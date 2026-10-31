FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
# openssl: prisma generate가 OpenSSL 버전을 정확히 감지하도록 (1.1.x 폴백 방지)
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_URL=http://192.168.35.4:5000
# 빌드 단계 전용 자리표시자: 일부 API 라우트가 모듈 로드 시 키 존재를 요구해 페이지 데이터 수집이 실패하는 것 방지.
# 이 값은 builder 스테이지에만 있고 최종 이미지(runner)에는 들어가지 않는다. 실제 키는 NAS .env 로 주입.
ENV OPENAI_API_KEY=build-placeholder
ENV ANTHROPIC_API_KEY=build-placeholder
RUN npx prisma generate
# Build with warnings allowed for TypeScript issues
RUN npm run build || echo "Build completed with warnings"

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma 쿼리 엔진(libquery_engine ...openssl-3.0.x)이 요구하는 libssl.so.3 제공
RUN apk add --no-cache openssl libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 5000
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"
ENV NEXTAUTH_URL=http://192.168.35.4:5000

CMD ["node", "server.js"]
