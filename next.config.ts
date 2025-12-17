import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // این بخش حیاتی است: پکیج‌های سنگین را از بیلد خارج می‌کند
    serverComponentsExternalPackages: ['vosk', 'fluent-ffmpeg', 'ffmpeg-static'],
    
    serverActions: {
      allowedOrigins: [
        'localhost:3000', 
        // آدرس تونل خود را اگر دارید اینجا بگذارید (مثل مرحله قبل)
        // 'xxxx-xxxx.devtunnels.ms', 
      ],
    },
  },
  // حل مشکل ایمپورت ماژول‌های قدیمی در وب‌پک
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })
    return config
  },
};

export default nextConfig;