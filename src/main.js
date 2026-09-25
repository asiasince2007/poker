import stats from "../data/preflop.json";
import {
  ranks,
  suits,
  suitNames,
  rankNames,
  cardName,
  shortCard,
  handClass,
} from "./cards.js";
import { bestFive, categories } from "./evaluator.js";
import { drawOuts } from "./draws.js";
import { advice, money, callPrice, euros } from "./strategy.js";
const $ = (id) => document.getElementById(id);
const pc = (q) =>
  (q * 100).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + " %";
const number = (n) => n.toLocaleString("de-DE");
const cards = Array(7).fill(null);
let worker,
  watchdog,
  generation = 0,
  current = null,
  selectedSlot = 0,
  selectedRank = "A",
  calculationFailed = false;
const hero = () => cards.slice(0, 2).filter((c) => c !== null);
const board = () => cards.slice(2).filter((c) => c !== null);
const enemies = () => Number($("opponents").value);
const textFields = [
  "pot",
  "call",
  "paid",
  "stack",
  "highest",
  "lastRaise",
  "q",
  "limpers",
];
function resetSituation() {
  textFields.forEach((id) => ($(id).value = ""));
  ["closing", "special", "worseCalls"].forEach((id) => ($(id).checked = false));
  $("position").value = "";
  $("situation").value = "";
}
function cancel() {
  generation++;
  worker?.terminate();
  worker = null;
  clearTimeout(watchdog);
  current = null;
}
function fail(message) {
  cancel();
  calculationFailed = true;
  $("result").innerHTML =
    '<h2>Berechnung nicht verfügbar</h2><p></p><button id="retry">Erneut versuchen</button>';
  $("result").querySelector("p").textContent = message;
  $("retry").onclick = recalculate;
  $("calculation").textContent =
    "Keine aktuelle Wahrscheinlichkeitsberechnung. Bitte erneut versuchen.";
  updateAdvice();
}
window.addEventListener("error", () =>
  fail(
    "Es ist ein technischer Fehler aufgetreten. Bitte neu versuchen oder die Seite neu laden.",
  ),
);
window.addEventListener("unhandledrejection", () =>
  fail(
    "Die Berechnung konnte nicht abgeschlossen werden. Bitte die Seite neu laden.",
  ),
);
function cardButton(c, i) {
  const b = document.createElement("button");
  b.className = `card ${c === null ? "empty" : c % 4 === 1 || c % 4 === 2 ? "red" : "black"}`;
  const label =
    i < 2
      ? `Handkarte ${i + 1}`
      : i < 5
        ? `Flopkarte ${i - 1}`
        : i === 5
          ? "Turn"
          : "River";
  b.setAttribute(
    "aria-label",
    `${label}: ${c === null ? "wählen" : cardName(c)}`,
  );
  b.innerHTML =
    c === null
      ? `${i < 2 ? i + 1 : i < 5 ? "Flop " + (i - 1) : label}<br>＋`
      : `${ranks[c >> 2].replace("T", "10")}<small>${suits[c % 4]}</small>`;
  b.disabled =
    (i === 5 && cards.slice(2, 5).some((c) => c === null)) ||
    (i === 6 && cards.slice(2, 6).some((c) => c === null));
  b.onclick = () => openPicker(i);
  return b;
}
function renderCards() {
  $("hero-cards").replaceChildren(
    ...cards.slice(0, 2).map((c, i) => cardButton(c, i)),
  );
  $("board-cards").replaceChildren(
    ...cards.slice(2).map((c, i) => cardButton(c, i + 2)),
  );
  $("clear-board").disabled = !board().length;
}
function openPicker(slot) {
  selectedSlot = slot;
  selectedRank = cards[slot] === null ? "A" : ranks[cards[slot] >> 2];
  $("picker-title").textContent =
    slot < 2
      ? `Deine Karte ${slot + 1}`
      : slot < 5
        ? `Flopkarte ${slot - 1}`
        : slot === 5
          ? "Turn auswählen"
          : "River auswählen";
  renderPicker();
  $("picker").showModal();
}
function renderPicker() {
  $("rank-picker").replaceChildren(
    ...[...ranks].reverse().map((r) => {
      const b = document.createElement("button");
      b.textContent = r.replace("T", "10");
      b.setAttribute("aria-label", `Wert ${rankNames[r] || r}`);
      b.setAttribute("aria-pressed", String(r === selectedRank));
      b.onclick = () => {
        selectedRank = r;
        renderPicker();
      };
      return b;
    }),
  );
  $("suit-picker").replaceChildren(
    ...suits.map((s, i) => {
      const c = ranks.indexOf(selectedRank) * 4 + i,
        b = document.createElement("button");
      b.textContent = `${s} ${suitNames[i]}`;
      b.className = i === 1 || i === 2 ? "red" : "black";
      b.setAttribute("aria-label", cardName(c));
      b.disabled = cards.some((v, j) => v === c && j !== selectedSlot);
      b.onclick = () => setCard(c);
      return b;
    }),
  );
  $("remove-card").disabled = cards[selectedSlot] === null;
}
function setCard(c) {
  const oldStage = stage();
  cards[selectedSlot] = c;
  if (c === null && selectedSlot >= 2 && selectedSlot < 5) {
    cards[5] = null;
    cards[6] = null;
  }
  if (c === null && selectedSlot === 5) cards[6] = null;
  if (stage() !== oldStage) resetSituation();
  $("q").value = "";
  $("closing").checked = false;
  $("worseCalls").checked = false;
  $("picker").close();
  renderCards();
  recalculate();
}
function stage() {
  const n = board().length;
  return n < 3 ? 0 : n;
}
$("close-picker").onclick = () => $("picker").close();
$("remove-card").onclick = () => setCard(null);
$("new-hand").onclick = () => {
  cards.fill(null);
  resetSituation();
  $("opponents").value = "5";
  renderCards();
  recalculate();
};
$("clear-board").onclick = () => {
  cards.fill(null, 2);
  resetSituation();
  renderCards();
  recalculate();
};
$("opponents").onchange = () => {
  $("q").value = "";
  $("closing").checked = false;
  $("worseCalls").checked = false;
  recalculate();
};
function ranking() {
  const opponents = enemies() || 5,
    rows = [...stats.preflop].sort(
      (a, b) =>
        b.estimates[opponents - 1].equity - a.estimates[opponents - 1].equity,
    );
  const key = hero().length === 2 ? handClass(hero()) : "";
  $("ranking-note").textContent =
    `Nach Potanteil gegen ${opponents} Zufallsgegner. Nahe Rangplätze sind keine sicheren Stärkeunterschiede.`;
  $("ranking-body").innerHTML = rows
    .map(
      (r, i) =>
        `<tr class="${r.hand === key ? "highlight" : ""}"><td>${i + 1}</td><td>${r.hand}</td><td>${pc(r.estimates[opponents - 1].equity / 100)}</td><td>${r.estimates[opponents - 1].ci95_pp.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td></tr>`,
    )
    .join("");
  return rows.findIndex((r) => r.hand === key) + 1;
}
function recalculate() {
  cancel();
  calculationFailed = false;
  const h = hero(),
    b = board(),
    count = enemies(),
    rankIndex = ranking();
  $("street").textContent =
    b.length === 0
      ? "VOR DEM FLOP"
      : b.length < 3
        ? "FLOP ERGÄNZEN"
        : b.length === 3
          ? "FLOP"
          : b.length === 4
            ? "TURN"
            : "RIVER";
  $("current-hand").replaceChildren();
  $("calculation").textContent = "Wähle zuerst deine Karten.";
  if (count === 0) {
    $("result").innerHTML =
      "<h2>Pot ohne Kartenvergleich gewonnen</h2><p>Alle Gegner sind ausgestiegen. Eine Equity-Berechnung ist nicht nötig.</p>";
    updateAdvice();
    return;
  }
  if (h.length < 2 || (b.length > 0 && b.length < 3)) {
    $("result").innerHTML =
      h.length < 2
        ? `<h2>Wähle deine ${h.length ? "zweite Karte" : "zwei Karten"}.</h2><p>Danach siehst du sofort den statistischen Potanteil. Den Flop kannst du hier ergänzen.</p>`
        : `<h2>Flop noch unvollständig</h2><p>${b.length} von 3 Flopkarten gewählt. Ergänze den Flop oder leere den Tisch für die Preflop-Rechnung.</p>`;
    updateAdvice();
    return;
  }
  if (b.length === 0) {
    const key = handClass(h),
      data = stats.preflop.find((r) => r.hand === key).estimates[count - 1];
    current = {
      equity: data.equity / 100,
      halfWidth: data.ci95_pp / 100,
      n: stats.n_per_scenario,
      method: "preflop",
    };
    $("result").innerHTML =
      `<div class="result-top"><div><span class="metric-label">Erwarteter Potanteil (Equity)</span><strong class="equity-number">${pc(current.equity)}</strong></div><span class="result-tag">${key} · Rang ${rankIndex}/169</span></div><p>Gegen ${count} Zufallsgegner · ± ${data.ci95_pp.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Prozentpunkte¹</p>`;
    $("current-hand").innerHTML =
      `<div class="current"><h3>${key} · ${key.length === 2 ? "Paar" : key.endsWith("s") ? "Gleiches Kartensymbol" : "Verschiedene Kartensymbole"}</h3><p>${rankIndex <= 17 ? "Unter den oberen 10 % der Klassen in diesem Modell." : `Rang ${rankIndex} von 169 Klassen in diesem Modell.`} Eine passende Aktion hängt außerdem von Position, Einsätzen und Gegnerauswahl ab.</p></div>`;
    $("calculation").innerHTML =
      `<p>Vorberechnete Monte-Carlo-Simulation: ${number(current.n)} Austeilungen je Klasse; Startwert ${stats.seed}. ¹ Geschätztes einzelnes 95-%-Intervall: ${pc(Math.max(0, current.equity - current.halfWidth))} bis ${pc(Math.min(1, current.equity + current.halfWidth))}. Nahe Rangplätze können sich durch Stichprobenfehler vertauschen.</p><p>Alleinsieg und Teilung sind im übernommenen Datensatz nicht getrennt gespeichert und werden nicht aus der Equity abgeleitet. Paare: 6, suited: 4, offsuit: 12 konkrete Kombinationen je Klasse.</p>`;
    updateAdvice();
    return;
  }
  const best = bestFive([...h, ...b]);
  $("current-hand").innerHTML =
    `<div class="current"><h3>Aktuell: ${categories[best.category]}</h3><span class="mini-cards">${best.cards.map(shortCard).join(" ")}</span><p>Beste fünf aus deinen Karten und dem bisherigen Tisch. Das ist noch keine Gewinnwahrscheinlichkeit.</p></div>`;
  $("result").innerHTML =
    '<h2 class="loading">Deine Karten werden berechnet …</h2><p>Zufällige Gegner und alle noch kommenden Tischkarten. Du kannst die Eingaben weiter ändern.</p>';
  $("calculation").textContent = "Simulation läuft …";
  updateAdvice();
  const id = generation;
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    watchdog = setTimeout(() => {
      if (id === generation)
        fail("Die Berechnung dauert zu lange. Bitte erneut versuchen.");
    }, 30000);
    worker.onerror = () => {
      if (id === generation)
        fail(
          "Der Rechenprozess konnte nicht gestartet werden. Prüfe die Verbindung und lade neu.",
        );
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== generation) return;
      if (data.error) {
        fail(data.error);
        return;
      }
      current = data.result;
      renderEquity(Boolean(data.partial));
      if (!data.partial) {
        clearTimeout(watchdog);
        worker.terminate();
        worker = null;
      }
      updateAdvice();
    };
    worker.postMessage({
      id,
      hero: h,
      board: b,
      opponents: count,
      n: 30000,
      seed: 20260925,
    });
  } catch {
    fail(
      "Web Worker ist in diesem Browser nicht verfügbar. Bitte die Website in einem aktuellen Safari öffnen.",
    );
  }
}
function renderEquity(partial) {
  const r = current,
    exact = r.method === "exact";
  $("result").innerHTML =
    `<div class="result-top"><div><span class="metric-label">Erwarteter Potanteil (Equity)</span><strong class="equity-number">${pc(r.equity)}</strong></div><span class="result-tag">${partial ? "Näherung läuft" : exact ? "Exakt im Modell" : "Simulation fertig"}</span></div><p>Gegen ${enemies()} Zufallsgegner · ${number(r.n)} ${exact ? "Gegnerhände" : "Austeilungen"}${exact ? "" : ` · ± ${(100 * r.halfWidth).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Prozentpunkte¹`}</p><div class="stats"><div><strong>${pc(r.win)}</strong><span>Alleinsieg</span></div><div><strong>${pc(r.tie)}</strong><span>Geteilter Sieg</span></div><div><strong>${pc(r.loss)}</strong><span>Verlust</span></div></div>`;
  const draws = drawOuts(hero(), board());
  $("calculation").innerHTML =
    `<p>${exact ? "Exakte Enumeration aller 990 legalen Gegnerhände am River." : `Monte-Carlo-Simulation mit ${number(r.n)} Austeilungen, Startwert ${r.seed}. ¹ Geschätztes einzelnes 95-%-Intervall: ${pc(Math.max(0, r.equity - r.halfWidth))} bis ${pc(Math.min(1, r.equity + r.halfWidth))}. Bei ${partial ? "dieser Zwischenanzeige" : "der Schlussanzeige"} beschreibt es ausschließlich den Stichprobenfehler.`}</p>${draws ? `<h3>Nächste Karte: Straße / Flush treffen</h3><p>${draws.flush.length} Flush-Karten + ${draws.straight.length} Straßen-Karten = <strong>${draws.union.length} verschiedene Trefferkarten</strong> nach Abzug von Überschneidungen. ${pc(draws.next)} für einen dieser Treffer auf der nächsten Karte.</p>${draws.union.length ? `<p class="mini-cards">${draws.union.map(shortCard).join(" ")}</p>` : ""}<p>Gezählt wird das Vervollständigen einer jetzt noch fehlenden Straße oder eines Flushs. Das sind keine sicheren Gewinn-Outs; ein Treffer kann später verlieren oder auf dem Tisch liegen. Keine vollständige Liste aller Verbesserungen; Backdoor-Wege brauchen zwei Karten.</p>` : ""}<h3>Deine Handkategorie am River</h3><p>${r.finalCategories
      .map((p, i) => (p > 0 ? `${categories[i]}: ${pc(p)}` : ""))
      .filter(Boolean)
      .join(
        " · ",
      )}</p><p>Jede fertige Hand zählt nur in ihrer höchsten Kategorie. Diese Verteilung beschreibt deine Kombination, nicht die Chance, mit dieser Kategorie zu gewinnen.</p>`;
}
function updateAdvice() {
  const b = board(),
    s = Object.fromEntries(
      [
        "pot",
        "call",
        "paid",
        "stack",
        "bb",
        "sb",
        "chip",
        "highest",
        "lastRaise",
      ].map((id) => [id, money($(id).value)]),
    );
  const invalid = Object.keys(s).filter(
    (id) => $(id).value.trim() && s[id] === null,
  );
  $("preflop-situation").hidden = b.length >= 3;
  $("worse-field").hidden = b.length !== 3;
  $("limpers-field").hidden = $("situation").value !== "limped";
  document
    .querySelectorAll(".raise-field")
    .forEach((e) => (e.hidden = $("situation").value !== "raised"));
  if (calculationFailed) {
    $("advice").textContent =
      "Die Kartenberechnung ist fehlgeschlagen. Keine aktuelle Handlungsempfehlung; bitte erneut berechnen.";
    $("threshold").textContent = "Berechnung unterbrochen.";
    $("call-result").textContent = "Keine aktuelle Callbewertung.";
    return;
  }
  const rulesValid =
    s.sb !== null &&
    s.sb > 0 &&
    s.sb <= s.bb &&
    s.chip > 0 &&
    s.sb % s.chip === 0;
  $("advice").textContent = invalid.length
    ? "Ungültiger Geldwert: bitte nichtnegative Eurobeträge mit höchstens zwei Nachkommastellen eingeben."
    : !rulesValid
      ? "Small Blind, Big Blind und kleinsten Chip konsistent eintragen."
      : advice({
          ...s,
          hero: hero(),
          board: b,
          opponents: enemies(),
          position: $("position").value,
          situation: $("situation").value,
          limpers:
            $("limpers").value === "" ? null : Number($("limpers").value),
          rules: $("rules").checked,
          special: $("special").checked,
          worseCalls: $("worseCalls").checked,
        });
  if (s.pot === null || s.call === null || s.pot + s.call <= 0) {
    $("threshold").textContent =
      "Pot und zusätzlichen Call als nichtnegative Eurobeträge mit positivem Endpot eintragen.";
    $("call-result").textContent = "Noch keine Callbewertung.";
    return;
  }
  if ($("special").checked || !$("rules").checked) {
    $("threshold").textContent =
      "Gewinnbaren Pot und Hausregeln zuerst klären.";
    $("call-result").textContent =
      "Einfache Callformel für diese Situation ausgesetzt.";
    return;
  }
  $("threshold").textContent =
    `Mathematischer Preis: ${euros(s.call)} zusätzlich in ${euros(s.pot)} gewinnbaren Pot. Nötiger Potanteil: ${pc(s.call / (s.pot + s.call))}.`;
  const qText = $("q").value.trim(),
    qValid = /^\d+(?:[.,]\d+)?$/.test(qText),
    q = qText
      ? qValid
        ? Number(qText.replace(",", ".")) / 100
        : NaN
      : current?.equity;
  if (qText && (!Number.isFinite(q) || q < 0 || q > 1)) {
    $("call-result").textContent =
      "Potanteil muss zwischen 0 und 100 % liegen.";
    return;
  }
  if (s.stack !== null && s.call > s.stack) {
    $("call-result").textContent =
      "Call übersteigt die spielbaren Chips; All-in und Nebenpot gesondert prüfen.";
    return;
  }
  if (!$("closing").checked) {
    $("call-result").textContent =
      "Weitere Zahlungen sind möglich oder noch ungeklärt. Der Callpreis allein erlaubt keinen Vergleich mit einer bis zum River berechneten Equity.";
    return;
  }
  if (!Number.isFinite(q)) {
    $("call-result").textContent =
      "Eine aktuelle Kartenrechnung oder eine eigene begründete Potanteil-Schätzung fehlt.";
    return;
  }
  const calculation = callPrice(s.pot, s.call, q);
  $("call-result").textContent =
    `${qText ? "Mit deiner eigenen Schätzung" : "Nur als Zufallsgegner-Modellbeispiel"} (${pc(q)}): Erwartungswert ${euros(calculation.ev)}. ${qText ? (calculation.ev > 0 ? "Im angegebenen Modell rechnerisch günstiger Call; Qualität der Schätzung bleibt entscheidend." : calculation.ev < 0 ? "Im angegebenen Modell ist Aussteigen rechnerisch günstiger als Mitgehen." : "Rechnerisch neutral, kein Puffer für Schätzfehler.") : "Keine automatische Call-Empfehlung gegen einen tatsächlichen Einsatz."}`;
}
document
  .querySelectorAll("#spielhilfe input, #spielhilfe select")
  .forEach((el) => el.addEventListener("input", updateAdvice));
$("new-hand").disabled = false;
$("opponents").disabled = false;
renderCards();
recalculate();
fetch("./version.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((v) => {
    if (v?.commit)
      $("version").textContent =
        `Veröffentlichter Stand: ${v.commit.slice(0, 12)}`;
  })
  .catch(() => {});
