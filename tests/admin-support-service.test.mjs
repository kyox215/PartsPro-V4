import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
function service(rpcClient) {
 const source=readFileSync(new URL('../src/lib/partspro-support.ts',import.meta.url),'utf8'),loadedModule={exports:{}};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const readClient={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:{message:'Synthetic detail read failure'}})})};
 vm.runInNewContext(js,{module:loadedModule,exports:loadedModule.exports,Date,console,require:name=>name==='server-only'?{}:name==='node:crypto'?{randomUUID}:name==='@/lib/supabase/server'?{createClient:async()=>rpcClient}:name==='@/lib/supabase/admin'?{createServiceRoleClient:()=>readClient,isSupabaseServiceRoleConfigured:()=>true}:name==='@/lib/partspro-notifications'?{notifySupportStaffReply:async()=>{},notifySupportAssigned:async()=>{},notifySupportCustomerMessage:async()=>{}}:(()=>{throw Error(name)})()});return loadedModule.exports;
}
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
test('atomic support reply preserves the exact send identifier and acknowledges committed send despite failed detail read',async()=>{
 const calls=[],api=service({rpc:async(name,args)=>{calls.push({name,args});return {data:{saved:true,created:calls.length===1},error:null}}});
 for(let i=0;i<2;i++){const result=await api.createAdminSupportMessage({body:'  Synthetic reply  ',conversationId:id,userId:user,requestId:id});assert.equal(result.saved,true);assert.equal(result.detail,null);assert.equal(result.followupError,true);}
 assert.equal(calls[0].name,'admin_send_support_message_atomic');assert.equal(calls[0].args.p_body,'Synthetic reply');assert.equal(calls[0].args.p_message_id,id);assert.deepEqual(calls[1].args,calls[0].args);
});
test('missing atomic RPC fails closed without any fallback direct writes',async()=>{
 const api=service({rpc:async()=>({data:null,error:{code:'PGRST202'}}),from:()=>{throw Error('Fallback writes forbidden')}});
 await assert.rejects(api.createAdminSupportMessage({body:'Synthetic reply',conversationId:id,userId:user,requestId:id}),e=>e.status===503);
});
test('send identifier conflicts remain a 409 and cannot be acknowledged as a new send',async()=>{
 const api=service({rpc:async()=>({data:null,error:{code:'23505'}})});
 await assert.rejects(api.createAdminSupportMessage({body:'Other',conversationId:id,userId:user,requestId:id}),e=>e.status===409);
});
test('committed conversation actions remain acknowledged when read fails; no retry mutation is issued',async()=>{
 const calls=[],api=service({rpc:async(name,args)=>{calls.push({name,args});return {data:{saved:true},error:null}}});
 const result=await api.updateAdminSupportConversation({action:'resolve',conversationId:id,userId:user});assert.equal(result.saved,true);assert.equal(result.readError,true);assert.equal(result.detail,null);assert.equal(calls.length,1);assert.equal(calls[0].name,'admin_update_support_conversation_atomic');
});
