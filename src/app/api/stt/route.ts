import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// اصلاح مهم: استفاده از Model با حرف بزرگ
import { Model, Recognizer } from 'vosk';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// تنظیم مسیر FFmpeg
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// مسیر مدل فارسی
const MODEL_PATH = path.join(process.cwd(), 'model');

// متغیر گلوبال برای نگهداری مدل (جهت جلوگیری از لود شدن مجدد در هر درخواست)
let globalModel: Model | null = null;

export async function POST(req: Request) {
  try {
    // 1. بررسی وجود پوشه مدل
    if (!fs.existsSync(MODEL_PATH)) {
        console.error("❌ پوشه مدل یافت نشد:", MODEL_PATH);
        return NextResponse.json({ 
            text: "خطا: مدل فارسی پیدا نشد. لطفا پوشه model را در ریشه پروژه قرار دهید." 
        }, { status: 500 });
    }

    // 2. لود کردن مدل (فقط یکبار)
    if (!globalModel) {
        console.log("🔄 در حال بارگذاری مدل Vosk در حافظه...");
        // تنظیم سطح لاگ برای جلوگیری از شلوغی ترمینال
        try {
            globalModel = new Model(MODEL_PATH); 
            // اگر متد setLogLevel روی کلاس Model استاتیک باشد یا روی instance:
            // در نسخه‌های جدید معمولاً نیازی به setLogLevel نیست یا به روش دیگری است
        } catch (e) {
            console.error("خطا در لود مدل:", e);
            return NextResponse.json({ error: "خطا در لود مدل زبان" }, { status: 500 });
        }
    }

    // 3. دریافت فایل
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // تعریف مسیر فایل‌های موقت
    const tempInput = path.join(process.cwd(), `temp_in_${Date.now()}.webm`);
    const tempOutput = path.join(process.cwd(), `temp_out_${Date.now()}.wav`);
    
    // ذخیره فایل ورودی
    fs.writeFileSync(tempInput, buffer);

    console.log("⚙️ در حال تبدیل فرمت فایل صوتی...");

    // 4. تبدیل فرمت با FFmpeg به فرمت دقیق مورد نیاز Vosk
    await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
            .toFormat('wav')
            .audioChannels(1)          // مونو
            .audioFrequency(16000)     // 16 کیلوهرتز
            .on('end', resolve)
            .on('error', (err) => reject(err))
            .save(tempOutput);
    });

    // 5. پردازش با Vosk
    const rec = new Recognizer({ model: globalModel, sampleRate: 16000 });
    
    const wavBuffer = fs.readFileSync(tempOutput);
    rec.acceptWaveform(wavBuffer);
    
    const result = rec.finalResult();
    rec.free();

    // 6. پاکسازی
    try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) { /* ignore */ }

    console.log("✅ نتیجه:", result.text);

    return NextResponse.json({ 
        text: result.text || "",
        mode: "server-vosk-offline"
    });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}