/**
 * Viridian City's south district, redrawn the round 3 way: the worked example
 * of a map program (`tools/mapcraft/README.md`).
 *
 * The map is Viridian City's rows 44-75: the twelve town rows at the top are
 * the shipped town, read from the game and locked, and the twenty rows under
 * them are the district this program draws. The brief it keeps is the one
 * every attempt in the map research kept:
 *
 * - going down from the town to the exit at the bottom is quickest by hopping
 *   ledges, and going up is the long way round on foot;
 * - the ranger's hut stands in its own meadow, with a door that can be walked to;
 * - the town's south edge stays open where it is open now.
 *
 * It was planned before it was drawn - the road skeleton first, then the
 * terraces, then one thing worth seeing in each screen - and then rendered,
 * compared with a FireRed route and fixed three times. Judged blind beside
 * real FireRed routes drawn in the same tiles, it scored where they did.
 *
 *   npx vite-node tools/mapcraft/look.mts -- tools/mapcraft/examples/viridianSouth.ts out/viridian-south
 */
import { sketchViridianCity } from '../../../src/game/world/maps/viridianCity';
import { doorFront } from '../../../src/game/world/mapFile';
import { MapProgram, type Point } from '../program';
import { shippedRows } from '../shipped';
import type { MapcraftResult } from '../report';

/** The town rows of Viridian City above the district, and the district's own first row. */
const TOWN_FIRST_ROW = 44;
const TOWN_ROWS = 12;

/** Where the brief's walks start and end, in this map's tiles. */
const FOOT: Point = [37, 29];
const STREET: Point = [40, 11];
const EXIT: Point = [37, 31];

