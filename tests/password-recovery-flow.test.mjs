import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const state = { configured:true, user:{id:"synthetic-user"}, cookies:new Map(), updates:0, sends:0, exchanged:new Set(), failSend:false };
class Redirect extends Error { constructor(url) {super("redirect");this.url=url;} }
const auth = {
  getUser:async()=>({data:{user:state.user},error:null}),
  updateUser:async()=>{state.updates++;return {error:null};},
  resetPasswordForEmail:async()=>{state.sends++;return {error:state.failSend ? {message:"rate limit"} : null};},
  signOut:async()=>({error:null}),
  exchangeCodeForSession:async code=>{if(state.exchanged.has(code))return {error:{message:"used"}};state.exchanged.add(code);return {error:code==="valid-synthetic-code" ? null : {message:"expired"}};},
};
globalThis.__partsproAuthTest = {
  isSupabaseConfigured:()=>state.configured,
  createClient:async()=>({auth}),
  cookies:async()=>({get:key=>state.cookies.has(key)?{value:state.cookies.get(key)}:undefined,set:(key,value)=>{if(value)state.cookies.set(key,value);else state.cookies.delete(key);}}),
  headers:async()=>new Headers({host:"partspro.invalid"}),
  redirect:url=>{throw new Redirect(url);},
  requestOrigin:()=>"https://partspro.invalid",
  cleanAuthRedirect:next=>typeof next==="string" && next.startsWith("/") && !next.startsWith("//") ? next : "/account",
  PASSWORD_RECOVERY_COOKIE:"partspro-password-recovery",
  SIGNUP_RESEND_AT_COOKIE:"partspro-signup-resend-at",
  normalizeSignupVerificationEmail:value=>String(value || "").trim().toLowerCase(),
  NextResponse:{redirect:url=>new Response(null,{status:302,headers:{location:String(url)}})},
};
async function loadTs(relative) {
  const source=fs.readFileSync(new URL(relative,import.meta.url),"utf8");
  let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
  js=js.replace(/import\s+\{([\s\S]*?)\}\s+from\s+["'][^"']+["'];?/g,(_match,names)=>`const {${names}} = globalThis.__partsproAuthTest;`);
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const actions=await loadTs("../src/app/login/actions.ts");
const callback=await loadTs("../src/app/auth/recovery/route.ts");
const data=values=>{const form=new FormData();for(const [key,value] of Object.entries(values))form.set(key,value);return form;};
function reset(){state.configured=true;state.user={id:"synthetic-user"};state.cookies.clear();state.updates=0;state.sends=0;state.failSend=false;state.exchanged.clear();}
test("request reports generic success and rate errors without revealing account existence",async()=>{
  reset(); const result=await actions.requestPasswordRecovery({},data({email:"synthetic@example.invalid",next:"/rma?order=test"}));
  assert.equal(result.notice,"recovery_sent");assert.equal(state.sends,1);
  state.failSend=true; assert.equal((await actions.requestPasswordRecovery({},data({email:"synthetic@example.invalid"}))).error,"resend_rate");
});
test("expired, reused and missing recovery codes return to recovery request",async()=>{
  reset();
  for(const code of ["", "expired"]){const response=await callback.GET(new Request(`https://partspro.invalid/auth/recovery?code=${code}`));assert.match(response.headers.get("location"),/recovery_expired/);assert.equal(state.cookies.size,0);}
  const accepted=await callback.GET(new Request("https://partspro.invalid/auth/recovery?code=valid-synthetic-code&next=%2Frma%3Forder%3Dtest"));
  assert.match(accepted.headers.get("location"),/login\/update-password/);assert.equal(state.cookies.get("partspro-password-recovery"),"synthetic-user");
  const reused=await callback.GET(new Request("https://partspro.invalid/auth/recovery?code=valid-synthetic-code"));assert.match(reused.headers.get("location"),/recovery_expired/);
});
test("password update validates matching user, strength and confirmation, then consumes marker",async()=>{
  reset(); const valid=data({password:"synthetic-pass-123",confirmation:"synthetic-pass-123",next:"/checkout"});
  assert.equal((await actions.updateRecoveredPassword({},valid)).error,"recovery_expired");assert.equal(state.updates,0);
  state.cookies.set("partspro-password-recovery","another-synthetic-user");assert.equal((await actions.updateRecoveredPassword({},valid)).error,"recovery_expired");
  state.cookies.set("partspro-password-recovery","synthetic-user");
  assert.equal((await actions.updateRecoveredPassword({},data({password:"short",confirmation:"short"}))).error,"weak");
  assert.equal((await actions.updateRecoveredPassword({},data({password:"synthetic-pass-123",confirmation:"different-pass"}))).error,"password_mismatch");assert.equal(state.updates,0);
  await assert.rejects(actions.updateRecoveredPassword({},valid),error=>error instanceof Redirect && error.url.includes("password_updated"));
  assert.equal(state.updates,1);assert.equal(state.cookies.has("partspro-password-recovery"),false);
  assert.equal((await actions.updateRecoveredPassword({},valid)).error,"recovery_expired");assert.equal(state.updates,1);
});
