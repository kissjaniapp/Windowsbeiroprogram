'use strict';
const http = require('node:http');

// Only the fixed local timer and its two read/arm endpoints are reachable.
function sensorGet(requestPath) {
  if (typeof requestPath !== 'string' || !/^\/(?:status|arm\?token=[A-Za-z0-9_%-]+(?:&previous=[A-Za-z0-9_%-]+)?)$/.test(requestPath)) {
    return Promise.resolve({ok:false, error:'Érvénytelen érzékelőkérés.'});
  }
  return new Promise(resolve => {
    let settled=false;
    const done=value=>{if(!settled){settled=true;resolve(value)}};
    const request=http.get({hostname:'192.168.4.1',port:80,path:requestPath,timeout:2500}, response=>{
      let body='';
      response.setEncoding('utf8');
      response.on('data',chunk=>{body+=chunk;if(body.length>16384)request.destroy();});
      response.on('error',()=>done({ok:false,error:'A kártya válasza megszakadt.'}));
      response.on('end',()=>{
        if(response.statusCode<200||response.statusCode>=300)return done({ok:false,status:response.statusCode});
        try {done({ok:true,data:JSON.parse(body)});} catch (_) {done({ok:false,error:'A kártya válasza nem értelmezhető.'});}
      });
    });
    request.on('timeout',()=>request.destroy());
    request.on('error',()=>done({ok:false,error:'Az érzékelő nem érhető el.'}));
  });
}
module.exports={sensorGet};
