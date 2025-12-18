'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Mic, MicOff, Copy, Check, Globe, Cloud, HelpCircle, Loader2, Smartphone, Monitor, Apple, Moon, Sun, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  // --- States ---
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
  const [isBrowserSupported, setIsBrowserSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('در حال بارگذاری...')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android' | 'windows'>('ios')
  
  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  
  // مخازن امن برای مدیریت متن
  const historyTranscriptRef = useRef('') 
  const currentSessionTextRef = useRef('') 
  
  const isRecordingRef = useRef(false)
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { toast } = useToast()

  // --- Logger ---
  const log = (message: string, data?: any) => {
    // console.log disabled for production
  }

  // --- Fix Scroll: اسکرول خودکار ---
  useEffect(() => {
    if (showResult && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [transcription, liveTranscription, showResult]);

  // --- Theme & Title Management ---
  useEffect(() => {
    // 🟢 تنظیم تایتل تب مرورگر در لحظه لود
    document.title = "تایپ صوتی هوشمند";

    const root = window.document.documentElement
    root.classList.remove(isDarkMode ? 'light' : 'dark')
    root.classList.add(isDarkMode ? 'dark' : 'light')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
    
    if (typeof window !== 'undefined') {
      const hasSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      setIsBrowserSupported(hasSupport && isHttps)
      if (!hasSupport) setUseWebSpeech(false)
    }
    
    setTimeout(() => setIsLoading(false), 2000)
  }, [])

  // --- Text Sync Logic ---
  useEffect(() => {
    if (!showResult) {
      setTranscription('')
      setLiveTranscription('')
      setEditedText('')
      historyTranscriptRef.current = ''
      currentSessionTextRef.current = ''
    } else {
      const combined = (transcription + ' ' + liveTranscription).replace(/\s+/g, ' ').trim()
      if (isRecordingRef.current) {
          setEditedText(combined)
      } else if (!editedText && combined) {
          setEditedText(combined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription, liveTranscription, showResult])

  // --- Fix Manual Edit ---
  const handleManualEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setEditedText(newText)
    
    historyTranscriptRef.current = newText
    setTranscription(newText)
    currentSessionTextRef.current = '' 
    setLiveTranscription('')
  }

  // --- Keyboard Shortcut ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && !isRecordingRef.current) {
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && isRecordingRef.current) {
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [shortcutKey]);

  // ==========================================
  // 🟢 CORE ENGINE
  // ==========================================

  const startWatchdog = () => {
    const config = getDeviceConfig();
    
    // غیرفعال کردن watchdog برای پلتفرم‌های غیر از Windows
    if (!config.useWatchdog) {
      console.log(`🔍 ${config.platformName}: Watchdog disabled for platform stability`);
      return;
    }
    
    if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current)
    
    console.log(`🔍 ${config.platformName}: Starting watchdog with ${config.watchdogInterval}ms interval`);
    
    watchdogTimerRef.current = setInterval(() => {
        if (isRecordingRef.current && recognitionRef.current) {
            try {
                recognitionRef.current.start()
            } catch (e) { /* Active */ }
        }
    }, config.watchdogInterval)
  }

  const initWebSpeech = useCallback(() => {
    if (typeof window === 'undefined') return false
    
    const config = getDeviceConfig();
    console.log(`🔍 ${config.platformName}: Initializing Web Speech with config:`, config);
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      toast({
        title: "عدم پشتیبانی",
        description: "مرورگر شما از قابلیت تبدیل گفتار پشتیبانی نمی‌کند.",
        variant: "destructive",
      })
      return false
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = config.continuousMode  // استفاده از تنظیمات مبتنی بر دستگاه
      recognition.interimResults = true 
      recognition.lang = selectedLanguage
      
      recognition.onresult = (event: any) => {
        let sessionFullText = ''
        let sessionInterim = ''
        let hasFinal = false

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0].transcript
          
          if (!text || text.trim() === '') continue
          
          if (result.isFinal) {
            sessionFullText += text
            hasFinal = true
          } else {
            sessionInterim += text
          }
        }
        
        currentSessionTextRef.current = sessionFullText
        
        const totalDisplay = (historyTranscriptRef.current + ' ' + sessionFullText).replace(/\s+/g, ' ').trim()
        setTranscription(totalDisplay)
        setLiveTranscription(sessionInterim)
        
        setEditedText((totalDisplay + ' ' + sessionInterim).trim())

        if (hasFinal) {
            recognition.stop()
        }
      }
      
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'network') return 
        
        if (event.error === 'not-allowed') {
            stopRecordingInternal()
            toast({
                title: "دسترسی میکروفون مسدود است",
                description: "لطفاً دسترسی مرورگر را بررسی کنید.",
                variant: "destructive"
            })
        }
      }
      
      recognition.onend = () => {
        const config = getDeviceConfig();
        
        if (isRecordingRef.current) {
            console.log(`🔍 ${config.platformName}: Recognition ended, restarting in ${config.restartDelay}ms`);
            
            if (currentSessionTextRef.current) {
                historyTranscriptRef.current = (historyTranscriptRef.current + ' ' + currentSessionTextRef.current).trim()
                currentSessionTextRef.current = ''
            }
            
            setTranscription(historyTranscriptRef.current)
            setEditedText(historyTranscriptRef.current)
            setLiveTranscription('')

            setTimeout(() => {
                if (isRecordingRef.current) {
                    try { 
                        recognition.start();
                        console.log(`🔍 ${config.platformName}: Recognition restarted successfully`);
                    } catch(e){
                        console.log(`🔍 ${config.platformName}: Restart failed:`, e);
                    }
                }
            }, config.restartDelay)  // استفاده از timeout مبتنی بر دستگاه
        }
      }
      
      recognitionRef.current = recognition
      return true
    } catch (error) {
      console.error('Init error:', error)
      return false
    }
  }, [selectedLanguage]) 

  // ==========================================
  // 🔍 DEVICE DETECTION SYSTEM
  // ==========================================
  
  const getDeviceInfo = () => {
    if (typeof window === 'undefined') return { isWindows: false, isAndroid: false, isIOS: false, isMobile: false };
    
    const userAgent = navigator.userAgent;
    const platform = navigator.platform || (navigator as any).userAgentData?.platform || '';
    
    const isWindows = /Win\d{2}|Windows/.test(userAgent) || /Win/.test(platform);
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                 (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = isAndroid || isIOS || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    return { isWindows, isAndroid, isIOS, isMobile };
  };

  const isIOS = () => {
    const { isIOS } = getDeviceInfo();
    return isIOS;
  };

  const getDeviceConfig = () => {
    const deviceInfo = getDeviceInfo();
    
    // Windows Configuration - الگوی فعلی بدون تغییر
    if (deviceInfo.isWindows) {
      return {
        useWatchdog: true,
        watchdogInterval: 2000,
        restartDelay: 100,
        continuousMode: true,
        maxSilenceTime: 2000,
        platformName: 'Windows'
      };
    }
    
    // Android Configuration - بهینه‌سازی شده برای موبایل
    if (deviceInfo.isAndroid) {
      return {
        useWatchdog: false,  // غیرفعال کردن watchdog برای Android
        watchdogInterval: 3000,
        restartDelay: 500,    // timeout طولانی‌تر برای Android
        continuousMode: false, // conservative approach برای موبایل
        maxSilenceTime: 3000,
        platformName: 'Android'
      };
    }
    
    // Default Configuration (شامل iOS و سایر پلتفرم‌ها)
    return {
      useWatchdog: false,
      watchdogInterval: 3000,
      restartDelay: 300,
      continuousMode: false,
      maxSilenceTime: 3000,
      platformName: 'Other'
    };
  };

  const stopRecordingInternal = () => {
    setIsRecording(false)
    isRecordingRef.current = false 
    
    if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current)
        watchdogTimerRef.current = null
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch(e){}
    }
    
    if (currentSessionTextRef.current) {
        historyTranscriptRef.current = (historyTranscriptRef.current + ' ' + currentSessionTextRef.current).trim()
    }
    setTranscription(historyTranscriptRef.current)
    setEditedText(historyTranscriptRef.current)
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
  }

  const startRecording = async () => {
    const supportsWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const config = getDeviceConfig();
    
    console.log(`🔍 ${config.platformName}: Starting recording with Web Speech mode`);
    console.log(`🔍 Device Info:`, getDeviceInfo());
    
    if (!showResult) {
       historyTranscriptRef.current = ''
       currentSessionTextRef.current = ''
       setTranscription('')
       setLiveTranscription('')
       setEditedText('')
    }

    if (useWebSpeech && supportsWebSpeech && !isIOS()) {
      const initialized = initWebSpeech()
      if (initialized && recognitionRef.current) {
        try {
          isRecordingRef.current = true
          setIsRecording(true)
          recognitionRef.current.start()
          setShowResult(true)
          startWatchdog()
          console.log(`🔍 ${config.platformName}: Web Speech recording started successfully`);
        } catch (error) {
          stopRecordingInternal()
        }
      }
    } 
    else {
      // Cloud API Logic
      console.log(`🔍 ${config.platformName}: Starting recording with Cloud API mode`);
      
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
          
          const formData = new FormData();
          formData.append('audio', audioBlob);

          try {
            const response = await fetch('/api/stt', {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            const newText = (editedText + ' ' + data.text).trim();
            setTranscription(newText);
            setEditedText(newText);
            historyTranscriptRef.current = newText;
          } catch (err) {
            toast({ title: "خطا در ارتباط با سرور", variant: "destructive" });
          } finally {
            setIsProcessing(false);
          }
        };

        mediaRecorder.start();
        
        isRecordingRef.current = true
        setIsRecording(true);
        toast({ title: "در حال ضبط برای پردازش در سرور..." });

      } catch (err) {
        toast({ title: "دسترسی میکروفون داده نشد", variant: "destructive" });
      }
    }
  }

  const stopRecording = () => {
    stopRecordingInternal()
  }

  const handleDialogChange = (open: boolean) => {
    setShowResult(open)
    if (!open) {
        stopRecording()
    }
  }

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

  const LoadingScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 mx-auto mb-6 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
        />
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-black text-foreground mb-2"
        >
          VT
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground"
        >
          {loadingMessage}
        </motion.p>
      </div>
    </motion.div>
  );

  const ProcessingAnimation = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4"
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </motion.div>
      <p className="text-muted-foreground text-lg">در حال پردازش صدا...</p>
    </div>
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 md:p-8 font-vazir text-foreground transition-colors duration-500 relative">
      
      {/* دکمه تم */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute top-4 right-4 md:top-8 md:right-8"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="rounded-full w-12 h-12 bg-muted/50 backdrop-blur-sm border-border/50 shadow-lg hover:bg-muted hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          <AnimatePresence mode="wait">
            {isDarkMode ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
              >
                <Sun className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
              >
                <Moon className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Hero Section & Logo */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-10 md:mb-16 flex flex-col items-center"
        >
          {/* 🟢 دیزاین جدید لوگو (با جهت ltr برای چینش صحیح انگلیسی) */}
          <div className="flex items-baseline gap-3 mb-6 select-none" dir="ltr">
            <h1 className="text-7xl md:text-9xl font-black text-foreground tracking-tighter" style={{ textShadow: isDarkMode ? '0 0 30px rgba(255,255,255,0.1)' : '0 0 30px rgba(0,0,0,0.05)' }}>
              VT
            </h1>
            <span className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-primary/90 uppercase">
              VocalType
            </span>
          </div>
          
          {/* 🟢 تیتر جدید */}
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-4xl font-bold text-foreground tracking-tight"
          >
            دستیار هوشمند تایپ صوتی
          </motion.h2>
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col md:flex-row gap-3 mb-8 md:mb-12"
      >
        <Button 
          variant={useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(true)}
          disabled={!isBrowserSupported}
          className="group flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-500 hover:shadow-lg hover:shadow-primary/20 bg-card border-border text-foreground hover:bg-accent"
        >
          <Globe className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180" />
          Web Speech
        </Button>
        <Button 
          variant={!useWebSpeech ? "default" : "outline"}
          onClick={() => setUseWebSpeech(false)}
          className="group flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-500 hover:shadow-lg hover:shadow-primary/20 bg-card border-border text-foreground hover:bg-accent"
        >
          <Cloud className="h-5 w-5 transition-transform duration-500 group-hover:translate-y-[-4px]" />
          Cloud API
        </Button>
      </motion.div>

      <AnimatePresence>
        {useWebSpeech && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-8 md:mb-12 w-full max-w-xs md:max-w-md"
          >
            <select
              className="w-full p-3 rounded-xl border-border bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-500 hover:shadow-primary/20"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="fa-IR">فارسی</option>
              <option value="en-US">English</option>
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isRecording ? [1, 1.05, 1] : 1,
          transition: { repeat: isRecording ? Infinity : 0, duration: 1.2, ease: "easeInOut" }
        }}
        className="relative"
      >
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${isRecording ? 'bg-destructive/30 animate-pulse' : 'bg-primary/20'}`}></div>
        <Button
          size="lg"
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center ${isRecording ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`}
        >
          {isRecording ? <MicOff className="h-14 w-14 md:h-16 md:w-16" /> : <Mic className="h-14 w-14 md:h-16 md:w-16" />}
        </Button>
      </motion.div>
      
      {isRecording && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-destructive font-medium text-lg md:text-xl animate-pulse"
        >
          در حال ضبط...
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mt-8 md:mt-12"
      >
        <Button
          variant="ghost"
          onClick={() => setShowGuide(true)}
          className="text-muted-foreground hover:text-foreground transition-colors duration-300 flex items-center gap-2"
        >
          <HelpCircle className="h-5 w-5" />
          راهنمای استفاده
        </Button>
      </motion.div>

      {/* 🟢 Developer Credit Footer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-4 left-0 right-0 text-center"
      >
        <a 
          href="https://instagram.com/pedram_khoshdast" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs font-mono text-muted-foreground/60 hover:text-primary transition-colors duration-300 tracking-wider"
        >
          Made by @pedram_khoshdast
        </a>
      </motion.div>

      <Dialog open={showResult} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl shadow-2xl border-0 overflow-hidden bg-card">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <DialogHeader className="pb-2">
              <DialogTitle className="text-right text-2xl md:text-3xl font-bold text-foreground">نتیجه</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              {isProcessing && <ProcessingAnimation />}
              
              <div className="relative h-[300px] md:h-[400px] p-5 bg-muted rounded-2xl border border-border shadow-inner overflow-hidden" dir="ltr">
                <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-muted to-transparent z-10 pointer-events-none"></div>
                
                <Textarea
                  ref={textareaRef}
                  value={editedText}
                  onChange={handleManualEdit}
                  dir="rtl"
                  className="w-full h-full bg-transparent border-none text-foreground text-xl md:text-2xl leading-loose resize-none focus:outline-none scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-muted text-right placeholder:text-right"
                  placeholder="متن اینجا ظاهر می‌شود..."
                />
              </div>

              <div className="flex justify-end gap-3" dir="ltr">
                <Button variant="outline" onClick={copyToClipboard} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 bg-card border-border text-foreground hover:bg-accent">
                  {copied ? <Check className="mr-2 h-5 w-5 text-green-500" /> : <Copy className="mr-2 h-5 w-5" />}
                  کپی متن
                </Button>
                <Button onClick={() => handleDialogChange(false)} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                  بستن
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl rounded-2xl shadow-2xl border-0 overflow-hidden bg-card max-h-[90vh] overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <DialogHeader className="pb-6 border-b border-border">
              <DialogTitle className="text-right text-2xl md:text-3xl font-bold text-foreground">راهنمای استفاده</DialogTitle>
            </DialogHeader>
            
            <div className="mt-6 space-y-8 text-right" dir="rtl">
              <div className="flex justify-center gap-2 p-1 bg-muted rounded-xl">
                {[
                  { key: 'ios', label: 'iOS', icon: Apple },
                  { key: 'android', label: 'Android', icon: Smartphone },
                  { key: 'windows', label: 'Windows', icon: Monitor },
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={selectedPlatform === key ? 'default' : 'ghost'}
                    onClick={() => setSelectedPlatform(key as any)}
                    className={`flex-1 gap-2 rounded-lg transition-all duration-300 ${selectedPlatform === key ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
              
              <AnimatePresence mode="wait">
                 {selectedPlatform === 'ios' && (
                  <motion.div
                    key="ios"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-2xl p-6 md:p-8 border border-blue-200 dark:border-blue-800"
                  >
                    <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                      <Apple className="h-6 w-6 text-blue-500" />
                      آموزش فعال‌سازی «VocalType» در آیفون 🎙️📱
                    </h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                      با این روش می‌تونی تایپ صوتی رو خیلی سریع و فقط با یک لمس فعال کنی.
                    </p>
                    
                    <div className="space-y-6">
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-blue-200 dark:border-blue-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۱</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">نصب شورتکات</h3>
                            <p className="text-muted-foreground mb-3">ابتدا شورتکات «VocalType» را از لینک زیر نصب کن:</p>
                            <a 
                              href="https://www.icloud.com/shortcuts/26da3fa054c64be58c9c01ff3fa9a98f" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              <Globe className="h-4 w-4" />
                              نصب VocalType
                            </a>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-blue-200 dark:border-blue-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۲</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">فعال‌سازی AssistiveTouch</h3>
                            <ul className="space-y-2 text-muted-foreground">
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> وارد Settings گوشی شو</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> برو به Accessibility</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> گزینه Touch رو انتخاب کن</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> وارد AssistiveTouch شو و اون رو فعال کن</li>
                            </ul>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-blue-200 dark:border-blue-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۳</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">اتصال شورتکات به AssistiveTouch</h3>
                            <ul className="space-y-2 text-muted-foreground">
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> داخل صفحه AssistiveTouch، وارد بخش Custom Actions شو</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> یکی از گزینه‌ها (Single Tap / Double Tap / Long Press) رو انتخاب کن</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> لیست رو اسکرول کن تا به بخش Shortcuts برسی</li>
                              <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> شورتکات VocalType رو انتخاب کن</li>
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                      
                      <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-xl border border-blue-300 dark:border-blue-700">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <span className="font-semibold">✅ نتیجه نهایی:</span> از این به بعد، با حرکتی که انتخاب کردی روی AssistiveTouch، تایپ صوتی فوراً فعال میشه. گوشی شما با دریافت پاسخ ویبره می‌ده و متن در کلیپ‌بورد کپی میشه.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                 )}

                 {selectedPlatform === 'android' && (
                  <motion.div
                    key="android"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-2xl p-6 md:p-8 border border-green-200 dark:border-green-800"
                  >
                    <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                      <Smartphone className="h-6 w-6 text-green-500" />
                      فعال‌سازی تایپ صوتی در اندروید 🤖📱
                    </h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                      اندروید به صورت پیش‌فرض از تایپ صوتی عالی پشتیبانی می‌کند. برای دسترسی سریع‌تر:
                    </p>
                    
                    <div className="space-y-6">
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-green-200 dark:border-green-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۱</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">استفاده از کیبورد</h3>
                            <p className="text-muted-foreground">
                              در هر قسمتی که متن وارد می‌کنید، روی آیکون میکروفون در کیبورد Gboard یا کیبورد پیش‌فرض خود ضربه بزنید و شروع به صحبت کنید.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-green-200 dark:border-green-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۲</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">دسترسی سریع از طریق دستیار صوتی</h3>
                            <p className="text-muted-foreground">
                              دستیار صوتی Google (Hey Google) را فعال کنید و بگویید "تایپ کن" یا "Type" و سپس متن مورد نظر خود را بیان کنید.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                 )}

                 {selectedPlatform === 'windows' && (
                  <motion.div
                    key="windows"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900 rounded-2xl p-6 md:p-8 border border-sky-200 dark:border-sky-800"
                  >
                    <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                      <Monitor className="h-6 w-6 text-sky-500" />
                      فعال‌سازی تایپ صوتی در ویندوز ۱۱ 🖥️🎤
                    </h2>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                      ویندوز ۱۱ دارای قابلیت تایپ صوتی داخلی و قدرتمند است که با یک شورتکات ساده قابل دسترسی است.
                    </p>
                    
                    <div className="space-y-6">
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-sky-200 dark:border-sky-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۱</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">استفاده از شورتکات</h3>
                            <p className="text-muted-foreground mb-3">
                              در هر برنامه یا متنی که مکان‌نما در حال چشمک‌زدن است، کلیدهای ترکیبی زیر را فشار دهید:
                            </p>
                            <div className="flex items-center justify-center gap-2 p-3 bg-sky-100 dark:bg-sky-900/50 rounded-lg border border-sky-300 dark:border-sky-700">
                              <kbd className="px-3 py-1 bg-white dark:bg-slate-700 rounded border border-border text-sm font-mono">Win</kbd>
                              <span className="text-muted-foreground">+</span>
                              <kbd className="px-3 py-1 bg-white dark:bg-slate-700 rounded border border-border text-sm font-mono">H</kbd>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-sky-200 dark:border-sky-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center flex-shrink-0 font-bold">۲</div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-2">شروع به صحبت کنید</h3>
                            <p className="text-muted-foreground">
                              پس از فشردن شورتکات، پنجره‌ی تایپ صوتی ظاهر می‌شود. میکروفون را فعال کرده و متن خود را بگویید. متن به صورت خودکار تایپ خواهد شد.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                 )}
              </AnimatePresence>
            </div>
            
            <div className="flex justify-end mt-8 pt-6 border-t border-border">
              <Button onClick={() => setShowGuide(false)} className="rounded-full px-6 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                بستن
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}