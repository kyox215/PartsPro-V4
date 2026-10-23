// Local-only real CheckoutClient with synthetic customer/catalog/API data.
// No production credentials, requests, orders or wallet debits.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const dir = path.join(root, "outputs/checkout-wallet/2026-10-23/fixture");
mkdirSync(dir, { recursive: true });
const builder = readFileSync("tests/fixtures/account-pricing-ui/build.cjs.fixture", "utf8").replaceAll("__HARNESS_DIR__", JSON.stringify(dir))
  .replace("errors:true", "errors:true,moduleTrace:true,errorDetails:true")
  .replace("const alias={", "const alias={'@/app/actions/i18n':dir+'/locale.ts',");
writeFileSync(path.join(dir, "locale.ts"), "export async function setLocale(){return {ok:true}};");
writeFileSync(path.join(dir, "build.cjs"), builder);
const existingEntry = readFileSync("tests/fixtures/account-pricing-ui/entry.tsx.fixture", "utf8");
const data = existingEntry.slice(existingEntry.indexOf("const id="), existingEntry.indexOf("function BoundaryProbe"))
  .replaceAll("REMAX-6954851225270", "WALLET-FIXTURE-001")
  .replaceAll("REMAX CB25 Arancione", "Wallet checkout test battery")
  .replaceAll("brand:'REMAX'", "brand:'Apple'")
  .replaceAll("price:1.4", "price:11.5").replaceAll("Price:1.4", "Price:11.5")
  .replace("setCartStorageOwner('user-a');", "setCartStorageOwner('wallet-fixture');");
