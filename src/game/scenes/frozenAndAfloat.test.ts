import { describe, expect, it, vi } from 'vitest';

/**
 * Ice and the sea, driven through the real WorldScene. A step onto ice carries
 * on until something stops it, every carried tile a whole step of the raid
 * and only the last one rolling the grass; and a boat, asked before it is
 * boarded, carries the player tile by tile to the far jetty at walking pace,
 * and will not sail outside its tide.
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

// What is under test is where the player ends up, not what it sounds like.
const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

// The question before boarding: what the scene would do with each answer is
// what is asked of it, so the prompt only remembers how to give one.
const prompts: { lines: readonly string[]; onChoose: (index: number) => void }[] = [];
vi.mock('../ui/ChoicePrompt', () => ({
  ChoicePrompt: class {
    public constructor(_scene: unknown, options: { lines: readonly string[]; onChoose: (index: number) => void }) {
      prompts.push(options);
    }
    public destroy(): void {}
    public moveSelection(): void {}
    public confirm(): void {}
  },
}));

const shown: string[][] = [];
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
    public showMessage(message: string): void {
      shown.push([message]);
      this.visible = true;
    }
    public showMessages(messages: string[]): void {
      shown.push([...messages]);
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
import { placedAreaAt } from '../world/mapAreas';
import { sailingOf, type MapSailing } from '../world/sailing';
import type { Material } from '../world/tileset/materials';
import type { WorldMapDefinition } from '../worldMap';
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
    textures: { get: vi.fn(() => ({ has: vi.fn(() => true), add: vi.fn() })) },
  });
};

/** The parts of the scene these tests read and drive, which are private to it. */
interface Driven {
  currentTile: GridPosition;
  targetTile: GridPosition | null;
  facing: Direction;
  currentMap: WorldMapDefinition;
  runSession: ActiveRunSession;
  dialogBox: { visible: boolean };
  voyaging: unknown;
  isBlocked(tile: GridPosition): boolean;
  tryBoard(facing: Direction, asked: boolean): boolean;
  createBoats(): void;
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


/** A straight run of open ground with no door on it, `length` tiles east of where it starts. */
function openRun(driven: Driven, length: number): GridPosition[] {
  const map = driven.currentMap;
  const doorway = (tile: GridPosition) =>
    map.warps.some((warp) => warp.source.x === tile.x && warp.source.y === tile.y);
  const outdoors = (tile: GridPosition) => (placedAreaAt(map.areas ?? [], tile)?.kind ?? 'outdoors') === 'outdoors';
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x + length < map.width - 1; x += 1) {
      const tiles = Array.from({ length: length + 1 }, (_, step) => ({ x: x + step, y }));
      if (tiles.every((tile) => !driven.isBlocked(tile) && !doorway(tile) && outdoors(tile))) {
        return tiles;
      }
    }
  }
  throw new Error(`No straight run of ${length} open tiles on ${map.id}.`);
}

/** The map the player is on, its ground under `tiles` turned to ice. */
function freeze(driven: Driven, tiles: readonly GridPosition[]): void {
  const terrain: Material[][] = driven.currentMap.terrain.map((row) => [...row]);
  for (const tile of tiles) terrain[tile.y][tile.x] = 'ice';
  driven.currentMap = { ...driven.currentMap, terrain };
}

/** One tap of a direction, then frames until the player is standing still. */
function press(scene: WorldScene, controls: Record<string, FakeKey>, direction: Direction): number {
  const driven = scene as unknown as Driven;
  controls[direction].isDown = true;
  scene.update(0, 10);
  controls[direction].isDown = false;
  let frames = 1;
  while (driven.targetTile !== null && frames < 500) {
    scene.update(0, 10);
    frames += 1;
  }
  return frames;
}

