// Temporary entry point: confirms the engine runs in its worker. The game UI replaces this next.
import { Engine } from './engine/client';
import { initialState, STANDARD } from './engine/rules';
import { moveText } from './engine/notation';

const out = document.getElementById('out')!;
const st = initialState();
new Engine().think(st, 'standard', 'hard').then((r) => {
  out.textContent = r ? `Engine move ${moveText(st, STANDARD, r.move)} — depth ${r.depth}, ${r.nodes} nodes, ${r.timeMs} ms` : 'cancelled';
});
