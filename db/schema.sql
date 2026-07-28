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
  -- Los formularios del panel ya validan, pero la restricción vive aquí: es lo
  -- único que no se puede evadir. Un slot_granularity de 0 rompe el generador.
  constraint businesses_window_sane check (booking_window_days between 1 and 180),
  constraint businesses_notice_sane check (min_notice_minutes between 0 and 10080),
  constraint businesses_granularity_sane check (slot_granularity_minutes between 5 and 60),
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
  active boolean not null default true
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
  constraint services_duration_positive check (duration_minutes > 0 and duration_minutes <= 720),
  constraint services_buffer_sane check (buffer_after_minutes >= 0 and buffer_after_minutes <= 240),
  constraint services_price_positive check (price_cents >= 0 and deposit_cents >= 0)
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
    ('confirmation','reminder_24h','reminder_2h','cancelled','rescheduled')),
  send_at timestamptz not null,
  sent_at timestamptz,
  error text,
  unique (appointment_id, kind)
);
create index on notifications (send_at) where sent_at is null;
