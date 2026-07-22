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
  assert.match(html,/属性关联审查/);
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
  assert.match(app,/仅查看属性相同文件/);
  assert.match(app,/文件大小/);
  assert.match(app,/index===0\?'open'/);
  assert.match(css,/\.alert-banner\.fatal/);
  assert.doesNotMatch(html,/id="compareFiles"/);
});

test('save messages are rendered on separate lines',()=>{
  const css=read('src/ui/style.css');
  assert.match(css,/\.save-summary span\{display:block/);
});

test('visible product branding contains no legacy product names',()=>{
  const source=['README.md','package.json','src/main.js','src/cli.js','src/reports.js','src/ui/index.html','src/ui/app.js'].map(read).join('\n');
  const legacySuffix='le'+'ns',forbidden=new RegExp(['Tender'+legacySuffix,'tender-'+legacySuffix,'tender'+legacySuffix,'投标'+'慧眼'].join('|'),'i');
  assert.match(source,/TenderGuard/);
  assert.doesNotMatch(source,forbidden);
});
