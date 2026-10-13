import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { requireInsertion } from '../run/runGeneration';
import { EXTRACTION_POINTS, isExtractionAvailable, type ExtractionPoint } from './extractionPoints';
import { nearestOpenExit } from './nearestExit';

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
