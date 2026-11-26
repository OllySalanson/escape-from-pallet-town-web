import { describe, expect, it } from 'vitest';
import { isFurniture, isWearableItem } from '../items';
import { CHART_PIECES } from '../treasure/treasureMap';
import { findsToKeepRoomFor } from './findRoom';

const none = { held: () => 0, owns: () => false };

describe('the finds the locker can keep room for', () => {
  it('offers the materials and the money, whether or not any is at home', () => {
    const finds = findsToKeepRoomFor({ progress: { errands: [] }, ...none });
    expect(finds).toContain('parts-crate');
    expect(finds).toContain('money');
  });

  it('never offers furniture or clothes, which come home in a pack that comes home', () => {
    const finds = findsToKeepRoomFor({ progress: { errands: [] }, ...none });
    expect(finds.filter((itemId) => isFurniture(itemId) || isWearableItem(itemId))).toEqual([]);
  });

  it('offers a piece of the sea chart only once the hunt has started', () => {
    const piece = CHART_PIECES[0].itemId;
    expect(findsToKeepRoomFor({ progress: { errands: [] }, ...none })).not.toContain(piece);
    expect(findsToKeepRoomFor({ progress: { errands: [], treasureHunt: { pinned: [piece] } }, ...none })).toContain(piece);
  });
});
