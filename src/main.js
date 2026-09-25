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
import { initHistory } from "./history-ui.js";
import { advice, money, callPrice, callCeiling, euros } from "./strategy.js";
const $ = (id) => document.getElementById(id);
const pc = (q) =>
  (q * 100).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + " %";
const number = (n) => n.toLocaleString("de-DE");
const cards = Array(7).fill(null);
const revealed = { hero: false, board: false, equity: false };
let callSummary = "Callgrenze: Situation ergänzen.";
let completed = false;
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
const historyUI = initHistory(() => ({
  hero: hero(),
  board: board(),
  opponents: enemies(),
}));
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
  completed = false;
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
  $("public-status").textContent = "Berechnung fehlgeschlagen.";
  updateAdvice();
  applyVisibility();
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
  const visible = revealed[i < 2 ? "hero" : "board"];
  b.setAttribute(
    "aria-label",
    `${label}: ${c === null ? "wählen" : visible ? cardName(c) : "gesetzt, verdeckt"}`,
  );
  b.classList.toggle("covered", c !== null && !visible);
  b.innerHTML =
    c === null
      ? `${i < 2 ? i + 1 : i < 5 ? "Flop " + (i - 1) : label}<br>＋`
      : !visible
        ? "▧"
        : `${ranks[c >> 2].replace("T", "10")}<small>${suits[c % 4]}</small>`;
  b.disabled =
    (i === 5 && cards.slice(2, 5).some((c) => c === null)) ||
    (i === 6 && cards.slice(2, 6).some((c) => c === null));
  b.onclick = () => openPicker(i);
  return b;
}
function renderCards() {
  historyUI.update();
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
  if (selectedSlot < 2 && cards[selectedSlot] !== c) historyUI.reset();
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
  historyUI.reset();
  cards.fill(null);
  Object.keys(revealed).forEach((k) => (revealed[k] = false));
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
    referenceOpponents = Math.min(opponents, 5),
    rows = [...stats.preflop].sort(
      (a, b) =>
        b.estimates[referenceOpponents - 1].equity -
        a.estimates[referenceOpponents - 1].equity,
    );
  const key = hero().length === 2 ? handClass(hero()) : "";
  $("ranking-note").textContent =
    `${opponents > 5 ? "Referenztabelle nur bis 5 Gegner vorhanden; hier ausdrücklich 5 Gegner. Deine ausgewählte Hand wird oben gegen " + opponents + " Gegner neu berechnet. " : ""}Nach Potanteil gegen ${referenceOpponents} Zufallsgegner. Nahe Rangplätze sind keine sicheren Stärkeunterschiede.`;
  $("ranking-body").innerHTML = rows
    .map(
      (r, i) =>
        `<tr class="${opponents <= 5 && r.hand === key && revealed.hero && revealed.equity ? "highlight" : ""}"><td>${i + 1}</td><td>${r.hand}</td><td>${pc(r.estimates[referenceOpponents - 1].equity / 100)}</td><td>${r.estimates[referenceOpponents - 1].ci95_pp.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td></tr>`,
    )
    .join("");
  return rows.findIndex((r) => r.hand === key) + 1;
}
function recalculate() {
  cancel();
  calculationFailed = false;
  const h = hero(),
    b = board(),
    count = enemies();
  ranking();
  renderCurrent();
  $("street").textContent =
    b.length === 0
      ? "Vor dem Flop"
      : b.length < 3
        ? "Flop ergänzen"
        : b.length === 3
          ? "Flop"
          : b.length === 4
            ? "Turn"
            : "River";
  $("calculation").textContent = "Wähle zuerst deine Karten.";
  if (count === 0) {
    $("result").innerHTML = "<p>Pot ohne Kartenvergleich gewonnen.</p>";
    $("public-status").textContent = "Alle Gegner ausgestiegen.";
    updateAdvice();
    applyVisibility();
    return;
  }
  if (h.length < 2 || (b.length > 0 && b.length < 3)) {
    const message =
      h.length < 2
        ? `Wähle deine ${h.length ? "zweite Karte" : "zwei Karten"}.`
        : `Flop noch unvollständig: ${b.length} von 3.`;
    $("result").textContent = message;
    $("public-status").textContent = message;
    updateAdvice();
    applyVisibility();
    return;
  }
  const target = Number($("samples").value);
  if (!b.length && count <= 5) {
    const row = stats.preflop.find((r) => r.hand === handClass(h)).estimates[
      count - 1
    ];
    current = {
      equity: row.equity / 100,
      halfWidth: row.ci95_pp / 100,
      n: stats.n_per_scenario,
      method: "preflop",
    };
    renderEquity(true);
  } else {
    $("result").innerHTML = '<p class="loading">Berechnung läuft …</p>';
    $("public-status").textContent = "Berechnung läuft …";
  }
  updateAdvice();
  applyVisibility();
  const id = generation;
  // Inactivity timeout, renewed by real worker progress; not a 30-second limit
  // on an intentionally large sample. Input changes still terminate immediately.
  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (id === generation)
        fail("Der Rechenprozess antwortet nicht. Bitte erneut versuchen.");
    }, 45000);
  };
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    armWatchdog();
    worker.onerror = () => {
      if (id === generation)
        fail(
          "Der Rechenprozess konnte nicht gestartet werden. Bitte neu laden.",
        );
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== generation) return;
      if (data.error) {
        fail(data.error);
        return;
      }
      armWatchdog();
      if (data.result.method === "enumerating") {
        // A deterministic enumeration prefix is NOT a random sample. Show only
        // its progress, never biased prefix equity or a fake confidence interval.
        $("public-status").textContent =
          `Exakte Rechnung: ${number(data.result.n)} / ${number(data.result.total)}`;
        return;
      }
      // The saved 100k preflop estimate is a better immediate preview than the
      // initial 2k sample; do not replace it until the live sample catches up.
      if (
        data.partial &&
        current?.method === "preflop" &&
        data.result.n < current.n
      )
        return;
      current = data.result;
      completed = !data.partial;
      renderEquity(Boolean(data.partial));
      updateAdvice();
      applyVisibility();
      if (!data.partial) {
        clearTimeout(watchdog);
        worker.terminate();
        worker = null;
      }
    };
    worker.postMessage({
      id,
      hero: h,
      board: b,
      opponents: count,
      n: target,
      seed: 20260925,
    });
  } catch {
    fail(
      "Web Worker ist nicht verfügbar. Bitte einen aktuellen Safari verwenden.",
    );
  }
}
function renderCurrent() {
  const h = hero(),
    b = board();
  if (h.length < 2) $("current-hand").textContent = "Karten fehlen";
  else if (b.length > 0 && b.length < 3)
    $("current-hand").textContent = "Flop unvollständig";
  else if (!b.length) {
    const key = handClass(h);
    $("current-hand").textContent =
      `${revealed.hero ? key + " · " : ""}${key.length === 2 ? "Paar" : key.endsWith("s") ? "Gleiches Symbol" : "Verschiedene Symbole"}`;
  } else {
    const best = bestFive([...h, ...b]);
    $("current-hand").innerHTML =
      `<strong>${categories[best.category]}</strong>${revealed.hero && revealed.board ? `<span class="mini-cards">${best.cards.map(shortCard).join(" ")}</span>` : ""}`;
  }
}
function renderEquity(partial) {
  const r = current,
    exact = r.method === "exact",
    preview = r.method === "preflop";
  const label = preview
    ? "100.000 gespeichert · Verfeinerung läuft"
    : partial
      ? `Näherung: ${number(r.n)} / ${number(Number($("samples").value))}`
      : exact
        ? `Exakt · ${number(r.n)} Möglichkeiten`
        : `Simulation fertig · ${number(r.n)} Austeilungen`;
  $("public-status").textContent = label;
  $("result").innerHTML =
    `<strong class="equity-number">${pc(r.equity)}</strong><p class="uncertainty">${exact ? "Exakt im Zufallsmodell" : `± ${(100 * r.halfWidth).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Prozentpunkte¹`}</p>${preview ? "<p>Erste Näherung</p>" : `<div class="stats"><span>Alleinsieg <b>${pc(r.win)}</b></span><span>Teilung <b>${pc(r.tie)}</b></span><span>Verlust <b>${pc(r.loss)}</b></span></div>`}`;
  const draws = drawOuts(hero(), board());
  $("calculation").innerHTML =
    `<p>Gegen ${enemies()} zufällige Gegner. ${exact ? `Alle ${number(r.n)} legalen Kombinationen aus verbleibendem Board und Gegnerhand vollständig ausgewertet.` : `${preview ? "Gespeicherte erste Näherung" : "Monte-Carlo-Simulation"}: ${number(r.n)} Austeilungen. Startwert ${preview ? stats.seed : r.seed}. ¹ Geschätztes einzelnes 95-%-Intervall: ${pc(Math.max(0, r.equity - r.halfWidth))} bis ${pc(Math.min(1, r.equity + r.halfWidth))}. ${partial ? "Vorläufiger Zwischenstand." : "Fester Schlussstand."} Das Intervall beschreibt ausschließlich den Stichprobenfehler.`}</p><p>1 Mio. statt 30.000 Austeilungen reduziert den typischen Simulationsfehler um etwa Faktor 5,8; 5 Mio. um Faktor 12,9. Eine unpassende Gegnerauswahl wird dadurch nicht richtig. Vor dem Flop ist die Rangliste weiterhin eine separat bezeichnete 100.000er-Referenz, kein neuer Rang für diese Live-Schätzung.</p>${draws ? `<h3>Treffer auf der nächsten Karte</h3><p>${draws.flush.length} Flush-Karten + ${draws.straight.length} Straßen-Karten = ${draws.union.length} verschiedene Trefferkarten nach Abzug der Überschneidungen: ${pc(draws.next)}.</p><p>Nur das Vervollständigen einer fehlenden Straße/eines Flushs; kein sicherer Gewinn, keine vollständige Verbesserungsmenge und keine Backdoor-Wege.</p>` : ""}${
      r.finalCategories
        ? `<h3>Handkategorie am River</h3><p>${r.finalCategories
            .map((p, i) => (p > 0 ? `${categories[i]}: ${pc(p)}` : ""))
            .filter(Boolean)
            .join(
              " · ",
            )}</p><p>Jede Hand zählt nur in der höchsten Kategorie. Die Kategorieverteilung ist keine Gewinnquote.</p>`
        : ""
    }<p>Callgrenze: q × P / (1 − q), für den unveränderten aktuell gewinnbaren Pot P inklusive des gegnerischen Einsatzes. Nur bei abschließendem Call ohne weitere Kosten und ohne Nebenpot. Bei Simulation verwendet die angezeigte Modellgrenze die untere 95-%-Intervallgrenze statt des Punktschätzers und wird auf Chipgröße abgerundet sowie auf den Reststack begrenzt. Das berücksichtigt Stichprobenfehler, bietet aber keine Sicherheit gegen Modellfehler. Bei eigener q-Schätzung gibt es kein berechnetes Unsicherheitsintervall. Die Grenze ist kein eigener Setzbetrag und kein strategisches Optimum.</p>`;
}
function applyVisibility() {
  for (const key of ["hero", "board", "equity"]) {
    const button = $("toggle-" + key);
    button.textContent = revealed[key] ? "Verbergen" : "Zeigen";
    button.setAttribute(
      "aria-label",
      `${key === "hero" ? "Eigene Karten" : key === "board" ? "Tischkarten" : "Ergebnis"} ${revealed[key] ? "verbergen" : "zeigen"}`,
    );
    button.setAttribute("aria-pressed", String(revealed[key]));
  }
  const sensitiveHand =
    hero().length === 2 && (board().length === 0 || board().length >= 3);
  const sensitive = sensitiveHand && enemies() > 0 && !calculationFailed;
  $("current-hand").hidden = sensitiveHand && !revealed.equity;
  $("current-mask").hidden = !$("current-hand").hidden;
  $("result").hidden = sensitive && !revealed.equity;
  $("result-mask").hidden = !$("result").hidden;
  $("quick-advice").hidden = !revealed.equity;
  $("quick-call").hidden = !revealed.equity;
  $("advice").hidden = !revealed.equity;
  $("call-result").hidden = !revealed.equity;
  $("calculation-details").hidden = !revealed.equity;
  $("analysis-mask").hidden = revealed.equity;
}
function hideAll() {
  historyUI.conceal();
  Object.keys(revealed).forEach((key) => (revealed[key] = false));
  $("picker").close();
  $("analysis-dialog").close();
  $("situation-dialog").close();
  renderCards();
  renderCurrent();
  ranking();
  applyVisibility();
}
for (const key of ["hero", "board", "equity"]) {
  $("toggle-" + key).disabled = false;
  $("toggle-" + key).onclick = () => {
    revealed[key] = !revealed[key];
    renderCards();
    renderCurrent();
    ranking();
    applyVisibility();
  };
}
$("hide-all").onclick = hideAll;
window.addEventListener("pagehide", hideAll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hideAll();
});
$("samples").onchange = recalculate;
$("edit-situation").onclick = () => $("situation-dialog").showModal();
$("close-situation").onclick = () => $("situation-dialog").close();
$("show-details").onclick = () => $("analysis-dialog").showModal();
$("close-analysis").onclick = () => $("analysis-dialog").close();
function updateAdvice() {
  callSummary = "Callgrenze: Situation ergänzen.";
  computeAdvice();
  const text = $("advice").textContent;
  $("quick-advice").textContent = /fehlen|auswählen|Zuerst/.test(text)
    ? "Einsatz offen · Angaben ergänzen."
    : text.split(". ")[0] + (text.includes(". ") ? "." : "");
  $("quick-call").textContent = callSummary;
  applyVisibility();
}
function computeAdvice() {
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
  $("worse-field").hidden = b.length < 3;
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
  if (enemies() === 0) {
    $("advice").textContent = "Alle Gegner sind ausgestiegen: Pot gewonnen.";
    $("threshold").textContent = "Kein Call erforderlich.";
    $("call-result").textContent = "Pot ohne Kartenvergleich gewonnen.";
    callSummary = "Kein Call erforderlich.";
    return;
  }
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
    callSummary = "All-in / Nebenpot / Regeln: individuell prüfen.";
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
    callSummary = "Callgrenze offen: weitere Zahlungen möglich.";
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
  if (
    s.stack !== null &&
    s.chip > 0 &&
    !invalid.length &&
    rulesValid &&
    s.bb > 0 &&
    s.bb % s.chip === 0 &&
    [s.pot, s.call, s.stack].every((v) => v % s.chip === 0)
  ) {
    if (qText || completed) {
      const bound = qText ? q : Math.max(0, q - (current?.halfWidth || 0));
      const cap = callCeiling(s.pot, bound, s.chip, s.stack);
      callSummary = `${qText ? "Deine Schätzung" : "Zufallsmodell"}: Call höchstens ${euros(cap)}${cap === s.stack ? " (Reststack)" : ""}. Kein Optimum.`;
    } else callSummary = "Callgrenze: Schlussrechnung abwarten.";
  }
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
