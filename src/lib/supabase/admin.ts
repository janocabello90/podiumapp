import { createClient } from '@supabase/supabase-js'

// Admin client bypasses RLS and storage bucket MIME restrictions
// Requires SUPABASE_SERVICE_ROLE_KEY in environment variables
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
      'Add it in Supabase Dashboard → Settings → API → service_role key'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
