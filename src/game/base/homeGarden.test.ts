import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { CHARMANDER, PIDGEY, Pokemon, getSpeciesById } from '../pokemon';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { createStartingStash } from '../stash';
import type { RaidProgress } from '../save/SaveManager';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from './baseMap';
import { stepsFrom, stepsTo } from './baseWalks';
import { DAY_CARE_KEEPER, penTiles } from './dayCarePen';
import { BASE_DOORS } from './doors';
import { BASE_FIXTURES } from './fixtures';
import { restoreBase } from './baseGames.testkit';
import {
  GARDEN_SIZE,
  awayFromGarden,
  gardenLines,
  gardenPokemon,
  gardenQuestion,
  gardenStarts,
  gardenTiles,
  inGarden,
  nextGardenTile,
  toggleGarden,
} from './homeGarden';

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const RATTATA = getSpeciesById('rattata')!;

/** A vault of the starter and eight more at the levels given, kept in that order. */
function vault(levels: readonly number[], progress: Partial<RaidProgress> = {}) {
  const stash = createStartingStash(CHARMANDER);
  levels.forEach((level, index) => stash.addPokemon(new Pokemon(index % 2 ? PIDGEY : RATTATA, level), `kept-${index + 1}`));
  return restoreBase(stash, progress);
}

