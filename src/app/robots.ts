import type { MetadataRoute } from "next";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPartsProSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalogo", "/professionale", "/b2b", "/prodotto/"],
        disallow: [
          "/account",
          "/admin",
          "/api",
          "/auth",
          "/carrello",
          "/checkout",
          "/login",
          "/rma",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
