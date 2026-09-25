# Prüfumfang und Abnahme

Stand: 25.09.2026. Die ausführbaren Tests sind maßgeblich; ein bestandener Desktop-/WebKit-Test ist kein Nachweis für ein physisches iPhone.

## Mathematik

- Vollständige Enumeration aller 2.598.960 Fünfkartenhände: Kategoriehäufigkeiten `[1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]` von hoher Karte bis Straight Flush.
- 4.000 reproduzierbare zufällige Vergleiche zweier Siebenkartenhände gegen die unabhängige Bibliothek pokersolver. Zusätzlich jede erste Hand gegen explizite Fünfer-Teilmengen reduziert.
- Alle 1.326 konkreten Startpaare, 169 Klassen, Häufigkeiten 6/4/12, alle 845 Datenwerte und Gegnerzuordnungen geprüft.
- 12 frische Preflop-Simulationen: AA, KK, AKs, AKo, 98s, 72o gegen je 1 und 5 Gegner; 30.000 Austeilungen pro Fall. Vorab festgelegte Toleranz: 5 × sqrt(0,25/30000 + 0,25/100000), ungefähr 1,65 Prozentpunkte. Feste Seeds, keine nachträglich angepassten Erwartungen.
- Ass niedrig/hoch, ungültiges QKA23, Kicker, Full-House-Reihenfolge, zwei Drillinge, Board spielt vollständig, Royal Flush, 2-/3-/6-fache Teilungen, Kartenfehler, Gegnergrenzen, deterministische Flops, exakte River-Enumeration.
- Draw-Überschneidung 9+8−2=15, 47-/46-Karten-Nenner, Call-EV bei 0/25/35/100 %, Mindest-Raise 0,60→1,00 €, bereits bezahlt versus zusätzlich, half-pot Beispiele und Stack-/Nebenpot-Sperren.

## Browser und Oberfläche

Produktionsbuild, Unterpfad `/poker/`, Playwright 1.58.2; Chromium 145 und WebKit 26.0. Mobile Touch-Ansicht 430×932; zusätzliche Breiten 320 und 1280. Verkleinerter Viewport 430×480 prüft Scroll-/Eingabebedienung bei geringer Höhe, simuliert jedoch keine echte iOS-Tastatur.

Abgedeckt: Start, zwei Handkarten, vollständiger/unvollständiger Flop, Karten ändern/entfernen, doppelte Karten gesperrt, Gegnerzahl, Rangliste, Worker-Abbruch bei schnellen Änderungen, neue Hand ohne erfundenen Reststack, negative/leere Eingaben, Prozentgrenzen, Call-Bedingungen, Regelgrenzen, absichtlicher Worker-Ladefehler, blockiertes Hauptskript, ausgeschaltetes JavaScript, Turn/River, exakte Rechnung, kein Gegner, horizontaler Überlauf. Fehler müssen erklärt werden; veraltete Berechnungen dürfen nicht zurückkehren.

Ein beim ersten Test gefundener Unterschied zwischen automatischer Eingabefüllung und sichtbarer Scrollposition nach Viewportwechsel wird im Abnahmetest ausdrücklich durch Scrollen und Antippen geprüft. Das behauptet keine automatische iOS-Tastatursteuerung. JavaScript-aus wird in einer eigenen Browserkonfiguration getestet.

## Kompakte Präzisionsfassung

Zusätzliche Tests: PRNG-Zustand nach sechs Millionen Ziehungen gegen eine unabhängige BigInt-Zustandsrechnung, exakte Flop-/Turn-Anzahlen und Royal-Flush-Sicherheitsfälle, keine Equity aus deterministischen Enumerationspräfixen, 1-Mio.- und 5-Mio.-Zielgrößen mit sinkendem Fehler, feste-Pot-Callgrenzen inklusive q=0/1, Chiprundung und Reststack. Browser: unabhängiges Verdecken aller drei Bereiche, keine sichtbaren abgeleiteten Angaben, Reset, Berechnung bei verdecktem Ergebnis, 5-Mio.-Modus, exakte Floprechnung und bedingte Kurzempfehlungen. Hauptansicht bei 430×740 geprüft, um gegenüber 430×932 Platz für Browserleisten zu lassen. Schrift und Farben bewusst zurückhaltend; Eingaben bleiben mit 16-px-Schrift, interaktive Ziele mindestens 44 px hoch.

## iPhone 14 Pro Max: kurzer echter Gerätetest

1. Website über HTTPS in Safari öffnen; keine heruntergeladene HTML-Datei verwenden. Oben muss der Rechner mit einer verständlichen Eingabeaufforderung erscheinen.
2. A♥ und K♥ auswählen: Karten und Ergebnis bleiben verdeckt. „Zeigen“ bei eigenen Karten und beim Potanteil antippen; oben erscheint die aktuelle Einordnung. Gegner auf 2 stellen.
3. Q♥ und 9♥ ergänzen: „Flop noch unvollständig“, keine alte Prozentzahl. Dann 2♣ wählen: Rechnung bis 1.000.000, ungefähr 58 % gegen zwei Zufallsgegner. Handkarten bleiben erhalten. Die Hauptansicht einschließlich Ergebnis, Sichtschaltern und Einsatzangaben soll ohne Scrollen sichtbar sein. Optional 5 Mio. wählen.
4. Eine bereits verwendete Karte erneut wählen wollen: gesperrt. Eine Flopkarte ändern und sofort Gegnerzahl wechseln: nur der neue Stand darf bleiben.
5. „Einsatzangaben“ öffnen. Pot 3, Call 1: 25 % Callpreis. Ohne Abschlussbestätigung keine endgültige EV-Entscheidung. Mit Bestätigung und eigener Schätzung 35: +0,40 € im Modell. Die Eingabe muss mit geöffneter Tastatur erreichbar sein.
6. „Alles verdecken“ sowie Appwechsel prüfen; Ergebnis, Handrang und Empfehlungen verschwinden. „Neue Hand“: Karten, Geld und eigene Schätzung leer, Blinds unverändert, Sichtbarkeit wieder verdeckt. Neu laden und die Standkennung am Seitenende prüfen.

Physischer Gerätetest: offen, vom Nutzer durchzuführen. Die Ursache des weißen Ergebnisbereichs der alten lokalen HTML-Datei wurde nicht nachgewiesen und wird durch diese Neuimplementierung nicht rückwirkend erklärt.
