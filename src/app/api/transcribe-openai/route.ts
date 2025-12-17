import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Convert file to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    // Create a temporary file
    const tempFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: tempFile,
      model: 'whisper-1',
      language: 'fa',
      response_format: 'text',
    })

    return NextResponse.json({
      text: transcription,
      success: true,
    })

  } catch (error) {
    console.error('OpenAI Whisper error:', error)
    
    return NextResponse.json(
      { 
        error: 'خطا در پردازش گفتار به نوشتار',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}