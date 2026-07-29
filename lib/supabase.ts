import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

// Cliente de Supabase para el navegador usando @supabase/ssr.
// Esto permite que la sesión se comparta correctamente con Middleware/SSR via cookies.
//
// El generico <Database> viene de lib/database.types.ts, generado con
// `pnpm db:types` contra la base real. Sin el, cada query devuelve any y los
// nombres de columna no se validan: asi fue como se colaron user_id en vez de
// usuario_id, y un update sobre perfiles.telefono cuando la columna no existia.
export const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
