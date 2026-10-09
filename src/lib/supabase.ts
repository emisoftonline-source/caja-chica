import { createClient } from "@supabase/supabase-js";

// Estos dos valores son los ÚNICOS que debes configurar.
// Ve a tu archivo .env (creado a partir de .env.example) y pega ahí
// la URL de tu proyecto y la clave "anon public" / "publishable".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en tu archivo .env"
  );
}

// Cliente principal: lo usa toda la aplicación para iniciar sesión y
// leer/escribir datos del usuario que está conectado en este momento.
export const supabase = createClient(supabaseUrl, supabaseKey);
