/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images can come from any tenant's configured CDN; allow remote https hosts.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
