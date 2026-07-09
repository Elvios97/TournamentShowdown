# Sicherheitsmodell der Public Beta

Die abschließende Sicherheitsmigration ist `SUPABASE_PUBLIC_BETA_HARDENING.sql`.
Sie muss nach allen älteren SQL-Dateien ausgeführt werden, weil ältere Migrationen
teilweise dieselben Policies und RPC-Funktionen definieren.

## Zugriff ohne Anmeldung

- `team_sheets`: nur persönliche Teams mit `visibility = public`
- `pokemon_sets`: nur Sets eines solchen öffentlichen persönlichen Teams
- Keine Profile, Turniere, Mitglieder, Drafts, Trades, Matches oder Einladungscodes

## Zugriff nach Anmeldung

- Profile: lesbar für angemeldete Nutzer, änderbar nur durch den Eigentümer oder Admin
- Turniere: öffentliche beziehungsweise ungelistete Turniere sowie eigene Mitgliedschaften
- Mitglieder: lesbar im Turnier; Rollenänderungen nur durch Host oder Admin
- Pools und Rulesets: eigene, öffentliche Vorlagen oder turniergebundene Daten
- Team-Sheets: eigenes Team, freigegebene persönliche Teams oder nach Turniereinstellung sichtbare Sheets
- Matches, Drafts und Trades: nur Mitglieder, Hosts und Admins des betreffenden Turniers
- Einladungscodes: ausschließlich Host und Admin

## Schreibschutz

- Ein Nutzer kann sich nicht selbst zum Host machen.
- Ein öffentlicher Self-Join erzeugt ausschließlich die Rolle `player`.
- Team-Sheets können nachträglich nicht einem anderen Profil, Mitglied oder Turnier zugeordnet werden.
- Direkte Draft-Pick-Schreibzugriffe bleiben Host/Admin vorbehalten. Spieler picken ausschließlich über die atomare RPC `make_draft_pick`.
- Die Pick-RPC sperrt die Draft-Session, prüft Zugreihenfolge, Pool, Ruleset, Teamgröße, Duplikate und Punktebudget.

## Schlüssel

- Im Browser darf ausschließlich der öffentliche Supabase-Publishable-Key verwendet werden.
- Der `service_role`-Key darf nur für lokale Administrationsskripte als temporäre Umgebungsvariable verwendet werden.
- Der `service_role`-Key darf niemals in Git, Frontend-Code, Screenshots oder Logs erscheinen.

## Prüfung vor Veröffentlichung

1. Migration im Supabase SQL Editor ausführen.
2. Mit zwei normalen Konten und einem Hostkonto testen.
3. Direkte REST-Versuche auf fremde private Teams und Rollenänderungen müssen abgewiesen werden.
4. Öffentliche persönliche Teams müssen anonym lesbar, aber nicht veränderbar sein.
5. `SUPABASE_RPC_EXECUTE_HARDENING.sql` muss zuletzt ausgeführt worden sein; schreibende RPCs dürfen für `anon` kein `EXECUTE` besitzen.
