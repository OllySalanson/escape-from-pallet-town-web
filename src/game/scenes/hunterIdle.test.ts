import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { KeyPresses } from '../input/KeyPresses';
import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import {
  DEFAULT_HUNTER_TUNING,
  findHunterPursuitPath,
  findHunterSpawnTile,
  HUNTER_IDLE_STEP_MS,
  HUNTER_SEARCH_MS,
  HUNTER_SPAWN_DISTANCE,
  type HunterState,
} from '../world/hunter';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  hunterState: HunterState;
  hunterStillMs: number;
  targetTile: GridPosition | null;
  pendingTrainerBattle: { trainer: { name: string; party: readonly Pokemon[] }; isHunter: boolean } | undefined;
  advanceHunterWhileStill(chargedMs: number): void;
  advanceRunClock(deltaMs: number): void;
  tryStartHunterBattle(): boolean;
}

/**
 * The hunter arriving on a player who then stands still, on the real
 * Floodplain: the player on its front door's tile and the hunter where the
 * real arrival search puts it, `HUNTER_SPAWN_DISTANCE` walking steps off.
 */
function standingStill(
  { elapsedMs = 90_000, enraged = false, hunter: hunterOverride }: {
    elapsedMs?: number;
    enraged?: boolean;
    hunter?: Partial<HunterState>;
  } = {},
) {
  const map = getWorldMap('floodplain-relay');
  const isBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
  const bounds = { width: map.width, height: map.height };
  const player = map.collision
    .flatMap((row, y) => row.map((_blocked, x) => ({ x, y })))
    .find((tile) => !isBlocked(tile) && findHunterSpawnTile(tile, bounds, isBlocked) !== null)!;
  const hunter = findHunterSpawnTile(player, bounds, isBlocked, (tiles) => tiles[0])!;

  const interrupted: string[] = [];
  /** Each arrival the hunter made, as `hunterArrives` was told it: back for the enrage, or not. */
  const arrivals: ('arrived' | 'back')[] = [];
  const clock = { elapsedMs, isEnraged: enraged };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    keyPresses: new KeyPresses(() => 0),
    currentMap: map,
    collisionData: map.collision,
    bounds,
    currentTile: player,
    targetTile: null,
    facing: 'down',
    currentInterior: null,
    hunterNear: false,
    hunterFacing: 'down',
    hunterStillMs: 0,
    hunterState: {
      spawned: true,
      defeated: false,
      mapId: map.id,
      position: hunter,
      ...hunterOverride,
    },
    activatedPoiIds: new Set<string>(),
    defeatedTrainerIds: new Set<string>(),
    bag: new Bag(),
    dialogBox: { visible: false, showMessages: vi.fn(), setY: vi.fn() },
    party: new PokemonParty([new Pokemon(CHARMANDER, 10)]),
    runSession: {
      stepsTaken: 40,
      manager: {
        phase: RunPhase.InRun,
        get isEnraged() {
          return clock.isEnraged;
        },
        isEnrageGraceExpired: false,
        snapshot: () => ({ elapsedMs: clock.elapsedMs }),
        tick: (deltaMs: number) => {
          clock.elapsedMs += deltaMs;
          return { elapsedMs: clock.elapsedMs, isEnraged: clock.isEnraged };
        },
      },
      plan: { hunter: { ...DEFAULT_HUNTER_TUNING, spawnDelayMs: 60_000 } },
    },
    // What is drawn, and what the map's other figures and exits add to the
    // hunter's collision, is not what these tests are about.
    placeFigure: vi.fn(),
    createHunterSprite: vi.fn(),
    playCutscene: vi.fn(),
    hunterBlocker: () => isBlocked,
    findHunterSpawnTile: () => findHunterSpawnTile(player, bounds, isBlocked, (tiles) => tiles[0]),
    interrupt: (lines: readonly string[]) => interrupted.push(...lines),
    hunterArrives: (returning: boolean) => arrivals.push(returning ? 'back' : 'arrived'),
    refreshExtractionMarkers: vi.fn(),
    refreshRunTimerHud: vi.fn(),
  });

  const driven = scene as unknown as Driven;
  /** Walking steps from the hunter to the player: the pursuit stops beside them, one short. */
  const stepsBetween = (): number =>
    findHunterPursuitPath(driven.hunterState.position!, player, bounds, isBlocked).length + 1;
  return { scene: driven, player, clock, interrupted, arrivals, stepsBetween };
}

