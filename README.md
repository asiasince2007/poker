# Pokerassistent

Deutsche Texas-Hold’em-Web-App für schnelle Handyeingaben. [Website öffnen](https://asiasince2007.github.io/poker/).

Kompakte schwarz-weiß-graue Hauptansicht mit „Aktuell“ ganz oben. Eigene Karten starten verdeckt; Tischkarten und Ergebnis sind standardmäßig sichtbar. Die Sichtschalter und „Alles verdecken“ verbergen auf Wunsch. Ein Appwechsel verdeckt nur eigene Karten und schließt den privaten Verlauf, ohne die Sichtbarkeit von Tischkarten und Ergebnis zu ändern. „Neue Hand“ stellt die Startsichtbarkeit wieder her. Karten bleiben auch verdeckt antippbar.

Bis zu acht aktive Gegner. Die ausgewählte Hand wird für die tatsächliche Gegnerzahl berechnet; die historische Starthand-Referenztabelle enthält nur 1–5 Gegner und ist für 6–8 ausdrücklich als 5-Gegner-Referenz gekennzeichnet.

„Hand speichern“ erfasst die eigenen Karten, optionale Tischkarten, gewonnen/verloren/geteilt sowie einen optionalen Schätzbetrag. Gewinn/Teilung meint die eigene gesamte Auszahlung inklusive Einsatz, Verlust den verlorenen eigenen Einsatz. Gespeichert wird ausschließlich im lokalen Browserspeicher. „Gespeicherte Hände“ zeigt einen zunächst verdeckten Verlauf, Häufigkeiten nach Starthand und einen JSON-Export; keine erfundene Nettobilanz. Wiederholtes Speichern aktualisiert dieselbe Hand, „Neue Hand“ beginnt einen neuen Eintrag. Browserdaten löschen oder Privatmodus können Daten entfernen; für längere Aufbewahrung exportieren.

Zwei konkrete Handkarten auswählen, dann den tatsächlichen Flop im selben Rechner ergänzen. Optional Turn und River hinzufügen. Gegnerzahl meint nur Gegner, die noch in der Hand sind. Die berechnete Equity ist der erwartete Potanteil gegen zufällige Gegner, keine Vorhersage gegen eine bestimmte Setzauswahl. Automatische Prozent-Faustregel ohne Einsatzangaben: unter 25 % nicht erhöhen, ab 25 % +0,60 €, ab 50 % +1,20 €, ab 75 % +2,40 €. Es zählt der angezeigte gerundete Potanteil. Die Stufen sind frei festgelegt, keine berechnete optimale Strategie oder sichere Callgrenze. Schieben geht nur ohne offenen Einsatz; Mitgehen und Erhöhen sind verschiedene Aktionen. Die frühere Eingabemaske und Einsatzlogik sind entfernt und im Git-Stand 4221e685d8cfed9229009461961b68cadc662535 nachvollziehbar.

## Lokal entwickeln und prüfen

Node.js ab 22.12 (CI: 24), npm und Git:

```sh
npm ci
npm run dev
npm test
npm run build
npm run check:privacy
npx playwright install chromium webkit
npm run test:browser
```

`npm run preview` zeigt den Produktionsbuild. Browsertests verwenden ausschließlich den Produktionsbuild unter `/poker/`, einschließlich Worker-URLs; vorher neu bauen. Unter Linux installiert `npx playwright install --with-deps chromium webkit` zusätzlich Systembibliotheken. Playwright 1.58.2 ist reproduzierbar fixiert: Chromium 145 und WebKit 26.0. Neuere Browserdownloads waren in der Entwicklungsumgebung nicht erreichbar; das ist kein echter iPhone-Test.

## Struktur

- `src/cards.js`, `evaluator.js`: Kartenkodierung und Handvergleich.
- `src/equity.js`, `worker.js`, `draws.js`: Simulation mit 1 oder 5 Mio. Austeilungen, exakte Heads-up-Auswertung ab dem Flop und definierte Trefferereignisse.
- `src/strategy.js`: Betragsvalidierung für den Verlauf und feste Prozent-Faustregel.
- `src/main.js`, `style.css`, `index.html`: Oberfläche, Zustände, Erläuterungen.
- `data/preflop.json`: einzige öffentliche Starthandstatistik; Rangliste und Einzelwerte teilen dieselbe Quelle.
- `tests`: exhaustive mathematische, unabhängige Vergleichs- und Browserprüfungen.
- [Methoden und Herkunft](docs/METHODEN.md), [Prüfumfang und iPhone-Abnahme](docs/PRUEFUNG.md).

Keine Framework-Laufzeit, API, Anmeldung oder extern geladenen Schriftarten. Vite bündelt native JavaScript-Module. Karteneingaben verlassen den Browser nicht. Kein Service Worker; Onlinebetrieb steht im Vordergrund. Die privaten Ausgangsdokumente gehören nicht in dieses Repository.

## Veröffentlichung

GitHub Pages muss auf **GitHub Actions** eingestellt sein. `.github/workflows/pages.yml` prüft Pull Requests mit Unit-/Statistiktests, Produktionsbuild, Inhaltsprüfung und Chromium/WebKit. Auf `main` wird nach denselben Prüfungen ausschließlich `dist` als Pages-Artefakt veröffentlicht. Der Deploymentjob nutzt die Umgebung `github-pages` und minimale OIDC-/Pages-Rechte. Bestehende Freigaben oder Schutzregeln werden nicht umgangen.

Aktuelle offizielle Action-Releases wurden am 25.09.2026 geprüft und auf Commit-SHAs fixiert. Relative Asset-/Worker-Pfade unterstützen den Repository-Unterpfad; es gibt keine clientseitigen Unterseitenrouten. `version.json` im Build enthält den tatsächlich gebauten Commit. Bei Pull-Request-Builds ist dies der GitHub-Testmerge-Commit; bei Veröffentlichung der Commit auf `main`.

Für einen überprüfbaren Release: PR-Diff prüfen, erfolgreiche Checks am aktuellen Commit abwarten, mergen, anschließend den Workflow auf `main` und `https://asiasince2007.github.io/poker/version.json` vergleichen. Live-Browsertests:

```powershell
$env:LIVE_URL='https://asiasince2007.github.io/poker/'
npm run test:browser
```

## Grenzen

Frei festgelegte Prozentstufen, keine optimale Strategie und kein Gegnerprofil. Keine automatische All-in-/Nebenpotberechnung. Die gespeicherte Preflop-Referenz enthält nur Equity. Die Live-Berechnung der ausgewählten Hand liefert zusätzlich getrennte Sieg-/Teilungsquoten. Standard: 1 Mio., optional 5 Mio. Austeilungen; gegen einen Gegner nach dem Flop exakt. Statistische Unsicherheit ist von Modellunsicherheit zu unterscheiden. Ein physisches iPhone muss separat abgenommen werden.
