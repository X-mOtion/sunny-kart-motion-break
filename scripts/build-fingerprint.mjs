import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
export async function buildFingerprint(){
 const root=fileURLToPath(new URL('../dist/',import.meta.url)),names=(await fs.readdir(root+'assets')).filter(n=>/\.(js|css)$/.test(n)).map(n=>'assets/'+n);
 const files=['index.html','gesture-test.html','pose/worker.js',...names].sort(),h=createHash('sha256');
 for(const file of files){h.update(file+'\0');h.update(await fs.readFile(root+file));}
 return {sha256:h.digest('hex'),files};
}
