import { extractionPointsOn } from './extractionPoints';
import { districtsForMap } from './districts';
import { huntingGrounds, type HunterGround } from './hunterPack';
import { trainersOn } from './mapTrainers';
import { idleBeatTiles } from './npcIdle';
import { entitiesForMap } from './npcs';
import { insertionsOn } from '../run/runGeneration';
import type { WorldMapDefinition } from '../worldMap';

/**
 * Where a map's hunters patrol. The ground alone says where a loop could go, and
 * says it of a village as of an empty lawn: drawn before anybody stood on it, High
 * Moor's loop had a corner under a Nidoran and another in the Lost Fold, behind a
 * boulder, and its hunter never went north of the ledges.
 */
export function huntingGroundsOn(map: WorldMapDefinition): readonly HunterGround[] {
  return huntingGrounds({
    width: map.width,
    height: map.height,
    collision: map.collision,
    links: map.links,
    outdoors: map.areas?.find((area) => area.kind === 'outdoors')?.rect ?? {
      x: 0,
      y: 0,
      width: map.width,
      height: map.height,
    },
    districts: districtsForMap(map.id),
    keepClear: [
      ...insertionsOn(map.id).map((insertion) => insertion.position),
      ...extractionPointsOn(map.id).map((point) => point.position),
    ],
    standing: [
      ...entitiesForMap(map.id).flatMap((entity) => idleBeatTiles(entity)),
      ...trainersOn(map.id).map((trainer) => trainer.position),
    ],
  });
}
