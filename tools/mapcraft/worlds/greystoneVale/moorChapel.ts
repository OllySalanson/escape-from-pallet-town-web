/**
 * THE MOOR CHAPEL, on the fell west of High Moor: a far place, reached only
 * after dark.
 *
 * The one idea: a ruined chapel on a fell, in a fog that lifts only after
 * dark - its graveyard, its crypt and its ghosts. The sheep track nobody signs
 * leaves the shepherd's clearing on High Moor and runs west through the wood;
 * by day the fog turns it back (a night track, `gates.ts`), and on a night raid
 * it comes out at the Lantern Cross, at the head of the fell. From the cross
 * the track drops through the heather, under the crags, to the chapel on its
 * knoll - FireRed's own Pokemon Tower - with the graveyard walled round it,
 * and the old corpse road the drovers carried their dead along leaves by the
 * lych gate, west off the fell and out of the vale. Under the chapel's floor is
 * the crypt, the one place a raid meets Ghost Pokemon on every step, and what
 * the drovers buried with their dead, and the Spell Tag.
 */
import type { MapFileArea, MapFileLink } from '../../../../src/game/world/mapFile';
import { TOWER_GROUND } from '../../../../src/game/world/tileset/insideTileset';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/**
 * The fell as it is drawn, a letter a tile: T the wood, C the crags, . the
 * fell's grass, g heather, W the tarn, d the corpse road. Everything stands
 * along the one road the drovers carried their dead on: in off the sheep
 * track at the Lantern Cross, west along a corridor under the crags with the
 * heather either side, round the tarn at the crags' west foot, south past the
 * chapel's door and the graveyard's lych gate, and west out of the vale. The
 * wood frames every side, on whole lattice cells so its trees are whole.
 */
const GROUND = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTTTTTTTTTTTTTTTT',
  'TTTTTTTTCCCCCCCCCCCCCCCC......CCCCCCCC..........TTTTTTTTTTTTTTTT',
  'TTTTTTTTCCCCCCCCCCCCC....ggggg..CCCC.......ggg..TTTTTTTTTTTTTTTT',
  'TTTTTTTTCCCCWWWWCCC....gggggggg..........gggggg.TTTTTTTTTTTTTTTT',
  'TTTTTTTTCCCWWWWWW.....gggggggggg.......gggggggg.TTTTTTTTTTTTTTTT',
  'TTTTTTTTCCWWWWWWW.....ggggggggggg.....gggggggg..TTTTTTTTTTTTTTTT',
  'TTTTTTTTCCWWWWWWW......ggggggggg..ddddddddddddddddTTTTTTTTTTTTTT',
  'TTTTTTTT..WWWWWW.........ggggg....dddddddddddddddd..............',
  'TTTTTTTT..ggggggg..ddddddddddddddddddddddddddddddd..............',
  'TTTTTTTT...gggg....dddddddddddddddddd.......dd..TTTTTTTTTTTTTTTT',
  'TTTTTTTT...........dddddddddddddddddd.......ddggTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTT.....ddd............TT........ddggTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTggg..ddd............TT........ddggTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT........ddggTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT........ddggTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT........dd.gTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..dddddddd..TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..dddddddd..TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..dd........TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..ddggggg...TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..ddgggggg..TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgggg.ddd............TT..dd.ggggg..TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTggg..ddd............TT..dd..ggg...TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTgg...ddd............TT..dd..TTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTT.....ddd............TT..ddggTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTT.....ddd............TT..ddggTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTT.....ddd............TT..dd..TTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTT.....ddd............TTTTddTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTdddddddddddddddddddd............TTTTddTTTTTTTTTTTTTTTTTTTTTTTT',
  'dddddddddddddddddddddd........TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'dddddddddddddddddddddd........TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT..gggggg......TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT...gggggggg...TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/** Where FireRed's Pokemon Tower stands, and so the tile in front of its door. */
const CHAPEL = { x: 24, y: 23 } as const;
const CHAPEL_DOOR = { x: CHAPEL.x + 3, y: CHAPEL.y + 7 } as const;

