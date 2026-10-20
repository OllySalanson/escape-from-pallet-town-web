import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../worldMap';
import { CHARACTER_FEET_PIXEL_Y } from '../playerFrames';
import { areaFrame } from './areaFrame';
import { PLAYER_MARKER_GROUND_LAYERS } from './characterPresentation';
import { layOutAreas } from './mapAreas';

/** The lowest world pixel row drawn for a player standing on a tile row: soles and ground ring. */
function lowestDrawnRow(tileY: number): number {
  const frameTop = tileY * TILE_SIZE + TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
  const ringFoot = Math.max(
    ...PLAYER_MARKER_GROUND_LAYERS.flatMap((layer) => layer.rects.map((rect) => rect.y + rect.height - 1)),
  );
  return frameTop + Math.max(CHARACTER_FEET_PIXEL_Y, ringFoot);
}

const VIEW = { width: 400, height: 256 };

describe('the dark round a place', () => {
  // Every room's door mat is on its last row, so this is where a player
  // arriving in any building stands: the slab under the room cut their
  // shoes and ground ring off.
  it('leaves a player standing on a room’s last row whole, feet and ring', () => {
    const room = { x: 70, y: 1, width: 12, height: 9 };
    const { slabs, bounds } = areaFrame(room, VIEW);
    const below = slabs.find((slab) => slab.y > room.y * TILE_SIZE);
    expect(below).toBeDefined();
    const lastRow = room.y + room.height - 1;
    expect(below!.y).toBeGreaterThan(lowestDrawnRow(lastRow));
    expect(bounds.y + bounds.height).toBeGreaterThan(lowestDrawnRow(lastRow));
    // The sides reach as far down as the slab under it, so no corner is open.
    for (const side of slabs.filter((slab) => slab.y === room.y * TILE_SIZE)) {
      expect(side.y + side.height).toBe(below!.y);
    }
  });

  it('lets the camera down onto the last row of an inside taller than the view', () => {
    const cave = { x: 70, y: 1, width: 40, height: 40 };
    const { bounds } = areaFrame(cave, VIEW);
    expect(bounds.y + bounds.height).toBeGreaterThan(lowestDrawnRow(cave.y + cave.height - 1));
  });

  it('never shows the place laid under it', () => {
    const layout = layOutAreas({ name: 'Out', width: 40, height: 40 }, [
      { id: 'a', name: 'A', kind: 'inside', width: 12, height: 9 },
      { id: 'b', name: 'B', kind: 'inside', width: 12, height: 9 },
    ]);
    const [, upper, lower] = layout.areas;
    expect(lower.rect.x).toBe(upper.rect.x);
    const below = areaFrame(upper.rect, VIEW).slabs.find((slab) => slab.y > upper.rect.y * TILE_SIZE)!;
    expect(below.y).toBeLessThanOrEqual(lower.rect.y * TILE_SIZE);
  });

  it('keeps the outdoors’ camera to the map, with no strip of black under its last row', () => {
    const outdoors = { x: 0, y: 0, width: 64, height: 72 };
    const { bounds } = areaFrame(outdoors, VIEW, true);
    expect(bounds.y + bounds.height).toBe(72 * TILE_SIZE);
  });
});
