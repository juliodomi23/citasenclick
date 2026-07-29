-- Migración: comisión por especialista.
-- Ejecutar con: psql $DATABASE_URL -f db/004-comisiones.sql

alter table staff
  add column if not exists commission_pct numeric(5, 2) not null default 0;

alter table staff
  add constraint staff_commission_sane check (commission_pct >= 0 and commission_pct <= 100);

-- Se calcula y congela al momento del cobro (como "description"): si luego
-- cambias el % de un especialista, el corte de un día viejo no se mueve.
alter table sales
  add column if not exists commission_cents int not null default 0;
