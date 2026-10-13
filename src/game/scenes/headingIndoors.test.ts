import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { GridPosition } from '../movement/gridMovement';
import { FIRST_CONTRACT } from '../objectives/contracts';
import { getWorldMap } from '../worldMap';
import { BUILDING_INSIDES } from '../world/buildingInsides';
import { stepDistances } from '../world/mapStructure';
import { WorldScene } from './WorldScene';

/** The heading the objective chip, the hunter chip and a prize in view all print. */
interface Driven {
  headingTo(target: GridPosition): string;
}

const PRESS = BUILDING_INSIDES.find((inside) => inside.area.id === 'press-house')!;

/** The player standing on the press house's first mat, on the Floodplain as a fresh save has it. */
function onThePressHouseMat(): { scene: Driven; mat: GridPosition } {
  const map = getWorldMap('floodplain-relay');
  const room = map.areas!.find((area) => area.id === PRESS.area.id)!;
  const mat = map.warps.find(
    (warp) => warp.source.y >= room.rect.y && warp.source.y < room.rect.y + room.rect.height,
  )!.source;
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, { currentMap: map, currentTile: mat });
  return { scene: scene as unknown as Driven, mat };
}

describe('a heading from inside a room', () => {
  it('points at a door even when the thing it names cannot be walked to from here today', () => {
    // The lost field kit, from the press house with every gate shut: the
    // Cider Yard's doors open onto ground that does not reach it. The chip
    // used to fall back on a straight line across the grid the rooms are laid
    // out on, and read "LOST KIT: W" - a wall, and nowhere on the map.
    const { scene, mat } = onThePressHouseMat();
    const map = getWorldMap('floodplain-relay');
    const kit = FIRST_CONTRACT.markers[0].position;
    expect(stepDistances(map.collision, kit, new Set(), map.links)[mat.y][mat.x]).toBe(-1);

    // Every door out of the press house is pressed down, through the south wall.
    expect(scene.headingTo(kit)).toBe('S');
  });

  it('still points straight at something in the same room', () => {
    const { scene, mat } = onThePressHouseMat();
    expect(scene.headingTo({ x: mat.x + 3, y: mat.y - 3 })).toBe('NE');
  });
});
