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
    
    // ذخیره بدون پسوند برای تشخیص هوشمند فرمت
    const tempInput = path.join(process.cwd(), `input_${Date.now()}`); 
    const tempOutput = path.join(process.cwd(), `output_${Date.now()}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    // تبدیل به MP3
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    // ارسال به Groq با پرامپت عمومی و استاندارد
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa",
      response_format: "json",
      // 👇 این همان پرامپت طلایی برای استفاده عمومی است 👇
      prompt: "این متن، یک گفتگوی فارسی روان است که در آن واژگان انگلیسی (مثل ID, App, OK) با املای لاتین و کلمات فارسی با رعایت دقیق نیم‌فاصله (مانند «می‌شود» و «آن‌ها») و علائم نگارشی صحیح نوشته شده‌اند."
    });

    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { /* ignore */ }

    return NextResponse.json({ 
        text: transcription.text || "",
        mode: "groq-whisper-general"
    });

  } catch (error: any) {
    console.error('Groq Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}