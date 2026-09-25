# Rechenmodell, Daten und Grenzen

## Eine Quelle je Datenbestand

`data/preflop.json` ist der einzige veröffentlichte Starthand-Datenbestand. Tabellen und Einzelresultate werden daraus erzeugt. Import: `node scripts/import-preflop.js <Quelldatei>`. Es werden ausschließlich Seed, Stichprobengröße, Klassen, zwei Karten-IDs und fünf numerische Schätzungen je Klasse übernommen. Die Quelle enthält zusätzlich 20 feste Flops; diese wurden bewusst nicht in den Rechner kopiert. Ein vom Nutzer gewählter Flop wird immer neu berechnet.

Ursprung: vom Auftraggeber bereitgestellte Simulation vom 24.09.2026, phevaluator 0.6.0, Seed 2026092402, 100.000 Austeilungen je Szenario. SHA-256 der geprüften Ursprungs-JSON: `3832bb25c25093a1007376bf402204f26b635842667ae2bc3486aec001dd5d62`. Die Ursprungssammlung umfasst 169 Preflop- und 20 Flop-Szenarien (18,9 Millionen Austeilungen). Öffentlich genutzt werden 16,9 Millionen Preflop-Austeilungen, 845 korrelierte Schätzungen. Eine Austeilung liefert die Werte für 1–5 Gegner nacheinander; diese fünf Werte sind keine unabhängigen Stichproben.

IDs: Rangfolge `23456789TJQKA`, pro Rang `Kreuz, Karo, Herz, Pik`, also Rangindex × 4 + Symbolindex. Für Paare werden Pik und Herz verwendet, suited Pik/Pik, offsuit Pik/Herz. Symmetrie erlaubt Übertragung innerhalb der Klasse vor dem Flop. 13 Paare × 6 + 78 suited × 4 + 78 offsuit × 12 = 1.326 konkrete Startkombinationen. Ein ungewichteter Mittelwert der 169 Zeilen wäre kein Deckmittelwert.

`scripts/reproduce-preflop.py <Ausgabedatei>` dokumentiert das ursprüngliche Preflop-Experiment ohne private Inhalte. Es benötigt das native Backend von `phevaluator==0.6.0` und CPython. Es ist optional, aufwendig und kein Browser-Laufzeitbestandteil. Die vollständige Ursprungssimulation wurde für dieses Release nicht erneut gerechnet. Neu geprüft wurden Zuordnung und alle Wertebereiche sowie 12 unabhängige Simulationen (6 repräsentative Hände × 2 Gegnerzahlen, je 30.000 Austeilungen). Neu erzeugte Dateien ersetzen die kanonische Datei erst nach einem dokumentierten Vergleich.

## Neuer Browserauswerter

Eigene Implementierung in `src/evaluator.js`: Häufigkeiten und Bitmasken für die besten fünf aus 5–7 Karten. Kategorien plus fünf Kicker werden als Basis-15-Zahl lexikografisch kodiert. Keine sechste Beikarte, keine Symbolpräferenz, Ass niedrig nur A2345. Für die sichtbaren fünf Karten werden alle Fünfer-Teilmengen verglichen. Der heiße Simulationspfad verwendet direkt die Rang-/Symbolzählung; validierte Eingaben sind Voraussetzung.

Jede Simulation zieht aus dem Restdeck mit partiellem Fisher–Yates ohne Zurücklegen, ergänzt zuerst das Board und danach je zwei Karten für jeden Gegner. Dieselbe faire Verteilung entstünde bei umgekehrter Reihenfolge. Unbekannte gefoldete Karten werden mangels Informationen nicht entfernt; ihr Marginaleffekt ist bereits im Zufallsmodell enthalten. Kein Modell für selektives Folden oder gegnerische Einsatzverteilungen.

