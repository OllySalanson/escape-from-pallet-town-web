/**
 * EMBER ISLE, a volcano out in the open sea beyond the smugglers' cove: the
 * vale's richest ground, and its worst.
 *
 * The one idea: an island nobody walks to, and a crater nobody walks into.
 * The smugglers' skiff runs out from the cove's jetty - The Smugglers' Run -
 * between one minute into a raid and the moment their own boat sails at half
 * past two, and lands at the Smugglers' Landing on the island's north-east
 * beach, which is the only way here. From the beach the cone stands over
 * everything. The path goes round its foot, through the tall grass of the
 * north apron, to the charcoal burners' camp in the west cove, and from there
 * the climb starts: up the south face in two terraces, steps cut through each
 * band of rock, to the Lava Tube in the face under the rim. The tube is the
 * only way into the crater, and the crater is ash every step of which rolls
 * for a wild Pokemon, among the vale's strongest; at its far end the
 * smugglers' best guard their hoard. The way off is the charcoal burners'
 * Cinder Boat, which puts out from the west cove late in a raid, or back on
 * the skiff before it stops running.
 *
 * Drawn letter for letter: W the sea, ~ the beach, . the cone's grassy foot,
 * g its tall grass, d the path, M the jetty and the steps cut through the
 * rock, C the rock and v the crater's ash.
 */
import { plantCaveMouth } from '../../caves';
import type { Point } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { lavaTube } from './lavaTube';
import { GREYSTONE_VALE } from './plan';

export const EMBER_ISLE = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWCCCCWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWCCCCCCCWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWW~~~~CCCCCCCCC~~~~WWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWW~~~~...CCCCCCCC.....~~WWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWW~~~~..gg...CCCCCC.ggg....~~~WWWWWWWMMWWW~~WWWWWWW',
  'WWWWWWWWWWWWW~~~...ggggg...CCCC..gggggg...~~~~~~~~MM~~~~~~~WWWWW',
  'WWWWWWWWWWW~.....ggggggg........gggggggg...........~~~~~~~~~WWWW',
  'WWWWWWWWWWW~....gggggg.ddddddddddddddddddddddddddddddd..ggg..~WW',
  'WWWWWWWWWWW~....gggg..dddddddddddddddddddddddddddddddd.ggggg.~~W',
  'WWWWWWWWW~.....gg....dd...gggg........ggggg..........gggg....~WW',
  'WWWWWWWWW~..........dd...ggggggg....gggggggggg...............~WW',
  'WWWWWWWWW~....gg...ddd..ggggCCCCCCCCCCCCCCCCCggg..CCCCCC.....~WW',
  'WWWWWWWWW~...gggg..dd...CCCCCCCCCCCCCCCCCCCCCCCC.CCCCCCCCCC..~WW',
  'WWWWWWW~.....ggg..dd..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC~~WW',
  'WWWWWWW~........ddd..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWW',
  'WWWWWWW~.......dd...CCCCCCCCCCCvvvvvvvvvCCCCCCCCCCCCCCCCCCCCCWWW',
  'WWWWWWW~......dd...CCCCCCCCCvvvvvvvvvvvvvvvvCCCCCCCCCCCCCCCCWWWW',
  'WWWWW~.......ddd..CCCCCCCCvvvvvvvvvvvWWWvvvvvvCCCCCCCCCCCCCCWWWW',
  'WWWWW~......dd...CCCCCCCvvvvvvvvvCCvWWWWWvvvvvvvCCCCCCCCCCCWWWWW',
  'WWWWW~.....ddd...CCCCCCvvvvvvvvvCCCCvWWWvvvvvvvvvCCCCCCCCCCWWWWW',
  'WWWWW~.....dd...CCCCCCCvvvvvvvvvvCCvvvvvvvvvvvvvvCCCCCCCCCCCWWWW',
  'WW~.....gg.dd...CCCCCCvvvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCCWWWW',
  'WW~WWW..ggddd...CCCCCCCvvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCWWWWW',
  'ddMMMMMMMMMdd..CCCCCCCCvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCWWWWWW',
  'WWMMMMMMMMMdd..CCCCCCCCCvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCWWWWWW',
  'WW~WWWW~...dd..CCCCCCCCCCvvvvvvvvvvvvvvvCCvvvvvvvCCCCCCCCCCWWWWW',
  'WWW~~~~....ddd.CCCCCCCCCCCCCvvvvvvvvvvvvCCvvvvvvCCCCCCCCCCCWWWWW',
  'WWWW~.......dd..CCCCCCCCCCCCCCCCvvvvvvvvvvvvvvvCCCCCCCCCCCCWWWWW',
  'WWWW~........dd.CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWWWW',
  'WWWW~........dd..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWWWWW',
  'WWWW~.......ddd..CCCCCC......gggg..CCCC...ggCCCCCCCCCCCCCWWWWWWW',
  'WWWWWW~.....dd..CCCCC.....gggggggg.........gggCCCC...CCCCWWWWWWW',
  'WWWWWW~.....dd..CCCCCC........CCCCC...................CCCWWWWWWW',
  'WWWWWW~.....dd..CCC...CCC...CCCCCCCCCCCCCCCCCCCCCC..CCCCCWWWWWWW',
  'WWWWWW~.....dd..CC.....CC===CCCCCCCCCCCCCCCCCCCCCCMMCCCCCWWWWWWW',
  'WWWWWWW~....dd..CCCCCC.....ggggg........ggg.CCCCCC.....CCCWWWWWW',
  'WWWWWWW~....dd..CCC.....gggggggg......ggggggg.....gggg..CCWWWWWW',
  'WWWWWWW~....dd..CCC.......ggg.....ggggggggg......ggg....CCWWWWWW',
  'WWWWWWW~.....dd.CCCMMCCCCCCCCCCCCCC....CCCCCCCCCCCCCCCCCCCWWWWWW',
  'WWWWWWWW~.....dddddMMCCCCCCCCCCCCCC====CCCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWWWWWWW~~~.....ddd~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CCCCWWWWWWWW',
  'WWWWWWWWWWWWW~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~CCCWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWW~~~~~~~~~~~~~~~WW~~~~~~~~~~~~~~WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

