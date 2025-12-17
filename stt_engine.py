import sys
import json
import speech_recognition as sr
from pydub import AudioSegment
import os

# تنظیم خروجی استاندارد به UTF-8 (برای فارسی حیاتی است)
sys.stdout.reconfigure(encoding='utf-8')

def main():
    try:
        # دریافت مسیر فایل از آرگومان‌های ورودی
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No file provided"}))
            sys.exit(1)

        input_file = sys.argv[1]
        
        # تبدیل به WAV
        wav_file = input_file + ".wav"
        sound = AudioSegment.from_file(input_file)
        sound.export(wav_file, format="wav")

        # ارسال به گوگل
        r = sr.Recognizer()
        with sr.AudioFile(wav_file) as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            audio_data = r.record(source)
            
            # دریافت متن
            text = r.recognize_google(audio_data, language="fa-IR")
            
            # چاپ خروجی به صورت JSON برای Next.js
            print(json.dumps({"text": text}))

    except sr.UnknownValueError:
        print(json.dumps({"text": ""})) # متن خالی یعنی شنیده نشد
    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        # پاکسازی فایل WAV موقت
        if 'wav_file' in locals() and os.path.exists(wav_file):
            os.remove(wav_file)

if __name__ == "__main__":
    main()