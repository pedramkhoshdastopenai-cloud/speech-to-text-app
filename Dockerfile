# استفاده از نسخه سبک لینوکس که نود جی‌اس 18 داره
FROM node:18-bullseye-slim

# نصب پایتون، پیپ و FFmpeg (حیاتی برای پروژه ما)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# تنظیم دایرکتوری کاری
WORKDIR /app

# کپی کردن فایل‌های وابستگی پایتون و نصب آن‌ها
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# کپی کردن فایل‌های پروژه
COPY package*.json ./
RUN npm install

# کپی کردن کل سورس کد
COPY . .

# بیلد کردن پروژه نکست جی‌اس
RUN npm run build

# باز کردن پورت 3000
EXPOSE 3000

# دستور شروع برنامه
CMD ["npm", "start"]