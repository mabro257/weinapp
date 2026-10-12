# Weinbewertungs-App: Projektstand

Stand 10.10.2026. Ersetzt die ursprüngliche Übergabe. Alle hier genannten Entscheidungen sind vom Nutzer bestätigt.

## Ziel

Mobile Web-App (PWA) für einen kleinen Freundeskreis: Weine bewerten, Verkostungen als Erinnerung festhalten, im Restaurant eine Entscheidungshilfe bekommen, persönliche Statistik je Rebsorte. Nur Deutsch, kein Offline-Betrieb, keine Push-Nachrichten.

## Technik

| Baustein | Wahl |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, React Router, vite-plugin-pwa |
| Backend | Supabase (Postgres, Auth, Storage), Region Frankfurt, Free-Plan |
| Hosting | Netlify (Build aus GitHub, `netlify.toml`) |
| Mailversand | Brevo SMTP (Free), weil der Supabase-Standard nur ~2 Mails/Stunde schafft |
| Backup | GitHub Action, nächtlich `pg_dump` als Artifact (30 Tage), hält das Projekt zugleich aktiv |

Ohne Umgebungsvariablen läuft die App im **Demo-Modus** mit Beispieldaten im Browser (`src/lib/mockApi.ts`), mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` gegen Supabase (`src/lib/supabaseApi.ts`). Beide setzen dieselbe Schnittstelle `Api` um (`src/lib/api.ts`).

## Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Login | E-Mail mit **6-stelligem Code** (OTP), kein Link, weil Links auf dem iPhone in Safari statt in der installierten App landen. Jeder darf sich registrieren. |
| Wein-Identität | Wein jahrgangsunabhängig. Jahrgang ist ein optionales Feld der Bewertung, Drilldown auf der Detailseite. |
| Bewertung | 1–100 per Schieberegler plus −/+ zum Feinjustieren. Optional Körper, Säure, Tannin (Skala 1–5), Notiz, Datum, Ort/Anlass als Tags. Mehrere Bewertungen pro Wein erlaubt. |
| Ort/Anlass | Freitext wird zum Tag, frühere Tags werden vorgeschlagen. Kein GPS. Kein Einfluss auf Statistik oder Empfehlung. |
| Rebsorten | Mehrere pro Wein, die erste ist die **Hauptrebsorte**. Nur sie zählt für Boxplots und Decider. Synonyme (Spätburgunder = Pinot Noir) sind im Glossar hinterlegt und durchsuchbar. |
| Etikettfoto | Optional, beim Anlegen oder bei jeder Bewertung, solange der Wein noch kein Bild hat. Wird im Browser auf 800 px verkleinert und als WebP gespeichert. |
| Katalog | Kuratiert, groß vorbefüllt. Neue Weine sind sofort bewertbar. Beim Anlegen werden ähnliche Weine angezeigt. Der Admin kann Dubletten zusammenführen (`merge_wines`). |
| Suche | Postgres `pg_trgm` + `unaccent`. Alle Suchwörter müssen passen (exakt oder ähnlich), Treffer im Namen zählen mehr. Durchsucht Name, Weingut, Region, Land, Rebsorten inkl. Synonymen. |
| Community | Durchschnitt aller Nutzer je Wein und Jahrgang über eine Datenbankfunktion. Einzelbewertungen, Notizen und Orte anderer bleiben privat. |
| Boxplots | Quartile inklusiv (wie Excel `QUARTILE.INC`). Unter 5 Werten nur Punkte, 5–9 Werte Linien Min–Max, ab 10 Werten Tukey (1,5 × IQR) mit Ausreißern. Mehrfachbewertungen zählen einzeln. Achse 70–100. |
| Decider | Regelbasiert: Hauptrebsorte 45 %, Region 20 %, Geschmacksnähe 15 %, Community 20 %. Wenige Bewertungen werden zum eigenen Schnitt hin gedämpft. Jede Empfehlung mit Begründung und Sicherheitsstufe. Der Preis wird angezeigt, aber nicht bewertet. |
| Glossar | 134 Rebsorten mit Texten von Claude, vom Admin zu prüfen (`src/lib/grapesData.ts`, daraus `supabase/02_glossar.sql`). Weitere 569 seltene Sorten aus dem Katalog ohne Text, nur über die Suche sichtbar. Lugana = Rebsorte Turbiana. |
| Design | Entwurf A: hell, rund, eine Akzentfarbe Beere `#8E2A4B`, Plus Jakarta Sans. Breite fließend, auf großen Bildschirmen auf 576 px begrenzt. |
| Deployment | Zuerst Demo-Modus, dann Supabase. Änderungen gesammelt hochladen (Netlify: 15 Credits pro Veröffentlichung, 300 pro Monat). |

## Datenmodell (`supabase/01_schema.sql`)

- `profiles`: Anzeigename, Admin-Flag. Wird bei der Registrierung automatisch angelegt. Nutzer dürfen nur den Namen ändern.
- `grapes`: Rebsorte, Synonyme, Farbe, Glossarfelder.
- `wines`: Katalog. `source` (import/manuell/demo), `status` (offen/geprüft), `merged_into` für Dubletten, `search_text` per Trigger.
- `wine_grapes`: Rebsorten je Wein mit `position` (1 = Hauptrebsorte).
- `ratings`: Bewertungen, nur für den Eigentümer sichtbar.
- Funktionen: `search_wines`, `similar_wines`, `wine_community`, `grape_community`, `set_wine_label`, `merge_wines`.
- Storage-Bucket `labels` (öffentlich lesbar, Upload nur angemeldet, max. 2 MB).

