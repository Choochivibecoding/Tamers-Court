import { describe, it, expect } from 'vitest';
import {
  STANDARD, GOLLON, initialState, legalMoves, applyMove, gameStatus, emptyBoard, makeState, piece, sq,
  mFrom, mTo, mKind, MV_SWAP, MV_DROP, sqX, sqY, pType, pStage, pRest, CIT_B, CIT_W, computeHash,
  KING, PRINCE, ADV_KING, GENERAL, VIZIER, GIRAFFE, PICKET, KNIGHT, ROOK, ELEPHANT, CAMEL, WAR_ENGINE, PAWN,
  WHITE, BLACK, type State, type Rules,
} from '../src/engine/rules';
// @ts-expect-error untyped reference implementation
import * as ref from './reference-engine.js';

/* ---------- helpers ---------- */
const at = (name: string) => {
  if (name === 'citW') return CIT_W;
  if (name === 'citB') return CIT_B;
  return sq(name.charCodeAt(0) - 96, parseInt(name.slice(1), 10) - 1);
};
type Spec = [string, 0 | 1, number, number?];
function position(list: Spec[], turn: 0 | 1 = WHITE, swapUsed = 0): State {
  const b = emptyBoard();
  for (const [s, c, t, of] of list) b[at(s)] = piece(t, c, of ?? 0);
  return makeState(b, turn, swapUsed);
}
const targetsFrom = (st: State, rules: Rules, from: string) =>
  legalMoves(st, rules).filter((m) => mFrom(m) === at(from)).map((m) => mTo(m)).sort((a, b) => a - b);
const names = (sqs: number[]) => sqs.map((s) => String.fromCharCode(96 + sqX(s)) + (sqY(s) + 1)).sort();
const find = (st: State, rules: Rules, from: string, to: string, kind?: number) =>
  legalMoves(st, rules).find((m) => mFrom(m) === at(from) && mTo(m) === at(to) && (kind === undefined || mKind(m) === kind));

/* ---------- differential test against the prototype engine ---------- */
const REF_T: Record<string, number> = { k: KING, pr: PRINCE, ak: ADV_KING, g: GENERAL, v: VIZIER, gi: GIRAFFE, t: PICKET, n: KNIGHT, r: ROOK, e: ELEPHANT, c: CAMEL, w: WAR_ENGINE, p: PAWN };
const refSq = (s: number) => ref.idx(sqX(s), sqY(s));
const key = (x: number, y: number, x2: number, y2: number, k: string) => `${x},${y}>${x2},${y2}:${k}`;
function newMoves(st: State): string[] {
  return legalMoves(st, STANDARD).map((m) => key(sqX(mFrom(m)), sqY(mFrom(m)), sqX(mTo(m)), sqY(mTo(m)), mKind(m) === MV_SWAP ? 'swap' : mKind(m) === MV_DROP ? 'drop' : 'n')).sort();
}
function refMoves(rs: any): string[] {
  return ref.legal(rs).map((m: any) => key(ref.X(m.f), ref.Y(m.f), ref.X(m.t), ref.Y(m.t), m.k)).sort();
}
function boardsMatch(st: State, rs: any): boolean {
  for (let y = 0; y < 10; y++) for (let x = 0; x < 13; x++) {
    if (!ref.onBoard(x, y)) continue;
    const a = st.b[sq(x, y)], p = rs.b[ref.idx(x, y)];
    if (!a !== !p) return false;
    if (!p) continue;
    if (pType(a) !== REF_T[p.t] || (a >> 4 & 1) !== (p.c === 'w' ? 0 : 1)) return false;
    if (p.t === 'p' && (REF_T[p.of] !== ((a >> 5) & 15) || pStage(a) !== (p.s || 0) || pRest(a) !== !!p.rest)) return false;
  }
  return true;
}

describe('agrees with the prototype engine', () => {
  it('from the initial position', () => {
    expect(newMoves(initialState())).toEqual(refMoves(ref.initial()));
    expect(newMoves(initialState()).length).toBe(24);
  });

  it('over 60 random games', () => {
    let seed = 7;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    let plies = 0;
    for (let g = 0; g < 60; g++) {
      let st = initialState(), rs = ref.initial();
      for (let ply = 0; ply < 160; ply++) {
        const a = newMoves(st), b = refMoves(rs);
        expect(a).toEqual(b);
        const ns = gameStatus(st, STANDARD), rsSt = ref.status(rs);
        expect(ns.over).toBe(!!rsSt.over);
        if (ns.over) break;
        // Prefer captures half the time so games reach promotions and endgames
        const ms = legalMoves(st, STANDARD);
        const caps = ms.filter((m) => st.b[mTo(m)] > 0 && mKind(m) === 0);
        const m = caps.length && rnd() < 0.6 ? caps[(rnd() * caps.length) | 0] : ms[(rnd() * ms.length) | 0];
        const rm = ref.legal(rs).find((r: any) => r.f === refSq(mFrom(m)) && r.t === refSq(mTo(m)) && r.k === (mKind(m) === MV_SWAP ? 'swap' : mKind(m) === MV_DROP ? 'drop' : 'n'));
        st = applyMove(st, STANDARD, m);
        rs = ref.apply(rs, rm);
        expect(boardsMatch(st, rs)).toBe(true);
        expect([st.h1, st.h2]).toEqual(computeHash(st));
        plies++;
      }
    }
    expect(plies).toBeGreaterThan(3000);
  });
});

