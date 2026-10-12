import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'release');
const result=spawnSync(process.execPath,['scripts/build-extension.mjs'],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
async function walk(dir,prefix='',files={}){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(entry.name==='.DS_Store')continue;
    const file=path.join(dir,entry.name),name=prefix+entry.name;
    if(entry.isDirectory())await walk(file,name+'/',files);
    else if(entry.isFile())files[name]=new Uint8Array(await fs.readFile(file));
  }
  return files;
}
const extension=await walk(path.join(out,'SunnyKart-Chrome'),'SunnyKart-Chrome/');
const web=await walk(path.join(root,'dist'),'dist/');
web['scripts/serve.mjs']=new Uint8Array(await fs.readFile(path.join(root,'scripts/serve.mjs')));
web['package.json']=strToU8(JSON.stringify({name:'sunny-kart-local-web',private:true,type:'module',engines:{node:'>=22.12.0'},scripts:{start:'node scripts/serve.mjs'}},null,2)+'\n');
web['INSTALL.zh-CN.md']=new Uint8Array(await fs.readFile(path.join(root,'docs/INSTALL.zh-CN.md')));
web['Start Sunny Kart.cmd']=strToU8('@echo off\r\ncd /d "%~dp0"\r\nnode scripts/serve.mjs --open\r\npause\r\n');
web['启动游戏.command']=strToU8('#!/bin/zsh\ncd "${0:A:h}"\nexport PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"\nnode scripts/serve.mjs --open\n');
web['启动游戏.command']=[web['启动游戏.command'],{os:3,attrs:0o100755*65536}];
const source={};
for(const dir of ['src','public','scripts','tests','extension','docs'])await walk(path.join(root,dir),'SunnyKart/'+dir+'/',source);
for(const file of ['README.md','LICENSE','.gitignore','.gitattributes','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','gesture-test.html','启动游戏.command','Start Sunny Kart.cmd'])source['SunnyKart/'+file]=new Uint8Array(await fs.readFile(path.join(root,file)));
source['SunnyKart/启动游戏.command']=[source['SunnyKart/启动游戏.command'],{os:3,attrs:0o100755*65536}];
const records=[];
for(const [name,files] of [['SunnyKart-Chrome-extension.zip',extension],['SunnyKart-web.zip',web],['SunnyKart-source.zip',source]]){
  const bytes=zipSync(files,{level:6});
  if(Object.keys(unzipSync(bytes)).length!==Object.keys(files).length)throw Error('ZIP verification failed');
  await fs.writeFile(path.join(out,name),bytes);
  records.push({file:name,bytes:bytes.length,files:Object.keys(files).length,sha256:createHash('sha256').update(bytes).digest('hex')});
  console.log(`${name}: ${(bytes.length/1024/1024).toFixed(1)} MiB`);
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(records,null,2)+'\n');
