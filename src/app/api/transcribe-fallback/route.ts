import { NextRequest, NextResponse } from 'next/server'

// Simple speech-to-text using free services
// This is a fallback implementation when Google Cloud is not available

export async function POST(request: NextRequest) {
  try {
    // Get the audio file from the request
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'فایل صوتی پیدا نشد' },
        { status: 400 }
      )
    }

    // For now, return a mock response
    // In a real implementation, you could use:
    // 1. OpenAI Whisper API (paid but affordable)
    // 2. AssemblyAI (has free tier)
    // 3. Deepgram (has free tier)
    // 4. Self-hosted Whisper model

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock transcription - in real implementation, this would come from the API
    const mockTranscription = "این یک متن نمونه برای نمایش عملکرد تبدیل گفتار به نوشتار است. در نسخه واقعی، این متن از صوت شما استخراج می‌شود."

    return NextResponse.json({
      text: mockTranscription,
      success: true,
      note: "این یک نسخه آزمایشی است. برای استفاده واقعی، لطفاً یکی از سرویس‌های زیر را تنظیم کنید: OpenAI Whisper, AssemblyAI, یا Deepgram"
    })

  } catch (error) {
    console.error('Speech-to-Text error:', error)
    
    return NextResponse.json(
      { 
        error: 'خطا در پردازش گفتار به نوشتار',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}