import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import solver from "pokersolver";
import {
  parseCards as c,
  handClass,
  validateCards,
  ranks,
  deck,
} from "../src/cards.js";
import { evaluate, bestFive, categoryOf } from "../src/evaluator.js";
import { random, simulate, potShare, validateScenario } from "../src/equity.js";
import { drawOuts, outsProbability } from "../src/draws.js";
import {
  money,
  callPrice,
  minimumRaise,
  advice,
  openingHand,
} from "../src/strategy.js";
const data = JSON.parse(
  readFileSync("data/preflop.json", "utf8").replace(/^\uFEFF/, ""),
);
const score = (text) => evaluate(c(text));
test("nine categories in order, wheels, no wrapped straights, kickers, full houses", () => {
  const examples = [
    "As Kd Qh 8c 3s",
    "As Ad Qh 8c 3s",
    "As Ad Qh Qc 3s",
    "As Ad Ah 8c 3s",
    "As 2d 3h 4c 5s",
    "As Js 8s 5s 3s",
    "As Ad Ah 8c 8s",
    "As Ad Ah Ac 3s",
    "9s Ts Js Qs Ks",
  ];
  examples.forEach((h, i) => assert.equal(categoryOf(score(h)), i));
  for (let i = 1; i < 9; i++)
    assert.ok(score(examples[i]) > score(examples[i - 1]));
  assert.equal(categoryOf(score("Qs Kd Ah 2c 3s")), 0);
  assert.ok(score("2s 3d 4h 5c 6s") > score("As 2d 3h 4c 5s"));
  assert.ok(score("As Kd Qh Jh Tc") > score("9s Kd Qh Jh Tc"));
  assert.ok(score("As Ad Kh Qc Js") > score("As Ad Kh Qc Ts"));
  assert.ok(score("9s 9d 9h 6c 6s") > score("6s 6d 6h Ac As"));
  assert.ok(score("9s 9d 9h Ac As") > score("9s 9d 9h Kc Ks"));
  assert.equal(categoryOf(score("6s 7d 9h 9c 9s 6d Kh")), 6);
  assert.equal(score("As Ad Ah Ks Kd Kh 2c"), score("As Ad Ah Ks Kd"));
  assert.equal(score("As Ks Qs Js Ts 2h 3c"), score("As Ks Qs Js Ts 8h 9c"));
});
test("exhaustive 2,598,960 five-card hands match combinatorial category totals", () => {
  const counts = Array(9).fill(0);
  for (let a = 0; a < 48; a++)
    for (let b = a + 1; b < 49; b++)
      for (let d = b + 1; d < 50; d++)
        for (let e = d + 1; e < 51; e++)
          for (let f = e + 1; f < 52; f++)
            counts[categoryOf(evaluate([a, b, d, e, f]))]++;
  assert.deepEqual(
    counts,
    [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40],
  );
});
test("independent pokersolver order comparisons and best-five reduction, 4,000 seeded deals", () => {
  const rng = random(1234567);
  const deal = () => {
    const pool = [...deck];
    for (let i = 0; i < 9; i++) {
      const j = i + Math.floor(rng() * (52 - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 9);
  };
  const external = (cards) =>
    solver.Hand.solve(cards.map((id) => ranks[id >> 2] + "cdhs"[id % 4]));
  for (let i = 0; i < 4000; i++) {
    const d = deal(),
      a = d.slice(0, 7),
      b = [...d.slice(0, 5), ...d.slice(7, 9)],
      sa = external(a),
      sb = external(b),
      winners = solver.Hand.winners([sa, sb]);
    const expected = winners.length === 2 ? 0 : winners[0] === sa ? 1 : -1;
    assert.equal(
      Math.sign(evaluate(a) - evaluate(b)),
      expected,
      `deal ${i}: ${d}`,
    );
    assert.equal(bestFive(a).score, evaluate(a));
  }
});
test("all 1,326 pairs map to 169 validated classes with correct multiplicities", () => {
  const counts = new Map();
  for (let a = 0; a < 51; a++)
    for (let b = a + 1; b < 52; b++) {
      const h = handClass([a, b]);
      counts.set(h, (counts.get(h) || 0) + 1);
    }
  assert.equal(counts.size, 169);
  assert.equal(data.preflop.length, 169);
  assert.equal(new Set(data.preflop.map((r) => r.hand)).size, 169);
  for (const row of data.preflop) {
    assert.equal(handClass(row.cards), row.hand);
    assert.equal(
      counts.get(row.hand),
      row.hand.length === 2 ? 6 : row.hand.endsWith("s") ? 4 : 12,
    );
    assert.equal(row.estimates.length, 5);
    row.estimates.forEach((v, i) => {
      assert.equal(v.opponents, i + 1);
      assert.ok(v.equity > 0 && v.equity < 100);
      assert.ok(v.ci95_pp > 0 && v.ci95_pp <= 0.31);
    });
  }
  assert.equal(handClass(c("Ah Kd")), "AKo");
  assert.equal(handClass(c("Ah Kh")), "AKs");
  assert.throws(() => handClass(c("Ah Ah")));
  assert.throws(() => validateCards([52]));
  assert.throws(() => c("Az"));
  assert.throws(() => c("1c"));
});
test("tie shares, impossible inputs, seeded simulations and exact river", () => {
  assert.equal(potShare([8, 8, 8]), 1 / 3);
  assert.equal(potShare([8, 8]), 0.5);
  assert.equal(potShare([8, 9]), 0);
  assert.equal(potShare([9, 8]), 1);
  assert.throws(() => validateScenario(c("As Ad"), c("2s 3s"), 1));
  assert.throws(() => validateScenario(c("As Ad"), c("As 3s 4s"), 1));
  assert.throws(() => validateScenario(c("As Ad"), [], 9));
  const full = { hero: c("2d 3c"), board: c("As Ks Qs Js Ts"), opponents: 1 };
  const r = simulate(full);
  assert.equal(r.method, "exact");
  assert.equal(r.n, 990);
  assert.equal(r.equity, 0.5);
  assert.equal(r.tie, 1);
  assert.equal(r.win, 0);
  assert.equal(r.halfWidth, 0);
  const six = simulate({ ...full, opponents: 5, n: 1000 });
  assert.ok(Math.abs(six.equity - 1 / 6) < 1e-12);
  assert.equal(six.tie, 1);
  const unbeatable = simulate({
    hero: c("As Ks"),
    board: c("Qs Js Ts 2c 3d"),
    opponents: 1,
  });
  assert.equal(unbeatable.win, 1);
  const flop = {
    hero: c("Ah Kh"),
    board: c("Qh 9h 2c"),
    opponents: 2,
    n: 10000,
    seed: 77,
  };
  assert.deepEqual(simulate(flop), simulate(flop));
  const f = simulate(flop);
  assert.ok(Math.abs(f.equity - 0.581) < 0.025);
  assert.ok(Math.abs(f.win + f.tie + f.loss - 1) < 1e-12);
});
test("preflop estimates independently reproduced with fixed 5-sigma maximum-variance tolerances", () => {
  // Chosen before running: independent MC errors <= .25/n + .25/100000.
  const n = 30000,
    tolerance = 5 * Math.sqrt(0.25 / n + 0.25 / 100000);
  for (const key of ["AA", "KK", "AKs", "AKo", "98s", "72o"])
    for (const opponents of [1, 5]) {
      const row = data.preflop.find((r) => r.hand === key);
      const result = simulate({
        hero: row.cards,
        board: [],
        opponents,
        n,
        seed: 991 + opponents,
      });
      assert.ok(
        Math.abs(result.equity - row.estimates[opponents - 1].equity / 100) <
          tolerance,
        `${key} vs ${opponents}: ${result.equity}`,
      );
    }
});
test("draw events count intersecting cards once; hit probability is not equity", () => {
  const d = drawOuts(c("9h 8h"), c("7h 6h Kc"));
  assert.equal(d.flush.length, 9);
  assert.equal(d.straight.length, 8);
  assert.equal(d.union.length, 15);
  assert.equal(d.next, 15 / 47);
  assert.ok(
    Math.abs(outsProbability(9, 3).byRiver - 0.3496762257169288) < 1e-12,
  );
  assert.equal(outsProbability(9, 4).next, 9 / 46);
  assert.throws(() => outsProbability(48, 3));
  assert.equal(drawOuts(c("Ah Kh"), c("Qh Jh Th")).flush.length, 0);
});
test("money, call EV boundaries, raise totals and guarded strategy", () => {
  assert.equal(money("0,20"), 20);
  assert.equal(money(" 1.20 "), 120);
  assert.equal(money(""), null);
  assert.equal(money("-1"), null);
  assert.equal(money("1.234"), null);
  assert.deepEqual(callPrice(300, 100, 0.25), { required: 0.25, ev: 0 });
  assert.ok(Math.abs(callPrice(300, 100, 0.35).ev - 40) < 1e-10);
  assert.equal(callPrice(300, 100, 0).ev, -100);
  assert.equal(callPrice(300, 100, 1).ev, 300);
  assert.throws(() => callPrice(0, 0, 0.5));
  assert.throws(() => callPrice(100, 20, 1.01));
  assert.equal(minimumRaise(60, 40, 20), 100);
  assert.equal(60 - 20, 40);
  const s = {
    hero: c("As Ad"),
    board: [],
    opponents: 5,
    rules: true,
    bb: 20,
    chip: 10,
    paid: 0,
    stack: 1000,
    call: 20,
    pot: 30,
    position: "early",
    situation: "unopened",
  };
  assert.match(advice(s), /insgesamt 0,60/);
  assert.match(
    advice({
      ...s,
      paid: 20,
      call: 0,
      position: "bb",
      situation: "limped",
      limpers: 3,
    }),
    /insgesamt 1,20/,
  );
  assert.match(advice({ ...s, opponents: 0 }), /sofort/);
  assert.match(advice({ ...s, stack: 50 }), /All-in/);
  assert.match(advice({ ...s, special: true }), /Nebenpot/);
  assert.match(advice({ ...s, stack: null }), /fehlen/);
  assert.match(
    advice({ ...s, situation: "raised", highest: 60, lastRaise: 40, call: 60 }),
    /insgesamt 1,00/,
  );
  assert.equal(openingHand(c("7s 2h"), "button"), false);
  for (const [pot, bet] of [
    [120, "0,60"],
    [240, "1,20"],
    [480, "2,40"],
  ])
    assert.ok(
      advice({
        ...s,
        hero: c("Qs Qc"),
        board: c("Qh 9h 2c"),
        call: 0,
        pot,
        worseCalls: true,
      }).includes(bet),
    );
});
