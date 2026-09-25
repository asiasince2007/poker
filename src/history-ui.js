import { shortCard } from "./cards.js";
import { euros, money } from "./strategy.js";
import {
  readHistory,
  writeRecord,
  removeRecord,
  summarize,
  outcomeNames,
} from "./history.js";

export function initHistory(snapshot) {
  const $ = (id) => document.getElementById(id);
  let activeId = null,
    draft = null,
    shown = false;
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function amountLabel() {
    const lost = $("save-outcome").value === "lost";
    $("save-amount-label").textContent = lost
      ? "Ca. verlorener eigener Einsatz (€), optional"
      : "Ca. gesamte Auszahlung (€), optional";
    $("save-amount-hint").textContent = lost
      ? "Nur deinen verlorenen Einsatz schätzen."
      : "Inklusive zurückerhaltenem eigenem Einsatz; kein Nettogewinn. Bei Teilung nur dein ausgezahlter Anteil.";
  }
  function conceal() {
    shown = false;
    $("history-content").hidden = true;
    $("toggle-history").textContent = "Zeigen";
    $("toggle-history").setAttribute("aria-pressed", "false");
    $("export-history").disabled = true;
    $("history-message").textContent = "Verlauf verdeckt.";
    $("save-dialog").close();
    $("history-dialog").close();
  }
  function renderHistory() {
    $("history-content").hidden = !shown;
    $("toggle-history").textContent = shown ? "Verbergen" : "Zeigen";
    $("toggle-history").setAttribute("aria-pressed", String(shown));
    $("export-history").disabled = !shown;
    if (!shown) {
      $("history-message").textContent = "Verlauf verdeckt.";
      return;
    }
    try {
      const records = readHistory(localStorage),
        s = summarize(records);
      $("history-message").textContent =
        `${s.count} Hände · nur in diesem Browser`;
      $("history-summary").replaceChildren(
        node(
          "p",
          `${s.won} gewonnen · ${s.lost} verloren · ${s.split} geteilt. ${s.withBoard} mit mindestens einer erfassten Tischkarte.`,
        ),
        node(
          "p",
          `Geschätzte Auszahlungen inkl. Einsatz: ${euros(s.grossPayoutCents)} aus ${s.payoutEntries} Betragsangaben. Geschätzte verlorene Einsätze: ${euros(s.lostStakeCents)} aus ${s.lossEntries} Betragsangaben.`,
        ),
        node(
          "p",
          "Keine Nettobilanz: Bei Gewinnen fehlt der eigene Gesamteinsatz. Leere Beträge zählen als unbekannt. Freiwillig erfasste Hände sind keine repräsentative Stichprobe; diese Häufigkeiten sind keine künftigen Gewinnchancen.",
          "micro",
        ),
      );
      $("history-groups").replaceChildren(
        node("h3", "Nach Starthand"),
        ...s.groups.map((g) =>
          node(
            "p",
            `${g.hand}: ${g.count} erfasst · ${g.won} gewonnen / ${g.lost} verloren / ${g.split} geteilt`,
            "micro",
          ),
        ),
      );
      $("history-list").replaceChildren(
        ...[...records].reverse().map((r) => {
          const row = document.createElement("article");
          row.className = "history-entry";
          const boardText = r.board.length
            ? r.board.map(shortCard).join(" ") +
              (r.board.length < 3
                ? " (unvollständig erfasst)"
                : ` (${["", "", "", "Flop", "Turn", "River"][r.board.length]} erfasst)`)
            : "nicht erfasst";
          row.append(
            node(
              "h3",
              `${r.hero.map(shortCard).join(" ")} · ${outcomeNames[r.outcome]}`,
            ),
            node("p", `Tisch: ${boardText}`),
            node(
              "p",
              `${new Date(r.createdAt).toLocaleString("de-DE")} · ${r.opponents} Gegner bei Erfassung`,
              "micro",
            ),
            node(
              "p",
              r.amountCents === null
                ? "Betrag nicht angegeben"
                : `Ca. ${euros(r.amountCents)} ${r.outcome === "lost" ? "verlorener Einsatz" : "Auszahlung inkl. eigenem Einsatz"}`,
              "micro",
            ),
          );
          const del = node("button", "Löschen");
          del.onclick = () => {
            if (!confirm("Diesen gespeicherten Eintrag löschen?")) return;
            try {
              removeRecord(localStorage, r.id);
              if (activeId === r.id) activeId = null;
              renderHistory();
            } catch {
              $("history-message").textContent =
                "Löschen fehlgeschlagen. Die Daten wurden nicht als gelöscht bestätigt.";
            }
          };
          row.append(del);
          return row;
        }),
      );
    } catch {
      $("history-content").hidden = true;
      $("export-history").disabled = true;
      $("history-message").textContent =
        "Verlauf nicht lesbar oder Browserspeicher gesperrt. Bestehende Daten werden nicht überschrieben.";
    }
  }
  $("save-hand").onclick = () => {
    draft = snapshot();
    if (draft.hero.length !== 2) return;
    $("save-feedback").textContent = "";
    $("save-outcome").value = "";
    $("save-amount").value = "";
    $("save-board").checked = draft.board.length > 0;
    $("save-board").disabled = !draft.board.length;
    $("save-card-summary").textContent =
      `Zwei Handkarten und optional ${draft.board.length} Tischkarten. Kartenwerte bleiben hier verdeckt.`;
    $("confirm-save").disabled = false;
    try {
      const old = readHistory(localStorage).find((r) => r.id === activeId);
      if (old) {
        $("save-outcome").value = old.outcome;
        $("save-amount").value =
          old.amountCents === null
            ? ""
            : (old.amountCents / 100).toFixed(2).replace(".", ",");
        draft.createdAt = old.createdAt;
        $("save-feedback").textContent =
          "Diese Hand ist bereits gespeichert. Speichern aktualisiert den Eintrag.";
      }
    } catch {
      $("confirm-save").disabled = true;
      $("save-feedback").textContent =
        "Speicher nicht lesbar oder gesperrt. Bestehende Daten bleiben erhalten.";
    }
    amountLabel();
    $("save-dialog").showModal();
  };
  $("save-outcome").onchange = () => {
    $("save-amount").value = "";
    amountLabel();
  };
  $("confirm-save").onclick = () => {
    const outcome = $("save-outcome").value,
      raw = $("save-amount").value.trim(),
      amountCents = raw ? money(raw) : null;
    if (!outcome || (raw && amountCents === null)) {
      $("save-feedback").textContent = !outcome
        ? "Bitte gewonnen, verloren oder geteilt auswählen."
        : "Betrag als nichtnegative Eurozahl eingeben oder leer lassen.";
      return;
    }
    try {
      const id = activeId || crypto.randomUUID();
      const saved = writeRecord(localStorage, {
        ...draft,
        id,
        createdAt: draft.createdAt || new Date().toISOString(),
        board: $("save-board").checked ? draft.board : [],
        outcome,
        amountCents,
      });
      activeId = id;
      draft.createdAt = saved.createdAt;
      $("save-feedback").textContent =
        "Gespeichert. Erneutes Speichern aktualisiert diese Hand. Für die nächste Runde „Neue Hand“ nutzen.";
    } catch {
      $("save-feedback").textContent =
        "Nicht gespeichert. Browserspeicher gesperrt, voll oder Daten nicht lesbar. Einträge gegebenenfalls zuerst exportieren.";
    }
  };
  $("close-save").onclick = () => $("save-dialog").close();
  $("open-history").onclick = () => {
    shown = false;
    renderHistory();
    $("history-dialog").showModal();
  };
  $("close-history").onclick = () => {
    shown = false;
    renderHistory();
    $("history-dialog").close();
  };
  $("toggle-history").onclick = () => {
    shown = !shown;
    renderHistory();
  };
  $("export-history").onclick = () => {
    if (!shown) return;
    try {
      const hands = readHistory(localStorage),
        data = {
          version: 1,
          exportedAt: new Date().toISOString(),
          notes:
            "Amounts are estimates: won/split = gross payout including returned own stake; lost = lost own stake. Missing board cards are unknown, not proof of a preflop finish. No net profit calculated.",
          hands,
        };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `haende-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      $("history-message").textContent =
        "Export angefordert. Die Datei enthält deine gespeicherten Karten und Beträge.";
    } catch {
      $("history-message").textContent =
        "Export nicht möglich; gespeicherte Daten konnten nicht gelesen werden.";
    }
  };
  return {
    conceal,
    reset: () => {
      activeId = null;
    },
    update: () => {
      $("save-hand").disabled = snapshot().hero.length !== 2;
    },
  };
}
