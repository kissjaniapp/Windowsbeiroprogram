# Windows eredménybeíró – Google kulcsok beépítve a telepítőbe

A Windows program ugyanazt a Google Apps Script /exec fogadót és adatformátumot
használhatja, mint a [meglévő Android alkalmazás](https://github.com/kissjaniapp/Gyakorl-be-r-app).

**Nem kell kulcsot vagy webcímet megadni a Windows alkalmazásban.**
Azok az EXE elkészítésekor épülnek bele, a GitHub Actions titkos beállításaiból.

## Egyszeri GitHub-beállítás (csak az EXE készítőjének)

A [Windowsbeiroprogram](https://github.com/kissjaniapp/Windowsbeiroprogram)
GitHub tárhelyen válaszd:

**Settings → Secrets and variables → Actions → New repository secret**

Vegyél fel két, pontosan így elnevezett titkot:

- \`GOOGLE_WEBAPP_URL\`: az Android alkalmazásban is használt
  \`https://script.google.com/macros/s/.../exec\` webalkalmazás-cím.
- \`GOOGLE_SHARED_KEY\`: pontosan az a közös kulcs, amit a
  \`GoogleAppsScript.gs\` fájlban a fogadó használ.

Ne tedd ezeket a titkokat publikus commitba vagy issue-ba.
Az URL és a kulcs csak a GitHub Actions titkos környezetéből
kerülhet a \`embedded-google-config.json\` fájlba az építés során.

A fájlt a \`.gitignore\` nem engedi véletlenül feltölteni. Ha a titkok
nincsenek beállítva, a tesztek sikeresen lefutnak, de a telepítő
összeállítása kihagyásra kerül. Így nem készül működésképtelen,
kulcs nélküli EXE, és a tesztek állapota nem jelenik meg hibásként.

## Telepítő készítése

A két titok felvétele után: **Actions → Windows telepito epitese → Run workflow**.
A sikeres futás **Artifacts → Eredmeny-beiro-Windows** részében
elérhető a telepítő és a hordozható EXE.

## Internet nélküli versenyek

- A 3 gyakorló + 9 éles kör, a futamok, a pont+idő vagy csak pont
  mód, a rangsor, a JPEG- és Excel-mentés logikája változatlan.
- A végső eredmények a Windows felhasználói profiljában,
  a \`google-pending-results.json\` fájlban várakoznak.
- A program működése közben 15 másodpercenként ellenőrzi, sikerül-e
  feltölteni az adatokat. A következő indítás után is újrapróbálja.
- Csak a Google Apps Script visszaigazolt \`ok:true\` és azonos
  \`eventId\` válasza után törlődik a helyi sorból az adott verseny.
- Az Apps Script azonos versenyazonosítóval lecseréli a korábbi sorokat,
  így hálózati probléma miatti újraküldés nem duplikálja a versenyt.

A beépített kulcs **nem tekinthető teljesen titkosnak**, mert egy
telepített kliensprogramból kellő hozzáféréssel kinyerhető. A GitHub
Actions titkok azt akadályozzák meg, hogy a kulcs a nyilvános
GitHub-forráskódba és naplókba kerüljön. Komolyabb védelemhez szerveroldali
hitelesítés szükséges.

**Arduino:** a két hozzáférhető GitHub projektben nem szerepelt
Arduino Wi-Fi-adatprotokoll vagy firmware-forrás, ezért a program
hardveres időfogadását nem módosítottuk. A jelen módosítás az
eredménybevitelt és automatikus Google-feltöltést érinti.
