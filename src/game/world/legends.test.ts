import { describe, expect, it } from 'vitest';
import { getCatchChance } from '../pokemon/battle/battleEngine';
import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { gateKey, gateKeys, gatesForMap } from './gates';
import {
  caughtLegends,
  LEGENDS,
  legendEntityId,
  legendFledLine,
  legendOneThrowLine,
  legendStandingAs,
  legendTooStrongLine,
} from './legends';
import { stepDistances } from './mapStructure';
import { entitiesForMap } from './npcs';
import { createRunTrainerEncounters } from './trainers';

describe('the four legends', () => {
  it('are Kanto’s four, at FireRed’s own levels and catch rate', () => {
    expect(LEGENDS.map((legend) => [legend.speciesId, legend.level])).toEqual([
      ['articuno', 50],
      ['zapdos', 50],
      ['moltres', 50],
      ['mewtwo', 70],
    ]);
    for (const legend of LEGENDS) {
      expect(getSpeciesById(legend.speciesId)?.catchRate).toBe(3);
    }
  });

  it('each know a full kit at that level, so neither side of the fight is stuck', () => {
    for (const legend of LEGENDS) {
      const pokemon = new Pokemon(getSpeciesById(legend.speciesId)!, legend.level);
      expect(pokemon.moves.filter((move) => move.base.power > 0).length).toBeGreaterThan(0);
      expect(pokemon.moves).toHaveLength(4);
    }
  });

  it('stand on their maps as Pokemon that fight when spoken to, one on each of four maps', () => {
    expect(new Set(LEGENDS.map((legend) => legend.mapId)).size).toBe(LEGENDS.length);
    for (const legend of LEGENDS) {
      const standing = entitiesForMap(legend.mapId).find((entity) => entity.id === legendEntityId(legend));
      expect(standing).toMatchObject({
        position: legend.position,
        pokemon: legend.speciesId,
        wildLevel: legend.level,
        dialogLines: [legend.cry],
      });
      expect(legendStandingAs(legendEntityId(legend))).toBe(legend);
    }
    expect(legendStandingAs('town-sign')).toBeUndefined();
  });

  it('each stand behind their keeper’s doors: shut, nothing reaches them, open, the front door does', () => {
    for (const legend of LEGENDS) {
      const gates = gatesForMap(legend.mapId);
      const keepersDoors = gates.filter((gate) => gate.bossId === legend.behindBossId).map(gateKey);
      expect(keepersDoors.length).toBeGreaterThan(0);
      expect(createRunTrainerEncounters().some((encounter) => encounter.bossId === legend.behindBossId)).toBe(true);
      const everyOtherDoor = gateKeys(gates).filter((key) => !keepersDoors.includes(key));
      const from = frontDoorFor(legend.mapId)!.position;
      // Asked from beside it, because the legend's own tile is held by the legend.
      const reach = (opened: readonly string[]) => {
        const map = getWorldMap(legend.mapId, opened);
        const steps = stepDistances(map.collision, from);
        return [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ].some(({ x, y }) => (steps[legend.position.y + y]?.[legend.position.x + x] ?? -1) >= 0);
      };
      expect(`${legend.speciesId} reached with its keeper standing: ${reach(everyOtherDoor)}`).toBe(
        `${legend.speciesId} reached with its keeper standing: false`,
      );
      expect(`${legend.speciesId} reached with every door open: ${reach(gateKeys(gates))}`).toBe(
        `${legend.speciesId} reached with every door open: true`,
      );
    }
  });

  it('stand on a dead end, so they are never in anybody’s way', () => {
    for (const legend of LEGENDS) {
      const map = getWorldMap(legend.mapId, gateKeys(gatesForMap(legend.mapId)));
      const { x, y } = legend.position;
      expect(map.collision[y][x]).toBe(false);
      const open = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(([nx, ny]) => map.collision[ny]?.[nx] === false);
      expect(`${legend.speciesId}: ${open.length} ways in`).toBe(`${legend.speciesId}: 1 ways in`);
    }
  });
});

describe('a caught legend', () => {
  it('is any legend whose kind the Pokedex owns, and no other', () => {
    expect(caughtLegends([])).toEqual([]);
    // Bulbasaur, Articuno and Mewtwo.
    expect(caughtLegends([1, 144, 150])).toEqual(['legend-articuno', 'legend-mewtwo']);
  });

  it('rides into the raid on the plan, and changes nothing the seed rolls', () => {
    const plain = generateRunPlan(7, undefined, 'floodplain-relay');
    const caught = generateRunPlan(7, undefined, 'floodplain-relay', undefined, undefined, [], {}, [], [], false, [
      'legend-mewtwo',
    ]);
    expect(plain.caughtLegends).toEqual([]);
    expect(caught.caughtLegends).toEqual(['legend-mewtwo']);
    expect(caught.loot).toEqual(plain.loot);
    expect(caught.hunter).toEqual(plain.hunter);
  });
});

describe('the one throw', () => {
  it('is FireRed’s catch with no HP left: about one in eighty in a Poke Ball, twice that asleep', () => {
    const mewtwo = new Pokemon(getSpeciesById('mewtwo')!, 70);
    const poke = getCatchChance(3, 0, mewtwo.maxHp, null, 1);
    expect(poke).toBeGreaterThan(1 / 85);
    expect(poke).toBeLessThan(1 / 75);
    expect(getCatchChance(3, 0, mewtwo.maxHp, 'sleep', 1)).toBeGreaterThan(2 * poke);
  });

  it('speaks in the battle’s own words', () => {
    expect(legendTooStrongLine('Articuno')).toBe('ARTICUNO is too strong to catch while it can still fight!');
    expect(legendOneThrowLine('Zapdos')).toBe('ZAPDOS is too weak to get away! There is time for one throw.');
    expect(legendFledLine('Moltres')).toBe('Wild MOLTRES fled!');
  });
});
