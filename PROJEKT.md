# WineWithFriends: Projektstand

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

## Update 4 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Name | Die App heißt **WineWithFriends** (Seitentitel, Manifest, Home-Bildschirm, Anmeldeseite, Einladung). |
| III Freunde | Die Linie heißt „DREI FREUNDE", nicht „ELF FREUNDE" (3 Weine, `09` benennt um, `06` korrigiert). |
| Zahlen in der Suche | „3", „drei" und „III" finden sich gegenseitig (Zahlen 1–12, römisch ab II). Im Suchtext steht hinter Ziffer bzw. römischer Zahl das Zahlwort, Ziffern in der Suchanfrage werden zum Wort. Jahreszahlen bleiben unberührt. |
| Etikett-Kamera | Eigene Kamera-Ansicht mit Etikett-Rahmen (Hochformat 4:5 wie die Vorschaubilder). Das Foto wird auf den Rahmen zugeschnitten, danach Vorschau mit „Nochmal"/„Verwenden". Fotos aus der Galerie werden mittig auf 4:5 zugeschnitten. Ohne Kamerazugriff bleibt die Galerie. |
| EAN-Scanner | Geprüft und verworfen: nur ca. 5.900 Weine (Open Food Facts) haben einen Barcode, X-Wines keinen. |

Getestet: `09` gegen Postgres (PGlite) inkl. zweitem Lauf und erneutem `06`, Suche „3/drei/iii freunde", „3 Talente", „No. 1"; Typecheck, Build; Kamera im Demo-Modus mit simulierter Kamera (Zuschnitt stimmt mit dem Rahmen überein), Meldung ohne Kamerazugriff. Nicht getestet: echte Handykamera.

