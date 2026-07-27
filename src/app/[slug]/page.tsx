import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { getBusiness } from '@/lib/availability';
import { Booking, type Service, type Staff } from './booking';

export default async function Page(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params;
  const business = await getBusiness(slug);
  if (!business) notFound();

  const services = (await sql`
    select id, name, duration_minutes, price_cents from services
     where business_id = ${business.id} and active
     order by name
  `) as Service[];

  const staff = (await sql`
    select st.id, st.name, array_agg(ss.service_id::text) as service_ids
      from staff st
      join staff_services ss on ss.staff_id = st.id
     where st.business_id = ${business.id} and st.active
     group by st.id, st.name
     order by st.name
  `) as Staff[];

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
      <header className="text-center">
        <h1 className="font-display text-3xl leading-tight text-ink">{business.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">Agenda tu cita en menos de un minuto</p>
      </header>
      <Booking
        slug={business.slug}
        timezone={business.timezone}
        bookingWindowDays={business.booking_window_days}
        whatsappPhone={business.whatsapp_phone}
        services={services}
        staff={staff}
      />
    </main>
  );
}
