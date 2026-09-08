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
import { BULBASAUR, Pokemon, PokemonParty } from '../pokemon';
import { RunManager, RunPhase } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { ENRAGE_GRACE_MS } from '../run/RunManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
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
      image: vi.fn(() => chainable()),
      text: vi.fn(() => chainable()),
      container: vi.fn(() => chainable()),
      graphics: vi.fn(() => chainable()),
    },
    scale: {
      width: BASE_STAGE_WIDTH,
      height: BASE_STAGE_HEIGHT,
      on: vi.fn(),
      off: vi.fn(),
    },
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        flash: vi.fn(),
        shake: vi.fn(),
        // Fades resolve immediately, so a transition that waits on one is
        // observable rather than stranded in a callback nothing ever fires.
        once: vi.fn((_event: string, callback: () => void) => callback()),
        setBounds: vi.fn(),
        setRoundPixels: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
        worldView: { left: 0, right: BASE_STAGE_WIDTH },
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
    scene: {
      start: vi.fn(),
      launch: vi.fn(),
      pause: vi.fn(),
      // The real game registers both, and which one exists decides where a
      // finished raid is handed to.
      manager: { keys: { hub: {}, extraction: {} } },
    },
    events: { once: vi.fn(), on: vi.fn() },
    // Raid resolution waits a beat so the flash lands on the map; run it now.
    time: {
      now: 0,
      delayedCall: vi.fn((_delayMs: number, callback: () => void) => callback()),
    },
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
    { mapId: RUN_INSERTIONS[insertionId].mapId, durationMs: RAID_DURATION_MS },
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

  /**
   * Every way a raid can end now routes through the result screen, which is a
   * new hand-off at the exact moment PR #70 found the freeze. Each ending is
   * played out and then followed by a second raid on the same scene instance.
   */
  it.each([
    ['extraction', 'extraction'],
    ['the clock expiring', 'timer'],
    ['losing the last Pokemon in a battle', 'defeat'],
  ] as const)('leaves the next raid playable after %s', (_label, ending) => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();
    const started = scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } };

    const first = startRaid(scene, manager, 'floodplain-relay', 1);
    const internals = scene as unknown as {
      currentTile: { x: number; y: number };
      targetTile: { x: number; y: number } | null;
      isWarping: boolean;
      pendingTrainerBattle: unknown;
      tryExtract(): void;
      advanceRunClock(deltaMs: number): void;
      handleRunResolutionComplete(): void;
    };

    if (ending === 'extraction') {
      const exit = first.plan!.extractionPoints.find(
        (point) => point.mapId === 'floodplain-relay' && point.requirement?.kind === 'always',
      )!;
      internals.currentTile = { ...exit.position };
      internals.tryExtract();
      expect(manager.phase).toBe(RunPhase.Escaped);
    } else if (ending === 'timer') {
      internals.advanceRunClock(RAID_DURATION_MS);
      internals.advanceRunClock(ENRAGE_GRACE_MS);
      expect(manager.phase).toBe(RunPhase.Wiped);
    } else {
      // A defeat resolves inside BattleScene, so the world is left exactly as it
      // was when it handed off - mid battle-transition, and never told the raid
      // ended.
      internals.isWarping = true;
      manager.resolveWipe();
      expect(manager.phase).toBe(RunPhase.Wiped);
    }

    if (ending !== 'defeat') {
      // A finished raid goes to the result screen, not straight back to the hub.
      expect(started.scene.start).toHaveBeenCalledWith('extraction', expect.anything());
    }

    startRaid(scene, manager, 'town-square', 2);
    const spawn = { ...internals.currentTile };
    pressRight(scene, controls);

    expect(internals.targetTile).toEqual({ x: spawn.x + 1, y: spawn.y });

    // And the second raid can still hand a fight to BattleScene. An inherited
    // result-screen flag makes handleRunResolutionComplete() return before that
    // branch, so a trainer walked into would simply never fight.
    started.scene.start.mockClear();
    internals.pendingTrainerBattle = { trainer: { id: 't', name: 'T', party: [] }, isHunter: false };
    internals.handleRunResolutionComplete();

    expect(started.scene.start).toHaveBeenCalledWith('battle', expect.anything());
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
      pendingResultScreen: boolean;
      isWarping: boolean;
      targetTile: unknown;
      stepProgress: number;
      pendingTrainerBattle: unknown;
    };

    Object.assign(internals, {
      facing: 'left',
      caughtPokemonStash: [new Pokemon(BULBASAUR, 5)],
      pendingHubTransition: true,
      pendingResultScreen: true,
      isWarping: true,
      stepProgress: 0.5,
      pendingTrainerBattle: { trainer: {}, introLines: [], isHunter: false },
    });
    manager.resolveEscape();

    startRaid(scene, manager, 'town-square', 2);

    expect(internals.pendingHubTransition).toBe(false);
    // The result screen's own flag has the same lifetime and the same teeth:
    // handleRunResolutionComplete() returns on it, so a raid that inherited it
    // could never hand off to a battle or to the hub again.
    expect(internals.pendingResultScreen).toBe(false);
    expect(internals.isWarping).toBe(false);
    expect(internals.targetTile).toBeNull();
    expect(internals.stepProgress).toBe(0);
    expect(internals.pendingTrainerBattle).toBeUndefined();
    expect(internals.facing).toBe('down');
    expect(internals.caughtPokemonStash).toEqual([]);
  });
});
