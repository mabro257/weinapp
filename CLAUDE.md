# WineWithFriends (Weinbewertungs-App): Kontext für Claude

Stand 25.10.2026, App-Name **WineWithFriends** (Titel, Manifest, Login, Einladung). Diese Datei wird in Claude Code automatisch geladen (über `../CLAUDE.md` im Ordner `Claude-Weinapp`). Ausführlich: `PROJEKT.md` (Entscheidungen), `ANLEITUNG.md` (Schritte für den Nutzer), `tools/README.md` (Hilfsskripte).

## Nutzer und Arbeitsweise

- Nutzer: Marcel. Antworten **auf Deutsch**, kurz, Antwort zuerst. Er liest oft am Smartphone.
- Keine Programmier-, Supabase- oder Postgres-Erfahrung: jeden Schritt klickgenau erklären (Menüpfade, Buttonnamen), technische Entscheidungen trifft Claude.
- **Vor größeren Funktionen zuerst Entwürfe zeigen** (Design-Canvas, siehe unten), erst nach Freigabe bauen. Kleine Korrekturen direkt umsetzen. Seit Update 4 sagt der Nutzer meist „umsetzen": dann direkt bauen und im Bericht die getroffenen Gestaltungsentscheidungen nennen.
- Ergebnisse immer selbst prüfen (Typecheck, Build, Browser-Test im Demo-Modus, SQL gegen PGlite), dann ehrlich berichten, was getestet ist und was nicht.

## Werkzeuge und Ablauf (seit 25.10.2026: Git statt Browser-Upload)

Firmenrechner **ohne Admin-Rechte**: alles portabel in `%LOCALAPPDATA%\weinapp-tools` (= `C:\Users\Marcel.Brockmann\AppData\Local\weinapp-tools`), immer mit vollem Pfad aufrufen.

| Werkzeug | Pfad |
| --- | --- |
| Git für Windows (portabel 2.56.0.3, inkl. Git Credential Manager) | `weinapp-tools\git\cmd\git.exe` |
| Node.js 22 (ZIP) | `weinapp-tools\node-v22.23.3-win-x64\node.exe` (für npm: Ordner vorne in `$env:PATH`) |
| npm-Cache | `weinapp-tools\npm-cache` (`$env:npm_config_cache`) |

- **Arbeitsordner = Git-Klon** `C:\Users\Marcel.Brockmann\Downloads\Claude-Weinapp\weinapp-git` (Branch `main`, remote `https://github.com/mabro257/weinapp.git`). Der alte Ordner `weinapp` daneben ist nur noch Archiv.
- **Anmeldung:** einmalig im Browser über den Git Credential Manager (`credential.helper=manager` im Repo), Token liegt in der Windows-Anmeldeinformationsverwaltung. Nie einen Token im Chat verlangen. Commit-Autor im Repo: „Marcel" / `mabro257@users.noreply.github.com`.
- **Ablauf:** ändern → prüfen (Typecheck `npm run typecheck`, Build `npm run build`, SQL-Tests `node tools/test-XX.mjs .`, Browser-Test Demo-Modus) → **lokal committen** → dem Nutzer Änderungen zeigen → **erst nach seiner Freigabe `git push`**.
- **Ein Push = ein Netlify-Deploy (15 von 300 Credits/Monat).** Änderungen sammeln, nicht für jede Kleinigkeit pushen.
- **SQL-Skripte** führt der Nutzer weiter selbst im Supabase SQL Editor aus (kein automatisches Einspielen). Datenbank-Änderungen immer als neues nummeriertes Skript, nach dem Push mit Klickanleitung.
- **Nie viele Dateien lokal per Node umschreiben/löschen** (Sophos-Ransomware-Schutz). Massenumwandlungen in Netlify-Build oder GitHub Actions.
- Commit-Texte immer über eine Datei übergeben (`git commit -F datei`, UTF-8 ohne BOM): Windows PowerShell 5.1 zerlegt Anführungszeichen in `-m "..."`.
- Zeilenenden: `core.autocrlf=true` (Standard von Git für Windows), Inhalte werden mit LF gespeichert. Neue Dateien als UTF-8 ohne BOM.
- Firewall-Meldung zu Node.js beim lokalen Testserver: Nutzer soll „Abbrechen" klicken. Testserver: `.claude/launch.json` im Ordner `Claude-Weinapp` (`vite preview` auf Port 4173).
- Beim Browser-Upload früher verloren gegangen und am 25.10.2026 korrigiert: `.gitignore` lag als `download`, `.env.example` als `env.example` im Repository.
- **Netlify Free: 300 Credits/Monat, 15 pro Deploy.**
- Supabase SQL Editor zeigt bei Skripten mit Tabellen manchmal „table without RLS": **„Run and enable RLS"** wählen (Fehlalarm, RLS ist in den Skripten gesetzt).
- Browser-Test im Demo-Modus: Die PWA cacht per Service Worker; nach neuem Build Service Worker abmelden und Caches löschen, sonst läuft die alte Version.
- PowerShell-Fallen: Dateien immer als UTF-8 ohne BOM schreiben (`[IO.File]::WriteAllText(..., New-Object Text.UTF8Encoding $false)`), nie `Get-Content`/`Set-Content` ohne Encoding (hat schon Umlaute zerstört). Deutsche Anführungszeichen „…" in PowerShell-Strings brechen den Parser, dann besser das Edit-Werkzeug nutzen.

