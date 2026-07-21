'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { XMLParser } = require('fast-xml-parser');

const LIMITS = Object.freeze({ entries: 20000, total: 2 * 1024 ** 3, single: 512 * 1024 ** 2, ratio: 200, depth: 3 });
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];
const text = x => x == null ? '' : typeof x === 'object' ? (x['#text'] || '') : String(x);
const normalize = v => String(v || '').normalize('NFKC').trim().replace(/\\/g, '/').replace(/\s+/g, ' ').toLowerCase();

function classify(name, b) {
  const ext = path.extname(name).toLowerCase();
  const h = b.subarray(0, 16).toString('hex');
  if (h.startsWith('504b0304')) return ['zip', ext === '.docx' || ext === '.docm' ? 'word' : ext === '.xlsx' || ext === '.xlsm' ? 'excel' : ext === '.pptx' || ext === '.pptm' ? 'powerpoint' : 'zip'];
  if (b.subarray(0, 5).toString() === '%PDF-') return ['pdf', 'pdf'];
  if (h.startsWith('ffd8ff')) return ['image/jpeg', 'image'];
  if (h.startsWith('89504e470d0a1a0a')) return ['image/png', 'image'];
  if (h.startsWith('49492a00') || h.startsWith('4d4d002a')) return ['image/tiff', 'image'];
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return ['image/webp', 'image'];
  if (h.startsWith('d0cf11e0a1b11ae1')) return ['application/x-ole-storage', ['.doc'].includes(ext) ? 'word-legacy' : ['.xls'].includes(ext) ? 'excel-legacy' : ['.ppt'].includes(ext) ? 'powerpoint-legacy' : 'ole'];
  if (['.txt','.csv','.xml','.json','.html','.htm'].includes(ext)) return ['text/plain', 'text'];
  return ['application/octet-stream', 'other'];
}

