"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminMarketplacePanel } from "./admin-marketplace-panel";
import { useI18n } from "./i18n-provider";

type AdminCommercePanelProps = {
  permissions?: readonly string[];
};

export function AdminCommercePanel({ permissions = [] }: AdminCommercePanelProps) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950">{zh ? "电商" : "Canali di vendita"}</h2>
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-500">{zh ? "当前站点" : "Sito attuale"}: EBAY_IT / EUR</div>
      </div>

      <Tabs value="ebay" className="min-w-0 gap-4">
        <TabsList className="h-10 bg-white shadow-sm" aria-label={zh ? "电商功能" : "Funzioni dei canali di vendita"}>
          <TabsTrigger value="ebay" className="px-4">
            eBay
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ebay" className="mt-0 min-w-0">
          <AdminMarketplacePanel permissions={permissions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
