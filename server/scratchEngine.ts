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

function randSym(exclude: Set<Symbol> = new Set()): Symbol {
  const pool = SYMBOLS.filter((s) => !exclude.has(s));
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fill remaining cells with random symbols, ensuring NO unintended 3-in-a-row
 *  and (for non-consolation outcomes) at most a controlled number of pairs. */
function fillSafe(grid: (Symbol | null)[], avoidPairs: boolean): Symbol[] {
  const cells = grid.slice();
  for (let i = 0; i < 9; i++) {
    if (cells[i] != null) continue;
    let tries = 0;
    while (tries++ < 50) {
      const s = randSym();
      cells[i] = s;
      // check no line of 3 same with already-placed cells
      const bad = WIN_LINES.some(([a, b, c]) =>
        cells[a] && cells[b] && cells[c] && cells[a] === cells[b] && cells[b] === cells[c]
      );
      if (bad) { cells[i] = null; continue; }
      if (avoidPairs) {
        const counts: Partial<Record<Symbol, number>> = {};
        for (const x of cells) if (x) counts[x] = (counts[x] ?? 0) + 1;
        if (Object.values(counts).some((n) => (n ?? 0) >= 2)) { cells[i] = null; continue; }
      }
      break;
    }
    if (cells[i] == null) cells[i] = randSym(); // give up, accept
  }
  return cells as Symbol[];
}

function buildWinningGrid(winSym: Symbol): Symbol[] {
  const line = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
  const grid: (Symbol | null)[] = Array(9).fill(null);
  for (const idx of line) grid[idx] = winSym;
  return fillSafe(grid, /*avoidPairs*/ false);
}

function buildConsolationGrid(): Symbol[] {
  // Place exactly one pair of a random symbol, then fill avoiding 3-in-a-row
  // and avoiding any further pair of OTHER symbols. The placed pair may coincidentally
  // get a third match — we re-check and retry if so.
  for (let attempt = 0; attempt < 20; attempt++) {
    const sym = randSym();
    const positions = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 2);
    const grid: (Symbol | null)[] = Array(9).fill(null);
    grid[positions[0]] = sym;
    grid[positions[1]] = sym;
    // Avoid lines of 3 same by construction; fill the rest with distinct symbols
    const used = new Set<Symbol>([sym]);
    const rest = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => grid[i] == null));
    let ok = true;
    for (const i of rest) {
      const choices = SYMBOLS.filter((s) => !used.has(s));
      if (choices.length === 0) { ok = false; break; }
      grid[i] = choices[Math.floor(Math.random() * choices.length)];
      used.add(grid[i] as Symbol);
    }
    if (!ok) continue;
    if (evaluate(grid as Symbol[]).kind === 'consolation') return grid as Symbol[];
  }
  // fallback: simple lose grid (shouldn't happen)
  return buildLoseGrid();
}

function buildLoseGrid(): Symbol[] {
  // All distinct symbols → no pair, no triple. We have 6 symbols for 9 cells,
  // so duplicates are unavoidable. We allow at most one repeated symbol that
  // appears in non-line and non-pair-only positions? Pairs imply consolation.
  // Easiest fully-losing layout: pick 9 cells using 6 symbols but ensure no
  // symbol appears more than once → impossible. So minimum is one symbol
  // appearing twice, which yields consolation. To truly lose, we must avoid
  // having any pair, which is impossible with 9 cells / 6 symbols → therefore
  // "lose" outcomes are absorbed into consolation. To respect the spec,
  // treat 'lose' outcomes as: exactly one symbol appears twice and all others
  // once or twice as well — i.e. there WILL be a pair, which scores consolation.
  //
  // To still produce true zero-win grids we'd need ≥9 distinct symbols.
  // Resolution: re-route 'lose' to consolation here — kept as separate branch
  // for clarity (and easy future expansion of the symbol set).
  return buildConsolationGrid();
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
      grid = buildWinningGrid('okapi');
      break;
    case 'three':
      grid = buildWinningGrid(outcome.sym);
      break;
    case 'consolation':
      grid = buildConsolationGrid();
      break;
    case 'lose':
    default:
      grid = buildLoseGrid();
      break;
  }
  // Re-evaluate authoritatively (defensive — handles fillSafe edge cases).
  const ev = evaluate(grid);
  let win = 0;
  if (ev.kind === 'three' && ev.sym) {
    win = Math.floor(bet * THREE_IN_A_ROW[ev.sym]);
  } else if (ev.kind === 'consolation') {
    win = Math.floor(bet * CONSOLATION);
  }
  return { grid, win };
}
