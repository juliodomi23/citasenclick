-- Migración: inventario y corte de caja.
-- Ejecutar con: psql $DATABASE_URL -f db/002-caja-inventario.sql
--
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
  created_at timestamptz not null default now(),
  constraint sales_qty_positive check (qty > 0)
);
create index on sales (business_id, created_at);
