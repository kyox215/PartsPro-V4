import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PERF_BASE_URL || 'http://127.0.0.1:3158';
const origin = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(origin.hostname) && !(origin.protocol === 'https:' && process.env.PERF_ALLOWED_ORIGIN === origin.origin)) throw new Error('Explicit verified remote origin required');
const output = process.env.PERF_OUTPUT || '/tmp/partspro-diagnostics';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
 for (const path of ['/', '/catalogo', '/login', '/professionale', '/carrello']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.emulateNetworkConditions', { offline:false, latency:80, downloadThroughput:1_125_000, uploadThroughput:187_500, connectionType:'cellular4g' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate:4 });
  const errors=[], badResponses=[], failedRequests=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('response', r=>{ if(r.status()>=400) badResponses.push({path:new URL(r.url()).pathname,status:r.status()}); });
  page.on('requestfailed', r=>failedRequests.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  await page.addInitScript(()=>{
   window.__diag={lcp:0,longTasks:[]};
   new PerformanceObserver(list=>{ for(const e of list.getEntries()) window.__diag.lcp=e.startTime; }).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(list=>{ for(const e of list.getEntries()) window.__diag.longTasks.push(Math.round(e.duration)); }).observe({type:'longtask',buffered:true});
  });
  const response=await page.goto(baseURL+path,{waitUntil:'domcontentloaded',timeout:60000});
  if(path==='/') await page.locator('#stocked-products a[href^="/prodotto/"]').first().waitFor();
  if(path==='/catalogo') await page.locator('a[href^="/prodotto/"]').first().waitFor();
  const contentReadyMs=Math.round(await page.evaluate(()=>performance.now()));
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  const metrics=await page.evaluate(()=>{
   const r=performance.getEntriesByType('resource');
   return {lcpMs:Math.round(window.__diag.lcp),longTasks:window.__diag.longTasks,loadMs:Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd),
    jsEncodedBytes:r.filter(x=>x.initiatorType==='script').reduce((a,x)=>a+x.encodedBodySize,0),
    jsDecodedBytes:r.filter(x=>x.initiatorType==='script').reduce((a,x)=>a+x.decodedBodySize,0),
    slowest:r.toSorted((a,b)=>b.duration-a.duration).slice(0,12).map(x=>({path:new URL(x.name).pathname,ms:Math.round(x.duration),startMs:Math.round(x.startTime),bytes:x.encodedBodySize,type:x.initiatorType})),
    apis:r.filter(x=>new URL(x.name).pathname.startsWith('/api/')).map(x=>({path:new URL(x.name).pathname,ms:Math.round(x.duration)})),
    images:[...document.images].filter(x=>x.loading==='eager').map(x=>({top:Math.round(x.getBoundingClientRect().top),priority:x.fetchPriority})),
    brokenImages:[...document.images].filter(x=>x.complete&&!x.naturalWidth).length};
  });
  const result={path,status:response.status(),contentReadyMs,...metrics,errors,badResponses,failedRequests};results.push(result);console.log(JSON.stringify(result));
  await context.close();
 }
} finally {await browser.close();await writeFile(output+'/results.json',JSON.stringify({baseURL,results},null,2));}