/** The nave: FireRed's Pokemon Tower's ground floor, quiet, its pews of graves either side of the aisle. */
const NAVE: MapFileArea = {
  id: 'moor-chapel-nave',
  name: 'Moor Chapel',
  kind: 'tower',
  style: 'tower',
  width: 24,
  height: 20,
  ground: TOWER_GROUND,
  buildings: [
    // The two statues either side of where the altar was, as Lavender's top floor stands them.
    { x: 9, y: 2, kind: 'tower-statue' },
    { x: 13, y: 2, kind: 'tower-statue' },
    // Pews of graves either side of the aisle.
    ...[6, 7, 8, 9, 13, 14, 15, 16].flatMap((x) => [
      { x, y: 7, kind: 'tower-grave' as const },
      { x, y: 11, kind: 'tower-grave' as const },
    ]),
    ...[7, 8, 9, 13, 14, 15].map((x) => ({ x, y: 15, kind: 'tower-grave' as const })),
  ],
};

/**
 * Where FireRed's Pokemon Tower 3F stands its graves, cell for cell: the maze
 * Game Freak drew round its stairs up on the east, which are where the crypt's
 * are. All but the one over the stairs: FireRed's 3F has wall beside it where
 * every tower floor here has the ground floor's, so it would seal a tile in.
 */
const TOWER_3F_GRAVES: readonly (readonly [number, number])[] = [
  [8, 4], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6],
  [16, 6], [17, 6], [18, 6], [6, 7], [6, 8], [17, 8], [6, 9], [10, 9], [11, 9], [12, 9],
  [16, 9], [6, 10], [10, 10], [11, 10], [12, 10], [16, 10], [6, 11], [16, 11], [6, 12], [16, 12],
  [19, 12], [20, 12], [6, 13], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13], [15, 13], [16, 13],
  [18, 13], [19, 13], [4, 15], [5, 15], [6, 15], [17, 15], [18, 15], [6, 16], [9, 17], [10, 17],
  [11, 17], [12, 17], [13, 17],
];

/**
 * The crypt under the nave: the same round room, its own stairs up in the east
 * and nothing at its foot, its graves the maze FireRed's third floor is - and
 * the drovers' own, in gold, in the inner block where the grave goods are.
 */
const CRYPT: MapFileArea = {
  id: 'moor-chapel-crypt',
  name: 'The Crypt',
  kind: 'tower',
  style: 'tower',
  width: 24,
  height: 20,
  ground: TOWER_GROUND.map((row, y) => (y === 18 ? 'C'.repeat(24) : row)),
  buildings: TOWER_3F_GRAVES.map(([x, y]) => ({
    x,
    y,
    kind: x >= 10 && x <= 12 && (y === 9 || y === 10) ? ('tower-gold-grave' as const) : ('tower-grave' as const),
  })),
};

