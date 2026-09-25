import { rank, suit, validateCards } from "./cards.js";
export const categories = [
  "Hohe Karte",
  "Ein Paar",
  "Zwei Paare",
  "Drilling",
  "Straße",
  "Flush",
  "Full House",
  "Vierling",
  "Straight Flush",
];
// Base 15 encodes category followed by five tie breakers; larger is stronger.
export function encode(category, values) {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 15 + (values[i] || 0);
  return score;
}
export const categoryOf = (score) => Math.floor(score / 15 ** 5);
export function straightHigh(mask) {
  for (let high = 14; high >= 6; high--)
    if (((mask >> (high - 4)) & 31) === 31) return high;
  return (mask & 0x403c) === 0x403c ? 5 : 0;
}
function highest(mask, count) {
  const result = [];
  for (let r = 14; r >= 2 && result.length < count; r--)
    if (mask & (1 << r)) result.push(r);
  return result;
}
// Direct count/bitmask evaluator, no tables or external runtime library.
// Internal hot path expects validated, distinct 5–7 cards.
export function evaluate(cards) {
  const counts = new Uint8Array(15),
    suitCounts = new Uint8Array(4),
    masks = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = rank(c),
      s = suit(c);
    counts[r]++;
    suitCounts[s]++;
    masks[s] |= 1 << r;
    mask |= 1 << r;
  }
  let flush = -1;
  for (let s = 0; s < 4; s++)
    if (suitCounts[s] >= 5) {
      flush = s;
      const high = straightHigh(masks[s]);
      if (high) return encode(8, [high]);
    }
  const quads = [],
    trips = [],
    pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r);
    if (counts[r] === 3) trips.push(r);
    if (counts[r] >= 2) pairs.push(r);
  }
  if (quads.length)
    return encode(7, [quads[0], ...highest(mask & ~(1 << quads[0]), 1)]);
  if (trips.length && pairs.some((r) => r !== trips[0]))
    return encode(6, [trips[0], pairs.find((r) => r !== trips[0])]);
  if (flush >= 0) return encode(5, highest(masks[flush], 5));
  const straight = straightHigh(mask);
  if (straight) return encode(4, [straight]);
  if (trips.length)
    return encode(3, [trips[0], ...highest(mask & ~(1 << trips[0]), 2)]);
  if (pairs.length >= 2)
    return encode(2, [
      pairs[0],
      pairs[1],
      ...highest(mask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1),
    ]);
  if (pairs.length)
    return encode(1, [pairs[0], ...highest(mask & ~(1 << pairs[0]), 3)]);
  return encode(0, highest(mask, 5));
}
export function bestFive(cards) {
  validateCards(cards);
  if (cards.length < 5 || cards.length > 7)
    throw new Error("Fünf bis sieben Karten erforderlich.");
  let score = -1,
    best = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]],
              value = evaluate(five);
            if (value > score) {
              score = value;
              best = five;
            }
          }
  return { score, category: categoryOf(score), cards: best };
}
