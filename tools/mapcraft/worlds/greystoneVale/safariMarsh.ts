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
import { startDistrict } from '../../worldPlan';
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

  const file = districtFile(GREYSTONE_VALE, 'safari-marsh', p, {
    // The power station's far side is past the hunter's blind window from
    // every other way out now its stand-in into the marsh is gone
    // (`hunterFlee.test.ts`): the wardens' stile by the north road covers it.
    exits: [{ x: 29, y: 4, name: "Wardens' Stile", opens: { when: 'always' } }],
    dropIns: [{ x: 30, y: 32, name: 'Rest House', description: "The rest house in the middle of the reserve, the dry ground a raid stops at." }],
    itemSpots: [{ x: 26, y: 56, hidden: true }, { x: 50, y: 24 }, { x: 8, y: 44 }],
    extra: {
      signs: [{ x: 13, y: 38, lines: ['SAFARI MARSH', "A warden's reserve. Keep to the paths; the reeds are full."] }],
      people: [
        {
          x: 10,
          y: 42,
          name: 'Warden',
          look: 'gentleman',
          facing: 'left',
          lines: ['Welcome to the reserve.', 'Pokemon live in these reeds that you will not find anywhere else in the vale.'],
        },
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
  return { file, notes: p.notes };
}
