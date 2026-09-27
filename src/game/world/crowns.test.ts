import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../worldMap';
import { gatesForMap, gateStatesToVerify } from './gates';
import type { MapLayers } from './tiles';

/**
 * A crown may never hang over a tile somebody walks.
 *
 * A tree's crown is drawn over the figures, so whoever stands under one is
 * gone: at Route 1's steading all that showed of the player was the chevron,
 * and in a playtest the hunter stood under one unseen. One tile is enough -
 * Viridian shipped a dead-end tile at 12,24 that hid the player whole. The map
 * expansions carved lanes along the crown rows of the lattice and brought back
 * two hundred of these, which `tools/tileset/crowns.mts` could list and nothing
 * failed on, so this is the rule held in CI rather than in a tool somebody has
 * to remember to run.
 *
 * A tree cut into by a lane is felled (the lattice stamps list their crown row
 * among the tiles they block, so it happens by construction); a tree standing
 * alone in grass has the ground under its crown drawn solid, which is invisible
 * - the crown is opaque - and means the player walks round it rather than
 * behind it. An arch's span is not a crown: it is built to be walked under
 * (`PropCell.walkedUnder`).
 */
function standingUnderCrowns(layers: MapLayers): string[] {
  const found: string[] = [];
  layers.crowned.forEach((row, y) =>
    row.forEach((crowned, x) => {
      if (crowned && !layers.collision[y][x]) {
        found.push(`${x},${y}`);
      }
    }),
  );
  return found;
}

describe('tree crowns', () => {
  const cases = (Object.keys(WORLD_MAPS) as WorldMapId[]).flatMap((id) =>
    gateStatesToVerify(gatesForMap(id)).map((open) => [id, open] as const),
  );

  it.each(cases)('never hang over walkable ground on %s with doors %j open', (id, open) => {
    expect(standingUnderCrowns(getWorldMap(id, open).layers)).toEqual([]);
  });

  it('never hang over walkable ground in the harbour, built up or not', () => {
    const everything = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
    expect(standingUnderCrowns(getBaseMap([]).layers)).toEqual([]);
    expect(standingUnderCrowns(getBaseMap(everything).layers)).toEqual([]);
  });

  /**
   * A wood of FireRed's route conifers has no crowns at all, and that is the
   * art rather than a gap in the rule. Its trees stand on a lattice
   * (`tileset/lattice.ts`) with every body and base a wall, and the one part of
   * a tree drawn over the figures is its tip, which hangs over the ground above
   * the wood the way FireRed draws it: a point in front of the feet of whoever
   * stands there, never a canopy over them. So a lattice wood carries tips -
   * canopy that is walked under - instead, and hundreds of them.
   */
  it('are on every wooded map, so the rule is asking about something', () => {
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      const { crowned, canopy } = WORLD_MAPS[id].layers;
      const crowns = crowned.flat().filter(Boolean).length;
      if (WORLD_MAPS[id].tileset.materials.tree.lattice) {
        const tips = canopy.tiles.flatMap((row, y) => row.filter((tile, x) => tile >= 0 && !crowned[y][x])).length;
        expect(crowns, id).toBe(0);
        expect(tips, id).toBeGreaterThan(100);
      } else {
        expect(crowns, id).toBeGreaterThan(100);
      }
    }
  });
});
