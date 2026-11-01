/**
 * Tamerlane chess (Shatranj al-Kabir) rules.
 *
 * Board: 11 files (a–k) × 10 ranks plus two citadels. Internally the board is
 * a padded mailbox so that every leap, including the Camel's (3,1), can be
 * tested with a single array read: off-board cells hold OFF.
 *
 * Logical coordinates: x 0..12, y 0..9. Files a–k are x 1..11. The white
 * citadel is (12, 1), beside k2; the black citadel is (0, 8), beside a9.
 */

export const PAD = 3;
export const COLS = 13;
export const ROWS = 10;
export const STRIDE = COLS + 2 * PAD;
export const SIZE = STRIDE * (ROWS + 2 * PAD);
export const OFF = -1;

export type Color = 0 | 1;
export const WHITE: Color = 0;
export const BLACK: Color = 1;
export const other = (c: Color): Color => (c ^ 1) as Color;

export const sq = (x: number, y: number): number => (y + PAD) * STRIDE + x + PAD;
export const sqX = (s: number): number => (s % STRIDE) - PAD;
export const sqY = (s: number): number => Math.floor(s / STRIDE) - PAD;

export const CIT_W = sq(12, 1);
export const CIT_B = sq(0, 8);
export const isCitadel = (s: number): boolean => s === CIT_W || s === CIT_B;
export const citadelOwner = (s: number): Color => (s === CIT_W ? WHITE : BLACK);

/* ---------- Piece types ---------- */
export const KING = 1, PRINCE = 2, ADV_KING = 3, GENERAL = 4, VIZIER = 5, GIRAFFE = 6,
  PICKET = 7, KNIGHT = 8, ROOK = 9, ELEPHANT = 10, CAMEL = 11, WAR_ENGINE = 12, PAWN = 13;
export type PieceType = number;

export const PIECE_NAMES: Record<number, string> = {
  [KING]: 'King', [PRINCE]: 'Prince', [ADV_KING]: 'Adventitious King', [GENERAL]: 'General',
  [VIZIER]: 'Vizier', [GIRAFFE]: 'Giraffe', [PICKET]: 'Picket', [KNIGHT]: 'Knight', [ROOK]: 'Rook',
  [ELEPHANT]: 'Elephant', [CAMEL]: 'Camel', [WAR_ENGINE]: 'War engine', [PAWN]: 'Pawn',
};
export const PIECE_ABBR: Record<number, string> = {
  [KING]: 'K', [PRINCE]: 'Pr', [ADV_KING]: 'AK', [GENERAL]: 'G', [VIZIER]: 'V', [GIRAFFE]: 'Gi',
  [PICKET]: 'Pk', [KNIGHT]: 'N', [ROOK]: 'R', [ELEPHANT]: 'E', [CAMEL]: 'C', [WAR_ENGINE]: 'W', [PAWN]: 'P',
};

/**
 * Piece code (a positive int; 0 = empty, -1 = off board):
 *   bits 0–3 type, bit 4 colour, bits 5–8 "pawn of" type, bits 9–10 pawn-of-pawns
 *   arrivals at the far rank, bit 11 resting (pawn of pawns waiting on the far rank).
 */
export const piece = (t: PieceType, c: Color, of = 0, stage = 0, rest = 0): number =>
  t | (c << 4) | (of << 5) | (stage << 9) | (rest << 11);
export const pType = (p: number): PieceType => p & 15;
export const pColor = (p: number): Color => ((p >> 4) & 1) as Color;
export const pOf = (p: number): PieceType => (p >> 5) & 15;
export const pStage = (p: number): number => (p >> 9) & 3;
export const pRest = (p: number): boolean => ((p >> 11) & 1) === 1;
export const isRoyalType = (t: PieceType): boolean => t >= KING && t <= ADV_KING;
export const isRoyal = (p: number): boolean => p > 0 && isRoyalType(p & 15);

/** What a pawn turns into on the far rank (the pawn of pawns is handled separately). */
export const promotesTo = (of: PieceType): PieceType => (of === KING ? PRINCE : of);

