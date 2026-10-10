import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';

/**
 * A Strength boulder, as a map maker places one: FireRed's own boulder
 * (`strengthBoulder` on the town sheet), solid as a person, and pushed one tile
 * by walking into it with a Pokemon in the party that knows Strength - which
 * HM04 teaches, and which Bill barters like the other three.
 *
 * Where a boulder stands is raid state, never map state: it is rebuilt where the
 * map put it on every raid, and where it has been pushed to this raid rides on
 * `ActiveRunSession.bouldersMoved`, because the world is rebuilt on the return
 * from every fight. It is an entity rather than a gate for the same reason - a
 * gate is a tile that is shut or open for good, and a boulder is a wall that
 * moves - so the step planner and the hunter's search meet it the way they meet
 * a person (`WorldScene.entityHolds`), and nothing about the map's collision
 * changes when one is pushed.
 *
 * Two things it may never do, both of them FireRed's own soft-lock with a
 * five-minute clock on it: come to rest anywhere a raid is for (an exit, a
 * drop-in, an item, a landmark, a door - the scene names those), or shut the
 * player off from every way out. A push that would is refused, and the boulder
 * stays where it is.
 */

/** What a boulder says when faced, before anything is done about it. */
export const BOULDER_LINES: readonly string[] = [
  "It's a big boulder. A Pokémon that knows Strength could push it.",
];

/** The tile a push in this direction would move the boulder onto. */
export function boulderDestination(boulder: GridPosition, facing: Direction): GridPosition {
  return nextTileFromDirection(boulder, facing);
}

/**
 * Whether someone standing on `from` can still walk to any of `goals` (or stand
 * beside one, which is how an exit is reached), with `blocked` saying what is in
 * the way and `through` the doorways a tile leads through into another place of
 * the same map. A plain breadth-first search over the map: it is asked once per
 * push, never per frame.
 */
export function canStillReach(
  from: GridPosition,
  goals: readonly GridPosition[],
  size: { readonly width: number; readonly height: number },
  blocked: (tile: GridPosition) => boolean,
  through: readonly { readonly source: GridPosition; readonly destination: GridPosition }[] = [],
): boolean {
  if (goals.length === 0) {
    return true;
  }
  const goal = new Set(goals.map(({ x, y }) => y * size.width + x));
  const seen = new Uint8Array(size.width * size.height);
  const queue: GridPosition[] = [from];
  seen[from.y * size.width + from.x] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const tile = queue[head];
    for (const next of [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
      ...through
        .filter(({ source }) => source.x === tile.x && source.y === tile.y)
        .map(({ destination }) => destination),
    ]) {
      if (next.x < 0 || next.y < 0 || next.x >= size.width || next.y >= size.height) {
        continue;
      }
      const key = next.y * size.width + next.x;
      if (goal.has(key)) {
        return true;
      }
      if (seen[key] || blocked(next)) {
        continue;
      }
      seen[key] = 1;
      queue.push(next);
    }
  }
  return false;
}
