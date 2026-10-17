import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StoreHeader } from "@/components/partspro/store-header";
import { PasswordRecoveryUpdate } from "@/components/partspro/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/partspro-auth-form-state";
import { cleanAuthRedirect } from "@/lib/partspro-auth-redirect";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getRequestI18n } from "@/i18n/request";
import { getDictionary,translate } from "@/i18n/get-dictionary";
import { tx } from "@/i18n/dictionaries/storefront";
export default async function UpdatePasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams; const next=cleanAuthRedirect(Array.isArray(params.next)?params.next[0]:params.next);
  const failure=`/login?${new URLSearchParams({mode:"forgot",next,error:"recovery_expired"})}`;
  if (!isSupabaseConfigured()) redirect(failure);
  const client=await createClient(); const {data:{user},error}=await client.auth.getUser();
  if (error || !user || (await cookies()).get(PASSWORD_RECOVERY_COOKIE)?.value !== user.id) redirect(failure);
  const {locale}=await getRequestI18n(); const dictionary=getDictionary(locale); const t=(key:string)=>translate(dictionary,key);
  return <main className="pp-auth-page pp-recovery-page min-h-screen bg-[#f4f6fa]"><StoreHeader /><div className="pp-recovery-layout mx-auto max-w-[440px] px-3 py-5"><Card className="pp-auth-card"><CardHeader><span className="pp-account-eyebrow">PARTSPRO ACCOUNT</span><CardTitle><h1>{tx(t,"storefront.ux.newPassword","Nuova password")}</h1></CardTitle></CardHeader><CardContent><PasswordRecoveryUpdate next={next} /></CardContent></Card></div></main>;
}