/* ---------- Rule sets ---------- */
export interface Rules {
  id: 'standard' | 'gollon';
  name: string;
  /** Which royal pieces may enter the enemy citadel (and so draw the game). */
  citadelEntry: 'any-royal' | 'king-only';
  /** Pawn of pawns may be dropped onto an occupied non-royal square, removing the occupant. */
  dropOntoOccupied: boolean;
  /** Pawn of pawns may also be dropped where it attacks an enemy piece that has no move. */
  dropOnTrapped: boolean;
}
export const STANDARD: Rules = {
  id: 'standard', name: 'Standard', citadelEntry: 'any-royal', dropOntoOccupied: false, dropOnTrapped: false,
};
export const GOLLON: Rules = {
  id: 'gollon', name: 'Gollon', citadelEntry: 'king-only', dropOntoOccupied: true, dropOnTrapped: true,
};
export const RULESETS = { standard: STANDARD, gollon: GOLLON };

/* ---------- Moves ---------- */
export const MV_NORMAL = 0, MV_SWAP = 1, MV_DROP = 2;
export const encodeMove = (from: number, to: number, kind = MV_NORMAL): number => from | (to << 9) | (kind << 18);
export const mFrom = (m: number): number => m & 511;
export const mTo = (m: number): number => (m >> 9) & 511;
export const mKind = (m: number): number => (m >> 18) & 3;

/* ---------- Geometry ---------- */
const d = (dx: number, dy: number) => dy * STRIDE + dx;
export const ORTH = [d(1, 0), d(-1, 0), d(0, 1), d(0, -1)];
export const DIAG = [d(1, 1), d(1, -1), d(-1, 1), d(-1, -1)];
export const ALL8 = [...ORTH, ...DIAG];
const LEAPS: Record<number, number[]> = {
  [ELEPHANT]: [d(2, 2), d(2, -2), d(-2, 2), d(-2, -2)],
  [WAR_ENGINE]: [d(2, 0), d(-2, 0), d(0, 2), d(0, -2)],
  [CAMEL]: [d(1, 3), d(1, -3), d(-1, 3), d(-1, -3), d(3, 1), d(3, -1), d(-3, 1), d(-3, -1)],
  [KNIGHT]: [d(1, 2), d(1, -2), d(-1, 2), d(-1, -2), d(2, 1), d(2, -1), d(-2, 1), d(-2, -1)],
};
/** Giraffe: diagonal step, then one of the two straight directions that continue it. */
const GIRAFFE_PATHS: [number, number][] = [
  [d(1, 1), d(1, 0)], [d(1, 1), d(0, 1)], [d(1, -1), d(1, 0)], [d(1, -1), d(0, -1)],
  [d(-1, 1), d(-1, 0)], [d(-1, 1), d(0, 1)], [d(-1, -1), d(-1, 0)], [d(-1, -1), d(0, -1)],
];
export const GIRAFFE_MIN_STRAIGHT = 3;

export const forward = (c: Color): number => (c === WHITE ? STRIDE : -STRIDE);
export const lastRank = (c: Color): number => (c === WHITE ? ROWS - 1 : 0);
/** Where the pawn of pawns returns on its second arrival: the pawn of kings' start square. */
export const pawnHome = (c: Color): number => sq(6, c === WHITE ? 2 : 7);

/* ---------- State ---------- */
export interface State {
  b: Int32Array;
  turn: Color;
  /** bit 0: White has used its King swap; bit 1: Black has. */
  swapUsed: number;
  /** Half-moves since the last capture or pawn move. */
  quiet: number;
  ply: number;
  /** A royal piece has entered the enemy citadel. */
  citadelDraw: boolean;
  /** Number of royal pieces each side holds. */
  royals: [number, number];
  /** Square of each side's original King, or -1 once captured. */
  king: [number, number];
  h1: number;
  h2: number;
  last: number; // last move, -1 if none
}

/* Zobrist-style hashing without tables: each (square, piece) pair is mixed into two 32-bit keys. */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return x ^ (x >>> 16);
}
export const zkey1 = (s: number, p: number): number => mix((s << 12) ^ p ^ 0x51ed27);
export const zkey2 = (s: number, p: number): number => mix(((s << 12) ^ p) + 0x9e3779b9);
const Z_TURN1 = mix(0x1234567), Z_TURN2 = mix(0x7654321);
const Z_SWAP1 = [mix(0xabc1), mix(0xabc2)], Z_SWAP2 = [mix(0xdef1), mix(0xdef2)];

