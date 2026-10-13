import { describe, expect, it } from 'vitest';
import { PokemonType } from '../pokemon/PokemonType';
import { MoveCategory } from '../pokemon/MoveBase';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, SQUIRTLE, getSpeciesById } from '../pokemon/species';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import type { WildEncounterTable } from '../pokemon/encounters';
import { WORLD_MAPS, type WorldMapId, getWorldMap, isMapInProgress } from '../worldMap';
import { generateRunPlan } from '../run/runGeneration';
import { MAP_DISTRICTS, districtAt, districtsForMap } from './districts';
import { WORLD_INTERIORS } from './interiors';
import { encounterTableAt } from './localEncounters';
import { measureTable } from './encounterMeasure';
import { districtTableFor } from './nightRaids';

const MAPS = Object.values(WORLD_MAPS);
/**
 * Variety from place to place and a target for every starter are asked of a
 * map's wildlife as a whole, which a map still being drawn does not have yet:
 * Greystone Vale's one drawn district is one place (`MAPS_IN_PROGRESS`).
 */
const FINISHED_MAPS = MAPS.filter((map) => !isMapInProgress(map.id));

/** Every tall-grass tile of a map, with the district it stands in. */
const grassTiles = (mapId: WorldMapId) => {
  const map = getWorldMap(mapId);
  const tiles: { x: number; y: number; districtId: string | undefined }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.tallGrass[y][x]) {
        tiles.push({ x, y, districtId: districtAt(mapId, { x, y })?.id });
      }
    }
  }
  return tiles;
};

const tablesOf = (mapId: WorldMapId, night = false): WildEncounterTable[] => [
  ...new Set(
    districtsForMap(mapId)
      .filter((district) => district.encounters)
      .map((district) => districtTableFor(district, night) as WildEncounterTable),
  ),
];

/**
 * A raid is a day raid or a night raid by the player's clock (`nightRaids.ts`),
 * and every rule a place's wildlife is held to holds at both hours.
 */
const HOURS = [
  { night: false, hour: 'by day' },
  { night: true, hour: 'by night' },
] as const;

