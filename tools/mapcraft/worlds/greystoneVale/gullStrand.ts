/**
 * GULL STRAND, the coast in the south of Greystone Vale.
 *
 * The one idea: sea cliffs and a strand where the river meets the sea. The
 * river comes down from The Crossing across a heath and out over the sand; the
 * road comes down beside it to the strand, where a stone jetty runs out into
 * the sea to Fisher's Jetty, the way off the map. In the west the land ends in
 * cliffs with the sea cave at their foot (the Greystone Caves' lowest mouth,
 * onto the caves' bottom floor), and the trail from
 * Reedmere crosses the river on a stone bridge on its way to the road. The
 * road for the orchards leaves east along the top of the heath.
 *
 * Stone laid over water is the bridge and the jetty, as at The Crossing; the
 * sea runs to the map's south edge, which needs no wood to seal it.
 *
 * Filled on 31 October 2026, the second ring out from Mill Square, because the
 * heath was a lawn with beds on it. It is a fishing shore now, and everything on
 * it is for the boats: the Old Light on the headland and the keeper who still
 * trims it, the rope walk, the sailors' rest, the salt pans at the river's mouth,
 * Fisher Row, the quay market and the wrackers' sand in the cove under the cliff.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import { plantCaveMouth } from '../../caves';
import type { Point } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { GREYSTONE_VALE } from './plan';

/** The land above the coast, a letter a lattice cell: T the wood, . the heath. */
const LAND = [
  'TTTTTTTTTTTTTT..TTTTTTT.TTTTTTTT',
  'TTTTTTTTTTTTTT..TTTTTTT.TTTTTTTT',
  'TTTTTTTTTT..................TTTT',
  'TTTTT........................TTT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TT..............................',
  'TT............................TT',
  '....................TT.........T',
  'TTT.................TT........TT',
  'TTT.................TT........TT',
  'TTT.TT.......................TTT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT...........................TT',
  'TTT......................TTT..TT',
  'TTT......................TTT.TTT',
  'TTT..........................TTT',
  'TTT..........................TTT',
  'TT............................TT',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
  'T..............................T',
];

