import type { MoveBase } from './MoveBase';
import { GENERATED_MACHINE_LEARNERS } from './generated/machineLearners';
import { AERIAL_ACE, BULLET_SEED, CUT, DIG, ICE_BEAM, IRON_TAIL, ROCK_SMASH, SURF } from './moves';

/**
 * What a machine is, and which species answer to it.
 *
 * This is the tutorial's `PokemonBase.learnableByItems` turned the other way up.
 * There it is a list on every species, because a Unity ScriptableObject has
 * nowhere else to put it; here a machine is already a thing with a name, a
 * number and a move, so the list of who can be taught belongs beside it. It is
 * the same fact either way - `machineMovesFor()` reads it back per species, the
 * way the tutorial's field is read - and it means an eighth machine is one row
 * in this file rather than an edit to a hundred and fifty species.
 *
 * **Nothing here is invented.** The compatibility list is
 * `generated/machineLearners.ts`, written by `node tools/species/generate.mjs`
 * out of `tools/moves/frlg-machines.json` - a committed PokeAPI snapshot of
 * what FireRed/LeafGreen lets each of the 151 be taught - and
 * `machines.test.ts` reads that snapshot back and fails a catalogue that has
 * drifted from it. That is the whole point of the check the player meets: a TM
 * refused is canon refusing it, not a designer's guess. It was seventeen
 * hand-written lists until the roster became the 151.
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

/** The identifier both snapshots know a move by: its name, lowercased and hyphenated. */
const identifierOf = (move: MoveBase): string => move.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Canon's compatibility list for a move, or nothing where FireRed has no disc for it. */
const learnersOf = (move: MoveBase): readonly string[] =>
  GENERATED_MACHINE_LEARNERS[identifierOf(move)] ?? [];

const machine = (number: string, move: MoveBase, reusable = false): MachineDefinition => ({
  number,
  move,
  reusable,
  learners: learnersOf(move),
});

export const MACHINES: Readonly<Record<string, MachineDefinition>> = {
  // The narrowest disc in the game: fifteen of the 151, and among the starters
  // only the Grass line.
  'tm09-bullet-seed': machine('TM09', BULLET_SEED),
  'tm13-ice-beam': machine('TM13', ICE_BEAM),
  'tm23-iron-tail': machine('TM23', IRON_TAIL),
  'tm28-dig': machine('TM28', DIG),
  'tm40-aerial-ace': machine('TM40', AERIAL_ACE),
  // The three HMs. An HM is never used up, which is what makes it safe for one
  // to be a permanent capability rather than a consumable: the two below are
  // doors as well as moves (`world/fieldMoves.ts`), and a door opened by a disc
  // that could run out would be a door that could be lost.
  'hm01-cut': machine('HM01', CUT, true),
  'hm03-surf': machine('HM03', SURF, true),
  // The widest of the three, which is what an HM is for.
  'hm06-rock-smash': machine('HM06', ROCK_SMASH, true),
};

export type MachineId = keyof typeof MACHINES;

export const MACHINE_DEFINITIONS: readonly MachineDefinition[] = Object.values(MACHINES);

/**
 * Whether this species may be taught this move from a machine. The one question
 * a TM asks, and the tutorial's `TmItem.CanBeTaught` read off our own table.
 */
export function canLearnFromMachine(speciesId: string, move: MoveBase): boolean {
  return MACHINE_DEFINITIONS.some(
    (candidate) => candidate.move === move && candidate.learners.includes(speciesId),
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
  return MACHINE_DEFINITIONS.filter((candidate) => candidate.learners.includes(speciesId)).map(
    (candidate) => candidate.move,
  );
}
