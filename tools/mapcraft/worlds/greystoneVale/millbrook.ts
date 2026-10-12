/**
 * MILLBROOK, Greystone Vale's village and front door.
 *
 * The one idea: every road starts here. Four roads meet at Mill Square - the
 * Westward Road in from the west, the drove road down from the moor, the road
 * east to The Crossing and the lane south to the marsh - and the village is
 * what a FireRed town is on those roads: a street loop with every house facing
 * a street, the Pokemon Center on the square, the mill on its pond, gardens
 * behind fences, rows of trees between the blocks, and a deep wood round all
 * of it. Along the foot of the village the ground drops a step to a quiet
 * meadow, as Viridian's does: one ledge line from the wood to the lane.
 *
 * Drawn in FireRed's pieces only (Kanto's buildings, the town pieces cut from
 * pret, the FireRed sheet's fountain, stall, planters and signs): the first
 * draw used the CC0 sheet's fountain, stalls and timber mill, and two blind
 * judges both named them as another game's props on FireRed ground
 * (`docs/screens/greystone-vale/README.md`).
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function millbrook(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'millbrook');

  // -- The village, carved out of the wood ------------------------------------
  // A frame six tiles deep on every side, notched so it is not a ruled box.
  p.meadow(6, 8, 52, 48);
  p.wood(6, 8, 4, 2).wood(54, 8, 4, 4).wood(6, 52, 2, 4).wood(56, 50, 2, 6);

  // -- The streets: a loop, every end at something ------------------------------
  p.road([[0, 30], [5, 30]]); // the Westward Road, in through the wood...
  p.road([[6, 30], [25, 30]], { letter: 'P' }); // ...and the west street to the square
  p.road([[30, 0], [30, 7]]); // the drove road, down from the moor...
  p.road([[30, 8], [30, 25]], { letter: 'P' }); // ...and the north street to the square
  p.road([[36, 30], [57, 30]], { letter: 'P' }); // the east street...
  p.road([[58, 30], [62, 30]]); // ...and the road on to The Crossing
  p.road([[10, 30], [10, 18], [29, 18]], { letter: 'P' }); // the west loop, behind the cottages
  p.road([[32, 22], [50, 22], [50, 29]], { letter: 'P' }); // the east loop, past the mill
  // The south street leaves the square and ends where it is going: at the
  // purple house one way and the Mart's forecourt the other.
  p.road([[34, 36], [34, 42], [14, 42]], { letter: 'P' });
  p.road([[36, 42], [47, 42]], { letter: 'P' });
  p.road([[40, 44], [40, 62]]); // the lane south to the marsh

  // -- Mill Square: the fountain where the drove road meets the street --------
  p.block(26, 26, 10, 10, 'P');
  p.building('round-fountain', 29, 27, { lot: 'P' });
  // You land under the fountain with a planter either side and the stall
  // below: whichever way you set off, something answers within a few steps.
  p.building('planter', 27, 32, { lot: 'P' }).building('planter', 33, 32, { lot: 'P' });
  p.building('market-stall', 29, 33, { lot: 'P' });
  p.bushes([26, 26], [35, 26], [26, 35]);

  // -- North-west: cottages on the loop, the allotments and the tool shed -------
  p.building('grey-house', 12, 13); // faces the loop
  p.road([[13, 16], [13, 16]], { letter: 'P' });
  p.yard(18, 9, 10, 8, { gates: [[20, 16]], inner: '.' }); // the allotments, the shed at their back
  p.flowers([19, 11], [20, 11], [21, 11], [19, 13], [20, 13], [21, 13]);
  p.building('shed', 23, 10, { lot: '.' });
  p.wood(6, 10, 4, 6).wood(6, 18, 4, 12); // the wood steps in behind the cottages

  // The block inside the west loop: two cottages on the street, a garden behind.
  p.building('house-flowers', 13, 24);
  p.building('orange-house', 20, 25);
  p.road([[21, 29], [21, 29]], { letter: 'P' });
  p.fenceLine([[12, 22], [28, 22]], { gaps: [[18, 22]] });
  p.flowers([13, 21], [14, 21], [15, 21], [24, 21], [25, 21]);
  p.wood(26, 20, 2, 2);

  // -- North-east: the mill on its pond -------------------------------------
  p.blob(46, 12, 6.5, 3.5, 'W');
  p.building('warden-house', 42, 16); // the mill: thatched, on the pond's bank
  p.road([[44, 21], [44, 21]], { letter: 'P' });
  p.flowers([48, 19], [48, 20]);
  p.wood(34, 10, 4, 4); // a copse between the drove road and the pond
  p.building('house-door', 34, 17); // the miller's house, on the loop
  p.road([[35, 21], [35, 21]], { letter: 'P' });
  p.flowers([39, 19], [40, 19], [39, 20]);

  // The block inside the east loop: the Pokemon Center facing the square's street, and a house.
  p.building('pokemon-center', 37, 25);
  p.building('cottage', 43, 26);
  p.road([[44, 29], [44, 29]], { letter: 'P' });
  p.wood(48, 24, 2, 4);
  p.wood(52, 18, 6, 10); // the wood comes in past the end of the east street

  // -- South-west: houses on the south street, a garden on the square's side --
  p.building('purple-house', 13, 36);
  p.road([[14, 40], [14, 41]], { letter: 'P' });
  p.building('blue-house', 21, 36);
  p.wood(6, 32, 6, 12); // the wood comes in past the purple house
  p.flowers([14, 33], [15, 33], [16, 33], [17, 32], [20, 33], [21, 33]);
  p.wood(24, 32, 2, 2).wood(26, 38, 6, 2);

  // -- South-east: the Mart on its forecourt, trees behind it ----------------
  p.building('poke-mart', 44, 36);
  p.block(42, 40, 8, 2, 'P'); // the Mart's forecourt, where the south street ends
  p.wood(36, 34, 4, 2);
  p.flowers([37, 37], [38, 37], [39, 38], [42, 34], [43, 34]);
  p.wood(48, 32, 4, 2);
  p.flowers([49, 35], [50, 35], [51, 36]);
  p.wood(54, 32, 4, 12).wood(50, 40, 4, 4);

  // -- The foot of the village: the brook's pool, with reeds round it ---------
  // The wood closes in on three sides; the lane south runs past its east bank.
  p.wood(6, 44, 8, 12).wood(42, 46, 16, 10).wood(14, 52, 26, 4);
  p.blob(25, 48, 7, 2.2, 'W');
  p.bedRows([46, 15, 17], [47, 14, 17], [48, 14, 16], [49, 15, 17], [51, 19, 31], [50, 32, 34], [49, 33, 35]);
  p.flowers([36, 46], [37, 47], [22, 45], [28, 45]);

  const file = districtFile(GREYSTONE_VALE, 'millbrook', p, {
    dropIns: [{ x: 30, y: 32, name: 'Mill Square', description: 'The square where every road in the vale starts.' }],
    itemSpots: [{ x: 20, y: 14 }, { x: 36, y: 50 }, { x: 52, y: 14, hidden: true }],
    extra: {
      signs: [
        { x: 12, y: 29, lines: ['MILLBROOK', 'Where every road in the vale starts.'] },
        { x: 36, y: 29, lines: ['MILL SQUARE', 'West: the Westward Road. North: the moor. East: The Crossing. South: Reedmere.'] },
        { x: 42, y: 44, lines: ['South to REEDMERE', 'Down the lane, past the pool.'] },
      ],
      people: [
        { x: 46, y: 21, name: 'Miller', look: 'worker', facing: 'down', lines: ['The pond turns the wheel all year.', 'The brook runs under the village and comes out by the south meadow.'] },
        { x: 32, y: 34, name: 'Trader', look: 'woman', facing: 'left', lines: ['Fresh from the orchards over the river.', 'The road east takes you on to The Crossing.'] },
        { x: 28, y: 29, name: 'Ada', look: 'little-girl', facing: 'right', lines: ['There is a cave up in the peaks. Mum says it goes all the way to the sea.'] },
      ],
      landmarks: [{ x: 24, y: 14, name: 'Tool Shed', kind: 'shed' }],
    },
  });
  return { file, notes: p.notes };
}
