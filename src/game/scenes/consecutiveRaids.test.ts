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
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { ENRAGE_GRACE_MS } from '../run/RunManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import { FIRST_CONTRACT } from '../objectives';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { RAID_CARRIAGE_KEYS, type RaidCarriage } from '../run/raidCarriage';
import { createHunterState, type HunterState } from '../world/hunter';
import { isTallGrassInMap, type WorldMapDefinition } from '../worldMap';
import { BattleScene, type BattleSceneData } from './BattleScene';
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
    game: { loop: { frame: 0 } },
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
  const plan = generateRunPlan(seed, undefined, insertionId, seed === 1 ? FIRST_CONTRACT : undefined);
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
      // The deployment briefing holds the clock until it is read.
      (scene as unknown as { dialogBox: { visible: boolean } }).dialogBox.visible = false;
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

  /**
   * Playtest 4, bug 2: a stranger walked to the Ferry Dock, read "OPENS IN 40s",
   * stood on it while the caption turned to EXTRACT OPEN, kept standing, and lost
   * the raid to the clock. Extraction was only asked when a step finished.
   */
  it('takes a player who is standing on an exit when it opens', () => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();
    const session = startRaid(scene, manager, 'floodplain-relay', 1);
    const dock = session.plan!.extractionPoints.find((point) => point.label === 'FERRY DOCK')!;
    const opensAtMs = (dock.requirement as { unlockAtMs: number }).unlockAtMs;
    const internals = scene as unknown as {
      currentTile: { x: number; y: number };
      dialogBox: { visible: boolean };
      tryExtract(): boolean;
    };

    // The briefing is read, and the step onto the dock is spent on its locked line.
    internals.dialogBox.visible = false;
    internals.currentTile = { ...dock.position };
    expect(internals.tryExtract()).toBe(true);
    expect(manager.phase).toBe(RunPhase.InRun);
    expect(internals.dialogBox.visible).toBe(true);
    internals.dialogBox.visible = false;

    // Standing still, a frame at a time, until the signal.
    for (let elapsedMs = 0; elapsedMs < opensAtMs - 1_000; elapsedMs += 100) {
      scene.update(0, 100);
    }
    expect(manager.phase).toBe(RunPhase.InRun);
    for (let frame = 0; frame < 20; frame += 1) {
      scene.update(0, 100);
    }
    expect(manager.phase).toBe(RunPhase.Escaped);
  });

  it('does not take a player off an open exit while they are still reading', () => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();
    const session = startRaid(scene, manager, 'floodplain-relay', 1);
    const dock = session.plan!.extractionPoints.find((point) => point.label === 'FERRY DOCK')!;
    const internals = scene as unknown as {
      currentTile: { x: number; y: number };
      dialogBox: { visible: boolean };
      advanceRunClock(deltaMs: number): void;
    };

    internals.dialogBox.visible = false;
    internals.currentTile = { ...dock.position };
    internals.advanceRunClock(60_000);
    internals.dialogBox.visible = true;
    scene.update(0, 100);
    expect(manager.phase).toBe(RunPhase.InRun);

    internals.dialogBox.visible = false;
    scene.update(0, 100);
    expect(manager.phase).toBe(RunPhase.Escaped);
  });

  /**
   * Playtest 3, D4: the raid chip already read 4:58 while the first "ARROW KEYS
   * / WASD" box was still typing. A box the raid raises on its own first frame
   * is not billed; the clock starts when the player can first act.
   */
  it('does not charge the opening briefing to the raid clock', () => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    const manager = new RunManager();
    startRaid(scene, manager, 'floodplain-relay', 1);
    const internals = scene as unknown as {
      dialogBox: { visible: boolean; showMessage(): void };
      advanceRunClock(deltaMs: number): void;
    };

    expect(internals.dialogBox.visible).toBe(true);
    internals.advanceRunClock(2_000);
    expect(manager.snapshot().elapsedMs).toBe(0);

    internals.dialogBox.visible = false;
    internals.advanceRunClock(2_000);
    expect(manager.snapshot().elapsedMs).toBe(2_000);

    // Only that box is free: dialogue the player opens afterwards is billed.
    internals.dialogBox.showMessage();
    internals.advanceRunClock(2_000);
    expect(manager.snapshot().elapsedMs).toBe(4_000);
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

/**
 * Playtest 3, B1: "A RIVAL HUNTER is on your trail!" fired a second time after
 * one wild Bulbasaur, with the hunter eleven tiles from where it had been.
 *
 * A battle shuts the world down and the world is rebuilt from whatever the
 * battle hands back, so the raid is only as continuous as that payload. The
 * wild-encounter payload had been written out beside the trainer one and was
 * two fields short. These drive the real round trip - the real WorldScene into
 * the real BattleScene and back - for both kinds of fight, and hold the payload
 * to every key of `RaidCarriage` in both directions.
 */
describe('a raid carried through a battle and back', () => {
  interface WorldInternals {
    currentMap: WorldMapDefinition;
    collisionData: boolean[][];
    currentTile: { x: number; y: number };
    targetTile: { x: number; y: number } | null;
    stepProgress: number;
    dialogBox: { visible: boolean };
    hunterState: HunterState;
    defeatedTrainerIds: Set<string>;
    collectedLootIds: Set<string>;
    activatedPoiIds: Set<string>;
    pendingTrainerBattle: unknown;
    advanceStep(deltaMs: number): void;
    handleRunResolutionComplete(): void;
  }

  /** A walkable tile outside the tall grass, and the tall grass one step from it. */
  /**
   * A step from bare ground into tall grass with nothing else on either tile.
   *
   * The loot this raid laid is skipped deliberately: `generateLoot` re-seats
   * every piece on its own seed, so the first tall-grass tile on the map is a
   * different thing from raid to raid, and a step that lands on a Cable coil
   * picks it up instead of rolling the encounter this is about. Adding one
   * piece to a map's pool used to be enough to break this test.
   */
  const stepIntoTallGrass = (world: WorldInternals, session: ActiveRunSession) => {
    const { currentMap: map, collisionData } = world;
    const open = (x: number, y: number) => collisionData[y]?.[x] === false;
    const busy = new Set(
      (session.plan?.loot[map.id] ?? []).map(({ position }) => `${position.x},${position.y}`),
    );
    const clear = (x: number, y: number) => open(x, y) && !busy.has(`${x},${y}`);
    for (let y = 0; y < collisionData.length; y += 1) {
      for (let x = 0; x < collisionData[y].length; x += 1) {
        if (!clear(x, y) || isTallGrassInMap(map, { x, y })) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const grass = { x: x + dx, y: y + dy };
          if (clear(grass.x, grass.y) && isTallGrassInMap(map, grass)) {
            return { from: { x, y }, grass };
          }
        }
      }
    }
    throw new Error(`${map.id} has no empty tall grass to walk into`);
  };

  const startsOf = (scene: object) =>
    (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene.start;

  const lastStart = <T>(scene: object, key: string): T => {
    const call = startsOf(scene).mock.calls.filter(([started]) => started === key).at(-1);
    expect(call, `nothing started '${key}'`).toBeDefined();
    return call![1] as T;
  };

  it.each(['wild', 'trainer'] as const)(
    'brings the hunter, the beaten trainers and the ground already worked back from a %s fight',
    (kind) => {
      const controls = makeControls();
      const world = new WorldScene();
      attachSceneStubs(world, controls);
      const manager = new RunManager();
      // Seed 1 carries the first contract, whose authored teaching fight makes
      // the first step into tall grass a certain encounter rather than a roll.
      const runSession = startRaid(world, manager, 'floodplain-relay', 1);
      const internals = world as unknown as WorldInternals;
      internals.dialogBox.visible = false;

      const { from, grass } = stepIntoTallGrass(internals, runSession);
      // The hunter has arrived, been beaten, and is standing where it fell.
      const hunter: HunterState = {
        ...createHunterState(),
        spawned: true,
        defeated: true,
        mapId: internals.currentMap.id,
        position: { ...from },
      };
      internals.hunterState = hunter;
      internals.defeatedTrainerIds.add('raider-maya');
      internals.collectedLootIds.add('a-potion-already-taken');
      internals.activatedPoiIds.add('a-landmark-already-worked');

      if (kind === 'wild') {
        internals.currentTile = { ...from };
        internals.targetTile = { ...grass };
        internals.stepProgress = 0;
        internals.advanceStep(60_000);
      } else {
        internals.currentTile = { ...grass };
        internals.pendingTrainerBattle = {
          trainer: { id: 'toll', name: 'TOLL', party: [new Pokemon(BULBASAUR, 3)] },
          introLines: [],
          isHunter: false,
        };
        internals.handleRunResolutionComplete();
      }

      // Out: the world packs the whole carriage, whatever kind of fight it is.
      const outbound = lastStart<BattleSceneData>(world, 'battle');
      expect(kind === 'wild' ? outbound.wild : outbound.trainer).toBeDefined();
      for (const key of RAID_CARRIAGE_KEYS) {
        expect(outbound, `the ${kind} payload drops ${key}`).toHaveProperty(key);
      }
      expect(outbound.hunterState).toEqual(hunter);
      expect(outbound.defeatedTrainerIds).toEqual(['raider-maya']);
      expect(outbound.runSession).toBe(runSession);

      // Through: the real battle scene takes it and hands it back.
      const battle = new BattleScene();
      attachSceneStubs(battle as unknown as WorldScene, makeControls());
      // The battle screen draws far more than the world does; none of it is
      // what is under test, so everything it draws on answers with itself.
      Object.assign(battle as object, {
        add: new Proxy({}, { get: () => () => chainable() }),
        tweens: chainable(),
        input: { keyboard: new Proxy({}, { get: () => () => chainable() }) },
        cameras: { main: chainable() },
      });
      battle.create(outbound);
      (battle as unknown as { completeReturnToWorld(): void }).completeReturnToWorld();
      const inbound = lastStart<RaidCarriage>(battle, 'world');
      for (const key of RAID_CARRIAGE_KEYS) {
        expect(inbound, `the battle hands back no ${key}`).toHaveProperty(key);
      }

      // Back: the same raid, not a new one with the same clock.
      startsOf(world).mockClear();
      world.create(inbound);
      expect(internals.hunterState).toEqual(hunter);
      expect([...internals.defeatedTrainerIds]).toEqual(['raider-maya']);
      expect([...internals.collectedLootIds]).toEqual(['a-potion-already-taken']);
      expect([...internals.activatedPoiIds]).toEqual(['a-landmark-already-worked']);
      expect(internals.currentTile).toEqual(grass);
      // The arrival is announced once per raid: nothing is said on the way back.
      expect(internals.dialogBox.visible).toBe(false);
    },
  );
});

/**
 * Walking is the one thing the world times for itself, and it shares this file's
 * harness: both rules below are about what a frame is allowed to lose.
 */
describe('walking at any frame rate', () => {
  const enterTownSquare = (): {
    scene: WorldScene;
    controls: Record<string, FakeKey>;
    internals: { currentTile: { x: number; y: number }; targetTile: { x: number; y: number } | null };
    game: { loop: { frame: number } };
  } => {
    const controls = makeControls();
    const scene = new WorldScene();
    attachSceneStubs(scene, controls);
    startRaid(scene, new RunManager(), 'town-square', 2);
    return {
      scene,
      controls,
      internals: scene as unknown as {
        currentTile: { x: number; y: number };
        targetTile: { x: number; y: number } | null;
      },
      game: (scene as unknown as { game: { loop: { frame: number } } }).game,
    };
  };

  it('takes the step for a press that is already up again when the frame reads it', () => {
    const { scene, controls, internals } = enterTownSquare();
    const spawn = { ...internals.currentTile };

    controls.right.tap();
    expect(controls.right.isDown).toBe(false);
    scene.update(0, 100);

    expect(internals.targetTile).toEqual({ x: spawn.x + 1, y: spawn.y });
  });

  it('does not keep that press for a later frame to walk on', () => {
    const { scene, controls, internals, game } = enterTownSquare();

    controls.right.tap();
    game.loop.frame += 1;
    scene.update(0, 100);

    expect(internals.targetTile).toBeNull();
  });

  it('charges a held walk the same game time at ten frames a second as at sixty', () => {
    const gameTimeToWalk = (frameMs: number, tiles: number): number => {
      const { scene, controls, internals, game } = enterTownSquare();
      const goal = internals.currentTile.x + tiles;
      controls.right.isDown = true;
      let elapsedMs = 0;
      while (internals.currentTile.x < goal && elapsedMs < 5_000) {
        game.loop.frame += 1;
        scene.update(0, frameMs);
        elapsedMs += frameMs;
      }
      expect(internals.currentTile.x).toBe(goal);
      return elapsedMs;
    };

    // One frame to take the key, then 150ms a tile, landing on the next frame.
    // Before the overflow was carried, two tiles cost 500ms at ten frames a second.
    const atSixty = gameTimeToWalk(1000 / 60, 2);
    expect(atSixty).toBeGreaterThanOrEqual(300);
    expect(atSixty).toBeLessThanOrEqual(300 + 2 * (1000 / 60) + 0.001);
    expect(gameTimeToWalk(100, 2)).toBe(100 + 300);
  });
});
