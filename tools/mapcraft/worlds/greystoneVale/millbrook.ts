/**
 * MILLBROOK, Greystone Vale's village and front door, where a new game lands.
 *
 * The one idea: every road starts here, and the brook runs through all of it.
 * Four roads meet at Mill Square - the Westward Road in from the west, the drove
 * road down from the moor, the road east to The Crossing and the lane south to
 * the marsh - and the brook comes out of the millpond past the mill, under the
 * two east streets and along the foot of the village to Tom's pool. You land on
 * the square on market day.
 *
 * It was redrawn on 30 October 2026 because the vale felt sparse beside the
 * harbour: a screen here held 44 kinds of tile and one figure, where a screen of
 * the harbour holds 114 and five. So the rule it is drawn to is the harbour's
 * rule. **Every screen holds a place, the place is doing something, and somebody
 * is there.** The mill has a yard with the day's sacks in it; the allotments
 * are dug and somebody is digging them; the orchard has pickers and berries you
 * can take; the lane south goes round a woodcutter's glade and the drove road
 * past a pound with a Tauros in it, where both were twenty tiles of sand between
 * ruled walls of pine. There are things to find, and the people say where:
 * Hazel's walled garden behind the Cut tree, the stones across the pool, a coin
 * purse the Square's notice board is offering a reward for.
 *
 * The hand is the harbour's too: a stone square, earth streets, broadleaves in
 * the open with the pines as the wood behind them, and a wood whose edge comes
 * in and out (`OUTLINE`) rather than a ruled frame. People and Pokemon stand on
 * open ground and walk a small beat, never in a street two tiles wide, because
 * a figure is a wall to a walk out.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { withInside, type InsideExtras } from './insides';
import { GREYSTONE_VALE } from './plan';

/**
 * Where the wood stands, a letter a lattice cell (two tiles square): T wood, .
 * cleared. Drawn first so everything else stands on it: the village's own edge
 * comes in and out, and the four roads leave it through places of their own.
 */
const OUTLINE = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT.........TTTTTTTTTTT',
  'TTTTTTTTTTTT..........TTTTTTTTTT',
  'TTTTTTTTTTTT..........TTTTTTTTTT',
  'TTTTTTT.....................TTTT',
  'TTTTTT.......................TTT',
  'TTTTT........................TTT',
  'TTTT.........................TTT',
  'TTTTT.........................TT',
  'TTTTT.........................TT',
  'TTTTT........................TTT',
  'TTTT.........................TTT',
  'TTT..........................TTT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT............................TT',
  'TT...........................TTT',
  'TTT..........................TTT',
  'TTTTT........................TTT',
  'TTTTT.......................TTTT',
  'TTTTT.......................TTTT',
  'TTTTTT......................TTTT',
  'TTTTTTT.....................TTTT',
  'TTTTTTT.....................TTTT',
  'TTTTTTTT....................TTTT',
  'TTTTTTTTTT...........T.......TTT',
  'TTTTT...T........T..TT.......TTT',
  'TTTTT...............TT.......TTT',
  'TTTTT...T........T...T.......TTT',
  'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];


