import { NextRequest, NextResponse } from 'next/server'
import { speech } from '@google-cloud/speech'

// Initialize Google Cloud Speech-to-Text client
const client = new speech.SpeechClient()

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
    const audioBytes = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(audioBytes)

    // Configure the request for Persian speech recognition
    const audio = {
      content: audioBuffer.toString('base64'),
    }

    const config = {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 48000,
      languageCode: 'fa-IR',
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      audioChannelCount: 1,
      enableWordTimeOffsets: false,
    }

    const recognitionRequest = {
      audio: audio,
      config: config,
    }

    // Perform speech recognition
    const [response] = await client.recognize(recognitionRequest)
    
    // Extract the transcription
    const transcription = response.results
      .map(result => result.alternatives?.[0]?.transcript)
      .filter(transcript => transcript)
      .join(' ')

    return NextResponse.json({
      text: transcription || '',
      success: true,
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