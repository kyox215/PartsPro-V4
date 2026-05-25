import type { NextConfig } from "next";

const supabaseImageHostname = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yiuxrjqexlfjtxxrkqvi.supabase.co"
).hostname;

const nextConfig: NextConfig = {
  images: {
    qualities: [55, 75, 88],
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname,
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
