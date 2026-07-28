# Ütemterv-sablonok

Az itteni JSON-fájlok kész munkastruktúrák (WBS). Új projekt indításakor a
kiválasztott sablon egy lépésben betöltődik a projekt fázisai közé, utána a nem
odavaló sorok törölhetők. A betöltést az `App\Support\PhaseTemplates` olvassa be
és az `App\Services\PhaseTemplateImporter` viszi be az adatbázisba.

## Formátum

```json
{
    "key": "hotel-standard",
    "name": "Hotel – standard ütemterv",
    "description": "Egy mondat arról, mire való.",
    "source": "Hotel_standard_utemterv_v3.mpp",
    "rows": [
        {"wbs": "1", "level": 0, "name": "TELJES PROJECT", "group": true},
        {"wbs": "1.1", "level": 1, "name": "Megrendelői feladatok", "group": true},
        {"wbs": "1.1.1", "level": 2, "name": "Építési engedély biztosítása", "group": false}
    ]
}
```

- A `rows` **mélységi (depth-first) sorrendben** áll — ebből épül fel a fa.
- A `level` 0-ról indul, és soronként legfeljebb eggyel nőhet.
- A `group: true` sor összegző fejléc: nincs saját dátuma és készültsége, azok a
  gyerekeiből gördülnek fel.
- A `milestone: true` opcionális (nulla időtartamú, kritikus pont).
- A `key` egyedi; az `App\Support\PhaseTemplates::DEFAULT_KEY` mondja meg, melyik
  töltődik be alapból új projektnél.

## Új sablon MS Project (.mpp) fájlból

A `.mpp` bináris formátum, PHP-ból nem olvasható. Egyszeri konverzióval
készítjük a JSON-t — a futó alkalmazásnak nincs szüksége Java-ra:

1. `.mpp` → MSPDI XML az [MPXJ](https://www.mpxj.org/) könyvtárral, Docker-ben:

   ```
   docker run --rm -v "$PWD:/w" -w /w maven:3.9-eclipse-temurin-21 bash -c \
     "mvn -q -B dependency:copy-dependencies -DoutputDirectory=libs && \
      javac -cp 'libs/*' -d out Dump.java && java -cp 'out:libs/*' Dump input.mpp out.xml"
   ```

   (a `pom.xml` egyetlen függősége `net.sf.mpxj:mpxj`, a `Dump.java` pedig
   `UniversalProjectReader` + `MSPDIWriter` — kb. tíz sor)

2. Az XML `<Task>` elemeiből kell a `Name`, `OutlineLevel`, `OutlineNumber`,
   `Summary` és `Milestone` mező. A Project összegző sora (`OutlineLevel = 0`)
   kimarad, a többinél `level = OutlineLevel - 1`.

3. A kész JSON ide kerül, `<kulcs>.json` néven. Kódmódosítás nem kell hozzá:
   a `PhaseTemplates` a mappa minden JSON-ját beolvassa.
