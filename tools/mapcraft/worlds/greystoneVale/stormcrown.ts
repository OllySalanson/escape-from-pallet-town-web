/**
 * STORMCROWN, the storm-struck summit above the peaks: the first of the vale's
 * far places (`plan.ts`).
 *
 * The one idea: the summit is reached only from below. A raid comes up out of
 * the deepest floor of the Greystone Caves through the Chimney, a cave mouth
 * on the mountain's lower shoulder, and climbs round three bands of crag to
 * the cairn on the top, where Mew watches the storm. It is drawn as FireRed
 * draws Route 23's climb and Mt. Ember's summit path: a framed corridor
 * switching back across the face of the mountain, each band of crag running
 * out of the picture on both sides, one gap in each and the gaps on
 * alternate ends, so the way up is the long way.
 *
 * - **The shoulder**: the treeline under the first crag, the Chimney in its
 *   face, and a scree gully in the wood at the foot that is a way out of its
 *   own (the plan's Cloud Stair is at the top; without the gully the hunter's
 *   blind window would not cover the walk out from the foot,
 *   `hunterFlee.test.ts`).
 * - **The first shelf**: heather on a wide ledge of the mountain, the path
 *   along it under the second crag.
 * - **The second shelf**: the Storm Shelter, a refuge hut where a climber
 *   waits the weather out.
 * - **The summit**: the cairn on bare rock and short grass, Mew on its nub
 *   beside it, and the Cloud Stair going on over the top and down the far
 *   side, off the map.
 * - **Ledges** are the quick way back down - one off the summit, one off each
 *   shelf - and never a way up: a ledge only hops south.
 *
 * Every fight up here is in the rain (the district's places are `rain`), on
 * FireRed's climb-to-the-Plateau table (`summit`).
 *
 * The Greystone Caves' sixth floor, B5F, is this district's way in: it rides
 * in this file with the five floors above it and every ladder (as the other
 * mouths' districts carry them, so it passes its checks alone), and the hole
 * from B4F's far corner down to it (`greystoneDeep`).
 */
import { plantCaveMouth } from '../../caves';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { caveLadders, chimneyLink, greystoneCaves, greystoneDeep } from './greystoneCaves';
import { GREYSTONE_VALE } from './plan';

