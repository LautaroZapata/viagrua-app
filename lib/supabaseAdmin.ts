import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

let keyToUse = SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  // Fallback to anon key only in development to allow local testing.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production')
  }
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY not set — falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY for local development')
  keyToUse = ANON_KEY
}

if (!keyToUse) {
  throw new Error('supabaseKey is required. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment')
}

export const supabaseAdmin = createClient(SUPABASE_URL, keyToUse)
