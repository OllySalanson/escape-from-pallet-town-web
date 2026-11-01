import { describe, expect, it } from 'vitest';
import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import { ARENA_KEEPER_TILE, ARENA_MAT, ARENA_STATIONS, ARENA_TELESCOPES, arenaCollision } from './arenaHall';
import { RIVAL_TILE } from './arenaBouts';
import { getBaseMap } from './baseMap';
import { BASE_DOORS } from './doors';
import { roundTheYardStair, SLIDE_REACH, slideRound, YARD_STAIR } from './arenaWalk';

const SOLID = arenaCollision();
const same = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;
const isPerson = (tile: GridPosition): boolean => same(tile, ARENA_KEEPER_TILE) || same(tile, RIVAL_TILE);
const isBlocked = (tile: GridPosition): boolean => (SOLID[tile.y]?.[tile.x] ?? true) || isPerson(tile);
const step = (from: GridPosition, direction: Direction): GridPosition => ({
  x: from.x + DIRECTION_DELTAS[direction].x,
  y: from.y + DIRECTION_DELTAS[direction].y,
});

/** Where one held key takes a player, and every tile on the way, as the scene's walk does it. */
function hold(from: GridPosition, direction: Direction): { readonly path: readonly GridPosition[]; readonly loops: boolean } {
  const path = [from];
  const seen = new Set([`${from.x},${from.y}`]);
  for (;;) {
    const here = path[path.length - 1];
    const ahead = step(here, direction);
    const side = isBlocked(ahead) ? slideRound(here, direction, isBlocked, isPerson) : null;
    const next = isBlocked(ahead) ? (side ? step(here, side) : null) : ahead;
    if (!next) {
      return { path, loops: false };
    }
    const key = `${next.x},${next.y}`;
    if (seen.has(key)) {
      return { path, loops: true };
    }
    seen.add(key);
    path.push(next);
  }
}

/** Where a run of held keys ends, each from where the last stopped. */
const holds = (from: GridPosition, ...keys: readonly Direction[]): GridPosition =>
  keys.reduce((at, direction) => {
    const { path } = hold(at, direction);
    return path[path.length - 1];
  }, from);

const passes = (from: GridPosition, direction: Direction, tile: GridPosition): boolean =>
  hold(from, direction).path.some((each) => same(each, tile));

const stationNamed = (id: string) => ARENA_STATIONS.find((station) => station.id === id)!;
const fronts = (id: string): readonly GridPosition[] => stationNamed(id).tiles.map((tile) => ({ x: tile.x, y: tile.y + 1 }));
const [west, east] = ARENA_TELESCOPES;
const RAIL = { x: ARENA_MAT.x, y: west.stance.y };

