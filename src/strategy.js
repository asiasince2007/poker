import { handClass, rank, suit } from "./cards.js";
import { bestFive } from "./evaluator.js";
export const euros = (cents) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export function money(text) {
  if (typeof text !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(text.trim()))
    return null;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n <= 100000 ? Math.round(n * 100) : null;
}
export function callPrice(pot, call, q) {
  if (
    ![pot, call, q].every(Number.isFinite) ||
    pot < 0 ||
    call < 0 ||
    pot + call <= 0 ||
    q < 0 ||
    q > 1
  )
    throw new Error("Pot, Call und Anteil prüfen.");
  return { required: call / (pot + call), ev: q * (pot + call) - call };
}
export function minimumRaise(highest, lastFullRaise, bb) {
  if (
    ![highest, lastFullRaise, bb].every(Number.isInteger) ||
    highest < 0 ||
    lastFullRaise <= 0 ||
    bb <= 0
  )
    throw new Error("Einsatzfolge prüfen.");
  return highest === 0 ? bb : highest + Math.max(lastFullRaise, bb);
}
export function openingHand(hero, position) {
  const key = handClass(hero),
    a = Math.max(...hero.map(rank)),
    b = Math.min(...hero.map(rank)),
    suited = suit(hero[0]) === suit(hero[1]);
  const early =
    (a === b && a >= 6) ||
    (suited && a === 14 && b >= 10) ||
    (a === 14 && b >= 11) ||
    ["KQs", "KJs", "QJs", "JTs"].includes(key);
  const cutoff =
    early ||
    a === b ||
    (suited && a === 14) ||
    ["KTs", "QTs", "T9s", "98s", "KQo", "KJo", "QJo"].includes(key);
  return position === "early"
    ? early
    : ["cutoff", "sb"].includes(position)
      ? cutoff
      : position === "button"
        ? cutoff ||
          (suited && a === 13) ||
          [
            "Q8s",
            "Q9s",
            "J8s",
            "J9s",
            "T8s",
            "97s",
            "87s",
            "76s",
            "65s",
            "KTo",
            "QTo",
            "JTo",
          ].includes(key) ||
          (a === 14 && !suited)
        : false;
}
export function advice(s) {
  const {
    hero,
    board,
    opponents,
    position,
    situation,
    bb,
    chip,
    paid,
    stack,
    call,
    pot,
  } = s;
  if (opponents === 0)
    return "Alle Gegner sind ausgestiegen: Du gewinnst den Pot sofort. Keine weitere Bet nötig.";
  if (hero.length !== 2 || (board.length > 0 && board.length < 3))
    return "Zuerst zwei Handkarten und gegebenenfalls den vollständigen Flop auswählen.";
  if (!s.rules)
    return "Euro-Hilfe setzt No-Limit, Cashgame ohne Rake und ohne Ante voraus. Bei anderen Regeln bleibt nur der Kartenrechner anwendbar.";
  if (s.special)
    return "Kurzes All-in oder Nebenpot: gewinnbaren Pot und Erhöhungsrecht individuell klären. Keine einfache Euro-Empfehlung.";
  if (![bb, chip].every((v) => Number.isInteger(v) && v > 0) || bb % chip)
    return "Big Blind und kleinsten Chip passend einstellen.";
  if (stack === null || paid === null || call === null)
    return "Für konkrete Beträge fehlen: verbleibende spielbare Chips, bereits bezahlt und zusätzlicher Call (auch 0 ausdrücklich eintragen).";
  if ([paid, stack, call, pot].some((v) => v !== null && v % chip))
    return "Geldwerte müssen mit dem kleinsten Chip darstellbar sein.";
  if (stack === 0)
    return "Du hast keine Chips mehr für eine weitere Aktion. Kartenrechnung ist weiter möglich.";
  if (call > stack)
    return "Der volle Call übersteigt die spielbaren Chips. All-in/Nebenpot gesondert prüfen.";
  const raise = (total) => {
    total = Math.ceil(total / chip) * chip;
    const extra = total - paid;
    if (extra <= call || extra <= 0)
      return "Die eingegebenen Beiträge passen nicht zur gewählten Situation.";
    if (extra >= stack)
      return "Die übliche Größe würde die spielbaren Chips aufbrauchen oder überschreiten. Keine automatische All-in-Empfehlung.";
    return `Auf insgesamt ${euros(total)} erhöhen; noch ${euros(extra)} ergänzen. Vereinfachter Ausgangspunkt, kein bewiesenes Optimum.`;
  };
  if (board.length === 0) {
    if (!position || !situation)
      return "Für den Anfängerplan Position und bisherige Aktion auswählen.";
    if (situation === "raised") {
      if (
        s.highest === null ||
        s.lastRaise === null ||
        s.highest <= bb ||
        s.lastRaise < bb ||
        s.lastRaise > s.highest - bb ||
        s.highest - paid !== call
      )
        return "Für eine Erhöhung: höchsten Gesamtbeitrag und letzte volle Erhöhungsdifferenz konsistent eintragen. Höchster Beitrag minus bereits bezahlt muss dem Call entsprechen.";
      return `Es wurde erhöht. Nächste volle Mindest-Erhöhung: insgesamt ${euros(Math.ceil(minimumRaise(s.highest, s.lastRaise, bb) / chip) * chip)}. Das ist eine Regelgrenze, keine Empfehlung. Mitgehen kostet ${euros(call)}; Gegnerauswahl, Position und spätere Kosten prüfen.`;
    }
    if (
      paid > bb ||
      call !== bb - paid ||
      (position === "bb" && paid !== bb) ||
      (position !== "bb" && paid === bb)
    )
      return "Ohne Erhöhung muss der Call den Big Blind abzüglich deines bisherigen Beitrags ausgleichen. Position und Beträge prüfen.";
    if (
      situation === "limped" &&
      (!Number.isInteger(s.limpers) || s.limpers < 1 || s.limpers > opponents)
    )
      return "Zahl der bloßen Mitspieler zwischen 1 und aktiver Gegnerzahl eintragen.";
    if (situation === "unopened" && position === "bb")
      return "Wenn wirklich alle anderen ausgestiegen sind: Gegnerzahl 0 wählen, du gewinnst sofort. Ein noch aktiver Small Blind zählt als Mitspieler.";
    const strong = ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo", "AQs"].includes(
      handClass(hero),
    );
    if (situation === "limped")
      return strong
        ? raise(3 * bb + bb * s.limpers)
        : call === 0
          ? "Kostenlos schieben. Für diese Hand sieht der vorsichtige Plan keine Erhöhung vor."
          : "Aussteigen ist der vorsichtige Anfängerstandard gegen bloße Mitspieler. Ein spekulativer Call benötigt zusätzliche Begründung.";
    return openingHand(hero, position)
      ? raise(3 * bb)
      : "Aussteigen: Diese Hand liegt außerhalb der vereinfachten Eröffnungsauswahl für deine Position.";
  }
  if (call > 0)
    return `Schieben ist nicht möglich. Mitgehen kostet ${euros(call)}. Prüfe unten den Callpreis; eine Zufallsgegner-Equity allein begründet keinen Call.`;
  if (paid > 0)
    return "Du hast in dieser Setzrunde schon bezahlt. Eine neue Eröffnung passt nicht dazu; Aktionsfolge prüfen. Wenn nichts fehlt, ist Schieben möglich.";
  const cat = bestFive([...hero, ...board]).category;
  if (board.length !== 3)
    return "Kostenlos schieben ist möglich. Die vereinfachte Setzregel gilt nur am Flop; Turn/River neu nach Gegnerauswahl bewerten.";
  const rs = board.map(rank),
    ss = board.map(suit),
    sorted = [...new Set(rs)].sort((a, b) => a - b);
  const straightBoard = [
    sorted,
    sorted.map((r) => (r === 14 ? 1 : r)).sort((a, b) => a - b),
  ].some((v) => v.length === 3 && v[2] - v[0] <= 4);
  const warning =
    (new Set(rs).size < 3 && cat < 6) ||
    (new Set(ss).size === 1 && cat < 5) ||
    (straightBoard && cat < 4);
  if (warning || cat < 2 || !s.worseCalls)
    return "Kostenlos schieben als vorsichtiger Standard. Eine Bet braucht eine Begründung: Bezahlen schlechtere Hände? Steigen bessere aus?";
  if (pot === null || pot <= 0)
    return "Für die halbe-Pot-Orientierung den aktuellen Pot eintragen. Kostenlos schieben bleibt möglich.";
  const bet = Math.ceil(Math.max(bb, pot / 2) / chip) * chip;
  if (bet >= stack)
    return "Die halbe-Pot-Größe würde die spielbaren Chips aufbrauchen oder überschreiten. Kein automatisches All-in; Schieben bleibt möglich.";
  return `${euros(bet)} setzen: ungefähr halber Pot, mindestens Big Blind, auf Chipgröße aufgerundet. Bedingt durch deine Angabe, dass schlechtere Hände bezahlen. Schieben bleibt eine Alternative.`;
}
