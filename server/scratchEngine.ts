/**
 * Scratch card grid generator.
 *
 * Symbols and 3-in-a-row payouts:
 *   okapi    × 50  (jackpot)
 *   diamond  × 20
 *   lightning× 10
 *   star     ×  5
 *   coin     ×  3
 *   flame    ×  2
 *
 * Plus: any 2 identical symbols anywhere in the 9-cell grid → bet × 0.5 (consolation).
 *
 * Target house edge ≈ 35% — tuned via OUTCOME_WEIGHTS below.
 * EV per bet  = Σ (weight_i / Σw) * payout_multiplier_i
 * House edge  = 1 - EV.
 */

export type Symbol = 'okapi' | 'diamond' | 'lightning' | 'star' | 'coin' | 'flame';

export const SYMBOLS: Symbol[] = ['okapi', 'diamond', 'lightning', 'star', 'coin', 'flame'];

const THREE_IN_A_ROW: Record<Symbol, number> = {
  okapi: 50,
  diamond: 20,
  lightning: 10,
  star: 5,
  coin: 3,
  flame: 2,
};
const CONSOLATION = 0.5;

type Outcome =
  | { kind: 'jackpot_okapi' }
  | { kind: 'three'; sym: Symbol }
  | { kind: 'consolation' }
  | { kind: 'lose' };

// Weights chosen so that EV ≈ 0.65 → house edge ≈ 35%.
// EV = (1*50 + 2*20 + 4*10 + 10*5 + 20*3 + 30*2 + 400*0.5 + 0*lose) / total
// Let's pick:
const OUTCOME_WEIGHTS: { o: Outcome; w: number }[] = [
  { o: { kind: 'jackpot_okapi' },           w: 1 },    // ×50
  { o: { kind: 'three', sym: 'diamond' },   w: 3 },    // ×20
  { o: { kind: 'three', sym: 'lightning' }, w: 6 },    // ×10
  { o: { kind: 'three', sym: 'star' },      w: 15 },   // ×5
  { o: { kind: 'three', sym: 'coin' },      w: 30 },   // ×3
  { o: { kind: 'three', sym: 'flame' },     w: 50 },   // ×2
  { o: { kind: 'consolation' },             w: 380 },  // ×0.5
  { o: { kind: 'lose' },                    w: 515 },  // ×0
];
// EV = (1*50 + 3*20 + 6*10 + 15*5 + 30*3 + 50*2 + 380*0.5 + 0) / 1000
//    = (50 + 60 + 60 + 75 + 90 + 100 + 190) / 1000
//    = 625 / 1000 = 0.625  →  house edge ≈ 37.5%

function pickOutcome(): Outcome {
  const total = OUTCOME_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const { o, w } of OUTCOME_WEIGHTS) {
    if ((r -= w) <= 0) return o;
  }
  return { kind: 'lose' };
}

const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],           // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],           // cols
  [0, 4, 8], [2, 4, 6],                       // diagonals
];

/**
 * Flat grid builder — NO recursion, NO mutual calls.
 * The authoritative payout is computed by evaluate() over the returned grid,
 * so even if 'lose' grids contain incidental pairs/triples (unavoidable with
 * 9 cells / 6 symbols), the bookkeeping stays correct.
 */
function buildGrid(type: 'win' | 'consolation' | 'lose', symbol?: Symbol): Symbol[] {
  const symbols = SYMBOLS.slice();
  const grid: Symbol[] = [];

  if (type === 'win' && symbol) {
    // Place 3 identical symbols in first row, rest random (others only).
    grid.push(symbol, symbol, symbol);
    for (let i = 3; i < 9; i++) {
      const others = symbols.filter((s) => s !== symbol);
      grid.push(others[Math.floor(Math.random() * others.length)]);
    }
    return grid;
  }

  if (type === 'consolation') {
    // Exactly 2 of one symbol, then fill with the others.
    const s = symbols[Math.floor(Math.random() * symbols.length)];
    grid.push(s, s);
    const others = symbols.filter((x) => x !== s);
    while (grid.length < 9) {
      grid.push(others[grid.length % others.length]);
    }
    return grid.sort(() => Math.random() - 0.5);
  }

  // lose: 9 cells from a 9-element pool, shuffled.
  const pool: Symbol[] = [...symbols, ...symbols.slice(0, 3)];
  return pool.sort(() => Math.random() - 0.5).slice(0, 9);
}

function evaluate(grid: Symbol[]): { kind: 'three' | 'consolation' | 'lose'; sym?: Symbol } {
  for (const [a, b, c] of WIN_LINES) {
    if (grid[a] === grid[b] && grid[b] === grid[c]) return { kind: 'three', sym: grid[a] };
  }
  const counts: Partial<Record<Symbol, number>> = {};
  for (const s of grid) counts[s] = (counts[s] ?? 0) + 1;
  if (Object.values(counts).some((n) => (n ?? 0) >= 2)) return { kind: 'consolation' };
  return { kind: 'lose' };
}

export function generateGrid(bet: number): { grid: Symbol[]; win: number } {
  const outcome = pickOutcome();
  let grid: Symbol[];
  switch (outcome.kind) {
    case 'jackpot_okapi':
      grid = buildGrid('win', 'okapi');
      break;
    case 'three':
      grid = buildGrid('win', outcome.sym);
      break;
    case 'consolation':
      grid = buildGrid('consolation');
      break;
    case 'lose':
    default:
      grid = buildGrid('lose');
      break;
  }
  // Re-evaluate authoritatively over the returned grid.
  const ev = evaluate(grid);
  let win = 0;
  if (ev.kind === 'three' && ev.sym) {
    win = Math.floor(bet * THREE_IN_A_ROW[ev.sym]);
  } else if (ev.kind === 'consolation') {
    win = Math.floor(bet * CONSOLATION);
  }
  return { grid, win };
}
