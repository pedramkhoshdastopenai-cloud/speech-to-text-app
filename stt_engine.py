import sys
import json
import speech_recognition as sr
import os
import subprocess

def transcribe_audio(input_path):
    is_wav = input_path.lower().endswith('.wav')
    wav_path = input_path if is_wav else input_path + ".wav"
    
    try:
        # تبدیل با FFmpeg (در لینوکس Render حتما نصب است)
        if not is_wav:
            subprocess.run([
                'ffmpeg', '-y', '-i', input_path, 
                '-ar', '16000', '-ac', '1', wav_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        r = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = r.record(source)
            # تشخیص فارسی
            text = r.recognize_google(audio_data, language="fa-IR")
            return {"text": text}
            
    except Exception as e:
        return {"error": f"Error: {str(e)}"}
    finally:
        if not is_wav and os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    print(json.dumps(transcribe_audio(sys.argv[1])))