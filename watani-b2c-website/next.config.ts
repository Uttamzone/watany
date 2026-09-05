import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ships only needed node_modules files, not the full tree - see Dockerfile.
  output: "standalone",
  images: {
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
};

export default nextConfig;
