import { AjustesNav } from './nav';

/**
 * Servicios, Equipo y Horarios vivían como pestañas de primer nivel en el
 * menú principal — 8 opciones ahí arriba era demasiado para escanear rápido.
 * Se agrupan aquí, dentro de Ajustes, como sub-secciones de "cómo está
 * configurado el negocio" (que es lo que en el fondo son las tres).
 */
export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AjustesNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
