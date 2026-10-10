import { describe, expect, it } from 'vitest';
import { blankMap, placeSpot, updateThing, type SpotKind } from './draft';
import { markBoxes } from './mapPainter';
import type { MapFile } from '../world/mapFile';

/** The boxes the painter would redraw when `change` turns `before` into `after`. */
function repainted(before: MapFile, after: MapFile): string[] {
  const was = markBoxes(before, undefined);
  const now = markBoxes(after, undefined);
  return [
    ...[...was.keys()].filter((key) => !now.has(key)),
    ...[...now.keys()].filter((key) => !was.has(key)),
  ];
}

const placed = (kind: SpotKind) => {
  const outcome = placeSpot(blankMap(30, 20), kind, { x: 10, y: 10 });
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return outcome;
};

describe('what the kept picture redraws', () => {
  it.each([
    ['pokemon', { species: 'snorlax' }],
    ['berry-tree', { berry: 'rawst' }],
  ] as const)('redraws a %s when it changes, including the row its head is in', (kind, change) => {
    const { file, thing } = placed(kind);
    const changed = updateThing(file, thing, change);
    expect(repainted(file, changed)).toHaveLength(2);
    const box = [...markBoxes(changed, undefined).entries()].find(([key]) => key.startsWith(kind))![1];
    expect(box.y).toBe(9);
    expect(box.height).toBe(2);
  });

  it('redraws a boulder where it is placed and where it is taken away', () => {
    const { file } = placed('boulder');
    expect(repainted(blankMap(30, 20), file)).toHaveLength(1);
  });
});
