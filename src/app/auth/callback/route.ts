import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If it's a recovery (password reset), redirect to the update password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`)
      }
      // Otherwise redirect to dashboard
      return NextResponse.redirect(`${origin}/patients`)
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
