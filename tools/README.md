# Hilfsskripte (nicht Teil der App)

Werden nur lokal von Claude genutzt, Netlify baut sie nicht mit. Ausführen mit Node 22 (portable Version reicht).
Vorher einmalig in diesem Ordner: `npm install @electric-sql/pglite` (für die Tests).

| Skript | Zweck | Aufruf |
| --- | --- | --- |
| `gen-sql.mjs` | erzeugt `supabase/02_glossar.sql` und `03_beispielweine.sql` aus `src/lib/grapesData.ts` und `demoData.ts` | `node tools/gen-sql.mjs .` |
| `build-import.mjs` | baut `data/katalog.csv.gz` und `data/rebsorten_extra.csv` aus der X-Wines-CSV | `node tools/build-import.mjs <XWines_Full_100K_wines.csv> .` |
| `build-off.mjs` | baut `data/off_katalog.csv.gz` aus dem Open-Food-Facts-Abruf | `node tools/build-off.mjs <off-wines.json> .` |
| `fetch-off2.mjs` | lädt Weine aus Open Food Facts (API, max. 1.000 je Abfrage, deshalb in Teilmengen; dauert ca. 30 Min.) | `node tools/fetch-off2.mjs off-wines.json` |
| `xwines.mjs` | CSV-Parser für X-Wines, `stats`-Auswertung | `node tools/xwines.mjs stats <csv>` |
| `make-icons.mjs` | erzeugt die PNG-App-Icons | `node tools/make-icons.mjs public` |
| `test-sql.mjs`, `test-import.mjs`, `test-06.mjs`, `test-08.mjs`, `test-09.mjs` | testen die SQL-Skripte gegen PGlite (Postgres im Prozess) mit nachgebautem Supabase (auth.uid, Rollen, Storage) | `node tools/test-08.mjs .` |

Rohdaten sind nicht im Repository: X-Wines-CSV (Google Drive der Autoren, Ordner „last", Datei `XWines_Full_100K_wines.zip`, CC0) und der Open-Food-Facts-Abruf (`fetch-off2.mjs`).
Die Testskripte erwarten als Argument den Projektordner (bzw. bei test-sql den Ordner `supabase`); Pfade ggf. anpassen.
