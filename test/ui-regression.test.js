'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('saving metadata keeps the active property editor mounted and editable',()=>{
  const source=read('src/ui/app.js');
  const saveBranch=source.slice(source.indexOf("if(action==='save')"),source.indexOf("}catch(e){showSaveStatus"));
  assert.match(source,/data-original=/);
  assert.match(saveBranch,/input\.dataset\.original=input\.value/);
  assert.match(source,/input\.disabled=false/);
  assert.match(saveBranch,/resume\.focus/);
  assert.doesNotMatch(saveBranch,/renderFileDetail\s*\(/);
  assert.doesNotMatch(saveBranch,/alert\s*\(/);
});

test('file detail header uses two explicit rows without a negative sticky offset',()=>{
  const app=read('src/ui/app.js');
  const css=read('src/ui/style.css');
  assert.match(app,/file-name-row/);
  assert.match(app,/file-info-row/);
  assert.match(css,/\.file-detail-sticky\{position:sticky;top:0/);
  assert.match(app,/data-expand-sections/);
  assert.match(app,/data-collapse-sections/);
  assert.match(app,/property-section" open/);
  assert.match(read('src/ui/pro.css'),/\.file-name-row \{[^}]*white-space: normal/);
  assert.doesNotMatch(css,/\.file-detail-sticky\{[^}]*top:-/);
});

test('batch review and property editor are separate workspaces',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/style.css');
  assert.match(html,/id="compareWorkspace"/);
  assert.match(html,/id="editorWorkspace"/);
  assert.match(html,/文件审查/);
  assert.doesNotMatch(html,/供应商概览|文件级审查/);
  assert.match(html,/属性重复审查/);
  assert.match(html,/操作记录/);
  assert.match(app,/--supplier-count:\$\{Math\.max\(1,data\.supplierStats\.length\)\}/);
  assert.match(css,/repeat\(var\(--supplier-count\),minmax\(245px,1fr\)\)/);
});

test('property editor has a draggable file pane and compact add control',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(html,/id="editorSplitter"/);
  assert.match(html,/id="addEditorFilesInline"/);
  assert.match(app,/onpointerdown/);
  assert.match(app,/setExplorerWidth/);
  assert.match(css,/--explorer-width/);
});

test('supplier review uses numbered expandable metadata cards and inline filters',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(app,/supplier-file-card/);
  assert.match(app,/file-sequence/);
  assert.match(app,/查看更多与编辑/);
  assert.match(app,/仅查看相同文件/);
  assert.match(app,/仅查看属性重复文件/);
  assert.match(app,/文件大小/);
  assert.match(app,/&lt;空&gt;/);
  assert.match(app,/fileIssues/);
  assert.match(app,/issue-tag/);
  assert.match(app,/>\+<\/button>/);
  assert.match(app,/>−<\/button>/);
  assert.match(app,/index===0\?'open'/);
  assert.match(css,/\.alert-banner\.fatal/);
  assert.doesNotMatch(html,/id="compareFiles"/);
});

test('attribute repetition review uses one full-path evidence row per file',()=>{
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(app,/跨供应商属性重复/);
  assert.match(app,/duplicate-file-row/);
  assert.match(app,/group\.riskLevel/);
  assert.match(app,/pathMarkup\(ref\.path\)/);
  assert.match(css,/\.duplicate-file-row \{[^}]*grid-template-columns/);
  assert.match(css,/\.path-directory/);
});

test('save messages are rendered on separate lines',()=>{
  const css=read('src/ui/style.css');
  assert.match(css,/\.save-summary span\{display:block/);
});

test('visible product branding uses PreSalesX consistently',()=>{
  const source=['README.md','package.json','package-lock.json','src/main.js','src/cli.js','src/reports.js','src/ui/index.html','src/ui/app.js','scripts/after-pack.js','scripts/ui-smoke.js','.github/workflows/release.yml'].map(read).join('\n');
  const forbidden=new RegExp([
    Buffer.from('54656e6465724775617264','hex').toString(),
    Buffer.from('74656e6465722d6775617264','hex').toString(),
    Buffer.from('74656e6465726775617264','hex').toString(),
    Buffer.from('50726553616c65734775617264','hex').toString(),
    Buffer.from('70726573616c65732d6775617264','hex').toString(),
    Buffer.from('70726573616c65736775617264','hex').toString()
  ].join('|'),'i');
  assert.match(source,/PreSalesX/);
  assert.doesNotMatch(source,forbidden);
});

test('application and release artifacts use version 1.2.0 consistently',()=>{
  const manifest=JSON.parse(read('package.json'));
  const html=read('src/ui/index.html');
  const analyzer=read('src/analyzer.js');
  const workflow=read('.github/workflows/release.yml');
  assert.equal(manifest.version,'1.2.0');
  assert.match(html,/PreSalesX 1\.2\.0/);
  assert.match(analyzer,/appVersion:APP_VERSION/);
  assert.match(manifest.scripts['dist:win'],/--win zip --x64/);
  assert.match(manifest.scripts['dist:mac'],/--mac zip --universal/);
  assert.match(manifest.scripts['dist:win'],/--publish never/);
  assert.match(manifest.scripts['dist:mac'],/--publish never/);
  assert.match(workflow,/PreSalesX-\*-Windows-\*\.zip/);
  assert.match(workflow,/PreSalesX-\*-macOS-\*\.zip/);
  assert.match(workflow,/gh release create/);
});
