'use strict';

const crypto=require('crypto');
const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\\/g,'/').replace(/\s+/g,' ').toLowerCase();
const idFor=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
const formatBytes=value=>{const n=Number(value)||0;if(n<1024)return `${n} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;if(n<1024**3)return `${(n/1024**2).toFixed(1)} MB`;return `${(n/1024**3).toFixed(1)} GB`;};

const ATTRIBUTE_DEFS={
  word:[['author','作者',55],['lastEditor','最后一次保存者',80]],
  excel:[['author','作者',55],['lastEditor','最后一次保存者',80]],
  powerpoint:[['author','作者',55],['lastEditor','最后一次保存者',80]],
  pdf:[['author','作者',60],['title','标题',35],['subject','主题',35],['keywords','关键词',40],['creator','创建程序',30],['producer','制作工具',25]],
  image:[['author','作者',55],['software','创建软件',30],['title','标题',30],['description','说明',30]]
};
const IGNORED_VALUES=new Set(['microsoft office user','administrator','admin','wps','microsoft word','microsoft excel','microsoft powerpoint']);

function fileRef(submission,file){return {key:`${submission.id}|${file.zipPath}`,supplier:submission.supplier,zipName:submission.zipName,path:file.zipPath,name:file.name,kind:file.kind,size:file.size,sha256:file.sha256};}
function groupBy(items,keyOf){const groups=new Map();for(const item of items){const key=keyOf(item);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}return groups;}
function crossSupplier(items){return new Set(items.map(item=>item.supplier)).size>1;}

function buildAudit(submissions=[]){
  const wrapped=submissions.flatMap(submission=>submission.files.map(file=>({submission,file,...fileRef(submission,file)})));
  const supplierStats=submissions.map(submission=>{
    const types={};for(const file of submission.files)types[file.kind]=(types[file.kind]||0)+1;
    return {id:submission.id,supplier:submission.supplier,zipName:submission.zipName,zipPath:submission.zipPath,zipSha256:submission.zipSha256,manifestHash:submission.manifestHash,fileCount:submission.fileCount,totalSize:submission.totalSize,totalSizeLabel:formatBytes(submission.totalSize),parseErrors:submission.files.filter(file=>file.parseError).length,types};
  });
  const identicalPackages=[...groupBy(supplierStats,item=>item.manifestHash).entries()].filter(([,items])=>items.length>1).map(([manifestHash,items])=>({id:idFor(`package:${manifestHash}`),manifestHash,suppliers:items.map(item=>item.supplier),packages:items.map(item=>item.zipName),fileCount:items[0].fileCount,totalSize:items[0].totalSize,totalSizeLabel:items[0].totalSizeLabel}));
  const exactFiles=[...groupBy(wrapped,item=>item.sha256).entries()].filter(([,items])=>items.length>1&&crossSupplier(items)).map(([sha256,items])=>({id:idFor(`file:${sha256}`),sha256,size:items[0].size,sizeLabel:formatBytes(items[0].size),suppliers:[...new Set(items.map(item=>item.supplier))],files:items.map(({submission,file})=>fileRef(submission,file))})).sort((a,b)=>b.size-a.size);
  const attributeBuckets=new Map();
  for(const item of wrapped){for(const [field,label,weight] of ATTRIBUTE_DEFS[item.kind]||[]){const value=item.file.attributes?.[field],normalized=normalize(value);if(!normalized||IGNORED_VALUES.has(normalized))continue;const key=`${item.kind}:${field}:${normalized}`;if(!attributeBuckets.has(key))attributeBuckets.set(key,{kind:item.kind,field,label,weight,value:String(value),files:[]});attributeBuckets.get(key).files.push(fileRef(item.submission,item.file));}}
  const attributeMatches=[...attributeBuckets.values()].filter(group=>group.files.length>1&&crossSupplier(group.files)).map(group=>({...group,id:idFor(`attribute:${group.kind}:${group.field}:${normalize(group.value)}`),suppliers:[...new Set(group.files.map(file=>file.supplier))]})).sort((a,b)=>b.weight-a.weight||b.files.length-a.files.length);
  return {createdAt:new Date().toISOString(),supplierStats,identicalPackages,exactFiles,attributeMatches,summary:{supplierCount:submissions.length,fileCount:wrapped.length,totalSize:submissions.reduce((sum,item)=>sum+item.totalSize,0),totalSizeLabel:formatBytes(submissions.reduce((sum,item)=>sum+item.totalSize,0)),identicalPackageGroups:identicalPackages.length,exactFileGroups:exactFiles.length,attributeMatchGroups:attributeMatches.length}};
}

module.exports={buildAudit,ATTRIBUTE_DEFS,formatBytes};
