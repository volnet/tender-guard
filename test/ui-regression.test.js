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
  const html=read('src/ui/index.html');
  assert.match(app,/file-name-row/);
  assert.match(app,/file-info-row/);
  assert.match(html,/\.file-detail-sticky\{position:sticky;top:0/);
  assert.doesNotMatch(html,/\.file-detail-sticky\{[^}]*top:-/);
});
