# OTS — Pokémon Drafting, Open Sheets & Turnier-Tool

Statische Online-First-Webapp mit Supabase-Backend für Drafts, Turniere,
Matches, Team-Sheets und öffentlich geteilte Teams. Nutzer melden sich mit
Benutzername und Passwort an. Datenzugriffe werden serverseitig durch
Postgres Row Level Security und validierte RPC-Funktionen geschützt.

Das Projekt befindet sich im Stand einer Public Beta.

## Schnellstart

Voraussetzungen: Node.js 20 oder neuer, Python 3 für den einfachen lokalen
Webserver und ein Supabase-Projekt.

1. Supabase-Projekt anlegen und Email/Password Auth aktivieren.
2. Datenbankschema und Migrationen gemäß [`DEPLOYMENT.md`](./DEPLOYMENT.md) ausführen.
3. In `js/config.js` ausschließlich Project URL und anon/publishable Key eintragen.
4. Tests ausführen: `npm test`.
5. Lokal starten: `python -m http.server 4173`.
6. `http://127.0.0.1:4173/` öffnen.

Weitere Dokumentation:

- [`DEPLOYMENT.md`](./DEPLOYMENT.md): Umgebungsvariablen, Build und Hosting
- [`SECURITY.md`](./SECURITY.md): RLS- und Schlüsselmodell
- [`PUBLIC_BETA_TESTING.md`](./PUBLIC_BETA_TESTING.md): manuelle Beta-Abnahme
- [`DEV_NOTES.md`](./DEV_NOTES.md): technische Hintergründe

## Fanprojekt und Markenhinweis

This is an unofficial fan-made tool and is not affiliated with, endorsed, sponsored, or approved by Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.

Hinweise zu Marken, Sprites und externen Inhaltsquellen stehen in
[`LEGAL.md`](./LEGAL.md).

## Projektstruktur

```text
index.html
styles.css
package.json               # dependency-freie Build- und Testbefehle
scripts/                   # statischer Deployment-Build und Checks
SUPABASE_SCHEMA.sql        # vollständiges DB-Schema inkl. RLS-Policies
DEV_NOTES.md                # Setup, Architektur, Feature-Status
js/
  config.js / supabaseClient.js / auth.js / router.js / main.js
  utils.js, sprites.js, showdownParser.js   # wiederverwendete Kernlogik
  storage/                                    # generische Supabase-CRUD-Helfer
  features/
    profile/ dashboard/ tournaments/ rulesets/
    pools/ teams/ openSheets/ importExport/
    matches/ draft/ publicTeams/
```

## Tests und Build

- `npm test`: JavaScript-Syntax sowie Logik-, Sicherheits- und Migrationstests
- `npm run build`: erzeugt ein sauberes statisches Deployment unter `dist/`
- `npm run preflight`: führt Tests, Build und Release-Inhaltsprüfung zusammen aus

Unter Windows PowerShell kann die Skriptausführungsrichtlinie `npm.ps1`
blockieren. Dann `npm.cmd test`, `npm.cmd run build` beziehungsweise
`npm.cmd run preflight` verwenden.

Der Build benötigt `SUPABASE_URL` und `SUPABASE_ANON_KEY` als
Umgebungsvariablen. `.env.example` dient nur als Vorlage und wird nicht
automatisch geladen. Ein `service_role`-Key wird vom Build abgewiesen.

## Public-Beta-Checkliste

- Sicherheitsmigration und atomare Teamimport-Funktion eingespielt
- Login mit normalem Nutzer, Host und zweitem Spieler geprüft
- Realtime-Draft in zwei getrennten Browsersitzungen geprüft
- Private Teams nicht anonym erreichbar
- Öffentliche Teamlinks anonym lesbar und nicht bearbeitbar
- JSON-/Showdown-Fehlerfälle ohne Datenverlust geprüft
- Desktop- und Mobile-Ansichten geprüft
- Fanprojekt-Hinweis sichtbar
- `npm test` und `npm run build` erfolgreich
- [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) vollständig abgezeichnet

Die ursprüngliche Einzeldatei-Version (reines `localStorage`, kein Backend)
liegt zur Referenz unter `index.legacy.html.bak` / `app.legacy.js.bak`.

## Showdown-Parser & Sprites (unverändert aus der Ursprungsversion)

- Der Showdown-Parser erkennt Nicknames korrekt:
  `Surfer (Raichu-Alola) @ Life Orb` → Spezies `Raichu-Alola`, Nickname `Surfer`.
- Sprites laufen über mehrere Fallback-Quellen (Showdown Dex → PokémonDB Home
  → ältere Showdown-Sprites → neutrales Platzhalterbild).
- Alola-/Therian-/Ogerpon-Formen u. a. haben hinterlegte Aliase in
  `js/sprites.js` (`SPRITE_ALIASES`). Zeigt ein Sprite einen Platzhalter,
  dort ergänzen.
