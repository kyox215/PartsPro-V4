import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { safeCatalogReturn, catalogBrowseKey } from "../src/lib/partspro-catalog-return.mjs";
const source = fs.readFileSync(new URL("../src/lib/partspro-auth-redirect.ts",import.meta.url),"utf8");
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {cleanAuthRedirect,postLoginRedirect} = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("catalog return preserves search but rejects external paths and delegated customer changes",()=>{
  assert.equal(safeCatalogReturn("/catalogo?category=Schermi&q=iPhone+15"),"/catalogo?category=Schermi&q=iPhone+15");
  assert.equal(safeCatalogReturn("/catalogo?companyId=customer-a", "customer-a"),"/catalogo?companyId=customer-a");
  for (const value of ["https://evil.test/catalogo","//evil.test/catalogo","/\\evil.test/catalogo","/account","/catalogo?companyId=customer-b","/catalogo\n"]) assert.equal(safeCatalogReturn(value),null);
  assert.equal(safeCatalogReturn("/catalogo?companyId=customer-b","customer-a"),null);
  assert.notEqual(catalogBrowseKey("/catalogo","a",null),catalogBrowseKey("/catalogo","b",null));
});
test("auth redirect rejects external and malformed destinations and retains internal deep links",()=>{
  assert.equal(cleanAuthRedirect("/rma?order=order-a&line=line-b&requestId=request-c"),"/rma?order=order-a&line=line-b&requestId=request-c");
  for(const value of ["https://evil.test","//evil.test","/\\evil.test","/account\n", "javascript:alert(1)"]) assert.equal(cleanAuthRedirect(value),"/account");
  for(const value of ["/login?next=/checkout","/admin?section=orders","/auth/recovery?code=x"]) assert.equal(postLoginRedirect(value,{profileComplete:true}),"/account");
});
test("profile completion retains one safe return destination without nested setup loops",()=>{
  const path=postLoginRedirect("/checkout?companyId=customer-a",{profileComplete:false});
  assert.equal(new URL(path,"https://partspro.test").searchParams.get("returnTo"),"/checkout?companyId=customer-a");
  const wrapped=postLoginRedirect("/account?setup=1&returnTo=%2Frma%3Forder%3Da",{profileComplete:false});
  assert.equal(new URL(wrapped,"https://partspro.test").searchParams.get("returnTo"),"/rma?order=a");
  assert.equal(postLoginRedirect("/account?setup=1&returnTo=%2Faccount%3Fsetup%3D1",{profileComplete:false}),"/account?setup=1");
  assert.equal(postLoginRedirect("/checkout",{adminAllowed:true,profileComplete:false}),"/admin");
});
