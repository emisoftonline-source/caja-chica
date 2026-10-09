# Caja Chica

Sistema de control de caja chica: fondos, gastos, firmas, anulaciones, cierres mensuales, devoluciones a Contabilidad, reportes, usuarios con roles y logo de empresa. Hecho con React + TypeScript + Vite + Supabase, listo para publicar en Netlify. Funciona bien tanto en computadora como en celular.

## Antes de empezar

No necesitas saber programación para dejar esto funcionando. Solo vas a hacer 4 cosas, en este orden:

1. Crear tu proyecto en Supabase y pegar un script SQL (una sola vez).
2. Pegar dos datos de conexión en un archivo de configuración.
3. Crear tu primer usuario (Super Administrador).
4. Publicar el proyecto en Netlify.

---

## Paso 1 — Crear la base de datos en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (si no tienes una) y un **proyecto nuevo**. Elige cualquier nombre y una contraseña de base de datos (no la necesitarás después, solo guárdala).
2. Espera a que el proyecto termine de crearse (1-2 minutos).
3. En el menú de la izquierda, entra a **SQL Editor**.
4. Haz clic en **New query**.
5. Abre el archivo `database/setup.sql` de esta carpeta, copia **todo** su contenido, y pégalo en el editor.
6. Haz clic en **Run** (o el botón ▶). Debe decir "Success. No rows returned".

Eso es todo en la base de datos. Ese script ya creó las tablas, las reglas de seguridad y el espacio de almacenamiento para el logo — no necesitas tocar nada más ahí.

### Un ajuste recomendado (para que los usuarios nuevos puedan entrar de inmediato)

Por defecto, Supabase le pide a cada usuario nuevo que confirme su correo antes de poder iniciar sesión. Como tú vas a crear las cuentas de tus empleados desde dentro del programa (no ellos mismos), te conviene desactivar ese paso:

1. En Supabase, ve a **Authentication** → **Providers** → (o **Sign In / Providers** según la versión) → **Email**.
2. Busca la opción **"Confirm email"** y desactívala.
3. Guarda los cambios.

Si prefieres dejarla activada, cada usuario nuevo deberá confirmar su correo (revisando su bandeja de entrada) antes de poder iniciar sesión por primera vez.

---

## Paso 2 — Conectar la aplicación a tu proyecto de Supabase

1. En Supabase, ve a **Settings** (el ícono de engranaje, abajo a la izquierda) → **API**.
2. Vas a ver dos datos que necesitas copiar:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (una clave larga de letras y números) — también puede aparecer como **"Publishable key"**
3. Dentro de esta carpeta del proyecto, busca el archivo `.env.example` y haz una copia de él llamada exactamente `.env` (sin ".example").
4. Abre `.env` con cualquier editor de texto y pega ahí los dos valores:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-larga-aquí
```

5. Guarda el archivo. Eso es todo — no necesitas cambiar nada más en ningún otro archivo.

> Nunca pegues ahí la "service_role key". Esa clave es secreta y esta aplicación no la usa para nada.

---

## Paso 3 — Crear tu primer usuario (Super Administrador)

Esta es la única cuenta que se crea manualmente. Todas las demás (administradores, cajeros) las vas a crear después desde dentro del programa, en la pantalla "Usuarios".

1. En Supabase, ve a **Authentication** → **Users**.
2. Haz clic en **Add user** → **Create new user**.
3. Escribe el correo y la contraseña que vas a usar para entrar como Super Administrador.
4. Marca la casilla **Auto Confirm User** (si aparece) para no tener que confirmar el correo.
5. Guarda.

Con eso ya tienes tu cuenta lista. La primera vez que ese usuario inicia sesión en la aplicación, el sistema automáticamente:
- crea tu empresa ("Mi Empresa" — puedes cambiarle el nombre y el logo luego, en Configuración),
- abre tu primer período de caja,
- y te asigna el rol de **Super Administrador**.

---

## Paso 4 — Probar en tu computadora (opcional) y publicar en Netlify

### Probar en tu computadora antes de publicar (opcional)

Si tienes Node.js instalado:

```
npm install
npm run dev
```

Y abre la dirección que te muestre en pantalla (normalmente `http://localhost:5173`).

### Publicar en Netlify

