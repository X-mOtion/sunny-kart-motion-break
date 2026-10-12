import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=fs.readdirSync(new URL('../tests/',import.meta.url)).filter(x=>x.endsWith('.test.ts')).sort().map(x=>'tests/'+x);
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit',cwd:new URL('../',import.meta.url)});
if(result.error)throw result.error;
process.exit(result.status??1);
