import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { TILE_SIZE } from '../worldMap';
import { BASE_DOORS } from './doors';
import {
  BASE_ROOMS,
  CENTER_DISPLAY,
  COUNTER_BALLS,
  OAK_WALL_MAP,
  WORKSHOP_DISPLAY,
  buildRoom,
  propTiles,
  WALL_MAP_TILES,
  restingBalls,
  roomNamed,
  stairArrival,
  BADGE_CASE_WALL,
  PENNANT_WALL,
  PUMPKIN_SPOT,
  wallTiles,
  type BaseRoom,
} from './rooms';
import type { BaseKeeper } from './doors';
import { BASE_PIECES } from './generated/basePieces';
import { stepsFrom, stepsTo, servingTiles, walksToKeepers, BASE_STARTS } from './baseWalks';
import { baseGame } from './baseGames.testkit';
import { CABINET_UNITS, CABINET_UNITS_AT_START, CABINET_UNIT_SIZE, unitTiles } from './cabinet';

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const room = (id: string): BaseRoom => roomNamed(id)!;
const keeperOf = (each: BaseRoom): BaseKeeper => each.keeper!;
const matOf = (each: BaseRoom): GridPosition => each.mat!;
/** The rooms a keeper serves from, which is every room but the player's own house. */
const KEEPER_ROOMS = BASE_ROOMS.filter((each) => each.keeper !== null);
/** Where a player comes into a room: its mat, or the foot of its stairs. */
const entrancesOf = (each: BaseRoom): GridPosition[] => [
  ...(each.mat ? [each.mat] : []),
  ...each.stairs.map((stair) => stair.tile),
];
const key = (tile: GridPosition) => `${tile.x},${tile.y}`;

/** The states a room can be in that change what stands in it. */
const STATES = [
  { built: [], hurt: 0 },
  { built: EVERY_RUNG, hurt: 0 },
  { built: EVERY_RUNG, hurt: 12 },
  { built: ['recovery-bay-1', 'quarantine-ward'], hurt: 3 },
  // Bill's cabinet: a first deal, the second pair of units carried in, and
  // every shelf and every crate full.
  { built: [], hurt: 0, traded: 1 },
  { built: [], hurt: 0, traded: 60 },
  { built: EVERY_RUNG, hurt: 0, traded: 400 },
] as const;