export function computeHash(st: State): [number, number] {
  let h1 = 0, h2 = 0;
  for (let s = 0; s < SIZE; s++) {
    const p = st.b[s];
    if (p > 0) { h1 ^= zkey1(s, p); h2 ^= zkey2(s, p); }
  }
  if (st.turn) { h1 ^= Z_TURN1; h2 ^= Z_TURN2; }
  for (const c of [0, 1]) if (st.swapUsed & (1 << c)) { h1 ^= Z_SWAP1[c]; h2 ^= Z_SWAP2[c]; }
  return [h1, h2];
}

export function emptyBoard(): Int32Array {
  const b = new Int32Array(SIZE).fill(OFF);
  for (let y = 0; y < ROWS; y++) for (let x = 1; x <= 11; x++) b[sq(x, y)] = 0;
  b[CIT_W] = 0;
  b[CIT_B] = 0;
  return b;
}

/** Builds a State from a board, recomputing derived fields. */
export function makeState(b: Int32Array, turn: Color = WHITE, swapUsed = 0): State {
  const royals: [number, number] = [0, 0];
  const king: [number, number] = [-1, -1];
  for (let s = 0; s < SIZE; s++) {
    const p = b[s];
    if (p > 0 && isRoyal(p)) {
      royals[pColor(p)]++;
      if (pType(p) === KING) king[pColor(p)] = s;
    }
  }
  const st: State = { b, turn, swapUsed, quiet: 0, ply: 0, citadelDraw: false, royals, king, h1: 0, h2: 0, last: -1 };
  [st.h1, st.h2] = computeHash(st);
  return st;
}

const BACK: number[] = [ELEPHANT, 0, CAMEL, 0, WAR_ENGINE, 0, WAR_ENGINE, 0, CAMEL, 0, ELEPHANT];
const MIDDLE: number[] = [ROOK, KNIGHT, PICKET, GIRAFFE, GENERAL, KING, VIZIER, GIRAFFE, PICKET, KNIGHT, ROOK];
/** "Pawn of" for files a–k: pawns, war engines, camels, elephants, generals, kings, viziers, giraffes, pickets, knights, rooks. */
const PAWNS: number[] = [PAWN, WAR_ENGINE, CAMEL, ELEPHANT, GENERAL, KING, VIZIER, GIRAFFE, PICKET, KNIGHT, ROOK];

export function initialState(): State {
  const b = emptyBoard();
  for (let f = 0; f < 11; f++) {
    const x = f + 1;
    if (BACK[f]) { b[sq(x, 0)] = piece(BACK[f], WHITE); b[sq(x, 9)] = piece(BACK[f], BLACK); }
    b[sq(x, 1)] = piece(MIDDLE[f], WHITE);
    b[sq(x, 8)] = piece(MIDDLE[f], BLACK);
    b[sq(x, 2)] = piece(PAWN, WHITE, PAWNS[f]);
    b[sq(x, 7)] = piece(PAWN, BLACK, PAWNS[f]);
  }
  return makeState(b);
}

/* ---------- Movement ---------- */

/** May piece p stand on square s (ignoring occupancy)? */
export function canEnter(rules: Rules, p: number, s: number): boolean {
  if (!isCitadel(s)) return true;
  const t = pType(p);
  if (!isRoyalType(t)) return false;
  if (citadelOwner(s) === pColor(p)) return t !== KING; // a Prince or Adventitious King may shelter at home
  return rules.citadelEntry === 'any-royal' || t === KING;
}

/** Can this occupant be captured by a piece of colour `by`? */
const capturable = (q: number, by: Color): boolean => q > 0 && pColor(q) !== by && !pRest(q);

/**
 * Pushes pseudo-legal non-drop, non-swap moves of the piece on s.
 * With capturesOnly, only captures (and promotions) are generated.
 */