Mulberry32 mit 32-Bit-Zustandsbegrenzung bei jedem Zug (auch bei Millionen Ziehungen ohne Verlust der Ganzzahlgenauigkeit), Seed 20260925: standardmäßig 1.000.000, optional 5.000.000 Austeilungen je Anfrage. Das gilt auch für die ausgewählte Preflop-Hand. Dort dient der gespeicherte 100.000er-Wert nur als sofortige erste Näherung; er wird erst ab mindestens gleich großer Live-Stichprobe ersetzt. Die Rangliste bleibt ausdrücklich die ursprüngliche 100.000er-Referenz; es wird kein scheinbar neu bestimmter Rang aus einer einzelnen präziseren Hand abgeleitet. Keine optionale vorzeitige statistische Stoppregel. Zwischenmeldungen nach 2.000, 10.000, dann je 50.000 Austeilungen. 1 Mio. verkleinert den Standardfehler gegenüber 30.000 um sqrt(1.000.000/30.000) ≈ 5,77; 5 Mio. um etwa 12,91. Der maximale geschätzte normale 95-%-Fehler bei Varianz 0,25 liegt bei ungefähr ±0,098 bzw. ±0,044 Prozentpunkten. Modellfehler bleibt davon unberührt.

Gegen genau einen Gegner wird nach dem Flop vollständig enumeriert: Flop C(47,2) × C(45,2) = 1.070.190 Kombinationen, Turn 46 × C(45,2) = 45.540, River C(45,2) = 990. Ungeordnete Turn-/River-Paare am Flop genügen, weil nur die finale Hand bewertet wird, keine Zwischenentscheidungen. Während der exakten Enumeration gibt es nur einen Fortschrittszähler: Ein deterministischer Anfangsausschnitt ist keine Zufallsstichprobe und erhält deshalb weder eine vorläufige Equity noch ein Scheinintervall. Der vollständige Wert ist exakt innerhalb des Zufallsgegner-Modells.

Kartenänderungen beenden den Worker und erhöhen eine Anfrage-ID; alte Antworten werden verworfen. Ein 45-Sekunden-Inaktivitätswächter wird bei echten Fortschrittsmeldungen erneuert; absichtlich große Rechnungen dürfen länger laufen, ohne als Fehler zu gelten. Eingaben bleiben bedienbar. Die Rechnung ist auch bei exakter Enumeration keine sichere Prognose gegen spielende Menschen.

Für jede Austeilung ist X = 0 bei Verlust, 1 bei Alleinsieg, 1/k bei k gemeinsamen Gewinnern. Equity = Mittelwert von X. Sieg, Teilung, Verlust sind getrennte Ereignisse; Teilung ist eine Wahrscheinlichkeit, kein Potanteil. Normalapproximation für den geschätzten einzelnen 95-%-Fehler: 1,96 × sqrt((Mittel(X²) − Mittel(X)²)/(n−1)). An Randwerten ist diese Approximation schwächer; die Live-Anzeige verwendet deshalb mindestens 3/n als Halbbreite. Intervalle werden auf [0,1] begrenzt. Vorbereitete Daten behalten ihre ursprünglichen Normalintervalle. Alle Intervalle betreffen nur Stichprobenrauschen, nicht Gegner-Modellfehler. Rundung der Anzeige kann eine sehr hohe/niedrige Quote als 100,0/0,0 % darstellen.

Rangliste: fallend nach Equity bei der ausgewählten Gegnerzahl, keine abgesicherte Totalordnung. Die einzelnen 95-%-Intervalle schützen weder simultan alle 169 Ränge noch alle Zwischenanzeigen. Kleine Unterschiede ausdrücklich unsicher.

## Treffer und Entscheidungen

Die Draw-Anzeige enumeriert genau jene verbleibenden Einzelkarten, die eine aktuell fehlende Straße oder einen aktuell fehlenden Flush vervollständigen. Überschneidungen werden durch eine Menge entfernt. Sie beschreibt nur diesen Treffer, keinen Sieg, keine vollständige Verbesserungsmenge und keine Backdoor-Chance. Die finale Kategorienverteilung enthält jedes Ergebnis genau einmal nach seiner höchsten Kategorie und darf nicht als universelle Gewinnchance einer Kategorie gelesen werden.

