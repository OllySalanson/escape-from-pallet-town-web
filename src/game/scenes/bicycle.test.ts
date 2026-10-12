import { describe, expect, it, vi } from 'vitest';

/**
 * The Bicycle, driven through the real WorldScene: ridden from the pack, twice
 * the pace, and not one price a step pays changed by it - the hunter still
 * takes its step for every tile, tall grass still rolls once a tile, and the
 * hunter's idle step still counts only time stood still. Off it at a room's
 * door, never on it in one, and never ridden once it has left the pack.
 */

class FakeKey {
  public isDown = false;
  public justDown = false;
  public on(): this {
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      public constructor(key?: string) {
        this.key = key;
      }
      public key?: string;
    },
    Math: {
      Vector2: class {
        public x = 0;
        public y = 0;
        public set(x: number, y: number): this {
          this.x = x;
          this.y = y;
          return this;
        }
      },
      Linear: (from: number, to: number, t: number) => from + (to - from) * t,
    },
    Input: {
      Keyboard: {
        JustDown: (key: FakeKey | undefined) => Boolean(key?.justDown),
        KeyCodes: { SPACE: 32, ENTER: 13, P: 80, B: 66, K: 75, O: 79 },
      },
    },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: {
      Scene2D: {
        Events: {
          FADE_OUT_COMPLETE: 'camerafadeoutcomplete',
          FADE_IN_COMPLETE: 'camerafadeincomplete',
        },
      },
    },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

// The bell is what getting on sounds like; what is under test is the ride.
const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

vi.mock('../ui/DialogBox', () => ({
  DialogBox: class {
    public visible = false;
    public isCurrentMessageComplete = true;
    public setScrollFactor(): this {
      return this;
    }
    public setVisible(value: boolean): this {
      this.visible = value;
      return this;
    }
    public showMessage(): void {
      this.visible = true;
    }
    public showMessages(): void {
      this.visible = true;
    }
    public advance(): void {}
    public skip(): void {}
    public update(): void {}
  },
}));

import { Bag } from '../items';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, requireInsertion } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { BIKE_STEP_DURATION_MS, BIKE_TEXTURE, BIKE_WORDS } from '../world/bicycle';
import { HUNTER_IDLE_STEP_MS, type HunterState } from '../world/hunter';
import { placedAreaAt } from '../world/mapAreas';
import type { MapWarp, WorldMapDefinition } from '../worldMap';
import { WorldScene } from './WorldScene';

/** A display object that answers every chainable setter with itself. */
const chainable = (): never => {
  const members: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(members, {
    get: (target, property) => {
      if (property === 'height' || property === 'width') return 10;
      if (property === 'text') return '';
      if (property === 'frame') return { name: 0 };
      if (!(property in target)) {
        target[property as string] = vi.fn(() => proxy);
      }
      return target[property as string];
    },
  });
  return proxy as never;
};

const makeControls = (): Record<string, FakeKey> => {
  const controls: Record<string, FakeKey> = {};
  for (const name of ['up', 'down', 'left', 'right', 'w', 'a', 's', 'd']) {
    controls[name] = new FakeKey();
  }
  return controls;
};

