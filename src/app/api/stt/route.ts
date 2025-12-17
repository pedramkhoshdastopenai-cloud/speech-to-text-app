import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// تنظیم مسیر FFmpeg
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        return NextResponse.json({ error: "API Key یافت نشد" }, { status: 500 });
    }

    const groq = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1"
    });

    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // اصلاح ۱: فایل ورودی را بدون پسوند ذخیره می‌کنیم تا FFmpeg خودش هدر فایل را بخواند
    // این کار مشکل فرمت m4a آیفون را حل می‌کند
    const tempInput = path.join(process.cwd(), `input_${Date.now()}`); 
    const tempOutput = path.join(process.cwd(), `output_${Date.now()}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    console.log("🚀 در حال تبدیل فرمت هوشمند...");

    // تبدیل به MP3 استاندارد
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    // اصلاح ۲: اضافه کردن پرامپت برای افزایش دقت و اصلاح جمله‌بندی
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa", // زبان فارسی
      response_format: "json",
      // این خط جادو می‌کند! به هوش مصنوعی زمینه می‌دهد:
      prompt: "متن گفتار محاوره‌ای فارسی است. لطفاً آن را به صورت سلیس، با علائم نگارشی صحیح و نیم‌فاصله‌های درست تایپ کن."
    });

    // پاکسازی فایل‌ها
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    console.log("✅ نتیجه:", transcription.text);

    // اصلاح ۳: اضافه کردن ایموجی برای تشخیص منبع
    // اگر درخواست از شورتکات بیاید این ایموجی را می‌بینید
    const finalText = transcription.text ? `🤖 ${transcription.text}` : "";

    return NextResponse.json({ 
        text: finalText,
        mode: "groq-whisper-optimized"
    });

  } catch (error: any) {
    console.error('Groq Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}