/* ---------- individual rules ---------- */
describe('piece movement', () => {
  it('Giraffe: diagonal step then at least three straight', () => {
    const st = position([['f5', 0, GIRAFFE], ['a1', 0, KING], ['k10', 1, KING]]);
    const t = names(targetsFrom(st, STANDARD, 'f5'));
    expect(t).toContain('g9');   // g6 then up 3
    expect(t).toContain('g10');
    expect(t).not.toContain('g8'); // only 2 straight
    expect(t).toContain('j6');   // g6 then right 3
    expect(t.length).toBe(14); // 4 + 3 + 4 + 3 across the four diagonals
  });
  it('Giraffe is blocked by a piece on its turning square', () => {
    const st = position([['f5', 0, GIRAFFE], ['g6', 0, PAWN, PAWN], ['a1', 0, KING], ['k10', 1, KING]]);
    const t = names(targetsFrom(st, STANDARD, 'f5'));
    expect(t).not.toContain('g9');
    expect(t).not.toContain('j6');
  });
  it('Picket must move at least two squares and cannot take an adjacent piece', () => {
    const st = position([['e5', 0, PICKET], ['f6', 1, ROOK], ['d4', 1, ROOK], ['a1', 0, KING], ['k10', 1, KING]]);
    const t = names(targetsFrom(st, STANDARD, 'e5'));
    expect(t).not.toContain('f6');
    expect(t).not.toContain('g7'); // blocked by f6
    expect(t).toContain('c7');
  });
  it('Camel leaps (3,1)', () => {
    const st = position([['f5', 0, CAMEL], ['a1', 0, KING], ['k10', 1, KING]]);
    expect(names(targetsFrom(st, STANDARD, 'f5'))).toEqual(['c4', 'c6', 'e2', 'e8', 'g2', 'g8', 'i4', 'i6']);
  });
  it('pawns have no double step', () => {
    expect(names(targetsFrom(initialState(), STANDARD, 'e3'))).toEqual(['e4']);
  });
});

describe('promotion', () => {
  it('each pawn promotes to its own piece; pawn of kings becomes a Prince', () => {
    let st = position([['c9', 0, PAWN, CAMEL], ['f9', 0, PAWN, KING], ['a1', 0, KING], ['k1', 1, KING]]);
    st = applyMove(st, STANDARD, find(st, STANDARD, 'c9', 'c10')!);
    expect(pType(st.b[at('c10')])).toBe(CAMEL);
    st = applyMove(st, STANDARD, legalMoves(st, STANDARD)[0]);
    st = applyMove(st, STANDARD, find(st, STANDARD, 'f9', 'f10')!);
    expect(pType(st.b[at('f10')])).toBe(PRINCE);
    expect(st.royals[WHITE]).toBe(2);
  });
  it('pawn of pawns: rests, drops to fork, returns home, then becomes an Adventitious King', () => {
    let st = position([['a9', 0, PAWN, PAWN], ['d6', 1, ROOK], ['f6', 1, ROOK], ['a1', 0, KING], ['k1', 1, KING]]);
    const pass = () => { st = applyMove(st, STANDARD, legalMoves(st, STANDARD).find((m) => sqX(mFrom(m)) === 11 && sqY(mFrom(m)) === 0)!); };
    st = applyMove(st, STANDARD, find(st, STANDARD, 'a9', 'a10')!);
    expect(pRest(st.b[at('a10')])).toBe(true);
    pass();
    const drops = legalMoves(st, STANDARD).filter((m) => mKind(m) === MV_DROP).map(mTo);
    expect(names(drops)).toEqual(['e5']);
    st = applyMove(st, STANDARD, find(st, STANDARD, 'a10', 'e5', MV_DROP)!);
    expect(pRest(st.b[at('e5')])).toBe(false);
    // Second arrival: jumps to f3
    st = position([['b9', 0, PAWN, PAWN], ['a1', 0, KING], ['k1', 1, KING]]);
    st.b[at('b9')] = piece(PAWN, WHITE, PAWN, 1); st = makeState(st.b);
    st = applyMove(st, STANDARD, find(st, STANDARD, 'b9', 'b10')!);
    expect(st.b[at('b10')]).toBe(0);
    expect(pStage(st.b[at('f3')])).toBe(2);
    // Third arrival: Adventitious King
    st = position([['b9', 0, PAWN, PAWN], ['a1', 0, KING], ['k1', 1, KING]]);
    st.b[at('b9')] = piece(PAWN, WHITE, PAWN, 2); st = makeState(st.b);
    st = applyMove(st, STANDARD, find(st, STANDARD, 'b9', 'b10')!);
    expect(pType(st.b[at('b10')])).toBe(ADV_KING);
    expect(st.royals[WHITE]).toBe(2);
  });
  it('Gollon rules allow a drop onto an occupied square', () => {
    const st0 = position([['a10', 0, PAWN, PAWN], ['d6', 1, ROOK], ['f6', 1, ROOK], ['e5', 1, VIZIER], ['a1', 0, KING], ['k1', 1, KING]]);
    st0.b[at('a10')] = piece(PAWN, WHITE, PAWN, 1, 1);
    const st = makeState(st0.b);
    expect(find(st, STANDARD, 'a10', 'e5', MV_DROP)).toBeUndefined();
    expect(find(st, GOLLON, 'a10', 'e5', MV_DROP)).toBeDefined();
  });
});

