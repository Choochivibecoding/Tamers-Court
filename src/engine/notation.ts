import {
  State, sqX, sqY, CIT_W, CIT_B, mFrom, mTo, mKind, MV_SWAP, MV_DROP, PIECE_ABBR, pType, applyMove, Rules,
} from './rules';

const FILES = 'abcdefghijk';
export function squareName(s: number): string {
  if (s === CIT_W) return 'cW';
  if (s === CIT_B) return 'cB';
  return FILES[sqX(s) - 1] + (sqY(s) + 1);
}

/** Readable move text, e.g. "Gie2–e7", "Rk2×k9", "P*e5" (drop), "K⇄R a1" (swap), "Pf9–f10=Pr". */
export function moveText(st: State, rules: Rules, m: number): string {
  const from = mFrom(m), to = mTo(m), kind = mKind(m);
  if (kind === MV_SWAP) return `K⇄${PIECE_ABBR[pType(st.b[to])]} ${squareName(to)}`;
  if (kind === MV_DROP) return `P*${squareName(to)}`;
  const after = applyMove(st, rules, m);
  const mover = st.b[from];
  const dest = mTo(after.last);
  let s = PIECE_ABBR[pType(mover)] + squareName(from) + (st.b[to] > 0 ? '×' : '–') + squareName(dest);
  const np = after.b[dest];
  if (pType(np) !== pType(mover)) s += '=' + PIECE_ABBR[pType(np)];
  if (after.citadelDraw) s += ' ½';
  return s;
}
