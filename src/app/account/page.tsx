import { AccountPage } from "@/components/partspro/account-page";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Page() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    redirect("/login?next=/account&error=config");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  return <AccountPage userEmail={user.email ?? undefined} />;
}
