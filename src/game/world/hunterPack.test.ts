import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { getWorldMap } from '../worldMap';
import { insertionsOn } from '../run/runGeneration';
import { districtsForMap } from './districts';
import { extractionPointsOn } from './extractionPoints';
import {
  HUNTER_ALERT_MS,
  HUNTER_ARRIVAL_CLEARANCE,
  HUNTER_CHASE_STEP_MS,
  HUNTER_COME_FOR_MS,
  HUNTER_ENRAGED_STEP_MS,
  HUNTER_FIGHT_CATCH_UP_STEPS,
  HUNTER_GRASS_SIGHT_STEPS,
  HUNTER_SIGHT_STEPS,
  HUNTER_TAIL_STEPS,
  HunterPack,
  canSee,
  createHunterPack,
  huntingGrounds,
  inGround,
  isTouching,
  rivalsForGrounds,
  type HunterGround,
  type PackEvent,
  type PackHunter,
  type PackWorld,
} from './hunterPack';

/**
 * A grid drawn as text: `#` solid and opaque, `~` solid and see-through
 * (water), `,` tall grass, anything else open.
 */
function grid(rows: readonly string[]) {
  const height = rows.length;
  const width = rows[0].length;
  const at = (index: number): string => rows[(index / width) | 0][index % width];
  return {
    width,
    height,
    blocked: (index: number) => at(index) === '#' || at(index) === '~',
    opaque: (index: number) => at(index) === '#',
    grass: (tile: GridPosition) => rows[tile.y]?.[tile.x] === ',',
  };
}

type Grid = ReturnType<typeof grid>;

function worldOf(map: Grid, player: GridPosition, extra: Partial<PackWorld> = {}): PackWorld {
  return {
    width: map.width,
    height: map.height,
    blocked: map.blocked,
    opaque: map.opaque,
    player,
    heading: player,
    playerMoving: false,
    playerInGrass: map.grass(player),
    playerHidden: false,
    samePlace: () => true,
    enraged: false,
    ...extra,
  };
}

function groundOf(rect: { x: number; y: number; width: number; height: number }, post: GridPosition): HunterGround {
  return { id: 'patch', name: 'THE PATCH', rects: [rect], post, route: [post] };
}

function hunterIn(ground: HunterGround, changes: Partial<PackHunter>): { pack: HunterPack; hunter: PackHunter } {
  const hunters = createHunterPack([ground], ['blue']);
  Object.assign(hunters[0], changes);
  return { pack: new HunterPack(hunters), hunter: hunters[0] };
}

/**
 * A player walking a list of tiles at walking pace, the pack advanced every
 * 16 ms frame alongside, with `stopMs` stood still before the walk. Answers
 * the events and where the walk got to.
 */
function play(
  map: Grid,
  pack: HunterPack,
  walk: readonly GridPosition[],
  options: { readonly stopMs?: number; readonly world?: Partial<PackWorld> } = {},
): { readonly events: PackEvent[]; readonly at: GridPosition; readonly caught: boolean } {
  const events: PackEvent[] = [];
  let player = walk[0];
  let index = 0;
  let stepMs = 0;
  let stopMs = options.stopMs ?? 0;
  for (let frame = 0; frame < 2_000; frame += 1) {
    const next = index + 1 < walk.length && stopMs <= 0 ? walk[index + 1] : null;
    if (stopMs > 0) {
      stopMs -= 16;
    } else if (next) {
      stepMs += 16;
      if (stepMs >= STEP_DURATION_MS) {
        stepMs -= STEP_DURATION_MS;
        index += 1;
        player = walk[index];
      }
    }
    const heading = index + 1 < walk.length && stopMs <= 0 ? walk[index + 1] : player;
    const world = worldOf(map, player, {
      heading,
      playerMoving: heading !== player,
      ...options.world,
    });
    events.push(...pack.advance(world, 16));
    if (pack.catcher(player) && !world.playerMoving) {
      return { events, at: player, caught: true };
    }
    // Got there: what happens to a player who then stands still is another test.
    if (index === walk.length - 1 && stopMs <= 0 && walk.length > 1) {
      break;
    }
  }
  return { events, at: player, caught: false };
}

const line = (y: number, from: number, to: number): GridPosition[] =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, step) => ({ x: from + Math.sign(to - from) * step, y }));

