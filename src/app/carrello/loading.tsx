import { StoreHeader } from "@/components/partspro/store-header";
import { anonymousStoreHeaderAccess } from "@/lib/partspro-header-access";

export default function Loading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={anonymousStoreHeaderAccess} />
      <div className="mx-auto grid max-w-[1360px] gap-2 px-2 pt-2 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-3 lg:pt-3 lg:pb-4">
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 hidden h-5 w-28 animate-pulse rounded-full bg-slate-200 lg:block" />
              <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-slate-200" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded-md bg-slate-200" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-[90px] animate-pulse rounded-lg border border-slate-200 bg-white"
              />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white lg:hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse border-b border-slate-100 bg-white last:border-b-0"
              />
            ))}
          </div>
        </section>
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-5 animate-pulse rounded bg-slate-100" />
            ))}
            <div className="h-10 animate-pulse rounded-md bg-slate-200" />
          </div>
        </aside>
      </div>
    </main>
  );
}
