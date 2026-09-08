// Prospective evaluation only. The manifest is created once for an approved release.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'docs/model-validation/frozen-models-2026-09-08.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw Error(`Missing model function ${name}`);
  let end = source.indexOf('{', start), depth = 0;
  do { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; } while (depth && end < source.length);
  if (depth) throw Error(`Unclosed model function ${name}`);
  return source.slice(start, end);
}
const btc = fs.readFileSync(path.join(ROOT, 'risk-metric.html'), 'utf8');
const spy = fs.readFileSync(path.join(ROOT, 'spy-risk-metric.html'), 'utf8');
const btcCode = btc.match(/const GENESIS =[^]*?const STRUCTURAL_RISK_FLOOR = [^;]+;/)[0] + '\n' +
  ['buildDataset','normCdf','structuralRiskForResidual'].map(n => extract(btc,n)).join('\n');
const spyCode = ['upperBound','assignTrailingPercentiles','buildDataset'].map(n => extract(spy,n)).join('\n');
const codeHashes = { btc: hash(btcCode), spy: hash(spyCode) };
const raw = Object.fromEntries(['btc','spy'].map(symbol => [symbol, fs.readFileSync(path.join(ROOT, symbol === 'btc' ? 'data.csv' : 'data_spy.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(r => { const [d,p,tr] = r.split(','); return [d,+p,tr ? +tr : null]; })]));
const freezeDate = '2026-09-08';
function validateRows(rows, symbol) {
  rows.forEach((r,i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r[0]) || !Number.isFinite(Date.parse(r[0])) || new Date(r[0]).toISOString().slice(0,10) !== r[0] || (i && r[0] <= rows[i-1][0])) throw Error(`${symbol}: invalid or unordered date`);
    if (!Number.isFinite(r[1]) || r[1] < 0 || (symbol === 'spy' && (!Number.isFinite(r[2]) || r[2] <= 0 || r[1] <= 0))) throw Error(`${symbol}: invalid price/return input`);
  });
}
Object.entries(raw).forEach(([symbol,rows]) => validateRows(rows,symbol));
const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : null;
const baselineEndDates = existing ? existing.baselineEndDates : Object.fromEntries(Object.entries(raw).map(([k,rows]) => [k,rows.filter(r=>r[0]<=freezeDate).at(-1)[0]]));
const baselineHashes = Object.fromEntries(Object.entries(raw).map(([k,rows]) => [k,hash(JSON.stringify(rows.filter(r=>r[0]<=baselineEndDates[k])))]));
if (process.argv.includes('--freeze')) {
  if (fs.existsSync(manifestPath)) throw Error('Freeze exists. Do not overwrite a prospective evaluation baseline.');
  fs.writeFileSync(manifestPath, JSON.stringify({freezeDate, codeHashes, baselineEndDates, baselineHashes,
    protocol: {monthlyContribution:1000, riskThreshold:0.5, weights:[4,3,2,1], purchaseCostBps:5, cashInterest:0, minimumCalendarDays:1095,
      execution:'First available date of each new month after freeze; prior observation signal; purchases capped by contributed cash.',
      benchmark:'Same contributions and costs; invest immediately; BTC price returns, SPY dividend-reinvested return index.',
      exclusions:'No leverage, sales, taxes or annualized-return claim. EMA remains a descriptive screen, not an investment portfolio.'}},null,2)+'\n');
}
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
for (const model of ['btc','spy']) {
  if (codeHashes[model] !== manifest.codeHashes[model]) throw Error(`${model}: model changed after freeze; review/version before evaluation`);
  if (baselineHashes[model] !== manifest.baselineHashes[model]) throw Error(`${model}: pre-freeze history changed; reconcile source revisions before evaluation`);
}
const btcModel = new Function(btcCode+';return buildDataset;')();
const spyModel = new Function(spyCode+';return buildDataset;')();
const points = {btc:btcModel(raw.btc).pts,spy:spyModel(raw.spy,{}).pts};
function evaluate(points,symbol) {
  const p = manifest.protocol;
  let cash=0,units=0,benchmarkUnits=0,funded=0,costs=0,benchmarkCosts=0,periods=0,priorMonth='';
  let lastValue=null,firstDate=null,lastDate=null,observations=0,maxGapDays=0;
  for(let i=1;i<points.length;i++) {
    const current=points[i],previous=points[i-1];
    if(current.date<=manifest.freezeDate || previous.modelWarmup) continue;
    const value=symbol==='btc'?current.price:current.totalReturnIndex;
    if(!Number.isFinite(value)||!(value>0)) throw Error(`Invalid ${symbol} return input`);
    observations++;
    maxGapDays=Math.max(maxGapDays,(Date.parse(current.date)-Date.parse(previous.date))/864e5);
    if(!firstDate) firstDate=current.date;
    lastDate=current.date;lastValue=value;
    const month=current.date.slice(0,7);
    // The first partial post-freeze month is deliberately excluded.
    if(month===manifest.freezeDate.slice(0,7) || month===priorMonth) continue;
    priorMonth=month;periods++;funded+=p.monthlyContribution;cash+=p.monthlyContribution;
    const fee=p.monthlyContribution*p.purchaseCostBps/10000;
    benchmarkUnits+=(p.monthlyContribution-fee)/value;benchmarkCosts+=fee;
    const risk=previous.riskCombo;
    if(!Number.isFinite(risk)||risk>=p.riskThreshold) continue;
    const band=Math.min(3,Math.max(0,Math.floor(risk/(p.riskThreshold/4))));
    const spend=Math.min(cash,p.monthlyContribution*p.weights[band]);
    const cost=spend*p.purchaseCostBps/10000;
    cash-=spend;costs+=cost;units+=(spend-cost)/value;
  }
  const days=lastDate?Math.floor((Date.parse(lastDate)-Date.parse(manifest.freezeDate))/864e5):0;
  const monthNumber = d => Number(d.slice(0,4))*12+Number(d.slice(5,7));
  const expectedMonths=lastDate?Math.max(0,monthNumber(lastDate)-monthNumber(manifest.freezeDate)):0;
  const complete=days>=p.minimumCalendarDays && periods>=36 && periods===expectedMonths && observations>=(symbol==='btc'?990:660) && maxGapDays<=(symbol==='btc'?2:7);
  return {status:!complete?'pending: insufficient or incomplete post-freeze history':'prospective descriptive comparison; review uncertainty before claims',
    observations,expectedContributionMonths:expectedMonths,maxObservationGapDays:maxGapDays,
    firstDate,lastDate,calendarDaysAfterFreeze:days,contributionPeriods:periods,contributed:funded,
    strategyValue:lastValue?units*lastValue+cash:null,benchmarkValue:lastValue?benchmarkUnits*lastValue:null,cash,purchaseCosts:costs,benchmarkPurchaseCosts:benchmarkCosts};
}
console.log(JSON.stringify({freezeDate:manifest.freezeDate,protocol:manifest.protocol,btc:evaluate(points.btc,'btc'),spy:evaluate(points.spy,'spy'),ema:'Not assessed: a point-in-time total-return portfolio and frozen constituent rules are required.'},null,2));
