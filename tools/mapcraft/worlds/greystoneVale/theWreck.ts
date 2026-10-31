/**
 * THE WRECK, the east cape where the vale meets the open sea.
 *
 * The one idea: a liner has run aground on the reef off the cape, and the
 * salvage camp on the beach below the cliffs picks it over. The road from the
 * orchards runs out along the cliff top past the salvage master's house and
 * goes down a cleft in the cliffs to the beach; the camp's pier is where the
 * salvage launch puts in, a while into a raid. The reef is the only way out to
 * the wreck: a bar of sand at low water, with the cargo the sea has thrown up
 * along it. A trail comes down through the wood from the Safari Marsh.
 *
 * Drawn as the rest of the vale taught: the cliff top a framed corridor
 * between the wood and the cliff, the beach a band between the cliff and the
 * sea rather than a field of sand, rock in masses, a way down you can see from
 * either end, and FireRed's own harbour - its pier, its crates, its launch and
 * its liner - rather than another game's barrels and huts.
 *
 * Filled on 31 October 2026, the fourth ring out from Mill Square: everybody
 * has come to the wreck for something. The camp sells it off by the lot; the
 * first-class passengers are still on the beach in their good clothes, waiting
 * to be told when dinner is; the cape has sightseers, a man selling them
 * postcards, and an inn that has changed its name to suit; two men have spent
 * a week getting the ship's piano up the trail to the marsh. And the wreck can
 * be boarded now: a salvage stage on piles runs round the bow from the end of
 * the bar to a hole in her side, and the hold is still full.
 */
