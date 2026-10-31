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
 *
 * Filled on 31 October 2026, the third ring out from Mill Square. People still
 * live on the dry half and have not stopped arguing about the wet one: the fish
 * market on the Old Quay, the street of doors, the man who still pays rates on a
 * house with a Krabby in it, the boatyard, the sandbag gang, and past the keeper
 * the divers working the drowned streets, what lives in the roofs now, and the
 * old Mayor, who has not moved out.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { openingsOf, openingTiles, planLimits, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

export function sunkenQuarter(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'sunken-quarter');

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };
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
  p.building('crate-pair', 18, 14, { lot: 'P' }).building('sack', 48, 15, { lot: 'P' });

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

  // -- The fish market on the Old Quay: what still comes in, and who still buys it -----
  stand('striped-stall', 24, 12, 'P');
  stand('market-stall', 47, 12, 'P');
  stand('produce-crate', 29, 14);
  stand('barrels', 42, 14);
  stand('mooring-post', 36, 12);
  stand('mooring-post', 15, 13);

  // -- The upper street's gardens, kept up as if nothing had happened ---------------------
  p.flowers([26, 21], [33, 21], [40, 21], [44, 18], [50, 20]);
  stand('pot-plant', 19, 18);
  stand('bench', 27, 18);
  stand('notice-board', 33, 20);
  stand('barrel', 41, 19);

  // -- The sandbag gang, where the lower street stops being a street ------------------------
  stand('sack', 26, 27);
  stand('sack', 25, 27);
  stand('sack', 32, 27);
  stand('sack', 33, 27);

  // -- The boatyard, at its one dry corner ---------------------------------------------------
  stand('mooring-post', 55, 30);

  // -- The drowned town: posts where the boats tie up, and the roofs' new tenants ------------
  stand('mooring-post', 28, 44);
  stand('mooring-post', 45, 48);
  stand('wet-rock', 44, 34);
  stand('wet-rock', 16, 37);
  stand('water-lily', 18, 36);
  stand('water-lily', 41, 37);
  stand('water-lily', 21, 48);
  stand('gravestone-worn', 25, 39);
  p.flowers([36, 41], [24, 34], [25, 36], [27, 37]);
  stand('barrels', 33, 56);
  stand('bench', 26, 57);

  const file = districtFile(GREYSTONE_VALE, 'sunken-quarter', p, {
    // Without the fishers' boat the west cove under Gull Strand's cliffs is
    // past the hunter's blind window from every way out (`hunterFlee.test.ts`).
    exits: [{ x: 46, y: 4, name: "Fishers' Boat", opens: { when: 'always' } }],
    dropIns: [{ x: 37, y: 14, name: 'Old Quay', description: 'The quay of the drowned port, where the jetty from the strand comes in.' }],
    itemSpots: [
      { x: 36, y: 35, hidden: true },
      { x: 3, y: 40 },
      { x: 33, y: 58 },
      { x: 53, y: 28 },
      { x: 12, y: 16, hidden: true },
      { x: 47, y: 16 },
    ],
    extra: {
      // Behind the keeper's barricades, a place of its own: the drowned town,
      // the mansion on its terrace and the stair. Its own name is what keeps
      // what is only found there (`BUILT_IN_FILE_PRIZES`) behind the
      // barricades rather than anywhere on the quay.
      districts: [
        { name: 'THE DROWNED TOWN', x: 10, y: 31, width: 54, height: 33, wildlife: 'shore' },
        { name: 'THE OLD QUAY', x: 14, y: 12, width: 40, height: 4, wildlife: 'shore' },
        { name: 'THE BOATYARD', x: 48, y: 24, width: 6, height: 7, wildlife: 'shore' },
      ],
      signs: [
        { x: 32, y: 26, lines: ['THE SUNKEN QUARTER', 'The old high street. Mind the tide.'] },
        { x: 29, y: 16, lines: ['THE OLD QUAY', 'Fish, when there is fish. The jetty north goes to Gull Strand. Boat steps at its elbow.'] },
        { x: 33, y: 19, lines: ['NOTICE', 'Rates are still due on all properties, wet or dry. By order. Yours, the Borough.'] },
        { x: 16, y: 23, lines: ['UPPER STREET', 'Formerly Middle Street. Before that, Hill Street. The sea has been very good for the view.'] },
        { x: 47, y: 25, lines: ['THE BOATYARD', 'Repairs to anything that floats. Everything else we can only sympathise with.'] },
        { x: 32, y: 47, lines: ['MARKET STREET', 'Market on Thursdays. Bring a boat.'] },
        { x: 28, y: 56, lines: ['LOW WATER', 'Stair to the sea, a minute and a half after the tide turns. Do not wait for the second turn.'] },
      ],
      // A Slowpoke asleep on the old west quay, a Krabby at the east end of the
      // high street where the sea comes in, and what has moved in since.
      pokemon: [
        { x: 10, y: 20, species: 'slowpoke' },
        { x: 53, y: 14, species: 'krabby' },
        { x: 31, y: 14, species: 'meowth', beat: { everyMs: 1900, roam: [[1, 0]] } },
        { x: 38, y: 15, species: 'pidgey', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 26, y: 19, species: 'rattata' },
        { x: 44, y: 20, species: 'pidgey', level: 7 },
        { x: 48, y: 28, species: 'krabby', level: 9 },
        { x: 34, y: 40, species: 'krabby', level: 12 },
        { x: 28, y: 39, species: 'slowpoke', level: 14 },
        { x: 28, y: 41, species: 'shellder', level: 12 },
        { x: 20, y: 47, species: 'krabby', beat: { everyMs: 1200, roam: [[1, 0]] } },
        { x: 41, y: 46, species: 'psyduck', beat: { everyMs: 2400, roam: [[-1, 0]] } },
        { x: 4, y: 45, species: 'staryu', level: 11 },
        { x: 22, y: 55, species: 'shellder', beat: { everyMs: 2100, roam: [[1, 0]] } },
        { x: 34, y: 59, species: 'krabby', level: 11 },
      ],
      berryTrees: [{ x: 35, y: 41, berry: 'oran' }],
      people: [
        { x: 24, y: 19, name: 'Flood Warden', look: 'sailor', facing: 'down', lines: ['The sea came over the wall and never went home.', 'The sandbags hold the lower streets. Most days.'], beat: { everyMs: 3600, glances: ['down', 'right'] }, calls: ['Mind your feet down there!'] },
        { x: 47, y: 23, name: 'Harbourmaster', look: 'captain', facing: 'down', lines: ['The sea took the lower town in one winter.', 'At low water you can walk the old streets to the stair.'], beat: { everyMs: 3900, glances: ['down', 'left'] }, calls: ['High water at four.'] },
        // -- The Old Quay -----------------------------------------------------------------
        { x: 26, y: 16, name: 'Fish Wife', look: 'old-woman', facing: 'up', lines: ['Same pitch as my mother and hers. It was forty yards inland in her day.', 'The fish are fresher now. They just swim up.'], beat: { everyMs: 2900, glances: ['up', 'right'] }, calls: ['Fresh off the street!'] },
        { x: 38, y: 13, name: 'Quay Porter', look: 'heavy-man', facing: 'right', lines: ['Boats still come. They tie up to what used to be the Town Hall, and I carry it over.', 'North is the jetty and Gull Strand. Fishers go out from the elbow if you need off quick.'], beat: { everyMs: 3100, roam: [[1, 0]], glances: ['right'] }, calls: ['Mind your backs!'] },
        { x: 20, y: 13, name: 'Young Angler', look: 'tuber-boy', facing: 'left', lines: ['Grandad says I am fishing in his bedroom.', 'I have caught a slipper.'], beat: { everyMs: 2000, glances: ['left', 'up'] }, calls: ['Got another slipper!'] },
        // -- The upper street -----------------------------------------------------------------
        { x: 18, y: 20, name: 'Mr Ledger', look: 'gentleman', facing: 'right', lines: ['I still pay rates on Number Nine, Market Street.', 'It has a Krabby in it. I have written to the Krabby.'], beat: { everyMs: 3800, glances: ['down', 'left'] }, calls: ['It is the principle!'] },
        { x: 39, y: 21, name: 'Mrs Tide', look: 'woman', facing: 'down', lines: ['We moved up a street. Then we moved up another. There is one more street.', 'Then there is the hill. I have my eye on the hill.'], beat: { everyMs: 3200, glances: ['down', 'left'] }, calls: ['One more street, I said.'] },
        { x: 28, y: 21, name: 'Old Salt', look: 'old-man', facing: 'right', lines: ['Sit here on a quiet night and you can hear the church bell, under the water, ringing the hours.', 'It is wrong by twenty minutes. It always was.'], calls: ['Hear that? Ten past.'] },
        // -- The sandbag gang ---------------------------------------------------------------------
        { x: 28, y: 26, name: 'Sandbagger', look: 'worker', facing: 'down', lines: ['Bag, stack, bag, stack. Boatswain Cragg says nobody goes down past him without a fight.', 'He means it kindly. He has seen what is down there. He wants it for himself.'], beat: { everyMs: 2800, roam: [[-1, 0]], glances: ['down'] }, calls: ['Another bag here!'] },
        { x: 33, y: 26, name: 'Sand Boy', look: 'youngster', facing: 'left', lines: ['My job is to fetch the sand. It comes from the beach. The beach is what the sea left.', 'So I am giving it back, really. I do not think it notices.'], beat: { everyMs: 1900, glances: ['down', 'left'] }, calls: ['Sand! Coming through!'] },
        // -- The boatyard ----------------------------------------------------------------------------
        { x: 53, y: 26, name: 'Shipwright', look: 'bald-man', facing: 'left', lines: ['Ten years ago I had one boat a month. Now every house on the street wants one.', 'I did very well out of the flood. Do not repeat that.'], beat: { everyMs: 3000, glances: ['left', 'down'] }, calls: ['Tar! Who has the tar?'] },
        // -- The drowned town, past the keeper --------------------------------------------------------
        { x: 25, y: 41, name: 'The Old Mayor', look: 'rich-boy', facing: 'down', lines: ['This is the Mayor’s residence. I am the Mayor. I have not resigned.', 'The sea has not filed the proper forms. Until it does, I live here.'], beat: { everyMs: 4400, glances: ['down', 'right'] }, calls: ['Do you have an appointment?'] },
        { x: 37, y: 47, name: 'Diver Ames', look: 'swimmer', facing: 'left', lines: ['The cellars are all there. You just need a good breath and no sense.', 'Coral got the good bottles. I have got a very nice doorknob.'], beat: { everyMs: 2600, roam: [[1, 0]], glances: ['down'] }, calls: ['Going down!'] },
        { x: 18, y: 55, name: 'Salvage Woman', look: 'worker-woman', facing: 'right', lines: ['The bottom street was the good end. Look at the state of that roof. Lovely slates.', 'I have been selling them back to the top street. They have no idea.'], beat: { everyMs: 3300, roam: [[-1, 0]], glances: ['right'] }, calls: ['Mind my slates!'] },
        { x: 32, y: 59, name: 'Stair Keeper', look: 'fisherman', facing: 'down', lines: ['The stair only shows at low water. A minute and a half in, it starts to show.', 'People wait for it. Then they stand on the last step and look back, and it is very quiet.'], beat: { everyMs: 3700, glances: ['down', 'left'] }, calls: ['Not yet. Not yet.'] },
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
        { x: 10, y: 21, name: 'Rates Man Odd', team: 'lengthsman', look: 'clerk', facing: 'right', sight: 0, lines: ['I have a bill here for every house on this street, and one for you. Settle up!'] },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The dry half's doors, and who has not left. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'quarter', 'cottage', 45, 19, 'The Harbour Office', [
    { x: 3, y: 3, name: 'Clerk of Tides', look: 'clerk', facing: 'down', lines: ['High water, low water, high water. Three hundred years in these ledgers.', 'There is a gap of one night, marked: see outside.'] },
  ], { itemSpots: [{ x: 1, y: 6, hidden: true }] });
  next = withInside(next, 'quarter', 'grey-house', 34, 18, 'The Tide House', [
    { x: 3, y: 3, name: 'Old Mrs Dunn', look: 'old-woman', facing: 'down', lines: ['My husband went down to check the cellar.', 'I keep his dinner in the oven. It is a very good oven.'] },
  ]);
  next = withInside(next, 'quarter', 'shed', 49, 24, 'The Shipwright’s', [], { itemSpots: [{ x: 7, y: 5 }] });
  return next;
}

/** The boss who holds the quarter's doors, by the id `trainers.ts` gives him. */
export const KEEPER = 'vale-quay-keeper';