## Technik

- React 19, Vite 8, TypeScript 7, Tailwind CSS 4 (Theme in `src/index.css`, Grundstile in `@layer base`, sonst überschreiben sie `text-white`), React Router 7, vite-plugin-pwa, supabase-js.
- Hosting Netlify (Build aus GitHub, `netlify.toml`), Backend Supabase (Frankfurt, Free), Mailversand Brevo SMTP, Login per 6-stelligem E-Mail-Code (Vorlagen „Confirm signup" und „Magic Link" zeigen `{{ .Token }}`).
- Ohne `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` läuft die App im **Demo-Modus** (`src/lib/mockApi.ts`, `mockSocial.ts`, Beispieldaten `demoData.ts`, localStorage-Schlüssel `weinapp-demo-v2`). Beide Umsetzungen erfüllen das Interface `Api` in `src/lib/api.ts`. Neue Funktionen immer in beiden umsetzen.
- Logik: `decider.ts` (regelbasiert), `stats.ts` (Boxplot, QUARTILE.INC, Tukey ab 10), `taste.ts` (Profil und Matrix nach **neutraler Einordnung**: Katalog-Körper/Säure, sonst Rebsorte, nie die eigene Angabe; Top 5; Stilgruppen; Empfehlungen), `naming.ts` (Namensregel), Hilfetexte `HELP` in `text.ts`, `social.ts` (Zwilling, Gruppen-Decider, Abzeichen), `grapesData.ts` (134 Glossar-Rebsorten, Quelle für `02_glossar.sql`).
- Seiten in `src/pages`, Navigation: Suche, Auswahl, Freunde, Geschmack, Ich. **„Auswahl" ist der sichtbare Name des früheren „Decider"** (seit 25.10.2026); im Code heißen Datei, Route und Funktionen weiter `decider`.
- Begriffe: immer **„Bewertung"** (nicht Verkostung/Verlauf), Datum „Getrunken am". Bestätigungen über `useConfirm()` aus `components/Confirm.tsx`, nie `window.confirm`.
- Einführung `IntroPage.tsx` (`/intro`): bei neuen Funktionen prüfen, ob sie dort erwähnt werden sollten. Regel des Nutzers: nichts als bekannt voraussetzen, jeden genannten Begriff kurz erklären, so wenig Text wie möglich.

## Datenbank (`supabase/`)

