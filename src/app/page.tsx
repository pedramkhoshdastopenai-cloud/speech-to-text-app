'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Mic, MicOff, Copy, Check, Globe, Cloud, HelpCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [liveTranscription, setLiveTranscription] = useState('')
  const [editedText, setEditedText] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [copied, setCopied] = useState(false)
  const [useWebSpeech, setUseWebSpeech] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState('fa-IR')
  const [shortcutKey, setShortcutKey] = useState('F10')
  const [debugInfo, setDebugInfo] = useState('')
  const [isBrowserSupported, setIsBrowserSupported] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null) // از any استفاده کردیم تا با تایپ‌اسکریپت درگیر نشویم
  const { toast } = useToast()

  // Sync editedText with transcription and liveTranscription
  useEffect(() => {
    if (!showResult) {
      setTranscription('')
      setLiveTranscription('')
      setEditedText('')
    } else {
      const combined = (transcription + ' ' + liveTranscription).trim()
      if (combined !== editedText) {
        setEditedText(combined)
      }
    }
  }, [transcription, liveTranscription, showResult])

  // Keyboard shortcut listener for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && !isRecording) {
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && isRecording) {
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [shortcutKey, isRecording]);

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
    const textToCopy = editedText.trim()
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8 font-vazir text-white">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-8 md:mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">تبدیل گفتار به نوشتار</h1>
          <p className="text-slate-400 text-lg md:text-xl">صحبت کنید و متن را ببینید</p>
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col md:flex-row gap-3 mb-8 md:mb-12"
      >
        <Button 
          variant={useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(true)}
          disabled={!isBrowserSupported}
          className="group flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
        >
          <Globe className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" />
          Web Speech (رایگان)
        </Button>
        <Button 
          variant={!useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(false)}
          className="group flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
        >
          <Cloud className="h-5 w-5 transition-transform duration-300 group-hover:translate-y-[-4px]" />
          Cloud API
        </Button>
      </motion.div>

      <AnimatePresence>
        {useWebSpeech && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mb-8 md:mb-12 w-full max-w-xs md:max-w-md"
          >
            <select
              className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 hover:shadow-blue-500/20"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="fa-IR">فارسی</option>
              <option value="en-US">English</option>
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      {/* دکمه اصلی ضبط */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isRecording ? [1, 1.1, 1] : 1,
          transition: { repeat: isRecording ? Infinity : 0, duration: 1.2, ease: 'easeInOut' }
        }}
        className="relative"
      >
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${isRecording ? 'bg-red-500/30 animate-pulse' : 'bg-blue-500/20'}`}></div>
        <Button
          size="lg"
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isRecording ? <MicOff className="h-14 w-14 md:h-16 md:w-16" /> : <Mic className="h-14 w-14 md:h-16 md:w-16" />}
        </Button>
      </motion.div>
      
      {isRecording && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-red-400 font-medium text-lg md:text-xl animate-pulse"
        >
          در حال ضبط...
        </motion.p>
      )}

      {/* دکمه راهنمای استفاده */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-8 md:mt-12"
      >
        <Button
          variant="ghost"
          onClick={() => setShowGuide(true)}
          className="text-slate-400 hover:text-white transition-colors duration-300 flex items-center gap-2"
        >
          <HelpCircle className="h-5 w-5" />
          راهنمای استفاده
        </Button>
      </motion.div>

      {/* مودال نمایش نتیجه */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl shadow-2xl border-0 overflow-hidden bg-slate-900">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DialogHeader className="pb-2">
              <DialogTitle className="text-right text-2xl md:text-3xl font-bold text-white">نتیجه</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              {/* باکس نمایش متن */}
              <div className="relative min-h-[220px] md:min-h-[280px] p-5 bg-slate-800 rounded-2xl border border-slate-700 text-right shadow-inner" dir="rtl">
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-full bg-transparent border-none text-white text-xl md:text-2xl leading-loose resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
                  placeholder="متن اینجا ظاهر می‌شود..."
                />
                {/* مکان‌نما چشمک‌زن اگر در حال ضبط باشد و متن زنده نباشد */}
                {isRecording && !liveTranscription && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="absolute top-5 right-5 inline-block w-0.5 h-6 md:h-8 bg-blue-500"
                  ></motion.span>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={copyToClipboard} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                  {copied ? <Check className="mr-2 h-5 w-5 text-green-500" /> : <Copy className="mr-2 h-5 w-5" />}
                  کپی متن
                </Button>
                <Button onClick={() => setShowResult(false)} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                  بستن
                </Button>
              </div>
              
              {/* دیباگ برای اطمینان */}
              {debugInfo && (
                <details className="text-xs text-slate-400 text-left" dir="ltr">
                  <summary>Debug Info</summary>
                  <pre>{debugInfo}</pre>
                </details>
              )}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* مودال راهنمای استفاده */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl shadow-2xl border-0 overflow-hidden bg-slate-900">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DialogHeader className="pb-2">
              <DialogTitle className="text-right text-2xl md:text-3xl font-bold text-white">راهنمای استفاده</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-6 text-right" dir="rtl">
              <p className="text-slate-300 text-lg leading-relaxed">
                این نرم‌افزار برای تبدیل گفتار به متن طراحی شده است. می‌توانید از دو روش Web Speech (رایگان و محلی) یا Cloud API (پردازش ابری) استفاده کنید. زبان پیش‌فرض فارسی است، اما می‌توانید انگلیسی را نیز انتخاب کنید.
              </p>
              <ul className="list-disc list-inside text-slate-300 text-lg leading-relaxed space-y-2">
                <li>دکمه میکروفون را فشار دهید تا ضبط شروع شود.</li>
                <li>صحبت کنید و متن زنده را مشاهده کنید.</li>
                <li>دوباره دکمه را فشار دهید تا ضبط متوقف شود.</li>
                <li>متن نهایی در کادر قابل ویرایش ظاهر می‌شود و می‌توانید آن را کپی یا ویرایش کنید.</li>
                <li>در صورت استفاده از Cloud API، صدا به سرور ارسال و پردازش می‌شود.</li>
              </ul>
              
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-xl font-semibold text-white mb-3">شورتکات کیبورد (فقط برای کامپیوتر)</h3>
                <p className="text-slate-300 text-lg mb-4">
                  کلید مورد نظر را انتخاب کنید. با نگه داشتن این کلید، ضبط صدا به صورت خودکار شروع می‌شود و متن در کادر نتیجه تایپ خواهد شد. از میکروفون پیش‌فرض کامپیوتر استفاده می‌شود. این قابلیت زمانی فعال است که صفحه نرم‌افزار باز باشد.
                </p>
                <Select value={shortcutKey} onValueChange={setShortcutKey}>
                  <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="انتخاب کلید" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="F1">F1</SelectItem>
                    <SelectItem value="F2">F2</SelectItem>
                    <SelectItem value="F3">F3</SelectItem>
                    <SelectItem value="F4">F4</SelectItem>
                    <SelectItem value="F5">F5</SelectItem>
                    <SelectItem value="F6">F6</SelectItem>
                    <SelectItem value="F7">F7</SelectItem>
                    <SelectItem value="F8">F8</SelectItem>
                    <SelectItem value="F9">F9</SelectItem>
                    <SelectItem value="F10">F10</SelectItem>
                    <SelectItem value="F11">F11</SelectItem>
                    <SelectItem value="F12">F12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowGuide(false)} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                  بستن
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}