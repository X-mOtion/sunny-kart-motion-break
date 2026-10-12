import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function extensionFingerprint(root) {
  const files=[];
  async function walk(dir) {
    for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())await walk(full);
      else if(entry.isFile()&&entry.name!=='.DS_Store'&&full!==path.join(root,'BUILD.json'))files.push(path.relative(root,full).split(path.sep).join('/'));
    }
  }
  await walk(root);
  files.sort();
  const h=createHash('sha256');
  for(const file of files){h.update(file+'\0');h.update(await fs.readFile(path.join(root,file)));}
  return {sha256:h.digest('hex'),files};
}
