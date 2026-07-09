# Public-Beta-Test: Realtime-Draft

Für diesen Test werden ein Hostkonto und zwei normale Spielerkonten benötigt.
Jedes Konto sollte in einem eigenen Browserprofil oder privaten Browserfenster laufen.

## Vorbereitung

1. Host erstellt ein Testturnier mit zwei Spielern.
2. Ein Pool mit mindestens zehn Pokémon und ein Ruleset mit mindestens zwei Picks pro Spieler sind zugeordnet.
3. Host erstellt die Draft-Runde und öffnet den Draft in allen Sitzungen.
4. In allen Sitzungen muss `Live verbunden` erscheinen.

## Pflichtfälle

- Host startet den Draft: Beide Spieler sehen denselben aktuellen Zug.
- Spieler im aktuellen Zug pickt: Der Pick erscheint ohne manuellen Reload in allen Sitzungen.
- Falscher Spieler versucht zu picken: Es erscheint eine verständliche Fehlermeldung und kein Pick wird gespeichert.
- Beide Spieler klicken gleichzeitig auf dasselbe Pokémon: Nur der gültige Zug wird gespeichert.
- Aktueller Spieler doppelklickt: Es entsteht genau ein Pick.
- Browser des aktuellen Spielers wird neu geladen: Draft-Stand und Zug werden korrekt wiederhergestellt.
- Netzwerk wird kurz getrennt: Der Verbindungsstatus wechselt sichtbar und der Stand bleibt lesbar.
- Host pausiert: Spieler können nicht picken.
- Host setzt fort: Der vorherige Zug bleibt erhalten.
- Host nimmt den letzten Pick zurück: Historie, Team und aktueller Zug werden in allen Sitzungen korrigiert.
- Draft erreicht die konfigurierte Teamgröße: Status wechselt auf `completed` und weitere Picks sind gesperrt.

## Tauschfälle

- Spieler erstellt ein Angebot nur mit einem eigenen Pick.
- Nur der Empfänger kann annehmen oder ablehnen.
- Nur der Ersteller kann zurückziehen.
- Ein bereits verändertes oder nicht mehr offenes Angebot kann nicht erneut angenommen werden.
- Ein Tausch, der ein Punktebudget überschreiten würde, wird abgewiesen.

## Erwartete Fehlerzustände

- Fehlender Pool oder fehlendes Ruleset erzeugt einen sichtbaren Konfigurationsfehler.
- Netzwerkfehler werden als Verbindungsfehler angezeigt.
- Ein bereits serverseitig verarbeiteter Pick wird nicht ein zweites Mal angelegt.
- Nach jedem Fehler bleibt der aktuelle Draft-Stand sichtbar und kann neu geladen werden.

# Phase 3: Team-Import und öffentliche Links

Vor dem Test `SUPABASE_ATOMIC_TEAM_IMPORT.sql` einmal im Supabase SQL Editor ausführen.

## Atomarer Import

- Ein gültiger JSON-Export ersetzt das vorhandene Team vollständig.
- Ein gültiger Showdown-Export ersetzt das vorhandene Team vollständig.
- Ein Import mit mehr als vier Moves wird abgewiesen; das bisherige Team bleibt unverändert.
- Ein Import mit mehr als 252 EVs pro Wert oder mehr als 510 EVs insgesamt wird abgewiesen; das bisherige Team bleibt unverändert.
- Eine Datei über 1 MB wird vor dem Upload abgewiesen.
- Eine beschädigte JSON-Datei zeigt eine verständliche Fehlermeldung.

## Öffentlicher Teamlink

- Ein eigenes Team auf `öffentlich` stellen und `Öffentlichen Link kopieren` wählen.
- Den Link in einem privaten Browserfenster ohne Anmeldung öffnen.
- Teamname, Pokémon und Sets sind sichtbar; Bearbeiten-, Import- und Löschaktionen fehlen.
- Nach Umstellung des Teams auf `privat` zeigt derselbe Link nur noch `Team nicht verfügbar`.
- Eine zufällige oder gelöschte Team-ID zeigt dieselbe neutrale Fehlermeldung.
- Darstellung zusätzlich bei ungefähr 390 px Fensterbreite prüfen.

# Phase 4: Team-Prüfung

- Ein unvollständiges eigenes Team öffnen und den Bereich `Team-Prüfung` aufklappen.
- Blockierende Probleme stehen unter `Zuerst beheben`, optionale Angaben unter `Danach ergänzen`.
- Jeder Eintrag erklärt neben dem Problem auch konkret, wie es behoben wird.
- `Set bearbeiten` öffnet beim richtigen Pokémon den Set-Editor.
- Mehr als vier Moves, doppelte Moves, ungültige EV und zu große Teams werden als Fehler angezeigt.
- Fehlendes Item, fehlende Fähigkeit, fehlendes Wesen, fehlende Moves und leere EV werden als Hinweise angezeigt.
- Ein vollständiges Team mit passendem Regelset zeigt `Team-Prüfung: Einsatzbereit`.
- Auf einem schmalen Fenster stehen Text und Schaltfläche untereinander, ohne abgeschnitten zu werden.

# Phase 5: UI/UX-Aufräumen

- Die Anmeldeseite verwendet verständliche deutsche Texte und zeigt keine technischen Platzhalter.
- In der Topbar gibt es keine funktionslose Benachrichtigung oder erfundene Anzahl.
- Das Dashboard zeigt keine Beispiel-Matches, Beispiel-Aktivitäten oder erfundene Statistiken.
- Noch nicht angebundene Dashboard-Bereiche erklären neutral, wo die echten Daten zu finden sind.
- Ladefehler zeigen eine verständliche Handlungsempfehlung statt einer technischen Supabase-Meldung.
- Leere Teamlisten bieten direkt die Aktion `Team anlegen` an.
- Champions bleibt als klar gekennzeichneter Platzhalter ohne Funktionsversprechen bestehen.
- Sidebar, Topbar, Dashboard und Team-Hub bei etwa 390 px Breite auf Überlappungen prüfen.

# Phase 6: Rechtlicher Safe Mode

- Sidebar und öffentliche Teamansicht zeigen das neutrale OTS-Draft-Hexagon statt eines Pokéball-Markenlogos.
- Der Fanprojekt-Hinweis ist am Seitenende sichtbar und auf Mobilgeräten vollständig lesbar.
- Die Anmeldeseite zeigt zusätzlich einen kurzen Markenhinweis.
- Öffentliche Teamlinks enthalten ebenfalls einen sichtbaren Hinweis auf das inoffizielle Fanprojekt.
- Es wird an keiner Stelle behauptet oder angedeutet, dass OTS DraftHub ein offizielles Produkt ist.
- Externe Sprite- und Fontquellen sind in `LEGAL.md` dokumentiert.
