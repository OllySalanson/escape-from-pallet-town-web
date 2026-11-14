import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'out', FADE_IN_COMPLETE: 'in' } } },
  },
}));

import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/**
 * "Not one step in tall grass" is THE LAPRAS DOLL's condition, and a door that
 * landed on tall grass left the boots dry: wading was noted only as a step
 * ended, and a door puts you on its landing without one (the gyms playtest of
 * 14 Nov 2026, the Revenue House in the Coast).
 */
describe('a door that lands in tall grass', () => {
  const VALE = getWorldMap('greystone-vale');
  const wet = VALE.warps.filter(
    (warp) => warp.destinationMapId === VALE.id && VALE.tallGrass[warp.destination.y]?.[warp.destination.x] === true,
  );

  it('is a step into it: the boots are wet', () => {
    expect(wet.length, 'a door on the vale whose landing is tall grass').toBeGreaterThan(0);
    const session: { wadedGrass?: boolean } = {};
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    const noop = () => undefined;
    Object.assign(scene as object, {
      currentMap: VALE,
      currentTile: { ...wet[0].source },
      runSession: session,
      player: { stop: noop, x: 0, y: 0 },
      partner: { tuckIn: noop },
      cameras: { main: { fadeOut: noop, fadeIn: noop, centerOn: noop, once: (_event: string, then: () => void) => then() } },
      spentPresses: { spendHeld: noop },
      controls: {},
    });
    for (const method of [
      'showIdlePose', 'resetBouldersLeftIn', 'setPlayerPosition', 'settleRiding', 'standPartnerBesidePlayer',
      'configureCamera', 'saveGame', 'noteDistrict', 'surveyGround', 'refreshRunTimerHud', 'currentArea',
    ]) {
      (scene as unknown as Record<string, unknown>)[method] = noop;
    }
    // Whatever else a door does once the player is through, the boots are what is asked.
    const walkThrough = (scene as unknown as { walkThrough(warp: unknown): void }).walkThrough.bind(scene);
    try {
      walkThrough(wet[0]);
    } catch {
      // The rest of the doorway's work wants more of the scene than this stands up.
    }
    expect(session.wadedGrass).toBe(true);
  });
});
