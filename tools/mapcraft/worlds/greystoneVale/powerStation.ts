/**
 * THE POWER STATION, east of Pine Hollow: a hydro-electric station run down
 * under its dam.
 *
 * The one idea: the station stands at the foot of the dam, and everything in
 * the valley below is the water it let go of and the works it powered. The
 * trail comes in out of the pines from the west onto the station's road, which
 * runs along the foot of the dam past the forecourt, over the tailrace on a
 * stone bridge and away east as the Pylon Road. The reservoir fills the head of
 * the valley behind the dam; the tailrace comes out under the station and runs
 * south and east to the map's edge; and south of the forecourt the switchyard
 * stands fenced and gone to grass, where what lives on the current lives now.
 * Its service gate at the back of the yard is a way out that opens only to the
 * Card Key, and the card was lost in the pines next door. The workers' row,
 * two houses and a garden, is down the valley on the far side of the road.
 *
 * FireRed's own Power Plant, cut off Route 10 (`scripts/cut-frlg-towns.mjs`),
 * stands against the dam's cliff as it stands against Route 10's.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/**
 * The valley, a letter a lattice cell: T the wood, . open ground. The wood fills
 * it and the places are cut out of it - the reservoir's shore, the station's
 * pocket under the dam, the road, the hamlet, the switchyard, the tailrace down
 * to its pond and the path through the trees to it - so each is framed rather
 * than set down in open grass.
 */
const LAND = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTT.....................TTTTT',
  'TTTTT.......................TTTT',
  'TTTT.........................TTT',
  'TTTT.........................TTT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT.TTTTTTTT.........TTTTTTTTTTT',
  'TTT.TTTTTTTT.........TTTTTTTTTTT',
  'TTT.TTTTTTTT.........TTTTTTTTTTT',
  'TTT...........................TT',
  '..............................TT',
  'TT..................TT........TT',
  'TT..................TT........TT',
  'TT..................TT........TT',
  'TT..................TT........TT',
  'TT..................TT........TT',
  'TT..................TT........TT',
  'TT............................TT',
  'TT............................TT',
  'TT..........TTTTTTT.............',
  'TT.........TTTTTTTT..........TTT',
  'TTTTT.....................TTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export function powerStation(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'power-station');
  p.cells(LAND);

  // -- The reservoir behind the dam, and the dam: a cliff band across the
  // valley with the station built against its foot
  p.blob(32, 9, 19, 6, 'W');
  p.block(8, 15, 52, 3, 'C'); // across the valley to the east wood
  // A path climbs round the dam's west end, between it and the hillside,
  // onto the reservoir's shore.
  p.road([[6, 20], [6, 12], [14, 12]]);
  // The station's chimney caps stand in the dam's bottom row, the cliff's face
  // behind and between them, as Route 10's stands against its cliff.
  p.building('power-plant', 27, 17);
  p.block(27, 17, 9, 1, 'C');

  // -- The tailrace: out of the reservoir through the dam beside the station,
  // and south into the settling pond, its reeds on the far shore
  p.river([[44, 8], [44, 38]], { width: 3 });
  p.put(43, 14, 'W');
  p.blob(46, 42, 7, 4, 'W');
  p.block(42, 38, 2, 1, 'W'); // the pond's edge closed up against the wood
  p.bedRows([46, 40, 50], [47, 39, 52], [48, 41, 49]);

  // -- The road: in from the pines, along the foot of the dam past the
  // forecourt, over the tailrace and away east as the Pylon Road
  p.road([[2, 26], [43, 26]]);
  p.block(43, 25, 5, 4, 'M'); // the stone bridge over the tailrace
  p.road([[48, 26], [56, 26], [56, 44], [62, 44]]);
  // The forecourt: sand worn bare in front of the doors, as Route 10's plant
  // stands on, running into the road
  p.draw(25, 24, [
    '  dddddddddd  ',
    ' dddddddddddd ',
    'dddddddddddddd',
    'dddddddddddddd',
    ' dddddddddddd ',
  ]);

  // -- The switchyard: fenced and gone to grass, its gate off the forecourt,
  // its service gate at the back
  // Its bed is gravel, and the grass has come up through it in drifts.
  p.yard(20, 31, 20, 12, { gates: [[31, 31], [32, 31]], inner: 'v' });
  p.put(30, 42, 'v'); // the service gate, let into the back fence
  p.bedRows(
    [32, 21, 27], [33, 21, 29], [34, 22, 28], [35, 21, 25],
    [32, 35, 38], [33, 34, 38], [34, 33, 38], [35, 35, 38], [36, 36, 38],
    [37, 24, 33], [38, 22, 34], [39, 23, 35], [40, 26, 32],
    [39, 37, 38], [40, 36, 38], [41, 35, 38],
  );
  p.road([[31, 28], [31, 30]]);

  // -- The workers' row, down the valley on the far side of the road
  p.building('grey-house', 6, 31).building('house', 13, 31);
  p.road([[9, 28], [9, 35]]);
  p.road([[5, 35], [16, 35]]); // the lane along their doors, the garden across it
  p.yard(5, 37, 14, 6, { gates: [[9, 37], [10, 37], [11, 42], [12, 42]], inner: '.' }); // their garden
  p.flowers([7, 39], [8, 40], [14, 39], [16, 40]);
  // and out of its back gate, down to the pond, where they fished off shift
  p.road([[11, 43], [11, 48], [38, 48]]);

  // -- Grass in the wet ground: below the hamlet, and on the tailrace's east
  // bank, where the damkeeper watches the road
  p.bedRows([44, 4, 9], [45, 4, 10], [46, 5, 9]);
  p.bedRows([30, 48, 53], [31, 47, 53], [32, 48, 52], [36, 47, 53], [37, 48, 53]);
  p.building('rock', 21, 45).building('rock', 22, 46);

  const file = districtFile(GREYSTONE_VALE, 'power-station', p, {
    dropIns: [
      {
        x: 31,
        y: 27,
        name: 'The Dam',
        description: 'The forecourt of the power station, under the dam, with the switchyard gone to grass beyond it.',
      },
    ],
    itemSpots: [
      { x: 38, y: 41 }, // in the switchyard, by the service gate
      { x: 17, y: 41, hidden: true }, // the workers' garden
      { x: 57, y: 30 }, // the bank of the tailrace
      { x: 15, y: 3 }, // the reservoir's north shore
    ],
    exits: [{ x: 30, y: 42, name: 'Service Gate', opens: { when: 'key' } }],
    extra: {
      landmarks: [
        { x: 38, y: 24, name: 'Control Room', kind: 'shed' },
        { x: 52, y: 9, name: 'Relay Mast', kind: 'mast' },
      ],
      signs: [
        { x: 23, y: 25, lines: ['GREYSTONE POWER STATION', 'Service gate locked. Card Key holders only.'] },
        { x: 52, y: 27, lines: ['PYLON ROAD', 'East: out of the vale.'] },
      ],
      people: [
        {
          x: 12,
          y: 28,
          name: 'Old Ohm',
          look: 'old-man',
          facing: 'down',
          lines: [
            'The turbines stopped the year the Card Key went missing.',
            'Last I heard it was dropped in the pines, out west.',
          ],
        },
      ],
      trainers: [
        {
          x: 52,
          y: 34,
          name: 'Damkeeper Volt',
          team: 'lengthsman',
          look: 'scientist',
          facing: 'right',
          sight: 3,
          lines: ['Nobody touches the sluices but me!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