1. Sube esta carpeta a un repositorio de GitHub (o arrastra la carpeta directamente a Netlify si usas "Deploy manually").
2. En [netlify.com](https://netlify.com), crea un nuevo sitio desde ese repositorio.
3. Netlify va a detectar automáticamente:
   - Comando de construcción: `npm run build`
   - Carpeta a publicar: `dist`
4. Antes de publicar, ve a **Site configuration → Environment variables** y agrega las mismas dos variables de tu archivo `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Publica el sitio (Deploy site).

El archivo `netlify.toml` y `public/_redirects` ya vienen incluidos, así que las distintas pantallas del programa (Dashboard, Gastos, Usuarios, etc.) van a funcionar bien incluso si alguien entra directo a una de esas direcciones o actualiza la página.

---

## Qué incluye el programa

- **Dashboard**: saldo disponible, fondos ingresados y total gastado del período actual.
- **Fondos**: historial de dinero entregado por Contabilidad, con filtros de fecha y búsqueda, e impresión del historial.
- **Gastos**: registrar, editar y anular gastos; cada uno con firma "Entregué conforme" y "Recibí conforme" (nombre + C.I.); impresión de cada comprobante y de un reporte general filtrado.
- **Cierre mensual**: resumen del período, cierre con devolución de saldo a Contabilidad, y consulta/impresión de cierres anteriores.
- **Reportes**: gasto por tipo de pago, activos vs. anulados, historial de cierres, con impresión.
- **Usuarios**: crear usuarios con correo y contraseña (quedan activos de inmediato), editar nombre, y — solo el Super Administrador — asignar roles y habilitar/inhabilitar usuarios.
- **Configuración**: nombre de la empresa y logo (se sube a Supabase y se ve igual para todos los usuarios).

### Roles

- **Super Administrador**: todo lo del Administrador, además de asignar roles y habilitar/inhabilitar usuarios.
- **Administrador**: fondos, gastos, cierres, reportes, usuarios (crear/editar, sin cambiar roles ni estado), configuración.
- **Cajero**: ve el dashboard y registra gastos. No puede añadir fondos, anular, editar, cerrar el mes ni gestionar usuarios.

Estos permisos están protegidos en dos capas: la interfaz los respeta (oculta botones que no corresponden), y además la base de datos los exige mediante reglas de seguridad (RLS) y funciones que verifican el rol — así que aunque alguien intente saltarse la pantalla, la base de datos de todas formas rechaza la operación.

Solo un Super Administrador puede convertir a otra persona en Super Administrador o en Administrador. Cuando un Administrador registra un usuario nuevo, ese usuario siempre queda como Cajero, sin excepción — esto lo exige la base de datos, no solo la pantalla, así que no se puede evadir manipulando la aplicación desde el navegador.

### Reglas de integridad del dinero

- Nunca se puede registrar un gasto mayor al saldo disponible ("Saldo insuficiente al momento de registrar"), incluso si dos personas intentan gastar al mismo tiempo — la base de datos bloquea el cálculo mientras se verifica, evitando que ambas pasen a la vez.
- Los gastos nunca se eliminan: se **anulan**, quedan visibles en el historial, pero dejan de afectar el saldo.
- Cada edición de un gasto guarda el monto anterior y quién hizo el cambio.
- Un período cerrado no admite nuevos gastos, fondos ni ediciones.
- Todo el historial (fondos, gastos, anulaciones, cierres) queda guardado para siempre en Supabase. No existe backup local ni restaurar sistema.

---

## Problemas comunes

- **"Falta configurar VITE_SUPABASE_URL..." en la consola / pantalla en blanco**: revisa que el archivo `.env` tenga los dos valores bien pegados (en Netlify, que estén en Environment variables) y que vuelvas a publicar después de agregarlos.
- **Un usuario nuevo no puede iniciar sesión después de creado**: revisa el ajuste de "Confirm email" del Paso 1, o pídele que confirme su correo si lo dejaste activado.
- **"Correo o contraseña incorrectos"**: confírmalo en Supabase → Authentication → Users, que el correo esté escrito igual y que la cuenta exista.
- **Al refrescar una página interna (ej. /gastos) aparece un error 404**: asegúrate de que `public/_redirects` y `netlify.toml` se hayan subido junto con el resto del proyecto (ya vienen incluidos).
- **"Saldo insuficiente al momento de registrar"**: es el comportamiento esperado — el gasto supera el saldo disponible del período actual.
