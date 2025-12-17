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
    
    // استفاده از شناسه یکتا برای جلوگیری از تداخل فایل‌ها
    const uniqueId = Date.now();
    const tempInput = path.join(process.cwd(), `input_${uniqueId}`); 
    const tempOutput = path.join(process.cwd(), `output_${uniqueId}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    // تبدیل فرمت به MP3 (این قسمت برای سازگاری با آیفون حیاتی است)
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    console.log("🎤 Sending to Whisper V3...");

    // ارسال به هوش مصنوعی (فقط Whisper)
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3", // دقیق‌ترین مدل موجود
      language: "fa",
      response_format: "json",
      // این پرامپت فقط برای "استایل" دادن به خودِ ویسپر است و خطری ندارد
      prompt: "متن گفتار فارسی روان، با رعایت علائم نگارشی و نوشتن صحیح کلمات انگلیسی مثل React و API."
    });

    // پاکسازی فایل‌های موقت
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    console.log("✅ Result:", transcription.text);

    return NextResponse.json({ 
        text: transcription.text,
        mode: "pure-whisper-v3"
    });

  } catch (error: any) {
    console.error('Groq Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}