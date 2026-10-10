// Actual React components; all admin APIs mocked. No production writes or auth proof.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_UX_FIXTURE_URL || 'http://127.0.0.1:3169';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture only');
const output = path.resolve('outputs/admin-products/2026-10-10');
await fs.mkdir(output, { recursive: true });
const initial = { sku:'UX-1', name:'测试长名称 / Cavo elettronico professionale con nome lungo e caratteristiche tecniche', brand:'REMAX', category:'Connettori', catalogDepartment:'general_merchandise', grade:'A', price:10, retailPrice:15, costPrice:5, stock:8, status:'In Stock', stockStatus:'In Stock', catalogStatus:'active', updatedAt:'2026-10-10T08:00:00Z', moq:1, warehouse:'Milano', compatibleWith:[], tags:[], imageUrl:'/pwa/icon-192.png', catalogUrl:'/catalogo', storefrontVisible:true, storefrontUrl:'/prodotto/UX-1', supplier:'Fixture', model:'CB25', modelCodes:[] };
async function visible(locator) { const end=Date.now()+6000; while(Date.now()<end) { for (const item of await locator.all()) if (await item.isVisible()) return item; await new Promise(r=>setTimeout(r,40)); } throw new Error('No visible control: '+locator); }
const browser = await chromium.launch({ channel:'chrome', headless:true });
const results = [];
try {
  for (const [width,height,locale] of [[1440,1000,'zh-CN'],[360,740,'zh-CN'],[390,700,'it'],[768,900,'it']]) {
    const context = await browser.newContext({ viewport:{width,height} });
    const page = await context.newPage(); page.setDefaultTimeout(6000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const writes = []; let products = [structuredClone(initial), {...initial, sku:'UX-2', name:'Second test product'}];
    let rejectSave = true, nextPageShrinks = true;
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      let data = [], meta = { source:'supabase', total:0, returned:0 };
      if (url.pathname === '/api/catalog-directory' || url.pathname === '/api/admin/catalog-directory') data={nodes:[],revision:'1'};
      else if (url.pathname === '/api/admin/products/model-groups') data = [{brand:'REMAX',models:[],series:[]}];
      else if (url.pathname === '/api/admin/products' && request.method() === 'GET') {
        if (url.searchParams.get('q') === 'slow') await new Promise(resolve=>setTimeout(resolve,450));
        const offset = Number(url.searchParams.get('offset'));
        if (offset && nextPageShrinks) { nextPageShrinks = false; data = []; meta.total = 2; }
        else { data = products; meta = { source:'supabase', total:nextPageShrinks?45:2, returned:2, summary:{total:2,active:2} }; }
      } else if (url.pathname === '/api/admin/products' && request.method() === 'DELETE') {
        const body = request.postDataJSON(); writes.push({ method:'DELETE', body });
        assert.deepEqual(body.skus, ['UX-1','UX-2']); products[0].catalogStatus='hidden';
        await route.fulfill({status:207,contentType:'application/json',body:JSON.stringify({data:[products[0]],meta:{outcome:'partial',failedSku:'UX-2',unattemptedSkus:[]}})}); return;
      } else if (url.pathname === '/api/admin/products' && request.method() === 'PATCH') {
        const body = request.postDataJSON(); writes.push({method:'PATCH',body});
        await new Promise(resolve=>setTimeout(resolve,300));
        if (rejectSave) { rejectSave=false; await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic save unavailable'}})}); return; }
        assert.equal(body.product.expectedUpdatedAt,products[0].updatedAt); Object.assign(products[0],body.product); products[0].updatedAt='2026-10-10T11:00:00.123456Z'; data=products[0];
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,meta})});
    });
    const zh = locale === 'zh-CN';
    try {
      await page.goto(`${base}/?locale=${locale}`, {waitUntil:'domcontentloaded'});
      await (await visible(page.getByText(initial.name,{exact:true}))).waitFor();
      await (await visible(page.getByRole('checkbox'))).click();
      const hide = page.getByRole('button',{name:zh?'批量下架':'Nascondi selezionati',exact:true});
      await hide.click(); await page.getByRole('dialog').waitFor();
      await page.screenshot({path:path.join(output,`hide-confirm-${width}.png`)});
      assert.equal(writes.length,0,'confirmation does not mutate');
      await page.getByRole('dialog').getByRole('button',{name:zh?'取消':'Annulla',exact:true}).click();
      await hide.click(); await page.getByRole('dialog').getByRole('button',{name:zh?'批量下架':'Nascondi selezionati',exact:true}).click();
      await page.getByText(zh?/已隐藏 1 个/:/1 nascosti/).waitFor();
      assert.equal(writes.filter(w=>w.method==='DELETE').length,1);
      await page.getByRole('dialog').waitFor({state:'hidden'});
      // A page that vanishes after a catalog write falls back to the last valid page.
      await page.getByRole('button',{name:'3',exact:true}).click();
      await page.getByText(zh?/第 1 \/ 1 页/:/Pagina 1 \/ 1/).waitFor();
      // Selected rows cannot remain actionable as soon as a filter changes.
      await (await visible(page.getByRole('checkbox'))).click();
      const search = await visible(page.getByRole('textbox',{name:zh?'搜索 SKU / 商品 / 品牌 / 型号':'Cerca SKU / prodotto / brand / modello',exact:true}));
      await search.fill('slow');
      assert.equal(await hide.count(),0,'changing criteria immediately clears selected products');
      assert.equal(await (await visible(page.locator('button[aria-label$=": UX-1"]'))).isEnabled(),false,'stale results locked');
      await page.getByRole('button',{name:zh?'清除筛选':'Azzera filtri',exact:true}).click();
      const menu = await visible(page.locator('button[aria-label$=": UX-1"]'));
      await menu.waitFor(); await page.waitForTimeout(250); await menu.click();
      await page.getByRole('menuitem',{name:zh?'编辑商品':'Modifica',exact:true}).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      const name = dialog.getByRole('group',{name:zh?'商品名称':'Nome prodotto',exact:true}).getByRole('textbox');
      await name.fill('Preserved edit after synthetic network error');
      const review = dialog.getByRole('checkbox'); if (await review.count()) await review.first().check();
      let confirms = 0; page.on('dialog', async d => { confirms++; await d.dismiss(); });
      await page.keyboard.press('Escape'); assert.ok(await dialog.isVisible()); assert.equal(confirms,1);
      await dialog.getByRole('button',{name:zh?'保存':'Salva',exact:true}).click();
      assert.equal(await name.isEnabled(),false,'fields locked during save');
      await page.keyboard.press('Escape'); assert.ok(await dialog.isVisible(),'saving drawer cannot close');
      await dialog.getByRole('alert').filter({hasText:'Synthetic save unavailable'}).waitFor();
      assert.equal(await name.inputValue(),'Preserved edit after synthetic network error');
      const headerBox = await dialog.locator('[data-slot=sheet-header]').boundingBox(); assert.ok(headerBox.y>=-1,'error header stays visible');
      await page.screenshot({path:path.join(output,`save-recovery-${width}.png`)});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'no horizontal page overflow');
      assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().width <= innerWidth+1),'drawer fits viewport');
      await dialog.getByRole('button',{name:zh?'保存':'Salva',exact:true}).click();
      await dialog.getByRole('heading',{name:'Preserved edit after synthetic network error',exact:true}).waitFor();
      assert.equal(writes.filter(w=>w.method==='PATCH').length,2);
      await page.screenshot({path:path.join(output,`detail-${width}.png`)});
      assert.deepEqual(errors,[]);
      results.push({width,height,locale,confirmation:true,bulkPartialReadback:true,pageRecovery:true,staleRowsLocked:true,unsavedProtected:true,saveFailureRetained:true,noOverflow:true,pageErrors:0});
    } catch (error) { await page.screenshot({path:path.join(output,`failure-${width}.png`),fullPage:true}); throw error; }
    finally { await context.close(); }
  }
  // Creation-only staff: content saved once, image retry must not require edit permission.
  {
    const context = await browser.newContext({viewport:{width:390,height:760}}), page=await context.newPage();
    page.setDefaultTimeout(6000); const counts={create:0,patch:0,image:0}; let created=null;
    await context.route('**/api/**',async route=>{
      const r=route.request(),u=new URL(r.url());let data=[],meta={source:'supabase',total:0,returned:0};
      if(u.pathname==='/api/catalog-directory' || u.pathname==='/api/admin/catalog-directory') data={nodes:[],revision:'1'};
      else if(u.pathname==='/api/admin/products' && r.method()==='GET') {data=created?[created]:[];meta.total=data.length;meta.returned=data.length;}
      else if(u.pathname==='/api/admin/products' && r.method()==='POST') {counts.create++;created={...initial,...r.postDataJSON().product,sku:'NEW-SYNTHETIC',catalogStatus:'draft',storefrontVisible:false};data=created;}
      else if(u.pathname==='/api/admin/products' && r.method()==='PATCH') {counts.patch++;throw new Error('Creation-only image retry must not patch product content');}
      else if(u.pathname.endsWith('/images')) {counts.image++; if(counts.image===1){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic image error'}})});return;}data=created;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,meta})});
    });
    try {
      await page.goto(`${base}/?locale=it&createOnly=1`);
      await page.getByRole('button',{name:'Nuovo prodotto',exact:true}).click();
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      await dialog.getByRole('group',{name:'Nome prodotto',exact:true}).getByRole('textbox').fill('Synthetic catalog item');
      await dialog.locator('input[type=file]').setInputFiles(path.resolve('public/pwa/icon-192.png'));
      const review=dialog.getByRole('checkbox');if(await review.count())await review.first().check();
      await dialog.getByRole('button',{name:'Salva',exact:true}).click();
      await dialog.getByText(/NEW-SYNTHETIC.*foto non/).waitFor();
      assert.equal(counts.create,1);assert.equal(counts.image,1);assert.equal(counts.patch,0);
      await dialog.getByRole('button',{name:'Salva',exact:true}).click();
      await dialog.getByRole('heading',{name:'Synthetic catalog item',exact:true}).waitFor();
      assert.deepEqual(counts,{create:1,patch:0,image:2});
      results.push({scenario:'creation-only automatic SKU with image failure',...counts});
    } catch(error) {await page.screenshot({path:path.join(output,'create-image-failure.png'),fullPage:true});throw error;}
    finally {await context.close();}
  }
  await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify({environment:'Real components with mocked admin APIs',results},null,2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
