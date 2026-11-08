'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createGoogleSync, validGoogleUrl, validateEvent} = require('../google-sync');

const endpoint = 'https://script.google.com/macros/s/AKfycbexample/exec';
const sample = () => ({
  eventId:'verseny-1762500000000-abcdef', date:'2026-11-08',
  mode:'both', usedTime:true, createdAt:'2026-11-08T10:00:00.000Z',
  results:[{name:'Teszt Elek', heat:1, points:12, totalTime:3.5, result:15.5}]
});
function store(fetchImpl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'results-sync-'));
  const opts = {
    dataDir:dir, fetchImpl,
    encryptKey: key => Buffer.from(key, 'utf8').toString('base64'),
    decryptKey: stored => Buffer.from(stored, 'base64').toString('utf8')
  };
  return {dir, opts, sync:createGoogleSync(opts)};
}
test('Google endpoint validation rejects other hosts or cleartext', () => {
  assert.equal(validGoogleUrl(endpoint), true);
  assert.equal(validGoogleUrl('http://script.google.com/macros/s/x/exec'), false);
  assert.equal(validGoogleUrl('https://example.org/macros/s/x/exec'), false);
  assert.equal(validGoogleUrl('https://script.google.com.evil.org/macros/s/x/exec'), false);
});

test('Competition data uses the Android result schema', () => {
  assert.deepEqual(validateEvent(sample()), sample());
  assert.throws(() => validateEvent({...sample(),results:[]}));
  assert.throws(() => validateEvent({...sample(),results:[{name:'X',heat:1,points:NaN,totalTime:0,result:0}]}));
});

test('Offline result survives restart and uploads only after confirmed acknowledgement', async (t) => {
  let sent = [];
  const initial = store(async () => { throw new Error('offline'); });
  t.after(() => fs.rmSync(initial.dir, {recursive:true,force:true}));
  initial.sync.saveConfig({url:endpoint,key:'private-test-key'});
  initial.sync.enqueue(sample());
  await initial.sync.flush();
  assert.equal(initial.sync.getStatus().pendingCount, 1);
  const json = fs.readFileSync(path.join(initial.dir,'google-pending-results.json'),'utf8');
  assert.equal(json.includes('private-test-key'), false);
  const restored = createGoogleSync({...initial.opts,fetchImpl:async (url, options) => {
    sent.push({url, options});
    return {ok:true,json:async()=>({ok:true,eventId:sample().eventId})};
  }});
  await restored.flush();
  assert.equal(restored.getStatus().pendingCount, 0);
  assert.equal(sent.length,1);
  assert.equal(sent[0].url,endpoint);
  assert.equal(JSON.parse(sent[0].options.body).secret,'private-test-key');
  assert.equal(JSON.parse(sent[0].options.body).results[0].name,'Teszt Elek');
});

test('Wrong acknowledgement keeps event queued and duplicate enqueue does not multiply it', async (t) => {
  const x = store(async()=>({ok:true,json:async()=>({ok:true,eventId:'wrong-id'})}));
  t.after(()=>fs.rmSync(x.dir,{recursive:true,force:true}));
  x.sync.saveConfig({url:endpoint,key:'any-key'});
  x.sync.enqueue(sample());
  await x.sync.flush();
  assert.equal(x.sync.getStatus().pendingCount,1);
  x.sync.enqueue(sample());
  await x.sync.flush();
  assert.equal(x.sync.getStatus().pendingCount,1);
});

test('An event is safely queued even before any Google configuration', async (t) => {
  const x = store(async()=>{throw Error('Must not send without configuration')});
  t.after(()=>fs.rmSync(x.dir,{recursive:true,force:true}));
  x.sync.enqueue(sample());
  await x.sync.flush();
  assert.equal(x.sync.getStatus().pendingCount,1);
  assert.equal(x.sync.getStatus().configured,false);
});

test('Blank secret in settings preserves the encrypted previous key', async (t) => {
  const x = store(async()=>({ok:true,json:async()=>({ok:true,eventId:sample().eventId})}));
  t.after(()=>fs.rmSync(x.dir,{recursive:true,force:true}));
  x.sync.saveConfig({url:endpoint,key:'keep-me'});
  const before=JSON.parse(fs.readFileSync(path.join(x.dir,'google-sync-config.json'),'utf8'));
  x.sync.saveConfig({url:endpoint,key:''});
  const after=JSON.parse(fs.readFileSync(path.join(x.dir,'google-sync-config.json'),'utf8'));
  assert.equal(before.encryptedKey,after.encryptedKey);
});
