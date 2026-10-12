/**
 * The smallest whole world: two districts drawn apart and stitched together,
 * and a two-floor cave under one of them - the worked example of a world plan
 * (`tools/mapcraft/README.md`, "A huge map").
 *
 *   npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/examples/quarryRoad.ts out/quarry-road
 *
 * Each district starts from `startDistrict`, which seals its edge except where
 * the plan says a road crosses, so the two programs never see each other and
 * still meet. Leave the quarry out of `districts` and the map still stitches
 * and plays: the road east simply runs into the wood.
 */
import type { MapcraftResult } from '../report';
import { caveMaze, caveMouthSpots, plantCaveMouth } from '../caves';
import { seeded, type Random } from '../program';
import { districtFile } from '../stitch';
import { startDistrict, type WorldPlan } from '../worldPlan';
import type { WorldResult } from '../worldReport';

export const QUARRY_ROAD: WorldPlan = {
  id: 'quarry-road',
  name: 'Quarry Road',
  districtSize: 32,
  districts: [
    {
      id: 'orchard-bend',
      name: 'ORCHARD BEND',
      cell: [0, 0],
      idea: 'A farm road bends round a pond under an orchard terrace.',
    },
    {
      id: 'old-quarry',
      name: 'OLD QUARRY',
      cell: [1, 0],
      idea: 'The road climbs out past a worked rock face with a cave cut into it.',
    },
  ],
  crossings: [{ between: ['orchard-bend', 'old-quarry'], at: 16, kind: 'road' }],
  exits: [
    { district: 'orchard-bend', side: 'west', at: 14, name: 'Farm Lane' },
    { district: 'old-quarry', side: 'east', at: 8, name: 'Quarry Top' },
  ],
};

function orchardBend(): MapcraftResult {
  const p = startDistrict(QUARRY_ROAD, 'orchard-bend');
  // The orchard terrace above, the lane below, and the terrace's lip between:
  // short ledges anchored on whole trees, the way up at its east end.
  p.meadow(10, 4, 16, 7); // the terrace
  p.meadow(2, 12, 28, 8); // the low ground the lane runs through
  p.wood(12, 4, 2, 2).wood(18, 4, 2, 2); // the orchard
  p.ledge(10, 15, 11).wood(16, 10, 2, 2).ledge(18, 21, 11).wood(22, 10, 2, 2);
  p.road([
    [0, 14],
    [6, 14],
    [6, 16],
    [30, 16],
  ]); // the farm lane bends east to the quarry
  p.road([
    [12, 7],
    [24, 7],
    [24, 16],
  ]); // the orchard track comes down through the gap...
  p.building('sign', 11, 7); // ...from the orchard's gate sign
  p.pond(10, 18, 6, 2).bushes([9, 18], [16, 19]); // the pond under the lane
  p.bed(2, 18, 6, 2); // grass the long way round has to cross
  p.yard(18, 18, 6, 4, { gates: [[20, 18]], inner: 'g' }); // a fenced pasture
  p.flowers([4, 12], [5, 13], [8, 12], [14, 12], [15, 13]);
  p.building('sign', 4, 15);
  return {
    file: districtFile(QUARRY_ROAD, 'orchard-bend', p, {
      dropIns: [
        { x: 3, y: 15, name: 'Farm Lane', description: 'Where the lane comes in from the west.' },
      ],
      itemSpots: [{ x: 15, y: 5 }],
    }),
    notes: p.notes,
  };
}

function oldQuarry(random: Random): MapcraftResult {
  const p = startDistrict(QUARRY_ROAD, 'old-quarry');
  p.rock(2, 2, 28, 28); // the hill the quarry is cut into
  p.meadow(2, 12, 12, 8).meadow(14, 14, 4, 6); // the worked-out floor, stepping round the spoil
  p.meadow(12, 4, 18, 8); // the upper working, under the face
  p.meadow(22, 12, 6, 4); // a bay the last of the stone came out of
  p.road([
    [0, 16],
    [12, 16],
    [12, 8],
    [30, 8],
  ]); // the road climbs out past the face
  p.ledge(2, 8, 13).building('rock', 9, 13); // a bench cut in the floor: the quick way down to the road
  p.bed(4, 18, 6, 2).bed(22, 13, 5, 3); // grass on the old floor and in the bay
  p.building('round-boulder', 15, 18); // spoil left on the floor
  p.fenceLine([
    [16, 12],
    [21, 12],
  ]); // the lip of the upper working, fenced
  const mouth = caveMouthSpots(p, { x: 16, y: 2, width: 12, height: 4 })[0];
  if (!mouth) throw new Error('the quarry face has no foot for a cave mouth');
  plantCaveMouth(p, mouth);
  const cave = caveMaze({
    floors: [
      { id: 'quarry-cave', name: 'Quarry Cave', width: 32, height: 24 },
      { id: 'quarry-cave-b1f', name: 'Quarry Cave B1F', width: 40, height: 32 },
    ],
    ladders: [['quarry-cave', 'quarry-cave-b1f', 2]],
    mouths: [{ at: mouth, floor: 'quarry-cave' }],
    random,
  });
  return {
    file: districtFile(QUARRY_ROAD, 'old-quarry', p, {
      dropIns: [
        { x: 4, y: 16, name: 'Quarry Floor', description: 'The worked-out floor of the quarry.' },
      ],
      itemSpots: [{ x: 26, y: 6 }, ...cave.secrets],
      extra: { areas: cave.areas, links: cave.links },
    }),
    notes: p.notes,
  };
}

export default function quarryRoad(seed = 1): WorldResult {
  const random = seeded(seed);
  return {
    plan: QUARRY_ROAD,
    districts: { 'orchard-bend': orchardBend(), 'old-quarry': oldQuarry(random) },
  };
}
