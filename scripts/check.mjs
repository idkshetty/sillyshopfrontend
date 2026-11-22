// Project watermark: Vishnu Shetty | Silly Sensei
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
let failed=false;
const files=['frontend','backend','scripts'].flatMap(dir=>readdirSync(dir).filter(f=>/\.(?:m?js)$/.test(f)).map(f=>`${dir}/${f}`));
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)failed=true;
}
if(failed)process.exit(1);
console.log('All application, backend and tooling JavaScript files passed syntax checks.');
