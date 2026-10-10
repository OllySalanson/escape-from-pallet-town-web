import { describe, expect, it } from 'vitest';
import { BUILDING_CHOICES, GROUND_BRUSHES } from './palette';
import {
  extendMap,
  moveThing,
  paintWith,
  placeDoor,
  placeBuilding,
  rectangle,
  removeThing,
} from './draft';
import { layersFor } from './mapCanvas';
import {
  extendLayers,
  groundChange,
  grownEdges,
  mapChange,
  patchLayers,
} from './layerPatch';
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
      } else if (choice < 0.85) {
        // A door shuts the ground it stands on: a small tree, or a stretch of deep water.
        const to = {
          x: Math.min(file.width - 1, at.x + Math.floor(roll() * 12)),
          y: Math.min(file.height - 1, at.y + Math.floor(roll() * 3)),
        };
        const outcome =
          roll() < 0.5 ? placeDoor(file, 'cut-tree', at) : placeDoor(file, 'surf', at, to);
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
      const changed = mapChange(before, file);
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

  it.each([
    { left: 4, top: 0, right: 0, bottom: 0 },
    { left: 0, top: 2, right: 3, bottom: 0 },
    { left: 0, top: 0, right: 0, bottom: 5 },
    { left: 6, top: 4, right: 1, bottom: 7 },
  ])('draws a map grown by %o as building it whole does', (sides) => {
    const before = tiledSample(44, 34, { places: false });
    const grown = extendMap(before, sides);
    const layers = extendLayers(layersFor(before), sides);
    for (const strip of grownEdges(grown.width, grown.height, sides)) {
      patchLayers(layers, grown, strip);
    }
    const whole = layersFor(grown);
    for (const key of Object.keys(whole) as (keyof typeof whole)[]) {
      expect({ key, value: layers[key] }).toEqual({ key, value: whole[key] });
    }
  });
});