const attachSceneStubs = (scene: WorldScene, controls: Record<string, FakeKey>): void => {
  Object.assign(scene as unknown as Record<string, unknown>, {
    // A Pokemon standing in the world - a legend (`world/legends.ts`) - bobs on
    // an animation of its own.
    anims: { exists: vi.fn(() => true), create: vi.fn() },
    add: {
      sprite: vi.fn(() => chainable()),
      rectangle: vi.fn(() => chainable()),
      image: vi.fn(() => chainable()),
      text: vi.fn(() => chainable()),
      container: vi.fn(() => chainable()),
      graphics: vi.fn(() => chainable()),
    },
    scale: { width: BASE_STAGE_WIDTH, height: BASE_STAGE_HEIGHT, on: vi.fn(), off: vi.fn() },
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        flash: vi.fn(),
        shake: vi.fn(),
        once: vi.fn((_event: string, callback: () => void) => callback()),
        setBackgroundColor: vi.fn(),
        setBounds: vi.fn(),
        setRoundPixels: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
        centerOn: vi.fn(),
        worldView: { left: 0, right: BASE_STAGE_WIDTH, top: 0, bottom: BASE_STAGE_HEIGHT },
      },
    },
    game: { loop: { frame: 0 } },
    input: {
      keyboard: {
        addCapture: vi.fn(),
        addKey: vi.fn((code: number) => controls[String(code)] ?? new FakeKey()),
        addKeys: vi.fn(() => ({ W: controls.w, A: controls.a, S: controls.s, D: controls.d })),
        createCursorKeys: vi.fn(() => ({
          up: controls.up,
          down: controls.down,
          left: controls.left,
          right: controls.right,
        })),
        on: vi.fn(),
      },
    },
    make: {
      tilemap: vi.fn(() => ({
        addTilesetImage: vi.fn(() => ({})),
        createBlankLayer: vi.fn(() => ({
          putTilesAt: vi.fn(),
          setDepth: vi.fn(),
          forEachTile: vi.fn(),
          setAlpha: vi.fn(),
        })),
      })),
    },
    scene: {
      start: vi.fn(),
      launch: vi.fn(),
      pause: vi.fn(),
      manager: { keys: { base: {}, extraction: {} } },
    },
    events: { once: vi.fn(), on: vi.fn() },
    time: { now: 0, delayedCall: vi.fn((_delayMs: number, callback: () => void) => callback()) },
    tweens: { add: vi.fn(() => chainable()), addCounter: vi.fn(() => chainable()) },
  });
};

/** The parts of the scene these tests read and drive, which are private to it. */
interface Driven {
  currentTile: GridPosition;
  targetTile: GridPosition | null;
  facing: Direction;
  riding: boolean;
  bag: Bag;
  currentMap: WorldMapDefinition;
  hunterState: HunterState;
  runSession: ActiveRunSession;
  dialogBox: { visible: boolean };
  player: { setTexture: ReturnType<typeof vi.fn> };
  scene: { launch: ReturnType<typeof vi.fn> };
  isBlocked(tile: GridPosition): boolean;
  openBag(): void;
  walkThrough(warp: MapWarp): void;
  advanceRunClock(deltaMs: number): void;
}

interface BikeArg {
  readonly riding: boolean;
  readonly toggle: () => string | null;
}

/** Drops into the Floodplain, briefing read, with this pack. */
function dropIn(pack: Record<string, number>, runSession?: ActiveRunSession) {
  const controls = makeControls();
  const scene = new WorldScene();
  attachSceneStubs(scene, controls);
  const manager = runSession?.manager ?? new RunManager();
  const team = new PokemonParty([new Pokemon(CHARMANDER, 10)]);
  if (!runSession) {
    manager.startRun(
      { party: team.pokemon, items: [] },
      { mapId: requireInsertion('floodplain-relay').mapId, durationMs: RAID_DURATION_MS },
    );
  }
  const session =
    runSession ??
    createActiveRunSession(manager, {}, {}, [], [], [], generateRunPlan(7, undefined, 'floodplain-relay', undefined), []);
  session.firstDeploymentBriefingShown = true;
  scene.create({ party: team, bag: new Bag(pack), runSession: session });
  const driven = scene as unknown as Driven;
  driven.dialogBox.visible = false;
  // What a tile holds when the player arrives on it is not what these tests
  // are about, only what every step pays: nothing on the way is picked up,
  // worked or fought, and the grass is asked - and counted - but rolls nothing.
  const rolls = vi.fn(() => undefined);
  Object.assign(scene as unknown as Record<string, unknown>, {
    tryCollectLootAt: () => null,
    tryMakeContractStopAt: () => null,
    tryReachDropInAt: () => null,
    tryActivatePoiAt: () => null,
    tryExtract: () => false,
    tryTrainerChallengeAt: () => false,
    encountersAtCurrentTile: rolls,
  });
  return { scene, driven, controls, manager, rolls, session };
}

/** The pack's USE or WALK on the Bicycle, exactly as the bag is handed it. */
function pressBikeInPack(driven: Driven): string | null {
  driven.openBag();
  const data = driven.scene.launch.mock.calls.at(-1)![1] as { bike: BikeArg };
  return data.bike.toggle();
}

