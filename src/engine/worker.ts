/// <reference lib="webworker" />
import { Searcher, LEVELS, type Level, type SearchResult } from './search';
import { RULESETS, type State } from './rules';

export interface ThinkRequest { id: number; state: State; rules: keyof typeof RULESETS; level: Level; }
export interface ThinkResponse extends SearchResult { id: number; }

const searcher = new Searcher();
self.onmessage = (e: MessageEvent<ThinkRequest>) => {
  const { id, state, rules, level } = e.data;
  const result = searcher.search(state, { rules: RULESETS[rules], ...LEVELS[level] });
  (self as unknown as Worker).postMessage({ id, ...result } satisfies ThinkResponse);
};