describe("walking THE RAID ARENA's great hall on a held key", () => {
  it('goes from the mat to the bench on one key, and stops in front of it', () => {
    const end = holds(ARENA_MAT, 'left');
    expect(fronts('bench')).toContainEqual(end);
    expect(slideRound(end, 'up', isBlocked, isPerson)).toBeNull();
    expect(isBlocked(step(end, 'up'))).toBe(true);
  });

  it('goes from the mat past the rack to the locker on one key, and stops in front of it', () => {
    const { path } = hold(ARENA_MAT, 'right');
    expect(fronts('locker')).toContainEqual(path[path.length - 1]);
    for (const front of fronts('rack')) {
      expect(path).toContainEqual(front);
    }
  });

  it('goes up the runner to the rail on one key, and stays at the rail in front of the door', () => {
    expect(holds(ARENA_MAT, 'up')).toEqual(RAIL);
    expect(slideRound(RAIL, 'up', isBlocked, isPerson)).toBeNull();
  });

  it('goes along the rail over the plate of each telescope on one key from the head of the runner', () => {
    expect(passes(RAIL, 'right', east.stance)).toBe(true);
    expect(passes(RAIL, 'left', west.stance)).toBe(true);
  });

  it('turns a press up near a telescope into walking up to it, facing it', () => {
    for (const telescope of ARENA_TELESCOPES) {
      const way = telescope.side === 'east' ? -1 : 1;
      for (let away = 1; away < SLIDE_REACH; away += 1) {
        const from = { x: telescope.stance.x + way * away, y: telescope.stance.y };
        expect(holds(from, 'up'), `${telescope.side} ${away}`).toEqual(telescope.stance);
      }
    }
  });

  it('never goes round what is pressed into on purpose', () => {
    for (const station of ARENA_STATIONS) {
      for (const tile of [...station.tiles, ...station.past]) {
        expect(slideRound({ x: tile.x, y: tile.y + 1 }, 'up', isBlocked, isPerson), `${tile.x},${tile.y}`).toBeNull();
      }
    }
    for (const telescope of ARENA_TELESCOPES) {
      expect(slideRound(telescope.stance, 'up', isBlocked, isPerson)).toBeNull();
    }
    const below = { x: ARENA_KEEPER_TILE.x, y: ARENA_KEEPER_TILE.y + 1 };
    expect(slideRound(below, 'up', isBlocked, isPerson)).toBeNull();
    const underTheRival = { x: RIVAL_TILE.x, y: RIVAL_TILE.y + 1 };
    expect(slideRound(underTheRival, 'up', isBlocked, isPerson)).toBeNull();
  });

  it('takes the whole way round on four held keys, one for each side of the hall', () => {
    const start = holds(ARENA_MAT, 'up');
    const eastEnd = holds(start, 'right');
    const northEnd = holds(eastEnd, 'up');
    const westEnd = holds(northEnd, 'left');
    const southEnd = holds(westEnd, 'down');
    const home = holds(southEnd, 'right');
    expect(eastEnd.x).toBeGreaterThan(60);
    expect(northEnd.y).toBeLessThan(10);
    expect(westEnd.x).toBeLessThan(10);
    expect(southEnd.y).toBeGreaterThan(50);
    expect(home).toEqual(eastEnd);
  });

  it('goes round the rail itself on one key, hugging the fence from the end of its straight to the far side', () => {
    const start = { x: east.tile.x + 1, y: east.tile.y };
    const { path } = hold(start, 'up');
    const hugging = path.filter((tile) => SOLID[tile.y][tile.x - 1] === true).length;
    expect(path[path.length - 1].y).toBeLessThan(10);
    expect(hugging).toBeGreaterThanOrEqual(25);
  });

  it('comes back from everything on two held keys', () => {
    const benchEnd = holds(ARENA_MAT, 'left');
    expect(passes(benchEnd, 'right', { x: ARENA_MAT.x, y: benchEnd.y })).toBe(true);
    for (const telescope of ARENA_TELESCOPES) {
      const back = telescope.side === 'east' ? 'left' : 'right';
      expect(passes(telescope.stance, back, RAIL), telescope.side).toBe(true);
    }
    // Pressing down beside the porch goes in, not on along the wall.
    for (const x of [ARENA_MAT.x - 4, ARENA_MAT.x - 3, ARENA_MAT.x - 2, ARENA_MAT.x + 2, ARENA_MAT.x + 3, ARENA_MAT.x + 4]) {
      expect(passes({ x, y: benchEnd.y }, 'down', { x: ARENA_MAT.x + Math.sign(x - ARENA_MAT.x), y: ARENA_MAT.y }), `${x}`).toBe(true);
    }
  });

  it('never walks a held key in circles or against nothing, from any tile, any way', () => {
    const faults: string[] = [];
    SOLID.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (blocked) {
          return;
        }
        for (const direction of ['up', 'down', 'left', 'right'] as const) {
          const walked = hold({ x, y }, direction);
          if (walked.loops) {
            faults.push(`${x},${y} ${direction}`);
          }
        }
      }),
    );
    expect(faults).toEqual([]);
  });

  it('leaves every tile a way on: nothing wedges, and everything gets back to the mat', () => {
    const faults: string[] = [];
    SOLID.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (blocked) {
          return;
        }
        const ways = (['up', 'down', 'left', 'right'] as const).filter((direction) => !isBlocked(step({ x, y }, direction)));
        if (ways.length === 0 && !same({ x, y }, ARENA_KEEPER_TILE) && !same({ x, y }, RIVAL_TILE)) {
          faults.push(`${x},${y}`);
        }
      }),
    );
    expect(faults).toEqual([]);
  });
});

describe('the first walk across the yard', () => {
  const { collision } = getBaseMap([]);
  const shut = (tile: GridPosition): boolean => collision[tile.y]?.[tile.x] ?? true;
  const door = BASE_DOORS.find((each) => each.id === 'raid-arena')!;

  it('holds one key west from either row of the keepers\' path to under the Arena\'s door', () => {
    for (const row of [12, 13]) {
      let at: GridPosition = { x: 20, y: row };
      for (let steps = 0; steps < 40 && at.x > door.returnTo.x; steps += 1) {
        const ahead = step(at, 'left');
        const way = shut(ahead) ? roundTheYardStair(at, 'left', shut) : 'left';
        expect(way, `stopped at ${at.x},${at.y}`).not.toBeNull();
        at = step(at, way!);
      }
      expect(at).toEqual(door.returnTo);
    }
  });

  it('is the only tile that goes round anything, and only for that key', () => {
    expect(roundTheYardStair({ x: YARD_STAIR.x, y: YARD_STAIR.y }, 'up', shut)).toBeNull();
    expect(roundTheYardStair({ x: YARD_STAIR.x + 1, y: YARD_STAIR.y }, 'left', shut)).toBeNull();
  });
});
