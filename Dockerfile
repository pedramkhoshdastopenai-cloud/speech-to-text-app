# استفاده از نسخه پایدار نود
FROM node:18-slim

# نصب پایتون و ابزارهای مورد نیاز برای میکروسرویس و بیلد
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# تعیین دایرکتوری کاری
WORKDIR /app

# کپی فایل‌های پکیج
COPY package*.json ./

# نصب پکیج‌ها (بدون نصب vosk که مشکل ایجاد می‌کرد)
RUN npm install

# نصب کتابخانه‌های پایتون مورد نیاز برای میکروسرویس گوگل
# اگر فایل requirements.txt دارید از آن استفاده کنید، در غیر این صورت دستی نصب می‌کنیم
RUN pip3 install --no-cache-dir google-cloud-speech --break-system-packages || \
    pip3 install --no-cache-dir google-cloud-speech

# کپی کل پروژه
COPY . .

# بیلد کردن پروژه نکس‌جی‌اس
RUN npm run build

# تنظیم پورت به صورت داینامیک
# این خط باعث می‌شود اگر PORT در محیط تعریف شده بود استفاده شود، در غیر این صورت 10000
ENV PORT=10000
EXPOSE 10000

# دستور شروع به کار
CMD ["npm", "start"]