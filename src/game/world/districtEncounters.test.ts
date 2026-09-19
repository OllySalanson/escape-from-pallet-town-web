import { describe, expect, it } from 'vitest';
import { PokemonType } from '../pokemon/PokemonType';
import { MoveCategory } from '../pokemon/MoveBase';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, SQUIRTLE, getSpeciesById } from '../pokemon/species';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import type { WildEncounterTable } from '../pokemon/encounters';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import { generateRunPlan } from '../run/runGeneration';
import { MAP_DISTRICTS, districtAt, districtsForMap } from './districts';
import { encounterTableAt } from './localEncounters';
import { measureTable } from './encounterMeasure';

const MAPS = Object.values(WORLD_MAPS);

/** Every tall-grass tile of a map, with the district it stands in. */
const grassTiles = (mapId: WorldMapId) => {
  const map = WORLD_MAPS[mapId];
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

const tablesOf = (mapId: WorldMapId): WildEncounterTable[] => [
  ...new Set(
    districtsForMap(mapId)
      .filter((district) => district.encounters)
      .map((district) => district.encounters as WildEncounterTable),
  ),
];

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

  it('holds no table for a place with no tall grass to roll it on', () => {
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      const grass = grassTiles(district.mapId).some((tile) => tile.districtId === district.id);
      expect(grass, `${district.id} has wildlife and no tall grass`).toBe(true);
    }
  });

  it('names only species the game has, at sane weights and levels', () => {
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      const table = district.encounters as WildEncounterTable;
      expect(table.stepEncounterRate).toBeGreaterThan(0);
      expect(table.entries.length).toBeGreaterThan(1);
      for (const entry of table.entries) {
        expect(getSpeciesById(entry.speciesId), `${district.id}: ${entry.speciesId}`).toBeDefined();
        expect(entry.weight).toBeGreaterThan(0);
        expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel);
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

  it('is not the same wildlife from one place to the next', () => {
    for (const map of MAPS) {
      const mixes = tablesOf(map.id).map((table) =>
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
   * Nothing but a starter's kit tells the three apart before level 7, and the
   * signature move is what makes the choice loud. That needs a target in what
   * a raid on the map can meet. The wild pool is seven species, and only one of
   * them is weak to each of Grass and Water (Squirtle and Charmander), so a
   * per-place guarantee would put both in every place; it is held per map, and
   * gets stricter as the rest of the 151 arrive.
   */
  it('gives each level-7 signature move a target somewhere on every map', () => {
    const signatures: [typeof BULBASAUR, PokemonType][] = [
      [BULBASAUR, PokemonType.Grass],
      [CHARMANDER, PokemonType.Fire],
      [SQUIRTLE, PokemonType.Water],
    ];
    for (const map of MAPS) {
      const wild = tablesOf(map.id).flatMap((table) =>
        table.entries.map((entry) => getSpeciesById(entry.speciesId)!),
      );
      for (const [starter, type] of signatures) {
        const learned = new Pokemon(starter, 7).moves.map((move) => move.base);
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
    const partnerLevel = (mapId: WorldMapId): number => (mapId === 'viridian-forest' ? 8 : 5);
    const FLOOR: Record<string, number> = { 'viridian-forest': 0.12 };

    it('keeps every place beatable by every starter, and the starting maps easy', () => {
      for (const map of MAPS) {
        for (const district of districtsForMap(map.id).filter((entry) => entry.encounters)) {
          for (const starter of ['bulbasaur', 'charmander', 'squirtle']) {
            const measure = measureTable(district.encounters!, starter, partnerLevel(map.id), 60);
            expect(
              measure.winRate,
              `${starter} at ${district.name}: ${(measure.winRate * 100).toFixed(0)}%`,
            ).toBeGreaterThanOrEqual(FLOOR[map.id] ?? 0.5);
          }
          if (map.id !== 'viridian-forest') {
            const { meanLevel } = measureTable(district.encounters!, 'bulbasaur', 5, 1);
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
