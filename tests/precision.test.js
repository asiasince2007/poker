import test from "node:test";
import assert from "node:assert/strict";
import { random, simulate } from "../src/equity.js";
import { parseCards as c } from "../src/cards.js";
import { equityHint } from "../src/strategy.js";

test("PRNG preserves modular state beyond the JavaScript safe-integer boundary", () => {
  const seed = 20260925,
    rng = random(seed);
  const n = 6000000;
  let actual;
  for (let i = 0; i < n; i++) actual = rng();
  // Independently derive the nth state with exact BigInt arithmetic. Unbounded
  // Number additions exceed 2^53 before this checkpoint and produce a mismatch.
  let t = Number((BigInt(seed) + BigInt(n) * 0x6d2b79f5n) & 0xffffffffn);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  assert.equal(actual, ((t ^ (t >>> 14)) >>> 0) / 4294967296);
});

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
test("percentage tiers agree with displayed rounding and reject unknown equity", () => {
  for (const [q, cents] of [
    [0, 0],
    [0.2494, 0],
    [0.2495, 60],
    [0.25, 60],
    [0.4994, 60],
    [0.4995, 120],
    [0.5, 120],
    [0.7494, 120],
    [0.7495, 240],
    [0.75, 240],
    [1, 240],
  ])
    assert.equal(equityHint(q), cents);
  for (const q of [null, undefined, NaN, -1, 1.01, Infinity])
    assert.equal(equityHint(q), null);
});
