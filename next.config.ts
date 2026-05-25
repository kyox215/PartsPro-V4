import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "apiv2.mobilax.fr",
        pathname: "/v1.0/assets/images/products/id-image/**",
        search: "?size=bg",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
