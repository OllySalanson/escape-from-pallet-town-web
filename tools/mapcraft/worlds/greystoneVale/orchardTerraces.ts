/**
 * ORCHARD TERRACES, the farm in the south-east of Greystone Vale.
 *
 * The one idea: a farm in a wooded combe above the sea. The lane comes in out
 * of the wood from Gull Strand, winds down into the farmyard where the
 * farmhouse stands, and goes on east for The Wreck; the trail from Tanglewood
 * comes down through the trees into the top of the yard. Round the yard the
 * farm's places are cut out of the wood - the orchard fenced on the hill above
 * it, the rough pasture below, and the path down through the trees to the cove
 * - so each is a clearing you come to rather than a field laid on a lawn.
 * Every path ends at something: the orchard's at its packing shed, the
 * pasture's at the byre, the hay meadow's at its barn, the cove path on the
 * sand.
 *
 * It is the farm's second drawing. The first stepped three shelves down an
 * open hillside edged with ledges; judged blind, its orchards read as stamped
 * grids and its ledges as floating, and this one beat it head to head.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

const LAND = Array.from({ length: 32 }, () => 'T'.repeat(32));

export function orchardTerraces(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'orchard-terraces');
  // The sea needs no wood to seal it: free the rim along the shore.
  const rim: [number, number][] = [];
  for (let y = 52; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if (x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH) rim.push([x, y]);
  p.unlock(rim);
  p.cells(LAND);

  // -- The places, cut out of the combe's wood --------------------------------
  p.meadow(0, 10, 18, 10); // the lane in from Gull Strand
  p.meadow(18, 8, 20, 12).meadow(16, 12, 4, 8).meadow(36, 10, 4, 6); // the farmyard
  p.meadow(34, 0, 6, 8); // the trail down from Tanglewood
  p.meadow(44, 6, 12, 16).meadow(38, 10, 6, 6); // the orchard on the hill, and the gap up to its gate
  p.meadow(32, 26, 8, 6).meadow(40, 28, 24, 6).meadow(46, 26, 8, 2); // the lane on east
  p.meadow(38, 36, 16, 8).meadow(44, 42, 4, 4); // the hay meadow below it, and the way down to the cove
  p.meadow(8, 28, 20, 14); // the rough pasture
  p.meadow(28, 30, 6, 12).meadow(24, 38, 6, 10); // the path down to the cove
  p.meadow(8, 46, 50, 8); // the cove
  p.wood(18, 6, 2, 2).wood(36, 6, 2, 2).wood(22, 40, 6, 4).wood(50, 46, 8, 4);

  // -- The farmyard: the farmhouse, its apple store, and the yard trodden bare
  p.building('warden-house', 22, 8);
  p.building('shed', 31, 9);
  p.block(20, 14, 16, 5, 'd'); // the yard, trodden bare
  // what the apple store has put out in the yard, round the landing
  p.building('crate-stack', 30, 13).building('produce-crate', 26, 17).building('barrel', 34, 17);
  p.flowers([18, 12], [19, 13], [36, 13], [37, 14], [18, 18]);
  p.bedRows([11, 3, 8], [12, 2, 9], [16, 2, 9], [17, 1, 10], [18, 3, 9], [11, 20, 22], [12, 19, 22]);

  // -- The orchard: apple trees in a fenced field on the hill, no two rows alike
  p.yard(44, 6, 14, 16, { gates: [[44, 12], [44, 13]], inner: '.' });
  for (const [x, y] of [[45, 7], [49, 8], [46, 16], [51, 17]] as const) {
    p.building('tree', x, y);
    p.block(x, y, 3, 1, '#');
  }
  p.road([[44, 12], [54, 12]]); // the pickers' path to the packing shed
  p.building('shed', 52, 9);
  p.bedRows([19, 45, 49], [20, 45, 50]);

  // -- The rough pasture, fenced, with stones in it and the grass grown long
  p.yard(8, 30, 18, 12, { gates: [[17, 30], [18, 30]], inner: '.' });
  p.bedRows([32, 10, 16], [33, 9, 18], [34, 10, 17], [36, 18, 24], [37, 17, 24], [38, 19, 23]);
  p.building('rock', 12, 37).building('rock', 21, 33).building('rock', 13, 38);

  // -- The lane: in from the west, winding into the yard, and on east -------
  p.road([[0, 14], [12, 14], [12, 18], [20, 18]]);
  p.road([[36, 0], [36, 8], [34, 8], [34, 14]]);
  p.road([[36, 12], [44, 12]]); // up to the orchard gate
  p.road([[34, 18], [34, 28], [38, 28], [38, 30], [46, 30], [46, 28], [54, 28], [54, 30], [62, 30]]);
  p.wood(48, 30, 4, 4); // the copse the lane goes round
  p.road([[42, 32], [42, 36]]); // down into the hay meadow, to its barn
  p.building('shed', 41, 37);
  p.bedRows([37, 46, 52], [38, 45, 52], [39, 46, 51], [40, 41, 50], [41, 43, 49]);
  p.road([[18, 20], [18, 34]]); // through the pasture gate to the byre
  p.building('shed', 17, 35);
  p.road([[34, 28], [30, 28], [30, 40], [26, 40], [26, 48]]); // down through the trees to the cove

  // -- The cove: sand under the trees and the sea
  p.block(8, 48, 50, 5, '~');
  // the tide's bites into the sand and the sand's tongues out into the sea
  p.draw(8, 50, [
    '                                              ',
    '                WWWWWWW           WWWWWW      ',
    'WWWWWW         WWWWWWWWWW       WWWWWWWWWWW  WW',
  ]);
  p.draw(6, 49, ['~~', '~~~', '~~~~']);
  p.block(0, 53, 64, 11, 'W');
  p.draw(10, 53, ['    ~~~~~~             ~~~~~~~        ', '     ~~~~               ~~~~         ']);
  p.block(0, 52, 8, 1, 'W').block(58, 52, 6, 1, 'W');
  p.bedRows([46, 40, 46], [47, 39, 47]);
  p.building('rock', 20, 49).building('rock', 45, 50).building('rock', 46, 51);

  const file = districtFile(GREYSTONE_VALE, 'orchard-terraces', p, {
    // Ways out of the farm's own, at the west end of the cove and in the
    // orchard: the lane's way on east is The Wreck's, and without these the
    // far corners would be further from a way out than the hunter's blind
    // window covers (`hunterFlee.test.ts`).
    exits: [
      { x: 8, y: 48, name: 'Cockle Path', opens: { when: 'always' } },
      { x: 55, y: 7, name: "Pickers' Path", opens: { when: 'always' } },
    ],
    dropIns: [{ x: 30, y: 17, name: 'Farmhouse', description: 'The farmyard at Orchard Terraces, in the combe above the cove.' }],
    itemSpots: [{ x: 49, y: 15, hidden: true }, { x: 10, y: 40 }, { x: 54, y: 49 }],
    extra: {
      landmarks: [{ x: 33, y: 13, name: 'Apple Store', kind: 'shed' }],
      berryTrees: [{ x: 38, y: 11, berry: 'sitrus' }],
      signs: [{ x: 15, y: 13, lines: ['ORCHARD TERRACES', 'The farm is down the lane. The cove is below it.'] }],
      people: [
        {
          x: 27,
          y: 16,
          name: 'Farmer Hale',
          look: 'straw-hat',
          facing: 'down',
          lines: ['The apples are up the hill, the cove is down the path. Shut the gates.'],
        },
      ],
      trainers: [
        {
          x: 42,
          y: 12,
          name: 'Orchardist Pip',
          team: 'orchardist',
          look: 'picnicker',
          facing: 'right',
          sight: 2,
          lines: ['Paws off my apples!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
