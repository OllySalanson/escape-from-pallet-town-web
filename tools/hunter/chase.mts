/**
 * What a chase is like, measured on the real map rather than argued.
 *
 *   npx vite-node tools/hunter/chase.mts [-- --map=greystone-vale --chases=300 --pause=0 --grass=0.1 --seed=1]
 *
 * Plays chases with `world/hunterPack.ts`'s own pack on a map's real
 * collision: a player starts somewhere a hunter has just seen them, the "!"
 * beat runs, and they walk the shortest way to a place 40-90 steps off at
 * walking pace, never stopping unless `--pause=` (ms) is given, which stops
 * them for that long every 25 steps - a box read, a crate searched, a bump.
 * Every step into tall grass rolls a wild fight at `--grass=` and, if it
 * fires, hands the pack the fight (`afterFight`). It prints how often the
 * hunter catches them, how often it gives up and why, how long the chase ran,
 * how many snags gave the player a tile, and the smallest gap.
 *
 * Run it on both sides of a change to the pack's numbers and diff the output;
 * the table in the deep dive is its summary.
 */
import { getWorldMap } from '../../src/game/worldMap';
import { huntingGroundsOn } from '../../src/game/world/mapHuntingGrounds';
import {
  HunterPack,
  createHunterPack,
  inGround,
  isTouching,
  type PackWorld,
} from '../../src/game/world/hunterPack';
import { HUNTER_ALERT_MS } from '../../src/game/world/hunterPack';
import { STEP_DURATION_MS } from '../../src/game/movement/stepClock';
import { linkKey, type GridPosition } from '../../src/game/movement/gridMovement';
import type { WorldMapId } from '../../src/game/worldMap';

const arg = (name: string, fallback: string): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const MAP = arg('map', 'greystone-vale') as WorldMapId;
const CHASES = Number(arg('chases', '300'));
const PAUSE_MS = Number(arg('pause', '0'));
const GRASS = Number(arg('grass', '0.1'));
let seed = Number(arg('seed', '1'));
const random = (): number => {
  seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const map = getWorldMap(MAP);
const { width, height } = map;
const outdoors = map.areas?.find((area) => area.kind === 'outdoors')?.rect ?? { x: 0, y: 0, width, height };
const grounds = huntingGroundsOn(map);
console.log(`${MAP}: ${grounds.length} patches`);
for (const ground of grounds) {
  console.log(`  ${ground.name.padEnd(20)} post ${ground.post.x},${ground.post.y}  loop of ${ground.route.length}`);
}

const SEE_THROUGH = new Set(['water', 'ford', 'fence', 'ice']);
const blocked = (index: number): boolean => map.collision[(index / width) | 0][index % width];
const opaque = (index: number): boolean =>
  blocked(index) && !SEE_THROUGH.has(map.terrain[(index / width) | 0]?.[index % width] as string);
const outside = (tile: GridPosition): boolean =>
  tile.x < outdoors.x || tile.y < outdoors.y || tile.x >= outdoors.x + outdoors.width || tile.y >= outdoors.y + outdoors.height;

/** Steps from a tile to everywhere, the player's own walk. */
function walkFrom(start: GridPosition, limit: number): Int32Array {
  const distance = new Int32Array(width * height).fill(-1);
  const queue = [start.y * width + start.x];
  distance[queue[0]] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    if (distance[here] >= limit) {
      continue;
    }
    const x = here % width;
    const y = (here / width) | 0;
    const steps = [
      y > 0 ? here - width : -1,
      y < height - 1 ? here + width : -1,
      x > 0 ? here - 1 : -1,
      x < width - 1 ? here + 1 : -1,
    ].map((next, direction) => map.links?.get(linkKey(here, direction)) ?? next);
    for (const next of steps) {
      if (next < 0 || distance[next] !== -1 || blocked(next)) {
        continue;
      }
      distance[next] = distance[here] + 1;
      queue.push(next);
    }
  }
  return distance;
}

const tileOf = (index: number): GridPosition => ({ x: index % width, y: (index / width) | 0 });

interface Result {
  readonly caught: boolean;
  readonly gaveUp: boolean;
  readonly arrived: boolean;
  readonly ms: number;
  readonly snags: number;
  readonly fights: number;
  readonly minGap: number;
  readonly leftPatch: boolean;
}

