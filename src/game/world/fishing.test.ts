import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSpeciesById, Pokemon } from '../pokemon';
import { WORLD_MAPS } from '../worldMap';
import { createSeededRng } from '../run/rng';
import { districtAt, MAP_DISTRICTS } from './districts';
import {
  CAST_MS,
  DOT_MS,
  FEWEST_DOTS,
  MOST_DOTS,
  ROD_ITEM_IDS,
  bestRod,
  castDurationMs,
  dotsShown,
  fishingTable,
  fishingWaterAt,
  isFishingWater,
  planCast,
  type FishingWater,
} from './fishing';
import { FISHING_WATER_SOURCES } from './generated/fishingWaters';
import { rollEncounter } from './wildEncounters';

interface Slot {
  readonly speciesId: string;
  readonly minLevel: number;
  readonly maxLevel: number;
}

/** The committed snapshot of FireRed's own table, which the game is held to. */
const SNAPSHOT = JSON.parse(
  readFileSync(join(__dirname, '../../../tools/encounters/frlg-water.json'), 'utf8'),
) as {
  readonly fishingRates: readonly number[];
  readonly rods: Readonly<Record<'old_rod' | 'good_rod' | 'super_rod', readonly number[]>>;
  readonly waters: readonly {
    readonly id: FishingWater;
    readonly FireRed: { readonly map: string; readonly fishing: readonly Slot[] };
  }[];
};

const WATERS = Object.keys(FISHING_WATER_SOURCES) as FishingWater[];
const ROD_GROUP = { 'old-rod': 'old_rod', 'good-rod': 'good_rod' } as const;

/** Every walkable tile with fishable water in front of it, on a shipped map. */
const banks = Object.values(WORLD_MAPS).flatMap((map) =>
  map.collision.flatMap((row, y) =>
    row.flatMap((blocked, x) =>
      !blocked &&
      [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ].some((tile) => isFishingWater(map, tile))
        ? [{ mapId: map.id, tile: { x, y } }]
        : [],
    ),
  ),
);

