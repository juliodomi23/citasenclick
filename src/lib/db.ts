import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// ponytail: driver serverless con tagged templates, sin ORM. Las queries de
// disponibilidad se escriben a mano igual (ARQUITECTURA.md §1), así que Drizzle
// solo duplicaría el esquema. Meterlo cuando el panel tenga CRUD de verdad.
//
// La conexión se abre en la primera query, no al importar el módulo: así un
// test que solo usa funciones puras de un archivo que importa `sql` no exige
// DATABASE_URL.
let client: NeonQueryFunction<false, false> | null = null;

export const sql = ((...args: Parameters<NeonQueryFunction<false, false>>) => {
  client ??= neon(process.env.DATABASE_URL!);
  return client(...args);
}) as NeonQueryFunction<false, false>;
