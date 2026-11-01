import { describe, it, expect } from 'vitest';
import { Searcher, LEVELS } from '../src/engine/search';
import {
  STANDARD, initialState, applyMove, gameStatus, emptyBoard, makeState, piece, sq, mFrom, mTo,
  KING, ROOK, WHITE, BLACK, sqX, sqY,
} from '../src/engine/rules';

const at = (n: string) => sq(n.charCodeAt(0) - 96, parseInt(n.slice(1), 10) - 1);
const nm = (s: number) => String.fromCharCode(96 + sqX(s)) + (sqY(s) + 1);

describe('search', () => {
  it('takes a hanging Rook', () => {
    const b = emptyBoard();
    b[at('f2')] = piece(KING, WHITE); b[at('a1')] = piece(ROOK, WHITE);
    b[at('a8')] = piece(ROOK, BLACK); b[at('k10')] = piece(KING, BLACK);
    const r = new Searcher().search(makeState(b), { rules: STANDARD, timeMs: 500 });
    expect(nm(mFrom(r.move)) + nm(mTo(r.move))).toBe('a1a8');
  });

  it('finds a mate in one', () => {
    const b = emptyBoard();
    // Rh1–a1 is mate: the b2 Rook covers the b-file.
    b[at('a10')] = piece(KING, BLACK); b[at('h1')] = piece(ROOK, WHITE);
    b[at('b2')] = piece(ROOK, WHITE); b[at('k3')] = piece(KING, WHITE);
    const st = makeState(b);
    const r = new Searcher().search(st, { rules: STANDARD, timeMs: 1000 });
    const after = applyMove(st, STANDARD, r.move);
    expect(gameStatus(after, STANDARD)).toMatchObject({ over: true, winner: WHITE });
  });

  it('reaches a useful depth in the opening within the Hard budget', () => {
    const r = new Searcher().search(initialState(), { rules: STANDARD, ...LEVELS.hard });
    console.log(`opening: depth ${r.depth}, ${r.nodes} nodes in ${r.timeMs} ms (${Math.round(r.nodes / r.timeMs)}k nps)`);
    expect(r.depth).toBeGreaterThanOrEqual(4);
    expect(r.timeMs).toBeLessThan(LEVELS.hard.timeMs * 1.5);
  });

  it('plays a full game against itself without illegal moves', () => {
    let st = initialState();
    const s = new Searcher();
    let n = 0;
    for (; n < 400; n++) {
      const status = gameStatus(st, STANDARD);
      if (status.over) break;
      const r = s.search(st, { rules: STANDARD, timeMs: 60, maxDepth: 3 });
      expect(status.moves).toContain(r.move);
      st = applyMove(st, STANDARD, r.move);
    }
    console.log('self-play ended after', n, 'plies:', JSON.stringify(gameStatus(st, STANDARD).over ? gameStatus(st, STANDARD) : 'still running'));
  }, 120_000);

  it('Hard beats Easy', () => {
    let wins = 0;
    for (let g = 0; g < 4; g++) {
      let st = initialState();
      const hardSide = g % 2;
      const hard = new Searcher(), easy = new Searcher();
      for (let n = 0; n < 300; n++) {
        const status = gameStatus(st, STANDARD);
        if (status.over) { if (status.winner === hardSide) wins++; break; }
        const r = st.turn === hardSide
          ? hard.search(st, { rules: STANDARD, timeMs: 80 })
          : easy.search(st, { rules: STANDARD, ...LEVELS.easy });
        st = applyMove(st, STANDARD, r.move);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  }, 180_000);
});
