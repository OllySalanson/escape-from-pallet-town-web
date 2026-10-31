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
 */
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
  'TTTTTTTgTTT.g......dddd.gggggTTT',
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
  p.blob(22, 15, 5.2, 6.4, 'W'); // the long pool by the north road
  p.blob(45, 45, 5.6, 6.6, 'W'); // the big pool south of the east road
  p.blob(49, 14.5, 3.6, 2.8, 'W'); // the pond by the north-east hut

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

  const file = districtFile(GREYSTONE_VALE, 'safari-marsh', p, {
    // The power station's far side is past the hunter's blind window from
    // every other way out now its stand-in into the marsh is gone
    // (`hunterFlee.test.ts`): the wardens' stile by the north road covers it.
    exits: [{ x: 29, y: 4, name: "Wardens' Stile", opens: { when: 'always' } }],
    dropIns: [{ x: 30, y: 32, name: 'Rest House', description: "The rest house in the middle of the reserve, the dry ground a raid stops at." }],
    itemSpots: [{ x: 26, y: 56, hidden: true }, { x: 50, y: 24 }, { x: 11, y: 44 }],
    extra: {
      districts: [{ name: 'THE SAFARI GATE', x: 2, y: 34, width: 12, height: 14, wildlife: 'safari' }],
      signs: [
        { x: 13, y: 38, lines: ['SAFARI MARSH', "A warden's reserve. Keep to the paths; the reeds are full."] },
        { x: 13, y: 42, lines: ['TICKETS', 'Free. There used to be a charge. There used to be a lot of things.'] },
        { x: 26, y: 33, lines: ['REST HOUSE', 'Tea. Dry socks. No catching on the furniture.'] },
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
        { x: 18, y: 57, species: 'nidoran-f', level: 10 },
        { x: 4, y: 46, species: 'rattata', beat: { everyMs: 1400, roam: [[1, 0]] } },
        { x: 12, y: 43, species: 'venonat', level: 11 },
        { x: 33, y: 34, species: 'doduo', beat: { everyMs: 1500, roam: [[1, 0]] } },
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
      ],
      trainers: [
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
  return {
    file: withInside(file, 'safari', 'warden-house', 27, 26, 'The Rest House', [
      { x: 4, y: 2, name: 'Warden’s Wife', look: 'woman', facing: 'down', lines: ['Tea? Everybody comes in here wet and tells me about the one that got away.', 'Nobody has ever told me about one that stayed.'] },
      { x: 7, y: 7, name: 'Wet Birder', look: 'cameraman', facing: 'left', lines: ['Three weeks I have been here, and I have a very good picture of some reeds.'] },
    ]),
    notes: p.notes,
    limits: planLimits(GREYSTONE_VALE),
  };
}
