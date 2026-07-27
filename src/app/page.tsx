export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-display text-4xl leading-tight text-ink">Cita en Click</h1>
      <span className="mx-auto mt-5 block h-px w-16 bg-accent-200" />
      <p className="mt-5 text-ink-muted">
        Cada negocio tiene su propio enlace. Si llegaste aquí por error, pídele su link al negocio.
      </p>
      <a
        className="mx-auto mt-8 flex min-h-12 w-full max-w-xs cursor-pointer items-center justify-center rounded-xl bg-accent-600 px-6 font-medium text-white shadow-soft transition-colors duration-200 hover:bg-accent-700"
        href="/barberia-demo"
      >
        Ver la demo
      </a>
    </main>
  );
}
