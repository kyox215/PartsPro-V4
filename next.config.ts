import type { NextConfig } from "next";
import { productImageRemotePatterns } from "./src/lib/partspro-image-policy.mjs";

const supabaseImageUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yiuxrjqexlfjtxxrkqvi.supabase.co";

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
    formats: ["image/webp"],
    minimumCacheTTL: 300,
    qualities: [55, 72, 75, 88],
    remotePatterns: productImageRemotePatterns(supabaseImageUrl),
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
