import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Drives the real WorldScene through a boss fight's return.
 *
 * A gate is only worth anything if the door opens in the raid that won it, and
 * stays open for the next one - and both of those happen in the hand-off between
 * two scenes that the unit tests around `gates.ts` never see. A trainer fight
 * returns by restarting WorldScene with the beaten trainer's id in its payload,
 * so that payload is what these tests send.
 */

class FakeKey {
  public isDown = false;
  public justDown = false;
  private readonly listeners: Array<() => void> = [];
  public on(_event: string, listener: () => void): this {
    this.listeners.push(listener);
    return this;
  }
  /** A press that is down and up again before any frame reads the key. */
  public tap(): void {
    this.listeners.forEach((listener) => listener());
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

const spoken: string[][] = [];

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
      this.visible = true;
      spoken.push([message]);
    }
    public showMessages(messages: string[]): void {
      this.visible = true;
      spoken.push([...messages]);
    }
    public advance(): void {}
    public skip(): void {}
    public update(): void {}
  },
}));

// The save is reached through `window.localStorage`, and a `window` that exists
// would otherwise have the audio manager reach for a real AudioContext.
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

import { Bag } from '../items';
import { BULBASAUR, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { WORLD_GATES } from '../world/gates';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { WorldScene, type WorldSceneData } from './WorldScene';

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

const attachSceneStubs = (scene: WorldScene): void => {
  const key = (): FakeKey => new FakeKey();
  Object.assign(scene as unknown as Record<string, unknown>, {
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
        setBounds: vi.fn(),
        setRoundPixels: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
        worldView: { left: 0, right: BASE_STAGE_WIDTH },
      },
    },
    game: { loop: { frame: 0 } },
    input: {
      keyboard: {
        addCapture: vi.fn(),
        addKey: vi.fn(key),
        addKeys: vi.fn(() => ({ W: key(), A: key(), S: key(), D: key() })),
        createCursorKeys: vi.fn(() => ({ up: key(), down: key(), left: key(), right: key() })),
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
        })),
      })),
    },
    scene: {
      start: vi.fn(),
      launch: vi.fn(),
      pause: vi.fn(),
      manager: { keys: { hub: {}, extraction: {} } },
    },
    events: { once: vi.fn(), on: vi.fn() },
    time: { now: 0, delayedCall: vi.fn() },
  });
};

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const GATE = WORLD_GATES.find((gate) => gate.mapId === 'route-1')!;
const GATE_TILE = GATE.tiles[0];
/**
 * Every door the same boss holds. The Overlook's warden has two - the gate off
 * the east road, and the steps down the bank into the station yard - and one
 * won fight opens both.
 */
const BOSS_GATES = WORLD_GATES.filter((gate) => gate.bossId === GATE.bossId);
const BOSS_GATE_TILES = BOSS_GATES.flatMap((gate) => gate.tiles);
const BOSS = bossEncounters(createRunTrainerEncounters()).find(
  (boss) => boss.bossId === GATE.bossId,
)!;
const ORDINARY_TRAINER = createRunTrainerEncounters().find(
  (trainer) => trainer.mapId === 'route-1' && trainer.bossId === undefined,
)!;

interface Internals {
  bag: { count(itemId: string): number };
  currentTile: { x: number; y: number };
  defeatedBosses: readonly string[];
  isBlocked(tile: { x: number; y: number }): boolean;
  isBlockedForHunter(tile: { x: number; y: number }): boolean;
  tryReachDropInAt(tile: { x: number; y: number }): string | null;
}

const internalsOf = (scene: WorldScene): Internals => scene as unknown as Internals;

const deploy = (
  insertionId: RunInsertionId,
  defeatedBosses: readonly string[] = [],
): { session: ActiveRunSession; data: WorldSceneData } => {
  const party = new PokemonParty([new Pokemon(BULBASAUR, 5)]);
  const manager = new RunManager();
  manager.startRun(
    { party: party.pokemon, items: [] },
    { mapId: RUN_INSERTIONS[insertionId].mapId, durationMs: RAID_DURATION_MS },
  );
  const plan = generateRunPlan(11, undefined, insertionId, undefined, undefined, defeatedBosses);
  const session = createActiveRunSession(manager, {}, {}, [], [], [], plan);
  return { session, data: { party, bag: new Bag(), runSession: session } };
};

/** The payload BattleScene restarts the world with after a won trainer fight. */
const returnFromWinning = (
  data: WorldSceneData,
  trainerId: string,
  at: { x: number; y: number },
): WorldSceneData => ({
  ...data,
  defeatedTrainerIds: [trainerId],
  returnLocation: { mapId: 'route-1', position: at, facing: 'right' },
});

