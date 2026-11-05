import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXIT_VEHICLES,
  exitRideFor,
  LOCKED_RIDE_ALPHA,
  RIDE_ARRIVAL_MS,
  RIDE_DEPARTURE_MS,
  RIDE_FRAME,
  rideArrival,
  rideDeparture,
  rideIdle,
  rideOnMap,
  ridePicture,
  type ExitGround,
  type ExitRide,
} from './exitVehicles';
import { extractionPointsOn } from './extractionPoints';
import { materialForChar, type Material } from './tileset/materials';
import { getWorldMap } from '../worldMap';

/** A patch of ground drawn in the map files' own letters, the exit at `*`. */
function ground(rows: readonly string[], underground = false): { ground: ExitGround; exit: { x: number; y: number } } {
  let exit = { x: -1, y: -1 };
  const materials = rows.map((row, y) =>
    [...row].map((char, x) => {
      if (char === '*') {
        exit = { x, y };
        return 'grass' as Material;
      }
      const material = materialForChar(char);
      if (!material) throw new Error(`no material ${char}`);
      return material;
    }),
  );
  return {
    ground: {
      width: rows[0].length,
      height: rows.length,
      materialAt: (x, y) => materials[y]?.[x],
      underground,
    },
    exit,
  };
}

const rideOf = (rows: readonly string[], underground = false): ExitRide => {
  const patch = ground(rows, underground);
  return exitRideFor(patch.ground, patch.exit);
};

describe('the ride an exit gets from its ground', () => {
  it('is a boat moored on the deep water beside a quay, bow to the open water', () => {
    expect(rideOf(['TTTTT', 'MM*MM', 'WWWWW', 'WWWWW'])).toEqual({ vehicle: 'boat', facing: 'down', at: { x: 2, y: 2 } });
    // Water on two sides: the side with more water beyond it is the sea.
    expect(rideOf(['TTWTT', 'MM*WW', 'MMMWW', 'MMMMM'])).toMatchObject({ vehicle: 'boat', facing: 'right', at: { x: 3, y: 1 } });
  });

  it('is never a boat on water you can wade', () => {
    expect(rideOf(['TTTTT', 'TT*TT', 'wwwww'])).toMatchObject({ vehicle: 'bike' });
  });

  it('is Pidgeot on high ground, hovering over the exit', () => {
    expect(rideOf(['CCCCC', 'C.*.C', 'C...C'])).toEqual({ vehicle: 'bird', facing: 'up', at: { x: 2, y: 1 } });
  });

  it('is a minecart under a roof, whatever the ground beside it', () => {
    expect(rideOf(['BBBBB', 'PP*PP', 'WWWWW'], true)).toMatchObject({ vehicle: 'minecart', at: { x: 2, y: 1 } });
  });

  it('is a bicycle anywhere else, facing into the wood the way out leads into', () => {
    expect(rideOf(['TTTTTTT', 'TT*....', 'TTTTTTT'])).toEqual({ vehicle: 'bike', facing: 'left', at: { x: 2, y: 1 } });
    expect(rideOf(['TTTTTTT', '....*TT', 'TTTTTTT'])).toEqual({ vehicle: 'bike', facing: 'right', at: { x: 4, y: 1 } });
  });

  it('reads the water before the cliff, and the roof before both', () => {
    expect(rideOf(['CCCCC', 'C.*.C', 'WWWWW'])).toMatchObject({ vehicle: 'boat' });
    expect(rideOf(['CCCCC', 'C.*.C', 'WWWWW'], true)).toMatchObject({ vehicle: 'minecart' });
  });
});

describe('every exit on every map', () => {
  it('has a ride that stands where its kind can stand', () => {
    const seen = new Set<string>();
    for (const point of extractionPointsAll()) {
      const map = getWorldMap(point.mapId);
      const ride = rideOnMap(map, point.position);
      seen.add(ride.vehicle);
      const under = map.terrain[ride.at.y]?.[ride.at.x];
      if (ride.vehicle === 'boat') {
        expect(under, `${point.label} moors its boat on deep water`).toBe('water');
      } else {
        expect(ride.at, `${point.label}'s ${ride.vehicle} stands on the exit`).toEqual(point.position);
      }
    }
    // The shipped maps have quays, cliff tops and lanes, and one hatch under a roof.
    expect([...seen].sort()).toEqual([...EXIT_VEHICLES].sort());
  });

  it("gives Greystone Vale's ways out the rides their names promise", () => {
    const rides = new Map(
      extractionPointsOn('greystone-vale').map((point) => [
        point.label,
        rideOnMap(getWorldMap('greystone-vale'), point.position).vehicle,
      ]),
    );
    for (const boat of ["FISHERS' BOAT", "SMUGGLERS' BOAT", "WHALER'S BOAT", 'CINDER BOAT', 'SALVAGE LAUNCH']) {
      expect(rides.get(boat), boat).toBe('boat');
    }
    expect(rides.get('CLOUD STAIR')).toBe('bird');
    expect(rides.get('ESCAPE HATCH')).toBe('minecart');
    expect(rides.get('GOAT TRACK')).toBe('bike');
  });
});

function extractionPointsAll() {
  return (['pallet-town', 'route-1', 'viridian-forest', 'viridian-city', 'floodplain-relay', 'greystone-vale'] as const).flatMap(
    (mapId) => extractionPointsOn(mapId),
  );
}

