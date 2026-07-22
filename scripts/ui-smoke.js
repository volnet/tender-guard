'use strict';

const path=require('path');
const fs=require('fs');
const fsp=fs.promises;
const {spawn}=require('child_process');
const electron=path.join(__dirname,'..','node_modules','electron','dist','electron.exe');
const resultFile=path.join(__dirname,'..','tmp','tenderguard-ui-smoke.json');
const screenshot=path.join(__dirname,'..','tmp','tenderguard-ui-smoke.png');
const userData=path.join(__dirname,'..','tmp','electron-smoke-profile');
const zips=[process.env.TENDERGUARD_TEST_ZIP_A,process.env.TENDERGUARD_TEST_ZIP_B].filter(Boolean);

(async()=>{
  if(zips.length!==2)throw new Error('Set TENDERGUARD_TEST_ZIP_A and TENDERGUARD_TEST_ZIP_B for the supplier smoke test');
  await fsp.mkdir(path.dirname(resultFile),{recursive:true});
  await Promise.all([fsp.rm(resultFile,{force:true}),fsp.rm(screenshot,{force:true})]);
  const child=spawn(electron,['.'],{cwd:path.join(__dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TENDERGUARD_SMOKE:'1',TENDERGUARD_SMOKE_ZIPS:JSON.stringify(zips),TENDERGUARD_SMOKE_RESULT:resultFile,TENDERGUARD_SMOKE_SCREENSHOT:screenshot,TENDERGUARD_SMOKE_USER_DATA:userData}});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const exitCode=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Electron UI smoke timed out'));},120000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);resolve(code);});});
  if(!fs.existsSync(resultFile))throw new Error(`Electron smoke produced no result (exit ${exitCode}): ${stderr}`);
  const payload=JSON.parse(await fsp.readFile(resultFile,'utf8'));if(payload.error)throw new Error(payload.stack||payload.error);
  const result=payload.result;
  if(result.overview.brand!=='TenderGuard'||result.overview.suppliers.length!==2||result.overview.cards!==10||result.overview.initialOpen!==2||result.expanded!==10||result.overview.numbered!==10||result.overview.metadata!==10||!result.overview.fullPaths.every(Boolean)||result.attributeGroups<1||!result.drawer.open||!result.drawer.hasEditor||result.drawer.sections<1||!result.separateEditor||result.legacyText)throw new Error(`UI smoke assertions failed: ${JSON.stringify(result)}`);
  console.log(JSON.stringify({...result,screenshot},null,2));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
