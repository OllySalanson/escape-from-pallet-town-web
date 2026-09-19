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
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
      p: { prop: 'pine', anchor: [0, 2], ground: '.', blocks: [[0, -1], [1, -1], [1, 0]] },
    },
  });

  // == THE RIVER, AND THE FOREST IT RUNS THROUGH ============================
  // Laid down first, because everything else is cut out of it. The river runs
  // in long reaches with square bends - this sheet's bank is a lip that runs,
  // and a shore drawn as a staircase reads as a staircase. Everything that is
  // not river is wood: thicket, with a tree on every third column of every
  // second row, as this kind of forest is planted. So a district is carved,
  // not built - what nobody cut stays a wall, and no two pieces of map can
  // meet along a seam that turns out to be a corridor.
  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWWWWWWWWWWWWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWWWWWWWWWWWWWWTTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTTTTTTTTTTWWWTTTtTTtTTWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTWWWTTTTTTTTTWWWWWWWTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTWWWWWWWWWWWWWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTWWWWWWWWWWWWWWWWWWWTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTTTTTTTTTTTTTWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTTTTTTTTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWWWWWWWWWWWWWWWWWWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTTTTTTTTTTTTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWTTTtTTtTTtTTtTTTWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWWWWWWWWWWWWWWWWWWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTWWWWWWWWWWWWWWWWWWWWWWTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTTTTTTTTTTTTWWWTTTTTTTTTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // == THE LANDING - the north-west quay ===================================
  // A clearing that opens onto the water. The office is tucked under the wood
  // with a hedge run from it to the boathouse, the yard is in front of both,
  // and the stone quay wraps the bay the flood bit out of it, with the ferry
  // jetty running out into that. East along the quay the old causeway goes
  // under: three tiles of deep water, and the keep's tower on the far side.
  map.draw(8, 5, [
    '   ,,,,#######,,,,              ',
    '  T,,,,#######,,,,              ',
    '   ,,,,,,,,,,,,,,,,MMMMMMMMMMMMM',
    '  T,,,,,,,,,,,,,,,,MMMMMMMMMMMMM',
    ' ,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMM',
    ' ,,,,,,,,,,,,,,,,,,MMMWWWWWWMMMM',
    ' ,,         ,,,,,,,MMMWWWWWWMMMM',
    ' ,,        T  T  T MMMWWWWWWMMMM',
    ' ,, ..             MMMWWWWWWMMMM',
  ]);
  map.plant(11, 5, 'building');
  map.plant(22, 5, 'barn');
  map.plant(32, 10, 'jetty');
  map.plant(32, 7, 'crateStack');
  map.plant(29, 8, 'barrelPair');
  map.plant(18, 7, 'cratePair');
  map.plant(14, 9, 'sack');
  map.plant(12, 10, 'sack');
  map.plant(21, 9, 'barrel');
  map.plant(37, 12, 'mooringPost');
  map.plant(12, 13, 'hut');

  // == THE REEDBEDS - the west bank ========================================
  // The road doglegs east past the ranger's hut and runs down the river side,
  // quick and in plain view. Everything inland of it is reeds: one marsh, a
  // lone tree standing in it to steer by, and no way through that is free.
  map.draw(3, 14, [
    '      ,, ..             ',
    '      ,, ..             ',
    '      ,,,,,,,,,         ',
    ' ggg....Cgg..,,,,       ',
    'gggggCggggg..T,,,,,,,,, ',
    'gggggWWWgggg.C,,,,,,,,, ',
    ' ggggWWWgggggCggg...,,.C',
    '  .gWW.gg.t.gggg..C.,,. ',
    '  CgWWg..ggggWWg..,,,,  ',
    ' ..CgggCg...gWWgg.,,,   ',
    '  .ggCgggg..Cgggg.,,.T  ',
    ' ggggggggggCggggT,,,,,, ',
    ' gggggCggggggggT.....,, ',
    '   ,,                ,, ',
    '   ,C              T,,, ',
  ]);

  // == MARKET ISLE - the middle of the river ===============================
  // The square, paved and still standing. Two bridges leave its north shore
  // side by side - the plank one goes home, the towered one goes east and is
  // held, with a banner either hand of it - and whoever comes off either finds
  // the fountain in front of them.
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
  ]);
  map.plant(23, 28, 'bridge');
  map.plant(31, 28, 'stoneBridge');
  map.plant(26, 34, 'stripedStall');
  map.plant(31, 37, 'stoneFountain');
  map.plant(26, 38, 'produce');
  map.plant(34, 39, 'bench');
  map.plant(34, 35, 'potPlant');
  map.plant(24, 35, 'cratePair');
  map.plant(31, 33, 'banner');
  map.plant(35, 33, 'banner');

  // The ford to Old Town. The one to the orchard is `gates.ts`'s to open.
  map.draw(19, 37, ['www', 'www']);

  // == OLD TOWN - the south-west ===========================================
  // The street the water came up: two houses behind their front hedges, the
  // old tree the street has always gone round, and the green with the shrine.
  map.draw(3, 29, [
    '   ,,           ',
    '   ,,           ',
    '   C,.......... ',
    '   ,,.......... ',
    '   ,,.......... ',
    '   ,C.......... ',
    '   ,,.......... ',
    '   ,,##,####,## ',
    '   ,,,,,...,,,,,',
    '   ,,,,,.t.,,,,,',
    '     ,,,,,,, ,, ',
    '    T""""""  ,, ',
    '     """"""  ,, ',
    '    T######  ,, ',
    '             ,, ',
  ]);
  map.plant(8, 31, 'house');
  map.plant(13, 31, 'house');
  map.plant(10, 40, 'shrine');

  // South of the river: the towpath in its reeds, the last house, and the
  // road down to the gate.
  map.draw(3, 44, [
    '             ,,           ',
    '             ,,           ',
    '             ,,           ',
    '             ,,,ggggCggggg',
    '           ,,,,,ggggCggggg',
    '           ,,             ',
    '   .....   ,,             ',
    '   .....   ,,,,,,,,,      ',
    '   .....         ,,       ',
    '   .....         ,,,,,,,,,',
    '   .....              ,,,,',
    '   ,,,,,,,,,,,            ',
    '            ,,            ',
    '            ,,,,,,,       ',
    '                 ,,       ',
    '              ,,,,,       ',
    '              ,,          ',
  ]);
  map.plant(6, 50, 'house');
  map.plant(24, 49, 'hut');

  // == MILL WEIR - the east bank, north ====================================
  // The towered bridge lands here, and the road from it forks at once: north
  // to the gatehouse, east to the mill on its pond, south into the orchard.
  map.draw(30, 17, [
    '                               ',
    '                               ',
    '              ,,,,,            ',
    '              ,,,,,            ',
    '              ,,,,,            ',
    '    ,,,,,,,,,,,,,,,,,          ',
    '    ,,       ,,   ,,,,,,.....  ',
    '    ,,       ,,       ,,.....  ',
    '  ,,,,,,,,   ,,       ,,.....  ',
    '  ,,,        ,,       ,,.....  ',
    '  ,,,        ,,       ,,.....  ',
    '  ,,,        ,,                ',
  ]);
  map.plant(53, 23, 'house');
  map.plant(50, 26, 'haystack');

  // The gatehouse in the race, and the stone that runs under it.
  map.draw(46, 15, ['MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM']);
  map.plant(45, 15, 'gatehouse');

  // == THE ORCHARD - the east bank, south ==================================
  // Planted in rows, because an orchard is, and the rows are still there -
  // the only straight lines on this map, and none runs far before a tree that
  // came down in the flood.
  map.draw(41, 29, [
    '  ,,                ',
    '  ,,,,,,,,,,,,,,,,, ',
    '  ,,.t..t..t..t.,,  ',
    '  ,,............,,  ',
    '  ,,,,,,,..,,,,,,,  ',
    '   ,.t..t.....t.,   ',
    '   ,............,,  ',
    '  ,,,,,,,,,,,,,,,,  ',
    '  ,,.t.....t..t.,,  ',
    '  ,,............,,  ',
    '  ,,,,,,,,,,,,,,,,  ',
    '   ,.t..t..t....,   ',
    '   ,............,,  ',
    '   ,,,,,,,,,,,,,,,  ',
    '            ,,      ',
    '            ,,      ',
    'FFFFFFFFFFFF,,FFFFFF',
  ]);
  map.plant(50, 34, 'log');
  map.plant(48, 37, 'haystack');

  // == BEACON KEEP - the north-east ========================================
  // Pine and rock, and the tower. Moated on two sides by the river and on the
  // third by the race, so the only dry way in is under the gatehouse - until
  // the water drops and the old causeway shows.
  map.draw(43, 3, [
    '    ...           ',
    '    ...           ',
    '    ...  ,,,,,,   ',
    '    ...  ,,  ,,   ',
    ',,,,...,,,,  ,,,  ',
    ',,,,...,,     ,,  ',
    '   ,...       ,,  ',
    '   ,,,,,,,,,,,,,  ',
    '   ,,       ,,    ',
    '   ,,             ',
    '   ,,             ',
    '   ,,             ',
  ]);
  map.plant(47, 3, 'tower');
  map.plant(56, 12, 'trapdoor');

  // == THE VAULT - the south-east ==========================================
  // Behind the orchard's back fence. The trapdoor is open; somebody has been
  // here since the flood.
  map.draw(33, 46, [
    '                    ,,      ',
    ' ggggCggg           ,,      ',
    ' ggggCggg   ,,,,,,,,,,      ',
    '  ,,,,,,,,,,,,              ',
    '  ,,      vvvvvvv           ',
    '  ,,      vvvvvvv,,,,,,     ',
    '  ,,      vvvvvvv    ,,     ',
    '  ,,      vvvvvvv    ,,     ',
    'MM,,                 ,,     ',
    'MM,,,,,,,,,,,,,,,,,,,,,     ',
  ]);
  map.plant(45, 51, 'trapdoorOpen');
  map.plant(44, 50, 'barrel');
  map.plant(49, 52, 'crateStack');

  // The causeway from the vault to the south road. `gates.ts` owns the middle.
  map.draw(29, 54, ['MMMM', 'MMMM']);

  return map;
}
