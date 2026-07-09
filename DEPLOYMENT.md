# Deployment der Public Beta

## Zielbild

Die Anwendung ist eine statische HTML/CSS/JavaScript-Seite. Supabase stellt
Authentifizierung, Datenbank, Row Level Security, RPC-Funktionen und Realtime
bereit. Für das Hosting wird ausschließlich der Inhalt von `dist/`
veröffentlicht. SQL-Dateien, Backups und Administrationsskripte gehören nicht
in das öffentliche Webverzeichnis.

## Voraussetzungen

- Node.js 20 oder neuer
- Supabase-Projekt
- Statischer Hoster wie Netlify, Vercel, Cloudflare Pages oder vergleichbar
- Drei Testkonten: Host und zwei normale Spieler

## Supabase vorbereiten

Für ein neues Projekt zuerst `SUPABASE_SCHEMA.sql` ausführen. Anschließend
alle benötigten Feature- und Fix-Migrationen ausführen. Dabei gilt zwingend:

1. `SUPABASE_PUBLIC_BETA_HARDENING.sql` nach allen älteren Feature- und Fix-Dateien ausführen.
2. `SUPABASE_ATOMIC_TEAM_IMPORT.sql` danach ausführen.
3. `SUPABASE_RPC_EXECUTE_HARDENING.sql` als letzte Sicherheitsmigration ausführen.

Mindestens erforderlich für den aktuellen Public-Beta-Stand sind die
Migrationen für Login/Profile, persönliche Teams, Sichtbarkeit, Team-Marker,
Turnierberechtigungen, Pokémon-Katalog, Matches, Pool-Rankings, Realtime-Draft,
Trades, Regelset-Kontext und Referenzkataloge.

Wenn Champions-Teams nicht angelegt werden können, kann
`SUPABASE_CHAMPIONS_TEAM_BUILDER_SETUP.sql` als wiederholbare Reparaturmigration
ausgeführt werden. Sie legt die benötigten Personal-Team-Berechtigungen und
Team-Builder-Spalten für `team_sheets` und `pokemon_sets` an.

Wenn Bisaflor/Venusaur nur als Mega-Form erscheint oder `Thick Fat` fehlt,
`SUPABASE_VENUSAUR_MEGA_FIX.sql` im Supabase SQL Editor ausführen.

Wenn Mega-Fähigkeiten allgemein fehlen, `SUPABASE_MEGA_ABILITY_FIXES.sql`
ausführen. Die Datei ergänzt die offiziellen Mega-Form-Fähigkeiten für den
Team Builder.

Nach Migrationen im Supabase Dashboard prüfen:

- Email/Password Auth ist aktiviert.
- Testnutzer sind bestätigt und besitzen einen passenden `profiles`-Eintrag.
- Realtime ist für die von der Draft-Migration vorgesehenen Tabellen aktiv.
- RLS ist auf allen Anwendungstabellen aktiviert.
- Der anonyme Zugriff sieht ausschließlich öffentliche persönliche Teams und deren Sets.

Die endgültigen Zugriffsregeln stehen in `SECURITY.md`.

## Umgebungsvariablen

Beim Hoster hinterlegen:

- `SUPABASE_URL`: Project URL, beispielsweise `https://projekt.supabase.co`
- `SUPABASE_ANON_KEY`: anon/publishable Key
- `BASE_PATH`: optional, normalerweise leer

Nicht hinterlegen:

- `SUPABASE_SERVICE_ROLE_KEY`
- Datenbankpasswort
- persönliche Login-Daten

Der Publishable-Key ist für Browseranwendungen vorgesehen. Die eigentliche
Absicherung erfolgt über RLS. Trotzdem darf niemals ein `service_role`-Key in
den Frontend-Build gelangen.

## Build

PowerShell-Beispiel:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR-PUBLISHABLE-KEY"
npm.cmd test
npm.cmd run build
```

Der Build:

- validiert URL und Key,
- blockiert erkennbare `service_role`-Keys,
- kopiert nur `index.html`, `styles.css` und `js/`,
- schließt Testdateien aus dem öffentlichen Artefakt aus,
- erzeugt `dist/js/config.js` aus den Umgebungsvariablen.

## Hosting-Konfiguration

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 20 oder neuer

Die Anwendung verwendet Hash-Routen wie `#/teams`. Deshalb ist keine
SPA-Rewrite-Regel auf `index.html` erforderlich. HTTPS muss aktiviert sein,
damit Clipboard- und Auth-Funktionen zuverlässig arbeiten.

### Cloudflare Workers mit Git Deploy

Wenn Cloudflare einen Deploy Command verlangt:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Version command: `git rev-parse --short HEAD`
- Root directory: `/`

Die Datei `wrangler.toml` verweist Wrangler auf `dist/` als statisches
Asset-Verzeichnis. Die Build-Variablen `SUPABASE_URL` und
`SUPABASE_ANON_KEY` müssen in Cloudflare unter Build-Variablen hinterlegt
sein.

## Abnahme vor Veröffentlichung

1. `npm test` ist erfolgreich.
2. `npm run build` ist erfolgreich.
3. Deployment-URL lädt ohne Konsolenfehler.
4. Login, Logout und erneute Anmeldung funktionieren.
5. Host erstellt ein Testturnier und zwei Spieler treten bei.
6. Realtime-Draft wird in zwei getrennten Browserprofilen geprüft.
7. Ein privates Team ist über seine ID anonym nicht erreichbar.
8. Ein öffentliches Team ist anonym nur lesbar.
9. Fehlerhafter JSON-/Showdown-Import verändert das bestehende Team nicht.
10. Mobile Darstellung bei ungefähr 390 px Breite ist benutzbar.
11. Fanprojekt-Hinweis ist sichtbar.

Vor dem Release kann die automatische Prüfung zusammengefasst ausgeführt werden:

```powershell
npm.cmd run preflight
```

Optional prüft der Preflight zusätzlich die Erreichbarkeit des konfigurierten
Supabase-Auth-Endpunkts:

```powershell
$env:PREFLIGHT_NETWORK = "1"
npm.cmd run preflight
```

Die manuelle Freigabe wird in `RELEASE_CHECKLIST.md` dokumentiert.

Die ausführlichen Abläufe stehen in `PUBLIC_BETA_TESTING.md`.

## Rollback

- Vor SQL-Änderungen ein Supabase-Datenbank-Backup erstellen.
- Den zuletzt funktionierenden statischen Build als Deployment behalten.
- Bei einem Frontendproblem auf das vorherige Deployment zurückrollen.
- Datenbankmigrationen nicht blind rückgängig machen; zuerst betroffene RLS-Policies und Funktionen prüfen.
