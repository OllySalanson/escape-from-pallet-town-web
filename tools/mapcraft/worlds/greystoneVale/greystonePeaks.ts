/**
 * GREYSTONE PEAKS, the high ground above The Crossing.
 *
 * The one idea: a pass climbs past quarry benches to the mouth of the
 * Greystone Caves, and the river is born in a tarn under the summit. The way
 * up from High Moor climbs through a cutting in a band of rock, past the tarn
 * where the river starts, round its head under the summit and down its far
 * side, squeezed between the water and the cliff the caves open in. Under the
 * cliff the quarry is worked in benches; a ledge off the upper bench is the
 * quick way back down. The pass goes on south to The Crossing, and a path
 * nobody signs leaves the quarry east into the pines.
 *
 * Drawn as the moor and the river taught: rock in masses against the walls,
 * never a ruled band or a scatter of boulders; the pass bent by the land;
 * places along the way rather than a pattern; and tall grass on the slopes
 * rather than lawn.
 *
 * The Greystone Caves open at the foot of the cliff, at the plan's spot: the
 * mouth onto their top floor, whose floors ride in Tanglewood's file
 * (`greystoneCaves.ts`).
 */
import { caveMouthSpots, plantCaveMouth } from '../../caves';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { GREYSTONE_VALE } from './plan';

