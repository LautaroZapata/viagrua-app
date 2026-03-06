import { createBrowserClient } from '@supabase/ssr';

// Cliente de Supabase para el navegador usando @supabase/ssr.
// Esto permite que la sesión se comparta correctamente con Middleware/SSR via cookies.
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);