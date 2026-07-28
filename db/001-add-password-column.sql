-- Migración: agregar soporte para contraseñas en lugar de magic links
-- Ejecutar con: psql $DATABASE_URL -f db/001-add-password-column.sql

-- Agregar columna password a users si no existe
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password text;

-- Los usuarios existentes sin contraseña quedarán en NULL
-- Cuando hagan login por primera vez, se ejecuta setupPasswordAndLogin()
