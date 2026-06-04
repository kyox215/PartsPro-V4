export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mx-auto grid max-w-[1500px] gap-3 lg:grid-cols-[72px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-2rem)] rounded-lg border border-slate-200 bg-white p-3 lg:block">
          <div className="size-9 animate-pulse rounded-lg bg-primary/15" />
          <div className="mt-8 grid gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="size-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
        <section className="min-w-0 space-y-3">
          <div className="h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:h-16">
            <div className="h-5 w-36 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
            </div>
            <div className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </section>
      </div>
    </main>
  );
}
