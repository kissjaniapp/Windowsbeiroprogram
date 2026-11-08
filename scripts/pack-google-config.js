'use strict';
// Kizárólag építéskor fut: a titok csak az összeállított Electron-csomagba kerül,
// a nyilvános forráskódba vagy a GitHub naplóiba nem.
const fs = require('node:fs');
const path = require('node:path');
const {validGoogleUrl} = require('../google-sync');

const url = String(process.env.GOOGLE_WEBAPP_URL || '').trim();
const key = String(process.env.GOOGLE_SHARED_KEY || '').trim();

if (!validGoogleUrl(url) || !key) {
  console.error('Hiányzik a Google Apps Script URL vagy közös kulcs a GitHub Actions titkai közül.');
  console.error('Állítsd be: GOOGLE_WEBAPP_URL és GOOGLE_SHARED_KEY a Repository Settings → Secrets and variables → Actions alatt.');
  process.exit(1);
}
const dest = path.join(__dirname, '..', 'embedded-google-config.json');
fs.writeFileSync(dest, JSON.stringify({url,key}), {encoding:'utf8', mode:0o600});
console.log('Google-kapcsolat beépítve. Az értékek biztonsági okból nem kerülnek kiírásra.');
