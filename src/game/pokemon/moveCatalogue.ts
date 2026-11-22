import { MoveBase } from './MoveBase';
import { GENERATED_MOVES } from './generated/moveCatalogue';
import * as AUTHORED from './moves';

/**
 * Move names a save may still hold from before the game spelt the move as
 * canon does, and the name it has now. Unity called Supersonic "Super Sonic",
 * and this game kept that until a playtest read it off the battle log (20 Nov
 * 2026); a stored name is resolved through `knowableMoves`, which reads this,
 * so a Pokemon saved knowing the old spelling still knows the move.
 */
export const LEGACY_MOVE_NAMES: Readonly<Record<string, string>> = { 'Super Sonic': 'Supersonic' };

const GENERATED: ReadonlySet<MoveBase> = new Set(Object.values(GENERATED_MOVES));

const identifierOf = (move: MoveBase): string => move.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * The moves `moves.ts` writes out by hand, by the identifier canon knows them
 * by. Derived from the module rather than listed here, so a move authored
 * tomorrow overrides the generated one without a second list to remember.
 */
export const AUTHORED_MOVES: Readonly<Record<string, MoveBase>> = Object.freeze(
  Object.fromEntries(
    Object.values(AUTHORED)
      // Struggle is the engine's, not a move anybody can be handed or taught,
      // and a move `moves.ts` only names (Tackle, Vine Whip) is the import's
      // own row rather than anything written there.
      .filter(
        (value): value is MoveBase =>
          value instanceof MoveBase && value !== AUTHORED.STRUGGLE && !GENERATED.has(value),
      )
      .map((move) => [identifierOf(move), move]),
  ),
);

/**
 * Every move the game can hand to a Pokemon, by identifier.
 *
 * Two halves. `generated/moveCatalogue.ts` is the import: the 188 level-up
 * moves of the 151 that `MoveBase` can express, each on generation III's own
 * numbers. `moves.ts` is what this game wrote by hand - the machines' six, and
 * the early moves whose wording or effect was authored - and it wins wherever
 * the two hold the same move.
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
