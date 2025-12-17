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

    // 1. آماده‌سازی فایل
    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueId = Date.now();
    const tempInput = path.join(process.cwd(), `input_${uniqueId}`); 
    const tempOutput = path.join(process.cwd(), `output_${uniqueId}.mp3`);
    fs.writeFileSync(tempInput, buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(tempInput).toFormat('mp3').on('end', resolve).on('error', reject).save(tempOutput);
    });

    // 2. تبدیل صدا به متن (Whisper با جزئیات کامل)
    console.log("\n🎤 ================= NEW REQUEST =================");
    console.log("🎤 Step 1: Whisper Analysis (Verbose Mode)...");
    
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempOutput),
      model: "whisper-large-v3",
      language: "fa",
      response_format: "verbose_json", // دریافت جزئیات برای محاسبه نمره اطمینان
    });

    const rawText = transcription.text;
    
    // محاسبه نمره اطمینان (میانگین logprobs سگمنت‌ها)
    // هرچه به 0 نزدیک‌تر باشد (مثلا -0.1) یعنی اطمینان بالاتر است
    let avgLogprob = -1.0; 
    if (transcription.segments && transcription.segments.length > 0) {
        const sum = transcription.segments.reduce((acc: any, seg: any) => acc + seg.avg_logprob, 0);
        avgLogprob = sum / transcription.segments.length;
    }

    console.log(`📊 Confidence Score: ${avgLogprob.toFixed(4)}`);
    console.log("📝 Raw Text:", rawText);
    console.log("----------------------------------------------");

    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { /* cleanup */ }

    if (!rawText || rawText.trim().length === 0) return NextResponse.json({ text: "" });

    // 3. اجرای همزمان ۳ استراتژی برای مقایسه
    console.log("⚔️  Step 2: Strategy Battle...");

    // A. محافظه‌کار (فقط انگلیسی‌ها و علائم نگارشی)
    const promptConservative = `
    You are a strictly conservative Persian Editor.
    Task: Fix ONLY punctuation and English technical terms (to Latin).
    Constraints: DO NOT fix typos like "ثوم". DO NOT change casual style. Output ONLY text.
    `;

    // B. متعادل (اصلاح املایی + انگلیسی + حفظ لحن)
    const promptBalanced = `
    You are a smart Persian Editor.
    Rules:
    1. Fix spelling errors (e.g. "تست ثوم" -> "تست سوم").
    2. Convert English tech terms to Latin.
    3. KEEP the user's casual tone (e.g. keep "میکنه").
    Output ONLY text.
    `;

    // C. یادگیری با مثال (Few-Shot)
    const promptFewShot = `
    You are a Persian Text Corrector. Follow these examples:
    Input: "تست ثوم." -> Output: "تست سوم."
    Input: "نکس جی اس." -> Output: "Next.js."
    Input: "قست وام." -> Output: "قسط وام."
    Task: Correct the input based on patterns.
    `;

    // اجرای موازی (فقط برای تست، در نسخه نهایی فقط یکی اجرا می‌شود)
    const [resConservative, resBalanced, resFewShot] = await Promise.all([
        groq.chat.completions.create({ messages: [{ role: "system", content: promptConservative }, { role: "user", content: rawText }], model: "llama-3.3-70b-versatile", temperature: 0 }),
        groq.chat.completions.create({ messages: [{ role: "system", content: promptBalanced }, { role: "user", content: rawText }], model: "llama-3.3-70b-versatile", temperature: 0.1 }),
        groq.chat.completions.create({ messages: [{ role: "system", content: promptFewShot }, { role: "user", content: rawText }], model: "llama-3.3-70b-versatile", temperature: 0.1 })
    ]);

    const textConservative = resConservative.choices[0]?.message?.content?.trim();
    const textBalanced = resBalanced.choices[0]?.message?.content?.trim();
    const textFewShot = resFewShot.choices[0]?.message?.content?.trim();

    // 4. استراتژی هوشمند (Conditional Logic)
    let textSmart = "";
    let smartDecision = "";

    if (avgLogprob > -0.25) {
        // کیفیت عالی -> دست نزن (یا فقط محافظه‌کار)
        smartDecision = "🟢 High Confidence (Raw Text / Conservative)";
        textSmart = textConservative || rawText; // ترجیحاً محافظه‌کار برای علائم نگارشی
    } else if (avgLogprob > -0.7) {
        // کیفیت متوسط -> اصلاح هوشمند
        smartDecision = "🟡 Medium Confidence (Balanced Strategy)";
        textSmart = textBalanced || rawText;
    } else {
        // کیفیت پایین (نویز) -> محافظه‌کار باش که توهم نزنی
        smartDecision = "🔴 Low Confidence (Conservative / Raw)";
        textSmart = rawText; // در نویز شدید، متن خام امن‌تر است
    }

    // چاپ نتایج
    console.log("🛡️  Strategy A (Conservative):", textConservative);
    console.log("⚖️  Strategy B (Balanced):    ", textBalanced);
    console.log("💡 Strategy C (Few-Shot):    ", textFewShot);
    console.log(`🧠 Strategy D (Smart Logic):  [${smartDecision}] \n   ↳ Result: ${textSmart}`);
    console.log("==============================================\n");

    return NextResponse.json({ 
        text: textSmart, // خروجی نهایی نرم‌افزار، نتیجه هوشمند است
        mode: "battle-mode-smart" 
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}