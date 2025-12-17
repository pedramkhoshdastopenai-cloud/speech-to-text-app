# استفاده از نسخه پایدار نود
FROM node:18-slim

# نصب پایتون و ابزارهای مورد نیاز سیستم
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    make \
    g++ \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# تعیین دایرکتوری کاری
WORKDIR /app

# کپی فایل‌های پکیج نود
COPY package*.json ./

# نصب پکیج‌های نود (بدون vosk)
RUN npm install

# نصب کتابخانه‌های پایتون مورد نیاز اسکریپت stt_engine.py
# نصب speech_recognition و کتابخانه گوگل
RUN pip3 install --no-cache-dir \
    speechrecognition \
    google-cloud-speech \
    --break-system-packages || \
    pip3 install --no-cache-dir \
    speechrecognition \
    google-cloud-speech

# کپی کل پروژه (شامل stt_engine.py)
COPY . .

# بیلد کردن پروژه نکس‌جی‌اس
RUN npm run build

# تنظیم پورت
ENV PORT=10000
EXPOSE 10000

# دستور شروع به کار
CMD ["npm", "start"]