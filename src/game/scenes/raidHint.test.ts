import { describe, expect, it, vi } from 'vitest';

/**
 * The raid's hint line - offered on the controls bar beside the game, never
 * drawn on the map - driven through the real WorldScene: facing a thing the
 * interact key works on says its key and its name, as the harbour does - a way
 * out with a lock in it, a field move's obstacle, a cache - and facing it from
 * the tile beside, or with a box up, says nothing (the 20 Nov AI playtest,
 * #126, #127, #148: a Card Key in the pack, SPACE pressed from beside the gate).
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

// Nothing played is under test: only what the line at the foot says.
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
    public setY(): this {
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
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, requireInsertion } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { extractionPointsOn } from '../world/extractionPoints';
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
  });
};

/** The parts of the scene these tests read and drive, which are private to it. */
interface Driven {
  currentTile: GridPosition;
  facing: Direction;
  currentMap: WorldMapDefinition;
  runSession: ActiveRunSession;
  dialogBox: { visible: boolean };
  momentLine: string;
  isBlocked(tile: GridPosition): boolean;
  refreshHint(): void;
}

/** Drops into the Floodplain, briefing read. */
function dropIn(): Driven {
  const controls = makeControls();
  const scene = new WorldScene();
  attachSceneStubs(scene, controls);
  const manager = new RunManager();
  const team = new PokemonParty([new Pokemon(CHARMANDER, 10)]);
  manager.startRun(
    { party: team.pokemon, items: [] },
    { mapId: requireInsertion('floodplain-relay').mapId, durationMs: RAID_DURATION_MS },
  );
  const session = createActiveRunSession(manager, {}, {}, [], [], [], generateRunPlan(7, undefined, 'floodplain-relay', undefined), []);
  session.firstDeploymentBriefingShown = true;
  scene.create({ party: team, bag: new Bag({}), runSession: session });
  const driven = scene as unknown as Driven;
  driven.dialogBox.visible = false;
  return driven;
}

const STEPS: readonly [Direction, number, number][] = [
  ['up', 0, -1],
  ['down', 0, 1],
  ['left', -1, 0],
  ['right', 1, 0],
];

/** Stands the player on open ground beside `target`, facing it, and reads the line. */
function faceFromBeside(driven: Driven, target: GridPosition): string {
  for (const [facing, dx, dy] of STEPS) {
    const stand = { x: target.x - dx, y: target.y - dy };
    if (!driven.isBlocked(stand)) {
      driven.currentTile = stand;
      driven.facing = facing;
      driven.refreshHint();
      return driven.momentLine;
    }
  }
  throw new Error(`Nowhere to stand beside ${target.x},${target.y}.`);
}

/** The same tile, turned to face the other way. */
function turnAway(driven: Driven): string {
  const back: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  driven.facing = back[driven.facing];
  driven.refreshHint();
  return driven.momentLine;
}

describe("the raid's hint line", () => {
  it('names a way out with a lock in it, faced, and says nothing turned away from it', () => {
    const driven = dropIn();
    const stairs = extractionPointsOn('floodplain-relay').find((point) => point.label === 'MARKET STAIRS')!;

    expect(faceFromBeside(driven, stairs.position)).toBe('[SPACE] MARKET STAIRS');
    expect(turnAway(driven)).toBe('');
  });

  it('names a field move’s obstacle while it is shut', () => {
    const driven = dropIn();
    const ride = driven.currentMap.gates.find((gate) => gate.label === 'OSIER RIDE')!;

    expect(faceFromBeside(driven, ride.tiles[0])).toBe('[SPACE] OSIER RIDE');
  });

  it('names a cache that still has something in it', () => {
    const driven = dropIn();
    const cache = driven.currentMap.pois[0];

    expect(faceFromBeside(driven, cache.position)).toBe(`[SPACE] ${cache.label}`);
  });

  it('says nothing while a box is up, and comes back when it goes', () => {
    const driven = dropIn();
    const cache = driven.currentMap.pois[0];
    faceFromBeside(driven, cache.position);

    driven.dialogBox.visible = true;
    driven.refreshHint();
    expect(driven.momentLine).toBe('');

    driven.dialogBox.visible = false;
    driven.refreshHint();
    expect(driven.momentLine).toBe(`[SPACE] ${cache.label}`);
  });
});
