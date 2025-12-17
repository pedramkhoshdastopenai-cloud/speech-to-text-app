FROM node:18-slim

# ۱. نصب پایتون و ابزار FFmpeg به صورت سیستمی (بسیار حیاتی)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ۲. نصب وابستگی‌های Node.js
COPY package*.json ./
RUN npm install

# ۳. نصب فقط کتابخانه اصلی تشخیص صدا در پایتون
RUN pip3 install --no-cache-dir speechrecognition --break-system-packages || \
    pip3 install --no-cache-dir speechrecognition

COPY . .

# ۴. بیلد پروژه
RUN npm run build

# ۵. تنظیمات پورت Render
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]