async function openZip(file) {
  // Buffer-backed ZIPs keep parsing deterministic across Electron/Node builds;
  // the outer archive limit prevents unbounded memory use.
  const b=await fsp.readFile(file);
  if(b.length>LIMITS.total) throw new Error('ZIP 文件超过安全限制');
  return new Promise((resolve,reject)=>yauzl.fromBuffer(b,{lazyEntries:true,autoClose:false,decodeStrings:true,validateEntrySizes:true},(e,z)=>e?reject(e):resolve(z)));
}
function readEntry(z, e, cap = LIMITS.single) {
  return new Promise((resolve, reject) => z.openReadStream(e, (err,s) => {
    if (err) return reject(err); const chunks=[]; let n=0;
    s.on('data', c => { n += c.length; if (n > cap) s.destroy(new Error('单文件超过安全限制')); else chunks.push(c); });
    s.on('error', reject); s.on('end', () => resolve(Buffer.concat(chunks)));
  }));
}
async function listZip(file, limits = LIMITS) {
  const z = await openZip(file); const out=[]; let total=0, count=0;
  return new Promise((resolve,reject) => {
    const fail=e=>{ try{z.close();}catch{} reject(e); };
    z.on('entry', e => {
      const n=e.fileName.replace(/\\/g,'/');
      if (n.startsWith('/') || /^[A-Za-z]:/.test(n) || n.split('/').includes('..')) return fail(new Error(`路径穿越: ${n}`));
      if (++count > limits.entries) return fail(new Error('ZIP 条目过多'));
      total += e.uncompressedSize;
      if (e.uncompressedSize > limits.single || total > limits.total || (e.compressedSize && e.uncompressedSize/e.compressedSize > limits.ratio)) return fail(new Error(`ZIP 资源限制: ${n}`));
      const symlink = ((e.externalFileAttributes >>> 16) & 0o170000) === 0o120000;
      if (symlink) return fail(new Error(`禁止符号链接: ${n}`));
      out.push(e); z.readEntry();
    });
    z.on('error', fail); z.on('end',()=>{ z.close(); resolve({entries:out,total}); }); z.readEntry();
  });
}
async function zipBuffers(file, wanted) {
  const z=await openZip(file), out=new Map();
  return new Promise((resolve,reject)=>{ z.on('entry',async e=>{ try { if(wanted(e.fileName)) out.set(e.fileName,await readEntry(z,e,32*1024**2)); z.readEntry(); } catch(x){reject(x);} }); z.on('error',reject); z.on('end',()=>{z.close();resolve(out);}); z.readEntry(); });
}
function coreProps(xml) {
  if (!xml) return {}; let o; try{o=parser.parse(xml.toString('utf8'));}catch{return {};}
  const c=o['cp:coreProperties']||{}, a=o.Properties||{};
  return { author:text(c['dc:creator']||a.Company), lastEditor:text(c['cp:lastModifiedBy']||a.Manager), title:text(c['dc:title']), subject:text(c['dc:subject']), keywords:text(c['cp:keywords']), description:text(c['dc:description']), created:text((c['dcterms:created']||{})['#text']||c['dcterms:created']), modified:text((c['dcterms:modified']||{})['#text']||c['dcterms:modified']), lastPrinted:text(c['cp:lastPrinted']), company:text(a.Company), manager:text(a.Manager), application:text(a.Application), appVersion:text(a.AppVersion), version:text(c['cp:version']||a.AppVersion), template:text(a.Template), totalEditingTime:text(c['cp:totalTime']), revision:text(c['cp:revision'])};
}
async function officeExtract(buffer, kind) {
  const tmp=path.join(require('os').tmpdir(),`tl-${crypto.randomUUID()}.zip`); await fsp.writeFile(tmp,buffer);
  try {
    const names = await listZip(tmp); const wanted=n => /^(docProps\/(core|app|custom)\.xml|word\/(document|comments|settings)\.xml|word\/_rels\/document\.xml\.rels|xl\/(workbook|styles|comments\d*)\.xml|xl\/worksheets\/sheet\d+\.xml|xl\/_rels\/workbook\.xml\.rels|ppt\/presentation\.xml|ppt\/slides\/slide\d+\.xml|.*\/media\/.*)$/i.test(n);
    const m=await zipBuffers(tmp,wanted); const props={...coreProps(m.get('docProps/core.xml')),...coreProps(m.get('docProps/app.xml'))};
    const custom=m.get('docProps/custom.xml'); if(custom&&/<property\b/i.test(custom.toString('utf8'))) props.customProperties=sha(custom);
    const all=[...m.entries()]; props.internalStructureHash=sha(Buffer.from(names.entries.map(e=>e.fileName).join('\n')));
    props.mediaHashes=all.filter(([n])=>/\/media\//.test(n)).map(([,b])=>sha(b));
    const xmlText=all.filter(([n])=>/\.(xml|rels)$/.test(n)).map(([,b])=>b.toString('utf8')).join('\n');
    props.localPaths=Array.from(new Set(xmlText.match(/(?:[A-Za-z]:\\|file:\/\/\/)[^<"']+/g)||[])).slice(0,50);
    props.externalLinks=Array.from(new Set(xmlText.match(/https?:\/\/[^<"']+/g)||[])).slice(0,50);
    props.documentIds=Array.from(new Set(xmlText.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig)||[])).slice(0,20);
    props.hasMacros=names.entries.some(e=>/vbaProject\.bin$/i.test(e.fileName));
    if(kind==='excel') {
      const wb=m.get('xl/workbook.xml'); if(wb){const w=parser.parse(wb.toString()).workbook||{}; props.sheets=arr(w.sheets?.sheet).map(s=>({name:s['@_name'],state:s['@_state']||'visible'}));}
    }
    const body=xmlText.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); props.textSample=body.slice(0,200000); props.textFingerprint=simhash(body); return props;
  } finally { await fsp.rm(tmp,{force:true}); }
}
function pdfExtract(b) { const s=b.toString('latin1'); const pick=k=>{const m=s.match(new RegExp('/'+k+'\\s*\\(([^)]{0,500})\\)'));return m?.[1]||''}; return {author:pick('Author'),creator:pick('Creator'),producer:pick('Producer'),title:pick('Title'),created:pick('CreationDate'),modified:pick('ModDate'),documentIds:(s.match(/<([0-9A-F]{16,64})>/ig)||[]).map(x=>x.slice(1,-1)).slice(0,10),pdfVersion:(s.match(/^%PDF-([^\r\n]+)/)||[])[1]||'',hasJavaScript:/\/JavaScript|\/JS\b/.test(s),hasSignature:/\/Type\s*\/Sig\b/.test(s),encrypted:/\/Encrypt\b/.test(s),pageCount:(s.match(/\/Type\s*\/Page\b/g)||[]).length,textFingerprint:simhash(s.replace(/[^\x20-\x7e\u4e00-\u9fff]+/g,' '))}; }
function propertyGroups(f) {
  const a=f.attributes||{}; const useful=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==''&&v!=null&&(!Array.isArray(v)||v.length)));
  const office=['word','excel','powerpoint'].includes(f.kind), missing=v=>v===''||v==null?'未提取到':v;
  return [
    {id:'common',title:'常见文件属性',open:true,items:{文件名:f.name,'ZIP 内路径':f.zipPath,文件类型:f.kind,MIME:f.mime,扩展名:f.extension,文件大小:f.size,'SHA-256':f.sha256,...(office?{作者:missing(a.author),'最后一次保存者':missing(a.lastEditor),修订号:missing(a.revision),版本号:missing(a.version||a.appVersion),程序名称:missing(a.application),公司:missing(a.company),管理者:missing(a.manager),'创建内容的时间':missing(a.created),'最后一次保存的日期':missing(a.modified)}:useful({作者:a.author,'最后一次保存者':a.lastEditor,'创建内容的时间':a.created,'最后一次保存的日期':a.modified,程序名称:a.application,版本号:a.version||a.appVersion,公司:a.company,管理者:a.manager}))}},
    {id:'document',title:f.kind==='pdf'?'PDF 文档属性':f.kind==='excel'?'Excel 专有属性':f.kind==='word'?'Word 专有属性':f.kind==='powerpoint'?'PowerPoint 专有属性':'文档专有属性',open:true,items:useful({标题:a.title,主题:a.subject,关键词:a.keywords,说明:a.description,模板:a.template,总编辑时间:a.totalEditingTime,'PDF 版本':a.pdfVersion,页数:a.pageCount,文档ID:a.documentIds,工作表:a.sheets})},
    {id:'fingerprint',title:'内容指纹与相似度',items:useful({'SimHash':a.textFingerprint,媒体文件哈希:a.mediaHashes,内部结构哈希:a.internalStructureHash,自定义属性哈希:a.customProperties})},
    {id:'paths',title:'链接、路径与嵌入内容',items:useful({本地路径:a.localPaths,外部链接:a.externalLinks,包含宏:a.hasMacros,包含PDF脚本:a.hasJavaScript,包含签名:a.hasSignature,已加密:a.encrypted})},
    {id:'integrity',title:'格式与解析状态',items:useful({扩展名不一致:f.extensionMismatch,解析错误:f.parseError})}
  ].filter(g=>Object.keys(g.items).length);
}

async function analyzeBuffer(b,name,origin={}) {
  const [mime,kind]=classify(name,b); const f={name:path.basename(name),zipPath:origin.entryPath||name,sourcePath:origin.sourcePath||'',size:b.length,sha256:sha(b),mime,kind,extension:path.extname(name).toLowerCase(),extensionMismatch:false,attributes:{}};
  try{if(['word','excel','powerpoint'].includes(kind))f.attributes=await officeExtract(b,kind);else if(kind==='pdf')f.attributes=pdfExtract(b);else if(kind==='image')f.attributes={imageHash:f.sha256};else if(kind==='text'){const t=b.toString('utf8').slice(0,200000);f.attributes={textFingerprint:simhash(t),textSample:t};}}catch(x){f.parseError=x.message;} f.propertyGroups=propertyGroups(f); return f;
}

async function analyzeFiles(filePaths,options={}) {const files=[];for(let i=0;i<filePaths.length;i++){const p=path.resolve(filePaths[i]),b=await fsp.readFile(p);const f=await analyzeBuffer(b,path.basename(p),{sourcePath:p});f.supplier='单文件检查';files.push(f);options.progress?.({done:i+1,total:filePaths.length,name:path.basename(p)});}return {schemaVersion:2,appVersion:'1.1.0',id:crypto.randomUUID(),name:'单文件检查',mode:'files',createdAt:new Date().toISOString(),submissions:[{id:crypto.randomUUID(),supplier:'单文件检查',zipName:'本地文件',zipPath:'',fileCount:files.length,totalSize:files.reduce((n,f)=>n+f.size,0),files}],findings:[],disclaimer:'单文件属性检查仅展示可提取信息；清理操作始终生成新副本。'};}
function simhash(s){const toks=normalize(s).match(/[\p{L}\p{N}]{2,}/gu)||[]; if(!toks.length)return'';const v=new Int32Array(64);for(const t of toks){const h=crypto.createHash('sha256').update(t).digest();for(let i=0;i<64;i++)v[i]+=((h[Math.floor(i/8)]>>(i%8))&1)?1:-1;}let x=0n;for(let i=0;i<64;i++)if(v[i]>=0)x|=1n<<BigInt(i);return x.toString(16).padStart(16,'0');}
function hamming(a,b){if(!a||!b)return 64;let x=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(x){n++;x&=x-1n;}return n;}

async function analyzeZip(zipPath, supplier, progress=()=>{}) {
  const raw=await fsp.readFile(zipPath); const listing=await listZip(zipPath); const z=await openZip(zipPath); const files=[]; let done=0;
  await new Promise((resolve,reject)=>{ z.on('entry',async e=>{ try { if(/\/$/.test(e.fileName)){z.readEntry();return;} const b=await readEntry(z,e); const f=await analyzeBuffer(b,e.fileName,{entryPath:e.fileName});f.supplier=supplier;files.push(f); progress(++done,listing.entries.filter(x=>!(/\/$/.test(x.fileName))).length,e.fileName); z.readEntry(); }catch(x){reject(x);} }); z.on('error',reject); z.on('end',()=>{z.close();resolve();}); z.readEntry(); });
  return {id:crypto.randomUUID(),supplier,zipName:path.basename(zipPath),zipPath,zipSha256:sha(raw),manifestHash:sha(Buffer.from(files.map(f=>`${f.zipPath}:${f.sha256}`).sort().join('\n'))),fileCount:files.length,totalSize:listing.total,files};
}
function supplierSubmissions(archive) {
  const groups=new Map(), root=[];
  for(const f of archive.files){const parts=f.zipPath.replace(/\\/g,'/').split('/').filter(Boolean);if(parts.length>1){const supplier=parts[0];if(!groups.has(supplier))groups.set(supplier,[]);groups.get(supplier).push({...f,supplier});}else root.push(f);}
  if(!groups.size||root.length)return [archive];
  return [...groups].map(([supplier,files])=>({...archive,id:crypto.randomUUID(),supplier,fileCount:files.length,totalSize:files.reduce((n,f)=>n+f.size,0),files}));
}
function correlate(submissions, enabled={}) {
  const findings=[]; const add=(type,key,a,b,weight,why,sourceA,sourceB)=>{if(!key)return; findings.push({id:sha(Buffer.from([type,a.supplier,b.supplier,key,sourceA,sourceB].join('|'))).slice(0,16),type,level:weight>=85?'极高风险':weight>=65?'高风险':weight>=40?'中风险':'低风险',weight,suppliers:[a.supplier,b.supplier],files:[`${a.zipName}/${sourceA}`,`${b.zipName}/${sourceB}`],value:key,reason:why,review:'暂不判断',guidance:'核对原始文件形成过程、制作人员授权关系及统一模板来源。'});};
  const allow=k=>enabled[k]!==false; const fsx=submissions.flatMap(s=>s.files.map(f=>({...f,supplier:s.supplier,zipName:s.zipName})));
  for(let i=0;i<fsx.length;i++)for(let j=i+1;j<fsx.length;j++){const a=fsx[i],b=fsx[j];if(a.supplier===b.supplier)continue;
    if(allow('exact')&&a.sha256===b.sha256)add('相同文件',a.sha256,a,b,95,'不同供应商提交了内容完全一致的文件',a.zipPath,b.zipPath);
    const pairs=[['author','相同作者',45],['lastEditor','相同最后编辑人',75],['company','相同公司属性',55],['template','相同模板路径',75],['internalStructureHash','相同内部结构',45]];
    for(const [k,t,w] of pairs){if(!allow('metadata'))continue;const x=normalize(a.attributes[k]),y=normalize(b.attributes[k]);if(x&&x===y&&!['microsoft office user','administrator','admin','wps'].includes(x))add(t,a.attributes[k],a,b,w,`不同供应商文件的${t.replace('相同','')}一致`,a.zipPath,b.zipPath);}
    for(const k of ['documentIds','localPaths','externalLinks','mediaHashes']){if(!allow(k==='mediaHashes'?'image':'metadata'))continue;const common=(a.attributes[k]||[]).map(normalize).filter(Boolean).filter(x=>(b.attributes[k]||[]).map(normalize).includes(x));for(const x of common.slice(0,5))add(k==='documentIds'?'相同文档ID':k==='localPaths'?'相同本地路径':k==='mediaHashes'?'相同图片':'相同外部链接',x,a,b,k==='documentIds'||k==='localPaths'?90:k==='mediaHashes'?80:55,`发现较具唯一性的共同${k}`,a.zipPath,b.zipPath);}
    const d=hamming(a.attributes.textFingerprint,b.attributes.textFingerprint);if(allow('simhash')&&d<=3&&a.attributes.textFingerprint)add('文本高度相似',`${a.attributes.textFingerprint} / 距离 ${d}`,a,b,55,'本地 SimHash 显示文本结构高度相似；需排除招标方统一内容',a.zipPath,b.zipPath);
  }
  return findings.sort((a,b)=>b.weight-a.weight);
}
async function analyzeProject(zipPaths, options={}) { const submissions=[]; for(let i=0;i<zipPaths.length;i++){const p=path.resolve(zipPaths[i]);const archive=await analyzeZip(p,path.basename(p,path.extname(p)),(d,t,n)=>options.progress?.({supplier:i+1,suppliers:zipPaths.length,done:d,total:t,name:n}));submissions.push(...supplierSubmissions(archive));} return {schemaVersion:2,appVersion:'1.1.0',id:crypto.randomUUID(),name:options.name||`检测项目 ${new Date().toLocaleDateString('zh-CN')}`,mode:'compare',createdAt:new Date().toISOString(),method:'离线确定性规则 v1.1',detectionOptions:options.detectionOptions||{},limits:LIMITS,submissions,findings:correlate(submissions,options.detectionOptions),disclaimer:'本系统仅发现异常关联与同源风险，不直接作出串标、违法或法律定性结论；结果须结合其他证据人工复核。'}; }
module.exports={LIMITS,analyzeProject,analyzeFiles,analyzeZip,analyzeBuffer,correlate,listZip,normalize,sha,propertyGroups,openZip,readEntry};
