/**
 * TANGLEWOOD, the wood in the middle of Greystone Vale's east side.
 *
 * The one idea: a maze of paths that loop and fork, opening onto a ruined
 * shrine in a glade. The road from The Crossing runs through it east to the
 * Eastern Track, and is the one way that is easy to follow; everything off it
 * forks and comes back round, so a raid that leaves the road can lose it. The
 * shrine stands in the glade north of the road, reached three ways and seen
 * from none of them until you are in it. In the north-east the wood climbs
 * onto a rock outcrop, where the Greystone Caves have a mouth.
 *
 * FireRed draws no broadleaf mass - its broadleaf stands alone, and planted
 * shoulder to shoulder it reads as an orchard - so the wood is FireRed's own
 * forest conifer, as Viridian Forest is, with the broadleaves standing in the
 * glades. Drawn a letter a lattice cell (`MapProgram.cells`), with detail tile
 * by tile on top.
 */
import { caveMouthSpots, plantCaveMouth } from '../../caves';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { caveLife } from './caveLife';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { GREYSTONE_VALE } from './plan';

/** The wood, a letter a lattice cell: T pines, . lanes and glades, g tall grass, d the road, C rock. */
const WOOD = [
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTT.....ggggg......TTTTTTTTTTTT',
  'TTTT.TTTTTTTTTT.TTT.TTTTTTTTTTTT',
  'TTTTgTTTTTTTTTT.TTT.TTTTCCCCCCTT',
  'TTTTgTTTTTTTTTT.TTT.TTTTCCCCCCTT',
  'TTTTgTTTTTTTTTT.....TTTTCCCCCCTT',
  'TTTTgTTTTTTTTTT.TTT.TTTTCCCCCCTT',
  'TTTT.....TTTTTT.TTT.TTT.......TT',
  'TTTT.....TTTTTT.TTT.....TTTTTTTT',
  'TTTT.....TTTTTTgT........TTTTTTT',
  'TTTT.TTT.TTTTTTgT............TTT',
  'TTTT.TTT.TTTTTTgT........TTT.TTT',
  'TTTT.TTT.TTT....T........TTTgTTT',
  'TTT..TTT.TTT.TTTTT.....TTTTTgTTT',
  'ddddddTT.TTT.TTTTTTTdTTTTTTTgTTT',
  'TTTTTdTT.TTTddddddddddTTTTTTgTTT',
  'TTTTTdTT.TTTdTTT.TTTTdTTTTTT.TTT',
  'TTTTTddddddddTTT.TTTTdTTTTTT.TTT',
  'TTTTTTTTT.TTTTTT.TTTTddddddddddd',
  'TTTTTTTTT.TTTTTT.TTTTTTTT.TTTTTT',
  'TTTTTTTTT.TTTTTT...TTTTTT.TTTTTT',
  'TTTTTTTTT.TTTTTTTT.TTTTTT.TTTTTT',
  'TTTT.ggg..ggggg....TTTTTT.TTTTTT',
  'TTTT.TTTTTTTTTTTTT.TT..TT.TTTTTT',
  '.....TTTTTTTTTTTTTgTT........TTT',
  'TTTT.TTTTTTTTTTTTTgTT..TTTTTTTTT',
  'TTTT....TTTTTTTTTTgTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTgTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTT',
];

export function tanglewood(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'tanglewood');
  p.cells(WOOD);

  // -- The shrine: a statue on ground worn bare round it, in a glade the wood
  // closes round, the stones of its ring fallen, one broadleaf leaning over it
  p.draw(38, 22, [' dddddd ', 'dddddddd', 'dddddddd', ' dddddd ']);
  p.building('gym-statue', 41, 22, { lot: 'd' });
  p.building('rock', 48, 26).building('rock', 49, 26).building('rock', 48, 27); // fallen together
  p.building('tree', 34, 25);
  p.block(34, 25, 3, 1, '#'); // thicket under its crown, so nobody stands hidden there
  p.road([[40, 26], [40, 32]]); // the one spur off the road that goes somewhere
  p.bedRows([27, 43, 47], [28, 44, 47]);

  // -- Where three lanes meet in the north-west: a pool, and a berry tree by it
  p.draw(11, 19, ['  WWW ', ' WWWWW', 'WWWWWW', ' WWWW ']);

  // -- The way underground: the Greystone Caves open at the outcrop's foot -----
  const mouth = caveMouthSpots(p, { x: 50, y: 14, width: 8, height: 6 })[0];
  if (!mouth) throw new Error('the outcrop has no foot for a cave mouth');
  plantCaveMouth(p, mouth);
  // A worn path from the shrine to the mouth: the shrine's keepers went in.
  p.road([[44, 22], [46, 22], [46, 18], [mouth[0] - 1, 18]]);
  const cave = greystoneCaves();
  // Who and what is down there, floor by floor (`caveLife.ts`).
  const life = caveLife();

  const file = districtFile(GREYSTONE_VALE, 'tanglewood', p, {
    dropIns: [],
    // A way out in a pocket beside the road just inside the wood, for whoever
    // is lost in the maze: the road's own way out is at the wood's far east end.
    exits: [{ x: 6, y: 30, name: 'Deer Gap', opens: { when: 'always' } }],
    itemSpots: [
      { x: 14, y: 56 },
      { x: 43, y: 52 },
      { x: 37, y: 28, hidden: true },
      { x: 9, y: 26 },
      ...cave.secrets,
    ],
    extra: {
      landmarks: [{ x: 42, y: 27, name: 'Ruined Shrine', kind: 'shrine' }, ...life.landmarks],
      people: [
        // In the glade at the end of the south-east lanes, as far into the maze as it goes.
        {
          x: 50,
          y: 53,
          name: 'Woodcutter',
          look: 'bald-man',
          facing: 'left',
          lines: ['Lost? Every path in Tanglewood comes back to the road in the end.', 'The road is north of here. It always is.'],
        },
        ...life.people,
      ],
      pokemon: life.pokemon,
      berryTrees: [{ x: 16, y: 19, berry: 'pecha' }],
      areas: cave.areas,
      links: [caveMouthLink(cave, 'wood', mouth), ...caveLadders(cave)],
      signs: [
        { x: 17, y: 36, lines: ['TANGLEWOOD', 'East to the Eastern Track. Keep to the road.'] },
        ...life.signs,
      ],
      trainers: [
        {
          x: 18,
          y: 48,
          name: 'Bug Catcher Tam',
          team: 'scout',
          look: 'bug-catcher',
          facing: 'right',
          sight: 3,
          lines: ['Everyone gets lost in here. That is how I catch them.'],
        },
        ...life.trainers,
      ],
    },
  });
  return { file, notes: p.notes };
}