export function pieceMoves(st: State, rules: Rules, s: number, out: number[], capturesOnly = false): void {
  const b = st.b, p = b[s], t = pType(p), c = pColor(p);
  const add = (to: number) => {
    const q = b[to];
    if (q === OFF || !canEnter(rules, p, to)) return;
    if (q === 0) { if (!capturesOnly) out.push(encodeMove(s, to)); }
    else if (capturable(q, c)) out.push(encodeMove(s, to));
  };
  switch (t) {
    case KING: case PRINCE: case ADV_KING: for (const o of ALL8) add(s + o); return;
    case GENERAL: for (const o of DIAG) add(s + o); return;
    case VIZIER: for (const o of ORTH) add(s + o); return;
    case ELEPHANT: case WAR_ENGINE: case CAMEL: case KNIGHT: for (const o of LEAPS[t]) add(s + o); return;
    case ROOK:
      for (const o of ORTH) {
        for (let to = s + o; ; to += o) {
          const q = b[to];
          if (q === OFF || isCitadel(to)) break;
          if (q === 0) { if (!capturesOnly) out.push(encodeMove(s, to)); continue; }
          if (capturable(q, c)) out.push(encodeMove(s, to));
          break;
        }
      }
      return;
    case PICKET:
      for (const o of DIAG) {
        for (let k = 1, to = s + o; ; k++, to += o) {
          const q = b[to];
          if (q === OFF || isCitadel(to)) break;
          if (k < 2) { if (q !== 0) break; continue; }
          if (q === 0) { if (!capturesOnly) out.push(encodeMove(s, to)); continue; }
          if (capturable(q, c)) out.push(encodeMove(s, to));
          break;
        }
      }
      return;
    case GIRAFFE:
      for (const [dg, st8] of GIRAFFE_PATHS) {
        const m = s + dg;
        if (b[m] !== 0 || isCitadel(m)) continue;
        for (let k = 1, to = m + st8; ; k++, to += st8) {
          const q = b[to];
          if (q === OFF || isCitadel(to)) break;
          if (k < GIRAFFE_MIN_STRAIGHT) { if (q !== 0) break; continue; }
          if (q === 0) { if (!capturesOnly) out.push(encodeMove(s, to)); continue; }
          if (capturable(q, c)) out.push(encodeMove(s, to));
          break;
        }
      }
      return;
    case PAWN: {
      if (pRest(p)) return;
      const f = forward(c);
      const to = s + f;
      const promo = sqY(to) === lastRank(c);
      if (b[to] === 0 && !isCitadel(to) && (!capturesOnly || promo)) out.push(encodeMove(s, to));
      for (const side of [-1, 1]) {
        const cap = to + side;
        if (!isCitadel(cap) && capturable(b[cap], c)) out.push(encodeMove(s, cap));
      }
      return;
    }
  }
}

/** Number of pseudo-legal moves the piece on s has (used for the "trapped piece" drop rule). */
function mobility(st: State, rules: Rules, s: number): number {
  const tmp: number[] = [];
  pieceMoves(st, rules, s, tmp);
  return tmp.length;
}

/** Drops available to a resting pawn of pawns on s. */
export function dropMoves(st: State, rules: Rules, s: number, out: number[]): void {
  const b = st.b, p = b[s], c = pColor(p);
  if (pStage(p) >= 2) {
    const home = pawnHome(c);
    if (b[home] === 0) out.push(encodeMove(s, home, MV_DROP));
    return;
  }
  const f = forward(c), enemy = other(c);
  for (let y = 0; y < ROWS; y++) {
    const ay = y + (c === WHITE ? 1 : -1);
    if (ay < 0 || ay >= ROWS) continue;
    for (let x = 1; x <= 11; x++) {
      const to = sq(x, y);
      if (to === s) continue;
      const q = b[to];
      if (q !== 0 && !(rules.dropOntoOccupied && q > 0 && !isRoyal(q))) continue;
      let attacked = 0, trapped = false;
      for (const side of [-1, 1]) {
        const a = to + f + side;
        const v = b[a];
        if (v > 0 && pColor(v) === enemy && !pRest(v) && !isCitadel(a)) {
          attacked++;
          if (rules.dropOnTrapped && !trapped) {
            // Test the target's mobility with the pawn placed.
            const saved = b[to], savedFrom = b[s];
            b[s] = 0; b[to] = piece(PAWN, c, PAWN, 1);
            trapped = mobility(st, rules, a) === 0;
            b[to] = saved; b[s] = savedFrom;
          }
        }
      }
      if (attacked >= 2 || trapped) out.push(encodeMove(s, to, MV_DROP));
    }
  }
}

/* ---------- Attack detection (reverse lookup from the target square) ---------- */

