export const ranks = '23456789TJQKA';
// Same encoding as phevaluator: rank * 4 + club/diamond/heart/spade.
export const suits = ['♣', '♦', '♥', '♠'];
export const suitNames = ['Kreuz', 'Karo', 'Herz', 'Pik'];
export const rankNames = { A: 'Ass', K: 'König', Q: 'Dame', J: 'Bube', T: 'Zehn' };
export const deck = Array.from({ length: 52 }, (_, i) => i);
export const rank = c => (c >> 2) + 2;
export const suit = c => c % 4;
export const shortCard = c => ranks[c >> 2].replace('T', '10') + suits[suit(c)];
export const cardName = c => `${rankNames[ranks[c >> 2]] || ranks[c >> 2]} ${suitNames[suit(c)]}`;
export function validateCards(cards) {
  if (!Array.isArray(cards) || cards.some(c => !Number.isInteger(c) || c < 0 || c > 51)) throw new Error('Ungültige Karte.');
  if (new Set(cards).size !== cards.length) throw new Error('Jede Karte darf nur einmal vorkommen.');
}
export function handClass(cards) {
  validateCards(cards);
  if (cards.length !== 2) throw new Error('Zwei Handkarten erforderlich.');
  const [a, b] = [...cards].sort((x, y) => y - x);
  return ranks[a >> 2] + ranks[b >> 2] + ((a >> 2) === (b >> 2) ? '' : suit(a) === suit(b) ? 's' : 'o');
}
export function parseCards(text) {
  const tokens = text.split(' ');
  if (tokens.some(c => !/^[2-9TJQKA][cdhs]$/.test(c))) throw new Error('Ungültige Kartenbezeichnung.');
  const cards = tokens.map(c => ranks.indexOf(c[0]) * 4 + 'cdhs'.indexOf(c[1]));
  validateCards(cards);
  return cards;
}
