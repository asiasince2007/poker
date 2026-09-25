# Rechenmodell, Daten und Grenzen

## Eine Quelle je Datenbestand

`data/preflop.json` ist der einzige veröffentlichte Starthand-Datenbestand. Tabellen und Einzelresultate werden daraus erzeugt. Import: `node scripts/import-preflop.js <Quelldatei>`. Es werden ausschließlich Seed, Stichprobengröße, Klassen, zwei Karten-IDs und fünf numerische Schätzungen je Klasse übernommen. Die Quelle enthält zusätzlich 20 feste Flops; diese wurden bewusst nicht in den Rechner kopiert. Ein vom Nutzer gewählter Flop wird immer neu berechnet.

Ursprung: vom Auftraggeber bereitgestellte Simulation vom 24.09.2026, phevaluator 0.6.0, Seed 2026092402, 100.000 Austeilungen je Szenario. SHA-256 der geprüften Ursprungs-JSON: `3832bb25c25093a1007376bf402204f26b635842667ae2bc3486aec001dd5d62`. Die Ursprungssammlung umfasst 169 Preflop- und 20 Flop-Szenarien (18,9 Millionen Austeilungen). Öffentlich genutzt werden 16,9 Millionen Preflop-Austeilungen, 845 korrelierte Schätzungen. Eine Austeilung liefert die Werte für 1–5 Gegner nacheinander; diese fünf Werte sind keine unabhängigen Stichproben.

IDs: Rangfolge `23456789TJQKA`, pro Rang `Kreuz, Karo, Herz, Pik`, also Rangindex × 4 + Symbolindex. Für Paare werden Pik und Herz verwendet, suited Pik/Pik, offsuit Pik/Herz. Symmetrie erlaubt Übertragung innerhalb der Klasse vor dem Flop. 13 Paare × 6 + 78 suited × 4 + 78 offsuit × 12 = 1.326 konkrete Startkombinationen. Ein ungewichteter Mittelwert der 169 Zeilen wäre kein Deckmittelwert.

`scripts/reproduce-preflop.py <Ausgabedatei>` dokumentiert das ursprüngliche Preflop-Experiment ohne private Inhalte. Es benötigt das native Backend von `phevaluator==0.6.0` und CPython. Es ist optional, aufwendig und kein Browser-Laufzeitbestandteil. Die vollständige Ursprungssimulation wurde für dieses Release nicht erneut gerechnet. Neu geprüft wurden Zuordnung und alle Wertebereiche sowie 12 unabhängige Simulationen (6 repräsentative Hände × 2 Gegnerzahlen, je 30.000 Austeilungen). Neu erzeugte Dateien ersetzen die kanonische Datei erst nach einem dokumentierten Vergleich.

## Neuer Browserauswerter

Eigene Implementierung in `src/evaluator.js`: Häufigkeiten und Bitmasken für die besten fünf aus 5–7 Karten. Kategorien plus fünf Kicker werden als Basis-15-Zahl lexikografisch kodiert. Keine sechste Beikarte, keine Symbolpräferenz, Ass niedrig nur A2345. Für die sichtbaren fünf Karten werden alle Fünfer-Teilmengen verglichen. Der heiße Simulationspfad verwendet direkt die Rang-/Symbolzählung; validierte Eingaben sind Voraussetzung.

Jede Simulation zieht aus dem Restdeck mit partiellem Fisher–Yates ohne Zurücklegen, ergänzt zuerst das Board und danach je zwei Karten für jeden Gegner. Dieselbe faire Verteilung entstünde bei umgekehrter Reihenfolge. Unbekannte gefoldete Karten werden mangels Informationen nicht entfernt; ihr Marginaleffekt ist bereits im Zufallsmodell enthalten. Kein Modell für selektives Folden oder gegnerische Einsatzverteilungen.

Mulberry32, Seed 20260925, 30.000 Austeilungen je Anfrage; erste Zwischenanzeige nach 2.000, weitere nach 10.000/20.000. Keine optionale vorzeitige statistische Stoppregel. Kartenänderungen beenden den Worker und erhöhen eine Anfrage-ID; alte Antworten werden verworfen. Ein 30-Sekunden-Wächter ersetzt hängende Berechnungen durch einen erklärten Fehler. River gegen einen Gegner: exakt C(45,2) = 990 Hände. Größere Räume werden simuliert. Eine Modellrechnung ist auch bei exakter Enumeration keine sichere Prognose gegen spielende Menschen.

Für jede Austeilung ist X = 0 bei Verlust, 1 bei Alleinsieg, 1/k bei k gemeinsamen Gewinnern. Equity = Mittelwert von X. Sieg, Teilung, Verlust sind getrennte Ereignisse; Teilung ist eine Wahrscheinlichkeit, kein Potanteil. Normalapproximation für den geschätzten einzelnen 95-%-Fehler: 1,96 × sqrt((Mittel(X²) − Mittel(X)²)/(n−1)). An Randwerten ist diese Approximation schwächer; die Live-Anzeige verwendet deshalb mindestens 3/n als Halbbreite. Intervalle werden auf [0,1] begrenzt. Vorbereitete Daten behalten ihre ursprünglichen Normalintervalle. Alle Intervalle betreffen nur Stichprobenrauschen, nicht Gegner-Modellfehler. Rundung der Anzeige kann eine sehr hohe/niedrige Quote als 100,0/0,0 % darstellen.

Rangliste: fallend nach Equity bei der ausgewählten Gegnerzahl, keine abgesicherte Totalordnung. Die einzelnen 95-%-Intervalle schützen weder simultan alle 169 Ränge noch alle Zwischenanzeigen. Kleine Unterschiede ausdrücklich unsicher.

