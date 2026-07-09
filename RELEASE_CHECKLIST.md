# Release-Freigabe Public Beta

Release-Version: `0.9.0-beta`

Datum: ____________________

Verantwortlich: ____________________

Deployment-URL: ____________________

## Automatische Freigabe

- [ ] `npm.cmd run preflight` ist erfolgreich.
- [ ] Der Build enthält keine SQL-, Markdown-, Backup- oder Testdateien.
- [ ] Der Build enthält keinen Secret- oder `service_role`-Key.
- [ ] Die Deployment-URL lädt über HTTPS ohne relevante Konsolenfehler.

## Supabase

- [ ] Alle Feature- und Fix-Migrationen sind eingespielt.
- [ ] `SUPABASE_PUBLIC_BETA_HARDENING.sql` wurde danach ausgeführt.
- [ ] `SUPABASE_ATOMIC_TEAM_IMPORT.sql` wurde ausgeführt.
- [ ] `SUPABASE_RPC_EXECUTE_HARDENING.sql` wurde danach als letzte Sicherheitsmigration ausgeführt.
- [ ] RLS ist auf allen Anwendungstabellen aktiviert.
- [ ] Realtime ist für Draft-Sessions und Picks aktiv.
- [ ] Es existieren ein Hostkonto und zwei normale Testkonten.

## Kritische Abläufe

- [ ] Login und Logout funktionieren.
- [ ] Turnier erstellen und per Einladung beitreten funktioniert.
- [ ] Zwei Spieler sehen denselben Draftzustand in Echtzeit.
- [ ] Doppelklick und gleichzeitiger Pick erzeugen keinen doppelten Datensatz.
- [ ] Tauschangebot kann angenommen, abgelehnt und zurückgezogen werden.
- [ ] Gültiger Teamimport funktioniert.
- [ ] Fehlerhafter Teamimport verändert das bestehende Team nicht.
- [ ] Privates Team ist anonym nicht erreichbar.
- [ ] Öffentliches Team ist anonym lesbar, aber nicht bearbeitbar.

## Oberfläche und Rechtliches

- [ ] Desktopansicht ist ohne Überlappungen benutzbar.
- [ ] Mobile Ansicht bei ungefähr 390 px ist benutzbar.
- [ ] Lade-, Fehler- und Leerzustände sind verständlich.
- [ ] Fanprojekt-Hinweis ist sichtbar.
- [ ] Es wird kein offizielles Pokémon-Logo als OTS-Marke verwendet.

## Ergebnis

- [ ] Freigegeben
- [ ] Nicht freigegeben

Offene Punkte:

____________________________________________________________________

____________________________________________________________________
