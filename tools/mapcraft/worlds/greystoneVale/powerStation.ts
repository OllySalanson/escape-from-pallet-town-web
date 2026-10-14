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
 * And up on the reservoir's east shore the relay mast still works: raise the
 * linesmen on it and their track out of the north-east corner of the shore is a
 * way out, as the shipped maps' Sluice Wheel opens the West Culvert.
 *
 * FireRed's own Power Plant, cut off Route 10 (`scripts/cut-frlg-towns.mjs`),
 * stands against the dam's cliff as it stands against Route 10's.
 */
import type { MapcraftResult } from '../../report';
import { plantCaveMouth } from '../../caves';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { fallsCaveArea, fallsCaveBoulders, fallsCaveSecrets, fallsMouthLink } from './fallsCave';
import {
  bunkerAreas,
  bunkerExits,
  bunkerItemSpots,
  bunkerLandmarks,
  bunkerLinks,
  bunkerSigns,
  bunkerTrainers,
} from './bunker';
import { GREYSTONE_VALE } from './plan';

/** The Falls Cave's mouth, in the cliff behind the water where it spills through the dam. */
export const FALLS_MOUTH = [48, 17] as const;

/** The tile in front of the Power Plant's door, which goes into its turbine hall and the Bunker under it. */
export const PLANT_DOOR = [31, 24] as const;

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
  'TTTT..........................TT', // the linesmen's track, a nub off the reservoir's north-east shore
  'TTTT.........................TTT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT.TTTTTTTT..........TTTTTTTTTT',
  'TTT.TTTTTTT...........TTTTTTTTTT',
  'TTT.TTTTTT............TTTTTTTTTT',
  'TTT...........................TT',
  '..............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT...........TTTTT............TT',
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
  p.blob(34, 10, 18, 5, 'W');
  p.block(8, 15, 52, 3, 'C'); // across the valley to the east wood
  // and stepping up where the rock stands proud of the water, so it is a
  // hillside the dam was built into rather than a ruled line
  p.draw(18, 13, ['    CCC', 'CCCCCCC']);
  p.draw(36, 12, ['  CCCC', ' CCCCCC', 'CCCCCCCC']);
  // The Pylon Road climbs round the dam's west end, between it and the
  // hillside, and runs along the reservoir's north shore out of the vale.
  p.road([[6, 26], [6, 10], [10, 10], [10, 2], [30, 2], [30, 0]]);
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
  // Over the bridge, down the tailrace's east bank past the damkeeper, and
  // through the wood to meet the south road, so the valley's roads are a ring.
  p.road([[48, 26], [54, 26], [54, 52], [30, 52]]);
  // The forecourt: sand worn bare in front of the doors, as Route 10's plant
  // stands on, running into the road
  p.draw(25, 24, [
    '  dddddddddd  ',
    ' dddddddddddd ',
    'dddddddddddddd',
    'dddddddddddddd',
    ' dddddddddddd ',
  ]);
  // The station's stores stacked at the forecourt's west end and a boulder
  // out on the east, so whoever lands here meets something whichever way
  // they set off.
  p.building('barrels', 25, 28).building('rock', 35, 28);

  // -- The switchyard: fenced and gone to grass, its gate off the forecourt,
  // its service gate at the back
  // Its bed is gravel, and the grass has come up through it in drifts.
  p.yard(20, 31, 20, 12, { gates: [[31, 31], [32, 31]], inner: 'v' });
  p.put(30, 42, 'v'); // the service gate, let into the back fence
  // A bush outside it keeps the gate a pocket stepped into from the yard: with
  // Safari Marsh drawn, a gate open on both sides was the short way from the
  // dam to the south road, and an exit takes whoever steps on it.
  p.bushes([30, 43]);
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
  p.yard(5, 38, 14, 5, { gates: [[9, 38], [10, 38], [11, 42], [12, 42]], inner: '.' }); // their garden, a strip of grass off the lane
  p.flowers([6, 39], [7, 39], [6, 40], [8, 41], [15, 40]);
  // and out of its back gate, down to the pond, where they fished off shift
  p.road([[11, 43], [11, 48], [38, 48]]);
  // The south road, through the wood to the Safari Zone's gate
  p.road([[30, 48], [30, 63]]);

  // -- Grass in the wet ground: reeds down the tailrace's west bank, below the
  // hamlet, and on the east bank, where the damkeeper watches the road
  p.bedRows([29, 42, 43], [30, 41, 43], [31, 41, 43], [32, 42, 43], [33, 41, 43], [34, 42, 43], [35, 41, 43], [36, 41, 43]);
  p.bedRows([44, 4, 9], [45, 4, 10], [46, 5, 9]);
  p.bedRows([30, 48, 53], [31, 47, 53], [32, 48, 52], [36, 47, 53], [37, 48, 53]);
  p.building('rock', 21, 45).building('rock', 22, 46);

  // -- Behind the falls: where the tailrace spills through the dam, a strip of
  // reeds runs up its east bank under the cliff to a cave mouth nobody signs,
  // and the Falls Cave goes through the hill to the Lost Garden.
  p.block(47, 18, 3, 7, '.');
  p.bedRows([18, 49, 49], [19, 48, 49], [20, 47, 49], [21, 47, 49], [22, 47, 49], [23, 48, 49], [24, 48, 49]);
  plantCaveMouth(p, FALLS_MOUTH);

  const file = districtFile(GREYSTONE_VALE, 'power-station', p, {
    dropIns: [
      {
        x: 30,
        y: 28,
        name: 'The Dam',
        description: 'The forecourt of the power station, under the dam, with the switchyard gone to grass beyond it.',
      },
    ],
    itemSpots: [
      { x: 38, y: 41 }, // in the switchyard, by the service gate
      { x: 17, y: 41, hidden: true }, // the workers' garden
      { x: 57, y: 30 }, // the bank of the tailrace
      { x: 44, y: 3 }, // the reservoir's north shore
      ...fallsCaveSecrets(),
      ...bunkerItemSpots(),
    ],
    exits: [
      { x: 30, y: 42, name: 'Service Gate', opens: { when: 'key' } },
      // Sealed until the relay mast on the shore below raises the linesmen.
      { x: 59, y: 7, name: "Linesmen's Track", opens: { when: 'landmark', landmark: 'Relay Mast' } },
      ...bunkerExits(),
    ],
    extra: {
      landmarks: [
        { x: 38, y: 24, name: 'Control Room', kind: 'shed' },
        { x: 52, y: 9, name: 'Relay Mast', kind: 'mast' },
        ...bunkerLandmarks(),
      ],
      signs: [
        { x: 23, y: 25, lines: ['GREYSTONE POWER STATION', 'Service gate locked. Card Key holders only.'] },
        { x: 8, y: 25, lines: ['PYLON ROAD', 'North: along the reservoir and out of the vale.'] },
        { x: 28, y: 49, lines: ['SAFARI ZONE', 'South: the marsh reserve.'] },
        ...bunkerSigns(),
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
      // The Falls Cave rides in both its districts' files, so each passes
      // its checks alone, and the stitcher takes it once; what stands in it,
      // the Strength boulders, rides here, where the cave is entered.
      areas: [fallsCaveArea(), ...bunkerAreas()],
      links: [fallsMouthLink('station', FALLS_MOUTH), ...bunkerLinks(PLANT_DOOR)],
      boulders: fallsCaveBoulders(),
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
        ...bunkerTrainers(),
      ],
    },
  });
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}
