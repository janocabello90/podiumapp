'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onTranscription: (text: string) => void
  currentText: string
  placeholder?: string
}

export default function VoiceDictation({ onTranscription, currentText, placeholder }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const audioBlob = new Blob(chunks.current, { type: 'audio/webm' })

        if (audioBlob.size < 1000) {
          toast.error('Grabación demasiado corta')
          return
        }

        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Error de transcripción')
          }

          const { text } = await response.json()
          if (text && text.trim()) {
            // Append to existing text with space
            const newText = currentText
              ? `${currentText} ${text.trim()}`
              : text.trim()
            onTranscription(newText)
            toast.success('Dictado transcrito')
          } else {
            toast.error('No se detectó texto en el audio')
          }
        } catch (err: any) {
          toast.error(err.message || 'Error al transcribir')
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      mediaRecorder.current = recorder
      setIsRecording(true)
    } catch (err) {
      toast.error('No se pudo acceder al micrófono. Revisa los permisos.')
    }
  }, [currentText, onTranscription])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop()
      setIsRecording(false)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      {isTranscribing ? (
        <button
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Transcribiendo...
        </button>
      ) : isRecording ? (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors animate-pulse"
        >
          <MicOff className="w-3.5 h-3.5" />
          Parar dictado
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors"
          title={placeholder || 'Dictar notas por voz'}
        >
          <Mic className="w-3.5 h-3.5" />
          Dictar
        </button>
      )}
    </div>
  )
}
