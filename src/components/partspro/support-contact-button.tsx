"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "./i18n-provider";

export function SupportContactButton() {
  const t = useT();
  return (
    <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("partspro:open-support"))}>
      <MessageCircle aria-hidden="true" className="size-4" />
      {t("storefront.ux.contactSupport")}
    </Button>
  );
}
