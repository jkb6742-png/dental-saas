# Dental SaaS NAS 배포 PowerShell 스크립트
# 작성일: 2026-06-08
# 설명: 현재 버전을 NAS로 업데이트 (Windows용)

param(
    [Parameter(Mandatory=$true)]
    [string]$NASHost,

    [Parameter(Mandatory=$true)]
    [string]$NASUser,

    [string]$NASPath = "/volume1/docker/dental-saas"
)

# 오류 발생 시 스크립트 중단
$ErrorActionPreference = "Stop"

Write-Host "🚀 Dental SaaS NAS 배포 시작..." -ForegroundColor Green

# Git 상태 확인
Write-Host "🔍 Git 상태 확인 중..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ 커밋되지 않은 변경사항이 있습니다." -ForegroundColor Red
    git status
    Write-Host "변경사항을 커밋한 후 다시 시도하세요." -ForegroundColor Red
    exit 1
}

$currentCommit = git rev-parse HEAD
$currentBranch = git branch --show-current
Write-Host "   현재 브랜치: $currentBranch" -ForegroundColor Cyan
Write-Host "   현재 커밋: $currentCommit" -ForegroundColor Cyan

# 배포 패키지 생성
Write-Host "📦 배포 패키지 생성 중..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployArchive = "dental-saas-deploy-$timestamp.tar.gz"

# tar 명령어로 패키지 생성 (Windows에서 tar 사용)
$excludePatterns = @(
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=.next",
    "--exclude=*.log",
    "--exclude=uploads",
    "--exclude=cache",
    "--exclude=*.tmp"
)

Write-Host "   패키징 중... (node_modules 제외)" -ForegroundColor Gray
& tar $excludePatterns -czf $deployArchive .

if (-not (Test-Path $deployArchive)) {
    Write-Host "❌ 패키지 생성 실패" -ForegroundColor Red
    exit 1
}

Write-Host "   패키지 생성 완료: $deployArchive" -ForegroundColor Green

# SSH 연결 테스트
Write-Host "🔗 NAS 연결 테스트 중..." -ForegroundColor Yellow
try {
    $testResult = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$NASUser@$NASHost" "echo 'Connection successful'"
    if ($testResult -ne "Connection successful") {
        throw "Connection failed"
    }
    Write-Host "   NAS 연결 성공" -ForegroundColor Green
} catch {
    Write-Host "❌ NAS 연결 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "SSH 키 설정이나 네트워크 연결을 확인하세요." -ForegroundColor Yellow
    Remove-Item $deployArchive -ErrorAction SilentlyContinue
    exit 1
}

# 백업 생성
Write-Host "📦 기존 버전 백업 중..." -ForegroundColor Yellow
$backupPath = "/volume1/docker/dental-saas-backup-$timestamp"

ssh "$NASUser@$NASHost" @"
    if [ -d '$NASPath' ]; then
        echo '   기존 버전을 백업합니다...'
        cp -r '$NASPath' '$backupPath'
        echo '   백업 완료: $backupPath'
    else
        echo '   기존 설치가 없습니다. 신규 설치를 진행합니다.'
        mkdir -p '$NASPath'
    fi
"@

# 파일 전송
Write-Host "📤 NAS로 파일 전송 중..." -ForegroundColor Yellow
try {
    scp $deployArchive "${NASUser}@${NASHost}:/tmp/"
    Write-Host "   파일 전송 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 파일 전송 실패: $($_.Exception.Message)" -ForegroundColor Red
    Remove-Item $deployArchive
    exit 1
}

# NAS에서 배포 실행
Write-Host "🔧 NAS에서 배포 실행 중..." -ForegroundColor Yellow

$deployScript = @"
set -e

echo "   배포 디렉토리로 이동 중..."
cd '$NASPath'

# 기존 컨테이너 중지
if [ -f docker-compose.nas.yml ]; then
    echo "   기존 컨테이너 중지 중..."
    docker-compose -f docker-compose.nas.yml down 2>/dev/null || true
fi

# 새 파일 압축 해제
echo "   새 버전 배포 중..."
tar -xzf /tmp/$deployArchive -C '$NASPath'

