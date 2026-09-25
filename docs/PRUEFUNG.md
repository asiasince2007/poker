# Prüfumfang und Abnahme

Stand: 25.09.2026. Die ausführbaren Tests sind maßgeblich. WebKit ist kein physischer iPhone-Test.

## Rechenmodell und Speicherung

Vollständige Enumeration aller 2.598.960 Fünfkartenhände, 4.000 reproduzierbare Vergleiche gegen pokersolver, alle 1.326 Startkombinationen und 169 Klassen. Gespeicherte Referenzwerte gegen unabhängige Simulationen geprüft. Exakte Heads-up-Auswertung, Flop-/Turn-Anzahlen, 1-/5-Mio.-Zielgrößen, PRNG-Zustand nach sechs Millionen Ziehungen, neunfache Potteilung. Speicherprüfungen decken optionale/unvollständige Tischkarten, Aktualisierung ohne Duplikat, getrennte Bruttoauszahlungen/verlorene Einsätze, beschädigte Daten und gesperrten/vollen Speicher ab.

## Oberfläche und Prozentstufen

Produktionsbuild unter /poker/, Chromium und WebKit, mobile Ansicht 430×932 sowie Hauptansicht 430×740 mit sichtbarer Faustregel. Breiten 320/430/1280 und kleiner Viewport 430×480. Speicherung, Wiederladen, Export, Löschen, negative Eingabe und Fehlerbehandlung. Bis acht Gegner, schnelle Änderungen, Worker-Abbruch, fehlgeschlagener Worker, blockiertes Skript und JavaScript-aus.

Prozentstufen an 25/50/75 % und Rundungsgrenzen geprüft; ungültige oder fehlende Equity liefert keinen Betrag. Browserfälle zeigen alle vier Stufen, entfernen alte Empfehlungen bei neuer Hand/Fehler, bestätigen null Gegner und prüfen, dass keine Einsatzmaske mehr vorhanden ist. Ein geteilter Royal Flush testet ausdrücklich den Potanteil statt der Alleinsiegquote. Die Tests bestätigen die Implementierung der frei festgelegten Stufen, nicht deren strategische Güte.

Eigene Karten starten verdeckt, Tischkarten/Ergebnis sichtbar. Unabhängige Sichtschalter, „Alles verdecken“, Neustart der Hand und visibilitychange-Ereignis geprüft. Beim Appwechsel bleiben Tischkarten/Ergebnis wie eingestellt; eigene Karten werden verdeckt und private Dialoge geschlossen. Die Ereignisprüfung ersetzt keinen echten iOS-Appwechsel.

## Kurzer Test auf dem iPhone 14 Pro Max

1. HTTPS-Website in Safari neu laden. A♥ K♥ eingeben: eigene Karten verdeckt, Potanteil und Faustregel erscheinen direkt. Tisch- und Ergebnisschalter heißen „Verbergen“.
2. Gegnerzahl 2 und Q♥ 9♥ 2♣ ergänzen: ungefähr 58 % und Richtbetrag +1,20 €. Kein weiteres Formular. Unvollständiger Flop darf keine alte Stufe anzeigen.
3. Tischkarten und Ergebnis getrennt verbergen/zeigen. App wechseln: eigene Karten verdeckt, Board/Ergebnis wie vorher eingestellt. „Alles verdecken“ muss alles verbergen. „Neue Hand“ stellt die Standardansicht her.
4. „Hand speichern“: Ergebnis und optionalen Schätzbetrag eintragen. Verlauf bleibt nach Neuladen erhalten; zunächst verdeckt, Export/Löschen weiterhin erreichbar. Bei geöffneter Tastatur müssen Betragsfeld und Speichern erreichbar sein.
5. Acht Gegner und optional fünf Millionen Austeilungen ausprobieren. Ergebnis und Faustregel bleiben auf der Hauptansicht erreichbar.

Physischer Gerätetest offen. Die früheren Tests der entfernten Einsatzmaske sind im Git-Commit 4221e685d8cfed9229009461961b68cadc662535 archiviert und gehören nicht mehr zur aktiven Oberfläche.
