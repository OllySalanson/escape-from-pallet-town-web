import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MACHINE_ITEM_IDS, getItemById } from '../items';
import { MoveCategory } from './MoveBase';
import { PokemonType } from './PokemonType';
import { SPECIES_BY_ID } from './species';
import { MACHINES, MACHINE_DEFINITIONS, canLearnFromMachine, machineMovesFor } from './machines';

/**
 * The committed PokeAPI snapshot this catalogue is lifted out of. Reading it
 * back here is the whole point: the captain's rule is that nothing about the
 * 151 is invented, and a per-species compatibility list is exactly the kind of
 * thing that gets quietly guessed at. A TM this game refuses is FireRed
 * refusing it.
 */
const SNAPSHOT = JSON.parse(
  readFileSync(new URL('../../../tools/moves/frlg-machines.json', import.meta.url), 'utf8'),
) as {
  readonly machines: Readonly<
    Record<
      string,
      {
        machine: string;
        type: string;
        power: number | null;
        accuracy: number | null;
        pp: number;
        stat_chance: number;
        effect_chance: number | null;
        ailment: string;
        min_hits: number | null;
        max_hits: number | null;
      }
    >
  >;
  readonly learners: Readonly<Record<string, readonly string[]>>;
};

/** PokeAPI's slug for a move, which is its name lowercased and hyphenated. */
const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Generation III decides physical against special by the move's **type**, not
 * per move - the split arrived in generation IV. `moveTyping.test.ts` holds the
 * shipped catalogue to the same rule; this is the half of it the machines need,
 * and it is why Bullet Seed is Special here and physical in a modern dex.
 */
const SPECIAL_TYPES = new Set<string>([
  PokemonType.Fire,
  PokemonType.Water,
  PokemonType.Grass,
  PokemonType.Electric,
  PokemonType.Psychic,
  PokemonType.Ice,
  PokemonType.Dragon,
  PokemonType.Dark,
]);

