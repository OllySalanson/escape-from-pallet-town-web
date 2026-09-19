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
    '.....................................',
    '..t..t...........t.........t..t..t...',
    '....................,,,..............',
    '.##......,,,,.......,,,.#..C.........',
    '.##.t....,,,,,,,,,,,,,,.#.....MMMMMMM',
    '.....#...,,,#,,,,#,,,,,,,,,,,,MMMMMMM',
    '..t..#.,,,,,#,,,,#,,..t..MMMMMMM.t...',
    '.....#.,,..........,,....MWWWWWWM....',
    '.##....,,.t..##..t.,,.#..MWWWWWWM.t..',
    '.##.t..,,....##....,,.#..MWWWWWWM....',
    '.......,,..........,,....MWWWWWWM....',
  ]);
  map.plant(10, 3, 'building');
  map.plant(23, 3, 'barn');
  map.plant(32, 10, 'jetty');
  map.plant(14, 9, 'cratePair');
  map.plant(25, 10, 'barrelPair');
  map.plant(36, 11, 'mooringPost');
  map.plant(11, 8, 'signboard');

  // == THE REEDBEDS - the west bank ========================================
  // The shore road runs down the river side, straight enough to be quick and
  // open enough to be watched. Inland of it the reeds stand in beds with lanes
  // between them, and the ranger's hut sits where the two ways part.
  map.draw(3, 14, [
    '....,,..................',
    '.t..,,...t..##..t..,,,..',
    '....,,......##.....,,,..',
    '.gggg,,,,,,,,,,,,,,,,,..',
    '.gggg.....#....t...,,.C.',
    '.gggg.##..#........,,...',
    '......##.gggg.##...,,,..',
    '..t......gggg.##.t..,,..',
    '.....ggg.gggg.......,,.C',
    '.##..ggg......#.ggg.,,..',
    '.##..ggg..t...#.ggg.,,..',
    '..........#...#.ggg.,,,.',
    '.gggg.##..#.........,,,.',
    '.gggg.##....t..##..,,,..',
    '.gggg.......#..##..,,...',
  ]);
  map.plant(9, 18, 'hut');
  map.plant(21, 24, 'signboard');

  // == MARKET ISLE - the middle of the river ===============================
  // The square, paved and still standing. The fountain is what you steer by
  // from any shore, and the two bridges leave the north side together: the
  // plank one goes home, the towered one goes east and is held.
  map.draw(22, 32, [
    '.,,..#....MMM...',
    '.,,..#.PPPMMMP#.',
    '.,,PPPPPPPPPPP#.',
    '#.PPPPPPPPPPPP..',
    '#.PP...PPPP.PP.#',
    'wwPP...PPPP.PPww',
    'wwPPPPPPPPPPPPww',
    '#.PPPPP.PPPPPP.#',
    '#..PPPP.PPPP....',
    '.t...PPPPP...t..',
    '......PPP.......',
    '.##...,,,...##..',
  ]);
  map.plant(23, 28, 'bridge');
  map.plant(31, 28, 'stoneBridge');
  map.plant(26, 36, 'stoneFountain');
  map.plant(30, 33, 'marketStall');
  map.plant(33, 36, 'produce');
  map.plant(29, 40, 'bench');
  map.plant(24, 39, 'barrel');
  map.plant(36, 40, 'banner');

  // The fords either side of the isle, carried across the arms.
  map.draw(19, 37, ['www', 'www']);
  map.draw(38, 37, ['www', 'www']);

  // == OLD TOWN - the south-west ===========================================
  // The street the water came up. Houses either side of it, the green with
  // the shrine on it, and the road on south to the gate.
  map.draw(3, 29, [
    '..,,............',
    '.t.,,..t...##.t.',
    '...,,......##...',
    '.#.,,,,,,,,,,,,.',
    '.#.,,.......,,,,',
    '...,,.......,,..',
    '.t.,,..t....,,#.',
    '...,,,,,,,,,,,#.',
    '.#.,,""""..,,,,,',
    '.#.,,""""..,,..,',
    '...,,""""#.,,.t.',
    '.t.,,....#.,,...',
    '...,,,,,,,,,,.#.',
    '.#..,,...,,...#.',
    '.#..,,.t.,,.....',
  ]);
  map.draw(3, 44, [
    '....,,...,,...............',
    '.t..,,...,,,,,,,,,,..t..#.',
    '....,,.......#..,,,.....#.',
    '.##.,,,,,,,..#...,,,,,....',
    '.##....#,,,.......#.,,..t.',
    '....t..#.,,,,,,...#.,,....',
    '.........,,..,,,,,,,,,.##.',
    '.#..##...,,.....t...,,.##.',
    '.#..##.t.,,,,,......,,....',
    '.........,,..,,..##.,,,.t.',
    '.t..#....,,..,,..##..,,...',
    '....#..t.,,,,,,.......,,..',
    '..........,,..,,,,,,,,,,..',
    '.##..t....,,......t...,,..',
    '.##.......,,,,,,,,,,,,,,..',
    '....t..t.....,,...........',
    '.............,,...........',
  ]);
  map.plant(8, 32, 'house');
  map.plant(8, 40, 'house');
  map.plant(9, 37, 'shrine');
  map.plant(17, 33, 'statue');
  map.plant(12, 50, 'house');
  map.plant(21, 52, 'barn');
  map.plant(14, 47, 'barrel');

  // == MILL WEIR - the east bank, north ====================================
  // The mill stands on its pond with the race running back to the river. The
  // race is also the keep's moat, and the gatehouse stands in it.
  map.draw(30, 17, [
    '..........   ..................',
    '.t..##..t.   .t..,,,..         ',
    '....##....   ....,,,..         ',
    '..,,,,,,..                     ',
    '..,,..,,..                     ',
    '..,,..,,,,,,,,,,,,,,,.         ',
    '.#,,.....,,,.....,,,,.         ',
    '.#,,.t...,,,..t...,,,.         ',
    '..,,.....,,,......,,,,,,,,,,,,,',
    '..,,,,,,,,,,..##...,,..t....,,.',
    '.....#....,,..##...,,.......,,.',
    '.t...#....,,.......,,..##...,,.',
  ]);
  map.plant(46, 22, 'house');
  map.plant(55, 25, 'haystack');
  map.plant(59, 19, 'crateStack');

  // The gatehouse in the race, and the stone that runs under its arch.
  map.draw(46, 17, ['MMM', 'MMM', 'MMM', 'MMM', 'MMM']);
  map.plant(45, 15, 'gatehouse');

  // == THE ORCHARD - the east bank, south ==================================
  // Planted in rows, because an orchard is, and the rows are still there. The
  // lanes between them are the only straight things on this map, and none of
  // them runs far before a tree that came down.
  map.draw(41, 29, [
    '..,,.........,,.....',
    '..,,..t..t...,,.t...',
    '..,,.........,,.....',
    '..,,,,,,,,,,,,,,,,..',
    '..,,..t..t..t.,,....',
    '..,,..........,,.t..',
    '..,,,,,,,,,,..,,....',
    '.....t..t..,..,,,,,.',
    'ww.........,..,,..,.',
    'ww,,,,,,,,,,.t..t.,.',
    '..,,...........,,,,.',
    '..,,.t..t..t...,,...',
    '..,,...........,,.t.',
    '..,,,,,,,,,,,,,,,...',
    '.....t..t...,,......',
    '............,,..t...',
    'FFFFFFFFFFFF,,FFFFFF',
  ]);
  map.plant(55, 37, 'barn');
  map.plant(45, 43, 'haystack');

  // == BEACON KEEP - the north-east ========================================
  // Rock and pine, and the tower. Moated on two sides by the river and on the
  // third by the race, so the only dry way in is under the gatehouse.
  map.draw(43, 3, [
    '..................',
    '..p..C....p..C..p.',
    '......,,,,........',
    '.C....,,,,,,,.C...',
    '......,,..,,,.....',
    '......,,..,,,,,,..',
    '.p....,,..C..,,,..',
    '......,,,,,,,,,..C',
    '.C..p...,,,...p...',
    '........,,,.......',
    '..C.....,,,..C..p.',
    '.....p..,,,.......',
  ]);
  map.plant(44, 3, 'tower');
  map.plant(54, 6, 'roundBoulder');
  map.plant(58, 12, 'trapdoor');

  // The drowned causeway between the Landing and the keep. `gates.ts` owns
  // these tiles: deep while the sluice is held, a ford once it is not.
  map.draw(40, 7, ['WWW', 'WWW']);

  // == THE VAULT - the south-east ==========================================
  // Behind the orchard's back fence. The trapdoor is open; somebody has been
  // here since the flood.
  map.draw(33, 47, [
    '...............,,...........',
    '.t..##..t..C...,,..t..##..t.',
    '....##.........,,.....##....',
    '..,,,,,,,,,,,,,,,,,,,,,,,...',
    '..,,...C....,,....#....,,...',
    '..,,.t......,,....#..t.,,...',
    '..,,....##..,,,,,,,....,,.C.',
    '.C,,....##..,,....,,...,,...',
    '..,,,,,,,,,,,,..t.,,,,,,,...',
    '..,,..t....,,.....,,........',
    '..,,.......,,..##.,,..t..C..',
    '..,,,,,,,,,,,..##.,,........',
    '.....t..C....t....,,,,,,,,..',
    '..................,,........',
  ]);
  map.plant(46, 52, 'trapdoorOpen');
  map.plant(52, 49, 'cellarDoors');
  map.plant(40, 56, 'crateTower');

  return map;
}
