import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
if(!fs.existsSync(path.join(root,'index.html'))){console.error('缺少构建包。请先运行 npm run build。');process.exit(1);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.glb':'model/gltf-binary','.wasm':'application/wasm','.task':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw 0;}catch{res.writeHead(404).end('File not found');return;}
 const ext=path.extname(file);res.setHeader('Content-Type',mime[ext]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',ext==='.html'?'no-cache':'public, max-age=3600');res.setHeader('Accept-Ranges','bytes');
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);return;}
 if(/gzip/.test(req.headers['accept-encoding']||'')&&['.js','.css','.html','.json','.svg','.wasm','.task','.glb'].includes(ext)){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);}
 else{res.setHeader('Content-Length',stat.size);fs.createReadStream(file).pipe(res);}
});
let port=Number(process.env.KART_PORT||4173);
server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<4200){port++;server.listen(port,'127.0.0.1');}else{console.error(e);process.exit(1);}});
server.on('listening',()=>{const url=`http://localhost:${port}/`;console.log(`\n☀ 阳光城卡丁车已启动\n\n电脑打开：${url}`);console.log('\n体感驾驶请在电脑 localhost 地址打开，允许摄像头并保持头部、双肩入镜。\n关闭游戏服务：在此窗口按 Control + C。\n');if(process.argv.includes('--open'))openBrowser(url);});
server.listen(port,'127.0.0.1');

function openBrowser(url){
 const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
 const args=process.platform==='win32'?['/c','start','',url]:[url];
 const child=spawn(command,args,{stdio:'ignore'});child.on('error',()=>console.log(`Open this address in your browser: ${url}`));
}