/** The tube's two mouths: in the face under the rim over the upper terrace, and in the crater's north wall. */
export const FLANK_MOUTH: Point = [27, 46];
export const CRATER_MOUTH: Point = [34, 31];

/** The jetty the skiff puts in at (`plan.ts`'s Smugglers' Run lands here). */
export const LANDING: Point = [50, 20];

/** The hoard's nook, in the crater's south-east: its item spots, one for every piece (`BUILT_IN_FILE_HOARDS`). */
export const HOARD = { x: 42, y: 40, width: 7, height: 5 } as const;
export const HOARD_SPOTS: readonly Point[] = [
  [43, 40],
  [45, 40],
  [47, 40],
  [44, 41],
  [45, 42],
  [46, 43],
  [42, 44],
  [45, 44],
];

/** Where the fire horse stands, on its own shelf of the crater floor. */
export const RAPIDASH: Point = [24, 37];

export function emberIsle(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'ember-isle');
  p.draw(0, 0, EMBER_ISLE);
  plantCaveMouth(p, FLANK_MOUTH);
  plantCaveMouth(p, CRATER_MOUTH);
  const tube = lavaTube(FLANK_MOUTH, CRATER_MOUTH);

  // -- The Smugglers' Landing: what the skiff brought over, stacked on the beach
  p.building('crate-pair', 53, 22, { lot: '~' }).building('barrels', 57, 22, { lot: '~' });
  p.building('sack', 55, 23, { lot: '~' });

  // -- The charcoal burners' camp in the west cove: their hut, the kiln and
  // the wood they bring up from the wreck-wood on the beach
  p.building('hut', 9, 30, { lot: '.' }).building('log', 7, 35, { lot: '.' });
  p.building('big-stump', 10, 27, { lot: '.' }).building('dead-stump', 13, 26, { lot: '.' });

  // -- The crater: boulders the cone threw, and the hoard's crates
  p.building('round-boulder', 28, 39, { lot: 'v' }).building('rock', 42, 33, { lot: 'v' });
  p.building('rock', 31, 42, { lot: 'v' }).building('rock', 44, 36, { lot: 'v' });
  p.building('crate-stack', 47, 41, { lot: 'v' }).building('barrels', 43, 43, { lot: 'v' });

  // -- The black beach under the cone: rocks at the tide line
  p.building('rock', 24, 58, { lot: '~' }).building('rock', 41, 57, { lot: '~' });

  const file = districtFile(GREYSTONE_VALE, 'ember-isle', p, {
    dropIns: [],
    itemSpots: [
      // In the crater, against its west wall: the Charcoal falls back here (`filePrizes.ts`).
      { x: 25, y: 35 },
      // On the black beach, under the tide line, for whoever takes the ledge down.
      { x: 45, y: 58, hidden: true },
      // The hoard: what the smugglers keep in the crater.
      ...HOARD_SPOTS.map(([x, y]) => ({ x, y })),
      ...tube.secrets,
    ],
    extra: {
      areas: [tube.area],
      links: tube.links,
      // The hoard first, because the first named place wins a tile; then the
      // crater, every step of whose ash rolls for a wild Pokemon; then the
      // island round it, whose tall grass does.
      districts: [
        { name: 'THE HOARD', ...HOARD, wildlife: 'volcano', floorRolls: true },
        { name: 'THE CRATER', x: 21, y: 31, width: 29, height: 15, wildlife: 'volcano', floorRolls: true },
        { name: 'EMBER ISLE', x: 2, y: 14, width: 60, height: 47, wildlife: 'volcano' },
      ],
      signs: [
        { x: 14, y: 37, lines: ['EMBER ISLE', 'The path climbs the south face to the Lava Tube. The crater is past it.'] },
        { x: 26, y: 47, lines: ['LAVA TUBE', 'The only way into the crater. Mind your step on the ash.'] },
      ],
      people: [
        {
          x: 55,
          y: 25,
          name: 'Lookout',
          look: 'rocket-grunt',
          facing: 'left',
          lines: [
            'The skiff runs back to the cove till our boat sails. Half past two, and not a minute after.',
            'Miss it and you are here till the burners go.',
          ],
        },
        {
          x: 12,
          y: 34,
          name: 'Charcoal Burner',
          look: 'hiker',
          facing: 'down',
          lines: [
            'Our boat takes the charcoal off at twenty past three. There is room for one more.',
            'The crater is ash all the way down, and something lives in every step of it.',
          ],
        },
      ],
      landmarks: [
        { x: 51, y: 18, name: "Smugglers' Landing", kind: 'jetty' },
        { x: 12, y: 33, name: "Burners' Kiln", kind: 'kiln' },
      ],
      trainers: [
        {
          x: 42,
          y: 39,
          name: 'Smuggler',
          team: 'netter',
          look: 'rocket-grunt',
          facing: 'left',
          sight: 3,
          lines: ['Nobody comes through the tube but us!'],
        },
        {
          x: 41,
          y: 44,
          name: 'Smuggler',
          team: 'lengthsman',
          look: 'rocket-grunt',
          facing: 'left',
          sight: 3,
          lines: ['That hoard is the whole run. Hands off it!'],
        },
      ],
      pokemon: [{ x: RAPIDASH[0], y: RAPIDASH[1], species: 'rapidash', level: 40 }],
    },
  });
  return { file, notes: p.notes };
}
