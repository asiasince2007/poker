import { deck, validateCards } from "./cards.js";
import { evaluate, categoryOf } from "./evaluator.js";
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    // Wrap on every draw: millions of additions otherwise exceed JS's exact
    // integer range and silently corrupt the low bits used by the generator.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function validateScenario(hero, board, opponents) {
  validateCards([...hero, ...board]);
  if (hero.length !== 2 || ![0, 3, 4, 5].includes(board.length))
    throw new Error(
      "Zwei eigene und null, drei, vier oder fünf Tischkarten erforderlich.",
    );
  if (!Number.isInteger(opponents) || opponents < 1 || opponents > 8)
    throw new Error("Ein bis acht aktive Gegner erforderlich.");
}
export function potShare(scores) {
  const best = Math.max(...scores);
  return scores[0] === best ? 1 / scores.filter((s) => s === best).length : 0;
}
export function simulate(
  { hero, board, opponents, n = 1000000, seed = 20260925 },
  progress,
) {
  validateScenario(hero, board, opponents);
  if (!Number.isInteger(n) || n < 100 || n > 5000000)
    throw new Error("Ungültige Stichprobengröße.");
  const known = new Set([...hero, ...board]),
    pool = deck.filter((c) => !known.has(c));
  const rng = random(seed),
    needed = 5 - board.length + 2 * opponents;
  let sum = 0,
    sum2 = 0,
    wins = 0,
    ties = 0;
  const finalCategories = Array(9).fill(0);
  const report = (done, method = "simulation") => ({
    method,
    n: done,
    seed,
    equity: sum / done,
    halfWidth:
      method === "exact"
        ? 0
        : Math.max(
            3 / done,
            1.96 *
              Math.sqrt(
                Math.max(0, sum2 / done - (sum / done) ** 2) / (done - 1),
              ),
          ),
    win: wins / done,
    tie: ties / done,
    loss: (done - wins - ties) / done,
    finalCategories: finalCategories.map((x) => x / done),
  });
  function record(sharedBoard, opponentsCards) {
    const score = evaluate([...hero, ...sharedBoard]),
      scores = [score];
    for (let j = 0; j < opponents; j++)
      scores.push(
        evaluate([...opponentsCards.slice(j * 2, j * 2 + 2), ...sharedBoard]),
      );
    const share = potShare(scores);
    sum += share;
    sum2 += share * share;
    if (share === 1) wins++;
    else if (share > 0) ties++;
    finalCategories[categoryOf(score)]++;
  }
  // Exact postflop heads-up. Unordered runouts are sufficient: only showdown
  // outcomes are evaluated, not decisions at intermediate betting streets.
  if (board.length >= 3 && opponents === 1) {
    let done = 0;
    const total =
      board.length === 3 ? 1070190 : board.length === 4 ? 45540 : 990;
    function finish(runout, remaining) {
      for (let a = 0; a < remaining.length; a++)
        for (let b = a + 1; b < remaining.length; b++) {
          record([...board, ...runout], [remaining[a], remaining[b]]);
          done++;
          if (progress && done % 25000 === 0 && done < total)
            progress({ n: done, total, method: "enumerating" });
        }
    }
    if (board.length === 5) finish([], pool);
    else if (board.length === 4) {
      for (const c of pool)
        finish(
          [c],
          pool.filter((v) => v !== c),
        );
    } else {
      for (let a = 0; a < pool.length; a++)
        for (let b = a + 1; b < pool.length; b++) {
          finish(
            [pool[a], pool[b]],
            pool.filter((v) => v !== pool[a] && v !== pool[b]),
          );
        }
    }
    return report(done, "exact");
  }
  for (let i = 1; i <= n; i++) {
    // Partial Fisher–Yates; every next sample is uniform even when pool stays permuted.
    for (let j = 0; j < needed; j++) {
      const k = j + Math.floor(rng() * (pool.length - j));
      [pool[j], pool[k]] = [pool[k], pool[j]];
    }
    const missing = 5 - board.length;
    record([...board, ...pool.slice(0, missing)], pool.slice(missing, needed));
    if (progress && (i === 2000 || i === 10000 || i % 50000 === 0) && i < n)
      progress(report(i));
  }
  return report(n);
}
