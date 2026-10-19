export const fmt = (n: number) =>
  "Bs. " + Number(n ?? 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO");
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso: string) => fmtDate(iso) + " · " + fmtTime(iso);

// Solo letras y espacios (incluye tildes y ñ) — para nombres y firmas
export const onlyLetters = (s: string) => s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ\s]/g, "");

// Solo números, letras y espacio — para "número + extensión" del C.I.
export const onlyCI = (s: string) => s.replace(/[^0-9A-Za-z\s]/g, "");

// Número de factura / recibo: letras, números, guion, barra y espacio
export const onlyDoc = (s: string) => s.replace(/[^0-9A-Za-z\-\/\s]/g, "");

// Correlativo del gasto con ceros a la izquierda (1 → "0001")
export const fmtNumero = (n: number) => String(n ?? 0).padStart(4, "0");

// Traduce errores técnicos de Postgres/Supabase a mensajes comprensibles
export function friendlyError(raw: unknown): string {
  const msg = (raw as any)?.message || String(raw);
  const known: Record<string, string> = {
    "Saldo insuficiente al momento de registrar": "Saldo insuficiente al momento de registrar",
    "El período está cerrado, no se pueden registrar gastos": "Este período ya está cerrado. No se pueden registrar nuevos gastos.",
    "No autorizado para anular gastos": "No tienes permiso para anular gastos.",
    "No autorizado para editar gastos": "No tienes permiso para editar gastos.",
    "No autorizado para añadir fondos": "No tienes permiso para añadir fondos.",
    "No autorizado para cerrar el período": "No tienes permiso para cerrar el período.",
    "El período ya está cerrado": "Este período ya fue cerrado anteriormente.",
    "Solo un Super Administrador puede asignar roles": "Solo un Super Administrador puede asignar roles.",
    "Solo un Super Administrador puede inhabilitar usuarios": "Solo un Super Administrador puede inhabilitar o habilitar usuarios.",
    "Solo un Super Administrador puede cambiar contraseñas": "Solo un Super Administrador puede cambiar contraseñas.",
    "Para tu propia contraseña usa la opción de recuperación": "Para tu propia contraseña usa «¿Olvidaste tu contraseña?» en el inicio de sesión.",
    "La contraseña debe tener al menos 6 caracteres": "La contraseña debe tener al menos 6 caracteres.",
    "No puedes cambiar tu propio rol": "No puedes cambiar tu propio rol.",
    "No puedes inhabilitarte a ti mismo": "No puedes inhabilitarte a ti mismo.",
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ya existe un usuario registrado con ese correo.",
  };
  for (const key in known) {
    if (msg.includes(key)) return known[key];
  }
  return msg || "Ocurrió un error inesperado. Intenta de nuevo.";
}
