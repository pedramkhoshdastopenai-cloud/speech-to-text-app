import sys
import json
import speech_recognition as sr
import os
import subprocess

def transcribe_audio(input_path):
    # مسیر فایل موقت برای تبدیل
    wav_path = input_path.replace(".mp3", ".wav")
    
    try:
        # تبدیل قطعی هر فرمتی (MP3, WebM, M4A) به WAV استاندارد
        # استفاده از ffmpeg سیستمی که ۱۰۰٪ پایدار است
        subprocess.run([
            'ffmpeg', '-y', '-i', input_path, 
            '-ar', '16000', '-ac', '1', wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        r = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = r.record(source)
            # استفاده از موتور گوگل
            text = r.recognize_google(audio_data, language="fa-IR")
            return {"text": text}
            
    except Exception as e:
        return {"error": str(e)}
    finally:
        # پاکسازی فایل‌های موقت
        if os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    # خروجی نهایی فقط یک JSON تمیز برای نودجی‌اس
    print(json.dumps(transcribe_audio(sys.argv[1])))