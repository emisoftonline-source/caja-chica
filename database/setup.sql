-- =====================================================================
-- CAJA CHICA — SCRIPT ÚNICO DE BASE DE DATOS (Supabase / PostgreSQL)
-- Copia TODO este archivo y pégalo en: tu proyecto de Supabase →
-- SQL Editor → New query → pega esto → Run. Es seguro volver a
-- ejecutarlo si algo falla a mitad de camino (no duplica nada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECCIÓN 1: TIPOS DE DATO (roles, estados)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('superadmin', 'admin', 'cajero');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.period_estado as enum ('abierto', 'cerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_pago as enum ('efectivo', 'qr', 'cheque');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_estado as enum ('activo', 'anulado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- SECCIÓN 2: TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi Empresa',
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'cajero',
  company_id uuid references public.companies(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  nombre text not null,
  -- Primer día del mes que representa este período (no depende de la
  -- fecha de la computadora de quien cierra el mes). Se usa para
  -- calcular el nombre del próximo período automáticamente.
  periodo_mes date not null default date_trunc('month', now())::date,
  estado public.period_estado not null default 'abierto',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.cash_periods add column if not exists periodo_mes date not null default date_trunc('month', now())::date;

-- Solo puede existir un período ABIERTO por empresa a la vez.
create unique index if not exists idx_one_open_period_per_company
  on public.cash_periods (company_id)
  where estado = 'abierto';

create table if not exists public.fund_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period_id uuid not null references public.cash_periods(id),
  monto numeric(12,2) not null check (monto > 0),
  detalle text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period_id uuid not null references public.cash_periods(id),
  persona text not null,
  motivo text not null,
  monto numeric(12,2) not null check (monto > 0),
  tipo_pago public.tipo_pago not null,
  estado public.expense_estado not null default 'activo',
  entregado_nombre text,
  entregado_ci text,
  recibido_nombre text,
  recibido_ci text,
  editado boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anulado_por uuid references public.profiles(id),
  anulado_at timestamptz,
  motivo_anulacion text
);

create table if not exists public.expense_edits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  monto_anterior numeric(12,2) not null,
  monto_nuevo numeric(12,2) not null,
  editado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_closures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period_id uuid not null references public.cash_periods(id) unique,
  fondos_total numeric(12,2) not null,
  gastado_total numeric(12,2) not null,
  saldo_devuelto numeric(12,2) not null,
  cerrado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  usuario_id uuid references public.profiles(id),
  accion text not null,
  tabla text,
  registro_id uuid,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_company on public.profiles(company_id);
create index if not exists idx_periods_company on public.cash_periods(company_id);
create index if not exists idx_funds_period on public.fund_entries(period_id);
create index if not exists idx_expenses_period on public.expenses(period_id);
create index if not exists idx_expenses_estado on public.expenses(estado);
create index if not exists idx_expenses_company on public.expenses(company_id);
create index if not exists idx_closures_company on public.monthly_closures(company_id);
create index if not exists idx_audit_company on public.audit_logs(company_id);

-- ---------------------------------------------------------------------
-- SECCIÓN 3: FUNCIONES AUXILIARES (evitan recursión en políticas RLS)
-- ---------------------------------------------------------------------
create or replace function public.fn_current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.fn_current_company()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- SECCIÓN 4: CREACIÓN AUTOMÁTICA DE PERFIL AL REGISTRAR UN USUARIO
-- El primer usuario que se registre se vuelve Super Administrador y
-- crea la empresa inicial junto con el primer período. Los siguientes
-- usuarios se crean desde dentro del programa (pantalla Usuarios).
--
-- IMPORTANTE (seguridad): este disparador NUNCA confía en el rol que
-- venga del navegador (raw_user_meta_data). Todo usuario que no sea el
-- primero se crea siempre como 'cajero'. Si quien lo está creando es
-- Super Administrador y quiere darle otro rol, la propia aplicación
-- llama justo después a fn_set_user_role(), que es la única función
-- capaz de cambiar un rol y que ya verifica, dentro de la base de
-- datos, que quien la ejecuta sea realmente un Super Administrador.
-- Así, nadie puede fabricarse a sí mismo (ni a otro) como Super
-- Administrador manipulando la aplicación desde el navegador.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_role public.user_role;
  v_is_first boolean;
begin
  select count(*) = 0 into v_is_first from public.profiles;

  if v_is_first then
    insert into public.companies (nombre) values ('Mi Empresa') returning id into v_company_id;
    insert into public.cash_periods (company_id, nombre, estado)
      values (v_company_id, upper(to_char(now(), 'TMMonth YYYY')), 'abierto');
    v_role := 'superadmin';
  else
    -- Importante: la empresa del usuario nuevo es la del Super
    -- Administrador real (el perfil "superadmin" más antiguo), no
    -- "la empresa más antigua de toda la base de datos". Si alguna vez
    -- quedó una empresa huérfana (de una prueba, o de una cuenta que
    -- ya no existe), esto evita que el usuario nuevo caiga ahí y
    -- desaparezca de la lista de usuarios del administrador real.
    select company_id into v_company_id
    from public.profiles
    where role = 'superadmin'
    order by created_at asc
    limit 1;

    if v_company_id is null then
      select id into v_company_id from public.companies order by created_at asc limit 1;
    end if;

    v_role := 'cajero';
  end if;

  insert into public.profiles (id, email, full_name, role, company_id, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_company_id,
    true
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- SECCIÓN 4B: REPARACIÓN (seguro de repetir) — corrige perfiles que
-- hayan quedado asignados a una empresa huérfana por el error descrito
-- arriba, uniéndolos a la empresa real del Super Administrador. No
-- toca fondos, gastos, períodos ni cierres: solo la ficha del usuario.
-- ---------------------------------------------------------------------
do $$
declare
  v_real_company uuid;
begin
  select company_id into v_real_company
  from public.profiles
  where role = 'superadmin'
  order by created_at asc
  limit 1;

  if v_real_company is not null then
    update public.profiles
       set company_id = v_real_company
     where company_id <> v_real_company;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- SECCIÓN 5: FUNCIONES DE NEGOCIO (RPC)
-- Toda escritura importante pasa por aquí, nunca directo a las tablas.
-- Usan "for update" para bloquear la fila del período mientras calculan
-- el saldo, así dos personas no pueden gastar al mismo tiempo más de
-- lo que hay disponible (evita condiciones de carrera / saldo negativo).
-- ---------------------------------------------------------------------

-- Si el script ya se había ejecutado con una versión anterior en la que
-- fn_cerrar_periodo recibía el nombre del próximo período como
-- parámetro, esto elimina esa versión vieja para no dejar funciones
-- duplicadas (ahora ese nombre se calcula dentro de la función).
drop function if exists public.fn_cerrar_periodo(uuid, text);

-- Registrar gasto (cualquier usuario activo)
create or replace function public.fn_registrar_gasto(
  p_period_id uuid, p_persona text, p_motivo text, p_monto numeric,
  p_tipo_pago public.tipo_pago, p_entregado_nombre text, p_entregado_ci text,
  p_recibido_nombre text, p_recibido_ci text
) returns public.expenses language plpgsql security definer set search_path = public as $$
declare
  v_profile record; v_period record; v_saldo numeric(12,2); v_expense public.expenses;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false then
    raise exception 'Usuario no autorizado';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Monto inválido';
  end if;

  select * into v_period from public.cash_periods where id = p_period_id for update;
  if v_period is null or v_period.company_id <> v_profile.company_id then
    raise exception 'Período no encontrado';
  end if;
  if v_period.estado <> 'abierto' then
    raise exception 'El período está cerrado, no se pueden registrar gastos';
  end if;

  select coalesce((select sum(monto) from public.fund_entries where period_id = p_period_id), 0)
       - coalesce((select sum(monto) from public.expenses where period_id = p_period_id and estado = 'activo'), 0)
  into v_saldo;

  if p_monto > v_saldo then
    raise exception 'Saldo insuficiente al momento de registrar';
  end if;

  insert into public.expenses (
    company_id, period_id, persona, motivo, monto, tipo_pago,
    entregado_nombre, entregado_ci, recibido_nombre, recibido_ci, created_by
  ) values (
    v_profile.company_id, p_period_id, p_persona, p_motivo, p_monto, p_tipo_pago,
    p_entregado_nombre, p_entregado_ci, p_recibido_nombre, p_recibido_ci, v_profile.id
  ) returning * into v_expense;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'crear_gasto', 'expenses', v_expense.id,
          jsonb_build_object('monto', p_monto, 'persona', p_persona));

  return v_expense;
end;
$$;

-- Anular gasto (solo admin / superadmin)
create or replace function public.fn_anular_gasto(p_expense_id uuid, p_motivo text default null)
returns public.expenses language plpgsql security definer set search_path = public as $$
declare v_profile record; v_expense record; v_period record;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado para anular gastos';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if v_expense is null or v_expense.company_id <> v_profile.company_id then
    raise exception 'Gasto no encontrado';
  end if;
  if v_expense.estado = 'anulado' then
    raise exception 'El gasto ya está anulado';
  end if;

  select * into v_period from public.cash_periods where id = v_expense.period_id;
  if v_period.estado <> 'abierto' then
    raise exception 'No se puede anular un gasto de un período cerrado';
  end if;

  update public.expenses
     set estado = 'anulado', anulado_por = v_profile.id, anulado_at = now(), motivo_anulacion = p_motivo
   where id = p_expense_id
  returning * into v_expense;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'anular_gasto', 'expenses', v_expense.id,
          jsonb_build_object('motivo', p_motivo));

  return v_expense;
end;
$$;

-- Editar gasto activo, con historial de auditoría (solo admin / superadmin)
create or replace function public.fn_editar_gasto(
  p_expense_id uuid, p_nuevo_monto numeric, p_persona text, p_motivo_gasto text,
  p_tipo_pago public.tipo_pago, p_entregado_nombre text, p_entregado_ci text,
  p_recibido_nombre text, p_recibido_ci text
) returns public.expenses language plpgsql security definer set search_path = public as $$
declare v_profile record; v_expense record; v_period record; v_saldo numeric(12,2);
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado para editar gastos';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if v_expense is null or v_expense.company_id <> v_profile.company_id then
    raise exception 'Gasto no encontrado';
  end if;
  if v_expense.estado <> 'activo' then
    raise exception 'Solo se pueden editar gastos activos';
  end if;

  select * into v_period from public.cash_periods where id = v_expense.period_id for update;
  if v_period.estado <> 'abierto' then
    raise exception 'No se puede editar un gasto de un período cerrado';
  end if;

  select coalesce((select sum(monto) from public.fund_entries where period_id = v_period.id), 0)
       - coalesce((select sum(monto) from public.expenses
                    where period_id = v_period.id and estado = 'activo' and id <> p_expense_id), 0)
  into v_saldo;

  if p_nuevo_monto > v_saldo then
    raise exception 'Saldo insuficiente al momento de registrar';
  end if;

  insert into public.expense_edits (expense_id, monto_anterior, monto_nuevo, editado_por)
  values (p_expense_id, v_expense.monto, p_nuevo_monto, v_profile.id);

  update public.expenses set
    monto = p_nuevo_monto,
    persona = coalesce(p_persona, persona),
    motivo = coalesce(p_motivo_gasto, motivo),
    tipo_pago = coalesce(p_tipo_pago, tipo_pago),
    entregado_nombre = coalesce(p_entregado_nombre, entregado_nombre),
    entregado_ci = coalesce(p_entregado_ci, entregado_ci),
    recibido_nombre = coalesce(p_recibido_nombre, recibido_nombre),
    recibido_ci = coalesce(p_recibido_ci, recibido_ci),
    editado = true,
    updated_at = now()
  where id = p_expense_id
  returning * into v_expense;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'editar_gasto', 'expenses', v_expense.id,
          jsonb_build_object('motivo', p_motivo_gasto));

  return v_expense;
