// Fetch public client assets locally. The repository tracks hashes, not website code.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
const origin='https://spelunkr.tv';
const latest=process.argv.includes('--latest');
const hash=source=>createHash('sha256').update(source).digest('hex');
async function download(path){
 if(!/^\/assets\/[a-zA-Z0-9_.-]+\.(js|css)$/.test(path))throw Error('Unexpected asset path');
 const response=await fetch(origin+path);if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);
 return response.text();
}
async function save(path,source){await mkdir('vendor/site/assets',{recursive:true});await writeFile('vendor/site'+path,source);}
if(!latest){
 const manifest=JSON.parse(await readFile('upstream/site-manifest.json','utf8'));
 if(manifest.origin!==origin)throw Error('Unexpected upstream origin');
 for(const [path,asset]of Object.entries(manifest.assets)){
  const source=await download(path);if(hash(source)!==asset.sha256)throw Error(`Hash mismatch: ${path}. Review upstream before updating.`);await save(path,source);
 }
 await writeFile('vendor/site/snapshot.json',JSON.stringify(manifest,null,2)+'\n');
 console.log(`Fetched and verified ${Object.keys(manifest.assets).length} pinned assets.`);
}else{
 const html=await(await fetch(origin)).text();
 const main=html.match(/<script[^>]+src="(\/assets\/[^\"]+\.js)"/)[1];
 const css=html.match(/<link[^>]+href="(\/assets\/[^\"]+\.css)"/)[1];
 const visited=new Map();
 async function asset(path){
  if(visited.has(path))return;visited.set(path,null);
  const source=await download(path);await save(path,source);visited.set(path,{sha256:hash(source),bytes:Buffer.byteLength(source)});
  const dependencies=new Set();
  if(path.endsWith('.js')){
   const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
   function walk(node){if(!node||typeof node!=='object')return;
    if(['ImportExpression','ImportDeclaration','ExportNamedDeclaration'].includes(node.type)&&typeof node.source?.value==='string'){
     const url=new URL(node.source.value,origin+path);if(url.origin===origin&&url.pathname.startsWith('/assets/'))dependencies.add(url.pathname);
    }
    for(const [key,value]of Object.entries(node)){if(key==='source')continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
   }walk(ast);
   for(const m of source.matchAll(/"(assets\/[^" ]+\.(?:css|js))"/g))dependencies.add('/'+m[1]);
  }
  for(const dependency of dependencies)await asset(dependency);
 }
 await asset(main);await asset(css);
 const manifest={origin,main,css,retrievedAt:new Date().toISOString(),assets:Object.fromEntries(visited)};
 for(const file of ['vendor/site/snapshot.json','upstream/site-manifest.json'])await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
 console.log(`Updated manifest for ${visited.size} assets. Review adapters and test before committing.`);
}
