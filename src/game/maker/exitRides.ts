/**
 * What the map maker says and draws of an exit's ride (`world/exitVehicles.ts`):
 * the ride is read off the ground the maker painted round the exit, exactly as
 * the raid reads it, so nothing about it is chosen or saved.
 */
import { exitRideFor, type ExitGround, type ExitRide } from '../world/exitVehicles';
import type { MapFile } from '../world/mapFile';
import { materialForChar } from '../world/tileset/materials';
import type { GridPoint } from './draft';

/**
 * The ground of the place a view shows, as a ride is read off it. A view of
 * an inside carries that inside's own ground (`focusArea`), which is how it is
 * told from the outdoors' without being told which place it is.
 */
export function groundOfView(file: MapFile): ExitGround {
  const inside = (file.areas ?? []).some((area) => area.ground === file.ground);
  return {
    width: file.width,
    height: file.height,
    materialAt: (x, y) => {
      const char = file.ground[y]?.[x];
      return char === undefined ? undefined : materialForChar(char);
    },
    underground: inside,
  };
}

export function rideOfExit(file: MapFile, spot: GridPoint): ExitRide {
  return exitRideFor(groundOfView(file), spot);
}

/** Why an exit has the ride it has, in the pane that shows the exit. */
export function rideLine(ride: ExitRide): string {
  switch (ride.vehicle) {
    case 'boat':
      return 'Its ride is a boat, moored on the deep water beside it.';
    case 'bird':
      return 'Its ride is Pidgeot, because a cliff is near: high ground is left by air.';
    case 'minecart':
      return 'Its ride is a minecart, because it is under a roof.';
    case 'bike':
      return 'Its ride is a bicycle. Beside deep water it would be a boat, near a cliff Pidgeot, and under a roof a minecart.';
  }
}
