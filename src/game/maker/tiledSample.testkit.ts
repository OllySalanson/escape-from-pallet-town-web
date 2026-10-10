import sampleLaneJson from '../../maps/sample/sample-lane.json';
import { readMapFile, type MapFile } from '../world/mapFile';

const sample = (() => {
  const reading = readMapFile(sampleLaneJson);
  if (!reading.ok) {
    throw new Error(reading.problems.join('; '));
  }
  return reading.file;
})();

/**
 * The sample lane laid side by side to fill a map of any size: a lot of
 * everything near everything, for the tests that need a big map drawn the way
 * a maker draws one. Its drop-ins, exits and other places stay in the
 * top-left copy, unless `places` is false.
 */
export function tiledSample(width: number, height: number, { places = true } = {}): MapFile {
  const ground = Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) => sample.ground[y % sample.height][x % sample.width],
    ).join(''),
  );
  const buildings: MapFile['buildings'][number][] = [];
  for (let oy = 0; oy + sample.height <= height; oy += sample.height) {
    for (let ox = 0; ox + sample.width <= width; ox += sample.width) {
      buildings.push(
        ...sample.buildings.map((building) => ({
          ...building,
          x: building.x + ox,
          y: building.y + oy,
        })),
      );
    }
  }
  const tiled = { ...sample, id: 'tiled', name: 'Tiled', width, height, ground, buildings };
  return places ? tiled : { ...tiled, dropIns: [], exits: [], itemSpots: [] };
}
