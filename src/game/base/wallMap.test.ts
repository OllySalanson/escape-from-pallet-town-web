import { describe, expect, it } from 'vitest';
import { createStartingStash } from '../stash';
import { CHARMANDER } from '../pokemon';
import { MINIMAP_PALETTE } from '../world/minimap';
import { encodeSurvey } from '../world/survey';
import { tilesAround } from '../world/minimap';
import { frontDoorFor } from '../run/runGeneration';
import { WORLD_MAPS } from '../worldMap';
import type { RaidProgress } from '../save/SaveManager';
import { restoreBase } from './baseGames.testkit';
import { OAK_WALL_MAP } from './rooms';
import {
  POSTER_TILE,
  WALL_MAP_ORDER,
  posterLayout,
  wallMapEntries,
  wallMapNote,
  wallMapPoster,
  wallSigns,
} from './wallMap';

const game = (progress: Partial<RaidProgress> = {}) => restoreBase(createStartingStash(CHARMANDER), progress);

const EVERY_KEEPER = [
  'floodplain-toll-keeper',
  'floodplain-sluice-keeper',
  'floodplain-orchard-warden',
  'floodplain-quarry-foreman',
  'floodplain-sea-wall-keeper',
  'pallet-mill-keeper',
  'pallet-salt-keeper',
  'overlook-warden',
  'forest-ridge-keeper',
  'forest-quarry-keeper',
];

describe('the wall map in Oak’s Lab', () => {
  it('hangs every raid map, and only those', () => {
    expect([...WALL_MAP_ORDER].sort()).toEqual(Object.keys(WORLD_MAPS).sort());
    // Where every save starts is the first thing on the wall.
    expect(WALL_MAP_ORDER[0]).toBe('floodplain-relay');
  });

  it('pins a sign for every keeper beaten, under the map they held, and none for anyone else', () => {
    const fresh = game();
    for (const mapId of WALL_MAP_ORDER) {
      expect(wallSigns(fresh, mapId)).toEqual([]);
    }
    const two = game({ defeatedBosses: ['floodplain-toll-keeper', 'overlook-warden'] });
    expect(wallSigns(two, 'floodplain-relay')).toEqual([
      { bossId: 'floodplain-toll-keeper', keeper: 'TOLLMAN BRIGGS', doors: 'TOLL BRIDGE + ORCHARD FORD' },
    ]);
    expect(wallSigns(two, 'route-1').map((sign) => sign.doors)).toEqual(['OVERLOOK GATE + STEPS']);
    expect(wallSigns(two, 'pallet-town')).toEqual([]);
  });

  it('counts every keeper in the game once, beaten or holding', () => {
    const entries = wallMapEntries(game({ defeatedBosses: EVERY_KEEPER }));
    expect(entries.reduce((sum, entry) => sum + entry.signs.length, 0)).toBe(EVERY_KEEPER.length);
    expect(entries.every((entry) => entry.held === 0)).toBe(true);
    expect(wallMapNote(game({ defeatedBosses: EVERY_KEEPER }))).toBe('10 of 10 keepers beaten');
    // A field-move door is opened, not beaten: it pins no sign.
    expect(wallMapEntries(game({ openedGates: ['route-1-thorn-gate'] })).some((entry) => entry.signs.length > 0)).toBe(false);
  });

  it('knows a map by what has been walked on it, not by its doors alone', () => {
    const fresh = game();
    // A fresh save knows the ground round its one front door, and has walked nothing.
    const [floodplain, ...others] = wallMapEntries(fresh);
    expect(floodplain.known).toBeGreaterThan(0);
    expect(floodplain.walked).toBe(false);
    expect(others.every((entry) => entry.known === 0)).toBe(true);
    expect(wallMapNote(fresh)).toBe('0 of 4 maps walked');

    const door = frontDoorFor('route-1')!.position;
    const map = WORLD_MAPS['route-1'];
    const walked = game({
      surveyed: { 'route-1': encodeSurvey(map.width, new Set(tilesAround(door, 6, map.width, map.height))) },
    });
    const route = wallMapEntries(walked).find((entry) => entry.mapId === 'route-1')!;
    expect(route.walked).toBe(true);
    expect(route.known).toBeGreaterThan(0);
    expect(route.districtsKnown).toBeGreaterThan(0);
  });
});