| Skript | Inhalt | Ausführung |
| --- | --- | --- |
| `01_schema.sql` | Tabellen, RLS, Suche, Storage | SQL Editor, einmalig |
| `02_glossar.sql` | Rebsorten (generiert) | SQL Editor, wiederholbar |
| `03_beispielweine.sql` | Demo-Weine | SQL Editor |
| `04_update_suche.sql` | schnellere Suche | SQL Editor |
| `05_katalog_import.sql` | X-Wines + Open Food Facts | **nur über GitHub Action „Katalog-Import"** (psql, `data/*.csv.gz`) |
| `06_weingut_iii_freunde.sql` | 11 Weine III Freunde (Linie „DREI FREUNDE") | SQL Editor |
| `07_update_merkliste_suche.sql` | Merkliste, Suche mit Etikett/„bester Treffer" (ersetzt search_wines aus 04) | SQL Editor |
| `08_sozial.sql` | Gruppen, Sichtbarkeit, Weinabende, Empfehlungen, Community nur Gruppen | SQL Editor |
| `09_update_zahlen_freunde.sql` | `num_words` (3 = drei = III im Suchtext), search_wines (ersetzt 07), ELF → DREI FREUNDE | SQL Editor |
| `10a_katalog_daten.sql` | Korrekturliste OFF (1.842 Umbenennungen, 283 Dubletten) in Schema `staging`, **generiert** von `tools/clean-off.mjs` | SQL Editor, vor 10b |
| `10b_namen_dubletten.sql` | `token_key`, `wine_similarity`, `similar_wine_ids`, neues `similar_wines`, `merge_wine_into` (zieht alles um), `merge_wines`, `duplicate_candidates`, `dismiss_duplicate`, Tabelle `duplicate_dismissed`; wendet 10a an und löscht `staging` | SQL Editor |

| `11_iii_freunde_weinabend.sql` | `token_key` mit Zahlwörtern (III = 3 = drei) und ohne „trocken/dry", III Freunde: „DREI FREUNDE Rosé" in „Rosé" zusammengeführt, „DREI FREUNDE" aus Namen entfernt, `delete_tasting(id, mit_bewertungen)` | SQL Editor, nach 10b |

| `12_weinabend_preis.sql` | `tasting_participants` + `is_tasting_participant` (ohne Einträge = ganze Gruppe), `set_tasting_participants`, `tasting_wines.visible` (neu = verdeckt), Bewertungsregel im Abend (restriktive Policy), `set_wine_price` | SQL Editor, nach 11 |

| `13_dubletten_schneller.sql` | Spalte `wines.match_key` (= token_key aus Name + Weingut, per Trigger) mit GIN-Trigramm-Index; `similar_wine_ids` über diesen Index (60 Kandidaten); `wine_similarity` ohne Einzelbuchstaben im Weingut und Deckel 0,6 bei klar anderem Weingut; Dublette ab 0,92 | SQL Editor, nach 12 (Backfill ca. 1 Min.) |

| `14_suche_schneller.sql` | Spalte `wines.name_norm` (= `name_norm(name)`: nur Buchstaben/Ziffern, Zahlwörter, Leerzeichen außen) mit Trigramm-Index; `search_wines` neu: exakte Suche zuerst (Kandidaten über Wortanfang im Namen, max. 3.000 je Quelle, plus eigene Weine), unscharfe Suche nur ohne exakten Treffer, Wörter mit 1 Zeichen ignoriert | SQL Editor, nach 13 (Backfill ca. 1 Min.) |

| `15_einfuehrung.sql` | `profiles.intro_seen_at`, Bestandsnutzer mit Bewertung = gesehen, `mark_intro_seen()` | SQL Editor |

`05` braucht `num_words` (09), `match_key`/`token_key` (13) und `name_norm` (14). Frische Installation: 01–04, 06–15, dann 05 per Action. Suchlaufzeit mit `tools/perf-suche.mjs . mit14` messen (Stand 14: 19 typische Suchen zusammen 1,0 s statt 13,4 s, einzeln 2–255 ms). Stand 25.10.2026: alles bis Update 9 ist live, alle SQL-Skripte bis 13 sind ausgeführt. Ab jetzt zeigt `git log` den Stand; nur ausgeführte SQL-Skripte beim Nutzer nachfragen.

Supabase bricht App-Anfragen nach **8 Sekunden** ab: Funktionen, die über den ganzen Katalog laufen, mit `tools/perf-dubletten.mjs` (voller Katalog in PGlite) messen. Stand Update 9: Dubletten-Prüfung 1,1 s bei 83 Weinen (wächst linear, ca. 13 ms je bewertetem/angelegtem Wein), „Gibt es schon?" 25–80 ms.

Texte: Nutzer will **kurze, untechnische Texte** (keine Erklärungen, wie gerechnet wird). Geschmacksmatrix startet mit Weiß.

Weinabend-Begriffe: „Bewertungen aufdecken" (nicht „auflösen"), Status in der DB bleibt `aufgeloest`. Zurück-Buttons nutzen `useBack` in `ui.tsx` (ohne Verlauf → Ausweichseite). Schrift: `font-variant-ligatures: no-common-ligatures`, sonst fehlt in „fi" der i-Punkt.

