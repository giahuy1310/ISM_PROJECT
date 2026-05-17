import type { NextConfig } from "next";

const projectDir = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectDir,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
