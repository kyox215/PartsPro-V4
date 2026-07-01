import type { NextConfig } from "next";

const supabaseImageHostname = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yiuxrjqexlfjtxxrkqvi.supabase.co"
).hostname;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    qualities: [55, 72, 75, 88],
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname,
        pathname: "/storage/v1/object/public/product-images/**",
      },
      {
        protocol: "https",
        hostname: "apiv2.mobilax.fr",
        pathname: "/v1.0/assets/images/products/id-image/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