export function moorChapel(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'moor-chapel');
  p.draw(0, 0, GROUND);

  // -- The chapel in its churchyard beside the road: FireRed's own Pokemon
  // Tower, walled round with its graves in the fell's own post and rail, the
  // road's sand worn in at the gate and up to its door
  p.building('pokemon-tower', CHAPEL.x, CHAPEL.y);
  p.fenceLine([[22, 22], [33, 22]]).fenceLine([[33, 22], [33, 39]]).fenceLine([[22, 39], [33, 39]]);
  p.fenceLine([[22, 22], [22, 29]]).fenceLine([[22, 32], [22, 39]]);
  p.road([[22, CHAPEL_DOOR.y], [CHAPEL_DOOR.x - 1, CHAPEL_DOOR.y]]);
  // Graves in broken rows below the chapel and beside it, and the grass come
  // up between them
  p.bedRows([35, 25, 31], [36, 24, 32], [37, 24, 32], [38, 26, 31]);
  for (const [x, y] of [
    [31, 24], [32, 26], [31, 28],
    [25, 33], [26, 33], [27, 33], [29, 33], [30, 33], [31, 33],
    [24, 35], [25, 35], [27, 35], [28, 35], [29, 35], [31, 35],
    [25, 37], [26, 37], [28, 37], [30, 37], [31, 37],
  ] as const) {
    p.building('grave', x, y);
  }
  // The gold ones nearest the chapel door: the drovers who paid for theirs.
  p.building('gold-grave', 24, 32).building('gold-grave', 32, 32);

  // The Lantern Cross: the tower's statue in the corner of the crags and the
  // wood at the head of the fell, where the sheep track comes out of the trees.
  p.building('grave-statue', 47, 12);
  // -- The drove track south from the cross through the wood: the way the
  // flocks came down off the fell, past the drovers' bothy at its bend, where
  // they slept the night before the fair, and on to the gap they left by
  p.building('cottage', 38, 24);

  // -- The night track: the sheep track's whole run through the wood is wood
  // by day, so the fog has turned it back before the fell is in sight, and a
  // way through on a night raid. Whole lattice cells, so by day it is whole
  // trees, as deep as a door may be wide.
  const nightTrack = { kind: 'night' as const, x: 48, y: 18, width: 12, height: 2 };

  const links: MapFileLink[] = [
    {
      ends: [
        { x: CHAPEL_DOOR.x, y: CHAPEL_DOOR.y, toward: 'up', look: 'door' },
        { area: NAVE.id, x: 11, y: 18, toward: 'down', look: 'mat' },
      ],
    },
    {
      ends: [
        { area: NAVE.id, x: 4, y: 10, toward: 'left', look: 'stairs-down' },
        { area: CRYPT.id, x: 18, y: 10, toward: 'right', look: 'stairs-up' },
      ],
    },
  ];

  const file = districtFile(GREYSTONE_VALE, 'moor-chapel', p, {
    dropIns: [],
    // The drove track's end, a gap in the wood the flocks went out by: the
    // fell's second way out, so a raid at the cross need not go round by the
    // corpse road.
    exits: [{ x: 38, y: 39, name: "Drovers' Gap", opens: { when: 'always' } }],
    itemSpots: [
      { x: 32, y: 38, hidden: true }, // in the churchyard's far corner
      { x: 40, y: 12 }, // under the crags
      // In the crypt: the Spell Tag where FireRed's third floor leaves its item,
      // and what else was left in the far corner.
      { area: CRYPT.id, x: 13, y: 2, prize: 'spell-tag' },
      { area: CRYPT.id, x: 7, y: 16 },
    ],
    extra: {
      doors: [nightTrack],
      areas: [NAVE, CRYPT],
      links,
      districts: [
        { name: 'The Churchyard', x: 22, y: 22, width: 12, height: 18, wildlife: 'haunted' },
        { area: CRYPT.id, name: 'The Crypt', x: 0, y: 0, width: 24, height: 20, wildlife: 'haunted' },
      ],
      landmarks: [
        { area: CRYPT.id, x: 9, y: 9, name: 'Grave Goods', kind: 'grave' },
        { x: 23, y: 38, name: 'The Ossuary', kind: 'shrine' },
      ],
      signs: [
        { x: 37, y: 25, lines: ["DROVERS' BOTHY", 'The drovers slept here the night before the fair.'] },
        { x: 46, y: 15, lines: ['LANTERN CROSS', 'Lit for the drovers coming over the fell after dark.'] },
        { x: 21, y: 32, lines: ['THE MOOR CHAPEL', 'Erected in the memory of the drovers and their POKéMON.'] },
        { x: 12, y: 42, lines: ['THE CORPSE ROAD', 'West, off the fell.'] },
      ],
      people: [
        {
          area: NAVE.id,
          x: 18,
          y: 7,
          name: 'Channeler',
          look: 'channeler',
          facing: 'left',
          lines: ['I am a CHANNELER.', 'There are spirits up to mischief.', 'I sense them under the floor.'],
        },
        {
          area: NAVE.id,
          x: 5,
          y: 14,
          name: 'Mourner',
          look: 'old-woman',
          facing: 'up',
          lines: ['I came to pray for my dearly departed CLEFAIRY.', 'Sniff!'],
        },
      ],
    },
  });
  // The crypt's prize is the game's own map's: checked alone, it is held to the vale's limits.
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** For `look.mts`: the district alone. */
export default moorChapel;
