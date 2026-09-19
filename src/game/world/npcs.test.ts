import { describe, expect, it } from 'vitest';
import { nextTileFromDirection } from '../movement/gridMovement';
import { getWorldEntityAt } from './npcs';

describe('world interaction targets', () => {
  it('finds the market square guide directly in front of the player', () => {
    // The guide stands on the square's paving looking west, so the tile in
    // front of them is the one to their left, and the player on it faces right.
    const facedTile = nextTileFromDirection({ x: 8, y: 10 }, 'right');
    expect(getWorldEntityAt('pallet-town', facedTile)).toMatchObject({
      id: 'route-guide',
      kind: 'npc',
      position: { x: 9, y: 10 },
    });
  });

  it('finds the town sign directly in front of the player', () => {
    // The board stands under the houses at the head of the square and is read
    // from the paving below it.
    const facedTile = nextTileFromDirection({ x: 9, y: 9 }, 'up');
    expect(getWorldEntityAt('pallet-town', facedTile)).toMatchObject({
      id: 'town-sign',
      kind: 'sign',
    });
  });

  it('never returns another map\u2019s entity for the same tile', () => {
    // The town sign's own tile, asked of a map it does not stand on.
    expect(getWorldEntityAt('pallet-town', { x: 9, y: 8 })?.id).toBe('town-sign');
    expect(getWorldEntityAt('viridian-forest', { x: 9, y: 8 })).toBeUndefined();
  });
});
