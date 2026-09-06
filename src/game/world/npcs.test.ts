import { describe, expect, it } from 'vitest';
import { nextTileFromDirection } from '../movement/gridMovement';
import { getWorldEntityAt } from './npcs';

describe('world interaction targets', () => {
  it('finds the route guide directly in front of the player', () => {
    const facedTile = nextTileFromDirection({ x: 6, y: 8 }, 'left');
    expect(getWorldEntityAt(facedTile)).toEqual({
      id: 'route-guide',
      kind: 'npc',
      position: { x: 5, y: 8 },
      facing: 'right',
      dialogLines: [
        'Pallet Town is small, but every great journey starts somewhere.',
        'The tall grass is waiting just beyond town!',
      ],
    });
  });

  it('finds the town sign directly in front of the player', () => {
    const facedTile = nextTileFromDirection({ x: 9, y: 9 }, 'up');
    expect(getWorldEntityAt(facedTile)).toMatchObject({
      id: 'town-sign',
      dialogLines: ['PALLET TOWN', 'A town of new beginnings.'],
    });
  });
});
