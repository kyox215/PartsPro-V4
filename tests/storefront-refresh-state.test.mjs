import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStorefrontRefresh, quoteIsCurrent, refreshVisibleCatalog } from '../src/lib/storefront-refresh.mjs';

function clock() {
 let time=0, serial=0; const timers=new Map(), runs=[];
 const schedule=(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:time+delay});return id;};
 const coordinator=createStorefrontRefresh({run:v=>runs.push(v),now:()=>time,schedule,cancel:id=>timers.delete(id)});
 function advance(ms) {const end=time+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}
 return {coordinator,advance,runs,timers};
}
test('rapid focus/visible/token events skip a fresh account, then coalesce into one 300ms request',()=>{
 const h=clock();h.coordinator.request();h.advance(29_999);assert.deepEqual(h.runs,[]);
 h.advance(1);for(let i=0;i<20;i++)h.coordinator.request('focus');h.advance(299);assert.deepEqual(h.runs,[]);h.advance(1);assert.deepEqual(h.runs,[1]);
 for(let i=0;i<20;i++)h.coordinator.request('focus');assert.deepEqual(h.runs,[1]);h.coordinator.complete(1);h.advance(10_000);h.coordinator.request();assert.deepEqual(h.runs,[1]);
});
test('expiry invalidates prices immediately and bypasses freshness debounce',()=>{
 const h=clock();h.coordinator.request('expiry');assert.deepEqual(h.runs,[1]);assert.equal(h.coordinator.getSnapshot().pricesInvalid,true);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().pricesInvalid,false);
});
test('identity change supersedes an in-flight account and rejects its old completion',()=>{
 const h=clock();h.coordinator.request('pricing');h.coordinator.request('identity');assert.deepEqual(h.runs,[1,2]);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().refreshing,true);assert.equal(h.coordinator.getSnapshot().pricesInvalid,true);h.coordinator.complete(2);assert.equal(h.coordinator.getSnapshot().completedVersion,2);
});
test('15s failure stops pending and does not retry on further focus; explicit retry is bounded',()=>{
 const h=clock();h.coordinator.request('pricing');h.advance(15_000);assert.equal(h.coordinator.getSnapshot().error,'refresh_failed');assert.equal(h.coordinator.getSnapshot().refreshing,false);
 h.advance(60_000);h.coordinator.request();h.advance(10_000);assert.deepEqual(h.runs,[1]);h.coordinator.request('retry');assert.deepEqual(h.runs,[1,2]);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().refreshing,true);h.coordinator.complete(2);assert.equal(h.coordinator.getSnapshot().error,null);
});
test('unmount cancels pending work; effect reactivation supports StrictMode without old timers',()=>{
 const h=clock();h.advance(30_000);h.coordinator.request();h.coordinator.dispose();h.advance(60_000);assert.deepEqual(h.runs,[]);assert.equal(h.timers.size,0);h.coordinator.activate();h.coordinator.request('retry');assert.deepEqual(h.runs,[1]);h.coordinator.dispose();h.advance(60_000);assert.equal(h.timers.size,0);
});
test('expiry boundary is inclusive and does not turn a server price-unavailable response into infinite loading',()=>{
 const until=new Date(1000).toISOString();assert.equal(quoteIsCurrent({priceValidUntil:until},999),true);assert.equal(quoteIsCurrent({priceValidUntil:until},1000),false);assert.equal(quoteIsCurrent({quoteStatus:'unavailable'}),true);assert.equal(quoteIsCurrent({quoteStatus:'hidden'}),true);
});
test('refresh preserves loaded count and order, batches max50 and max2 simultaneous requests',async()=>{
 let running=0,max=0;const calls=[];
 const result=await refreshVisibleCatalog(123,async(offset,limit)=>{calls.push([offset,limit]);running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,2));running--;return{products:Array.from({length:limit},(_,i)=>offset+i),total:839};},new AbortController().signal);
 assert.deepEqual(calls,[[0,50],[50,50],[100,23]]);assert.equal(max,2);assert.equal(result.products.length,123);assert.deepEqual(result.products,Array.from({length:123},(_,i)=>i));assert.equal(result.total,839);
});
test('late page results are rejected after a new filter or identity aborts the old request',async()=>{
 const controller=new AbortController();let done;const result=refreshVisibleCatalog(24,async()=>{await new Promise(r=>done=r);return{products:['old'],total:1};},controller.signal);controller.abort();done();await assert.rejects(result,{name:'AbortError'});
});
test('auth callback and page mismatch coalesce the same identity while another identity supersedes it',()=>{
 const h=clock();h.coordinator.request('identity:"user-b"');h.coordinator.request('identity:"user-b"');assert.deepEqual(h.runs,[1]);h.coordinator.request('identity:"user-c"');assert.deepEqual(h.runs,[1,2]);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().refreshing,true);h.coordinator.complete(2);h.coordinator.request('identity:"user-c"');assert.deepEqual(h.runs,[1,2]);
});
test('an invalidation arriving after the in-flight snapshot keeps quotes locked until the queued generation completes',()=>{
 const h=clock();h.coordinator.request('pricing');h.coordinator.request('expiry');h.coordinator.request('pricing');assert.deepEqual(h.runs,[1]);h.coordinator.complete(1);assert.deepEqual(h.runs,[1,2]);assert.equal(h.coordinator.getSnapshot().completedVersion,0);assert.equal(h.coordinator.getSnapshot().pricesInvalid,true);assert.equal(h.coordinator.getSnapshot().refreshing,true);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().pricesInvalid,true);h.coordinator.complete(2);assert.equal(h.coordinator.getSnapshot().pricesInvalid,false);
});
test('queued invalidations do not create an automatic retry loop after the deadline',()=>{
 const h=clock();h.coordinator.request('pricing');h.coordinator.request('expiry');h.advance(15_000);h.advance(60_000);assert.deepEqual(h.runs,[1]);assert.equal(h.coordinator.getSnapshot().error,'refresh_failed');h.coordinator.request('retry');h.coordinator.complete(2);assert.deepEqual(h.runs,[1,2]);
});

test('a timed-out generation cannot clear failure or unlock prices when its response arrives late',()=>{
 const h=clock();h.coordinator.request('pricing');h.coordinator.request('expiry');h.advance(15_000);h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().pricesInvalid,true);assert.equal(h.coordinator.getSnapshot().error,'refresh_failed');assert.equal(h.coordinator.getSnapshot().completedVersion,0);h.coordinator.request('retry');h.coordinator.complete(1);assert.equal(h.coordinator.getSnapshot().refreshing,true);h.coordinator.complete(2);assert.equal(h.coordinator.getSnapshot().error,null);
});

test('one failed catalog page stops the queue before another worker starts later batches',async()=>{
 const calls=[];let finishOther;
 const result=refreshVisibleCatalog(200,async(offset)=>{calls.push(offset);if(offset===0)throw new Error('offline');await new Promise(r=>finishOther=r);return{products:[],total:200};},new AbortController().signal);
 await assert.rejects(result,/offline/);finishOther();await new Promise(r=>setImmediate(r));assert.deepEqual(calls,[0,50]);
});
