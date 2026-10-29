import { cellsFor } from '../items/itemGrid';
import { ITEMS, type ItemId } from '../items/items';
import type { WorldPoi } from './pois';
import { keyHint } from '../input/keyBindings';

/**
 * Searching a cache: what is in it comes to light a piece at a time, and the
 * player takes what they want of it while the world goes on.
 *
 * The captain, 2026-10-29: "in Tarkov you search dead bodies and you search
 * crates; here it's just like there's a crate that has two Poke Balls and you
 * pick it up. I feel like we should search crates." A cache used to pay out
 * whole the moment it was touched, so it was a waypoint rather than a choice.
 * Now opening one starts a search: a short wait for the lid, then each piece
 * after its own wait - longer for a bigger thing - and every piece that has
 * come to light can be taken into the pack, or left. The search is the
 * player's own time: the raid clock runs through it and the hunter keeps
 * coming, so a strongroom is a decision to stand still for four seconds with
 * somebody on your tail, and a spring is a moment.
 *
 * Nothing is lost by walking away. Every step away closes the search, and the
 * cache keeps what was not taken and what has already come to light, so
 * coming back carries on where it stopped (`CacheSearchState`, kept on the
 * raid's session so a fight does not forget it). A cache is spent - its
 * figure taken off the map - only once every piece is in somebody's pack.
 *
 * What a cache holds is untouched: the same reward rows, pieced out one unit
 * at a time ("2 Poke Balls" is two pieces), so the payout is exactly what it
 * was and only how it is taken has changed.
 */

/** One thing in a cache: a single unit of one of its reward rows. */
export interface SearchPiece {
  readonly itemId: ItemId;
  /** The squares it takes in the pack, which is what makes it slower to find. */
  readonly squares: number;
}

/** How long the lid takes before the first piece can come to light. */
export const SEARCH_OPEN_MS = 400;
/** How long every piece takes to come to light, before its size. */
export const SEARCH_PIECE_MS = 350;
/** And for each square it takes in the pack. */
export const SEARCH_SQUARE_MS = 150;

/** What searching a cache comes to, in pieces, in the order they come to light. */
export function searchPieces(reward: WorldPoi['reward']): SearchPiece[] {
  return reward.flatMap(({ itemId, quantity }) =>
    Array.from({ length: quantity }, () => ({ itemId, squares: cellsFor(itemId, 1) })),
  );
}

/** How long one piece takes to come to light. */
export function pieceSearchMs(piece: SearchPiece): number {
  return SEARCH_PIECE_MS + SEARCH_SQUARE_MS * piece.squares;
}

/** How long a whole cache takes to search, from the lid to its last piece. */
export function searchDurationMs(pieces: readonly SearchPiece[]): number {
  return pieces.reduce((total, piece) => total + pieceSearchMs(piece), SEARCH_OPEN_MS);
}

/** How many pieces have come to light after `searchedMs` of searching. */
export function piecesRevealed(pieces: readonly SearchPiece[], searchedMs: number): number {
  let at = SEARCH_OPEN_MS;
  let revealed = 0;
  for (const piece of pieces) {
    at += pieceSearchMs(piece);
    if (searchedMs < at) {
      break;
    }
    revealed += 1;
  }
  return revealed;
}

/**
 * Where a cache's search has got to. Kept per cache for the rest of the raid
 * (`ActiveRunSession.cachesSearched`), so a search walked away from, or broken
 * off by a fight, carries on where it stopped.
 */
export interface CacheSearchState {
  /** Time spent searching it, all told: what has come to light is read off this. */
  readonly searchedMs: number;
  /** The pieces taken out of it, by their index in `searchPieces`. */
  readonly taken: readonly number[];
}

export const FRESH_SEARCH: CacheSearchState = { searchedMs: 0, taken: [] };

/** The search after `deltaMs` more of it, never past the time the whole cache takes. */
export function searchOn(state: CacheSearchState, pieces: readonly SearchPiece[], deltaMs: number): CacheSearchState {
  const searchedMs = Math.min(searchDurationMs(pieces), state.searchedMs + Math.max(0, deltaMs));
  return searchedMs === state.searchedMs ? state : { ...state, searchedMs };
}

/** Whether every piece has come to light. */
export function searchFinished(state: CacheSearchState, pieces: readonly SearchPiece[]): boolean {
  return piecesRevealed(pieces, state.searchedMs) >= pieces.length;
}