describe('King swap', () => {
  it('is available only in check, once per game', () => {
    const st = position([['f2', 0, KING], ['a1', 0, ROOK], ['f8', 1, ROOK], ['k10', 1, KING]]);
    const swap = find(st, STANDARD, 'f2', 'a1', MV_SWAP)!;
    expect(swap).toBeDefined();
    const after = applyMove(st, STANDARD, swap);
    expect(pType(after.b[at('a1')])).toBe(KING);
    expect(pType(after.b[at('f2')])).toBe(ROOK);
    const used = position([['f2', 0, KING], ['a1', 0, ROOK], ['f8', 1, ROOK], ['k10', 1, KING]], WHITE, 1);
    expect(find(used, STANDARD, 'f2', 'a1', MV_SWAP)).toBeUndefined();
    const calm = position([['f2', 0, KING], ['a1', 0, ROOK], ['g8', 1, ROOK], ['k10', 1, KING]]);
    expect(find(calm, STANDARD, 'f2', 'a1', MV_SWAP)).toBeUndefined();
  });
});

describe('citadels and results', () => {
  it('a King entering the enemy citadel draws', () => {
    const st = position([['a8', 0, KING], ['k1', 1, KING], ['k5', 1, ROOK]]);
    const m = find(st, STANDARD, 'a8', 'citB')!;
    const after = applyMove(st, STANDARD, m);
    expect(gameStatus(after, STANDARD)).toMatchObject({ over: true, winner: null, reason: 'citadel' });
  });
  it('a King may not enter its own citadel; a Prince may', () => {
    const st = position([['k3', 0, KING], ['k1', 0, PRINCE], ['a10', 1, KING]]);
    expect(find(st, STANDARD, 'k3', 'citW')).toBeUndefined();
    expect(find(st, STANDARD, 'k1', 'citW')).toBeDefined();
  });
  it('Gollon rules let only the King enter the enemy citadel', () => {
    const st = position([['a7', 0, PRINCE], ['k1', 0, KING], ['k10', 1, KING]]);
    expect(find(st, STANDARD, 'a7', 'citB')).toBeUndefined(); // two squares away
    const st2 = position([['a8', 0, PRINCE], ['k1', 0, KING], ['k10', 1, KING]]);
    expect(find(st2, STANDARD, 'a8', 'citB')).toBeDefined();
    expect(find(st2, GOLLON, 'a8', 'citB')).toBeUndefined();
  });
  it('stalemate loses', () => {
    // Black King on a10 has no moves and is not in check
    const st = position([['a10', 1, KING], ['c9', 0, ROOK], ['b8', 0, ROOK], ['k1', 0, KING]], BLACK);
    expect(gameStatus(st, STANDARD)).toMatchObject({ over: true, winner: WHITE, reason: 'stalemate' });
  });
  it('checkmate', () => {
    const st = position([['a10', 1, KING], ['c9', 0, ROOK], ['b1', 0, ROOK], ['k1', 0, KING]], BLACK);
    // b-file and 9th rank covered, a10 attacked? rook b1 covers b-file; add attacker on a-file
    const st2 = position([['a10', 1, KING], ['c9', 0, ROOK], ['b1', 0, ROOK], ['a1', 0, ROOK], ['k1', 0, KING]], BLACK);
    expect(gameStatus(st2, STANDARD)).toMatchObject({ over: true, winner: WHITE, reason: 'checkmate' });
    expect(gameStatus(st, STANDARD).over).toBe(true);
  });
});
