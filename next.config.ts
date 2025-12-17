import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // در Next.js 15 این گزینه به ریشه کانفیگ منتقل شده است
  serverExternalPackages: ['vosk', 'fluent-ffmpeg', 'ffmpeg-static'],
  
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000', 
        // آدرس‌های تونل یا دامنه نهایی خود را اینجا اضافه کنید
      ],
    },
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })
    return config
  },
};

export default nextConfig;