Die kompakte Übersicht zeigt Handrang, Karten, Gegnerzahl, Potanteil und eine automatische Prozent-Faustregel. Eigene Karten starten verdeckt, Tischkarten und Ergebnis sichtbar. Der Ergebnisschalter verdeckt auch Handrang, Faustregel und Berechnungsdetails. Konkrete beste Karten erscheinen nur, wenn eigene und Tischkarten sichtbar sind. Kartenwerte fehlen bei verdeckten Karten auch im zugänglichen Buttonnamen. „Alles verdecken“ verbirgt alles; neue Hand setzt eigene Karten verdeckt und Board/Ergebnis sichtbar. Ein Appwechsel verdeckt ausschließlich eigene Karten und schließt Dialoge, ohne manuelle Sichtentscheidungen für Board/Ergebnis zu ändern. Das ist Anzeigeschutz, keine Verschlüsselung.

### Automatische Prozent-Faustregel

Unter 25 %: „Schieben / nicht erhöhen“. 25 bis unter 50 %: +0,60 €. 50 bis unter 75 %: +1,20 €. Ab 75 %: +2,40 €. Es zählt ausschließlich der angezeigte, auf eine Nachkommastelle gerundete erwartete Potanteil einschließlich Teilungen, nicht die Alleinsiegquote. Die Beträge sind zusätzliche Chipbeträge als grobe Orientierung für die gewünschte 10/20-Cent-Runde. Die Schwellen wurden als einfache UI-Konvention festgelegt; keine empirische Kalibrierung, Optimierung oder wissenschaftliche Herleitung. Sie dürfen nicht mit der geprüften Equity-Mathematik verwechselt werden.

Keine Eingaben für Pot, Call, Stack, Position oder Einsatzfolge. Entsprechend keine Erwartungswert-/Callpreisrechnung und keine Prüfung rechtlich zulässiger Mindest-Erhöhungen, weiterer Kosten, Rake oder Nebenpots. Mitgehen gleicht einen offenen Einsatz aus, Erhöhen geht darüber hinaus; Schieben ist nur ohne offenen Einsatz möglich. Ein Stufenbetrag ist keine sichere oder maximale Callgrenze. Vorläufige Rechnung ergibt eine vorläufige Stufe; fehlende/ungültige/fehlgeschlagene Rechnung ergibt keinen Betrag. Bei null Gegnern steht „Pot gewonnen“. Änderungen entfernen veraltete Stufen zusammen mit der alten Equity.

Die frühere Eingabemaske mit bedingter Einsatzlogik wurde auf Nutzerwunsch entfernt. Archiv: Git-Commit 4221e685d8cfed9229009461961b68cadc662535 mit damaligen Quellen, Implementierung und Tests. Es gibt keine zweite aktive Einsatzlogik.

## Primärquellen, Stand 25.09.2026