Getestet am 10.10.2026 gegen Postgres (PGlite) mit nachgebauter Supabase-Umgebung: Schema, Seeds (wiederholbar), Suche inkl. Tippfehler/Synonym/Akzent, Zugriffsregeln (kein Selbst-Admin, keine fremden Bewertungen, keine Glossaränderung ohne Admin), Community-Funktionen, Etikett und Merge.

## Roadmap

1. ✅ Datenmodell, Schema, Zugriffsregeln
2. ✅ Projekt-Setup (Vite, React, TS, Tailwind, PWA, Netlify-Konfiguration)
3. ✅ Anmeldung per E-Mail-Code, Profil
4. ✅ **Großer Katalogimport** aus X-Wines (CC0, 100.646 Weine, alle Länder). Daten in `data/`, Import per GitHub Action „Katalog-Import" (`supabase/05_katalog_import.sql`). 95 % der Rebsorten-Angaben sind auf Glossar-Sorten abgebildet. Getestet gegen Postgres: Import ca. 40 s, Datenbank ca. 105 MB, Suche 0,1 bis 0,6 s.
5. ✅ Bewertungsablauf inkl. Foto, Tags, Jahrgang
6. ✅ Detailseite nach Entwurf A
7. ✅ Restaurant-Decider
8. ✅ Glossar und Boxplots
9. ⏳ Online bringen nach `ANLEITUNG.md`, Test mit dem Freundeskreis

## Update 12.10.2026

- Reiter **Geschmack** statt Rebsorten: Geschmacksprofil, Matrix Körper × Säure, „Probier mal"-Empfehlungen, Verlässlichkeit je Rebsorte (seltene Sorten zusammengefasst).
- **Glossar** nach Farbe und Stilgruppe geordnet (je 4 Gruppen für Rot und Weiß), seltene Sorten nur über die Suche.
- **Suche**: Etikettbild bzw. farbiges Glas als Vorschau, beste Treffer oben und fett.
- **Merkliste**: Weine merken (Tabelle `saved_wines`), Liste unter „Ich".
- **Open Food Facts** (ODbL): ca. 5.900 zusätzliche Weine, Quellenhinweis unter „Ich".
- Jacques' Wein-Depot: kein automatischer Abzug des Sortiments (Datenbankrecht § 87b UrhG), stattdessen Abgleich gekaufter Weine auf Zuruf.

## Update „Sozial"

Entwürfe S1–S9 im Design-Canvas, Seite „Sozial", vom Nutzer freigegeben.

| Thema | Umsetzung |
| --- | --- |
| Gruppen | Tabellen `groups`, `group_members`. Anlegen per `create_group`, Beitritt per Einladungslink `/beitreten/CODE` (`join_group`). Eine Person kann in mehreren Gruppen sein. Admin = Ersteller. |
| Sichtbarkeit | `ratings.shared` (Standard an, bestehende Bewertungen sichtbar). Gilt für Note, Notiz, Ort und alle eigenen Gruppen. Pro Bewertung umschaltbar. Community-Werte zählen nur noch dich und deine Gruppen. |
| Weinabend | `tastings`, `tasting_wines`, `ratings.tasting_id`. Noten der anderen bis zur Auflösung verborgen (Zugriffsregel), Fortschritt über `tasting_progress`. Nur der Gastgeber pflegt Weine und löst auf. Keine Blindverkostung. |
| Gruppen-Decider | Modus „Für den Tisch": Passung je Person über den normalen Decider, Tischwert = Schnitt − halbe Differenz zum Schwächsten. |
| Empfehlen | `recommendations`, nur an Mitglieder der eigenen Gruppen. Erscheint unter „Für dich empfohlen", mit „Auf die Merkliste". |
| Geschmackszwilling | ab 5 gemeinsamen Weinen: 75 % Notenabstand, 25 % Profilähnlichkeit. Tipps = Weine ab 88 Punkten, die du nicht kennst. |
| Abzeichen | 12 Abzeichen, im Browser aus eigenen Daten berechnet. „Etikett-Profi" aus dem Entwurf ersetzt durch „Notizbuch" (Fotos werden nicht pro Nutzer gezählt). |

Getestet gegen Postgres (PGlite): Fremde sehen nichts, private Bewertungen bleiben privat, Weinabend-Noten erst nach Auflösung, nur Host steuert den Abend, Empfehlungen nur an Gruppenmitglieder, nach Austritt keine Sicht mehr.

## Offene Punkte

- Glossartexte prüfen. Weitere Rebsorten ergänzen, sobald der Katalog importiert ist.
- Admin-Oberfläche in der App (Freigabe, Dubletten) statt SQL, falls gewünscht.
- Gewichte im Decider nach ersten Erfahrungen nachjustieren.
- Barcode-Scan über Open Food Facts (nicht geprüft).
