"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeCatalogReturn } from "@/lib/partspro-catalog-return.mjs";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";
export function CatalogBackLink({ assistedCompanyId }: { assistedCompanyId?: string | null }) {
  const params = useSearchParams(); const t = useT();
  const href = safeCatalogReturn(params.get("returnTo"), assistedCompanyId) ?? hrefWithAssistedCompanyId("/catalogo", assistedCompanyId);
  return <Button variant="ghost" size="sm" asChild className="mb-2 min-h-11 px-2"><Link href={href}><ArrowLeft className="size-4" />{tx(t, "storefront.product.backToCatalog", "Torna al catalogo")}</Link></Button>;
}