# 권한 설정
echo "   권한 설정 중..."
chown -R '$NASUser':users '$NASPath' 2>/dev/null || true
chmod -R 755 '$NASPath'

# 환경 설정 확인
if [ ! -f .env ]; then
    echo "   환경 설정 파일 생성 중..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "   ⚠️  .env 파일을 수정하세요!"
    else
        echo "   ⚠️  .env.example 파일이 없습니다. .env 파일을 직접 생성하세요."
    fi
fi

# 필요한 디렉토리 생성
echo "   필요한 디렉토리 생성 중..."
mkdir -p /volume1/docker/dental-saas/cache
mkdir -p /volume1/docker/dental-saas/uploads
mkdir -p /volume1/docker/dental-saas/logs
mkdir -p /volume1/docker/dental-saas/postgres_data

# Docker 이미지 빌드
echo "   Docker 이미지 빌드 중..."
if [ -f docker-compose.nas.yml ]; then
    docker-compose -f docker-compose.nas.yml build --no-cache

    # 서비스 시작
    echo "   서비스 시작 중..."
    docker-compose -f docker-compose.nas.yml up -d
else
    echo "   ❌ docker-compose.nas.yml 파일을 찾을 수 없습니다."
    exit 1
fi

# 임시 파일 정리
rm -f /tmp/$deployArchive

echo "   ✅ 배포 완료!"
"@

try {
    ssh "$NASUser@$NASHost" $deployScript
    Write-Host "   배포 스크립트 실행 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 배포 실행 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "백업에서 복원할 수 있습니다: $backupPath" -ForegroundColor Yellow
    Remove-Item $deployArchive
    exit 1
}

# 로컬 임시 파일 정리
Remove-Item $deployArchive

# 배포 결과 확인
Write-Host "🔍 배포 결과 확인 중..." -ForegroundColor Yellow
Start-Sleep 10

try {
    Write-Host "   컨테이너 상태:" -ForegroundColor Cyan
    ssh "$NASUser@$NASHost" "cd '$NASPath' && docker-compose -f docker-compose.nas.yml ps"

    Write-Host "`n   최근 애플리케이션 로그:" -ForegroundColor Cyan
    ssh "$NASUser@$NASHost" "cd '$NASPath' && docker-compose -f docker-compose.nas.yml logs --tail=10 dental-app" 2>$null
} catch {
    Write-Host "   ⚠️  로그 확인 중 오류 발생 (정상적일 수 있음)" -ForegroundColor Yellow
}

# 완료 메시지
Write-Host "`n🎉 배포 완료!" -ForegroundColor Green
Write-Host "   📍 접속 주소: http://${NASHost}:3000" -ForegroundColor Cyan
Write-Host "   📦 백업 위치: $backupPath" -ForegroundColor Cyan
Write-Host "   📋 Git 커밋: $currentCommit" -ForegroundColor Cyan

Write-Host "`n📝 배포 후 확인사항:" -ForegroundColor Yellow
Write-Host "   1. .env 파일 설정 확인" -ForegroundColor Gray
Write-Host "   2. 데이터베이스 마이그레이션 확인" -ForegroundColor Gray
Write-Host "   3. 웹 접속 테스트" -ForegroundColor Gray
Write-Host "   4. 파일 업로드 테스트" -ForegroundColor Gray

Write-Host "`n🔗 유용한 명령어:" -ForegroundColor Yellow
Write-Host "   - 로그 확인:" -ForegroundColor Gray
Write-Host "     ssh $NASUser@$NASHost 'cd $NASPath && docker-compose -f docker-compose.nas.yml logs -f'" -ForegroundColor DarkGray
Write-Host "   - 서비스 재시작:" -ForegroundColor Gray
Write-Host "     ssh $NASUser@$NASHost 'cd $NASPath && docker-compose -f docker-compose.nas.yml restart'" -ForegroundColor DarkGray
Write-Host "   - 백업 복원:" -ForegroundColor Gray
Write-Host "     ssh $NASUser@$NASHost 'rm -rf $NASPath && mv $backupPath $NASPath'" -ForegroundColor DarkGray

Write-Host "`n📱 브라우저에서 http://${NASHost}:3000 으로 접속해서 테스트하세요!" -ForegroundColor Green