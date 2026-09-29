// Headless local browser check, using the bundled browser automation runtime.
import { createRequire } from 'node:module';
import path from 'node:path';
const bundled=process.env.GNOESIS_BROWSER_MODULES;
if(!bundled)throw Error('Set GNOESIS_BROWSER_MODULES to the bundled Node package directory.');
const require=createRequire(path.join(bundled,'package.json'));
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.GNOESIS_BROWSER_EXE,headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.GNOESIS_VERIFY_URL||'http://127.0.0.1:3001'}/#/research`,{waitUntil:'networkidle',timeout:60000});
 await page.getByRole('heading',{name:'Gnoesis Agenic Research',exact:true}).waitFor();
 await page.getByRole('button',{name:'Review cost and limits',exact:true}).waitFor();
 await page.screenshot({path:'data/trading/verification/research-console.png',fullPage:true});
 const text=await page.locator('body').innerText();
 if(!text.includes('Predictive value is unvalidated')||!text.includes('Research only'))throw Error('Required research disclosure is missing.');
 const approve=page.getByRole('button',{name:'Review cost and limits',exact:true});await approve.click();
 await page.getByText('Planning estimate',{exact:false}).first().waitFor();
 const start=page.getByRole('button',{name:'Confirm and start research',exact:true});if(await start.isEnabled())throw Error('Research approval gate is missing.');
 const ticker=page.getByLabel('Stock ticker',{exact:true});await ticker.fill('MSFT');
 if(await start.count())throw Error('Estimate was not invalidated after editing the ticker.');
 if(errors.length)throw Error(`Browser errors: ${errors.join('; ')}`);
 console.log(JSON.stringify({heading:'Gnoesis Agenic Research',local_route:true,errors,estimate_gate:true,stale_estimate_invalidated:true,screenshot:path.resolve('data/trading/verification/research-console.png')},null,2));
}finally{await browser.close();}
