/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@whalabi/matrix', '@whalabi/shared'],
  // Proxy same-origin: /api/* → contenedor de la API. Evita exponer el puerto de
  // la API al navegador y elimina CORS. API_INTERNAL_URL apunta al servicio api.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