describe('wildlife authored per place', () => {
  it('gives every district that holds tall grass a table of its own', () => {
    for (const map of MAPS) {
      const held = new Set(grassTiles(map.id).map((tile) => tile.districtId));
      expect(held.has(undefined), `${map.id} has tall grass outside every district`).toBe(false);
      for (const id of held) {
        expect(
          districtsForMap(map.id).find((district) => district.id === id)?.encounters,
          `${id} holds tall grass but has no wildlife`,
        ).toBeDefined();
      }
    }
  });

  it('holds no table for a place with nothing to roll it on', () => {
    // Tall grass, or a floor that rolls on every step of it - which is what a
    // cave is, and the only ground in the game that is not grass and still
    // costs fights (`interiors.ts`). Everything else with a table would be a
    // table nothing ever reads.
    const rollingFloors = new Set(
      WORLD_INTERIORS.filter((interior) => interior.floorRolls).map((interior) => interior.label),
    );
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      if (rollingFloors.has(district.name)) {
        continue;
      }
      const grass = grassTiles(district.mapId).some((tile) => tile.districtId === district.id);
      expect(grass, `${district.id} has wildlife and no tall grass`).toBe(true);
    }
  });

  it.each(HOURS)('names only species the game has, at sane weights and levels, $hour', ({ night }) => {
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      const table = districtTableFor(district, night) as WildEncounterTable;
      expect(table.stepEncounterRate).toBeGreaterThan(0);
      expect(table.entries.length).toBeGreaterThan(1);
      for (const entry of table.entries) {
        expect(getSpeciesById(entry.speciesId), `${district.id}: ${entry.speciesId}`).toBeDefined();
        expect(entry.weight).toBeGreaterThan(0);
        expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel);
      }
    }
  });

  /**
   * A wild encounter has to be a fight that can end. Abra and Ditto come out of
   * the import with no move at all - Teleport and Transform are both on the
   * bespoke list - so one in tall grass would stand there while the raid clock
   * ran, and the player's only way out would be to flee. Cocoons are allowed:
   * Metapod and Kakuna know Harden and nothing else in FireRed, which is a free
   * catch rather than a stalemate.
   */
  it.each(HOURS)('never rolls a species with no move to make, $hour', ({ night }) => {
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      for (const entry of (districtTableFor(district, night) as WildEncounterTable).entries) {
        const species = getSpeciesById(entry.speciesId)!;
        for (const level of [entry.minLevel, entry.maxLevel]) {
          expect(
            new Pokemon(species, level).moves.length,
            `${district.id}: ${entry.speciesId} at ${level} knows nothing`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('resolves a tile to its district, and only then to the map', () => {
    const fallback: WildEncounterTable = { stepEncounterRate: 0.5, entries: [] };
    const reed = districtsForMap('floodplain-relay').find((entry) => entry.id === 'floodplain-reedbeds')!;
    const tile = { x: reed.areas[0].x, y: reed.areas[0].y };

    expect(encounterTableAt('floodplain-relay', tile, fallback)).toBe(reed.encounters);
    expect(encounterTableAt('floodplain-relay', { x: 999, y: 999 }, fallback)).toBe(fallback);
  });

  it.each(HOURS)('is not the same wildlife from one place to the next, $hour', ({ night }) => {
    for (const map of FINISHED_MAPS) {
      const mixes = tablesOf(map.id, night).map((table) =>
        [...new Set(table.entries.map((entry) => entry.speciesId))].sort().join('/'),
      );
      expect(new Set(mixes).size, `${map.id} offers one mix everywhere`).toBeGreaterThan(1);
    }
  });

  it('gives a raid its own varied copy of every place, the same for the same seed', () => {
    const plan = generateRunPlan(0xabc);
    const authored = districtsForMap('floodplain-relay').find((entry) => entry.id === 'floodplain-reedbeds')!;
    const reed = plan.districtEncounters['floodplain-reedbeds'];

    expect(reed.entries.map((entry) => entry.speciesId)).toEqual(
      authored.encounters!.entries.map((entry) => entry.speciesId),
    );
    expect(generateRunPlan(0xabc).districtEncounters).toEqual(plan.districtEncounters);
    expect(generateRunPlan(0xdef).districtEncounters).not.toEqual(plan.districtEncounters);
  });

  /**
   * Nothing but a starter's kit tells the three apart before its first attack
   * of its own type, and that attack is what makes the choice loud - FireRed
   * teaches Ember and Bubble at 7 and Vine Whip at 10, so it is asked at 10.
   * That needs a target in what a raid on the map can meet. It is held per map
   * rather than per place, because a per-place guarantee would put something
   * weak to each of Grass, Fire and Water in every place.
   */
  it.each(HOURS)('gives each signature attack a target somewhere on every map, $hour', ({ night }) => {
    const signatures: [typeof BULBASAUR, PokemonType][] = [
      [BULBASAUR, PokemonType.Grass],
      [CHARMANDER, PokemonType.Fire],
      [SQUIRTLE, PokemonType.Water],
    ];
    for (const map of FINISHED_MAPS) {
      const wild = tablesOf(map.id, night).flatMap((table) =>
        table.entries.map((entry) => getSpeciesById(entry.speciesId)!),
      );
      for (const [starter, type] of signatures) {
        const learned = new Pokemon(starter, 10).moves.map((move) => move.base);
        expect(learned.some((move) => move.type === type && move.category !== MoveCategory.Status)).toBe(true);
        expect(
          wild.some(
            (base) =>
              getTypeEffectiveness(type, [
                base.primaryType,
                ...(base.secondaryType ? [base.secondaryType] : []),
              ]) > 1,
          ),
          `${starter.name}'s ${type} move has no target on ${map.id}`,
        ).toBe(true);
      }
    }
  });

  /**
   * Measured over the real engine: a level-5 partner on the starting maps, a
   * level-8 one in the forest. The floors are the worst place a starter meets,
   * not an average, because a district is somewhere a raid can be routed to.
   */
  describe('difficulty', () => {
    // Greystone Vale is not a starting map either: it opens after them, and its
    // woods roll the woodland table, Viridian Forest's own country. Measured as
    // the forest is, with a level-8 partner and no cap at the starting level.
    const LATER_MAPS: readonly string[] = ['viridian-forest', 'greystone-vale'];
    const partnerLevel = (mapId: WorldMapId): number => (LATER_MAPS.includes(mapId) ? 8 : 5);
    // The vale's woods by night, measured: a Squirtle wins 50% of the woodland
    // table, which is the floor's own edge, so it is written down rather than
    // left to a rounding.
    const FLOOR: Record<string, number> = { 'viridian-forest': 0.12, 'greystone-vale': 0.45 };

    // A night table that holds what the day one does is the day's fight, so
    // it is measured once, by day.
    it.each(HOURS)('keeps every place beatable by every starter, and the starting maps easy, $hour', ({ night }) => {
      for (const map of MAPS) {
        for (const district of districtsForMap(map.id).filter((entry) => entry.encounters)) {
          const table = districtTableFor(district, night)!;
          if (night && table.entries.every((entry, slot) => entry.speciesId === district.encounters!.entries[slot].speciesId)) {
            continue;
          }
          for (const starter of ['bulbasaur', 'charmander', 'squirtle']) {
            const measure = measureTable(table, starter, partnerLevel(map.id), 60);
            expect(
              measure.winRate,
              `${starter} at ${district.name} ${night ? 'by night' : 'by day'}: ${(measure.winRate * 100).toFixed(0)}%`,
            ).toBeGreaterThanOrEqual(FLOOR[map.id] ?? 0.5);
          }
          if (!LATER_MAPS.includes(map.id)) {
            const { meanLevel } = measureTable(table, 'bulbasaur', 5, 1);
            expect(meanLevel, district.name).toBeLessThanOrEqual(5);
          }
        }
      }
    });

    it('climbs through the forest from its edge to its deep stand', () => {
      const mean = (id: string) =>
        measureTable(MAP_DISTRICTS.find((entry) => entry.id === id)!.encounters!, 'bulbasaur', 8, 1).meanLevel;

      expect(mean('forest-north-landing')).toBeLessThan(mean('forest-deep-stand'));
      const forest = tablesOf('viridian-forest');
      const top = Math.max(...forest.flatMap((table) => table.entries.map((entry) => entry.maxLevel)));
      expect(top).toBeLessThanOrEqual(10);
    });
  });
});
