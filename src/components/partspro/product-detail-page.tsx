import Link from "next/link";
import {
  ArrowLeft,
  BadgeEuro,
  Barcode,
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Truck,
  type LucideIcon,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PartProduct } from "@/lib/partspro-data";
import { PartVisual } from "./part-visual";
import { ProductDetailPurchasePanel } from "./product-card";
import { StoreHeader } from "./store-header";

type ProductDetailPageProps = {
  product: PartProduct;
};

export function ProductDetailPage({ product }: ProductDetailPageProps) {
  const canShowBuyerPrice = product.price > 0;

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-6">
        <Button variant="ghost" asChild className="mb-3">
          <Link href="/catalogo">
            <ArrowLeft className="size-4" />
            Torna al catalogo
          </Link>
        </Button>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-32 lg:self-start">
            <CardContent className="p-3 sm:p-4">
              <PartVisual
                variant={product.visual}
                className="min-h-[260px] rounded-lg sm:min-h-[360px] lg:min-h-[460px]"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Lotto", value: "Tracciato" },
                  { label: "QC", value: "Test pre-spedizione" },
                  { label: "Packing", value: "Antistatico" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="text-[11px] font-bold uppercase text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 truncate text-xs font-black text-slate-700">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                    {product.status}
                  </Badge>
                  <Badge className="border border-primary/20 bg-primary/8 text-primary">
                    {product.warehouse}
                  </Badge>
                  <Badge variant="outline">{product.grade}</Badge>
                </div>
                <h1 className="mt-4 break-words text-2xl font-black tracking-normal sm:text-3xl md:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-2 flex min-w-0 items-center gap-2 font-mono text-sm text-slate-500">
                  <Barcode className="size-4 shrink-0" />
                  <span className="truncate">{product.sku}</span>
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {product.compatibleWith.map((model) => (
                    <span
                      key={model}
                      className="max-w-full truncate rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700"
                      title={model}
                    >
                      {model}
                    </span>
                  ))}
                </div>

                <Separator className="my-5" />

                <div className="rounded-lg border border-primary/20 bg-primary/8 p-4 text-sm text-slate-700">
                  <div className="flex items-center gap-2 font-black text-slate-950">
                    <BadgeEuro className="size-4 text-primary" />
                    Prezzi riservati ai buyer verificati
                  </div>
                  <p className="mt-2 leading-6">
                    Accedi con Partita IVA approvata per vedere listino wholesale,
                    quantità minime, sconti volume e condizioni di pagamento.
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: PackageCheck,
                      label: "Stock",
                      value: `${product.stock} pezzi`,
                      text: product.status,
                    },
                    {
                      icon: Boxes,
                      label: "MOQ",
                      value: `${product.moq} pz`,
                      text: "Ordine minimo",
                    },
                    {
                      icon: Clock,
                      label: "Lead time",
                      value: product.leadTime,
                      text: "Stima logistica",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                        <item.icon className="size-3.5" />
                        {item.label}
                      </div>
                      <div className="mt-1 truncate text-sm font-black text-slate-800">
                        {item.value}
                      </div>
                      <div className="truncate text-xs text-slate-500">{item.text}</div>
                    </div>
                  ))}
                </div>

                {canShowBuyerPrice ? (
                  <ProductDetailPurchasePanel product={product} />
                ) : (
                  <Card className="mt-3 border-primary/20 bg-white">
                    <CardContent className="flex flex-col gap-3 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black text-slate-950">Prezzo protetto</div>
                        <p className="mt-1 leading-6">
                          Accedi con un cliente B2B approvato per sbloccare
                          prezzo netto, preventivo e invio al carrello.
                        </p>
                      </div>
                      <Button asChild className="shrink-0">
                        <Link href="/login?next=/catalogo">Accedi</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Truck, label: product.leadTime, text: "Consegna tracciata in Italia" },
                { icon: ShieldCheck, label: `${product.rmaDays} giorni RMA`, text: "Reso gestito da account" },
                { icon: PackageCheck, label: `${product.stock} pezzi`, text: product.status },
                { icon: FileText, label: "Fattura B2B", text: "PEC / Codice Destinatario" },
              ].map((item) => (
                <Card key={item.label} className="rounded-lg border-slate-200 bg-white">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-black">{item.label}</div>
                      <div className="truncate text-xs text-slate-500">{item.text}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Dettagli tecnici</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              <Spec label="Brand" value={product.brand} />
              <Spec label="Categoria" value={product.category} />
              <Spec label="Qualità" value={product.grade} />
              <Spec label="Aliquota IVA" value={`${product.vatRate}%`} />
              <Spec label="Magazzino" value={product.warehouse} />
              <Spec label="Ultimo aggiornamento" value={product.updatedAt} />
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Condizioni B2B</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow
                icon={Landmark}
                label="Partita IVA"
                value="Prezzo riservato ad aziende verificate"
              />
              <InfoRow
                icon={FileText}
                label="Fattura elettronica"
                value="PEC o Codice Destinatario in checkout"
              />
              <InfoRow
                icon={Warehouse}
                label="Allocazione stock"
                value={`${product.warehouse} · priorità ordini pagati`}
              />
              <InfoRow
                icon={ShieldCheck}
                label="Garanzia RMA"
                value={`${product.rmaDays} giorni con lotto tracciato`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="rounded-lg border-slate-200 bg-white lg:col-span-2">
            <CardHeader>
              <CardTitle>Logistica e documenti</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <Spec label="DDT" value="Incluso in spedizione" />
              <Spec label="Imballo" value="Antistatico + blister" />
              <Spec label="Supporto" value="RMA da account" />
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Checklist qualità</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Test funzionale", "Controllo estetico", "Imballo antistatico", "Seriale lotto tracciato"].map(
                (item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {item}
                  </div>
                )
              )}
              <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
                <Clock className="size-4" />
                Aggiornato in tempo reale dal magazzino
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-800">{value}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-800">{label}</div>
        <div className="mt-0.5 text-xs leading-5 text-slate-500">{value}</div>
      </div>
    </div>
  );
}
