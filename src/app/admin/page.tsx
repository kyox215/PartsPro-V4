import { AdminDashboard } from "@/components/partspro/admin-dashboard";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const authState = await getAdminAuthState();

  if (!authState.allowed) {
    redirect("/login?next=/admin");
  }

  return <AdminDashboard demoMode={!authState.configured} />;
}
