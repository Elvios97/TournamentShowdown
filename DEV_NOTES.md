# DEV_NOTES - Pokemon Drafting Tool

Dieses Projekt ist eine statische HTML/CSS/JS-App mit Supabase als Backend.
Die App nutzt jetzt einen Login mit Benutzername und Passwort ueber Supabase
Auth. Es werden keine Passwoerter im Frontend gespeichert.

## Sicherheit

- In `js/config.js` duerfen nur oeffentliche Supabase-Werte stehen:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` beziehungsweise `publishable` Key
- Niemals den `service_role` Key in HTML, JavaScript oder Git speichern.
- `js/supabaseClient.js` blockiert den Start, wenn versehentlich ein
  `service_role` Key eingetragen wird.
- Der `anon`/`publishable` Key ist bei Supabase fuer Frontends vorgesehen.
  Die echten Datenrechte muessen ueber RLS-Policies abgesichert sein.
- Profilwechsel erfolgt nur ueber Logout und erneuten Login. Fremde Profile
  werden angezeigt, aber nicht lokal uebernommen.

## Lokaler Start

Im Projektordner:

```bash
python -m http.server 4173
```

Dann im Browser oeffnen:

```text
http://127.0.0.1:4173/
```

Alternative mit Node:

```bash
npx serve .
```

## Supabase Setup

Diese Schritte musst du im Supabase Dashboard ausfuehren.

1. Supabase Dashboard oeffnen.
2. Projekt auswaehlen.
3. `Authentication -> Providers -> Email` oeffnen.
4. E-Mail/Password aktivieren.
5. Fuer dieses private MVP E-Mail-Confirmations deaktivieren oder neue User
   beim Anlegen direkt bestaetigen.
6. `Settings -> API` oeffnen.
7. `Project URL` und `anon`/`publishable` Key in `js/config.js` eintragen.
8. SQL Editor oeffnen.
9. SQL-Dateien in dieser Reihenfolge ausfuehren:
   - `SUPABASE_SCHEMA.sql`
   - `SUPABASE_FIX_PERSONAL_TEAMS.sql`
   - `SUPABASE_MVP_LOGIN_PROFILES_RLS.sql`
   - `SUPABASE_FIX_INVITE_CODE_LOGIN.sql`
   - `SUPABASE_FIX_TEAM_VISIBILITY_SETTINGS.sql`
   - `SUPABASE_FIX_TEAM_BALL_VARIANT.sql`
   - `SUPABASE_ENABLE_PUBLIC_PROFILE_DIRECTORY.sql`

`SUPABASE_ENABLE_PUBLIC_PROFILE_DIRECTORY.sql` ist noetig, wenn im
Profilwechsel alle Profile aus der Datenbank angezeigt werden sollen.

## User Anlegen

Die App zeigt Benutzernamen an. Supabase Auth braucht intern aber eine
E-Mail-Adresse. Deshalb wird ein technisches Mapping verwendet.

Beispiel:

- Login-Name in der App: `mirco`
- Auth-Mail in Supabase: `mirco@pokemon-draft.local`

Neuen User anlegen:

1. Supabase Dashboard oeffnen.
2. `Authentication -> Users -> Add user`.
3. E-Mail nach Schema setzen, zum Beispiel `alex@pokemon-draft.local`.
4. Passwort setzen.
5. User bestaetigen beziehungsweise Auto Confirm nutzen.
6. Danach mit `alex` und dem Passwort in der App einloggen.

Erlaubte Username-Zeichen:

- `a-z`
- `0-9`
- `_`
- `-`

Laenge: 3 bis 32 Zeichen.

## Admin Setzen

Nur Admins duerfen aktuell neue Turniere erstellen.

Im Supabase SQL Editor:

```sql
update profiles
set global_role = 'admin'
where username = 'mirco';
```

Wenn das Profil noch nicht existiert, zuerst einmal mit dem User in der App
einloggen. Danach den SQL-Befehl erneut ausfuehren.

## Public Teams

Eigene Teams koennen im Dashboard auf `public` gestellt werden.

Sichtbarkeit:

- `private`: nur eigener User
- `public`: andere eingeloggte User koennen das Team sehen

Andere User sehen nur oeffentliche Teams. Private Teams bleiben durch RLS
geschuetzt.

## Profilwechsel

Der Profilwechsel zeigt alle sichtbaren Profile aus der Datenbank.

Wichtig:

- Aktuelles Profil kann weiter genutzt werden.
- Andere Profile sind sichtbar, aber der Button ist deaktiviert.
- Fuer einen anderen Benutzer: Logout und mit diesem Benutzer neu einloggen.
- Dadurch werden keine fremden Profil-IDs als lokale Session missbraucht.

## Browserdaten Zuruecksetzen

Wenn du vorher die alte lokale Profil-Version getestet hast:

1. Browser DevTools oeffnen.
2. Application/Storage oeffnen.
3. Local Storage fuer `127.0.0.1` oder `localhost` loeschen.
4. Seite neu laden.

Die App nutzt den alten lokalen Profil-Cache nicht mehr aktiv. Ein Reset hilft
aber bei sauberen Tests.

## Test-Checkliste

Nach dem SQL Setup:

1. App starten.
2. Mit Admin-User einloggen.
3. Neues Turnier erstellen.
4. Zweiten User in Supabase anlegen.
5. Mit zweitem User einloggen.
6. Mit User B per Einladungscode einem Turnier beitreten.
7. Profilwechsel oeffnen und pruefen, ob alle Profile angezeigt werden.
8. Mit User A ein persoenliches Team anlegen.
9. Team auf `public` stellen.
10. Mit User B einloggen und pruefen, ob das public Team sichtbar ist.
11. Team wieder auf `private` stellen und pruefen, ob es fuer User B
    verschwindet.
12. In einem Turnier `Open Sheets sichtbar` deaktivieren und pruefen, ob
    User B nur sein eigenes Turnier-Sheet sieht.

## Bekannte Offene Punkte

- Kein Admin-Panel zum Erstellen neuer User.
- Kein Passwort-Reset im UI.
- Champions Converter ist aktuell nur als Platzhalter vorhanden.
- Live-Drafting ist noch nicht vollstaendig implementiert.
# UI-Redesign: OTS DraftHub (Juni 2026)

- Die App nutzt jetzt eine feste Desktop-Sidebar, eine reduzierte Topbar und ein responsives Dashboard-Grid.
- Das Design-System liegt weiterhin zentral in `styles.css`. Die neuen Tokens decken Flächen, Akzentfarben, Abstände, Radien und Schatten ab.
- Bestehende Dashboard-IDs und globale Event-Handler wurden beibehalten. Datenzugriff, Supabase-Modelle, Draft-, Open-Sheet- und Turnierlogik wurden nicht verändert.
- Geteilte Inhalte werden neutral als „Geteilte Teams“ und „Weitere Turniere“ bezeichnet.
- Das Profilmenü bündelt Profilwechsel, Namensänderung, Profilverwaltung und Logout. Auf kleinen Screens öffnet der Menübutton die Sidebar als Drawer.
- Visuell geprüft wurden 1280 × 720 und 390 × 844. Login-Gate, User-Menü und mobile Sidebar wurden interaktiv geprüft.
- Die Hauptnavigation besitzt echte Dashboard-Routen für Turniere, Teams und Vorlagen. Turniergebundene Bereiche öffnen das zuletzt besuchte oder erste aktive Turnier.
- Geteilte Teams werden auf Desktop zweispaltig dargestellt; ihre sechs Pokémon erscheinen als 3×2-Sprite-Block. Eigene Teamzeilen verwenden größere horizontale Sprites.
- Turniere, Teams sowie Vorlagen & Pools besitzen eigenständige Hub-Seiten. Die Teamseite unterstützt Erstellen, Öffnen, Umbenennen, Teilen, Showdown-Import und Löschen persönlicher Teams.
- Champions bleibt eine eigenständige Platzhalterseite, bis der spätere Funktionsumfang feststeht.
- Lesbarkeits-Pass: Grundschrift, Überschriften, Navigation, Buttons, Karten und Pokémon-Sprites wurden moderat vergrößert. Bei mittleren Desktopbreiten stapelt sich das Dashboard früher, damit die größeren Inhalte ausreichend Platz behalten.
- Matches Stufe 1: Der Turnierbereich besitzt Kennzahlen, Statusfilter, responsive Matchkarten, Ligatabelle, Match-Erstellung mit Notiz, Score-Eingabe und Löschfunktion. Termine und beidseitige Ergebnisbestätigung sind noch nicht Teil des Schemas.