import type { MapFile, MapFileArea, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { INN_ROOM, withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/**
 * The wood and the cape, a letter a lattice cell: T the wood, . open ground.
 * The trail comes down from the marsh through two clearings, and the cape's
 * wood steps in and out along the road so no stretch of it is ruled.
 */
const CAPE = [
  'TTTTTTTTTT..TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTT..TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTT.....TTTTTTTTTTTTTTTTTTT',
  'TTTTTTT.......TTTTTTTTTTTTTTTTTT',
  'TTTTTTTT.......TTTTTTTTTTTTTTTTT',
  'TTTTTTTTTT......TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT.....TTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT...TTTTTTTTTTTTTTTTT',
  'TTT.....TTT......TT...........TT',
  'TTT.....TTT.......T............T',
  'TTT......T.........TTT.........T',
  'TT.................TTT...........',
  'TT..............................',
  'TT.............................T',
  '..............................TT',
  '..............................TT',
];

/** The room the hole in her side opens on: the forward hold, stacked to the deckhead. */
const HOLD: Pick<MapFileArea, 'style' | 'width' | 'height' | 'ground' | 'buildings'> = {
  style: 'warehouse',
  width: 17,
  height: 11,
  ground: ['BBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBBB', ...Array<string>(9).fill('PPPPPPPPPPPPPPPPP')],
  buildings: [
    { kind: 'big-crate', x: 0, y: 2 },
    { kind: 'boxes', x: 3, y: 2 },
    { kind: 'tall-box', x: 5, y: 2 },
    { kind: 'big-crate', x: 11, y: 2 },
    { kind: 'tall-box', x: 14, y: 2 },
    { kind: 'boxes', x: 16, y: 2 },
    { kind: 'big-crate', x: 3, y: 6 },
    { kind: 'boxes', x: 6, y: 6 },
    { kind: 'big-crate', x: 11, y: 6 },
    { kind: 'wooden-box', x: 14, y: 7 },
    { kind: 'boxes', x: 0, y: 8 },
    { kind: 'big-crate', x: 15, y: 9 },
  ],
};

export function theWreck(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'the-wreck');
  // The sea needs no wood to seal it: free the rim where the sea meets it,
  // east and south below the cliff top, and west below the beach, where it
  // runs on into the sea off the orchards.
  const rim: [number, number][] = [];
  for (let y = 34; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      const onRim =
        x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH || (x < SEAM_DEPTH && y >= 42);
      if (onRim && !(x >= p.width - SEAM_DEPTH && (y === 40 || y === 41))) rim.push([x, y]);
    }
  }
  p.unlock(rim);

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The wood and the cliff top, cut out together -----------------------------
  p.cells(CAPE);
  p.bedRows([18, 18, 21], [19, 17, 22], [20, 18, 23], [21, 19, 22]);
  p.bedRows([23, 6, 13], [24, 6, 13], [25, 6, 12], [26, 7, 11]);
  p.bedRows([26, 20, 31], [27, 20, 30]);
  p.bedRows([18, 40, 47], [19, 39, 49], [20, 40, 46]);
  // Bracken in the clearings, the whole way down the trail from the marsh.
  p.bedRows([6, 16, 18], [7, 15, 18], [8, 15, 17]);
  p.bedRows([9, 25, 28], [10, 26, 29], [11, 27, 30]);

  // -- The cliff, in masses that step in and out, cleft where the road goes down
  p.draw(6, 30, [
    '  CCCCCCCCCCCCCCCC                             CCCCCC',
    ' CCCCCCCCCCCCCCCCCCC   CCCCCCCCCCC             CCCCCC',
    'CCCCCCCCCCCCCCCCCCCC  CCCCCCCCCCCCCCCCC      CCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCC  CCCCCCCCCCCCCCCCC      CCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCC  CCCCCCCCCCCCCCCCC      CCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCC  CCCCCCCCCCCCCCCCC      CCCCCCCC',
  ]);
  p.wood(26, 32, 2, 4);
  p.wood(46, 32, 4, 4);

  // -- The beach, between the cliff and the sea: its tide line comes and goes ---
  p.block(6, 36, 52, 6, '~');
  p.block(0, 42, 64, 22, 'W').block(58, 34, 6, 8, 'W');
  p.draw(6, 36, [
    'WW',
    'WWW',
    'WW',
  ]);
  // The sea's edge, drawn: two bays and the root of the bar.
  p.draw(0, 40, [
    '      WWW',
    '      WWWWW',
    '           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '            ~~~~~~~~~~~~~~~      ~~~~~~~~~~~~~',
    '                  ~~~~~~~~~~      ~~~~~~~~~',
    '                                   ~~~~~',
  ]);
  // A tide pool on the Lido's sand, and the rocks the sea left on the beach.
  p.draw(15, 42, [' WW', 'WWW', ' WW']);
  p.draw(41, 42, ['  WW', ' WWWW', '  WW']);

  // -- The pier the salvage launch puts in at: on the flood tide it runs out to
  // Frostreef from the pier's end (The Ice Run, `plan.ts`), and the game draws
  // it moored there while it sails, so nothing stands in its water.
  p.block(50, 40, 14, 2, 'M');

  // -- The reef: a bar of sand out to the wreck, the cargo thrown up along it ---
  p.draw(20, 44, [
    '  ~~~~~~~~~~',
    '  ~~~~~~~~~~~~~',
    '    ~~~~~~~~~~~~',
    '    ~~~~~~~~~~~~',
  ]);
  p.building('ss-anne', 24, 48, { lot: 'W' }); // the wreck, aground on the reef
  stand('rock', 23, 45);
  stand('rock', 33, 47);

  // -- The salvage stage: on piles round her bow, from the bar to the hole in her side
  p.block(21, 47, 3, 8, '_');
  p.block(21, 52, 16, 3, '_');
  stand('mooring-post', 20, 49, 'W');
  stand('mooring-post', 20, 52, 'W');
  stand('mooring-post', 28, 55, 'W');
  stand('mooring-post', 33, 55, 'W');
  stand('crate-pair', 32, 52);
  stand('barrels', 35, 52);
  stand('wet-rock', 36, 48, 'W');
  stand('wet-rock', 16, 49, 'W');
  stand('wet-rock', 38, 56, 'W');
  stand('wet-rock', 12, 57, 'W');

  // -- The camp: lots laid out on the sand, the auction under its awning ---------
  stand('striped-stall', 32, 36);
  stand('sack', 38, 37);
  stand('crate-stack', 38, 38);
  stand('barrel', 32, 40);
  stand('crate-pair', 47, 38);
  stand('crate-stack', 49, 37);
  stand('barrels', 40, 36);
  stand('sack', 46, 40);
  stand('sack', 47, 37); // and one to the east of where you land, as every landing has something within four steps
  stand('log', 34, 43);
  stand('hut', 51, 36);
  stand('hut', 54, 36);
  stand('mooring-post', 52, 42, 'W');
  stand('mooring-post', 57, 42, 'W');

  // -- The Lido: the first-class passengers, in their deck chairs --------------
  stand('bench', 18, 37);
  stand('bench', 23, 37);
  stand('bench', 28, 38);
  stand('pot-plant', 22, 37);
  stand('pot-plant', 27, 37);
  stand('barrel', 14, 37);
  stand('crate-pair', 11, 37);
  stand('log', 12, 41);

  // -- The trail: two men, one piano ---------------------------------------------
  stand('crate-stack', 20, 8);
  stand('sack', 18, 6);
  stand('stump', 25, 9);
  stand('log', 27, 11);
  p.flowers([17, 8], [25, 7]);

  // -- The inn at the road, and the cape's own bench --------------------------------
  p.building('house', 15, 22);
  stand('barrels', 20, 25);
  stand('wooden-sign', 14, 26);
  p.flowers([13, 22], [13, 24], [21, 23]);

  // -- The Viewpoint: everybody up from the marsh comes to look ---------------------
  stand('market-stall', 33, 26);
  stand('bench', 38, 28);
  stand('signpost', 37, 27);
  p.flowers([41, 27], [32, 29], [43, 28]);

  // -- The salvage master's house, above the camp, and the washing -------------------
  p.building('house', 46, 23);
  p.flowers([45, 26], [51, 25], [51, 26]);
  p.yard(52, 24, 6, 4, { gates: [[52, 25]], inner: '"' });
  stand('seedlings', 54, 25);
  stand('seedlings', 55, 25);
  stand('yellow-crop', 56, 25);
  stand('yellow-crop', 54, 26);

  // -- The signal station, on the end of the cape -----------------------------------
  p.block(50, 18, 8, 6, '.');
  p.building('shed', 52, 18);
  stand('flag', 50, 20);
  stand('bench', 54, 22);
  p.flowers([57, 19], [57, 22]);

  // -- The Spearow's rocks, west along the top of the cliff --------------------------
  stand('rock', 8, 19);
  stand('rock', 12, 17);
  stand('rock', 14, 21);
  stand('round-boulder', 9, 16);
  stand('rock', 6, 28);
  stand('log', 30, 21);

  // -- Roads, drawn last so nothing cuts them -----------------------------------
  p.road([[0, 30], [12, 30], [12, 28], [32, 28], [32, 24], [44, 24], [44, 34]]); // along the cliff top, round the beds, and down the camp cleft
  p.road([[48, 27], [48, 26]]); // the house door
  p.road([[17, 26], [17, 28]]); // the inn door
  p.road([[53, 22], [53, 23]]); // the signal station's door path, and down the side of the garden
  p.road([[50, 23], [53, 23]]);
  p.road([[50, 23], [50, 25]]);
  p.trail([[20, 0], [20, 4]]);
  p.trail([[20, 4], [24, 4], [24, 16]]); // down through the wood from the Safari Marsh, by the piano

  const file = districtFile(GREYSTONE_VALE, 'the-wreck', p, {
    dropIns: [{ x: 43, y: 37, name: 'Salvage Camp', description: 'The salvage camp on the beach under the east cape, with the wreck out on the reef.' }],
    // The first is the Wreck's own: whatever a raid finds there by its place falls back on it.
    itemSpots: [
      { x: 27, y: 45 },
      { x: 34, y: 46 },
      { x: 10, y: 37, hidden: true },
      { x: 35, y: 54, hidden: true },
      { x: 14, y: 19 },
      { x: 28, y: 22, hidden: true },
    ],
    extra: {
      districts: [
        { name: 'THE CAPE ROAD', x: 12, y: 21, width: 11, height: 7, wildlife: 'shore' },
        { name: 'THE VIEWPOINT', x: 32, y: 26, width: 13, height: 6, wildlife: 'shore' },
        { name: 'THE SPEARS', x: 6, y: 16, width: 10, height: 7, wildlife: 'shore' },
        { name: 'THE SIGNAL STATION', x: 50, y: 18, width: 8, height: 6, wildlife: 'shore' },
        { name: 'THE LIDO', x: 8, y: 36, width: 22, height: 8, wildlife: 'shore' },
        { name: 'THE SALVAGE CAMP', x: 30, y: 36, width: 28, height: 8, wildlife: 'shore' },
        { name: 'THE SALVAGE STAGE', x: 20, y: 47, width: 18, height: 8, wildlife: 'shore' },
        { name: 'THE PIANO', x: 14, y: 4, width: 16, height: 9, wildlife: 'shore' },
      ],
      signs: [
        { x: 26, y: 30, lines: ['THE WRECK', 'The liner went onto the reef in the last storm. The camp is below the cliff.'] },
        { x: 46, y: 29, lines: ['THE CAPE', 'The wreck is out on the reef, past the camp. The pier is east.'] },
        { x: 54, y: 39, lines: ['THE ICE RUN', 'The launch runs out to Frostreef on the flood tide.', 'It sails from 2:00 until 4:00.'] },
        { x: 42, y: 40, lines: ['LOTS 1-40', 'Sold as seen. Some of it has been seen by the sea for some time.'] },
        { x: 38, y: 41, lines: ['LOT 41', 'Deck chairs, nine. Sea damage. Some of the sea is still in them.'] },
        { x: 30, y: 44, lines: ['THE BAR', 'Dry at low water. It has been low water for some weeks. Nobody trusts it.'] },
        { x: 25, y: 44, lines: ['SALVAGE STAGE', 'Round the bow. Mind the planks. If you fall in, you are now a lot.'] },
        { x: 27, y: 54, lines: ['HOLD', 'Forward hold through the hole, which we did not make. We did make it bigger.'] },
        { x: 16, y: 40, lines: ['FIRST CLASS ONLY', 'Passengers in other classes are asked to wait on the other beach.'] },
        { x: 21, y: 28, lines: ['THE SHIP INN', 'Formerly The Cape. Formerly The Ship. Ask about our new cutlery.'] },
        { x: 30, y: 24, lines: ['THE VIEWPOINT', 'See the wreck. There is only the one. It does not do anything.'] },
        { x: 27, y: 14, lines: ['PLEASE KEEP LEFT', 'Piano in road.'] },
      ],
      people: [
        { x: 39, y: 40, name: 'Auctioneer', look: 'gentleman', facing: 'down', lines: ['Lot forty-two, a lifeboat, one careful owner. Who will start me at something?', 'Everything must go. It has mostly gone once already.'], beat: { everyMs: 2600, glances: ['down', 'left', 'right'] }, calls: ['Who will start me?', 'Sold, to the man in the sea!'] },
        { x: 35, y: 41, name: 'Bidder', look: 'bald-man', facing: 'up', lines: ['I came for a porthole. I have bought nine, and something I was told was a chair.', 'I have no boat. I have a shed with very good views of the shed.'], beat: { everyMs: 3100, glances: ['up', 'right'] }, calls: ['Mine! Is that mine?'] },
        { x: 41, y: 41, name: 'Dealer', look: 'rich-boy', facing: 'left', lines: ['Silver, if you can find any. That is all that is worth the walk.', 'The sea took the plate. The camp took the spoons. I have a very good price on some forks.'], beat: { everyMs: 2900, glances: ['left', 'up'] } },
        { x: 48, y: 41, name: 'Salvage Hand', look: 'worker', facing: 'up', lines: ['Up from the hold on the morning tide, sorted by noon, sold by two.', 'The launch for the islands puts in at the pier a while in. Do not ask what it carries back.'], beat: { everyMs: 2700, roam: [[1, 0]], glances: ['up'] }, calls: ['Mind your backs!'] },
        { x: 52, y: 39, name: 'Tallyman', look: 'clerk', facing: 'up', lines: ['Everything off the wreck is written down in this book. It is a very honest book.', 'I keep the other one at home.'], beat: { everyMs: 3500, glances: ['up', 'left'] } },
        { x: 21, y: 39, name: 'Lady Pemberton', look: 'beauty', facing: 'down', lines: ['We were told dinner would be at eight. It is the principle of the thing.', 'One does not simply leave a ship because it has stopped working.'], beat: { everyMs: 3700, glances: ['down', 'right'] }, calls: ['Steward!'] },
        { x: 25, y: 40, name: 'Colonel Tate', look: 'gentleman', facing: 'left', lines: ['We paid until Tuesday, and I intend to have until Tuesday.', 'Splendid air. Bit of a list on the dining room.'], beat: { everyMs: 4100, glances: ['left', 'down'] }, calls: ['First sitting, is it?'] },
        { x: 29, y: 41, name: 'Steward', look: 'chef', facing: 'left', lines: ['Dinner will be slightly delayed, madam. As it was yesterday.', 'I have a tin of something, and my training.'], beat: { everyMs: 2300, roam: [[-1, 0], [-2, 0]], glances: ['left'] }, calls: ['Very good, madam.', 'Shortly, sir. Shortly.'] },
        { x: 17, y: 39, name: 'Master Pemberton', look: 'rich-boy', facing: 'down', lines: ['Mother says we are on holiday. Father is still looking for the second funnel.', 'It is the best holiday we have ever had.'], beat: { everyMs: 1900, roam: [[0, 1]], glances: ['down', 'left'] }, calls: ['Crab on the Colonel!'] },
        { x: 10, y: 39, name: 'Beachcomber', look: 'fisherman', facing: 'right', lines: ['The bar to the wreck only shows at low water.', "Whatever the sea throws up on it is anybody's."], beat: { everyMs: 3300, glances: ['right', 'down'] } },
        { x: 31, y: 53, name: 'Diver', look: 'swimmer', facing: 'left', lines: ['You can walk in now, through the side. It takes all the fun out of it.', 'I used to go down for this. I have kept the suit on, out of pride.'], beat: { everyMs: 2800, glances: ['left', 'down'] }, calls: ['Mind the plank!'] },
        { x: 24, y: 53, name: 'Second Mate', look: 'sailor', facing: 'up', lines: ['Technically this is still a ship and I am still on watch.', 'If the Captain ever comes back from that harbour, tell him she is doing very well, considering.'], beat: { everyMs: 3900, glances: ['up', 'right'] }, calls: ['All well, considering!'] },
        { x: 32, y: 30, name: 'Sightseer', look: 'woman', facing: 'down', lines: ['Is that it? It looked bigger on the postcard.', 'We have come all the way from the farm. Doreen wanted to see something go wrong.'], beat: { everyMs: 3000, glances: ['down', 'right'] }, calls: ['Is that it?'] },
        { x: 40, y: 30, name: 'Doreen', look: 'old-woman', facing: 'down', lines: ['Lovely. Lovely. You do not get wrecks like that now.', 'My mother saw the big one in the year of the eels. It had three funnels.'], beat: { everyMs: 3800, glances: ['down', 'left'] } },
        { x: 36, y: 25, name: 'Postcard Man', look: 'man', facing: 'down', lines: ['Picture of the wreck, one coin. Picture of the wreck before it was a wreck, two.', 'I had pictures of the storm but they all came out grey. I sell those as well.'], beat: { everyMs: 2500, glances: ['down', 'left'] }, calls: ['Postcards! Wish you were here!'] },
        { x: 56, y: 21, name: 'Signalman', look: 'cameraman', facing: 'down', lines: ['Ship on the reef. I log it every morning. Same ship.', 'I did signal her. I signalled YOU ARE STANDING INTO DANGER, and she signalled THANK YOU.'], beat: { everyMs: 3400, glances: ['down', 'right', 'left'] }, calls: ['Ship on the reef!'] },
        { x: 55, y: 28, name: "Salvager's Wife", look: 'woman', facing: 'left', lines: ['Ned has been out on that wreck since the tide turned.', 'If you see him, tell him his tea is cold.'], beat: { everyMs: 3100, glances: ['left', 'down'] } },
        { x: 24, y: 8, name: 'Big Stan', look: 'heavy-man', facing: 'left', lines: ['It is a piano. It is in that crate. There is a man at the marsh who will give us ten for it.', 'A week, we have been at it. Two more days, if it stops going backwards.'], beat: { everyMs: 2700, glances: ['left', 'up'] }, calls: ['To me! To you! To me!'] },
        { x: 19, y: 8, name: 'Little Stan', look: 'boy', facing: 'right', lines: ['I do the thinking. I think we should have gone by the road.', 'I said so on Monday. It was already in the wood by then.'], beat: { everyMs: 3000, glances: ['right', 'up'] }, calls: ['To you! To me! To you!'] },
        { x: 26, y: 12, name: 'Piano Tuner', look: 'poke-maniac', facing: 'left', lines: ['They sent for me at the marsh end. I said I would come out and meet it.', 'It is flat. It is flat in every way a thing can be, apart from the one they need.'], beat: { everyMs: 3600, glances: ['left', 'down'] } },
        { x: 8, y: 22, name: 'Spearow Man', look: 'bug-catcher', facing: 'up', lines: ['Sixty pairs on these rocks, every year. I count them. They come over and count me.', 'Do not wear a hat up here. Do not bring a sandwich. Do not look as though you might.'], beat: { everyMs: 2400, glances: ['up', 'right'] }, calls: ['Do not look at them!'] },
        { x: 19, y: 27, name: 'Landlady', look: 'old-woman', facing: 'left', lines: ['We did nicely out of that storm. I will not say we are pleased. I will say the roof is new.', 'The cook is off the ship. The chairs are off the ship. Do not ask about the bell.'], beat: { everyMs: 3200, glances: ['left', 'down'] }, calls: ['Rooms! Sea views!'] },
      ],
      trainers: [
        { x: 30, y: 46, name: 'Salvager Ned', team: 'raider', look: 'worker', facing: 'left', sight: 0, lines: ['This camp has first pick of the wreck!', 'You want a share, you earn it.'] },
        { x: 8, y: 26, name: 'Wrecker Bess', team: 'netter', look: 'worker-woman', facing: 'right', sight: 3, lines: ['A lantern? On a cliff? I have no idea what you mean. Give me that.'] },
      ],
      landmarks: [
        { x: 56, y: 39, name: 'Salvage Pier', kind: 'jetty' },
      ],
      berryTrees: [{ x: 29, y: 19, berry: 'chesto' }, { x: 56, y: 26, berry: 'sitrus' }],
      // The cape's own: the Spearow on their rocks, a Fearow over them all, the
      // crabs that have taken to first class, and what got out of the wreck.
      pokemon: [
        { x: 44, y: 22, species: 'fearow', level: 13 },
        { x: 11, y: 18, species: 'spearow', beat: { everyMs: 1100, roam: [[1, 0]] } },
        { x: 7, y: 21, species: 'spearow', level: 11 },
        { x: 13, y: 20, species: 'spearow', beat: { everyMs: 1300, roam: [[0, 1]] } },
        { x: 10, y: 21, species: 'spearow', beat: { everyMs: 900, roam: [[-1, 0]] } },
        { x: 26, y: 46, species: 'staryu', level: 11 },
        { x: 30, y: 37, species: 'meowth', beat: { everyMs: 2100, roam: [[1, 0]] } },
        { x: 38, y: 43, species: 'krabby', beat: { everyMs: 1200, roam: [[1, 0]] } },
        { x: 20, y: 41, species: 'krabby', level: 11, beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 9, y: 38, species: 'shellder', level: 12 },
        { x: 33, y: 45, species: 'krabby', beat: { everyMs: 1300, roam: [[-1, 0]] } },
        { x: 29, y: 54, species: 'slowpoke', level: 12 },
        { x: 18, y: 42, species: 'psyduck' },
        { x: 13, y: 43, species: 'tentacool', level: 11 },
        { x: 22, y: 7, species: 'rattata', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 27, y: 20, species: 'pidgey', beat: { everyMs: 1700, roam: [[1, 0]] } },
        { x: 45, y: 20, species: 'bellsprout' },
        { x: 42, y: 26, species: 'pidgeotto', level: 12 },
        { x: 50, y: 28, species: 'rattata', level: 11, beat: { everyMs: 1500, roam: [[0, 1]] } },
        { x: 11, y: 28, species: 'oddish' },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** Her forward hold, and the inn with the ship's chairs in it. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'wreck', 'ss-anne', 24, 48, 'The Forward Hold', [
    { x: 8, y: 9, name: 'Purser', look: 'clerk', facing: 'down', lines: ['Tickets, please. All tickets to be shown. I am aware of the situation.', 'If you have no ticket you may pay the difference, and the difference is the whole ship.'] },
    { x: 13, y: 5, name: 'Stowaway', look: 'youngster', facing: 'left', lines: ['You have not seen me. I got on at the last port for a free ride to the islands.', 'It is the longest anyone has ever got away with it. I am never going home.'] },
  ], { room: HOLD, itemSpots: [{ x: 1, y: 5 }, { x: 16, y: 7, hidden: true }, { x: 9, y: 3 }], pokemon: [{ x: 7, y: 4, species: 'meowth', level: 12 }, { x: 2, y: 7, species: 'rattata' }, { x: 13, y: 9, species: 'tentacool' }] });
  next = withInside(next, 'wreck', 'house', 15, 22, 'The Ship Inn', [
    { x: 4, y: 2, name: 'Ship’s Cook', look: 'chef', facing: 'down', lines: ['I do fourteen courses or I do nothing. Tonight it is nothing, with a light sauce.'] },
    { x: 6, y: 7, name: 'Regular', look: 'old-man', facing: 'left', lines: ['This used to be a decent pub. Now it has got a chandelier and I cannot see the darts.', 'I sit in a first-class chair and I have never been so uncomfortable.'] },
  ], { room: INN_ROOM });
  return next;
}
