import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ships only needed node_modules files, not the full tree - see Dockerfile.
  output: "standalone",
  // Disable X-Powered-By header to avoid framework fingerprinting
  poweredByHeader: false,
  // Enable HTTP compression for smaller transfer sizes and faster page loads
  compress: true,
  experimental: {
    // Optimize bundle size by tree-shaking heavy icon and animation packages
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 blocks optimizing images from local IPs by default; backend runs on localhost:8080 in dev.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "cdn.21st.dev",
      },
      {
        protocol: "https",
        hostname: "me7aitdbxq.ufs.sh",
      },
      // Product images uploaded via the admin, served by watani-b2c-service
      // from a mounted directory at /uploads/** (see StorageWebConfig).
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/uploads/**",
      },
      // Hetzner deployment - see STORAGE_BASE_URL in
      // deploy/k8s/01-backend-config.yaml.
      {
        protocol: "https",
        hostname: "wataniandsons.ca",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "www.wataniandsons.ca",
        pathname: "/uploads/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
