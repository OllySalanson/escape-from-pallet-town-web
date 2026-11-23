import { describe, expect, it, vi } from 'vitest';
import { RunManager } from '../run';
import { Pokemon, BULBASAUR } from '../pokemon';
import { getWorldMap } from '../worldMap';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { createRunTrainerEncounters } from '../world/trainers';
import { RAID_CONTRACTS } from '../objectives/contracts';
import { isFirstJobsBanked, NEAR_JOBS } from '../objectives/standingBoard';
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
  leaderHere(): string | undefined;
}

/** CERULEAN GYM's door on GULL STRAND, pressed up from the tile below it. */
const CERULEAN_DOORSTEP = { x: 179, y: 216 };

/** What the raid is out for: a job (the board's first), no job, or a new save's first raid. */
type OutFor = 'job' | 'no job' | 'first raid';

function standingAt(
  tile: { readonly x: number; readonly y: number },
  beaten: readonly string[] = [],
  outFor: OutFor = 'job',
  beatenHere: readonly string[] = [],
): Driven {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, { mapId: 'greystone-vale', durationMs: 60_000 });
  const map = getWorldMap('greystone-vale', beaten);
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision,
    currentTile: tile,
    wayFields: new Map(),
    trainerEncounters: createRunTrainerEncounters().filter((encounter) => encounter.mapId === 'greystone-vale'),
    defeatedTrainerIds: new Set<string>(beatenHere),
    runSession: {
      manager,
      plan: {
        defeatedBosses: beaten,
        ...(outFor === 'job' ? { contract: RAID_CONTRACTS[0] } : {}),
        ...(outFor === 'first raid' ? { stagedChase: true } : {}),
      },
    },
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

  it('leads to the door the whole way on a raid that carries no job', () => {
    // The AI playtest's friends went out with NO JOB to find the gym and were
    // sent after coins (22 Nov 2026): a raid with no job is out for the gym, so
    // the arrow takes it from across the strand.
    expect(standingAt({ x: 140, y: 215 }, [], 'no job').gymDoorNear()?.cue).toMatch(/^CERULEAN GYM: /);
    // Misty beaten, it is the next gym's door instead.
    expect(standingAt({ x: 140, y: 215 }, [MISTY_BOSS_ID], 'no job').gymDoorNear()?.cue).toMatch(/^FUCHSIA GYM: /);
  });

  it('keeps a job ahead of the gym until the door is near, and leaves a first raid to its stake', () => {
    // Led to the gym the whole way once the first jobs were banked, three of
    // the 22 Nov retest's five friends were walked off a job they carried.
    expect(standingAt({ x: 140, y: 215 }, [], 'job').gymDoorNear()).toBeUndefined();
    expect(standingAt({ x: 140, y: 215 }, [], 'first raid').gymDoorNear()).toBeUndefined();
    expect(standingAt({ x: 173, y: 217 }, [], 'first raid').gymDoorNear()?.cue).toMatch(/^CERULEAN GYM: /);
  });

  it('names the leader inside the gym, rather than turning green for the door it came in by', () => {
    // FUCHSIA GYM's floor, a few steps in: KOGA is at the north end. The arrow
    // led a friend to the door and then pointed back out to the nearest exit
    // (persona playtest, 23 Nov 2026).
    const inside = { x: 392, y: 380 };
    expect(standingAt(inside, [MISTY_BOSS_ID], 'no job').leaderHere()).toBe('KOGA: N');
    expect(standingAt(inside, [MISTY_BOSS_ID], 'job').leaderHere()).toBe('KOGA: N');
    // Beaten on this raid, or the gym already won: nothing to name.
    expect(standingAt(inside, [MISTY_BOSS_ID], 'no job', [KOGA_BOSS_ID]).leaderHere()).toBeUndefined();
    expect(standingAt(inside, [MISTY_BOSS_ID, KOGA_BOSS_ID], 'no job').leaderHere()).toBeUndefined();
    // Outdoors, it is the door's to say.
    expect(standingAt({ x: 140, y: 215 }, [MISTY_BOSS_ID], 'no job').leaderHere()).toBeUndefined();
  });

  it('counts the first jobs as the finish line does: the chain, then the near jobs', () => {
    const chain = RAID_CONTRACTS.map((contract) => contract.id);
    expect(isFirstJobsBanked({ completedContracts: chain, standingContractsBanked: NEAR_JOBS })).toBe(true);
    expect(isFirstJobsBanked({ completedContracts: chain, standingContractsBanked: NEAR_JOBS - 1 })).toBe(false);
    expect(isFirstJobsBanked({ completedContracts: chain.slice(1), standingContractsBanked: NEAR_JOBS })).toBe(false);
  });
});
