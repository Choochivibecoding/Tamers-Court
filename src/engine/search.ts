/**
 * Alpha-beta search for Tamerlane chess.
 *
 * Uses "royal capture" semantics inside the tree: moves are pseudo-legal and a
 * side that has lost its last royal piece has lost. Because stalemate also
 * loses in this game, that matches the real rules without per-node legality
 * checks. Root moves are filtered for legality.
 *
 * Features: iterative deepening, transposition table, null-move pruning,
 * late-move reductions, killer and history move ordering, capture quiescence.
 */
import {
  State, Rules, Color, SIZE, ROWS, pseudoMoves, legalMoves, applyMove, attackedBy, other,
  pType, pColor, pOf, pRest, pStage, isRoyal, promotesTo, sqX, sqY, mFrom, mTo, mKind, MV_NORMAL,
  KING, PRINCE, ADV_KING, GENERAL, VIZIER, GIRAFFE, PICKET, KNIGHT, ROOK, ELEPHANT, CAMEL, WAR_ENGINE, PAWN,
} from './rules';

export const MATE = 100000;
const INF = 1 << 30;

/** Piece values in centipawns. Royal pieces beyond the King are worth keeping as spare lives. */
export const VALUE: Record<number, number> = {
  [PAWN]: 100, [GENERAL]: 150, [VIZIER]: 150, [ELEPHANT]: 150, [WAR_ENGINE]: 200, [CAMEL]: 250,
  [KNIGHT]: 300, [PICKET]: 350, [GIRAFFE]: 400, [ROOK]: 500, [PRINCE]: 450, [ADV_KING]: 450, [KING]: 0,
};

/* ---------- Evaluation ---------- */

/** Static evaluation from the side to move's point of view. */
export function evaluate(st: State): number {
  const b = st.b;
  let score = 0;
  for (let s = 0; s < SIZE; s++) {
    const p = b[s];
    if (p <= 0) continue;
    const t = pType(p), c = pColor(p), x = sqX(s), y = sqY(s);
    let v = VALUE[t];
    if (t === PAWN) {
      const adv = c === 0 ? y - 2 : 7 - y;
      const of = pOf(p);
      const target = of === PAWN ? (pStage(p) >= 2 ? ADV_KING : PRINCE) : promotesTo(of);
      if (pRest(p)) v += 60;
      else if (adv > 0) v += Math.round(adv * adv * 0.9 * (VALUE[target] / 100));
      // Central pawns are a little more useful
      v += 4 - Math.abs(x - 6);
    } else if (t === KING) {
      const home = c === 0 ? 1 : ROWS - 2;
      v -= 12 * Math.abs(y - home);
    } else if (!isRoyal(p)) {
      v -= 5 * (Math.abs(x - 6) + Math.abs(y - 4.5));
    }
    score += c === 0 ? v : -v;
  }
  return st.turn === 0 ? score : -score;
}

/* ---------- Transposition table ---------- */
const TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;
class TT {
  check = new Int32Array(TT_SIZE);
  move = new Int32Array(TT_SIZE);
  score = new Int32Array(TT_SIZE);
  depth = new Int8Array(TT_SIZE);
  flag = new Uint8Array(TT_SIZE);
  clear() { this.flag.fill(0); }
}

export interface SearchOptions {
  rules: Rules;
  /** Soft time budget in milliseconds. */
  timeMs?: number;
  maxDepth?: number;
  /** Random centipawns added to each root move's score, to weaken and vary play. */
  noise?: number;
}
export interface SearchResult { move: number; score: number; depth: number; nodes: number; timeMs: number; }

export class Searcher {
  private tt = new TT();
  private killers = new Int32Array(128 * 2);
  private history = new Int32Array(512 * 512);
  private nodes = 0;
  private deadline = 0;
  private aborted = false;
  private rules!: Rules;

