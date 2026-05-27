import { StoreHeader } from "@/components/partspro/store-header";
import { anonymousStoreHeaderAccess } from "@/lib/partspro-header-access";

export default function Loading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={anonymousStoreHeaderAccess} />
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-3 h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:p-4">
            <div className="min-h-[260px] animate-pulse rounded-lg bg-slate-100 sm:min-h-[360px] lg:min-h-[460px]" />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {["lot", "qc", "packing"].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg border border-slate-100 bg-slate-50"
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-6 w-14 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 h-10 w-11/12 animate-pulse rounded-lg bg-slate-100 sm:h-14" />
              <div className="mt-3 h-5 w-48 animate-pulse rounded bg-slate-100" />
              <div className="mt-5 flex flex-wrap gap-2">
                {["m1", "m2", "m3", "m4"].map((item) => (
                  <div key={item} className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
                ))}
              </div>
              <div className="my-5 h-px bg-slate-100" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {["stock", "moq", "lead"].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {["shipping", "rma", "availability", "invoice"].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white"
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
