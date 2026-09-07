import { describe, expect, it, vi } from 'vitest';

/**
 * Drives the real WorldScene object through two raids in a row.
 *
 * Phaser hands every `scene.start('world')` the same scene instance, so a second
 * raid inherits whatever the first left behind. That is exactly how the game
 * became unplayable past one raid: an extraction set `pendingHubTransition`, and
 * the next raid's `update()` returned on it before the player could take a step.
 */

class FakeKey {
  public isDown = false;
  public justDown = false;
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

vi.mock('../ui/DialogBox', () => ({
  DialogBox: class {
    public visible = false;
    public isCurrentMessageComplete = true;
    public setScrollFactor(): this {
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
import { BULBASAUR, Pokemon, PokemonParty } from '../pokemon';
import { RunManager, RunPhase } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
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

const attachSceneStubs = (scene: WorldScene, controls: Record<string, FakeKey>): void => {
  Object.assign(scene as unknown as Record<string, unknown>, {
    add: {
      sprite: vi.fn(() => chainable()),
      rectangle: vi.fn(() => chainable()),
      text: vi.fn(() => chainable()),
      container: vi.fn(() => chainable()),
    },
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        flash: vi.fn(),
        shake: vi.fn(),
        once: vi.fn(),
        setBounds: vi.fn(),
        setRoundPixels: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
      },
    },
    input: {
      keyboard: {
        addCapture: vi.fn(),
        addKey: vi.fn((code: number) => controls[String(code)] ?? new FakeKey()),
        addKeys: vi.fn(() => ({
          W: controls.w,
          A: controls.a,
          S: controls.s,
          D: controls.d,
        })),
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
        })),
      })),
    },
    scene: { start: vi.fn(), launch: vi.fn(), pause: vi.fn(), manager: { keys: {} } },
    events: { once: vi.fn(), on: vi.fn() },
  });
};

const startRaid = (
  scene: WorldScene,
  manager: RunManager,
  insertionId: RunInsertionId,
  seed: number,
) => {
  const party = new PokemonParty([new Pokemon(BULBASAUR, 5)]);
  manager.startRun(
    { party: party.pokemon, items: [{ itemId: 'potion', quantity: 5 }] },
    { mapId: RUN_INSERTIONS[insertionId].mapId, durationMs: 1_080_000 },
  );
  // A second raid never carries the first contract: it was banked on extraction.
  const plan = generateRunPlan(seed, undefined, insertionId, seed === 1);
  const runSession = createActiveRunSession(manager, {}, {}, [], [], [], plan);
  scene.create({ party, bag: new Bag({ potion: 5 }), runSession });
  return runSession;
};

const pressRight = (scene: WorldScene, controls: Record<string, FakeKey>): void => {
  controls.right.isDown = true;
  scene.update(0, 16);
  controls.right.isDown = false;
};

const makeControls = (): Record<string, FakeKey> => {
  const controls: Record<string, FakeKey> = {};
  for (const name of ['up', 'down', 'left', 'right', 'w', 'a', 's', 'd']) {
    controls[name] = new FakeKey();
  }
  return controls;
};

describe('two raids in a row on one WorldScene instance', () => {
  it('leaves the second raid playable after the first is extracted from', () => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();

    const first = startRaid(scene, manager, 'floodplain-relay', 1);
    const internals = scene as unknown as {
      currentTile: { x: number; y: number };
      targetTile: { x: number; y: number } | null;
      pendingHubTransition: boolean;
      tryExtract(): void;
    };

    // Walk onto an exit that is open from the first second of the raid and take it.
    const exit = first.plan!.extractionPoints.find(
      (point) => point.mapId === 'floodplain-relay' && point.requirement?.kind === 'always',
    )!;
    internals.currentTile = { ...exit.position };
    internals.tryExtract();

    expect(manager.phase).toBe(RunPhase.Escaped);
    expect(internals.pendingHubTransition).toBe(true);

    // Back to the hub, then straight out again - the same scene object is reused.
    startRaid(scene, manager, 'town-square', 2);

    // The whole defect in one assertion: the second raid must answer the controls.
    const spawn = { ...internals.currentTile };
    pressRight(scene, controls);

    expect(internals.targetTile).toEqual({ x: spawn.x + 1, y: spawn.y });
  });

  it('starts every raid from a clean per-raid state rather than the last one', () => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();

    startRaid(scene, manager, 'floodplain-relay', 1);
    const internals = scene as unknown as {
      facing: string;
      caughtPokemonStash: Pokemon[];
      pendingHubTransition: boolean;
      isWarping: boolean;
      targetTile: unknown;
      stepProgress: number;
      pendingTrainerBattle: unknown;
    };

    Object.assign(internals, {
      facing: 'left',
      caughtPokemonStash: [new Pokemon(BULBASAUR, 5)],
      pendingHubTransition: true,
      isWarping: true,
      stepProgress: 0.5,
      pendingTrainerBattle: { trainer: {}, introLines: [], isHunter: false },
    });
    manager.resolveEscape();

    startRaid(scene, manager, 'town-square', 2);

    expect(internals.pendingHubTransition).toBe(false);
    expect(internals.isWarping).toBe(false);
    expect(internals.targetTile).toBeNull();
    expect(internals.stepProgress).toBe(0);
    expect(internals.pendingTrainerBattle).toBeUndefined();
    expect(internals.facing).toBe('down');
    expect(internals.caughtPokemonStash).toEqual([]);
  });
});
