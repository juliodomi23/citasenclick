-- Migración: personalización por negocio (logo + tema de color).
-- Ejecutar con: psql $DATABASE_URL -f db/003-personalizacion.sql

alter table businesses
  add column if not exists logo_url text,
  add column if not exists theme text not null default 'rosa';

-- El check no se puede meter en el add column de arriba en Postgres < 12 en
-- una sola sentencia con NOT VALID controlado; se agrega aparte y ya.
alter table businesses
  add constraint businesses_theme_valido
  check (theme in ('rosa', 'azul', 'verde', 'ambar', 'grafito'));
