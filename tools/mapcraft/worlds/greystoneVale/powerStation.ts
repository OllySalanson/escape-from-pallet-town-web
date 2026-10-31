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
 *
 * Filled on 31 October 2026, the fourth ring out from Mill Square: the company
 * town the turbines left behind, which has not been told. The shift has been
 * on strike on the forecourt since the flood, against a management that went
 * home in it; the company shops and the works canteen still open on the road,
 * the canteen with a pie and the shop with nothing but a clerk; the switchyard
 * has ranks of dead insulators and a man testing them; the allotments are at
 * war over a marrow; the sailing club's dinghy is the one way out to the valve
 * tower, where a man has been turning a wheel for years because nobody relieved
 * him. There is warm water in the tailrace, which everybody fishes and nobody
 * asks about, and a bus stop in the wood with a queue.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
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
import { INN_ROOM, withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/** The Falls Cave's mouth, in the cliff behind the water where it spills through the dam. */
export const FALLS_MOUTH = [48, 17] as const;

/** The tile in front of the Power Plant's door, which goes into its turbine hall and the Bunker under it. */
export const PLANT_DOOR = [31, 24] as const;

/** Where the dinghy ties up: the end of the sailing club's jetty, and the valve tower's stage. */
const CLUB_JETTY = { x: 41, y: 11 };
const TOWER_STAGE = { x: 31, y: 11 };

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
  'TT...............TTTT.........TTT',
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

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The reservoir behind the dam, and the dam: a cliff band across the
  // valley with the station built against its foot. A long water with a bay at
  // each end of its north shore, drawn rather than rolled: a flooded valley has
  // the shape of the valley.
  p.draw(16, 4, [
    '      WWWWWWW',
    '     WWWWWWWWWW',
    '    WWWWWWWWWWWWWWWW        WWWWWW',
    '   WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ' WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '    WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '       WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);
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
  p.draw(39, 38, [
    '   WWWWWWWWW',
    ' WWWWWWWWWWWWW',
    'WWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWW',
    ' WWWWWWWWWWWW',
    ' WWWWWWWWWW',
    '   WWWWWWW',
  ]);
  stand('water-lily', 49, 41, 'W');
  stand('water-lily', 43, 42, 'W');
  stand('wet-rock', 46, 40, 'W');
  p.bedRows([45, 47, 51], [46, 40, 51], [47, 39, 52], [48, 41, 49]);

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
  // The picket: the shift, out since the flood, either side of the doors.
  stand('banners', 26, 24);
  stand('banners', 34, 24);
  stand('sack', 37, 25);

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
    [32, 21, 25], [33, 21, 26], [34, 22, 25],
    [32, 36, 38], [33, 35, 38], [34, 36, 38],
    [38, 22, 27], [39, 23, 28], [40, 24, 27],
    [39, 36, 38], [40, 35, 38], [41, 35, 38],
  );
  p.road([[31, 28], [31, 30]]);
  // Its ranks of insulators, on their footings, feeding nothing: two banks down
  // the yard with a way between them, and the oil drums left where they were.
  for (const x of [22, 24, 26, 28]) for (const y of [34, 37]) if (!(x === 28 && y === 37)) stand('mooring-post', x, y, 'v');
  for (const x of [34, 36]) for (const y of [34, 37]) stand('mooring-post', x, y, 'v');
  stand('barrels', 29, 32, 'v');
  stand('barrel', 34, 32, 'v');
  stand('crate-pair', 22, 40, 'v');

  // -- The workers' row, down the valley on the far side of the road
  // The way down the yard's west fence stays open: it is the short way south from
  // the forecourt, and with it shut the yard's far corners are past the hunter's
  // blind window from every way out (`hunterFlee.test.ts`).
  p.building('grey-house', 4, 31).building('house', 11, 31);
  stand('hut', 16, 32);
  p.road([[9, 28], [9, 35]]);
  p.road([[5, 35], [16, 35]]); // the lane along their doors, the garden across it
  p.yard(5, 38, 14, 5, { gates: [[9, 38], [10, 38], [11, 42], [12, 42]], inner: '.' }); // their garden, a strip of grass off the lane
  // The allotments, in rows, with two people not speaking across the path.
  for (const x of [6, 7, 8]) {
    stand('yellow-crop', x, 39);
    stand('seedlings', x, 41);
  }
  stand('red-crop', 14, 39);
  stand('red-crop', 15, 39);
  stand('red-crop', 16, 39);
  stand('seedlings', 14, 41);
  stand('pot-plant', 17, 39);
  p.flowers([14, 37], [4, 37]);
  // and out of its back gate, down to the pond, where they fished off shift
  p.road([[11, 43], [11, 48], [38, 48]]);
  // The south road, through the wood to the Safari Zone's gate
  p.road([[30, 48], [30, 63]]);

  // -- Grass in the wet ground: reeds down the tailrace's west bank, below the
  // hamlet, and on the east bank, where the damkeeper watches the road
  p.bedRows([29, 42, 43], [30, 41, 43], [31, 41, 43], [32, 42, 43], [33, 41, 43], [34, 42, 43], [35, 41, 43], [36, 41, 43]);
  p.bedRows([44, 4, 9], [45, 4, 10], [46, 5, 9]);
  p.bedRows([30, 48, 53], [31, 47, 53], [32, 48, 52], [36, 47, 53], [37, 48, 53]);

  // -- The tip: what a company throws away when it is told it can stop keeping it
  p.block(13, 44, 8, 4, 'v');
  stand('crate-tower', 14, 44);
  stand('barrels', 18, 44);
  stand('crate-pair', 17, 46);
  stand('sack', 16, 45);
  stand('barrel', 19, 46);
  stand('log', 13, 47);

  // -- The bus stop, on the road to the marsh: an awning, a bench and a queue
  stand('market-stall', 22, 44);
  stand('bench', 25, 45);

  // -- The sailing club, on the north shore: its shed, its jetty and its dinghy --
  p.building('shed', 36, 3);
  p.block(36, 7, 5, 2, '_'); // the club's stage, in front of its doors
  stand('flag', 41, 3);
  stand('bench', 42, 4);
  stand('barrel', 34, 4);
  p.block(41, 7, 2, 5, '_');
  p.block(41, 6, 2, 1, '_');
  stand('mooring-post', 43, 8, 'W');
  stand('mooring-post', 39, 9, 'W');
  p.flowers([46, 4], [32, 4], [33, 5]);

  // -- The valve tower, out in the water, and the stage round its foot ------------
  p.building('tower', 25, 4, { lot: 'W' });
  p.block(23, 11, 9, 3, '_');
  stand('crate-pair', 23, 12);
  stand('mooring-post', 22, 12, 'W');
  stand('wet-rock', 20, 8, 'W');
  stand('water-lily', 35, 8, 'W');
  stand('water-lily', 37, 13, 'W');

  // -- The company shops and the works canteen, on the north side of the road ----
  p.building('brick-shops', 9, 21);
  p.building('orange-house', 21, 21);
  stand('barrels', 19, 24);
  stand('bench', 25, 22);

  // -- The survey: a line of posts for pylons that were never sent -----------------
  for (const x of [9, 11, 13, 15]) stand('rail-post', x, 13);
  stand('stump', 12, 11);
  p.flowers([8, 11], [14, 11]);

  // -- The linesmen's hut, on the east shore, under the mast -------------------------
  stand('hut', 54, 4);
  stand('crate-pair', 57, 4);
  stand('log', 54, 10);
  p.flowers([50, 3], [57, 10]);

  // -- The warm water: the tailrace, where it comes out, and everybody on its bank --
  stand('hut', 57, 34);
  stand('barrel', 56, 38);
  stand('bench', 48, 34);
  stand('sack', 41, 37);

  // -- The gauge house and the road mender, out along the wood's two roads ---------
  p.block(34, 54, 10, 5, '.');
  stand('hut', 37, 54);
  stand('stump', 34, 56);
  p.block(24, 54, 6, 6, '.');
  p.block(25, 55, 4, 3, 'v');
  stand('sack', 26, 54);
  stand('barrel', 25, 58);
  stand('big-stump', 27, 58);

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
      { x: 37, y: 29 }, // the forecourt's own: what a raid is told is at the Station falls back on it
      { x: 38, y: 41 }, // in the switchyard, by the service gate
      { x: 16, y: 44, hidden: true }, // on the tip
      { x: 46, y: 5, hidden: true }, // behind the sailing club's jetty
      { x: 29, y: 13 }, // on the valve tower's stage, which only the dinghy reaches
      { x: 41, y: 55 }, // behind the gauge house
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
        { area: 'falls-cave', x: 4, y: 15, lines: ['Scratched on the wall:', 'THE BOULDERS UPSTAIRS MOVE. IT TAKES SOMETHING STRONG.'] },
        { x: 27, y: 28, lines: ['GREYSTONE POWER STATION', 'Service gate locked. Card Key holders only.'] },
        { x: 8, y: 25, lines: ['PYLON ROAD', 'North: along the reservoir and out of the vale.'] },
        { x: 31, y: 47, lines: ['SAFARI ZONE', 'South: the marsh reserve.'] },
        { x: 28, y: 24, lines: ['OFFICIAL PICKET', 'Do not cross. Strike now in its ninth year. Management informed. Management not found.'] },
        { x: 18, y: 25, lines: ['THE COMPANY SHOPS', 'Company tokens only. Company tokens no longer issued. Please ask for details.'] },
        { x: 25, y: 24, lines: ['WORKS CANTEEN', 'Thursday: pie. Other days: the rest of the pie.'] },
        { x: 37, y: 30, lines: ['DANGER OF DEATH', 'Not since the flood. But it is the principle of the thing.'] },
        { x: 13, y: 37, lines: ['ALLOTMENTS', 'Marrows may not be measured after dark. This means you, Mrs Watt.'] },
        { x: 45, y: 4, lines: ['GREYSTONE SAILING CLUB', 'Dinghy to the valve tower: ask nobody. There is nobody to ask.'] },
        { x: 13, y: 4, lines: ['PYLON ROAD', 'Pylons to follow. See the Surveyor.'] },
        { x: 53, y: 11, lines: ['RELAY MAST', 'Raise the linesmen on it and their track opens. They do not come. They do leave the gate.'] },
        { x: 47, y: 29, lines: ['TAILRACE', 'No swimming. No drinking. No reason given. Fishing permitted.'] },
        { x: 40, y: 47, lines: ['SETTLING POND', 'Everything in here is settling. Please do not stir it.'] },
        { x: 21, y: 47, lines: ['THE TIP', 'Property of the Company. Anything you find has already been thrown away by experts.'] },
        { x: 29, y: 47, lines: ['BUS STOP', 'The 8:15 to Millbrook. Timetable subject to the road existing.'] },
        { x: 35, y: 54, lines: ['GAUGE HOUSE', 'Water level read daily. Please do not tell the gauge.'] },
        ...bunkerSigns(),
      ],
      people: [
        { x: 29, y: 25, name: 'Shop Steward', look: 'heavy-man', facing: 'down', lines: ['Nine years out, and not one of us has crossed this line. Solidarity, that is.', 'Management? Went home in the flood. We have sent them a very strongly worded letter.'], beat: { everyMs: 3000, glances: ['down', 'left', 'right'] }, calls: ['What do we want?'] },
        { x: 33, y: 25, name: 'Picket', look: 'worker', facing: 'down', lines: ['We want the turbines back on. Then we want to not turn them on until they say sorry.', 'I do not know if anybody has thought that through.'], beat: { everyMs: 2700, glances: ['down', 'left'] }, calls: ['Turbines!'] },
        { x: 30, y: 25, name: 'Picket', look: 'worker-woman', facing: 'down', lines: ['My mum was on this line. My nan brought the sandwiches. I got my union card for my fifth birthday.'], beat: { everyMs: 2500, glances: ['down', 'right'] }, calls: ['When do we want them?'] },
        { x: 36, y: 26, name: 'Scab', look: 'man', facing: 'left', lines: ['I go in every morning and dust. Somebody has to, and it is very quiet in there.', 'There is something on the turbine floor. It is yellow. I dust round it.'], beat: { everyMs: 3500, glances: ['left', 'up'] } },
        { x: 29, y: 37, name: 'Meter Man', look: 'scientist', facing: 'left', lines: ['Nought volts. Nought volts. Nought volts. Something bit me. Nought volts.', 'The Company asks for these figures every month. Well, it did.'], beat: { everyMs: 2900, roam: [[0, 1]], glances: ['left'] }, calls: ['Nought volts!'] },
        { x: 9, y: 40, name: 'Mrs Watt', look: 'old-woman', facing: 'right', lines: ['That marrow of mine would have been a yard long if somebody had not breathed on it.', 'I know who. He knows I know. We have not spoken since the year of the flood.'], beat: { everyMs: 3400, glances: ['right', 'down'] }, calls: ['I saw that, Mr Ampere!'] },
        { x: 13, y: 40, name: 'Mr Ampere', look: 'old-man', facing: 'left', lines: ['I do not measure her marrow. I happen to walk past it, with a tape.', 'It is the water, you know. Out of the tailrace. Everything comes up very big, and warm.'], beat: { everyMs: 3700, glances: ['left', 'down'] }, calls: ['Mind my beans!'] },
        { x: 15, y: 37, name: 'Terrace Lad', look: 'little-boy', facing: 'down', lines: ['My dad says there will be lights again one day.', 'I have never seen lights. Are they good?'], beat: { everyMs: 1800, glances: ['down', 'right', 'up'] }, calls: ['Are you from the Company?'] },
        { x: 6, y: 37, name: 'Terrace Mum', look: 'woman', facing: 'right', lines: ['Nine years on half pay from a Company that does not exist.', 'It still comes, mind. In an envelope. I have stopped looking at who sends it.'], beat: { everyMs: 3100, glances: ['right', 'up'] }, calls: ['Tea is on the table!'] },
        { x: 13, y: 25, name: 'Company Clerk', look: 'clerk', facing: 'down', lines: ['We are open. We have always been open. We have no goods, and you would need tokens.', 'I can offer you a very nice receipt.'], beat: { everyMs: 3300, glances: ['down', 'left'] } },
        { x: 36, y: 8, name: 'Commodore', look: 'captain', facing: 'down', lines: ['Commodore of the Club, since the last one drowned. In a manner of speaking. He moved to the coast.', 'There is the one dinghy. Take it. Nobody sails. We only come for the bar.'], beat: { everyMs: 3600, glances: ['down', 'right'] }, calls: ['Mind the boom!'] },
        { x: 39, y: 8, name: 'Crew', look: 'sailor', facing: 'right', lines: ['Rowed it out to the tower last spring. There is a chap out there. He asked me what year it was.', 'I told him. I wish I had not. He went very quiet and turned the wheel.'], beat: { everyMs: 2800, glances: ['right', 'down'] } },
        { x: 28, y: 11, name: 'Valve Man', look: 'hiker', facing: 'down', lines: ['Half a turn on the hour. Nobody has relieved me, so I have not been relieved.', 'If I stop, you see, I do not know what happens. That is rather why I have not stopped.'], beat: { everyMs: 3000, glances: ['down', 'left', 'right'] }, calls: ['Half a turn!'] },
        { x: 56, y: 8, name: 'Apprentice', look: 'youngster', facing: 'left', lines: ['First day. They told me to wait here for the foreman. I am not sure which year he meant.', 'That mast still works. Nobody is on the other end, but it hums when you ask it nicely.'], beat: { everyMs: 2300, glances: ['left', 'down'] }, calls: ['Are you the foreman?'] },
        { x: 17, y: 4, name: 'Long Walker', look: 'camper', facing: 'left', lines: ['I am walking the whole of the Pylon Road, end to end. There are no pylons. It takes it out of you.', 'Bring a flask. The reservoir is very pretty, and you will not want to drink it.'], beat: { everyMs: 3100, glances: ['left', 'down'] }, calls: ['Lovely day for it.'] },
        { x: 11, y: 11, name: 'Surveyor', look: 'cameraman', facing: 'right', lines: ['The new line goes straight through here. I have put the posts in. The pylons are coming.', 'I have been told that by a very reliable man, who has since retired.'], beat: { everyMs: 3200, glances: ['right', 'down'] } },
        { x: 47, y: 33, name: 'Warm Water Bob', look: 'fisherman', facing: 'left', lines: ['Lovely and warm, this. Comes out of the station like a bath. Fish love it.', 'They have not got as many eyes as they used to. Or they have got more. I do not count them.'], beat: { everyMs: 3900, glances: ['left', 'down'] }, calls: ['Got one! No. Got two!'] },
        { x: 42, y: 37, name: 'Angler', look: 'old-man', facing: 'right', lines: ['Why is it warm, if the turbines are off? We do not ask that here.', 'We have a rule about it. Well, we had. The man who made it went for a swim.'], beat: { everyMs: 4100, glances: ['right', 'up'] } },
        { x: 53, y: 45, name: 'Sampler', look: 'scientist', facing: 'left', lines: ['A jar a day, for the Water Board. It was clear last year. It is green this year. Next year, who knows?', 'I have written to them. They have sent me more jars.'], beat: { everyMs: 3000, glances: ['left', 'down'] } },
        { x: 16, y: 43, name: 'Rag Man', look: 'bald-man', facing: 'down', lines: ['Rags, bones, bits of turbine. I go round with the cart. There is no cart. I used to go round.', 'That Grimer is my partner. We split it fifty-fifty, and it eats its half.'], beat: { everyMs: 2600, glances: ['down', 'right'] }, calls: ['Any old iron!'] },
        { x: 25, y: 47, name: 'Commuter', look: 'gentleman', facing: 'right', lines: ['The 8:15. It is a little late this morning.', 'I have told the office I shall be in as soon as it comes. I am not sure they are still there.'], beat: { everyMs: 3200, glances: ['right', 'up'] } },
        { x: 26, y: 47, name: 'Commuter', look: 'woman', facing: 'right', lines: ['I was here before him. I want that understood. There is a system.', 'No, I have never seen a bus. I have seen the sign.'], beat: { everyMs: 2800, glances: ['right', 'left'] } },
        { x: 27, y: 47, name: 'Schoolgirl', look: 'lass', facing: 'left', lines: ['I am going to be late for school. I started waiting when I was seven.', 'I think I know most of it by now, anyway.'], beat: { everyMs: 2100, glances: ['left', 'down'] }, calls: ['Is that it? No.'] },
        { x: 40, y: 56, name: 'Gauge Reader', look: 'worker', facing: 'left', lines: ['Up a bit, down a bit. I write it in the book and I send it to the dam.', 'The dam sends it to me. It is very good to know somebody is on top of it.'], beat: { everyMs: 3400, glances: ['left', 'up'] } },
        { x: 28, y: 55, name: 'Road Mender', look: 'straw-hat', facing: 'left', lines: ['Three weeks I have been filling this hole. The Company is paying by the shovel.', 'They have not paid yet. So I dig it out, and fill it in again, to keep the shovels up.'], beat: { everyMs: 2900, roam: [[0, 1]], glances: ['left', 'down'] }, calls: ['Mind the hole!'] },
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
        {
          x: 47,
          y: 24,
          name: 'Linesman',
          look: 'worker',
          facing: 'down',
          lines: ['The turbines have not turned since the flood.', 'The falls still try. Listen to them.'],
        },
        {
          area: 'turbine-hall',
          x: 1,
          y: 6,
          name: 'Night Watchman',
          look: 'old-man',
          facing: 'right',
          lines: ['There is a steel shutter on the floor below.', 'Only the Card Key opens it, and the card was lost in the pines.'],
        },
        {
          area: 'bunker-b1f',
          x: 22,
          y: 18,
          name: 'Guard',
          look: 'rocket-grunt',
          facing: 'up',
          lines: ['The shutter takes the Card Key. The lift takes power.', 'Nobody gets down here by accident.'],
        },
        {
          area: 'bunker-b2f',
          x: 29,
          y: 12,
          name: 'Grunt',
          look: 'rocket-grunt',
          facing: 'left',
          lines: ['Step on an arrow and the floor carries you till something stops you.', 'The generator is across all that. Took me a week.'],
        },
        {
          area: 'bunker-b3f',
          x: 5,
          y: 5,
          name: 'Scientist',
          look: 'scientist',
          facing: 'down',
          lines: ['The lift only runs once the generator on the floor above is back on.', 'Whoever did that, thank you. I was down here a long time.'],
        },
      ],
      // What the dead station draws: Magnemite to its old lines, and a
      // Voltorb on the lawn that every raid takes for a Poke Ball.
      pokemon: [
        { x: 5, y: 46, species: 'magnemite', level: 12 },
        { x: 48, y: 48, species: 'magnemite' },
        { x: 13, y: 6, species: 'voltorb' },
        // The switchyard's: on the last of the current, a Magnemite to a bank.
        { x: 23, y: 36, species: 'magnemite', beat: { everyMs: 1300, roam: [[1, 0], [2, 0]] } },
        { x: 35, y: 36, species: 'magnemite', level: 12, beat: { everyMs: 1600, roam: [[0, 1]] } },
        { x: 30, y: 35, species: 'voltorb', level: 12 },
        { x: 25, y: 41, species: 'voltorb', beat: { everyMs: 1900, roam: [[1, 0]] } },
        { x: 37, y: 37, species: 'pikachu', beat: { everyMs: 1500, roam: [[0, 1]] } },
        // The tip's own, and the bird that follows the Rag Man about.
        { x: 20, y: 45, species: 'grimer', level: 12 },
        { x: 16, y: 46, species: 'koffing' },
        { x: 21, y: 44, species: 'rattata', beat: { everyMs: 1400, roam: [[-1, 0]] } },
        // The reservoir's shore, the tailrace and the pond: what warm water brings.
        { x: 18, y: 5, species: 'pidgey', beat: { everyMs: 1700, roam: [[1, 0]] } },
        { x: 26, y: 13, species: 'psyduck', level: 11 },
        { x: 50, y: 5, species: 'poliwag', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 48, y: 33, species: 'slowpoke', level: 12 },
        { x: 50, y: 37, species: 'poliwag' },
        { x: 44, y: 46, species: 'grimer', beat: { everyMs: 2300, roam: [[1, 0]] } },
        { x: 50, y: 44, species: 'koffing', level: 11 },
        // The road, the hamlet and the wood's clearings.
        { x: 17, y: 37, species: 'meowth', beat: { everyMs: 2100, roam: [[1, 0]] } },
        { x: 16, y: 25, species: 'rattata', beat: { everyMs: 1300, roam: [[1, 0]] } },
        { x: 9, y: 11, species: 'oddish' },
        { x: 56, y: 44, species: 'pikachu', level: 11 },
        { x: 56, y: 7, species: 'voltorb' },
        { x: 42, y: 56, species: 'zubat', beat: { everyMs: 1100, roam: [[0, 1]] } },
        { x: 25, y: 56, species: 'pidgey' },
        // Inside: a Magnemite on the dead turbine, and what the hideout below
        // left behind it - a Koffing and a Grimer on B2F, a Voltorb on B3F.
        { area: 'turbine-hall', x: 22, y: 4, species: 'magnemite' },
        // Zapdos, where FireRed keeps it: the power station, drinking what is
        // left of the current between the dead generators - and Mewtwo in the
        // war room at the bottom of the Bunker, behind the Card Key, the
        // spinner floor and the lift, as far from a landing as the vale goes.
        { area: 'turbine-hall', x: 12, y: 6, species: 'zapdos', level: 50, legendary: true },
        { area: 'bunker-b4f', x: 17, y: 11, species: 'mewtwo', level: 70, legendary: true },
        { area: 'bunker-b2f', x: 25, y: 18, species: 'koffing', level: 13 },
        { area: 'bunker-b2f', x: 24, y: 16, species: 'grimer' },
        { area: 'bunker-b3f', x: 30, y: 6, species: 'voltorb', level: 13 },
        { area: 'bunker-b1f', x: 18, y: 5, species: 'rattata' },
        { area: 'bunker-b2f', x: 9, y: 19, species: 'koffing' },
        // In the Falls Cave's two halls, clear of the boulders: a Machop in the
        // west one that has been shoving rocks about, a Geodude in the east.
        { area: 'falls-cave', x: 8, y: 17, species: 'machop', level: 12 },
        { area: 'falls-cave', x: 40, y: 16, species: 'geodude' },
      ],
      berryTrees: [{ x: 16, y: 40, berry: 'aspear' }, { x: 48, y: 3, berry: 'cheri' }, { x: 57, y: 41, berry: 'pecha' }],
      // The Falls Cave rides in both its districts' files, so each passes
      // its checks alone, and the stitcher takes it once; what stands in it,
      // the Strength boulders, rides here, where the cave is entered.
      areas: [fallsCaveArea(), ...bunkerAreas()],
      links: [
        fallsMouthLink('station', FALLS_MOUTH),
        ...bunkerLinks(PLANT_DOOR),
        {
          ends: [
            { x: CLUB_JETTY.x, y: CLUB_JETTY.y, toward: 'left', look: 'boat' },
            { x: TOWER_STAGE.x, y: TOWER_STAGE.y, toward: 'right', look: 'boat' },
          ],
          sails: { name: 'The Club Dinghy', craft: 'punt', from: 0, until: 300, course: [] },
        },
      ],
      districts: [
        { name: 'THE COMPANY SHOPS', x: 8, y: 20, width: 18, height: 6, wildlife: 'power-plant' },
        { name: 'TURBINE ROW', x: 4, y: 29, width: 16, height: 9, wildlife: 'power-plant' },
        { name: 'THE ALLOTMENTS', x: 5, y: 38, width: 14, height: 5, wildlife: 'power-plant' },
        { name: 'THE SWITCHYARD', x: 20, y: 31, width: 20, height: 12, wildlife: 'power-plant' },
        { name: 'THE SAILING CLUB', x: 34, y: 2, width: 14, height: 10, wildlife: 'power-plant' },
        { name: 'THE VALVE TOWER', x: 22, y: 4, width: 11, height: 10, wildlife: 'power-plant' },
        { name: 'THE LINESMEN’S HUT', x: 50, y: 3, width: 10, height: 9, wildlife: 'power-plant' },
        { name: 'THE WARM WATER', x: 41, y: 29, width: 13, height: 9, wildlife: 'power-plant' },
        { name: 'THE SETTLING POND', x: 38, y: 38, width: 16, height: 11, wildlife: 'power-plant' },
        { name: 'THE TIP', x: 13, y: 44, width: 9, height: 4, wildlife: 'power-plant' },
        { name: 'THE BUS STOP', x: 22, y: 44, width: 8, height: 4, wildlife: 'power-plant' },
        { name: 'THE GAUGE HOUSE', x: 34, y: 54, width: 10, height: 5, wildlife: 'power-plant' },
        { name: 'THE SURVEY', x: 8, y: 10, width: 9, height: 5, wildlife: 'power-plant' },
      ],
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
        { x: 16, y: 11, name: 'Foreman Dray', team: 'breaker', look: 'worker', facing: 'right', sight: 0, lines: ['You from the Company? I was told to wait for somebody from the Company.', 'Well, somebody is going to answer for those pylons.'] },
        ...bunkerTrainers(),
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The doors that still open on the road: the canteen, the one shop with anybody in it, and the Union. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'station', 'orange-house', 21, 21, 'The Works Canteen', [
    { x: 4, y: 2, name: 'Dinner Lady', look: 'chef', facing: 'down', lines: ['Pie. It was going to be pie on the Thursday, and the Thursday has not properly finished.', 'Eat up. You look like the night shift.'] },
    { x: 6, y: 7, name: 'Night Shift', look: 'man', facing: 'left', lines: ['We are not on strike. We were asleep when they called it, and nobody has told us officially.'] },
  ], { room: INN_ROOM, pokemon: [{ x: 5, y: 4, species: 'meowth' }] });
  next = withInside(next, 'station', 'grey-house', 4, 31, 'The Union Hall', [
    { x: 7, y: 6, name: 'Branch Secretary', look: 'woman', facing: 'down', lines: ['All in favour of carrying on? Carried. It has been carried every month for nine years.', 'That card you are after, by the way. The Card Key. It went in the pines, with the last man who cared.'] },
  ], { itemSpots: [{ x: 10, y: 7, hidden: true }] });
  return next;
}
