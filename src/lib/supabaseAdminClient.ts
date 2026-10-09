import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Cliente secundario, usado SOLO por la pantalla "Usuarios" para
// registrar (signUp) a un nuevo empleado sin cerrar la sesión del
// administrador que lo está creando. No guarda sesión en el navegador
// (persistSession: false) y usa la misma clave pública de siempre —
// nunca la service_role key, que esta aplicación no necesita.
export const supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
