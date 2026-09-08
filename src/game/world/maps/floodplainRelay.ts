import { MapSketch } from '../mapGrid';

/**
 * Floodplain Relay. 32x32, the shipped footprint. Water is the default here:
 * the flood is what says no.
 *
 * Every coordinate the rest of the code depends on - the insertion, the three
 * exits, both landmarks, the first contract, the loot and the signs - keeps its
 * shipped position. The one thing that has moved since is the checkpoint: it
 * used to sit in the corner of the road, where a trainer who has to be spoken
 * to is a locked door rather than a price, and it now stands on a jetty beside
 * it and watches the approach instead.
 *
 * It stays the smallest map in the game. Its job is to teach four things in
 * ninety seconds: the road is fast and exposed, the reeds are slow and covered,
 * the vault is a signposted dead end, and three exits work on three rules.
 */
export function sketchFloodplainRelay(): MapSketch {
  const map = new MapSketch({ width: 32, height: 32, fill: 'W' });

  // 1. The landing: the insertion jetty and the route board.
  map.lane([[14, 3], [16, 3]], '.');
  map.raw(15, 2, '.');
  map.lane([[14, 4], [18, 4]], '.');
  map.raw(13, 4, 'S');
  map.lane([[14, 5], [12, 5]], 'g');
  map.raw(15, 3, 'I');

  // 2. The road: the same road, now doglegged five times. Its longest straight
  // section is six tiles; it used to be a dead-straight column of twenty-seven.
  map.lane([[15, 4], [15, 7]]);
  map.lane([[15, 7], [13, 7]]);
  map.lane([[13, 7], [13, 11]]);
  map.lane([[13, 11], [15, 11]]);
  map.lane([[15, 11], [15, 16]]);
  map.lane([[15, 16], [13, 16]]);
  map.lane([[13, 16], [13, 20]]);
  map.lane([[13, 20], [15, 20]]);
  map.lane([[15, 20], [15, 25]]);

  // The checkpoint. RAIDER MAYA stands on a jetty hung off the corner rather
  // than in the corner itself, so the road stays open and stays the fast route;
  // what it costs is her watch, which runs north up the approach she is facing.
  // A trainer standing in a one-tile lane is a locked door, not a price.
  map.lane([[15, 16], [15, 17]]);
  map.raw(15, 17, 'H');

  // 3. The ranger station: a loop off the road holding the Radio Exit.
  map.lane([[18, 4], [18, 7]], '.');
  map.lane([[17, 7], [21, 7]], '.');
  map.raw(18, 7, '*');
  map.raw(19, 8, 'X');
  map.lane([[16, 6], [17, 6]], '.');
  map.raw(15, 6, ',');

  // 4. The reeds: eight shelves with water between them and every crossing
  // staggered, so no two shelves line up and moving through them is a zigzag.
  for (const y of [9, 11, 13, 15, 17, 19, 21, 23]) {
    map.rect(4, y, 11, y, 'g');
  }
  for (const [y, x] of [[9, 8], [11, 9], [13, 8], [15, 8], [17, 9], [19, 7], [21, 9], [23, 8]] as const) {
    map.raw(x, y, 'W');
  }
  for (const [y, xs] of [
    [10, [6, 10]],
    [12, [7, 10]],
    [14, [5, 9]],
    [16, [6, 10]],
    [18, [5, 8, 11]],
    [20, [6, 8, 10]],
    [22, [6, 10]],
  ] as const) {
    for (const x of xs) {
      map.raw(x, y, 'g');
    }
  }
  for (const y of [9, 11, 17, 19]) {
    map.raw(12, y, 'g');
  }
  map.raw(7, 12, 'L');
  map.raw(11, 15, 'L');
  map.raw(7, 21, 'X');
  map.raw(11, 23, 'O');

  // 5. The south bank: the reeds' third mouth. There is no short way from the
  // road to the contract - it is three shelves deep whichever way you come.
  map.lane([[5, 24], [5, 26]], '.');
  map.lane([[5, 26], [8, 26]], '.');
  map.lane([[8, 26], [8, 25]], '.');
  map.lane([[8, 25], [11, 25]], '.');
  map.lane([[11, 25], [11, 27]], '.');
  map.lane([[11, 27], [13, 27]], '.');

  // 6. The vault causeway: east, exposed, and with a long north return. The
  // return is deliberately longer than the way in; what it buys is ground the
  // hunter is not already standing on.
  map.lane([[15, 13], [20, 13]]);
  map.raw(19, 14, 'S');
  map.lane([[20, 13], [20, 15]]);
  map.lane([[20, 15], [22, 15]]);
  map.lane([[22, 15], [22, 16]]);
  map.lane([[22, 16], [26, 16]]);
  map.lane([[26, 16], [26, 15]]);
  map.raw(27, 15, '*');
  map.lane([[27, 14], [27, 12]], '.');
  map.lane([[27, 12], [24, 12]], '.');
  map.lane([[24, 12], [24, 10]], '.');
  map.lane([[24, 10], [21, 10]], '.');
  map.lane([[21, 10], [21, 8]], '.');

  // 7. The south delta: two loops round the south gate, not one road end.
  map.lane([[15, 25], [13, 25]]);
  map.lane([[13, 25], [13, 27]]);
  map.lane([[13, 27], [15, 27]]);
  map.lane([[15, 25], [17, 25]]);
  map.lane([[17, 25], [17, 27]]);
  map.lane([[17, 27], [15, 27]]);
  map.raw(15, 28, 'X');

  // 8. The north reedbank: the third door off the landing.
  map.rect(5, 5, 11, 5, 'g');
  map.rect(5, 7, 11, 7, 'g');
  map.raw(9, 5, 'W');
  map.raw(9, 7, 'W');
  for (const x of [5, 8, 11]) {
    map.raw(x, 6, 'g');
  }
  map.raw(12, 5, 'g');
  map.raw(12, 7, 'g');
  map.raw(5, 8, 'g');

  return map;
}
