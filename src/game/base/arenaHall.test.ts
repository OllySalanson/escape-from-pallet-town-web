import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIRST_WORDS } from '../hub/firstWords';
import { buildMinimap } from '../world/minimap';
import type { Material } from '../world/tileset/materials';
import { TILE_SOURCES } from '../world/tileset/sheets';
import {
  ARENA_CENTRE,
  ARENA_FENCE,
  ARENA_HALL_HEIGHT,
  ARENA_HALL_WIDTH,
  ARENA_KEEPER_TILE,
  ARENA_MAT,
  ARENA_PILLARS,
  ARENA_STATIONS,
  ARENA_TELESCOPES,
  ARENA_TILE,
  ARENA_TORCHES,
  FLOOR_PARALLAX,
  PIT_MAP_CENTRE,
  PIT_MAP_SIZE,
  PIT_RIM,
  PLATFORM_CLEAR,
  PODIUM_PARALLAX,
  TIER_PARALLAX,
  WALL_FOOT,
  acrossOval,
  arenaCollision,
  arenaStationAt,
  arenaTelescopeAt,
  cameraEased,
  cameraLean,
  isArenaFence,
  namePlatePlace,
  parallaxShift,
  pitLookPoint,
  pitTileAt,
  podiumHole,
} from './arenaHall';
import { ARENA_HALL_SOURCE } from './arenaHallSheet';
import { PERSON_WIDTH, STANDS_HEIGHT, STANDS_ORIGIN, STANDS_WIDTH, crowdSeats, nextStir, paintCrowdPerson, paintStands } from './arenaStands';
import { inkAtHour } from './pitClock';
import { PIT_FLOOR_SIZE, calmCloudInk, calmedFloor, isGroundKnown, paintPitFloor, paintPodium, paintTier, RING_ORIGIN, steppedCloud } from './arenaPit';
import { baseGame } from './baseGames.testkit';
import { ARENA_HALL_GROUND, ARENA_HALL_OVER, ARENA_HALL_SHEET } from './generated/arenaHallTiles';
import { BASE_ROOMS, buildRoom, roomNamed } from './rooms';
import { isAtRim } from './arenaRim';

const solid = arenaCollision();
const key = (x: number, y: number): string => `${x},${y}`;

/** How many steps every tile that can be walked to is from the mat. */
function stepsFromTheMat(): Map<string, number> {
  const steps = new Map([[key(ARENA_MAT.x, ARENA_MAT.y), 0]]);
  const queue = [ARENA_MAT];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: x + dx, y: y + dy };
      if (solid[next.y]?.[next.x] === false && !steps.has(key(next.x, next.y))) {
        steps.set(key(next.x, next.y), steps.get(key(x, y))! + 1);
        queue.push(next);
      }
    }
  }
  return steps;
}

