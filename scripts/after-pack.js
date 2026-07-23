'use strict';

const path=require('path');
const {execFileSync}=require('child_process');
const {version}=require('../package.json');

exports.default=async context=>{
  if(context.electronPlatformName!=='win32')return;
  const root=context.packager.projectDir,exe=path.join(context.appOutDir,'PreSalesGuard.exe'),icon=path.join(root,'src','ui','assets','presalesguard-logo.ico'),rcedit=path.join(root,'node_modules','electron-winstaller','vendor','rcedit.exe');
  execFileSync(rcedit,[exe,'--set-icon',icon,'--set-version-string','ProductName','PreSalesGuard','--set-version-string','FileDescription','PreSalesGuard Pre-Sales Document Review Workspace','--set-version-string','CompanyName','PreSalesGuard','--set-version-string','InternalName','PreSalesGuard','--set-version-string','OriginalFilename','PreSalesGuard.exe','--set-file-version',version,'--set-product-version',version],{stdio:'inherit',windowsHide:true});
};