export function attackedBy(st: State, rules: Rules, target: number, by: Color): boolean {
  const b = st.b;
  const own = (q: number, t: number) => q > 0 && pColor(q) === by && pType(q) === t && !pRest(q);
  // Royal steps (royals can also strike into citadels, if allowed to enter them)
  for (const o of ALL8) {
    const q = b[target - o];
    if (q > 0 && pColor(q) === by && isRoyal(q) && canEnter(rules, q, target)) return true;
  }
  if (isCitadel(target)) return false; // no other piece can enter a citadel
  for (const o of DIAG) if (own(b[target - o], GENERAL)) return true;
  for (const o of ORTH) if (own(b[target - o], VIZIER)) return true;
  for (const t of [ELEPHANT, WAR_ENGINE, CAMEL, KNIGHT]) for (const o of LEAPS[t]) if (own(b[target - o], t)) return true;
  // Pawns attack diagonally forward
  const back = -forward(by);
  if (own(b[target + back - 1], PAWN) || own(b[target + back + 1], PAWN)) return true;
  // Rooks
  for (const o of ORTH) {
    for (let s = target + o; ; s += o) {
      const q = b[s];
      if (q === OFF || isCitadel(s)) break;
      if (q !== 0) { if (own(q, ROOK)) return true; break; }
    }
  }
  // Pickets (at least two squares away)
  for (const o of DIAG) {
    for (let k = 1, s = target + o; ; k++, s += o) {
      const q = b[s];
      if (q === OFF || isCitadel(s)) break;
      if (q !== 0) { if (k >= 2 && own(q, PICKET)) return true; break; }
    }
  }
  // Giraffes: walk back along the straight leg, then one diagonal step
  for (const [dg, st8] of GIRAFFE_PATHS) {
    for (let k = 1, m = target - st8; ; k++, m -= st8) {
      const q = b[m];
      if (q === OFF || isCitadel(m) || q !== 0) break; // the turning square and the leg must be empty
      if (k >= GIRAFFE_MIN_STRAIGHT && own(b[m - dg], GIRAFFE)) return true;
    }
  }
  return false;
}

export const inCheck = (st: State, rules: Rules, c: Color): boolean => {
  if (st.royals[c] !== 1) return false;
  const r = royalSquares(st, c)[0];
  return attackedBy(st, rules, r, other(c));
};

export function royalSquares(st: State, c: Color): number[] {
  const out: number[] = [];
  for (let s = 0; s < SIZE; s++) { const p = st.b[s]; if (p > 0 && pColor(p) === c && isRoyal(p)) out.push(s); }
  return out;
}

/** All pseudo-legal moves for the side to move (no self-check filtering). */
export function pseudoMoves(st: State, rules: Rules, out: number[] = [], capturesOnly = false): number[] {
  const b = st.b, c = st.turn;
  for (let s = 0; s < SIZE; s++) {
    const p = b[s];
    if (p <= 0 || pColor(p) !== c) continue;
    if (pType(p) === PAWN && pRest(p)) { if (!capturesOnly) dropMoves(st, rules, s, out); continue; }
    pieceMoves(st, rules, s, out, capturesOnly);
  }
  if (!capturesOnly) swapMoves(st, rules, out);
  return out;
}

/** The once-per-game King swap, available while the King is in check. */
export function swapMoves(st: State, rules: Rules, out: number[]): void {
  const c = st.turn, k = st.king[c];
  if (k < 0 || (st.swapUsed & (1 << c)) || isCitadel(k) || !attackedBy(st, rules, k, other(c))) return;
  for (let s = 0; s < SIZE; s++) {
    const q = st.b[s];
    if (q > 0 && pColor(q) === c && s !== k && !isRoyal(q) && !pRest(q) && !isCitadel(s)) out.push(encodeMove(k, s, MV_SWAP));
  }
}

/* ---------- Making moves ---------- */

