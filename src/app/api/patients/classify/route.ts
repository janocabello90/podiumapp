import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  BODY_REGIONS,
  ACTIVITY_LEVELS,
  PATHOLOGIES,
} from '@/lib/clinical/taxonomy'

// POST /api/patients/classify
// Body: { patientId: string } (single) or { backfill: true } (all unclassified)
// Uses Claude Haiku to extract structured clinical classification from
// anamnesis + assessment + report (free text) and writes to patients table.

const SYSTEM_PROMPT = `Eres un clasificador clínico experto en fisioterapia musculoesquelética. Tu tarea es extraer información estructurada del historial clínico de un paciente (anamnesis, valoración y, si existe, informe).

Devuelves SOLO JSON válido con esta forma exacta:
{
  "body_region": "<uno de los slugs permitidos>",
  "pathology_tag": "<uno de los slugs de patología>",
  "pathology_label": "<texto libre descriptivo si pathology_tag='otro', null en otro caso>",
  "activity_level": "<uno de los slugs permitidos>",
  "confidence": <número 0-1>,
  "reasoning": "<1-2 frases justificando>"
}

REGLAS:
- Elige SIEMPRE el slug más específico del catálogo; usa 'otro' solo si realmente nada encaja.
- Si hay varias regiones afectadas, elige 'multiple' y en pathology_tag la más relevante.
- Para activity_level integra tanto el nivel deportivo declarado como el tipo de trabajo (sedentario suma sedentarismo).
- Confidence = 1.0 si el informe o valoración lo dice literal; 0.7-0.9 si se deduce claramente de la anamnesis; <0.7 si se infiere con poca evidencia.
- NO inventes diagnóstico si no hay datos: devuelve 'otro' con confidence baja.
- NO añadas ningún texto fuera del JSON.`

function buildVocab() {
  const regions = BODY_REGIONS.map((r) => `- ${r.slug}: ${r.label}`).join('\n')
  const activities = ACTIVITY_LEVELS.map((a) => `- ${a.slug}: ${a.label} (${a.description})`).join('\n')
  const pathologies = PATHOLOGIES.map((p) => `- ${p.slug} (${p.region}): ${p.label}`).join('\n')
  return { regions, activities, pathologies }
}

function buildContextFromPatient(patient: any): string {
  const anamnesis = (patient.anamnesis_forms || [])
    .filter((a: any) => a.status === 'completed')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const assessment = (patient.assessments || [])
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const report = (patient.reports || [])
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  let ctx = `PACIENTE: ${patient.full_name}\n`
  if (patient.date_of_birth) {
    const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    ctx += `Edad: ${age} años\n`
  }
  if (patient.gender) {
    ctx += `Sexo: ${patient.gender === 'male' ? 'Hombre' : patient.gender === 'female' ? 'Mujer' : 'Otro'}\n`
  }

  if (anamnesis?.form_data) {
    const fd = anamnesis.form_data
    const keepKeys = [
      'occupation', 'work_demands', 'physical_activity', 'activity_detail',
      'main_reason', 'duration', 'onset', 'onset_detail',
      'pain_location', 'pain_radiation', 'radiation_detail', 'pain_sensation',
      'pain_constancy', 'pain_intensity_7d', 'pain_mechanical_behavior',
      'pain_aggravates', 'pain_movement_timing', 'pain_relieves',
      'night_pain', 'activities_lost', 'previous_diagnosis', 'previous_treatments',
    ]
    const relevant = Object.entries(fd)
      .filter(([k]) => keepKeys.includes(k))
      .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')
    if (relevant) ctx += `\nANAMNESIS:\n${relevant}\n`
  }

  if (assessment?.assessment_data) {
    const ad = assessment.assessment_data
    // Keep only the diagnosis-related fields + region info
    const diag = Object.entries(ad)
      .filter(([k]) =>
        k.includes('diagnosis') ||
        k.includes('region') ||
        k.includes('hallazgos') ||
        k.includes('conclusion')
      )
      .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')
    if (diag) ctx += `\nVALORACIÓN (diagnóstico y hallazgos):\n${diag}\n`
    if (assessment.notes) ctx += `\nNotas valoración: ${assessment.notes}\n`
  }

  if (report?.report_data) {
    const rd = report.report_data
    if (rd.conclusiones) ctx += `\nCONCLUSIONES DEL INFORME:\n${typeof rd.conclusiones === 'string' ? rd.conclusiones : JSON.stringify(rd.conclusiones)}\n`
    if (rd.resumen_anamnesis) ctx += `\nRESUMEN ANAMNESIS (informe):\n${rd.resumen_anamnesis}\n`
  }

  return ctx
}

