import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { pitFrameFor } from '../base/arenaHall';
import { ARENA_RIM, landingBelow, shareTheRim } from '../base/arenaRim';
import { insertionsOn } from '../run/runGeneration';
import { BaseScene } from './BaseScene';

const BACK = { name: 'back' };

/**
 * The real walking frame on a stand-in of the hall: a click has planned a walk of
 * two steps ending in a panel, and each frame the step under way ends at once.
 */
function clickedWalk() {
  const opened: string[] = [];
  const begun: unknown[] = [];
  const pressed = new Set<object>();
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    stepCarryMs: null,
    targetTile: null,
    walkPlan: { steps: ['up', 'up'], then: () => opened.push('rack') },
    listAskedMidStep: null,
    leaving: false,
    resting: false,
    namePrompt: null,
    knockScreen: null,
    favoursScreen: null,
    arenaPanel: null,
    telescope: null,
    fogLift: null,
    phrasePicker: null,
    knockPrompt: null,
    boxQuestion: null,
    fishing: null,
    inspecting: null,
    decor: null,
    pushingAgainst: null,
    lookMs: 0,
    facing: 'up',
    currentTile: { x: 5, y: 5 },
    bounds: { width: 10, height: 10 },
    place: { room: null },
    controls: { back: BACK, look: {}, favours: {}, talk: {}, decorate: {}, coin: {} },
    keyPresses: {
      justPressed: (key: object) => pressed.delete(key),
    },
    dialogBox: { visible: false, update: () => undefined },
    player: { stop: () => undefined, setFrame: () => undefined },
    learnKey: () => undefined,
    closePhrases: () => undefined,
    showHint: () => undefined,
    hintHere: () => '',
    isInteractionPressed: () => false,
    readInput: () => ({ up: false, down: false, left: false, right: false }),
    isBlocked: () => false,
    turnsToFacePartner: () => false,
    standStill: () => undefined,
    beginStep: (target: unknown) => {
      begun.push(target);
      scene.targetTile = target;
    },
    advanceStep: () => {
      scene.currentTile = scene.targetTile;
      scene.targetTile = null;
    },
  });
  const frame = () => (scene.updateWalking as (deltaMs: number) => void).call(scene, 16);
  return { scene, frame, opened, begun, pressEscape: () => pressed.add(BACK) };
}

describe('calling off a walk the pointer asked for', () => {
  it('opens what was clicked when nothing is pressed', () => {
    const walk = clickedWalk();
    for (let frames = 0; frames < 6; frames += 1) {
      walk.frame();
    }
    expect(walk.begun).toHaveLength(2);
    expect(walk.opened).toEqual(['rack']);
  });

  it('stops at the end of the step under way when ESC is pressed mid-step, and opens nothing', () => {
    const walk = clickedWalk();
    walk.frame();
    expect(walk.scene.targetTile).not.toBeNull();
    walk.pressEscape();
    for (let frames = 0; frames < 6; frames += 1) {
      walk.frame();
    }
    expect(walk.begun).toHaveLength(1);
    expect(walk.opened).toEqual([]);
    expect(walk.scene.walkPlan).toBeNull();
  });

  it('stops where the player stands when ESC is pressed between steps', () => {
    const walk = clickedWalk();
    walk.pressEscape();
    for (let frames = 0; frames < 6; frames += 1) {
      walk.frame();
    }
    expect(walk.begun).toEqual([]);
    expect(walk.opened).toEqual([]);
  });
});

describe('a way in chosen before the rim has been explained', () => {
  const share = shareTheRim(
    insertionsOn('greystone-vale').map((insertion) => ({ id: insertion.id, tile: insertion.position })),
    pitFrameFor(384, 384),
  );
  const rail = ARENA_RIM[0];
  const under = landingBelow(rail, share)!;
  const elsewhere = share.landings.find((landing) => landing.id !== under.id)!;

  function atTheRail(boxUp: boolean) {
    const flow = {
      insertionId: elsewhere.id,
      chooseInsertion(id: string) {
        flow.insertionId = id;
      },
    };
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      arena: { share, aimAt: () => undefined, atTheRail: () => undefined },
      kit: { flow },
      telescope: null,
      arenaPanel: null,
      fogLift: null,
      targetTile: null,
      aimed: null,
      currentTile: rail,
      dialogBox: { visible: boxUp },
    });
    const frame = () => (scene.settleAim as () => void).call(scene);
    return { scene, flow, frame };
  }

  it('is still chosen while the marshal explains it, and when the panel opens', () => {
    const { scene, flow, frame } = atTheRail(true);
    frame();
    frame();
    expect(flow.insertionId).toBe(elsewhere.id);
    (scene.dialogBox as { visible: boolean }).visible = false;
    scene.arenaPanel = 'rim';
    frame();
    expect(flow.insertionId).toBe(elsewhere.id);
    expect(scene.aimed).toBe(elsewhere);
  });

  it('gives way to what is below once the player is simply standing at the rail', () => {
    const { flow, frame } = atTheRail(false);
    frame();
    expect(flow.insertionId).toBe(under.id);
  });

  it('is still chosen after NOT YET, until the player takes a step', () => {
    const { scene, flow, frame } = atTheRail(false);
    scene.arenaPanel = 'rim';
    frame();
    scene.arenaPanel = null;
    frame();
    frame();
    expect(flow.insertionId).toBe(elsewhere.id);
    expect(scene.aimed).toBe(elsewhere);

    // Stepping off and back onto the very same tile counts as walking the rim.
    scene.targetTile = { x: rail.x + 1, y: rail.y };
    frame();
    scene.targetTile = null;
    frame();
    expect(flow.insertionId).toBe(under.id);
    expect(scene.aimed).toBe(under);
  });
});