  search(root: State, opts: SearchOptions): SearchResult {
    const start = Date.now();
    this.rules = opts.rules;
    this.nodes = 0;
    this.aborted = false;
    this.deadline = start + (opts.timeMs ?? 1000);
    this.killers.fill(0);
    this.history.fill(0);
    const maxDepth = opts.maxDepth ?? 64;
    const noise = opts.noise ?? 0;

    let moves = legalMoves(root, this.rules);
    if (!moves.length) return { move: -1, score: -MATE, depth: 0, nodes: 0, timeMs: 0 };
    if (moves.length === 1) return { move: moves[0], score: 0, depth: 0, nodes: 0, timeMs: 0 };
    moves = this.order(root, moves, 0, 0);

    let best = moves[0], bestScore = -INF, completed = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF, iterBest = -1, iterScore = -INF;
      const scored: [number, number][] = [];
      for (const m of moves) {
        const child = applyMove(root, this.rules, m);
        let v: number;
        if (child.citadelDraw) v = 0;
        else if (noise > 0) v = -this.negamax(child, depth - 1, -INF, INF, 1, true);
        else if (iterBest < 0) v = -this.negamax(child, depth - 1, -INF, -alpha, 1, true);
        else {
          v = -this.negamax(child, depth - 1, -alpha - 1, -alpha, 1, true);
          if (v > alpha && !this.aborted) v = -this.negamax(child, depth - 1, -INF, -alpha, 1, true);
        }
        if (this.aborted) break;
        if (noise > 0) v += Math.round((Math.random() * 2 - 1) * noise);
        scored.push([m, v]);
        if (v > iterScore) { iterScore = v; iterBest = m; }
        if (v > alpha) alpha = v;
      }
      if (this.aborted) {
        // Keep a partially searched iteration only if it found a better first choice
        if (iterBest >= 0 && iterBest === moves[0]) { best = iterBest; bestScore = iterScore; }
        break;
      }
      best = iterBest; bestScore = iterScore; completed = depth;
      // Re-order root moves by this iteration's scores
      scored.sort((a, b) => b[1] - a[1]);
      moves = scored.map((s) => s[0]);
      if (Math.abs(bestScore) > MATE - 200) break;
      if (Date.now() > start + (opts.timeMs ?? 1000) * 0.55) break; // next iteration would likely not finish
    }
    return { move: best, score: bestScore, depth: completed, nodes: this.nodes, timeMs: Date.now() - start };
  }

  private negamax(st: State, depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.aborted = true;
    if (this.aborted) return 0;
    const c = st.turn;
    if (st.royals[c] === 0) return -MATE + ply;
    if (st.citadelDraw || st.quiet >= 100) return 0;
    if (depth <= 0) return this.quiesce(st, alpha, beta, ply, 6);

    const idx = st.h1 & TT_MASK, tt = this.tt;
    let ttMove = 0;
    if (tt.flag[idx] && tt.check[idx] === st.h2) {
      ttMove = tt.move[idx];
      if (tt.depth[idx] >= depth) {
        let s = tt.score[idx];
        if (s > MATE - 1000) s -= ply; else if (s < -MATE + 1000) s += ply;
        const f = tt.flag[idx];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    const k = st.king[c];
    const checked = k >= 0 && st.royals[c] === 1 && attackedBy(st, this.rules, k, other(c));

    // Null move: if passing still beats beta, this node is good enough
    if (allowNull && !checked && depth >= 3 && beta < MATE - 1000 && this.hasOfficers(st, c)) {
      const nullSt: State = { ...st, turn: other(c), h1: st.h1 ^ 0x5bd1e995, h2: st.h2 ^ 0x1b873593, last: -1 };
      const v = -this.negamax(nullSt, depth - 3, -beta, -beta + 1, ply + 1, false);
      if (this.aborted) return 0;
      if (v >= beta) return beta;
    }

    let moves = pseudoMoves(st, this.rules);
    if (!moves.length) return -MATE + ply; // no move at all loses
    moves = this.order(st, moves, ttMove, ply);

    const alpha0 = alpha;
    let best = -INF, bestMove = moves[0], searched = 0;
    for (const m of moves) {
      const child = applyMove(st, this.rules, m);
      const capture = st.b[mTo(m)] > 0 && mKind(m) === MV_NORMAL;
      let v: number;
      if (searched === 0) v = -this.negamax(child, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // Late-move reduction for quiet moves
        const reduce = depth >= 3 && searched >= 4 && !capture && !checked && m !== this.killers[ply * 2] ? 1 : 0;
        v = -this.negamax(child, depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && (reduce || v < beta)) v = -this.negamax(child, depth - 1, -beta, -alpha, ply + 1, true);
      }
      if (this.aborted) return 0;
      searched++;
      if (v > best) { best = v; bestMove = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!capture && ply < 128) {
          this.killers[ply * 2 + 1] = this.killers[ply * 2];
          this.killers[ply * 2] = m;
          this.history[(mFrom(m) << 9) | mTo(m)] += depth * depth;
        }
        break;
      }
    }

    let store = best;
    if (store > MATE - 1000) store += ply; else if (store < -MATE + 1000) store -= ply;
    tt.check[idx] = st.h2; tt.move[idx] = bestMove; tt.score[idx] = store; tt.depth[idx] = depth;
    tt.flag[idx] = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    return best;
  }

  private quiesce(st: State, alpha: number, beta: number, ply: number, left: number): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.aborted = true;
    if (this.aborted) return 0;
    const c = st.turn;
    if (st.royals[c] === 0) return -MATE + ply;
    if (st.citadelDraw) return 0;
    const stand = evaluate(st);
    if (stand >= beta || left <= 0) return stand;
    if (stand > alpha) alpha = stand;
    const moves = this.order(st, pseudoMoves(st, this.rules, [], true), 0, ply);
    for (const m of moves) {
      const v = -this.quiesce(applyMove(st, this.rules, m), -beta, -alpha, ply + 1, left - 1);
      if (this.aborted) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  private hasOfficers(st: State, c: Color): boolean {
    for (let s = 0; s < SIZE; s++) {
      const p = st.b[s];
      if (p > 0 && pColor(p) === c && !isRoyal(p) && pType(p) !== PAWN) return true;
    }
    return false;
  }

  private order(st: State, moves: number[], ttMove: number, ply: number): number[] {
    const b = st.b, k0 = ply < 128 ? this.killers[ply * 2] : 0, k1 = ply < 128 ? this.killers[ply * 2 + 1] : 0;
    const scores = new Map<number, number>();
    for (const m of moves) {
      let s: number;
      if (m === ttMove) s = 1e9;
      else {
        const victim = b[mTo(m)];
        if (mKind(m) === MV_NORMAL && victim > 0) {
          s = 1e7 + (isRoyal(victim) ? 1e6 : VALUE[pType(victim)] * 10) - VALUE[pType(b[mFrom(m)])];
        } else if (m === k0) s = 9e6;
        else if (m === k1) s = 8e6;
        else s = this.history[(mFrom(m) << 9) | mTo(m)] + (mKind(m) !== MV_NORMAL ? 5e6 : 0);
      }
      scores.set(m, s);
    }
    return moves.sort((a, z) => scores.get(z)! - scores.get(a)!);
  }
}

/** Strength presets used by the UI. */
export const LEVELS = {
  easy: { timeMs: 200, maxDepth: 1, noise: 120 },
  normal: { timeMs: 500, maxDepth: 3, noise: 25 },
  hard: { timeMs: 1500, maxDepth: 64, noise: 0 },
  master: { timeMs: 5000, maxDepth: 64, noise: 0 },
} as const;
export type Level = keyof typeof LEVELS;
