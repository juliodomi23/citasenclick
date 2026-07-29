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
const getClient = () => (client ??= postgres(process.env.DATABASE_URL!));

export const sql = ((...args: Parameters<postgres.Sql>) => getClient()(...args)) as postgres.Sql;

// begin() vive en el cliente real, no en este wrapper: se reexpone aparte
// para las mutaciones que necesitan que dos inserts caigan juntos o ninguno
// (p.ej. cobrar una cita: marcarla atendida + registrar la venta).
export const begin = ((...args: Parameters<postgres.Sql['begin']>) =>
  getClient().begin(...args)) as postgres.Sql['begin'];
