import test from "node:test";
import assert from "node:assert/strict";
import {
  readHistory,
  writeRecord,
  removeRecord,
  summarize,
  HISTORY_KEY,
} from "../src/history.js";
import { simulate, validateScenario } from "../src/equity.js";
import { parseCards as c } from "../src/cards.js";

function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
}
const base = {
  id: "hand-1",
  createdAt: "2026-09-25T08:00:00Z",
  hero: c("As Ad"),
  board: [],
  opponents: 8,
  outcome: "won",
  amountCents: 500,
};
test("history persists optional boards, updates one hand and separates payout from loss", () => {
  const s = storage();
  writeRecord(s, base);
  assert.deepEqual(readHistory(s)[0].board, []);
  writeRecord(s, { ...base, board: c("Kh 2s"), amountCents: 700 });
  assert.equal(readHistory(s).length, 1);
  writeRecord(s, { ...base, id: "hand-2", outcome: "lost", amountCents: 200 });
  writeRecord(s, {
    ...base,
    id: "hand-3",
    outcome: "split",
    amountCents: null,
  });
  const report = summarize(readHistory(s));
  assert.equal(report.count, 3);
  assert.equal(report.withBoard, 1);
  assert.equal(report.grossPayoutCents, 700);
  assert.equal(report.lostStakeCents, 200);
  assert.equal(report.payoutEntries, 1);
  assert.equal(report.lossEntries, 1);
  assert.equal(report.groups[0].hand, "AA");
  assert.equal(report.groups[0].split, 1);
  assert.equal(readHistory(s)[1].amountMeaning, "lost_stake");
  removeRecord(s, "hand-2");
  assert.equal(readHistory(s).length, 2);
});
test("invalid or inaccessible history never silently overwrites existing data", () => {
  const s = storage();
  s.setItem(HISTORY_KEY, "broken");
  assert.throws(() => writeRecord(s, base));
  assert.equal(s.getItem(HISTORY_KEY), "broken");
  const clean = storage();
  assert.throws(() => writeRecord(clean, { ...base, board: c("As Kh Qd") }));
  assert.throws(() => writeRecord(clean, { ...base, outcome: "__proto__" }));
  assert.throws(() => writeRecord(clean, { ...base, amountCents: -1 }));
  assert.throws(() => writeRecord(clean, { ...base, opponents: 9 }));
  assert.throws(() =>
    writeRecord(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      },
      base,
    ),
  );
  assert.equal(readHistory(clean).length, 0);
});
test("six to eight opponents: legal nine-way splits and preflop simulation", () => {
  for (const opponents of [6, 7, 8]) {
    validateScenario(c("2c 3d"), c("As Ks Qs Js Ts"), opponents);
    const r = simulate({
      hero: c("2c 3d"),
      board: c("As Ks Qs Js Ts"),
      opponents,
      n: 1000,
    });
    assert.equal(r.tie, 1);
    assert.equal(r.loss, 0);
    assert.ok(Math.abs(r.equity - 1 / (opponents + 1)) < 1e-12);
  }
  const r = simulate({ hero: c("As Ah"), board: [], opponents: 8, n: 30000 });
  assert.ok(r.equity > 0.3 && r.equity < 0.4);
  assert.throws(() => validateScenario(c("As Ad"), [], 9));
});
