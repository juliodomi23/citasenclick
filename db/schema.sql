-- Esquema de "Citas en un Click". Ver ARQUITECTURA.md §2.
-- ponytail: SQL plano en vez de migraciones Drizzle. Cuando haya un segundo
-- entorno que migrar sin poder recrear la DB, meter drizzle-kit.

create extension if not exists btree_gist;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  timezone text not null default 'America/Mexico_City',
  whatsapp_phone text,
  booking_window_days int not null default 30,
  min_notice_minutes int not null default 120,
  slot_granularity_minutes int not null default 15,
  -- Marca por cliente: la fija el superadmin, no el dueño del negocio.
  logo_url text,
  theme text not null default 'rosa',
  -- Link de reseña (Google, Facebook...). NULL = no se pide reseña.
  review_url text,
  -- Los formularios del panel ya validan, pero la restricción vive aquí: es lo
  -- único que no se puede evadir. Un slot_granularity de 0 rompe el generador.
  constraint businesses_window_sane check (booking_window_days between 1 and 180),
  constraint businesses_notice_sane check (min_notice_minutes between 0 and 10080),
  constraint businesses_granularity_sane check (slot_granularity_minutes between 5 and 60),
  constraint businesses_theme_valido check (theme in ('rosa', 'azul', 'verde', 'ambar', 'grafito')),
  created_at timestamptz default now()
);

-- Solo dueños/recepción. El cliente final NO existe aquí.
create table users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  email text unique,
  phone text unique,                            -- E.164, para el magic link
  role text not null check (role in ('owner','staff')),
  password text,                                -- NULL = sin contraseña aún (primera vez)
  created_at timestamptz default now(),
  constraint users_contact_present check (phone is not null or email is not null)
);

-- Magic link: un solo uso, 15 minutos. Ver §9.
create table login_tokens (
  token text primary key default replace(gen_random_uuid()::text,'-',''),
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on login_tokens (user_id, created_at);   -- para el límite de envíos

create table sessions (
  token text primary key default replace(gen_random_uuid()::text,'-',''),
  user_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (expires_at);

create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  user_id uuid references users on delete set null,
  name text not null,
  active boolean not null default true,
  commission_pct numeric(5, 2) not null default 0,
  constraint staff_commission_sane check (commission_pct >= 0 and commission_pct <= 100)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  name text not null,
  duration_minutes int not null,
  buffer_after_minutes int not null default 0,
  price_cents int not null default 0,
  deposit_cents int not null default 0,
  active boolean not null default true,
  -- Cada cuántos días conviene recordarle al cliente que le toca de nuevo.
  -- NULL = desactivado.
  rebook_after_days int,
  constraint services_duration_positive check (duration_minutes > 0 and duration_minutes <= 720),
  constraint services_buffer_sane check (buffer_after_minutes >= 0 and buffer_after_minutes <= 240),
  constraint services_price_positive check (price_cents >= 0 and deposit_cents >= 0),
  constraint services_rebook_sane check (rebook_after_days is null or rebook_after_days between 1 and 365)
);

create table staff_services (
  staff_id uuid references staff on delete cascade,
  service_id uuid references services on delete cascade,
  primary key (staff_id, service_id)
);

create table schedule_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0=domingo
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  date date not null,
  start_time time,       -- NULL + NULL = día cerrado completo
  end_time time,
  reason text
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  staff_id uuid not null references staff on delete cascade,
  service_id uuid not null references services,
  customer_name text not null,
  customer_phone text not null,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,                 -- incluye buffer_after
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','no_show','completed')),
  -- ponytail: uuid v4 sin guiones (122 bits) en vez de pgcrypto/gen_random_bytes.
  -- Una extensión menos que instalar; igual de imposible de adivinar.
  manage_token text unique not null default replace(gen_random_uuid()::text,'-',''),
  created_at timestamptz default now(),

  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

create index on appointments (business_id, starts_at);
create index on appointments (staff_id, starts_at);

create table notifications (
  id bigserial primary key,
  appointment_id uuid not null references appointments on delete cascade,
  kind text not null check (kind in
    ('confirmation','reminder_24h','reminder_2h','cancelled','rescheduled',
     'new_booking_alert','rebook_reminder','review_request')),
  send_at timestamptz not null,
  sent_at timestamptz,
  error text,
  unique (appointment_id, kind)
);
create index on notifications (send_at) where sent_at is null;

-- Lista de espera: cuando no hay horario, la clienta se anota y se le avisa
-- por WhatsApp si se libera un lugar (cancelación o no-show). Va directo a
-- n8n, no por la outbox: es first-come-first-served, no tiene sentido tarde.
create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  staff_id uuid references staff on delete cascade,   -- NULL = cualquiera
  service_id uuid not null references services on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  date date not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index on waitlist_entries (business_id, service_id, date) where notified_at is null;

-- Inventario y corte de caja.
-- ponytail: una sola tabla "sales" en vez de sales + sale_items — cada cobro
-- (de una cita o de un producto) es una sola fila. Si algún día hace falta
-- vender varios productos en una misma transacción, ahí se separa en items.

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  name text not null,
  price_cents int not null default 0,
  stock int not null default 0,
  active boolean not null default true,
  constraint products_price_positive check (price_cents >= 0),
  constraint products_stock_sane check (stock >= 0)
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  staff_id uuid references staff on delete set null,
  appointment_id uuid references appointments on delete set null,
  product_id uuid references products on delete set null,
  -- Nombre del servicio o producto al momento del cobro: si luego se renombra
  -- o se oculta el servicio/producto, el corte de caja de ese día no cambia.
  description text not null,
  qty int not null default 1,
  payment_method text not null check (payment_method in ('efectivo', 'tarjeta', 'transferencia')),
  total_cents int not null check (total_cents >= 0),
  -- Congelada al momento del cobro (como "description"): si luego cambias el
  -- % de un especialista, el corte de un día viejo no se mueve.
  commission_cents int not null default 0,
  created_at timestamptz not null default now(),
  constraint sales_qty_positive check (qty > 0)
);
create index on sales (business_id, created_at);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  -- 'cierre' es el conteo físico al final del día, no un movimiento de
  -- dinero — vive en la misma tabla porque también es "algo que pasó en la
  -- caja ese día" y así el arqueo se arma con una sola query.
  type text not null check (type in ('apertura', 'retiro', 'deposito', 'cierre')),
  amount_cents int not null check (amount_cents >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index on cash_movements (business_id, created_at);
