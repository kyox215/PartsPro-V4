import { StoreHeader } from "@/components/partspro/store-header";
import { anonymousStoreHeaderAccess } from "@/lib/partspro-header-access";

export default function Loading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={anonymousStoreHeaderAccess} />
      <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            {["apple", "samsung", "xiaomi", "huawei", "oppo", "honor"].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        </aside>
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:p-6">
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-4 h-10 max-w-3xl animate-pulse rounded-lg bg-slate-100" />
            <div className="mt-3 h-5 max-w-2xl animate-pulse rounded bg-slate-100" />
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {["count", "shipping", "rma"].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