- [PokerStars: Texas Hold’em](https://www.pokerstars.com/poker/games/texas-holdem/) – beste fünf, Blinds, volle Mindest-Erhöhungen. Hausregeln der konkreten Runde bleiben zu bestätigen.
- [PokerStars: Handregeln](https://www.pokerstars.com/poker/games/rules/) – Kategorien und Vergleiche.
- [PokerStars Learn: Pot Odds](https://www.pokerstars.com/poker/learn/lesson/pot-odds/) – Callpreis und spätere Kosten. Vereinfachende Gleichsetzungen von Draw-Treffer und Equity im Lehrtext werden hier nicht übernommen.
- [PokerStars Learn: Starthandauswahl](https://www.pokerstars.com/poker/learn/strategies/level-up-your-starting-hand-selection/) – allgemeine Strategiegrundlagen; keine Quelle für die frei festgelegten Prozentstufen.
- [PH Evaluator](https://github.com/HenryRLee/PokerHandEvaluator) – Ursprungsauswerter, Apache-2.0.
- [pokersolver](https://github.com/goldfire/pokersolver) – unabhängiger Entwicklungs-Testauswerter, MIT.
- [GitHub: Pages-Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) – Buildartefakt, OIDC, Umgebung. Action-Versionen zusätzlich gegen aktuelle offizielle Releases geprüft und auf Commit-SHAs fixiert.

## Datenschutz und Lizenzgrenzen

### Eigene gespeicherte Hände

Explizites Speichern legt zwei eigene Karten, 0–5 vorhandene Tischkarten, Ergebnis (gewonnen/verloren/geteilt), Erfassungszeit, Gegnerzahl bei Erfassung und optional einen geschätzten Betrag in `localStorage` unter `karten.hands.v1` ab. Auch teilweise erfasste Flops sind zulässig: Die Archivierung ist unabhängig von einer gültigen Berechnung. Fehlende Tischkarten bedeuten unbekannt, nicht nachgewiesen vor dem Flop beendet. Beträge sind immer Schätzungen; gewonnene/geteilte Hände speichern die eigene Bruttoauszahlung inklusive zurückerhaltenem Einsatz, verlorene Hände den verlorenen Einsatz. Daraus wird keine Nettobilanz gebildet. Leere Beträge werden nicht als Null behandelt. Nach Starthand gruppierte Ergebniszahlen sind beschreibende Häufigkeiten einer selbst ausgewählten Sammlung, keine belastbaren Gewinnwahrscheinlichkeiten und kein Trainingsdatensatz für die Equity.

Ein Eintrag wird bis „Neue Hand“ oder dem Ändern einer eigenen Karte aktualisiert statt doppelt angelegt. Ein neuer Reload beginnt ohne aktive Handverknüpfung. JSON-Export enthält Karten, geschätzte Beträge und Bedeutungsfelder; kein Upload. Speicherfehler, Quotenüberschreitung und unbekannte oder beschädigte Daten werden gemeldet und nicht als erfolgreicher Speichervorgang behandelt. Bestehende beschädigte Daten werden nicht stillschweigend überschrieben. Verlauf startet verdeckt, Appwechsel schließt auch Speicherdialog und Verlauf. Der lokale Speicher ist nicht verschlüsselt; Löschen der Browserdaten/Privatmodus kann Einträge entfernen.

### Sechs bis acht Gegner

Die Live-Simulation zieht für jeden der bis zu acht Gegner zwei weitere legale Karten ohne Zurücklegen. 0 Gegner bedeutet bereits gewonnenen Pot und löst keine Simulation aus. Die importierten Referenzdaten bleiben unverändert bei 1–5 Gegnern; für 6–8 wird kein fehlender Wert interpoliert. Preflop startet dort direkt eine frische Simulation. Die separate Rangliste bezeichnet ihre weiter angezeigten 5-Gegner-Werte ausdrücklich als abweichende Referenz. Die automatische Faustregel verwendet für alle Gegnerzahlen dieselben Prozentstufen.

Keine persönlichen Aufzeichnungen, Originaldokumente, versteckten Markdown-Bytes, privaten Pfade oder Geräteinformationen im öffentlichen Inhalt. Keine Analyseintegration oder externe Fonts. Keine Datenübertragung durch Karten-/Einsatzformulare. Nur ausdrücklich gespeicherte Hände bleiben im lokalen Browser über Sitzungen erhalten; laufende Karten und Einsatzfelder werden beim Neuladen zurückgesetzt. Hostingzugriffe sind trotzdem technisch für GitHub sichtbar. Lokale Datenimport-Skripte veröffentlichen keine Quelldatei. Ausschließlich `dist` ist das Pages-Artefakt.

Build-/Testabhängigkeiten: Vite MIT, Playwright Apache-2.0, pokersolver MIT; sie werden als Entwicklungswerkzeuge genutzt. Der Laufzeit-Auswerter ist eigene Implementierung. PH Evaluator ist nur optionale Reproduktionsabhängigkeit, nicht im Browser gebündelt. Quellentexte wurden nicht kopiert; Erläuterungen sind eigene Zusammenfassungen. Das Repository erteilt derzeit keine zusätzliche pauschale Lizenz für eigene Inhalte.
