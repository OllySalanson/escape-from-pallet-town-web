import { describe, expect, it } from 'vitest';
import {
  FRESH_SEARCH,
  SEARCH_OPEN_MS,
  cacheEmptied,
  pieceSearchMs,
  piecesRevealed,
  piecesToTake,
  searchDurationMs,
  searchFinished,
  searchOn,
  searchPieces,
  searchRows,
  takePiece,
} from './cacheSearch';
import { MAP_FILE_LANDMARKS } from './mapFile';
import { WORLD_POIS } from './pois';

const HIDE = searchPieces(MAP_FILE_LANDMARKS.hide.reward);
const STRONGROOM = searchPieces(MAP_FILE_LANDMARKS.strongroom.reward);

describe('searching a cache', () => {
  it('pieces a cache out a unit at a time, and pays exactly what it held', () => {
    // "A crate that has two Poke Balls" is two things to find.
    expect(HIDE.map((piece) => piece.itemId)).toEqual(['poke-ball', 'poke-ball']);
    for (const poi of WORLD_POIS) {
      const pieces = searchPieces(poi.reward);
      for (const { itemId, quantity } of poi.reward) {
        expect(pieces.filter((piece) => piece.itemId === itemId)).toHaveLength(
          poi.reward.filter((row) => row.itemId === itemId).reduce((sum, row) => sum + row.quantity, 0),
        );
        expect(quantity).toBeGreaterThan(0);
      }
    }
  });

  it('shows nothing until the lid is up, then one piece at a time', () => {
    expect(piecesRevealed(HIDE, 0)).toBe(0);
    expect(piecesRevealed(HIDE, SEARCH_OPEN_MS)).toBe(0);
    const first = SEARCH_OPEN_MS + pieceSearchMs(HIDE[0]);
    expect(piecesRevealed(HIDE, first - 1)).toBe(0);
    expect(piecesRevealed(HIDE, first)).toBe(1);
    expect(piecesRevealed(HIDE, searchDurationMs(HIDE))).toBe(2);
  });

  it('is quick for a small cache, longer for a big one, and never a chore', () => {
    expect(searchDurationMs(HIDE)).toBeLessThanOrEqual(1_600);
    expect(searchDurationMs(STRONGROOM)).toBeGreaterThan(searchDurationMs(HIDE) * 2);
    // The biggest cache in the game, shipped or drawn by a maker, is under five seconds.
    const every = [...WORLD_POIS.map((poi) => poi.reward), ...Object.values(MAP_FILE_LANDMARKS).map((kind) => kind.reward)];
    for (const reward of every) {
      expect(searchDurationMs(searchPieces(reward))).toBeLessThanOrEqual(5_000);
    }
    // A bigger thing takes longer to turn up than a small one.
    const crate = searchPieces([{ itemId: 'parts-crate', quantity: 1 }])[0];
    const potion = searchPieces([{ itemId: 'potion', quantity: 1 }])[0];
    expect(pieceSearchMs(crate)).toBeGreaterThan(pieceSearchMs(potion));
  });

  it('lets a piece be taken only once it has come to light, and only once', () => {
    let state = searchOn(FRESH_SEARCH, HIDE, SEARCH_OPEN_MS + pieceSearchMs(HIDE[0]));
    expect(takePiece(state, HIDE, 1)).toBeNull();
    state = takePiece(state, HIDE, 0)!;
    expect(state.taken).toEqual([0]);
    expect(takePiece(state, HIDE, 0)).toBeNull();
    expect(piecesToTake(state, HIDE)).toEqual([]);
    expect(cacheEmptied(state, HIDE)).toBe(false);
  });

  it('carries on where it stopped, and never past the end', () => {
    const half = searchOn(FRESH_SEARCH, STRONGROOM, 1_000);
    const resumed = searchOn(half, STRONGROOM, 100_000);
    expect(resumed.searchedMs).toBe(searchDurationMs(STRONGROOM));
    expect(searchFinished(resumed, STRONGROOM)).toBe(true);
    // Unchanged state is the same object, so a frame with nothing new redraws nothing.
    expect(searchOn(resumed, STRONGROOM, 16)).toBe(resumed);
  });

  it('is spent once every piece is taken, whatever order they went in', () => {
    let state = searchOn(FRESH_SEARCH, HIDE, searchDurationMs(HIDE));
    state = takePiece(state, HIDE, 1)!;
    state = takePiece(state, HIDE, 0)!;
    expect(cacheEmptied(state, HIDE)).toBe(true);
  });

  it('says what has come to light by name and number, and keeps the rest a question', () => {
    const rows = searchRows(searchOn(FRESH_SEARCH, HIDE, SEARCH_OPEN_MS + pieceSearchMs(HIDE[0])), HIDE);
    expect(rows.map((row) => [row.key, row.text, row.status])).toEqual([
      ['1', 'POKÉ BALL', 'found'],
      [null, 'SEARCHING.', 'searching'],
    ]);
    const taken = searchRows(takePiece(searchOn(FRESH_SEARCH, HIDE, 10_000), HIDE, 0)!, HIDE);
    expect(taken.map((row) => [row.key, row.status])).toEqual([[null, 'taken'], ['2', 'found']]);
    expect(searchRows(FRESH_SEARCH, STRONGROOM).slice(1).every((row) => row.text === '???')).toBe(true);
  });
});
