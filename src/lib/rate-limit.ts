import { sql } from './db';

/**
 * Topes de los endpoints públicos. Cada uno cuesta dinero: una reserva y una
 * entrada a la lista de espera terminan en un mensaje de WhatsApp que Meta
 * cobra, y una agenda llena de citas falsas deja al negocio sin horarios que
 * vender. Los números son generosos para una persona real y estrechos para un
 * script: nadie agenda 6 citas en una hora desde el mismo teléfono.
 */
export const LIMITS = {
  booking: { max: 5, minutes: 60 },
  waitlist: { max: 5, minutes: 60 },
  login: { max: 10, minutes: 15 },
} as const;

export type Bucket = keyof typeof LIMITS;

/**
 * Registra un uso y dice si ya se pasó del tope. Cuenta primero e inserta
 * después: si ya está en el límite no ensucia la tabla con el intento
 * rechazado, así el bloqueo dura la ventana y no se extiende sola cada vez
 * que alguien reintenta.
 */
export async function hitLimit(bucket: Bucket, key: string): Promise<boolean> {
  const { max, minutes } = LIMITS[bucket];

  const rows = (await sql`
    select count(*)::int as n from rate_limits
     where bucket = ${bucket} and key = ${key}
       and created_at > now() - make_interval(mins => ${minutes})
  `) as { n: number }[];

  if ((rows[0]?.n ?? 0) >= max) return true;

  await sql`insert into rate_limits (bucket, key) values (${bucket}, ${key})`;
  return false;
}

/** Olvida los usos viejos. Lo llama el cron: si no, la tabla crece para siempre. */
export async function purgeOldLimits() {
  await sql`delete from rate_limits where created_at < now() - interval '1 day'`;
}