end;
$$;

-- Añadir fondo (solo admin / superadmin)
create or replace function public.fn_agregar_fondo(p_period_id uuid, p_monto numeric, p_detalle text)
returns public.fund_entries language plpgsql security definer set search_path = public as $$
declare v_profile record; v_period record; v_fund public.fund_entries;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado para añadir fondos';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Monto inválido';
  end if;

  select * into v_period from public.cash_periods where id = p_period_id for update;
  if v_period is null or v_period.company_id <> v_profile.company_id or v_period.estado <> 'abierto' then
    raise exception 'El período no está abierto';
  end if;

  insert into public.fund_entries (company_id, period_id, monto, detalle, created_by)
  values (v_profile.company_id, p_period_id, p_monto, p_detalle, v_profile.id)
  returning * into v_fund;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'crear_fondo', 'fund_entries', v_fund.id,
          jsonb_build_object('monto', p_monto));

  return v_fund;
end;
$$;

-- Cerrar período mensual y abrir el siguiente (solo admin / superadmin).
-- El nombre y el mes del nuevo período se calculan aquí, a partir del
-- período que se está cerrando (periodo_mes), nunca con la fecha de la
-- computadora de quien hace clic en "Cerrar mes" — así da igual si el
-- cierre se hace el mismo día o varias semanas después.
create or replace function public.fn_cerrar_periodo(p_period_id uuid)
returns public.monthly_closures language plpgsql security definer set search_path = public as $$
declare
  v_profile record; v_period record; v_fondos numeric(12,2); v_gastado numeric(12,2);
  v_saldo numeric(12,2); v_closure public.monthly_closures; v_new_period public.cash_periods;
  v_siguiente_mes date; v_siguiente_nombre text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado para cerrar el período';
  end if;

  select * into v_period from public.cash_periods where id = p_period_id for update;
  if v_period is null or v_period.company_id <> v_profile.company_id then
    raise exception 'Período no encontrado';
  end if;
  if v_period.estado <> 'abierto' then
    raise exception 'El período ya está cerrado';
  end if;

  select coalesce(sum(monto), 0) into v_fondos from public.fund_entries where period_id = p_period_id;
  select coalesce(sum(monto), 0) into v_gastado from public.expenses where period_id = p_period_id and estado = 'activo';
  v_saldo := v_fondos - v_gastado;

  update public.cash_periods set estado = 'cerrado', closed_at = now() where id = p_period_id;

  insert into public.monthly_closures (company_id, period_id, fondos_total, gastado_total, saldo_devuelto, cerrado_por)
  values (v_profile.company_id, p_period_id, v_fondos, v_gastado, v_saldo, v_profile.id)
  returning * into v_closure;

  v_siguiente_mes := (v_period.periodo_mes + interval '1 month')::date;
  v_siguiente_nombre := upper(to_char(v_siguiente_mes, 'TMMonth YYYY'));

  insert into public.cash_periods (company_id, nombre, periodo_mes, estado)
  values (v_profile.company_id, v_siguiente_nombre, v_siguiente_mes, 'abierto')
  returning * into v_new_period;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'cerrar_periodo', 'cash_periods', p_period_id,
          jsonb_build_object('saldo_devuelto', v_saldo, 'nuevo_periodo_id', v_new_period.id));

  return v_closure;
