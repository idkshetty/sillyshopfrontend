// Project watermark: Vishnu Shetty | Silly Sensei
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const root=path.resolve('frontend');
const port=Number(process.env.PORT || 4173);
const apiPort=Number(process.env.API_PORT || 3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json'};

function proxyToBackend(req,res){
  const upstream=http.request({
    hostname:'127.0.0.1',
    port:apiPort,
    path:req.url,
    method:req.method,
    headers:{...req.headers,host:`127.0.0.1:${apiPort}`}
  },upRes=>{
    res.writeHead(upRes.statusCode||502,upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error',()=>{
    if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({error:{code:'unavailable',message:'Local backend on port '+apiPort+' is not reachable.'}}));
  });
  req.pipe(upstream);
}

http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname);
    if(relative.startsWith('/api/')||relative==='/config'||relative==='/health'||relative.startsWith('/webhooks/')){
      proxyToBackend(req,res);
      return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    if(relative==='/')relative='/index.html';
    else if(['/shop','/admin','/checkout','/auction'].includes(relative.toLowerCase()))relative+='.html';
    const filename=path.resolve(root,'.'+relative);
    const lower=relative.toLowerCase(),segments=lower.split('/');
    const ext=path.extname(lower);
    // Windows resolves case and backslashes differently from URL paths.
    if(!filename.startsWith(root+path.sep)||/[\\:]/.test(relative)||segments.some(part=>part.startsWith('.')||/[. ]$/.test(part))||['functions','scripts','node_modules','test-results','tests'].some(part=>segments.includes(part))||/\.(?:rules|log|md)$/.test(lower)||/\/(?:package[^/]*|firebase|firestore[^/]*|storage-cors)\.json$/.test(lower)){res.writeHead(403);res.end();return;}
    if(!['.html','.js','.css','.svg','.png','.webp','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.eot'].includes(ext)){res.writeHead(403);res.end();return;}
    const info=await stat(filename);if(!info.isFile())throw new Error('not found');
    const etag='"'+info.size+'-'+Math.round(info.mtimeMs)+'"',asset=lower.startsWith('/assets/');
    const headers={'Content-Type':types[ext]||'application/octet-stream','Cache-Control':asset?'public, max-age=3600':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Vary':'Accept-Encoding'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
    let data=await readFile(filename);if(/gzip/.test(req.headers['accept-encoding']||'')&&['.js','.css','.html','.svg'].includes(ext)){data=gzipSync(data);headers['Content-Encoding']='gzip';}
    if(req.method==='HEAD'){res.writeHead(200,headers);res.end();return;}
    res.writeHead(200,headers);res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`hehe.cafe: http://localhost:${port}/ (and http://127.0.0.1:${port}/)`));
