/**
 * ORCHARD TERRACES, the farm in the south-east of Greystone Vale.
 *
 * The one idea: the farm is cut out of the hillside wood as two framed slopes
 * down from the farmyard to the sea, and the ledges are the quick way down.
 * The terraces go down to the sands in four shelves, the farm road zig-zagging
 * past the cowman's cottage; the lane goes down past the lower orchard and
 * the cider press, turns east for The Wreck, and ends in a ledge that is the
 * quick way down to the pasture and its dew pond. The farmyard at the top
 * keeps its kitchen garden, and the north orchard stands beside it.
 *
 * Drawn as FireRed draws a route, which the open field this farm first was
 * never read as: each slope a corridor about twenty wide whose wood steps in
 * and out, each run of ledge from one of those steps to the road, tall grass
 * in whole beds, and a road that goes past places rather than round shapes.
 * A fruit tree is FireRed's broadleaf with thicket under its crown, so nobody
 * stands hidden under one.
 *
 * Filled on 31 October 2026, the third ring out from Mill Square: a farm in the
 * week of the apple harvest. The yard has hens that are Doduo, a barn, and a
 * family who have stopped counting; the pickers are up the trees in the north
 * orchard and the press is running; the cowman has a cow's name for everything;
 * the cornfield has a scarecrow nobody is sure of; there is a stall on the lane
 * with an honesty box and nobody watching it; and the shore, which was sixty
 * tiles of ruled sand, has spits and pools and cockle women and a slip for the
 * boat. The dew pond is a pond now.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { INN_ROOM, withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

export function orchardTerraces(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'orchard-terraces');
  // The sea needs no wood to seal it: free the rim along the shore.
  const rim: [number, number][] = [];
  for (let y = 52; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if (x < SEAM_DEPTH || x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH) rim.push([x, y]);
  p.unlock(rim);

  /** A fruit tree, with thicket under its crown so nobody stands hidden under one. */
  const tree = (x: number, y: number, kind: 'tree' | 'tree-2' = 'tree') => {
    p.building(kind, x, y);
    p.block(x, y, 3, 1, '#');
  };

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The farmyard, the kitchen garden and the road in from the strand --------
  p.meadow(14, 4, 26, 14);
  p.meadow(4, 4, 10, 10);
  p.meadow(0, 12, 14, 6);
  p.yard(5, 6, 9, 6, { gates: [[9, 11]], inner: '"' }); // the kitchen garden
  p.flowers([6, 7], [7, 7], [12, 7], [6, 9], [12, 10]);
  p.block(18, 12, 20, 5, 'd'); // the yard, trodden bare
  p.building('warden-house', 20, 7); // the farmhouse
  p.building('shed', 29, 8); // the apple store
  p.flowers([33, 6], [34, 6], [34, 7], [27, 6], [26, 6]);

  // -- The north orchard, beside the yard ---------------------------------------
  p.meadow(40, 8, 2, 4);
  p.meadow(42, 4, 16, 12);
  p.yard(43, 5, 14, 10, { gates: [[43, 8], [43, 9]], inner: '.' });
  tree(45, 6);
  tree(51, 7, 'tree-2');
  tree(47, 10);
  tree(52, 11);

  // -- The terraces: one framed slope down to the shore ---------------------------
  // Four shelves. The wood steps in and out along both sides, and each edge
  // of ledge runs from one of those steps to the road.
  p.meadow(8, 18, 20, 32);
  p.wood(8, 22, 2, 4).wood(24, 22, 4, 4); // the wood steps in at the first edge
  p.bed(10, 18, 10, 5, { round: false }); // the hay meadow under the yard
  p.ledge(10, 19, 24).put(20, 24, 'o');
  p.building('house', 14, 25); // the cowman's cottage, its door on the shelf road
  p.flowers([13, 27], [19, 28], [19, 27]);
  p.bed(24, 26, 4, 4, { round: false }).bed(8, 25, 4, 3, { round: false });
  p.wood(8, 30, 4, 4).ledge(15, 27, 32);
  p.bed(15, 33, 6, 4, { round: false }).bed(24, 33, 4, 2, { round: false }); // the cornfield, between the shelf roads
  p.wood(26, 36, 2, 4);
  p.bed(8, 35, 4, 6, { round: false });
  p.ledge(8, 20, 41).wood(24, 38, 4, 4);
  p.bed(8, 42, 11, 6, { round: false }); // rough grazing

  // -- The lane: the other framed slope, past the lower orchard and the press -----
  p.meadow(34, 18, 20, 18);
  p.meadow(54, 28, 10, 6); // the lane's way on east, to The Wreck
  p.wood(52, 18, 2, 4).wood(34, 30, 2, 4);
  p.yard(38, 19, 10, 9, { gates: [[38, 23]], inner: '.' }); // the lower orchard, its gate on the lane
  tree(40, 20, 'tree-2');
  tree(44, 22);
  tree(40, 24);
  p.flowers([39, 22], [39, 26]);
  p.bedRows([22, 49, 53], [23, 49, 53], [24, 49, 53], [21, 49, 51]);
  p.building('shed', 49, 25); // the cider press, its door on the lane
  p.flowers([48, 28], [52, 28]);
  p.bed(38, 32, 14, 3, { round: false });
  // The lane's foot: one edge from step to step, the quick way down to the pasture.
  p.ledge(36, 51, 35).wood(52, 34, 2, 2);

  // -- The pasture over the shore, with the drove track out to the dew pond -------
  p.meadow(34, 36, 20, 14);
  p.meadow(28, 44, 6, 6);
  p.bed(36, 37, 10, 5, { round: false }).bed(30, 47, 11, 3, { round: false });
  p.wood(50, 36, 4, 4);
  p.draw(44, 41, ['  WWWWW ', ' WWWWWWW', 'WWWWWWWW', 'WWWWWWWW', ' WWWWWW ', '   WWW  ']); // the dew pond
  stand('water-lily', 46, 43, 'W');
  stand('water-lily', 49, 42, 'W');
  stand('wet-rock', 48, 44, 'W');

  // -- The farm road, drawn last so nothing cuts it --------------------------------
  p.road([[0, 14], [20, 14]]); // in from Gull Strand
  p.road([[21, 16], [21, 29], [12, 29], [12, 37], [21, 37], [21, 47]], { width: 3 }); // down the terraces, by the cottage and the pond
  p.road([[24, 44], [42, 44]]); // the drove track, out across the pasture to the dew pond
  p.road([[36, 16], [36, 30], [62, 30]]); // the lane, and on east to The Wreck
  p.trail([[36, 0], [36, 4]]); // down from Tanglewood into the yard
  // Shrubs in the yard round the landing, so every way you set off meets something.
  p.put(21, 12, 'o').put(27, 12, 'o').put(24, 15, 'o');

  // -- The shore: spits, pools and the tide's own line, never a ruled edge -----
  p.block(2, 50, 60, 2, '~');
  p.block(0, 52, 64, 12, 'W');
  p.block(0, 52, 2, 2, 'W').block(62, 52, 2, 2, 'W'); // the sea, not the sand, meets the rim
  p.block(2, 48, 2, 2, '~'); // a nook in the wood at the west end of the sands, where the cockle path goes up
  p.draw(2, 52, [
    '~~~~~~~~~~~~~~~~~~~~~WWWW~~~~~~~~~~~~~~~~~~WWW~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~WWWWWW~~~~~~~~~~~~~~~~WWWWW~~~~~~~~~~~',
    ' ~~~~~~~~~~~~~~~~~~WWWWWWWW~~~~~~~~~~~~~WWWWWWWW~~~~~~~~',
    '   ~~~~~~~~~~~~~WWWWWWWWWWWWW~~~~~~~WWWWWWWWWWWWW~~~~~',
    '     ~~~~~~~~~WWWWWWWWWWWWWWWWW~~WWWWWWWWWWWWWWWWWW~',
    '       ~~~~WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);
  // The tide pools the cockle women work, on the broad spit.
  p.draw(8, 53, [' WWWW', 'WWWWWW', ' WWWW']);
  p.draw(29, 53, [' WW ', 'WWWW', ' WW ']);
  // The slip, on piles, for the one boat the farm admits to.
  p.road([[46, 52], [46, 57]], { letter: '_' });
  stand('mooring-post', 45, 56, 'W');
  stand('mooring-post', 48, 55, 'W');
  stand('wet-rock', 23, 54, 'W');
  stand('wet-rock', 40, 58, 'W');
  stand('wet-rock', 16, 60, 'W');
  // Drift, and what the sea has been sent back.
  stand('log', 18, 53);
  stand('log', 36, 52);
  stand('barrel', 52, 53);
  stand('crate-pair', 56, 53);
  stand('sack', 13, 56);

  // -- The yard at work: the barn, the well, the cart, and the Doduo -----------
  p.building('timber-house', 33, 6);
  stand('fountain', 18, 13);
  stand('crate-stack', 36, 15);
  stand('sack', 28, 15);
  stand('barrels', 31, 15);
  stand('sack', 29, 16);
  p.flowers([26, 10], [38, 8], [19, 5]);

  // -- The kitchen garden, in rows -----------------------------------------------
  for (const x of [7, 9, 11]) {
    stand('yellow-crop', x, 8);
    stand('seedlings', x, 10);
  }
  stand('red-crop', 7, 9);
  stand('red-crop', 9, 9);
  stand('pot-plant', 6, 9);

  // -- The road in, along the top of the hay ---------------------------------------
  stand('log', 7, 16);
  stand('stump', 11, 16);
  p.flowers([2, 16], [9, 12], [13, 13]);

  // -- The north orchard in harvest ---------------------------------------------------
  stand('crate-pair', 45, 12);
  stand('sack', 54, 6);
  stand('produce-crate', 55, 6);
  stand('produce-crate', 49, 6);
  p.flowers([44, 13], [55, 13], [50, 10]);

  // -- The cowman's: the shelf road, the churns, the cows ------------------------------
  stand('barrel', 12, 26);
  stand('barrel', 20, 25);
  stand('sack', 13, 28);

  // -- The cornfield and its scarecrow ---------------------------------------------------
  p.flowers([22, 34], [14, 34], [14, 37]);

  // -- The rough grazing, and the hay ---------------------------------------------------------
  stand('big-stump', 19, 43);
  stand('stump', 9, 48);

  // -- The press, running -------------------------------------------------------------------------
  stand('barrels', 53, 26);
  stand('crate-stack', 51, 23);
  stand('produce-crate', 48, 25);
  stand('barrel', 47, 28);

  // -- The honesty box, on the lane east ----------------------------------------------------------
  stand('produce', 57, 28);
  stand('sack', 61, 28);
  p.flowers([55, 29], [55, 33], [62, 33]);
  stand('rock', 60, 33);

  // -- The pasture and the dew pond: a herdsman's bench -----------------------------------------------
  stand('bench', 39, 45);
  stand('stump', 53, 38);
  p.flowers([42, 40], [36, 47], [53, 47], [52, 39], [43, 47]);

  const file = districtFile(GREYSTONE_VALE, 'orchard-terraces', p, {
    exits: [
      { x: 2, y: 48, name: 'Cockle Path', opens: { when: 'always' } },
      { x: 57, y: 4, name: "Pickers' Path", opens: { when: 'always' } },
    ],
    dropIns: [{ x: 24, y: 12, name: 'Farmhouse', description: 'The yard of the farm at Orchard Terraces, at the top of the terraces.' }],
    itemSpots: [
      { x: 49, y: 13, hidden: true },
      { x: 9, y: 37 },
      { x: 52, y: 48 },
      { x: 37, y: 54, hidden: true },
      { x: 60, y: 32, hidden: true },
      { x: 25, y: 30 },
      { x: 50, y: 20, hidden: true },
      { x: 12, y: 57 },
    ],
    extra: {
      districts: [
        { name: 'THE NORTH ORCHARD', x: 42, y: 4, width: 16, height: 11, wildlife: 'field' },
        { name: 'THE KITCHEN GARDEN', x: 5, y: 6, width: 9, height: 6, wildlife: 'field' },
        { name: 'THE COWMAN’S', x: 8, y: 25, width: 16, height: 7, wildlife: 'field' },
        { name: 'THE CORNFIELD', x: 12, y: 33, width: 14, height: 8, wildlife: 'field' },
        { name: 'THE LOWER ORCHARD', x: 38, y: 19, width: 10, height: 9, wildlife: 'field' },
        { name: 'THE CIDER PRESS', x: 48, y: 19, width: 6, height: 10, wildlife: 'field' },
        { name: 'THE HONESTY BOX', x: 54, y: 28, width: 10, height: 6, wildlife: 'field' },
        { name: 'THE DEW POND', x: 34, y: 37, width: 20, height: 13, wildlife: 'field' },
        { name: 'THE COCKLE BEDS', x: 2, y: 50, width: 22, height: 10, wildlife: 'shore' },
        { name: 'THE SLIP', x: 40, y: 50, width: 20, height: 8, wildlife: 'shore' },
      ],
      landmarks: [
        { x: 32, y: 14, name: 'Apple Store', kind: 'shed' },
        { x: 49, y: 29, name: 'Cider Vat', kind: 'kiln' },
      ],
      berryTrees: [
        { x: 12, y: 8, berry: 'sitrus' },
        { x: 12, y: 28, berry: 'cheri' }, // by the cowman's door
        { x: 50, y: 12, berry: 'pecha' },
        { x: 49, y: 20, berry: 'oran' },
        { x: 25, y: 19, berry: 'aspear' },
      ],
      // The farm's beasts: the Tauros the pasture is grazed by, one of them
      // ready to argue about it, and the yard's Doduo, who are hens to everybody here.
      pokemon: [
        { x: 48, y: 38, species: 'tauros', level: 9 },
        { x: 32, y: 46, species: 'tauros' },
        { x: 37, y: 41, species: 'tauros', beat: { everyMs: 3100, roam: [[1, 0]] } },
        { x: 29, y: 13, species: 'doduo', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 34, y: 13, species: 'doduo', level: 9, beat: { everyMs: 1600, roam: [[0, 1]] } },
        { x: 20, y: 16, species: 'doduo', beat: { everyMs: 1300, roam: [[1, 0]] } },
        { x: 16, y: 7, species: 'meowth', beat: { everyMs: 2000, roam: [[0, 1]] } },
        { x: 10, y: 9, species: 'caterpie' },
        { x: 41, y: 10, species: 'pidgey' },
        { x: 46, y: 11, species: 'caterpie', level: 6 },
        { x: 24, y: 27, species: 'tauros', beat: { everyMs: 3300, roam: [[1, 0]] } },
        { x: 25, y: 28, species: 'tauros', level: 10 },
        { x: 17, y: 34, species: 'spearow', beat: { everyMs: 1100, roam: [[1, 0]] } },
        { x: 21, y: 39, species: 'spearow', level: 8 },
        { x: 13, y: 44, species: 'rattata', beat: { everyMs: 1500, roam: [[0, 1]] } },
        { x: 44, y: 26, species: 'bellsprout', level: 8 },
        { x: 51, y: 29, species: 'rattata', level: 7, beat: { everyMs: 1300, roam: [[1, 0]] } },
        { x: 56, y: 33, species: 'rattata', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 43, y: 38, species: 'psyduck', level: 8 },
        { x: 14, y: 51, species: 'krabby', beat: { everyMs: 1200, roam: [[1, 0]] } },
        { x: 10, y: 56, species: 'shellder', level: 10 },
        { x: 33, y: 53, species: 'krabby', level: 8 },
        { x: 44, y: 51, species: 'psyduck', beat: { everyMs: 2500, roam: [[1, 0]] } },
      ],
      signs: [
        { x: 4, y: 13, lines: ['THE WEST ROAD', 'West: Gull Strand and the sea wall. East: the farm, and more work than you came for.'] },
        { x: 35, y: 18, lines: ['THE CIDER PRESS', 'Down the lane. Tasting by the jug. Mind the second jug.'] },
        { x: 42, y: 15, lines: ['NORTH ORCHARD', 'Do not climb the trees unless you are paid to. Do not get paid to.'] },
        { x: 20, y: 28, lines: ['THE COWMAN', 'Milk at the door. Knock loud. He is usually telling a Tauros something.'] },
        { x: 55, y: 32, lines: ['HONESTY BOX', 'Apples: one each. Leave what you think is fair. We have started counting.'] },
        { x: 34, y: 42, lines: ['THE DEW POND', 'It has never been dry and nothing runs into it. Nobody knows why. Nobody has asked it.'] },
        { x: 44, y: 50, lines: ['THE SLIP', 'One boat. For fishing. We have told the man from the Revenue the same.'] },
        { x: 24, y: 48, lines: ['THE SANDS', 'Along the sands west, the cockle path goes up through the wood.'] },
        { x: 15, y: 12, lines: ['ORCHARD TERRACES', 'The lane is east. The terraces are down, and the ledges are quicker.'] },
        { x: 58, y: 32, lines: ['THE LANE', 'East: The Wreck, on the cape. West and up: the farm.'] },
      ],
      people: [
        { x: 27, y: 13, name: 'Farmer Hale', look: 'straw-hat', facing: 'down', lines: ['Hop the terraces if you are in a hurry. Mind, you will not climb back.', 'Those trees up in the wood are mine, and I will have them back one day. Tell them.'], beat: { everyMs: 3400, glances: ['left', 'down'] }, calls: ['Harvest! All hands!'] },
        { x: 23, y: 16, name: 'Hen Girl', look: 'little-girl', facing: 'right', lines: ['These are the hens. There are nine and they have two heads each, so that is eighteen.', 'They lay one egg between them, and they argue over whose it is.'], beat: { everyMs: 1900, glances: ['right', 'up'] }, calls: ['Chook chook chook!'] },
        { x: 37, y: 13, name: 'Barn Hand', look: 'worker', facing: 'left', lines: ['Apples in the store, hay in the barn, and Himself in a mood.', 'That medicine bag on the shelf belongs to some nurse down the harbour. It came up with the vet.'], beat: { everyMs: 2800, roam: [[0, 1]], glances: ['left'] }, calls: ['Mind out, coming through!'] },
        { x: 8, y: 7, name: 'Mrs Hale', look: 'woman', facing: 'down', lines: ['I grow the beans, I feed the hands, and I do the books. He says he runs the farm.', 'It is very good for him to think so.'], beat: { everyMs: 3200, glances: ['down', 'right'] }, calls: ['Off my beans!'] },
        { x: 45, y: 10, name: 'Picker', look: 'picnicker', facing: 'up', lines: ['These are the old trees. The best apples are always the highest ones.', 'Which is why I am down here telling you about them.'], beat: { everyMs: 2900, glances: ['up', 'right'] }, calls: ['Catch!'] },
        { x: 55, y: 8, name: 'Old Picker', look: 'old-man', facing: 'left', lines: ['Fifty harvests. I can tell you the tree by the taste, and the year by the tree.', 'Nobody has ever asked.'], beat: { everyMs: 4100, glances: ['up', 'left'] }, calls: ['Not that one. It is thinking.'] },
        { x: 20, y: 27, name: 'Cowman', look: 'heavy-man', facing: 'left', lines: ['That one is Buttercup. That one is also Buttercup. It saves time.', 'Do not stand behind a Tauros, or in front. Stand somewhere else, on another farm.'], beat: { everyMs: 3600, glances: ['left', 'right'] }, calls: ['Come on, Buttercup!'] },
        { x: 18, y: 36, name: 'Scarecrow', look: 'straw-hat', facing: 'down', lines: ['...', 'It does not answer. It is a scarecrow. It was facing the other way a minute ago.'] },
        { x: 11, y: 43, name: 'Shepherd', look: 'hiker', facing: 'right', lines: ['Rough grazing. We tried sheep, but something kept eating them. We tried something else.', 'It ate that as well. Hop the ledges down, it is quicker than walking.'], beat: { everyMs: 3700, glances: ['down', 'right'] } },
        { x: 44, y: 21, name: 'Apple Girl', look: 'lass', facing: 'left', lines: ['Pip says I am not to take any. Pip says that about everything.', 'I have told him it is not his orchard. It is not. It is just his apples.'], beat: { everyMs: 2300, roam: [[1, 0]], glances: ['left', 'down'] }, calls: ['Pip! They are ripe!'] },
        { x: 53, y: 29, name: 'Cider Maker', look: 'bald-man', facing: 'up', lines: ['Everything goes in. Windfalls, wasps, the odd boot. It all comes out as cider.', 'It is very good for you. It is very good at something.'], beat: { everyMs: 3000, roam: [[1, 0]], glances: ['up'] }, calls: ['Second press! Who is next?'] },
        { x: 56, y: 29, name: 'Honest Tom', look: 'youngster', facing: 'right', lines: ['I am not watching the box. Nobody watches the box. That is the whole idea of it.', 'I just happen to sit here. All day. Looking at it.'], beat: { everyMs: 2500, glances: ['up', 'left'] }, calls: ['I saw nothing. I saw that.'] },
        { x: 40, y: 44, name: 'Herdsman', look: 'camper', facing: 'right', lines: ['That pond has not gone down in a dry year or come up in a wet one. Sit and watch it.', 'I have. The Tauros have. Nothing happens, and it is the best part of the day.'], beat: { everyMs: 4200, glances: ['right', 'down'] }, calls: ['Steady, you lot.'] },
        { x: 58, y: 51, name: 'Shell Digger', look: 'tuber-girl', facing: 'down', lines: ['The tide leaves the best shells right at the far end of the sands!', 'I found a whole boot once. Dad is wearing it.'], beat: { everyMs: 2000, roam: [[-1, 0]], glances: ['down'] }, calls: ['Got one! Got one!'] },
        { x: 6, y: 53, name: 'Cockle Woman', look: 'old-woman', facing: 'right', lines: ['You rake them at low water and you get off the sand at the turn. It comes in faster than you.', 'There is a path up through the wood at the west end. Everybody here has run up it.'], beat: { everyMs: 3100, glances: ['down', 'right'] }, calls: ['Cockles! Mind the tide!'] },
        { x: 15, y: 54, name: 'Cockle Lad', look: 'tuber-boy', facing: 'left', lines: ['Nan can tell when the tide will turn from the smell.', 'I can tell from when it is round my knees.'], beat: { everyMs: 1800, roam: [[1, 0]], glances: ['left'] }, calls: ['Nan! It is at my knees!'] },
        { x: 47, y: 52, name: 'Boatman', look: 'fisherman', facing: 'left', lines: ['One boat. We use it for going out and for coming back.', 'Down the coast there is a very quiet cove, I am told. Very good fishing. Very expensive fish.'], beat: { everyMs: 3300, glances: ['down', 'left'] }, calls: ['Tide is on the turn.'] },
      ],
      trainers: [
        { x: 39, y: 26, name: 'Orchardist Pip', team: 'orchardist', look: 'picnicker', facing: 'left', sight: 0, lines: ['Paws off my apples!'] },
        { x: 26, y: 46, name: 'Farmhand Bo', team: 'drover', look: 'boy', facing: 'left', sight: 0, lines: ['I was told to keep the track clear. You are on the track!'] },
        { x: 34, y: 51, name: 'Beachcomber Wyn', team: 'netter', look: 'swimmer-woman', facing: 'down', sight: 0, lines: ['Anything on this beach is mine. That includes you, until you beat me.'] },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The farm's doors: the farmhouse, its store, the barn, the cowman's and the press. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'orchard', 'warden-house', 20, 7, 'The Farmhouse', [
    { x: 4, y: 2, name: 'Gran Hale', look: 'old-woman', facing: 'down', lines: ['Sit down. You look thin. Everybody who comes through here looks thin, and I blame the raids.', 'The Pokémon Center sent a girl for that medicine bag. We fed her. She went home in the end.'] },
    { x: 7, y: 7, name: 'Hungry Picker', look: 'boy', facing: 'left', lines: ['Dinner is at twelve. It is not twelve. I am going to stand here until it is.'] },
  ], { room: INN_ROOM, pokemon: [{ x: 9, y: 2, species: 'meowth' }] });
  next = withInside(next, 'orchard', 'shed', 29, 8, 'The Apple Store', [], { itemSpots: [{ x: 7, y: 5 }] });
  next = withInside(next, 'orchard', 'timber-house', 33, 6, 'The Barn', [
    { x: 9, y: 5, name: 'Sleeping Hand', look: 'man', facing: 'down', lines: ['Zzz... the hay... the hay is finished, Mr Hale... zzz...'] },
  ], { itemSpots: [{ x: 1, y: 6, hidden: true }] });
  next = withInside(next, 'orchard', 'house', 14, 25, 'The Cowman’s Kitchen', [
    { x: 3, y: 3, name: 'Cowman’s Wife', look: 'woman', facing: 'down', lines: ['He calls me Buttercup as well. I have asked him to stop. He has asked me which one I am.'] },
  ]);
  next = withInside(next, 'orchard', 'shed', 49, 25, 'The Pressing Room', [
    { x: 5, y: 5, name: 'Taster', look: 'old-man', facing: 'left', lines: ['Somebody has to. I took it on for the good of the farm.', 'Forty years of that. Have I told you about the farm? Lovely farm. Have I told you?'] },
  ]);
  return next;
}
