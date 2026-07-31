-- Migración: lista de espera, recordatorio de re-agendar y solicitud de reseña.
-- Ejecutar con: psql $DATABASE_URL -f db/007-waitlist-rebook-review.sql

-- Cada N días, "te toca tu próximo [servicio]". NULL = desactivado para ese servicio.
alter table services add column rebook_after_days int;
alter table services add constraint services_rebook_sane
  check (rebook_after_days is null or rebook_after_days between 1 and 365);

-- Link de reseña (Google, Facebook, el que sea). NULL = no se pide reseña.
alter table businesses add column review_url text;

-- 'waitlist_available' se manda directo a n8n (como el login), no pasa por la
-- outbox: es first-come-first-served, no tiene sentido si llega tarde.
-- 'rebook_reminder' y 'review_request' sí van por la outbox (mismo patrón que
-- confirmation/reminder_24h): se programan al momento de completar la cita.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in
    ('confirmation','reminder_24h','reminder_2h','cancelled','rescheduled',
     'new_booking_alert','rebook_reminder','review_request'));

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
