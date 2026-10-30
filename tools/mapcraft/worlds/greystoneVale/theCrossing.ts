/**
 * THE CROSSING, where the vale's river is crossed.
 *
 * The one idea: the river splits the vale, and there are two ways over it,
 * each a different walk. The trail down from the peaks follows the river's
 * east bank to the stone bridge, under the bridge-keeper's cottage, where the
 * road from Millbrook comes over and runs on to Tanglewood. Below the bridge
 * the river opens into the Wide Water, where the herons stand; a path down
 * the west bank takes the stepping stones at its foot and goes on east
 * through the trees, a way nobody signs.
 *
 * It is drawn as FireRed draws a route, and as High Moor learned to: a
 * valley about twenty tiles wide between walls of wood, with the river and
 * the road winding down it round the things in their way. A wide-open valley
 * read to blind judges as "an open field with roads along its edges".
 *
 * What five rounds of blind judging taught it: a river drawn straight reads
 * as a canal and one drawn in big square bends reads as "a staircase of
 * rectangles", but one that steps in and out in short jogs reads as a river;
 * a pale square of FireRed's shallow water in it reads as a mistake, so there
 * is no ford; and roads ruled across the map meeting at right angles read as
 * a diagram.
 *
 * The bridge and the stepping stones are stone laid over the water: no bridge
 * on the FireRed sheet spans a river from west to east.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function theCrossing(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'the-crossing');

  // -- The valley, between walls of wood and the peaks' cliff ----------------------
  p.meadow(22, 4, 20, 56);
  p.wood(22, 56, 6, 4);
  p.rock(18, 4, 10, 6).rock(18, 10, 6, 6).rock(18, 16, 4, 8); // the west bank is the peaks' cliff, stepping back

  // -- The river: one long bend west under the cliff, out under the bridge, --------
  // -- into the Wide Water in the corner of the wood, and one reach on down. --------
  p.river([[28, 0], [28, 10], [24, 10], [24, 34]], { width: 4 });
  p.blob(27, 39, 5.5, 4.2, 'W'); // the Wide Water
  p.river([[28, 42], [28, 63]], { width: 4 });

  // -- Tall grass on the banks, in beds -----------------------------------------------
  p.bedRows([4, 32, 37], [5, 32, 37], [6, 32, 36], [7, 33, 36]);
  p.bedRows([9, 32, 36], [10, 32, 36], [11, 32, 36], [12, 32, 35], [13, 32, 35]);
  p.bedRows([15, 28, 33], [16, 28, 33], [17, 28, 33], [18, 29, 33], [19, 29, 32]);
  p.bedRows([16, 22, 23], [17, 22, 23], [18, 22, 23], [19, 22, 23], [20, 22, 23], [21, 22, 23]);
  p.bedRows([22, 29, 33], [23, 28, 33], [24, 28, 33], [25, 28, 33], [26, 28, 32], [27, 30, 32]);
  p.bedRows([34, 33, 35], [35, 33, 35], [36, 34, 35], [37, 34, 35], [38, 34, 35], [39, 34, 35]);
  p.bedRows([45, 22, 25], [46, 22, 26], [47, 22, 26], [48, 22, 26], [49, 23, 26]);
  p.bedRows([45, 33, 37], [46, 32, 37], [47, 32, 37], [48, 33, 37], [49, 33, 36]);
  p.bedRows([36, 39, 41], [37, 39, 41], [38, 40, 41], [41, 41, 41], [42, 41, 41], [43, 41, 41], [44, 41, 41]);

  // -- The wood comes down to the trail and turns it; the cottage below -------------
  p.wood(38, 18, 4, 8); // the wood comes down to the trail and turns it
  p.building('cottage', 37, 27);
  p.flowers([36, 28], [36, 29], [42, 28]);

  // -- The bridge -------------------------------------------------------------------
  p.block(23, 30, 6, 3, 'M');

  // -- The stepping stones, and the heron hide in a clearing at their east end ----------
  p.block(28, 52, 4, 2, 'M');
  p.building('shed', 34, 54);
  p.flowers([33, 57], [38, 56], [39, 57]);
  p.wood(38, 58, 4, 2).wood(40, 50, 2, 6);

  // -- The West Bank: the road in from Millbrook comes out of the trees to a place ---
  // A carter's yard on the north of the road, a rest for the horses on the south,
  // and a clearing on the lane down to the stones where somebody cuts the withies.
  p.meadow(4, 24, 12, 6).meadow(4, 34, 10, 6);
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
  p.road([[46, 0], [46, 6], [38, 6], [38, 16], [34, 16], [34, 29]], { width: 3 }); // down from the peaks, round their rock
  p.road([[0, 30], [20, 30]], { width: 3 }); // in from Millbrook to the bridge...
  p.road([[29, 30], [44, 30], [44, 32], [62, 32]], { width: 3 }); // ...over it, past the cottage door, on to Tanglewood
  p.road([[36, 33], [36, 40], [38, 40], [38, 48], [46, 48], [46, 62]], { width: 3 }); // along the Wide Water and south to the strand
  p.trail([[16, 33], [16, 52], [27, 52]]); // a lane through the wood to the stepping stones...
  p.road([[32, 52], [61, 52]]); // ...over them, past the hide, and away east through the trees
  p.road([[35, 54], [35, 54]]); // the hide's door

  const file = districtFile(GREYSTONE_VALE, 'the-crossing', p, {
    dropIns: [{ x: 40, y: 56, name: 'Stepping Stones', description: 'By the heron hide at the foot of The Crossing, over the stepping stones from the west bank.' }],
    itemSpots: [{ x: 34, y: 12 }, { x: 41, y: 38 }, { x: 24, y: 54, hidden: true }, { x: 15, y: 45, hidden: true }],
    extra: {
      signs: [
        { x: 22, y: 29, lines: ['THE CROSSING', 'Over the bridge: Tanglewood. North: the peaks. South: the strand.'] },
        { x: 39, y: 33, lines: ['North: GREYSTONE PEAKS', 'South: GULL STRAND.'] },
        { x: 2, y: 32, lines: ['THE CROSSING', 'West: Millbrook and the Mill Square.'] },
        { x: 15, y: 29, lines: ['THE WEST BANK', 'Bridge ahead. Carters give way to nobody. Do not stand behind the Ponyta.'] },
        { x: 46, y: 58, lines: ['The road south', 'Down to Gull Strand and the sea.'] },
      ],
      // A Slowpoke dozing where the river comes out of the gorge, and a
      // Psyduck on the Wide Water's bank.
      pokemon: [
        { x: 11, y: 37, species: 'ponyta', level: 8, beat: { everyMs: 2700, roam: [[0, -1]] } },
        { x: 5, y: 27, species: 'rattata', level: 5, beat: { everyMs: 1500, roam: [[0, -1]] } },
        { x: 23, y: 26, species: 'poliwag', beat: { everyMs: 2100, roam: [[0, -1]] } },
        { x: 33, y: 8, species: 'slowpoke', level: 9 },
        { x: 33, y: 43, species: 'psyduck', level: 8 },
        { x: 36, y: 13, species: 'spearow', level: 8 },
      ],
      people: [
        { x: 9, y: 29, name: 'Carter', look: 'heavy-man', facing: 'down', lines: ['Everything Millbrook sells comes over that bridge, and I have carried all of it.', 'My back would like a word with the people who built a village on the wrong side of a river.'], beat: { everyMs: 3300, roam: [[1, 0], [2, 0]], glances: ['right'] }, calls: ['Mind your backs!'] },
        { x: 8, y: 37, name: 'Ostler', look: 'straw-hat', facing: 'right', lines: ['That Ponyta bites. No, it does not. It burns. I do not know why I said bites.'], beat: { everyMs: 3500, glances: ['up', 'down'] }, calls: ['Steady! Steady there!'] },
        { x: 14, y: 46, name: 'Withy Cutter', look: 'old-woman', facing: 'up', lines: ['Baskets, hurdles, the odd eel trap. It all comes out of this bed.', 'Your lane there runs down to the stones. Keep your feet.'], beat: { everyMs: 2900, glances: ['left'] }, calls: ['Baskets! Good baskets!'] },
        { x: 26, y: 45, name: 'Angler', look: 'fisherman', facing: 'up', lines: ['The herons take the best of the Wide Water.', 'Down the bank there are stepping stones, if you keep your feet.'] },
        { x: 52, y: 35, name: 'Peddler', look: 'heavy-man', facing: 'up', lines: ['East is Tanglewood. I go round it, myself.', 'Folk who leave that road come out a day later.'] },
      ],
      trainers: [
        { x: 31, y: 29, name: 'Netter Bryn', team: 'netter', look: 'fisherman', facing: 'down', sight: 0, lines: ['The bridge is my spot!', 'Let us see what you have caught.'] },
      ],
      berryTrees: [{ x: 5, y: 38, berry: 'pecha' }],
      landmarks: [{ x: 36, y: 58, name: 'Heron Hide', kind: 'hide' }],
    },
  });
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}
