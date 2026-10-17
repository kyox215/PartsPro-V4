import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function loader(mocks={}){
 const cache=new Map();
 return function load(relative){
  const file=path.resolve(relative);if(cache.has(file))return cache.get(file);
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const loadedModule={exports:{}};cache.set(file,loadedModule.exports);
  const localRequire=name=>{
   if(name in mocks)return mocks[name];
   if(name.startsWith('.')||name.startsWith('@/')){
    const base=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);
    const target=[base,base+'.ts',base+'.tsx',base+'.mjs'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
    if(!target)throw Error('Cannot resolve '+name+' from '+file);return load(target);
   }
   return require(name);
  };
  vm.runInNewContext(source,{module:loadedModule,exports:loadedModule.exports,require:localRequire,URL,URLSearchParams,process,console,Intl},{filename:file});cache.set(file,loadedModule.exports);return loadedModule.exports;
 };
}
const load=loader();const config=load('src/i18n/config.ts');
test('device primary language and unsupported fallback are deterministic',()=>{
 for(const [header,expected] of [[null,'en-US'],['','en-US'],['en-GB,en;q=.9','en-US'],['zh-TW,en;q=.8','zh-CN'],['it-CH,it;q=.9','it-IT'],['fr-FR,it;q=.8','en-US'],['de-DE,zh;q=.9','en-US'],['en;q=.2,it;q=.9','it-IT'],['*','en-US'],['zh;q=0,it;q=.5','it-IT'],['it;q=oops','en-US']])assert.equal(config.deviceLocale(header),expected,String(header));
 assert.equal(config.resolveLocaleScope('/admin'),'admin');assert.equal(config.resolveLocaleScope('/login','/admin?panel=orders'),'admin');assert.equal(config.resolveLocaleScope('/login','/admin/orders'),'admin');
});
test('request locale ignores legacy cookies/account preferences; explicit local choice wins in both scopes',async()=>{
 for(const scope of ['storefront','admin'])for(const explicit of [null,'en-US','it-IT','zh-CN','invalid']){
  const cookieValues={partspro_locale_admin:'zh-CN',partspro_locale_storefront:'zh-CN',...(explicit?{partspro_locale_device_v2:explicit}:{})};
  const getRequestI18n=loader({'next/headers':{headers:async()=>new Map([['accept-language','it-IT'],['x-partspro-locale-scope',scope]]),cookies:async()=>({get:name=>cookieValues[name]?{value:cookieValues[name]}:undefined})}})('src/i18n/request.ts').getRequestI18n;
  const result=await getRequestI18n();assert.equal(result.scope,scope);assert.equal(result.locale,config.isLocale(explicit)?explicit:'it-IT');
 }
 assert.doesNotMatch(fs.readFileSync('src/i18n/request.ts','utf8'),/readCurrentAccount|preferred_locale|createClient/);
});
test('manual choice/reset changes only the local cookie, including English; no account write',async()=>{
 const writes=[],refreshes=[];const {setLocale}=loader({'next/headers':{cookies:async()=>({set:(...args)=>writes.push(args)})},'next/cache':{revalidatePath:(...args)=>refreshes.push(args)}})('src/app/actions/i18n.ts');
 assert.equal((await setLocale('en-US','admin')).ok,true);assert.equal(writes[0][0],config.localeCookieByScope.storefront);assert.equal(writes[0][1],'en-US');assert.equal(writes[0][2].maxAge,31536000);
 assert.equal((await setLocale(null,'storefront')).ok,true);assert.equal(writes[1][2].maxAge,0);assert.equal((await setLocale('fr-FR','admin')).ok,false);assert.equal(writes.length,2);assert.equal(refreshes.length,2);
 for(const file of ['src/app/actions/i18n.ts','src/app/login/actions.ts','src/app/auth/callback/route.ts'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/persistCurrentAccountPreferredLocale|seedCurrentAccountPreferredLocale/);
});
test('successful profile save clears onboarding and preserves safe account/checkout destinations',()=>{
 const {postProfileSaveRedirect:go}=load('src/lib/partspro-auth-redirect.ts');
 assert.equal(go(null,'setup=1&section=orders&returnTo=%2Fcheckout&q=ABC'),'/account?section=orders&q=ABC');
 assert.equal(go('/account?section=orders&orderId=A','setup=1'),'/account?section=orders&orderId=A');
 assert.equal(go('/account?setup=1&section=wallet&returnTo=%2Faccount','setup=1'),'/account?section=wallet');
 assert.equal(go('/checkout?draft=1','setup=1'),'/checkout?draft=1');
 for(const input of ['https://evil.test','//evil.test','/\\evil.test','/login?next=/account','/auth/callback','/admin','/account\u0000'])assert.equal(go(input,'setup=1'),'/account',input);
});
test('profile browser/API share boundaries and field errors without relaxing the API',()=>{
 const {accountProfileSchema:schema,accountProfileLimits:limits,accountProfileIssue:issue}=load('src/lib/partspro-account-profile-validation.ts');
 const valid={billingAddress:'Via Test 1, 00012 Guidonia (RM)',shippingAddress:'Via Test 1, 00012 Guidonia (RM)',companyName:'Negozio 客户',contactName:'',email:'fixture@example.test',fiscalCode:'12345678901',pec:'',phone:'12345'};
 assert.equal(schema.safeParse(valid).success,true);
 for(const field of ['billingAddress','shippingAddress','companyName','contactName','fiscalCode','phone']){
  assert.equal(schema.safeParse({...valid,[field]:'x'.repeat(limits[field].max)}).success,true,field+' at max');
  const invalid=schema.safeParse({...valid,[field]:'x'.repeat(limits[field].max+1)});assert.equal(invalid.success,false);assert.equal(issue(invalid.error.issues).field,field);assert.equal(issue(invalid.error.issues).limit,limits[field].max);
 }
 const short=schema.safeParse({...valid,phone:'1234'});assert.equal(short.success,false);assert.equal(issue(short.error.issues).key,'storefront.account.profile.tooShort');
 assert.equal(schema.safeParse({...valid,pec:'bad-email'}).success,false);assert.equal(schema.safeParse({...valid,unknown:'x'}).success,false);assert.equal(issue([{path:'shippingAddress',code:'too_big',message:'RAW'}]).field,'shippingAddress');assert.equal(issue([{path:'unknown',code:'too_big'}]),null);
 const source=fs.readFileSync('src/app/api/account/profile/route.ts','utf8');assert.match(source,/accountProfileSchema.safeParse/);assert.match(source,/email: userEmail/);
});
test('profile read failure is explicit and completed accounts ignore stale setup flags',async()=>{
 const empty={data:[],warning:undefined};
 for(const failed of [true,false]){
  const profile={data:failed?null:{id:'fixture',profileCompletedAt:'2026-10-17'},warning:failed?'RAW profile read failure':undefined};
  const mockRepo={getCurrentCustomerProfile:async()=>profile,listCurrentCustomerCompanies:async()=>empty,listCurrentCustomerOrderSummaries:async()=>empty,listCurrentCustomerRmaRequests:async()=>empty,getCurrentCustomerWallet:async()=>({data:{balance:0,currency:'EUR',transactions:[]}})};
  const Page=loader({'@/lib/supabase/env':{isSupabaseConfigured:()=>true},'@/lib/partspro-account-context':{getCurrentAccountContext:async()=>({authenticated:true,accountType:'customer',email:'fixture@example.test'})},'@/lib/partspro-repository':mockRepo,'@/lib/partspro-header-access':{toStoreHeaderAccountAccess:()=>({})},'@/components/partspro/account-page':{AccountPage:()=>null},'next/navigation':{redirect:()=>{throw Error('unexpected redirect')}}})('src/app/account/page.tsx').default;
  const result=await Page({searchParams:Promise.resolve({setup:'1'})});assert.equal(result.props.profileUnavailable,failed);assert.equal(result.props.forceSetup,false);assert.equal(result.props.dataWarning,profile.warning);
 }
 const source=fs.readFileSync('src/components/partspro/account-page.tsx','utf8');assert.match(source,/!profileUnavailable \? <AccountProfileDialog/);assert.match(source,/profileUnavailable \? t\("storefront.account.profile.loadError"\)/);
});
test('English dictionaries cover every storefront/admin leaf and keep interpolation contracts',()=>{
 const {getDictionary}=load('src/i18n/get-dictionary.ts');const {getAdminDictionary,normalizeAdminLocale}=load('src/i18n/dictionaries/admin.ts');
 function leaves(value,prefix=''){return Object.entries(value).flatMap(([key,v])=>typeof v==='string'?[[prefix+key,v]]:leaves(v,prefix+key+'.'));}
 for(const locale of ['it-IT','zh-CN'])for(const [key,value] of Object.entries(getDictionary(locale))){const en=getDictionary('en-US')[key];assert.equal(typeof en,'string',key);assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(en.match(/\{\w+\}/g)||[]).sort(),key);if(key!=='language.zh-CN')assert.doesNotMatch(en,/\p{Script=Han}/u,key);}
 const en=new Map(leaves(getAdminDictionary('en-US')));for(const [key,value] of leaves(getAdminDictionary('it-IT'))){assert.ok(en.has(key),key);assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(en.get(key).match(/\{\w+\}/g)||[]).sort(),key);assert.doesNotMatch(en.get(key),/\p{Script=Han}/u,key);}
 assert.equal(normalizeAdminLocale('fr-FR'),'en');assert.equal(normalizeAdminLocale('en-GB'),'en');
});
test('fixed English UI templates translate labels and preserve inserted business values verbatim',()=>{
 const {englishUiCopy,englishUiTemplate}=load('src/i18n/english-ui-copy.ts');
 const callback=()=>42;const original=Object.freeze({label:'Ordini',count:0,callback,nested:['Nome cliente']});
 const translated=englishUiCopy(original);assert.equal(translated.label,'Orders');assert.equal(translated.nested[0],'Customer name');assert.equal(translated.callback,callback);assert.equal(translated.count,0);assert.equal(original.label,'Ordini');
 assert.equal(englishUiTemplate`Ordine ${'客户 {0}'} creato.`,'Order 客户 {0} created.');
 assert.equal(englishUiCopy('UNRECOGNIZED DATA'), 'UNRECOGNIZED DATA');
});
test('English call sites have explicit translations for every fixed literal and template',()=>{
 const {englishLiteralCopy:dictionary}=load('src/i18n/english-literals.ts');let checked=0;
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):/\.(ts|tsx)$/.test(entry.name)?[path.join(dir,entry.name)]:[]);}
 for(const file of [...files('src/components/partspro'),...files('src/lib')]){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function walk(node){
   let key;
   if(ts.isCallExpression(node)&&node.expression.getText(ast)==='englishUiCopy'&&ts.isStringLiteral(node.arguments[0]))key=node.arguments[0].text;
   if(ts.isTaggedTemplateExpression(node)&&node.tag.getText(ast)==='englishUiTemplate')key=ts.isTemplateExpression(node.template)?node.template.head.text+node.template.templateSpans.map((span,index)=>`{${index}}`+span.literal.text).join(''):node.template.text;
   if(key&&/[A-Za-zÀ-ÿ]/.test(key)){assert.equal(typeof dictionary[key],'string',file+': '+key);checked++;}
   ts.forEachChild(node,walk);
  }walk(ast);
 }
 assert.ok(checked>350,checked+' fixed UI translations checked');
});
