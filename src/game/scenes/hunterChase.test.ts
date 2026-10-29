import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { GridPosition } from '../movement/gridMovement';
import { RunPhase } from '../run/RunManager';
import { frontDoorFor } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { DEFAULT_HUNTER_TUNING, findHunterPursuitPath, type HunterState } from '../world/hunter';
import { stepDistances } from '../world/mapStructure';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  hunterState: HunterState;
  advanceHunterPursuit(): void;
  hunterBlocker(): (tile: GridPosition) => boolean;
  wasMet(entity: unknown): boolean;
}

/**
 * The captain on 29 Oct, fleeing Blue: once the hunter stopped searching and
 * came back on the trail, every step walked at half pace, and walking back
 * into it and fleeing again (another search, so no chase) put the pace right.
 * The chase was the cost: every step the player took paid for a search of the
 * map, and that search asked every figure on the map about every tile it
 * reached. These are the real scene's own chase and blocker, on the real
 * Floodplain, its figures standing.
 */
function chased(stepsAway: number) {
  const map = getWorldMap('floodplain-relay');
  const bounds = { width: map.width, height: map.height, links: map.links };
  const player = frontDoorFor('floodplain-relay')!.position;
  const distances = stepDistances(map.collision, player, undefined, map.links);
  const y = distances.findIndex((row) => row.includes(stepsAway));
  const hunter = { x: distances[y].indexOf(stepsAway), y };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision,
    bounds,
    currentTile: player,
    currentInterior: null,
    hunterNear: false,
    hunterFacing: 'down',
    hunterState: { spawned: true, defeated: false, mapId: map.id, position: hunter },
    idleFigures: [],
    caughtLegends: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    activatedPoiIds: new Set<string>(),
    runSession: {
      manager: { phase: RunPhase.InRun, isEnraged: false, snapshot: () => ({ elapsedMs: 60_000 }) },
      plan: { hunter: { ...DEFAULT_HUNTER_TUNING, aggressionStepsPerPlayerStep: 1 } },
    },
    placeFigure: vi.fn(),
  });
  return { scene: scene as unknown as Driven, map, bounds, player };
}

describe('a chase', () => {
  it('asks where each figure stands once a step, not once for every tile it searches', () => {
    const { scene, map, bounds, player } = chased(60);
    const asked = vi.spyOn(scene, 'wasMet');
    const before = findHunterPursuitPath(scene.hunterState.position!, player, bounds, scene.hunterBlocker());
    asked.mockClear();

    scene.advanceHunterPursuit();
    const questions = asked.mock.calls.length;

    // One step nearer, by the map's own shortest route.
    const after = findHunterPursuitPath(scene.hunterState.position!, player, bounds, scene.hunterBlocker());
    expect(after.length).toBe(before.length - 1);
    // Every figure asked once, by the one blocker the step's search used. It
    // was every figure for every tile the search reached: hundreds of
    // thousands of questions a step on Greystone Vale.
    expect(map.entities.length).toBeGreaterThan(10);
    expect(questions).toBeLessThanOrEqual(map.entities.length);
  });

  it('still walks round every figure standing on the map', () => {
    const { scene, map } = chased(10);
    const isBlocked = scene.hunterBlocker();
    // Figures on ground that is otherwise open, so it is the figure that stops it.
    const standing = map.entities.filter(
      (entity) =>
        !entity.pokemon && !entity.boulder && !entity.barrier && map.collision[entity.position.y][entity.position.x] === false,
    );

    expect(standing.length).toBeGreaterThan(0);
    for (const entity of standing) {
      expect(isBlocked(entity.position)).toBe(true);
    }
  });
});
