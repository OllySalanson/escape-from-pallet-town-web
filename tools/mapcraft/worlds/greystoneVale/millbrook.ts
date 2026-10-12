/**
 * MILLBROOK, Greystone Vale's village and front door.
 *
 * The one idea: every road starts here. Four roads meet at a paved square with
 * a fountain - the Westward Road in from the west, the drove road down from the
 * moor, the road east over the brook to The Crossing, and the lane south along
 * the brook to the marsh - and everything else is what a mill village has on
 * those roads: the mill on its race under the mill pond, cottages along the
 * Westward Road, allotments, a market on the square, and the ground falling
 * away south of the square in short terraces to a quiet meadow.
 *
 * Planned before it was drawn, in this order: the roads and where each ends;
 * the brook (it rises in the mill pond and pools at the foot of the village,
 * because a district's water cannot leave by its sealed edge); the masses of
 * wood that frame it; then one thing worth seeing in each part.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function millbrook(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'millbrook');

  // -- The ground the village stands on, carved out of the wood ------------
  p.meadow(22, 6, 14, 18); // north: the drove road and its field
  p.meadow(36, 4, 20, 20); // the mill and its pond
  p.meadow(4, 22, 56, 20); // the middle band the Westward Road and the east road cross
  p.meadow(22, 42, 20, 16).meadow(42, 46, 12, 12); // south: the terraces and meadow, and the brook's pool
  p.meadow(46, 42, 6, 4); // the orchard's way down to the pool's east bank
  p.meadow(8, 10, 8, 6); // a clearing hidden in the north-west wood

  // -- The roads, every end at something -----------------------------------
  p.road([[0, 30], [24, 30]]); // the Westward Road, in to the square
  p.road([[30, 0], [30, 24]]); // the drove road, down from the moor to the square
  p.road([[38, 30], [62, 30]]); // the east road, over the brook to The Crossing
  p.road([[36, 38], [36, 44], [40, 44], [40, 52]]); // the lane south, along the brook...
  p.trail([[40, 52], [40, 62]]); // ...fading into the path to the marsh
  p.road([[48, 22], [48, 30]]); // the mill lane, up from the east road
  p.trail([[12, 16], [12, 22]]); // a path into the north-west wood's clearing

  // -- The square: paved, a fountain where the drove road meets it ----------
  // You land among the market, under the fountain with a stall on every other
  // side, so whichever way you set off something answers within a few steps.
  p.block(24, 24, 14, 14, 'P');
  p.building('stone-fountain', 29, 28, { lot: 'P' });
  p.building('bench', 25, 32, { lot: 'P' });
  p.building('market-stall', 33, 32, { lot: 'P' });
  p.building('striped-stall', 28, 34, { lot: 'P' });
  p.bushes([24, 24], [37, 24], [24, 37], [37, 37]);

  // -- The brook and the mill ----------------------------------------------
  p.blob(48, 9, 6.5, 3.5, 'W'); // the mill pond under the north wood
  p.river([[44, 10], [44, 50]], { width: 2 }); // the race, then the brook down the village
  p.pond(42, 50, 8, 6); // where the brook pools at the foot of the village
  p.block(44, 29, 2, 4, 'w'); // the east road fords the brook: no bridge on this sheet spans it east to west
  p.building('timber-house', 47, 15); // the mill, on the race
  p.block(46, 20, 8, 2, 'd'); // the mill yard
  p.building('barrels', 52, 16).building('sack', 52, 19).building('crates', 50, 22, { lot: 'd' });
  p.wood(54, 4, 6, 8); // the wood behind the mill pond

  // -- The north field beside the drove road -------------------------------
  p.bedRows([8, 23, 27], [9, 22, 27], [10, 22, 28], [11, 22, 28], [12, 23, 28], [13, 22, 27], [14, 23, 26]);
  p.fenceLine([[29, 6], [29, 20]], { gaps: [[29, 12]] }); // the field's fence, a gate halfway
  p.wood(36, 4, 4, 6).wood(38, 10, 2, 2); // a copse between the road and the mill pond
  p.wood(34, 16, 2, 2); // a lone tree where the drove road comes into the village
  p.wood(32, 6, 2, 2).wood(32, 10, 2, 2); // the drove road's avenue
  p.road([[36, 22], [40, 22], [40, 13]]); // the footpath up the brook to the mill pond...
  p.building('bench', 37, 12); // ...and a bench at its end

  // -- The Westward Road: cottages, and allotments across the road ----------
  p.building('house-door', 6, 24);
  p.building('orange-house', 15, 25);
  p.road([[8, 28], [8, 28]]).road([[16, 29], [16, 29]]); // the cottages' paths to the road
  p.flowers([6, 28], [10, 28], [15, 29], [18, 29]);
  p.yard(6, 34, 14, 8, { gates: [[12, 34]], inner: '.' }); // the allotments
  for (const x of [8, 10, 14, 16]) for (let y = 36; y <= 39; y += 1) p.building(x < 12 ? 'yellow-crop' : 'red-crop', x, y);
  p.building('shed', 20, 18);
  p.wood(4, 42, 18, 20); // the south-west wood
  p.wood(4, 22, 2, 8).wood(4, 32, 2, 10); // the wood steps in behind the first cottage and the allotments

  // -- East of the brook: a cottage and its paddock --------------------------
  p.building('grey-house', 55, 23); // the miller's house, facing the east road
  p.road([[57, 27], [57, 28]]);
  p.yard(52, 40, 8, 6, { gates: [[54, 40]], inner: 'g' }); // a paddock gone to grass
  for (const [x, y] of [[48, 34], [52, 34], [56, 34], [50, 36], [54, 36]] as const) p.wood(x, y, 2, 2); // the orchard above it
  p.wood(56, 46, 6, 16).wood(46, 56, 10, 6); // the south-east wood

  // -- South of the square: terraces down to a quiet meadow ---------------
  // Short ledges anchored on whole trees and a bush, the gaps staggered, so the
  // quick way down to the meadow is two hops and the way back up is the lane.
  p.wood(20, 40, 2, 2).ledge(22, 27, 41).wood(28, 40, 2, 2).ledge(30, 33, 41).bushes([34, 41], [35, 41]);
  p.wood(22, 44, 2, 2).ledge(24, 29, 45).bushes([30, 45]).ledge(31, 34, 45).bushes([35, 45]);
  p.wood(26, 52, 2, 2); // a lone tree in the meadow
  p.bedRows([50, 30, 35], [51, 29, 36], [52, 30, 36], [53, 31, 35]); // grass on the way to the pool
  p.bedRows([54, 22, 27], [55, 22, 29], [56, 23, 30], [57, 24, 28]); // the wild edge where the village gives way to the marsh
  p.bedRows([46, 50, 53], [47, 50, 53], [48, 51, 53], [56, 42, 47], [57, 44, 49]); // reeds round the pool
  p.flowers([24, 48], [25, 49], [27, 48]);

  const file = districtFile(GREYSTONE_VALE, 'millbrook', p, {
    dropIns: [{ x: 30, y: 32, name: 'Mill Square', description: 'The square where every road in the vale starts.' }],
    itemSpots: [{ x: 10, y: 12 }, { x: 33, y: 54 }, { x: 57, y: 43, hidden: true }],
    extra: {
      signs: [
        { x: 23, y: 29, lines: ['MILLBROOK', 'West: the Westward Road. North: the moor. East: The Crossing. South: Reedmere.'] },
        { x: 6, y: 29, lines: ['Westward Road', 'Millbrook, and the vale beyond.'] },
      ],
      people: [
        { x: 47, y: 21, name: 'Miller', look: 'worker', facing: 'down', lines: ['The race turns the wheel all year.', 'The brook runs out under the village and pools by the south lane.'] },
        { x: 36, y: 33, name: 'Trader', look: 'woman', facing: 'left', lines: ['Fresh from the orchards over the brook.', 'The road east fords the brook on its way to The Crossing.'] },
        { x: 27, y: 30, name: 'Ada', look: 'little-girl', facing: 'right', lines: ['There is a cave up in the peaks. Mum says it goes all the way to the sea.'] },
      ],
      landmarks: [{ x: 21, y: 22, name: 'Tool Shed', kind: 'shed' }],
    },
  });
  return { file, notes: p.notes };
}
