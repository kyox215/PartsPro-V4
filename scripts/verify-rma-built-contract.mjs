// Executes the actual Next.js server-bundled DTO and its resolved workflow; no workflow substitution.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
require('../.next/server/app/api/admin/rma/route.js');
const runtime=require('../.next/server/webpack-runtime.js');
const modules=Object.entries(runtime.m).filter(([,fn])=>fn.toString().includes('canApproveWalletRefund'));
assert.equal(modules.length,1,'one built admin DTO module');
const built=runtime(modules[0][0]);
const base={id:'SYNTHETIC-RMA',status:'approved',quantity:1,receivedAt:null,receivedQuantity:null,
 qcStatus:'pending',inventoryDisposition:'pending',requestedResolution:'wallet_credit',negotiationStatus:'none',attachments:[],events:[]};
const caps={manage:true,inventory:true,refund:true,adjustStock:true,approveRefund:true,waiveReturn:true,qc:true};
const mapper=Object.values(built).find(fn=>{if(typeof fn!=='function')return false;try{const result=fn(base,caps);return result?.id===base.id&&Array.isArray(result.availableActions);}catch{return false;}});
assert.ok(mapper,'find real bundled mapper');
const before=mapper(base,caps);
assert.equal(before.recommendedAction,'execute_refund','Next build must use the current workflow, never the same-named legacy MJS');
assert.ok(before.availableActions.includes('waive_return'),'unreceived approved request can change to refund only');
const exempt=mapper({...base,returnWaivedAt:'2026-10-23'},caps);
assert.ok(exempt.availableActions.includes('execute_refund'));
assert.equal(exempt.availableActions.includes('mark_received'),false);
assert.equal(mapper({...base,customerShippedAt:'2026-10-23'},caps).availableActions.includes('waive_return'),false);
assert.equal(mapper(base,{...caps,approveRefund:false}).availableActions.includes('execute_refund'),false);
assert.equal(mapper({...base,status:'closed',refundCompletedAt:'2026-10-23',returnWaivedAt:'2026-10-23'},caps).availableActions.includes('execute_refund'),false);
console.log('PASS: actual Next server bundle exposes refund before receipt, no-return choice, transit/receipt/permission/terminal guards.');

// Also start the built Next server and exercise its actual HTTP auth boundary.
const {createServer}=await import('node:net');
const {spawn}=await import('node:child_process');
const probe=createServer();
await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
try {
 let ready=false;
 for(let attempt=0;attempt<40;attempt++) {
  try {const response=await fetch(`http://127.0.0.1:${port}/api/admin/rma?view=active`,{signal:AbortSignal.timeout(1500)});assert.ok([401,403].includes(response.status));const payload=await response.json();assert.equal(payload.error.code,'ADMIN_FORBIDDEN');ready=true;break;}catch(error){if(child.exitCode!==null)throw new Error(`Next startup failed (${child.exitCode})`);if(attempt===39)throw error;await new Promise(resolve=>setTimeout(resolve,250));}
 }
 assert.equal(ready,true);
 const response=await fetch(`http://127.0.0.1:${port}/api/admin/rma/11111111-1111-4111-8111-111111111111/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',returnMode:'refund_only',waiverReasonCode:'no_recovery_value',idempotencyKey:'anonymous-cannot-approve'})});
 assert.ok([401,403].includes(response.status),'real built approval endpoint preserves auth before parsing or writing');
 const denied=await response.json();assert.equal(denied.error.code,'ADMIN_FORBIDDEN');
 console.log('PASS: real Next HTTP list and approval routes reject anonymous requests (no business writes).');
} finally {child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
