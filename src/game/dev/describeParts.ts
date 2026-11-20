import { getItemById } from '../items/items';
import type { BagContents } from '../items/Bag';
import type { GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon';

/**
 * The pieces of a scene's `describeForTest()` that more than one scene says
 * the same way: a team, a bag, a tile. Plain JSON out, game objects in.
 */

export interface TeamMember {
  readonly name: string;
  readonly species: string;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly status: string | null;
  readonly moves: readonly string[];
}

export function describeTeam(pokemon: readonly Pokemon[]): TeamMember[] {
  return pokemon.map((each) => ({
    name: each.name,
    species: each.base.name,
    level: each.level,
    hp: each.currentHp,
    maxHp: each.maxHp,
    status: each.isFainted ? 'fainted' : (each.primaryStatus ?? null),
    moves: each.moves.map((move) => move.base.name),
  }));
}

/** What a bag holds, by the name a player reads, biggest stacks first. */
export function describeBag(contents: BagContents): Record<string, number> {
  return Object.fromEntries(
    Object.entries(contents)
      .filter(([, quantity]) => quantity > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([itemId, quantity]) => [getItemById(itemId)?.displayName ?? itemId, quantity]),
  );
}

export const tileOf = (position: GridPosition): { x: number; y: number } => ({ x: position.x, y: position.y });

/** The tiles a camera's view covers, given the size of a tile. */
export function viewTiles(
  view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  tileSize: number,
): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } {
  return {
    left: Math.floor(view.x / tileSize),
    top: Math.floor(view.y / tileSize),
    right: Math.ceil((view.x + view.width) / tileSize) - 1,
    bottom: Math.ceil((view.y + view.height) / tileSize) - 1,
  };
}

export const inView = (
  tile: GridPosition,
  view: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
): boolean => tile.x >= view.left && tile.x <= view.right && tile.y >= view.top && tile.y <= view.bottom;