export function greystonePeaks(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'greystone-peaks');

  // -- Two framed ways, the climb and the descent, with the gorge between ----------
  p.meadow(8, 4, 44, 56);

  // -- The tarn under the summit, and the gorge the river cuts from it -------------
  p.pond(18, 7, 20, 7);
  p.rock(22, 14, 6, 10).rock(24, 24, 4, 14).rock(22, 38, 6, 8).rock(24, 46, 4, 14);
  p.rock(32, 14, 4, 8).rock(32, 22, 6, 10).rock(32, 32, 4, 14).rock(32, 46, 6, 6).rock(32, 52, 4, 8);
  p.river([[28, 12], [28, 63]], { width: 4 });

  // -- The climb: the summit's shoulder, a shelf of tall grass, the cutting ----------
  p.rock(2, 4, 8, 30).rock(10, 4, 6, 8); // the climb's west wall: the summit's cliff
  p.bed(10, 12, 6, 8, { round: false });
  p.bed(18, 14, 4, 6, { round: false });
  p.rock(10, 22, 4, 6).rock(18, 22, 6, 6); // the band, from the cliff to the gorge, cut through
  p.bed(18, 28, 6, 8, { round: false });
  p.bed(10, 28, 4, 6, { round: false });
  p.rock(8, 46, 6, 8); // an outcrop on the lower slope
  p.bed(14, 40, 8, 6, { round: false });
  p.wood(16, 52, 8, 8);
  p.meadow(6, 56, 2, 2); // a nook in the wood, where the goat track goes over the hill
  // THE HIGH PASTURE: the lawn under the outcrop fenced for the ponies that
  // summer up here, a gate at each end, so the goat track's way up goes
  // through it rather than round.
  p.yard(14, 46, 10, 6, { gates: [[16, 46], [15, 51]], inner: '.' });

  // -- The cliff the caves open in, joined to the crag over the quarry ---------------
  p.rock(48, 4, 10, 6);
  p.rock(40, 8, 8, 14);
  p.block(48, 10, 10, 8, 'v'); // the upper bench, cut back into the hill
  p.building('shed', 52, 11, { lot: 'v' });
  p.building('crates', 48, 14, { lot: 'v' });
  p.meadow(52, 18, 6, 6); // the bench's foot
  p.ledge(51, 57, 18); // off the upper bench, the quick way down
  p.bedRows([19, 51, 56], [20, 52, 56]);

  // -- The descent below the cave front ------------------------------------------
  p.bed(38, 26, 6, 8, { round: false });
  p.rock(48, 26, 10, 18); // the peaks' east cliff
  p.wood(38, 38, 4, 6);
  p.bed(38, 46, 6, 6, { round: false });
  p.wood(38, 54, 6, 6).wood(48, 48, 4, 12);

  // -- The pass, drawn last so nothing cuts it ---------------------------------------
  p.road(
    [[0, 36], [14, 36], [14, 30], [16, 30], [16, 20], [16, 4], [37, 4], [37, 22], [49, 22]],
    { width: 3 },
  ); // in from High Moor, through the cutting, past the tarn, round its head, down under the cliff
  p.road([[48, 12], [48, 21]]); // up onto the upper bench
  p.road([[44, 25], [44, 46], [46, 46], [46, 62]], { width: 3 }); // on down to The Crossing
  p.trail([[52, 22], [62, 22]]); // the unsigned path east into the pines

  // -- The way underground: the Greystone Caves open at the foot of the cliff -------
  const mouth = caveMouthSpots(p, { x: 40, y: 18, width: 8, height: 6 }).find(([x]) => x === 42);
  if (!mouth) throw new Error('the cliff has no foot for a cave mouth');
  plantCaveMouth(p, mouth);
  const cave = greystoneCaves();

  const file = districtFile(GREYSTONE_VALE, 'greystone-peaks', p, {
    // A way out of the peaks' own, in a nook at the foot of the climb: the
    // pass's planned ways on are south and east, and without this the
    // hunter's blind window would not cover the walk out of the west side
    // (`hunterFlee.test.ts`), as the woods' hidden ways out answer it there.
    exits: [{ x: 6, y: 57, name: 'Goat Track', opens: { when: 'always' } }],
    dropIns: [{ x: 56, y: 13, name: 'The Quarry', description: 'The quarry bench under the crag, beside the cliff the Greystone Caves open in.' }],
    itemSpots: [{ x: 11, y: 13 }, { x: 56, y: 20 }, { x: 18, y: 47, hidden: true }],
    extra: {
      signs: [
        { x: 13, y: 38, lines: ['GREYSTONE PEAKS', 'The pass climbs through the cutting and round the head of the tarn.'] },
        { x: 20, y: 6, lines: ['THE TARN', 'The river starts here, under the summit.'] },
        { x: 17, y: 47, lines: ['THE HIGH PASTURE', 'Shut the gate behind you. The ponies wander.'] },
        { x: 44, y: 57, lines: ['THE PASS', 'Down: The Crossing. Up: the caves, the quarry and the tarn.'] },
      ],
      people: [
        { x: 21, y: 16, name: 'Climber', look: 'hiker', facing: 'right', lines: ['The river is born in this tarn. Follow it down and you come to The Crossing.'] },
        {
          x: 49,
          y: 45,
          name: 'Mountain Ranger',
          look: 'camper',
          facing: 'left',
          lines: ['Lost on the hill? The Goat Track leaves through the pasture, west of the gorge.'],
        },
      ],
      // The ponies in the pasture, and the Mankey troop that sits on the gorge's
      // edge watching whoever comes down the pass.
      pokemon: [
        { x: 19, y: 48, species: 'ponyta', level: 10 },
        { x: 21, y: 50, species: 'ponyta' },
        { x: 37, y: 34, species: 'mankey', level: 9 },
        { x: 36, y: 44, species: 'mankey' },
      ],
      // A rowan by the head of the pass.
      berryTrees: [{ x: 45, y: 5, berry: 'oran' }],
      trainers: [
        { x: 56, y: 15, name: 'Breaker Finn', team: 'breaker', look: 'black-belt', facing: 'left', sight: 0, lines: ['This quarry is closed to visitors!', 'Unless you can break through me.'] },
      ],
      landmarks: [{ x: 53, y: 15, name: 'Quarry Hut', kind: 'shed' }],
      // The floors ride in Tanglewood's file too; carried here as well, so the
      // peaks pass their checks alone, the stitcher takes them once.
      areas: cave.areas,
      links: [caveMouthLink(cave, 'peaks', mouth), ...caveLadders(cave)],
    },
  });
  return { file, notes: p.notes };
}
