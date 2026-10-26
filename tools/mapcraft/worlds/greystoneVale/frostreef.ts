/**
 * FROSTREEF, an island of ice out on the outer reef, south-east of the vale.
 *
 * The one idea: an island nobody walks to. The salvage launch puts in at the
 * Wreck's pier on the flood tide and runs out to the reef - The Ice Run - and
 * lands at the Ice Jetty on the island's north shore, and that is the only
 * way here. From the shore the berg stands over everything, and the ridge
 * behind it walls off the frozen lagoon, which is the island's best ground:
 * Lapras waits on the ice there, and the NeverMeltIce is found nowhere else.
 * The only way into the lagoon is under the berg, through Berg Cave, whose
 * floors are FireRed's sliding ice; the only way off the lagoon is the
 * whalers' boat that puts in at its channel late in a raid, or back the way
 * you came, under the berg and out on the launch before the tide turns.
 *
 * Drawn letter for letter, because a sheet of ice is a puzzle and a puzzle is
 * the drawing: `I` is ice, which carries a step on until something stops it
 * (`slidingFloor.ts`), and `o` a snowy boulder standing on it, which is what
 * stops one. The frozen pool on the shore teaches the rule where getting it
 * wrong costs nothing; the lagoon and the cave are where it costs the tide.
 * Every one of them is held to being fair by `frostreef.test.ts`.
 */
import { plantCaveMouth } from '../../caves';
import type { Point } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { bergCave } from './bergCave';
import { GREYSTONE_VALE } from './plan';

/** The island as drawn: W the sea, ~ the shore, C rock, M the jetty's stone, I ice, o a boulder on it. */
export const FROSTREEF = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWCCCCCCCCCCWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWCCCCCCCCCCWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWCCCCCCCCCCWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWCCCCCCCCCCWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWCCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWCCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWCCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWWWCCCCCCCCWWWWWWWWWWWWWWWWMMWWWWWWWWCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWWWCCCCCCCCWWW~~~~~~~~~WWWWMMWWWWWWWWCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWWWCCCCCCCC~~~~~~~~~~~~~~WWMMW~~~~~~WCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWWWCCCCCCCC~~~~~~~~~~~~~~~~dd~~~~~~~~CCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCCCCCC~~~~~~~~~~~~~~~~dd~~~~~~~~CCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC~~~~~~........TTTT..dd.......~CCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC.~~~~~~~~.....TTTT..dd...ggg..CCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC~IIIIIII~~......TT..dd.gggggg.CCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC~IIIIIIoII~....gTT..dd..ggggggCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC~IIIIIIIIII~.ggggg..dd....ggggCCCCCCCCCCCCCCCCCCCWWWWW',
  'WWWWCCCCCC~IIoIIIIIII~ggggg...dd.....gg.CCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWCCCCCCC~IIIIIII~~..ggg....dd......ggCCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWCCCCCCCC~~~~~~~...........dd........CCCCCCCCCCCCCCCCWWWWWWWW',
  'WWWWCCCCCCCC........CCCC......dddddddddddddddddddCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCC......CCCCCCCC...dddddddddddddddddddCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCC....CCCCCCCCCCC.......CCCCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC~~~dddddddddd',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC~~~~dddddddddd',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC~~~~~CCCCCCWWWW',
  'WWWWWWCCCC~~~IIIIIIIICCCCCCCCCCCCCIIIIICCCCCCCCC~~~~~CCCCCCCWWWW',
  'WWWWWWCCC~~~IIIIIIIIICCCCCCCCCCCIIIIIIIICCCCCC~~~~~~~CCCCCCCWWWW',
  'WWWWWWCCC~IIIIIIIIIIICCCCCCIIIICIIIIIIIIIIIIII~~~~~~~CCCCCCCWWWW',
  'WWWWWWCCCCIIIIIIIIIIIIIIIIIII~~~IIIIIIIIIIIIIIII~~~~~CCCCCCCWWWW',
  'WWWWWWCCCCIIIIIIIIIIIIIIIIII~~~~IIIIIIIIII~~~IICCCCCCCCCCCCCWWWW',
  'WWWWWWCCCCIIIIIIIIIIoIIIIIII~~~IIIIIIIIII~~~IIIIICCCCCCCCCCCWWWW',
  'WWWWWWCCCCCIIIIIIIIIIIIIIIIIIIIIIIIIIIIIICCCCIIIIICCCCCCCCCCWWWW',
  'WWWWWWCCCCCIIIIIIIIIIIIIIIIIIIIIIIIoIIIIICCCCIIIIICCCCCCCCCCWWWW',
  'WWWWWWCCCCCCIIIIIIIIIIIIIIIIIIIIIIIIIIIIICCCCIIIIICCCCCCCCCCWWWW',
  'WWWWWWCCCCCCIIIIIIIICCCCCCIIIIIIIIIIIIIIICCCCIIIICCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCIIIIIIICCCCCCIIIIIIIIoIIIIIICCCCIIICCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCIIIIICCCCCCIIIIIIIIIIIIIIIIII~~~~CCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCCCCIICCCCCCIIIIIIIIIIIIIIII~~~~~CCCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCWWWW',
  'WWWWWWCCCCCCCCCCCCCCCCCCCCCIIIIIIIIIICCCCCCCCCCCCCCCCCWWWWWWWWWW',
  'WWWWWWWWWWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWWWWWWWWWW',
  'WWWWWWWWWWCCCCCCCCCCCCCCCCWWWWWWCCCCCCCCCCCCCCCCWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWCCCCCCCCCCCCWWWWWWCCCCCCCCCCCCCCCCWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWCCCCCCWWWWWWWWWWWWWWWWWWCCCCCCWWWWWWWWWWWWWWWWWWWW',
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
];

