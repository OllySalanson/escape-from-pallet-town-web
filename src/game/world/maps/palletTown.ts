import { MapSketch } from '../mapGrid';

/**
 * Pallet Town - "The Cordon". 32x44, the shipped footprint, not one tile bigger.
 *
 * The rule of the map is fences. Water says no absolutely, a hedge says no, and
 * a fence says no *except at the gate* - so the gate is where the decision
 * lives. Tall grass goes inside the plots and never in the lanes, so every lane
 * is fast and clean and every plot costs encounters: the player reads the price
 * off the ground.
 *
 * Authored skeleton-first. The map starts solid hedge, lanes are carved as
 * polylines so the network is connected by construction, then plots are cut off
 * them. `approvedDesign.test.ts` pins the result against the approved design.
 */
export function sketchPalletTown(): MapSketch {
  const map = new MapSketch({ width: 32, height: 44, fill: 'T', sealBorder: true });

  // 1. Town Square and the Market Ring. The ring is a C, not a loop - its
  // north-west corner is hedge - so the four gates are a real commitment
  // rather than a rotation.
  map.lane([[3, 2], [11, 2], [11, 10], [3, 10], [3, 3]]);
  map.set(3, 2, 'T');
  map.pen(4, 3, 10, 9, 'P');
  map.set(8, 3, ',');
  map.set(6, 9, ',');
  map.set(4, 5, ',');
  map.set(10, 7, ',');
  map.set(7, 6, 'I');
  map.set(6, 11, 'T');

  // 2. The Well Verge: a pocket off the west gate holding the Town Pump.
  map.rect(1, 4, 2, 9, '.');
  map.set(2, 5, 'T');
  map.set(1, 7, 'T');
  map.set(2, 8, 'T');
  map.set(1, 4, '*');

  // 3. The Orchard: four tall-grass aisles with staggered gaps, so crossing it
  // east is a four-turn zigzag. It is the only way east from the square.
  map.rect(13, 2, 18, 9, 'g');
  map.hLine(13, 18, 3, 'T');
  map.set(17, 3, 'g');
  map.hLine(13, 18, 5, 'T');
  map.set(14, 5, 'g');
  map.hLine(13, 18, 7, 'T');
  map.set(17, 7, 'g');
  map.hLine(13, 18, 9, '.');
  map.set(14, 9, 'T');
  map.set(16, 9, 'T');
  map.vLine(12, 2, 10, 'F');
  map.set(12, 6, ',');

  // 4. The Millpond and its ledges.
  map.rect(19, 2, 26, 8, 'W');
  map.set(21, 9, 'W');
  map.set(22, 9, 'W');
  map.hLine(19, 20, 9, '.');
  map.hLine(23, 26, 9, '.');

  // 5. East Walk: a serpentine through the north-east.
  map.lane(
    [[27, 9], [27, 8], [28, 8], [28, 6], [27, 6], [27, 4], [28, 4], [28, 2], [30, 2], [30, 4], [29, 4]],
    '.',
  );
  map.lane([[30, 4], [30, 9]], '.');
  map.set(29, 6, '.');
  map.set(29, 8, '.');

  // 6. Mill Lane: the east-west artery, broken four times so it is a sequence
  // of rooms rather than a corridor.
  map.lane([[13, 10], [30, 10]]);
  for (const x of [17, 21, 25, 29]) {
    map.set(x, 10, 'T');
  }
  for (const x of [13, 15, 18, 19, 20, 23, 24, 26, 30]) {
    map.lane([[x, 9], [x, 10]]);
  }

  // 7. The Sheds: two one-door caches and two two-door shortcuts. Reaching the
  // Allotments without them costs 35 steps instead of 23.
  map.lane([[1, 11], [9, 11]]);
  for (const x of [1, 2, 3, 6]) {
    map.set(x, 11, 'T');
  }
  map.lane([[4, 10], [4, 11]]);
  map.lane([[5, 11], [5, 15]]);
  map.lane([[1, 15], [9, 15]]);
  map.set(1, 15, 'T');
  map.set(2, 15, 'T');
  map.pen(1, 12, 4, 14, '.');
  map.set(4, 13, ',');
  map.pen(6, 12, 9, 14, '.');
  map.set(7, 12, ',');
  map.set(9, 13, ',');
  map.pen(1, 16, 4, 18, '.');
  map.set(3, 16, ',');
  map.pen(6, 16, 9, 18, '.');
  map.set(7, 16, ',');
  map.set(7, 18, ',');

  // 8. Chapel Lane: a fast spine, cut once in the middle, so its two halves are
  // different sides of the Green rather than a detour.
  map.lane([[10, 11], [10, 19]]);
  map.set(10, 13, 'T');
  map.lane([[9, 11], [10, 11]]);
  map.lane([[9, 15], [10, 15]]);

  // 9. The Green: a fenced paddock with offset cells inside it.
  map.rect(11, 11, 18, 18, 'F');
  map.rect(12, 12, 17, 17, 'g');
  map.hLine(12, 17, 14, 'F');
  map.set(15, 14, 'g');
  map.vLine(14, 15, 17, 'F');
  map.set(14, 16, 'g');
  map.set(13, 11, ',');
  map.set(18, 13, ',');
  map.set(11, 16, ',');
  map.set(16, 18, ',');
  map.set(12, 18, ',');
  map.lane([[13, 10], [13, 11]]);

  // 10. The East Pens.
  map.lane([[19, 10], [19, 18]]);
  map.lane([[19, 13], [18, 13]]);
  map.lane([[19, 15], [30, 15]]);
  map.set(27, 15, 'T');
  map.lane([[24, 10], [24, 15]]);
  map.lane([[30, 10], [30, 15]]);
  map.set(30, 8, 'T');
  map.pen(20, 11, 23, 14, 'g');
  map.set(23, 13, ',');
  map.pen(25, 11, 28, 14, 'g');
  map.set(26, 10, ',');
  map.set(26, 11, ',');
  map.set(28, 14, ',');
  map.pen(20, 16, 24, 18, 'g');
  map.set(20, 17, ',');
  map.pen(26, 16, 30, 18, 'g');
  map.set(26, 17, ',');
  map.set(28, 16, ',');

  // 11. The Allotments: thirteen tall-grass strips with eleven staggered gaps,
  // and all the caches. Same step count to the ford line as the East Copse and
  // a completely different kind of walk.
  map.rect(1, 19, 21, 27, 'F');
  for (const y of [20, 22, 24, 26]) {
    map.hLine(1, 20, y, 'g');
  }
  for (const [y, xs] of [
    [20, [6, 14]],
    [22, [3, 10, 17]],
    [24, [6, 14]],
    [26, [3, 10, 17]],
  ] as const) {
    for (const x of xs) {
      map.set(x, y, 'F');
    }
  }
  for (const [y, xs] of [
    [21, [2, 8, 12, 19]],
    [23, [2, 5, 9, 13, 18]],
    [25, [2, 8, 12, 15, 19]],
  ] as const) {
    for (const x of xs) {
      map.set(x, y, 'g');
    }
  }
  for (const x of [7, 10, 12, 16]) {
    map.set(x, 19, ',');
  }
  for (const x of [8, 16]) {
    map.set(x, 27, ',');
  }
  map.set(21, 26, ',');

  // 12. The East Copse: a winding track with no tall grass on it at all - and
  // no cover either. The Mill Stair opens off its east loop.
  map.lane([[22, 26], [22, 19], [25, 19], [25, 16]]);
  map.lane([[25, 19], [25, 21], [27, 21], [27, 24], [25, 24], [25, 27]]);
  map.lane([[22, 24], [25, 24]]);
  map.lane([[27, 21], [30, 21]]);
  map.raw(31, 20, 'X');
  map.set(30, 20, 'X');
  map.lane([[27, 24], [29, 24], [29, 26], [27, 26], [25, 26]]);

  // 13. The Leat: water across the whole map with three staggered fords.
  map.rect(1, 28, 30, 30, 'W');
  map.lane([[8, 28], [8, 29], [7, 29], [7, 30], [7, 31]]);
  map.lane([[16, 28], [16, 29], [15, 29], [15, 30], [15, 31]]);
  map.lane([[25, 28], [25, 29], [24, 29], [24, 30], [24, 31]]);

  // 14. The south bank, the Flood, and the west stairs.
  map.lane([[2, 31], [30, 31]]);
  for (const x of [10, 17, 21, 26, 29]) {
    map.set(x, 31, 'T');
  }
  map.rect(1, 33, 5, 40, 'W');
  map.raw(0, 32, 'X');
  map.set(1, 32, 'X');
  map.lane([[1, 32], [2, 32]]);
  map.lane([[2, 32], [2, 31]]);
  map.set(28, 31, '*');
  map.lane([[6, 31], [6, 32], [7, 32], [7, 36], [6, 36], [6, 41], [7, 41], [7, 42]]);

  // 15. The Stockyard: two staggered rows of pens. The only two lateral ways
  // across it run through tall-grass pens.
  map.lane([[6, 32], [28, 32]]);
  for (const x of [11, 17, 23]) {
    map.set(x, 32, 'T');
  }
  map.lane([[8, 37], [28, 37]]);
  for (const x of [13, 24]) {
    map.set(x, 37, 'F');
  }
  map.lane([[2, 42], [30, 42]]);
  for (const x of [6, 12, 21, 26]) {
    map.set(x, 42, 'T');
  }
  for (const x of [8, 14, 20, 26]) {
    map.lane([[x, 32], [x, 37]]);
  }
  for (const x of [10, 16, 22, 28]) {
    map.lane([[x, 37], [x, 42]]);
  }
  map.pen(9, 33, 13, 36, 'g');
  map.set(9, 35, ',');
  map.pen(15, 33, 19, 36, 'g');
  map.set(15, 34, ',');
  map.pen(21, 33, 25, 36, 'g');
  map.set(21, 35, ',');
  map.pen(11, 38, 15, 41, 'g');
  map.set(11, 39, ',');
  map.set(15, 39, ',');
  map.pen(17, 38, 21, 41, 'g');
  map.set(17, 40, ',');
  map.pen(23, 38, 27, 41, 'g');
  map.set(23, 39, ',');
  map.set(27, 39, ',');
  map.lane([[2, 41], [7, 41]]);

  // 16. South Orchard: the south-east serpentine down to the South Gate.
  map.lane([
    [30, 31], [30, 33], [29, 33], [29, 35], [30, 35], [30, 38], [29, 38], [29, 40], [30, 40], [30, 42],
  ]);
  map.raw(15, 43, 'X');
  map.set(15, 42, 'X');

  // 17. Surfacing: dirt on the arteries, grass everywhere else.
  for (const region of [
    [1, 11, 9, 18],
    [27, 2, 30, 9],
    [19, 9, 26, 9],
    [22, 19, 30, 27],
    [27, 31, 30, 42],
    [1, 41, 7, 42],
  ] as const) {
    map.resurface(region, ',', '.');
  }

  // 18. Content: the objective, the caches, the landmarks and the townsfolk.
  map.set(13, 24, 'O');
  for (const [x, y] of [
    [2, 13], [2, 17], [21, 12], [29, 17], [1, 20], [1, 26], [10, 34], [18, 39], [24, 39], [29, 25], [13, 2],
  ] as const) {
    map.set(x, y, 'L');
  }
  map.set(15, 30, 'H');
  map.set(22, 21, 'H');
  map.set(9, 4, 'S');
  map.set(1, 5, 'S');
  map.set(5, 7, 'N');
  map.set(19, 9, 'N');

  return map;
}
