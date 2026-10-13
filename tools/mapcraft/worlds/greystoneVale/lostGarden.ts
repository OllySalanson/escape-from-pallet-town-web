/**
 * THE LOST GARDEN, east of the Power Station: the station master's garden,
 * gone wild in a valley the cliffs closed off.
 *
 * The one idea: a walled garden nobody has tended for years, found from the
 * inside. There is no road in. The only way is the Falls Cave from behind the
 * dam (`fallsCave.ts`), and its mouth opens under the west cliff onto the old
 * garden walk, which runs east through what is left - past the overgrown beds
 * where the rarest grass Pokemon grow, round the fountain to the glasshouse in
 * the middle, and on to the gardener's lodge and the gate in the east wall,
 * the Gardener's Gate, which is the way out and never a way in. North of the
 * glasshouse the station master's berry trees stand in what were rows, and a
 * terrace drops back to the walk. South, through the long beds nobody has cut,
 * is a glade with one old tree in flower: the Old Bloom, where the Miracle
 * Seed is.
 */
import type { MapcraftResult } from '../../report';
import { plantCaveMouth } from '../../caves';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { fallsCaveArea, fallsMouthLink } from './fallsCave';
import { GREYSTONE_VALE } from './plan';

/** Where the Falls Cave comes out, at the foot of the west cliff. */
export const GARDEN_MOUTH = [8, 32] as const;

/**
 * The valley, a letter a lattice cell: T the wood, C the cliffs, . open ground.
 * The hill the cave runs through is wooded on top and shows its rock only
 * where it falls away - a face over the cave's step and another down the
 * orchard's side - and a band of the same rock is the terrace edge between
 * the orchard and the garden; the garden, the orchard above it, the lane up the east
 * side, the lodge by the gate and the long beds to the south are cut out of
 * the wood, so each is framed rather than set down in a field.
 */
