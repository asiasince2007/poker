import { deck, rank, suit } from './cards.js';
import { straightHigh } from './evaluator.js';
export function outsProbability(outs, boardLength) {
  const unseen = boardLength === 3 ? 47 : 46;
  if (!Number.isInteger(outs) || outs < 0 || outs > unseen || ![3, 4].includes(boardLength)) throw new Error('Ungültige Trefferkarten.');
  return { next: outs / unseen, byRiver: boardLength === 3 ? 1 - ((47 - outs) * (46 - outs)) / (47 * 46) : outs / 46 };
}
// Distinct events: complete a currently missing straight and/or flush next card.
// These are NOT winning outs; cards may subsequently lose or just play the board.
export function drawOuts(hero, board) {
  if (![3, 4].includes(board.length)) return null;
  const cards = [...hero, ...board], counts = [0, 0, 0, 0]; let mask = 0;
  cards.forEach(c => { counts[suit(c)]++; mask |= 1 << rank(c); });
  const flush = [], straight = [];
  for (const c of deck.filter(c => !cards.includes(c))) {
    if (counts[suit(c)] === 4) flush.push(c);
    if (!straightHigh(mask) && straightHigh(mask | (1 << rank(c)))) straight.push(c);
  }
  const union = [...new Set([...flush, ...straight])];
  return { flush, straight, union, ...outsProbability(union.length, board.length) };
}