describe("THE BOLTHOLE's garden", () => {
  it('puts out the six highest level not going on the next raid, by default', () => {
    const game = vault([3, 9, 4, 12, 7, 2, 10, 8]);
    const out = gardenPokemon(game).map((stored) => stored.id);
    expect(out).toHaveLength(GARDEN_SIZE);
    // The vault's own order, the two lowest (Lv 3 and Lv 2) left in their boxes.
    expect(out).toEqual(['kept-2', 'kept-3', 'kept-4', 'kept-5', 'kept-7', 'kept-8']);
    // Never the partner: it walks at the player's heel.
    expect(out).not.toContain(game.stash.partnerId());
  });

  it('never puts out who is going on the next raid, or waiting on Nurse Joy', () => {
    const game = vault([3, 9, 4, 12], { lastBench: ['kept-4'] });
    game.stash.listPokemon().find((stored) => stored.id === 'kept-2')!.pokemon.takeDamage(5);
    const out = gardenPokemon(game).map((stored) => stored.id);
    expect(out).toEqual(['kept-1', 'kept-3']);
    const team = game.stash.listPokemon().find((stored) => stored.id === 'kept-4')!;
    expect(awayFromGarden(team, game)).toBe('team');
  });

  it("keeps the PC's choice, to who could be out", () => {
    const game = vault([3, 9, 4, 12], { garden: ['kept-3', 'kept-4', 'gone-1'], lastBench: ['kept-4'] });
    expect(gardenPokemon(game).map((stored) => stored.id)).toEqual(['kept-3']);
    expect(gardenPokemon(vault([3, 9], { garden: [] }))).toEqual([]);
  });

  it('puts one out or brings one in, and refuses a seventh or one that is somewhere else', () => {
    const game = vault([3, 9, 4, 12, 7, 2, 10, 8]);
    const brought = toggleGarden(game, 'kept-2');
    expect(brought).toEqual({ garden: ['kept-3', 'kept-4', 'kept-5', 'kept-7', 'kept-8'], out: false });
    const full = toggleGarden(game, 'kept-6');
    expect('refused' in full && full.refused).toContain('6 out already');
    const partner = toggleGarden(game, game.stash.partnerId()!);
    expect('refused' in partner && partner.refused).toContain('walks at your heel');
    const room = vault([3, 9], { garden: ['kept-1'] });
    expect(toggleGarden(room, 'kept-2')).toEqual({ garden: ['kept-1', 'kept-2'], out: true });
  });

  it('is lawn beside the house, whether or not the mast is built, with room for all six', () => {
    for (const built of [[], EVERY_RUNG]) {
      const map = getBaseMap(built);
      const free = (tile: GridPosition) => !map.collision[tile.y][tile.x] && key(tile) !== key(DAY_CARE_KEEPER.position);
      const open = gardenTiles().filter(free);
      expect(open.length).toBeGreaterThanOrEqual(GARDEN_SIZE + 3);
      const starts = gardenStarts(GARDEN_SIZE, free);
      expect(new Set(starts.map(key)).size).toBe(GARDEN_SIZE);
    }
    // Nobody arrives, goes in or reads anything inside it.
    const kept = [
      BASE_SPAWN,
      BASE_LANDING,
      ...penTiles(),
      ...BASE_DOORS.flatMap((door) => [...door.tiles, door.returnTo]),
      ...BASE_SIGNS.map((sign) => ({ x: sign.x, y: sign.y })),
    ];
    for (const tile of kept) expect([tile, inGarden(tile)]).toEqual([tile, false]);
  });

  /**
   * The yard's own rule, asked with every tile of the garden taken at once:
   * nothing is walled off, every built thing can still be read, and no walk to
   * a door is a step longer - walking must never become a toll for re-kitting.
   */
  it('walls nothing off and lengthens no walk to a door, with the whole garden full', () => {
    const garden = new Set(gardenTiles().map(key));
    for (const built of [[], EVERY_RUNG]) {
      const map = getBaseMap(built);
      for (const start of [BASE_SPAWN, BASE_LANDING]) {
        const empty = stepsFrom(map.collision, start);
        const full = stepsFrom(map.collision, start, (tile) => garden.has(key(tile)));
        for (const door of BASE_DOORS) {
          expect([door.id, stepsTo(full, door.tiles)]).toEqual([door.id, stepsTo(empty, door.tiles)]);
        }
        // Every built thing, and the Day-Care Man, can still be faced.
        const read = [...BASE_FIXTURES.map((fixture) => ({ name: fixture.name, at: fixture.at })), { name: 'DAY-CARE MAN', at: DAY_CARE_KEEPER.position }];
        for (const { name, at } of read) {
          const near = [
            { x: at.x, y: at.y + 1 },
            { x: at.x - 1, y: at.y },
            { x: at.x + 1, y: at.y },
            { x: at.x, y: at.y - 1 },
          ].filter((tile) => !map.collision[tile.y]?.[tile.x] && !garden.has(key(tile)));
          expect([name, near.some((tile) => full[tile.y][tile.x] < Infinity)]).toEqual([name, true]);
        }
        const pen = new Set(penTiles().map(key));
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            if (map.collision[y][x] || pen.has(`${x},${y}`) || garden.has(`${x},${y}`)) continue;
            expect([x, y, full[y][x] < Infinity]).toEqual([x, y, true]);
          }
        }
      }
    }
  });

  it('potters a tile at a time, never out of the garden nor onto a tile it may not have', () => {
    const from = { x: 43, y: 8 };
    for (let roll = 0; roll < 1; roll += 0.01) {
      const to = nextGardenTile(from, roll, (tile) => tile.x !== 44);
      expect(inGarden(to)).toBe(true);
      expect(Math.abs(to.x - from.x) + Math.abs(to.y - from.y)).toBeLessThanOrEqual(1);
      expect(to.x).not.toBe(44);
    }
    expect(nextGardenTile({ x: 41, y: 7 }, 0, () => false)).toEqual({ x: 41, y: 7 });
  });

  it('says who it is and where it is kept, and asks in one line', () => {
    const game = vault([5]);
    const stored = game.stash.listPokemon().find((one) => one.id === 'kept-1')!;
    expect(gardenLines(stored, 'BOX 1')[0]).toBe(
      'Rattata, Lv 5. It is kept in BOX 1, and potters about out here between raids.',
    );
    expect(gardenQuestion('WWWWWWWWWW').length).toBeLessThanOrEqual(40);
  });
});
