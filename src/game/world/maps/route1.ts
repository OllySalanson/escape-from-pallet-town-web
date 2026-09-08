import { MapSketch } from '../mapGrid';

/**
 * Route 1 - "The Braid". 32x32, the shipped footprint.
 *
 * Its rule is neither Pallet Town's gates nor the forest's grass-only trails:
 * the route is a *braid*. Two doglegged roads run the length of the map, four
 * tall-grass cross-links tie them together, and the field systems between them
 * are open at both ends. So there is always a second way on, the roads are fast
 * and coverless, and every way of cutting between them costs encounters.
 *
 * The shipped map was the emptiest in the game - 87% walkable with a 25x25 open
 * square in it - and had no insertion of its own, reachable only by walking off
 * the bottom of Pallet Town. It is rebuilt here in place, to the same standard
 * as the other three, with its own insertion at the head of the braid.
 */
export function sketchRoute1(): MapSketch {
  const map = new MapSketch({ width: 32, height: 32, fill: 'T', sealBorder: true });

  // 1. The fork: the insertion sits on the junction, so the first thing the
  // route asks is which road you are taking.
  map.lane([[16, 2], [16, 3]]);
  map.set(15, 2, 'S'); // the route board, on a stub off the head
  map.lane([[16, 3], [13, 3], [13, 4], [10, 4], [10, 3], [9, 3]]);
  map.lane([[16, 3], [19, 3], [19, 4], [22, 4], [22, 3], [23, 3]]);
  map.set(16, 3, 'I');

  // 2. The west road: a dirt column that steps west and back the whole way
  // down, so no leg of it is longer than four tiles.
  map.lane([
    [9, 3], [9, 6], [7, 6], [7, 10], [9, 10], [9, 14], [7, 14], [7, 18],
    [9, 18], [9, 22], [7, 22], [7, 26], [9, 26], [9, 29],
  ]);

  // 3. The east road, stepping the opposite way, so the two are never level.
  map.lane([
    [23, 3], [23, 7], [25, 7], [25, 11], [23, 11], [23, 15], [25, 15], [25, 19],
    [23, 19], [23, 23], [25, 23], [25, 27], [23, 27], [23, 29],
  ]);

  // 4. Four cross-links. Every one of them is tall grass: crossing the braid is
  // always the shorter way and always the one that costs fights.
  map.lane([[9, 6], [12, 6], [12, 7], [15, 7], [15, 6], [18, 6], [18, 7], [22, 7]], 'g');
  map.lane([[9, 13], [12, 13], [12, 14], [15, 14], [15, 13], [18, 13], [18, 14], [22, 14]], 'g');
  map.lane([[9, 20], [12, 20], [12, 21], [15, 21], [15, 20], [18, 20], [18, 21], [22, 21]], 'g');
  map.lane([[9, 26], [12, 26], [12, 27], [15, 27], [15, 26], [18, 26], [18, 27], [22, 27]], 'g');

  // 5. Three field systems in the middle of the braid. Each is fenced with two
  // doors on the cross-link above it and one on the link below, so a field is a
  // loop through the braid rather than a pocket to be cornered in. Internal
  // fence stubs keep any run through them short.
  for (const [top, bottom, stubs] of [
    [8, 12, [[15, 9], [18, 10], [14, 11], [19, 11]]],
    [15, 19, [[14, 16], [17, 17], [19, 18], [13, 18]]],
    [22, 25, [[16, 23], [13, 24], [19, 24]]],
  ] as const) {
    map.rect(11, top, 21, bottom, 'F');
    map.rect(12, top + 1, 20, bottom - 1, 'g');
    for (const [x, y] of stubs) {
      map.set(x, y, 'F');
    }
    map.set(13, top, 'g');
    map.set(19, top, 'g');
    map.set(16, bottom, 'g');
  }

  // 6. West verge: a small cache pocket, a long two-door paddock that loops
  // back onto the road, and the West Gate.
  map.pen(2, 5, 6, 8, 'g');
  map.set(4, 6, 'F');
  map.set(6, 7, 'g');
  map.pen(2, 15, 6, 24, 'g');
  map.set(4, 17, 'F');
  map.set(3, 20, 'F');
  map.set(5, 22, 'F');
  map.set(6, 17, 'g');
  map.set(6, 22, 'g');
  map.lane([[7, 26], [5, 26], [5, 25], [3, 25], [3, 26], [1, 26]]);
  map.raw(0, 26, 'X');
  map.set(1, 26, 'X');

  // 7. East verge: a paddock hung off the relay spur, a two-door paddock, and
  // the field station's yard - the one place on the map with a single door.
  map.pen(26, 8, 30, 11, 'g');
  map.set(28, 11, 'g');
  map.pen(26, 22, 30, 26, 'g');
  map.set(26, 23, 'g');
  map.set(26, 25, 'g');
  map.pen(26, 16, 30, 20, '.');
  map.set(26, 18, '.');
  map.set(28, 18, '*');
  map.lane([[23, 13], [26, 13], [26, 12], [29, 12], [29, 13], [30, 13]]);
  map.raw(31, 13, 'X');
  map.set(30, 13, 'X');

  // 8. The tail: the two roads meet again on a doglegged south lane, with the
  // outpost gate in the middle of it.
  map.lane([[9, 29], [12, 29], [12, 30], [16, 30], [16, 29], [20, 29], [20, 30], [23, 30], [23, 29]]);
  map.raw(16, 31, 'X');
  map.set(16, 30, 'X');

  // 9. Content.
  map.set(16, 20, 'H'); // the checkpoint, on the third cross-link
  for (const [x, y] of [[4, 7], [28, 9], [4, 22]] as const) {
    map.set(x, y, 'L');
  }

  return map;
}