export default function viridianSouth(): MapcraftResult {
  const town = shippedRows(sketchViridianCity(), TOWN_FIRST_ROW, TOWN_ROWS);
  const p = new MapProgram(72, 32);
  p.draw(0, 0, town.ground).lock(0, 0, 72, TOWN_ROWS);
  p.buildings.push(...town.buildings);

  // 1. Carve the open ground out of the wood; what is not carved is the border.
  p.meadow(8, 12, 54, 2); // the verge under the street
  p.meadow(66, 12, 2, 4); // the town's east lane comes down...
  p.meadow(62, 14, 6, 2); // ...and turns west to meet the east road
  p.meadow(6, 14, 16, 10); // the ranger's meadow
  p.meadow(22, 14, 34, 10); // the hillside
  p.meadow(56, 14, 6, 2);
  p.meadow(56, 16, 10, 8); // the gap between the outcrop and the east wood
  p.meadow(14, 24, 52, 4); // the bottom shelf
  p.meadow(36, 28, 2, 4); // the way out to Pallet Road

  // 2. The roads: the skeleton, every end at something.
  const sand = (x: number, y: number, width: number, height: number) =>
    p.block(x, y, width, height, 'd');
  sand(13, 12, 3, 2); // the town's west path carries on, three wide...
  sand(14, 14, 2, 12); // ...as the ranger's lane, down to the bottom road
  sand(10, 18, 4, 2); // the spur to the hut door
  sand(16, 20, 17, 2); // the terrace road along the second shelf...
  sand(33, 20, 7, 3); // ...widening into a landing where the avenue's hops are
  sand(36, 12, 2, 3); // the avenue: Viridian's own axis leaves the street
  sand(60, 12, 2, 5); // the east road runs from the street to the grass...
  sand(60, 21, 2, 5); // ...and comes out below it
  sand(16, 24, 32, 2); // the bottom road...
  sand(30, 26, 18, 1); // ...swelling to three where the exit leaves it...
  sand(46, 26, 16, 2); // ...and swinging round the outcrop's skirt to the east road
  sand(36, 27, 2, 5); // down the gap to the exit

  // 3. The border steps in.
  p.wood(6, 14, 2, 4); // behind the hut
  p.wood(14, 26, 16, 2); // up to the bottom road west of the exit
  p.wood(62, 26, 4, 2); // the south-east corner
  p.wood(56, 14, 2, 2); // a tree where the east road leaves the verge

  // 4. The west: the ranger's hut, its garden, the pond.
  p.building('cottage-door', 8, 15);
  p.flowers([6, 18], [8, 18], [7, 19], [9, 19]); // by the door path
  p.yard(6, 20, 6, 4, { gates: [[10, 20]] }); // the garden, its gate off the spur
  p.flowers([7, 21], [9, 21], [8, 22], [10, 22]);
  p.block(18, 16, 4, 4, 'W').put(18, 19, '.'); // the pond above the junction
  p.bushes([17, 17]); // a bush on its bank
  p.fenceLine([
    [16, 15],
    [21, 15],
  ]); // a fence carries the top ledge line on to the lane

  // 5. The hill: two tree clumps and the outcrop are what the ledges span between.
  p.bedRows([16, 28, 38], [17, 26, 39], [18, 27, 37]); // the first hop lands in grass
  p.wood(22, 14, 4, 4).wood(22, 18, 2, 2); // the west clump
  p.wood(40, 16, 4, 4).wood(40, 20, 2, 4); // the centre clump
  p.wood(30, 14, 4, 2); // a pair on the top line
  p.wood(30, 18, 2, 2); // one tree on the second
  p.wood(22, 22, 2, 2).wood(16, 22, 4, 2); // between the two roads
  p.rock(48, 14, 8, 10); // the outcrop
  // The avenue's staircase and the west bay: rows 15, 19 and 23.
  p.ledge(26, 29, 15);
  p.ledge(34, 39, 15); // the avenue's first hop
  p.building('rock', 40, 15);
  p.ledge(24, 29, 19);
  p.building('rock', 32, 19);
  p.ledge(33, 38, 19); // the second, onto the terrace road
  p.bushes([39, 19]);
  p.ledge(24, 28, 23);
  p.building('rock', 29, 23);
  p.ledge(30, 32, 23);
  p.bushes([33, 23]);
  p.ledge(34, 39, 23); // the third, onto the bottom road
  // The east bay steps at its own rows, between the centre clump and the outcrop.
  p.ledge(44, 47, 17);
  p.ledge(42, 47, 21);
  p.flowers([44, 18], [46, 18], [45, 19], [47, 19], [42, 20], [44, 20], [46, 20]);
  p.building('sign', 38, 14); // the route sign before the first hop
  p.flowers([39, 13], [40, 14], [41, 13]);

  // 6. The east: grass the long way has to wade, a sign and fence at its edge, a big tree.
  p.bedRows([17, 57, 63], [18, 56, 65], [19, 56, 64], [20, 58, 63]);
  p.building('sign', 62, 16);
  p.fenceLine([
    [63, 16],
    [65, 16],
  ]);
  for (const [x, y] of [
    [49, 24],
    [50, 24],
    [56, 22],
  ] as const)
    p.building('rock', x, y); // scree at the outcrop's foot...
  p.fenceLine([
    [48, 25],
    [59, 25],
  ]); // ...fenced off from the road
  p.building('tree', 63, 21);

  // 7. The south verge: two fence runs either side of the exit gap, and its sign.
  p.fenceLine([
    [30, 27],
    [34, 27],
  ]);
  p.building('sign', 35, 27);
  p.fenceLine([
    [38, 27],
    [45, 27],
  ]);

  const file = p.toFile({
    id: 'mapcraft-viridian-south',
    name: 'Viridian south',
    dropIns: [{ x: 37, y: 30, name: 'Pallet Road', description: 'The foot of the terraces.' }],
    exits: [{ x: EXIT[0], y: EXIT[1], name: 'Pallet Road', opens: { when: 'always' } }],
  });
  const hut = file.buildings.find((building) => building.kind === 'cottage-door');
  const door = hut && doorFront(hut);
  return {
    file,
    district: { x: 0, y: TOWN_ROWS, width: 72, height: 32 - TOWN_ROWS },
    notes: p.notes,
    rules: [
      { kind: 'reach', label: 'The town can be walked to from the foot', from: FOOT, to: STREET },
      { kind: 'reach', label: 'The exit can be walked to', from: FOOT, to: EXIT },
      {
        kind: 'shortcut',
        label: 'Down by the ledges is quicker than on foot',
        from: STREET,
        to: FOOT,
        by: 6,
      },
      ...(door
        ? [
            {
              kind: 'reach' as const,
              label: "The hut's door can be walked to",
              from: FOOT,
              to: [door.x, door.y] as Point,
            },
          ]
        : []),
    ],
  };
}
