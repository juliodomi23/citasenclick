-- Migración: agrega 'new_booking_alert' al check de notifications.kind.
-- Ejecutar con: psql $DATABASE_URL -f db/006-fix-notification-kind-check.sql
--
-- Bug real: insertAppointment() (src/app/api/appointments/route.ts) inserta
-- una notificación 'new_booking_alert' para avisar al negocio cuando el
-- negocio tiene whatsapp_phone. El check constraint original no incluía ese
-- kind, así que CUALQUIER reserva contra un negocio con whatsapp_phone
-- configurado tronaba con 500 (23514, check violation). Confirmado en local
-- contra barberia-demo.

alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in
    ('confirmation','reminder_24h','reminder_2h','cancelled','rescheduled','new_booking_alert'));
