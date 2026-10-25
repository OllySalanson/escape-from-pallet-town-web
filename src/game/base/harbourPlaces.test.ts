import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from './baseMap';
import { BASE_DOORS } from './doors';
import { HARBOUR_PLACES, harbourPlaceAt } from './harbourPlaces';

describe('the parts of the harbour', () => {
  it('name every tile anybody can stand on, with everything built and nothing', () => {
    for (const built of [[], WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)]) {
      const map = getBaseMap(built);
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collision[y][x]) continue;
          expect([x, y, harbourPlaceAt({ x, y })?.id ?? null]).toEqual([x, y, expect.any(String)]);
        }
      }
    }
  });

  it('are each somewhere a player can actually stand', () => {
    const map = getBaseMap([]);
    for (const place of HARBOUR_PLACES) {
      let open = 0;
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!map.collision[y][x] && harbourPlaceAt({ x, y })?.id === place.id) open += 1;
        }
      }
      expect([place.id, open > 0]).toEqual([place.id, true]);
    }
  });

  it('put the landings and the doors where a player would say they are', () => {
    expect(harbourPlaceAt(BASE_LANDING)?.id).toBe('quay');
    expect(harbourPlaceAt(BASE_SPAWN)?.id).toBe('yard');
    const door = (id: string) => BASE_DOORS.find((each) => each.id === id)!.returnTo;
    expect(harbourPlaceAt(door('raid-arena'))?.id).toBe('arena-square');
    expect(harbourPlaceAt(door('oaks-lab'))?.id).toBe('yard');
    expect(harbourPlaceAt(door('bills-cottage'))?.id).toBe('quay');
    expect(harbourPlaceAt({ x: 29, y: 27 })?.id).toBe('long-pier');
    expect(harbourPlaceAt({ x: 54, y: 19 })?.id).toBe('cove');
  });
});

describe('the place-name board', () => {
  it('drops in, rests long enough to read, and goes back up', async () => {
    const { SIGN_HOLD_MS, SIGN_SLIDE_MS, signDrop } = await import('./placeNameSign');
    expect(signDrop(0)).toBe(0);
    expect(signDrop(SIGN_SLIDE_MS / 2)).toBeCloseTo(0.5);
    expect(signDrop(SIGN_SLIDE_MS + 1)).toBe(1);
    expect(signDrop(SIGN_SLIDE_MS + SIGN_HOLD_MS - 1)).toBe(1);
    expect(signDrop(SIGN_SLIDE_MS * 1.5 + SIGN_HOLD_MS)).toBeCloseTo(0.5);
    expect(signDrop(SIGN_SLIDE_MS * 2 + SIGN_HOLD_MS)).toBeNull();
    expect(SIGN_HOLD_MS).toBeGreaterThanOrEqual(2000);
  });
});
