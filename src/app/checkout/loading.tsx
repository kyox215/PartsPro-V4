import { StoreHeader } from "@/components/partspro/store-header";
import { anonymousStoreHeaderAccess } from "@/lib/partspro-header-access";

export default function Loading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={anonymousStoreHeaderAccess} />
      <div className="mx-auto grid max-w-[1300px] gap-3 px-2 pt-3 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-8">
        <section className="space-y-3 sm:space-y-4">
          <div className="space-y-3">
            <div className="h-8 w-36 animate-pulse rounded-md bg-slate-200" />
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
                <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200" />
              </div>
              <div className="h-11 w-[520px] max-w-full animate-pulse rounded-lg bg-slate-200" />
              <div className="h-5 w-[680px] max-w-full animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          {["items", "customer", "delivery", "payment", "confirm"].map((item, index) => (
            <div
              key={item}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
            >
              <div className="h-6 w-44 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: index === 0 ? 2 : 4 }, (_, fieldIndex) => (
                  <div
                    key={fieldIndex}
                    className="h-12 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="hidden space-y-3 lg:block">
          <div className="sticky top-28 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-5 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="h-11 animate-pulse rounded-md bg-slate-200" />
            <div className="h-14 animate-pulse rounded-lg bg-amber-50" />
          </div>
        </aside>
      </div>
    </main>
  );
}