export function gullStrand(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'gull-strand');
  // The sea needs no wood to seal it: free the south rim where the sea meets it.
  const rim: [number, number][] = [];
  for (let y = 46; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      const onRim = x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH;
      if (onRim && (x < 44 || x > 45)) rim.push([x, y]);
    }
  }
  p.unlock(rim);
  p.cells(LAND);
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The cliffs in the west: a band of rock with the cove under it, the
  // cliff-top path above, and stone steps cut down the face to the sand
  p.draw(2, 30, [
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCC ',
  ]);
  p.building('rock-stair', 6, 30, { lot: 'C' });

  // -- The cove under the cliffs and the strand east of the river, the sea beyond
  p.draw(0, 33, [
    '  ~~~~~~~~~~~~~~~~~~~~~~~                                       ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~                                      ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '  ~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '   ~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ',
    '     ~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ',
    '        ~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    ',
  ]);
  p.block(0, 47, 64, 17, 'W');
  p.draw(0, 45, ['WWWWW                                                     WWWWWW', 'WWWWWWWW                                               WWWWWWWWWW']);
  // The sea comes into the cove, so the sand under the cliffs is a crescent.
  p.draw(6, 39, [
    '      WWWWWW      ',
    '   WWWWWWWWWWWW   ',
    ' WWWWWWWWWWWWWWWW ',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
  ]);
  p.draw(20, 35, ['WWW', 'WWWW', ' WW']); // a tide pool left in the rocks
  // Dune grass at the back of the strand, and rocks along the tide line.
  p.bedRows([40, 34, 39], [41, 33, 40], [40, 50, 55], [41, 49, 56], [42, 50, 54]);
  // Rocks drawn up on the strand where you land, so every way you set off meets something.
  // Each stands on the sand it is drawn up on: a rock's lot defaults to grass,
  // which drew every one of them in a square of lawn on the beach.
  p.building('rock', 38, 45, { lot: '~' }).building('rock', 41, 42, { lot: '~' }).building('rock', 43, 45, { lot: '~' });
  p.building('rock', 4, 40, { lot: '~' }).building('rock', 5, 41, { lot: '~' }).building('rock', 19, 34, { lot: '~' }).building('rock', 24, 38, { lot: '~' }).building('rock', 58, 44, { lot: '~' });

  // -- The river, down from The Crossing to the sea ----------------------------
  p.river([[28, 0], [28, 10], [26, 10], [26, 26], [28, 26], [28, 48]], { width: 4 });
  p.block(26, 42, 8, 2, 'M'); // stepping stones across the river mouth, at low tide

  // -- Roads, and the trail from Reedmere over its stone bridge -----------------
  p.road([[46, 0], [46, 14], [62, 14]]); // down from The Crossing, and east to the orchards
  p.road([[46, 14], [46, 30], [42, 30], [42, 40]]); // down to the strand
  p.road([[2, 18], [22, 18]]); // in from Reedmere...
  p.block(22, 17, 10, 4, 'M'); // ...over the river on stone...
  p.road([[32, 18], [46, 18]]); // ...and on to the road
  // The jetty runs on to the Sunken Quarter: stone right to the edge, where
  // the plan's opening would lay a patch of sand halfway along it.
  p.unlock([[44, 60], [45, 60], [44, 61], [45, 61], [44, 62], [45, 62], [44, 63], [45, 63]]);
  p.block(44, 46, 2, 18, 'M'); // the jetty, out to the boats...
  p.building('ferry', 46, 52, { lot: 'W' }); // ...and the boat moored at it
  // The cliff-top path, down to the steps: it ends on the outcrop's grassy top
  // rather than running under it, where its sand met the stair's baked-in
  // grass in a hard line (the vale's playtest, B4).
  p.road([[6, 20], [6, 28]]);

  // -- The heath: grass in beds, flowers on the dry ground ---------------------
  p.bedRows([22, 8, 16], [23, 7, 17], [24, 9, 15], [24, 50, 56], [25, 49, 57], [26, 50, 55]);
  p.flowers([36, 24], [37, 25], [39, 24]);
  p.bedRows([11, 34, 41], [12, 33, 42], [13, 34, 40]);
  p.bedRows([21, 32, 40], [22, 31, 41], [23, 32, 41], [24, 33, 39], [26, 8, 20], [27, 9, 21], [28, 10, 18]);
  p.wood(54, 18, 8, 10).wood(50, 20, 4, 4); // the wood comes down the east side of the heath

  // -- The Old Light, on the headland: not lit since the boats had radios, and trimmed daily
  stand('tower', 8, 8);
  stand('cottage', 13, 11);
  p.road([[16, 14], [16, 16]], { letter: ',' });
  stand('bench', 8, 16);
  stand('barrel', 12, 14);
  p.flowers([12, 9], [18, 12], [19, 13], [11, 16]);
  // The wind trees: what grows up here, and which way it grows.
  stand('small-tree', 22, 8);
  stand('small-tree', 19, 7);
  stand('small-tree', 24, 11);
  stand('dead-stump', 21, 12);
  stand('tall-bush', 25, 13);
  p.put(25, 13, '#');

  // -- The rope walk: a long straight strip with a post every few tiles, as they are -----
  p.block(32, 6, 13, 2, ',');
  for (const x of [33, 36, 39, 42]) stand('fence-post', x, 5);
  stand('crate-pair', 45, 5);
  stand('sack', 32, 8);
  stand('sack', 34, 8);
  stand('barrel', 44, 8);

  // -- The sailors' rest, in its fence on the hill, where the sea can see it ----------------
  p.yard(49, 5, 11, 8, { gates: [[49, 9]], inner: '"' });
  stand('shrine', 54, 6);
  stand('grave', 51, 8);
  stand('grave', 53, 8);
  stand('gold-grave', 56, 8);
  stand('grave', 58, 8);
  stand('grave', 51, 10);
  stand('grave', 58, 10);
  p.put(50, 7, 'r').put(57, 11, 'r');

  // -- The salt pans, at the river's mouth: ruled on purpose, because they are --------------
  p.block(33, 30, 3, 3, 'w').block(37, 30, 4, 3, 'w').block(33, 34, 3, 3, 'w').block(37, 34, 4, 3, 'w');
  stand('sack', 41, 34);
  stand('sack', 41, 36);
  stand('sack', 36, 38);
  stand('crate-pair', 37, 38 - 1 + 0);
  stand('hut', 33, 37);
  p.flowers([44, 38], [45, 39]);

  // -- Fisher Row, along the path to the strand --------------------------------------------
  stand('blue-cottage', 44, 32);
  stand('flower-house', 56, 29);
  p.block(58, 33, 2, 1, ',');
  p.road([[47, 35], [50, 35]], { letter: ',' });
  for (const y of [36, 38]) stand('fence-post', 58, y);
  stand('barrels', 46, 37);
  stand('sack', 48, 38);

  // -- The net loft: a fisher's cottage on the heath above the strand, its garden fenced
  p.building('cottage', 50, 30);
  p.yard(49, 34, 8, 4, { gates: [[52, 34]], inner: '.' });
  p.flowers([50, 35], [51, 36], [55, 35]);
  p.road([[52, 34], [52, 40]]); // the loft's path, down to the strand

  // -- The quay market, at the foot of the jetty --------------------------------------------
  stand('market-stall', 47, 41);
  stand('produce-crate', 50, 42);
  stand('crate-stack', 46, 44 + 1);
  stand('barrels', 49, 45 - 1 + 1);
  stand('crate-pair', 55, 41);
  stand('barrel', 54, 44);
  // A stage off the jetty, for the boats that are not the ferry, and the men who fish off it.
  p.block(40, 50, 4, 3, '_');
  stand('crate-pair', 40, 50);
  stand('mooring-post', 39, 51, 'W');
  stand('mooring-post', 46, 49, 'W');
  stand('mooring-post', 43, 54, 'W');

  // -- The wrackers' sand, in the cove: everything the sea takes off the wreck ends up here ------
  stand('crate-stack', 8, 34);
  stand('barrel', 10, 36);
  stand('log', 16, 37);
  stand('lapras-doll', 22, 37 + 1);
  stand('crate-pair', 3, 38);
  stand('barrels', 20, 33 + 1);
  stand('wet-rock', 12, 42, 'W');
  stand('wet-rock', 18, 41, 'W');
  stand('wet-rock', 2, 47 - 1 + 1, 'W');

  // A nook in the west wood above the heath, where a smugglers' path goes off
  // through the trees: with The Crossing drawn its stand-in ways out are gone,
  // and without this the heath's far corner is past the hunter's blind window
  // (`hunterFlee.test.ts`).
  p.meadow(4, 8, 2, 2);

  // -- The sea cave: the Greystone Caves' lowest mouth, in the cliff foot over
  // the cove, onto the caves' bottom floor. Placed by hand: `caveMouthSpots`
  // wants grass or a path in front, and this one opens straight onto the beach.
  const mouth: Point = [13, 32];
  plantCaveMouth(p, mouth);
  const cave = greystoneCaves();

  const file = districtFile(GREYSTONE_VALE, 'gull-strand', p, {
    exits: [{ x: 4, y: 8, name: "Smugglers' Path", opens: { when: 'always' } }],
    dropIns: [{ x: 41, y: 45, name: 'The Strand', description: 'The strand where the road comes down to the sea.' }],
    itemSpots: [
      { x: 3, y: 36, hidden: true },
      { x: 56, y: 44 },
      { x: 18, y: 8 },
      { x: 15, y: 35, hidden: true },
      { x: 47, y: 9, hidden: true },
      { x: 42, y: 33 },
      { x: 42, y: 50, hidden: true },
    ],
    extra: {
      landmarks: [
        { x: 35, y: 45, name: 'River Mouth', kind: 'jetty' },
        { x: 7, y: 15, name: 'The Old Light', kind: 'mast' },
        { x: 55, y: 11, name: 'Sailors’ Rest', kind: 'grave' },
      ],
      districts: [
        { name: 'THE OLD LIGHT', x: 4, y: 6, width: 22, height: 12, wildlife: 'shore' },
        { name: 'THE ROPE WALK', x: 32, y: 4, width: 16, height: 6, wildlife: 'shore' },
        { name: 'THE SAILORS’ REST', x: 48, y: 4, width: 14, height: 10, wildlife: 'shore' },
        { name: 'THE SALT PANS', x: 32, y: 28, width: 10, height: 12, wildlife: 'shore' },
        { name: 'FISHER ROW', x: 42, y: 28, width: 20, height: 12, wildlife: 'shore' },
        { name: 'THE QUAY', x: 44, y: 40, width: 18, height: 8, wildlife: 'shore' },
        { name: 'WRACKERS’ SAND', x: 2, y: 33, width: 24, height: 13, wildlife: 'shore' },
      ],
      // The caves' floors ride in Tanglewood's file too; the stitcher takes them once.
      areas: cave.areas,
      links: [caveMouthLink(cave, 'sea', mouth), ...caveLadders(cave)],
      signs: [
        { x: 48, y: 12, lines: ['GULL STRAND', 'East: the orchards. South: the strand and the jetty.'] },
        { x: 16, y: 15 + 1 - 1 + 5, lines: ['GULL STRAND', 'West: Reedmere. East: the stone bridge. The cliff path goes down to the cove.'] },
        { x: 18, y: 16, lines: ['THE OLD LIGHT', 'Not lit since the boats got radios. Trimmed daily. Nobody has told Bertie.'] },
        { x: 40, y: 8, lines: ['THE ROPE WALK', 'Walk backwards. Keep walking. That is the whole of the trade.'] },
        { x: 48, y: 8, lines: ['THE SAILORS’ REST', 'They went out from the jetty. Some of them came back as far as this.'] },
        { x: 42, y: 29 - 1, lines: ['THE SALT PANS', 'Keep off the pans. Wade if you must. Do not lick anything.'] },
        { x: 53, y: 41, lines: ['THE QUAY', 'Fish off the boats by noon. After noon, ask the cat.'] },
        { x: 25, y: 39, lines: ['WRACKERS’ SAND', 'What the sea leaves is yours. What the sea wants back, it takes. Check the tide.'] },
      ],
      // The heath's own: a pair of Doduo on the dry ground, a Psyduck up the
      // river, and the Krabby that have the cove to themselves.
      pokemon: [
        { x: 14, y: 25, species: 'doduo', level: 9 },
        { x: 34, y: 5, species: 'psyduck', level: 8 },
        { x: 3, y: 42, species: 'krabby', level: 9 },
        { x: 8, y: 37, species: 'krabby', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 25, y: 42, species: 'krabby', beat: { everyMs: 1300, roam: [[0, 1]] } },
        { x: 24, y: 36, species: 'staryu', level: 9 },
        { x: 18, y: 36, species: 'shellder' },
        // The heath's: the Doduo on the headland, Spearow in the wind trees.
        { x: 21, y: 15, species: 'doduo', beat: { everyMs: 1700, roam: [[0, 1]] } },
        { x: 21, y: 9, species: 'spearow', beat: { everyMs: 1400, roam: [[1, 0]] } },
        // The rope walk's Mankey, who wants the end of the rope.
        { x: 38, y: 9, species: 'mankey', level: 8, beat: { everyMs: 1300, roam: [[1, 0], [2, 0]] } },
        // Nothing in the sailors' rest but a Gastly. It does not know yet.
        { x: 56, y: 10, species: 'gastly', beat: { everyMs: 2300, roam: [[0, 1]] } },
        // The salt pans' Slowpoke, and the Quay's Meowth, who knows when noon is.
        { x: 36, y: 37, species: 'slowpoke' },
        { x: 53, y: 44, species: 'meowth', beat: { everyMs: 1500, roam: [[-1, 0]] } },
        { x: 50, y: 44 - 3 + 0, species: 'pidgey', beat: { everyMs: 1100, roam: [[1, 0]] } },
        { x: 60, y: 42, species: 'shellder', level: 10 },
      ],
      berryTrees: [{ x: 23, y: 28, berry: 'rawst' }],
      people: [
        {
          x: 45,
          y: 58,
          name: 'Old Ness',
          look: 'fisherman',
          facing: 'down',
          lines: ['The boats go out from the end of the jetty.', 'There is a cave under the cliffs. The tide hides it.'],
        },
        {
          x: 17,
          y: 34,
          name: 'Beachcomber',
          look: 'old-woman',
          facing: 'down',
          lines: ['Everything the sea takes off the wreck ends up in this cove.', 'Mind the Krabby. They think it is theirs.'],
        },
        {
          x: 25,
          y: 6,
          name: 'Fisherman',
          look: 'fisherman',
          facing: 'right',
          lines: ['The Magikarp come up from the sea this far, and no further.'],
        },
        { x: 16, y: 10, name: 'Kite Flyer', look: 'little-girl', facing: 'down', lines: ['The wind off the sea takes my kite right over the cliffs!', 'That is four kites. There is a very well-off Krabby down there.'], beat: { everyMs: 1900, roam: [[1, 0], [2, 0]], glances: ['up'] }, calls: ['Up! Up! Oh, not again.'] },
        { x: 11, y: 12, name: 'Old Bertie', look: 'old-man', facing: 'left', lines: ['Lit her every night for forty years, and nobody has told me to stop.', 'They did tell me. I did not catch it. My hearing is very selective.'], beat: { everyMs: 3900, glances: ['up', 'down'] }, calls: ['Forty years!'] },
        { x: 43, y: 7, name: 'Ropemaker', look: 'worker', facing: 'left', lines: ['Forty fathoms a day, walking backwards. I have not seen where I was going since I was twelve.', 'If that Mankey has the end of it again, I am not going to know until the far post.'], beat: { everyMs: 2000, roam: [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0], [-6, 0]], glances: ['right'] }, calls: ['Mind your back. Mine, I mean.'] },
        { x: 47, y: 7, name: 'Rope Boy', look: 'youngster', facing: 'left', lines: ['I turn the wheel. He walks away. Then I turn the wheel some more. He is nearly at Pewter.'], beat: { everyMs: 3200, glances: ['left'] }, calls: ['Turn, turn, turn.'] },
        { x: 52, y: 11, name: 'Sexton', look: 'gentleman', facing: 'right', lines: ['There is nobody under most of these. The sea keeps them. These are just where to come and shout.', 'I have got a good one for you, down in the far corner. He is not dead. He owes me for the stone.'], beat: { everyMs: 4300, glances: ['down', 'right'] }, calls: ['Mind the graves.'] },
        { x: 33, y: 33, name: 'Salt Raker', look: 'straw-hat', facing: 'right', lines: ['Sea goes in, sun comes out, sea goes away, you rake what is left.', 'Everything tastes of it. My wife tastes of it. It is a very nice marriage.'], beat: { everyMs: 2800, roam: [[1, 0], [2, 0]], glances: ['up', 'down'] }, calls: ['Rake, and rake, and rake.'] },
        { x: 44, y: 37, name: 'Net Wife', look: 'woman', facing: 'right', lines: ['Every boat out of this strand has got one of my nets on it, and every net has got a hole.', 'They say I do not mend them. I say they keep finding Krabby.'], beat: { everyMs: 3100, glances: ['down'] }, calls: ['Who has had my needle?'] },
        { x: 57, y: 37, name: 'Drying Rack Dan', look: 'heavy-man', facing: 'left', lines: ['Salt, wind and three days on the rack. Then you could mend a boot with it.', 'People have. Those boots are very well thought of.'], beat: { everyMs: 3500, roam: [[0, -1]], glances: ['left'] }, calls: ['Mind the kippers!'] },
        { x: 46, y: 44, name: 'Fishwife', look: 'old-woman', facing: 'up', lines: ['Fresh in this morning. Which morning, I could not swear to.', 'If it looks back at you, that is how you know.'], beat: { everyMs: 2500, roam: [[1, 0]], glances: ['right'] }, calls: ['Fresh! Nearly!', 'Lovely bit of Magikarp!'] },
        { x: 51, y: 40, name: 'Fisher Lad', look: 'tuber-boy', facing: 'left', lines: ['I went on the boat once. Out to the end of the jetty.', 'They say past that there are islands. They say there is ice on one, and on the other a mountain on fire.', 'I think they say that to get you on the boat.'], beat: { everyMs: 2100, glances: ['down', 'right'] }, calls: ['Boat! There is a boat!'] },
        { x: 43, y: 52, name: 'Stage Angler', look: 'fisherman', facing: 'left', lines: ['Good bit of stage, this. Tide comes up through the boards at the spring.', 'Press at the water with a rod, if you have one. There is a Tentacool I am not speaking to.'], calls: ['Bite! No. Weed.'] },
        { x: 52, y: 28, name: 'Gorse Burner', look: 'hiker', facing: 'down', lines: ['Burn it back every spring or the whole heath goes to gorse.', 'It goes to gorse anyway. It is very good at it. I am quite fond of it.'], beat: { everyMs: 3600, roam: [[-1, 0]], glances: ['up', 'left'] }, calls: ['Stand back. Well. Stand.'] },
        { x: 38, y: 19, name: 'Salt Carter', look: 'man', facing: 'down', lines: ['Salt to the boats, fish to the salt, boats to the fish. I have been up and down this hill all my life.', 'I got to The Crossing once. It was all right.'], beat: { everyMs: 3000, glances: ['left', 'right'] }, calls: ['Salt! Mind your backs!'] },
        { x: 13, y: 37, name: 'Wracker', look: 'hiker', facing: 'right', lines: ['Three crates this week, and one of them full of dolls. What is it with that ship and dolls?', 'Something is under the sand by that log. I keep meaning to dig, but it might be somebody’s.'], beat: { everyMs: 3000, roam: [[0, 1]], glances: ['left', 'right'] }, calls: ['Finders keepers!'] },
        { x: 21, y: 39, name: 'Wracker’s Girl', look: 'tuber-girl', facing: 'left', lines: ['I found a boot. Then I found another boot. They are not the same boot.', 'I am going to keep looking until I find somebody with one of each.'], beat: { everyMs: 2200, glances: ['down'] }, calls: ['Found one!'] },
        { x: 20, y: 28 + 1 - 1 - 4, name: 'Courting Couple', look: 'crush-girl', facing: 'left', lines: ['You can see the whole coast from up here. Yes. That is why we come. The coast.'] },
      ],
      trainers: [
        {
          x: 52,
          y: 41,
          name: 'Raider Kit',
          team: 'raider',
          look: 'sailor',
          facing: 'left',
          sight: 0,
          lines: ['The strand is mine at low tide. Fight!'],
        },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The doors along the shore. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'strand', 'cottage', 13, 11, 'Bertie’s', [
    { x: 3, y: 4, name: 'Bertie’s Niece', look: 'lass', facing: 'down', lines: ['We have told him. We have told him in writing. He uses it to light the lamp.'] },
  ]);
  next = withInside(next, 'strand', 'cottage', 50, 30, 'Skipper’s Loft', [
    { x: 3, y: 4, name: 'Old Skipper', look: 'sailor', facing: 'down', lines: ['Forty years I fished off that strand and I have never yet seen the Mere Punt come out to sea.', 'It is a very small boat. They are very sensible.'] },
  ], { itemSpots: [{ x: 9, y: 7, hidden: true }] });
  next = withInside(next, 'strand', 'blue-cottage', 44, 32, 'Mrs Sprat’s', [
    { x: 3, y: 4, name: 'Mrs Sprat', look: 'old-woman', facing: 'down', lines: ['The lower town was my mother’s. You can see her roof, at low water, off the end of the jetty.', 'We did not sell it. It sort of went.'] },
  ]);
  return next;
}
