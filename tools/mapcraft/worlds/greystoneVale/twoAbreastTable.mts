/**
 * Which district of the vale is fiddliest to walk, for choosing the next one to
 * make walkable (the captain, 11 Nov 2026: "do the whole map one area at a
 * time"). Every drawn district is walked two abreast (`walkedTwoAbreast.testkit.ts`)
 * over the stitched collision, every gate open, from every tile where the ground
 * runs on over its rim and from each of its landings, and the table says how
 * many of the places a player walks to a pair cannot reach, how many ways out
 * and doors a pair walks further to than one walker, and how many road tiles
 * something stands on.
 *
 *   npx vite-node tools/mapcraft/worlds/greystoneVale/twoAbreastTable.mts
 *
 * A district already held to the rule (`<district>.test.ts`) still counts what
 * its test excuses on purpose - Millbrook's jetty and stepping stones - and a far
 * place reached only by boat or a cave floor has no rim to start from, so every
 * place in it counts as out of reach: read those rows with that in mind.
 */
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import type { MapFile, MapFileSpot } from '../../../../src/game/world/mapFile';
import { getWorldMap } from '../../../../src/game/worldMap';
import greystoneVale from './index';
import { GREYSTONE_VALE } from './plan';
import { valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

const SIZE = GREYSTONE_VALE.districtSize;
const world = greystoneVale();
const opened = gatesForMap('greystone-vale').map(gateKey);
const map = getWorldMap('greystone-vale', opened);
const districts = world.districts as Record<string, { readonly file: MapFile } | undefined>;

const rows: string[] = [];
for (const district of GREYSTONE_VALE.districts) {
  const file = districts[district.id]?.file;
  if (!file) continue;
  // The plan's cell [0, 0] is the vale's second district across and down: a ring of sea and wood surrounds it.
  const origin = { x: (district.cell[0] + 1) * SIZE, y: (district.cell[1] + 1) * SIZE };
  const solid = valeSolid(origin, opened);
  const starts: MapFileSpot[] = [];
  for (let i = 0; i < SIZE; i += 1) {
    for (const [x, y, dx, dy] of [
      [i, 0, 0, -1],
      [i, SIZE - 1, 0, 1],
      [0, i, -1, 0],
      [SIZE - 1, i, 1, 0],
    ] as const) {
      if (!solid(x, y) && map.collision[origin.y + y + dy]?.[origin.x + x + dx] === false)
        starts.push({ x, y });
    }
  }
  for (const landing of file.landings ?? []) if (landing.area === undefined) starts.push(landing);
  const walked = walkDistrict(file, solid, starts);
  const places = walked.places();
  rows.push(
    [
      district.id.padEnd(18),
      String(places.filter((place) => place.steps < 0).length).padStart(4),
      String(places.length).padStart(6),
      String(walked.longerTwoAbreast().length).padStart(7),
      String(walked.blockedOn(',d').length).padStart(6),
    ].join(' '),
  );
}
console.log(`${'district'.padEnd(18)} lost places longer onroad`);
console.log(rows.join('\n'));
