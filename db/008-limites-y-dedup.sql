-- Migración: límites de uso y deduplicación de la lista de espera.
-- Ejecutar con: psql $DATABASE_URL -f db/008-limites-y-dedup.sql
--
-- Por qué: /api/waitlist y /api/appointments son endpoints públicos sin
-- autenticación que escriben a la DB, y cada fila puede convertirse en un
-- mensaje de WhatsApp que se paga. Sin tope, el formulario es una manguera
-- de gasto — el mismo razonamiento que ya protegía el magic link (§9), que
-- a la lista de espera se le olvidó aplicar.

-- Una sola tabla para todos los límites en vez de una por caso. Cada fila es
-- "esta llave usó este recurso en este instante"; el tope se calcula contando
-- filas en una ventana, igual que ya lo hacía login_tokens.
create table rate_limits (
  id bigserial primary key,
  bucket text not null,     -- 'waitlist' | 'booking' | 'login'
  key text not null,        -- teléfono E.164 normalizado
  created_at timestamptz not null default now()
);
create index on rate_limits (bucket, key, created_at);

-- Una persona no puede tener dos entradas activas para el mismo servicio, el
-- mismo día y el mismo especialista. `nulls not distinct` (PG15+) es lo que
-- hace que "cualquier especialista" (staff_id NULL) también cuente como
-- duplicado — sin eso, NULL <> NULL y se podría insertar mil veces.
-- Parcial sobre notified_at is null: una vez avisada, puede volver a anotarse.
create unique index waitlist_sin_duplicados
  on waitlist_entries (business_id, service_id, date, customer_phone, staff_id)
  nulls not distinct
  where notified_at is null;