function chase(): Result | null {
  const ground = grounds[Math.floor(random() * grounds.length)];
  const rect = ground.rects[0];
  const start = { x: rect.x + Math.floor(random() * rect.width), y: rect.y + Math.floor(random() * rect.height) };
  if (blocked(start.y * width + start.x) || outside(start)) {
    return null;
  }
  const around = walkFrom(start, 90);
  const ring = [...around.keys()].filter((index) => around[index] === 5);
  const far = [...around.keys()].filter((index) => around[index] >= 40 && around[index] <= 90 && !outside(tileOf(index)));
  if (ring.length === 0 || far.length === 0) {
    return null;
  }
  const hunterTile = tileOf(ring[Math.floor(random() * ring.length)]);
  // Somewhere away from the hunter: a player runs from it, not past it.
  const fromHunter = walkFrom(hunterTile, 100);
  const away = far.filter((index) => fromHunter[index] === -1 || fromHunter[index] >= around[index] + 4);
  if (away.length === 0) {
    return null;
  }
  const goal = tileOf(away[Math.floor(random() * away.length)]);
  // The player's way there, walked backwards from the goal.
  const toGoal = walkFrom(goal, 200);
  const hunters = createHunterPack([ground], ['blue']);
  const pack = new HunterPack(hunters);
  const hunter = hunters[0];
  Object.assign(hunter, {
    mode: 'alerted',
    position: hunterTile,
    timerMs: HUNTER_ALERT_MS,
    lastSeen: start,
    facing: 'down',
  });

  let player = { ...start };
  let next: GridPosition | null = null;
  let stepMs = 0;
  let pausedMs = 0;
  let steps = 0;
  let ms = 0;
  let snags = 0;
  let fights = 0;
  let minGap = 99;
  let leftPatch = false;
  const world = (): PackWorld => ({
    width,
    height,
    links: map.links,
    blocked,
    opaque,
    player,
    heading: next ?? player,
    playerMoving: next !== null,
    playerInGrass: map.tallGrass[player.y]?.[player.x] === true,
    playerHidden: false,
    samePlace: (a, b) => outside(a) === outside(b),
    enraged: false,
  });
  const frame = 16;
  while (ms < 60_000) {
    ms += frame;
    // The player.
    let budget = frame;
    while (budget > 0) {
      if (pausedMs > 0) {
        const spent = Math.min(pausedMs, budget);
        pausedMs -= spent;
        budget -= spent;
        continue;
      }
      if (!next) {
        if (player.x === goal.x && player.y === goal.y) {
          return { caught: false, gaveUp: false, arrived: true, ms, snags, fights, minGap, leftPatch };
        }
        const here = player.y * width + player.x;
        const options = [here - width, here + width, here - 1, here + 1]
          .map((index, direction) => map.links?.get(linkKey(here, direction)) ?? index)
          .filter((index) => index >= 0 && toGoal[index] === toGoal[here] - 1 && !pack.hunterAt(tileOf(index)));
        if (options.length === 0) {
          budget = 0;
          continue;
        }
        next = tileOf(options[0]);
        stepMs = 0;
      }
      const need = STEP_DURATION_MS - stepMs;
      if (budget < need) {
        stepMs += budget;
        budget = 0;
        continue;
      }
      budget -= need;
      player = next;
      next = null;
      steps += 1;
      if (!inGround(ground, player)) {
        leftPatch = true;
      }
      // Arriving: the catch first, then the grass.
      const catcher = hunters.find((h) => (h.mode === 'chase') && isTouching(h.position, player));
      if (catcher) {
        return { caught: true, gaveUp: false, arrived: false, ms, snags, fights, minGap, leftPatch };
      }
      if (map.tallGrass[player.y]?.[player.x] && random() < GRASS) {
        fights += 1;
        pack.afterFight(world());
      }
      if (PAUSE_MS > 0 && steps % 25 === 0) {
        pausedMs = PAUSE_MS;
      }
    }
    const events = pack.advance(world(), frame);
    for (const event of events) {
      if (event.kind === 'caught') {
        return { caught: true, gaveUp: false, arrived: false, ms, snags, fights, minGap, leftPatch };
      }
      if (event.kind === 'snagged') {
        snags += 1;
      }
      if (event.kind === 'gave-up') {
        return { caught: false, gaveUp: true, arrived: false, ms, snags, fights, minGap, leftPatch };
      }
    }
    if (hunter.gap !== null) {
      minGap = Math.min(minGap, hunter.gap);
    }
  }
  return { caught: false, gaveUp: false, arrived: false, ms, snags, fights, minGap, leftPatch };
}

const results: Result[] = [];
while (results.length < CHASES) {
  const result = chase();
  if (result) {
    results.push(result);
  }
}
const share = (count: number): string => `${Math.round((100 * count) / results.length)}%`;
const mean = (values: readonly number[]): string =>
  values.length === 0 ? '-' : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
const caught = results.filter((r) => r.caught);
const gaveUp = results.filter((r) => r.gaveUp);
const arrived = results.filter((r) => r.arrived);
console.log(`\n${results.length} chases, pause ${PAUSE_MS} ms every 25 steps, grass fights ${GRASS}`);
console.log(`  caught     ${share(caught.length)}  after ${mean(caught.map((r) => r.ms / 1000))} s`);
console.log(`  shook it   ${share(gaveUp.length)}  after ${mean(gaveUp.map((r) => r.ms / 1000))} s, ${share(gaveUp.filter((r) => r.leftPatch).length)} of all by leaving its patch`);
console.log(`  got there  ${share(arrived.length)}  (still chased when they arrived: never shook it, never caught)`);
console.log(`  snags a chase ${mean(results.map((r) => r.snags))}, fights a chase ${mean(results.map((r) => r.fights))}`);
console.log(`  closest gap (steps) ${mean(results.filter((r) => r.minGap < 99).map((r) => r.minGap))}`);
