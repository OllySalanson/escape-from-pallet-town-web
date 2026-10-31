/**
 * THE CROSSING, where the vale's river is crossed.
 *
 * The one idea: the river splits the vale, and there are two ways over it,
 * each a different walk. The road from Millbrook comes over the stone bridge
 * into BRIDGE END, the one street on the river, where the roads for the peaks,
 * Tanglewood and the strand all part. Below the bridge the river opens into the
 * Wide Water, where the herons stand; a lane down the west bank takes the
 * stepping stones at its foot and goes on east through the trees, a way nobody
 * signs.
 *
 * It is drawn as FireRed draws a route, and as High Moor learned to: a valley
 * about twenty tiles wide between walls of wood, with the river and the road
 * winding down it round the things in their way. A wide-open valley read to
 * blind judges as "an open field with roads along its edges".
 *
 * Filled on 31 October 2026, the second ring out from Mill Square. Every screen
 * of the valley belongs to somebody now: the masons' yard where the stone comes
 * down from the peaks, the anglers' stage, Bridge End with the Coach and Ponyta
 * and the market that meets the carts, the drovers' rest and the bee garden on
 * the Tanglewood road, the heron walk on the Wide Water, the eel weir on the west
 * bank and the charcoal burners on the road nobody signs.
 *
 * What five rounds of blind judging taught it: a river drawn straight reads as a
 * canal and one drawn in big square bends reads as "a staircase of rectangles",
 * but one that steps in and out in short jogs reads as a river; a pale square of
 * FireRed's shallow water in it reads as a mistake, so there is no ford; and
 * roads ruled across the map meeting at right angles read as a diagram.
 *
 * The bridge and the stepping stones are stone laid over the water: no bridge
 * on the FireRed sheet spans a river from west to east.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { INN_ROOM, withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/** Where the wood stands, a letter a lattice cell: T wood, . cleared. */
const OUTLINE = [
  'TTTTTTTTTTTTTTTTTTTTTTT.TTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTT.TTTTTTTT',
  'TTTTTTTTTTTT.............TTTTTTT',
  'TTTTTTTTTTTT...............TTTTT',
  'TTTTTTTTTTTT................TTTT',
  'TTTTTTTTTTTT................TTTT',
  'TTTTTTTTTTT.................TTTT',
  'TTTTTTTTTTT...............TTTTTT',
  'TTTTTTTTTTT.............TTTTTTTT',
  'TTTTTTTTTT............TTTTTTTTTT',
  'TTTTTTTTTT............TTTTTTTTTT',
  'TTTTTTTTTT.............TTTTTTTTT',
  'TT......TT..............TTTTTTTT',
  'TT......TT.................TTTTT',
  'T.......T...................TTTT',
  '..............................TT',
  '................................',
  'T.......TT.....................T',
  'T.....TTTT.....................T',
  'T.......TT.....................T',
  'TT......TT.....................T',
  'TTTTTTT.TT...................TTT',
  'TTTTT.....TT...............TTTTT',
  'TTTTT.....TT..........TTTTTTTTTT',
  'TTTTTTTT..TT..............TTTTTT',
  'TTTTTTTT..TT...............TTTTT',
  'TTTTTTTT.................TTTTTTT',
  'TTTTTTTTTTTTTTTT.........TTTTTTT',
  'TTTTTTTTTTTTTTTT.TT........TTTTT',
  'TTTTTTTTTTTTTTTT.TT.......TTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTT.TTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTT.TTTTTTTT',
];

