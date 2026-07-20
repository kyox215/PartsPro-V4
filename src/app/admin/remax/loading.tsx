export default function AdminRemaxLoading() {
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-3" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-xl bg-white" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl bg-white" />
          <div className="h-80 animate-pulse rounded-xl bg-white" />
        </div>
      </div>
    </main>
  );
}
