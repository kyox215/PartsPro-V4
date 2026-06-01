import type { MetadataRoute } from "next";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/catalogo", priority: 0.9 },
  { path: "/professionale", priority: 0.7 },
  { path: "/b2b", priority: 0.7 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPartsProSiteUrl();
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.path === "/catalogo" ? "daily" : "weekly",
    priority: route.priority,
  }));
}
