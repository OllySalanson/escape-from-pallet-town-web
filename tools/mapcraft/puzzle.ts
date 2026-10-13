/**
 * A floor of Strength boulders and floor switches, solved: whether every
 * barrier on it can be opened from where a raid comes in, in how few pushes,
 * and how many ways there are to push it wrong.
 *
 * The rules are the game's own (`WorldScene.tryPushBoulder`, `switches.ts`):
 * a boulder moves one tile in the direction it is walked into, onto open floor
 * nobody stands on and nothing a raid is for; one that comes to rest on a
 * floor switch throws it and stays there for good; and a push that would wall
 * the player off from the way they came in is refused. A barrier is a wall
 * until every switch that opens it is thrown. Leaving the cave puts every
 * boulder not on a switch back where it started, so a floor pushed wrong costs
 * a walk out and back - which is what makes "the order to push them in" the
 * price rather than a raid lost.
 *
 * It is a breadth-first search over the player's reachable region and where
 * each boulder stands, which is small for a floor a raid solves in a minute;
 * `maxStates` stops it before it is not.
 */
import type { Point } from './program';

export interface BoulderFloor {
  /** Rows of `true` where nothing can stand: rock, furniture, the dark. */
  readonly solid: readonly (readonly boolean[])[];
  /** Tiles a boulder may not come to rest on: ways through, items, landings. */
  readonly keepClear: readonly Point[];
  readonly boulders: readonly Point[];
  readonly plates: readonly { readonly at: Point; readonly opens: string }[];
  readonly barriers: readonly { readonly id: string; readonly tiles: readonly Point[] }[];
  /** Where the player comes in, and must always be able to walk back to. */
  readonly start: Point;
}

export interface PuzzleAnswer {
  /** Whether every barrier can be opened. */
  readonly solved: boolean;
  /** The fewest pushes that open them all, or -1. */
  readonly pushes: number;
  /** Each push, in order: the boulder's tile and the way it went. */
  readonly solution: readonly { readonly from: Point; readonly toward: 'up' | 'down' | 'left' | 'right' }[];
  /** How many arrangements a raid can push the floor into. */
  readonly states: number;
  /** How many of those can never open every barrier: the ways to push it wrong; -1 when not counted. */
  readonly deadStates: number;
}

const STEPS = [
  ['up', 0, -1],
  ['down', 0, 1],
  ['left', -1, 0],
  ['right', 1, 0],
] as const;

