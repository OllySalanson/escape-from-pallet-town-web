/**
 * SAFARI MARSH, east of Tanglewood, behind the Safari Zone's own gate.
 *
 * The one idea: a warden's reserve where the vale's rarest Pokemon live. The
 * road from Tanglewood comes to FireRed's Safari Zone gate and goes in past it
 * onto the reserve's sand paths, which wind through reed beds, round two pools
 * and between copses to the rest house in the middle - the dry ground a raid
 * stops at - and on: north to the power station, south through the reeds to
 * the wreck, and east to the Ranger's Track, the way off the map. A second
 * hut stands by the pond in the north-east. The reeds roll the Safari Zone's
 * own table (`SAFARI_ZONE_WILDLIFE`): Nidoran, Exeggcute, Venonat, Paras and
 * Rhyhorn, and the Chansey, Kangaskhan, Scyther, Pinsir and Tauros that live
 * nowhere else in the game.
 *
 * Drawn a letter a lattice cell, as Reedmere is; the wood round the reserve is
 * the forest that runs on east of Tanglewood.
 *
 * Filled on 31 October 2026, the fourth ring out from Mill Square: a reserve
 * whose Warden has gone down to the harbour about his teeth and left it to
 * everybody else. A tour is losing people on the west lawn, and one of them has
 * got as far as the south planks. The birders have a hide on a deck out over the
 * long pool and a picture of some reeds. The Kangaskhan have a nursery by the
 * north-east pond; the Rhyhorn have a wallow; there is a stage out on the great
 * pool, an office full of what the marsh gave back, and a poacher who has never
 * seen that Scyther before in his life. The pools are drawn now, not rolled.
 */