Preisklassen (Nutzer, 13.10.2026): € bis 5 €, €€ bis 10 €, €€€ bis 15 €, €€€€ über 15 € (Ladenpreis). Gespeichert wird weiter 1–4.

**Namensregel (vom Nutzer gefordert, 13.10.2026):** Name = Name des Weins vom Etikett, ohne Weingut und ohne Jahrgang; Weingut, Rebsorte, Region, Jahrgang in eigenen Feldern. Gleiche Logik dreifach: `src/lib/naming.ts` (Eingabehilfe, Demo-Ähnlichkeit), `tools/naming.mjs` (Katalogbereinigung), SQL `token_key`/`wine_similarity` (Stoppwortlisten synchron halten). Dublette = Ähnlichkeit ≥ 0,8 (Name ohne Weingut-Wörter 70 %, Weingut 30 %), Vorschlag beim Anlegen ab 0,45.

Backup: GitHub Action `backup.yml` nachts, pg_dump passend zur Serverversion (17), Secrets `SUPABASE_DB_URL` (Session pooler), `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Hält das Projekt zugleich aktiv.

## Links

- Repository (privat): https://github.com/mabro257/weinapp
- Design-Canvas (claude.ai-Artifact, Seiten „Version 1" und „Sozial"): https://claude.ai/artifact/9Y23dYJHg7m7cSvPh3oJER
- Datenquellen: X-Wines (CC0), Open Food Facts (ODbL, Quellenhinweis unter „Ich"). Vivino und Shops wie jacques.de nicht automatisch auslesen (Nutzungsbedingungen bzw. Datenbankrecht § 87b UrhG), stattdessen gezielte Ergänzung auf Zuruf wie bei III Freunde.

## Offen

- Jacques' Wein-Depot: Nutzer wollte gekaufte Weine schicken (Liste, Bestellhistorie oder Kassenbon), dann als SQL-Skript ergänzen.
- Maison Galhaud: Website war nicht erreichbar, nur 2 Weine im Katalog.
- Admin-Oberfläche: Dubletten prüfen (`/dubletten`) und Wein bearbeiten (`/wein/:id/bearbeiten`) sind da; Glossar pflegen fehlt noch.
- Decider-Gewichte nach Praxiserfahrung justieren. Decider ist bewusst nicht mehr auf der Startseite (Haupt-Use-Case ist Bewerten), nur in der Navigation.
- X-Wines-Säure ist grob (nur 2/3/4). Die Geschmacksmatrix nutzt sie trotzdem vorrangig (Nutzerwunsch: neutrale Einordnung vor Rebsorte).
- EAN-Scanner: geprüft und vom Nutzer **abgelehnt** (13.10.2026), nur ca. 5.900 Weine (Open Food Facts) haben einen Barcode.
- Etikettfoto: eigene Kamera `src/components/LabelCamera.tsx` (getUserMedia, Rahmen 4:5 wie die Vorschaubilder, Zuschnitt auf den Rahmen, Galerie-Fotos mittig auf 4:5). Auf echtem iPhone/Android noch nicht getestet, nur mit simulierter Kamera.
