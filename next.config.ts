import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta solo lo que "node server.js" necesita en /.next/standalone —
  // sin esto la imagen de Docker carga node_modules completo (cientos de MB
  // que nunca se usan en producción).
  output: "standalone",
};

export default nextConfig;
