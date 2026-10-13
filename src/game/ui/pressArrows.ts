import type { Direction } from '../movement/gridMovement';

/**
 * The way to press, as a caption on the map writes it: a door's `THE PRESS
 * HOUSE ▲`, an edge's `ROUTE 1 ▶`.
 *
 * Orange Kid draws no arrows, so a typed `↑` is the browser's fallback face cut
 * to the game's pixel grid (`pixelText.ts`), and a thin arrow does not survive
 * that: at 12px its head lost both diagonals, so `↑` came out a `T`, `↓` a
 * dagger and `←`/`→` a plus with a long arm - the street read `THE PRESS HOUSE
 * T`. A filled triangle has no stroke to lose, which is why the battle cursor
 * and the dialogue's prompt were already `▶` and `▼`; the captions use the same
 * four.
 */
export const PRESS_ARROWS: Readonly<Record<Direction, string>> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};
