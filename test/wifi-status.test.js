'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SENSOR_SSID,findWifiSsids,createWifiStatus}=require('../wifi-status');

const sample=[
  'There is 1 interface on the system:',
  '    Name                   : Wi-Fi',
  '    Description            : Intel(R) Wireless',
  '    State                  : connected',
  '    SSID                   : VersenyIdomero',
  '    BSSID                  : 50:02:91:4a:20:bf',
  '    Network type           : Infrastructure',
  '    Authentication         : WPA2-Personal'
].join('\r\n');

test('Recognizes exact sensor SSID but never mistakes BSSID for Wi-Fi name',()=>{
  assert.equal(SENSOR_SSID,'VersenyIdomero');
  assert.deepEqual(findWifiSsids(sample),['VersenyIdomero']);
  assert.deepEqual(findWifiSsids('    SSID : Office\r\n BSSID : 11:22:33'),['Office']);
});
test('Green state only for correct SSID on Windows', async()=>{
  const run=(_exe,args,opts,cb)=>cb(null,sample,'');
  const state=await createWifiStatus({platform:'win32',run})();
  assert.equal(state.connected,true);
  assert.equal(state.ssid,'VersenyIdomero');
});
test('Red when connected to another Wi-Fi (even if it has internet)', async()=>{
  const run=(_exe,args,opts,cb)=>cb(null,sample.replace('SSID                   : VersenyIdomero','SSID                   : Telekom-390653_5GHz'),'');
  const state=await createWifiStatus({platform:'win32',run})();
  assert.equal(state.connected,false);
  assert.equal(state.ssid,'Telekom-390653_5GHz');
});
test('Red on Windows Wi-Fi inspection error',async()=>{
  const run=(_exe,args,opts,cb)=>cb(new Error('adapter off'),'', '');
  const state=await createWifiStatus({platform:'win32',run})();
  assert.equal(state.connected,false);
});
test('Unsupported OS has a clear status',async()=>{
  const state=await createWifiStatus({platform:'linux'})();
  assert.equal(state.supported,false);
  assert.equal(state.connected,false);
});
