import type { MoveBase } from '../pokemon/MoveBase';
import type { Pokemon } from '../pokemon';
import { CUT, SURF } from '../pokemon/moves';

/**
 * A move that is also a route.
 *
 * The tutorial has three of these and this game now has two of them: a
 * `CuttableTree` that goes away when something in the party knows Cut, and
 * `SurfableWater` that carries you when something knows Surf. Both are the same
 * sentence - *a door in the map, opened by what your Pokemon knows rather than
 * by a fight you won* - and that is a boss gate with a different key, so they
 * are authored as `MapGate`s in `gates.ts` and nothing here knows what a tile
 * is. See that file's header for why this extended the gate rather than
 * growing a second kind of door beside it.
 *
 * This module is only the *key*: which move opens which kind of door, who in a
 * party is holding it, and the three things the map says about it - what is in
 * the way, what happens when it goes, and what the caption reads while it is
 * still there. It is Phaser-free, so all of that is testable without a screen.
 *
 * **What a field move is not.** It is not a capability checked at the door
 * every raid: once a door is opened it is written to `raidProgress.openedGates`
 * and stays open for every later raid, exactly as a beaten boss's gate does.
 * The move is the key, and a key is spent on a lock once. That is the loop this
 * game already has - push further, come home, watch the dark retreat on the
 * drop-in map - and a door that shut again behind a player who deployed without
 * the right Pokemon would be a map that disagreed with their own survey.
 */
export const FIELD_MOVE_IDS = ['cut', 'surf'] as const;
export type FieldMoveId = (typeof FIELD_MOVE_IDS)[number];

export interface FieldMove {
  readonly id: FieldMoveId;
  /** The move itself, so nothing anywhere matches on a move's name. */
  readonly move: MoveBase;
  /** What the player calls it, in the capitals every caption uses. */
  readonly label: string;
  /** The caption's second line while the door is shut: the whole instruction. */
  readonly doorNote: string;
  /** What is in the way, said before anybody is asked to do anything about it. */
  readonly obstacle: string;
  /** Said when nothing in the party can do it. */
  readonly refusal: string;
  /** Said by whoever does, naming them. */
  readonly worked: (pokemonName: string) => string;
}

export const FIELD_MOVES: Readonly<Record<FieldMoveId, FieldMove>> = {
  cut: {
    id: 'cut',
    move: CUT,
    label: 'CUT',
    doorNote: 'NEEDS CUT',
    obstacle: 'Growth has closed the ride. Thick, old and shoulder high.',
    refusal: 'Nothing in the party can cut it. Something that reads HM01 could.',
    worked: (name) => `${name} cut the growth away.`,
  },
  surf: {
    id: 'surf',
    move: SURF,
    label: 'SURF',
    doorNote: 'NEEDS SURF',
    obstacle: 'The water is deep here, and moving.',
    refusal: 'Nothing in the party can carry you over it. Something that reads HM03 could.',
    worked: (name) => `${name} carried you across.`,
  },
};

export const FIELD_MOVE_LIST: readonly FieldMove[] = Object.values(FIELD_MOVES);

/** What this species is being asked for, by the id a gate names. */
export function fieldMove(id: FieldMoveId): FieldMove {
  return FIELD_MOVES[id];
}

/**
 * The first Pokemon in the party that knows this move, or nothing.
 *
 * The *first*, not the best: a field move is not a fight, so there is nothing
 * to choose between two Pokemon that both know it, and asking would be a menu
 * in front of a door. A fainted Pokemon still counts - opening a door is not
 * something it has to be standing up for, and refusing on that would make a
 * door that shuts when a raid goes badly.
 */
export function fieldMoveUser(
  party: readonly Pokemon[],
  id: FieldMoveId,
): Pokemon | undefined {
  const { move } = FIELD_MOVES[id];
  return party.find((pokemon) => pokemon.moves.some((known) => known.base === move));
}

/** Whether anything deployed can open a door of this kind. */
export function partyHasFieldMove(party: readonly Pokemon[], id: FieldMoveId): boolean {
  return fieldMoveUser(party, id) !== undefined;
}

/**
 * What the world says when the player presses the interact key at a field-move
 * door. Two lines either way, because a refusal has to name the move as well as
 * the obstacle: a player who has never seen an HM cannot be expected to guess
 * that a wall of growth is a door.
 */
export function fieldMoveLines(
  id: FieldMoveId,
  user: Pokemon | undefined,
): readonly string[] {
  const authored = FIELD_MOVES[id];
  if (!user) {
    return [authored.obstacle, authored.refusal];
  }
  return [authored.obstacle, authored.worked(user.base.name.toUpperCase())];
}

/**
 * The line said once, on the step that opened a door for good. It is the same
 * promise `gatesOpenedLines` makes for a boss's gate, because it is the same
 * door: what changes is only who turned the key.
 */
export function fieldMoveOpenedLine(label: string): string {
  return `${label} is open - and stays open on every raid from now on.`;
}