export function millbrook(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'millbrook');
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

  // -- The brook, from the millpond to Tom's pool ---------------------------------
  // Straight channels and plain pools, as FireRed draws water through a town. It
  // goes in before the streets so a street crosses it on a stone slab.
  p.pond(40, 9, 14, 7);
  p.block(48, 16, 2, 28, 'W');
  p.block(34, 44, 16, 2, 'W');
  p.pond(18, 44, 18, 7);
  p.block(30, 44, 20, 2, 'W');

  // -- The streets: earth, as the harbour's keepers' row is -------------------------
  p.road([[0, 30], [5, 30]]); // the Westward Road, in through the wood...
  p.road([[6, 30], [23, 30]], { letter: ',' }); // ...and the west street to the square
  p.road([[30, 0], [30, 7]]); // the drove road, down from the moor...
  p.road([[30, 8], [30, 25]], { letter: ',' }); // ...and the north street to the square
  p.road([[38, 30], [57, 30]], { letter: ',' }); // the east street...
  p.road([[58, 30], [62, 30]]); // ...and the road on to The Crossing
  // Where a street wears out into road it does so a tile at a time: a rule across a
  // road is where somebody stopped drawing.
  p.put(30, 8, 'd').put(31, 7, ',').put(31, 6, ',');
  p.put(6, 30, 'd').put(7, 30, 'd').put(5, 31, ',');
  p.put(58, 30, ',').put(59, 30, ',').put(57, 31, 'd');
  p.road([[10, 30], [10, 17], [29, 17]], { letter: ',' }); // Old Row, behind the cottages
  p.road([[32, 22], [52, 22], [52, 29]], { letter: ',' }); // Mill Lane, past the mill
  p.road([[34, 37], [34, 42], [14, 42]], { letter: ',' }); // the south street, to the purple house...
  p.road([[36, 42], [41, 42]], { letter: ',' }); // ...and to the Mart's forecourt
  p.block(42, 40, 6, 4, ',');
  // Where a street crosses the brook it goes over on stone.
  p.block(47, 22, 4, 2, 'M').block(47, 30, 4, 2, 'M');

  // -- The lane south: over the brook, round the glade, down to the marsh ---------
  p.road([[40, 44], [40, 52], [36, 52], [36, 58], [40, 58], [40, 61]]);
  p.block(39, 44, 4, 2, 'M');

  // -- Mill Square, on market day ---------------------------------------------------
  // You land under the fountain with a planter either side and the stall below:
  // whichever way you set off, something answers within a few steps.
  p.block(24, 26, 14, 11, 'M');
  stand('round-fountain', 29, 27);
  stand('planter', 27, 32);
  stand('planter', 33, 32);
  stand('market-stall', 29, 33);
  stand('market-stall', 25, 33);
  stand('produce-crate', 28, 34);
  stand('produce', 34, 34);
  stand('sack', 37, 33);
  stand('sack', 34, 33);
  stand('crate-pair', 36, 26);
  stand('barrels', 24, 26);
  stand('sack', 26, 26);
  stand('town-map', 33, 26);
  stand('planter', 37, 28);
  stand('planter', 24, 29);

  // -- Old Row: the oldest cottages, their gardens behind them -----------------------
  p.building('grey-house', 12, 13);
  p.flowers([17, 15], [17, 16], [11, 16]);
  tree(14, 9, 'tree-2');
  p.building('house-flowers', 12, 25);
  p.building('orange-house', 19, 26);
  p.block(20, 30, 2, 1, ',');
  p.flowers([18, 28], [18, 29], [23, 28], [23, 29]);
  // Two gardens behind them: Ott's beans and the Marlows' washing green.
  p.yard(13, 20, 6, 5, { gates: [[16, 20]], inner: '.' });
  for (const x of [14, 15, 16, 17]) {
    stand('yellow-crop', x, 22);
    stand('red-crop', x, 23);
  }
  p.yard(20, 20, 9, 5, { gates: [[22, 20]], inner: '.' });
  tree(25, 21);
  p.flowers([21, 21], [21, 22], [22, 23]);

  // -- The allotments, dug, with the tool shed at their back -------------------------
  p.yard(18, 8, 10, 8, { gates: [[20, 15]], inner: '.' });
  p.building('shed', 23, 9);
  for (const x of [19, 20, 21]) {
    stand('seedlings', x, 10);
    stand('yellow-crop', x, 12);
    stand('red-crop', x, 14);
  }
  for (const x of [23, 24, 25, 26]) stand('seedlings', x, 14);

  // -- The drove road's way in: the pound, the milestone and a place to sit ----------
  p.yard(24, 3, 5, 5, { gates: [[28, 5]], inner: '.' });
  stand('bench', 34, 5);
  p.flowers([37, 3], [38, 6]);
  tree(34, 10);
  tree(36, 13, 'tree-2');
  p.flowers([33, 12], [39, 11]);

  // -- The mill, on its pond, with the race down the side of it ----------------------
  p.building('warden-house', 42, 16);
  p.block(44, 21, 2, 1, ',');
  stand('barrels', 40, 17);
  stand('sack', 40, 19);
  stand('sack', 40, 20);
  stand('jetty', 44, 9, 'W');
  stand('wet-rock', 50, 11, 'W');
  p.flowers([33, 18]);
  p.building('house-door', 34, 17);
  p.block(35, 21, 2, 1, ',');
  // The yard over the race: the grain store, and the day's sacks waiting on a cart.
  p.building('shed', 51, 16);
  p.block(52, 20, 2, 2, ',');
  stand('crate-stack', 55, 17);
  stand('sack', 50, 16);
  stand('sack', 50, 17);
  stand('barrel', 55, 20);

  // -- East of the square: the Centre, and a house on the brook ---------------------
  p.building('pokemon-center', 38, 25);
  p.building('cottage', 43, 26);
  p.block(46, 29, 2, 1, ',');
  

  // -- The east gate: the keeper's cottage, on the road to The Crossing -----------------
  p.building('grey-house', 54, 24);
  p.put(59, 24, 'o').put(59, 25, 'o').put(59, 26, 'o').put(59, 27, 'o');
  stand('fence-post', 54, 29);
  stand('fence-post', 57, 29);
  stand('fence-post', 54, 32);
  stand('fence-post', 57, 32);

  // -- Past the brook, south of the street: Mrs Lark's prize flowers --------------------
  p.building('flower-house', 51, 34);
  p.block(52, 38, 2, 1, ',');
  p.flowers([50, 38], [51, 39], [54, 38], [55, 39], [56, 35], [50, 33]);
  stand('bench', 53, 40);

  // -- The village green, under the big tree -------------------------------------------
  tree(15, 32);
  p.flowers([13, 33], [19, 32], [22, 32]);
  stand('bench', 20, 34);

  // -- South of the green: the houses on the south street -------------------------------
  p.building('purple-house', 13, 37);
  p.block(15, 41, 2, 1, ',');
  p.building('blue-house', 21, 37);
  p.block(23, 41, 2, 1, ',');
  p.flowers([19, 39], [19, 40]);
  p.building('cottage', 29, 38);
  p.block(32, 41, 2, 1, ',');
  // What the square's stalls are stocked from.
  stand('crate-pair', 37, 37);
  stand('barrel', 39, 37);
  p.building('poke-mart', 44, 36);
  p.flowers([43, 36], [43, 37], [43, 38]);
  stand('bench', 44, 33);
  tree(39, 33, 'tree-2');

  // -- The foot of the village: Tom's pool and the reeds round it ------------------------
  stand('jetty', 24, 48, 'W');
  // The island, and the stones from the jetty's end out to it.
  p.block(27, 46, 4, 3, '.');
  p.put(25, 47, 'd').put(26, 47, 'd');
  p.flowers([30, 46], [27, 48]);
  stand('wet-rock', 32, 47, 'W');
  p.bedRows([46, 15, 17], [47, 14, 17], [48, 14, 16], [49, 15, 17], [51, 19, 29], [50, 36, 38], [49, 36, 38], [48, 37, 38]);
  p.flowers([36, 46], [37, 47], [16, 45]);
  stand('bench', 31, 52);

  // -- The orchard, behind its fence, on the lane -----------------------------------------
  p.yard(44, 46, 14, 14, { gates: [[44, 49], [44, 50]], inner: '.' });
  p.block(42, 49, 2, 2, ',');
  tree(46, 47);
  tree(52, 47, 'tree-2');
  tree(46, 53, 'tree-2');
  tree(52, 54);
  stand('crate-pair', 45, 57);
  stand('produce-crate', 55, 47);
  p.flowers([50, 51], [50, 52], [56, 52], [49, 57]);

  // -- The woodcutter's glade, where the lane bends ----------------------------------------
  p.road([[28, 56], [36, 56]], { letter: ',' });
  p.building('shed', 20, 54);
  p.block(21, 58, 2, 1, ',');

  stand('log', 25, 54);
  stand('log', 25, 55);
  stand('big-stump', 30, 54);
  stand('stump', 29, 59);
  stand('stump', 31, 59);
  stand('dead-stump', 33, 54);
  stand('log', 25, 58);

  // -- Hazel's garden: a walled patch behind the glade, kept for those with a Cut --------------
  // The one way in is the Cut tree, in a gap in the wood with a bush below it.
  p.put(16, 57, 'o').put(17, 57, 'o');
  p.flowers([10, 56], [15, 57], [10, 59], [15, 59]);
  stand('bench', 11, 54);

  // -- The camp on the Westward Road ----------------------------------------------------------
  stand('log', 5, 26);
  stand('stump', 8, 27);
  stand('log', 5, 34);
  p.flowers([8, 33], [7, 35]);

  // -- A wood's edge, thinning out: bushes where it meets the open ------------------------------
  p.bushes([10, 12], [12, 12], [10, 40], [11, 37], [54, 44], [56, 44], [18, 52], [42, 52], [42, 53], [16, 52]);
  p.bushes([58, 22], [57, 21], [56, 8], [50, 8]);

  const file = districtFile(GREYSTONE_VALE, 'millbrook', p, {
    dropIns: [{ x: 30, y: 32, name: 'Mill Square', description: 'The square where every road in the vale starts, on market day.' }],
    itemSpots: [
      { x: 20, y: 13 }, // between the allotment rows
      { x: 36, y: 50 }, // by the reeds
      { x: 54, y: 21, hidden: true }, // the yard's dropped coppers
      { x: 28, y: 47, hidden: true }, // the island, over the stones
      { x: 15, y: 55, hidden: true }, // Hazel's garden, behind the Cut tree
      { x: 23, y: 50 + 8, hidden: true }, // under the woodcutter's window
    ],
    extra: {
      doors: [{ kind: 'cut-tree', x: 16, y: 56, width: 1, height: 1 }],
      signs: [
        { x: 11, y: 29, lines: ['MILLBROOK', 'Where every road in the vale starts.'] },
        { x: 37, y: 29, lines: ['MILL SQUARE', 'West: the Westward Road. North: the moor. East: The Crossing. South: Reedmere.'] },
        { x: 39, y: 47, lines: ['South to REEDMERE', 'Down the lane, past the pool and the woodcutter.'] },
        { x: 33, y: 8, lines: ['North to HIGH MOOR', 'Up the drove road, past the Grey Stones.'] },
        { x: 28, y: 26, lines: ['NOTICES', 'LOST: one coin purse, at the mill, on Tuesday. Reward. Ask nobody. They will only look for it.', 'FOR SALE: pond. Slightly used.', 'WANTED: somebody with a Cut to do Hazel’s hedge. It has been years.'] },
        { x: 51, y: 22 + 2, lines: ['MILL LANE', 'The mill is open. The miller is not, before noon.'] },
        { x: 19, y: 16, lines: ['THE ALLOTMENTS', 'Please do not eat the seedlings. This means you, Oddish.'] },
        { x: 43, y: 48, lines: ['THE ORCHARD', 'Pick what you like. Take what you can carry. The berries grow back.'] },
      ],
      people: [
        // -- The square --------------------------------------------------------
        { x: 32, y: 34, name: 'Trader', look: 'woman', facing: 'left', lines: ['Fresh from the orchards over the river. Well. Over the road.', 'The road east takes you on to The Crossing.'], beat: { everyMs: 3100, glances: ['down', 'left'] }, calls: ['Fresh apples!', 'Best in the vale!'] },
        { x: 28, y: 29, name: 'Ada', look: 'little-girl', facing: 'right', lines: ['There is a cave up in the peaks. Mum says it goes all the way to the sea.'], beat: { everyMs: 1700, roam: [[0, -1], [0, -2]], glances: ['left', 'up'] }, calls: ['Pip! Wait for me!', 'Not fair!'] },
        { x: 26, y: 28, name: 'Pip', look: 'little-boy', facing: 'right', lines: ['Race you to the fountain!', 'I always win. Ada says that does not count because I start closer.'], beat: { everyMs: 1900, roam: [[0, 1], [-1, 1]], glances: ['up'] }, calls: ['Can\u2019t catch me!', 'Race you!'] },
        { x: 27, y: 36, name: 'Old Peg', look: 'old-woman', facing: 'up', lines: ['Everything on that stall was cheaper before you got here.', 'Everything was cheaper before anybody got here.'], beat: { everyMs: 2900, roam: [[1, 0], [-1, 0]], glances: ['up', 'left'] }, calls: ['Daylight robbery.', 'How much for that?'] },
        { x: 36, y: 36, name: 'Stallholder', look: 'straw-hat', facing: 'up', lines: ['Apples from the orchard, down the lane past the brook.', 'Or pick them yourself. Everybody else does.'], beat: { everyMs: 3700, roam: [[-1, 0]], glances: ['left', 'right'] }, calls: ['Lovely carrots!', 'Turnips! Get your turnips!'] },
        // -- The mill and the lane -----------------------------------------------
        { x: 47, y: 21, name: 'Miller', look: 'worker', facing: 'down', lines: ['The pond turns the wheel all year. It would be nice if it paid as well.', 'The brook runs right through the village and comes out at Tom’s pool.'], beat: { everyMs: 2700, roam: [[-1, 0]], glances: ['left', 'up'] }, calls: ['Who left the sluice open?', 'Sacks for the Mart!'] },
        { x: 45, y: 10, name: 'Old Wick', look: 'fisherman', facing: 'down', lines: ['Nothing in this pond but Magikarp and regret.', 'Mind, if you have a rod, press at the water. It costs you nothing but time.'], calls: ['Shh. They can hear you.', 'Nearly had that one.'] },
        { x: 54, y: 20, name: 'Carter', look: 'heavy-man', facing: 'left', lines: ['I lost my purse somewhere round this yard. Do not tell the board.', 'It told everyone.'], beat: { everyMs: 3300, glances: ['up', 'down'] }, calls: ['Anyone seen my purse?'] },
        // -- Old Row ---------------------------------------------------------------
        { x: 11, y: 15, name: 'Grandpa Ott', look: 'old-man', facing: 'right', lines: ['This is the oldest cottage in the vale.', 'When I was a boy there was snow on the peaks all summer.'], beat: { everyMs: 4100, roam: [[0, -1]], glances: ['down'] }, calls: ['Snow! All summer!', 'In my day...'] },
        { x: 22, y: 11, name: 'Digger', look: 'hiker', facing: 'down', lines: ['Dig, plant, chase off the Oddish. Dig, plant, chase off the Oddish.', 'It is a living. It is not a good one.'], beat: { everyMs: 2300, roam: [[0, 1]], glances: ['left', 'right'] }, calls: ['Oi! Off my seedlings!', 'Go on, shoo!'] },
        { x: 14, y: 21, name: 'Mrs Marlow', look: 'woman', facing: 'left', lines: ['I grow beans. Ott says he grows beans. Those are not beans.'], beat: { everyMs: 3500, roam: [[0, 1]], glances: ['right'] }, calls: ['Those are NOT beans.'] },
        { x: 23, y: 21, name: 'Fern', look: 'lass', facing: 'left', lines: ['There is a garden behind the woodcutter’s, walled off by one small tree.', 'Old Hazel left it. Nobody with a Cut has been past in years.'], beat: { everyMs: 3900, roam: [[0, 1]], glances: ['up'] }, calls: ['Hazel\u2019s garden, past the logs.'] },
        // -- The green and the south street -----------------------------------------
        { x: 18, y: 35, name: 'Nan Birch', look: 'old-woman', facing: 'right', lines: ['Sit down, you look terrible.', 'Everybody who comes through here looks terrible. It is the raids.'], beat: { everyMs: 4300, glances: ['up'] }, calls: ['Sit down a minute, love.'] },
        { x: 13, y: 41, name: 'Bram', look: 'boy', facing: 'right', lines: ['My mum says never to go down to the pool on your own.', 'Tom goes down there on his own. Tom is ten.'], beat: { everyMs: 2500, roam: [[-1, 0]], glances: ['down'] }, calls: ['Tam always wins.'] },
        { x: 40, y: 37, name: 'Gardener', look: 'woman', facing: 'left', lines: ['Every Pidgey in the vale nests in my roof.', 'East of the village the road goes over the bridge at The Crossing.'], beat: { everyMs: 3000, roam: [[1, 0]], glances: ['down', 'up'] }, calls: ['Get off my roof!', 'Shoo, Pidgey!'] },
        { x: 56, y: 37, name: 'Mrs Lark', look: 'beauty', facing: 'right', lines: ['Best in show, nine years running. There is no show. I started it. I judge it.'], beat: { everyMs: 3300, roam: [[0, 1]], glances: ['down'] }, calls: ['Mind my dahlias!'] },
        // -- The ends of the village ---------------------------------------------------
        { x: 38, y: 56, name: 'Lost Walker', look: 'hiker', facing: 'right', lines: ['Is this the way to the marsh? I have been going round this tree for some time.', 'South, you say. Down the lane. Yes. Obviously.'], beat: { everyMs: 2700, glances: ['down', 'left'] }, calls: ['Is this the marsh?'] },
        { x: 37, y: 5 + 2, name: 'Drover', look: 'camper', facing: 'left', lines: ['That Tauros has walked off this moor and back four times this year.', 'Up the road, mind the ledges. They only go down.'], beat: { everyMs: 3400, roam: [[0, -1]], glances: ['down'] }, calls: ['Come back here, you lump!', 'Whoa! Whoa there!'] },
        { x: 55, y: 28, name: 'Gatekeeper', look: 'gentleman', facing: 'down', lines: ['I keep the gate. There is no gate. It is a very quiet job.', 'East: The Crossing, and the only bridge for miles.'], beat: { everyMs: 3600, glances: ['left', 'right'] }, calls: ['Mind the gate. There is none.'] },
        { x: 6, y: 28, name: 'Wayfarer', look: 'picnicker', facing: 'right', lines: ['The Westward Road goes out of the vale, if you need to go out in a hurry.', 'Most people who come through do.'], beat: { everyMs: 3800, glances: ['down'] }, calls: ['Long road out.'] },
        { x: 48, y: 51, name: 'Picker', look: 'picnicker', facing: 'up', lines: ['The berries grow back by the next raid. Do not ask me how. I just pick.'], beat: { everyMs: 2600, roam: [[1, 0], [2, 0], [3, 0]], glances: ['left'] }, calls: ['Berries! Help yourself!', 'They grow back, you know.'] },
        { x: 28, y: 58, name: 'Woodcutter', look: 'black-belt', facing: 'left', lines: ['A proper axe would clear that little tree by the garden in one go.', 'I have a blunt one and a bad back. You want a Pokemon that knows Cut.'], beat: { everyMs: 3200, roam: [[1, 0]], glances: ['up'] }, calls: ['Timber!', 'Mind your feet.'] },
        { x: 17, y: 49, name: 'Tom', look: 'youngster', facing: 'right', lines: ['The pool is full of Magikarp!', 'Nobody believes me. There is something on the island too. Mind the gaps.'], calls: ['Magikarp! Loads of them!', 'There IS something out there!'] },
      ],
      pokemon: [
        // The square's Pidgey, after what the stalls drop.
        { x: 25, y: 31, species: 'pidgey', beat: { everyMs: 1500, roam: [[1, 0], [1, 1]] } },
        { x: 35, y: 31, species: 'pidgey', beat: { everyMs: 1300, roam: [[0, 1], [-1, 1]] } },
        // A dog at the east gate and a cat in the mill yard, who say their names and nothing else.
        { x: 59, y: 28, species: 'growlithe', beat: { everyMs: 2100, roam: [[-1, 0]] } },
        { x: 51, y: 21, species: 'meowth', level: 4, beat: { everyMs: 1800, roam: [[0, -1]] } },
        // What the signs complain about.
        { x: 26, y: 13, species: 'oddish', level: 4, beat: { everyMs: 2400, roam: [[0, 1], [-1, 1]] } },
        { x: 25, y: 4, species: 'tauros', beat: { everyMs: 2800, roam: [[1, 0]] } },
        { x: 37, y: 50, species: 'psyduck', beat: { everyMs: 2500, roam: [[0, -1]] } },
        { x: 57, y: 36, species: 'butterfree', beat: { everyMs: 1600, roam: [[0, 1], [0, 2]] } },
        { x: 55, y: 51, species: 'caterpie', level: 3, beat: { everyMs: 2200, roam: [[0, 1]] } },
        { x: 29, y: 46, species: 'slowpoke' },
        { x: 12, y: 57, species: 'vulpix', level: 6 },
      ],
      berryTrees: [
        { x: 49, y: 49, berry: 'oran' },
        { x: 51, y: 52, berry: 'pecha' },
        { x: 49, y: 55, berry: 'oran' },
        { x: 56, y: 56, berry: 'cheri' },
        { x: 14, y: 58, berry: 'sitrus' },
        { x: 24, y: 21, berry: 'rawst' },
      ],
      // Two you can walk up to and fight, for anybody who stops to.
      trainers: [
        { x: 16, y: 36, name: 'Scout Tam', team: 'scout', look: 'bug-catcher', facing: 'right', sight: 0, lines: ['You look like you have got a minute. You have not. Battle me anyway!'] },
        { x: 56, y: 57, name: 'Orchardist Bea', team: 'orchardist', look: 'picnicker', facing: 'left', sight: 0, lines: ['Those are my apples, and that is my good ladder.'] },
      ],
      landmarks: [
        { x: 24, y: 13, name: 'Tool Shed', kind: 'shed' },
        { x: 23, y: 33, name: 'Village Pump', kind: 'spring' },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/**
 * What a village has that a route does not: doors that open. Each is FireRed's
 * own room for the building it is (`maker/areas.ts`), named for who keeps it,
 * with somebody at home.
 */
function withInsides(file: MapFile): MapFile {
  let next = file;
  const inside = (
    kind: MapFileOutdoorBuildingKind,
    x: number,
    y: number,
    name: string,
    people: NonNullable<MapFile['people']>,
    more: InsideExtras = {},
  ) => {
    next = withInside(next, 'millbrook', kind, x, y, name, people, more);
  };
  // The mill is a working floor, not a kitchen: FireRed's warehouse, with the
  // machine the wheel drives at the back of it and the day's grain stacked up.
  inside(
    'warden-house',
    42,
    16,
    'The Mill',
    [{ x: 8, y: 5, name: 'Miller\u2019s Boy', look: 'youngster', facing: 'left', lines: ['Mind the sacks. I have counted them. I am going to count them again.', 'The wheel has not stopped in eighty years. Nobody knows how to stop it.'] }],
    {
      room: {
        style: 'warehouse',
        width: 12,
        height: 8,
        ground: ['BBBBBBBBBBBB', 'BBBBBBBBBBBB', ...Array<string>(6).fill('PPPPPPPPPPPP')],
        buildings: [
          { kind: 'generator', x: 4, y: 0 },
          { kind: 'boxes', x: 0, y: 2 },
          { kind: 'tall-box', x: 2, y: 2 },
          { kind: 'big-crate', x: 9, y: 2 },
          { kind: 'box', x: 11, y: 5 },
          { kind: 'stool', x: 9, y: 5 },
        ],
      },
      itemSpots: [{ x: 11, y: 7, hidden: true }],
    },
  );
  inside('pokemon-center', 38, 25, 'Millbrook Center', [
    { x: 4, y: 6, name: 'Nurse', look: 'beauty', facing: 'right', lines: ['The machines are spoken for, I am afraid. There is a raid on, you know.', 'If you are hurt, the pump on the green has medicine by it. Nobody counts it.'] },
  ]);
  inside('poke-mart', 44, 36, 'Millbrook Mart', [
    { x: 2, y: 2, name: 'Clerk', look: 'boy', facing: 'down', lines: ['Sorry, nothing on the shelves till the boat comes in.', 'Professor Oak’s parcel? We sent it out by the lane. It will be lying about somewhere.'] },
  // The till comes out, so the back of the shop can be walked to and the clerk spoken to:
  // nobody here can talk across a counter, and shut off it is ground nobody can reach.
  ], { without: ['mart-till'] });
  inside('grey-house', 12, 13, 'Ott’s Cottage', [
    { x: 2, y: 3, name: 'Mrs Ott', look: 'old-woman', facing: 'down', lines: ['He told you about the snow, did he.', 'There was no snow.'] },
  ]);
  inside('shed', 20, 54, 'The Woodshed', [], { itemSpots: [{ x: 7, y: 5 }] });
  return next;
}

