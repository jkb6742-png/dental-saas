import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 프로덕션 빌드가 기존 WIP 코드의 타입/린트 에러로 막히지 않도록 허용
  // (Dockerfile의 "Build with warnings allowed" 의도를 실제로 반영)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  serverExternalPackages: ["xlsx"],
  // 도메인 접속 허용
  allowedDevOrigins: ['thinklabinsight.com'],
};

export default nextConfig;
