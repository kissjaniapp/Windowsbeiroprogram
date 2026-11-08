'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const sensor=html.slice(html.indexOf('const SENSOR_URL='),html.indexOf('</script></body></html>',html.indexOf('const SENSOR_URL=')));
const sync=html.slice(html.indexOf('function sync(){'),html.indexOf('function refresh(){'));
const pre=`var D={gyak:[],eles:[]},ph='eles',ri=0,ci=0,fi=0,useTime=true;const num=x=>x===''?null:Number(x);const calc=(p,i,g)=>({p,i,r:p+i,v:g?i>0:i>=0});const fpre=()=>'';const nm=()=>'Test';var approve=true;function confirm(){return approve};class Event{constructor(type,options){this.type=type}};var inputs=[{value:'',dispatchEvent(){}},{value:'',dispatchEvent(){sync()}}];var elements={};function $(id){return elements[id]??=({classList:{toggle(){},contains(){return false}},textContent:''})};let document={querySelectorAll(){return inputs}};let window={};let timers=[];function setTimeout(fn,ms){timers.push(fn);return 1};function clearTimeout(){}`;
const execute=async code=>{const context=vm.createContext({assert,tick:queueMicrotask});return new vm.Script(pre+sync+sensor+code).runInContext(context)};
test('arm, partial result, acknowledgment and manual value',async()=>{await execute(`(async()=>{let req=[];sensorGet=async path=>{req.push(path);return {token:sensorMeasurement.token,boot_id:'abc',state:'armed'}};sensorAutoArm();for(let i=0;i<12;i++)await new Promise(tick);let m=sensorMeasurement;assert.equal(m.state,'armed');assert(req[0].startsWith('/arm?token='));sensorProcess(m,{state:'finished',result_ms:2650});assert.equal(inputs[1].value,'2.65');assert.equal(D.eles[0][0].p,null);assert.equal(D.eles[0][0].i,2.65);sensorRelease();assert.equal(sensorPrevious,m.token);ci=1;inputs[1].value='1.11';sensorAutoArm();for(let i=0;i<12;i++)await new Promise(tick);let n=sensorMeasurement;assert(req[1].includes('&previous='+m.token));sensorProcess(n,{state:'finished',result_ms:3250});assert.equal(inputs[1].value,'1.11');assert(n.warning)})()`)});
test('sensor error recovery requires confirmation and uses new token',async()=>{await execute(`(async()=>{sensorGet=async()=>({token:sensorMeasurement.token,boot_id:'abc',state:'armed'});sensorAutoArm();for(let i=0;i<12;i++)await new Promise(tick);let m=sensorMeasurement;sensorProcess(m,{state:'error'});approve=false;await sensorCheck();assert.equal(sensorMeasurement,m);approve=true;await sensorCheck();for(let i=0;i<12;i++)await new Promise(tick);assert.notEqual(sensorMeasurement.token,m.token);assert.equal(sensorMeasurement.state,'armed')})()`)});

test('HTTP bridge accepts only the fixed timer endpoints',async()=>{
 const {EventEmitter}=require('node:events');let calls=[];
 const http={get:(opts,callback)=>{calls.push(opts);const req=new EventEmitter();req.destroy=()=>req.emit('error',new Error());queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;res.setEncoding=()=>{};callback(res);res.emit('data','{\"state\":\"armed\"}');res.emit('end')});return req}};
 const module={exports:{}};new vm.Script(fs.readFileSync(path.join(__dirname,'..','sensor-http.js'),'utf8')).runInNewContext({require:()=>http,module,Promise,JSON});
 assert.equal((await module.exports.sensorGet('/status?x=1')).ok,false);
 let result=await module.exports.sensorGet('/arm?token=r1&previous=r2');assert.equal(result.data.state,'armed');assert.equal(calls[0].hostname,'192.168.4.1');
});