const OPEN = grid([
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
]);

describe('where the hunters are', () => {
  it('keeps one to each of Greystone Vale\'s nineteen districts, home off every landing and way out', () => {
    const map = getWorldMap('greystone-vale');
    const keepClear = [
      ...insertionsOn('greystone-vale').map((insertion) => insertion.position),
      ...extractionPointsOn('greystone-vale').map((point) => point.position),
    ];
    const grounds = huntingGrounds({
      width: map.width,
      height: map.height,
      collision: map.collision,
      links: map.links,
      outdoors: map.areas?.find((area) => area.kind === 'outdoors')?.rect ?? { x: 0, y: 0, width: map.width, height: map.height },
      districts: districtsForMap('greystone-vale'),
      keepClear,
    });
    expect(grounds).toHaveLength(19);
    for (const ground of grounds) {
      for (const tile of ground.route) {
        expect(map.collision[tile.y][tile.x], `${ground.name} stands on solid ground`).toBe(false);
        expect(inGround(ground, tile)).toBe(true);
        for (const clear of keepClear) {
          expect(Math.abs(clear.x - tile.x) + Math.abs(clear.y - tile.y), `${ground.name} stands on a landing`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('gives the raid\'s own rival the district it lands in, and never one face to two districts side by side', () => {
    const at = (cx: number, cy: number): HunterGround =>
      groundOf({ x: cx * 64, y: cy * 64, width: 64, height: 64 }, { x: cx * 64 + 32, y: cy * 64 + 32 });
    const grounds = [0, 1, 2].flatMap((cy) => [0, 1, 2].map((cx) => at(cx, cy)));
    const rivals = rivalsForGrounds(grounds, 'koga', { x: 64 + 10, y: 64 + 10 });
    expect(rivals[4]).toBe('koga');
    grounds.forEach((ground, index) => {
      grounds.forEach((other, otherIndex) => {
        const touching =
          Math.abs(ground.post.x - other.post.x) <= 64 && Math.abs(ground.post.y - other.post.y) <= 64 && index !== otherIndex;
        if (touching) {
          expect(rivals[index]).not.toBe(rivals[otherIndex]);
        }
      });
    });
  });

  it('comes out of hiding never in sight of the player', () => {
    const ground = groundOf({ x: 0, y: 0, width: 40, height: 5 }, { x: 4, y: 2 });
    const pack = new HunterPack(createHunterPack([{ ...ground, route: [{ x: 4, y: 2 }, { x: 36, y: 2 }] }], ['blue']));
    expect(pack.arrive(worldOf(OPEN, { x: 6, y: 2 }))).toBe(true);
    const hunter = pack.hunters[0];
    expect(hunter.position).toEqual({ x: 36, y: 2 });
    expect(Math.hypot(hunter.position.x - 6, 0)).toBeGreaterThanOrEqual(HUNTER_ARRIVAL_CLEARANCE);
    // And with nowhere far enough, it waits.
    const cramped = new HunterPack(createHunterPack([ground], ['blue']));
    expect(cramped.arrive(worldOf(OPEN, { x: 6, y: 2 }))).toBe(false);
    expect(cramped.hunters[0].mode).toBe('waiting');
  });
});

describe('what makes one chase you', () => {
  const map = grid([
    '..........',
    '....#.....',
    '..........',
    '..........',
    '..........',
  ]);
  const world = (player: GridPosition, extra: Partial<PackWorld> = {}) => worldOf(map, player, extra);

  it('sees ahead in a quarter-turn cone, hears all round close by, and never through a wall', () => {
    const from = { x: 4, y: 4 };
    expect(canSee(from, 'up', { x: 4, y: 2 }, world({ x: 4, y: 2 }), false)).toBe(true);
    expect(canSee(from, 'up', { x: 1, y: 2 }, world({ x: 1, y: 2 }), false)).toBe(false);
    expect(canSee(from, 'up', { x: 4, y: 0 }, world({ x: 4, y: 0 }), false)).toBe(false);
    expect(canSee(from, 'down', { x: 4, y: 2 }, world({ x: 4, y: 2 }), false)).toBe(true);
    expect(canSee(from, 'left', { x: 8, y: 4 }, world({ x: 8, y: 4 }), false)).toBe(false);
    expect(canSee(from, 'left', { x: 8, y: 4 }, world({ x: 8, y: 4 }), true)).toBe(true);
    expect(canSee({ x: 0, y: 0 }, 'right', { x: HUNTER_SIGHT_STEPS + 1, y: 0 }, world({ x: 8, y: 0 }), false)).toBe(false);
  });

  it('loses you in tall grass past arm\'s length', () => {
    const grassy = grid(['..,,,,,,,,', '..........']);
    const at = { x: 6, y: 0 };
    expect(canSee({ x: 1, y: 0 }, 'right', at, worldOf(grassy, at), true)).toBe(false);
    const near = { x: 1 + HUNTER_GRASS_SIGHT_STEPS, y: 0 };
    expect(canSee({ x: 1, y: 0 }, 'right', near, worldOf(grassy, near), true)).toBe(true);
  });

  it('says "!" and stands a beat before it runs', () => {
    const ground = groundOf({ x: 0, y: 0, width: 40, height: 5 }, { x: 10, y: 2 });
    const { pack, hunter } = hunterIn(ground, { mode: 'patrol', position: { x: 10, y: 2 }, facing: 'right' });
    const events = pack.advance(worldOf(OPEN, { x: 15, y: 2 }), 16);
    expect(events.map((event) => event.kind)).toEqual(['noticed']);
    expect(hunter.mode).toBe('alerted');
    pack.advance(worldOf(OPEN, { x: 15, y: 2 }), HUNTER_ALERT_MS - 32);
    expect(hunter.position).toEqual({ x: 10, y: 2 });
    pack.advance(worldOf(OPEN, { x: 15, y: 2 }), 48);
    expect(hunter.mode).toBe('chase');
  });
});

describe('a chase', () => {
  const ground = groundOf({ x: 0, y: 0, width: 40, height: 5 }, { x: 0, y: 2 });

  it('never gains on a player who keeps walking: it runs exactly as fast', () => {
    const { pack, hunter } = hunterIn(ground, { mode: 'chase', position: { x: 2, y: 2 }, lastSeen: { x: 6, y: 2 } });
    const result = play(OPEN, pack, line(2, 6, 36));
    expect(result.caught).toBe(false);
    expect(result.at).toEqual({ x: 36, y: 2 });
    expect(hunter.position.x).toBeLessThanOrEqual(33);
  });

  it('catches a player who stops', () => {
    const { pack } = hunterIn(ground, { mode: 'chase', position: { x: 2, y: 2 }, lastSeen: { x: 6, y: 2 } });
    expect(play(OPEN, pack, line(2, 6, 6), { stopMs: 2_000 }).caught).toBe(true);
  });

  it('snags running flat out into a wall, for one tile, and only once in a while', () => {
    // A lane east that turns north at a wall: the hunter has to turn where it hits it.
    const lane = grid([
      '############.##',
      '############.##',
      '############.##',
      '############.##',
      '############.##',
      '.............##',
      '###############',
    ]);
    const patch = groundOf({ x: 0, y: 0, width: 15, height: 7 }, { x: 0, y: 5 });
    const walk = [...line(5, 4, 12), ...[4, 3, 2, 1, 0].map((y) => ({ x: 12, y }))];
    const { pack } = hunterIn(patch, { mode: 'chase', position: { x: 0, y: 5 }, facing: 'right', lastSeen: walk[0] });
    const snagged = play(lane, pack, walk).events.filter((event) => event.kind === 'snagged');
    expect(snagged).toHaveLength(1);
  });

  it('follows you out of its patch only while it is right on your tail', () => {
    const patch = groundOf({ x: 0, y: 0, width: 20, height: 5 }, { x: 0, y: 2 });
    const far = hunterIn(patch, { mode: 'chase', position: { x: 10, y: 2 }, lastSeen: { x: 17, y: 2 } });
    const away = play(OPEN, far.pack, line(2, 17, 30));
    expect(away.events.some((event) => event.kind === 'gave-up')).toBe(true);
    // Home already: it stopped at the edge of its patch.
    expect(['return', 'patrol']).toContain(far.hunter.mode);
    expect(inGround(patch, far.hunter.position)).toBe(true);

    const close = hunterIn(patch, { mode: 'chase', position: { x: 15, y: 2 }, lastSeen: { x: 18, y: 2 } });
    expect(18 - 15 - 1).toBeLessThanOrEqual(HUNTER_TAIL_STEPS);
    const tailed = play(OPEN, close.pack, line(2, 18, 30));
    expect(tailed.events.some((event) => event.kind === 'gave-up')).toBe(false);
    expect(close.hunter.position.x).toBeGreaterThan(20);
  });

  it('loses you out of sight: it runs to where it last saw you, looks about, and walks home', () => {
    const { pack, hunter } = hunterIn(ground, { mode: 'chase', position: { x: 4, y: 2 }, lastSeen: { x: 12, y: 2 } });
    // Gone under a roof: nothing to see, so it goes on what it last saw.
    const hidden = worldOf(OPEN, { x: 30, y: 2 }, { playerHidden: true });
    const events: PackEvent[] = [];
    for (let frame = 0; frame < 400; frame += 1) {
      events.push(...pack.advance(hidden, 16));
    }
    const kinds = events.map((event) => event.kind);
    expect(kinds).toContain('gave-up');
    expect(kinds).not.toContain('caught');
    // It got to where it lost you before it gave up, and it is going home now.
    expect(['return', 'patrol']).toContain(hunter.mode);
    expect(hunter.lastSeen).toBeNull();
  });

  it('keeps track of you round one corner', () => {
    const corner = grid([
      '..........#',
      '..........#',
      '#########..',
      '#########..',
    ]);
    const patch = groundOf({ x: 0, y: 0, width: 11, height: 4 }, { x: 0, y: 0 });
    const { pack, hunter } = hunterIn(patch, { mode: 'chase', position: { x: 4, y: 0 }, lastSeen: { x: 8, y: 0 } });
    const result = play(corner, pack, [...line(0, 8, 9), ...[1, 2, 3].map((y) => ({ x: 9, y }))]);
    expect(result.events.some((event) => event.kind === 'gave-up')).toBe(false);
    expect(hunter.mode).toBe('chase');
  });
});

describe('a fight it is not in', () => {
  const ground = groundOf({ x: 0, y: 0, width: 40, height: 5 }, { x: 0, y: 2 });

  it('costs the player ground but always leaves them a step', () => {
    for (const start of [3, 5, 8, 12]) {
      const { pack, hunter } = hunterIn(ground, { mode: 'chase', position: { x: 20 - start, y: 2 }, lastSeen: { x: 20, y: 2 } });
      pack.afterFight(worldOf(OPEN, { x: 20, y: 2 }));
      const gap = 20 - hunter.position.x;
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeGreaterThanOrEqual(start - HUNTER_FIGHT_CATCH_UP_STEPS);
      expect(isTouching(hunter.position, { x: 20, y: 2 })).toBe(false);
      expect(hunter.lastSeen).toEqual({ x: 20, y: 2 });
    }
  });

  it('leaves a patrolling hunter where it was', () => {
    const { pack, hunter } = hunterIn(ground, { mode: 'patrol', position: { x: 2, y: 2 } });
    pack.afterFight(worldOf(OPEN, { x: 20, y: 2 }));
    expect(hunter.position).toEqual({ x: 2, y: 2 });
    expect(hunter.mode).toBe('patrol');
  });
});

describe('fled from, beaten and the enrage', () => {
  const ground = groundOf({ x: 0, y: 0, width: 40, height: 5 }, { x: 0, y: 2 });

  it('is blind and stands still for the search window, then walks home', () => {
    const { pack, hunter } = hunterIn(ground, { mode: 'chase', position: { x: 10, y: 2 } });
    pack.fledFrom(hunter, { x: 4, y: 2 }, 20_000);
    expect(pack.advance(worldOf(OPEN, { x: 6, y: 2 }), 19_000)).toEqual([]);
    expect(hunter.position).toEqual({ x: 4, y: 2 });
    expect(pack.hunterAt({ x: 4, y: 2 })).toBe(hunter);
    pack.advance(worldOf(OPEN, { x: 30, y: 2 }), 1_100);
    expect(hunter.mode).not.toBe('stunned');
  });

  it('is gone once beaten', () => {
    const { pack, hunter } = hunterIn(ground, { mode: 'chase', position: { x: 10, y: 2 } });
    pack.beaten(hunter);
    expect(pack.hunterAt({ x: 10, y: 2 })).toBeUndefined();
    expect(pack.advance(worldOf(OPEN, { x: 11, y: 2 }), 1_000)).toEqual([]);
  });

  it('turns on you at the enrage at twice your pace, and nowhere is out of its patch', () => {
    const small = groundOf({ x: 0, y: 0, width: 5, height: 5 }, { x: 0, y: 2 });
    const { pack, hunter } = hunterIn(small, { mode: 'patrol', position: { x: 2, y: 2 }, facing: 'left' });
    const world = worldOf(OPEN, { x: 30, y: 2 }, { enraged: true });
    pack.enrage(world);
    expect(hunter.mode).toBe('chase');
    for (let frame = 0; frame < (10 * HUNTER_ENRAGED_STEP_MS) / 15; frame += 1) {
      pack.advance(world, 15);
    }
    expect(hunter.position.x).toBe(12);
    expect(HUNTER_ENRAGED_STEP_MS).toBe(HUNTER_CHASE_STEP_MS / 2);
  });
});

describe('a hunter that comes for you', () => {
  const open = grid(Array.from({ length: 41 }, () => '.'.repeat(61)));
  const wholeMap = { x: 0, y: 0, width: 61, height: 41 };
  const middle = { x: 30, y: 20 };

  it('comes from out of sight, on the far side of you from the way out, and says so', () => {
    const { pack, hunter } = hunterIn(groundOf(wholeMap, { x: 2, y: 2 }), { mode: 'patrol' });
    const away = { x: 60, y: 20 };
    const events = pack.comeFor(worldOf(open, middle), away);
    expect(events.map((event) => event.kind)).toEqual(['noticed']);
    expect(hunter.mode).toBe('alerted');
    expect(Math.hypot(hunter.position.x - middle.x, hunter.position.y - middle.y)).toBeGreaterThanOrEqual(HUNTER_ARRIVAL_CLEARANCE);
    expect(hunter.position.x).toBeLessThan(middle.x);
  });

  it('sends nobody when one is already after you, or none is left', () => {
    const chasing = hunterIn(groundOf(wholeMap, { x: 2, y: 2 }), { mode: 'chase' });
    expect(chasing.pack.comeFor(worldOf(open, middle), undefined)).toEqual([]);
    const beaten = hunterIn(groundOf(wholeMap, { x: 2, y: 2 }), { mode: 'beaten' });
    expect(beaten.pack.comeFor(worldOf(open, middle), undefined)).toEqual([]);
    expect(beaten.hunter.mode).toBe('beaten');
  });

  it('waits where the player is too hemmed in for it to come from out of sight', () => {
    const cell = grid(['#####', '#...#', '#####']);
    const { pack, hunter } = hunterIn(groundOf({ x: 0, y: 0, width: 5, height: 3 }, { x: 1, y: 1 }), { mode: 'patrol' });
    expect(pack.comeFor(worldOf(cell, { x: 2, y: 1 }), undefined)).toEqual([]);
    expect(hunter.mode).toBe('patrol');
  });

  it('knows where you are out of sight and off its patch for a while', () => {
    const wall = grid(Array.from({ length: 41 }, (_row, y) => (y === 10 ? `${'#'.repeat(50)}...........` : '.'.repeat(61))));
    const patch = groundOf({ x: 0, y: 0, width: 30, height: 41 }, { x: 2, y: 2 });
    const { pack, hunter } = hunterIn(patch, { mode: 'patrol' });
    pack.comeFor(worldOf(wall, { x: 25, y: 5 }), undefined);
    // Off its patch and further than its tail: any other hunter would let them go.
    const elsewhere = { x: 34, y: 5 };
    pack.advance(worldOf(wall, elsewhere), HUNTER_ALERT_MS + 1);
    expect(hunter.mode).toBe('chase');
    expect(hunter.lastSeen).toEqual(elsewhere);
    expect(hunter.comingUntilMs).toBe(HUNTER_COME_FOR_MS);
  });

  it('leaves off once you are under a roof that hides you', () => {
    const { pack, hunter } = hunterIn(groundOf(wholeMap, { x: 2, y: 2 }), { mode: 'patrol' });
    pack.comeFor(worldOf(open, middle), undefined);
    const seenAt = hunter.lastSeen;
    pack.advance(worldOf(open, { x: 31, y: 20 }, { playerHidden: true }), HUNTER_ALERT_MS / 2);
    expect(hunter.lastSeen).toEqual(seenAt);
  });
});
