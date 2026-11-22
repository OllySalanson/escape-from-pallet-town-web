import { describe, expect, it, vi } from 'vitest';

/**
 * The Repel, driven through the real WorldScene: sprayed from the pack, it
 * turns back every wild Pokémon weaker than the lead for a hundred steps and
 * lets through anything at the lead's level or above, lasts across a fight
 * because it rides on the raid, is refused while one is working, and says so
 * on the step it wears off - which rolls nothing, as FireRed's does.
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

// Nothing played is under test here: the pack's hiss is BagScene's.
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

import { Bag, getItemById } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import type { WildEncounterTable } from '../pokemon/encounters';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, requireInsertion } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { stepRolls } from '../world/localEncounters';
import { REPEL_LINGERED_LINE, REPEL_WORE_OFF_LINE } from '../world/repel';
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
  targetTile: GridPosition | null;
  bag: Bag;
  currentMap: WorldMapDefinition;
  runSession: ActiveRunSession;
  dialogBox: { visible: boolean; showMessages: (lines: readonly string[]) => void };
  scene: { launch: ReturnType<typeof vi.fn> };
  isBlocked(tile: GridPosition): boolean;
  openBag(): void;
}

interface RepelArg {
  readonly spray: (item: NonNullable<ReturnType<typeof getItemById>>) => { used: boolean; message: string };
}

/** Grass that always rolls, and always rolls this one Pokémon at this level. */
const grassOf = (level: number): WildEncounterTable => ({
  stepEncounterRate: 1,
  entries: [{ speciesId: 'pidgey', minLevel: level, maxLevel: level, weight: 1 }],
});

/** Drops into the Floodplain with a level-10 lead, every tile walked rolling `grass`. */
function dropIn(grass: WildEncounterTable, runSession?: ActiveRunSession) {
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
  scene.create({ party: team, bag: new Bag({ repel: 2 }), runSession: session });
  const driven = scene as unknown as Driven;
  driven.dialogBox.visible = false;
  const said: string[] = [];
  const showMessages = driven.dialogBox.showMessages.bind(driven.dialogBox);
  driven.dialogBox.showMessages = (lines) => {
    said.push(...lines);
    showMessages(lines);
  };
  const battles: unknown[] = [];
  // Only the grass is under test: nothing on the way is picked up, worked or
  // fought but what it rolls, and every tile is grass.
  Object.assign(scene as unknown as Record<string, unknown>, {
    tryCollectLootAt: () => null,
    tryMakeContractStopAt: () => null,
    tryReachDropInAt: () => null,
    tryActivatePoiAt: () => null,
    tryExtract: () => false,
    tryTrainerChallengeAt: () => false,
    tryShimmer: () => false,
    encountersAtCurrentTile: () => grass,
    transitionToBattle: (encounter: unknown) => battles.push(encounter),
  });
  return { scene, driven, controls, session, battles, said };
}

/** The pack's USE on a Repel, exactly as the bag is handed it. */
function sprayInPack(driven: Driven): { used: boolean; message: string } {
  driven.openBag();
  const data = driven.scene.launch.mock.calls.at(-1)![1] as { repel: RepelArg };
  return data.repel.spray(getItemById('repel')!);
}

let now = 0;

/** Holds right for `tiles` steps, a frame at a time, dismissing whatever is said on the way. */
function walkEast(scene: WorldScene, controls: Record<string, FakeKey>, tiles: number): void {
  const driven = scene as unknown as Driven;
  const start = driven.runSession.stepsTaken ?? 0;
  const taken = () => (driven.runSession.stepsTaken ?? 0) - start;
  controls.right.isDown = true;
  for (let frames = 0; frames < 2000 && !(taken() === tiles - 1 && driven.targetTile !== null); frames += 1) {
    now += 10;
    scene.update(now, 10);
    // A line said on a step is read and dismissed, as a player presses on.
    driven.dialogBox.visible = false;
  }
  controls.right.isDown = false;
  for (let frames = 0; frames < 40 && driven.targetTile !== null; frames += 1) {
    now += 10;
    scene.update(now, 10);
  }
  driven.dialogBox.visible = false;
  expect(taken()).toBe(tiles);
}

/** A straight run of tall grass `length` tiles east of where it starts, with no door on it. */
function grassRun(driven: Driven, length: number): GridPosition {
  const map = driven.currentMap;
  const doorway = (tile: GridPosition) =>
    map.warps.some((warp) => warp.source.x === tile.x && warp.source.y === tile.y);
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x + length < map.width - 1; x += 1) {
      const tiles = Array.from({ length: length + 1 }, (_, step) => ({ x: x + step, y }));
      if (tiles.every((tile) => !driven.isBlocked(tile) && !doorway(tile) && stepRolls(map, tile))) {
        return tiles[0];
      }
    }
  }
  throw new Error(`No straight run of ${length} tall grass tiles on ${map.id}.`);
}

describe('the Repel in a raid', () => {
  it('turns back every wild Pokémon weaker than the lead while it works', () => {
    const { scene, driven, controls, session, battles } = dropIn(grassOf(9));
    driven.currentTile = grassRun(driven, 8);
    expect(sprayInPack(driven).used).toBe(true);
    expect(session.repel).toEqual({ stepsLeft: 100 });

    walkEast(scene, controls, 8);

    expect(battles).toEqual([]);
    expect(session.repel).toEqual({ stepsLeft: 92 });
  });

  it('wears off saying so, on a step that rolls nothing, and the grass rolls again after', () => {
    const { scene, driven, controls, session, battles, said } = dropIn(grassOf(9));
    driven.currentTile = grassRun(driven, 4);
    session.repel = { stepsLeft: 3 };

    walkEast(scene, controls, 2);
    expect(battles).toEqual([]);
    expect(said).not.toContain(REPEL_WORE_OFF_LINE);

    // The third step is the one it wears off on: said, and nothing rolled.
    walkEast(scene, controls, 1);
    expect(battles).toEqual([]);
    expect(said).toContain(REPEL_WORE_OFF_LINE);
    expect(session.repel).toBeUndefined();

    // And the next step rolls as the grass always did.
    walkEast(scene, controls, 1);
    expect(battles).toHaveLength(1);
  });

  it('lets through anything at the lead’s level or above', () => {
    const { scene, driven, controls, battles } = dropIn(grassOf(10));
    driven.currentTile = grassRun(driven, 1);
    sprayInPack(driven);

    walkEast(scene, controls, 1);

    expect(battles).toHaveLength(1);
  });

  it('is refused while one is still working, and the second is not spent', () => {
    const { scene, driven, controls, session } = dropIn(grassOf(3));
    driven.currentTile = grassRun(driven, 5);
    expect(sprayInPack(driven).used).toBe(true);
    walkEast(scene, controls, 5);

    expect(sprayInPack(driven)).toEqual({ used: false, message: REPEL_LINGERED_LINE });
    expect(session.repel).toEqual({ stepsLeft: 95 });
  });

  it('lasts across a fight: the world rebuilt from the same raid still has it', () => {
    const first = dropIn(grassOf(3));
    first.driven.currentTile = grassRun(first.driven, 4);
    sprayInPack(first.driven);
    walkEast(first.scene, first.controls, 4);

    const { scene, driven, controls, battles, session } = dropIn(grassOf(3), first.session);
    driven.currentTile = grassRun(driven, 4);
    walkEast(scene, controls, 4);

    expect(battles).toEqual([]);
    expect(session.repel).toEqual({ stepsLeft: 92 });
  });
});