describe('the board on the lab wall', () => {
  const area = OAK_WALL_MAP;

  it('is exactly the stretch of wall the lab keeps for it', () => {
    const poster = wallMapPoster(game(), area);
    expect([poster.width, poster.height]).toEqual([area.width * POSTER_TILE, area.height * POSTER_TILE]);
    expect(poster.data.length).toBe(poster.width * poster.height * 4);
    // Every pixel of it is drawn: a board with holes shows the wall through.
    for (let at = 3; at < poster.data.length; at += 4) {
      expect(poster.data[at]).toBe(255);
    }
  });

  it('hangs the four maps at one scale, standing on one line, inside the board', () => {
    const layout = posterLayout(area, {});
    const scale = (mapId: string) => {
      const placed = layout.pictures.find((picture) => picture.mapId === mapId)!;
      return placed.size.width / WORLD_MAPS[mapId as keyof typeof WORLD_MAPS].width;
    };
    // The Floodplain is twice Route 1 across, on the wall as in the world.
    expect(Math.abs(scale('floodplain-relay') - scale('route-1'))).toBeLessThan(0.1);
    const feet = layout.pictures.map((picture) => picture.at.y + picture.size.height + 2);
    expect(new Set(feet).size).toBe(1);
    for (const picture of layout.pictures) {
      expect(picture.at.x).toBeGreaterThanOrEqual(0);
      expect(picture.at.x + picture.size.width + 2).toBeLessThanOrEqual(layout.width);
      expect(picture.at.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('pins every sign under its own map, on the board, with room for every keeper there is', () => {
    const everyone = Object.fromEntries(
      WALL_MAP_ORDER.map((mapId) => [mapId, wallSigns(game({ defeatedBosses: EVERY_KEEPER }), mapId).length]),
    );
    const layout = posterLayout(area, everyone);
    expect(layout.signs).toHaveLength(EVERY_KEEPER.length);
    for (const sign of layout.signs) {
      const picture = layout.pictures.find((placed) => placed.mapId === sign.mapId)!;
      expect(sign.at.x).toBeGreaterThanOrEqual(picture.at.x);
      expect(sign.at.x).toBeLessThan(picture.at.x + picture.size.width + 2);
      expect(sign.at.y).toBeGreaterThan(picture.at.y + picture.size.height);
      expect(sign.at.y + 3).toBeLessThanOrEqual(layout.height - 2);
    }
  });

  it('draws the dark where nobody has walked and the ground where somebody has', () => {
    const count = (poster: ReturnType<typeof wallMapPoster>, inks: readonly string[]): number => {
      let found = 0;
      for (let at = 0; at < poster.data.length; at += 4) {
        const hex = `#${[0, 1, 2].map((offset) => poster.data[at + offset].toString(16).padStart(2, '0')).join('')}`;
        if (inks.includes(hex)) found += 1;
      }
      return found;
    };
    const door = frontDoorFor('route-1')!.position;
    const map = WORLD_MAPS['route-1'];
    const walked = wallMapPoster(
      game({
        surveyed: { 'route-1': encodeSurvey(map.width, new Set(tilesAround(door, 12, map.width, map.height))) },
      }),
      area,
    );
    const fresh = wallMapPoster(game(), area);
    const dark = ['0', '1', '2', '3', '4'].map((char) => MINIMAP_PALETTE[char]);
    const ground = ['.', 'g', ',', 'T', 'P'].map((char) => MINIMAP_PALETTE[char]);
    // A fresh save's wall is nearly all dark, and walking Route 1 puts ground
    // on it that was not there before.
    expect(count(fresh, dark)).toBeGreaterThan(count(fresh, ground) * 10);
    expect(count(walked, ground)).toBeGreaterThan(count(fresh, ground));
    expect(count(walked, dark)).toBeLessThan(count(fresh, dark));
  });
});
