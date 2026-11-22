// Project watermark: Vishnu Shetty | Silly Sensei
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {once} from 'node:events';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'4175'},stdio:['ignore','pipe','inherit'],windowsHide:true});
try {
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw new Error('Server exited before startup');}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server startup timed out')),10000).unref())]);
  for(const p of ['/shop.html','/shop.js','/downloads.js','/assets/brand-logo.webp'])
    assert.equal((await fetch('http://127.0.0.1:4175'+p)).status,200,p);
  for(const p of ['/backend/index.js','/backend/.env.example','/docs/PROJECT_GUIDE.md','/tests/backend.test.mjs','/package.json'])
    assert.notEqual((await fetch('http://127.0.0.1:4175'+p)).status,200,p);
  console.log('Public assets and private-file hosting boundaries passed.');
} finally { server.kill(); }
