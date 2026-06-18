import { AdminDashboard } from "@/components/partspro/admin-dashboard";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
import { visiblePanelsForPermissions } from "@/lib/partspro-permissions";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const authState = await getAdminAuthState();

  if (!authState.allowed) {
    if (authState.reason === "permission_unavailable") {
      return <AdminPermissionSyncRequired />;
    }

    redirect("/login?next=/admin");
  }

  return (
    <AdminDashboard
      initialPermissions={authState.permissions}
      initialUserId={authState.userId}
      initialVisiblePanels={visiblePanelsForPermissions(authState.permissions)}
    />
  );
}

function AdminPermissionSyncRequired() {
  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <p className="text-sm font-bold uppercase tracking-normal text-amber-700">
          Configurazione admin incompleta
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-normal">
          Permessi database da sincronizzare
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6">
          Il tuo account è riconosciuto come amministratore dall&apos;app, ma Supabase
          non restituisce ancora i permessi necessari per leggere clienti e
          pannelli admin. Applica le migrazioni database PartsPro e ricarica il
          pannello.
        </p>
      </section>
    </main>
  );
}
