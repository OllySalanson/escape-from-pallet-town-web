import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Floodplain Relay - the river town the flood took.
 *
 * One river comes in from the north, turns west, runs south, splits round an
 * island and leaves to the south. It is never more than three tiles across, so
 * wherever you stand on a bank the other bank is on the screen with you: the
 * water is the wall between every district and the next, the thing you steer
 * by, and the sightline that shows you the place you cannot reach yet.
 *
 * Six places, and what the river does to each:
 *
 * - THE LANDING (north-west) - the quay, the relay office, the boathouse and
 *   the ferry jetty. The front door. Across the north reach stands the keep's
 *   tower, three tiles of deep water away from your first step.
 * - THE REEDBEDS (west) - the shore road south, fast and watched, with the
 *   reeds inland of it: slower, costly, and the only cover on this bank.
 * - MARKET ISLE (middle) - the square, its fountain and its stalls, ringed by
 *   the river. Two bridges leave its north shore side by side: the plank one
 *   home, and the towered one that somebody holds.
 * - OLD TOWN (south-west) - the drowned street, the shrine and the way out
 *   through the South Gate.
 * - MILL WEIR and THE ORCHARD (east bank) - the mill on its pond, and the rows
 *   the town's fruit came from. Behind the toll bridge.
 * - BEACON KEEP (north-east) - moated by the mill race, entered through the
 *   gatehouse that stands in it. Behind the sluice keeper - and one drowned
 *   causeway from the Landing, which is the thing you find out when he falls.
 * - THE VAULT (south-east) - what the relay kept, under a trapdoor behind the
 *   orchard's back fence.
 *
 * Drawn as character art, one character per tile. Legend: `W` deep water,
 * `w` a ford you can wade, `.` grass, `"` mown turf, `g` reeds, `,` trodden
 * earth, `d` sand, `P` paving, `M` stone, `v` gravel, `#` hedge, `T` thicket,
 * `C` rock, `F` fence. And this map's own letters: `t` is a broadleaf tree
 * and `p` a pine, each drawn where its trunk stands - the two rows at and above
 * the letter are solid, and the crown above those is walked behind.
 */
