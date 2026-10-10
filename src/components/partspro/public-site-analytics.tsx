"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { isPublicAnalyticsPath, sanitizePublicAnalyticsEvent } from "@/lib/partspro-analytics-tracking";

export function PublicSiteAnalytics() {
  const pathname = usePathname();

  if (!isPublicAnalyticsPath(pathname)) return null;

  return <Analytics beforeSend={sanitizePublicAnalyticsEvent} debug={false} />;
}
