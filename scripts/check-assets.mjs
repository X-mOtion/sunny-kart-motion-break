import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
let count=0;
for(const [dir,manifest] of [['assets','manifest.json'],['pose','source-manifest.json']]){
  const source=JSON.parse(await fs.readFile(path.join(root,dir,manifest),'utf8'));
  for(const entry of Array.isArray(source)?source:source.files){
    const name=entry.file??entry.path,bytes=await fs.readFile(path.join(root,dir,name));
    assert.equal(bytes.byteLength,entry.bytes,`${dir}/${name}: size mismatch`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`${dir}/${name}: checksum mismatch`);
    count++;
  }
}
console.log(`Verified ${count} bundled assets and local recognition files.`);
