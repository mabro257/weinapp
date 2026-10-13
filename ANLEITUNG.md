# Anleitung: WineWithFriends online bringen

Stand 10.10.2026. Alles läuft im Browser, du musst nichts installieren.

**Reihenfolge**

1. [GitHub: Code hochladen](#teil-1--github-code-hochladen) (10 Minuten)
2. [Netlify: App veröffentlichen, zuerst im Demo-Modus](#teil-2--netlify-app-veröffentlichen) (10 Minuten)
3. [Supabase: Datenbank einrichten](#teil-3--supabase-datenbank-einrichten) (20 Minuten)
4. [Brevo: E-Mail-Versand für die Anmeldecodes](#teil-4--brevo-e-mail-versand-einrichten) (15 Minuten)
5. [Netlify mit Supabase verbinden](#teil-5--netlify-mit-supabase-verbinden) (5 Minuten)
6. [Admin-Rechte und automatisches Backup](#teil-6--admin-rechte-und-backup) (10 Minuten)
7. [Auf dem Handy installieren](#teil-7--app-auf-dem-handy-installieren)
8. [Großen Weinkatalog importieren](#teil-8--großen-weinkatalog-importieren) (10 Minuten)
9. [Update vom 12.10.2026](#teil-9--update-vom-12102026-geschmack-merkliste-open-food-facts)
10. [Update „Sozial"](#teil-10--update-sozial-gruppen-weinabend-empfehlen-zwilling-abzeichen)
11. [Update 4: WineWithFriends, Etikett-Kamera, Zahlen-Suche](#teil-11--update-4-winewithfriends-etikett-kamera-zahlen-suche)
12. [Update 5: Namensregel, Dubletten, Geschmack, Hilfe](#teil-12--update-5-namensregel-dubletten-geschmack-hilfe)
13. [Update 6: Preisklassen, III Freunde, Weinabend löschen](#teil-13--update-6-preisklassen-iii-freunde-weinabend-löschen)

Nach Teil 2 läuft die App schon online mit Beispieldaten. Du kannst sie testen, bevor die Datenbank steht.

> **Wichtig zu Zugangsdaten:** Das Datenbank-Passwort und den Brevo-SMTP-Schlüssel nur in die jeweiligen Einstellungsfelder eintragen (Supabase, GitHub Secrets), niemals in eine Datei im Repository. Am besten im Passwort-Manager speichern.

---

## Teil 1 · GitHub: Code hochladen

1. Gehe auf [github.com](https://github.com) und melde dich an. Hast du noch kein Konto, lege eins an.
2. Klicke oben rechts auf **+** → **New repository**.
   - **Repository name:** `weinapp`
   - **Private** auswählen
   - Keine README, keine .gitignore, keine Lizenz hinzufügen (alles schon in den Dateien enthalten)
   - **Create repository**
3. Auf der leeren Repository-Seite auf den Link **uploading an existing file** klicken.
4. Entpacke die ZIP-Datei `weinapp.zip` auf deinem Rechner. Öffne den entpackten Ordner `weinapp`. Markiere **alle Dateien und Ordner darin** (Strg + A) und ziehe sie in das Upload-Feld im Browser.
   - Wichtig: den **Inhalt** des Ordners ziehen, nicht den Ordner selbst.
   - Warte, bis alle Dateien in der Liste erscheinen (rund 45 Dateien).
5. Unten bei **Commit changes** einen Text eintragen, z. B. `Erste Version`, und auf **Commit changes** klicken.
6. Prüfen: Auf der Repository-Startseite müssen u. a. die Ordner `.github`, `public`, `src`, `supabase` und die Datei `package.json` zu sehen sein.
   - **Falls `.github` fehlt** (passiert bei manchen Browsern): **Add file** → **Create new file**. Als Dateiname `.github/workflows/backup.yml` eintippen (die Schrägstriche legen die Ordner an). Den Inhalt der Datei `backup.yml` aus der ZIP hineinkopieren und auf **Commit changes** klicken.

---

## Teil 2 · Netlify: App veröffentlichen

1. Gehe auf [app.netlify.com](https://app.netlify.com) und melde dich **mit GitHub** an.
2. **Add new project** → **Import an existing project** → **GitHub**.
3. GitHub fragt, worauf Netlify zugreifen darf: **Only select repositories** → `weinapp` → **Install / Authorize**.
4. Repository `weinapp` auswählen. Die Build-Einstellungen füllt Netlify automatisch aus der Datei `netlify.toml` aus:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Deploy weinapp** klicken. Nach 1 bis 2 Minuten steht oben ein Link wie `https://zufallsname-123.netlify.app`.
6. Schöneren Namen vergeben: **Project configuration** → **Change project name**, z. B. `weinrunde` → Adresse wird `https://weinrunde.netlify.app`.
7. Link öffnen. Oben steht „Demo-Modus mit Beispieldaten". Alles lässt sich ausprobieren, Änderungen bleiben nur auf deinem Gerät.

### Netlify-Credits schonen

Der kostenlose Plan hat 300 Credits pro Monat. Jede Veröffentlichung kostet 15, also gehen etwa **20 Veröffentlichungen pro Monat**. Sind die Credits aufgebraucht, ist die Seite bis zum Monatsende offline.

- Jedes Hochladen auf GitHub löst eine Veröffentlichung aus. **Änderungen deshalb immer gesammelt in einem Schritt hochladen**, nicht Datei für Datei.
- Wenn du mehrere Upload-Schritte brauchst: vorher **Project configuration** → **Build & deploy** → **Continuous deployment** → **Build settings** → **Configure** → **Stop builds**. Danach wieder **Activate builds** und unter **Deploys** → **Trigger deploy** → **Deploy project** einmal manuell veröffentlichen.
- Den Verbrauch siehst du unter **Team settings** → **Billing** / **Usage**.

---

## Teil 3 · Supabase: Datenbank einrichten

### 3.1 Projekt anlegen

1. Gehe auf [supabase.com](https://supabase.com) → **Start your project** → mit GitHub anmelden.
2. **New project**:
   - **Name:** `weinapp`
   - **Database Password:** auf **Generate a password** klicken und das Passwort **im Passwort-Manager speichern**. Du brauchst es für das Backup.
   - **Region:** `Central EU (Frankfurt)`
   - Plan: **Free**
3. **Create new project**. Die Einrichtung dauert 1 bis 2 Minuten.

### 3.2 Datenbank-Tabellen anlegen

Die drei SQL-Dateien liegen im Ordner `supabase` der ZIP-Datei. Reihenfolge einhalten:

1. Links im Menü **SQL Editor** öffnen → **New query**.
2. Den kompletten Inhalt von **`01_schema.sql`** hineinkopieren → **Run** (oder Strg + Enter). Unten muss „Success. No rows returned" stehen.
3. Neue Query → Inhalt von **`02_glossar.sql`** → **Run**. Das legt die Rebsorten mit Glossartexten an. Als Ergebnis erscheint `setval` mit der höchsten Rebsorten-ID, das ist richtig.
4. Neue Query → Inhalt von **`03_beispielweine.sql`** → **Run**. Das legt 25 Beispielweine an, bis der große Katalog importiert ist.
5. Prüfen: Links **Table Editor** → Tabelle `wines` zeigt 25 Zeilen, `grapes` zeigt 27 Zeilen.

> Erscheint bei 01 eine Warnung zu „destructive operations" oder „RLS", mit **Run this query** bestätigen. Das Skript darf nur einmal laufen. Bei einem zweiten Lauf meldet es „already exists", das ist dann harmlos. Die Dateien 02 und 03 dürfen mehrfach laufen.

### 3.3 Anmeldung per Code einstellen

Die App nutzt einen 6-stelligen Code statt eines Links. So funktioniert die Anmeldung auch in der installierten App auf dem iPhone.

1. **Authentication** → **Sign In / Providers** → **Email**:
   - **Enable Email provider:** an
   - **Confirm email:** an
   - **Email OTP Length:** `6`
   - **Email OTP Expiration:** `3600` (1 Stunde)
   - **Save**
2. **Authentication** → **Emails** (bzw. **Email Templates**). Die Vorlagen lassen sich erst bearbeiten, wenn der eigene Mailversand aus **Teil 4** eingerichtet ist. Dann zwei Vorlagen anpassen, **Confirm signup** (erste Anmeldung) und **Magic Link** (jede weitere Anmeldung). Beim Body von **Preview** auf **Source** umschalten. In beiden:
   - **Subject:** `Dein Anmeldecode für die Weinbewertung`
   - **Body** komplett ersetzen durch:

```html
<h2>Dein Anmeldecode</h2>
<p>Gib diesen Code in der Wein-App ein:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Der Code ist eine Stunde gültig. Wenn du dich nicht anmelden wolltest, ignoriere diese E-Mail.</p>
```

   - Jeweils **Save**.
3. **Authentication** → **URL Configuration** → **Site URL**: deine Netlify-Adresse, z. B. `https://weinrunde.netlify.app` → **Save**.

### 3.4 Zugangsdaten für die App notieren

**Project Settings** (Zahnrad) → **API Keys** bzw. **Data API**:

- **Project URL**, z. B. `https://abcdefgh.supabase.co`
- **Publishable key** (beginnt mit `sb_publishable_`), bei älteren Projekten heißt er **anon public**

Beide Werte sind für den Browser gedacht und dürfen öffentlich sein. Die Daten schützen die Zugriffsregeln in der Datenbank. Den **secret / service_role key** niemals verwenden oder weitergeben.

---

## Teil 4 · Brevo: E-Mail-Versand einrichten

Der eingebaute E-Mail-Versand von Supabase schafft nur etwa 2 E-Mails pro Stunde. Für den Freundeskreis brauchst du einen eigenen Versand. Brevo ist kostenlos (300 E-Mails pro Tag) und braucht keine eigene Domain.

1. Konto anlegen auf [brevo.com](https://www.brevo.com) (Free-Plan).
2. **Absender bestätigen:** oben rechts Name → **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**. Name `Weinbewertung`, E-Mail: deine Adresse. Den Bestätigungslink in der E-Mail anklicken.
3. **SMTP-Schlüssel erzeugen:** oben rechts Name → **SMTP & API** → Reiter **SMTP** → **Generate a new SMTP key**. Den Schlüssel sofort im Passwort-Manager speichern. Auf derselben Seite stehen **SMTP Server**, **Port** und **Login**.
4. In **Supabase** → **Authentication** → **Emails** → **SMTP Settings** → **Enable Custom SMTP**:
   - **Sender email:** die bestätigte Absenderadresse aus Schritt 2
   - **Sender name:** `Weinbewertung`
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Username:** der **Login** von der Brevo-SMTP-Seite (nicht deine normale E-Mail)
   - **Password:** der SMTP-Schlüssel aus Schritt 3
   - **Save**
5. **Authentication** → **Rate Limits** → **Rate limit for sending emails** auf `30` pro Stunde setzen → **Save**.

> Hinweis: Mit einer Gmail- oder GMX-Adresse als Absender landen die Codes anfangs öfter im Spam-Ordner. Mit einer eigenen Domain passiert das seltener. Freunde sollten beim ersten Mal im Spam nachsehen.

---

## Teil 5 · Netlify mit Supabase verbinden

1. Netlify → dein Projekt → **Project configuration** → **Environment variables** → **Add a variable** → **Add a single variable**:
   - Key `VITE_SUPABASE_URL`, Value: die Project URL aus 3.4 → **Create variable**
   - Key `VITE_SUPABASE_ANON_KEY`, Value: der Publishable key aus 3.4 → **Create variable**
2. **Deploys** → **Trigger deploy** → **Deploy project** (bzw. **Clear cache and deploy project**).
3. Nach 1 bis 2 Minuten die App neu laden. Der Demo-Hinweis ist weg, es erscheint die Anmeldung.
4. Mit deiner E-Mail anmelden: **Code anfordern** → Code aus der E-Mail eingeben → **Anmelden**.

**Klappt die Anmeldung nicht?**

- Keine E-Mail: Spam-Ordner prüfen. In Brevo unter **Transactional** → **Logs** nachsehen, ob die E-Mail rausging. In Supabase die SMTP-Daten prüfen.
- Die E-Mail enthält einen Link statt Code: Die Vorlage aus 3.3 wurde nicht gespeichert, für neue Nutzer gilt **Confirm signup**.
- „Token has expired or is invalid": Code neu anfordern und nur den neuesten verwenden.

---

## Teil 6 · Admin-Rechte und Backup

### 6.1 Dich zum Admin machen

Erst **nachdem du dich einmal angemeldet hast**: Supabase → **SQL Editor** → New query:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'DEINE@EMAIL.DE');
```

Die E-Mail-Adresse anpassen → **Run**. Als Admin darfst du Rebsorten pflegen, Weine ändern und doppelte Weine zusammenführen (aktuell per SQL, siehe unten).

### 6.2 Automatisches Backup einrichten

Das Backup läuft jede Nacht kostenlos über GitHub und hält gleichzeitig das Supabase-Projekt aktiv. Ohne Aktivität pausiert das kostenlose Projekt nach einer Woche.

1. **Verbindungsadresse holen:** Supabase → oben **Connect** → Reiter **Connection String** → **Type: URI**, **Method: Session pooler** (wichtig, nicht „Direct connection"). Die Adresse kopieren, sie sieht etwa so aus:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   `[YOUR-PASSWORD]` (inklusive Klammern) durch dein Datenbank-Passwort aus 3.1 ersetzen.
2. **GitHub** → Repository `weinapp` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, dreimal:
   - Name `SUPABASE_DB_URL`, Secret: die Adresse aus Schritt 1
   - Name `SUPABASE_URL`, Secret: die Project URL
   - Name `SUPABASE_ANON_KEY`, Secret: der Publishable key
3. **Testen:** Reiter **Actions** → links **Datenbank-Backup** → **Run workflow** → **Run workflow**. Nach etwa 1 Minute muss ein grüner Haken erscheinen.
4. **Backup herunterladen:** auf den Lauf klicken → unten unter **Artifacts** liegt `backup-…` als ZIP mit:
   - `weinapp-DATUM.dump`: alle App-Daten (Weine, Bewertungen, Profile, Glossar)
   - `nutzer-DATUM.csv`: Liste der Nutzer

Backups werden 30 Tage aufbewahrt. Möchtest du eines dauerhaft behalten, lade es herunter. Etikettfotos sind nicht im Backup enthalten, sie liegen getrennt im Supabase-Speicher.

**Wiederherstellen (nur im Notfall):** Das geht nicht im Browser, dafür brauchst du einen Rechner mit PostgreSQL-Werkzeugen. Melde dich dann, wir machen das gemeinsam.

### 6.3 Doppelte Weine zusammenführen (Admin)

Wenn zwei Einträge denselben Wein meinen: im **Table Editor** → `wines` die beiden IDs heraussuchen, dann im SQL Editor:

```sql
select public.merge_wines(DOPPELTE_ID, RICHTIGE_ID);
```

Alle Bewertungen ziehen zum richtigen Wein um. Der doppelte Eintrag verschwindet aus der Suche.

---

## Teil 7 · App auf dem Handy installieren

- **iPhone (Safari):** Adresse öffnen → **Teilen-Symbol** → **Zum Home-Bildschirm** → **Hinzufügen**.
- **Android (Chrome):** Adresse öffnen → **Drei-Punkte-Menü** → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

Danach öffnet sich die App ohne Browserleiste. Anmelden musst du dich einmal **in der installierten App**. Sie hat ihren eigenen Speicher und übernimmt die Anmeldung aus Safari nicht.

---

## Teil 8 · Großen Weinkatalog importieren

Der Katalog stammt aus dem offenen Datensatz **X-Wines** (Lizenz CC0, Stand 2022): 100.646 Weine aus 62 Ländern mit Weingut, Region, Rebsorten, Körper und Säure. Die Daten liegen fertig aufbereitet im Ordner `data`. Rebsorten-Namen sind auf das Glossar abgebildet (Pinot Noir → Spätburgunder usw.), Lugana-Weine auf Turbiana. Die Datenbank wächst dadurch auf etwa 105 MB, das kostenlose Limit liegt bei 500 MB.

1. **Supabase → SQL Editor:** nacheinander ausführen
   - `02_glossar.sql` (erneut, jetzt mit 134 Rebsorten)
   - `04_update_suche.sql` (schnellere Suche für den großen Katalog)
2. **GitHub → Actions → links „Katalog-Import" → Run workflow → Run workflow.** Dauert 2 bis 5 Minuten.
3. Grüner Haken = fertig. Im Protokoll des Schritts „Katalog importieren" stehen am Ende die Zahlen, etwa `importierte_weine 100646`.
4. App neu laden und z. B. nach „Lugana" suchen.

Die erfundenen Beispielweine werden dabei entfernt, außer jemand hat sie schon bewertet. Ein zweiter Lauf schadet nicht, bereits importierte Weine werden übersprungen.

---

## Teil 9 · Update vom 12.10.2026 (Geschmack, Merkliste, Open Food Facts)

1. Netlify: **Stop builds**.
2. Auf GitHub die Ordner aus `weinapp-update-2.zip` hochladen (Ordner für Ordner, siehe Tabelle in der Nachricht von Claude). Gleichnamige Dateien werden überschrieben.
3. Netlify: **Activate builds** → Deploys → **Trigger deploy** → **Deploy project**. Unter **Deploys** muss oben ein neuer Eintrag mit Status **Published** stehen.
4. Supabase → SQL Editor: `07_update_merkliste_suche.sql` ausführen.
5. GitHub → Actions → **Katalog-Import** → Run workflow. Bereits vorhandene Weine werden übersprungen, neu kommen ca. 5.900 Weine aus Open Food Facts dazu.
6. Am Handy die App einmal komplett schließen und neu öffnen, damit die neue Version geladen wird.

---

## Teil 10 · Update „Sozial" (Gruppen, Weinabend, Empfehlen, Zwilling, Abzeichen)

1. Netlify: **Stop builds**.
2. Auf GitHub den Ordner `src` aus `weinapp-update-3.zip` hochladen (Unterordner `components`, `lib`, `pages` einzeln über die Upload-Links) sowie `supabase/08_sozial.sql`, `ANLEITUNG.md`, `PROJEKT.md`.
3. Supabase → SQL Editor: `08_sozial.sql` ausführen. Fragt Supabase nach RLS, **Run and enable RLS** wählen.
4. Netlify: **Activate builds** → **Trigger deploy**.
5. App am Handy schließen und neu öffnen.
6. Unter **Freunde** → **+ Neu** eine Gruppe anlegen, dann **Kopieren** bzw. **Teilen** und den Link an die Freunde schicken. Wer den Link öffnet und sich anmeldet, ist in der Gruppe.

Gut zu wissen:
- Bestehende Bewertungen sind ab jetzt für deine Gruppen sichtbar. Einzelne lassen sich auf der Weinseite über das Personen-Symbol neben der Bewertung auf privat stellen (Schloss).
- „Gruppen Ø" auf der Weinseite zählt nur noch dich und deine Gruppen, nicht mehr alle Nutzer.
- Beim Weinabend sieht niemand die Noten der anderen, bis der Gastgeber auflöst.

---

## Teil 11 · Update 4: WineWithFriends, Etikett-Kamera, Zahlen-Suche

1. Netlify: **Stop builds**.
2. Auf GitHub die Ordner aus `weinapp-update-4.zip` hochladen (Tabelle in der Nachricht von Claude). Gleichnamige Dateien werden überschrieben.
3. Supabase → SQL Editor: `09_update_zahlen_freunde.sql` ausführen. Am Ende erscheint die Liste der III-Freunde-Weine mit „DREI FREUNDE".
4. Netlify: **Activate builds** → **Trigger deploy** → **Deploy project**.
5. Optional, damit überall der neue Name steht:
   - Supabase → **Authentication** → **Emails**: in **Confirm signup** und **Magic Link** den Betreff auf `Dein Anmeldecode für WineWithFriends` ändern → **Save**.
   - Supabase → **Authentication** → **Emails** → **SMTP Settings**: **Sender name** `WineWithFriends` → **Save**.
6. Am Handy die App schließen und neu öffnen. Der Name auf dem Home-Bildschirm ändert sich erst, wenn du die App einmal löschst und neu zum Home-Bildschirm hinzufügst (iPhone). Beim ersten Foto fragt die App nach dem Kamerazugriff: **Erlauben**.

---

## Teil 12 · Update 5: Namensregel, Dubletten, Geschmack, Hilfe

1. Netlify: **Stop builds**.
2. Auf GitHub die Ordner aus `weinapp-update-5.zip` hochladen (Tabelle in der Nachricht von Claude).
3. Supabase → **SQL Editor** → **New query**: Inhalt von `10a_katalog_daten.sql` einfügen → **Run**. Die Datei ist groß (rund 180 KB): am besten im Windows-Editor öffnen, **Strg + A**, **Strg + C**, im SQL Editor **Strg + V**. Ergebnis: `umbenennungen 1842`, `dubletten 283`.
4. Neue Query: Inhalt von `10b_namen_dubletten.sql` → **Run**. Fragt Supabase nach RLS, **Run and enable RLS** wählen. Ergebnis: `lugana_zusammengefuehrt true`.
5. Netlify: **Activate builds** → **Deploys** → **Trigger deploy** → **Deploy project**.
6. App am Handy schließen und neu öffnen.
7. Unter **Ich** → **Dubletten prüfen** (nur für Admins sichtbar) die vorgeschlagenen Paare durchgehen: **Links behalten** bzw. **Rechts behalten** führt zusammen, **Kein Duplikat** blendet das Paar dauerhaft aus. Behalte möglichst den Katalogeintrag.

So legst du ab jetzt Weine an: **Name** wie auf dem Etikett, aber ohne Weingut und ohne Jahrgang. **Weingut** ins eigene Feld, **Jahrgang** bei der Bewertung. Die App weist dich auf Abweichungen hin und schlägt eine Korrektur vor.

---

## Teil 13 · Update 6: Preisklassen, III Freunde, Weinabend löschen

1. Netlify: **Stop builds**.
2. Auf GitHub die Ordner aus `weinapp-update-6.zip` hochladen (Tabelle in der Nachricht von Claude).
3. Supabase → **SQL Editor** → **New query**: Inhalt von `11_iii_freunde_weinabend.sql` → **Run**. Am Ende steht die Liste der III-Freunde-Weine, „DREI FREUNDE Rosé" mit `zusammengefuehrt true`.
4. Netlify: **Activate builds** → **Deploys** → **Trigger deploy** → **Deploy project**.
5. App am Handy schließen und neu öffnen. Unter **Ich → Dubletten prüfen** entscheiden, ob „Riesling" und „Grauburgunder" von III Freunde dieselben sind wie die Katalogeinträge „Riesling" und „Grauburgunder Trocken".

Weinabend löschen: als Gastgeber auf der Seite des Abends ganz unten **Weinabend absagen** bzw. **Weinabend löschen**, Schalter **Alle Bewertungen löschen** nach Wunsch, dann **Endgültig löschen**.

---

## Später: Änderungen hochladen

1. GitHub → Repository → **Add file** → **Upload files**.
2. Alle geänderten Dateien **mit ihrer Ordnerstruktur** auf einmal hineinziehen. Gleichnamige Dateien werden überschrieben.
3. **Commit changes** → Netlify veröffentlicht automatisch (15 Credits).

## Kosten im Überblick (Stand 10.10.2026)

| Dienst | Plan | Grenze, die relevant werden kann |
| --- | --- | --- |
| GitHub | Free | keine für dieses Projekt |
| Netlify | Free | 300 Credits/Monat, etwa 20 Veröffentlichungen, Traffic für einen Freundeskreis unkritisch |
| Supabase | Free | 500 MB Datenbank, 1 GB Fotos, pausiert nach 7 Tagen ohne Aktivität (durch das Backup verhindert) |
| Brevo | Free | 300 E-Mails pro Tag |
