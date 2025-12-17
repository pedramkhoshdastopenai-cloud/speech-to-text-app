import { NextRequest, NextResponse } from 'next/server'

// AssemblyAI implementation (has free tier)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: 'فایل صوتی پیدا نشد' }, { status: 400 })
    }

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLYAI_API_KEY || '',
        'Content-Type': 'application/octet-stream',
      },
      body: await audioFile.arrayBuffer(),
    })

    if (!uploadResponse.ok) {
      throw new Error('خطا در آپلود فایل')
    }

    const { upload_url } = await uploadResponse.json()

    // Start transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLYAI_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: 'fa',
      }),
    })

    if (!transcriptResponse.ok) {
      throw new Error('خطا در شروع تبدیل گفتار')
    }

    const { id } = await transcriptResponse.json()

    // Poll for completion
    let transcript = null
    while (!transcript || transcript.status === 'processing' || transcript.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          'Authorization': process.env.ASSEMBLYAI_API_KEY || '',
        },
      })
      
      transcript = await statusResponse.json()
      
      if (transcript.status === 'error') {
        throw new Error('خطا در پردازش گفتار')
      }
    }

    return NextResponse.json({
      text: transcript.text || '',
      success: true,
    })

  } catch (error) {
    console.error('AssemblyAI error:', error)
    return NextResponse.json(
      { 
        error: 'خطا در پردازش گفتار به نوشتار',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}