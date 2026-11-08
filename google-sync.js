'use strict';
// A versenyeredmények küldési sora az Electron főfolyamatában él.
// Internet nélkül a feladatok a felhasználói adatkönyvtárban maradnak.
const fs = require('node:fs');
const path = require('node:path');

function validGoogleUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      u.hostname === 'script.google.com' &&
      /^\/macros\/s\/[^/]+\/exec$/.test(u.pathname) &&
      !u.username && !u.password && !u.hash;
  } catch (_) { return false; }
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' ||
      typeof event.eventId !== 'string' ||
      !/^[\w.:-]{8,128}$/.test(event.eventId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event.date || '') ||
      !['both', 'eles'].includes(event.mode) ||
      typeof event.usedTime !== 'boolean' ||
      typeof event.createdAt !== 'string' ||
      !Array.isArray(event.results) ||
      event.results.length < 1 || event.results.length > 10000) {
    throw new Error('Érvénytelen versenyadatok, a küldés nem történt meg.');
  }
  const results = event.results.map(r => {
    const name = String(r.name || '').trim();
    if (!name || name.length > 200 ||
        !Number.isInteger(r.heat) || r.heat < 1 || r.heat > 1000 ||
        ![r.points, r.totalTime, r.result].every(n => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error('Érvénytelen versenyzői eredmény.');
    }
    return {name, heat:r.heat, points:r.points, totalTime:r.totalTime, result:r.result};
  });
  return {
    eventId:event.eventId, date:event.date, mode:event.mode,
    usedTime:event.usedTime, createdAt:event.createdAt, results
  };
}

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), {encoding:'utf8', mode:0o600});
  fs.renameSync(temp, file);
}

function createGoogleSync({dataDir, encryptKey, decryptKey, fetchImpl=globalThis.fetch, onChange=()=>{}}) {
  if (!dataDir || typeof encryptKey !== 'function' || typeof decryptKey !== 'function') {
    throw new Error('Hiányzó tárolási vagy titkosítási beállítás.');
  }
  const queueFile = path.join(dataDir, 'google-pending-results.json');
  const configFile = path.join(dataDir, 'google-sync-config.json');
  const saved = readJSON(queueFile, []);
  if (!Array.isArray(saved)) throw new Error('A helyi eredménysor nem olvasható.');
  let queue = saved.map(validateEvent);
  let sending = false, lastMessage = '', lastSuccessAt = null;

  function getConfig() {
    const c = readJSON(configFile, {});
    return {url:c.url || '', encryptedKey:c.encryptedKey || ''};
  }
  function getStatus() {
    const config = getConfig();
    return {
      url:config.url, configured:!!(config.url && config.encryptedKey),
      pendingCount:queue.length, sending, lastMessage, lastSuccessAt
    };
  }
  function changed(message) {
    if (message) lastMessage = message;
    try { onChange(getStatus()); } catch (_) {}
  }
  function saveConfig({url, key}) {
    const trimmedUrl = String(url || '').trim();
    if (trimmedUrl && !validGoogleUrl(trimmedUrl)) {
      throw new Error('A Google Apps Script /exec címe érvénytelen.');
    }
    const old = getConfig();
    const secret = String(key || '').trim();
    const encryptedKey = !trimmedUrl ? '' :
      secret ? encryptKey(secret) : old.encryptedKey;
    writeJSON(configFile, {url:trimmedUrl, encryptedKey});
    changed(encryptedKey && trimmedUrl ?
      'Google Táblázat beállítva. Az automatikus küldés aktív.' :
      'Google kapcsolat nincs beállítva. A helyi eredmények megmaradnak.');
    if (trimmedUrl && encryptedKey) void flush();
    return getStatus();
  }
  function enqueue(event) {
    const payload = validateEvent(event);
    if (queue.some(x => x.eventId === payload.eventId)) return getStatus();
    const next = queue.concat([payload]);
    writeJSON(queueFile, next); // előbb tartós mentés, utána hálózati művelet
    queue = next;
    changed('Versenyeredmény biztonságosan mentve; feltöltésre vár.');
    void flush();
    return getStatus();
  }
  async function doFlush() {
    if (sending || !queue.length) return getStatus();
    const cfg = getConfig();
    if (!cfg.url || !cfg.encryptedKey) {
      changed('A feltöltés várakozik: add meg a Google Táblázat adatait.');
      return getStatus();
    }
    let secret;
    try { secret = decryptKey(cfg.encryptedKey); }
    catch (_) {
      changed('A Google-kulcs nem olvasható. Add meg újra a beállításokban.');
      return getStatus();
    }
    sending = true;
    changed('Google Táblázat elérése, küldés folyamatban…');
    try {
      while (queue.length) {
        const event = queue[0];
        // Főfolyamati HTTPS kérés: nem akad el a böngészős CORS-korlátozáson.
        // Csak a szerver megerősítő válasza után törlünk a helyi sorból.
        const response = await fetchImpl(cfg.url, {
          method:'POST',
          headers:{'Content-Type':'text/plain;charset=UTF-8'},
          body:JSON.stringify({...event, secret}),
          signal:AbortSignal.timeout(15000),
          redirect:'follow'
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const ack = await response.json();
        if (!ack || ack.ok !== true || String(ack.eventId) !== event.eventId) {
          throw new Error('A Google Táblázat nem igazolta vissza az eredményt.');
        }
        const next = queue.slice(1);
        writeJSON(queueFile, next);
        queue = next;
        lastSuccessAt = new Date().toISOString();
        changed(queue.length ? 'Eredmény feltöltve, következő küldése…' :
          '✅ Minden versenyeredmény visszaigazoltan feltöltve.');
      }
    } catch (_) {
      changed('Nincs elérhető Google-kapcsolat, vagy hibás válasz érkezett. Az eredmények helyben várakoznak; automatikusan újrapróbáljuk.');
    } finally {
      sending = false;
      changed();
    }
    return getStatus();
  }
  // Az egyszerre érkező időzítős, kézi és online-indítások ugyanazt a kérést várják.
  let inFlight = null;
  function flush() {
    if (!inFlight) inFlight = doFlush().finally(() => { inFlight = null; });
    return inFlight;
  }
  return {getStatus, saveConfig, enqueue, flush};
}

module.exports = {createGoogleSync, validGoogleUrl, validateEvent};