/** A straight run of open ground with no door on it, `length` tiles east of where it starts. */
function openRun(driven: Driven, length: number): GridPosition {
  const map = driven.currentMap;
  const doorway = (tile: GridPosition) =>
    map.warps.some((warp) => warp.source.x === tile.x && warp.source.y === tile.y);
  const outdoors = (tile: GridPosition) => (placedAreaAt(map.areas ?? [], tile)?.kind ?? 'outdoors') === 'outdoors';
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x + length < map.width - 1; x += 1) {
      const tiles = Array.from({ length: length + 1 }, (_, step) => ({ x: x + step, y }));
      if (tiles.every((tile) => !driven.isBlocked(tile) && !doorway(tile) && outdoors(tile))) {
        return tiles[0];
      }
    }
  }
  throw new Error(`No straight run of ${length} open tiles on ${map.id}.`);
}

/** Holds a direction for `tiles` steps, a frame at a time, and says how much raid clock it cost. */
function ride(scene: WorldScene, controls: Record<string, FakeKey>, direction: Direction, tiles: number) {
  const driven = scene as unknown as Driven;
  const start = driven.runSession.manager.snapshot().elapsedMs;
  const startSteps = driven.runSession.stepsTaken ?? 0;
  const taken = () => (driven.runSession.stepsTaken ?? 0) - startSteps;
  controls[direction].isDown = true;
  let frames = 0;
  // Held until the last step has begun, then let go so it is the last.
  while (!(taken() === tiles - 1 && driven.targetTile !== null) && frames < 1000) {
    scene.update(0, 10);
    frames += 1;
  }
  controls[direction].isDown = false;
  for (let settle = 0; settle < 40 && driven.targetTile !== null; settle += 1) {
    scene.update(0, 10);
    frames += 1;
  }
  expect(taken()).toBe(tiles);
  return { clockMs: driven.runSession.manager.snapshot().elapsedMs - start, frames };
}

/** A door on the Floodplain that leads into one of its rooms. */
function doorIntoARoom(driven: Driven): MapWarp {
  const map = driven.currentMap;
  const warp = map.warps.find(
    (one) => one.destinationMapId === map.id && placedAreaAt(map.areas ?? [], one.destination)?.kind === 'inside',
  );
  if (!warp) {
    throw new Error('The Floodplain has no door into a room.');
  }
  return warp;
}

describe('getting on and off', () => {
  it('rides from the pack outdoors: FireRed\'s bell, the ridden figure, and the pack closes', () => {
    const { driven } = dropIn({ bicycle: 1 });
    played.length = 0;

    expect(pressBikeInPack(driven)).toBeNull();

    expect(driven.riding).toBe(true);
    expect(driven.runSession.riding).toBe(true);
    expect(played).toContain('bikeBell');
    expect(driven.player.setTexture).toHaveBeenLastCalledWith(BIKE_TEXTURE, expect.any(Number));
    // And WALK is off it again, without a bell.
    played.length = 0;
    expect(pressBikeInPack(driven)).toBeNull();
    expect(driven.riding).toBe(false);
    expect(played).not.toContain('bikeBell');
  });

  it('will not be ridden inside a building, in Professor Oak\'s own words', () => {
    const { driven } = dropIn({ bicycle: 1 });
    driven.currentTile = { ...doorIntoARoom(driven).destination };

    expect(pressBikeInPack(driven)).toBe(BIKE_WORDS.notHere);
    expect(driven.riding).toBe(false);
  });

  it('puts the player on foot going through a door into a room, and they come back out on foot', () => {
    const { driven } = dropIn({ bicycle: 1 });
    pressBikeInPack(driven);
    const door = doorIntoARoom(driven);

    driven.walkThrough(door);
    expect(driven.riding).toBe(false);
    expect(driven.runSession.riding).toBe(false);
  });

  it('is not ridden once it has left the pack, put down there or dropped in a fight', () => {
    const { driven } = dropIn({ bicycle: 1 });
    pressBikeInPack(driven);
    const data = driven.scene.launch.mock.calls.at(-1)![1] as { onItemUsed: () => void };

    driven.bag.remove('bicycle');
    data.onItemUsed();

    expect(driven.riding).toBe(false);
  });

  it('is still ridden when the world is rebuilt after a fight, if it is still in the pack', () => {
    const first = dropIn({ bicycle: 1 });
    pressBikeInPack(first.driven);

    expect(dropIn({ bicycle: 1 }, first.session).driven.riding).toBe(true);
    // A catch that made room by putting the Bicycle down comes back on foot.
    expect(dropIn({ potion: 1 }, first.session).driven.riding).toBe(false);
  });
});

