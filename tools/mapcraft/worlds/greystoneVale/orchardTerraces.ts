/**
 * ORCHARD TERRACES, the farm in the south-east of Greystone Vale.
 *
 * The one idea: the farm is cut out of the hillside wood as two framed slopes
 * down from the farmyard to the sea, and the ledges are the quick way down.
 * The terraces go down to the sands in four shelves, the farm road zig-zagging
 * past the cowman's cottage; the lane goes down past the lower orchard and
 * the cider press, turns east for The Wreck, and ends in a ledge that is the
 * quick way down to the pasture and its dew pond. The farmyard at the top
 * keeps its kitchen garden, and the north orchard stands beside it.
 *
 * Drawn as FireRed draws a route, which the open field this farm first was
 * never read as: each slope a corridor about twenty wide whose wood steps in
 * and out, each run of ledge from one of those steps to the road, tall grass
 * in whole beds, and a road that goes past places rather than round shapes.
 * A fruit tree is FireRed's broadleaf with thicket under its crown, so nobody
 * stands hidden under one.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function orchardTerraces(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'orchard-terraces');
  // The sea needs no wood to seal it: free the rim along the shore.
  const rim: [number, number][] = [];
  for (let y = 52; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if (x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH) rim.push([x, y]);
  p.unlock(rim);

  /** A fruit tree, with thicket under its crown so nobody stands hidden under one. */
  const tree = (x: number, y: number, kind: 'tree' | 'tree-2' = 'tree') => {
    p.building(kind, x, y);
    p.block(x, y, 3, 1, '#');
  };

  // -- The farmyard, the kitchen garden and the road in from the strand --------
  p.meadow(14, 4, 26, 14);
  p.meadow(4, 4, 10, 10);
  p.meadow(0, 12, 14, 6);
  p.yard(5, 6, 9, 6, { gates: [[9, 11]], inner: '"' }); // the kitchen garden
  p.flowers([6, 7], [7, 7], [12, 7], [6, 9], [12, 10]);
  p.block(18, 12, 20, 5, 'd'); // the yard, trodden bare
  p.building('warden-house', 20, 7); // the farmhouse
  p.building('shed', 29, 8); // the apple store
  p.flowers([33, 6], [34, 6], [34, 7], [27, 6], [26, 6]);

  // -- The north orchard, beside the yard ---------------------------------------
  p.meadow(40, 8, 2, 4);
  p.meadow(42, 4, 16, 12);
  p.yard(43, 5, 14, 10, { gates: [[43, 8], [43, 9]], inner: '.' });
  tree(45, 6);
  tree(51, 7, 'tree-2');
  tree(47, 10);
  tree(52, 11);

  // -- The terraces: one framed slope down to the shore ---------------------------
  // Four shelves. The wood steps in and out along both sides, and each edge
  // of ledge runs from one of those steps to the road.
  p.meadow(8, 18, 20, 32);
  p.wood(8, 22, 2, 4).wood(24, 22, 4, 4); // the wood steps in at the first edge
  p.bed(10, 18, 10, 5, { round: false }); // the hay meadow under the yard
  p.ledge(10, 19, 24).put(20, 24, 'o');
  p.building('house', 14, 25); // the cowman's cottage, its door on the shelf road
  p.flowers([13, 27], [19, 28], [19, 27]);
  p.bed(24, 26, 4, 4, { round: false }).bed(8, 25, 4, 3, { round: false });
  p.wood(8, 30, 4, 4).ledge(15, 27, 32);
  p.bed(15, 33, 6, 4, { round: false }).bed(24, 33, 4, 2, { round: false }); // the cornfield, between the shelf roads
  p.wood(26, 36, 2, 4);
  p.bed(8, 35, 4, 6, { round: false });
  p.ledge(8, 20, 41).wood(24, 38, 4, 4);
  p.bed(8, 42, 11, 6, { round: false }); // rough grazing

  // -- The lane: the other framed slope, past the lower orchard and the press -----
  p.meadow(34, 18, 20, 18);
  p.meadow(54, 28, 10, 6); // the lane's way on east, to The Wreck
  p.wood(52, 18, 2, 4).wood(34, 30, 2, 4);
  p.yard(38, 19, 10, 9, { gates: [[38, 23]], inner: '.' }); // the lower orchard, its gate on the lane
  tree(40, 20, 'tree-2');
  tree(44, 22);
  tree(40, 24);
  p.flowers([39, 22], [39, 26]);
  p.bedRows([22, 49, 53], [23, 49, 53], [24, 49, 53], [21, 49, 51]);
  p.building('shed', 49, 25); // the cider press, its door on the lane
  p.flowers([48, 28], [52, 28]);
  p.bed(38, 32, 14, 3, { round: false });
  // The lane's foot: one edge from step to step, the quick way down to the pasture.
  p.ledge(36, 51, 35).wood(52, 34, 2, 2);

  // -- The pasture over the shore, with the drove track out to the dew pond -------
  p.meadow(34, 36, 20, 14);
  p.meadow(28, 44, 6, 6);
  p.bed(36, 37, 10, 5, { round: false }).bed(30, 47, 11, 3, { round: false });
  p.wood(50, 36, 4, 4);
  p.block(44, 42, 8, 5, 'W'); // the dew pond

  // -- The farm road, drawn last so nothing cuts it --------------------------------
  p.road([[0, 14], [20, 14]]); // in from Gull Strand
  p.road([[21, 16], [21, 29], [12, 29], [12, 37], [21, 37], [21, 47]], { width: 3 }); // down the terraces, by the cottage and the pond
  p.road([[24, 44], [42, 44]]); // the drove track, out across the pasture to the dew pond
  p.road([[36, 16], [36, 30], [62, 30]]); // the lane, and on east to The Wreck
  p.trail([[36, 0], [36, 4]]); // down from Tanglewood into the yard
  // Shrubs in the yard round the landing, so every way you set off meets something.
  p.put(21, 12, 'o').put(27, 12, 'o').put(24, 15, 'o');

  // -- The shore -------------------------------------------------------------
  p.block(2, 50, 60, 4, '~');
  p.block(0, 54, 64, 10, 'W');
  p.block(0, 52, 2, 2, 'W').block(62, 52, 2, 2, 'W'); // the sea, not the sand, meets the rim
  p.block(2, 48, 2, 2, '~'); // a nook in the wood at the west end of the sands, where the cockle path goes up

  const file = districtFile(GREYSTONE_VALE, 'orchard-terraces', p, {
    exits: [
      { x: 2, y: 48, name: 'Cockle Path', opens: { when: 'always' } },
      { x: 57, y: 4, name: "Pickers' Path", opens: { when: 'always' } },
    ],
    dropIns: [{ x: 24, y: 12, name: 'Farmhouse', description: 'The yard of the farm at Orchard Terraces, at the top of the terraces.' }],
    itemSpots: [{ x: 49, y: 13, hidden: true }, { x: 9, y: 37 }, { x: 52, y: 48 }],
    extra: {
      landmarks: [{ x: 32, y: 14, name: 'Apple Store', kind: 'shed' }],
      berryTrees: [{ x: 11, y: 8, berry: 'sitrus' }],
      signs: [
        { x: 24, y: 48, lines: ['THE SANDS', 'Along the sands west, the cockle path goes up through the wood.'] },
        { x: 15, y: 12, lines: ['ORCHARD TERRACES', 'The lane is east. The terraces are down, and the ledges are quicker.'] },
      ],
      people: [
        { x: 27, y: 13, name: 'Farmer Hale', look: 'straw-hat', facing: 'down', lines: ['Hop the terraces if you are in a hurry. Mind, you will not climb back.'] },
      ],
      trainers: [
        { x: 39, y: 22, name: 'Orchardist Pip', team: 'orchardist', look: 'picnicker', facing: 'left', sight: 0, lines: ['Paws off my apples!'] },
      ],
    },
  });
  return { file, notes: p.notes };
}
