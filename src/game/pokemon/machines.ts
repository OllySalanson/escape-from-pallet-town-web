import type { MoveBase } from './MoveBase';
import { AERIAL_ACE, BULLET_SEED, DIG, ICE_BEAM, IRON_TAIL, ROCK_SMASH } from './moves';

/**
 * What a machine is, and which species answer to it.
 *
 * This is the tutorial's `PokemonBase.learnableByItems` turned the other way up.
 * There it is a list on every species, because a Unity ScriptableObject has
 * nowhere else to put it; here a machine is already a thing with a name, a
 * number and a move, so the list of who can be taught belongs beside it. It is
 * the same fact either way - `machineMovesFor()` reads it back per species, the
 * way the tutorial's field is read - and it means a seventh machine is one row
 * in this file rather than an edit to seventeen species.
 *
 * **Nothing here is invented.** `learners` is lifted out of
 * `tools/moves/frlg-machines.json`, a committed PokeAPI snapshot of what the
 * shipped roster can be taught by machine in FireRed/LeafGreen, and
 * `machines.test.ts` reads that file back and fails a list that drifts from it.
 * That is the whole point of the check the player meets: a TM refused is canon
 * refusing it, not a designer's guess.
 *
 * The number on the disc is generation III's own. TM numbers are per version
 * group - number 39 is Rock Tomb here and Swagger in generation II - so the
 * snapshot only ever reads the `firered-leafgreen` row.
 */
export interface MachineDefinition {
  /** TM40, HM06: what is printed on the disc, and what a player calls it. */
  readonly number: string;
  readonly move: MoveBase;
  /**
   * An HM is never used up. It is one flag rather than two item kinds, exactly
   * as the tutorial has it, so the only difference between a TM and an HM is
   * whether the disc survives being read.
   */
  readonly reusable: boolean;
  /** Species ids, as `species.ts` spells them. FRLG's own compatibility list. */
  readonly learners: readonly string[];
}

const STARTER_LINES = {
  bulbasaur: ['bulbasaur', 'ivysaur', 'venusaur'],
  charmander: ['charmander', 'charmeleon', 'charizard'],
  squirtle: ['squirtle', 'wartortle', 'blastoise'],
} as const;

const PIDGEY_LINE = ['pidgey', 'pidgeotto', 'pidgeot'];
const PIKACHU_LINE = ['pikachu', 'raichu'];
const JIGGLYPUFF_LINE = ['jigglypuff', 'wigglytuff'];

export const MACHINES: Readonly<Record<string, MachineDefinition>> = {
  'tm09-bullet-seed': {
    number: 'TM09',
    move: BULLET_SEED,
    reusable: false,
    // The narrowest list in the game: the Grass starter and nobody else.
    learners: [...STARTER_LINES.bulbasaur],
  },
  'tm13-ice-beam': {
    number: 'TM13',
    move: ICE_BEAM,
    reusable: false,
    learners: [...STARTER_LINES.squirtle, ...JIGGLYPUFF_LINE],
  },
  'tm23-iron-tail': {
    number: 'TM23',
    move: IRON_TAIL,
    reusable: false,
    learners: [...STARTER_LINES.charmander, ...STARTER_LINES.squirtle, ...PIKACHU_LINE],
  },
  'tm28-dig': {
    number: 'TM28',
    move: DIG,
    reusable: false,
    learners: [
      ...STARTER_LINES.charmander,
      ...STARTER_LINES.squirtle,
      ...PIKACHU_LINE,
      ...JIGGLYPUFF_LINE,
    ],
  },
  'tm40-aerial-ace': {
    number: 'TM40',
    move: AERIAL_ACE,
    reusable: false,
    learners: [...STARTER_LINES.charmander, 'butterfree', ...PIDGEY_LINE],
  },
  'hm06-rock-smash': {
    number: 'HM06',
    move: ROCK_SMASH,
    reusable: true,
    // The widest, which is what an HM is for: eleven of the seventeen, every
    // starter line among them.
    learners: [
      ...STARTER_LINES.bulbasaur,
      ...STARTER_LINES.charmander,
      ...STARTER_LINES.squirtle,
      ...PIKACHU_LINE,
    ],
  },
};

export type MachineId = keyof typeof MACHINES;

export const MACHINE_DEFINITIONS: readonly MachineDefinition[] = Object.values(MACHINES);

/**
 * Whether this species may be taught this move from a machine. The one question
 * a TM asks, and the tutorial's `TmItem.CanBeTaught` read off our own table.
 */
export function canLearnFromMachine(speciesId: string, move: MoveBase): boolean {
  return MACHINE_DEFINITIONS.some(
    (machine) => machine.move === move && machine.learners.includes(speciesId),
  );
}

/**
 * Every move this species could ever be taught from a machine - the tutorial's
 * `learnableByItems`, derived rather than stored.
 *
 * `Pokemon.restoreMoveset` needs it: a save's moveset is a list of names, and
 * before this existed the only names it could resolve were the species' own
 * learnset, so a move taught from a TM was silently dropped by the next load.
 */
export function machineMovesFor(speciesId: string): readonly MoveBase[] {
  return MACHINE_DEFINITIONS.filter((machine) => machine.learners.includes(speciesId)).map(
    (machine) => machine.move,
  );
}
