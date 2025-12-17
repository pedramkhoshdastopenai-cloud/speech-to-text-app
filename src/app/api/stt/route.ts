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
    if (!apiKey) return NextResponse.json({ error: "API Key یافت نشد" }, { status: 500 });

    const groq = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1"
    });

    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    // 1. آماده‌سازی فایل
    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueId = Date.now();
    const tempInput = path.join(process.cwd(), `input_${uniqueId}`); 
    const tempOutput = path.join(process.cwd(), `output_${uniqueId}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    // 2. تبدیل به MP3 استاندارد
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput).toFormat('mp3').on('end', resolve).on('error', reject).save(tempOutput);
    });

    // 3. تبدیل صدا به متن (Whisper - Step 1)
    console.log("🎤 Step 1: Transcribing Audio...");
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa",
      response_format: "json",
    });

    const rawText = transcription.text;
    console.log("📝 Raw Text:", rawText);

    // پاکسازی فایل‌ها
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json({ text: "" });
    }

    // 4. اصلاح هوشمند با استراتژی Few-Shot (Llama 3 - Step 2)
    console.log("🧠 Step 2: Intelligent Correction (Few-Shot Strategy)...");
    
    // 👇 پرامپت برنده (مدل A) 👇
    const systemPrompt = `
You are a smart Persian Text Corrector.
INPUT: Raw speech-to-text transcript.
OUTPUT: Corrected text.

Follow these examples exactly to understand the style:

Input: "من رفتم بانک تا قست بدم."
Output: "من رفتم بانک تا قسط بدم." (Context: Bank implies 'Ghest')

Input: "برنامه نکس جی اس رو ران کن."
Output: "برنامه Next.js رو Run کن." (Tech terms to English)

Input: "روی سرور نود جی اس یه فایل نوت گذاشتم."
Output: "روی سرور Node.js یه فایل Note گذاشتم." (Distinguish Node vs Note)

Input: "هزینه میشه صد تومن نه دویست تومن."
Output: "هزینه میشه دویست تومن." (Keep final correction)

Input: "فایل رو چیز کن بفرست."
Output: "فایل رو بفرست." (Remove meaningless filler words)

Input: "قیمت کالا سفر تومن است."
Output: "قیمت کالا صفر تومن است."

Task: Correct the user input based on these patterns. Return ONLY the corrected text.
    `;

    const correction = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText }
        ],
        model: "llama3-70b-8192", 
        temperature: 0.1, // دمای پایین برای رعایت دقیق الگوها
    });

    const finalText = correction.choices[0]?.message?.content?.trim() || rawText;
    console.log("✅ Final Text:", finalText);

    return NextResponse.json({ 
        text: finalText,
        mode: "groq-hybrid-fewshot" 
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}