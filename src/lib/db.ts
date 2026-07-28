import postgres from 'postgres';

// Postgres propio en el VPS (mismo docker-compose, servicio "postgres"), no
// Neon: se cambió de @neondatabase/serverless a este driver porque aquel habla
// el protocolo HTTP propio de Neon, no Postgres normal por TCP — no sirve
// contra un Postgres cualquiera. `postgres` (porsager) usa tagged templates
// con la misma forma, así que el resto del código no cambió una sola línea.
//
// La conexión es perezosa (se abre en la primera query), no al importar el
// módulo: así un test que solo usa funciones puras de un archivo que importa
// `sql` no exige DATABASE_URL.
let client: postgres.Sql | null = null;

export const sql = ((...args: Parameters<postgres.Sql>) => {
  client ??= postgres(process.env.DATABASE_URL!);
  return client(...args);
}) as postgres.Sql;
