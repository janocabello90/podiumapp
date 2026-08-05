import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Require authentication to prevent API abuse / OpenAI quota drain
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

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
    // temperature 0 = menos "alucinaciones" del modelo con audio flojo/silencio
    whisperFormData.append('temperature', '0')

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

    // Whisper "alucina" frases comunes de YouTube cuando el audio es (casi) silencio.
    // Si la transcripción es EXACTAMENTE una de esas frases-basura conocidas, la
    // descartamos y devolvemos vacío (la UI dirá "No se detectó texto, repite").
    const raw = String(result.text || '')
    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "") // quitar acentos
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
    const HALLUCINATIONS = new Set([
      'gracias por ver el video',
      'gracias por ver este video',
      'gracias por ver el video hasta el final',
      'suscribete',
      'suscribete al canal',
      'no te olvides de suscribirte',
      'subtitulos realizados por la comunidad de amaraorg',
      'subtitulos por la comunidad de amaraorg',
      'subtitulado por la comunidad de amaraorg',
      'mas informacion en wwwalimmentaes',
      'gracias',
      'gracias por su atencion',
      'hasta la proxima',
    ])
    const text = HALLUCINATIONS.has(norm) ? '' : raw
    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
