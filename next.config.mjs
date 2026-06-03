/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // mysql2 has dynamic requires that shouldn't be webpack-bundled.
  serverExternalPackages: ["mysql2"],
};

export default nextConfig;
