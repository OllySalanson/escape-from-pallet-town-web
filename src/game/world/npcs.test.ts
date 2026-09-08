import { describe, expect, it } from 'vitest';
import { nextTileFromDirection } from '../movement/gridMovement';
import { getWorldEntityAt } from './npcs';

describe('world interaction targets', () => {
  it('finds the market square guide directly in front of the player', () => {
    const facedTile = nextTileFromDirection({ x: 5, y: 8 }, 'up');
    expect(getWorldEntityAt('pallet-town', facedTile)).toMatchObject({
      id: 'route-guide',
      kind: 'npc',
      position: { x: 5, y: 7 },
    });
  });

  it('finds the town sign directly in front of the player', () => {
    const facedTile = nextTileFromDirection({ x: 9, y: 5 }, 'up');
    expect(getWorldEntityAt('pallet-town', facedTile)).toMatchObject({
      id: 'town-sign',
      kind: 'sign',
    });
  });

  it('never returns another map\u2019s entity for the same tile', () => {
    expect(getWorldEntityAt('viridian-forest', { x: 9, y: 4 })).toBeUndefined();
  });
});