end;
$$;

-- Un usuario actualiza su propio nombre (nunca su propio rol)
create or replace function public.fn_update_my_profile(p_full_name text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  update public.profiles set full_name = p_full_name, updated_at = now()
  where id = auth.uid()
  returning * into v_profile;
  return v_profile;
end;
$$;

-- Admin/superadmin edita nombre de un usuario de su empresa (nunca su rol aquí)
create or replace function public.fn_admin_update_profile(p_user_id uuid, p_full_name text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile record; v_target public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado';
  end if;

  update public.profiles set full_name = coalesce(p_full_name, full_name), updated_at = now()
  where id = p_user_id and company_id = v_profile.company_id
  returning * into v_target;

  if v_target is null then
    raise exception 'Usuario no encontrado';
  end if;
  return v_target;
end;
$$;

-- Asignar rol (solo superadmin, y nunca sobre sí mismo)
create or replace function public.fn_set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile record; v_target public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role <> 'superadmin' then
    raise exception 'Solo un Super Administrador puede asignar roles';
  end if;
  if p_user_id = v_profile.id then
    raise exception 'No puedes cambiar tu propio rol';
  end if;

  update public.profiles set role = p_role, updated_at = now()
  where id = p_user_id and company_id = v_profile.company_id
  returning * into v_target;

  if v_target is null then
    raise exception 'Usuario no encontrado';
  end if;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id, 'cambiar_rol', 'profiles', p_user_id,
          jsonb_build_object('nuevo_rol', p_role));

  return v_target;
end;
$$;

-- Habilitar / inhabilitar usuario (solo superadmin, y nunca sobre sí mismo)
create or replace function public.fn_set_user_active(p_user_id uuid, p_active boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile record; v_target public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role <> 'superadmin' then
    raise exception 'Solo un Super Administrador puede inhabilitar usuarios';
  end if;
  if p_user_id = v_profile.id then
    raise exception 'No puedes inhabilitarte a ti mismo';
  end if;

  update public.profiles set active = p_active, updated_at = now()
  where id = p_user_id and company_id = v_profile.company_id
  returning * into v_target;

  if v_target is null then
    raise exception 'Usuario no encontrado';
  end if;

  insert into public.audit_logs (company_id, usuario_id, accion, tabla, registro_id, detalle)
  values (v_profile.company_id, v_profile.id,
          case when p_active then 'habilitar_usuario' else 'inhabilitar_usuario' end,
          'profiles', p_user_id, '{}'::jsonb);

  return v_target;
end;
$$;

-- Configurar nombre/logo de la empresa (solo admin / superadmin)
create or replace function public.fn_update_company(p_nombre text, p_logo_url text)
returns public.companies language plpgsql security definer set search_path = public as $$
declare v_profile record; v_company public.companies;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.active = false or v_profile.role not in ('admin','superadmin') then
    raise exception 'No autorizado para configurar la empresa';
  end if;

  update public.companies set
    nombre = coalesce(p_nombre, nombre),
    logo_url = case when p_logo_url is not null then p_logo_url else logo_url end
  where id = v_profile.company_id
  returning * into v_company;

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------
-- SECCIÓN 6: SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY)
-- Solo existen políticas de lectura (SELECT). Toda escritura sensible
-- pasa por las funciones de la Sección 5, que validan el rol dentro de
-- la base de datos — así, aunque alguien use las herramientas del
-- navegador para saltarse la interfaz, Postgres igual se lo impide.
-- ---------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.cash_periods enable row level security;
alter table public.fund_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_edits enable row level security;
alter table public.monthly_closures enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (id = public.fn_current_company());

-- El nombre y el logo de la empresa también se muestran en la pantalla
-- de inicio de sesión, ANTES de entrar — ahí todavía no hay un usuario
-- identificado, así que se permite leer esos datos (nombre y logo,
-- nada financiero ni de usuarios) sin haber iniciado sesión.
drop policy if exists companies_select_public on public.companies;
create policy companies_select_public on public.companies for select to anon
  using (true);

-- Un Cajero solo puede ver su propio perfil (no la lista completa de
-- usuarios de la empresa). Administrador y Super Administrador sí ven
-- a todos los usuarios de su empresa, porque son quienes los gestionan.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (company_id = public.fn_current_company() and public.fn_current_role() in ('admin', 'superadmin'))
  );

