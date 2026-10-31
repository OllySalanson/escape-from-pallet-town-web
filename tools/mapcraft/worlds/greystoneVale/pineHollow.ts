/**
 * PINE HOLLOW, the dark pine wood in the north-east of Greystone Vale.
 *
 * The one idea: one hidden trail threads three clearings, and nothing is
 * signed. It comes in over the col from the peaks in the west, finds the
 * The one idea back and forth under the pines - north, south,
 * north again - until it reaches the lip of the hollow the wood is named for and
 * drops in by a ledge: the quick way down, never the way back. It climbs out
 * east to the clearing where one broadleaf stands among the pines and leaves as
 * the Pine Trail, on into The Power Station; the station's Card Key was lost in
 * that clearing, and lies there one raid in five. The way back from the hollow
 * goes round by the broadleaf, so the ledge has a job: it saves the long way
 * round.
 *
 * The way south to Tanglewood is a deer path nobody signs: it leaves the
 * hollow's foot through tall grass and winds down between the trunks. Two
 * dead ends off the trail are where things are found.
 *
 * The wood is drawn as a sketch, one letter a 2x2 lattice cell, because the
 * conifer stands on that lattice: a trail drawn on an odd tile is eaten by the
 * trees beside it. Detail that is not a tree - the pool, the grass, the ledge -
 * is drawn tile by tile on top. FireRed's pieces only: the Kanto conifer, its
 * broadleaf and its rocks.
 *
 * Filled on 31 October 2026, the third ring out from Mill Square, and still not
 * one sign: nobody here wants to be found, so what it has instead of signs is
 * people who will tell you, grudgingly. Old Wren and her water at the spring; the
 * resin tappers, who are why Bill's amber is here at all, and the weeping pine
 * they work in the hollow; the collier's stack under the oak; the linesman walking
 * the cable through the trees to the station, who lost a card here and has not
 * told anybody; the bee wood; the Pikachu glade; and a deer stalker with no deer.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/** The wood, a letter a lattice cell: T pines, . the trail and the clearings, g tall grass. */
const WOOD = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTT.....TTTTTTTTTTTTTTTTTTTT',
  'TTTTT.........TTTTTTTTT....TTTTT',
  'TTTT...........TTTTTTT.......TTT',
  'TTTT................TT........TT',
  'TTTT..........TTTT.TTT........TT',
  'TTTT..........TTTT............TT',
  'TTTT..TTT.TTTTTTTT.T..........TT',
  'TTTT......TTTTTTTT.TTT.......TTT',
  '......TTTTTTTTTTTT.TTTT.....TTTT',
  'TTTT.TTTTTTTTTTT.T.TTTTT..T..TTT',
  'TTTT.TTTTTTTT....T.TTTTT..T.....',
  'TTTT.TTTTTTTTT........TT..TTTTTT',
  'TTT....TTTTT...........T..TTTTTT',
  'TTT....TTTTT...........T..TTTTTT',
  'TTT....TTTTT..............TTTTTT',
  'TTTTTTTTTTTT..............TTTTTT',
  'TTTTTTTTTTTT...........T.TTTTTTT',
  'TTTTTTTTTgggg.........TT......TT',
  'TTTTTTTTTggggT.....TTTTT......TT',
  'TTTTTTTTTggTTTTT.TTTTTTT......TT',
  'TTTTTTTTTggTTTTT.TTTTTTT......TT',
  'TTTTTggggggTTTTT.TTTTTTT......TT',
  'TTTTTgggggTTTT.......TTTTTTTTTTT',
  'TTTTTggTTTTTTT.......TTTTTTTTTTT',
  'TTTTTggTTTTTTT.......TTTTTTTTTTT',
  'TTTTTgggggTTTT.......TTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTgTTTTTTTTTTTTTTTTTTTTTT',
];

