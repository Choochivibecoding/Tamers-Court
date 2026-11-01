# Tamer's Court

A web version of Tamerlane chess (Shatranj al-Kabir), the 14th-century "Great Chess" of Timur's court: 11×10 board, two citadels, 13 piece types, pawns that promote to their own piece, multiple royal pieces, and the King's once-per-game swap.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # rules and engine tests
npm run build      # typecheck + production build
```

## Layout

- `src/engine/rules.ts` – board, pieces, move generation, rule sets (Standard, Gollon), game status
- `src/engine/search.ts` – alpha-beta search: iterative deepening, transposition table, null move, LMR, quiescence
- `src/engine/worker.ts`, `client.ts` – runs the search in a Web Worker
- `src/engine/notation.ts` – move text
- `tests/` – unit tests per rule, a differential test against the original prototype engine, engine tests

## Rule sets

| | Standard | Gollon |
|---|---|---|
| Who may enter the enemy citadel (draw) | any royal piece | the King only |
| Pawn-of-pawns drop onto an occupied square | no | yes (occupant removed) |
| Drop that attacks a piece with no move | no | yes |

Common to both: Camel leaps (3,1); Giraffe moves one diagonal then at least three straight; stalemate loses.

## License

MIT