describe('the rooms behind the base doors', () => {
  it('puts one room behind every door, under the same name, opening the same screen', () => {
    for (const door of BASE_DOORS) {
      const inside = room(door.id);
      expect([door.id, inside.name, inside.screen]).toEqual([door.id, door.name, door.screen]);
    }
    // And every room is behind a door, or up the stairs from a room that is.
    for (const each of BASE_ROOMS) {
      const reached =
        BASE_DOORS.some((door) => door.id === each.id) ||
        BASE_ROOMS.some(
          (other) =>
            BASE_DOORS.some((door) => door.id === other.id) &&
            other.stairs.some((stair) => stair.to === each.id),
        );
      expect([each.id, reached]).toEqual([each.id, true]);
    }
  });

  /** A room with nobody in it opens no screen: what it is for is what stands in it. */
  it('gives a screen to every room with a keeper, and to no other', () => {
    for (const each of BASE_ROOMS) {
      expect([each.id, each.screen === null]).toEqual([each.id, each.keeper === null]);
    }
  });

  /**
   * FireRed rooms stand still in the middle of the screen, and the smallest
   * stage the game is authored against is 320x240: a room that did not fit it
   * would scroll, and would not look like the room it is dressed as.
   */
  it('fits every room on the smallest stage', () => {
    for (const each of BASE_ROOMS) {
      expect([each.id, each.width * TILE_SIZE <= BASE_STAGE_WIDTH]).toEqual([each.id, true]);
      expect([each.id, each.height * TILE_SIZE <= BASE_STAGE_HEIGHT]).toEqual([each.id, true]);
    }
  });

  it('lays the mat on the bottom row, so a push south from it is the way out', () => {
    for (const each of BASE_ROOMS.filter((candidate) => candidate.mat !== null)) {
      const built = buildRoom(each, baseGame());
      const mat = matOf(each);
      expect([each.id, mat.y]).toEqual([each.id, each.height - 1]);
      expect([each.id, built.collision[mat.y][mat.x]]).toEqual([each.id, false]);
    }
  });

  /**
   * The keeper is who the room is for, so they can always be walked up to -
   * and nothing they stand on or beside is a wall anybody else needs. Asked in
   * every state a room can be in, because what Brock builds stands in rooms.
   */
  it('reaches the keeper and every tile of every room from the mat, whatever is built', () => {
    for (const state of STATES) {
      const game = baseGame(state);
      for (const each of KEEPER_ROOMS) {
        const built = buildRoom(each, game);
        const keeper = keeperOf(each).position;
        expect([each.id, built.collision[keeper.y][keeper.x]]).toEqual([each.id, false]);
        expect([each.id, key(keeper) === key(matOf(each))]).toEqual([each.id, false]);
        const steps = stepsFrom(built.collision, matOf(each), (tile) => key(tile) === key(keeper));
        expect([each.id, stepsTo(steps, servingTiles(each, built.collision)) < Infinity]).toEqual([
          each.id,
          true,
        ]);
        for (let y = 0; y < each.height; y += 1) {
          for (let x = 0; x < each.width; x += 1) {
            if (built.collision[y][x] || key({ x, y }) === key(keeper)) continue;
            expect([each.id, state.built.length, x, y, steps[y][x] < Infinity]).toEqual([
              each.id,
              state.built.length,
              x,
              y,
              true,
            ]);
          }
        }
      }
    }
  });

  /**
   * The captain's rule for the base: walking must never become a toll for a
   * player re-kitting many times an hour. The screen is one key from the mat,
   * so the toll is the yard; the room only asks a few steps of a player who
   * wants to walk up to the keeper and look at what is standing there.
   */
  it('keeps every keeper a short walk from the door, and every door where it was', () => {
    const game = baseGame({ built: EVERY_RUNG });
    // Seven from the middle of the yard (`baseMap.test.ts`), and from the
    // quay no further than the Center and the workshop were before any door
    // had a room behind it.
    const limits: Record<string, number> = { 'the yard': 7, 'the quay (home from a raid)': 11 };
    for (const start of BASE_STARTS) {
      for (const walk of walksToKeepers(start.tile, game)) {
        expect([start.name, walk.door.id, walk.yard <= limits[start.name]]).toEqual([
          start.name,
          walk.door.id,
          true,
        ]);
        expect([walk.door.id, walk.acrossTheRoom <= 4]).toEqual([walk.door.id, true]);
      }
    }
  });

  it('gives every thing in a room a tile to stand beside and read it from', () => {
    for (const state of STATES) {
      const game = baseGame(state);
      for (const each of BASE_ROOMS) {
        const built = buildRoom(each, game);
        for (const thing of built.things) {
          const beside = thing.tiles.some((tile) =>
            [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ].some(([dx, dy]) => built.collision[tile.y + dy]?.[tile.x + dx] === false),
          );
          expect([each.id, thing.name, beside]).toEqual([each.id, thing.name, true]);
          for (const tile of thing.tiles) {
            expect([each.id, thing.name, built.collision[tile.y][tile.x]]).toEqual([
              each.id,
              thing.name,
              true,
            ]);
          }
        }
      }
    }
  });
});