const LAND = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTCTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTCTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTCC..........TTTTTTTTTTT',
  'TTTTTTTTTCC............TTTTTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCCCCCCCCCCCCCC...TTTTTT',
  'TTTTTTTTTCC...............TTTTTT',
  'TTTTTTTTTCC...................TT',
  'TCCCCCCCCCC...................TT',
  'TT............................TT',
  'TT..........................TTTT',
  'TT..............................',
  'TT.....TTTT..................TTT',
  'TTT...TTTTT.................TTTT',
  'TTTTTTTTTTT.................TTTT',
  'TTTTTTTTTTT.............TTTTTTTT',
  'TTTTTTTTTTT............TTT..TTTT',
  'TTTTTTTTTTTTTTT............TTTTT',
  'TTTTTTTTTTTTTTT...........TTTTTT',
  'TTTTTTTTTTTTTTT...........TTTTTT',
  'TTTTTTTTTTTTTTT...........TTTTTT',
  'TTTTTTTTTTTTTTTTT........TTTTTTT',
  'TTTTTTTTTTTTTTTTTTT....TTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export function lostGarden(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'lost-garden');
  p.cells(LAND);

  // -- The hill's south face, and the mouth of the Falls Cave in it: the way
  // in, opening on a step of worn sand with ferns grown up either side.
  p.block(2, 32, 14, 1, 'C');
  plantCaveMouth(p, GARDEN_MOUTH);
  p.draw(5, 33, [' dddddd', 'ddddddddd', ' ddddddd']);
  p.bedRows([33, 2, 4], [34, 2, 4], [35, 3, 4], [36, 4, 6], [37, 5, 9], [38, 7, 9]);
  p.building('rock', 12, 37).building('rock', 3, 38);

  // -- The garden walk, from the step to the west gate of the garden.
  p.road([[11, 34], [21, 34]]);
  p.bedRows([36, 13, 19], [37, 12, 20], [38, 14, 18]);

  // -- The orchard terrace: a band of rock above the garden, with two short
  // drops in it - the quick way down from the berry trees into the beds.
  p.put(27, 24, '.').put(28, 24, '.').put(29, 24, '.').put(30, 24, '.');
  p.ledge(27, 30, 25);
  p.put(38, 24, '.').put(39, 24, '.').put(40, 24, '.');
  p.ledge(38, 40, 25);

  // -- The garden: fenced on three sides with the terrace for its fourth,
  // a gate in each fence, the walk through the west and east gates.
  p.fenceLine([[22, 26], [22, 47], [45, 47], [45, 26]], {
    gaps: [[22, 34], [22, 35], [32, 47], [33, 47], [45, 34], [45, 35]],
  });
  // The court in front of the glasshouse, its paving cracked, the fountain
  // to one side of it, and the walk across.
  p.draw(27, 31, [
    '  PPPPPPPPPP',
    'PPPPPPPPPPPP',
    'PPPPPPPPPPPP',
    'PPPPPPPPPPPP',
    'PPPPPPPPPPP ',
    ' PPPPPPP    ',
  ]);
  p.road([[23, 34], [26, 34]], { letter: 'P' });
  p.road([[39, 34], [44, 34]], { letter: 'P' });
  p.building('stone-fountain', 34, 32);
  // The glasshouse at the head of the court.
  p.building('green-house', 30, 27);
  p.bushes([29, 30], [35, 30]);
  // A paved path south from the court to the south gate.
  p.road([[32, 37], [32, 46]], { letter: 'P' });
  // The beds, none like another: the big one by the west gate gone to tall
  // grass, a rose bed by the glasshouse, the kitchen garden, and a bench.
  p.bedRows([27, 24, 28], [28, 23, 28], [29, 23, 27], [30, 24, 26]);
  p.draw(37, 27, ['  fff ', ' ffffo', 'fff#ff', ' ff ff']);
  p.bedRows([38, 23, 29], [39, 23, 30], [40, 23, 31], [41, 24, 30], [42, 25, 29], [43, 26, 28]);
  for (const [x, y, kind] of [
    [24, 45, 'seedlings'], [25, 45, 'yellow-crop'], [26, 45, 'seedlings'], [27, 45, 'red-crop'],
    [24, 46, 'red-crop'], [25, 46, 'seedlings'], [26, 46, 'yellow-crop'], [27, 46, 'seedlings'],
  ] as const)
    p.building(kind, x, y);
  p.bedRows([39, 37, 42], [40, 36, 43], [41, 35, 43], [42, 36, 42], [43, 38, 41]);
  p.building('bench', 36, 37);
  p.flowers([30, 37], [35, 37], [43, 38], [43, 41]);

  // -- The orchard: the station master's berry trees in their two rows, in a
  // fenced plot with his potting shed above it, gone to grass at the corners.
  p.building('shed', 36, 10);
  p.fenceLine([[22, 14], [41, 14], [41, 22], [22, 22], [22, 14]], {
    gaps: [[41, 17], [41, 18], [28, 22], [29, 22], [39, 22], [33, 14], [34, 14]],
  });
  p.road([[23, 17], [46, 17]]);
  p.bedRows([15, 23, 24], [16, 23, 23], [20, 36, 40], [21, 34, 40], [11, 23, 27], [12, 22, 28], [13, 24, 27]);
  p.draw(30, 20, ['#']);
  p.flowers([44, 12], [45, 21], [25, 23], [36, 23]);

  // -- The lane up the east side from the walk to the orchard.
  p.road([[47, 17], [47, 33]]);

  // -- The walk east, past the lodge, bending down to the gate in the wall.
  p.road([[46, 34], [52, 34], [52, 36], [62, 36]]);
  p.building('green-cottage', 52, 28);
  // The lodge's yard: a fence round the woodpile, and a gap onto the walk.
  p.fenceLine([[50, 27], [58, 27], [58, 32]], { gaps: [[58, 31]] });
  p.building('log', 49, 29);
  p.flowers([50, 31], [51, 32]);
  // The lodge's pond, south of the walk, with its reeds.
  p.block(48, 39, 6, 4, 'W');
  p.bedRows([38, 53, 55], [40, 54, 55], [41, 54, 55], [43, 47, 50]);
  p.building('rock', 56, 39);

  // -- The long beds and the Old Bloom: south from the garden gate, a path
  // through grass nobody has cut, to a glade with one old tree in flower.
  p.road([[32, 48], [32, 52], [42, 52], [42, 54], [46, 54]]);
  p.bedRows(
    [48, 30, 31], [49, 30, 31], [50, 29, 31], [51, 30, 31],
    [48, 34, 41], [49, 34, 43], [50, 35, 44], [54, 34, 41], [55, 35, 42], [56, 36, 40],
  );
  p.building('tree', 47, 50);
  p.block(47, 50, 3, 1, '#'); // thicket under its crown, so nobody stands hidden there
  p.draw(44, 49, ['ff', 'f']);
  p.draw(50, 52, [' f', 'ff', 'f ']);
  p.bedRows([56, 40, 46], [57, 41, 47], [55, 48, 50], [56, 47, 51]);

  const file = districtFile(GREYSTONE_VALE, 'lost-garden', p, {
    dropIns: [],
    itemSpots: [
      { x: 48, y: 53, prize: 'miracle-seed' }, // under the Old Bloom
      { x: 35, y: 12, hidden: true }, // at the end of the orchard's top row
      { x: 55, y: 41, hidden: true }, // in the reeds past the lodge's pond
    ],
    extra: {
      landmarks: [{ x: 32, y: 31, name: 'The Glasshouse', kind: 'herbs' }],
      signs: [{ x: 21, y: 33, lines: ["STATION MASTER'S GARDEN", 'Please keep to the paths.'] }],
      berryTrees: [
        { x: 26, y: 15, berry: 'oran' },
        { x: 30, y: 15, berry: 'pecha' },
        { x: 36, y: 15, berry: 'sitrus' },
        { x: 39, y: 15, berry: 'aspear' },
        { x: 25, y: 20, berry: 'cheri' },
        { x: 29, y: 20, berry: 'rawst' },
        { x: 33, y: 20, berry: 'oran' },
      ],
      trainers: [
        {
          x: 52,
          y: 32,
          name: 'Gardener Rowan',
          team: 'orchardist',
          look: 'straw-hat',
          facing: 'down',
          sight: 2,
          lines: ['These beds were the station master\'s pride. Mind where you tread!'],
        },
      ],
      districts: [{ name: 'THE OLD BLOOM', x: 40, y: 47, width: 16, height: 12, wildlife: 'garden' }],
      areas: [fallsCaveArea()],
      links: [fallsMouthLink('garden', GARDEN_MOUTH)],
    },
  });
  return { file, notes: p.notes };
}
