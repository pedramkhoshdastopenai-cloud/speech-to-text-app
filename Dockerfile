FROM node:18-slim

# نصب ابزارهای مورد نیاز سیستم (لینوکس)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# نصب کتابخانه پایتون
RUN pip3 install --no-cache-dir speechrecognition --break-system-packages || \
    pip3 install --no-cache-dir speechrecognition

COPY . .
RUN npm run build

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]