describe("Brock's workshop, where the whole ladder can be seen", () => {
  it('has a bay for every rung, and one only', () => {
    expect(WORKSHOP_DISPLAY.map((display) => display.upgradeId).sort()).toEqual(
      [...EVERY_RUNG].sort(),
    );
  });

  it('keeps every bay to itself, clear of the keeper and the mat', () => {
    const workshop = room('brocks-workshop');
    const taken = new Map<string, string>([
      [key(keeperOf(workshop).position), 'keeper'],
      [key(matOf(workshop)), 'mat'],
    ]);
    for (const display of WORKSHOP_DISPLAY) {
      for (const tile of propTiles(display.props)) {
        expect([key(tile), taken.get(key(tile)) ?? display.upgradeId]).toEqual([
          key(tile),
          display.upgradeId,
        ]);
        taken.set(key(tile), display.upgradeId);
      }
    }
  });

  /** A rung you cannot see is the bookkeeping the rooms exist to replace. */
  it('stands something new in the room for every rung built, and nothing before', () => {
    const workshop = room('brocks-workshop');
    const empty = buildRoom(workshop, baseGame());
    expect(empty.things).toEqual([]);
    for (const upgrade of WORKSHOP_UPGRADES) {
      const built = buildRoom(workshop, baseGame({ built: [upgrade.id] }));
      let changed = 0;
      for (let y = 0; y < workshop.height; y += 1) {
        for (let x = 0; x < workshop.width; x += 1) {
          if (built.layers.detail.tiles[y][x] !== empty.layers.detail.tiles[y][x]) changed += 1;
        }
      }
      expect([upgrade.id, changed > 0]).toEqual([upgrade.id, true]);
      expect(built.things.map((thing) => thing.upgradeId)).toEqual([upgrade.id]);
    }
  });
});

describe('the Pokémon Center, which shows who is being treated', () => {
  const center = room('pokemon-centre');

  it('sets a Poké Ball on the counter for everyone waiting, as many as it holds', () => {
    const count = (waiting: number) =>
      restingBalls(waiting).reduce((sum, sprite) => sum + (sprite.piece === 'ball.two' ? 2 : 1), 0);
    expect(count(0)).toBe(0);
    expect(count(1)).toBe(1);
    expect(count(5)).toBe(5);
    expect(count(COUNTER_BALLS + 4)).toBe(COUNTER_BALLS);
    for (const sprite of restingBalls(COUNTER_BALLS)) {
      expect(center.counter.some((tile) => key(tile) === key(sprite))).toBe(true);
      // Never on the cell of the counter Joy is served across.
      expect(sprite.x).not.toBe(keeperOf(center).position.x);
    }
  });

  it('says how many are waiting over the counter, and says nothing when nobody is', () => {
    expect(buildRoom(center, baseGame()).things).toEqual([]);
    const waiting = buildRoom(center, baseGame({ hurt: 3 }));
    expect(waiting.things.map((thing) => thing.name)).toEqual(['3 POKÉ BALLS']);
    expect(waiting.sprites.length).toBeGreaterThan(0);
  });

  it('stands what Brock fitted there once it is built', () => {
    for (const display of CENTER_DISPLAY) {
      expect(EVERY_RUNG).toContain(display.upgradeId);
      const built = buildRoom(center, baseGame({ built: [display.upgradeId] }));
      expect(built.things.map((thing) => thing.upgradeId)).toEqual([display.upgradeId]);
    }
  });
});

/**
 * Two pieces of work fill these rooms - the wall map in Oak's Lab and the
 * oddities on Bill's shelves - and the room is built so that neither has to
 * move anything to do it. These hold the space they were promised.
 */