## Treffer und Entscheidungen

Die Draw-Anzeige enumeriert genau jene verbleibenden Einzelkarten, die eine aktuell fehlende Straße oder einen aktuell fehlenden Flush vervollständigen. Überschneidungen werden durch eine Menge entfernt. Sie beschreibt nur diesen Treffer, keinen Sieg, keine vollständige Verbesserungsmenge und keine Backdoor-Chance. Die finale Kategorienverteilung enthält jedes Ergebnis genau einmal nach seiner höchsten Kategorie und darf nicht als universelle Gewinnchance einer Kategorie gelesen werden.

Die Euro-Hilfe verwendet Euro-Cent als Ganzzahlen, keine Fließkomma-Vergleiche bei Mindestbeträgen. Nichtnegative Zahlen, höchstens zwei Nachkommastellen, Komma oder Punkt. Leer ist unbekannt. Callformel bei abschließender Zahlung: C/(P+C) und q(P+C)−C. Ohne ausdrückliche Bestätigung, dass keine weiteren Zahlungen anfallen, wird kein solcher Erwartungswert als Entscheidung angezeigt. Zufallsgegnerwerte bleiben auch mit Bestätigung ausdrücklich ein Modellbeispiel. Eine eigene q-Schätzung ist getrennt bezeichnet und muss zwischen 0 und 100 % liegen. Das ist keine gemessene Bluffquote.

Heuristik bei ungeöffnetem Pot, 5–6 Personen: früh 66+, ATs+, AJo+, KQs, KJs, QJs, JTs; Cutoff zusätzlich kleine Paare, alle suited Asse, KTs, QTs, T9s, 98s, KQo, KJo, QJo; Button zusätzlich alle suited Könige, Q8s–Q9s, J8s–J9s, T8s, 97s, 87s, 76s, 65s, alle offsuit Asse, KTo, QTo, JTo. Small Blind nutzt Cutoff-Auswahl. Diese konservative Anpassung ist kein Solver-Optimum und keine aus Equity abgeleitete Schwelle. Standardgröße 3 BB; bei Limpern nur AA–TT, AK und AQs: 3 BB + 1 BB je Limper. Nach einer Erhöhung zeigt die App Regelgrenze und Callkosten, keine automatische 3-Bet aus einem Equity-Prozentwert.

Flop bei Call=0: erste passende Regel. Warnzeichen zuerst; ohne Warnzeichen mit mindestens zwei Paaren und ausdrücklicher Erwartung, dass schlechtere Hände zahlen, ungefähr halber Pot. Sonst Check als vorsichtige Orientierung. Jeder Vorschlag berücksichtigt Chipgröße, Mindestbet und verbleibenden Betrag; keine automatische Stack-Aufbrauch-Empfehlung. Turn/River haben Kartenrechnung, aber keinen erweiterten Bet-Entscheidungsbaum. Kurze All-ins, Nebenpots, Gebühren, Ante und abweichende Limitregeln deaktivieren die einfache Hilfe. Unterschiedliche gegnerische Stacks werden nicht automatisch rekonstruiert.

## Primärquellen, Stand 25.09.2026

- [PokerStars: Texas Hold’em](https://www.pokerstars.com/poker/games/texas-holdem/) – beste fünf, Blinds, volle Mindest-Erhöhungen. Hausregeln der konkreten Runde bleiben zu bestätigen.
- [PokerStars: Handregeln](https://www.pokerstars.com/poker/games/rules/) – Kategorien und Vergleiche.
- [PokerStars Learn: Pot Odds](https://www.pokerstars.com/poker/learn/lesson/pot-odds/) – Callpreis und spätere Kosten. Vereinfachende Gleichsetzungen von Draw-Treffer und Equity im Lehrtext werden hier nicht übernommen.
- [PokerStars Learn: Starthandauswahl](https://www.pokerstars.com/poker/learn/strategies/level-up-your-starting-hand-selection/) – Position und Auswahl als Strategiegrundlagen; keine exakte Quelle für die eigene reduzierte Auswahlliste.
- [PH Evaluator](https://github.com/HenryRLee/PokerHandEvaluator) – Ursprungsauswerter, Apache-2.0.
- [pokersolver](https://github.com/goldfire/pokersolver) – unabhängiger Entwicklungs-Testauswerter, MIT.
- [GitHub: Pages-Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) – Buildartefakt, OIDC, Umgebung. Action-Versionen zusätzlich gegen aktuelle offizielle Releases geprüft und auf Commit-SHAs fixiert.

## Datenschutz und Lizenzgrenzen

Keine persönlichen Aufzeichnungen, Originaldokumente, versteckten Markdown-Bytes, privaten Pfade oder Geräteinformationen im öffentlichen Inhalt. Keine Analyseintegration oder externe Fonts. Keine Datenübertragung durch Karten-/Einsatzformulare, keine Speicherung zwischen Browser-Sitzungen. Hostingzugriffe sind trotzdem technisch für GitHub sichtbar. Lokale Datenimport-Skripte veröffentlichen keine Quelldatei. Ausschließlich `dist` ist das Pages-Artefakt.

Build-/Testabhängigkeiten: Vite MIT, Playwright Apache-2.0, pokersolver MIT; sie werden als Entwicklungswerkzeuge genutzt. Der Laufzeit-Auswerter ist eigene Implementierung. PH Evaluator ist nur optionale Reproduktionsabhängigkeit, nicht im Browser gebündelt. Quellentexte wurden nicht kopiert; Erläuterungen sind eigene Zusammenfassungen. Das Repository erteilt derzeit keine zusätzliche pauschale Lizenz für eigene Inhalte.
