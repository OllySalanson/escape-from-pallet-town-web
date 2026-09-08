import { MapSketch } from '../mapGrid';

/**
 * Viridian Forest. 32x36, the shipped footprint. Trees are the default.
 *
 * Its rule is not "pick the fast lane or the covered one" - there is no fast
 * lane. Eleven clearings joined by seventeen trails, and every trail is tall
 * grass, so distance here is priced in fights rather than steps and the only
 * question is which clearings you chain together.
 *
 * It is the only one of the three maps that is fully two-connected: no single
 * blocked tile anywhere can seal a region off from every exit.
 */
export function sketchViridianForest(): MapSketch {
  const map = new MapSketch({ width: 32, height: 36, fill: 'T' });

  // The eleven clearings.
  const clearing = (x0: number, y0: number, x1: number, y1: number): void => {
    map.rect(x0, y0, x1, y1, '.');
  };
  clearing(6, 2, 9, 4); // North Landing
  clearing(14, 4, 18, 7); // Fire Tower
  clearing(2, 8, 5, 11); // Beetle Hollow
  clearing(13, 12, 16, 15); // The Crossroads
  clearing(24, 8, 27, 11); // Sap Pool
  clearing(28, 6, 30, 9); // Tower Steps
  clearing(2, 17, 5, 20); // Brook Head
  clearing(17, 17, 20, 20); // Warden's Cut
  clearing(12, 21, 15, 24); // Deep Stand
  clearing(26, 19, 29, 22); // East Rise
  clearing(18, 28, 22, 31); // The Clearing

  // Seventeen trails, every one of them tall grass.
  const trail = (points: readonly (readonly [number, number])[]): void => {
    map.lane(points, 'g');
  };
  trail([[8, 4], [8, 7], [11, 7], [11, 5], [13, 5]]); // Landing -> Fire Tower
  trail([[6, 4], [6, 6], [4, 6], [4, 8]]); // Landing -> Beetle Hollow
  trail([[18, 6], [21, 6], [21, 9], [23, 9], [23, 10], [24, 10]]); // Fire Tower -> Sap Pool
  trail([[16, 7], [16, 9], [14, 9], [14, 12]]); // Fire Tower -> Crossroads
  trail([[5, 9], [7, 9], [7, 11], [9, 11], [9, 13], [12, 13]]); // Beetle Hollow -> Crossroads
  trail([[5, 11], [5, 14], [3, 14], [3, 16], [4, 16], [4, 17]]); // Beetle Hollow -> Brook Head
  trail([[16, 14], [18, 14], [18, 16], [19, 16], [19, 17]]); // Crossroads -> Warden's Cut
  trail([[13, 15], [13, 17], [11, 17], [11, 21], [12, 21]]); // Crossroads -> Deep Stand
  trail([[26, 11], [26, 13], [28, 13], [28, 16], [27, 16], [27, 18], [28, 18], [28, 19]]); // Sap Pool -> East Rise
  trail([[5, 18], [7, 18], [7, 20], [9, 20], [9, 23], [12, 23]]); // Brook Head -> Deep Stand
  trail([[20, 18], [23, 18], [23, 20], [26, 20]]); // Warden's Cut -> East Rise
  trail([[20, 20], [20, 23], [22, 23], [22, 25], [21, 25], [21, 28]]); // Warden's Cut -> The Clearing
  trail([[14, 24], [14, 26], [18, 26], [18, 28]]); // Deep Stand -> The Clearing
  trail([[28, 22], [28, 25], [26, 25], [26, 27], [23, 27], [23, 28], [22, 28]]); // East Rise -> The Clearing
  trail([[27, 9], [28, 9]]); // Sap Pool -> Tower Steps
  trail([[2, 20], [1, 20]]); // Brook Head -> the ford

  // Content. The insertion lands where the old warp from Route 1 used to.
  map.raw(7, 2, 'I');
  map.raw(16, 6, '*'); // Fire Tower - opens the Tower Steps
  map.raw(18, 18, 'H'); // Warden Ivy, in the middle of her three-trail hub
  map.raw(20, 30, 'X'); // The Clearing
  map.raw(1, 20, 'X'); // Brook Ford
  map.raw(30, 8, 'X'); // Tower Steps
  for (const [x, y] of [[4, 18], [14, 22], [27, 21], [21, 30]] as const) {
    map.raw(x, y, 'L');
  }
  for (const [x, y] of [[3, 9], [25, 10], [15, 13], [19, 19], [29, 21], [13, 23]] as const) {
    map.raw(x, y, 'L');
  }

  return map;
}