describe('the hooks the rooms leave for what comes next', () => {
  it("hangs the wall map on the stretch of Oak's wall kept bare for it", () => {
    const lab = room('oaks-lab');
    const game = baseGame({ built: EVERY_RUNG });
    const built = buildRoom(lab, game);
    const plain = buildRoom(lab, baseGame()).layers.ground;
    for (let y = OAK_WALL_MAP.y; y < OAK_WALL_MAP.y + OAK_WALL_MAP.height; y += 1) {
      for (let x = OAK_WALL_MAP.x; x < OAK_WALL_MAP.x + OAK_WALL_MAP.width; x += 1) {
        // Wall, both rows of it, with the plain wall drawn and no tile over
        // it: the map is painted there by the scene, from the save.
        expect([x, y, built.collision[y][x]]).toEqual([x, y, true]);
        expect([x, y, plain.tiles[y][x] >= 0]).toEqual([x, y, true]);
        expect([x, y, built.layers.detail.tiles[y][x]]).toEqual([x, y, -1]);
      }
    }
    expect(built.wallMap).toEqual(OAK_WALL_MAP);
    // The one room it hangs in.
    for (const other of BASE_ROOMS.filter((each) => each.id !== 'oaks-lab')) {
      expect(buildRoom(other, game).wallMap).toBeNull();
    }
  });

  it('opens the wall map from the floor in front of it, and captions the whole board', () => {
    const lab = room('oaks-lab');
    const built = buildRoom(lab, baseGame());
    const board = built.things.find((thing) => thing.opens === 'wall-map')!;
    expect(board.name).toBe('THE WALL MAP');
    expect(board.tiles).toEqual(WALL_MAP_TILES);
    // Every tile of the board's lower row can be faced from a floor tile in
    // front of it, so the key the hint names works wherever the player stands
    // under it - the trap is a board that answers only from its middle.
    const foot = OAK_WALL_MAP.y + OAK_WALL_MAP.height - 1;
    for (let x = OAK_WALL_MAP.x; x < OAK_WALL_MAP.x + OAK_WALL_MAP.width; x += 1) {
      expect(board.tiles.some((tile) => tile.x === x && tile.y === foot)).toBe(true);
      expect([x, built.collision[foot + 1][x]]).toEqual([x, false]);
      expect(Number.isFinite(stepsFrom(built.collision, matOf(lab))[foot + 1][x])).toBe(true);
    }
  });

  it("stands Bill's cabinet empty until something is traded to him", () => {
    const cottage = room('bills-cottage');
    const built = buildRoom(cottage, baseGame());
    const shelf = BASE_PIECES['lab.shelvesEmpty'];
    expect(CABINET_UNIT_SIZE).toEqual({ width: shelf.width, height: shelf.height });
    expect(built.cabinet?.layout.units).toBe(CABINET_UNITS_AT_START);
    expect(built.cabinet?.layout.placed).toEqual([]);
    for (let unit = 0; unit < CABINET_UNITS_AT_START; unit += 1) {
      for (const tile of unitTiles(unit)) {
        expect([tile, built.collision[tile.y][tile.x], built.layers.detail.tiles[tile.y][tile.x] >= 0]).toEqual([
          tile,
          true,
          true,
        ]);
      }
    }
    // The floor the second pair is carried in onto is bare until it is.
    for (let unit = CABINET_UNITS_AT_START; unit < CABINET_UNITS.length; unit += 1) {
      for (const tile of unitTiles(unit)) {
        expect([tile, built.collision[tile.y][tile.x]]).toEqual([tile, false]);
      }
    }
  });
});

