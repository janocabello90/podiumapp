import { REPORT_MODEL, REPORT_MAX_TOKENS, REPORT_THINKING, REPORT_EFFORT } from './aiConfig'
import { parseReportJson } from './parseReportJson'

export type ReportCallResult = { reportData: any; stopReason: string | null; raw: string; usage: any }

async function runOnce(anthropic: any, system: string, messages: any[]): Promise<{ text: string; stopReason: string | null; usage: any }> {
  // Streaming: con max_tokens alto evita timeouts HTTP. finalMessage() devuelve el mensaje completo.
  const stream = anthropic.messages.stream({
    model: REPORT_MODEL,
    max_tokens: REPORT_MAX_TOKENS,
    thinking: REPORT_THINKING,
    output_config: REPORT_EFFORT,
    system,
    messages,
  } as any)
  const message = await stream.finalMessage()
  const text = (message.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
  return { text, stopReason: (message as any).stop_reason ?? null, usage: (message as any).usage ?? null }
}

// Llama al modelo y parsea el informe con robustez:
//  - parser tolerante + reparación de JSON (parseReportJson: comillas/saltos/comas),
//  - REINTENTO automático (1 vez) si la respuesta no se puede parsear ni reparar
//    (los fallos de formato del modelo son intermitentes → a la 2ª suele salir).
// Un truncado por longitud (stop_reason=max_tokens) NO se reintenta (reintentar no ayuda).
// Si tras el reintento sigue fallando, lanza un error con { stopReason, raw } para
// que la ruta guarde la respuesta cruda y el diagnóstico en la fila del informe.
export async function callReportModel(anthropic: any, params: { system: string; messages: any[] }): Promise<ReportCallResult> {
  let last: { text: string; stopReason: string | null; usage: any } = { text: '', stopReason: null, usage: null }
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await runOnce(anthropic, params.system, params.messages)
    try {
      const reportData = parseReportJson(last.text)
      return { reportData, stopReason: last.stopReason, raw: last.text, usage: last.usage }
    } catch {
      if (last.stopReason === 'max_tokens') break // reintentar no ayudaría (venía cortado)
    }
  }
  const err: any = new Error('NO_JSON')
  err.stopReason = last.stopReason
  err.raw = last.text
  throw err
}
