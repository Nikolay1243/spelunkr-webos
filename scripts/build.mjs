import { build } from 'esbuild';
import { adaptPlayer } from './adapt-player.mjs';
import { mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { parse } from 'acorn';
import { analyze } from 'eslint-scope';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
const snapshot=JSON.parse(await readFile('vendor/site/snapshot.json','utf8'));
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
const adaptLocation={name:'webos-location',setup(build){
  build.onResolve({filter:/^\//},args=>({path:'https://spelunkr.tv'+args.path,external:true}));
  build.onLoad({filter:/vendor\/site\/.*\.js$/},async args=>{
    let source=await readFile(args.path,'utf8');
    if(args.path.endsWith(snapshot.main))source=adaptPlayer(source);
    const ast=parse(source,{ecmaVersion:2022,sourceType:'module',ranges:true});
    const scope=analyze(ast,{ecmaVersion:2022,sourceType:'module'});
    const edits=[];
    function walk(node){if(!node||typeof node!=='object')return;
      if(node.type==='MemberExpression'&&!node.computed&&node.property.name==='location'&&['window','globalThis'].includes(node.object.name)){
        edits.push({start:node.start,end:node.end});return;
      }
      for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
    }
    walk(ast);
    for(const ref of scope.globalScope.through)if(ref.identifier.name==='location')edits.push({start:ref.identifier.start,end:ref.identifier.end});
    for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+'window.SpelunkrWebOS.location'+source.slice(edit.end);
    return {contents:source,loader:'js',resolveDir:resolve(args.path,'..')};
  });
}};
// webOS 6.x (LG C1 and older) ships Chromium 79. Targeting anything newer emits
// syntax that browser cannot parse, which fails the entire bundle with a
// SyntaxError before a single statement runs -- the app then sits on its
// "PLEASE STAND BY" placeholder with no error surface. Runtime APIs missing from
// Chromium 79 are shimmed in src/legacy-shims.js, which must be imported first.
const BROWSER_TARGET='chrome79';
await build({stdin:{contents:`import './src/legacy-shims.js'; import './src/webos-bridge.js'; import './vendor/site${snapshot.css}'; import './src/webos-ui.css'; window.SpelunkrWebOS.ready.then(()=>import('./vendor/site${snapshot.main}')); `,resolveDir:process.cwd()},outfile:'dist/app.js',bundle:true,format:'iife',target:BROWSER_TARGET,minify:true,define:{'import.meta':'{}'},plugins:[adaptLocation]});
// Guard: a target regression has to fail here, not on someone's TV.
try{parse(await readFile('dist/app.js','utf8'),{ecmaVersion:2019,sourceType:'script'});}
catch(error){throw new Error(`dist/app.js is not ES2019-parseable, so webOS 6 cannot load it (${error.message}). Check BROWSER_TARGET in scripts/build.mjs.`);}
for(const file of ['index.html','appinfo.json'])await copyFile('src/'+file,'dist/'+file);
// Original pixel S icon, generated without external artwork or image dependencies.
function crc(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type), n=Buffer.alloc(4), c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c]);}
function icon(size){const rows=['01111','11000','01110','00011','11110'],data=Buffer.alloc((1+size*4)*size);for(let y=0;y<size;y++){for(let x=0;x<size;x++){const gx=Math.floor(x/size*7)-1,gy=Math.floor(y/size*7)-1;const lit=rows[gy]?.[gx]==='1',i=y*(1+size*4)+1+x*4;data.set(lit?[255,226,131,255]:[32,9,80,255],i);}}const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);}
await writeFile('dist/icon.png',icon(80));await writeFile('dist/largeIcon.png',icon(130));

// Typography must not depend on the network: pull every face into dist/.
const { localizeFonts } = await import('./localize-fonts.mjs');
await localizeFonts('dist');

await rm('output/auth-service',{recursive:true,force:true});await mkdir('output/auth-service',{recursive:true});
await build({entryPoints:['service/service.cjs'],outfile:'output/auth-service/service.cjs',bundle:true,platform:'node',format:'cjs',target:'node16',external:['webos-service','bufferutil','utf-8-validate']});
for(const file of ['package.json','services.json','ws-LICENSE.txt'])await copyFile('service/'+file,'output/auth-service/'+file);