describe('the picture of a ride', () => {
  const at = { x: 10, y: 10 };
  it('stands a side-on ride on its tile with its wheels on the tile\'s last row', () => {
    for (const vehicle of ['bike', 'minecart'] as const) {
      for (const facing of ['left', 'right'] as const) {
        const picture = ridePicture({ vehicle, facing, at });
        expect(picture.bounds.y + picture.bounds.height, `${vehicle} ${facing}`).toBe(16);
        // Centred on the tile, to the pixel the art allows.
        const middle = picture.bounds.x + picture.bounds.width / 2;
        expect(Math.abs(middle - 8), `${vehicle} ${facing}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('mirrors a ride that faces right, and nothing else', () => {
    expect(ridePicture({ vehicle: 'bike', facing: 'right', at }).flipX).toBe(true);
    expect(ridePicture({ vehicle: 'bike', facing: 'left', at }).flipX).toBe(false);
    expect(ridePicture({ vehicle: 'boat', facing: 'down', at }).flipX).toBe(false);
    expect(ridePicture({ vehicle: 'boat', facing: 'right', at }).flipX).toBe(true);
  });

  it('lies a boat out on its water, its stern at the quay', () => {
    // Moored below the quay: the hull starts within a few pixels of the quay's edge (the water tile's top).
    const down = ridePicture({ vehicle: 'boat', facing: 'down', at });
    expect(down.bounds.y).toBeGreaterThanOrEqual(0);
    expect(down.bounds.y).toBeLessThanOrEqual(3);
    const left = ridePicture({ vehicle: 'boat', facing: 'left', at });
    expect(left.bounds.x + left.bounds.width).toBe(16);
  });

  it('hovers a bird over the exit with its shadow on the ground under it', () => {
    const picture = ridePicture({ vehicle: 'bird', facing: 'up', at });
    expect(picture.frames?.length).toBe(2);
    expect(picture.bounds.y + picture.bounds.height).toBeLessThan(16);
    expect(picture.shadow?.y).toBeGreaterThan(picture.bounds.y + picture.bounds.height - 1);
  });

  it('draws from sheets that ship and are credited', () => {
    const root = join(__dirname, '../../../public');
    const provenance = readFileSync(join(root, 'assets/ASSET_PROVENANCE.md'), 'utf8');
    for (const vehicle of EXIT_VEHICLES) {
      const picture = ridePicture({ vehicle, facing: 'left', at });
      const png = readFileSync(join(root, picture.path));
      const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
      expect(width % RIDE_FRAME, picture.path).toBe(0);
      expect(height % RIDE_FRAME, picture.path).toBe(0);
      expect(picture.frame).toBeLessThan((width / RIDE_FRAME) * (height / RIDE_FRAME));
      expect(provenance, picture.path).toContain(picture.path.replace('assets/', ''));
    }
  });
});

describe('how a ride moves', () => {
  const ride: ExitRide = { vehicle: 'boat', facing: 'down', at: { x: 0, y: 0 } };

  it('moves in whole pixels at every moment, so the art is never resampled', () => {
    for (const vehicle of EXIT_VEHICLES) {
      const each = { ...ride, vehicle };
      for (let ms = 0; ms <= 2_000; ms += 17) {
        for (const pose of [rideIdle(vehicle, ms), rideArrival(each, ms), rideDeparture(each, ms)]) {
          expect(Number.isInteger(pose.dx) && Number.isInteger(pose.dy), `${vehicle} at ${ms}ms`).toBe(true);
        }
      }
    }
  });

  it('comes in from the way it will leave by, and comes to rest when its exit has opened', () => {
    const first = rideArrival(ride, 0);
    expect(first.dy).toBeGreaterThan(0);
    expect(first.alpha).toBe(LOCKED_RIDE_ALPHA);
    expect(rideArrival(ride, RIDE_ARRIVAL_MS)).toMatchObject({ dx: 0, dy: 0, alpha: 1 });
    expect(rideArrival({ ...ride, vehicle: 'bird', facing: 'up' }, 0).dy).toBeLessThan(0);
  });

  it('is gone before the result screen, the way it faces', () => {
    // `RUN_RESULT_DELAY_MS` in WorldScene: the world stands 700ms before the result screen.
    expect(RIDE_DEPARTURE_MS).toBeLessThan(700);
    const end = rideDeparture({ ...ride, facing: 'left' }, RIDE_DEPARTURE_MS);
    expect(end.alpha).toBe(0);
    expect(end.dx).toBeLessThan(-32);
    expect(rideDeparture({ ...ride, vehicle: 'bird', facing: 'up' }, RIDE_DEPARTURE_MS).dy).toBeLessThan(-32);
  });

  it('rocks a moored boat and beats a bird\'s wings at rest, and holds wheels still', () => {
    const boat = new Set(Array.from({ length: 40 }, (_, i) => rideIdle('boat', i * 100).dy));
    expect(boat.size).toBe(2);
    const beats = new Set(Array.from({ length: 40 }, (_, i) => rideIdle('bird', i * 100).beat));
    expect(beats.size).toBe(2);
    expect(rideIdle('bike', 1234)).toEqual({ dx: 0, dy: 0, alpha: 1, beat: 0 });
  });
});
