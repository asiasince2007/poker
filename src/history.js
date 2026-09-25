import { validateCards, handClass } from "./cards.js";

export const HISTORY_KEY = "karten.hands.v1";
export const outcomeNames = {
  won: "Gewonnen",
  lost: "Verloren",
  split: "Geteilt",
};

export function validateRecord(r) {
  if (
    !r ||
    typeof r.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(r.id) ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    !Array.isArray(r.hero) ||
    r.hero.length !== 2 ||
    !Array.isArray(r.board) ||
    r.board.length > 5 ||
    !Object.hasOwn(outcomeNames, r.outcome) ||
    !Number.isInteger(r.opponents) ||
    r.opponents < 0 ||
    r.opponents > 8 ||
    (r.amountCents !== null &&
      (!Number.isInteger(r.amountCents) ||
        r.amountCents < 0 ||
        r.amountCents > 10000000))
  )
    throw new Error("Ungültiger gespeicherter Eintrag.");
  validateCards([...r.hero, ...r.board]);
  // Allowlist prevents arbitrary imported/local fields becoming public markup.
  return {
    id: r.id,
    createdAt: r.createdAt,
    hero: [...r.hero],
    board: [...r.board],
    opponents: r.opponents,
    outcome: r.outcome,
    amountCents: r.amountCents,
    amountEstimated: true,
    amountMeaning: r.outcome === "lost" ? "lost_stake" : "gross_payout",
  };
}

export function readHistory(storage) {
  const raw = storage.getItem(HISTORY_KEY);
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (
    value.version !== 1 ||
    !Array.isArray(value.hands) ||
    value.hands.length > 10000
  )
    throw new Error("Gespeicherte Daten haben ein unbekanntes Format.");
  const records = value.hands.map(validateRecord);
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Doppelte Einträge im Speicher.");
  return records;
}

export function writeRecord(storage, record) {
  const clean = validateRecord(record),
    records = readHistory(storage);
  const index = records.findIndex((r) => r.id === clean.id);
  if (index < 0) records.push(clean);
  else records[index] = clean;
  if (records.length > 10000)
    throw new Error(
      "Speichergrenze erreicht. Erst exportieren und Einträge entfernen.",
    );
  storage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, hands: records }));
  return clean;
}

export function removeRecord(storage, id) {
  const records = readHistory(storage);
  storage.setItem(
    HISTORY_KEY,
    JSON.stringify({ version: 1, hands: records.filter((r) => r.id !== id) }),
  );
}

export function summarize(records) {
  const summary = {
    count: records.length,
    won: 0,
    lost: 0,
    split: 0,
    withBoard: 0,
    grossPayoutCents: 0,
    payoutEntries: 0,
    lostStakeCents: 0,
    lossEntries: 0,
    groups: [],
  };
  const groups = new Map();
  for (const r of records) {
    summary[r.outcome]++;
    if (r.board.length) summary.withBoard++;
    if (r.amountCents !== null) {
      if (r.outcome === "lost") {
        summary.lostStakeCents += r.amountCents;
        summary.lossEntries++;
      } else {
        summary.grossPayoutCents += r.amountCents;
        summary.payoutEntries++;
      }
    }
    const key = handClass(r.hero),
      g = groups.get(key) || { hand: key, count: 0, won: 0, lost: 0, split: 0 };
    g.count++;
    g[r.outcome]++;
    groups.set(key, g);
  }
  summary.groups = [...groups.values()].sort(
    (a, b) => b.count - a.count || a.hand.localeCompare(b.hand),
  );
  return summary;
}