/** Every tile that can be walked to from the mat. */
function reached(): Set<string> {
  const seen = new Set([key(ARENA_MAT.x, ARENA_MAT.y)]);
  const queue = [ARENA_MAT];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: x + dx, y: y + dy };
      if (solid[next.y]?.[next.x] === false && !seen.has(key(next.x, next.y))) {
        seen.add(key(next.x, next.y));
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("THE RAID ARENA's great hall", () => {
  const hall = roomNamed('raid-arena')!;

  it('is four times as wide as the widest other room, and well over three times the largest by area', () => {
    const others = BASE_ROOMS.filter((room) => room.id !== 'raid-arena');
    const widest = Math.max(...others.map((room) => room.width));
    const largest = Math.max(...others.map((room) => room.width * room.height));
    expect(hall.width).toBeGreaterThanOrEqual(widest * 4);
    const floor = solid.flat().filter((blocked) => !blocked).length;
    expect(floor).toBeGreaterThanOrEqual(largest * 3.5);
  });

  it('has a platform that goes all the way round, with every tile of it walkable from the mat', () => {
    const walked = reached();
    const open = solid.flatMap((row, y) => row.flatMap((blocked, x) => (blocked ? [] : [key(x, y)])));
    expect(open.filter((tile) => !walked.has(tile))).toEqual([]);
    // All four sides, at the height of the hall's own middle and its centre line.
    const out = (dx: number, dy: number): string => {
      let x = ARENA_MAT.x;
      let y = 33;
      while (solid[y]?.[x]) {
        x += dx;
        y += dy;
      }
      return key(x, y);
    };
    for (const side of [out(1, 0), out(-1, 0), out(0, -1), out(0, 1)]) {
      expect(walked.has(side)).toBe(true);
    }
  });

  it('never lets anybody stand in the pit', () => {
    solid.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (!blocked) {
          const across = acrossOval(PIT_RIM, (x + 0.5) * ARENA_TILE, (y + 0.5) * ARENA_TILE);
          expect(across, `${x},${y}`).toBeGreaterThan(1);
        }
      }),
    );
  });

  it('keeps a fence all round that can be stood at from anywhere on the ring, for a jump', () => {
    expect(ARENA_FENCE.length).toBeGreaterThan(100);
    for (const tile of ARENA_FENCE) {
      expect(isArenaFence(tile)).toBe(true);
      const beside = [
        solid[tile.y][tile.x + 1],
        solid[tile.y][tile.x - 1],
        solid[tile.y + 1]?.[tile.x],
        solid[tile.y - 1]?.[tile.x],
      ];
      expect(beside).toContain(false);
    }
  });

  it('keeps open floor between the fence and the pillars, so the walk round the rim is never shut', () => {
    for (const pillar of ARENA_PILLARS) {
      const nearest = Math.min(
        ...ARENA_FENCE.map((tile) => Math.abs(tile.x - pillar.x) + Math.abs(tile.y - pillar.y)),
      );
      expect(nearest, `${pillar.x},${pillar.y}`).toBeGreaterThan(PLATFORM_CLEAR);
    }
  });

  it('stands its furniture on solid tiles, each with floor in front of it a step or two from the mat', () => {
    expect(ARENA_STATIONS.map((station) => station.id)).toEqual(['bench', 'rack', 'locker']);
    const steps = stepsFromTheMat();
    for (const station of ARENA_STATIONS) {
      for (const tile of station.tiles) {
        expect(solid[tile.y][tile.x], `${station.id} ${tile.x},${tile.y}`).toBe(true);
        expect(arenaStationAt(tile)?.id).toBe(station.id);
      }
      const front = station.tiles.map((tile) => steps.get(key(tile.x, tile.y + 1)));
      expect(front.every((walk) => walk !== undefined), station.id).toBe(true);
      expect(Math.min(...(front as number[])), station.id).toBeLessThanOrEqual(12);
    }
  });

  it('lets a standing torch at the end of a station answer for it', () => {
    expect(ARENA_STATIONS.map((station) => station.past.map((tile) => `${tile.x},${tile.y}`))).toEqual([['32,59'], ['38,59'], []]);
    for (const station of ARENA_STATIONS) {
      for (const tile of station.past) {
        expect(solid[tile.y][tile.x], `${tile.x},${tile.y}`).toBe(true);
      }
    }
  });

  it('leaves no floor a figure could stand on out of sight, behind a pillar or anything else as tall', () => {
    const hidden = solid.flatMap((row, y) =>
      row.flatMap((blocked, x) => {
        const behindPillar = ARENA_PILLARS.some((pillar) => pillar.x === x && pillar.y > y && pillar.y - y <= 2);
        const behindFurniture = ARENA_STATIONS.some((station) => station.rises.some((tile) => tile.x === x && tile.y === y));
        return !blocked && (behindPillar || behindFurniture) ? [key(x, y)] : [];
      }),
    );
    expect(hidden).toEqual([]);
  });

  it('has no floor with one way in, but in front of what it is for', () => {
    const fronts = new Set(
      ARENA_STATIONS.flatMap((station) => [...station.tiles, ...station.past]).map((tile) => key(tile.x, tile.y + 1)),
    );
    const deadEnds = solid.flatMap((row, y) =>
      row.flatMap((blocked, x) => {
        const ways = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => solid[y + dy]?.[x + dx] === false);
        return !blocked && ways.length <= 1 && !fronts.has(key(x, y)) ? [key(x, y)] : [];
      }),
    );
    expect(deadEnds).toEqual([]);
  });

  it('never lets its furniture shut the walk round the rim', () => {
    const walkable = stepsFromTheMat();
    solid.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (!blocked) {
          expect(walkable.has(key(x, y)), `${x},${y}`).toBe(true);
        }
      }),
    );
    for (const tile of ARENA_FENCE) {
      expect(arenaStationAt(tile)).toBeUndefined();
    }
  });

  it('mirrors its pillars about the door, and gives every pillar a torch', () => {
    const at = new Set(ARENA_PILLARS.map((pillar) => key(pillar.x, pillar.y)));
    for (const pillar of ARENA_PILLARS) {
      expect(at.has(key(ARENA_MAT.x * 2 - pillar.x, pillar.y))).toBe(true);
      expect(solid[pillar.y][pillar.x]).toBe(true);
    }
    expect(ARENA_TORCHES.filter((torch) => torch.on === 'pillar')).toHaveLength(ARENA_PILLARS.length);
    expect(ARENA_TORCHES.some((torch) => torch.on === 'wall')).toBe(true);
    expect(ARENA_TORCHES.filter((torch) => torch.on === 'stand')).toHaveLength(2);
  });

  it('walks wider beside the pit than above and below it, and all of it is reached', () => {
    const across = (from: number, way: number): number => {
      let x = from;
      let walked = 0;
      while (solid[33][x] !== false) x += way;
      while (solid[33][x] === false || arenaTelescopeAt({ x, y: 33 }) || ARENA_PILLARS.some((pillar) => pillar.x === x && pillar.y === 33)) {
        x += way;
        walked += 1;
      }
      return walked;
    };
    const downwards = (from: number, way: number): number => {
      let y = from;
      let walked = 0;
      while (solid[y]?.[ARENA_MAT.x] !== false) y += way;
      while (solid[y]?.[ARENA_MAT.x] === false) {
        y += way;
        walked += 1;
      }
      return walked;
    };
    expect(across(ARENA_MAT.x, 1)).toBeGreaterThanOrEqual(7);
    expect(across(ARENA_MAT.x, -1)).toBeGreaterThanOrEqual(7);
    expect(across(ARENA_MAT.x, 1)).toBeGreaterThan(downwards(33, -1));
    // North and south are as they always were: the pit and the wall stand where they stood.
    expect(PIT_RIM.ry).toBe(360);
    expect(WALL_FOOT.ry).toBe(464);
    expect(PIT_RIM.rx).toBe(376);
  });

  it('stands a telescope on the rail on the left and on the right, mirrored, in sight of the door and each walked up to from the floor', () => {
    expect(ARENA_TELESCOPES.map((telescope) => telescope.side)).toEqual(['west', 'east']);
    const [west, east] = ARENA_TELESCOPES;
    expect(ARENA_MAT.x * 2 - west.tile.x).toBe(east.tile.x);
    expect(west.tile.y).toBe(east.tile.y);
    const steps = stepsFromTheMat();
    for (const telescope of ARENA_TELESCOPES) {
      expect(solid[telescope.tile.y][telescope.tile.x], telescope.side).toBe(true);
      expect(arenaTelescopeAt(telescope.tile)).toBe(telescope);
      expect(isArenaFence(telescope.tile), telescope.side).toBe(false);
      expect(steps.has(key(telescope.stance.x, telescope.stance.y)), telescope.side).toBe(true);
      // At the end of the fence's straight, with its plate on the rail's own row
      // and the rail going on past it on the far side.
      const way = telescope.side === 'east' ? 1 : -1;
      expect(isArenaFence({ x: telescope.tile.x - way, y: telescope.tile.y }), telescope.side).toBe(true);
      expect(telescope.stance, telescope.side).toEqual({ x: telescope.tile.x, y: telescope.tile.y + 1 });
      expect(isAtRim({ x: telescope.tile.x + way, y: telescope.tile.y }), telescope.side).toBe(true);
      // Its plate is not on the rim: a press there is the telescope, not a jump.
      expect(isAtRim(telescope.stance), telescope.side).toBe(false);
    }
  });

  it('stands its keeper on floor, clear of the mat and the runner up the middle', () => {
    expect(solid[ARENA_KEEPER_TILE.y][ARENA_KEEPER_TILE.x]).toBe(false);
    expect(Math.abs(ARENA_KEEPER_TILE.x - ARENA_MAT.x)).toBeGreaterThan(1);
    // Nor on the row the stations are walked along, or a held key would stop at her.
    expect(ARENA_KEEPER_TILE.y).not.toBe(ARENA_STATIONS[0].tiles[0].y + 1);
  });

  it('builds as an ordinary room, drawn from a sheet the loader fetches', () => {
    const built = buildRoom(hall, baseGame());
    expect(built.pit).toBe(true);
    expect(built.collision).toEqual(solid);
    expect(built.layers.ground.tiles).toHaveLength(ARENA_HALL_HEIGHT);
    expect(built.layers.ground.tiles[0]).toHaveLength(ARENA_HALL_WIDTH);
    expect(TILE_SOURCES).toContainEqual(ARENA_HALL_SOURCE.source);
  });

  it('has art under every tile that can be walked on, and a hole where the pit is', () => {
    const built = buildRoom(hall, baseGame());
    solid.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (!blocked) {
          expect(built.layers.ground.tiles[y][x], `${x},${y}`).toBeGreaterThanOrEqual(ARENA_HALL_SOURCE.at(0, 0));
        }
      }),
    );
    const { x, y } = PIT_MAP_CENTRE;
    expect(built.layers.ground.tiles[Math.floor(y / ARENA_TILE)][Math.floor(x / ARENA_TILE)]).toBe(-1);
  });

  it('matches its generated tile lists to the sheet they number', () => {
    // A PNG says how big it is sixteen bytes in.
    const sheet = readFileSync(new URL('../../../public/assets/arena-hall.png', import.meta.url));
    expect(sheet.readUInt32BE(16)).toBe(ARENA_HALL_SHEET.columns * ARENA_TILE);
    expect(sheet.readUInt32BE(20)).toBe(ARENA_HALL_SHEET.rows * ARENA_TILE);
    const tiles = ARENA_HALL_SHEET.columns * ARENA_HALL_SHEET.rows;
    for (const layer of [ARENA_HALL_GROUND, ARENA_HALL_OVER]) {
      const rows = layer.split('\n');
      expect(rows).toHaveLength(ARENA_HALL_HEIGHT);
      for (const row of rows) {
        expect(row).toHaveLength(ARENA_HALL_WIDTH * 3);
        for (const code of row.match(/.{3}/g) ?? []) {
          if (code !== '---') {
            expect(Number.parseInt(code, 36)).toBeLessThan(tiles);
          }
        }
      }
    }
  });
});