async function classifyOne(
  patient: any,
  anthropic: Anthropic
): Promise<{
  body_region: string | null
  pathology_tag: string | null
  pathology_label: string | null
  activity_level: string | null
  confidence: number
  reasoning: string
} | null> {
  const { regions, activities, pathologies } = buildVocab()
  const context = buildContextFromPatient(patient)

  if (!context.includes('ANAMNESIS') && !context.includes('VALORACIÓN') && !context.includes('INFORME')) {
    // Not enough data to classify
    return null
  }

  const userMessage = `VOCABULARIO PERMITIDO:

REGIONES CORPORALES (body_region):
${regions}

NIVELES DE ACTIVIDAD (activity_level):
${activities}

PATOLOGÍAS (pathology_tag):
${pathologies}

---

HISTORIAL DEL PACIENTE:
${context}

---

Clasifica. Devuelve SOLO el JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const responseText = message.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : responseText
    const parsed = JSON.parse(jsonStr.trim())

    // Validate against vocabulary
    const validRegion = BODY_REGIONS.some((r) => r.slug === parsed.body_region) ? parsed.body_region : null
    const validActivity = ACTIVITY_LEVELS.some((a) => a.slug === parsed.activity_level) ? parsed.activity_level : null
    const validPathology = PATHOLOGIES.some((p) => p.slug === parsed.pathology_tag) ? parsed.pathology_tag : null

    return {
      body_region: validRegion,
      pathology_tag: validPathology,
      pathology_label: parsed.pathology_label || null,
      activity_level: validActivity,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: parsed.reasoning || '',
    }
  } catch (e) {
    console.error('Classifier parse error:', responseText.substring(0, 400))
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await request.json().catch(() => ({}))
    const { patientId, backfill, force } = body

    const anthropic = new Anthropic({ apiKey })

    const select = `*, anamnesis_forms(*), assessments(*), reports(*)`

    if (patientId) {
      const { data: patient, error } = await adminSupabase
        .from('patients')
        .select(select)
        .eq('id', patientId)
        .eq('clinic_id', profile.clinic_id)
        .single()
      if (error || !patient) {
        return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
      }

      if (!force && patient.classification_source === 'manual') {
        // Don't overwrite manual classification
        return NextResponse.json({ skipped: true, reason: 'manual' })
      }

      const result = await classifyOne(patient, anthropic)
      if (!result) {
        return NextResponse.json({ skipped: true, reason: 'insufficient_data' })
      }

      const { error: updateError } = await adminSupabase
        .from('patients')
        .update({
          body_region: result.body_region,
          pathology_tag: result.pathology_tag,
          pathology_label: result.pathology_label,
          activity_level: result.activity_level,
          classification_source: 'ai',
          classification_confidence: result.confidence,
          classified_at: new Date().toISOString(),
        })
        .eq('id', patientId)
      if (updateError) {
        console.error('Classify update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, classification: result })
    }

    if (backfill) {
      // Classify all patients in the clinic that don't have classification yet
      let q = adminSupabase
        .from('patients')
        .select(select)
        .eq('clinic_id', profile.clinic_id)
        .eq('status', 'active')
      if (!force) {
        q = q.is('classified_at', null)
      }
      const { data: patients, error } = await q
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const results: any[] = []
      for (const patient of patients || []) {
        try {
          if (!force && patient.classification_source === 'manual') {
            results.push({ id: patient.id, skipped: 'manual' })
            continue
          }
          const result = await classifyOne(patient, anthropic)
          if (!result) {
            results.push({ id: patient.id, skipped: 'insufficient_data' })
            continue
          }
          await adminSupabase
            .from('patients')
            .update({
              body_region: result.body_region,
              pathology_tag: result.pathology_tag,
              pathology_label: result.pathology_label,
              activity_level: result.activity_level,
              classification_source: 'ai',
              classification_confidence: result.confidence,
              classified_at: new Date().toISOString(),
            })
            .eq('id', patient.id)
          results.push({ id: patient.id, classification: result })
        } catch (e: any) {
          console.error('Backfill error patient', patient.id, e)
          results.push({ id: patient.id, error: e.message })
        }
      }
      return NextResponse.json({ success: true, count: results.length, results })
    }

    return NextResponse.json({ error: 'patientId o backfill requerido' }, { status: 400 })
  } catch (error: any) {
    console.error('Classify API error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// PATCH /api/patients/classify — manual override by physio
export async function PATCH(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { patientId, body_region, pathology_tag, pathology_label, activity_level, confirm } = await request.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const payload: Record<string, any> = {
      classification_source: confirm ? 'ai_confirmed' : 'manual',
      classified_at: new Date().toISOString(),
    }
    if (body_region !== undefined) payload.body_region = body_region
    if (pathology_tag !== undefined) payload.pathology_tag = pathology_tag
    if (pathology_label !== undefined) payload.pathology_label = pathology_label
    if (activity_level !== undefined) payload.activity_level = activity_level

    const { error } = await adminSupabase
      .from('patients')
      .update(payload)
      .eq('id', patientId)
      .eq('clinic_id', profile.clinic_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Classify PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
