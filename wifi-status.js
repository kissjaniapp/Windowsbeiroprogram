'use strict';

const {execFile} = require('node:child_process');

const SENSOR_SSID = 'VersenyIdomero';

// A Windows csatlakozott Wi-Fi-jét vizsgáljuk; ez önmagában nem bizonyítja
// az Arduino érzékelő jelének megérkezését.
function findWifiSsids(netshOutput) {
  return String(netshOutput || '').split(/\r?\n/)
    .map(line => line.match(/^\s*SSID\s*:\s*(.*?)\s*$/i))
    .filter(Boolean)
    .map(match => match[1]).filter(Boolean);
}

function createWifiStatus({run=execFile, platform=process.platform, expectedSSID=SENSOR_SSID}={}) {
  return function getWifiStatus() {
    if (platform !== 'win32') {
      return Promise.resolve({
        supported:false, connected:false, ssid:null,
        expectedSSID, message:'A Wi-Fi állapotellenőrzés Windows rendszeren működik.'
      });
    }
    return new Promise(resolve => {
      run('netsh', ['wlan', 'show', 'interfaces'], {
        windowsHide:true, timeout:5000, maxBuffer:256*1024
      }, (error, stdout) => {
        if (error) {
          resolve({
            supported:true, connected:false, ssid:null, expectedSSID,
            message:'A Windows Wi-Fi állapota nem olvasható.'
          });
          return;
        }
        const ssids=findWifiSsids(stdout);
        const matched=ssids.find(s => s.trim()===expectedSSID);
        resolve({
          supported:true, connected:!!matched, ssid:matched||ssids[0]||null, expectedSSID,
          message:matched ? 'Csatlakozva a VersenyIdomero Wi-Fi-hálózathoz.' :
            ssids.length ? 'Másik Wi-Fi-hálózathoz csatlakozva.' : 'Nincs Wi-Fi kapcsolat.'
        });
      });
    });
  };
}

module.exports = {SENSOR_SSID, findWifiSsids, createWifiStatus};