describe('fishing reads FireRed’s own water', () => {
  it.each(WATERS)('%s: each rod reads exactly its FireRed slots, at FireRed’s rates', (water) => {
    const source = SNAPSHOT.waters.find((candidate) => candidate.id === water)!;
    expect(source.FireRed.map).toBe(FISHING_WATER_SOURCES[water]);
    for (const rod of ROD_ITEM_IDS) {
      const slots = SNAPSHOT.rods[ROD_GROUP[rod]];
      expect(fishingTable(water, rod).entries).toEqual(
        slots.map((slot) => ({
          ...source.FireRed.fishing[slot],
          weight: SNAPSHOT.fishingRates[slot],
        })),
      );
    }
  });

  it('reads the sea from Pallet Town and fresh water from Viridian City', () => {
    expect(FISHING_WATER_SOURCES).toEqual({ sea: 'MAP_PALLET_TOWN', fresh: 'MAP_VIRIDIAN_CITY' });
    expect(
      new Set(fishingTable('sea', 'good-rod').entries.map((entry) => entry.speciesId)),
    ).toEqual(new Set(['horsea', 'magikarp', 'krabby']));
    expect(
      new Set(fishingTable('fresh', 'good-rod').entries.map((entry) => entry.speciesId)),
    ).toEqual(new Set(['poliwag', 'magikarp', 'goldeen']));
  });

  it('weights the Old Rod 70/30 and the Good Rod 60/20/20, out of FireRed’s hundred', () => {
    expect(fishingTable('fresh', 'old-rod').entries.map((entry) => entry.weight)).toEqual([70, 30]);
    expect(fishingTable('fresh', 'good-rod').entries.map((entry) => entry.weight)).toEqual([
      60, 20, 20,
    ]);
  });

  it('hooks only a Magikarp on the Old Rod, at FireRed’s level for the water', () => {
    const rng = createSeededRng(7);
    for (let cast = 0; cast < 300; cast += 1) {
      const fresh = rollEncounter(fishingTable('fresh', 'old-rod'), () => rng.next())!;
      expect(fresh).toEqual({ speciesId: 'magikarp', level: 5 });
      const sea = rollEncounter(fishingTable('sea', 'old-rod'), () => rng.next())!;
      expect(sea.speciesId).toBe('magikarp');
      expect(sea.level).toBeGreaterThanOrEqual(5);
      expect(sea.level).toBeLessThanOrEqual(10);
    }
  });

  it('hooks what the Good Rod reads in about FireRed’s proportions, every bite a fight', () => {
    const rng = createSeededRng(11);
    const counts = new Map<string, number>();
    const casts = 4000;
    for (let cast = 0; cast < casts; cast += 1) {
      // A table whose step rate is one never answers "nothing": whether
      // anything bites is the cast's coin, decided before the table is asked.
      const wild = rollEncounter(fishingTable('fresh', 'good-rod'), () => rng.next());
      expect(wild).not.toBeNull();
      expect(wild!.level).toBeGreaterThanOrEqual(5);
      expect(wild!.level).toBeLessThanOrEqual(15);
      counts.set(wild!.speciesId, (counts.get(wild!.speciesId) ?? 0) + 1);
    }
    expect((counts.get('poliwag') ?? 0) / casts).toBeCloseTo(0.6, 1);
    expect((counts.get('goldeen') ?? 0) / casts).toBeCloseTo(0.2, 1);
    expect((counts.get('magikarp') ?? 0) / casts).toBeCloseTo(0.2, 1);
  });

  it('names only species the game has, each with a move to make at every level it bites at', () => {
    for (const water of WATERS) {
      for (const rod of ROD_ITEM_IDS) {
        for (const entry of fishingTable(water, rod).entries) {
          const species = getSpeciesById(entry.speciesId);
          expect(species, entry.speciesId).toBeDefined();
          for (const level of [entry.minLevel, entry.maxLevel]) {
            expect(
              new Pokemon(species!, level).moves.length,
              `${entry.speciesId} at ${level}`,
            ).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('a cast', () => {
  it('waits a second, then four to ten dots a third of a second apart, as FireRed’s first round does', () => {
    expect(planCast(() => 0).dots).toBe(FEWEST_DOTS);
    expect(planCast(() => 0.55).dots).toBe(9);
    expect(planCast(() => 0.99).dots).toBe(MOST_DOTS);
    const plan = { dots: 6, bites: true };
    expect(castDurationMs(plan)).toBeCloseTo(CAST_MS + 7 * DOT_MS);
    expect(dotsShown(plan, CAST_MS)).toBe(0);
    expect(dotsShown(plan, CAST_MS + DOT_MS - 1)).toBe(0);
    expect(dotsShown(plan, CAST_MS + DOT_MS)).toBe(1);
    expect(dotsShown(plan, CAST_MS + 3 * DOT_MS)).toBe(3);
    expect(dotsShown(plan, castDurationMs(plan) + 5_000)).toBe(6);
  });

  it('bites one cast in two: the coin is the second draw', () => {
    const draws = (bite: number) => {
      const sequence = [0.3, bite];
      return () => sequence.shift()!;
    };
    expect(planCast(draws(0.49)).bites).toBe(true);
    expect(planCast(draws(0.5)).bites).toBe(false);
    const rng = createSeededRng(3);
    const bites = Array.from({ length: 2000 }, () => planCast(() => rng.next()).bites).filter(
      Boolean,
    ).length;
    expect(bites / 2000).toBeCloseTo(0.5, 1);
  });

  it('fishes with the best rod in the pack, and with nothing without one', () => {
    const pack = (held: readonly string[]) => (itemId: string) => (held.includes(itemId) ? 1 : 0);
    expect(bestRod(pack([]))).toBeNull();
    expect(bestRod(pack(['old-rod']))).toBe('old-rod');
    expect(bestRod(pack(['old-rod', 'good-rod']))).toBe('good-rod');
  });
});

describe('where the water is', () => {
  it('lets every shipped map be fished from its banks', () => {
    for (const mapId of Object.keys(WORLD_MAPS)) {
      expect(
        banks.some((bank) => bank.mapId === mapId),
        mapId,
      ).toBe(true);
    }
  });

  it('never offers a bridge deck or a ford as water to cast into: only water nobody can stand on', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      map.terrain.forEach((row, y) =>
        row.forEach((material, x) => {
          if (isFishingWater(map, { x, y })) {
            expect(material).toBe('water');
            expect(map.collision[y][x]).toBe(true);
          }
        }),
      );
    }
  });

  it('fishes the sea only where a place stands on the tide, and every such place has water to cast into', () => {
    const sea = MAP_DISTRICTS.filter((district) => district.water === 'sea');
    expect(sea.map((district) => district.name).sort()).toEqual(
      [
        'THE BEACON',
        'THE BREACH',
        'THE HARD',
        'THE LIGHT',
        'THE MUDS',
        'THE SALTINGS',
        'THE SALTINGS',
        'THE SEA WALL',
        'THE STAITHE',
        'THE STRAND',
      ].sort(),
    );
    for (const district of sea) {
      expect(
        banks.some((bank) => districtAt(bank.mapId, bank.tile)?.id === district.id),
        `${district.id} says it is on the sea and has no water`,
      ).toBe(true);
    }
  });

  it('fishes fresh water everywhere else - the millpond, the brook, the pond, the tarn, a player’s own map', () => {
    expect(fishingWaterAt('pallet-town', { x: 2, y: 66 })).toBe('sea');
    const fresh = banks.filter((bank) => fishingWaterAt(bank.mapId, bank.tile) === 'fresh');
    for (const mapId of Object.keys(WORLD_MAPS)) {
      expect(
        fresh.some((bank) => bank.mapId === mapId),
        mapId,
      ).toBe(true);
    }
    expect(fishingWaterAt('player-anything', { x: 0, y: 0 })).toBe('fresh');
  });
});