describe('a player standing still with the hunter on the map', () => {
  it('is never charged a step for a pause shorter than the interval, so a sign can be read', () => {
    const { scene, stepsBetween } = standingStill();
    const before = stepsBetween();

    for (let ms = 0; ms < HUNTER_IDLE_STEP_MS - 16; ms += 16) {
      scene.advanceHunterWhileStill(16);
    }

    expect(stepsBetween()).toBe(before);
  });

  it('is walked up to a step every interval, and caught: standing still is not a hiding place', () => {
    const { scene, stepsBetween } = standingStill();
    expect(stepsBetween()).toBe(HUNTER_SPAWN_DISTANCE);

    scene.advanceHunterWhileStill(HUNTER_IDLE_STEP_MS);
    expect(stepsBetween()).toBe(HUNTER_SPAWN_DISTANCE - 1);

    // Playtest 33 left it five tiles off for 231 seconds and it never moved.
    for (let ms = 0; ms < 231_000; ms += 16) {
      scene.advanceHunterWhileStill(16);
    }
    expect(scene.tryStartHunterBattle()).toBe(true);
    expect(scene.pendingTrainerBattle?.isHunter).toBe(true);
  });

  it('starts counting again on every step, which is the hunter step already', () => {
    const { scene, stepsBetween } = standingStill();
    const before = stepsBetween();

    scene.advanceHunterWhileStill(HUNTER_IDLE_STEP_MS - 1_000);
    // Mid-step, the player is not standing still.
    scene.targetTile = { x: 0, y: 0 };
    scene.advanceHunterWhileStill(500);
    scene.targetTile = null;
    scene.advanceHunterWhileStill(HUNTER_IDLE_STEP_MS - 1_000);

    expect(stepsBetween()).toBe(before);
  });

  it('is left alone by a hunter that lost the trail, for as long as it searches', () => {
    const { scene, stepsBetween } = standingStill({ hunter: { searchRemainingMs: HUNTER_SEARCH_MS } });
    const before = stepsBetween();

    scene.advanceHunterWhileStill(HUNTER_SEARCH_MS - 1);

    expect(stepsBetween()).toBe(before);
  });

  it('is closed on at the hunter stride an enrage gives it', () => {
    const { scene, stepsBetween } = standingStill({ enraged: true });

    scene.advanceHunterWhileStill(HUNTER_IDLE_STEP_MS);

    expect(stepsBetween()).toBe(HUNTER_SPAWN_DISTANCE - 2);
  });

  it('is charged by the raid clock, so no time the clock does not charge is standing still', () => {
    const { scene, stepsBetween } = standingStill();
    const before = stepsBetween();

    // What the clock charges a frame of a briefing, a cutscene or a fight being handed over.
    for (let frame = 0; frame < 1_000; frame += 1) {
      scene.advanceHunterWhileStill(0);
    }

    expect(stepsBetween()).toBe(before);
  });
});

describe('a beaten hunter', () => {
  const beaten = { spawned: true, defeated: true, position: undefined } satisfies Partial<HunterState>;

  it('stays beaten while there is clock left', () => {
    const { scene, interrupted, arrivals } = standingStill({ hunter: beaten });

    scene.advanceRunClock(100_000);

    expect(scene.hunterState.defeated).toBe(true);
    expect(interrupted).toEqual([]);
    expect(arrivals).toEqual([]);
  });

  it('comes back when the clock runs out, saying so, and fights on the enraged rung', () => {
    const { scene, interrupted, arrivals } = standingStill({ elapsedMs: 300_000, enraged: true, hunter: beaten });

    scene.advanceRunClock(16);

    expect(scene.hunterState).toMatchObject({ spawned: true, defeated: false, returning: false });
    expect(scene.hunterState.position).toBeDefined();
    // Said by the chip and the edge glow, never a box that stops the player.
    expect(arrivals).toEqual(['back']);
    expect(interrupted).toEqual([]);

    // Walked into, it is the enraged team: three levels above the player's.
    scene.advanceHunterWhileStill(HUNTER_IDLE_STEP_MS * 3);
    expect(scene.tryStartHunterBattle()).toBe(true);
    expect(scene.pendingTrainerBattle?.trainer.party[0].level).toBe(13);
  });

  it('comes back once: beaten again in the enrage, it is gone for the raid', () => {
    const { scene, arrivals } = standingStill({ elapsedMs: 300_000, enraged: true, hunter: beaten });
    scene.advanceRunClock(16);
    // What BattleScene hands back after the win.
    scene.hunterState = { ...scene.hunterState, defeated: true };
    arrivals.length = 0;

    scene.advanceRunClock(10_000);

    expect(scene.hunterState.defeated).toBe(true);
    expect(arrivals).toEqual([]);
  });

  it('beaten for the first time in the enrage, never comes back at all', () => {
    const { scene, arrivals } = standingStill({ elapsedMs: 300_000, enraged: true });
    scene.advanceRunClock(16);
    scene.hunterState = { ...scene.hunterState, defeated: true };

    scene.advanceRunClock(10_000);

    expect(scene.hunterState.defeated).toBe(true);
    expect(arrivals).toEqual([]);
  });
});
