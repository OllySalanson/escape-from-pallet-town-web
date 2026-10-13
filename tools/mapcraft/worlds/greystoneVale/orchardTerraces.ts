/**
 * ORCHARD TERRACES, the farm in the south-east of Greystone Vale.
 *
 * The one idea: orchards and fenced pastures step down to the sea, and the
 * ledges on the farm road are the quick way home. The hillside is wooded and
 * the farm is three shelves stepping down it, each edged by broken runs of
 * ledge anchored on clumps of trees: the farmyard and the north orchard at the
 * top, the lane's shelf with the west orchard and the cornfield in the middle,
 * the pasture over the shore at the foot. The farm road goes down by the one
 * gap in each edge, the long way round; a hop down a ledge is the quick way
 * down - and never back up. The lane leaves east for The Wreck, and the trail
 * from Tanglewood comes down into the north orchard.
 *
 * An orchard is FireRed's broadleaf planted in rows on grass, with thicket
 * under each crown so nobody stands hidden under one; no two are the same
 * shape. The hillside is drawn a letter a lattice cell.
 */
import type { Point } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The hillside, a letter a lattice cell: T the wood round it and the clumps a run of ledge ends on. */
const HILLSIDE = [
  'TTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTT',
  'TTTTTTTTTT.............TTTTTTTTT',
  'TTTT.......................TTTTT',
  'TT...........................TTT',
  'TT...........................TTT',
  'TT...........................TTT',
  '.............................TTT',
  'TT...........................TTT',
  'TT...........................TTT',
  'TT...........................TTT',
  'TT.....TT.....T.....TT..T...TTTT',
  'TT.....T.....................TTT',
  'TT...........................TTT',
  'TT............................TT',
  'TT..............................',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TTT..........................TTT',
  'TTT.....TT.......TT...T.....TTTT',
  'TTT......T........T..........TTT',
  'TTT..........................TTT',
  'TTT..........................TTT',
  'TTT..........................TTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export function orchardTerraces(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'orchard-terraces');
  // The sea needs no wood to seal it: free the rim along the shore.
  const rim: [number, number][] = [];
  for (let y = 52; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if (x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH) rim.push([x, y]);
  p.unlock(rim);
  p.cells(HILLSIDE);

  /** Broadleaves at the given spots, each with thicket under its crown. */
  const trees = (...spots: readonly Point[]) => {
    spots.forEach(([x, y], index) => {
      p.building(index % 3 === 1 ? 'tree-2' : 'tree', x, y);
      p.block(x, y, 3, 1, '#');
    });
  };

  // -- Shelf one: the farmyard, its kitchen garden, and the north orchard -----
  p.block(18, 12, 20, 5, 'd'); // the yard, trodden bare
  p.building('warden-house', 20, 7); // the farmhouse
  p.building('shed', 29, 8); // the apple store
  p.yard(6, 6, 10, 6, { gates: [[10, 11]], inner: '"' }); // the kitchen garden
  p.flowers([7, 7], [8, 7], [13, 7], [14, 8], [7, 9], [13, 10], [14, 10]);
  p.bedRows([17, 4, 16], [18, 4, 17], [19, 5, 17], [20, 4, 16], [21, 6, 14]); // a hayfield under the yard
  p.flowers([33, 6], [34, 6], [34, 7], [27, 6], [26, 6]);
  p.yard(38, 4, 18, 13, { gates: [[38, 8], [38, 9]], inner: '.' }); // the north orchard
  trees([40, 5], [45, 5], [49, 6], [53, 5], [42, 10], [47, 10], [52, 9], [40, 14], [49, 14]);
  p.bedRows([18, 48, 56], [19, 47, 57], [20, 48, 55]);

  // -- Shelf two: the west orchard, the cornfield, and the lane east -----------
  p.yard(4, 27, 21, 12, { gates: [[24, 31], [24, 32], [12, 38], [13, 38]], inner: '.' });
  trees([6, 28], [11, 28], [15, 29], [20, 28], [8, 32], [13, 33], [18, 32], [6, 35], [16, 36]);
  p.bedRows([28, 30, 35], [29, 28, 36], [30, 28, 37], [31, 27, 37], [32, 28, 36], [33, 28, 37], [34, 29, 36], [35, 30, 34]); // the cornfield
  p.flowers([26, 28], [26, 29], [27, 37], [38, 36]);
  p.bedRows([24, 30, 38], [25, 29, 39], [26, 31, 37]); // long grass under the terrace edge
  p.bedRows([33, 47, 55], [34, 46, 56], [35, 47, 56], [36, 48, 54]);
  p.flowers([50, 37], [51, 37], [52, 38], [56, 33]);

  // -- Shelf three: the pasture over the shore ----------------------------------
  p.bedRows([44, 8, 18], [45, 6, 21], [46, 6, 22], [47, 7, 20], [48, 9, 17]); // rough pasture
  p.bedRows([45, 27, 36], [46, 26, 37], [47, 27, 36], [48, 28, 34], [45, 44, 54], [46, 43, 56], [47, 44, 55]);
  p.flowers([38, 45], [38, 46], [56, 48]);

  // -- The terrace edges: broken runs of ledge, each ending on a clump of trees,
  // with gaps where the road and the track go down - the hop is the quick way
  p.ledge(4, 13, 22).ledge(16, 27, 22).ledge(30, 39, 22).ledge(50, 55, 22);
  p.ledge(6, 15, 41).ledge(18, 35, 41).ledge(46, 55, 41);

  // -- The farm road: the long way, by the gap in each edge ------------------------
  p.road([[0, 14], [18, 14]], { width: 3 });
  p.road([[34, 14], [34, 18], [44, 18], [44, 30], [62, 30]], { width: 3 });
  p.road([[44, 30], [40, 30], [40, 48]]); // the track down through the next edge to the pasture
  p.road([[40, 39], [12, 39], [12, 38]]); // and west under the orchard to its gate
  p.road([[40, 48], [24, 48]]); // and along the foot of the pasture to the shore
  p.trail([[36, 0], [36, 8], [37, 8]]); // down from Tanglewood to the orchard gate
  // Shrubs in the yard round the landing, so every way you set off meets something.
  p.put(21, 12, 'o').put(27, 12, 'o').put(24, 15, 'o');

  // -- The shore -------------------------------------------------------------
  p.block(2, 50, 60, 4, '~');
  p.block(0, 54, 64, 10, 'W');
  p.block(0, 52, 2, 2, 'W').block(62, 52, 2, 2, 'W'); // the sea, not the sand, meets the rim
  p.block(2, 48, 2, 2, '~'); // a nook in the wood at the west end of the sands, where the cockle path goes up

  const file = districtFile(GREYSTONE_VALE, 'orchard-terraces', p, {
    // Ways out of the farm's own, at the dead ends of the sands and of the
    // lane beside the north orchard: the lane's way on east is The Wreck's
    // now, and without these the far corners would be further from a way out
    // than the hunter's blind window covers (`hunterFlee.test.ts`).
    exits: [
      { x: 2, y: 48, name: 'Cockle Path', opens: { when: 'always' } },
      { x: 57, y: 8, name: "Pickers' Path", opens: { when: 'always' } },
    ],
    dropIns: [{ x: 24, y: 12, name: 'Farmhouse', description: 'The yard of the farm at Orchard Terraces, at the top of the terraces.' }],
    itemSpots: [{ x: 45, y: 13, hidden: true }, { x: 11, y: 37 }, { x: 57, y: 48 }],
    extra: {
      landmarks: [{ x: 32, y: 14, name: 'Apple Store', kind: 'shed' }],
      berryTrees: [{ x: 11, y: 8, berry: 'sitrus' }],
      signs: [{ x: 15, y: 12, lines: ['ORCHARD TERRACES', 'The lane is east and down. The ledges are quicker.'] }],
      people: [
        {
          x: 27,
          y: 13,
          name: 'Farmer Hale',
          look: 'straw-hat',
          facing: 'down',
          lines: ['Hop the terraces if you are in a hurry. Mind, you will not climb back.'],
        },
      ],
      trainers: [
        {
          x: 26,
          y: 29,
          name: 'Orchardist Pip',
          team: 'orchardist',
          look: 'picnicker',
          facing: 'left',
          sight: 3,
          lines: ['Paws off my apples!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