export function stormcrown(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'stormcrown');

  // -- The mountain, drawn whole ------------------------------------------------
  // C is the crag, . short grass, g the heather the storm flattens, d the path,
  // = a ledge (it hops south), W rain standing in a hollow, T the treeline.
  // Three bands of crag run out of the frame on both sides; one gap in each,
  // on alternate ends, is the way up, so the path switches back across the
  // face: in at the Chimney, east along the shoulder, up the east gap, west
  // along the first shelf round the crag nose and the boulders, up the west
  // gap, east along the second shelf past the Storm Shelter, up the east gap
  // onto the summit and round the tor to the cairn. A narrow chute through
  // each band holds the ledges: the quick way back down, never a way up.
  p.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCC.CCCCCCCCCCCddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCC..........CCCCCCddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCC.................CCddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCC...ggggg...........ddddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCC...gggggggg.........ddddCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCC.....gggggg....CCCC..dd..CCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCC..............CCCCCC.dd....CCCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCC.............CCCCCCCdd.....CCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCC....WWWW......CCCC.dd.....CCCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCC.WWWWWW..........dddddddddCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCWWWWWW........ggdddddddddCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCWWWW........ggggggg.CCddCCCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCC....gggggCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC====CCCCCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC......CCCCCCCC.dd.CCCCCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC.......CCCC....dd....CCCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC........gggggg.dd.....CCCCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCC.......ggggggggdd.........CCCCCCTT',
    'TTCCCCCCCCCCCCCCCC...CCCCCCCC.gggggggggggggggdd.........CCCCCCTT',
    'TTCCCCCCCCC.gggggg....CCCCCC.ggggggggggggggg.dd............CCCTT',
    'TTCCCCCCC.ggggggggg....CCCC....ggggggg.gggg..ddddddddd.....CCCTT',
    'TTCCCCCC..gggggggggg.........................ddddddddd....CCCCTT',
    'TTCCCCCC...gggggggg........ddddggggggdddddddddd...WWWWW...CCCCTT',
    'TTCCCCCCC.ddddddddddddddddddddggggggggddddddddd..WWWWWW..CCCCCTT',
    'TTCCCCCCCCddddddddddddddddddd..gggggggg..........WWWWW..CCCCCCTT',
    'TTCCCC....dd....................ggggg................CCCCCCCCCTT',
    'TTCCCC....ddCC.....................CCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCC....ddCCCCCCCC......CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCC....ddCCCCCCCC======CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCC....ddCCCCCCCC......CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCC....ddCCCCCCC.......CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCC...ddddCCCCCCC............CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCC...dddd.CCCCCC..................CCCCCCCCCCCCCCCCCCCCCCCCCTT',
    'TTCCCC..dd....CCCC.....................CCCCCCCCggggggCCCCCCCCCTT',
    'TTCCCC..dd..gggggggggg................CCCCCCCCgggggggggg.CCCCCTT',
    'TTCCCCC.dd.gggggggggggg.................CCCC...gggggggg...CCCCTT',
    'TTCCCCCCdd............dddddddddddddddddddd................CCCCTT',
    'TTCCCCCCddddddddddddddddddddddddddddddddddddddddddddd....CCCCCTT',
    'TTCCCCCCddddddddddddddddggggggggg.......ddddddddddddd..CCCCCCCTT',
    'TTCCCCCCCCCCCC...gggggggggggggg............CCCCC...dd..CCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=====CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCC.dd.CCCCCCCCTT',
    'TTTTTTTT...............CCCCCCC.......CCCCCCCCCCCCC.dd.TTTTTTTTTT',
    'TTTTTTTT................dd............ggggggggg....ddTTTTTTTTTTT',
    'TTTTTT...gggggggggg.....ddddddddddddddgggggggggddddd......TTTTTT',
    'TTTTTT..ggggggggggggg...ddddddddddddddggggggggdddddd......TTTTTT',
    'TTTTTTTTTT.ggggggg........TTTTTTTT......gggggTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTT................TTTTTTTT........TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTT....TTTTTT......TTTTTTTT........TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // The mountain runs out of the picture on three sides: its rim is crag to
  // the map's edge, where a wood would have stood it in a box of trees. Only
  // the treeline at its foot stays wood, as the peaks' frame below it is.
  const rim: [number, number][] = [];
  for (let y = 0; y < 54; y += 1) for (const x of [0, 1, 62, 63]) rim.push([x, y]);
  for (let x = 2; x < 62; x += 1) if (x < 40 || x > 41) rim.push([x, 0], [x, 1]);
  p.unlock(rim);
  for (const [x, y] of rim) p.put(x, y, 'C');

  // -- The Storm Shelter on the second shelf, and the cairn on the top ------------
  p.building('shed', 50, 23);
  p.building('strange-stone', 28, 5);

  // -- The Chimney: the Greystone Caves' sixth floor comes out in the first crag --
  const mouth: [number, number] = [24, 54];
  plantCaveMouth(p, mouth);
  const cave = greystoneCaves();
  const deep = greystoneDeep(cave);

  const file = districtFile(GREYSTONE_VALE, 'stormcrown', p, {
    // The scree gully: a pocket in the treeline at the foot of the east gap,
    // where the scree runs off the mountain the steep way. The plan's way out,
    // the Cloud Stair, is over the top; without this one the hunter's blind
    // window would not cover the walk out from the shelves and the shoulder
    // (`hunterFlee.test.ts`), and here, under the first gap, it is in reach of
    // every part of the climb.
    exits: [{ x: 57, y: 56, name: 'Scree Gully', opens: { when: 'always' } }],
    dropIns: [],
    itemSpots: [
      { x: 55, y: 42 }, // the first shelf's east bay, past the boulders
      { x: 9, y: 27 }, // the second shelf's west end, under the summit's crag
      { x: 30, y: 6, hidden: true }, // under the cairn
      ...deep.secrets,
    ],
    extra: {
      // Every fight up here is in the storm: the summit and the shoulder are
      // named, and the crags between them are STORMCROWN itself, which the plan
      // rains on (`plan.ts`).
      districts: [
        { name: 'THE CAIRN', x: 2, y: 0, width: 60, height: 21, wildlife: 'summit', rain: true },
        { name: 'THE CHIMNEY', x: 2, y: 47, width: 60, height: 15, wildlife: 'summit', rain: true },
      ],
      signs: [
        { x: 26, y: 55, lines: ['STORMCROWN', 'The path climbs round the three crags to the cairn.'] },
        { x: 37, y: 9, lines: ['THE CLOUD STAIR', 'Over the top, and down the far side out of the storm.'] },
      ],
      people: [
        {
          x: 49,
          y: 25,
          name: 'Climber',
          look: 'hiker',
          facing: 'right',
          lines: ['I came up for the view and the storm came with me.', 'Something small and pink watches from the cairn.'],
        },
      ],
      trainers: [
        { x: 30, y: 41, name: 'Hiker Brann', team: 'breaker', look: 'hiker', facing: 'up', sight: 2, lines: ['Nobody climbs Stormcrown without a fight!'] },
      ],
      landmarks: [{ x: 52, y: 27, name: 'Storm Shelter', kind: 'spring' }],
      // Mew, behind the cairn on the very top: the vale's legend.
      pokemon: [{ x: 28, y: 3, species: 'mew', level: 50, legendary: true }],
      areas: [...cave.areas, deep.area],
      links: [chimneyLink(mouth), deep.hole, ...caveLadders(cave)],
    },
  });
  // The vale is the game's own map, so it is held to its limits: Mew is a legend.
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}