/** Whether every piece has been taken: the cache is spent. */
export function cacheEmptied(state: CacheSearchState, pieces: readonly SearchPiece[]): boolean {
  return pieces.every((_piece, index) => state.taken.includes(index));
}

/** The pieces that have come to light and are still in the cache, by index. */
export function piecesToTake(state: CacheSearchState, pieces: readonly SearchPiece[]): number[] {
  const revealed = piecesRevealed(pieces, state.searchedMs);
  return pieces.map((_piece, index) => index).filter((index) => index < revealed && !state.taken.includes(index));
}

/** The search with `index` taken. Only a piece that has come to light and is still there can be. */
export function takePiece(state: CacheSearchState, pieces: readonly SearchPiece[], index: number): CacheSearchState | null {
  return piecesToTake(state, pieces).includes(index) ? { ...state, taken: [...state.taken, index] } : null;
}

/** The most rows a search lists, one to a number key. A bigger cache lists the rest as one line. */
export const SEARCH_ROWS = 6;

export type SearchRowStatus = 'found' | 'taken' | 'searching' | 'hidden';

export interface SearchRow {
  /** The number key that takes it, while it can be taken. */
  readonly key: string | null;
  readonly itemId: ItemId | null;
  readonly text: string;
  readonly status: SearchRowStatus;
}

/**
 * What the search panel says, row by row: a piece that has come to light by
 * name with the number key that takes it, a piece taken struck through as
 * TAKEN, the next piece as SEARCHING with as many dots as it is far along, and
 * the rest as a row of question marks - how many things are in a cache is
 * known from the lid, what they are is not.
 */
export function searchRows(state: CacheSearchState, pieces: readonly SearchPiece[]): SearchRow[] {
  const revealed = piecesRevealed(pieces, state.searchedMs);
  const rows = pieces.slice(0, SEARCH_ROWS).map((piece, index): SearchRow => {
    const name = ITEMS[piece.itemId].displayName.toUpperCase();
    if (state.taken.includes(index)) {
      return { key: null, itemId: piece.itemId, text: `${name} - TAKEN`, status: 'taken' };
    }
    if (index < revealed) {
      return { key: String(index + 1), itemId: piece.itemId, text: name, status: 'found' };
    }
    if (index === revealed) {
      return { key: null, itemId: null, text: `SEARCHING${'.'.repeat(1 + searchProgress(state, pieces, index))}`, status: 'searching' };
    }
    return { key: null, itemId: null, text: '???', status: 'hidden' };
  });
  return rows;
}

/** How far along the piece now being searched is, in three dots. */
function searchProgress(state: CacheSearchState, pieces: readonly SearchPiece[], index: number): number {
  const before = pieces.slice(0, index).reduce((total, piece) => total + pieceSearchMs(piece), SEARCH_OPEN_MS);
  const along = (state.searchedMs - before) / pieceSearchMs(pieces[index]);
  return Math.max(0, Math.min(2, Math.floor(along * 3)));
}

/** What the panel says under a piece the pack would not take. */
export function searchRefusal(itemId: ItemId): string {
  return `NO ROOM FOR ${ITEMS[itemId].displayName.toUpperCase()}: ${keyHint('B', 'PACK')}`;
}

/** What the panel says when taking a piece made the pack re-seat itself round it. */
export const SEARCH_RESEATED = 'YOUR PACK RE-PACKED ITSELF';

/**
 * The panel's last lines: why a key was just refused, if one was, then the
 * keys that do something now, then how to leave - which is walking away, so
 * nobody has to learn a key to stop searching.
 */
export function searchFooter(
  state: CacheSearchState,
  pieces: readonly SearchPiece[],
  takingAll: boolean,
  said: string | null,
): string[] {
  const numbers = piecesToTake(state, pieces)
    .filter((index) => index < SEARCH_ROWS)
    .map((index) => index + 1);
  const finished = searchFinished(state, pieces);
  const keys =
    takingAll && !finished
      ? 'TAKING EACH AS FOUND'
      : [
        ...(numbers.length === 0 ? [] : [keyHint(numbers.length === 1 ? `${numbers[0]}` : `${numbers[0]}-${numbers[numbers.length - 1]}`, 'TAKE')]),
        keyHint('SPACE', 'ALL'),
      ].join(' ');
  return [...(said ? [said] : []), keys, 'WALK AWAY TO LEAVE'];
}
