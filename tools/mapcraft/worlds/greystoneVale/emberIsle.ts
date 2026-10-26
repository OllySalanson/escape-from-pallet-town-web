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
 * g its tall grass, d the path, M the jetty and the pier, C the rock and v
 * the crater's ash; the steps cut through the rock are planted over its gaps.
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
  'WWWWWWWWWWWWWWWWWWWW~~~~~~CCCCCCC~~~~WWWWWWWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWW~......CCCCCC.....~~~~~WWWWWWWWMMWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW~~~~~~...gg..CCCC.............~WWWWWMMWWWW~~~WWWWW',
  'WWWWWWWWWWWWWW~.......gggg.......gg.........~~~~~~MM~~~~~~~~~WWW',
  'WWWWWWWWWWWWWW~......ggggggg....ggggg.................~~~~~~~WWW',
  'WWWWWWWWWWW~~~~.dddddddddddddddddddddddddddddddddddddddd....g~WW',
  'WWWWWWWWWWW~....dddddddddddddddddddddddddddddddddddddddd...ggg~W',
  'WWWWWWWWWWW~....dd........................ggg...........gggg~WWW',
  'WWWWWWWWWWW~....dd....ggggg....CCCC......ggggggg.........gg.~WWW',
  'WWWWWWWWWWW~.gg.dd...gggggggCCCCCCCCCCCC..ggggg..CCCCCC.....~WWW',
  'WWWWWWWWW~~~.gggdd....ggggCCCCCCCCCCCCCCCCCC....CCCCCCCCCC..~WWW',
  'WWWWWWWWW~......dd....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWWWW~......dd...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWWWW~......dd...CCCCCCCCCCCvvvvvvvCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWW~~~......dd...CCCCCCCCvvvvvvvvvvvvvvvCCCCCCCCCCCCCCCCCWWW',
  'WWWWWWW~..g.....dd..CCCCCCCCvvvvvvvvvvvvvvvvvvCCCCCCCCCCCCCCCWWW',
  'WWWWWWW~.ggg....dd..CCCCCCvvvvvvvvvCCvvvvvvvvvvCCCCCCCCCCCCCCWWW',
  'WWWWW~~~.gggg...dd..CCCCCvvvvvvvvCCCCvvvvvvvvvvvCCCCCCCCCCCCWWWW',
  'WWWWW~...ggg....dd..CCCCvvvvvvvvvvCCvvvvvvvvvvvvvCCCCCCCCCCCWWWW',
  'WWWWW~..........dd..CCCCvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCCWWWW',
  'WW~~~~..........dd..CCCCvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCCWWWWW',
  'ddMMMMMMMMMMMddddd..CCCCvvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCCCWWWWW',
  'WWMMMMMMMMMMMddddd..CCCCvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCWWWW',
  'WW~~~~..........dd..CCCCCCvvvvvvvvvvvvvvvvvvvvvCCvvvvvvCCCCCWWWW',
  'WWWWW~..........dd..CCCCCCvvvvvvvvvvvvvvvvvvvvvCCvvvvvvCCCCCWWWW',
  'WWWWW~...gggg...dd..CCCCCCCCCCvvvvvvvvvvvvvvvvvvvvvvvvCCCCCCWWWW',
  'WWWWW~..gggggg..dd..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWW~...gggg...dd..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWWW~.........dd..CCCC...gg.......ggggg...CCCCCCCCCCCCCCCWWWWW',
  'WWWWWW~.........dd..CCCC..gggggg...ggggggg....CCCCCCCCCCCCWWWWWW',
  'WWWWWW~~........dd..CCCCC...ggg......ggg.......CCCCCCCCCCCWWWWWW',
  'WWWWWWWW~.......dd..CCCCCCCCCCCCCCC...CCC..CCCCCCCCCCCCCCWWWWWWW',
  'WWWWWWWW~.......dd..CCCCCCCCCCCCCCC===CCC..CCCCCCCCCCCCCCWWWWWWW',
  'WWWWWWWW~.......dd..CCCCCCCCCCC.....................CCCCCWWWWWWW',
  'WWWWWWWWW~......dd..CCCCCCCCCC...ggggg.....gggg......CCCCWWWWWWW',
  'WWWWWWWWW~......dd....CCCCCCC...ggggggg...gggggggg...CCCWWWWWWWW',
  'WWWWWWWWW~~.....dd....CCCCCCC......ggg.......C...CCCCCWWWWWWWWWW',
  'WWWWWWWWWWW~....ddddddddddddd..CCCCCCCCCCCCCCC===CCCCCWWWWWWWWWW',
  'WWWWWWWWWWWW~~~~~......ddddd~~~~~~~~~~~~~~~~~~~~~~~CCWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~WWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~~WWW~~~~~~~WWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

/** The tube's two mouths: in the face under the rim over the upper terrace, and in the crater's north wall. */
export const FLANK_MOUTH: Point = [25, 46];
export const CRATER_MOUTH: Point = [35, 31];

/** The jetty the skiff puts in at (`plan.ts`'s Smugglers' Run lands here). */
export const LANDING: Point = [50, 20];

/** The hoard's nook, in the crater's south-east: its item spots, one for every piece (`BUILT_IN_FILE_HOARDS`). */
export const HOARD = { x: 49, y: 41, width: 6, height: 4 } as const;
export const HOARD_SPOTS: readonly Point[] = [
  [49, 41],
  [51, 41],
  [53, 41],
  [50, 42],
  [52, 43],
  [49, 43],
  [51, 44],
  [53, 44],
];

