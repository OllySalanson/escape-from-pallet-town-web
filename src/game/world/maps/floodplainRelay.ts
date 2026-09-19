import { MapSketch } from '../mapGrid';
import type { FrlgPropName } from '../tileset/frlgTileset';

/**
 * Floodplain Relay - the river town the flood took.
 */
export function sketchFloodplainRelay(): MapSketch<FrlgPropName> {
  const map = new MapSketch<FrlgPropName>({ width: 64, height: 64, fill: 'W' });

  // == 1. THE LANDING - x11..34, y2..18 ==========================
  map.draw(11, 2, [
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWMMMWWWWWWWWWWWWWW',
    'WWWWWWMMMMM.WWWWWWWWWWWW',
    'WWWWW.MMMMM..WWWWWWWWWWW',
    'WWWW..vvvvv...WWWWWWWWWW',
    'WWW...vvvvvv...WWWWWWWWW',
    'WW.....vvvv.....WWWWWWWW',
    'W...g...vv........WWWWWW',
    'W..gggg.........,,,,,,,,',
    'W..gggg...FFFFF.,.......',
    'WW..gg....F...F.,.......',
    'WWW.......F...F.,....WWW',
    'WWWW......FF.FF.,...WWWW',
    'WWWWW......,,,,,,..WWWWW',
    'WWWWWW.....,....,..WWWWW',
    'WWWWWWW....,....,.WWWWWW',
    'WWWWWWWWWWW,,WWWWWWWWWWW',
  ]);

  // == 2. BEACON HEAD - x33..62, y8..20 ==========================
  map.draw(33, 8, [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,,,,,,,,,..CCC...WWWWWWWWWWW',
    '.........,..CC...C..WWWWWWWWWW',
    '.WWWWWWW.,.C......CC.WWWWWWWWW',
    'WWWWWWWW.,.C...dd..C..WWWWWWWW',
    'WWWWWWWW.,,.C.dddd.CC..WWWWWWW',
    'WWWWWWWWW.,.CC.dd.CC..WWWWWWWW',
    'WWWWWWWWW.,..CCCCCC..WWWWWWWWW',
    'WWWWWWWWW.,,........WWWWWWWWWW',
    'WWWWWWWWWW.,,,,,,..WWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);

  // == 3. THE REEDBEDS - x1..16, y14..38 =========================
  map.draw(1, 14, [
    'WWWWWWWWWWWWWWWW',
    'WWWWWWWW.....WWW',
    'WWWWWW..ggg...WW',
    'WWWWW..gggggg..W',
    'WWWW..ggg..ggg..',
    'WWW..gg.....gg..',
    'WW..gg...C...g..',
    'WW.gg...CCC...g.',
    'W..gg....C....g.',
    'W.ggg........gg.',
    'W.gg...ggg...gg.',
    'W..g..ggggg...g.',
    '...g..ggggg..gg.',
    '...gg..ggg..ggg.',
    'W..ggg.....gggg.',
    'WW..ggg...gggg..',
    'WWW..gggggggg..W',
    'WWWW..gggggg..WW',
    'WWWWW...gg...WWW',
    'WWWWWW......WWWW',
    'WWWWWWWWWWWWWWWW',
  ]);

  // == 4. THE CAUSEWAY - x14..32, y18..44 ========================
  map.draw(14, 18, [
    'WWWWWWWWWWWWWWWWWWW',
    'WWWWWWWW,,,WWWWWWWW',
    'WWWWWWW.,,,.WWWWWWW',
    'WWWWWW..,,,..WWWWWW',
    'WWWWW...,,,...WWWWW',
    'WWWW..gg,,,gg..WWWW',
    'WWW..ggg,,,ggg..WWW',
    'WW..gggg,,,gggg..WW',
    'W...ggg.,,,.ggg...W',
    'W..gg....,,....gg..',
    'W.gg....,,,,....gg.',
    'W.g....,,,,,,....g.',
    'W.....,,,...,,.....',
    'W....,,,.....,,....',
    'W...,,,.......,,...',
    'W..,,,.........,,..',
    'W.,,,...........,,.',
    'W,,,.............,,',
    'W,,...............,',
    'W,,...............,',
    'WW,,.............,,',
    'WWW,,,.........,,,W',
    'WWWW,,,,,,,,,,,,,WW',
    'WWWWWWW,,,,,WWWWWWW',
    'WWWWWWWW,,,WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWW',
  ]);

  return map;
}
