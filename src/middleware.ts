import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rutas públicas permitidas en el dominio "solo anamnesis" (pacientes).
function isPublicAnamnesisPath(path: string): boolean {
  return (
    path.startsWith('/anamnesis') ||
    path.startsWith('/api/anamnesis') ||
    path.startsWith('/privacidad') ||
    path.startsWith('/aviso-legal') ||
    path.startsWith('/cookies') ||
    path.startsWith('/brand') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon')
  )
}

export async function middleware(request: NextRequest) {
  // Dominio público (pacientes): si PUBLIC_ANAMNESIS_HOST está configurado y la petición
  // llega por ESE host, solo se permiten las rutas de anamnesis. Cualquier otra (raíz,
  // /login, /dashboard, /patients…) se bloquea, para que el paciente NO descubra la app.
  const publicHost = process.env.PUBLIC_ANAMNESIS_HOST
  if (publicHost) {
    const host = (request.headers.get('host') || '').toLowerCase()
    if (host === publicHost.toLowerCase()) {
      if (isPublicAnamnesisPath(request.nextUrl.pathname)) {
        return NextResponse.next()
      }
      // Redirige fuera (a la web de la clínica) o 404 neutro — no revela la app.
      const redirectTo = process.env.PUBLIC_REDIRECT_URL
      if (redirectTo) return NextResponse.redirect(redirectTo)
      return new NextResponse('Not found', { status: 404 })
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
