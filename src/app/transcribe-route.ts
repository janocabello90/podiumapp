import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key no configurada' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as Blob | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No se recibió archivo de audio' },
        { status: 400 }
      )
    }

    // Send to Whisper API
    const whisperFormData = new FormData()
    whisperFormData.append('file', audioFile, 'recording.webm')
    whisperFormData.append('model', 'whisper-1')
    whisperFormData.append('language', 'es')
    whisperFormData.append('response_format', 'json')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Whisper API error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.message || 'Error en la transcripción' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })
  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