describe('a boss-held gate in a live raid', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    spoken.length = 0;
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    new SaveManager(storage).save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 7, y: 9 },
      raidProgress: { ...DEFAULT_RAID_PROGRESS, unlockedInsertions: ['floodplain-relay', 'route-1'] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a wall to the player and to the hunter until its boss is beaten', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    scene.create(deploy('route-1').data);

    expect(BOSS_GATE_TILES).toContainEqual(GATE_TILE);
    for (const tile of BOSS_GATE_TILES) {
      expect(internalsOf(scene).isBlocked(tile)).toBe(true);
      expect(internalsOf(scene).isBlockedForHunter(tile)).toBe(true);
    }
    // The boss is a body in the lane as well, like any trainer.
    expect(internalsOf(scene).isBlocked(BOSS.position)).toBe(true);
    expect(spoken).toEqual([]);
  });

  it('opens in the raid that won the fight, says so once, and writes it to the save', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    const { data } = deploy('route-1');
    scene.create(data);

    const beside = { x: BOSS.position.x - 1, y: BOSS.position.y };
    scene.create(returnFromWinning(data, BOSS.trainer.id, beside));

    for (const tile of BOSS_GATE_TILES) {
      expect(internalsOf(scene).isBlocked(tile)).toBe(false);
      expect(internalsOf(scene).isBlockedForHunter(tile)).toBe(false);
    }
    // The boss has gone: the tile they held is lane again.
    expect(internalsOf(scene).isBlocked(BOSS.position)).toBe(false);
    // Both doors, named in one line and said once - not a line per door - and
    // then what the boss was carrying, in the same breath.
    expect(BOSS_GATES.map((gate) => gate.label)).toEqual(['OVERLOOK GATE', 'OVERLOOK STEPS']);
    expect(spoken).toEqual([
      [
        'OVERLOOK GATE and OVERLOOK STEPS are open - and stay open on every raid from now on.',
        'WARDEN WREN was carrying a LIFE ORB. You take it.',
        "The holder's hits land a third harder and cost it a tenth of its own HP. Give it to a POKéMON from the party screen - and get it home.",
      ],
    ]);
    // The gear is in the raid's own pack: it has to be carried out from here.
    expect(internalsOf(scene).bag.count('life-orb')).toBe(1);
    expect(new SaveManager(storage).load()!.raidProgress.defeatedBosses).toEqual([GATE.bossId]);

    // Every later battle return carries the same beaten id. The door is already
    // open and already recorded, so nothing is said or written again - and the
    // gear is handed over once, not once per return.
    scene.create(returnFromWinning(data, BOSS.trainer.id, beside));
    expect(spoken).toHaveLength(1);
    expect(internalsOf(scene).bag.count('life-orb')).toBe(1);
    expect(new SaveManager(storage).load()!.raidProgress.defeatedBosses).toEqual([GATE.bossId]);
  });

  it('stays shut when the fight that was won was not the boss', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    const { data } = deploy('route-1');
    scene.create(returnFromWinning(data, ORDINARY_TRAINER.trainer.id, { x: 16, y: 3 }));

    expect(internalsOf(scene).isBlocked(GATE_TILE)).toBe(true);
    expect(spoken).toEqual([]);
    expect(new SaveManager(storage).load()!.raidProgress.defeatedBosses).toEqual([]);
  });

  it('is open from the first step of every later raid, with the boss gone', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    scene.create(deploy('route-1-overlook', [GATE.bossId]).data);

    expect(internalsOf(scene).currentTile).toEqual(RUN_INSERTIONS['route-1-overlook'].position);
    expect(internalsOf(scene).isBlocked(GATE_TILE)).toBe(false);
    expect(internalsOf(scene).isBlocked(BOSS.position)).toBe(false);
    // Nothing was won this raid, so nothing is announced.
    expect(spoken).toEqual([]);
  });

  it('does not carry an opened gate into a raid whose save never beat the boss', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    const first = deploy('route-1');
    scene.create(first.data);
    scene.create(
      returnFromWinning(first.data, BOSS.trainer.id, { x: BOSS.position.x - 1, y: BOSS.position.y }),
    );
    expect(internalsOf(scene).isBlocked(GATE_TILE)).toBe(false);

    // Phaser reuses this one scene object. A raid deployed from a save with no
    // boss beaten must not inherit the last raid's open door.
    scene.create(deploy('route-1', []).data);
    expect(internalsOf(scene).defeatedBosses).toEqual([]);
    expect(internalsOf(scene).isBlocked(GATE_TILE)).toBe(true);
  });

  it('still opens the door in a browser that cannot save', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('storage is blocked');
      },
    });
    const scene = new WorldScene();
    attachSceneStubs(scene);
    const { data } = deploy('route-1');
    scene.create(
      returnFromWinning(data, BOSS.trainer.id, { x: BOSS.position.x - 1, y: BOSS.position.y }),
    );

    expect(internalsOf(scene).isBlocked(GATE_TILE)).toBe(false);
  });
});

describe('a drop-in point in a live raid', () => {
  let storage: MemoryStorage;
  const overlook = RUN_INSERTIONS['route-1-overlook'];

  beforeEach(() => {
    spoken.length = 0;
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    new SaveManager(storage).save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 7, y: 9 },
      raidProgress: { ...DEFAULT_RAID_PROGRESS, unlockedInsertions: ['floodplain-relay', 'route-1'] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unlocked for good by standing on it, and only says so the first time', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    scene.create(deploy('route-1', [GATE.bossId]).data);

    const line = internalsOf(scene).tryReachDropInAt(overlook.position);
    expect(line).toContain('OVERLOOK LANDING');
    expect(new SaveManager(storage).load()!.raidProgress.reachedInsertions).toEqual([overlook.id]);

    expect(internalsOf(scene).tryReachDropInAt(overlook.position)).toBeNull();
    // And a raid on a later day, from a save that already has it, stays quiet.
    scene.create(deploy('route-1', [GATE.bossId]).data);
    expect(internalsOf(scene).tryReachDropInAt(overlook.position)).toBeNull();
  });

  it('says nothing about the insertion the raid started on, or about ordinary ground', () => {
    const scene = new WorldScene();
    attachSceneStubs(scene);
    scene.create(deploy('route-1-overlook', [GATE.bossId]).data);

    expect(internalsOf(scene).tryReachDropInAt(overlook.position)).toBeNull();
    expect(internalsOf(scene).tryReachDropInAt({ x: overlook.position.x, y: overlook.position.y - 1 }))
      .toBeNull();
    // The front door was already offered by the lobby, so walking over it is not news.
    expect(internalsOf(scene).tryReachDropInAt(RUN_INSERTIONS['route-1'].position)).toBeNull();
    expect(new SaveManager(storage).load()!.raidProgress.reachedInsertions).toEqual([]);
  });
});
