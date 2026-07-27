-- Datos de prueba: una barbería de Tuxtla. Idempotente (borra y recrea el slug).
delete from businesses where slug = 'barberia-demo';

with b as (
  insert into businesses (slug, name, timezone, whatsapp_phone, slot_granularity_minutes)
  values ('barberia-demo', 'Barbería El Cañón', 'America/Mexico_City', '+529611234567', 15)
  returning id
), s as (
  insert into services (business_id, name, duration_minutes, buffer_after_minutes, price_cents)
  select b.id, x.name, x.dur, x.buf, x.price from b, (values
    ('Corte de cabello', 30, 5, 15000),
    ('Corte + barba',    45, 5, 22000),
    ('Afeitado clásico', 30, 5, 18000)
  ) as x(name, dur, buf, price)
  returning id, business_id, name
), st as (
  insert into staff (business_id, name)
  select b.id, x.name from b, (values ('Miguel'), ('Andrea')) as x(name)
  returning id, name
), ss as (
  insert into staff_services (staff_id, service_id)
  select st.id, s.id from st, s
  -- Andrea no hace afeitado clásico
  where not (st.name = 'Andrea' and s.name = 'Afeitado clásico')
  returning staff_id
)
-- Lun-Vie 9-14 y 16-20; Sábado 9-14. Domingo cerrado.
insert into schedule_rules (staff_id, weekday, start_time, end_time)
select st.id, w.weekday, w.start_time, w.end_time
from st, (values
  (1,'09:00'::time,'14:00'::time), (1,'16:00','20:00'),
  (2,'09:00','14:00'), (2,'16:00','20:00'),
  (3,'09:00','14:00'), (3,'16:00','20:00'),
  (4,'09:00','14:00'), (4,'16:00','20:00'),
  (5,'09:00','14:00'), (5,'16:00','20:00'),
  (6,'09:00','14:00')
) as w(weekday, start_time, end_time);
