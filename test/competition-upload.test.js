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
  const payload=validateEvent({...ctx.makeGooglePayload(),revisionId:'1762600000000-test'});
  assert.equal(payload.location,'Budapest');assert.equal(payload.eventType,'gyakorlas');
  assert.deepEqual(Array.from(payload.results,x=>x.heat),[1,2]);
  assert.equal(payload.results[0].rounds.length,3);assert.equal(payload.results[1].rounds[2].valid,false);
});
test('régi válasz nem törli a közben módosított eredményt',async()=>{
  const path=require('node:path');const dir=fs.mkdtempSync(path.join(__dirname,'eredmeny-rev-'));
  let release,arrived;const waiting=new Promise(resolve=>{arrived=resolve});const sent=[];
  try{
    const sync=createGoogleSync({dataDir:dir,encryptKey:x=>x,decryptKey:x=>x,fetchImpl:async(_url,request)=>{
      const p=JSON.parse(request.body);sent.push(p);if(sent.length===1){arrived();await new Promise(resolve=>{release=resolve});}
      return {ok:true,json:async()=>({ok:true,eventId:p.eventId,schemaVersion:2})};
    }});
    sync.saveConfig({url:'https://script.google.com/macros/s/test/exec',key:'key'});await sync.flush();
    const e={eventId:'verseny-123',schemaVersion:2,revisionId:'1762600000000-a',date:'2026-11-08',mode:'eles',usedTime:false,createdAt:'x',location:'Pécs',eventType:'verseny',results:[{name:'A',heat:1,points:1,totalTime:0,result:1,rounds:[]}]};
    sync.enqueue(e);await waiting;sync.enqueue({...e,revisionId:'1762600000001-b',results:[{...e.results[0],result:2}]});release();await sync.flush();
    assert.equal(sent.length,2);assert.equal(sent[1].results[0].result,2);assert.equal(sync.getStatus().pendingCount,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('a fogadó stale jelzése nem számít feltöltésnek',async()=>{
  const path=require('node:path');const dir=fs.mkdtempSync(path.join(__dirname,'eredmeny-stale-'));
  try{
    const sync=createGoogleSync({dataDir:dir,encryptKey:x=>x,decryptKey:x=>x,fetchImpl:async()=>({ok:true,json:async()=>({ok:true,eventId:'verseny-123',schemaVersion:2,stale:true})})});
    sync.saveConfig({url:'https://script.google.com/macros/s/test/exec',key:'key'});await sync.flush();
    sync.enqueue({eventId:'verseny-123',schemaVersion:2,revisionId:'1762600000000-a',date:'2026-11-08',mode:'eles',usedTime:false,createdAt:'x',results:[{name:'A',heat:1,points:1,totalTime:0,result:1,rounds:[]}]});
    await sync.flush();assert.equal(sync.getStatus().pendingCount,1);assert.match(sync.getStatus().lastMessage,/újabb/i);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
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
