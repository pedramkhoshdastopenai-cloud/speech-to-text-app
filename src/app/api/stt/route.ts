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
    
    // مسیردهی فایل موقت
    const uniqueId = Date.now();
    const tempDir = '/tmp'; // در Docker و Render پوشه tmp بهترین جاست
    const tempFilePath = path.join(tempDir, `audio_${uniqueId}.mp3`);
    
    fs.writeFileSync(tempFilePath, buffer);

    console.log("🚀 Executing Python Engine...");

    // اجرای اسکریپت پایتون
    // python3 stt_engine.py /tmp/audio_123.mp3
    const { stdout, stderr } = await execPromise(`python3 stt_engine.py "${tempFilePath}"`);

    // پاک کردن فایل اصلی
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    if (stderr) {
        console.error("Python Stderr:", stderr);
    }

    console.log("🐍 Python Output:", stdout);

    // تبدیل خروجی JSON پایتون به آبجکت جاوااسکریپت
    try {
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        
        return NextResponse.json({ 
            text: result.text,
            mode: "google-embedded-python"
        });
        
    } catch (e) {
        return NextResponse.json({ error: "خطا در پردازش خروجی پایتون" }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}