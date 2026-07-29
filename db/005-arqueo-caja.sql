-- Migración: arqueo de caja (fondo inicial, retiros, depósitos, conteo final).
-- Ejecutar con: psql $DATABASE_URL -f db/005-arqueo-caja.sql

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
