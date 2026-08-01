-- Migración: registro de qué migraciones se aplicaron.
-- Ejecutar con: psql $DATABASE_URL -f db/009-registro-de-migraciones.sql
--
-- Por qué: las migraciones son archivos numerados que se corren a mano contra
-- producción y nada anotaba cuál ya se había aplicado. El 2026-07-31
-- producción llevaba dos de atraso (006 y 007) y se descubrió por casualidad,
-- con el bug de `new_booking_alert` rompiendo toda reserva mientras tanto.
--
-- El arreglo no es una herramienta de migraciones: es una tabla y la
-- convención de que **cada archivo se registra a sí mismo al final**. Con eso:
--   - `select * from schema_migrations` contesta "qué falta" en un segundo;
--   - correr dos veces la misma migración falla en el PRIMARY KEY en vez de
--     pasar callada o dejar la base a medias.
-- ponytail: drizzle-kit resuelve esto y más, pero traería un paso de build y
-- un formato propio para un flujo que hoy es "pegar SQL en psql". Cuando haya
-- un segundo entorno de verdad, ahí sí.

create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

-- Baseline: estas ya estaban aplicadas en cualquier base que exista hoy (local
-- y producción), así que se registran sin ejecutarlas. `on conflict do nothing`
-- para que esta migración sea segura de correr en una base que ya tenga el
-- registro (p.ej. una creada desde schema.sql, que ya viene con estas filas).
insert into schema_migrations (filename) values
  ('001-add-password-column.sql'),
  ('002-caja-inventario.sql'),
  ('003-personalizacion.sql'),
  ('004-comisiones.sql'),
  ('005-arqueo-caja.sql'),
  ('006-fix-notification-kind-check.sql'),
  ('007-waitlist-rebook-review.sql'),
  ('008-limites-y-dedup.sql')
on conflict (filename) do nothing;

insert into schema_migrations (filename) values ('009-registro-de-migraciones.sql');