export function applyMove(st: State, rules: Rules, m: number): State {
  const b = st.b.slice();
  let h1 = st.h1 ^ Z_TURN1, h2 = st.h2 ^ Z_TURN2;
  const royals: [number, number] = [st.royals[0], st.royals[1]];
  const king: [number, number] = [st.king[0], st.king[1]];
  let swapUsed = st.swapUsed, quiet = st.quiet + 1, citadelDraw = false, last = m;
  const set = (s: number, v: number) => {
    const old = b[s];
    if (old > 0) { h1 ^= zkey1(s, old); h2 ^= zkey2(s, old); }
    if (v > 0) { h1 ^= zkey1(s, v); h2 ^= zkey2(s, v); }
    b[s] = v;
  };
  const from = mFrom(m), to = mTo(m), kind = mKind(m);
  const p = b[from], c = pColor(p), t = pType(p);

  if (kind === MV_SWAP) {
    const q = b[to];
    set(from, q); set(to, p);
    king[c] = to;
    swapUsed |= 1 << c;
    h1 ^= Z_SWAP1[c]; h2 ^= Z_SWAP2[c];
  } else if (kind === MV_DROP) {
    const q = b[to];
    if (q > 0 && pColor(q) !== c && isRoyal(q)) royals[pColor(q)]--; // never generated, defensive
    set(from, 0);
    set(to, piece(PAWN, c, PAWN, pStage(p), 0));
    quiet = 0;
  } else {
    const q = b[to];
    if (q > 0) {
      quiet = 0;
      if (isRoyal(q)) { royals[pColor(q)]--; if (pType(q) === KING) king[pColor(q)] = -1; }
    }
    if (t === PAWN) quiet = 0;
    set(from, 0);
    let np = p, dest = to;
    if (t === PAWN && sqY(to) === lastRank(c)) {
      const of = pOf(p);
      if (of === PAWN) {
        const arrivals = pStage(p) + 1;
        if (arrivals === 1) np = piece(PAWN, c, PAWN, 1, 1);
        else if (arrivals === 2) {
          const home = pawnHome(c);
          if (b[home] === 0) { np = piece(PAWN, c, PAWN, 2, 0); dest = home; } else np = piece(PAWN, c, PAWN, 2, 1);
        } else { np = piece(ADV_KING, c); royals[c]++; }
      } else {
        np = piece(promotesTo(of), c);
        if (isRoyal(np)) royals[c]++;
      }
    }
    if (dest !== to) set(to, 0);
    set(dest, np);
    if (t === KING) king[c] = dest;
    if (isCitadel(dest) && isRoyal(np) && citadelOwner(dest) !== c) citadelDraw = true;
    if (dest !== to) last = encodeMove(from, dest);
  }
  return { b, turn: other(st.turn), swapUsed, quiet, ply: st.ply + 1, citadelDraw, royals, king, h1, h2, last };
}

/** Legal moves: with a single royal piece you may not leave it attacked. */
export function legalMoves(st: State, rules: Rules): number[] {
  const c = st.turn;
  const ms = pseudoMoves(st, rules);
  if (st.royals[c] !== 1) return ms;
  return ms.filter((m) => {
    const after = applyMove(st, rules, m);
    if (after.citadelDraw) return true;
    if (after.royals[c] !== 1) return true;
    const r = royalSquares(after, c)[0];
    return !attackedBy(after, rules, r, other(c));
  });
}

/* ---------- Game status ---------- */
export type Result =
  | { over: false; check: boolean; threatened: number[]; moves: number[] }
  | { over: true; winner: Color | null; reason: 'checkmate' | 'stalemate' | 'no-royals' | 'citadel' | 'quiet-moves' | 'only-royals' };

export function gameStatus(st: State, rules: Rules): Result {
  const c = st.turn, o = other(c);
  if (st.citadelDraw) return { over: true, winner: null, reason: 'citadel' };
  if (st.royals[c] === 0) return { over: true, winner: o, reason: 'no-royals' };
  const moves = legalMoves(st, rules);
  const R = royalSquares(st, c);
  const check = R.length === 1 && attackedBy(st, rules, R[0], o);
  if (!moves.length) return { over: true, winner: o, reason: check ? 'checkmate' : 'stalemate' };
  if (st.quiet >= 100) return { over: true, winner: null, reason: 'quiet-moves' };
  let onlyRoyals = true;
  for (let s = 0; s < SIZE && onlyRoyals; s++) { const p = st.b[s]; if (p > 0 && !isRoyal(p)) onlyRoyals = false; }
  if (onlyRoyals) return { over: true, winner: null, reason: 'only-royals' };
  return { over: false, check, threatened: R.filter((r) => attackedBy(st, rules, r, o)), moves };
}
