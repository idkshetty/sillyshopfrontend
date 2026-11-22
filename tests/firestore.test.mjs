import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-silly-rules',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
test('Firestore financial and legacy collections are inaccessible to all browser clients',async()=>{
 for(const context of [env.unauthenticatedContext(),env.authenticatedContext('owner'),env.authenticatedContext('admin',{admin:true,email_verified:true})]){
  const db=context.firestore();
  for(const collection of ['products','checkoutRequests','sales','mailOutbox','referenceTransfers','customers','storeContent']){
   const ref=doc(db,collection,'test');await assertFails(getDoc(ref));await assertFails(setDoc(ref,{status:'paid'}));
  }
 }
 assert(true);
});
