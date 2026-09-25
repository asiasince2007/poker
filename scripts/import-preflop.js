// Usage: node scripts/import-preflop.js <source-json>. Never copy the entire input.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { handClass } from "../src/cards.js";
const bytes = readFileSync(process.argv[2]);
const expected =
  "3832bb25c25093a1007376bf402204f26b635842667ae2bc3486aec001dd5d62";
if (createHash("sha256").update(bytes).digest("hex") !== expected)
  throw Error("Unreviewed source hash. Review provenance before importing.");
const input = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
if (
  input.seed !== 2026092402 ||
  input.n_per_scenario !== 100000 ||
  input.preflop.length !== 169
)
  throw Error("Invalid metadata");
const preflop = input.preflop.map((row) => {
  if (handClass(row.cards) !== row.hand || row.estimates.length !== 5)
    throw Error("Invalid class");
  return {
    hand: row.hand,
    cards: [...row.cards],
    estimates: row.estimates.map((v, i) => {
      if (
        v.opponents !== i + 1 ||
        !(v.equity > 0 && v.equity < 100) ||
        !(v.ci95_pp > 0 && v.ci95_pp < 0.31)
      )
        throw Error("Invalid estimate");
      return { opponents: v.opponents, equity: v.equity, ci95_pp: v.ci95_pp };
    }),
  };
});
if (new Set(preflop.map((r) => r.hand)).size !== 169)
  throw Error("Repeated class");
writeFileSync(
  "data/preflop.json",
  JSON.stringify(
    { seed: input.seed, n_per_scenario: input.n_per_scenario, preflop },
    null,
    2,
  ) + "\n",
);
console.log(
  "Imported 169 classes and 845 estimates using an explicit field allowlist.",
);
