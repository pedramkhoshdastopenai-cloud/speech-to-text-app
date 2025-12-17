import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uniqueId = Date.now();
    const tempDir = '/tmp'; 
    const tempFilePath = path.join(tempDir, `audio_${uniqueId}.mp3`);
    
    // نوشتن فایل دریافتی در پوشه موقت
    fs.writeFileSync(tempFilePath, buffer);

    console.log("🚀 Running Python Microservice for iPhone/Google processing...");

    // اجرای موتور پایتونی که قبلاً نوشتیم
    // این اسکریپت خروجی را به صورت JSON در stdout چاپ می‌کند
    const { stdout, stderr } = await execPromise(`python3 stt_engine.py "${tempFilePath}"`);

    // پاک کردن فایل موقت
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    if (stderr) {
        console.error("Python Stderr:", stderr);
    }

    console.log("🐍 Python Microservice Output:", stdout);

    try {
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        
        // برگرداندن متن استخراج شده توسط گوگل (از طریق پایتون) به کلاینت
        return NextResponse.json({ 
            text: result.text,
            mode: "google-embedded-python"
        });
        
    } catch (e) {
        return NextResponse.json({ error: "خطا در پردازش خروجی موتور پایتون" }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}