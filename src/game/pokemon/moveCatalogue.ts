import { MoveBase } from './MoveBase';
import { GENERATED_MOVES } from './generated/moveCatalogue';
import * as AUTHORED from './moves';

/**
 * The one move this game spells differently from its own dex entry. Canon calls
 * it Supersonic; it has been Super Sonic here since Unity, and renaming a move
 * the player already knows is a change to the game rather than to the import.
 */
const RENAMED: Readonly<Record<string, string>> = { 'super-sonic': 'supersonic' };

const identifierOf = (move: MoveBase): string => {
  const slug = move.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return RENAMED[slug] ?? slug;
};

/**
 * The moves `moves.ts` writes out by hand, by the identifier canon knows them
 * by. Derived from the module rather than listed here, so a move authored
 * tomorrow overrides the generated one without a second list to remember.
 */
export const AUTHORED_MOVES: Readonly<Record<string, MoveBase>> = Object.freeze(
  Object.fromEntries(
    Object.values(AUTHORED)
      .filter((value): value is MoveBase => value instanceof MoveBase)
      .map((move) => [identifierOf(move), move]),
  ),
);

/**
 * Every move the game can hand to a Pokemon, by identifier.
 *
 * Two halves. `generated/moveCatalogue.ts` is the import: the 187 level-up
 * moves of the 151 that `MoveBase` can express, each on generation III's own
 * numbers. `moves.ts` is what this game wrote by hand - the machines' six, and
 * the early moves whose wording, power or effect was authored and measured -
 * and it wins wherever the two hold the same move, which is what keeps Tackle
 * at the 40 power every early fight in the game was balanced against rather
 * than FireRed's 35.
 *
 * `speciesImport.test.ts` prints that disagreement as a list, so an authored
 * move that drifts from canon is a row someone chose rather than a number
 * nobody noticed.
 */
export const MOVE_CATALOGUE: Readonly<Record<string, MoveBase>> = Object.freeze({
  ...GENERATED_MOVES,
  ...AUTHORED_MOVES,
});

/** The move that identifier names, or undefined where the engine has no way to play it. */
export const moveByIdentifier = (identifier: string): MoveBase | undefined =>
  MOVE_CATALOGUE[identifier];