export function pineHollow(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'pine-hollow');
  p.cells(WOOD);

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- The trail: a sand path worn through the wood from the col to the lip of
  // the hollow, where it stops at the ledge; every bend is where the wood turns it
  p.road([[2, 22], [8, 22], [8, 14], [26, 14], [26, 12], [36, 12], [36, 28]]);

  // -- Clearing 1, the spring: the path skirts its pool ------------------------
  p.blob(16.5, 9.5, 5.6, 2.4, 'W');
  p.bedRows([16, 12, 17], [17, 13, 16], [9, 24, 27], [10, 23, 27], [11, 24, 26]);

  // -- Clearing 2, the hollow: one copse, a berry tree in its lee, grass ------
  // The path comes down into a floor worn bare in the middle of the hollow, and
  // leaves it on the far side: the hollow is where the trail is going.
  p.draw(34, 28, [
    '  dddd    ',
    ' dddddddd ',
    'dddddddddd',
    'ddddddddddd',
    ' ddddddddd',
    '   ddddd  ',
  ]);
  p.bedRows([30, 24, 27], [31, 24, 28], [32, 24, 27], [37, 25, 32], [38, 24, 33], [39, 24, 30]);
  p.building('rock', 46, 38).building('rock', 47, 38).building('rock', 47, 37);
  // What stands at the end of each dead end, so a lane is seen to lead somewhere.
  p.building('rock', 9, 34).building('rock', 41, 55).building('rock', 58, 42);

  // -- Clearing 3, the broadleaf: one oak among the pines, and the way out ----
  p.building('tree', 51, 12);
  p.block(51, 12, 3, 1, '#'); // thicket under its crown, so nobody stands hidden there
  // The path picks up again where the hollow is climbed out of, and runs on to the oak.
  p.road([[44, 32], [48, 32], [48, 18], [54, 18], [54, 26], [61, 26]]);
  p.draw(49, 16, [' ddddd ', 'ddddddd']); // the ground worn bare under the oak
  p.bedRows([16, 44, 46], [17, 44, 47], [18, 44, 45], [19, 44, 45]);
  p.flowers([55, 13], [56, 14], [55, 15], [49, 10]);

  // -- The spring: Old Wren's hut, and her water ----------------------------------------
  p.building('hut', 10, 9);
  stand('log', 10, 8); // her woodpile, behind it
  stand('stump', 26, 11);
  stand('water-lily', 19, 9, 'W');
  stand('wet-rock', 15, 9, 'W');
  p.flowers([9, 13], [24, 13], [14, 12], [26, 8]);

  // -- The col: a walker's rest, where the trail comes in over the top ---------------------
  stand('log', 13, 20);
  stand('stump', 17, 21);

  // -- The charcoal track: a burnt-out stack at the back of the nook ----------------------------
  stand('dead-stump', 8, 31);
  stand('dead-stump', 12, 35);
  p.flowers([11, 31]);

  // -- The tappers' camp, on the way down: pots on the trees, and a lean-to --------------------
  stand('hut', 30, 26);
  stand('barrels', 26, 26);
  stand('pot', 33, 27);
  stand('pot', 33, 26);
  p.flowers([30, 29], [32, 30]);

  // -- The weeping pine, standing alone on the hollow's floor ----------------------------------------
  stand('pine', 36, 31, 'd');
  p.block(36, 31, 2, 1, '#'); // thicket under its tip, so nobody stands hidden there
  stand('pot', 35, 33);
  stand('pot', 38, 33);
  stand('pot', 36, 34);
  stand('big-stump', 41, 30);
  stand('log', 40, 33);

  // -- The bee wood: the nest, and the old stumps round it ------------------------------------------------
  stand('big-stump', 33, 50);
  stand('dead-stump', 38, 52);
  stand('stump', 37, 50);
  p.flowers([34, 53], [40, 51], [35, 49], [39, 49]);

  // -- The Pikachu glade, under the line to the station ---------------------------------------------------------
  stand('rail-post', 54, 42);
  stand('rail-post', 54, 46);
  stand('crate-pair', 52, 44);
  p.flowers([56, 37], [52, 40], [57, 46]);

  // -- The oak: the collier's stack and his wood --------------------------------------------------------------------
  stand('crate-stack', 57, 18);
  stand('log', 56, 14);
  stand('big-stump', 45, 12);
  stand('dead-stump', 57, 10);
  stand('dead-stump', 48, 8);
  p.flowers([46, 10], [58, 14]);

  // -- The deer path, down through the grass ----------------------------------------------------------------------
  stand('stump', 24, 41);
  stand('log', 12, 48);

  const file = districtFile(GREYSTONE_VALE, 'pine-hollow', p, {
    dropIns: [],
    itemSpots: [
      { x: 30, y: 38, hidden: true }, // the hollow's secret, in the grass
      { x: 10, y: 33 }, // the nook south of the col
      { x: 57, y: 41 }, // the nook south of the climb
      { x: 40, y: 54 }, // the fox earth, south of the hollow
      { x: 53, y: 8, key: true }, // the station's Card Key, dropped past the oak
      { x: 28, y: 30, hidden: true },
      { x: 53, y: 47 },
      { x: 23, y: 42, hidden: true },
      { x: 12, y: 31 },
    ],
    // A way out nobody signs, at the back of the nook south of the col: the
    // wood is wide, and its one planned way out is at its far east end.
    exits: [
      { x: 6, y: 34, name: 'Charcoal Track', opens: { when: 'always' } },
      // The nook south of the climb was within the hunter's blind window of the
      // Pine Trail; with the trail the way on into The Power Station now, a fox
      // run out through the pines at its far corner is that nook's way out.
      { x: 59, y: 40, name: 'Fox Run', opens: { when: 'always' } },
    ],
    extra: {
      // The hollow's own floor stays plain PINE HOLLOW: what the place hides
      // (`filePrizes.ts`, Bill's amber) is seated in what is not named otherwise.
      districts: [
        { name: 'THE COLD SPRING', x: 8, y: 6, width: 22, height: 10, wildlife: 'woodland' },
        { name: 'THE TAPPERS’ CAMP', x: 24, y: 24, width: 10, height: 8, wildlife: 'woodland' },
        { name: 'THE BEE WOOD', x: 32, y: 46, width: 10, height: 10, wildlife: 'woodland' },
        { name: 'THE PIKACHU GLADE', x: 50, y: 36, width: 10, height: 14, wildlife: 'woodland' },
        { name: 'THE OAK', x: 44, y: 8, width: 16, height: 11, wildlife: 'woodland' },
      ],
      landmarks: [
        { x: 22, y: 12, name: 'Cold Spring', kind: 'spring' },
        { x: 37, y: 35, name: 'The Weeping Pine', kind: 'herbs' },
      ],
      berryTrees: [
        { x: 31, y: 34, berry: 'oran' },
        { x: 47, y: 9, berry: 'pecha' }, // in the north glade, past the charcoal burner
        { x: 8, y: 18, berry: 'chesto' },
        { x: 58, y: 47, berry: 'cheri' },
      ],
      // Who lives in the pines: a Beedrill nest in the south glade, a Pikachu
      // in the east one, and Nidoran on the deer path, and the wood's small change.
      pokemon: [
        { x: 35, y: 53, species: 'beedrill', level: 10 },
        { x: 37, y: 54, species: 'weedle' },
        { x: 49, y: 35, species: 'pikachu', level: 8 },
        { x: 12, y: 52, species: 'nidoran-m', level: 8 },
        { x: 20, y: 42, species: 'caterpie' },
        { x: 36, y: 51, species: 'beedrill', beat: { everyMs: 1000, roam: [[1, 0]] } },
        { x: 40, y: 53, species: 'kakuna', level: 8 },
        { x: 56, y: 42, species: 'pikachu', beat: { everyMs: 1200, roam: [[0, 1]] } },
        { x: 53, y: 40, species: 'pikachu', level: 9 },
        { x: 23, y: 11, species: 'psyduck', beat: { everyMs: 2500, roam: [[1, 0]] } },
        { x: 13, y: 13, species: 'pidgey', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 10, y: 20, species: 'spearow', level: 7 },
        { x: 11, y: 34, species: 'rattata', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 44, y: 35, species: 'pidgey', beat: { everyMs: 1500, roam: [[0, 1]] } },
        { x: 30, y: 36, species: 'venonat', level: 9 },
        { x: 48, y: 15, species: 'vulpix', beat: { everyMs: 2000, roam: [[1, 0]] } },
        { x: 18, y: 50, species: 'nidoran-f', beat: { everyMs: 1800, roam: [[1, 0]] } },
        { x: 13, y: 54, species: 'metapod' },
        { x: 56, y: 48, species: 'oddish', level: 8 },
      ],
      people: [
        { x: 9, y: 12, name: 'Old Wren', look: 'old-woman', facing: 'right', lines: ['Nobody signs the trails in Pine Hollow. You find them or you do not.', 'The deer go south out of the hollow, down to the broadleaf wood.'], beat: { everyMs: 4200, glances: ['right', 'up'] }, calls: ['Who sent you?'] },
        { x: 18, y: 13, name: 'Water Girl', look: 'lass', facing: 'up', lines: ['Coldest spring in the vale. Gran says it cures everything.', 'She says that about everything. I just carry it.'], beat: { everyMs: 2200, glances: ['up', 'right'] }, calls: ['Mind the pails!'] },
        { x: 12, y: 21, name: 'Col Walker', look: 'hiker', facing: 'right', lines: ['Over the col from the peaks and this is what you get. Trees.', 'There is a charcoal track goes out of the nook south of here, if you know it. I never told you.'], beat: { everyMs: 3700, glances: ['right', 'down'] }, calls: ['Trees. More trees.'] },
        { x: 10, y: 32, name: 'Old Collier', look: 'old-man', facing: 'down', lines: ['My stack went cold here in the year of the fire. It has never been the same since.', 'You go out that way, behind me, if anything comes through the pines after you.'], beat: { everyMs: 4000, glances: ['down', 'left'] }, calls: ['Nothing here. Keep walking.'] },
        { x: 29, y: 30, name: 'Resin Tapper', look: 'worker', facing: 'up', lines: ['Cut the bark, hang the pot, come back in a year. This whole wood weeps if you ask it.', 'Leave it a very long time, and it goes to amber. There is a collector down at the harbour who pays silly money.'], beat: { everyMs: 2900, roam: [[1, 0]], glances: ['up'] }, calls: ['Mind the pots!'] },
        { x: 34, y: 30, name: 'Tapper’s Girl', look: 'little-girl', facing: 'left', lines: ['There is a Caterpie stuck in one of the old lumps, right the way through. Dad says a thousand years.', 'I said sorry to it.'], beat: { everyMs: 1800, glances: ['left', 'down'] }, calls: ['Do not touch, it is sticky!'] },
        { x: 42, y: 32, name: 'Amber Hunter', look: 'poke-maniac', facing: 'left', lines: ['That pine has been weeping since before there was a vale. Look under it. Look under all of them.', 'Amber lies anywhere in this wood. Good luck finding it twice.'], beat: { everyMs: 3500, glances: ['left', 'down'] }, calls: ['Hush. I can smell resin.'] },
        { x: 39, y: 50, name: 'Bee Warden', look: 'bug-catcher', facing: 'left', lines: ['Those are not bees. I keep saying that. They have got my hat.', 'It is a very big nest. Do not stand there. No. Do not stand there either.'], beat: { everyMs: 2400, glances: ['left', 'up'] }, calls: ['Slowly. Very slowly.'] },
        { x: 55, y: 45, name: 'Linesman', look: 'worker', facing: 'left', lines: ['I walk the cable from the station to the pass, and the Pikachu sit on it and drink.', 'I had a card for the Service Gate. I had it when I passed the oak. If you find it, you never saw me.'], beat: { everyMs: 3200, roam: [[0, 1]], glances: ['up', 'left'] }, calls: ['Off the line, you lot!'] },
        { x: 50, y: 16, name: 'Collier’s Mate', look: 'man', facing: 'right', lines: ['Bram does not talk. He has not said anything since the spring.', 'He said something to you? Sit down. Tell me everything.'], beat: { everyMs: 2700, glances: ['right', 'up'] }, calls: ['Who goes there?'] },
        { x: 13, y: 50, name: 'Deer Stalker', look: 'gentleman', facing: 'right', lines: ['Eleven years I have stalked the deer of Pine Hollow. I have seen the path, the prints, the droppings.', 'South out of the hollow, then on down. There is a very fine wood at the bottom of it, I am told.'], beat: { everyMs: 3900, glances: ['down', 'right'] }, calls: ['Shh! A deer! No.'] },
      ],
      trainers: [
        { x: 54, y: 17, name: 'Collier Bram', team: 'collier', look: 'hiker', facing: 'left', sight: 3, lines: ['I burn charcoal under the old oak. Nobody comes this far in.'] },
        { x: 26, y: 35, name: 'Tapper Ines', team: 'scout', look: 'picnicker', facing: 'right', sight: 0, lines: ['Five years that pot has been hanging, and you kicked it! Battle me!'] },
        { x: 30, y: 42, name: 'Woodsman Crake', team: 'orchardist', look: 'camper', facing: 'up', sight: 0, lines: ['Nobody comes down here. I come down here so nobody will. It is working, except for you.'] },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The wood's two roofs, neither of them advertised. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'pines', 'hut', 10, 9, 'Old Wren’s', [
    { x: 3, y: 3, name: 'Old Wren’s Sister', look: 'old-woman', facing: 'down', lines: ['She told you nothing. She tells everybody nothing. She has been telling me nothing for seventy years.', 'The oak glade is east. There. Now you know as much as I do.'] },
  ]);
  next = withInside(next, 'pines', 'hut', 30, 26, 'The Tappers’ Lean-to', [], { itemSpots: [{ x: 5, y: 3 }] });
  return next;
}