describe('what a ridden step costs', () => {
  it('is twice the pace: half the raid clock a walked tile costs, which is all the Bicycle buys', () => {
    const tiles = 8;
    const walker = dropIn({ bicycle: 1 });
    walker.driven.currentTile = openRun(walker.driven, tiles);
    const walked = ride(walker.scene, walker.controls, 'right', tiles);

    const rider = dropIn({ bicycle: 1 });
    rider.driven.currentTile = openRun(rider.driven, tiles);
    pressBikeInPack(rider.driven);
    const ridden = ride(rider.scene, rider.controls, 'right', tiles);

    // To within the one 10ms frame the first press is read on.
    const FRAME_MS = 10;
    expect(walked.clockMs - tiles * STEP_DURATION_MS).toBeGreaterThanOrEqual(0);
    expect(walked.clockMs - tiles * STEP_DURATION_MS).toBeLessThanOrEqual(FRAME_MS);
    expect(ridden.clockMs - tiles * BIKE_STEP_DURATION_MS).toBeGreaterThanOrEqual(0);
    expect(ridden.clockMs - tiles * BIKE_STEP_DURATION_MS).toBeLessThanOrEqual(FRAME_MS);
    expect(BIKE_STEP_DURATION_MS * 2).toBe(STEP_DURATION_MS);
  });

  it('is still one step: counted, and one roll of the grass a tile', () => {
    const tiles = 6;
    const { scene, driven, controls, rolls } = dropIn({ bicycle: 1 });
    driven.currentTile = openRun(driven, tiles);
    pressBikeInPack(driven);
    const steps = driven.runSession.stepsTaken ?? 0;

    ride(scene, controls, 'right', tiles);

    expect((driven.runSession.stepsTaken ?? 0) - steps).toBe(tiles);
    expect(rolls).toHaveBeenCalledTimes(tiles);
  });

  it('pays the hunter its step for every tile ridden, and never an idle step on top', () => {
    const { scene, driven, controls } = dropIn({ bicycle: 1 });
    const start = openRun(driven, 2);
    driven.currentTile = start;
    pressBikeInPack(driven);
    // Out on the map and far off, and its walk counted rather than taken, so
    // the count is the whole of what is being asked.
    driven.hunterState = { spawned: true, defeated: false, mapId: driven.currentMap.id, position: { x: 0, y: 0 } };
    let hunterSteps = 0;
    Object.assign(scene as unknown as Record<string, unknown>, {
      isHunterOnCurrentMap: () => true,
      advanceHunterPursuit: () => {
        hunterSteps += 1;
      },
    });

    // Well past the idle interval of clock, riding the whole time.
    const tiles = Math.ceil((HUNTER_IDLE_STEP_MS * 1.5) / BIKE_STEP_DURATION_MS);
    let ridden = 0;
    while (ridden < tiles) {
      ride(scene, controls, ridden % 2 === 0 ? 'right' : 'left', 1);
      ridden += 1;
    }

    expect(driven.currentTile).toEqual(start);
    expect(hunterSteps).toBe(tiles);
  });

  it('leaves the hunter\'s idle step exactly as it is for somebody standing still on it', () => {
    const idleStepsFor = (onBike: boolean): number => {
      const { scene, driven } = dropIn({ bicycle: 1 });
      if (onBike) {
        pressBikeInPack(driven);
      }
      driven.hunterState = { spawned: true, defeated: false, mapId: driven.currentMap.id, position: { x: 0, y: 0 } };
      let hunterSteps = 0;
      Object.assign(scene as unknown as Record<string, unknown>, {
        isHunterOnCurrentMap: () => true,
        advanceHunterPursuit: () => {
          hunterSteps += 1;
        },
      });
      for (let ms = 0; ms < HUNTER_IDLE_STEP_MS * 2; ms += 10) {
        driven.advanceRunClock(10);
      }
      return hunterSteps;
    };

    expect(idleStepsFor(true)).toBe(2);
    expect(idleStepsFor(false)).toBe(2);
  });
});