export function sketchFloodplainRelay(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 64,
    height: 64,
    fill: '.',
    stamps: {
      t: { prop: 'tree', anchor: [1, 2], ground: '.' },
      p: { prop: 'pine', anchor: [0, 2], ground: '.' },
    },
  });

  // == THE RIVER ===========================================================
  // Laid down first, because everything else is drawn against it. Long reaches
  // and square bends: this sheet's bank is a lip that runs, and a shore drawn
  // as a staircase reads as a staircase.
  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T.......................................WWW....................T',
    'T..........................WWWWWWWWWWWWWWWW....................T',
    'T..........................WWWWWWWWWWWWWWWW....................T',
    'T..........................WWWWWWWWWWWWWWWW....................T',
    'T..........................WWW..........WWW....................T',
    'T..........................WWW..........WWW.........WWWWWWW....T',
    'T..........................WWW..........WWW.........WWWWWWW....T',
    'T..........................WWW..........WWWWWWWWWWWWWWWWWWW....T',
    'T..........................WWW..........WWWWWWWWWWWWWWWWWWW....T',
    'T..........................WWW......................WWWWWWW....T',
    'T..........................WWW......................WWWWWWW....T',
    'T..........................WWW......................WWWWWWW....T',
    'T..........................WWW.................................T',
    'T..........................WWW.................................T',
    'T..........................WWW.................................T',
    'T..........................WWW.................................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWW................WWW......................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T..................WWWWWWWWWWWWWWWWWWWWWW......................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'T.............................WWW..............................T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // == THE WOODS ROUND IT ==================================================
  // A tree's crown does not block, so the outermost ring stays thicket under
  // the crowns: the edge is sealed by what it is made of, not by where a trunk
  // happens to fall.
  map.draw(0, 1, [
    ' ......................................T   ....................T',
    ' t..t..t..t..t..t..t..t..t..t..t..t..t.T   .t..t..t..t..t..t..t.',
  ]);
  map.draw(0, 61, [
    ' .............................   ..............................T',
    ' t..t..t..t..t..t..t..t..t..t.   .t..t..t..t..t..t..t..t..t..t.T',
  ]);
  map.draw(1, 3, [
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
  ]);
  map.draw(62, 3, [
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
    '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't', '.', 't',
  ]);

  // == THE LANDING - the north-west quay ===================================
  // The one place anyone still keeps up. The office faces the yard, the
  // boathouse faces the bay the flood bit out of the quay, and the jetty runs
  // out into it. East along the shore the old causeway goes under: three tiles
  // of deep water, the stones showing, and the keep's tower on the far side.
  map.draw(3, 3, [
    '....................................C',
    '.t..t..t..t..t..t..t..t..t..t..t..t.C',
    '.............########...............C',
    '.t..t..t.....########......t..t..t..C',
    '.............,,,,,,,,....,MMMMMMMMMMM',
    '.t..t..t.....,,,,,,,,....,MMMMMMMMMMM',
    '....,,,,,,,,,,,,,,,,,....,MMMMMMMMMMM',
    '....,,,,,,,,,,,,,,,,,,,,,,MMWWWWWWMMM',
    '....,,.........t..........MMWWWWWWMMM',
    '.t..,,.t..t..t....t..t..t.MMWWWWWWMMC',
    '....,,....................CMWWWWWWMCC',
  ]);
  map.plant(12, 5, 'building');
  map.plant(24, 5, 'barn');
  map.plant(32, 10, 'jetty');
  map.plant(33, 7, 'crateStack');
  map.plant(17, 7, 'cratePair');
  map.plant(20, 7, 'barrel');
  map.plant(30, 8, 'barrelPair');
  map.plant(37, 10, 'mooringPost');
  map.plant(11, 9, 'signboard');

  // == THE REEDBEDS - the west bank ========================================
  // The shore road runs down the river side, straight enough to be quick and
  // open enough to be watched. Inland of it the reeds stand in beds with lanes
  // between them, and the ranger's hut sits where the two ways part.
  map.draw(3, 14, [
    '....,,..................',
    '.t..,,.t..t..t..t..t..t.',
    '....,,,,,,,,,,..........',
    '.ggg...ggg,,,,..t..t..t.',
    'gggggCgggg..,,,.........',
    'ggggg.ggggg.,,,,,,,,,,..',
    '.gggg..gggggg.ggg...,,.C',
    '.t.ggg..ggggggggg.C.,,..',
    '...gggg...gggggg....,,.C',
    '.C.ggggg.t..ggggg...,,,.',
    '...ggggggg...gggg.C..,,.',
    '.gggggggggg.ggggg....,,.',
    '.ggggg.ggggggggg...t.,,.',
    '...,,................,,.',
    '.t.,,..t..t..t..t...,,,.',
  ]);
  map.plant(12, 16, 'hut');
  map.plant(21, 24, 'signboard');

  // == MARKET ISLE - the middle of the river ===============================
  // The square, paved and still standing. Two bridges leave its north shore
  // side by side - the plank one goes home, the towered one goes east and is
  // held - and whoever comes off either finds the fountain in front of them.
  map.draw(22, 32, [
    '.,,,,####,,,,,..',
    '.,,,,####,,,,,..',
    '..PPPPPPPPPPPP..',
    '#.PPPPPPPPPPPP.#',
    '#.PPPPPPPPPPPP.#',
    ',,PPPPPPPPPPPP,,',
    ',,PPPPPPPPPPPP,,',
    '#.PPPPPPPPPPPP.#',
    '#..PPPPPPPPPP..#',
    '.t...PPPPPP..t..',
    '...............C',
    '.t..t..t..t..t.C',
  ]);
  map.plant(23, 28, 'bridge');
  map.plant(31, 28, 'stoneBridge');
  map.plant(26, 34, 'stripedStall');
  map.plant(31, 37, 'stoneFountain');
  map.plant(24, 39, 'produce');
  map.plant(28, 40, 'bench');
  map.plant(34, 35, 'potPlant');
  map.plant(36, 39, 'banner');

  // The ford to Old Town. The one to the orchard is `gates.ts`'s to open.
  map.draw(19, 37, ['www', 'www']);

  // == OLD TOWN - the south-west ===========================================
  // The street the water came up: two houses with their front hedges, the old
  // tree the street has always gone round, and the green with the shrine.
  map.draw(3, 29, [
    '...,,..........C',
    '.t.,,..t..t..t.C',
    '...C,..........#',
    '.t.,,..........#',
    '...,,..........#',
    '.t.,C..........#',
    '...,,..........#',
    '...,,##,####,##.',
    '...,,,,,...,,,,,',
    '.t.,,,,,.t.,,,,,',
    '.....,,,,,,,....',
    '.....""""""..#..',
    '.t...""""""..#..',
    '................',
    '.t..t..t..t..,,.',
  ]);
  map.plant(8, 31, 'house');
  map.plant(13, 31, 'house');
  map.plant(9, 40, 'shrine');
  map.plant(12, 40, 'statue');

  // South of the river: the towpath in its reeds, the last houses, and the
  // road down to the gate.
  map.draw(3, 44, [
    '.............,,.          ',
    '.t..t..t..t..,,.          ',
    '.............,,.          ',
    '.............,,.ggggCggggg',
    '.t..t..#.....,,,ggggCggggg',
    '.......#..,,,,,,..........',
    '.t.....#..,,..,,.t..t..t..',
    '..........,,..,,..........',
    '.t..,,,,,,,,..,,,,,,,,,,,,',
    '....,,....C...,,..C.....,,',
    '.t..,,.t......,,.....t..,,',
    '....,,....##..,,..........',
    '.t..,,,,..##.,,,,.t..t..t.',
    '.......,,....,,,,.........',
    '.t..t..,,,,,,,,,,,.t..t...',
    '...........,,,,...........',
    '.t..t..t...,,,,..t..t..t..',
  ]);
  map.plant(6, 45, 'house');
  map.plant(21, 53, 'barn');
  map.plant(9, 55, 'hut');
  map.plant(13, 49, 'barrelPair');
  map.plant(19, 58, 'signboard');

  // == MILL WEIR - the east bank, north ====================================
  // The mill stands on its pond with the race running back to the river. The
  // towered bridge lands here, and the road from it forks: north to the
  // gatehouse, east to the mill, south into the orchard.
  map.draw(30, 17, [
    '..........   ..................',
    '.t..t..t..   .t....,,,.       .',
    '..........   ......,,,.       .',
    '..,,,,,,,.                    .',
    '..,,...,,.                    .',
    '..,,.t.,,,,,,,,,,,,,,.       ..',
    '..,,...,,..t..t..,,,,.       C.',
    '.t,,.....,,.......,,,..........',
    '..,,,,,,,,,..t..t.,,,,,,,,,,,..',
    '.....C..,,........,,..t..t..,,.',
    '.t..t...,,.t..t...,,........,,.',
    '........,,........,,..t..t..,,.',
  ]);
  map.plant(53, 25, 'house');
  map.plant(58, 26, 'haystack');
  map.plant(45, 24, 'cratePair');

  // The gatehouse in the race, and the stone that runs under it.
  map.draw(46, 15, ['MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM']);
  map.plant(45, 15, 'gatehouse');

  // == THE ORCHARD - the east bank, south ==================================
  // Planted in rows, because an orchard is, and the rows are still there -
  // the only straight lines on this map, and none runs far before a tree that
  // came down in the flood.
  map.draw(41, 29, [
    '.,,..............,,.',
    '.,,.t..t..t..t...,,.',
    '.,,..............,,.',
    '.,,,,,,,,,,,,,,,,,,.',
    '.,,.t..t.....t...,,.',
    '.,,..............,,.',
    '.,,,,,,,,,..,,,,,,,.',
    '..,.t..t..t..t...,..',
    '..,..............,,.',
    '.,,,,,,,,,,,,,,,,,,.',
    '.,,.t.....t..t...,,.',
    '.,,..............,,.',
    '.,,,,,,,,,,,,,,,,,,.',
    '..,.t..t..t......,,.',
    '..,..............,,.',
    '..,,,,,,,,,,,,,,,,,.',
    'FFFFFFFFFFFF,,FFFFFF',
  ]);
  map.plant(51, 33, 'log');
  map.plant(47, 39, 'haystack');
  map.plant(55, 41, 'barn');

  // == BEACON KEEP - the north-east ========================================
  // Pine and rock, and the tower. Moated on two sides by the river and on the
  // third by the race, so the only dry way in is under the gatehouse - until
  // the water drops and the old causeway shows.
  map.draw(43, 3, [
    '....C.....p..p..p.',
    '.p........p..p..p.',
    '..C.......,,,,....',
    '..........,,,,.p..',
    ',,,,......,,..C...',
    ',,,,,,,,,,,,..p.C.',
    '.C...p..,,........',
    '........,,,,,,,.p.',
    '.p..C.....p.,,....',
    '..........p.,,,,C.',
    '.p.......C....,,..',
    '..C...........,,p.',
  ]);
  map.plant(47, 3, 'tower');
  map.plant(55, 5, 'roundBoulder');
  map.plant(57, 12, 'trapdoor');

  // == THE VAULT - the south-east ==========================================
  // Behind the orchard's back fence. The trapdoor is open; somebody has been
  // here since the flood.
  map.draw(33, 46, [
    '        ............,,......',
    '.ggggCggg.t..t..t...,,.t..t.',
    '.ggggCggg...........,,......',
    '..,,,,,,,,,,,,,,,,,,,,,,,...',
    '..,,..C.....,,....#....,,...',
    '..,,.t..t...,,....#..t.,,...',
    '..,,........,,,,,,,....,,.C.',
    '.C,,..t..t..,,....,,...,,...',
    'MM,,,,,,,,,,,,..t.,,,,,,,...',
    'MM,,..t....,,.....,,........',
    '..,,.......,,..t..,,..t..C..',
    '..,,,,,,,,,,,.....,,........',
    '.....t..t....t..t.,,,,,,,,..',
    '..................,,........',
    '.t..t..t..t..t..t.....t..t..',
  ]);
  map.plant(46, 51, 'trapdoorOpen');
  map.plant(55, 50, 'cellarDoors');
  map.plant(41, 56, 'crateTower');

  // The causeway from the vault to the south road. `gates.ts` owns the middle.
  map.draw(29, 54, ['MMMM', 'MMMM']);

  return map;
}
