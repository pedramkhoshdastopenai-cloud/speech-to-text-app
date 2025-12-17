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
    
    // ذخیره فایل بدون پسوند برای تشخیص خودکار فرمت توسط FFmpeg
    const tempInput = path.join(process.cwd(), `input_${Date.now()}`); 
    const tempOutput = path.join(process.cwd(), `output_${Date.now()}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    console.log("🚀 در حال پردازش صدا...");

    // تبدیل به MP3
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    // ارسال به هوش مصنوعی با پرامپت اصلاح شده
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa",
      response_format: "json",
      prompt: "متن گفتار محاوره‌ای فارسی است. لطفاً آن را به صورت سلیس، با علائم نگارشی صحیح و نیم‌فاصله‌های درست تایپ کن."
    });

    // پاکسازی فایل‌ها
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    // حذف ایموجی و ارسال متن خالص
    const finalText = transcription.text || "";

    return NextResponse.json({ 
        text: finalText,
        mode: "groq-whisper-final"
    });

  } catch (error: any) {
    console.error('Groq Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}