describe('THE BOLTHOLE, the player\'s own house', () => {
  const downstairs = room('bolthole');
  const upstairs = room('bolthole-upstairs');

  it('is nobody\'s counter: no keeper, no screen, the door mat downstairs', () => {
    for (const each of [downstairs, upstairs]) {
      expect([each.id, each.keeper, each.screen]).toEqual([each.id, null, null]);
    }
    expect(downstairs.mat).not.toBeNull();
    // Upstairs is reached by the stairs and left by them.
    expect(upstairs.mat).toBeNull();
  });

  /**
   * FireRed's stairs: stepping onto the orange mat climbs them, and the
   * player arrives on the matching mat upstairs. Each stair has to lead to a
   * room with a stair back, or the player is stranded on the floor it took
   * them to.
   */
  it('joins its two floors with a stair each way, on ground the player can stand on', () => {
    for (const each of BASE_ROOMS) {
      const built = buildRoom(each, baseGame());
      for (const stair of each.stairs) {
        const to = room(stair.to);
        const arrival = stairArrival(each.id, to);
        expect([each.id, stair.to, arrival !== undefined]).toEqual([each.id, stair.to, true]);
        expect([each.id, built.collision[stair.tile.y][stair.tile.x]]).toEqual([each.id, false]);
        // Never the mat: the mat is the way out of the house.
        expect([each.id, each.mat !== null && key(each.mat) === key(stair.tile)]).toEqual([
          each.id,
          false,
        ]);
      }
    }
    expect(downstairs.stairs.map((stair) => stair.to)).toEqual(['bolthole-upstairs']);
    expect(upstairs.stairs.map((stair) => stair.to)).toEqual(['bolthole']);
  });

  it('reaches every tile of both floors from where the player comes in', () => {
    for (const state of STATES) {
      const game = baseGame(state);
      for (const each of [downstairs, upstairs]) {
        const built = buildRoom(each, game);
        for (const entrance of entrancesOf(each)) {
          const steps = stepsFrom(built.collision, entrance);
          for (let y = 0; y < each.height; y += 1) {
            for (let x = 0; x < each.width; x += 1) {
              if (built.collision[y][x]) continue;
              expect([each.id, x, y, steps[y][x] < Infinity]).toEqual([each.id, x, y, true]);
            }
          }
        }
      }
    }
  });

  /**
   * The stairs are near the door, as the player's house in FireRed has them:
   * the house is somewhere to look round, not a walk.
   */
  it('keeps the stairs a short walk from the door mat', () => {
    const built = buildRoom(downstairs, baseGame());
    const steps = stepsFrom(built.collision, matOf(downstairs));
    expect(stepsTo(steps, downstairs.stairs.map((stair) => stair.tile))).toBeLessThanOrEqual(12);
  });

  it('gives everything in the house something to say when it is faced', () => {
    for (const each of [downstairs, upstairs]) {
      const built = buildRoom(each, baseGame());
      expect(built.things.length).toBeGreaterThan(0);
      for (const thing of built.things) {
        expect([each.id, thing.name, (thing.lines ?? []).length > 0]).toEqual([each.id, thing.name, true]);
      }
    }
  });

  /**
   * The badge case and the pennants are pictures of the save painted on wall
   * the room keeps bare for them, as the wall map is in Oak's Lab: nothing
   * planted over that wall, the plain wall drawn under it, and each read from
   * the floor in front of it.
   */
  it.each([
    ['bolthole', BADGE_CASE_WALL, 'badge-case', 'THE BADGE CASE'],
    ['bolthole-upstairs', PENNANT_WALL, 'pennants', 'PENNANTS'],
  ] as const)('keeps a bare stretch of wall in %s for what hangs there', (id, wall, kind, name) => {
    const inside = room(id);
    const built = buildRoom(inside, baseGame({ built: EVERY_RUNG }));
    for (const tile of wallTiles(wall)) {
      expect([tile, built.collision[tile.y][tile.x]]).toEqual([tile, true]);
      expect([tile, built.layers.ground.tiles[tile.y][tile.x] >= 0]).toEqual([tile, true]);
      expect([tile, built.layers.detail.tiles[tile.y][tile.x]]).toEqual([tile, -1]);
    }
    expect(built.posters).toEqual([{ kind, area: wall }]);
    const thing = built.things.find((each) => each.name === name)!;
    expect(thing.tiles).toEqual(wallTiles(wall));
    // Every tile of its lower row can be faced from the floor under it.
    const foot = wall.y + wall.height - 1;
    const steps = stepsFrom(built.collision, entrancesOf(inside)[0]);
    for (let x = wall.x; x < wall.x + wall.width; x += 1) {
      expect([x, built.collision[foot + 1][x]]).toEqual([x, false]);
      expect([x, Number.isFinite(steps[foot + 1][x])]).toEqual([x, true]);
    }
  });

  it('hangs nothing on the walls of any other room', () => {
    for (const each of BASE_ROOMS.filter((candidate) => !candidate.id.startsWith('bolthole'))) {
      expect([each.id, buildRoom(each, baseGame()).posters]).toEqual([each.id, []]);
    }
  });

  /** The rug is the colour of the partner: one piece drawn three ways. */
  it("lays the upstairs rug in the partner's colour", () => {
    const game = baseGame();
    const rugCell = (starterSpeciesId: 'bulbasaur' | 'charmander' | 'squirtle') =>
      buildRoom(upstairs, { ...game, starterSpeciesId }).layers.detail.tiles[5][6];
    const colours = new Set([rugCell('bulbasaur'), rugCell('charmander'), rugCell('squirtle')]);
    expect(colours.size).toBe(3);
  });

  it('sleeps in the bed and plays the console, and nothing else in the house does anything', () => {
    const things = [downstairs, upstairs].flatMap((each) => buildRoom(each, baseGame()).things);
    expect(things.filter((thing) => thing.does === 'sleep').map((thing) => thing.name)).toEqual(['YOUR BED']);
    expect(things.filter((thing) => thing.does === 'play').map((thing) => thing.name)).toEqual(['THE CONSOLE']);
  });

  /**
   * The house follows the player's clock: a window for the hour and a
   * decoration for the month. Every combination has to leave the house as
   * walkable as it was, because the room is built from whatever time it is.
   */
  const MOMENTS = [
    new Date(2026, 5, 15, 12),
    new Date(2026, 5, 15, 19),
    new Date(2026, 5, 15, 23),
    new Date(2026, 9, 31, 22),
    new Date(2026, 11, 24, 18),
  ];

  it('stays walkable everywhere at every hour of every month it dresses up for', () => {
    for (const now of MOMENTS) {
      for (const each of [downstairs, upstairs]) {
        const built = buildRoom(each, baseGame(), now);
        for (const entrance of entrancesOf(each)) {
          const steps = stepsFrom(built.collision, entrance);
          for (let y = 0; y < each.height; y += 1) {
            for (let x = 0; x < each.width; x += 1) {
              if (built.collision[y][x]) continue;
              expect([now.toISOString(), each.id, x, y, steps[y][x] < Infinity]).toEqual([
                now.toISOString(),
                each.id,
                x,
                y,
                true,
              ]);
            }
          }
        }
        // And the stairs and the mat are never what a decoration is put on.
        for (const tile of entrancesOf(each)) {
          expect([now.toISOString(), each.id, built.collision[tile.y][tile.x]]).toEqual([
            now.toISOString(),
            each.id,
            false,
          ]);
        }
      }
    }
  });

  it('draws a different window for day, dusk and night', () => {
    const windowAt = (now: Date) => buildRoom(downstairs, baseGame(), now).layers.detail.tiles[1][6];
    const [day, dusk, night] = [12, 19, 23].map((hour) => windowAt(new Date(2026, 5, 15, hour)));
    expect(new Set([day, dusk, night]).size).toBe(3);
  });

  it('puts a pumpkin by the door all October and a tree in the corner all December', () => {
    const things = (now: Date) => buildRoom(downstairs, baseGame(), now).things.map((thing) => thing.name);
    expect(things(new Date(2026, 9, 1, 12))).toContain('A PUMPKIN');
    expect(things(new Date(2026, 9, 1, 12))).not.toContain('THE TREE');
    expect(things(new Date(2026, 11, 1, 12))).toContain('THE TREE');
    expect(things(new Date(2026, 11, 1, 12))).not.toContain('A PUMPKIN');
    for (const name of ['A PUMPKIN', 'THE TREE']) {
      expect(things(new Date(2026, 5, 1, 12))).not.toContain(name);
    }
    const october = buildRoom(downstairs, baseGame(), new Date(2026, 9, 31, 20));
    expect(october.collision[PUMPKIN_SPOT.y][PUMPKIN_SPOT.x]).toBe(true);
    const june = buildRoom(downstairs, baseGame(), new Date(2026, 5, 1, 12));
    expect(june.collision[PUMPKIN_SPOT.y][PUMPKIN_SPOT.x]).toBe(false);
  });
});
