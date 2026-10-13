import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { requireInsertion } from '../run/runGeneration';
import { EXTRACTION_POINTS, isExtractionAvailable, type ExtractionPoint } from './extractionPoints';
import { nearestOpenExit, walkingStepsFrom } from './nearestExit';

const pallet = getWorldMap('pallet-town');
const palletExits = EXTRACTION_POINTS.filter((point) => point.mapId === 'pallet-town');
const openAt = (elapsedMs: number) => (point: ExtractionPoint) => isExtractionAvailable(point, elapsedMs, new Set());

function nearestFrom(insertionId: Parameters<typeof requireInsertion>[0], elapsedMs = 0): string | undefined {
  return nearestOpenExit(
    palletExits,
    requireInsertion(insertionId).position,
    pallet.collision,
    openAt(elapsedMs),
    pallet.links,
  )?.label;
}

describe('the nearest open exit', () => {
  it('is the quarry track from the quarry, not the south gate across the valley', () => {
    expect(nearestFrom('pallet-quarry')).toBe('QUARRY TRACK');
  });

  it('is the south gate from the town square', () => {
    expect(nearestFrom('town-square')).toBe('SOUTH GATE');
  });

  it('never names an exit behind a shut gate, however close it is in a straight line', () => {
    // The strand lands twenty tiles from the HEADLAND STEPS, which stand behind
    // both of Salter Cobb's doors.
    expect(nearestFrom('pallet-strand')).not.toBe('HEADLAND STEPS');
  });

  it('waits for a timed exit to open before naming it', () => {
    expect(nearestFrom('pallet-strand', 0)).not.toBe('FERRY HARD');
    expect(nearestFrom('pallet-strand', 45_000)).toBe('FERRY HARD');
  });

  it('is nothing when no exit is open', () => {
    expect(nearestOpenExit(palletExits, { x: 7, y: 9 }, pallet.collision, () => false, pallet.links)).toBeUndefined();
  });
});

describe('walking steps to a place', () => {
  // A wall down the middle with a gap at the bottom; the top right is a solid
  // tile standing on its own, worked from beside it.
  const o = false;
  const X = true;
  const grid = [
    [o, X, o, X],
    [o, X, o, o],
    [o, o, o, o],
  ];
  const stepsTo = walkingStepsFrom({ x: 0, y: 0 }, grid);

  it('counts the walk round a wall, not the straight line', () => {
    expect(stepsTo({ x: 2, y: 0 })).toBe(6);
  });

  it('reaches a solid tile from the tile beside it', () => {
    expect(stepsTo({ x: 3, y: 0 })).toBe(6);
  });

  it('is undefined for a place nobody can stand beside', () => {
    expect(walkingStepsFrom({ x: 0, y: 0 }, [[o, X, X, X]])({ x: 3, y: 0 })).toBeUndefined();
  });
});
