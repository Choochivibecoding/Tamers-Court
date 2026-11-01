import type { State, RULESETS } from './rules';
import type { Level } from './search';
import type { ThinkRequest, ThinkResponse } from './worker';

/**
 * Runs the search in a Web Worker so the board stays responsive.
 * Calling think() again, or stop(), abandons the previous request.
 */
export class Engine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: ThinkResponse | null) => void>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<ThinkResponse>) => {
      const resolve = this.pending.get(e.data.id);
      if (resolve) { this.pending.delete(e.data.id); resolve(e.data); }
    };
    this.worker = w;
    return w;
  }

  think(state: State, rules: keyof typeof RULESETS, level: Level): Promise<ThinkResponse | null> {
    this.cancelPending();
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ensure().postMessage({ id, state, rules, level } satisfies ThinkRequest);
    });
  }

  /** Terminates any search in progress; the next think() starts a fresh worker. */
  stop(): void {
    this.cancelPending();
    this.worker?.terminate();
    this.worker = null;
  }

  private cancelPending() {
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
  }
}