import type { MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

/**
 * The reserve, a letter a lattice cell: T the wood and its copses, g the
 * reeds, d the sand paths, . the dry ground the huts stand on. The pools are
 * drawn over it by hand, with soft edges, because a pool on the lattice is a
 * stack of rectangles.
 */
const RESERVE = [
  'TTTTTTTTTTTTTTTdTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTdTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTg.d.ggTTTTTTTTTTTTT',
  'TTTTTTTTTTTTgg.dd.gTTTTTTTTTTTTT',
  'TTTTTTTTTggggTT.d.gTTTTTTTTTTTTT',
  'TTTTTTTTggggggg.d.TTTTTTTTTTTTTT',
  'TTTTTTTTggggggg.d.gTTTgggggTTTTT',
  'TTTTTTTTggggggg.d.gTTTgggggTTTTT',
  'TTTTTTTTgggggg.dd.gTTggggggTTTTT',
  'TTTTTTTTgggggg.d.TTTg.....gTTTTT',
  'TTTTTTTTgggggg.d.TTTg.....gTTTTT',
  'TTTTTTTTgggggg.d.gggg.....gTTTTT',
  'TTTTTTTg..gggg.d.gg.......gTTTTT',
  'TTTTTTTgTTT.g......dddd.gggg..TT',
  'TTTTTTTTTTTg.......d...gggg...TT',
  'TTTTTTggggg.dd...ddd.......ddddd',
  'TTTTggg.....d......ddddddddd.TTT',
  'T......dddddd.d.ggg.......TTTTTT',
  'T......d......d.gTgggggggTTTTTTT',
  'T......d.gggg.d.gTTggggggTTTTTTT',
  'dddddddd.gggg.d.gTTgggggggTTTTTT',
  'T.......ggg...d.TTTgggggggTTTTTT',
  'T......ggg.dddd.gTTgggggggTTTTTT',
  'T..TTT.gTg.d...ggTTgggggggTTTTTT',
  'TTgTTTTTTg.d.ggTTTTgggggggTTTTTT',
  'TTTTTTTTTg.d.gTTTTTgggggggTTTTTT',
  'TTTTTTTTTg.d.gTTTTTTggggTTTTTTTT',
  'TTTTTTTTg.dd.gTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTg.d.ggTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTg.d.gTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTdTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTdTTTTTTTTTTTTTTTTTTTTT',
];

export function safariMarsh(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'safari-marsh');
  p.cells(RESERVE);
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // The long pool by the north road, its two lobes pinched where the deck goes out.
  p.draw(17, 8, [
    '     WWWW',
    '   WWWWWWW',
    '  WWWWWWWW',
    '  WWWWWWWWW',
    ' WWWWWWWWWW',
    ' WWWWWWWWW',
    '  WWWWWWWW',
    '   WWWWWW',
    '  WWWWWWWW',
    ' WWWWWWWWW',
    ' WWWWWWWWWW',
    '  WWWWWWWW',
    '    WWWWW',
    '     WW',
  ]);
  // The great pool south of the east road, one long bay in its west side.
  p.draw(40, 39, [
    '     WWWWWW',
    '   WWWWWWWWWWW',
    '  WWWWWWWWWWWW',
    ' WWWWWWWWWWWWW',
    'WWWWWWWWWWWWWW',
    'WWWWWWWWWWWW',
    '   WWWWWWWWW',
    ' WWWWWWWWWWWW',
    ' WWWWWWWWWWWWW',
    '  WWWWWWWWWWW',
    '   WWWWWWWWW',
    '    WWWWWWW',
    '     WWWWW',
  ]);
  p.wood(52, 40, 2, 12);
  p.wood(50, 50, 2, 2);
  // The pond by the north-east hut.
  p.draw(46, 12, ['  WWW', ' WWWWWW', 'WWWWWWW', 'WWWWWW', ' WWWW', '  WW']);
  stand('water-lily', 21, 10, 'W');
  stand('water-lily', 24, 13, 'W');
  stand('water-lily', 25, 20, 'W');
  stand('wet-rock', 20, 12, 'W');
  stand('water-lily', 48, 41, 'W');
  stand('water-lily', 50, 47, 'W');
  stand('water-lily', 43, 49, 'W');
  stand('wet-rock', 48, 44, 'W');
  stand('water-lily', 48, 14, 'W');

  // -- The gate: FireRed's Safari Zone gate, beside the road where it goes in --
  p.building('safari-gate', 4, 34);
  p.building('route-sign', 12, 39);
  p.flowers([3, 44], [4, 45], [10, 45], [11, 44]);

  // -- The rest house in the middle, and the hut by the north-east pond -------
  p.building('warden-house', 27, 26);
  p.building('green-cottage', 44, 18);
  p.building('bench', 31, 31, { lot: '.' });
  p.bushes([27, 32], [30, 33]); // shrubs in the rest house's yard

  // -- The gate's forecourt, the third ring out from Mill Square: the only part of the
  // reserve with a queue. The ticket hut, the family that came for the day, and the
  // Warden's boards telling you what you are about to be told.
  p.building('hut', 11, 34);
  p.building('produce', 2, 43);
  p.building('bench', 7, 44);
  p.flowers([2, 42], [13, 44], [6, 46]);

  // -- The hide: a deck out over the reeds and the long pool, and a hut on stilts --
  p.building('hut', 20, 15, { lot: 'W' });
  p.block(19, 18, 11, 2, '_');
  stand('mooring-post', 18, 19, 'W');
  stand('bench', 22, 16, 'W');
  p.block(22, 16, 3, 2, '_');

  // -- The egg bank, on the dry ground by the road ------------------------------------
  stand('stump', 28, 21);
  stand('big-stump', 28, 23);
  p.flowers([29, 20], [28, 25]);

  // -- The north stile: a warden's bucket and a sign for the people coming the other way
  stand('barrel', 28, 6);
  stand('log', 28, 7);
  p.flowers([33, 5], [28, 5]);

  // -- The nursery, by the north-east pond: a garden the Kangaskhan have taken over ---
  p.yard(46, 21, 7, 5, { gates: [[46, 23]], inner: '"' });
  stand('pot', 51, 22, '"');
  p.flowers([43, 22], [42, 23], [52, 19]);

  // -- Lost property: a shed by the rest house, and the overflow outside it ------------
  p.building('shed', 33, 26);
  stand('crate-stack', 37, 26);
  stand('sack', 37, 29);
  stand('barrel', 32, 25);
  stand('town-map', 26, 31);
  stand('bench', 24, 36);

  // -- The great pool's stage, out from the reeds on its north shore -------------------
  p.block(44, 37, 2, 7, '_');
  p.block(44, 41, 4, 2, '_');
  stand('mooring-post', 43, 41, 'W');
  stand('crate-pair', 40, 36);

  // -- The wallow: mud in the reeds, and what lies in it --------------------------------
  p.draw(25, 49, ['  ,,,,', ' ,,,,,,', ',,,,,,,', ' ,,,,,', '  ,,,']);
  stand('rock', 30, 49);
  stand('big-stump', 25, 53);

  // -- The rangers' camp, at the end of the east road ------------------------------------
  stand('hut', 56, 26);
  stand('hut', 59, 27);
  stand('log', 53, 28);
  stand('pot', 58, 26);
  p.flowers([52, 28], [61, 29]);

  // -- The south planks, where the trail to the wreck crosses the brook ------------------
  p.road([[14, 55], [17, 55], [17, 56], [29, 56]], { width: 2, letter: 'W' });
  p.block(20, 55, 3, 3, '_');
  p.wood(30, 56, 2, 2);
  p.flowers([25, 58], [17, 53]);

  const file = districtFile(GREYSTONE_VALE, 'safari-marsh', p, {
    // The power station's far side is past the hunter's blind window from
    // every other way out now its stand-in into the marsh is gone
    // (`hunterFlee.test.ts`): the wardens' stile by the north road covers it.
    exits: [{ x: 29, y: 4, name: "Wardens' Stile", opens: { when: 'always' } }],
    dropIns: [{ x: 30, y: 32, name: 'Rest House', description: "The rest house in the middle of the reserve, the dry ground a raid stops at." }],
    itemSpots: [
      { x: 23, y: 45, hidden: true }, // plain marsh: what is lost out here falls back on it
      { x: 50, y: 22 },
      { x: 11, y: 44 },
      { x: 29, y: 19 }, // the end of the deck, on the road side
      { x: 47, y: 42, hidden: true },
      { x: 27, y: 51 },
      { x: 60, y: 30, hidden: true },
    ],
    extra: {
      districts: [
        { name: 'THE SAFARI GATE', x: 2, y: 34, width: 12, height: 14, wildlife: 'safari' },
        { name: 'THE HIDE', x: 18, y: 15, width: 11, height: 7, wildlife: 'safari' },
        { name: 'THE EGG BANK', x: 28, y: 19, width: 3, height: 7, wildlife: 'safari' },
        { name: 'THE NURSERY', x: 42, y: 17, width: 12, height: 9, wildlife: 'safari' },
        { name: 'LOST PROPERTY', x: 33, y: 25, width: 5, height: 6, wildlife: 'safari' },
        { name: 'THE TOUR', x: 16, y: 34, width: 11, height: 4, wildlife: 'safari' },
        { name: 'THE GREAT POOL', x: 39, y: 36, width: 14, height: 17, wildlife: 'safari' },
        { name: 'THE WALLOW', x: 24, y: 48, width: 8, height: 7, wildlife: 'safari' },
        { name: 'THE RANGERS’ CAMP', x: 52, y: 26, width: 10, height: 6, wildlife: 'safari' },
        { name: 'THE SOUTH PLANKS', x: 14, y: 53, width: 15, height: 7, wildlife: 'safari' },
      ],
      signs: [
        { x: 13, y: 38, lines: ['SAFARI MARSH', "A warden's reserve. Keep to the paths; the reeds are full."] },
        { x: 13, y: 42, lines: ['TICKETS', 'Free. There used to be a charge. There used to be a lot of things.'] },
        { x: 26, y: 33, lines: ['REST HOUSE', 'Tea. Dry socks. No catching on the furniture.'] },
        { x: 32, y: 6, lines: ['SAFARI MARSH: NORTH STILE', 'If you can hear a hum, you are going the wrong way. If you can hear a bite, also.'] },
        { x: 29, y: 16, lines: ['THE EGG BANK', 'Please do not sit on the eggs. They have been asked not to sit on you.'] },
        { x: 27, y: 20, lines: ['THE HIDE', 'Silence, please. Binoculars for hire. Binoculars not available.'] },
        { x: 44, y: 23, lines: ['THE NURSERY', 'Knock first. Then leave. Then knock from further away.'] },
        { x: 37, y: 28, lines: ['LOST PROPERTY', 'Boots, hats, three canoes and an uncle. Teeth: no. Stop asking.'] },
        { x: 42, y: 35, lines: ['THE GREAT POOL', 'No swimming. Something long has been seen. It has been seen looking back.'] },
        { x: 29, y: 48, lines: ['THE WALLOW', 'Rhyhorn cannot see well. They can hear you reading this.'] },
        { x: 53, y: 29, lines: ['RANGERS’ CAMP', 'East: the track and out. Sign in. Sign out. We count, at the end, and we are often surprised.'] },
        { x: 23, y: 58, lines: ['THE SOUTH PLANKS', 'South: The Wreck, through the wood. Mind the third plank. It is on its way to the sea.'] },
      ],
      // The reserve's own, standing where its paths go past them, as the
      // Safari Zone's rarest are met: a Kangaskhan in the middle glade, a
      // Chansey by the south pond, a Pinsir in the east beds, Nidoran and
      // Nidorino in the reeds.
      pokemon: [
        { x: 49, y: 20, species: 'kangaskhan', level: 14 },
        { x: 43, y: 52, species: 'chansey', level: 14 },
        { x: 31, y: 47, species: 'pinsir', level: 14 },
        { x: 18, y: 22, species: 'nidorino', level: 13 },
        { x: 18, y: 53, species: 'nidoran-f', level: 10 },
        { x: 4, y: 46, species: 'rattata', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 12, y: 43, species: 'venonat', level: 11 },
        { x: 33, y: 34, species: 'doduo', beat: { everyMs: 1500, roam: [[1, 0]] } },
        // The nursery: two mothers, and the Chansey who has taken charge of them.
        { x: 48, y: 23, species: 'kangaskhan', beat: { everyMs: 2400, roam: [[1, 0]] } },
        { x: 51, y: 24, species: 'cubone', beat: { everyMs: 1300, roam: [[0, -1]] } },
        { x: 50, y: 19, species: 'chansey', beat: { everyMs: 2100, roam: [[0, 1]] } },
        { x: 51, y: 12, species: 'poliwhirl', level: 13 },
        // The egg bank.
        { x: 29, y: 22, species: 'exeggcute', level: 12 },
        { x: 29, y: 21, species: 'exeggcute' },
        { x: 28, y: 22, species: 'exeggcute' },
        // What the hide is trying to see, from the shore it cannot be seen from.
        { x: 16, y: 16, species: 'psyduck', beat: { everyMs: 2300, roam: [[0, 1]] } },
        { x: 29, y: 11, species: 'venonat', beat: { everyMs: 1200, roam: [[0, 1]] } },
        { x: 34, y: 4, species: 'paras', level: 12 },
        // The great pool, the wallow and the reeds round them.
        { x: 46, y: 38, species: 'slowpoke', level: 13 },
        { x: 39, y: 42, species: 'psyduck' },
        { x: 40, y: 38, species: 'nidorina', level: 13 },
        { x: 28, y: 50, species: 'rhyhorn', level: 14 },
        { x: 26, y: 52, species: 'rhyhorn', beat: { everyMs: 3100, roam: [[1, 0]] } },
        { x: 40, y: 31, species: 'tauros', level: 14 },
        { x: 44, y: 30, species: 'tauros', beat: { everyMs: 2800, roam: [[1, 0]] } },
        { x: 49, y: 35, species: 'scyther', level: 14 },
        { x: 54, y: 27, species: 'nidoran-m', beat: { everyMs: 1500, roam: [[-1, 0]] } },
        { x: 21, y: 32, species: 'venonat' },
        { x: 18, y: 47, species: 'paras', beat: { everyMs: 1800, roam: [[0, 1]] } },
        { x: 24, y: 58, species: 'poliwag' },
      ],
      people: [
        {
          x: 10,
          y: 42,
          name: 'Warden',
          look: 'gentleman',
          facing: 'left',
          lines: ['Welcome to the reserve.', 'Pokemon live in these reeds that you will not find anywhere else in the vale.'],
          beat: { everyMs: 3500, glances: ['left', 'right'] },
          calls: ['Keep to the paths!'],
        },
        { x: 10, y: 37, name: 'Ticket Man', look: 'clerk', facing: 'down', lines: ['One ticket, free of charge. Do not lose it. There is no way of checking it, but do not lose it.', 'The real gate? That was the real gate. It is just mostly a hut now.'], beat: { everyMs: 3000, glances: ['down', 'right'] }, calls: ['Tickets! Free tickets!'] },
        { x: 2, y: 45, name: 'Day Tripper', look: 'woman', facing: 'right', lines: ['We came all the way from Millbrook to see something rare.', 'We have seen a Rattata. Tom thinks it is a very rare Rattata.'], beat: { everyMs: 2900, glances: ['right', 'up'] }, calls: ['Tom! Do not feed that!'] },
        { x: 6, y: 42, name: 'Tom', look: 'little-boy', facing: 'down', lines: ['That Rattata is very rare. I can tell. It looked at me.'], beat: { everyMs: 1700, glances: ['down', 'left'] }, calls: ['It looked at me!'] },
        { x: 32, y: 33, name: 'Reserve Warden', look: 'camper', facing: 'left', lines: ['The rest house is the only dry ground for a good way. We lose the odd visitor between huts.', 'The Kangaskhan by the east pond has been told not to. It is very firm about it.'], beat: { everyMs: 3300, glances: ['left', 'down'] }, calls: ['Dry socks inside.'] },
        { x: 34, y: 7, name: 'Stile Warden', look: 'hiker', facing: 'left', lines: ['North of here it is all the Power Station. They send us their hum, and we send them our midges.', 'The old Warden went to the harbour about his teeth. He left instructions. Nobody could understand them.'], beat: { everyMs: 3500, glances: ['left', 'up'] }, calls: ['Mind the stile!'] },
        { x: 16, y: 11, name: 'Stuck Birder', look: 'man', facing: 'right', lines: ['I am perfectly all right. I came in for a closer look, in the spring.', 'If you are going back, tell them on the deck that it was a reed. It was a reed the whole time.'], beat: { everyMs: 3600, glances: ['right', 'up'] }, calls: ['I am perfectly all right.'] },
        { x: 46, y: 52, name: 'Reed Cutter', look: 'old-woman', facing: 'up', lines: ['I cut reeds, and they grow back, and I cut them. The Warden says it is good for the marsh.', 'He says hoh hoh. I have decided that is what he means.'], beat: { everyMs: 3000, glances: ['up', 'right'] }, calls: ['Mind your ankles.'] },
        { x: 21, y: 18, name: 'Birder', look: 'cameraman', facing: 'left', lines: ['Sh. Sh. There. In the reeds. No, it has gone.', 'That was a Scyther. Or a reed. They are very similar in this light.'], beat: { everyMs: 3900, glances: ['left', 'up'] }, calls: ['Sh!'] },
        { x: 26, y: 19, name: 'Twitcher', look: 'poke-maniac', facing: 'up', lines: ['Forty-one species from this deck. I have seen two. The other thirty-nine are in my notebook, on trust.', 'If you see a Dratini, do not tell me. I could not bear it.'], beat: { everyMs: 2700, glances: ['up', 'right'] }, calls: ['Was that a Dratini?'] },
        { x: 29, y: 25, name: 'Egg Counter', look: 'lass', facing: 'up', lines: ['Six to a cluster, three clusters, eighteen. It was eighteen this morning. It keeps being eighteen.', 'They are not eggs. Nobody here has the heart to tell the Warden.'], beat: { everyMs: 2400, glances: ['up', 'right'] }, calls: ['Seventeen. Eighteen. Nineteen?'] },
        { x: 49, y: 24, name: 'Nursemaid', look: 'worker-woman', facing: 'up', lines: ['I do not run this nursery. I work here. That one runs it, and she has views on my hands.', 'Chansey does the rounds. She has been here longer than the roof.'], beat: { everyMs: 3000, glances: ['up', 'left'] }, calls: ['Gently! Gently!'] },
        { x: 35, y: 30, name: 'Property Clerk', look: 'clerk', facing: 'up', lines: ['Whatever the marsh takes, it gives back here, in about a year, and wetter.', 'A gentleman asks after gold teeth every month by post. I cannot read the letters. I think they say hoh.'], beat: { everyMs: 3200, glances: ['up', 'down'] } },
        { x: 18, y: 36, name: 'Tour Guide', look: 'gym-guide', facing: 'right', lines: ['Stay together, please! We left with twelve. We are now, let me see, four, and a very good four.', 'On your left, reeds. On your right, reeds. There will be time for questions at the end.'], beat: { everyMs: 2200, glances: ['right', 'left'] }, calls: ['Stay together, please!', 'On your left, reeds.'] },
        { x: 20, y: 36, name: 'Tourist', look: 'woman', facing: 'left', lines: ['It said rare and exotic in the brochure. Is that what that was?', 'My husband went to see about a toilet, by the second pool. On Tuesday.'], beat: { everyMs: 3100, glances: ['left', 'right'] } },
        { x: 21, y: 37, name: 'Tourist', look: 'bald-man', facing: 'left', lines: ['Lovely. Lovely. Do they do a tea?', 'I am in it for the sandwiches. I am not sure anyone else on this tour is still alive.'], beat: { everyMs: 2900, glances: ['left', 'down'] } },
        { x: 23, y: 37, name: 'Tourist', look: 'little-girl', facing: 'left', lines: ['We saw a very big one and it looked at us and Mr Dobbs is not with us now.', 'I am going to be a warden.'], beat: { everyMs: 1900, glances: ['left', 'up'] }, calls: ['Can I keep it?'] },
        { x: 18, y: 58, name: 'Mr Dobbs', look: 'gentleman', facing: 'up', lines: ['Excuse me. Is this the tour? I only stepped away for a moment.', 'They said to follow the flag. It was a very large flag. It may have been a Pinsir.'], beat: { everyMs: 2600, glances: ['up', 'left'] }, calls: ['Is this the tour?'] },
        { x: 47, y: 41, name: 'Pool Angler', look: 'fisherman', facing: 'down', lines: ['Long and blue, and it looks at you. I have seen it twice. I know how that sounds.', 'Nothing bites in here. Something watches, though, and I would rather that than nothing.'], beat: { everyMs: 3800, glances: ['down', 'right'] }, calls: ['There! No.'] },
        { x: 30, y: 52, name: 'Wallow Hand', look: 'black-belt', facing: 'up', lines: ['My job is to turn them over. They like it. They do not say so, but you are still here, so.', 'Do not run. They cannot see you till you run. Then they cannot see anything else.'], beat: { everyMs: 3000, glances: ['up', 'left'] } },
        { x: 56, y: 29, name: 'Head Ranger', look: 'cooltrainer', facing: 'left', lines: ['Two rangers for the whole marsh, and one of them is Moss, who thinks he is a Pokémon.', 'The east track is the quick way out. It is quick because nobody has ever told it about the reeds.'], beat: { everyMs: 3400, glances: ['left', 'down'] }, calls: ['Sign the book!'] },
        { x: 58, y: 27, name: 'Trainee Ranger', look: 'picnicker', facing: 'left', lines: ['I am learning to read the tracks. These ones say Head Ranger went that way, in a hurry.', 'These ones say I should have gone with him.'], beat: { everyMs: 2300, glances: ['left', 'up'] } },
      ],
      trainers: [
        { x: 32, y: 40, name: 'Poacher Vince', team: 'collier', look: 'rocker', facing: 'left', sight: 0, lines: ['Never seen that Scyther before in my life. Whose sack is this? Yours, is it? It had better be.'] },
        {
          x: 40,
          y: 33,
          name: 'Ranger Moss',
          team: 'scout',
          look: 'camper',
          facing: 'left',
          sight: 3,
          lines: ["The ranger's track is mine to keep. Show me what you caught!"],
        },
      ],
    },
  });
  const rested = withInside(file, 'safari', 'warden-house', 27, 26, 'The Rest House', [
    { x: 4, y: 2, name: 'Warden’s Wife', look: 'woman', facing: 'down', lines: ['Tea? Everybody comes in here wet and tells me about the one that got away.', 'Nobody has ever told me about one that stayed.'] },
    { x: 7, y: 7, name: 'Wet Birder', look: 'cameraman', facing: 'left', lines: ['Three weeks I have been here, and I have a very good picture of some reeds.'] },
  ]);
  return {
    file: withInside(rested, 'safari', 'shed', 33, 26, 'The Property Office', [
      { x: 2, y: 5, name: 'Lost Uncle', look: 'old-man', facing: 'down', lines: ['I was handed in on a Wednesday. They have been very good about it.', 'Nobody has claimed me yet. There is a form, and I am told it is in the marsh.'] },
    ], { itemSpots: [{ x: 7, y: 5, hidden: true }] }),
    notes: p.notes,
    limits: planLimits(GREYSTONE_VALE),
  };
}
