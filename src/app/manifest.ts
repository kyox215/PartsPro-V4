import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f8fafc",
    categories: ["business", "shopping", "productivity"],
    description: "PartsPro mobile parts ordering and support workspace.",
    display: "standalone",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    id: "/",
    lang: "it-IT",
    name: "PartsPro",
    orientation: "portrait",
    scope: "/",
    short_name: "PartsPro",
    start_url: "/",
    theme_color: "#0f172a",
  };
}
