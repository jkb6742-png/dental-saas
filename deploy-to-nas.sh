#!/bin/bash

# Dental SaaS NAS 배포 스크립트
# 작성일: 2026-06-08
# 설명: 현재 버전을 NAS로 업데이트

set -e

echo "🚀 Dental SaaS NAS 배포 시작..."

# 환경 변수 확인
if [ -z "$NAS_HOST" ]; then
    echo "❌ NAS_HOST 환경변수가 설정되지 않았습니다."
    echo "예: export NAS_HOST=192.168.1.100"
    exit 1
fi

if [ -z "$NAS_USER" ]; then
    echo "❌ NAS_USER 환경변수가 설정되지 않았습니다."
    echo "예: export NAS_USER=admin"
    exit 1
fi

NAS_PATH="/volume1/docker/dental-saas"
BACKUP_PATH="/volume1/docker/dental-saas-backup-$(date +%Y%m%d_%H%M%S)"

echo "📋 배포 정보:"
echo "   - NAS 호스트: $NAS_HOST"
echo "   - NAS 사용자: $NAS_USER"
echo "   - 배포 경로: $NAS_PATH"
echo "   - 백업 경로: $BACKUP_PATH"

# 1. 현재 버전 백업
echo "📦 기존 버전 백업 중..."
ssh $NAS_USER@$NAS_HOST "
    if [ -d $NAS_PATH ]; then
        echo '   기존 버전을 백업합니다...'
        cp -r $NAS_PATH $BACKUP_PATH
        echo '   백업 완료: $BACKUP_PATH'
    else
        echo '   기존 설치가 없습니다. 신규 설치를 진행합니다.'
    fi
"

# 2. Git 상태 확인
echo "🔍 Git 상태 확인 중..."
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 커밋되지 않은 변경사항이 있습니다."
    git status
    echo "변경사항을 커밋한 후 다시 시도하세요."
    exit 1
fi

CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)
echo "   현재 브랜치: $CURRENT_BRANCH"
echo "   현재 커밋: $CURRENT_COMMIT"

# 3. 배포 패키지 생성
echo "📦 배포 패키지 생성 중..."
DEPLOY_ARCHIVE="dental-saas-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

# 필요한 파일들만 패키징 (node_modules 제외)
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='*.log' \
    --exclude='uploads' \
    --exclude='cache' \
    --exclude='*.tmp' \
    -czf $DEPLOY_ARCHIVE .

echo "   패키지 생성 완료: $DEPLOY_ARCHIVE"

# 4. NAS로 파일 전송
echo "📤 NAS로 파일 전송 중..."
scp $DEPLOY_ARCHIVE $NAS_USER@$NAS_HOST:/tmp/

# 5. NAS에서 배포 실행
echo "🔧 NAS에서 배포 실행 중..."
ssh $NAS_USER@$NAS_HOST << EOF
    set -e

    # 배포 디렉토리 생성
    mkdir -p $NAS_PATH
    cd $NAS_PATH

    # 기존 파일 정리 (백업 제외)
    if [ -f docker-compose.nas.yml ]; then
        echo "   기존 컨테이너 중지 중..."
        docker-compose -f docker-compose.nas.yml down || true
    fi

    # 새 파일 압축 해제
    echo "   새 버전 배포 중..."
    tar -xzf /tmp/$DEPLOY_ARCHIVE -C $NAS_PATH

    # 권한 설정
    chown -R $NAS_USER:users $NAS_PATH
    chmod -R 755 $NAS_PATH

    # 환경 설정
    if [ ! -f .env ]; then
        echo "   환경 설정 파일 생성 중..."
        cp .env.example .env
        echo "   ⚠️  .env 파일을 수정하세요!"
    fi

    # Docker 이미지 빌드
    echo "   Docker 이미지 빌드 중..."
    docker-compose -f docker-compose.nas.yml build --no-cache

    # 데이터베이스 초기화 (신규 설치시에만)
    if [ ! -d "/volume1/docker/dental-saas/postgres_data" ]; then
        echo "   데이터베이스 초기 설정 중..."
        mkdir -p /volume1/docker/dental-saas/postgres_data
    fi

    # 서비스 시작
    echo "   서비스 시작 중..."
    docker-compose -f docker-compose.nas.yml up -d

    # 임시 파일 정리
    rm -f /tmp/$DEPLOY_ARCHIVE

    echo "   배포 완료!"
EOF

# 6. 로컬 임시 파일 정리
rm -f $DEPLOY_ARCHIVE

# 7. 배포 결과 확인
echo "🔍 배포 결과 확인 중..."
sleep 10

ssh $NAS_USER@$NAS_HOST "
    cd $NAS_PATH
    echo '   컨테이너 상태:'
    docker-compose -f docker-compose.nas.yml ps

    echo
    echo '   애플리케이션 로그:'
    docker-compose -f docker-compose.nas.yml logs --tail=20 dental-app || true
"

# 8. 완료 메시지
echo
echo "🎉 배포 완료!"
echo "   📍 접속 주소: http://$NAS_HOST:3000"
echo "   📦 백업 위치: $BACKUP_PATH"
echo "   📋 Git 커밋: $CURRENT_COMMIT"
echo
echo "📝 배포 후 확인사항:"
echo "   1. .env 파일 설정 확인"
echo "   2. 데이터베이스 마이그레이션 확인"
echo "   3. 웹 접속 테스트"
echo "   4. 파일 업로드 테스트"
echo
echo "🔗 유용한 명령어:"
echo "   - 로그 확인: ssh $NAS_USER@$NAS_HOST 'cd $NAS_PATH && docker-compose -f docker-compose.nas.yml logs -f'"
echo "   - 서비스 재시작: ssh $NAS_USER@$NAS_HOST 'cd $NAS_PATH && docker-compose -f docker-compose.nas.yml restart'"
echo "   - 백업 복원: ssh $NAS_USER@$NAS_HOST 'rm -rf $NAS_PATH && mv $BACKUP_PATH $NAS_PATH'"