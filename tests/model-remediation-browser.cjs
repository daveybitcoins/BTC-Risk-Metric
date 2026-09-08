const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),express=require('express');
const {chromium}=require('@playwright/test');
(async()=>{
 const app=express();app.use(express.static(path.resolve('next-site/out')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/spy-risk-metric/');await page.waitForFunction(()=>document.querySelector('#dcaRiskThreshold').options.length>0);
  await page.locator('#dcaStrategyToggle [data-val="fixed"]').click();await page.locator('#dcaRunBtn').click();
  const values=await page.locator('#dcaStats .card-value').allTextContents();assert.equal(values[2],values[3],'fixed allocation equals matched benchmark');
  assert.ok(!(await page.locator('#dcaStats').innerText()).includes('units'));
  await page.locator('#dcaStrategyToggle [data-val="linear"]').click();
  await page.locator('#dcaStart').fill('2026-08-01');await page.locator('#dcaEnd').fill('2026-09-04');await page.locator('#dcaRiskThreshold').selectOption('0.1');await page.locator('#dcaRunBtn').click();
  const skipped=await page.locator('#dcaStats .card-value').allTextContents();assert.equal(skipped[0],skipped[2],'all-skipped value remains contributed cash');assert.equal(skipped[1],skipped[0],'cash retained equals contribution');
  assert.match(await page.locator('#dcaBuyNote').innerText(),/Buying 0 of/);
  assert.doesNotMatch(await page.locator('#dcaStats').innerText(),/NaN|Infinity/);
  const before=await page.locator('#dcaStats').innerText();await page.getByRole('button',{name:'Toggle color theme'}).click();assert.equal(await page.locator('#dcaStats').innerText(),before);
  const dir='audits/model-validation-2026-09-08/remediation-screenshots';fs.mkdirSync(dir,{recursive:true});await page.locator('#dcaStats').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'spy-dca-cash.png')});
  await page.goto(base+'/dividend-tracker/');await page.evaluate(()=>localStorage.setItem('dividend_portfolios',JSON.stringify([{name:'Validation',holdings:[{ticker:'ABNY',shares:100,costBasis:null},{ticker:'QQQI',shares:100,costBasis:50}]}])));await page.reload();await page.locator('#holdings-table').waitFor();
  assert.equal(await page.locator('#annual-income').innerText(),'$782.16');assert.match(await page.locator('#dividend-coverage').innerText(),/prices 1\/2/);assert.match(await page.locator('#holdings-table').innerText(),/Liquidated; no recurring/);await page.screenshot({path:path.join(dir,'dividend-coverage.png')});
  assert.deepEqual(errors,[]);console.log('Model browser checks passed: matched DCA, cash retention, saved theme state, and inactive dividend coverage.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
