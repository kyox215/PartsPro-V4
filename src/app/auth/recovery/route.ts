import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cleanAuthRedirect, requestOrigin } from "@/lib/partspro-auth-redirect";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/partspro-auth-form-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request.headers,url.origin);
  const next = cleanAuthRedirect(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const failure = new URL(`/login?${new URLSearchParams({mode:"forgot",next,error:"recovery_expired"})}`,origin);
  if (!isSupabaseConfigured() || !code) return NextResponse.redirect(failure);
  try {
    const client = await createClient();
    const {error} = await client.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
    const {data:{user},error:authError} = await client.auth.getUser();
    if (authError || !user) return NextResponse.redirect(failure);
    (await cookies()).set(PASSWORD_RECOVERY_COOKIE,user.id,{httpOnly:true,path:"/",maxAge:600,sameSite:"lax",secure:process.env.NODE_ENV === "production"});
    return NextResponse.redirect(new URL(`/login/update-password?${new URLSearchParams({next})}`,origin));
  } catch { return NextResponse.redirect(failure); }
}
