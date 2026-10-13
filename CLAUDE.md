# WineWithFriends (Weinbewertungs-App): Kontext für Claude

Stand 13.10.2026, App-Name **WineWithFriends** (Titel, Manifest, Login, Einladung). Diese Datei wird in Claude Code automatisch geladen. Ausführlich: `PROJEKT.md` (Entscheidungen), `ANLEITUNG.md` (Schritte für den Nutzer), `tools/README.md` (Hilfsskripte).

## Nutzer und Arbeitsweise

- Nutzer: Marcel. Antworten **auf Deutsch**, kurz, Antwort zuerst. Er liest oft am Smartphone.
- Keine Programmier-, Supabase- oder Postgres-Erfahrung: jeden Schritt klickgenau erklären (Menüpfade, Buttonnamen), technische Entscheidungen trifft Claude.
- **Vor größeren Funktionen zuerst Entwürfe zeigen** (Design-Canvas, siehe unten), erst nach Freigabe bauen. Kleine Korrekturen direkt umsetzen. Seit Update 4 sagt der Nutzer meist „umsetzen": dann direkt bauen und im Bericht die getroffenen Gestaltungsentscheidungen nennen.
- Ergebnisse immer selbst prüfen (Typecheck, Build, Browser-Test im Demo-Modus, SQL gegen PGlite), dann ehrlich berichten, was getestet ist und was nicht.

## Wichtige Einschränkungen beim Nutzer

- Firmenrechner **ohne Admin-Rechte**, **kein Node, kein Git** installiert. Claude lädt für Tests eine portable Node-Version (nodejs.org, ZIP, Prüfsumme prüfen) in seinen Arbeitsordner, nachdem der Nutzer zugestimmt hat. Entpacken mit `tar -xf` (Expand-Archive scheitert an langen Pfaden).
- Firewall-Meldung zu Node.js beim lokalen Testserver: Nutzer soll „Abbrechen" klicken.
- **Hochladen nur über die GitHub-Weboberfläche.** Drag-and-drop ganzer Ordner hat Dateien flach abgelegt. Deshalb immer **ordnerweise Upload-Links** angeben: `https://github.com/mabro257/weinapp/upload/main/<ordner>`. Dateien mit Punkt (`.github`, `.gitignore`) prüfen lassen.
- Geänderte Dateien als ZIP-Paket liefern (Ordnerstruktur wie im Repository) plus Tabelle „Link → Dateien".
- Einzelne Dateien alternativ über den Stift (Edit) in GitHub ersetzen lassen: Volltext zum Einfügen liefern.
- **Netlify Free: 300 Credits/Monat, 15 pro Deploy.** Vor mehrteiligen Uploads „Stop builds", danach „Activate builds" + „Trigger deploy".
- Supabase SQL Editor zeigt bei Skripten mit Tabellen manchmal „table without RLS": **„Run and enable RLS"** wählen (Fehlalarm, RLS ist in den Skripten gesetzt).
- Browser-Test im Demo-Modus: Die PWA cacht per Service Worker; nach neuem Build Service Worker abmelden und Caches löschen, sonst läuft die alte Version.
- PowerShell-Fallen: Dateien immer als UTF-8 ohne BOM schreiben (`[IO.File]::WriteAllText(..., New-Object Text.UTF8Encoding $false)`), nie `Get-Content`/`Set-Content` ohne Encoding (hat schon Umlaute zerstört). Deutsche Anführungszeichen „…" in PowerShell-Strings brechen den Parser, dann besser das Edit-Werkzeug nutzen.

## Technik

- React 19, Vite 8, TypeScript 7, Tailwind CSS 4 (Theme in `src/index.css`, Grundstile in `@layer base`, sonst überschreiben sie `text-white`), React Router 7, vite-plugin-pwa, supabase-js.
- Hosting Netlify (Build aus GitHub, `netlify.toml`), Backend Supabase (Frankfurt, Free), Mailversand Brevo SMTP, Login per 6-stelligem E-Mail-Code (Vorlagen „Confirm signup" und „Magic Link" zeigen `{{ .Token }}`).
- Ohne `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` läuft die App im **Demo-Modus** (`src/lib/mockApi.ts`, `mockSocial.ts`, Beispieldaten `demoData.ts`, localStorage-Schlüssel `weinapp-demo-v2`). Beide Umsetzungen erfüllen das Interface `Api` in `src/lib/api.ts`. Neue Funktionen immer in beiden umsetzen.
- Logik: `decider.ts` (regelbasiert), `stats.ts` (Boxplot, QUARTILE.INC, Tukey ab 10), `taste.ts` (Profil und Matrix nach **neutraler Einordnung**: Katalog-Körper/Säure, sonst Rebsorte, nie die eigene Angabe; Top 5; Stilgruppen; Empfehlungen), `naming.ts` (Namensregel), Hilfetexte `HELP` in `text.ts`, `social.ts` (Zwilling, Gruppen-Decider, Abzeichen), `grapesData.ts` (134 Glossar-Rebsorten, Quelle für `02_glossar.sql`).
- Seiten in `src/pages`, Navigation: Suche, Decider, Freunde, Geschmack, Ich.

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

`05` braucht `num_words` aus `09`. Live beim Nutzer: bis Update 5 (10a/10b). Geliefert, Upload offen: Update 6 (11, Preisklassen, Weinabend löschen). **Am Anfang beim Nutzer nachfragen.**

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
