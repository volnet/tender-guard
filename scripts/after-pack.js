'use strict';

const path=require('path');
const {execFileSync}=require('child_process');
const {version}=require('../package.json');

exports.default=async context=>{
  if(context.electronPlatformName!=='win32')return;
  const root=context.packager.projectDir,exe=path.join(context.appOutDir,'PreSalesX.exe'),icon=path.join(root,'src','ui','assets','presalesx-logo.ico'),rcedit=path.join(root,'node_modules','electron-winstaller','vendor','rcedit.exe');
  execFileSync(rcedit,[exe,'--set-icon',icon,'--set-version-string','ProductName','PreSalesX','--set-version-string','FileDescription','PreSalesX Pre-Sales Document Review Workspace','--set-version-string','CompanyName','PreSalesX','--set-version-string','InternalName','PreSalesX','--set-version-string','OriginalFilename','PreSalesX.exe','--set-file-version',version,'--set-product-version',version],{stdio:'inherit',windowsHide:true});
};
