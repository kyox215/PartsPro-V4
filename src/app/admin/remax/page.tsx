import { redirect } from "next/navigation";
import { AdminRemaxCenter } from "@/components/partspro/admin-remax-center";
import { getAdminAuthState, hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  readAdminRemaxDashboard,
  type AdminRemaxDashboard,
} from "@/lib/partspro-remax-repository";

export default async function AdminRemaxPage() {
  const authState = await getAdminAuthState();

  if (!authState.allowed) {
    redirect("/login?next=/admin/remax");
  }

  if (!hasAdminPermission(authState, "product.read_admin")) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h1 className="text-xl font-black">Accesso REMAX non disponibile</h1>
          <p className="mt-2 text-sm font-semibold leading-6">
            Serve il permesso di lettura catalogo amministrativo. Chiedi a un amministratore di aggiornare il tuo ruolo.
          </p>
        </section>
      </main>
    );
  }

  let initialDashboard: AdminRemaxDashboard | null = null;
  let initialError: string | null = null;

  try {
    initialDashboard = await readAdminRemaxDashboard();
  } catch {
    initialError = "I dati REMAX non sono ancora disponibili. Verifica la migrazione database e riprova.";
  }

  return (
    <AdminRemaxCenter
      initialDashboard={initialDashboard}
      initialError={initialError}
    />
  );
}