describe('the pit', () => {
  it('slides each thing further the further down it is, and each towards whoever is looking', () => {
    const player = { x: ARENA_CENTRE.x + 380, y: ARENA_CENTRE.y };
    const amounts = [...TIER_PARALLAX, PODIUM_PARALLAX, FLOOR_PARALLAX];
    const slid = amounts.map((amount) => parallaxShift(amount, player).x);
    expect(slid).toEqual([...slid].sort((a, b) => a - b));
    expect(slid[0]).toBeGreaterThan(0);
    expect(parallaxShift(FLOOR_PARALLAX, ARENA_CENTRE)).toEqual({ x: 0, y: 0 });
  });

  it('says which tile of the map is at any point of it, for somebody standing anywhere', () => {
    const middle = ARENA_CENTRE;
    expect(pitTileAt(PIT_MAP_CENTRE, middle)).toEqual({ x: PIT_MAP_SIZE / 2, y: PIT_MAP_SIZE / 2 });
    expect(pitTileAt({ x: PIT_MAP_CENTRE.x - PIT_MAP_SIZE, y: PIT_MAP_CENTRE.y }, middle)).toBeNull();
    // Walking away slides the floor after you, so the same tile is further on.
    const east = { x: ARENA_CENTRE.x + 380, y: ARENA_CENTRE.y };
    const seen = pitTileAt(PIT_MAP_CENTRE, east)!;
    expect(seen.x).toBeLessThan(PIT_MAP_SIZE / 2);
  });

  it('looks past the steps from anywhere at the fence, at something on the floor', () => {
    for (const tile of ARENA_FENCE) {
      const standing = [
        { x: tile.x + 1, y: tile.y },
        { x: tile.x - 1, y: tile.y },
        { x: tile.x, y: tile.y + 1 },
        { x: tile.x, y: tile.y - 1 },
      ].find((each) => solid[each.y]?.[each.x] === false)!;
      const point = pitLookPoint(standing);
      expect(acrossOval(podiumHole(), point.x, point.y), `${standing.x},${standing.y}`).toBeLessThan(1.2);
    }
  });

  describe('the camera', () => {
    const VIEWS = [
      { width: 400, height: 256 },
      { width: 320, height: 240 },
    ];
    const FLOOR = solid.flatMap((row, y) => row.flatMap((blocked, x) => (blocked ? [] : [{ x, y }])));
    const middleOf = (tile: { x: number; y: number }) => ({ x: (tile.x + 0.5) * ARENA_TILE, y: (tile.y + 0.5) * ARENA_TILE });

    it('leans out over the pit from anywhere, never so far the player meets the hint below them', () => {
      expect(cameraLean(ARENA_CENTRE, VIEWS[0])).toEqual({ x: 0, y: 0 });
      for (const view of VIEWS) {
        for (const tile of FLOOR) {
          const player = middleOf(tile);
          const lean = cameraLean(player, view);
          expect(Math.abs(lean.y), `${tile.x},${tile.y}`).toBeLessThanOrEqual(view.height / 2 - 56);
          expect(Math.abs(lean.x), `${tile.x},${tile.y}`).toBeLessThanOrEqual(view.width / 2 - 56);
          // Always towards the middle, which is what stops it swinging out into the dark.
          expect(lean.x * (ARENA_CENTRE.x - player.x), `${tile.x},${tile.y}`).toBeGreaterThanOrEqual(0);
          expect(lean.y * (ARENA_CENTRE.y - player.y), `${tile.x},${tile.y}`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('moves by a share of a step for every step, so walking never swings the view', () => {
      for (const view of VIEWS) {
        for (const tile of FLOOR) {
          const lean = cameraLean(middleOf(tile), view);
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            if (solid[tile.y + dy]?.[tile.x + dx] === false) {
              const next = cameraLean(middleOf({ x: tile.x + dx, y: tile.y + dy }), view);
              expect(Math.hypot(next.x - lean.x, next.y - lean.y), `${tile.x},${tile.y}`).toBeLessThanOrEqual(ARENA_TILE * 0.35);
            }
          }
        }
      }
    });

    it('never needs the edge of the bounds to stop it, wherever the player walks', () => {
      for (const view of VIEWS) {
        for (const tile of FLOOR) {
          const player = middleOf(tile);
          const lean = cameraLean(player, view);
          const left = player.x + lean.x - view.width / 2;
          // East and west it is the width that matters: what is seen stays in what the stands paint.
          expect(left, `${tile.x},${tile.y}`).toBeGreaterThanOrEqual(STANDS_ORIGIN.x - 1);
          expect(left + view.width, `${tile.x},${tile.y}`).toBeLessThanOrEqual(STANDS_ORIGIN.x + STANDS_WIDTH + 1);
          expect(player.y + lean.y + view.height / 2, `${tile.x},${tile.y}`).toBeLessThanOrEqual(STANDS_ORIGIN.y + STANDS_HEIGHT + 1);
        }
      }
    });

    it('comes round to what it is asked to look at gently, and arrives', () => {
      const goal = { x: 300, y: -120 };
      let at = { x: 0, y: 0 };
      let frames = 0;
      while ((at.x !== goal.x || at.y !== goal.y) && frames < 600) {
        const next = cameraEased(at, goal, 1000 / 60);
        expect(Math.hypot(next.x - at.x, next.y - at.y)).toBeLessThanOrEqual(4.1);
        at = { x: next.x, y: next.y };
        frames += 1;
      }
      expect(at).toEqual(goal);
      // Slow to start from a small move, and in under two seconds from a big one.
      expect(frames).toBeLessThan(140);
    });
  });

  it('draws a way in\'s name plate whole or not at all', () => {
    const plate = { width: 90, height: 13 };
    const shift = ARENA_CENTRE.x - 520;
    const view = { x: 300 + shift, y: 300, width: 400, height: 256 };
    // In the middle of the view, over its mark.
    expect(namePlatePlace({ x: 500 + shift, y: 420 }, plate, view)).toEqual({ x: 455 + shift, y: 394 });
    // At either edge it slides along rather than being cut.
    expect(namePlatePlace({ x: 305 + shift, y: 420 }, plate, view)?.x).toBe(300 + shift);
    expect(namePlatePlace({ x: 684 + shift, y: 420 }, plate, view)?.x).toBe(596 + shift);
    // Under the top of the screen it goes below its mark.
    expect(namePlatePlace({ x: 500 + shift, y: 310 }, plate, view)?.y).toBe(320);
    // A mark off the screen has nothing to be named, the walk round the rim's case.
    expect(namePlatePlace({ x: 280 + shift, y: 420 }, plate, view)).toBeNull();
    expect(namePlatePlace({ x: 696 + shift, y: 420 }, plate, view)).toBeNull();
    // Nor is it ever cut by the stone round the pit: the hall's floor is drawn over it.
    expect(namePlatePlace({ x: ARENA_CENTRE.x + 370, y: 528 }, plate, { x: ARENA_CENTRE.x + 80, y: 400, width: 400, height: 256 })).toBeNull();
  });

  /** A map the size the pit shows, all open grass, walked within `walked` of its top-left. */
  function picture(walked: number) {
    const size = PIT_MAP_SIZE;
    const surveyed = new Set<number>();
    for (let y = 0; y < walked; y += 1) {
      for (let x = 0; x < walked; x += 1) {
        surveyed.add(y * size + x);
      }
    }
    return buildMinimap({
      map: {
        width: size,
        height: size,
        terrain: Array.from({ length: size }, () => Array<Material>(size).fill('grass')),
        collision: Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
      },
      surveyed,
    });
  }

  it('shows what a save has walked and hides the rest, in a picture that is its own', () => {
    const offset = (PIT_FLOOR_SIZE - PIT_MAP_SIZE) / 2;
    const pixel = (data: Uint8ClampedArray, mapX: number, mapY: number): number[] => {
      const at = ((mapY + offset) * PIT_FLOOR_SIZE + mapX + offset) * 4;
      return [...data.subarray(at, at + 4)];
    };
    const fresh = paintPitFloor(picture(0));
    const walked = paintPitFloor(picture(200));
    // Well inside what was walked: grass, so more green than anything, opaque.
    const green = (ink: number[]): boolean => ink[1] > ink[0] && ink[1] > ink[2] && ink[3] === 255;
    let shown = 0;
    let hidden = 0;
    for (let at = 100; at < 180; at += 1) {
      if (green(pixel(walked.data, at, at))) shown += 1;
      if (green(pixel(fresh.data, at, at))) hidden += 1;
    }
    expect(shown).toBe(80);
    expect(hidden).toBeLessThan(40);
    expect(isGroundKnown('.')).toBe(true);
    expect(isGroundKnown('2')).toBe(false);
  });

  it('never paints a ring beyond what the hall covers, so no corner of one shows past the wall', () => {
    for (const ring of [paintTier(0), paintPodium()]) {
      expect(ring.data[3]).toBe(0);
      expect(ring.data[(ring.width - 1) * 4 + 3]).toBe(0);
      expect(ring.data[((ring.height - 1) * ring.width) * 4 + 3]).toBe(0);
    }
    expect(RING_ORIGIN.x).toBeGreaterThan(0);
    const floor = paintPitFloor(picture(0));
    expect(floor.data[3]).toBe(0);
  });
});

/** Two rows of the box at most, so a line of hers never pages. */
const LONGEST_MARSHAL_LINE = 100;

describe('what is said on the way to a raid', () => {
  it('says it in the hall and nowhere past it: the marshal, not Oak', () => {
    expect(FIRST_WORDS.loadout.speaker).not.toBe('prof-oak');
    for (const line of FIRST_WORDS.loadout.lines) {
      expect(line.length).toBeLessThanOrEqual(LONGEST_MARSHAL_LINE);
    }
  });
});

describe('the stands round the hall', () => {
  const painted = paintStands();
  const opaque = (hallX: number, hallY: number): boolean =>
    painted.data[((hallY - STANDS_ORIGIN.y) * painted.width + hallX - STANDS_ORIGIN.x) * 4 + 3] > 0;

  it('stand all the way round the wall, and never over any ground that can be walked', () => {
    for (let index = 0; index < 180; index += 1) {
      const angle = (index / 180) * Math.PI * 2;
      const point = {
        x: Math.round(ARENA_CENTRE.x + Math.cos(angle) * (WALL_FOOT.rx + 30)),
        y: Math.round(ARENA_CENTRE.y + Math.sin(angle) * (WALL_FOOT.ry + 30)),
      };
      const onTheWayOut = Math.abs(point.x - (ARENA_MAT.x + 0.5) * ARENA_TILE) < 40 && point.y > ARENA_CENTRE.y;
      if (!onTheWayOut && Math.sin(angle) >= 0) {
        expect(opaque(point.x, point.y)).toBe(true);
      }
    }
    solid.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (!blocked) {
          for (const [px, py] of [[x * ARENA_TILE, y * ARENA_TILE], [x * ARENA_TILE + 15, y * ARENA_TILE + 15]]) {
            expect(opaque(px, py), `${x},${y}`).toBe(false);
          }
        }
      }),
    );
  });

  it('leave no gap anywhere the camera can go: a roof past the seats, and only the way out is open', () => {
    const middle = (ARENA_MAT.x + 0.5) * ARENA_TILE;
    for (let hallY = STANDS_ORIGIN.y; hallY < STANDS_ORIGIN.y + STANDS_HEIGHT; hallY += 3) {
      for (let hallX = STANDS_ORIGIN.x; hallX < STANDS_ORIGIN.x + STANDS_WIDTH; hallX += 3) {
        const inHall = hallX >= 0 && hallY >= 0 && hallX < ARENA_HALL_WIDTH * ARENA_TILE && hallY < ARENA_HALL_HEIGHT * ARENA_TILE && acrossOval(WALL_FOOT, hallX, hallY) <= 1;
        if (!opaque(hallX, hallY) && !inHall && !(Math.abs(hallX - middle) < 40 && hallY > ARENA_CENTRE.y)) {
          // Only the hall's own wall and its cap may lie outside the picture's ink.
          expect(acrossOval({ ...WALL_FOOT, rx: WALL_FOOT.rx + 12, ry: WALL_FOOT.ry + 12, y: WALL_FOOT.y - 24 }, hallX, hallY), `${hallX},${hallY}`).toBeLessThanOrEqual(1.12);
        }
      }
    }
  });

  it('leave the way out of the hall open', () => {
    const middle = (ARENA_MAT.x + 0.5) * ARENA_TILE;
    for (let y = (ARENA_MAT.y + 1) * ARENA_TILE; y < 1050; y += 1) {
      expect(opaque(Math.round(middle), y)).toBe(false);
    }
  });

  it('seat a crowd on them, inside the picture, the same crowd every time', () => {
    const seats = crowdSeats();
    expect(seats.length).toBeGreaterThan(400);
    expect(crowdSeats()).toBe(seats);
    for (const seat of seats) {
      expect(seat.x).toBeGreaterThanOrEqual(STANDS_ORIGIN.x);
      expect(seat.y).toBeGreaterThanOrEqual(STANDS_ORIGIN.y);
      expect(opaque(seat.x + 2, seat.y)).toBe(true);
    }
  });

  it('lets only somebody in view shift, by one pixel, and not for long', () => {
    const stir = nextStir([0.3, 0.1, 0.5], () => true, crowdSeats())!;
    expect(Math.abs(stir.dx) + Math.abs(stir.dy)).toBe(1);
    expect(stir.forMs).toBeLessThan(3000);
    expect(nextStir([0.3, 0.1, 0.5], () => false, crowdSeats())).toBeNull();
    expect(paintCrowdPerson().width % PERSON_WIDTH).toBe(0);
  });
});

describe('the floor through a telescope', () => {
  /** Two pixels of bright cloud over nothing walked, and two of ground. */
  const floor = () => ({
    width: 4,
    height: 1,
    data: new Uint8ClampedArray([248, 248, 248, 255, 24, 24, 24, 255, 72, 136, 56, 255, 72, 136, 56, 0]),
  });
  const walked = (tile: { readonly x: number }): boolean => tile.x >= 2;
  const ink = calmCloudInk('day');
  const pixel = (data: Uint8ClampedArray, at: number): readonly number[] => [...data.slice(at * 4, at * 4 + 4)];

  it('draws what nobody has walked down towards one quiet ink, and leaves walked ground exactly as it is', () => {
    const { data } = calmedFloor(floor(), { left: 0, top: 0 }, 1, walked, ink, 'day');
    expect(pixel(data, 2)).toEqual([72, 136, 56, 255]);
    const [bright, dark] = [pixel(data, 0), pixel(data, 1)];
    expect(bright[0] - dark[0]).toBeLessThan((248 - 24) / 2);
    expect(bright[0]).toBeLessThan(248);
    expect(dark[0]).toBeGreaterThan(24);
  });

  it('leaves what is outside the painted round alone', () => {
    const { data } = calmedFloor(floor(), { left: 0, top: 0 }, 1, () => false, ink, 'day');
    expect(pixel(data, 3)).toEqual([72, 136, 56, 0]);
  });

  it('lifts walked ground by night, so it is not darker than the cloud', () => {
    const { data } = calmedFloor(floor(), { left: 0, top: 0 }, 1, walked, calmCloudInk('night'), 'night');
    expect(pixel(data, 2)[1]).toBeGreaterThan(136);
  });

  it('calms the half-cloud on the edge of walked ground as well', () => {
    // The pit's brightest cloud at this hour, on a tile that has been walked.
    const [red, green, blue] = inkAtHour([176, 184, 200], 'cloud', 'day');
    const edge = { width: 1, height: 1, data: new Uint8ClampedArray([red, green, blue, 255]) };
    expect(pixel(calmedFloor(edge, { left: 0, top: 0 }, 1, () => true, ink, 'day').data, 0)[0]).toBeLessThan(red);
  });

  it('puts smoothed cloud back into hard steps, and never touches the ground', () => {
    const size = 8;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let at = 0; at < size * size; at += 1) {
      data.set([ink[0], ink[1], ink[2], 255], at * 4);
    }
    data.set([1, 2, 3, 255], 0);
    const stepped = steppedCloud({ width: size, height: size, data }, (x, y) => x === 0 && y === 0, ink);
    expect(pixel(stepped.data, 0)).toEqual([1, 2, 3, 255]);
    const inks = new Set<string>();
    for (let at = 1; at < size * size; at += 1) {
      inks.add(pixel(stepped.data, at).join());
    }
    expect(inks.size).toBeLessThanOrEqual(4);
    expect(pixel(stepped.data, 1).every((value, index) => index === 3 || value % 8 === 0)).toBe(true);
  });
});