describe('machines', () => {
  it('teaches each move on FireRed/LeafGreen numbers, straight off the snapshot', () => {
    for (const [id, machine] of Object.entries(MACHINES)) {
      const canon = SNAPSHOT.machines[slug(machine.move.name)];
      expect(canon, `${id} is not a FRLG machine`).toBeDefined();

      expect({ id, number: machine.number }).toEqual({ id, number: canon.machine });
      expect(machine.move.type.toLowerCase()).toBe(canon.type);
      expect(machine.move.power).toBe(canon.power);
      // A null accuracy in the snapshot is a move with no accuracy roll at all,
      // which this engine says as `alwaysHits` rather than as a number.
      expect(machine.move.accuracy).toBe(canon.accuracy ?? 100);
      expect(machine.move.alwaysHits).toBe(canon.accuracy === null);
      expect(machine.move.pp).toBe(canon.pp);
      expect(machine.move.hits).toEqual(
        canon.min_hits === null ? null : { min: canon.min_hits, max: canon.max_hits },
      );
      expect(machine.move.category).toBe(
        SPECIAL_TYPES.has(machine.move.type) ? MoveCategory.Special : MoveCategory.Physical,
      );
    }
  });

  it('carries each move secondary at the chance canon gives it', () => {
    for (const machine of MACHINE_DEFINITIONS) {
      const canon = SNAPSHOT.machines[slug(machine.move.name)];
      const chance = canon.effect_chance ?? 0;
      const rolled = machine.move.secondaries;

      expect(rolled.length, `${machine.number} secondaries`).toBe(chance === 0 ? 0 : 1);
      if (chance === 0) {
        continue;
      }
      expect(rolled[0].chance).toBe(chance);
      if (canon.ailment !== 'none') {
        expect(rolled[0].status).toBe(canon.ailment);
      } else {
        expect(rolled[0].boosts.length).toBe(1);
      }
    }
  });

  it('lets exactly the species FireRed lets, and no others', () => {
    for (const machine of MACHINE_DEFINITIONS) {
      const canon = Object.entries(SNAPSHOT.learners)
        .filter(([, moves]) => moves.includes(slug(machine.move.name)))
        .map(([species]) => species)
        .sort();

      expect([...machine.learners].sort(), `${machine.number} ${machine.move.name}`).toEqual(canon);
      expect(canon.length, `${machine.number} reaches nobody`).toBeGreaterThan(0);
      for (const species of machine.learners) {
        expect(SPECIES_BY_ID, `${species} is not a shipped species`).toHaveProperty(species);
        expect(canLearnFromMachine(species, machine.move)).toBe(true);
      }
    }
  });

  it('refuses a species canon refuses, which is the whole of the check', () => {
    // The three the playtest leans on: the Water starter has no wings, the
    // Grass starter is the only line that reads TM09, and Pikachu is on the
    // list for Iron Tail but not for Aerial Ace.
    expect(canLearnFromMachine('squirtle', MACHINES['tm40-aerial-ace'].move)).toBe(false);
    expect(canLearnFromMachine('pikachu', MACHINES['tm40-aerial-ace'].move)).toBe(false);
    expect(canLearnFromMachine('pikachu', MACHINES['tm23-iron-tail'].move)).toBe(true);
    expect(canLearnFromMachine('charmander', MACHINES['tm09-bullet-seed'].move)).toBe(false);
    expect(canLearnFromMachine('bulbasaur', MACHINES['tm09-bullet-seed'].move)).toBe(true);
  });

  /**
   * The six were chosen because no species *this game had* learned any of them,
   * so a disc was the only way to reach one. The import made that a smaller
   * claim and an exact one: FireRed teaches four of the six to nine species by
   * levelling, and those nine are listed here rather than left to be
   * rediscovered. Bullet Seed and Rock Smash are still in no learnset at all,
   * and no starter, no trainer's Pokemon and nothing on a shipped wild table
   * levels into any of the six - which is the part that matters, because it is
   * what stops a machine being a slower way to get a move you were owed.
   */
  it('is the only way to these moves for all but the nine species canon teaches them to', () => {
    const taught = new Set(MACHINE_DEFINITIONS.map((machine) => machine.move));
    const levelled: string[] = [];
    for (const species of Object.values(SPECIES_BY_ID)) {
      for (const entry of species.learnset) {
        if (taught.has(entry.move)) {
          levelled.push(`${species.id} ${entry.move.name} ${entry.level}`);
        }
      }
    }
    expect(levelled.sort()).toEqual([
      'articuno Ice Beam 49',
      'dewgong Ice Beam 51',
      'diglett Dig 17',
      'dugtrio Dig 17',
      'lapras Ice Beam 31',
      'onix Iron Tail 45',
      'seel Ice Beam 41',
      'shellder Ice Beam 50',
      'spearow Aerial Ace 25',
    ]);
  });

  it('names one disc per machine, and one machine per disc', () => {
    expect([...MACHINE_ITEM_IDS].sort()).toEqual(Object.keys(MACHINES).sort());
    for (const id of MACHINE_ITEM_IDS) {
      const item = getItemById(id);
      expect(item?.effect.type).toBe('machine');
      // The disc says on its face what it is and what it teaches, because a
      // bag row is the only place a player reads it.
      expect(item?.displayName).toContain(MACHINES[id].number);
      expect(item?.displayName).toContain(MACHINES[id].move.name);
    }
  });

  it('is five TMs used up by the reading and one HM that never is', () => {
    const reusable = MACHINE_DEFINITIONS.filter((machine) => machine.reusable);

    expect(reusable.length).toBe(1);
    for (const machine of MACHINE_DEFINITIONS) {
      expect(machine.number).toMatch(machine.reusable ? /^HM\d\d$/ : /^TM\d\d$/);
    }
  });

  it('reads back per species, which is what a saved moveset is resolved through', () => {
    expect(machineMovesFor('bulbasaur').map((move) => move.name).sort()).toEqual([
      'Bullet Seed',
      'Rock Smash',
    ]);
    expect(machineMovesFor('butterfree').map((move) => move.name)).toEqual(['Aerial Ace']);
    expect(machineMovesFor('pidgey').map((move) => move.name)).toEqual(['Aerial Ace']);
  });
});