/** The steps up the south face, two rows each: off the beach, and between the terraces. */
export const STEPS: readonly Point[] = [
  [29, 55],
  [29, 56],
  [41, 50],
  [41, 51],
];

/** Where the fire horse stands, on its own shelf of the crater floor. */
export const RAPIDASH: Point = [25, 38];

export function emberIsle(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'ember-isle');
  p.draw(0, 0, EMBER_ISLE);
  plantCaveMouth(p, FLANK_MOUTH);
  plantCaveMouth(p, CRATER_MOUTH);
  const tube = lavaTube(FLANK_MOUTH, CRATER_MOUTH);

  // -- The Smugglers' Landing: what the skiff brought over, stacked on the beach
  p.building('crate-pair', 53, 22, { lot: '~' }).building('barrels', 57, 22, { lot: '~' });
  p.building('sack', 55, 23, { lot: '~' });

  // -- The charcoal burners' camp in the west cove: their hut, the kiln, and
  // the drift-wood they burn
  p.building('hut', 11, 30, { lot: '.' }).building('log', 10, 38, { lot: '.' });
  p.building('big-stump', 12, 26, { lot: '.' }).building('dead-stump', 12, 32, { lot: '.' });

  // -- The climb: FireRed's stone steps through each band of rock, from the
  // black beach onto the lower terrace and from its east end onto the upper
  for (const [x, y] of STEPS) p.building('cliff-steps', x, y, { lot: '.' });

  // -- The crater: boulders the cone threw, and the hoard's crates
  p.building('round-boulder', 29, 40, { lot: 'v' }).building('rock', 42, 33, { lot: 'v' });
  p.building('rock', 32, 43, { lot: 'v' }).building('rock', 45, 36, { lot: 'v' });
  p.building('crate-stack', 53, 42, { lot: 'v' });

  // -- The black beach under the cone: rocks at the tide line
  p.building('rock', 24, 58, { lot: '~' }).building('rock', 41, 58, { lot: '~' });

  const file = districtFile(GREYSTONE_VALE, 'ember-isle', p, {
    dropIns: [],
    itemSpots: [
      // In the crater, against its west wall: the Charcoal falls back here (`filePrizes.ts`).
      { x: 26, y: 36 },
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
      // crater, every step of whose ash rolls for a wild Pokemon. The island
      // round them is the plan's district, whose tall grass rolls the volcano
      // too (`plan.ts`).
      districts: [
        { name: 'THE HOARD', ...HOARD, wildlife: 'volcano', floorRolls: true },
        { name: 'THE CRATER', x: 22, y: 31, width: 34, height: 15, wildlife: 'volcano', floorRolls: true },
      ],
      signs: [
        { x: 15, y: 39, lines: ['EMBER ISLE', 'The path climbs the south face to the Lava Tube. The crater is past it.'] },
        { x: 24, y: 47, lines: ['LAVA TUBE', 'The only way into the crater. Mind your step on the ash.'] },
        { x: 20, y: 57, lines: ['THE BLACK SANDS', 'The island makes its own beach. The boat is at the jetty on the west shore.'] },
      ],
      people: [
        {
          x: 57,
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
          x: 14,
          y: 34,
          name: 'Charcoal Burner',
          look: 'hiker',
          facing: 'down',
          lines: [
            'Our boat takes the charcoal off at twenty past three. There is room for one more.',
            'The crater is ash all the way down, and something lives in every step of it.',
          ],
        },
        {
          x: 29,
          y: 22,
          name: 'Volcanologist',
          look: 'scientist',
          facing: 'down',
          lines: ['The mountain breathes. Feel the ground? Warm.', 'It has not gone up in a hundred years. I am waiting.'],
        },
        {
          area: 'lava-tube',
          x: 15,
          y: 12,
          name: "Burners' Lad",
          look: 'youngster',
          facing: 'down',
          lines: ['The tube runs on under the crater. Hot underfoot all the way.'],
        },
      ],
      landmarks: [
        { x: 51, y: 18, name: "Smugglers' Landing", kind: 'jetty' },
        { x: 13, y: 33, name: "Burners' Kiln", kind: 'kiln' },
      ],
      trainers: [
        {
          x: 48,
          y: 41,
          name: 'Smuggler',
          team: 'netter',
          look: 'rocket-grunt',
          facing: 'left',
          sight: 3,
          lines: ['Nobody comes through the tube but us!'],
        },
        {
          x: 48,
          y: 44,
          name: 'Smuggler',
          team: 'lengthsman',
          look: 'rocket-grunt',
          facing: 'left',
          sight: 3,
          lines: ['That hoard is the whole run. Hands off it!'],
        },
      ],
      pokemon: [
        { x: RAPIDASH[0], y: RAPIDASH[1], species: 'rapidash', level: 40 },
        // A Magmar basking on the black sand, a Vulpix in the south grass and
        // a Ponyta on the west shore.
        { x: 40, y: 57, species: 'magmar', level: 15 },
        // Moltres in the crater, as FireRed keeps it on Mt. Ember's summit.
        { x: 30, y: 37, species: 'moltres', level: 50, legendary: true },
        { x: 50, y: 53, species: 'vulpix', level: 11 },
        { x: 10, y: 51, species: 'ponyta' },
        // In the Lava Tube: a Graveler in the warm north-east chamber and a
        // Growlithe asleep in the north-west one.
        { area: 'lava-tube', x: 18, y: 4, species: 'graveler', level: 15 },
        { area: 'lava-tube', x: 8, y: 6, species: 'growlithe' },
      ],
    },
  });
  return { file, notes: p.notes };
}
