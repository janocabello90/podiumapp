/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Desactiva la caché de navegación del cliente para páginas dinámicas: al volver a una
    // página (p. ej. la sesión) siempre se re-piden los datos frescos, sin necesidad de F5.
    // Los datos se autoguardan desde el navegador y esto evita ver una versión cacheada vieja.
    staleTimes: {
      dynamic: 0,
    },
  },
}

export default nextConfig