export function theCrossing(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'the-crossing');
  p.cells(OUTLINE);

  /** A broadleaf with thicket under its crown, so nobody stands hidden under one. */
  const tree = (x: number, y: number, kind: 'tree' | 'tree-2' = 'tree') => {
    p.building(kind, x, y);
    p.block(x, y, 3, 1, '#');
  };
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The peaks' cliff, stepping back along the west bank -----------------------------
  p.rock(18, 4, 10, 6).rock(18, 10, 6, 6).rock(18, 16, 4, 8);

  // -- The river: one long bend west under the cliff, out under the bridge, --------
  // -- into the Wide Water in the corner of the wood, and one reach on down. --------
  p.river([[28, 0], [28, 10], [24, 10], [24, 34]], { width: 4 });
  p.blob(27, 39, 6.5, 4.2, 'W'); // the Wide Water
  p.river([[28, 42], [28, 63]], { width: 4 });

  // -- Tall grass on the banks, in beds -----------------------------------------------
  p.bedRows([15, 28, 32], [16, 28, 33], [17, 28, 33], [18, 29, 33], [19, 29, 32], [20, 30, 32]);
  p.bedRows([16, 22, 23], [17, 22, 23], [18, 22, 23], [19, 22, 23], [20, 22, 23], [21, 22, 23]);
  p.bedRows([45, 22, 25], [46, 22, 26], [47, 22, 26], [48, 22, 26], [49, 23, 26]);
  p.bedRows([44, 33, 37], [45, 33, 37], [46, 32, 37], [47, 32, 37], [48, 33, 37], [49, 33, 36]);
  p.bedRows([4, 32, 37], [5, 32, 37], [6, 32, 36], [7, 33, 36]);
  p.bedRows([42, 41, 44], [43, 41, 45], [44, 42, 45], [45, 42, 44]);
  p.bedRows([8, 50, 54], [9, 49, 55], [10, 50, 54]);
  p.bedRows([36, 56, 60], [37, 55, 60], [38, 56, 59]);
  p.bedRows([25, 42, 46], [26, 42, 47]);

  // -- The stone yard: where the peaks' quarry comes down to a cart -----------------------
  p.building('shed', 44, 8);
  p.block(45, 12, 2, 2, ',');
  stand('round-boulder', 50, 6);
  stand('rock', 49, 12 - 1);
  stand('rock', 50, 12);
  stand('rock', 52, 12);
  stand('gym-statue', 41, 10);
  stand('strange-stone', 42, 13);
  stand('crate-pair', 54, 7);
  stand('sack', 53, 10);

  // -- The anglers' stage: planks out over the river, under their hut --------------------
  p.road([[26, 13], [31, 13]], { letter: '_' });
  stand('hut', 32, 9);
  stand('barrel', 35, 10);
  stand('mooring-post', 26, 11, 'W');
  p.flowers([36, 9]);
  tree(34, 12, 'tree-2');

  // -- BRIDGE END: the street on the river, where the roads part --------------------------
  // The inn and the keeper's on the north of it, the market and the carters' store
  // on the south, and the whole of it laid in stone because everything comes through.
  p.building('warden-house', 30, 23);
  p.building('grey-house', 42, 24);
  p.block(29, 28, 22, 8, 'M');
  p.block(32, 36, 3, 2, 'M');
  stand('stone-fountain', 39, 29 - 1 + 1 + 3 - 3);
  stand('market-stall', 29, 33);
  stand('market-stall', 45, 33);
  stand('produce', 32, 34);
  stand('crate-pair', 49, 28);
  stand('barrels', 36, 34);
  stand('sack', 43, 34);
  stand('sack', 44, 28);
  stand('planter', 37, 28);
  stand('planter', 41, 28);
  stand('town-map', 46, 28);
  p.flowers([28, 23], [36, 25], [36, 26], [47, 26], [48, 25]);
  p.flowers([40, 37], [50, 37]);
  tree(40, 21, 'tree-2');

  // -- The drovers' rest, on the Tanglewood road ----------------------------------------------
  p.yard(52, 22, 10, 8, { gates: [[56, 29]], inner: '.' });
  stand('crate-stack', 53, 23);
  stand('sack', 56, 23);
  stand('sack', 57, 23);
  stand('barrel', 60, 23);
  tree(56, 25);

  // -- The bee garden, south of the road ---------------------------------------------------------
  p.yard(46, 38, 12, 8, { gates: [[50, 38]], inner: '.' });
  p.flowers([48, 40], [50, 41], [52, 40], [54, 41], [48, 43], [50, 44], [53, 43], [55, 44], [56, 40], [47, 42]);
  stand('hut', 51, 42);
  stand('tall-bush', 55, 40);
  stand('tall-bush', 49, 40);
  p.put(55, 40, '#').put(49, 40, '#');
  stand('pot-plant', 48, 44);

  // -- The heron walk: planks out over the Wide Water, from the road --------------------------------
  p.road([[28, 38], [36, 38]], { letter: '_' });
  stand('mooring-post', 30, 36, 'W');
  stand('wet-rock', 24, 36, 'W');
  stand('wet-rock', 24, 41, 'W');
  stand('water-lily', 27, 41, 'W');
  stand('water-lily', 23, 39, 'W');
  stand('water-lily', 30, 41, 'W');
  stand('water-lily', 26, 36, 'W');
  stand('bench', 35, 40);
  p.flowers([36, 41], [32, 42]);

  // -- The stepping stones, and the heron hide in a clearing at their east end ----------
  p.block(28, 52, 4, 2, 'M');
  p.building('shed', 34, 54);
  p.flowers([33, 57], [38, 56], [39, 57]);
  p.meadow(34, 58, 4, 2);
  p.wood(38, 58, 4, 2).wood(40, 50, 2, 6).wood(42, 56, 2, 2);

  // -- The eel weir, on the west bank below the Wide Water ---------------------------------------------
  p.meadow(18, 44, 10, 8);
  stand('hut', 19, 45);
  stand('barrels', 22, 44);
  stand('log', 18, 50);
  for (const x of [28, 29, 30, 31]) stand('mooring-post', x, 47, 'W');

  // -- The charcoal burners, on the road nobody signs ---------------------------------------------------
  p.meadow(44, 44, 16, 8).meadow(44, 54, 16, 6);
  stand('shed', 52, 47);
  stand('big-stump', 47, 47);
  stand('log', 45, 50 - 1);
  stand('log', 57, 50);
  p.bedRows([46, 44, 46], [47, 44, 45]);
  stand('dead-stump', 58, 47);
  stand('stump', 49, 50);
  p.bedRows([55, 53, 57], [56, 52, 58], [57, 53, 58]);
  stand('big-stump', 47, 56);
  stand('crate-pair', 50, 55);
  stand('log', 48, 58);

  // -- The West Bank: the road in from Millbrook comes out of the trees to a place ---
  // A carter's yard on the north of the road, a rest for the horses on the south,
  // and a clearing on the lane down to the stones where somebody cuts the withies.
  p.wood(4, 24, 2, 2).wood(12, 38, 2, 2);
  p.building('shed', 7, 24);
  p.building('crate-stack', 12, 25).building('barrels', 12, 27).building('sack', 11, 28);
  p.flowers([6, 28], [5, 29]);
  p.building('log', 7, 35).building('stump', 6, 37);
  p.fenceLine([[10, 35], [13, 35], [13, 37]]);
  p.flowers([4, 36], [11, 38]);
  p.meadow(10, 42, 6, 6);
  p.bed(10, 44, 4, 4, { round: false });
  p.building('big-stump', 14, 42);

  // -- Roads and paths, drawn last so nothing cuts them -------------------------------
  p.road([[46, 0], [46, 6], [38, 6], [38, 16], [36, 16], [36, 27]], { width: 3 }); // down from the peaks, round their rock
  p.road([[0, 30], [20, 30]], { width: 3 }); // in from Millbrook to the bridge...
  p.road([[51, 32], [62, 32]], { width: 3 }); // ...through Bridge End, on to Tanglewood
  p.road([[38, 36], [38, 48], [46, 48], [46, 62]], { width: 3 }); // along the Wide Water and south to the strand
  p.road([[32, 52], [61, 52]]); // over the stones, past the hide, and away east through the trees
  p.road([[35, 54], [35, 54]]); // the hide's door
  p.trail([[16, 33], [16, 52], [27, 52]]); // a lane through the wood to the stepping stones
  p.block(23, 30, 6, 3, 'M'); // the bridge, joined to the street
  p.road([[56, 29], [56, 31]], { letter: ',' }); // the drovers' gate, on to the road
  p.road([[50, 35], [50, 37]], { letter: ',' }); // the bee garden's

  const file = districtFile(GREYSTONE_VALE, 'the-crossing', p, {
    dropIns: [{ x: 40, y: 56, name: 'Stepping Stones', description: 'By the heron hide at the foot of The Crossing, over the stepping stones from the west bank.' }],
    itemSpots: [
      { x: 34, y: 8 },
      { x: 41, y: 40 },
      { x: 24, y: 50, hidden: true },
      { x: 15, y: 45, hidden: true },
      { x: 52, y: 6, hidden: true },
      { x: 60, y: 28, hidden: true },
      { x: 47, y: 44, hidden: true },
      { x: 59, y: 56 },
    ],
    extra: {
      districts: [
        { name: 'THE STONE YARD', x: 40, y: 4, width: 16, height: 12, wildlife: 'wetland' },
        { name: 'THE ANGLERS’ STAGE', x: 26, y: 8, width: 12, height: 8, wildlife: 'wetland' },
        { name: 'BRIDGE END', x: 29, y: 22, width: 23, height: 16, wildlife: 'wetland' },
        { name: 'THE DROVERS’ REST', x: 52, y: 22, width: 12, height: 13, wildlife: 'wetland' },
        { name: 'THE BEE GARDEN', x: 44, y: 36, width: 16, height: 10, wildlife: 'wetland' },
        { name: 'THE WIDE WATER', x: 22, y: 34, width: 18, height: 10, wildlife: 'wetland' },
        { name: 'THE EEL WEIR', x: 18, y: 44, width: 10, height: 8, wildlife: 'wetland' },
        { name: 'THE BURNERS’ ROAD', x: 44, y: 46, width: 20, height: 14, wildlife: 'wetland' },
        { name: 'THE WEST BANK', x: 2, y: 24, width: 16, height: 24, wildlife: 'wetland' },
      ],
      signs: [
        { x: 22, y: 29, lines: ['THE CROSSING', 'Over the bridge: Bridge End. Tanglewood east, the peaks north, the strand south.'] },
        { x: 41, y: 35, lines: ['North: GREYSTONE PEAKS', 'East: TANGLEWOOD. South: GULL STRAND.'] },
        { x: 2, y: 32, lines: ['THE CROSSING', 'West: Millbrook and the Mill Square.'] },
        { x: 15, y: 29, lines: ['THE WEST BANK', 'Bridge ahead. Carters give way to nobody. Do not stand behind the Ponyta.'] },
        { x: 46, y: 58 - 1, lines: ['The road south', 'Down to Gull Strand and the sea.'] },
        { x: 35, y: 28, lines: ['THE COACH AND PONYTA', 'Hot food. Warm beds. Do not ask about the coach.'] },
        { x: 41, y: 14, lines: ['THE STONE YARD', 'Grey Stone cut to order. Statues by arrangement. Please do not sit on the statue. It is not finished.'] },
        { x: 33, y: 13, lines: ['THE ANGLERS’ STAGE', 'Members only. Membership is free. Fish are extra.'] },
        { x: 52, y: 37, lines: ['THE BEE GARDEN', 'Nothing here will sting you if you are polite. Be polite.'] },
        { x: 37, y: 37, lines: ['HERON WALK', 'Please keep to the boards. The herons will not. They have been told.'] },
        { x: 44, y: 51, lines: ['Nothing signposted', 'If you can read this you have gone wrong, or right. The burners do not mind.'] },
      ],
      pokemon: [
        // The carters' yard and the horses' rest, as they were.
        { x: 12, y: 37, species: 'ponyta', level: 8, beat: { everyMs: 2700, roam: [[0, -1]] } },
        { x: 5, y: 27, species: 'rattata', level: 5, beat: { everyMs: 1500, roam: [[0, -1]] } },
        // The river's own: a Poliwag under the cliff, a Slowpoke above the stage.
        { x: 23, y: 25, species: 'poliwag', beat: { everyMs: 2100, roam: [[0, -1]] } },
        { x: 33, y: 8, species: 'slowpoke', level: 9 },
        // The stone yard's Geodude: nobody has been able to tell them apart from the stock.
        { x: 47, y: 8 + 4 + 1, species: 'geodude', level: 8 },
        { x: 54, y: 12, species: 'machop', beat: { everyMs: 1700, roam: [[1, 0], [1, -1]] } },
        { x: 39, y: 9, species: 'spearow', level: 8 },
        // Bridge End's Pidgey, after what falls off the carts, and a cat with a good living.
        { x: 43, y: 31, species: 'pidgey', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 37, y: 32, species: 'pidgey', beat: { everyMs: 1600, roam: [[0, -1]] } },
        { x: 47, y: 30, species: 'meowth', beat: { everyMs: 2000, roam: [[0, 1]] } },
        // The drovers' rest: the herd, off duty.
        { x: 54, y: 26, species: 'tauros', beat: { everyMs: 2800, roam: [[0, 1]] } },
        { x: 60, y: 26, species: 'ponyta', beat: { everyMs: 2200, roam: [[0, 1]] } },
        { x: 58, y: 28, species: 'doduo', level: 8, beat: { everyMs: 1500, roam: [[-1, 0]] } },
        // The bees.
        { x: 48, y: 41, species: 'beedrill', beat: { everyMs: 1100, roam: [[0, 1]] } },
        { x: 54, y: 43, species: 'weedle', level: 6, beat: { everyMs: 2100, roam: [[0, -1]] } },
        { x: 56, y: 42, species: 'beedrill', level: 12 },
        // The Wide Water.
        { x: 33, y: 43, species: 'psyduck', level: 8 },
        { x: 36, y: 44 - 2 + 1, species: 'farfetchd', beat: { everyMs: 2400, roam: [[0, 1]] } },
        // The weir, and the burners' Vulpix, who is not helping.
        { x: 25, y: 46, species: 'poliwag', level: 7, beat: { everyMs: 1800, roam: [[-1, 0]] } },
        { x: 54, y: 55, species: 'vulpix', beat: { everyMs: 2000, roam: [[1, 0]] } },
        { x: 56, y: 58, species: 'rattata', level: 7 },
      ],
      people: [
        // -- The West Bank ------------------------------------------------------------
        { x: 9, y: 29, name: 'Carter', look: 'heavy-man', facing: 'down', lines: ['Everything Millbrook sells comes over that bridge, and I have carried all of it.', 'My back would like a word with the people who built a village on the wrong side of a river.'], beat: { everyMs: 3300, roam: [[1, 0], [2, 0]], glances: ['right'] }, calls: ['Mind your backs!'] },
        { x: 8, y: 37, name: 'Ostler', look: 'straw-hat', facing: 'right', lines: ['That Ponyta bites. No, it does not. It burns. I do not know why I said bites.'], beat: { everyMs: 3500, glances: ['up', 'down'] }, calls: ['Steady! Steady there!'] },
        { x: 14, y: 46, name: 'Withy Cutter', look: 'old-woman', facing: 'up', lines: ['Baskets, hurdles, the odd eel trap. It all comes out of this bed.', 'Your lane there runs down to the stones. Keep your feet.'], beat: { everyMs: 2900, glances: ['left'] }, calls: ['Baskets! Good baskets!'] },
        // -- The stone yard --------------------------------------------------------------
        { x: 43, y: 12, name: 'Mason', look: 'worker', facing: 'left', lines: ['It was going to be the Mayor of Millbrook. Then he stopped paying.', 'Now it is nobody in particular. It is coming on very well.'], beat: { everyMs: 3300, glances: ['left', 'down'] }, calls: ['Mind the chisel!', 'Not the nose. Not again.'] },
        { x: 51, y: 9, name: 'Stone Carter', look: 'man', facing: 'down', lines: ['Up the road for stone, down the road for stone. Up, down.', 'Some of those are stones. Some of those are Geodude. They are paid the same.'], beat: { everyMs: 2900, roam: [[0, 1]], glances: ['left'] }, calls: ['Up she goes!'] },
        // -- The anglers' stage --------------------------------------------------------------
        { x: 29, y: 15, name: 'Angler', look: 'fisherman', facing: 'up', lines: ['Biggest thing in this river is the one my brother did not catch.', 'I did not catch one nearly as big. Press at the water with a rod, if you have one.'], calls: ['It was THIS big.'] },
        { x: 27, y: 13, name: 'Brother', look: 'fisherman', facing: 'left', lines: ['He told you about the fish. There was a fish. It was this big.', 'I show him this big, every year. He has never once believed it.'], calls: ['It was BIGGER.'] },
        // -- Bridge End ------------------------------------------------------------------------
        { x: 34, y: 31, name: 'Toll Keeper', look: 'gentleman', facing: 'left', lines: ['The bridge is free. It has been free for ninety years. I keep it free.', 'Somebody has to. You would be surprised how much it costs.'], beat: { everyMs: 3700, glances: ['up', 'right'] }, calls: ['Free bridge! No charge!'] },
        { x: 33, y: 36, name: 'Stall Girl', look: 'lass', facing: 'up', lines: ['Everything here came over that bridge one way, and it is going back the other.', 'It is cheaper on the way back. Nobody knows why. Do not tell them.'], beat: { everyMs: 2700, roam: [[1, 0]], glances: ['up'] }, calls: ['Fresh off the cart!'] },
        { x: 48, y: 36, name: 'Stallholder', look: 'straw-hat', facing: 'up', lines: ['Honey from the bees, stone from the peaks, eels from the marsh. And me.', 'I am the only thing here that came from nowhere.'], beat: { everyMs: 3100, roam: [[-1, 0]], glances: ['left'] }, calls: ['Honey! Lovely honey!'] },
        { x: 42, y: 32, name: 'Lad', look: 'youngster', facing: 'left', lines: ['East is Tanglewood. Everybody who goes in says it is easy.', 'Then you see them a day later coming out the other side, very quiet.'], beat: { everyMs: 1900, roam: [[0, 1]], glances: ['right', 'left'] }, calls: ['Mind the cart!'] },
        { x: 36, y: 31, name: 'Pip’s Aunt', look: 'old-woman', facing: 'right', lines: ['My nephew in Millbrook says he always wins.', 'I raced him at Christmas. He started very close.'], beat: { everyMs: 4100, glances: ['down'] }, calls: ['Nobody writes, you know.'] },
        // -- The drovers' rest ------------------------------------------------------------------
        { x: 59, y: 30, name: 'Old Drover', look: 'old-man', facing: 'up', lines: ['Sixty head from the moor to the sea and I lost but the one.', 'He is in Millbrook. He has a pound of his own now. He has done very well.'], beat: { everyMs: 3900, glances: ['left', 'up'] }, calls: ['Whoa there. Whoa.'] },
        { x: 53, y: 34 + 1, name: 'Peddler', look: 'heavy-man', facing: 'up', lines: ['East is Tanglewood. I go round it, myself.', 'Folk who leave that road come out a day later.'], beat: { everyMs: 3400, glances: ['right'] }, calls: ['Pins! Thread! Advice!'] },
        // -- The bee garden -------------------------------------------------------------------------
        { x: 52, y: 40, name: 'Beekeeper', look: 'cameraman', facing: 'down', lines: ['You tell them everything, bees. Who has married, who has died. They like to know.', 'I told them about you. They were not interested. Mind the big one.'], beat: { everyMs: 3500, roam: [[1, 0]], glances: ['down', 'left'] }, calls: ['Gently now. Gently.'] },
        // -- The Wide Water -------------------------------------------------------------------------------
        { x: 29, y: 40 - 1 + 0, name: 'Heron Man', look: 'hiker', facing: 'left', lines: ['A heron can stand still for six hours. I have timed it.', 'I timed it from here. It took six hours.'], calls: ['Hush. There it goes.'] },
        { x: 25, y: 48 + 1, name: 'Weir Keeper', look: 'bald-man', facing: 'right', lines: ['The eels come down in autumn, all at once, in the dark, off to the sea.', 'Nobody has ever seen them come back. They come back, though. Nobody knows how. Eels.'], beat: { everyMs: 3600, glances: ['up'] }, calls: ['Eels. It is always eels.'] },
        // -- The burners' road ------------------------------------------------------------------------------
        { x: 50, y: 51, name: 'Burner', look: 'worker', facing: 'left', lines: ['You keep it covered and you keep it slow. Six days and you do not sleep.', 'Then you have got charcoal, and nobody thanks you. Mind the Vulpix. It likes to help.'], beat: { everyMs: 3100, roam: [[-1, 0]], glances: ['up'] }, calls: ['Do not lift that!'] },
        { x: 45, y: 56, name: 'Burner’s Wife', look: 'worker-woman', facing: 'right', lines: ['Everything I own smells of smoke. That is why I married him. It was the smell or nothing.'], beat: { everyMs: 3800, glances: ['up'] }, calls: ['Your dinner is cold!'] },
      ],
      trainers: [
        { x: 39, y: 34 + 3, name: 'Netter Bryn', team: 'netter', look: 'fisherman', facing: 'down', sight: 0, lines: ['The bridge is my spot!', 'Let us see what you have caught.'] },
        { x: 50, y: 15 - 5, name: 'Breaker Dunn', team: 'breaker', look: 'black-belt', facing: 'left', sight: 0, lines: ['I break rocks all day. Put your Pokemon down there and let us see.'] },
        { x: 59, y: 49, name: 'Collier Osk', team: 'collier', look: 'bald-man', facing: 'left', sight: 0, lines: ['Six days I have sat up with this stack. I could do with the company!'] },
      ],
      berryTrees: [
        { x: 5, y: 38, berry: 'pecha' },
        { x: 47, y: 40, berry: 'oran' },
        { x: 55, y: 44, berry: 'aspear' },
        { x: 44, y: 22, berry: 'cheri' },
      ],
      landmarks: [
        { x: 38, y: 57, name: 'Heron Hide', kind: 'hide' },
        { x: 48, y: 44 - 1, name: 'Hive Row', kind: 'herbs' },
        { x: 49, y: 57, name: 'Charcoal Stack', kind: 'kiln' },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** Bridge End's doors, the yard's and the hide's. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(
    file,
    'crossing',
    'warden-house',
    30,
    23,
    'The Coach and Ponyta',
    [
      { x: 4, y: 2, name: 'Innkeeper', look: 'heavy-man', facing: 'down', lines: ['The coach went into the river in my grandfather’s day. The Ponyta swam out.', 'We have kept the name. We have kept the Ponyta. It has a room.'] },
      { x: 6, y: 4, name: 'Traveller', look: 'man', facing: 'left', lines: ['Six of us came over the bridge. Five of us are staying for dinner.', 'I did not ask.'] },
      { x: 7, y: 7, name: 'Pedlar’s Wife', look: 'old-woman', facing: 'right', lines: ['He is out there telling people he goes round Tanglewood.', 'He got lost in it in the spring. He was gone a week. Do not tell him I told you.'] },
    ],
    { room: INN_ROOM, itemSpots: [{ x: 0, y: 8, hidden: true }], pokemon: [{ x: 11, y: 8, species: 'ponyta' }] },
  );
  next = withInside(next, 'crossing', 'grey-house', 42, 24, 'The Toll House', [
    { x: 3, y: 3, name: 'Keeper’s Wife', look: 'woman', facing: 'down', lines: ['He has not taken a penny on that bridge in thirty years, and he is out there every day.', 'I married a very honest man. I would not recommend it.'] },
  ]);
  next = withInside(next, 'crossing', 'shed', 44, 8, 'The Masons’ Shed', [], { itemSpots: [{ x: 7, y: 5 }] });
  next = withInside(next, 'crossing', 'shed', 34, 54, 'The Heron Hide', [
    { x: 5, y: 5, name: 'Watcher', look: 'cameraman', facing: 'left', lines: ['There is a slot in the wall for looking at the herons through, and they know about it.', 'They stand just out of the slot. I have started to take it personally.'] },
  ]);
  return next;
}
