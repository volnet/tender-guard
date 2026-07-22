'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('fs').promises;
const os=require('os');
const path=require('path');
const ExcelJS=require('exceljs');
const {exportExcel,exportHtml}=require('../src/reports');

function project(){return {name:'TenderGuard 报告测试',createdAt:'2026-07-22T00:00:00.000Z',disclaimer:'仅供人工复核',submissions:[{id:'s1',supplier:'供应商A',zipName:'A.zip',fileCount:1,totalSize:12,files:[{name:'a.pdf',zipPath:'a.pdf',kind:'pdf',size:12,sha256:'abc',attributes:{author:'张三'},propertyGroups:[]}]}],audit:{summary:{fileCount:1,exactFileGroups:1,attributeMatchGroups:1},supplierStats:[{supplier:'供应商A',zipName:'A.zip',fileCount:1,totalSize:12,totalSizeLabel:'12 B',parseErrors:0}],exactFiles:[{id:'e1',sha256:'abc',sizeLabel:'12 B',files:[{supplier:'供应商A',path:'a.pdf',size:12}]}],attributeMatches:[{id:'m1',kind:'pdf',label:'作者',value:'张三',riskLevel:'高风险',weight:85,files:[{supplier:'供应商A',path:'a.pdf'}]}]},operationLog:[{at:'2026-07-22T01:00:00.000Z',supplier:'供应商A',file:'a.pdf',action:'saveAs',changedFields:['author'],deletedFields:['title'],destination:'a-已修改.pdf',verified:true,beforeSha256:'old',afterSha256:'new'}]};}

test('Excel operation report contains supplier, audit and operation worksheets',async()=>{const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tg-report-')),file=path.join(dir,'report.xlsx');await exportExcel(project(),file);const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);for(const name of ['审查摘要','供应商汇总','完全相同文件','属性重复审查','操作记录','全部属性'])assert.ok(workbook.getWorksheet(name),name);const repeated=workbook.getWorksheet('属性重复审查');assert.equal(repeated.getRow(2).getCell(5).value,'高风险');const operations=workbook.getWorksheet('操作记录');assert.equal(operations.rowCount,2);assert.equal(operations.getRow(2).getCell(2).value,'供应商A');assert.match(String(operations.getRow(2).getCell(6).value),/title/);await fsp.rm(dir,{recursive:true,force:true});});

test('HTML operation report includes TenderGuard branding and saved actions',async()=>{const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tg-html-')),file=path.join(dir,'report.html');await exportHtml(project(),file);const html=await fsp.readFile(file,'utf8');assert.match(html,/TenderGuard/);assert.match(html,/操作记录/);assert.match(html,/a-已修改\.pdf/);await fsp.rm(dir,{recursive:true,force:true});});
