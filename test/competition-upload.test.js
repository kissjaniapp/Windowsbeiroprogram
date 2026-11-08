'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {validateEvent,createGoogleSync}=require('../google-sync');

test('a teljes verseny mindkét futamának körei és helyszíne elküldhetők',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const source=html.slice(html.indexOf('function makeGooglePayload()'),html.indexOf('async function queueGoogleCompetition()'));
  const ctx={googleEventId:null,Date,Math,Number,String,mode:'both',useTime:true,
    $:id=>({datum:{value:'2026-11-08'},eventLocation:{value:' Budapest '},eventType:{value:'gyakorlas'}}[id]),
    played:()=>true,
    tot:()=>({pp:5,ii:1.5,s:6.5}),
    futams:[1,2].map(i=>({names:['Versenyző '+i],D:{gyak:[[{p:2,i:1,r:3,v:true}]],eles:[[{p:5,i:1.5,r:6.5,v:true}],[{p:3,i:-1,r:2,v:false}]]}}))};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  const payload=validateEvent(ctx.makeGooglePayload());
  assert.equal(payload.location,'Budapest');assert.equal(payload.eventType,'gyakorlas');
  assert.deepEqual(Array.from(payload.results,x=>x.heat),[1,2]);
  assert.equal(payload.results[0].rounds.length,3);assert.equal(payload.results[1].rounds[2].valid,false);
});
test('a régi, helyszín nélküli várakozó adatok olvashatók',()=>{
  const event={eventId:'verseny-123',date:'2026-11-08',mode:'eles',usedTime:false,createdAt:'2026-11-08T12:00:00Z',results:[{name:'A',heat:1,points:1,totalTime:0,result:1}]};
  const validated=validateEvent(event);assert.deepEqual(validated,event);
});
test('a régi Google-fogadó nem igazolhatja vissza az új részletek mentését',async()=>{
  const path=require('node:path');const dir=fs.mkdtempSync(path.join(__dirname,'eredmeny-sync-'));
  let version=1;
  try {
    const sync=createGoogleSync({dataDir:dir,encryptKey:x=>x,decryptKey:x=>x,fetchImpl:async()=>({ok:true,json:async()=>({ok:true,eventId:'verseny-123',schemaVersion:version})})});
    sync.saveConfig({url:'https://script.google.com/macros/s/test/exec',key:'key'});
    sync.enqueue({eventId:'verseny-123',date:'2026-11-08',mode:'eles',usedTime:false,createdAt:'2026-11-08T12:00:00Z',location:'Pécs',eventType:'verseny',results:[{name:'A',heat:1,points:1,totalTime:0,result:1,rounds:[]}]});
    await sync.flush(); assert.equal(sync.getStatus().pendingCount,1);
    version=2;await sync.flush();assert.equal(sync.getStatus().pendingCount,0);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
