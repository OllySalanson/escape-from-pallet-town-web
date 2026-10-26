/**
 * THE SUNKEN QUARTER, the drowned lower town of the old port, south of Gull
 * Strand.
 *
 * The one idea: a town the sea took. The jetty from the strand runs on out
 * over the water to the Old Quay, the one stretch of the port still dry, with
 * the harbour office and two houses on the lane above it. From the lane the
 * old high street walks on into the sea: the streets of the lower town are
 * under the tide now, stone just awash, and the roofs of the houses along them
 * stand in the water. In the middle of it the mansion stands on its own
 * walled terrace, its garden gone to grass; from the terrace one drowned street
 * runs west to the shingle under the cliffs, where the trail comes round from
 * Smugglers' Cove, and another south to the Low Water Stair, the way off the
 * map that only shows when the tide is out.
 *
 * Stone laid over water is a drowned street, as the jetty is at Gull Strand;
 * the sea runs to the map's edges, which needs no wood to seal it.
 *
 * And it is the vale's one keeper's ground. Boatswain Cragg holds the old
 * high street where it leaves the lower street for the drowned town,
 * sandbagged across, and the only other way into the drowned town - the
 * street in from the shingle under the west cliff - is sandbagged too: two
 * doors (`MapFileDoor` 'boss'), the keeper authored and measured in
 * `src/game/world/trainers.ts` as every boss is. The quay, the upper street and
 * the Old Quay landing are on his side of them; the mansion and the Low Water
 * Stair are behind. Beat him and both come down, so the shingle and the cove
 * beyond it are a short way back into the town the quay was the only way into.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { openingsOf, openingTiles, planLimits, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function sunkenQuarter(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'sunken-quarter');
  // The sea needs no wood to seal it: free the whole rim but the openings.
  const kept = new Set(
    openingsOf(GREYSTONE_VALE, 'sunken-quarter').flatMap((opening) =>
      openingTiles(p.width, opening, 4).map(([x, y]) => `${x},${y}`),
    ),
  );
  const rim: [number, number][] = [];
  for (let y = 0; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if ((x < 2 || y < 2 || x >= p.width - 2 || y >= p.height - 2) && !kept.has(`${x},${y}`))
        rim.push([x, y]);
  p.unlock(rim);
  p.block(0, 0, 64, 64, 'W');

  // -- The headlands: the cliff the port stood under, and the open sea --
  // The west cliff runs off the map at both ends, so it reads as coast, not as
  // a block; east of the port is the open sea the wreck lies in.
  p.draw(0, 10, [
    'CCCC', 'CCCCC', 'CCCCCC', 'CCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCC',
    'CCCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCCCC',
    'CCCCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCC',
    'CCCCCCCC', 'CCCCCCC', 'CCCCCCC', 'CCCCCC', 'CCCCCC', 'CCCCCC', 'CCCCCCC', 'CCCCCCC',
  ]);
  p.draw(0, 46, [
    'CCCCCC', 'CCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCCC', 'CCCCCCCCC', 'CCCCCCCC',
    'CCCCCCCC', 'CCCCCCC', 'CCCCCCC', 'CCCCCC', 'CCCCCC', 'CCCCC', 'CCCCC', 'CCCC', 'CCCC',
    'CCCC', 'CCC',
  ]);

  // -- The port above the tide: the quay, and the upper street behind it ----
  // Drawn as a town first; the sea is let in over the lower streets below.
  p.block(8, 12, 46, 16, '.');
  p.draw(8, 12, ['WWWWWWWW', 'WWWWWW', 'WWW', 'W']); // the quay wall steps back west
  // The jetty, on from the strand to the quay: stone right to the edge, where
  // the plan's opening would lay sand.
  p.unlock([[44, 0], [45, 0], [44, 1], [45, 1], [30, 62], [31, 62], [30, 63], [31, 63]]);
  p.block(44, 0, 2, 12, 'M');
  p.put(46, 4, 'M'); // the fishers' steps, where the boats still put in
  p.draw(14, 12, [
    '  PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    ' PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
  ]);
  p.road([[10, 22], [52, 22]], { letter: 'P' }); // the upper street
  p.road([[30, 16], [30, 27]], { letter: 'P' }); // the high street, down from the quay
  // Row A faces the upper street, its back to the quay.
  p.building('house', 12, 18).building('orange-house', 20, 18);
  p.building('grey-house', 34, 18).building('cottage', 45, 19); // the harbour office
  p.flowers([25, 20], [26, 20], [40, 20], [41, 21]);
  p.fenceLine([[11, 17], [27, 17]], { gaps: [[18, 17]] });
  p.bushes([33, 17], [43, 18], [52, 19]);
  // On the quay: moorings on the lip, the cargo nobody came back for.
  p.building('mooring-post', 22, 12, { lot: 'P' }).building('mooring-post', 50, 12, { lot: 'P' });
  p.building('barrels', 33, 14, { lot: 'P' }).building('barrel', 41, 13, { lot: 'P' });
  p.building('crate-pair', 18, 14, { lot: 'P' }).building('crate', 48, 15, { lot: 'P' });

  // Row B stands on the last dry ground, its doors on the drowned street.
  p.building('house-door', 13, 24).building('green-house', 21, 24);
  p.building('blue-house', 34, 24).building('purple-house', 42, 24);

  // -- The tide: the sea comes up over the lower town --------------------------
  p.block(8, 28, 46, 36, 'W');
  // The streets walk on under the tide: stone just awash, as the jetty is.
  p.block(8, 28, 42, 2, 'M'); // the lower street, from the west cliff to the boatyard
  p.block(30, 28, 2, 28, 'M'); // the high street, on through the mansion to the stair
  p.block(8, 46, 22, 2, 'M'); // the low street, west to the shingle
  p.block(32, 46, 12, 2, 'M'); // ...and east to a door
  p.block(16, 54, 14, 2, 'M'); // the bottom street

  // The boatyard, the one dry corner of the lower town.
  p.draw(48, 24, ['  ..', '.....', '......', '......', '......', '.....', '....']);
  p.building('shed', 49, 24);
  p.building('crate-stack', 50, 29, { lot: '.' });

  // -- The roofs along the drowned streets, each where its street put it -------
  p.building('grey-house', 11, 42, { lot: 'W' }).building('orange-house', 17, 42, { lot: 'W' });
  p.building('green-cottage', 40, 42, { lot: 'W' });
  p.building('blue-house', 14, 50, { lot: 'W' }).building('house', 22, 50, { lot: 'W' });
  p.building('purple-house', 35, 50, { lot: 'W' }).building('small-flats', 44, 46, { lot: 'W' });
  p.building('rock', 24, 58, { lot: 'W' }).building('rock', 49, 38, { lot: 'W' }).building('rock', 12, 35, { lot: 'W' });

  // -- The mansion on its walled terrace, the garden gone to grass -------------
  p.draw(22, 32, [
    'BBBBBBBBPPBBBBBBBB',
    'B.......PP.......B',
    'B.......PP.......B',
    'B.......PP.......B',
    'B.......PP.......B',
    'B.......PP.......B',
    'BPPPPPPPPP.......B',
    'BPPPPPPPPP.......B',
    'B.......PP.......B',
    'B.......PP.......B',
    'BBBBBBBBPPBBBBBBBB',
  ]);
  // The mansion stands west of the street through its gates, facing south over
  // its forecourt; the garden east of the street has gone to grass.
  p.building('pokemon-mansion', 23, 33, { lot: 'P' });
  p.bedRows([33, 34, 37], [34, 33, 38], [35, 33, 38], [36, 34, 38], [37, 34, 37], [40, 23, 28], [41, 23, 27]);

  // -- The shingle under the west cliff, where the trail comes round ----------
  p.draw(2, 39, ['~~~~~~', '~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', '~~~~~~~', '~~~~~']);
  p.block(0, 38, 2, 2, 'C').block(0, 42, 2, 8, 'C');

  // -- The Low Water Stair: a landing at the foot of the high street ----------
  p.draw(26, 56, [' PPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', ' PPPPPPPP', '   PPPP', '    PP', '    PP', '    PW']);

  const file = districtFile(GREYSTONE_VALE, 'sunken-quarter', p, {
    // Without the fishers' boat the west cove under Gull Strand's cliffs is
    // past the hunter's blind window from every way out (`hunterFlee.test.ts`).
    exits: [{ x: 46, y: 4, name: "Fishers' Boat", opens: { when: 'always' } }],
    dropIns: [{ x: 37, y: 14, name: 'Old Quay', description: 'The quay of the drowned port, where the jetty from the strand comes in.' }],
    itemSpots: [{ x: 36, y: 35, hidden: true }, { x: 3, y: 40 }, { x: 33, y: 58 }, { x: 53, y: 28 }],
    extra: {
      // Behind the keeper's barricades, a place of its own: the drowned town,
      // the mansion on its terrace and the stair. Its own name is what keeps
      // what is only found there (`BUILT_IN_FILE_PRIZES`) behind the
      // barricades rather than anywhere on the quay.
      districts: [{ name: 'THE DROWNED TOWN', x: 10, y: 31, width: 54, height: 33, wildlife: 'shore' }],
      signs: [{ x: 32, y: 26, lines: ['THE SUNKEN QUARTER', 'The old high street. Mind the tide.'] }],
      // A Slowpoke asleep on the old west quay, and a Krabby at the east end
      // of the high street where the sea comes in.
      pokemon: [
        { x: 10, y: 20, species: 'slowpoke' },
        { x: 53, y: 14, species: 'krabby' },
      ],
      people: [
        {
          x: 24,
          y: 19,
          name: 'Flood Warden',
          look: 'sailor',
          facing: 'down',
          lines: ['The sea came over the wall and never went home.', 'The sandbags hold the lower streets. Most days.'],
        },
        {
          x: 47,
          y: 23,
          name: 'Harbourmaster',
          look: 'captain',
          facing: 'down',
          lines: ['The sea took the lower town in one winter.', 'At low water you can walk the old streets to the stair.'],
        },
      ],
      // The keeper's two doors: across the high street where it leaves the
      // lower street, the boatswain standing on the town's side of his
      // sandbags; and across the drowned street where it leaves the shingle.
      doors: [
        { kind: 'boss', keeper: KEEPER, name: 'Street Barricade', x: 30, y: 30, width: 2, height: 1 },
        { kind: 'boss', keeper: KEEPER, name: 'Shingle Barricade', x: 11, y: 46, width: 1, height: 2 },
      ],
      trainers: [
        {
          x: 30,
          y: 48,
          name: 'Diver Coral',
          team: 'netter',
          look: 'swimmer-woman',
          facing: 'up',
          sight: 3,
          lines: ['I dive the mansion cellars. Finders keepers!'],
        },
      ],
    },
  });
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The boss who holds the quarter's doors, by the id `trainers.ts` gives him. */
export const KEEPER = 'vale-quay-keeper';
