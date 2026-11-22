import { describe, expect, it, vi } from 'vitest';
import { RunManager } from '../run';
import { Pokemon, BULBASAUR } from '../pokemon';
import { getWorldMap } from '../worldMap';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import { WorldScene } from './WorldScene';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

/** What the gold arrow asks of the real scene near a gym. */
interface Driven {
  gymDoorNear(): { readonly cue: string; readonly tile: { readonly x: number; readonly y: number } } | undefined;
}

/** CERULEAN GYM's door on GULL STRAND, pressed up from the tile below it. */
const CERULEAN_DOORSTEP = { x: 179, y: 216 };

function standingAt(tile: { readonly x: number; readonly y: number }, beaten: readonly string[] = []): Driven {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, { mapId: 'greystone-vale', durationMs: 60_000 });
  const map = getWorldMap('greystone-vale', beaten);
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision,
    currentTile: tile,
    wayFields: new Map(),
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    runSession: { manager, plan: { defeatedBosses: beaten } },
  });
  return scene as unknown as Driven;
}

describe('the gold arrow at the next gym', () => {
  it('turns to the door once it is a few steps off, and leads to the doorstep', () => {
    // Seven of tester 3's sessions hunted for CERULEAN GYM's door under a
    // caption that shows along the whole front (AI playtest, 22 Nov 2026).
    const near = standingAt({ x: 173, y: 217 }).gymDoorNear();
    expect(near?.cue).toMatch(/^CERULEAN GYM: (E|NE)$/);
    expect(standingAt(CERULEAN_DOORSTEP).gymDoorNear()?.cue).toBe('CERULEAN GYM: N');
  });

  it('leaves the arrow to the job from across the strand, and for a gym already beaten', () => {
    expect(standingAt({ x: 140, y: 215 }).gymDoorNear()).toBeUndefined();
    expect(standingAt({ x: 173, y: 217 }, [MISTY_BOSS_ID]).gymDoorNear()?.cue ?? '').not.toMatch(/CERULEAN/);
  });
});
