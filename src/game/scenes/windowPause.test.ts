import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const plates: { title: string; lines: readonly string[]; destroyed: boolean }[] = [];
vi.mock('../ui/PausePlate', () => ({
  PausePlate: class {
    private readonly record: (typeof plates)[number];
    public constructor(_scene: unknown, title: string, lines: readonly string[]) {
      this.record = { title, lines, destroyed: false };
      plates.push(this.record);
    }
    public destroy(): void {
      this.record.destroyed = true;
    }
  },
}));

import { RunPhase } from '../run/RunManager';
import { WINDOW_PAUSE_LINES, WINDOW_PAUSE_TITLE, watchWindowFocus } from '../world/windowPause';
import { WorldScene } from './WorldScene';

/**
 * The world scene as Phaser holds it: running, paused (by the pack, the party,
 * the field guide or the plate) or gone. A paused scene is not stepped at all,
 * which is what stops the raid clock and the hunter - both are charged in
 * `update` - so `frame()` steps it only while it runs, as Phaser's loop does.
 */
function aRaidBeingWalked({ phase = RunPhase.InRun }: { phase?: RunPhase } = {}) {
  const state = { running: true, paused: false };
  const clock = { elapsedMs: 0 };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    windowPausePlate: null,
    pendingHubTransition: false,
    sys: {
      isActive: () => state.running && !state.paused,
      isPaused: () => state.paused,
      pause: vi.fn(() => {
        state.paused = true;
      }),
      resume: vi.fn(() => {
        state.paused = false;
      }),
    },
    runSession: { manager: { phase } },
  });
  const frame = (ms: number): void => {
    if (scene.sys.isActive()) {
      clock.elapsedMs += ms;
    }
  };
  return { scene, state, clock, frame };
}

describe('a raid paused while the window is not in use', () => {
  it('stops where it stands under the plate, and carries on from there', () => {
    const raid = aRaidBeingWalked();
    const page = new EventTarget();
    watchWindowFocus(page, () => raid.scene);
    raid.frame(1000);

    page.dispatchEvent(new Event('blur'));
    expect(plates.at(-1)).toEqual({ title: WINDOW_PAUSE_TITLE, lines: WINDOW_PAUSE_LINES, destroyed: false });
    for (let frame = 0; frame < 60; frame += 1) {
      raid.frame(16);
    }
    // A minute away from the window costs the raid nothing.
    expect(raid.clock.elapsedMs).toBe(1000);

    page.dispatchEvent(new Event('focus'));
    raid.frame(16);
    expect(raid.clock.elapsedMs).toBe(1000);

    page.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'KeyZ' }));
    expect(plates.at(-1)?.destroyed).toBe(true);
    raid.frame(16);
    expect(raid.clock.elapsedMs).toBe(1016);
  });

  it('is not paused twice, nor while the pack already has the world stopped', () => {
    const raid = aRaidBeingWalked();
    expect(raid.scene.canPauseForWindow()).toBe(true);
    raid.scene.pauseForWindow();
    expect(raid.scene.canPauseForWindow()).toBe(false);
    raid.scene.resumeFromWindowPause();

    raid.state.paused = true;
    expect(raid.scene.canPauseForWindow()).toBe(false);
  });

  it('is not paused once the raid is over', () => {
    expect(aRaidBeingWalked({ phase: RunPhase.Escaped }).scene.canPauseForWindow()).toBe(false);
    const ending = aRaidBeingWalked();
    Object.assign(ending.scene as object, { pendingHubTransition: true });
    expect(ending.scene.canPauseForWindow()).toBe(false);
  });
});