## Update 5 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Namensregel | **Name = Name des Weins vom Etikett, ohne Weingut und ohne Jahrgang.** Weingut, Rebsorten, Region und Jahrgang (in der Bewertung) stehen in eigenen Feldern. Steht nur die Rebsorte drauf, ist sie der Name. |
| Neuanlage | Hinweisbox mit Regel und Beispiel, Live-Prüfung des Namens (Jahrgang, Weingut im Namen, Großbuchstaben) mit einem Korrekturvorschlag, Vorschau „So erscheint der Wein", Rückfrage bei fehlendem Weingut, „Gibt es schon?" unabhängig von Wortreihenfolge. |
| Katalog bereinigt | Open Food Facts: 1.842 Namen nach der Regel korrigiert, 283 Dubletten (zu X-Wines oder untereinander) zusammengeführt, z. B. „Lugana - I Frati" (Ca del Frati) → „I Frati Lugana" (Cà dei Frati). |
| Dubletten | Zusammenführen zieht alles um (Bewertungen, Merkliste, Weinabende, Empfehlungen, Etikett, Rebsorten). Admin-Seite „Dubletten prüfen" unter „Ich" für selbst angelegte und bewertete Weine; „Kein Duplikat" merkt sich die Entscheidung. Ähnlichkeit: Weinname ohne Weingut-Wörter 70 %, Weingut 30 %, Dublette ab 0,8. |
| Bearbeiten | „Angaben zum Wein korrigieren" auf der Weinseite für Admin und für den Ersteller, solange der Wein ungeprüft ist. |
| Geschmacksmatrix | Weine werden neutral eingeordnet: Körper und Säure aus dem Katalog, sonst die Tendenz der Hauptrebsorte, nie die eigene Angabe. Gilt auch für „Dein Profil" und den „Sweet Spot". Feld antippen zeigt die eigenen Weine dort. |
| Meine Top 5 | Unter „Geschmack": Durchschnitt je Wein über alle Verkostungen, unabhängig von Zeitpunkt und Rebsorte. |
| Hilfe bei der Bewertung | Fragezeichen bei Gesamtnote, Körper, Säure und Tannin öffnen eine Erklärung: was es ist, woran man es erkennt, Beispiele für niedrig und hoch. |
| Decider | Allgemein formuliert („Unsicher zwischen mehreren Weinen?"), Beispiele Restaurant, Supermarkt, Weinhändler, Geschenk. Modus „Für mehrere" statt „Für den Tisch". Nicht mehr auf der Startseite, nur in der Navigation. |

Getestet: 10a/10b gegen Postgres (PGlite), auch zweimal hintereinander. Geprüft wurden die Zusammenführung inklusive Merkliste, Weinabend und Empfehlung, die Zugriffsregeln (nur Admin), dass Rosso und Brunello vom selben Weingut keine Dublette sind, dass Tippfehler beim Anlegen trotzdem gefunden werden, und der Katalog-Import mit den bereinigten Daten. Dazu Typecheck, Build und alle neuen Ansichten im Demo-Modus.

## Update 6 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Preisklassen | € bis 5 €, €€ bis 10 €, €€€ bis 15 €, €€€€ über 15 € (Ladenpreis). Gespeichert wird weiterhin 1–4, bestehende Angaben gelten jetzt nach der neuen Skala. |
| Dubletten mit Zahlen | Der Vergleich behandelt „III", „3" und „drei" gleich, „trocken"/„dry" zählen nicht. Die Eingabehilfe erkennt das Weingut im Namen auch in anderer Schreibweise („DREI FREUNDE Rosé" bei „III Freunde"). |
| III Freunde | „DREI FREUNDE Rosé" mit „Rosé" zusammengeführt. „DREI FREUNDE Riesling/Grauburgunder" heißen jetzt „Riesling"/„Grauburgunder" und erscheinen unter „Dubletten prüfen" neben „Riesling" bzw. „Grauburgunder Trocken" aus dem Katalog; der Admin entscheidet. |
| Weinabend löschen | Gastgeber kann einen Abend absagen (laufend) bzw. löschen (aufgelöst). Schalter „Alle Bewertungen löschen": an = Bewertungen des Abends für alle gelöscht; aus = sie bleiben als normale Bewertungen ohne Bezug zum Abend (bisher verdeckte Noten werden dadurch für die Gruppe sichtbar, der Hinweis steht im Dialog). |

Getestet: 11 gegen Postgres (PGlite), auch zweimal hintereinander, zusammen mit erneutem 06. Bewertungen ziehen beim Zusammenführen mit um, nur der Gastgeber darf löschen, beide Löschvarianten funktionieren. Dazu Typecheck, Build und im Demo-Modus Namenshilfe, Preistext und Weinabend löschen.

## Update 7 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Einladungslink | Gruppenseite mit Menü unten. „Zurück" führt ohne Verlauf (App über Link geöffnet) zu „Freunde" bzw. zur Startseite. |
| Weinabend: Teilnehmer | Der Gastgeber wählt beim Anlegen und später („Ändern"), wer aus der Gruppe dabei ist. Nur Teilnehmer sehen den Abend und können bewerten. Ältere Abende: ganze Gruppe. |
| Weinabend: verdeckte Weine | Neue Weine sind verdeckt; der Gastgeber schaltet sie mit dem Auge einzeln sichtbar oder „Alle zeigen". Teilnehmer sehen und bewerten nur sichtbare Weine (auch in der Datenbank abgesichert). Nach dem Aufdecken sind alle sichtbar. |
| Weinabend: Bedienung | Klick auf einen Wein führt immer zur Bewertung. Button „Bewertungen aufdecken" statt „Abend auflösen". Datum: „Noch 3 Tage", „Morgen", „Heute", danach „Läuft". |
| Freunde | Decider-Kachel entfernt (nur im Menü). Erhaltene Empfehlungen lassen sich „Ablehnen" (löschen). |
| Geschmacksmatrix | Zahl nur bei bewerteten Weinen, keine Rebsorten-Anzahl, keine gestrichelte Markierung mehr. |
| Preisklasse | Immer auf der Weinseite. Fehlt sie, kann jeder sie mit einem Tipp nachtragen (danach nur Admin/Ersteller änderbar). |
| Preis-Leistung | Unter „Geschmack": Durchschnittsnote je Preisklasse (Ø je Wein), Aussage „Weine ab 10 € bewertest du X Punkte besser", „Gut und günstig (bis 10 €)", Hinweis auf Weine ohne Preisklasse. |
| Kleinigkeiten | i-Punkt in „Profil" (Schrift-Ligatur abgeschaltet), keine Trennlinie unter dem letzten Wein unter „Ich". |

Getestet: 12 gegen Postgres (PGlite), auch zweimal hintereinander. Geprüft wurden die Teilnehmerregeln, verdeckte Weine, Bewerten nur sichtbarer Weine und nur während der Abend läuft, Preisklasse nachtragen und Empfehlung ablehnen. Dabei wurde ein Fehler gefunden und behoben: Der Gastgeber konnte einen neuen Abend nicht anlegen. Dazu Typecheck, Build und im Demo-Modus Einladungslink, Weinabend, Preisklasse, Preis-Leistung, Matrix und „Ich". Nicht getestet: die Sicht eines Teilnehmers in der App (im Demo-Modus bist du immer Gastgeber).

## Update 8 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Weinabend-Datum | Gastgeber kann das Datum nachträglich ändern („Datum ändern" unter dem Titel). |
| Bewertung im Weinabend | Ist ein Wein schon bewertet, öffnet ein Klick die bestehende Bewertung zum Ändern („Bewertung ändern"), statt eine zweite anzulegen. |
| Reiter „Ich" | Ganz oben die Kachel „Meine Bewertungen" (Anzahl, Ø Note, Rebsorten). Dahinter eigene Seite `/ich/bewertungen` mit Suche und Filtern nach Ort/Anlass als umbrechende Auswahl (erste 8, „Alle anzeigen"), nicht mehr seitlich scrollend. |
| Login | Hinweis auf den Spam-Ordner schon vor dem Anfordern und nach dem Versand. Überschrift „WineWithFriends". |
| Geschmacksmatrix | Weiß vorausgewählt, Säure-Achse mit „mild" und „frisch". |
| Kürzere Texte | Decider: nur Überschrift und eine Frage, kurzer Hinweis im Auswahlfeld. „Geschmack": technische Erklärungen entfernt bzw. auf einen Satz gekürzt. |

Getestet: Typecheck, Build und im Demo-Modus Datum ändern, Bewertung im Weinabend ändern (keine Doppelbewertung), „Ich" und „Meine Bewertungen" samt Filtern, Matrix, Decider und Login.

## Update 9 (13.10.2026)

| Thema | Umsetzung |
| --- | --- |
| Decider: Auswahl | Derselbe Wein bzw. dieselbe Rebsorte kann nicht zweimal gewählt werden (in der Trefferliste „schon gewählt", sonst Hinweis). Im Modus „Für mehrere" erscheint „Wähle mindestens eine Person aus.", wenn niemand aktiv ist. |
| Decider: Einordnung | Über den Ergebnissen ein Satz mit Begründung, z. B. „Barolo liegt knapp vor Riesling, denn du kennst ihn schon und gibst ihm im Schnitt 89." Abstufung: klare Sache (≥ 5 Punkte), knapp vorn (2–4), knappe Entscheidung (< 2); Hinweis bei geringer Sicherheit. Für mehrere: „bester Kompromiss, alle liegen zwischen X und Y". |
| Decider: Preis | Preisfeld und Preisanzeige entfernt. |
| Dubletten-Seite | Zeigt „Keine Dubletten vorhanden" bzw. einen Fehler mit „Nochmal versuchen" statt einer leeren Seite. |
| Dubletten-Prüfung | Ursache der leeren Seite: Die Prüfung dauerte mit dem vollen Katalog ca. 15 s, Supabase bricht nach 8 s ab. Jetzt gespeicherter Vergleichsschlüssel mit Index: 1,1 s. Zudem genauer: Dublette erst bei praktisch gleichem Namen und passendem Weingut („J. Riehl" ≠ „J. Bäumer", „Prosecco Brut" ≠ „Prosecco Rosé Brut"). |

Getestet: Laufzeit und Ergebnis mit dem vollen Katalog (106.907 Weine) in PGlite: 13 Paare mit Fehlalarmen in 14,6 s vorher, 3 echte Paare in 1,1 s nachher. Dazu die Dubletten-Tests aus Update 5, der Katalog-Import, Typecheck, Build und im Demo-Modus Decider (doppelte Auswahl, Hinweis ohne Person, Einordnung) und Dubletten-Seite (Paar, danach leer).

## Update 10 (25.10.2026): schnellere Suche, Arbeit per Git

| Thema | Umsetzung |
| --- | --- |
| Suche | Gespeicherter, aufbereiteter Weinname mit Index statt Neuberechnung bei jeder Suche; Tippfehler-Suche nur, wenn es keinen exakten Treffer gibt; Suche startet ab 2 Zeichen („Weiter tippen …"). Gemessen mit vollem Katalog: „pinot noir" 1,7 s → 0,09 s, „barolo" 0,4 s → 0,02 s, 19 typische Suchen 13,4 s → 1,0 s. Treffer und Reihenfolge unverändert (Tippfehler, Synonyme, Akzente, Zahlen, eigene Weine zuerst, Dubletten ausgeblendet). |
| Git | Repository als Klon `weinapp-git`, portable Werkzeuge, Push durch Claude nach Freigabe (siehe CLAUDE.md). `.gitignore`/`.env.example` korrigiert, fehlende Hilfsskripte ergänzt. |

## Update 11 (25.10.2026): Einführung

| Thema | Umsetzung |
| --- | --- |
| Inhalt | 7 kurze Seiten (`src/pages/IntroPage.tsx`, Route `/intro`): Willkommen, Wein finden, Wein bewerten (Notenskala), Geschmack, Decider, Freunde (Gruppe, Weinabend, Empfehlen), Ich. Jeder erwähnte Begriff wird im Satz erklärt (Weingut, Rebsorte, Jahrgang, Gruppe, Gastgeber, Merkliste, Abzeichen). Pro Seite eine Mini-Navigationsleiste, die zeigt, wo die Funktion zu finden ist. |
| Bedienung | Weiter/Zurück, Wischen, Pfeiltasten, „Überspringen", Fortschrittspunkte, Knopfleiste unten fixiert. |
| Wann | Automatisch einmal für neue Nutzer, egal auf welcher Seite sie starten (`IntroGate` in `App.tsx`), danach zurück zu dieser Seite. Beim Beitritt per Einladungslink erst nach dem Beitritt, danach zur Gruppe. Merker im Profil (`profiles.intro_seen_at`, Skript `15_einfuehrung.sql`, `mark_intro_seen()`), gilt also auf allen Geräten. Bestandsnutzer mit mindestens einer Bewertung gelten als „gesehen". Erneut abspielbar unter Ich → „Einführung ansehen" (danach zurück zu „Ich"). |

## Update 12 (25.10.2026): UX-Durchgang (21 Punkte)

| Bereich | Umsetzung |
| --- | --- |
| Bewerten | Weinseite: „Bewerten" bzw. „Nochmal bewerten" oben im Weinkopf. Bewertungsseite: Speichern unten fest; Geschmack, Ort/Anlass, Notiz, Foto unter „Mehr angeben" eingeklappt; bei unveränderter Note (85) Rückfrage vor dem Speichern; Tannin nur bei Rotwein; Datum „Getrunken am", nie in der Zukunft. |
| Eigene Bewertungen | Auf der Weinseite antippen bzw. „Ändern" öffnet „Bewertung ändern"; Aktionen beschriftet („Für Gruppen sichtbar"/„Privat", „Ändern", „Löschen"). |
| Weinabend | Aktualisiert sich alle 15 s und beim Zurückkehren in die App (neue Weine, Fortschritt, Aufdecken). Vergangene offene Abende: „Gestern" bzw. „Seit X Tagen offen", beim Gastgeber Hinweis mit „Bewertungen jetzt aufdecken". |
| Gruppen | Admin: umbenennen, Mitglieder entfernen, Gruppe löschen (Weinabende der Gruppe werden mitgelöscht, Bewertungen bleiben). Keine Datenbankänderung nötig, Rechte bestanden seit 08. |
| Name | Erste Einführung fragt den Anzeigenamen ab („Überspringen" springt beim ersten Mal zur Namensseite). |
| Geschmack | Profil nach Weiß/Rot getrennt (Tannin nur bei Rot); Matrix erst ab der ersten Bewertung; „Probier mal" mit Begründung „weil dir X gefällt" und Tipp aus den Gruppen (bester Wein der Sorte, den Freunde mögen, du nicht kennst). |
| Auswahl | Hinweis für Nutzer ohne Bewertungen. |
| Texte | Einheitlich „Bewertung" (nicht Verkostung/Verlauf); Rebsorten-Seite ohne Median/Spanne; Zwillinge ohne Rechenformel; Suchbeispiel „Lugana, Riesling, Barolo"; Export „als Excel-Tabelle"; seltene Rebsorten ohne Admin-Hinweis. |
| Dialoge | Eigene Bestätigung im App-Stil (`components/Confirm.tsx`, `useConfirm`) statt Browser-Dialog. Startbildschirm mit Logo statt „Lädt …". |

Getestet: Typecheck, Build, Demo-Modus für alle Punkte außer der automatischen Aktualisierung im Weinabend (im Demo-Modus ändert niemand sonst etwas; per Code geprüft).

## Offene Punkte

- Glossartexte prüfen. Weitere Rebsorten ergänzen, sobald der Katalog importiert ist.
- Admin-Oberfläche in der App (Freigabe, Dubletten) statt SQL, falls gewünscht.
- Gewichte im Decider nach ersten Erfahrungen nachjustieren.