/** The berg's foot over the jetty shore, and the ridge's foot over the lagoon: Berg Cave's two mouths. */
export const SHORE_MOUTH: Point = [46, 25];
export const LAGOON_MOUTH: Point = [11, 32];

/** Where Lapras waits: on the snow-bank in the middle of the frozen lagoon. */
export const LAPRAS: Point = [29, 37];

/** The boulders, varied by where they stand so no two neighbours are drawn alike. */
const BOULDERS = ['snowy-boulder', 'snowy-boulder-low', 'snowy-boulder', 'snowy-boulder-tall'] as const;

export function frostreef(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'frostreef');
  p.draw(0, 0, FROSTREEF.map((row) => row.replace(/[Io]/g, 'i')));
  FROSTREEF.forEach((row, y) =>
    [...row].forEach((letter, x) => {
      if (letter === 'o') p.building(BOULDERS[(x * 7 + y * 3) % BOULDERS.length], x, y, { lot: 'i' });
    }),
  );
  plantCaveMouth(p, SHORE_MOUTH);
  plantCaveMouth(p, LAGOON_MOUTH);
  const cave = bergCave(SHORE_MOUTH, LAGOON_MOUTH);

  const file = districtFile(GREYSTONE_VALE, 'frostreef', p, {
    dropIns: [],
    itemSpots: [
      // On the frozen pool under the headland: whoever slides across it picks it up.
      { x: 15, y: 22 },
      // On the far shore of the lagoon, under the berg's shadow.
      { x: 45, y: 45 },
      ...cave.secrets,
    ],
    extra: {
      areas: cave.areas,
      links: cave.links,
      districts: [
        { name: 'THE FROZEN LAGOON', x: 6, y: 28, width: 58, height: 24, wildlife: 'ice' },
      ],
      signs: [
        {
          x: 33,
          y: 16,
          lines: ['FROSTREEF', 'The launch puts in on the flood tide. When the tide turns, it does not.'],
        },
      ],
      people: [
        {
          x: 27,
          y: 17,
          name: 'Old Whaler',
          look: 'fisherman',
          facing: 'down',
          lines: [
            'The lagoon is the other side of the berg. The cave under it is ice the whole way.',
            'Once you are moving on ice you go till something stops you. Look before you step.',
            'Our boat comes into the lagoon late, for anyone who got that far.',
          ],
        },
        {
          area: 'berg-cave-1f',
          x: 16,
          y: 18,
          name: 'Ice Fisher',
          look: 'fisherman',
          facing: 'up',
          lines: ['The hole down is in the far corner, past the ice.', 'Stop against the right boulder and you are there. Stop against the wrong one and you go round again.'],
        },
      ],
      landmarks: [{ x: 31, y: 11, name: 'Ice Jetty', kind: 'jetty' }],
      pokemon: [
        { x: LAPRAS[0], y: LAPRAS[1], species: 'lapras', level: 10 },
        // A Seel hauled out by the landing, and a Jynx at the foot of the berg.
        { x: 19, y: 18, species: 'seel', level: 12 },
        { x: 34, y: 28, species: 'jynx', level: 14 },
        // Under the berg, on the stone floors the ice runs off, where no slide
        // can meet it: a Cloyster at the foot of B1F.
        { area: 'berg-cave-b1f', x: 5, y: 14, species: 'cloyster' },
      ],
    },
  });
  return { file, notes: p.notes };
}
