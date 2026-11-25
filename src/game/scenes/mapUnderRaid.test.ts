import { describe, expect, it, vi } from 'vitest';

/**
 * THE MAP over a raid (`WorldScene.keepMapOpen`): the world goes on under it -
 * the captain asked for the raid clock to keep running - so the map keeps the
 * clock on it in step, and gets out of the way the moment the world wants the
 * screen. The world's own frame, the clock included, runs before this is asked
 * (`updateRaid`), which `tools/playtest/mapScreen.mjs` plays in the real game.
 */

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

const { WorldScene } = await import('./WorldScene');

interface Harness {
  readonly scene: { keepMapOpen(deltaMs: number): boolean; mapScreen: unknown };
  readonly screen: { close: ReturnType<typeof vi.fn>; setClock: ReturnType<typeof vi.fn> };
}

function raidWithMapOpen(world: Record<string, unknown> = {}): Harness {
  const scene = Object.create(WorldScene.prototype) as Harness['scene'] & Record<string, unknown>;
  const screen = {
    close: vi.fn(() => {
      scene.mapScreen = null;
    }),
    setClock: vi.fn(),
  };
  Object.assign(scene, {
    mapScreen: screen,
    pendingHubTransition: false,
    isWarping: false,
    trainerPrompt: undefined,
    cutscene: undefined,
    fishing: undefined,
    dialogBox: { visible: false },
    pendingVoyage: undefined,
    voyaging: undefined,
    pendingTrainerBattle: undefined,
    pendingWildBattle: undefined,
    targetTile: null,
    runSession: { manager: { remainingMs: () => 123_000 } },
    tryStartHunterBattle: () => false,
    tryExtractWhereStanding: () => false,
    ...world,
  });
  return { scene, screen };
}

describe('THE MAP over a raid', () => {
  it('stays open with the clock on it kept in step, and owns the frame', () => {
    const { scene, screen } = raidWithMapOpen();
    expect(scene.keepMapOpen(100)).toBe(true);
    expect(screen.setClock).toHaveBeenCalledWith(123_000);
    expect(screen.close).not.toHaveBeenCalled();
  });

  it.each([
    ['a box to read', { dialogBox: { visible: true } }],
    ['a fight on its way', { pendingWildBattle: { id: 'x' } }],
    ['a trainer challenging', { pendingTrainerBattle: { id: 'x' } }],
    ['a door or a fade', { isWarping: true }],
    ['the raid ending', { pendingHubTransition: true }],
    ['an authored beat', { cutscene: { waitingForPlayer: false } }],
  ])('closes for %s, and hands the frame back', (_what, world) => {
    const { scene, screen } = raidWithMapOpen(world);
    expect(scene.keepMapOpen(100)).toBe(false);
    expect(screen.close).toHaveBeenCalledTimes(1);
  });

  it('closes when the hunter reaches the player standing looking at it', () => {
    const { scene, screen } = raidWithMapOpen({ tryStartHunterBattle: () => true });
    expect(scene.keepMapOpen(100)).toBe(false);
    expect(screen.close).toHaveBeenCalledTimes(1);
  });

  it('closes when a way out opens under their feet', () => {
    const { scene, screen } = raidWithMapOpen({ tryExtractWhereStanding: () => true });
    expect(scene.keepMapOpen(100)).toBe(false);
    expect(screen.close).toHaveBeenCalledTimes(1);
  });

  it('finishes a step the world is still moving them on', () => {
    const advanceStep = vi.fn();
    const { scene } = raidWithMapOpen({ targetTile: { x: 1, y: 1 }, advanceStep });
    scene.keepMapOpen(100);
    expect(advanceStep).toHaveBeenCalledWith(100);
  });
});
