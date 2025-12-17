import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key Not Found" }, { status: 500 });

    const groq = new OpenAI({ apiKey: apiKey, baseURL: "https://api.groq.com/openai/v1" });

    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueId = Date.now();
    const tempInput = path.join(process.cwd(), `input_${uniqueId}`); 
    const tempOutput = path.join(process.cwd(), `output_${uniqueId}.mp3`);
    
    fs.writeFileSync(tempInput, buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(tempInput).toFormat('mp3').on('end', resolve).on('error', reject).save(tempOutput);
    });

    console.log("🎤 Step 1: Transcribing...");
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa",
      response_format: "json",
    });

    const rawText = transcription.text;
    console.log("📝 Raw Text:", rawText);

    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { console.error("Cleanup error", e); }

    if (!rawText || rawText.trim().length === 0) return NextResponse.json({ text: "" });

    // 🔴 تغییر استراتژی: پرامپت محافظه‌کار (Conservative Prompt)
    console.log("🧠 Step 2: Minimalist Correction...");
    
    const systemPrompt = `
    You are a strictly conservative Persian Transcription Corrector.
    
    INPUT: Raw text from speech-to-text.
    OUTPUT: The exact same text, with ONLY specific technical fixes.
    
    🚫 NEGATIVE CONSTRAINTS (DO NOT DO THESE):
    1. DO NOT change the style. If the user speaks casually (e.g., "میکنه"), DO NOT make it formal ("می‌کند").
    2. DO NOT change synonyms. (e.g., NEVER change "خراب" to "بدتر").
    3. DO NOT change the meaning. (e.g., NEVER change "خوبی" to "خوبم").
    4. DO NOT remove words like "خیلی" or "واقعا" even if they seem redundant.
    
    ✅ ALLOWED FIXES (ONLY DO THESE):
    1. Fix obvious homophone errors (e.g., "قست" -> "قسط").
    2. Convert English technical terms to Latin script (e.g., "نکس جی اس" -> "Next.js").
    3. Fix punctuation.
    
    If the raw text is mostly correct, return it EXACTLY as is.
    `;

    const correction = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText }
        ],
        model: "llama3-70b-8192", 
        temperature: 0, // دمای صفر: یعنی هیچ خلاقیتی به خرج نده! (مهم‌ترین نکته)
    });

    const finalText = correction.choices[0]?.message?.content?.trim() || rawText;
    console.log("✅ Final Text:", finalText);

    return NextResponse.json({ 
        text: finalText,
        mode: "conservative-fix" 
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}