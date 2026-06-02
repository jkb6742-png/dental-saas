#!/bin/bash
# NAS SSH 배포 스크립트
# 사용법: bash deploy.sh [NAS_IP] [NAS_USER]
# 예시:   bash deploy.sh 192.168.0.100 admin

NAS_IP="${1:-192.168.0.100}"
NAS_USER="${2:-admin}"
REMOTE_DIR="/volume1/docker/dental-saas"

echo "🦷 덴탈 인사이트 NAS 배포 시작..."
echo "→ 대상: ${NAS_USER}@${NAS_IP}:${REMOTE_DIR}"

# 소스 전송 (node_modules, .next 제외)
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  ./ "${NAS_USER}@${NAS_IP}:${REMOTE_DIR}/"

echo "→ 파일 전송 완료. 빌드 및 실행 중..."

# NAS에서 실행
ssh "${NAS_USER}@${NAS_IP}" << EOF
  cd "${REMOTE_DIR}"

  # .env 없으면 예시에서 복사
  [ ! -f .env ] && cp .env.example .env && echo "⚠️ .env 파일을 수정해주세요" && exit 1

  # DB 마이그레이션 + 앱 실행
  docker compose down
  docker compose build --no-cache
  docker compose up -d

  # Prisma 마이그레이션
  sleep 10
  docker compose exec app npx prisma migrate deploy

  echo "✅ 배포 완료!"
  docker compose ps
EOF
