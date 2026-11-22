import test,{before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set} from 'firebase/database';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-silly-rtdb',database:{host:'127.0.0.1',port:9005,rules:await readFile('database.rules.json','utf8')}});await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database()),{publicStore:{content:{title:'Public'}},customers:{owner:{phone:'private'}},privateReferences:{order:{image:'private'}},privateSettings:{labels:{text:'private'}}});});});
after(async()=>env?.cleanup());
test('Realtime Database exposes public content and only the owner profile; all client writes are denied',async()=>{
 const anon=env.unauthenticatedContext().database(),owner=env.authenticatedContext('owner').database(),other=env.authenticatedContext('other').database(),admin=env.authenticatedContext('admin',{admin:true}).database();
 await assertSucceeds(get(ref(anon,'publicStore')));await assertSucceeds(get(ref(owner,'customers/owner')));
 for(const client of [anon,other,admin])await assertFails(get(ref(client,'customers/owner')));
 for(const client of [anon,owner,admin]){await assertFails(get(ref(client,'privateReferences')));await assertFails(get(ref(client,'privateSettings')));await assertFails(get(ref(client)));await assertFails(set(ref(client,'publicStore/content'),{title:'injected'}));await assertFails(set(ref(client,'customers/owner'),{phone:'injected'}));}
});
