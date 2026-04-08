import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Verify auth
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const patientId = formData.get('patient_id') as string
    const docType = formData.get('doc_type') as string || 'vald_report'

    if (!file || !patientId) {
      return NextResponse.json({ error: 'Archivo y patient_id requeridos' }, { status: 400 })
    }

    // Determine storage bucket and path
    const isImage = file.type.startsWith('image/')
    const bucketName = 'documents'
    const fileName = `${profile.clinic_id}/${patientId}/${Date.now()}_${file.name}`

    // Get admin client for storage operations
    let adminSupabase: ReturnType<typeof createAdminSupabaseClient> | null = null
    try {
      adminSupabase = createAdminSupabaseClient()
    } catch (e: any) {
      console.warn('Admin client not available:', e.message)
    }

    // If uploading an image, ensure bucket accepts image MIME types
    if (isImage && adminSupabase) {
      try {
        await adminSupabase.storage.updateBucket(bucketName, {
          public: false,
          allowedMimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
          ],
        })
      } catch (bucketErr: any) {
        console.warn('Could not update bucket MIME types:', bucketErr.message)
      }
    }

    // Upload file
    const storageClient = adminSupabase || supabase
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)

      // Helpful error message for MIME type issues
      if (uploadError.message?.includes('mime type') || uploadError.message?.includes('not supported')) {
        return NextResponse.json({
          error: `Tipo de archivo no soportado (${file.type}). Asegúrate de que SUPABASE_SERVICE_ROLE_KEY está configurada en las variables de entorno.`,
        }, { status: 400 })
      }

      return NextResponse.json({ error: 'Error al subir archivo: ' + uploadError.message }, { status: 500 })
    }

    // Create document record (using regular client with RLS)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        patient_id: patientId,
        clinic_id: profile.clinic_id,
        uploaded_by: user.id,
        doc_type: docType,
        file_name: file.name,
        storage_path: uploadData.path,
        extraction_status: isImage ? 'completed' : 'pending',
      })
      .select()
      .single()

    if (docError) {
      console.error('Document record error:', docError)
      return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// Get signed URL for viewing
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storagePath = searchParams.get('path')

    if (!storagePath) {
      return NextResponse.json({ error: 'Path requerido' }, { status: 400 })
    }

    // Try admin client first (no restrictions), fallback to regular
    let signedUrl: string | undefined
    try {
      const adminSupabase = createAdminSupabaseClient()
      const { data, error } = await adminSupabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 3600)
      if (!error && data) signedUrl = data.signedUrl
    } catch {
      // Fallback
    }

    if (!signedUrl) {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 3600)
      if (error) {
        return NextResponse.json({ error: 'Error al generar URL' }, { status: 500 })
      }
      signedUrl = data.signedUrl
    }

    return NextResponse.json({ url: signedUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
