'use strict';

const path=require('path');
const {execFileSync}=require('child_process');

exports.default=async context=>{
  if(context.electronPlatformName!=='win32')return;
  const root=context.packager.projectDir,exe=path.join(context.appOutDir,'TenderGuard.exe'),icon=path.join(root,'src','ui','assets','tenderguard-logo.ico'),rcedit=path.join(root,'node_modules','electron-winstaller','vendor','rcedit.exe');
  execFileSync(rcedit,[exe,'--set-icon',icon,'--set-version-string','ProductName','TenderGuard','--set-version-string','FileDescription','TenderGuard Supplier Document Review Workspace','--set-version-string','CompanyName','TenderGuard','--set-version-string','InternalName','TenderGuard','--set-version-string','OriginalFilename','TenderGuard.exe','--set-file-version','2.0.0','--set-product-version','2.0.0'],{stdio:'inherit',windowsHide:true});
};
