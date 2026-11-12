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
 * Filled on 31 October 2026, the third ring out from Mill Square. What was thirty
 * screens of the same pines is a wood people have got lost in for a long time,
 * and every fork comes out at the result. MISLAID in the middle is a hamlet of
 * people who took one turn off the road, with a pub called The Way Out; round it
 * the mushroom ring, the picnic that went too far, the shrine and the pilgrims who
 * came to ask it the way, the cavers' camp, the halfway stone, a hermit who sells
 * directions, the butterfly ride, the Old Oak (no relation), the forester's lodge,
 * the broken cart on the Eastern Track and the windfalls where the farm's apple
 * trees went wild.
 *
 * And since 9 November 2026 Fuchsia Gym stands at the wood's east end, beside
 * the Eastern Track where it goes on into the Safari Marsh: Koga's, who holds
 * every way into THE MARSH (`world/valeQuarters.ts`). Its hall is open from the
 * first raid, with his two trainers in it; he stands at its head only for a
 * holder of Misty's CASCADE BADGE.
 *
 * FireRed draws no broadleaf mass - its broadleaf stands alone, and planted
 * shoulder to shoulder it reads as an orchard - so the wood is FireRed's own
 * forest conifer, as Viridian Forest is, with the broadleaves standing in the
 * glades. Drawn a letter a lattice cell (`MapProgram.cells`), with detail tile
 * by tile on top.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import { caveMouthSpots, plantCaveMouth } from '../../caves';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { caveLife } from './caveLife';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { INN_ROOM, withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/** The wood, a letter a lattice cell: T pines, . lanes and glades, g tall grass, d the road, C rock. */
const WOOD = [
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTT...TTTTTTTTTTTTTTTTT',
  'TT......TgT.....TTTTTTTTTTTTTTTT',
  'TT.........ggg.........TTTTTTTTT',
  'TT......TTTTTTT........TTTTTTTTT',
  'TT......TTTTTTT........TCCCCCCTT',
  'TTTTgTTTTTTTTTT........TCCCCCCTT',
  'TTTTgTTTTTTTTTT........TCCCCCCTT',
  'TTTTgTTTTTTTTTT........TCCCCCCTT',
  'TTTT.....TTTTTT.....TTT.......TT',
  'TTTT.....TTTTTT.TTT...........TT',
  'TTTT.....TTTTTTgT........T...TTT',
  'TTTT.....TTTTTTgT............TTT',
  'TTTT.....TTTTTTgT........TTT.TTT',
  'TTTT.TTT.TTT....T........TTTgTTT',
  'TTT..TTT.TTT.TTTTT.....TTTTTgTTT',
  'ddddddTT.TTT.TTTTTTTdTTTTTTTgTTT',
  'T....dTT.TTTddddddddddTT....gTTT',
  'T....dT..TTTdTTT.....dTT.....TTT',
  'T....ddddddddTTT.....dTT.....T.T',
  'T.....TTT.TTT....TTTTddddddddddd',
  'T.....TTT.TTT....TTTTTTTT.....TT',
  'TTTTTTTTT.TTT......TTTTTT.....TT',
  'TTTTTTTTT.TTTTTTTT.TTTTTT.....TT',
  'TTTT.ggg..ggggg....TTTTTT.TTTTTT',
  'TTTT.TTT...........TT........TTT',
  '.....TTT..........gTT........TTT',
  'T.........TTTTTTTTgTT........TTT',
  'T.......TTTTTT..............TTTT',
  'T.......TTTTTT........TTTTTTTTTT',
  'T.......TTTTTT........TTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTT',
];

export function tanglewood(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'tanglewood');
  p.cells(WOOD);

  /** A broadleaf with thicket under its crown, so nobody stands hidden under one. */
  const tree = (x: number, y: number, kind: 'tree' | 'tree-2' = 'tree') => {
    p.building(kind, x, y);
    p.block(x, y, 3, 1, '#');
  };
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The shrine: a statue on ground worn bare round it, in a glade the wood
  // closes round, the stones of its ring fallen, one broadleaf leaning over it
  p.draw(38, 22, [' dddddd ', 'dddddddd', 'dddddddd', ' dddddd ']);
  p.building('shrine', 41, 22, { lot: 'd' });
  p.building('rock', 48, 26).building('rock', 49, 26).building('rock', 48, 27); // fallen together
  tree(34, 25);
  p.road([[40, 26], [40, 32]]); // the one spur off the road that goes somewhere
  p.bedRows([27, 43, 47], [28, 44, 47]);
  // What is left of the ring, and what the pilgrims have added to it.
  // The statues stand at the worn ground's corners, off the path to the caves.
  stand('grave-statue', 38, 22);
  stand('grave-statue', 45, 22);
  stand('strange-stone', 44, 22, 'd');
  stand('gravestone-worn', 36, 22);
  stand('pot', 43, 23);
  stand('pot', 40, 23);
  p.flowers([37, 26], [47, 25], [36, 28], [50, 29], [38, 29], [46, 29]);
  tree(49, 21, 'tree-2');

  // -- Where three lanes meet in the north-west: a pool, and a berry tree by it.
  // The pool lies against the wood, so nobody walks round it a tile wide.
  p.draw(11, 18, ['  WWWWW', ' WWWWWW', 'WWWWWWW', ' WWWWWW']);
  stand('water-lily', 14, 21, 'W');
  stand('water-lily', 12, 20, 'W');

  // -- The woodmen's stand, where the road comes in: the wood's edge is worked ------------
  // Stacked either side of the way down from the road to the shed, which is
  // kept two wide all the way to its door.
  p.building('big-stump', 2, 34);
  p.building('stump', 4, 35);
  p.building('log', 2, 36);
  p.building('crate-pair', 8, 36);
  p.flowers([7, 35]);
  p.building('shed', 2, 38);
  // The saw pit is beside the road where it turns, its log rolled off below it.
  p.block(8, 40, 3, 2, ','); // the saw pit
  stand('log', 8, 42);
  stand('sack', 11, 42);
  stand('barrel', 11, 40);
  // -- The picnic ground, on the west glade: as far in as most people mean to come --------
  // Spread on the grass between the pond and the way across the glade's foot,
  // so the lane down its west side and the way across stay clear.
  p.building('bench', 10, 22);
  p.flowers([9, 24], [14, 22], [16, 23], [9, 26], [16, 26]);
  stand('produce-crate', 11, 24);
  stand('sack', 13, 25);

  // -- The mushroom ring, up the long north lane: stay out of the middle ------------------
  p.building('hut', 5, 4);
  // The ring stands in the glade's south-east, so the lane from the east runs
  // past it to the hut and the way down rather than through the middle of it.
  for (const [x, y] of [[13, 8], [14, 9], [14, 10], [13, 11], [12, 11], [11, 10], [11, 9]] as const) {
    stand(x % 2 === 0 ? 'dead-stump' : 'stump', x, y);
  }
  p.flowers([5, 9], [6, 10], [12, 5], [13, 4], [8, 4]);

  // -- The lost picnic, at the top of the deer path ----------------------------------------
  stand('bench', 24, 4);
  stand('sack', 29, 3);
  p.flowers([25, 3], [30, 5], [23, 5]);

  // -- MISLAID: a hamlet of people who took one turn off the road --------------------------
  // The Way Out is the pub. Everybody has heard the joke, and everybody tells it.
  // The pub stands against the wood behind it, so there is no alley behind it a
  // tile wide, and its front is three rows deep.
  p.building('warden-house', 32, 6);
  p.building('cottage', 39, 9);
  // The hut and the cottage stand back off the lane in from the south, so it
  // runs straight up to the street two wide, with a way through between them.
  p.building('hut', 32, 14);
  p.building('cottage', 36, 14);
  p.yard(41, 14, 5, 4, { gates: [[43, 14], [44, 14]], inner: ',' });
  stand('yellow-crop', 42, 15);
  stand('yellow-crop', 44, 15);
  stand('seedlings', 42, 16);
  stand('red-crop', 44, 16);
  p.road([[30, 12], [44, 12]], { letter: ',' });
  // The well, which they dug the week they stopped looking, stands beside the
  // pub, so the way up from the street past the cottage is two wide and turns
  // into the yard behind it.
  stand('fountain', 38, 6);
  stand('notice-board', 39, 8);
  stand('pot-plant', 38, 8);
  p.flowers([41, 6], [43, 8], [35, 18], [30, 19], [31, 17]);

  // -- The way underground: the Greystone Caves open at the outcrop's foot -----
  const mouth = caveMouthSpots(p, { x: 50, y: 14, width: 8, height: 6 })[0];
  if (!mouth) throw new Error('the outcrop has no foot for a cave mouth');
  plantCaveMouth(p, mouth);
  // A worn path from the shrine to the mouth: the shrine's keepers went in.
  p.road([[44, 26], [46, 26], [46, 18], [mouth[0] - 1, 18]]);
  // The cavers' camp, in front of it: everything going in is roped up here
  // first. The two rows to the mouth, the two along the camp's foot and the
  // two down its east side to the lane south are kept clear.
  stand('hut', 54, 20);
  stand('crate-stack', 58, 18);
  stand('barrels', 58, 20);
  stand('crate-pair', 52, 22);
  stand('banner', 52, 20);
  p.flowers([57, 22]);
  const cave = greystoneCaves();
  // Who and what is down there, floor by floor (`caveLife.ts`).
  const life = caveLife();

  // -- Fuchsia Gym, in a clearing on the Eastern Track: Koga's, who holds THE
  // MARSH (`world/valeQuarters.ts`). The guard and the notice stand in the
  // pocket at the wood's edge, where the track goes on to his barred road.
  p.building('fuchsia-gym', 49, 34);
  p.block(52, 39, 1, 1, ','); // the gym's doorstep, off the track
  p.flowers([48, 38], [56, 39]);

  // -- The halfway stone, a wide place in the road -----------------------------------------
  stand('round-boulder', 37, 36);
  stand('bench', 34, 37);
  stand('sack', 40, 38);
  stand('barrel', 41, 36);
  p.flowers([34, 36], [39, 39]);

  // -- The hermit, who knows the way and charges for it ---------------------------------------
  stand('hut', 27, 41);
  stand('log', 26, 40); // above the hut, not across the way in from the halfway stone
  stand('stump', 26, 45);
  p.flowers([26, 41], [29, 45]);

  // -- The broken cart, on the Eastern Track: stopped to ask the way, eleven days ago --------
  // Spilled against the wood, so the way down past it to the Old Oak is clear.
  stand('crate-stack', 53, 42);
  stand('crate-pair', 55, 42);
  stand('produce', 55, 46);
  stand('barrels', 58, 42);
  stand('sack', 52, 42);
  stand('log', 52, 46);
  p.bedRows([46, 59, 59], [47, 59, 59]);

  // -- The butterfly ride, the long glade the bug catchers keep mown --------------------------
  p.bedRows([50, 22, 28], [51, 21, 29], [52, 22, 27]);
  // The club hut opens onto a mown yard of its own, not the ride's last row.
  stand('hut', 16, 50);
  p.flowers([20, 50], [19, 52], [31, 52], [33, 50], [35, 51], [30, 50], [34, 53], [20, 53]);

  // -- The Old Oak, where the lanes of the south-east give out ---------------------------------
  // The oaks stand either side of the way down from the cart, so it runs
  // straight on to the windfalls; the bench is under the west one.
  tree(46, 51);
  tree(55, 50, 'tree-2');
  tree(55, 53);
  stand('bench', 46, 54);
  stand('big-stump', 44, 54);
  p.flowers([44, 52], [56, 51], [44, 54], [53, 55], [47, 56]);

  // -- The forester's lodge, just in from the burners' road --------------------------------------
  p.building('timber-house', 9, 54);
  // Stacked along the glade's west side, so the way in down the lodge's own
  // wall to its door, and the three rows in front of it, are open.
  stand('log', 2, 55);
  stand('crate-pair', 2, 56);
  stand('big-stump', 4, 56);
  p.flowers([7, 58], [2, 54], [14, 59]);

  // -- The windfalls, where the farm's apple trees got out --------------------------------------
  tree(30, 57);
  tree(39, 58, 'tree-2');
  tree(32, 59);
  stand('crate-pair', 42, 60);
  p.flowers([29, 60], [36, 56], [39, 61], [34, 56], [42, 56]);

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
      { x: 50, y: 20 },
      { x: 31, y: 44, hidden: true },
      { x: 59, y: 45, hidden: true },
      { x: 7, y: 8, hidden: true },
      ...cave.secrets,
      ...life.itemSpots,
    ],
    extra: {
      districts: [
        { name: 'MISLAID', x: 30, y: 8, width: 16, height: 10, wildlife: 'woodland' },
        { name: 'THE MUSHROOM RING', x: 4, y: 4, width: 12, height: 8, wildlife: 'woodland' },
        { name: 'THE LOST PICNIC', x: 22, y: 2, width: 10, height: 6, wildlife: 'woodland' },
        { name: 'THE PICNIC GROUND', x: 8, y: 18, width: 10, height: 12, wildlife: 'woodland' },
        { name: 'THE WOODMEN’S STAND', x: 0, y: 32, width: 12, height: 12, wildlife: 'woodland' },
        { name: 'THE SHRINE GLADE', x: 34, y: 22, width: 18, height: 10, wildlife: 'woodland' },
        { name: 'THE CAVERS’ CAMP', x: 46, y: 18, width: 14, height: 8, wildlife: 'woodland' },
        { name: 'THE HALFWAY STONE', x: 32, y: 36, width: 10, height: 4, wildlife: 'woodland' },
        { name: 'THE HERMIT’S GLADE', x: 26, y: 40, width: 8, height: 6, wildlife: 'woodland' },
        { name: 'THE BROKEN CART', x: 50, y: 42, width: 10, height: 6, wildlife: 'woodland' },
        { name: 'THE BUTTERFLY RIDE', x: 16, y: 48, width: 20, height: 6, wildlife: 'woodland' },
        { name: 'THE OLD OAK', x: 42, y: 50, width: 16, height: 8, wildlife: 'woodland' },
        { name: 'THE FORESTER’S LODGE', x: 2, y: 54, width: 14, height: 6, wildlife: 'woodland' },
        { name: 'THE WINDFALLS', x: 28, y: 56, width: 16, height: 6, wildlife: 'woodland' },
        ...life.districts,
      ],
      landmarks: [
        { x: 42, y: 27, name: 'Ruined Shrine', kind: 'shrine' },
        { x: 4, y: 11, name: 'Drying Rack', kind: 'herbs' },
        ...life.landmarks,
      ],
      people: [
        // -- The woodmen's stand -------------------------------------------------------------
        { x: 5, y: 34, name: 'Woodman', look: 'black-belt', facing: 'down', lines: ['We only cut the edge. Nobody who went in to cut the middle has sent any wood back.', 'Keep to the road. I know everybody says it. Keep to it anyway.'], beat: { everyMs: 3200, roam: [[0, 1]], glances: ['down', 'right'] }, calls: ['Timber! Sort of.'] },
        { x: 9, y: 35, name: 'Young Woodman', look: 'boy', facing: 'left', lines: ['There was a deer path here somewhere, just off the road. It comes out at a gap.', 'If you ever need to leave in a hurry. Which you will. People do.'], beat: { everyMs: 2500, glances: ['up', 'down'] }, calls: ['Mind your head!'] },
        { x: 9, y: 41, name: 'Sawyer', look: 'worker', facing: 'up', lines: ['One man on top of the log, one man down the pit. I am the man down the pit.', 'You get a lot of sawdust and a very low opinion of the man on top.'], beat: { everyMs: 2800, glances: ['up', 'left'] }, calls: ['Pull! No, YOU pull!'] },
        // -- The picnic ground ----------------------------------------------------------------
        { x: 13, y: 23, name: 'Picnic Mum', look: 'woman', facing: 'right', lines: ['We said we would just go in as far as the pond.', 'This is as far as the pond. Nobody is to go any further. Tim. TIM.'], beat: { everyMs: 3000, glances: ['down', 'up'] }, calls: ['Tim! Come back here!'] },
        { x: 10, y: 19, name: 'Tim', look: 'little-boy', facing: 'up', lines: ['There is a lane behind that tree that goes all the way to a statue. I saw it.', 'I saw it from a very long way away. I am not allowed.'], beat: { everyMs: 1700, roam: [[1, 0]], glances: ['up', 'left'] }, calls: ['I can see a statue!'] },
        { x: 17, y: 24, name: 'Picnic Dad', look: 'man', facing: 'left', lines: ['I know exactly where we parked the cart.', 'It is just a question of which way we were facing when I knew it.'], calls: ['It is this way. Probably.'] },
        // -- The mushroom ring ----------------------------------------------------------------
        { x: 7, y: 9, name: 'Mushroom Woman', look: 'old-woman', facing: 'right', lines: ['Every lane in this wood is the same lane. I have been picking along it for sixty years.', 'Do not stand in the ring. Paras lives there, and it thinks it owns the place. It does.'], beat: { everyMs: 3700, glances: ['left', 'right'] }, calls: ['Not that one. Not that one.'] },
        // -- The lost picnic ------------------------------------------------------------------
        // The secret's clue (`world/secrets.ts`, THE LOST PICNIC): what keeps him
        // here comes and stands by his bench after dark.
        { x: 27, y: 4, name: 'Lost Picnicker', look: 'picnicker', facing: 'down', secret: 'the-lost-picnic', lines: ['I took one turn off the road for a picnic spot.', 'That was this morning.', 'Something stands by the bench after DARK, swinging a weight on a string. I always nod off before I see it.'], calls: ['Is it still today?'] },
        // -- Mislaid -----------------------------------------------------------------------------
        { x: 37, y: 11, name: 'Old Founder', look: 'old-man', facing: 'down', lines: ['I took one turn off the road in the year of the big snow. So did she, and him.', 'We put up a hut for the night. That was the hut.', 'Mislaid. Population fourteen. Founded by accident, and nobody has apologised.'], beat: { everyMs: 4100, glances: ['down', 'left'] }, calls: ['Fourteen! No, fifteen. Hello.'] },
        { x: 40, y: 17, name: 'Mrs Turner', look: 'woman', facing: 'left', lines: ['We are leaving in the morning. We have got it all worked out this time.', 'I have said that for nineteen years, and I have got a very nice garden out of it.'], beat: { everyMs: 3300, glances: ['up', 'left'] }, calls: ['We leave in the morning!'] },
        { x: 40, y: 6, name: 'Postman', look: 'man', facing: 'down', lines: ['I have a letter for Bridge End. It was urgent, in my father’s day.', 'I can see the smoke from there, some mornings. I wave the letter at it.'], beat: { everyMs: 2900, glances: ['left', 'right'] }, calls: ['Post! Any minute now!'] },
        { x: 45, y: 6, name: 'Dot', look: 'little-girl', facing: 'left', lines: ['I was born here. What is a road?', 'Grandad says it is like a lane that means it. I do not think he is well.'], beat: { everyMs: 1800, glances: ['down', 'left'] }, calls: ['What is a road?'] },
        { x: 43, y: 16, name: 'Gardener', look: 'straw-hat', facing: 'up', lines: ['Best soil in the vale. Nobody has ever come back to complain.'], beat: { everyMs: 3400, glances: ['left', 'right'] }, calls: ['Mind my beans.'] },
        { x: 42, y: 6, name: 'Surveyor', look: 'gentleman', facing: 'down', lines: ['I came to map this wood for the Crown, you know. Here is the map.', 'It is a very good map of here. I have not been anywhere else to compare it.'], beat: { everyMs: 3900, roam: [[1, 0]], glances: ['down', 'left'] }, calls: ['Remarkable. Remarkable.'] },
        // -- The shrine ---------------------------------------------------------------------------
        { x: 39, y: 24, name: 'Shrine Keeper', look: 'channeler', facing: 'right', lines: ['It was a shrine to something. We have lost the name of it.', 'We keep it up anyway, in case it remembers us.'], beat: { everyMs: 4300, glances: ['up', 'right'] }, calls: ['Mind the offerings.'] },
        { x: 44, y: 24, name: 'Pilgrim', look: 'old-woman', facing: 'up', lines: ['I walked three days to ask it the way home.', 'It is very good about listening. It has not said anything yet.'], beat: { everyMs: 3600, glances: ['up', 'left'] }, calls: ['Which way? Anybody?'] },
        { x: 36, y: 30, name: 'Pilgrim’s Lad', look: 'youngster', facing: 'right', lines: ['Gran says the old stones go underground, at the rock, past the camp.', 'She says the keepers used to go in. She does not say whether they came out.'], beat: { everyMs: 2200, roam: [[1, 0]], glances: ['up'] }, calls: ['Gran! There is another one!'] },
        // -- The cavers' camp ------------------------------------------------------------------------
        { x: 48, y: 21, name: 'Caver', look: 'hiker', facing: 'left', lines: ['This is the Wood Mouth. Greystone Caves, second floor, by the time you are in.', 'There is a way down from here to the sea and a way up to the quarry. We have lost two ropes finding out.'], beat: { everyMs: 3100, glances: ['left', 'up'] }, calls: ['Rope! Who has the rope?'] },
        { x: 53, y: 21, name: 'Tea Woman', look: 'worker-woman', facing: 'up', lines: ['They go in, I keep the kettle on. They come out, I count them.', 'It has never yet been the same number. I have stopped telling them.'], beat: { everyMs: 3500, glances: ['down'] }, calls: ['Tea? Before you go in?'] },
        // -- The halfway stone -------------------------------------------------------------------------
        { x: 39, y: 37, name: 'Pedlar', look: 'heavy-man', facing: 'left', lines: ['Halfway, it says. Everybody stops here and feels better about it.', 'Nobody has ever asked halfway to what. Pins?'], beat: { everyMs: 2700, glances: ['up', 'down'] }, calls: ['Pins! Thread! Directions!'] },
        // -- The hermit ------------------------------------------------------------------------------------
        { x: 29, y: 43, name: 'Hermit Bracken', look: 'bald-man', facing: 'down', lines: ['I came out here to get away from people, and I have never met so many.', 'Directions are one Potion. They are all wrong. It keeps people from coming back.'], beat: { everyMs: 4500, glances: ['left', 'right'] }, calls: ['Directions! Very reasonable!'] },
        // -- Fuchsia Gym, and the guard at Koga's bar, as FireRed's Route 23 keeps its badge gates --------
        { x: 61, y: 38, name: 'Marsh Guard', look: 'policeman', facing: 'down', lines: ['Past the bar on this track is THE MARSH, and KOGA keeps it. Only a trainer with his SOUL BADGE goes through.', 'He is in Fuchsia Gym, just there. He will not even see you without Misty’s CASCADE BADGE.'] },
        { x: 54, y: 39, name: 'Gym Fan', look: 'youngster', facing: 'up', lines: ['Koga barred every road into the Marsh himself. Nobody saw him do it. Nobody ever sees him do anything.', 'Everything in there is poison. I went in once with a Bellsprout. I came out with a very sorry Bellsprout.'], beat: { everyMs: 2600, glances: ['up', 'right'] }, calls: ['Fwahahaha! Like that.'] },
        // -- The broken cart ----------------------------------------------------------------------------------
        { x: 57, y: 43, name: 'Carter Yeo', look: 'heavy-man', facing: 'down', lines: ['Stopped to ask the way. Eleven days ago. A wheel came off while I was asking.', 'East is the Safari Marsh, if you are going. They have got a proper gate. They would.'], beat: { everyMs: 3000, glances: ['down', 'left'] }, calls: ['You got a wheel on you?'] },
        { x: 52, y: 43, name: 'Carter’s Boy', look: 'youngster', facing: 'right', lines: ['We were carrying turnips. We are carrying less turnips now.', 'Do not tell him about the Rattata. He thinks it is the damp.'], beat: { everyMs: 2100, glances: ['right', 'down'] }, calls: ['Not the turnips!'] },
        // -- The butterfly ride -------------------------------------------------------------------------------
        { x: 26, y: 51, name: 'Ned', look: 'bug-catcher', facing: 'up', lines: ['Members catch and release. That is the rule. Release is optional. That is also the rule.', 'Tam says everybody gets lost in here, and that is how he catches them. Tam is not well.'], beat: { everyMs: 2400, roam: [[1, 0]], glances: ['up'] }, calls: ['Got one! No I have not.'] },
        { x: 33, y: 50, name: 'Nell', look: 'little-girl', facing: 'left', lines: ['It was a Caterpie on Tuesday. Then it was a Metapod and it did not do anything for a week.', 'Then it was a Butterfree and it left. I cried. Do not tell Ned.'], beat: { everyMs: 1900, roam: [[0, 1]], glances: ['left'] }, calls: ['Do not squash him!'] },
        // -- The Old Oak ----------------------------------------------------------------------------------------
        { x: 54, y: 53, name: 'Woodcutter', look: 'bald-man', facing: 'right', lines: ['Lost? Every path in Tanglewood comes back to the road in the end.', 'I was sent to cut this one down. I have been working up to it for thirty years.'], beat: { everyMs: 3800, glances: ['right', 'up'] }, calls: ['Any day now.'] },
        { x: 55, y: 56, name: 'Acorn Girl', look: 'lass', facing: 'left', lines: ['Every acorn off this tree goes in the bag. In the bag, in the wood, and up comes a pine.', 'I do not know why. Nobody has ever seen another oak come up. I just keep trying.'], beat: { everyMs: 2600, roam: [[0, 1]], glances: ['left', 'up'] }, calls: ['Nobody step on that!'] },
        // -- The forester's lodge ---------------------------------------------------------------------------------
        { x: 6, y: 56, name: 'Forester', look: 'gentleman', facing: 'right', lines: ['I keep the official map of Tanglewood. Every year I go out and correct it.', 'Every year the wood has moved. Trees are not meant to do that. I have written to them.'], beat: { everyMs: 3600, glances: ['left', 'right'] }, calls: ['Stay on the marked paths!'] },
        // -- The windfalls -------------------------------------------------------------------------------------------
        { x: 35, y: 59, name: 'Picker Joss', look: 'picnicker', facing: 'right', lines: ['These got away from the farm, years back. Sour as anything.', 'Farmer Hale says they are still his. The trees have not been told. South is the Pickers’ way down.'], beat: { everyMs: 2800, glances: ['right', 'down'] }, calls: ['Windfalls! Free, and worth it.'] },
        ...life.people,
      ],
      pokemon: [
        { x: 22, y: 4, species: 'oddish' },
        // The lost picnic: a Drowzee dozes by the bench all day, the only one in
        // the vale, and after dark the Hypno it will be one day stands over it
        // (`world/secrets.ts`, THE LOST PICNIC). Both in the glade's back row,
        // off the way through to Mislaid.
        { x: 28, y: 3, species: 'drowzee', level: 10 },
        { x: 26, y: 2, species: 'hypno', level: 26, secret: 'the-lost-picnic' },
        { x: 2, y: 37, species: 'pidgey', beat: { everyMs: 1500, glances: ['right'] } },
        { x: 12, y: 24, species: 'caterpie', beat: { everyMs: 2300, roam: [[0, 1]] } },
        { x: 12, y: 10, species: 'paras', level: 8 },
        { x: 13, y: 9, species: 'paras', beat: { everyMs: 2900, roam: [[0, 1]] } },
        // Mislaid's cat, who came in with somebody, and the village's Pidgey.
        { x: 36, y: 11, species: 'meowth' },
        { x: 36, y: 17, species: 'pidgey', beat: { everyMs: 1500, roam: [[1, 0]] } },
        // The shrine's guest: it comes to the stones and nobody has said it may not.
        { x: 45, y: 30, species: 'clefairy', level: 9 },
        { x: 44, y: 31, species: 'oddish', beat: { everyMs: 3100, roam: [[1, 0]] } },
        // Under the cave mouth.
        { x: 48, y: 23, species: 'zubat', beat: { everyMs: 1200, roam: [[0, -1]] } },
        { x: 49, y: 27, species: 'geodude', level: 9 },
        { x: 38, y: 39, species: 'rattata', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 26, y: 41, species: 'venonat', beat: { everyMs: 2600, glances: ['down'] } },
        // The cart's turnips, and what has been eating them.
        { x: 59, y: 47, species: 'rattata', level: 7 },
        { x: 54, y: 47, species: 'pidgey' },
        // The north-east lane, which nobody walks.
        { x: 48, y: 34, species: 'bellsprout', level: 8 },
        // The ride.
        { x: 22, y: 50, species: 'butterfree', beat: { everyMs: 1100, roam: [[1, 0], [2, 0]] } },
        { x: 31, y: 51, species: 'metapod' },
        { x: 29, y: 50, species: 'caterpie', level: 6, beat: { everyMs: 2500, roam: [[1, 0]] } },
        { x: 21, y: 51, species: 'weedle', level: 7 },
        // The oak.
        { x: 42, y: 50, species: 'pidgeotto', level: 12 },
        { x: 45, y: 50, species: 'caterpie' },
        { x: 6, y: 57, species: 'nidoran-f', beat: { everyMs: 1900, roam: [[0, 1]] } },
        { x: 2, y: 58, species: 'rattata', level: 6 },
        { x: 38, y: 60, species: 'rattata', beat: { everyMs: 1500, roam: [[0, -1]] } },
        { x: 38, y: 58, species: 'oddish', level: 8 },
        ...life.pokemon,
      ],
      berryTrees: [
        { x: 17, y: 22, berry: 'pecha' },
        { x: 44, y: 50, berry: 'sitrus' },
        { x: 42, y: 59, berry: 'oran' },
        { x: 15, y: 4, berry: 'cheri' },
      ],
      areas: cave.areas,
      links: [caveMouthLink(cave, 'wood', mouth), ...caveLadders(cave)],
      signs: [
        { x: 15, y: 36, lines: ['TANGLEWOOD', 'East to the Eastern Track. Keep to the road.'] },
        { x: 8, y: 34, lines: ['WOODMEN’S STAND', 'Wood for The Crossing and the vale. Mind the logs. The logs do not mind you.'] },
        { x: 10, y: 24, lines: ['THE PICNIC GROUND', 'As far as the pond. No further. We mean it. We have told you now.'] },
        { x: 14, y: 8, lines: ['THE RING', 'Do not stand in it. Do not eat it. Do not ask it anything.'] },
        { x: 38, y: 10, lines: ['THE WAY OUT', 'Ales. Beds. No, it is not. We know. Everybody asks.'] },
        { x: 31, y: 5, lines: ['MISLAID', 'Pop. 14. Founded by accident. If you are looking for the road, so were we.'] },
        { x: 39, y: 31, lines: ['THE RUINED SHRINE', 'Please do not move the stones. They have been moved enough. Nobody knows by what.'] },
        { x: 48, y: 20, lines: ['THE WOOD MOUTH', 'Greystone Caves. Sign in with the tea. Sign out with the tea, if you can.'] },
        { x: 36, y: 36, lines: ['HALFWAY', 'Cut into the stone, very deep, by somebody who was sure.'] },
        { x: 30, y: 41, lines: ['DIRECTIONS', 'One Potion. All sales final. Refunds in the other direction.'] },
        { x: 55, y: 39, lines: ['THE EASTERN TRACK', 'East: Safari Marsh. West: back into all that. You have been warned.'] },
        { x: 50, y: 39, lines: ['FUCHSIA GYM', 'Leader: KOGA. The poisonous ninja master!', 'He fights holders of the CASCADE BADGE. Beat him for the SOUL BADGE and the Marsh.'] },
        // THE MARSH's notice, at the bar Koga holds (`world/valeQuarters.ts`):
        // what the quarter does to a team, said before it costs one.
        { x: 60, y: 38, lines: ['THE MARSH. Past the bar at the end of this track.', 'Touch anything in there and it poisons you back.', 'Fire and Flying never touch. Held by KOGA: SOUL BADGE.'] },
        { x: 19, y: 55, lines: ['THE BUG CLUB', 'Catch and release. Release optional. Mown on Tuesdays, by the Weedle, badly.'] },
        { x: 52, y: 50, lines: ['THE OLD OAK', 'No relation to the Professor. He has asked us to say so.'] },
        { x: 5, y: 54, lines: ['FORESTER’S LODGE', 'Official maps of Tanglewood. Correct as of the day before you bought it.'] },
        { x: 35, y: 61, lines: ['THE WINDFALLS', 'South: Orchard Terraces. The apples here belong to the farm. The apples disagree.'] },
        ...life.signs,
      ],
      trainers: [
        { x: 25, y: 51, name: 'Bug Catcher Tam', team: 'scout', look: 'bug-catcher', facing: 'up', sight: 3, lines: ['Everyone gets lost in here. That is how I catch them.'] },
        { x: 54, y: 50, name: 'Woods Ranger Ash', team: 'scout', look: 'camper', facing: 'down', sight: 0, lines: ['I walk every lane of this wood. I know exactly where I am. Let me prove it!'] },
        { x: 55, y: 23, name: 'Caver Rudge', team: 'breaker', look: 'hiker', facing: 'down', sight: 0, lines: ['I have been in deeper than anybody here! Fight me, or hold this rope.'] },
        ...life.trainers,
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The doors of Mislaid, and of the wood's few other roofs. */
function withInsides(file: MapFile): MapFile {
  // Fuchsia Gym's hall. Koga and his two trainers are authored in
  // `src/game/world/trainers.ts`, where a gym's parties are measured
  // (`quarterPuzzle.test.ts`), and stand in this room's tiles as
  // `KOGA_GYM_SPOTS` says; the Gym Guide by the mat is the file's own.
  let next = withInside(file, 'tanglewood', 'fuchsia-gym', 49, 34, 'Fuchsia Gym', [
    {
      x: 8,
      y: 10,
      name: 'Gym Guide',
      look: 'gym-guide',
      facing: 'left',
      lines: [
        'Yo! Champ in the making! KOGA holds every road into the Marsh.',
        'He only fights a trainer with Misty’s CASCADE BADGE. Until then, look around!',
        'His Pokémon poison you, float over Ground moves, and his Koffing blows itself up.',
        'A Ghost shrugs off Normal moves and most Poison. Fire and Flying never touch. Beat him for the SOUL BADGE!',
      ],
    },
  ]);
  next = withInside(
    next,
    'tanglewood',
    'warden-house',
    32,
    6,
    'The Way Out',
    [
      { x: 4, y: 2, name: 'Landlord', look: 'heavy-man', facing: 'down', lines: ['Everybody who comes in asks if this is the way out. Every one of them, and then they laugh.', 'Then they stop laughing, and then they have a drink. It is a good living.'] },
      { x: 6, y: 4, name: 'Regular', look: 'old-man', facing: 'left', lines: ['I only came in to ask the way.', 'That was before the old king died. Which old king? Exactly.'] },
      { x: 7, y: 7, name: 'Lost Salesman', look: 'gentleman', facing: 'right', lines: ['I had an appointment in Millbrook at ten.', 'I think I can still make it, if nobody stops me having this one.'] },
    ],
    { room: INN_ROOM, itemSpots: [{ x: 11, y: 8, hidden: true }], pokemon: [{ x: 9, y: 2, species: 'meowth' }] },
  );
  next = withInside(next, 'tanglewood', 'hut', 5, 4, 'The Drying Hut', [], { itemSpots: [{ x: 5, y: 3 }] });
  next = withInside(next, 'tanglewood', 'hut', 16, 50, 'The Bug Club', [
    { x: 3, y: 3, name: 'Club Secretary', look: 'bug-catcher', facing: 'down', lines: ['The club has eleven members and four hundred and six Weedle, and only the Weedle pay their dues.', 'Mostly in Poison Sting.'] },
  ]);
  next = withInside(next, 'tanglewood', 'timber-house', 9, 54, 'The Map Room', [
    { x: 9, y: 5, name: 'Forester’s Wife', look: 'old-woman', facing: 'left', lines: ['Every wall in here is the map of that wood, and no two of them agree.', 'He went out to look at the east lanes in the spring. He says it was yesterday.'] },
  ], { itemSpots: [{ x: 1, y: 6, hidden: true }] });
  return next;
}
