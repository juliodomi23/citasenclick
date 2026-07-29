import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

// Autoalojadas por next/font: sin llamadas a Google desde el navegador del
// cliente y sin salto de fuente al cargar. Importa en un VPS propio.
//
// Playfair Display (serif decorativo) se cambió por Plus Jakarta Sans: un
// serif de invitación de boda lee como papelería, no como una herramienta
// que se usa 50 veces al día en el mostrador. Jakarta Sans es la tipografía
// que domina en dashboards SaaS profesionales (Linear, Notion, Vercel).
const display = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cita en Click",
  description: "Agenda tu cita en un minuto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${display.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Corre antes del primer paint: sin esto, la página siempre nace
          clara y "salta" a oscura una vez que React monta el toggle.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(dark){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
