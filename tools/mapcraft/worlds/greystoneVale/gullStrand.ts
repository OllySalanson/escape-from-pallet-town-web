/**
 * GULL STRAND, the coast in the south of Greystone Vale.
 *
 * The one idea: sea cliffs and a strand where the river meets the sea. The
 * river comes down from The Crossing across a heath and out over the sand; the
 * road comes down beside it to the strand, where a stone jetty runs out into
 * the sea to Fisher's Jetty, the way off the map. In the west the land ends in
 * cliffs with the sea cave at their foot (the Greystone Caves' lowest mouth,
 * onto the caves' bottom floor), and the trail from
 * Reedmere crosses the river on a stone bridge on its way to the road. The
 * road for the orchards leaves east along the top of the heath.
 *
 * Stone laid over water is the bridge and the jetty, as at The Crossing; the
 * sea runs to the map's south edge, which needs no wood to seal it.
 */
import { plantCaveMouth } from '../../caves';
import type { Point } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { GREYSTONE_VALE } from './plan';

/** The land above the coast, a letter a lattice cell: T the wood, . the heath. */
const LAND = [
  'TTTTTTTTTTTTTT..TTTTTTT.TTTTTTTT',
  'TTTTTTTTTTTTTT..TTTTTTT.TTTTTTTT',
  'TTTTTTTTTT..................TTTT',
  'TTTTT........................TTT',
  'TTT.....................TTT...TT',
  'TTT...TT......................TT',
  'TTT...TT......................TT',
  'TT..............................',
  'TT........T...................TT',
  '....................TT.........T',
  'TTT.................TT........TT',
  'TTT.................TT........TT',
  'TTT.TT.......................TTT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT......................TTT..TT',
  'TTT......................TTT.TTT',
  'TTT..........................TTT',
  'TTT..........................TTT',
  'TT............................TT',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
];

