import { describe, expect, it } from 'vitest';
import { BASE_SIGNS, BASE_SPAWN, getBaseMap } from '../base/baseMap';
import { stepsFrom } from '../base/baseWalks';
import { BASE_DOORS } from '../base/doors';
import { HARBOUR_LIFE, harbourBeatTiles } from '../base/harbourLife';
import { HARBOUR_PLACES, harbourPlaceAt } from '../base/harbourPlaces';
import { BASE_ROOMS } from '../base/rooms';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import type { GridPosition } from '../movement/gridMovement';
import { PLAYTEST_BOARD_TILE, placeLanding, playtestBoardRows } from './playtestBoard';
import { playtestBoardMarkup } from './playtestBoardView';
import { PLAYTEST_GAMES } from './playtestKit';

const same = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;
const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);

describe('the PLAYTEST BOARD in the yard', () => {
  it('stands on open ground that nothing else stands on', () => {
    for (const built of [[], EVERY_RUNG]) {
      expect(getBaseMap(built).collision[PLAYTEST_BOARD_TILE.y][PLAYTEST_BOARD_TILE.x]).toBe(false);
    }
    expect(same(PLAYTEST_BOARD_TILE, BASE_SPAWN)).toBe(false);
    expect(BASE_SIGNS.some((sign) => same(sign, PLAYTEST_BOARD_TILE))).toBe(false);
    expect(BASE_DOORS.some((door) => door.tiles.some((tile) => same(tile, PLAYTEST_BOARD_TILE)) || same(door.returnTo, PLAYTEST_BOARD_TILE))).toBe(false);
    for (const figure of HARBOUR_LIFE) {
      expect(harbourBeatTiles(figure).some((tile) => same(tile, PLAYTEST_BOARD_TILE)), figure.id).toBe(false);
    }
  });

  it('can be read from the path, a step or two from where the run lands', () => {
    const below = { x: PLAYTEST_BOARD_TILE.x, y: PLAYTEST_BOARD_TILE.y - 1 };
    const steps = stepsFrom(getBaseMap().collision, BASE_SPAWN);
    expect(steps[below.y][below.x]).toBeLessThanOrEqual(3);
  });

  it('walls nothing off: every tile and every door is still reached with it standing', () => {
    for (const built of [[], EVERY_RUNG]) {
      const { collision } = getBaseMap(built);
      const open = stepsFrom(collision, BASE_SPAWN);
      const withBoard = stepsFrom(collision, BASE_SPAWN, (tile) => same(tile, PLAYTEST_BOARD_TILE));
      for (let y = 0; y < collision.length; y += 1) {
        for (let x = 0; x < collision[y].length; x += 1) {
          if (same({ x, y }, PLAYTEST_BOARD_TILE) || !Number.isFinite(open[y][x])) continue;
          expect(Number.isFinite(withBoard[y][x]), `${x},${y}`).toBe(true);
        }
      }
    }
  });
});

describe("the board's rows", () => {
  const rows = playtestBoardRows(null);

  it('goes to every room, every part of the harbour and every game', () => {
    for (const room of BASE_ROOMS) {
      expect(rows.some((row) => row.action.kind === 'room' && row.action.room === room.id), room.id).toBe(true);
    }
    for (const place of HARBOUR_PLACES) {
      expect(rows.some((row) => row.action.kind === 'place' && row.action.place === place.id), place.id).toBe(true);
    }
    for (const game of PLAYTEST_GAMES) {
      expect(rows.some((row) => row.action.kind === 'game' && row.action.game === game.id), game.id).toBe(true);
    }
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('puts the player down inside each part of the harbour, on open ground and off every door', () => {
    const { collision } = getBaseMap(EVERY_RUNG);
    const reached = stepsFrom(collision, BASE_SPAWN);
    for (const place of HARBOUR_PLACES) {
      const landing = placeLanding(place, EVERY_RUNG);
      expect(collision[landing.y][landing.x], place.id).toBe(false);
      expect(Number.isFinite(reached[landing.y][landing.x]), place.id).toBe(true);
      expect(BASE_DOORS.some((door) => door.tiles.some((tile) => same(tile, landing))), place.id).toBe(false);
      expect(harbourPlaceAt(landing)?.id, place.id).toBe(place.id);
    }
  });

  it('says which hour is set', () => {
    expect(playtestBoardRows('night').find((row) => row.id === 'hour-night')?.label).toBe('NIGHT (NOW)');
    expect(playtestBoardMarkup('night')).toContain('Hour: NIGHT');
    expect(playtestBoardMarkup(null)).toContain('Hour: MY CLOCK');
  });
});
