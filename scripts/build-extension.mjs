import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildFingerprint} from './build-fingerprint.mjs';
import {extensionFingerprint} from './extension-fingerprint.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
const output=path.join(root,'release/SunnyKart-Chrome');
await fs.mkdir(path.dirname(output),{recursive:true});
const stage=await fs.mkdtemp(path.join(path.dirname(output),'.sunny-kart-extension-'));
try{
  await fs.cp(path.join(root,'dist'),stage,{recursive:true});
  await fs.cp(path.join(root,'extension'),stage,{recursive:true});
  await fs.copyFile(path.join(root,'docs/INSTALL.zh-CN.md'),path.join(stage,'INSTALL.zh-CN.md'));
  const manifest=JSON.parse(await fs.readFile(path.join(stage,'manifest.json'),'utf8'));
  for(const name of Object.values(manifest.icons))await fs.access(path.join(stage,name));
  const gameBuild=await buildFingerprint(),extension=await extensionFingerprint(stage);
  await fs.writeFile(path.join(stage,'BUILD.json'),JSON.stringify({gameBuild,extensionVersion:manifest.version,extension},null,2)+'\n');
  const previous=await fs.readFile(path.join(output,'manifest.json'),'utf8').then(JSON.parse,error=>error.code==='ENOENT'?null:Promise.reject(error));
  if(previous&&previous.name!==manifest.name)throw Error('Refusing to replace an unrelated extension directory');
  if(!previous&&await fs.stat(output).then(()=>true,()=>false))throw Error('Output directory exists without a Sunny Kart manifest');
  await fs.rm(output,{recursive:true,force:true});
  await fs.rename(stage,output);
  console.log('Chrome extension ready: release/SunnyKart-Chrome');
}finally{await fs.rm(stage,{recursive:true,force:true});}
