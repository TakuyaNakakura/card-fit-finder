const backendBaseUrl = process.env.BACKEND_BASE_URL ?? "http://localhost:4000";

/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
