import { describe, expect, it, vi } from 'vitest';

/**
 * The Bunker under Greystone's power station, driven through the real
 * WorldScene on the vale's own map: the Rocket Hideout's arrows spin a player
 * on until a stop plate, a step of the raid a tile and one roll at the end;
 * the shutter opens only to the Card Key; the lift is dead until the
 * generator is thrown, then offers every floor and goes to the one chosen.
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
    public constructor(
      _scene: unknown,
      options: { lines: readonly string[]; onChoose: (index: number) => void },
    ) {
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
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, requireInsertion } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { DEAD_LIFT_LINES, LIFT_RUNNING_LINES } from '../world/lifts';
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
  isWarping: boolean;
  bag: Bag;
  isBlocked(tile: GridPosition): boolean;
  tryRideLift(facing: Direction, asked: boolean): boolean;
  tryInteract(): void;
}

/** Drops into Greystone Vale at the Dam, briefing read, with this pack. */
function dropIn(pack: Record<string, number>) {
  const controls = makeControls();
  const scene = new WorldScene();
  attachSceneStubs(scene, controls);
  const manager = new RunManager();
  const team = new PokemonParty([new Pokemon(CHARMANDER, 10)]);
  const insertion = requireInsertion('greystone-vale-the-dam');
  manager.startRun(
    { party: team.pokemon, items: [] },
    { mapId: insertion.mapId, durationMs: RAID_DURATION_MS },
  );
  const session = createActiveRunSession(
    manager,
    {},
    {},
    [],
    [],
    [],
    generateRunPlan(7, undefined, 'greystone-vale-the-dam', undefined),
    [],
  );
  session.firstDeploymentBriefingShown = true;
  scene.create({ party: team, bag: new Bag(pack), runSession: session });
  const driven = scene as unknown as Driven;
  driven.dialogBox.visible = false;
  // Nothing on the way is picked up, worked or fought; the floor is asked -
  // and counted - but rolls nothing.
  const rolls = vi.fn(() => undefined);
  Object.assign(scene as unknown as Record<string, unknown>, {
    tryCollectLootAt: () => null,
    tryMakeContractStopAt: () => null,
    tryReachDropInAt: () => null,
    tryActivatePoiAt: () => null,
    tryExtract: () => false,
    tryTrainerChallengeAt: () => false,
    tryStartHunterBattle: () => false,
    encountersAtCurrentTile: rolls,
  });
  return { scene, driven, controls, rolls };
}

/** A tile of one of the vale's places, from that place's own tiles. */
function at(driven: Driven, area: string, x: number, y: number): GridPosition {
  const rect = driven.currentMap.areas!.find((placed) => placed.id === area)!.rect;
  return { x: rect.x + x, y: rect.y + y };
}

/** One tap of a direction, then frames until the player is standing still. */
function press(scene: WorldScene, controls: Record<string, FakeKey>, direction: Direction): void {
  const driven = scene as unknown as Driven;
  controls[direction].isDown = true;
  scene.update(0, 10);
  controls[direction].isDown = false;
  for (let frames = 0; driven.targetTile !== null && frames < 2000; frames += 1) {
    scene.update(0, 10);
  }
}

describe('the spinner floor', () => {
  it('spins a player across B2F from plate to plate, a step a tile and one roll where it stops', () => {
    const { scene, driven, controls, rolls } = dropIn({});
    // The plate under the bottom row of the maze's west column, and the next
    // plate up it: the arrows between point up.
    driven.currentTile = at(driven, 'bunker-b2f', 6, 14);
    driven.facing = 'down';
    const steps = driven.runSession.stepsTaken ?? 0;
    press(scene, controls, 'up');
    expect(driven.currentTile).toEqual(at(driven, 'bunker-b2f', 6, 11));
    expect((driven.runSession.stepsTaken ?? 0) - steps).toBe(3);
    // The hideout's floor rolls on every step, but not mid-spin.
    expect(rolls).toHaveBeenCalledTimes(1);
    expect(driven.facing).toBe('up');
  });

  it('turns a spin at every arrow it crosses and carries it into the generator alcove', () => {
    const { scene, driven, controls } = dropIn({});
    // The last plate before the goal: up its lane to the conveyor, which runs
    // west along the back wall into the alcove and stops against the generator.
    driven.currentTile = at(driven, 'bunker-b2f', 15, 5);
    press(scene, controls, 'up');
    expect(driven.currentTile).toEqual(at(driven, 'bunker-b2f', 4, 3));
    expect(driven.facing).toBe('left');
  });
});

describe('the shutter on B1F', () => {
  it('stays shut without the Card Key, and says what it wants', () => {
    const { driven } = dropIn({});
    driven.currentTile = at(driven, 'bunker-b1f', 5, 7);
    driven.facing = 'down';
    driven.tryInteract();
    expect(shown.at(-1)!.join(' ')).toContain('It needs the Card Key!');
    expect(driven.isBlocked(at(driven, 'bunker-b1f', 5, 8))).toBe(true);
    expect(driven.runSession.switchesThrown ?? []).toEqual([]);
  });

  it('opens to the Card Key for the rest of the raid, and keeps the card', () => {
    const { driven } = dropIn({ 'card-key': 1 });
    driven.currentTile = at(driven, 'bunker-b1f', 6, 7);
    driven.facing = 'down';
    driven.tryInteract();
    expect(shown.at(-1)!.join(' ')).toContain('Bingo! The Card Key opened the door!');
    expect(driven.isBlocked(at(driven, 'bunker-b1f', 5, 8))).toBe(false);
    expect(driven.isBlocked(at(driven, 'bunker-b1f', 6, 9))).toBe(false);
    expect(driven.bag.count('card-key')).toBe(1);
  });
});

describe('the lift', () => {
  it('is dead until the generator on B2F is thrown, then offers every floor and goes to the one chosen', () => {
    const { driven } = dropIn({});
    driven.currentTile = at(driven, 'bunker-b1f', 12, 13);
    prompts.length = 0;
    expect(driven.tryRideLift('up', true)).toBe(true);
    expect(shown.at(-1)).toEqual([...DEAD_LIFT_LINES]);
    expect(prompts).toHaveLength(0);
    // Pushed into while dead, it is the wall it is let into.
    expect(driven.tryRideLift('up', false)).toBe(false);
    driven.dialogBox.visible = false;

    // The generator, faced from beside its foot.
    driven.currentTile = at(driven, 'bunker-b2f', 4, 3);
    driven.facing = 'left';
    driven.tryInteract();
    expect(shown.at(-1)).toEqual([...LIFT_RUNNING_LINES]);
    driven.dialogBox.visible = false;

    driven.currentTile = at(driven, 'bunker-b1f', 12, 13);
    expect(driven.tryRideLift('up', true)).toBe(true);
    const panel = prompts.at(-1)!;
    expect(panel.lines).toEqual(['Which floor do you want?']);
    panel.onChoose(3);
    expect(driven.currentTile).toEqual(at(driven, 'bunker-b4f', 4, 3));
    expect(driven.facing).toBe('down');
  });

  it('goes nowhere for the floor it is on, or EXIT', () => {
    const { driven } = dropIn({});
    driven.runSession.switchesThrown = ['greystone-vale/switch-bunker-b2f-1'];
    const landing = at(driven, 'bunker-b1f', 12, 13);
    for (const choice of [0, 4]) {
      driven.currentTile = landing;
      prompts.length = 0;
      expect(driven.tryRideLift('up', true)).toBe(true);
      prompts.at(-1)!.onChoose(choice);
      expect(driven.currentTile).toEqual(landing);
      expect(driven.isWarping).toBe(false);
    }
  });
});