export function solveBoulderFloor(
  floor: BoulderFloor,
  {
    maxStates = 400_000,
    /** Stop at the first answer rather than search every arrangement for the ways to push it wrong. */
    countDead = true,
  } = {},
): PuzzleAnswer {
  const height = floor.solid.length;
  const width = floor.solid[0]?.length ?? 0;
  const index = (x: number, y: number) => y * width + x;
  const clear = new Set(floor.keepClear.map(([x, y]) => index(x, y)));
  const plateAt = new Map(floor.plates.map((plate) => [index(...plate.at), plate]));
  const barrierTiles = floor.barriers.map((barrier) => ({
    id: barrier.id,
    tiles: new Set(barrier.tiles.map(([x, y]) => index(x, y))),
  }));
  const start = index(...floor.start);

  /** Barriers still shut, given the boulders standing. */
  const shutBarrierTiles = (boulders: readonly number[]): Set<number> => {
    const seated = new Set(boulders.filter((tile) => plateAt.has(tile)));
    const shut = new Set<number>();
    for (const barrier of barrierTiles) {
      const own = floor.plates.filter((plate) => plate.opens === barrier.id);
      if (!own.every((plate) => seated.has(index(...plate.at)))) {
        for (const tile of barrier.tiles) shut.add(tile);
      }
    }
    return shut;
  };
  const allOpen = (boulders: readonly number[]) =>
    floor.barriers.every((barrier) =>
      floor.plates
        .filter((plate) => plate.opens === barrier.id)
        .every((plate) => boulders.includes(index(...plate.at))),
    );

  /** Every tile the player can walk to, and the smallest, which names the region. */
  const region = (from: number, boulders: readonly number[], shut: Set<number>) => {
    const stood = new Set(boulders);
    const seen = new Uint8Array(width * height);
    const queue = [from];
    seen[from] = 1;
    let least = from;
    for (let head = 0; head < queue.length; head += 1) {
      const tile = queue[head];
      if (tile < least) least = tile;
      const x = tile % width;
      const y = Math.floor(tile / width);
      for (const [, dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = index(nx, ny);
        if (seen[next] || floor.solid[ny][nx] || stood.has(next) || shut.has(next)) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    return { seen, least };
  };

  type State = { player: number; boulders: number[]; key: string };
  const keyOf = (least: number, boulders: readonly number[]) => `${least}|${[...boulders].sort((a, b) => a - b).join(',')}`;
  const first = region(start, floor.boulders.map(([x, y]) => index(x, y)), shutBarrierTiles(floor.boulders.map(([x, y]) => index(x, y))));
  const initial: State = {
    player: start,
    boulders: floor.boulders.map(([x, y]) => index(x, y)),
    key: keyOf(first.least, floor.boulders.map(([x, y]) => index(x, y))),
  };
  const parent = new Map<string, { from: string; push: PuzzleAnswer['solution'][number] } | null>([[initial.key, null]]);
  const queue: State[] = [initial];
  const finals: string[] = [];
  const edges = new Map<string, string[]>();
  for (let head = 0; head < queue.length && parent.size < maxStates; head += 1) {
    const state = queue[head];
    if (allOpen(state.boulders)) {
      finals.push(state.key);
      if (!countDead) break;
    }
    const shut = shutBarrierTiles(state.boulders);
    const { seen } = region(state.player, state.boulders, shut);
    for (const [b, boulder] of state.boulders.entries()) {
      // A boulder on its switch has fallen into place.
      if (plateAt.has(boulder)) continue;
      const bx = boulder % width;
      const by = Math.floor(boulder / width);
      for (const [toward, dx, dy] of STEPS) {
        const behind = index(bx - dx, by - dy);
        const tx = bx + dx;
        const ty = by + dy;
        if (bx - dx < 0 || by - dy < 0 || bx - dx >= width || by - dy >= height || !seen[behind]) continue;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const to = index(tx, ty);
        if (floor.solid[ty][tx] || clear.has(to) || state.boulders.includes(to) || shut.has(to)) continue;
        const moved = state.boulders.map((tile, k) => (k === b ? to : tile));
        const after = shutBarrierTiles(moved);
        // The player stands where the boulder was; refused if that walls them
        // off from the way they came in.
        const { seen: reach, least } = region(boulder, moved, after);
        if (!reach[start]) continue;
        const key = keyOf(least, moved);
        (edges.get(state.key) ?? edges.set(state.key, []).get(state.key)!).push(key);
        if (parent.has(key)) continue;
        parent.set(key, { from: state.key, push: { from: [bx, by], toward } });
        queue.push({ player: boulder, boulders: moved, key });
      }
    }
  }
  // Which states can still reach an answer: walk the pushes backwards from every one that is.
  const back = new Map<string, string[]>();
  for (const [from, tos] of edges) for (const to of tos) (back.get(to) ?? back.set(to, []).get(to)!).push(from);
  const alive = new Set(finals);
  const stack = [...finals];
  while (stack.length > 0) {
    for (const from of back.get(stack.pop()!) ?? []) {
      if (!alive.has(from)) {
        alive.add(from);
        stack.push(from);
      }
    }
  }
  const best = finals[0];
  const solution: PuzzleAnswer['solution'][number][] = [];
  for (let at = best; at !== undefined; ) {
    const step = parent.get(at);
    if (!step) break;
    solution.unshift(step.push);
    at = step.from;
  }
  return {
    solved: best !== undefined,
    pushes: best === undefined ? -1 : solution.length,
    solution,
    states: parent.size,
    deadStates: countDead ? parent.size - alive.size : -1,
  };
}
