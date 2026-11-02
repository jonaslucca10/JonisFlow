/** @type {import('next').NextConfig} */
// API em outro host (dev) — em produção, domínio próprio + rewrite/reverse proxy.
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
