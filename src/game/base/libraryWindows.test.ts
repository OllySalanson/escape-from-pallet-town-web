import { describe, expect, it } from 'vitest';
import { baseGame } from './baseGames.testkit';
import { windowLight, type WindowLight } from './homeClock';
import { LIBRARY_PIECES, LIBRARY_SHEET } from './librarySheet';
import { buildRoom, LIBRARY_WINDOW_LINES, LIBRARY_WINDOW_PIECES, LIBRARY_WINDOWS, roomNamed } from './rooms';

/**
 * THE GREAT LIBRARY's three tall windows show the sky of the player's own
 * hour (the owner, 12 Nov 2026: "If it's daytime, those windows should be
 * daytime, and if it's nighttime, those windows should be nighttime. And same
 * with dusk as well."), by the clock THE BOLTHOLE's window and the harbour's
 * light already keep (`homeClock.ts`).
 */

const at = (hour: number): Date => new Date(2026, 10, 12, hour, 30);
const HOURS: readonly (readonly [WindowLight, number])[] = [
  ['day', 12],
  ['dusk', 19],
  ['night', 23],
];

const library = (now: Date) => buildRoom(roomNamed('great-library')!, baseGame(), now);

/** The tile ids of every layer in a window's two tiles, top then foot. */
const windowTiles = (now: Date, x: number): string =>
  JSON.stringify(Object.values(library(now).layers).map((layer) => [0, 1].map((y) => (layer as { tiles?: number[][] }).tiles?.[y]?.[x] ?? null)));

describe('THE GREAT LIBRARY’s windows', () => {
  it('there are three of them, between the bookcases of the back wall', () => {
    expect(LIBRARY_WINDOWS).toHaveLength(3);
  });

  it.each(HOURS)('show the %s sky at that hour, all three alike', (light, hour) => {
    expect(windowLight(at(hour))).toBe(light);
    const panes = LIBRARY_WINDOWS.map((x) => windowTiles(at(hour), x));
    expect(new Set(panes).size).toBe(1);
    // Faced, the window says the hour it shows.
    const window = library(at(hour)).things.find((thing) => thing.name === 'THE WINDOW')!;
    expect(window.lines).toEqual([LIBRARY_WINDOW_LINES[light]]);
    expect(window.tiles.map((tile) => tile.x)).toEqual([...LIBRARY_WINDOWS]);
  });

  it('are three different pictures, and the same picture all through one stretch of the day', () => {
    const pictures = HOURS.map(([, hour]) => windowTiles(at(hour), LIBRARY_WINDOWS[0]));
    expect(new Set(pictures).size).toBe(3);
    expect(windowTiles(at(8), LIBRARY_WINDOWS[0])).toBe(windowTiles(at(16), LIBRARY_WINDOWS[0]));
    // Dusk comes twice: before the day and after it.
    expect(windowLight(at(5))).toBe('dusk');
    expect(windowTiles(at(5), LIBRARY_WINDOWS[0])).toBe(windowTiles(at(19), LIBRARY_WINDOWS[0]));
    expect(windowTiles(at(2), LIBRARY_WINDOWS[0])).toBe(windowTiles(at(23), LIBRARY_WINDOWS[0]));
  });

  it('has a piece of the sheet for every hour the clock keeps, each its own', () => {
    const pieces = (['day', 'dusk', 'night'] as const).map((light) => LIBRARY_WINDOW_PIECES[light]);
    expect(new Set(pieces).size).toBe(3);
    const places = [LIBRARY_PIECES.backWindowDay, LIBRARY_PIECES.backWindowDusk, LIBRARY_PIECES.backWindowNight];
    expect(new Set(places.map((place) => `${place.column},${place.row}`)).size).toBe(3);
    for (const place of places) {
      expect([place.width, place.height]).toEqual([1, 2]);
      expect(place.column + place.width).toBeLessThanOrEqual(LIBRARY_SHEET.columns);
      expect(place.row + place.height).toBeLessThanOrEqual(LIBRARY_SHEET.rows);
    }
  });

  it('does not move anything a player walks round', () => {
    const [day, dusk, night] = HOURS.map(([, hour]) => library(at(hour)).collision);
    expect(dusk).toEqual(day);
    expect(night).toEqual(day);
  });
});