drop policy if exists periods_select on public.cash_periods;
create policy periods_select on public.cash_periods for select to authenticated
  using (company_id = public.fn_current_company());

drop policy if exists funds_select on public.fund_entries;
create policy funds_select on public.fund_entries for select to authenticated
  using (company_id = public.fn_current_company());

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (company_id = public.fn_current_company());

drop policy if exists expense_edits_select on public.expense_edits;
create policy expense_edits_select on public.expense_edits for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.company_id = public.fn_current_company()));

drop policy if exists closures_select on public.monthly_closures;
create policy closures_select on public.monthly_closures for select to authenticated
  using (company_id = public.fn_current_company());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (company_id = public.fn_current_company() and public.fn_current_role() in ('admin','superadmin'));

-- ---------------------------------------------------------------------
-- SECCIÓN 7: ALMACENAMIENTO (STORAGE) — bucket para el logo de la empresa
-- Esto crea automáticamente la "carpeta" llamada "logos". No necesitas
-- crear nada manualmente en el panel de Supabase.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists logos_admin_write on storage.objects;
create policy logos_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.fn_current_role() in ('admin','superadmin'));

drop policy if exists logos_admin_update on storage.objects;
create policy logos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.fn_current_role() in ('admin','superadmin'));

drop policy if exists logos_admin_delete on storage.objects;
create policy logos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.fn_current_role() in ('admin','superadmin'));

-- =====================================================================
-- LISTO. No hay ningún otro paso manual en la base de datos.
-- La empresa y el primer período de caja se crean solos en cuanto
-- registras tu primera cuenta (ver README.md, Paso 2).
-- =====================================================================
