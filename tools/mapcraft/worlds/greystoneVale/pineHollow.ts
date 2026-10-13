/**
 * PINE HOLLOW, the dark pine wood in the north-east of Greystone Vale.
 *
 * The one idea: one hidden trail threads three clearings, and nothing is
 * signed. It comes in over the col from the peaks in the west, finds the
 * spring clearing, then switches back and forth under the pines - north, south,
 * north again - until it reaches the lip of the hollow the wood is named for and
 * drops in by a ledge: the quick way down, never the way back. It climbs out
 * east to the clearing where one broadleaf stands among the pines and leaves as
 * the Pine Trail, on into The Power Station; the station's Card Key was lost in
 * that clearing, and lies there one raid in five. The way back from the hollow
 * goes round by the broadleaf, so the ledge has a job: it saves the long way
 * round.
 *
 * The way south to Tanglewood is a deer path nobody signs: it leaves the
 * hollow's foot through tall grass and winds down between the trunks. Two
 * dead ends off the trail are where things are found.
 *
 * The wood is drawn as a sketch, one letter a 2x2 lattice cell, because the
 * conifer stands on that lattice: a trail drawn on an odd tile is eaten by the
 * trees beside it. Detail that is not a tree - the pool, the grass, the ledge -
 * is drawn tile by tile on top. FireRed's pieces only: the Kanto conifer, its
 * broadleaf and its rocks.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The wood, a letter a lattice cell: T pines, . the trail and the clearings, g tall grass. */
const WOOD = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTT.....TTTTTTTTTTTTTTTTTTTT',
  'TTTTT.........TTTTTTTTT....TTTTT',
  'TTTT...........TTTTTTT.......TTT',
  'TTTT................TT........TT',
  'TTTT..........TTTT.TTT........TT',
  'TTTT..........TTTT............TT',
  'TTTT..TTT.TTTTTTTT.T..........TT',
  'TTTT......TTTTTTTT.TTT.......TTT',
  '......TTTTTTTTTTTT.TTTT.....TTTT',
  'TTTT.TTTTTTTTTTT.T.TTTTT..T..TTT',
  'TTTT.TTTTTTTT....T.TTTTT..T.....',
  'TTTT.TTTTTTTTT........TT..TTTTTT',
  'TTT....TTTTT...........T..TTTTTT',
  'TTT....TTTTT.....T.....T..TTTTTT',
  'TTT....TTTTT.....TT.......TTTTTT',
  'TTTTTTTTTTTT..............TTTTTT',
  'TTTTTTTTTTTT...........T.TTTTTTT',
  'TTTTTTTTTgggg.........TT.TT...TT',
  'TTTTTTTTTggggT.....TTTTT.TT...TT',
  'TTTTTTTTTggTTTTT.TTTTTTT.TTT.TTT',
  'TTTTTTTTTggTTTTT.TTTTTTT.TTT.TTT',
  'TTTTTggggggTTTTT.TTTTTTT.....TTT',
  'TTTTTgggggTTTTTT.TTTTTTTTTTTTTTT',
  'TTTTTggTTTTTTTTT.....TTTTTTTTTTT',
  'TTTTTggTTTTTTTTT.....TTTTTTTTTTT',
  'TTTTTgggggTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
];

export function pineHollow(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'pine-hollow');
  p.cells(WOOD);

  // -- The trail: a sand path worn through the wood from the col to the lip of
  // the hollow, where it stops at the ledge; every bend is where the wood turns it
  p.road([[2, 22], [8, 22], [8, 14], [26, 14], [26, 12], [36, 12], [36, 28]]);

  // -- Clearing 1, the spring: the path skirts its pool ------------------------
  p.blob(16.5, 9.5, 5.6, 2.4, 'W');
  p.bedRows([16, 12, 17], [17, 13, 16], [9, 24, 27], [10, 23, 27], [11, 24, 26]);

  // -- Clearing 2, the hollow: one copse, a berry tree in its lee, grass ------
  // The path comes down into a floor worn bare in the middle of the hollow, and
  // leaves it on the far side: the hollow is where the trail is going.
  p.draw(34, 28, [
    '  dddd    ',
    ' dddddddd ',
    'dddddddddd',
    'ddddddddddd',
    ' ddddddddd',
    '   ddddd  ',
  ]);
  p.bedRows([30, 24, 27], [31, 24, 28], [32, 24, 27], [37, 25, 32], [38, 24, 33], [39, 24, 30]);
  p.building('rock', 46, 38).building('rock', 47, 38).building('rock', 47, 37);
  // What stands at the end of each dead end, so a lane is seen to lead somewhere.
  p.building('rock', 9, 34).building('rock', 41, 55).building('rock', 58, 42);

  // -- Clearing 3, the broadleaf: one oak among the pines, and the way out ----
  p.building('tree', 51, 12);
  p.block(51, 12, 3, 1, '#'); // thicket under its crown, so nobody stands hidden there
  // The path picks up again where the hollow is climbed out of, and runs on to the oak.
  p.road([[44, 32], [48, 32], [48, 18], [54, 18], [54, 26], [61, 26]]);
  p.draw(49, 16, [' ddddd ', 'ddddddd']); // the ground worn bare under the oak
  p.bedRows([16, 44, 46], [17, 44, 47], [18, 44, 45], [19, 44, 45]);
  p.flowers([55, 13], [56, 14], [55, 15], [49, 10]);

  const file = districtFile(GREYSTONE_VALE, 'pine-hollow', p, {
    dropIns: [],
    itemSpots: [
      { x: 30, y: 38, hidden: true }, // the hollow's secret, in the grass
      { x: 10, y: 33 }, // the nook south of the col
      { x: 57, y: 41 }, // the nook south of the climb
      { x: 40, y: 54 }, // the fox earth, south of the hollow
      { x: 53, y: 8, key: true }, // the station's Card Key, dropped past the oak
    ],
    // A way out nobody signs, at the back of the nook south of the col: the
    // wood is wide, and its one planned way out is at its far east end.
    exits: [{ x: 6, y: 34, name: 'Charcoal Track', opens: { when: 'always' } }],
    extra: {
      landmarks: [{ x: 22, y: 12, name: 'Cold Spring', kind: 'spring' }],
      berryTrees: [{ x: 31, y: 34, berry: 'oran' }],
      people: [
        {
          x: 9,
          y: 12,
          name: 'Old Wren',
          look: 'old-woman',
          facing: 'right',
          lines: [
            'Nobody signs the trails in Pine Hollow. You find them or you do not.',
            'The deer go south out of the hollow, down to the broadleaf wood.',
          ],
        },
      ],
      trainers: [
        {
          x: 54,
          y: 17,
          name: 'Collier Bram',
          team: 'collier',
          look: 'hiker',
          facing: 'left',
          sight: 3,
          lines: ['I burn charcoal under the old oak. Nobody comes this far in.'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
