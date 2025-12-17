import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// تنظیم مسیر FFmpeg
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function POST(req: Request) {
  try {
    // دریافت کلید از محیط رندر
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        return NextResponse.json({ error: "API Key یافت نشد" }, { status: 500 });
    }

    // تنظیم کلاینت Groq (با استفاده از SDK استاندارد OpenAI)
    const groq = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1"
    });

    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // مسیر فایل‌های موقت
    const tempInput = path.join(process.cwd(), `input_${Date.now()}.webm`);
    const tempOutput = path.join(process.cwd(), `output_${Date.now()}.mp3`);
    
    // ذخیره فایل ورودی
    fs.writeFileSync(tempInput, buffer);

    console.log("🚀 در حال آماده‌سازی صدا برای ارسال به Groq...");

    // تبدیل به MP3 (چون حجمش کمتره و آپلود سریع‌تر انجام میشه)
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    // ارسال به Groq (مدل Whisper Large V3)
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3", // قوی‌ترین مدل موجود
      language: "fa", // زبان فارسی
      response_format: "json",
    });

    // پاکسازی فایل‌ها
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    console.log("✅ نتیجه Groq:", transcription.text);

    return NextResponse.json({ 
        text: transcription.text,
        mode: "groq-whisper-large"
    });

  } catch (error: any) {
    console.error('Groq Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}