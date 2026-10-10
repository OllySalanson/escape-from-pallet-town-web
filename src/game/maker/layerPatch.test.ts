import { describe, expect, it } from 'vitest';
import { BUILDING_CHOICES, GROUND_BRUSHES } from './palette';
import { moveThing, paintWith, placeBuilding, rectangle, removeThing } from './draft';
import { layersFor } from './mapCanvas';
import { buildingChange, groundChange, patchLayers, unionRect } from './layerPatch';
import { tiledSample } from './tiledSample.testkit';

/** A small seeded random, so a failure can be played again. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

describe('patching the layers of a changed patch', () => {
  it('draws every edit exactly as building the whole map again does', () => {
    const roll = random(7);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(roll() * list.length)];
    let file = tiledSample(70, 54, { places: false });
    const layers = layersFor(file);
    for (let edit = 0; edit < 120; edit += 1) {
      const before = file;
      const at = { x: Math.floor(roll() * file.width), y: Math.floor(roll() * file.height) };
      const choice = roll();
      if (choice < 0.6) {
        const to = {
          x: Math.min(file.width - 1, at.x + Math.floor(roll() * 5)),
          y: Math.min(file.height - 1, at.y + Math.floor(roll() * 5)),
        };
        file = paintWith(file, rectangle(at, to), pick(GROUND_BRUSHES));
      } else if (choice < 0.8 || file.buildings.length === 0) {
        const outcome = placeBuilding(file, pick(BUILDING_CHOICES).kind, at);
        file = outcome.placed ? outcome.file : file;
      } else if (choice < 0.9) {
        const thing = {
          kind: 'building' as const,
          index: Math.floor(roll() * file.buildings.length),
        };
        const outcome = moveThing(file, thing, at);
        file = outcome.placed ? outcome.file : file;
      } else {
        file = removeThing(file, {
          kind: 'building',
          index: Math.floor(roll() * file.buildings.length),
        });
      }
      const changed = unionRect(groundChange(before, file), buildingChange(before, file));
      if (changed) {
        patchLayers(layers, file, changed);
      }
      const whole = layersFor(file);
      // Compared a field at a time, so a failure names the layer that drifted.
      for (const key of Object.keys(whole) as (keyof typeof whole)[]) {
        expect({ edit, key, value: layers[key] }).toEqual({ edit, key, value: whole[key] });
      }
    }
  });

  it('finds exactly the ground that changed', () => {
    const file = tiledSample(40, 30, { places: false });
    const painted = paintWith(file, rectangle({ x: 5, y: 7 }, { x: 9, y: 8 }), GROUND_BRUSHES[0]);
    expect(groundChange(file, file)).toBeUndefined();
    const changed = groundChange(file, painted);
    expect(changed).toBeDefined();
    expect(changed!.x).toBeGreaterThanOrEqual(5);
    expect(changed!.x + changed!.width).toBeLessThanOrEqual(10);
    expect(changed!.y).toBeGreaterThanOrEqual(7);
    expect(changed!.y + changed!.height).toBeLessThanOrEqual(9);
  });
});
