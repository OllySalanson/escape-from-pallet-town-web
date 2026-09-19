import { MapSketch } from '../mapGrid';
import type { FrlgPropName } from '../tileset/frlgTileset';

/**
 * Floodplain Relay - the river town the flood took.
 *
 * Nine places in a ring around a drowned basin. The water is the map's one big
 * idea and it does three jobs: it is the wall between every district and the
 * next, it is the landmark you orient by from anywhere, and it is the sightline
 * that shows you the place you cannot reach yet. Two gates sit on the ring;
 * beating either opens half of it and beating both closes it, so the map you
 * were walking as two dead ends turns out to have been a loop.
 *
 * It is also what shapes every district. The flood came up through the streets,
 * so each place is a set of lobes with inlets bitten into it rather than a
 * field with things on it: the water carves the lanes, the lanes bend round the
 * water, and nothing here has a straight run across it because nothing in a
 * drowned town does.
 *
 * Drawn as character art, one character per tile. Legend: `W` deep water,
 * `w` a ford you can wade, `.` grass, `"` mown turf, `g` reeds, `,` trodden
 * earth, `d` sand, `~` beach, `P` paving, `M` stone, `v` gravel, `#` hedge,
 * `T` tree, `C` rock, `F` fence, `B` building wall.
 */
export function sketchFloodplainRelay(): MapSketch<FrlgPropName> {
  const map = new MapSketch<FrlgPropName>({ width: 64, height: 64, fill: 'W' });

  // == THE LANDING - the north quay ========================================
  // The one place anyone still keeps up. Stone at the water, an earth apron
  // behind it and the relay office facing it. The flood has taken two bites
  // out of the yard, so the apron is a pair of aprons and the way south runs
  // between them.
  map.draw(14, 3, [
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWMMMMMMWWWWWWWWWW',
    'WWWW...MMMMM...WWWWWWW',
    'WWW.,,,,,,,,,,,.WWWWWW',
    'WW..,,,,,,,,,,,,,.WWWW',
    'W.#,,,,WW,,,,,,,,,.WWW',
    'W.#,,,,WW.....,,,,,.WW',
    'W.#,,,,,,.....,,,,,,.W',
    'W.##,,,,,.....,,,,,,,.',
    'W..#,,,,,,,,,,,,,,,,,.',
    'W.gg#,,,WWWW,,,,#,,,,.',
    'W.gg#..WWWWWW...#..,,.',
    'WW.g#.WWWWWWWW..#..,.W',
    'WWW.#T.WWWWWW.T.#.,,.W',
    'WWWW....WWWW....#.,WWW',
    'WWWWW..........WWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(21, 8, 'building');
  map.plant(30, 5, 'crates');
  map.plant(18, 6, 'crate');
  map.plant(31, 13, 'tree');
  map.plant(16, 16, 'tree');

  // == THE RELAY CAUSEWAY - east off the Landing ===========================
  // Stone laid straight across the flood, two wide. It is the only crossing
  // nobody holds, which is why every raid starts by walking it or turning away
  // from it.
  map.draw(34, 11, [
    'WWWWW',
    'MMMMM',
    'MMMMM',
    'WWWWW',
  ]);

  // == BEACON HEAD - the rocky headland ====================================
  // Rock, sand and a lagoon inside the ring. From its south shore you can see
  // the mill and you cannot get to it until the sluice is yours.
  map.draw(38, 4, [
    'WWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWCCCCCCWWWWWWW',
    'WWWWWCC..dd...CWWWWW',
    'WWWCC..ddddddd.CCWWW',
    'WWC..dddWWWddddd.CWW',
    'WC..ddWWWWWWWddd..CW',
    '....ddWWWWWWWWdd...C',
    '....ddWWWWWWWWdd...C',
    'WC..dddWWWWWddd...CW',
    'WWC...dddWdddd...CWW',
    'WWCC...ddddd....CWWW',
    'WWWCC.........CCWWWW',
    'WWWWCC..,,,..CCWWWWW',
    'WWWWWCCC,,,CCCWWWWWW',
    'WWWWWWWW,,,WWWWWWWWW',
  ]);
  map.plant(45, 15, 'boulders');

  // == THE SLUICE - the first gate =========================================
  // The mill's own cut, dropped across the channel. `gates.ts` owns the tiles
  // that open; what is drawn here is the stone either side of them.
  map.draw(45, 18, [
    'WWWWWW',
    'WMMMMW',
    'WMMMMW',
    'WMMMMW',
  ]);

  // == MILL WEIR - the east arm ============================================
  // The mill stands over the race with its yard behind it. The water still
  // runs under the wall, so the yard is a horseshoe round it.
  map.draw(41, 21, [
    'WWWWWWWWWWWWWWWWWWWW',
    'WWWWW,,,,WWWWWWWWWWW',
    'WWW..,,,,..WWWWWWWWW',
    'WW..vvvvvv...WWWWWWW',
    'W..vvvvvvvvvv.WWWWWW',
    'W.vvv.....vvvvv.WWWW',
    'W.vvWWWWW.vvvvvv..WW',
    'W.vvWWWWWW..vvvvv..W',
    'W.vvvWWWWWW..vvvvv.W',
    'W..vvvWWWWWW.vvvvv.W',
    'WW.vvvvWWWW.vvv.vv.W',
    'WWW.vvvvvv.....F..v.',
    'WWWW..........TF..v.',
    'WWWWW..T....T..F..,.',
    'WWWWWW.........,,,.W',
    'WWWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(43, 26, 'building');
  map.plant(53, 24, 'crates');

  // == VAULT ISLAND - the far south-east ===================================
  // What the relay kept, and where. A walled yard round a cellar mouth with
  // the water in under the wall: the only dry way in is the causeway from the
  // mill, and the quick way out is the drop south.
  map.draw(42, 37, [
    'WWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWW,,,WWWWWWWWW',
    'WWWWWW..,,,..WWWWWWW',
    'WWWW..MvvvvvM..WWWWW',
    'WWW..MvvvvvvvM..WWWW',
    'WW..MvvWWWWWvvM..WWW',
    'WW.MvvvWWWWWvvvM..WW',
    'W..MvvvWWWWWWvvvM..W',
    'W.MvvvvvWWWvvvvvM..W',
    'W.Mvvvvvvvvvvvvvv..W',
    'W..Mvvvv...vvvvM...W',
    'WW..............,,.W',
    'WWW............,,WWW',
    'WWWW..........WWWWWW',
    'WWWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(46, 49, 'tree');
  map.plant(53, 49, 'tree');

  // == ORCHARD FLATS - the south shore =====================================
  // The town's orchard, waist deep. The rows are still there under the water,
  // so the dry ground runs in strips and everything between them is reeds.
  map.draw(24, 46, [
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW,,,,WWWW',
    'WWWWWWWWWW....,,,,,,..WW',
    'WWWWWWWW..ggg..,,,,,gg.W',
    'WWWWWW..gggggg..,,,ggg.W',
    'WWWW..ggg...ggg.,,.ggg.W',
    'WWW..ggg.....ggg,,.gg..W',
    'WW..gggg.....gggg,.g...W',
    'WW.ggg.........ggg,....W',
    'WW.gg...........gg,,...W',
    'WW..gg.........gg..,,..W',
    'WWW..gggg...gggg....,,.W',
    'WWWW...gggggggg......,.W',
    'WWWWWW....gg........,,WW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(33, 52, 'tree');
  map.plant(33, 55, 'treeAlt');
  map.plant(37, 53, 'tree');

  // == THE CAUSEWAY and THE REEDBEDS - the west arm ========================
  // The shore road runs the length of the basin with the reeds inland of it
  // behind a broken hedge. The fast way is the exposed one; the reeds are
  // slower, cost fights, and are the only cover on this side of the water.
  map.draw(5, 17, [
    'WWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWW..,,,..',
    'WWWWWWWWWW.gg.,,,..',
    'WWWWWWWW..ggg.,,...',
    'WWWWWW..#gg...,,...',
    'WWWWW..##...T.,....',
    'WWWW..gg#.....,....',
    'WWW..gggg#....,,...',
    'WW..ggggg#.....,...',
    'WW.gggWWg#.....,...',
    'WW.gggWWWg#....,...',
    'WW.gggWWWgg#...,,..',
    'WW..ggWWWgg#....,..',
    'WWW..gggggg#....,..',
    'WWWW..ggggg#...,,..',
    'WWWWW..gggg#...,...',
    'WWWWWW..ggg#..,,...',
    'WWWWWWW..gg#..,....',
    'WWWWWWWW...#.,,....',
    'WWWWWWWWW....,.....',
    'WWWWWWWWWWW.,,.....',
    'WWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(9, 22, 'tree');

  // == MARKET ISLE - the south-west ========================================
  // The market square, paved and still standing, with its fountain and the
  // stalls round it. The flood took the south row, so the square opens
  // straight onto the water on that side.
  map.draw(4, 36, [
    'WWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWW,,,WWWW',
    'WWWWWWWWWWW..,,,..WW',
    'WWWWWWWWW..PPPPPP..W',
    'WWWWWWW..PPPPPPPPP.W',
    'WWWWW..PPPPPPPPPPP.W',
    'WWWW..PPP.....PPPP.W',
    'WWW..PPPP.....PPP..W',
    'WW..PPPPP.....PP...W',
    'WW.PPPPPPP...PPP..WW',
    'WW.PPPP..PPPPPP..WWW',
    'WW..PP....WWW...WWWW',
    'WWW......WWWWWWWWWWW',
    'WWWW....WWWWWWWWWWWW',
    'WWWWW..,,WWWWWWWWWWW',
    'WWWWWW.,,WWWWWWWWWWW',
    'WWWWWWW,,WWWWWWWWWWW',
  ]);
  map.plant(13, 42, 'fountain');
  map.plant(8, 40, 'marketStall');
  map.plant(16, 40, 'marketStall');

  // == OLD TOWN - the south bank ===========================================
  // What is left of the town: a street of drowned houses, the green in front
  // of them, and the church at the end of it.
  map.draw(6, 50, [
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWW,,WWWWWWWWWWWWW',
    'WWWWW..,,..WWWWWWWWWWW',
    'WWW..,,,,,,,..WWWWWWWW',
    'WW..,,,,,,,,,,,..WWWWW',
    'W..""",,,,,,""",..WWWW',
    'W.""""",,,,"""""...WWW',
    'W.""""",,,,""""""...WW',
    'W..""",,,,,,,"""",,,..',
    'WW..,,,,,,,,,,,,,,,,,.',
    'WWW..,,....,,,....,,..',
    'WWWW........,.......WW',
    'WWWWW.......,....WWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
  ]);
  map.plant(9, 55, 'building');
  map.plant(18, 55, 'building');

  return map;
}
