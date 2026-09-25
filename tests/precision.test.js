import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/equity.js";
import { parseCards as c } from "../src/cards.js";
import { advice, callCeiling, callPrice } from "../src/strategy.js";

test("exact flop and turn counts, no biased equity in enumeration progress", () => {
  const progress = [];
  const flop = simulate(
    { hero: c("As Ks"), board: c("Qs Js Ts"), opponents: 1 },
    (r) => progress.push(r),
  );
  assert.equal(flop.method, "exact");
  assert.equal(flop.n, 1070190);
  assert.equal(flop.equity, 1);
  assert.equal(flop.win, 1);
  assert.equal(flop.halfWidth, 0);
  assert.ok(progress.length > 0);
  assert.ok(
    progress.every(
      (r) => r.method === "enumerating" && !("equity" in r) && r.n < r.total,
    ),
  );
  const turn = simulate({
    hero: c("As Ks"),
    board: c("Qs Js Ts 2c"),
    opponents: 1,
  });
  assert.equal(turn.n, 45540);
  assert.equal(turn.equity, 1);
});
test("million and five-million precision reach requested n with lower estimated noise", () => {
  const scenario = {
    hero: c("Ah Kh"),
    board: c("Qh 9h 2c"),
    opponents: 2,
    seed: 20260925,
  };
  const a = simulate({ ...scenario, n: 30000 }),
    b = simulate({ ...scenario, n: 1000000 }),
    d = simulate({ ...scenario, n: 5000000 });
  assert.equal(b.n, 1000000);
  assert.equal(d.n, 5000000);
  assert.ok(b.halfWidth < a.halfWidth / 5);
  assert.ok(d.halfWidth < b.halfWidth / 2);
  // Difference of two nested estimates: conservative max-variance 5-sigma bound.
  assert.ok(
    Math.abs(b.equity - d.equity) <
      5 * Math.sqrt(0.25 / 1000000 + 0.25 / 5000000),
  );
  assert.ok(d.equity > 0.56 && d.equity < 0.6);
  assert.throws(() => simulate({ ...scenario, n: 5000001 }));
});
test("fixed-pot call ceiling: rounding, stack, boundaries, lower q", () => {
  assert.equal(callCeiling(300, 0.25, 10, 1000), 100);
  assert.equal(callCeiling(300, 0.35, 10, 1000), 160);
  assert.ok(callPrice(300, 160, 0.35).ev >= 0);
  assert.ok(callPrice(300, 170, 0.35).ev < 0);
  assert.equal(callCeiling(300, 0.35, 10, 120), 120);
  assert.equal(callCeiling(300, 0, 10, 1000), 0);
  assert.equal(callCeiling(300, 1, 10, 1000), 1000);
  assert.ok(
    callCeiling(300, 0.34, 10, 1000) <= callCeiling(300, 0.35, 10, 1000),
  );
  for (const q of [-1, 1.1, NaN])
    assert.throws(() => callCeiling(300, q, 10, 1000));
  assert.throws(() => callCeiling(300, 0.5, 0, 1000));
});
test("postflop value orientation covers turn and river without betting board-only strength", () => {
  const s = {
    hero: c("Qs Qh"),
    board: c("Qd 9c 2h 4s"),
    opponents: 2,
    rules: true,
    special: false,
    bb: 20,
    chip: 10,
    paid: 0,
    stack: 1000,
    call: 0,
    pot: 300,
    worseCalls: true,
  };
  assert.match(advice(s), /1,50.*setzen/);
  assert.match(advice({ ...s, board: c("Qd 9c 2h 4s 4c") }), /1,50.*setzen/);
  assert.match(advice({ ...s, worseCalls: false }), /schieben/);
  assert.match(
    advice({ ...s, hero: c("As Ah"), board: c("Qd 9c 2h 4s 4c") }),
    /schieben/,
  );
  assert.match(
    advice({ ...s, hero: c("2c 3d"), board: c("As Ks Qs Js Ts") }),
    /vollständig auf dem Tisch/,
  );
});
