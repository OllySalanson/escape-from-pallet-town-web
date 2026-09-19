import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StubKey {
  justDown: boolean;
  isDown: boolean;
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: (key: StubKey) => key?.justDown === true } },
  },
}));

import { KeyPresses } from '../input/KeyPresses';
import { Bag } from '../items';
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import { CATCH_ALERT_MS, CATCH_SETTLE_MS } from '../world/cutscenes';
import { CUTSCENE_TIMED_CAP_MS } from '../cutscene/cutscene';
import { WorldScene } from './WorldScene';

const TILE = 16;

/** A drawn thing that remembers what was done to it. */
function stubGraphics() {
  const calls = { destroyed: 0, position: null as { x: number; y: number } | null };
  const self = {
    calls,
    clear: vi.fn(() => self),
    fillStyle: vi.fn(() => self),
    fillRect: vi.fn(() => self),
    setDepth: vi.fn(() => self),
    setVisible: vi.fn(() => self),
    setPosition: vi.fn((x: number, y: number) => {
      calls.position = { x, y };
      return self;
    }),
    destroy: vi.fn(() => {
      calls.destroyed += 1;
    }),
  };
  return self as typeof self & Record<string, unknown>;
}

/**
 * The hunter standing one tile east of the player, on the tick it makes contact -
 * the moment the raid is lost, and until now the moment with nothing to see.
 */
function caughtByTheHunter() {
  const map = getWorldMap('floodplain-relay');
  const player = { x: 8, y: 8 };
  const hunter = { x: 9, y: 8 };
  const graphics: ReturnType<typeof stubGraphics>[] = [];
  const hunterSprite = stubGraphics();
  const dialogBox = {
    visible: false,
    shown: [] as string[],
    showMessages: vi.fn((lines: string[]) => {
      dialogBox.shown.push(...lines);
      dialogBox.visible = true;
    }),
    showMessage: vi.fn(),
    setY: vi.fn(),
  };
  const playerSprite = {
    stop: vi.fn(),
    setFrame: vi.fn(),
    setPosition: vi.fn(),
    setDepth: vi.fn(),
  };
  const ticked: number[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    keyPresses: new KeyPresses(() => 0),
    currentMap: map,
    currentTile: player,
    facing: 'left',
    player: playerSprite,
    hunterState: { spawned: true, defeated: false, mapId: map.id, position: hunter },
    npcSprites: new Map([['rival-hunter', hunterSprite]]),
    npcAppearances: new Map(),
    mapObjects: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    bag: new Bag(),
    dialogBox,
    dialogRaised: false,
    scale: { width: 320, height: 240 },
    cameras: { main: { worldView: { left: 0, top: 0 }, fadeIn: vi.fn(), fadeOut: vi.fn() } },
    add: {
      graphics: vi.fn(() => {
        const drawn = stubGraphics();
        graphics.push(drawn);
        return drawn;
      }),
    },
    runSession: {
      manager: {
        phase: RunPhase.InRun,
        isEnraged: false,
        snapshot: () => ({ elapsedMs: 60_000 }),
        tick: (ms: number) => {
          ticked.push(ms);
          return { elapsedMs: 60_000, isEnraged: false };
        },
      },
      plan: undefined,
    },
  });

  return {
    scene: scene as unknown as {
      tryStartHunterBattle(): boolean;
      advanceCutscene(deltaMs: number): boolean;
      endCutscene(): void;
      facing: string;
      cutscene: { waitingForPlayer: boolean } | undefined;
      pendingTrainerBattle: unknown;
    },
    dialogBox,
    hunterSprite,
    graphics,
    hunter,
  };
}

describe('the hunter catching the player, as an authored beat', () => {
  let harness: ReturnType<typeof caughtByTheHunter>;

  beforeEach(() => {
    harness = caughtByTheHunter();
  });

  it('turns both figures to look at each other before a word is said', () => {
    expect(harness.scene.tryStartHunterBattle()).toBe(true);
    // The beat opens on the tick contact was made rather than a frame later:
    // the player was running west and is already looking east, at the hunter.
    expect(harness.scene.facing).toBe('right');
    expect(harness.dialogBox.showMessages).not.toHaveBeenCalled();

    harness.scene.advanceCutscene(16);

    expect(harness.hunterSprite.calls.position?.x).toBe(harness.hunter.x * TILE);
    expect(harness.hunterSprite.setVisible).toHaveBeenCalledWith(true);
    // And the mark is up over them, which is the one thing drawn for this beat.
    expect(harness.graphics).toHaveLength(1);
  });

  it('takes the mark down, speaks, and hands the frame to the dialogue box', () => {
    harness.scene.tryStartHunterBattle();
    expect(harness.scene.advanceCutscene(CATCH_ALERT_MS)).toBe(true);
    expect(harness.graphics[0].calls.destroyed).toBe(1);
    expect(harness.dialogBox.showMessages).not.toHaveBeenCalled();

    // The breath, and then the line - at which point the cutscene gives the
    // frame back so the box can be read and answered as any other box is.
    const speaking = harness.scene.advanceCutscene(CATCH_SETTLE_MS);
    expect(harness.dialogBox.shown).toEqual(['FOUND YOU.', 'There is nowhere left to run!']);
    expect(speaking).toBe(false);
    expect(harness.scene.cutscene?.waitingForPlayer).toBe(true);

    // Reading it is the player's own time, and closing it ends the beat.
    harness.dialogBox.visible = false;
    expect(harness.scene.advanceCutscene(16)).toBe(false);
    expect(harness.scene.cutscene).toBeUndefined();
  });

  it('cannot be started twice, however many ticks contact is made on', () => {
    expect(harness.scene.tryStartHunterBattle()).toBe(true);
    const first = harness.scene.cutscene;
    harness.scene.advanceCutscene(16);
    harness.scene.tryStartHunterBattle();
    expect(harness.scene.cutscene).toBe(first);
  });

  it('leaves nothing drawn behind when the fight it was leading to takes over', () => {
    harness.scene.tryStartHunterBattle();
    harness.scene.endCutscene();
    expect(harness.graphics[0].calls.destroyed).toBe(1);
    expect(harness.scene.cutscene).toBeUndefined();
  });

  it('runs itself out even if every frame is a long one', () => {
    harness.scene.tryStartHunterBattle();
    // One 100ms test-mode frame, or one absurd one: the beat still reaches its
    // line rather than being skipped or stalled by how the frames fell.
    harness.scene.advanceCutscene(CUTSCENE_TIMED_CAP_MS * 10);
    expect(harness.dialogBox.shown[0]).toBe('FOUND YOU.');
  });
});
