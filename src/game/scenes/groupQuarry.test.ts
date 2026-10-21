import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const room = vi.hoisted(() => ({
  friendTile: { x: 0, y: 0 },
}));

vi.mock('../raidRoom/friendRoom', () => ({
  friendRoom: () => ({
    room: { code: 'BCDF', mapId: 'floodplain-relay', me: 'me' },
    othersOn: () => [{ id: 'amy' }],
    figuresOn: () => [{ id: 'amy', place: 'floodplain-relay', tile: room.friendTile, toward: null, progress: 0, facing: 'down', name: 'AMY' }],
    hunters: { busy: new Set<string>() },
  }),
}));

import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap } from '../worldMap';
import { BUILDING_INSIDES } from '../world/buildingInsides';
import { stepDistances } from '../world/mapStructure';
import { WorldScene } from './WorldScene';

const PRESS = BUILDING_INSIDES.find((inside) => inside.area.id === 'press-house')!;

/** A floor tile of the press house, a yard tile 3 walking steps from it, and a yard tile 10 walking steps from that. */
function besideThePressHouse(): { room: GridPosition; doorstep: GridPosition; yard: GridPosition } {
  const map = getWorldMap('floodplain-relay');
  const rect = map.areas!.find((area) => area.id === PRESS.area.id)!.rect;
  const outdoors = map.areas![0].rect;
  const tileAt = (distances: ReturnType<typeof stepDistances>, steps: number): GridPosition | null => {
    for (let y = outdoors.y; y < outdoors.y + outdoors.height; y += 1) {
      for (let x = outdoors.x; x < outdoors.x + outdoors.width; x += 1) {
        if (distances[y][x] === steps) {
          return { x, y };
        }
      }
    }
    return null;
  };
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (map.collision[y][x]) {
        continue;
      }
      const doorstep = tileAt(stepDistances(map.collision, { x, y }, undefined, map.links), 3);
      const yard = doorstep && tileAt(stepDistances(map.collision, doorstep, undefined, map.links), 10);
      if (doorstep && yard) {
        return { room: { x, y }, doorstep, yard };
      }
    }
  }
  throw new Error('no doorstep beside the press house');
}

describe('the room’s one hunter, with a player indoors', () => {
  it('chases whoever is nearest by the walk through the door, not by a straight line across the grid', () => {
    const map = getWorldMap('floodplain-relay');
    const { room: inside, doorstep, yard } = besideThePressHouse();
    room.friendTile = yard;
    const straight = (a: GridPosition, b: GridPosition) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    // Straight across the composed grid the room lies far east of the yard, so
    // a straight count puts the friend ten steps off nearer than this player.
    expect(straight(inside, doorstep)).toBeGreaterThan(straight(yard, doorstep));

    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: map,
      currentTile: inside,
      runSession: {},
      hunterState: { spawned: true, defeated: false, mapId: map.id, position: doorstep },
    });
    const quarry = (scene as unknown as { groupQuarry(): { id: string } | null }).groupQuarry();
    expect(quarry?.id).toBe('me');
  });
});
