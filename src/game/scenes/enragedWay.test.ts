import { describe, expect, it, vi } from 'vitest';
import { RunManager } from '../run';
import { Pokemon, BULBASAUR } from '../pokemon';
import { WorldScene } from './WorldScene';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

interface Driven {
  raidWay(): { readonly cue?: string; readonly mark: { readonly tile: { x: number; y: number }; readonly out: boolean } | null };
}

/** WESTWARD ROAD, one step west of where the player stands. */
const EXIT = { label: 'Westward Road', heading: 'W', position: { x: 64, y: 158 } };
/** The job's next stop, the other way. */
const STAKE = { cue: 'STAKE 1: E (3 LEFT)', tile: { x: 150, y: 153 }, out: false };

/** The real scene's `raidWay`, standing beside an exit with a job still to do, the clock at `elapsedMs`. */
function holdingAJob(elapsedMs: number): Driven {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, { mapId: 'greystone-vale', durationMs: 60_000 });
  manager.tick(elapsedMs);
  const grid = [[true]];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: { id: 'greystone-vale' },
    collisionData: grid,
    currentTile: { x: 65, y: 158 },
    wayFields: new Map(),
    collectedLootIds: new Set(),
    activatedPoiIds: new Set(),
    bag: { revision: 0 },
    runSession: { manager, plan: {} },
    hunterPackHere: () => undefined,
    nearestExitCue: () => EXIT,
    contractTarget: () => STAKE,
    gymDoorNear: () => undefined,
    leaderHere: () => undefined,
    lootForCurrentMap: () => [],
    wayMarkTo: (tile: { x: number; y: number }, out: boolean) => ({ tile, out }),
  });
  return scene as unknown as Driven;
}

describe('the gold arrow once the hunters are ENRAGED', () => {
  it('leaves the job for the nearest way out, and the chip says so', () => {
    // One step beside WESTWARD ROAD at 0:00, the arrow still said STAKE 1: E,
    // away from the exit, with 15 seconds left (scenario loop, 23 Nov 2026).
    const way = holdingAJob(60_000).raidWay();
    expect(way.cue).toBe('OUT NOW VIA WESTWARD ROAD: W');
    expect(way.mark).toEqual({ tile: EXIT.position, out: true });
  });

  it('keeps to the job while the clock is still running', () => {
    const way = holdingAJob(59_000).raidWay();
    expect(way.cue).toBe(STAKE.cue);
    expect(way.mark).toEqual({ tile: STAKE.tile, out: false });
  });
});
