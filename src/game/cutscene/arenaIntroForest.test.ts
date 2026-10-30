import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import {
  ARENA_INTRO_FOREST_HEIGHT,
  ARENA_INTRO_FOREST_WIDTH,
  ESCAPE_ROUTE,
  EXIT_TILE,
  FIND_TILES,
  FIRE_WALL,
  HERO_LANDING,
  HUNTER_CHASE,
  HUNTER_ROUTE,
  PARTNER_STAND_TILE,
  SNEAK_ROUTE,
  STAND_TILE,
  SWARM_FROM,
  SWARM_RING,
  arenaIntroForest,
  routeTiles,
} from './arenaIntroForest';

const forest = arenaIntroForest();
const open = (tile: GridPosition) =>
  tile.x >= 0 &&
  tile.y >= 0 &&
  tile.x < ARENA_INTRO_FOREST_WIDTH &&
  tile.y < ARENA_INTRO_FOREST_HEIGHT &&
  forest.collision[tile.y][tile.x] === false;
const same = (a: GridPosition, b: GridPosition) => a.x === b.x && a.y === b.y;

/**
 * Nobody walks the trailer's wood but the trailer, so the one thing it can get
 * wrong is putting somebody inside a tree: every tile a figure is scripted
 * onto is open ground, and a figure standing under a crown would be drawn
 * under it.
 */
describe("THE RAID ARENA trailer's wood", () => {
  it('is the size it says', () => {
    expect(forest.collision).toHaveLength(ARENA_INTRO_FOREST_HEIGHT);
    expect(forest.collision.every((row) => row.length === ARENA_INTRO_FOREST_WIDTH)).toBe(true);
  });

  it.each([
    ['the sneak', SNEAK_ROUTE],
    ['the hunter', HUNTER_ROUTE],
    ['the escape', ESCAPE_ROUTE],
    ['the chase', HUNTER_CHASE],
  ])('walks %s over open ground, a step at a time', (_name, route) => {
    const tiles = routeTiles(route);
    for (const tile of tiles) {
      expect(open(tile), `${tile.x},${tile.y}`).toBe(true);
    }
    for (let index = 1; index < tiles.length; index += 1) {
      expect(Math.abs(tiles[index].x - tiles[index - 1].x) + Math.abs(tiles[index].y - tiles[index - 1].y)).toBe(1);
    }
  });

  it('lays every find on the way in, in the order it is walked', () => {
    const route = routeTiles(SNEAK_ROUTE);
    const at = FIND_TILES.map((tile) => route.findIndex((place) => same(place, tile)));
    expect(at.every((index) => index > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('stands the swarm, the stand and the landing on open ground', () => {
    for (const tile of [...SWARM_RING, ...SWARM_FROM, STAND_TILE, PARTNER_STAND_TILE, HERO_LANDING, EXIT_TILE]) {
      expect(open(tile), `${tile.x},${tile.y}`).toBe(true);
    }
    expect(SWARM_FROM).toHaveLength(SWARM_RING.length);
  });

  it('ends the sneak where the escape starts, and the escape on the exit', () => {
    expect(same(SNEAK_ROUTE.at(-1)!, STAND_TILE)).toBe(true);
    expect(same(ESCAPE_ROUTE[0], STAND_TILE)).toBe(true);
    expect(same(ESCAPE_ROUTE.at(-1)!, EXIT_TILE)).toBe(true);
  });

  it('shuts the road with the fire: hedge to hedge, behind the runners and in front of the hunter', () => {
    const column = FIRE_WALL[0].x;
    expect(FIRE_WALL.every((tile) => tile.x === column && open(tile))).toBe(true);
    expect(open({ x: column, y: FIRE_WALL[0].y - 1 })).toBe(false);
    expect(open({ x: column, y: FIRE_WALL.at(-1)!.y + 1 })).toBe(false);
    const onTheWall = (tile: GridPosition) => FIRE_WALL.some((burning) => same(burning, tile));
    expect(routeTiles(ESCAPE_ROUTE).some(onTheWall)).toBe(true);
    expect(routeTiles(HUNTER_CHASE).some(onTheWall)).toBe(false);
    expect(HUNTER_CHASE.at(-1)!.x).toBe(column - 1);
    expect(EXIT_TILE.x).toBeGreaterThan(column);
  });

  it('hangs no crown over a tile anybody is walked onto', () => {
    const walked = [...routeTiles(SNEAK_ROUTE), ...routeTiles(ESCAPE_ROUTE), ...routeTiles(HUNTER_ROUTE), ...routeTiles(HUNTER_CHASE), ...SWARM_RING];
    for (const tile of walked) {
      expect(forest.layers.canopy.tiles[tile.y][tile.x], `${tile.x},${tile.y}`).toBeLessThan(0);
    }
  });
});