writeFileSync(path.join(dir, "entry.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CheckoutClient} from '@/components/partspro/checkout-client';
import {I18nProvider} from '@/components/partspro/i18n-provider';
import {replaceStoredCartItems,setCartStorageOwner} from '@/components/partspro/cart-state';
import {storefrontDictionaries} from '@/i18n/dictionaries/storefront';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'full',locale=params.get('locale')==='en'?'en-US':params.get('locale')==='it'?'it-IT':params.get('locale')||'en-US';
const run=crypto.randomUUID(),originalFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{
  const url=typeof input==='string'?input:input.url;
  if(!url.startsWith('/'))throw new Error('Fixture blocks external request');
  return originalFetch(input,{...options,headers:{...options.headers,'x-fixture-run':run,'x-fixture-scenario':scenario}});
};
${data}
if(scenario==='preorder')Object.assign(product,{sku:'REMAX-FIXTURE-001',brand:'REMAX',purchaseKind:'preorder',preorderAvailableQuantity:100});
replaceStoredCartItems([{sku:product.sku,quantity:1}]);
class Boundary extends React.Component{state={error:''};static getDerivedStateFromError(e){return{error:e.message}};render(){return this.state.error?<h1 role="alert">CRASH: {this.state.error}</h1>:this.props.children}}
function App(){const[metrics,setMetrics]=React.useState({});React.useEffect(()=>{const timer=setInterval(()=>fetch('/__fixture/metrics').then(r=>r.json()).then(setMetrics),250);return()=>clearInterval(timer)},[]);return <>
<details open style={{background:'#fff7d6',padding:12}}><summary>LOCAL MOCK — no real orders or wallet debits</summary>
<nav>{['full','partial','zero','preorder','failure','slow','rejected','unknown'].map(s=><a style={{marginRight:12}} href={'/?scenario='+s+'&locale='+locale} key={s}>{s}</a>)}{['en','it','zh-CN'].map(l=><a style={{marginRight:12}} href={'/?scenario='+scenario+'&locale='+l} key={l}>{l}</a>)}</nav>
<button onClick={()=>replaceStoredCartItems([{sku:product.sku,quantity:2}])}>Fixture: quantity 2</button>
<pre data-testid="fixture-metrics" style={{whiteSpace:'pre-wrap',fontSize:11}}>{JSON.stringify(metrics,null,2)}</pre></details>
<I18nProvider locale={locale} scope="storefront" dictionary={storefrontDictionaries[locale]}><Boundary><CheckoutClient company={company} customerProfile={profile} initialAccountAccess={{userId:'wallet-fixture',authenticated:true,canViewPrices:true,canCheckout:true,accountType:'customer'}} catalogProducts={[product]} runtime={{canSubmit:true,mode:'ready',title:'Checkout',description:''}}/></Boundary></I18nProvider></>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
execFileSync(process.execPath, [path.join(dir, "build.cjs")], { cwd: root, stdio: "inherit" });

function functionsFrom(filePath, names) {
  const source = readFileSync(filePath, "utf8");
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  return file.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text))
    .map(n => n.getText(file).replace(/^export /, "")).join("\n");
}
// Use the real preview arithmetic and Money DTO functions, with no DB access.
const functions = functionsFrom("src/lib/partspro-api.ts", ["money", "toCents"])
  + functionsFrom("src/app/api/orders/preview/route.ts", ["calculateWalletSummary", "walletSummaryDto"]);
const { money, walletSummary } = vm.runInNewContext(ts.transpileModule(`(()=>{${functions};return {money,walletSummary:(total,balance,use)=>walletSummaryDto(calculateWalletSummary(total,balance,use))}})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
const runs = new Map();
const cssDir = path.join(root, ".next/static/css");
const css = readdirSync(cssDir).filter(n => n.endsWith(".css")).map(n => readFileSync(path.join(cssDir, n), "utf8")).join("\n");
const product = { sku: "WALLET-FIXTURE-001", name: "Wallet checkout test battery", brand: "Apple", category: "Batterie", price: 11.5, retailPrice: 11.5, basePrice: 11.5, priceResolved: true, priceVersion: "fixture-v1", quoteStatus: "available", customerType: "wholesale", customerLevel: "king", moq: 1, stock: 100, status: "In Stock", grade: "Original", visual: "battery" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const run = String(req.headers["x-fixture-run"] ?? "none");
  const scenario = String(req.headers["x-fixture-scenario"] ?? "full");
  const state = runs.get(run) ?? { scenario, quotes: [], submissions: [], receipts: {}, failedOnce: false };
  runs.set(run, state);
  const json = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/__fixture/metrics") return json({ scenario, quotes: state.quotes, submissions: state.submissions });
  if (url.pathname === "/api/orders/preview" || url.pathname === "/api/orders") {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const qty = body.items[0].quantity, subtotal = 1150 * qty, shipping = body.deliveryMethod === "pickup" ? 0 : 650, total = subtotal + shipping;
    const preorder = scenario === "preorder";
    const p = { ...product, sku: body.items[0].sku, ...(preorder ? { brand: "REMAX", purchaseKind: "preorder", preorderAvailableQuantity: 100 } : {}) };
    const wallet = walletSummary(total, scenario === "zero" ? 0 : scenario === "partial" ? 5 : 11.5, body.useWallet && !preorder);
    const totals = { subtotal: money(subtotal), shipping: money(shipping), vat: money(0), total: money(total) };
    const lines = [{ sku: p.sku, quantity: qty, unitPrice: money(1150), lineGross: money(subtotal), priceVersion: "fixture-v1", purchaseKind: preorder ? "preorder" : "stock" }];
    if (url.pathname.endsWith("preview")) {
      state.quotes.push(body);
      await new Promise(r => setTimeout(r, scenario === "slow" ? 1600 : 300));
      if (scenario === "failure" && body.useWallet && !state.failedOnce) { state.failedOnce = true; return json({ error: { code: "CATALOG_UNAVAILABLE", message: "Synthetic temporary quote failure" } }, 503); }
      return json({ data: { canSubmit: true, issues: [], orderKind: preorder ? "preorder" : "stock", catalog: { products: [p], rejected: [] }, lines, totals, wallet } });
    }
    state.submissions.push(body);
    await new Promise(r => setTimeout(r, 500));
    if (scenario === "rejected") return json({ error: { code: "ORDER_PRICE_CHANGED", details: { transactionRolledBack: true } } }, 409);
    const receipt = state.receipts[body.requestId] ?? { id: "fixture-order-001", orderNo: "LOCAL-MOCK-001", orderKind: preorder ? "preorder" : "stock", status: "confirmed", totals, lines, walletAppliedAmount: Number(wallet.appliedAmount.amount), payableAmount: Number(wallet.payableAmount.amount) };
    state.receipts[body.requestId] = receipt;
    if (scenario === "unknown" && state.submissions.length === 1) return json({ error: { code: "ORDER_RESULT_UNKNOWN" } }, 503);
    return json({ data: receipt });
  }
  if (url.pathname.startsWith("/api/orders/submissions/")) return json({ state: "created", order: state.receipts[url.pathname.split("/").pop()] });
  if (url.pathname.startsWith("/api/")) return json({ data: [] });
  if (url.pathname === "/bundle.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(readFileSync(path.join(dir, "bundle.js"))); }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}}</script><script src="/bundle.js"></script></body></html>`);
});
server.listen(3119, "127.0.0.1", () => console.log("Local checkout fixture: http://127.0.0.1:3119/?scenario=full&locale=en"));