export function gullStrand(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'gull-strand');
  // The sea needs no wood to seal it: free the south rim where the sea meets it.
  const rim: [number, number][] = [];
  for (let y = 46; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      const onRim = x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH;
      if (onRim && (x < 44 || x > 45)) rim.push([x, y]);
    }
  }
  p.unlock(rim);
  p.cells(LAND);

  // -- The cliffs in the west: a band of rock with the cove under it, the
  // cliff-top path above, and stone steps cut down the face to the sand
  p.draw(2, 30, [
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCC ',
  ]);
  p.building('rock-stair', 6, 30, { lot: 'C' });

  // -- The cove under the cliffs and the strand east of the river, the sea beyond
  p.draw(0, 33, [
    '  ~~~~~~~~~~~~~~~~~~~~~~~                                       ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '   ~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '     ~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '        ~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    ',
  ]);
  p.block(0, 47, 64, 17, 'W');
  p.draw(0, 45, ['WWWWW                                                     WWWWWW', 'WWWWWWWW                                               WWWWWWWWWW']);
  // The sea comes into the cove, so the sand under the cliffs is a crescent.
  p.draw(6, 39, [
    '      WWWWWW      ',
    '   WWWWWWWWWWWW   ',
    ' WWWWWWWWWWWWWWWW ',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
  ]);
  p.draw(20, 35, ['WWW', 'WWWW', ' WW']); // a tide pool left in the rocks
  // Dune grass at the back of the strand, and rocks along the tide line.
  p.bedRows([40, 34, 39], [41, 33, 40], [40, 50, 55], [41, 49, 56], [42, 50, 54]);
  // Rocks drawn up on the strand where you land, so every way you set off meets something.
  p.building('rock', 38, 45).building('rock', 41, 42).building('rock', 43, 45);
  p.building('rock', 4, 40).building('rock', 5, 41).building('rock', 19, 34).building('rock', 24, 38).building('rock', 58, 44);

  // -- The river, down from The Crossing to the sea ----------------------------
  p.river([[28, 0], [28, 10], [26, 10], [26, 26], [28, 26], [28, 48]], { width: 4 });
  p.block(26, 42, 8, 2, 'M'); // stepping stones across the river mouth, at low tide

  // -- Roads, and the trail from Reedmere over its stone bridge -----------------
  p.road([[46, 0], [46, 14], [62, 14]]); // down from The Crossing, and east to the orchards
  p.road([[46, 14], [46, 30], [42, 30], [42, 40]]); // down to the strand
  p.road([[2, 18], [22, 18]]); // in from Reedmere...
  p.block(22, 17, 10, 4, 'M'); // ...over the river on stone...
  p.road([[32, 18], [46, 18]]); // ...and on to the road
  p.block(44, 46, 2, 18, 'M'); // the jetty, out to the boats...
  p.building('ferry', 46, 52, { lot: 'W' }); // ...and the boat moored at it
  p.road([[6, 20], [6, 29]]); // the cliff-top path, down to the steps

  // -- The heath: grass in beds, flowers on the dry ground ---------------------
  p.bedRows([8, 34, 40], [9, 33, 41], [10, 34, 40], [22, 8, 16], [23, 7, 17], [24, 9, 15], [24, 50, 56], [25, 49, 57], [26, 50, 55]);
  p.flowers([36, 24], [37, 25], [39, 24], [12, 12], [13, 13], [54, 8], [55, 9]);
  p.bedRows([6, 50, 56], [7, 49, 57], [8, 50, 55], [12, 34, 41], [13, 33, 42], [14, 34, 40]);
  p.bedRows([22, 32, 40], [23, 31, 41], [24, 32, 41], [25, 33, 39], [26, 8, 20], [27, 9, 21], [28, 10, 18]);
  p.wood(54, 18, 8, 10).wood(50, 20, 4, 4); // the wood comes down the east side of the heath

  // -- The net loft: a fisher's cottage on the heath above the strand, its garden fenced
  p.building('cottage', 50, 30);
  p.yard(49, 34, 8, 4, { gates: [[52, 34]], inner: '.' });
  p.flowers([50, 35], [51, 36], [55, 35]);
  p.road([[52, 34], [52, 40]]); // the loft's path, down to the strand

  // A nook in the west wood above the heath, where a smugglers' path goes off
  // through the trees: with The Crossing drawn its stand-in ways out are gone,
  // and without this the heath's far corner is past the hunter's blind window
  // (`hunterFlee.test.ts`).
  p.meadow(4, 8, 2, 2);

  // -- The sea cave: the Greystone Caves' lowest mouth, in the cliff foot over
  // the cove, onto the caves' bottom floor. Placed by hand: `caveMouthSpots`
  // wants grass or a path in front, and this one opens straight onto the beach.
  const mouth: Point = [13, 32];
  plantCaveMouth(p, mouth);
  const cave = greystoneCaves();

  const file = districtFile(GREYSTONE_VALE, 'gull-strand', p, {
    exits: [{ x: 4, y: 8, name: "Smugglers' Path", opens: { when: 'always' } }],
    dropIns: [{ x: 41, y: 45, name: 'The Strand', description: 'The strand where the road comes down to the sea.' }],
    itemSpots: [{ x: 3, y: 36, hidden: true }, { x: 56, y: 44 }, { x: 18, y: 8 }],
    extra: {
      landmarks: [{ x: 35, y: 45, name: 'River Mouth', kind: 'jetty' }],
      // The caves' floors ride in Tanglewood's file too; the stitcher takes them once.
      areas: cave.areas,
      links: [caveMouthLink(cave, 'sea', mouth), ...caveLadders(cave)],
      signs: [{ x: 48, y: 12, lines: ['GULL STRAND', 'East: the orchards. South: the strand and the jetty.'] }],
      people: [
        {
          x: 45,
          y: 58,
          name: 'Old Ness',
          look: 'fisherman',
          facing: 'down',
          lines: ['The boats go out from the end of the jetty.', 'There is a cave under the cliffs. The tide hides it.'],
        },
      ],
      trainers: [
        {
          x: 52,
          y: 41,
          name: 'Raider Kit',
          team: 'raider',
          look: 'sailor',
          facing: 'left',
          sight: 3,
          lines: ['The strand is mine at low tide. Fight!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
