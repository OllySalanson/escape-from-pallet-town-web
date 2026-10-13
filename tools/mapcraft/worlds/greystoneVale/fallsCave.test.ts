import { describe, expect, it } from 'vitest';
import { MATERIAL_CHARS } from '../../../../src/game/world/tileset/materials';
import { solveBoulderFloor, type BoulderFloor } from '../../puzzle';
import type { Point } from '../../program';
import { walkingSteps, readTiles } from '../../tiles';
import {
  FALLS_BARRIER_ID,
  FALLS_LANDINGS,
  fallsCaveArea,
  fallsCaveBoulders,
} from './fallsCave';
import { lostGarden } from './lostGarden';
import { powerStation } from './powerStation';

/**
 * The Falls Cave is the Lost Garden's one way in, and its floor is a puzzle:
 * held here to being one that can be solved, by the game's own rules, and to
 * being the only way through.
 */
const area = fallsCaveArea();
const barrier = area.barriers![0];
const barrierTiles: Point[] = Array.from({ length: barrier.height }, (_, k) => [barrier.x, barrier.y + k]);

function floor(boulders: readonly Point[] = fallsCaveBoulders().map((b) => [b.x, b.y])): BoulderFloor {
  return {
    solid: area.ground.map((row) => [...row].map((letter) => letter === MATERIAL_CHARS.wall)),
    keepClear: [FALLS_LANDINGS.station, FALLS_LANDINGS.garden],
    boulders,
    plates: area.switches!.map((plate) => ({ at: [plate.x, plate.y] as Point, opens: plate.opens })),
    barriers: [{ id: barrier.id, tiles: barrierTiles }],
    start: FALLS_LANDINGS.station,
  };
}

/** Steps across the floor from the station's landing to the garden's, with the barrier a wall or not. */
function crossing(open: boolean): number {
  const ground = area.ground.map((row, y) =>
    [...row]
      .map((letter, x) =>
        !open && barrierTiles.some(([bx, by]) => bx === x && by === y) ? MATERIAL_CHARS.wall : letter,
      )
      .join(''),
  );
  const map = readTiles({ ...area, ground, buildings: [] } as never);
  return walkingSteps(map, FALLS_LANDINGS.station)[FALLS_LANDINGS.garden[1]][FALLS_LANDINGS.garden[0]];
}

describe('the Falls Cave', () => {
  it('is shut between its two mouths by the barrier, and open once it lifts', () => {
    expect(crossing(false)).toBe(-1);
    expect(crossing(true)).toBeGreaterThan(0);
  });

  it('has two floor switches, both opening the one barrier', () => {
    expect(area.switches).toHaveLength(2);
    expect(area.switches!.every((plate) => plate.kind === 'plate' && plate.opens === FALLS_BARRIER_ID)).toBe(true);
  });

  it('can be solved from the station side by the game\'s own rules, in a dozen pushes or so', () => {
    const answer = solveBoulderFloor(floor(), { countDead: false });
    expect(answer.solved).toBe(true);
    expect(answer.pushes).toBeGreaterThanOrEqual(8);
    expect(answer.pushes).toBeLessThanOrEqual(20);
  });

  it('rides in both its districts alike, and its boulders in the station\'s file alone', () => {
    const station = powerStation().file;
    const garden = lostGarden().file;
    const cave = (file: typeof station) => file.areas?.find((candidate) => candidate.id === area.id);
    expect(cave(station)).toEqual(cave(garden));
    expect(station.boulders?.filter((boulder) => boulder.area === area.id)).toHaveLength(3);
    expect(garden.boulders ?? []).toEqual([]);
  });
});
