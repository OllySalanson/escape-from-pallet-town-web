import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../worldMap';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap, gateStatesToVerify } from './gates';
import { WORLD_ENTITIES } from './npcs';
import { WORLD_POIS } from './pois';
import type { MapLayers } from './tiles';
import { createRunTrainerEncounters } from './trainers';

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
   * Canopy that is walked under is still drawn over whoever stands there, so it
   * is ground to pass over and never ground to stand anything on: a sign behind
   * a conifer's tip is a sign nobody reads, and an old man standing on one was
   * a pair of shoulders growing out of a tree. Loot and the trainers a raid
   * seats are kept off it where they are generated (`runGeneration.ts`); this is
   * everything authored in place.
   */
  it('never stands anything authored under it', () => {
    const authored = [
      ...EXTRACTION_POINTS.map((point) => [point.mapId, `exit ${point.label}`, point.position] as const),
      ...WORLD_POIS.map((poi) => [poi.mapId, `landmark ${poi.id}`, poi.position] as const),
      ...WORLD_ENTITIES.flatMap((entity) =>
        [entity.position, ...(entity.idle?.roam ?? [])].map((at) => [entity.mapId, `${entity.kind} ${entity.id}`, at] as const),
      ),
      ...createRunTrainerEncounters().map((trainer) => [trainer.mapId, `trainer ${trainer.trainer.id}`, trainer.position] as const),
      ...Object.entries(RUN_INSERTIONS).map(([id, insertion]) => [insertion.mapId, `landing ${id}`, insertion.position] as const),
      ...(Object.keys(WORLD_MAPS) as WorldMapId[]).flatMap((id) =>
        WORLD_MAPS[id].loot.map((item) => [id, `loot ${item.id}`, item.position] as const),
      ),
    ];
    const hidden = authored
      .filter(([mapId, , at]) => WORLD_MAPS[mapId].layers.canopy.tiles[at.y][at.x] >= 0)
      .map(([mapId, what, at]) => `${mapId} ${what} at ${at.x},${at.y}`);
    expect(hidden).toEqual([]);
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
