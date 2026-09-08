const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/evaluate-model-holdout.cjs','utf8');
function extract(name){const start=source.indexOf(`function ${name}(`);let end=source.indexOf('{',start),depth=0;do{if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}while(depth);return source.slice(start,end);}
const manifest=JSON.parse(fs.readFileSync('docs/model-validation/frozen-models-2026-09-08.json','utf8'));
const ctx=vm.createContext({manifest});vm.runInContext(extract('evaluate')+'\n'+extract('validateRows'),ctx);
const point=(date,risk=0.1,value=100)=>({date,riskCombo:risk,price:value,totalReturnIndex:value});
test('three years of endpoints without observations never qualifies as a complete holdout',()=>{
 const r=ctx.evaluate([point('2026-09-08'),point('2029-09-08')],'spy');
 assert.match(r.status,/pending/);assert.equal(r.contributionPeriods,1);assert.equal(r.maxObservationGapDays,1096);
});
test('holdout retains skipped cash and applies equal purchase costs to matched funding',()=>{
 const r=ctx.evaluate([point('2026-09-08',0.9),point('2026-10-01',0.1),point('2026-11-01',0.1)],'spy');
 assert.equal(r.contributed,2000);assert.equal(r.cash,0);assert.ok(Math.abs(r.strategyValue-1999)<1e-9);assert.ok(Math.abs(r.benchmarkValue-1999)<1e-9);assert.equal(r.purchaseCosts,1);
});
test('nonfinite prices and invalid or duplicate future dates are rejected',()=>{
 assert.throws(()=>ctx.validateRows([['2026-09-09',Infinity,100]],'spy'),/invalid price/);
 assert.throws(()=>ctx.validateRows([['2026-02-30',100,100]],'spy'),/invalid or unordered/);
 assert.throws(()=>ctx.validateRows([['2026-09-09',100,100],['2026-09-09',100,100]],'spy'),/invalid or unordered/);
 assert.throws(()=>ctx.evaluate([point('2026-09-08'),point('2026-10-01',0.1,Infinity)],'spy'),/Invalid spy/);
});
