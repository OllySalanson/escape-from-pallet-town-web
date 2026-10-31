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
  cameraLean,
  isArenaFence,
  namePlatePlace,
  parallaxShift,
  pitLookPoint,
  pitTileAt,
  podiumHole,
} from './arenaHall';
import { ARENA_HALL_SOURCE } from './arenaHallSheet';
import { PERSON_WIDTH, STANDS_ORIGIN, crowdSeats, nextStir, paintCrowdPerson, paintStands } from './arenaStands';
import { PIT_FLOOR_SIZE, isGroundKnown, paintPitFloor, paintPodium, paintTier, RING_ORIGIN } from './arenaPit';
import { baseGame } from './baseGames.testkit';
import { ARENA_HALL_GROUND, ARENA_HALL_OVER, ARENA_HALL_SHEET } from './generated/arenaHallTiles';
import { BASE_ROOMS, buildRoom, roomNamed } from './rooms';

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
  });

  it('stands its keeper on floor, clear of the mat and the runner up the middle', () => {
    expect(solid[ARENA_KEEPER_TILE.y][ARENA_KEEPER_TILE.x]).toBe(false);
    expect(Math.abs(ARENA_KEEPER_TILE.x - ARENA_MAT.x)).toBeGreaterThan(1);
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
    const player = { x: 900, y: 528 };
    const amounts = [...TIER_PARALLAX, PODIUM_PARALLAX, FLOOR_PARALLAX];
    const slid = amounts.map((amount) => parallaxShift(amount, player).x);
    expect(slid).toEqual([...slid].sort((a, b) => a - b));
    expect(slid[0]).toBeGreaterThan(0);
    expect(parallaxShift(FLOOR_PARALLAX, { x: 520, y: 528 })).toEqual({ x: 0, y: 0 });
  });

  it('says which tile of the map is at any point of it, for somebody standing anywhere', () => {
    const middle = { x: 520, y: 528 };
    expect(pitTileAt(PIT_MAP_CENTRE, middle)).toEqual({ x: PIT_MAP_SIZE / 2, y: PIT_MAP_SIZE / 2 });
    expect(pitTileAt({ x: PIT_MAP_CENTRE.x - PIT_MAP_SIZE, y: PIT_MAP_CENTRE.y }, middle)).toBeNull();
    // Walking away slides the floor after you, so the same tile is further on.
    const east = { x: 900, y: 528 };
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

  it('leans the camera out over the pit, never so far the player meets the hint below them', () => {
    expect(cameraLean({ x: 520, y: 528 }, 256)).toEqual({ x: 0, y: 0 });
    const mat = cameraLean({ x: (ARENA_MAT.x + 0.5) * ARENA_TILE, y: (ARENA_MAT.y + 0.5) * ARENA_TILE }, 256);
    expect(mat.y).toBeLessThan(0);
    expect(Math.abs(mat.y)).toBeLessThanOrEqual(256 / 2 - 56);
    expect(Math.abs(cameraLean({ x: 520, y: 1000 }, 240).y)).toBeLessThanOrEqual(240 / 2 - 56);
  });

  it('turns the view up to the stands at the far wall, and never away from the pit at the door', () => {
    // At the north rail it still looks out over the pit.
    expect(cameraLean({ x: 520, y: 528 - 400 }, 256).y).toBeGreaterThan(0);
    // At the wall it looks up over the seats.
    expect(cameraLean({ x: 520, y: 80 }, 256).y).toBeLessThan(0);
    // East and west, the same.
    expect(cameraLean({ x: 1000, y: 528 }, 256).x).toBeGreaterThan(0);
    // By the door, unchanged: the stations row and the mat both still lean north.
    expect(cameraLean({ x: 520, y: 960 }, 256).y).toBeLessThan(0);
  });

  it('draws a way in\'s name plate whole or not at all', () => {
    const plate = { width: 90, height: 13 };
    const view = { x: 300, y: 300, width: 400, height: 256 };
    // In the middle of the view, over its mark.
    expect(namePlatePlace({ x: 500, y: 420 }, plate, view)).toEqual({ x: 455, y: 394 });
    // At either edge it slides along rather than being cut.
    expect(namePlatePlace({ x: 305, y: 420 }, plate, view)?.x).toBe(300);
    expect(namePlatePlace({ x: 684, y: 420 }, plate, view)?.x).toBe(596);
    // Under the top of the screen it goes below its mark.
    expect(namePlatePlace({ x: 500, y: 310 }, plate, view)?.y).toBe(320);
    // A mark off the screen has nothing to be named, the walk round the rim's case.
    expect(namePlatePlace({ x: 280, y: 420 }, plate, view)).toBeNull();
    expect(namePlatePlace({ x: 696, y: 420 }, plate, view)).toBeNull();
    // Nor is it ever cut by the stone round the pit: the hall's floor is drawn over it.
    expect(namePlatePlace({ x: 520 + 370, y: 528 }, plate, { x: 600, y: 400, width: 400, height: 256 })).toBeNull();
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
    const stir = nextStir([0.3, 0.1, 0.5], () => true)!;
    expect(Math.abs(stir.dx) + Math.abs(stir.dy)).toBe(1);
    expect(stir.forMs).toBeLessThan(3000);
    expect(nextStir([0.3, 0.1, 0.5], () => false)).toBeNull();
    expect(paintCrowdPerson().width % PERSON_WIDTH).toBe(0);
  });
});
