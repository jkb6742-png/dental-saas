# NAS 환경용 Multi-stage Dockerfile (최적화)
FROM node:18-alpine AS base

# NAS 최적화를 위한 환경변수
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 필수 시스템 패키지 설치
RUN apk add --no-cache \
    libc6-compat \
    curl \
    tzdata \
    && corepack enable

WORKDIR /app

# Dependencies stage (캐싱 최적화)
FROM base AS deps

# 패키지 파일들 복사
COPY package*.json yarn.lock* pnpm-lock.yaml* ./

# 의존성 설치 (NAS 메모리 절약)
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile --production; \
  elif [ -f package-lock.json ]; then npm ci --omit=dev --cache /tmp/.npm; \
  elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; \
  else echo "Warning: Lockfile not found." && npm install --production; \
  fi

# Builder stage (빌드 최적화)
FROM base AS builder

# 캐시된 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# NAS 환경용 빌드 설정
ENV NEXT_BUILD_MEMORY_LIMIT=1024
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Prisma 클라이언트 생성
RUN npx prisma generate

# Next.js 빌드 (NAS 최적화)
RUN \
  if [ -f yarn.lock ]; then yarn build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then pnpm build; \
  else npm run build; \
  fi

# Production stage (런타임 최적화)
FROM base AS runner

# 보안을 위한 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 필요한 디렉토리 생성
RUN mkdir -p /app/cache /app/uploads /app/logs
RUN chown -R nextjs:nodejs /app

# 빌드된 애플리케이션 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 프로덕션 의존성 설치 (최소한만)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# NAS 헬스체크 스크립트
COPY <<EOF /app/healthcheck.sh
#!/bin/sh
set -e

# 기본 HTTP 헬스체크
if ! curl -f http://localhost:3000/api/health; then
    exit 1
fi

# 메모리 사용량 체크 (NAS 중요)
MEMORY_USAGE=\$(cat /proc/meminfo | grep MemAvailable | awk '{print \$2}')
if [ \$MEMORY_USAGE -lt 102400 ]; then  # 100MB 미만이면 경고
    echo "Warning: Low memory available: \${MEMORY_USAGE}KB"
fi

echo "Health check passed"
exit 0
EOF

RUN chmod +x /app/healthcheck.sh && chown nextjs:nodejs /app/healthcheck.sh

# 사용자 전환
USER nextjs

# 포트 노출
EXPOSE 3000

# 환경변수
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# NAS 최적화 Node.js 옵션
ENV NODE_OPTIONS="--max-old-space-size=768 --optimize-for-size"

# 애플리케이션 시작
CMD ["node", "server.js"]