describe('ice', () => {
  it('carries one press across the ice to the ground beyond, every tile a step and one roll at the end', () => {
    const { scene, driven, controls, rolls } = dropIn({});
    const run = openRun(driven, 6);
    freeze(driven, run.slice(1, 6));
    driven.currentTile = run[0];
    const steps = driven.runSession.stepsTaken ?? 0;
    const clock = driven.runSession.manager.snapshot().elapsedMs;

    press(scene, controls, 'right');

    expect(driven.currentTile).toEqual(run[6]);
    expect((driven.runSession.stepsTaken ?? 0) - steps).toBe(6);
    const spent = driven.runSession.manager.snapshot().elapsedMs - clock;
    expect(spent).toBeGreaterThanOrEqual(6 * STEP_DURATION_MS);
    expect(spent).toBeLessThanOrEqual(6 * STEP_DURATION_MS + 20);
    // Nothing rolls mid-slide: only the tile it stops on.
    expect(rolls).toHaveBeenCalledTimes(1);
  });

  it('stops on the ice against whatever stands in the way, and slides on from there the next press', () => {
    const { scene, driven, controls } = dropIn({});
    const run = openRun(driven, 6);
    freeze(driven, run.slice(1, 7));
    driven.currentTile = run[0];
    const blocked = driven.isBlocked.bind(driven);
    Object.assign(scene as unknown as Record<string, unknown>, {
      isBlocked: (tile: GridPosition) => (tile.x === run[5].x && tile.y === run[5].y) || blocked(tile),
    });

    press(scene, controls, 'right');
    expect(driven.currentTile).toEqual(run[4]);

    // Back the other way it carries on to the ground it came from.
    press(scene, controls, 'left');
    expect(driven.currentTile).toEqual(run[0]);
  });
});

describe('a boat', () => {
  /** A boat between the two ends of an open run, laid on the map the player is on. */
  function moor(driven: Driven, from: number, until: number): { run: GridPosition[]; sailing: MapSailing } {
    const run = openRun(driven, 7);
    const sailing = sailingOf({
      ends: [
        { x: run[0].x, y: run[0].y, toward: 'right', look: 'boat' },
        { x: run[7].x, y: run[7].y, toward: 'left', look: 'boat' },
      ],
      sails: { name: 'The Ice Run', from, until, course: [] },
    });
    driven.currentMap = { ...driven.currentMap, sailings: [sailing] };
    driven.createBoats();
    driven.currentTile = run[0];
    return { run, sailing };
  }

  it('asks first, then carries the player to the far jetty a tile a step, at walking pace', () => {
    const { scene, driven } = dropIn({});
    const { run, sailing } = moor(driven, 0, 300);
    prompts.length = 0;

    expect(driven.tryBoard('right', true)).toBe(true);
    expect(prompts.at(-1)!.lines[0]).toBe('Ahoy, there!');
    prompts.at(-1)!.onChoose(0);
    // "All aboard", read.
    expect(shown.at(-1)![0]).toContain('All aboard');
    driven.dialogBox.visible = false;

    const clock = driven.runSession.manager.snapshot().elapsedMs;
    const steps = driven.runSession.stepsTaken ?? 0;
    for (let frame = 0; frame < 400 && (driven.voyaging || driven.currentTile.x !== run[7].x); frame += 1) {
      scene.update(0, 10);
    }

    expect(driven.voyaging).toBeUndefined();
    expect(driven.currentTile).toEqual(run[7]);
    expect(driven.facing).toBe('right');
    // Six tiles of water and a step ashore: seven steps, charged as walking.
    expect((driven.runSession.stepsTaken ?? 0) - steps).toBe(sailing.course.length);
    const spent = driven.runSession.manager.snapshot().elapsedMs - clock;
    expect(spent).toBeGreaterThanOrEqual(sailing.course.length * STEP_DURATION_MS);
    expect(spent).toBeLessThanOrEqual((sailing.course.length + 1) * STEP_DURATION_MS);
  });

  it('stays ashore when the player says so', () => {
    const { driven } = dropIn({});
    const { run } = moor(driven, 0, 300);
    prompts.length = 0;
    driven.tryBoard('right', true);
    prompts.at(-1)!.onChoose(1);
    expect(driven.voyaging).toBeUndefined();
    expect(driven.currentTile).toEqual(run[0]);
  });

  it('will not sail before the tide, and says when it will', () => {
    const { driven } = dropIn({});
    moor(driven, 120, 240);
    prompts.length = 0;

    // Pushed into, it is the water it lies in: a bump.
    expect(driven.tryBoard('right', false)).toBe(false);
    // Asked, it says when it sails.
    expect(driven.tryBoard('right', true)).toBe(true);
    expect(prompts).toHaveLength(0);
    expect(shown.at(-1)!.join(' ')).toContain('from 2:00 until 4:00');
  });
});
