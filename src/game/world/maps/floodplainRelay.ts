import { MapSketch } from '../mapGrid';
import type { FrlgPropName } from '../tileset/frlgTileset';

/**
 * Floodplain Relay - the river town the flood took.
 */
export function sketchFloodplainRelay(): MapSketch<FrlgPropName> {
  const map = new MapSketch<FrlgPropName>({ width: 64, height: 64, fill: 'W' });

  // =====================================================================
  // 1. THE LANDING - the north bank, x12..34, y2..17.
  // =====================================================================
  map.draw(12, 2, [
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWMMMMWWWWWWWWWWWWWW',
    'WWWWMMMMMM.WWWWWWWWWWWW',
    'WWW.MMMMMM..WWWWWWWWWWW',
    'WW..MMvvvv...WWWWWWWWWW',
    'WW...vvvvvv....WWWWWWWW',
    'W.....vvvvv......WWWWWW',
    'W..gg..vvvv.......WWWWW',
    'W.gggg......FFFFF..WWWW',
    'W..ggg......F...F...WWW',
    'WW.gg.......F...F....WW',
    'WWW.........FF.FF....WW',
    'WWW.......,,,,,,,....WW',
    'WWWW......,.....,...WWW',
    'WWWWW.....,.....,..WWWW',
    'WWWWWWWWWW,,WWWWWWWWWWW',
  ]);
  map.plant(20, 6, 'building');
  map.plant(17, 8, 'crates');
  map.plant(26, 8, 'tree');
  map.plant(29, 9, 'tree');
  map.plant(27, 12, 'tree');
  map.plant(16, 14, 'tree');
  map.plant(21, 11, 'noticeBoard');

  return map;
}
