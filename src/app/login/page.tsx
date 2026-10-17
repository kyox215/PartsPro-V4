import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, ShieldCheck, RotateCcw } from "lucide-react";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StoreHeader } from "@/components/partspro/store-header";
import { AsyncFeedback } from "@/components/partspro/async-feedback";
import { PasswordAuthPanel, SignupVerificationPanel, PasswordRecoveryRequest } from "@/components/partspro/auth-forms";
import { tx } from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import { cleanAuthRedirect, postLoginRedirect } from "@/lib/partspro-auth-redirect";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { isSupabaseConfigured, isWeChatLoginEnabled } from "@/lib/supabase/env";
import { SIGNUP_RESEND_AT_COOKIE } from "@/lib/partspro-auth-form-state";
import { SIGNUP_VERIFICATION_EMAIL_COOKIE, normalizeSignupVerificationEmail } from "@/lib/partspro-signup-verification";
export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams; const read=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
  const {locale}=await getRequestI18n(); const dictionary=getDictionary(locale); const t=(key:string)=>translate(dictionary,key);
  const configured=isSupabaseConfigured(); const next=cleanAuthRedirect(read(params.next),"/account"); const mode=read(params.mode); const error=read(params.error); const notice=read(params.notice);
  if (configured && !error && mode !== "forgot") {
    const [account,admin]=await Promise.all([getCurrentAccountContext({ensure:true}),getAdminAuthState()]);
    if (account.authenticated && !account.accountSyncError) redirect(postLoginRedirect(next,{adminAllowed:admin.allowed,profileComplete:account.accountType !== "customer" || Boolean(account.customer?.profileCompletedAt)}));
  }
  const retryAt = Number((await cookies()).get(SIGNUP_RESEND_AT_COOKIE)?.value || 0);
  const pendingEmail=normalizeSignupVerificationEmail((await cookies()).get(SIGNUP_VERIFICATION_EMAIL_COOKIE)?.value);
  const title=mode === "forgot" ? tx(t,"storefront.ux.recoverPassword","Recupera password") : mode === "verify" ? tx(t,"storefront.login.verify.title","Verifica email") : tx(t,"storefront.login.title","Login PartsPro");
  return <main className="pp-auth-page min-h-screen bg-[#f4f6fa] text-slate-950"><StoreHeader /><div className="pp-auth-layout mx-auto px-3 py-4 sm:py-8"><section className="pp-auth-introduction"><span className="pp-account-eyebrow">PARTSPRO · ITALIA</span><h1>{tx(t,"storefront.professional.after.account.title","Accesso account")}</h1><p>{tx(t,"storefront.professional.after.account.body","Userai login, carrello, checkout e assistenza con lo stesso profilo cliente.")}</p><div className="pp-auth-feature"><Package aria-hidden="true"/><span>{tx(t,"nav.catalog","Catalogo")}</span></div><div className="pp-auth-feature"><ShieldCheck aria-hidden="true"/><span>{tx(t,"nav.account","Account")}</span></div><div className="pp-auth-feature"><RotateCcw aria-hidden="true"/><span>{tx(t,"storefront.rma.rules.title","Regole assistenza")}</span></div><Link className="pp-auth-help-link" href="/help">{tx(t,"storefront.ux.help","Aiuto")} →</Link></section><Card className="pp-auth-card border-slate-200 bg-white"><CardHeader><span className="pp-account-eyebrow">{tx(t,"storefront.login.badge","Accesso clienti")}</span><CardTitle className="text-2xl font-bold">{title}</CardTitle></CardHeader><CardContent className="space-y-4">
    {!configured && <AsyncFeedback state="error" title={tx(t,"storefront.login.error.config","Accesso temporaneamente non disponibile. Riprova più tardi o contatta l’assistenza.")} />}
    {error && <AsyncFeedback state="error" title={tx(t,`storefront.login.error.${error}`,tx(t,"storefront.login.error.generic","Accesso non riuscito. Riprova."))} />}
    {notice && <AsyncFeedback state="success" title={tx(t,`storefront.login.notice.${notice}`,tx(t,"storefront.ux.completed","Operazione completata."))} />}
    {mode === "verify" ? <SignupVerificationPanel configured={configured} next={next} pendingEmail={pendingEmail} initialRetryAt={Number.isFinite(retryAt) ? retryAt : 0} /> : mode === "forgot" ? <PasswordRecoveryRequest configured={configured} next={next} /> : <PasswordAuthPanel configured={configured} next={next} googleLoginUrl={`/auth/google?${new URLSearchParams({next,prompt:"select_account"})}`} weChatLoginUrl={isWeChatLoginEnabled() ? `/auth/wechat?${new URLSearchParams({next})}` : null} initialMode={mode === "signup" ? "signup" : "signin"} />}
  </CardContent></Card></div></main>;
}
