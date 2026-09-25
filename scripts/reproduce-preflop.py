"""Optional original preflop experiment. pip install phevaluator==0.6.0.
Writes to the caller-specified path; does not replace the canonical dataset.
CPython random.Random sample, seed and ordering match the original experiment.
16.9 million deals; each deal evaluates one to five random opponents.
"""
import json
import math
import random
import sys
from phevaluator import _pheval

rng = random.Random(2026092402)
ranks = '23456789TJQKA'
n = 100000
rows = []
hands = []
for i in range(12, -1, -1):
    hands.append((ranks[i] * 2, [i * 4 + 3, i * 4 + 2]))
    for j in range(i - 1, -1, -1):
        hands.extend([(ranks[i] + ranks[j] + 's', [i*4+3, j*4+3]),
                      (ranks[i] + ranks[j] + 'o', [i*4+3, j*4+2])])
for name, hero in hands:
    deck = [c for c in range(52) if c not in hero]
    sums = [[0., 0.] for _ in range(5)]
    for _ in range(n):
        cards = rng.sample(deck, 15)
        board = cards[:5]
        h = _pheval.evaluate_7cards(*(hero + board))
        best, ties = h, 1
        for i in range(5):
            opp = _pheval.evaluate_7cards(*(board + cards[5+i*2:7+i*2]))
            if opp < best:
                best, ties = opp, 1
            elif opp == best:
                ties += 1
            x = 1/ties if h == best else 0
            sums[i][0] += x
            sums[i][1] += x*x
    estimates = [{'opponents': i+1, 'equity': 100*s/n,
                  'ci95_pp': 196*math.sqrt(max(0, s2/n-(s/n)**2)/(n-1))}
                 for i, (s, s2) in enumerate(sums)]
    rows.append({'hand': name, 'cards': hero, 'estimates': estimates})
    print(name, flush=True)
with open(sys.argv[1], 'w', encoding='utf8') as output:
    json.dump({'seed': 2026092402, 'n_per_scenario': n, 'preflop': rows}, output, indent=2)
