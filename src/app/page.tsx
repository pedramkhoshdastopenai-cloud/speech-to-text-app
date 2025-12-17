'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Mic, MicOff, Copy, Check, Globe, Cloud } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [liveTranscription, setLiveTranscription] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [copied, setCopied] = useState(false)
  const [useWebSpeech, setUseWebSpeech] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState('fa-IR')
  const [debugInfo, setDebugInfo] = useState('')
  const [isBrowserSupported, setIsBrowserSupported] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null) // از any استفاده کردیم تا با تایپ‌اسکریپت درگیر نشویم
  const { toast } = useToast()

  // Initialize Web Speech API
  const initWebSpeech = () => {
    // Check support
    if (typeof window === 'undefined') return false
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      toast({
        title: "عدم پشتیبانی",
        description: "مرورگر شما از قابلیت تبدیل گفتار پشتیبانی نمی‌کند. لطفاً از Chrome استفاده کنید.",
        variant: "destructive",
      })
      return false
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = selectedLanguage
      
      console.log('--- راه‌اندازی تشخیص گفتار ---')
      
      recognition.onresult = (event: any) => {
        let interimChunk = ''
        let finalChunk = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0].transcript
          
          if (result.isFinal) {
            finalChunk += text
          } else {
            interimChunk += text
          }
        }
        
        // اگر متن نهایی داشتیم، به متن اصلی اضافه کن
        if (finalChunk) {
          setTranscription(prev => {
            const newText = (prev + ' ' + finalChunk).trim()
            console.log('📝 متن نهایی ثبت شد:', newText)
            return newText
          })
          setLiveTranscription('') // متن زنده را پاک کن چون نهایی شد
        } 
        // اگر فقط متن زنده (در حال صحبت) بود
        else if (interimChunk) {
          setLiveTranscription(interimChunk)
          console.log('⚡ در حال شنیدن:', interimChunk)
        }
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech error:', event.error)
        
        // خطاهای رایج را نادیده می‌گیریم تا ضبط قطع نشود
        if (event.error === 'no-speech') return 
        
        setDebugInfo(prev => prev + `\nError: ${event.error}`)
        
        if (event.error === 'not-allowed') {
            setIsRecording(false)
            toast({
                title: "دسترسی میکروفون مسدود است",
                description: "لطفاً دسترسی مرورگر به میکروفون را بررسی کنید.",
                variant: "destructive"
            })
        }
      }
      
      recognition.onend = () => {
        // اگر کاربر دکمه توقف را نزده اما ضبط قطع شده، دوباره وصل شو (برای حالت پیوسته)
        if (isRecording) {
            try {
                recognition.start()
                console.log('🔄 اتصال مجدد خودکار...')
            } catch (e) {
                // اگر نشد، وضعیت ضبط را فالس کن
                setIsRecording(false)
            }
        }
      }
      
      recognitionRef.current = recognition
      return true
    } catch (error) {
      console.error('Init error:', error)
      return false
    }
  }

// تشخیص سیستم عامل iOS
  const isIOS = () => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  const startRecording = async () => {
    // اول چک کن اگر وب اسپیچ ساپورت میشه (مثل اندروید/دسکتاپ) از همون استفاده کن
    const supportsWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    
    // اگر ساپورت میشد و کاربر iOS نبود (چون گاهی iOS دروغ میگه که ساپورت میکنه ولی کار نمیکنه!)
    if (useWebSpeech && supportsWebSpeech && !isIOS()) {
      const initialized = initWebSpeech()
      if (initialized && recognitionRef.current) {
        try {
          setLiveTranscription('')
          recognitionRef.current.start()
          setIsRecording(true)
          setShowResult(true)
        } catch (error) {
          setIsRecording(false)
        }
      }
    } 
    // 🚀 بخش جدید: اگر iOS بود یا وب اسپیچ نداشت
    else {
      console.log("🍎 حالت iOS یا Server-Side فعال شد");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setIsProcessing(true);
          setShowResult(true);
          
          // ارسال به سرور خودمون
          const formData = new FormData();
          formData.append('audio', audioBlob);

          try {
            const response = await fetch('/api/stt', { // آدرس API جدید که ساختیم
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            setTranscription(prev => prev + ' ' + data.text);
          } catch (err) {
            toast({ title: "خطا در ارتباط با سرور", variant: "destructive" });
          } finally {
            setIsProcessing(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        toast({ title: "در حال ضبط برای پردازش در سرور..." });

      } catch (err) {
        toast({ title: "دسترسی میکروفون داده نشد", variant: "destructive" });
      }
    }
  }

const stopRecording = () => {
    // توقف وب اسپیچ
    if (recognitionRef.current && isRecording && !mediaRecorderRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
    // توقف ریکوردر (حالت iOS)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // این باعث میشه رویداد onstop اجرا بشه و فایل ارسال بشه
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); // بستن میکروفون
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }

  // Copy text
  const copyToClipboard = async () => {
    const textToCopy = (transcription + ' ' + liveTranscription).trim()
    if (!textToCopy) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "کپی شد!" })
    } catch (err) {
      toast({ title: "خطا در کپی", variant: "destructive" })
    }
  }

  // Check browser on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      setIsBrowserSupported(hasSupport && isHttps)
      
      if (!hasSupport) setUseWebSpeech(false)
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4 font-sans">
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">تبدیل گفتار به نوشتار</h1>
        <p className="text-slate-500">برای شروع صحبت کنید</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button 
          variant={useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(true)}
          disabled={!isBrowserSupported}
        >
            <Globe className="mr-2 h-4 w-4"/> Web Speech (رایگان)
        </Button>
        <Button 
          variant={!useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(false)}
        >
            <Cloud className="mr-2 h-4 w-4"/> Cloud API
        </Button>
      </div>

      {useWebSpeech && (
        <div className="mb-8 w-64">
             <select
                className="w-full p-2 rounded border border-gray-300 dark:bg-slate-800 dark:text-white"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
             >
                 <option value="fa-IR">فارسی</option>
                 <option value="en-US">English</option>
             </select>
        </div>
      )}

      {/* دکمه اصلی ضبط */}
      <Button
        size="lg"
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-24 h-24 rounded-full shadow-2xl transition-all duration-300 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isRecording ? <MicOff className="h-10 w-10"/> : <Mic className="h-10 w-10"/>}
      </Button>
      
      {isRecording && <p className="mt-4 text-red-500 font-medium animate-pulse">در حال ضبط...</p>}

      {/* مودال نمایش نتیجه */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-right">نتیجه</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
             {/* باکس نمایش متن */}
             <div className="min-h-[200px] p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-right" dir="rtl">
                <span className="text-slate-800 dark:text-slate-200 text-lg leading-relaxed">
                    {transcription}
                </span>
                {/* متن زنده به صورت کم‌رنگ‌تر */}
                <span className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed mr-1">
                    {liveTranscription}
                </span>
                {/* مکان‌نما چشمک‌زن */}
                {isRecording && <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse align-middle"></span>}
             </div>

             <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={copyToClipboard}>
                    {copied ? <Check className="mr-2 h-4 w-4 text-green-500"/> : <Copy className="mr-2 h-4 w-4"/>}
                    کپی متن
                </Button>
                <Button onClick={() => setShowResult(false)}>بستن</Button>
             </div>
             
             {/* دیباگ برای اطمینان */}
             {debugInfo && (
                <details className="text-xs text-gray-400 text-left" dir="ltr">
                    <summary>Debug Info</summary>
                    <pre>{debugInfo}</pre>
                </details>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}