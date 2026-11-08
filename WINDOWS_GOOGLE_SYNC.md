# Windows eredménybeíró – automatikus Google Táblázat-küldés

A Windows változat ugyanazt a versenyadat-csomagot állítja elő, mint a
[meglévő Android alkalmazás](https://github.com/kissjaniapp/Gyakorl-be-r-app).
A 3 gyakorló és 9 éles kör, a futamok/csoportok, a pont+idő/csak pont,
a rangsor, a JPEG- és Excel-mentés eredeti logikáját nem változtatja meg.

## Működés

1. A főképernyőn nyisd le a **Google Táblázat – automatikus eredményküldés**
   részt. Egyszer add meg a Google Apps Script \`/exec\` URL-jét és a közös kulcsot.
   A beállítások a Windows felhasználói profiljában maradnak.
2. A verseny utolsó futamának lezárásakor az alkalmazás **először helyben**
   elmenti a teljes eredménycsomagot, akkor is, ha nincs internet.
3. Internet esetén az Electron főfolyamata HTTPS POST kérést küld a meglévő
   \`GoogleAppsScript.gs\` fogadónak. Csak \`{"ok":true,"eventId":"..."}\`
   visszaigazolás után távolítja el az adott versenyt a helyi sorból.
4. Internetkimaradás / Arduino helyi Wi-Fi / hibás Google-válasz esetén az
   eredmény várakozik. Amíg a program fut, 15 másodpercenként újrapróbálja.
   A következő programindításkor is automatikusan feldolgozza a sorát.
5. A versenyazonosító változatlan újrapróbálkozáskor. A fogadó Apps Script
   azonos versenyazonosítóval a korábbi sorokat lecseréli, így nincs duplikátum.

Az eredmények a Windows felhasználói adatkönyvtárában (\`userData\`),
\`google-pending-results.json\` fájlban vannak. A közös kulcs titkosítását
a Windows védett titkosítási szolgáltatása (Electron \`safeStorage\`) végzi.
A kulcsot **ne** írd be a nyilvános GitHub-forráskódba.

**Fontos:** a program bezárt állapotban nem fut és nem tölthet fel.
Ha az internet csak bezárás után érkezik meg, a következő indításkor
próbálkozik újra. Az el nem küldött versenyeket ne töröld a felhasználói
adatkönyvtárból.

**Arduino:** a két hozzáférhető, összehasonlított GitHub projektben nincs
Arduino Wi-Fi kommunikációs protokoll vagy firmware-forrás. A jelen
módosítás az eredményeket fogadó / beíró Windows programot egészíti ki
offline szinkronnal; **nem állítja**, hogy a hardver időmérő jelét is
automatikusan fogadja. Ahhoz az Arduino eredeti végpontjának és az
adatüzenetnek a leírása vagy kódja szükséges.

## Ellenőrzés

\`\`\`powershell
npm install
npm test
npm run dist
\`\`\`

A telepítő és a hordozható Windows EXE a GitHub Actions építés
\`Eredmeny-beiro-Windows\` artifactjából tölthető le.
