import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleLoginButton, LoginSubmitButton, WeChatLoginButton } from "@/components/partspro/login-client";
import { StoreHeader } from "@/components/partspro/store-header";
import { cleanAuthRedirect, postLoginRedirect } from "@/lib/partspro-auth-redirect";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { isSupabaseConfigured, isWeChatLoginEnabled } from "@/lib/supabase/env";
import { signInWithPassword, signUpWithPassword } from "./actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  config: "Manca la publishable key Supabase in .env.local.",
  account: "Accesso riuscito, ma la sincronizzazione dell'account PartsPro non e riuscita. Riprova o contatta l'assistenza.",
  exists: "Questo indirizzo email risulta gia registrato. Prova ad accedere.",
  invalid: "Email o password non validi.",
  missing: "Inserisci email e password.",
  oauth: "Accesso OAuth non riuscito. Verifica la configurazione dei provider in Supabase.",
  signup: "Registrazione non riuscita. Verifica email e password.",
  weak: "La password deve contenere almeno 8 caratteri.",
};

const noticeMessages: Record<string, string> = {
  confirm: "Account creato. Controlla la tua email per confermare l'accesso.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const next = cleanAuthRedirect(getParam(params.next), "/account");
  const error = getParam(params.error);
  const notice = getParam(params.notice);
  const weChatLoginEnabled = isWeChatLoginEnabled();
  const googleLoginUrl = `/auth/google?${new URLSearchParams({ next }).toString()}`;
  const weChatLoginUrl = weChatLoginEnabled
    ? `/auth/wechat?${new URLSearchParams({ next }).toString()}`
    : null;
  let accountSyncFailed = false;

  if (configured && !error) {
    const [account, adminAuth] = await Promise.all([
      getCurrentAccountContext({ ensure: true }),
      getAdminAuthState(),
    ]);

    if (account.authenticated && !account.accountSyncError) {
      redirect(postLoginRedirect(next, {
        adminAllowed: adminAuth.allowed,
      }));
    }

    accountSyncFailed = Boolean(account.authenticated && account.accountSyncError);
  }
  const effectiveError = error ?? (accountSyncFailed ? "account" : undefined);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid min-h-[calc(100vh-112px)] max-w-[1180px] place-items-center px-4 py-8">
        <Card className="w-full max-w-[440px] border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <Badge className="mb-2 w-fit border border-primary/20 bg-primary/8 text-primary">
              Accesso clienti
            </Badge>
            <CardTitle className="text-2xl font-black">Login PartsPro</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginRuntimeNotice configured={configured} />
            {effectiveError && (
              <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMessages[effectiveError] ?? "Accesso non riuscito."}</span>
              </div>
            )}
            {notice && (
              <div className="mb-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{noticeMessages[notice] ?? "Operazione completata."}</span>
              </div>
            )}
            <div className="mb-4 space-y-2">
              <GoogleLoginButton href={googleLoginUrl} disabled={!configured} />
              {weChatLoginUrl && (
                <WeChatLoginButton href={weChatLoginUrl} disabled={!configured} />
              )}
            </div>
            <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-normal text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>oppure</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <form action={signInWithPassword} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="buyer@azienda.it"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <LoginSubmitButton disabled={!configured} />
              {!configured && (
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  Il pulsante resta disattivato per evitare un login fittizio:
                  completa la publishable key e ricarica la pagina.
                </p>
              )}
            </form>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="mb-3">
                <div className="text-sm font-black text-slate-950">Nuovo cliente</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Crea un account cliente base. Dopo la conferma, il profilo appare in gestione clienti.
                </p>
              </div>
              <form action={signUpWithPassword} className="space-y-3">
                <input type="hidden" name="next" value={next} />
                <div className="space-y-2">
                  <Label htmlFor="display-name">Nome</Label>
                  <Input
                    id="display-name"
                    name="displayName"
                    autoComplete="name"
                    placeholder="Nome cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="signupEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="buyer@azienda.it"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="signupPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <LoginSubmitButton
                  disabled={!configured}
                  label="Crea account"
                  pendingLabel="Creazione account..."
                />
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function LoginRuntimeNotice({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <div className="mb-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">Login Supabase attivo</div>
          <p className="mt-1 leading-6">
            Le credenziali vengono verificate con Supabase Auth. Dopo il login
            i clienti aprono l&apos;area account, lo staff apre il pannello admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <Database className="mt-0.5 size-5 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <div className="font-black">Configurazione Supabase mancante</div>
        <p className="mt-1 leading-6">
          Supabase e collegato al progetto, ma manca ancora
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
        </p>
      </div>
    </div>
  );
}
