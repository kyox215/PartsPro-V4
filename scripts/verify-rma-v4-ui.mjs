// Local component interaction verification. Responses are fixtures, never production data.
// Prepare: node scripts/verify-rma-v4-ui.mjs --prepare
// Build fixture: RMA_UI_FIXTURE=1 npm run build
// Start: RMA_UI_FIXTURE=1 npm run start -- --hostname 127.0.0.1 --port 3173
// Run this script (PLAYWRIGHT_MODULE may point to the installed runtime).
// Stop that server, then run this script with --cleanup before production build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { projectRmaV4Workflow } from '../src/lib/partspro-rma-v4-rules.mjs';
const fixturePath = 'src/app/rma-verification-local/page.tsx';
const fixture = await readFile(new URL('../tests/fixtures/rma-v4-ui-page.tsx.fixture', import.meta.url), 'utf8');
if (process.argv.includes('--prepare')) {
 await mkdir('src/app/rma-verification-local', {recursive:true});
 await writeFile(fixturePath, fixture, {flag:'wx'});
 console.log('Local-only harness prepared.'); process.exit(0);
}
if (process.argv.includes('--cleanup')) {
 if (await readFile(fixturePath, 'utf8') !== fixture) throw Error('Fixture changed; refusing to remove');
 await unlink(fixturePath); await rmdir('src/app/rma-verification-local');
 console.log('Local-only harness removed.'); process.exit(0);
}
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.RMA_TEST_ORIGIN || 'http://127.0.0.1:3173';
if (new URL(origin).hostname !== '127.0.0.1') throw new Error('Loopback fixture server required');
const dir = 'outputs/rma-v4'; await mkdir(dir, {recursive:true});
const caps = {manage:true, inventory:true, refund:true, adjustStock:true, createReplacement:true};
const base = {id:'11111111-1111-4111-8111-111111111111',rmaNo:'RMA-TEST-001',orderId:'PP-TEST-1',orderNumber:'PP-TEST-1',sku:'TEST-SCREEN',productName:'Test screen / Schermo di prova',status:'received',quantity:3,receivedQuantity:3,receivedAt:'2026-09-26T10:00:00Z',qcStatus:'passed',inventoryDisposition:'quarantine',requestedResolution:'wallet_credit',refundPricingVerified:true,attachments:[],events:[],customerName:'Test customer',createdAt:'26/09/2026',reason:'quality_defect',refundPreview:{available:true,maxRefundAmount:60,quantity:3,currency:'EUR',netAmount:60,taxAmount:0,taxIncluded:true,shippingIncluded:false},replacementCandidates:[]};
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = [];
try {
 for (const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
  let current={...base}; const posted=[]; const errors=[];
  page.on('pageerror',e=>{errors.push(e.message); console.log(e.stack);});
  await page.route('**/api/**', async route=>{
   const url = new URL(route.request().url()); let body={data:[],meta:{}};
   const row={...current,...projectRmaV4Workflow(current,caps)};
   if (url.pathname.startsWith('/api/admin/rma')) {
    if (route.request().method()==='POST') {
     posted.push(route.request().postDataJSON());
     body={data:row};
    } else if (url.pathname==='/api/admin/rma') body={data:[row],meta:{total:1,countsComplete:true,queueCounts:{resolution:1}}};
    else body={data:row};
   } else if (url.pathname==='/api/rma') body={data:[{...current,status:'rejected',customerStage:'rejected',reasonCode:'quality_defect',canMarkShipped:false}, {...current,id:'22222222-2222-4222-8222-222222222222',status:'refunded',customerStage:'refunded',reasonCode:'quality_defect',canMarkShipped:false,refundAmount:60,refundedAt:'2026-09-26T10:00:00Z'}],meta:{orderOptions:[{id:'order-1',number:'PP-TEST-1',date:'26/09/2026',status:'shipped',total:60,items:1,lines:[{id:'line-1',sku:'TEST-SCREEN',productName:'Test screen',remainingQuantity:3,orderedQuantity:3,alreadyRequestedQuantity:0}]}]}};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  const open = async (overrides={})=> {current={...base,...overrides};await page.goto(`${origin}/rma-verification-local`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:base.productName}).waitFor();};
  await open({qcStatus:'failed'});
  assert.equal(await page.getByRole('button',{name:/Rimetti a stock/}).count(),0,'failed QC restock hidden');
  await page.getByRole('button',{name:'Apri accordo con cliente',exact:true}).click();
  await page.getByLabel('Motivo / documentazione').fill('Test: evidence needs customer agreement.');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).action,'start_negotiation');

  await open({qcStatus:'pending'});
  await page.getByRole('button',{name:'Dividi quantità',exact:true}).click();
  await page.getByLabel('Quantità da gestire in questa richiesta').fill('3');
  await page.getByLabel('Motivo / documentazione').fill('Test: two arrived, one remains outstanding.');
  assert.equal(await page.getByRole('button',{name:'Conferma',exact:true}).isDisabled(),true);
  await page.getByLabel('Quantità da gestire in questa richiesta').fill('2');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).action,'split_request');assert.equal(posted.at(-1).quantity,2);

  await open({negotiationStatus:'pending'});
  await page.getByRole('button',{name:'Registra accordo',exact:true}).click();
  await page.getByLabel('Motivo / documentazione').fill('Test: customer chose wallet settlement.');
  assert.equal(await page.getByRole('button',{name:'Conferma',exact:true}).isDisabled(),true);
  await page.getByLabel('Conferma del cliente (canale, data e risposta)').fill('Test written agreement 2026-09-26: wallet refund accepted.');
  await page.screenshot({path:`${dir}/agreement-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).negotiationOutcome,'refund_wallet');

  await open({negotiationStatus:'agreed',negotiationOutcome:'return_to_customer'});
  await page.getByRole('button',{name:'Spedisci articolo al cliente',exact:true}).click();
  await page.getByLabel('Corriere',{exact:true}).fill('Test carrier');
  await page.getByLabel('Tracking della restituzione').fill('TEST-TRACKING');
  await page.getByLabel('Motivo / documentazione').fill('Test dispatch evidence reference.');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).trackingNumber,'TEST-TRACKING');

  await open({requestedResolution:'replacement'});
  await page.getByRole('button',{name:'Crea ordine sostitutivo',exact:true}).click();
  await page.getByLabel('Motivo / documentazione').fill('Dedicated replacement authorized after inspection.');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).action,'create_replacement_order');
  await open({requestedResolution:'replacement',replacementReservedOrderId:'33333333-3333-4333-8333-333333333333'});
  assert.equal(await page.getByRole('link',{name:/Apri l’ordine sostitutivo/}).getAttribute('href'),'/admin?panel=orders&orderId=33333333-3333-4333-8333-333333333333');
  await page.getByRole('button',{name:'Sblocca ordine sostitutivo annullato',exact:true}).click();
  await page.getByLabel('Motivo / documentazione').fill('Order cancelled before dispatch; restart agreed resolution.');
  await page.getByRole('button',{name:'Conferma',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posted.at(-1).action,'release_cancelled_replacement');

  await open();
  assert.ok(await page.getByRole('button',{name:/Rimetti a stock/}).count()>0,'inventory available before refund approval');
  await page.screenshot({path:`${dir}/workbench-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no workbench overflow');
  await page.goto(`${origin}/rma-verification-local?customer=1`,{waitUntil:'networkidle'});
  await page.getByText('Richiesta non accettata',{exact:true}).waitFor({timeout:10000}).catch(async e=>{console.log({mobile,errors,body:await page.locator('body').innerText()});throw e;});
  assert.equal(await page.getByRole('radio',{name:'Rimborso nel saldo PartsPro'}).getAttribute('aria-checked'),'true');
  assert.ok(await page.getByText(/Accreditato nel saldo PartsPro/).count()>0);
  assert.equal(await page.getByText('wallet_credit',{exact:true}).count(),0);
  assert.equal(await page.getByText('quality_defect',{exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Controlla i movimenti del saldo'}).getAttribute('href'),'/account?section=wallet');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no customer overflow');
  await page.screenshot({path:`${dir}/customer-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  results.push({viewport:mobile?'390x844':'1440x1000',fixtureOnly:true,passed:true,postedActions:posted.map(x=>x.action)});
  await page.close();
 }
 await writeFile(`${dir}/interaction-results.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
} finally { await browser.close(); }
