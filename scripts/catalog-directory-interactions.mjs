// Real components; simulated admin APIs. Never proves production writes or authentication.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.CATALOG_FIXTURE_URL || 'http://127.0.0.1:3169';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only');
const output=path.resolve('outputs/catalog/2026-10-10'); await fs.mkdir(output,{recursive:true});
const initialProduct={sku:'CAT-UI-1',name:'测试长名称 / Cavo elettronico di alta qualità con descrizione molto lunga per dispositivi professionali',brand:'REMAX',category:'Connettori',catalogDepartment:'general_merchandise',grade:'A',price:10,retailPrice:15,costPrice:5,stock:8,status:'In Stock',stockStatus:'In Stock',catalogStatus:'active',updatedAt:'2026-10-10T08:00:00.123456Z',moq:1,warehouse:'Milano',compatibleWith:[],tags:[],imageUrl:'/pwa/icon-192.png',imagePath:'fixture',catalogUrl:'/catalogo?department=general_merchandise',storefrontVisible:true,storefrontUrl:'/prodotto/CAT-UI-1',supplier:'Fixture',modelCodes:[]};
const baseNodes=[['department','phone','手机','Smartphone'],['department','tablet','平板','Tablet'],['department','computer','电脑','Computer'],['department','general_merchandise','电子产品·高端产品','Elettronica e prodotti premium'],['brand','REMAX','REMAX','REMAX'],['category','Connettori','尾插','Connettori'],['category','Custom category','自定义长名称分类','Categoria personalizzata con nome molto lungo']].map(([kind,value,nameZh,nameIt],i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,kind,value,nameZh,nameIt,active:true,position:i,version:1,count:kind==='department'&&value!=='general_merchandise'?0:1,countsByDepartment:{general_merchandise:1}}));
async function visible(locator) { for(const item of await locator.all()) if(await item.isVisible()) return item; throw new Error('No visible matching control'); }
const browser=await chromium.launch({channel:'chrome',headless:true}); const results=[];
try {
 for(const [width,height,locale] of [[1440,1000,'zh-CN'],[360,740,'zh-CN'],[390,700,'it'],[768,900,'it']]){
  const context=await browser.newContext({viewport:{width,height}}); const page=await context.newPage(); const errors=[]; const writes=[]; let product={...initialProduct}; let nodes=structuredClone(baseNodes),revision=1,rejectNextProduct=true,acceptDiscard=true;
  page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',dialog=>acceptDiscard?dialog.accept():dialog.dismiss());
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.postDataJSON();
   let data,meta; let status=200;
   if(url.pathname==='/api/catalog-directory') data={nodes:nodes.filter(n=>n.active),revision:String(revision)};
   else if(url.pathname==='/api/admin/catalog-directory' && request.method()==='GET') data={nodes,revision:String(revision)};
   else if(url.pathname==='/api/admin/catalog-directory') { writes.push({type:'node',body}); const n=nodes.find(n=>n.id===body.id); assert.equal(n.version,body.version); Object.assign(n,body,{version:n.version+1}); revision++; data={nodes,revision:String(revision)}; }
   else if(url.pathname==='/api/admin/catalog-directory/move'){ writes.push({type:'move',body}); assert.equal(body.products[0].updatedAt,product.updatedAt); product.catalogDepartment=body.target.department; product.updatedAt='2026-10-10T09:00:00.123456Z'; revision++; data={moved:1,directory:{nodes,revision:String(revision)}}; }
   else if(url.pathname==='/api/admin/products/model-groups') {data=[{brand:'REMAX',models:[],series:[]}];meta={source:'supabase'};}
   else if(url.pathname==='/api/admin/products' && request.method()==='GET'){ data=[product];meta={source:'supabase',total:1,returned:1,summary:{total:1,active:1}}; }
   else if(url.pathname==='/api/admin/products' && request.method()==='PATCH'){if(rejectNextProduct){rejectNextProduct=false;writes.push({type:'rejected-product',body});await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Fixture save unavailable; retry'}})});return;}writes.push({type:'product',body});assert.equal(body.product.expectedUpdatedAt,product.updatedAt);Object.assign(product,body.product);product.updatedAt='2026-10-10T10:00:00.654321Z'; data=product;revision++;}
   else if(url.pathname==='/api/admin/products' && request.method()==='POST'){writes.push({type:'create',body});data={...product,...body.product,sku:'CAT-UI-NEW',catalogStatus:'draft',storefrontVisible:false};}
   else {data=[];meta={source:'supabase',total:0,returned:0};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify({data,meta})});
  });
  await page.goto(`${base}/?catalogView=directory&locale=${locale}`,{waitUntil:'domcontentloaded'});
  const zh=locale==='zh-CN';
  await page.getByRole('button',{name:zh?'电子产品·高端产品':'Elettronica e prodotti premium',exact:true}).click();
  await page.getByLabel('Nome italiano',{exact:true}).fill('Elettronica premium aggiornata');
  acceptDiscard=false;
  await page.getByRole('tab',{name:zh?'商品目录':'Catalogo prodotti',exact:true}).click();
  assert.equal(await page.getByLabel('Nome italiano',{exact:true}).inputValue(),'Elettronica premium aggiornata');
  assert.equal(await page.getByRole('tab',{name:zh?'目录管理':'Gestione catalogo',exact:true}).getAttribute('data-state'),'active');
  acceptDiscard=true;
  await page.getByRole('button',{name:zh?'保存目录':'Salva',exact:true}).click();
  await page.getByRole('status').filter({hasText:zh?'目录已保存':'Catalogo salvato'}).waitFor();
  assert.equal(writes.filter(w=>w.type==='node').length,1);
  await page.screenshot({path:path.join(output,`directory-${width}-${locale}.png`),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'directory page has no horizontal overflow');
  // Directory -> product list, select product and atomically move department.
  await page.getByRole('tab',{name:zh?'商品目录':'Catalogo prodotti',exact:true}).click();
  await page.waitForTimeout(300); assert.ok(await visible(page.getByText(initialProduct.name,{exact:true})));
  await (await visible(page.getByRole('checkbox'))).click();
  await page.getByRole('button',{name:zh?'移动目录':'Sposta nel catalogo',exact:true}).click();
  await page.getByLabel(zh?'目标系列':'Reparto',{exact:true}).selectOption('computer');
  await page.getByLabel(zh?'操作原因（至少3个字符）':'Motivo (almeno 3 caratteri)',{exact:true}).fill('Fixture move');
  await page.screenshot({path:path.join(output,`move-${width}-${locale}.png`)});
  await page.getByRole('button',{name:zh?'确认移动':'Conferma spostamento',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'}); assert.equal(writes.filter(w=>w.type==='move').length,1);
  assert.equal(product.catalogDepartment,'computer');
  await page.screenshot({path:path.join(output,`products-${width}-${locale}.png`),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'product page has no horizontal overflow');
  // Open editor using the actual row/card action. Record labels first for diagnostics if absent.
  const editButton=page.getByRole('button',{name:zh?'编辑商品':'Modifica',exact:true});
  if(await editButton.count()) await (await visible(editButton)).click();
  else { await (await visible(page.locator('button[aria-label$=": CAT-UI-1"]'))).click(); await page.waitForTimeout(150); await page.screenshot({path:path.join(output,`actions-${width}-${locale}.png`)}); await page.getByRole('menuitem',{name:/编辑|Modifica/}).first().click(); }
  const dialog=page.getByRole('dialog'); await dialog.waitFor();
  await dialog.locator('input:visible').first().waitFor();
  await dialog.getByRole('group',{name:zh?'商品名称':'Nome prodotto',exact:true}).getByRole('textbox').fill('Synthetic edited electronic cable');
  await dialog.getByRole('group',{name:zh?'分类':'Categoria',exact:true}).getByRole('combobox').click();
  await page.getByRole('option',{name:zh?'自定义长名称分类':'Categoria personalizzata con nome molto lungo',exact:true}).click();
  await page.screenshot({path:path.join(output,`editor-${width}-${locale}.png`)});
  await dialog.getByRole('button',{name:zh?'保存':'Salva',exact:true}).click();
  await dialog.getByRole('alert').filter({hasText:'Fixture save unavailable'}).waitFor();
  assert.equal(await dialog.getByRole('group',{name:zh?'商品名称':'Nome prodotto',exact:true}).getByRole('textbox').inputValue(),'Synthetic edited electronic cable');
  assert.equal(writes.filter(w=>w.type==='product').length,0);
  await page.screenshot({path:path.join(output,`save-recovery-${width}-${locale}.png`)});
  await dialog.getByRole('button',{name:zh?'保存':'Salva',exact:true}).click();
  await page.waitForTimeout(300);
  if(writes.filter(w=>w.type==='product').length!==1){console.log('EDITOR DIAGNOSTIC',await dialog.innerText());await page.screenshot({path:path.join(output,`editor-failure-${width}-${locale}.png`)});}
  assert.equal(writes.filter(w=>w.type==='product').length,1);
  assert.equal(product.name,'Synthetic edited electronic cable');
  assert.equal(product.category,'Custom category');

  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,'editor fits viewport');
  await dialog.locator('[data-slot="sheet-close"]').click();
  await page.getByRole('tab',{name:zh?'目录管理':'Gestione catalogo',exact:true}).click();
  await page.getByRole('button',{name:zh?'商品分类':'Categorie',exact:true}).click();
  await page.getByRole('button',{name:zh?'在此新建商品':'Crea prodotto',exact:true}).last().click();
  const createDialog=page.getByRole('dialog');await createDialog.waitFor();
  await createDialog.getByRole('group',{name:zh?'商品名称':'Nome prodotto',exact:true}).getByRole('textbox').fill('Synthetic draft from directory');
  await createDialog.getByRole('group',{name:zh?'批发价':'Prezzo B2B',exact:true}).getByRole('spinbutton').fill('5');
  await createDialog.getByRole('button',{name:zh?'保存':'Salva',exact:true}).click();
  await page.waitForTimeout(300);
  const creation=writes.find(w=>w.type==='create');assert.ok(creation);assert.match(creation.body.requestId,/^[a-f0-9-]{36}$/i);assert.equal(creation.body.product.category,'Custom category');
  await page.screenshot({path:path.join(output,`draft-${width}-${locale}.png`)});
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({width,height,locale,passed:['directory unsaved tab exit protection','directory rename/readback','department move/version payload','long labels','no page overflow','editor viewport','custom category edit/save/version','failed save retains input','directory-prefilled draft'],writes:writes.map(w=>w.type)});
  await context.close();
 }
 await fs.writeFile(path.join(output,'browser-fixture-results.json'),JSON.stringify({environment:'real React components with simulated admin APIs; not production E2E',results},null,2));
 console.log(JSON.stringify(results));
} finally { await browser.close(); }
