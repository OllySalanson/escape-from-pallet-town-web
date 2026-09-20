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
 * Eight places, and what the river does to each:
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
 * `C` rock, `F` fence. And this map's own letters: `t` is a tree of the forest,
 * `o` one that stands in grass - an orchard row, a landmark - `p` a pine and
 * `b` a tall bush one tile wide, each drawn where its trunk stands - the two rows at and above
 * the letter are solid, and the crown above those is walked behind.
 */
export function sketchFloodplainRelay(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 128,
    height: 128,
    fill: '.',
    stamps: {
      // A tree of the forest: cut the ground from under it and it goes, and
      // its tile goes back to thicket.
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
      // A tree somebody planted, or one that stands alone: it is in grass, and
      // nothing is cut from under it.
      o: { prop: 'tree', anchor: [1, 2], ground: '.' },
      p: { prop: 'pine', anchor: [0, 2], ground: '.', blocks: [[0, -1], [1, -1], [1, 0]] },
      // One tile wide, so it stands where nothing else will: in a hedge.
      b: { prop: 'tallBush', anchor: [0, 2], ground: 'T' },
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
    'TtTTtTTtTTtTTtTTTTTTTTTTTtTTtTWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
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
    ' ,,  ,,,,,  ,,,,,,,MMMWWWWWWMMMM',
    ' ,,  T  T  T  T  T MMMWWWWWWMMMM',
    ' ,, ..             MMMWWWWWWMMMM',
  ]);
  map.plant(11, 5, 'building');
  map.plant(22, 5, 'barn');
  map.plant(32, 10, 'jetty');
  map.plant(32, 7, 'crateStack');
  map.plant(29, 8, 'barrelPair');
  map.plant(18, 7, 'cratePair');
  // Where you wait for the ferry. It also stops the yard being a twelve-tile
  // dash, which two sacks at the player's feet used to do and looked it. The
  // yard is two rows deep here and so is a bench, so the way past is the path
  // feet have worn round the end of it: for eleven commits there was none, and
  // the front door was sealed off from its own quay, the route board and the
  // Ferry Dock - unnoticed, because with every gate open the quay can still be
  // reached the long way, through the keep. `floodplainRelay.test.ts` now
  // walks a fresh save from the front door to everything on the home bank.
  map.plant(14, 9, 'bench');
  map.plant(21, 9, 'barrel');
  map.plant(37, 12, 'mooringPost');
  map.plant(37, 7, 'barrel');
  map.plant(12, 13, 'hut');

  // == THE REEDBEDS - the west bank ========================================
  // The road doglegs east past the ranger's hut and runs down the river side,
  // quick and in plain view. Carry straight on instead and you are in the
  // reeds: one marsh, a lone tree standing in it to steer by, and the flooded
  // cut lying right across it. The only way round the cut is at its west end,
  // so the reeds are not a short cut that costs fights - they are the long way
  // and they cost fights, which is what makes the road a price worth reading.
  map.draw(3, 14, [
    '      ,, ..             ',
    '      ,, ..             ',
    '      ,,,,,,,,,         ',
    ' ggg....Cgg..,,,,       ',
    'gggggCggggg..T,,,,,,,,, ',
    'gggggWWWgggg.C,,,,,,,,, ',
    ' ggggWWW.ggggCggT...,,.C',
    '  .gWW.gg.o.ggggTTC.,,. ',
    ' ggWWWWWWWWWWWWWT  ,    ',
    ' ..WWWWWWWWWWWWWg  ,    ',
    ' ..ggCgggg..Cgggg  ,    ',
    ' ggggggCggggggggT,,,,,, ',
    ' gggggCggggCggggg...T,, ',
    '   ,             gggg,, ',
    '   ,            T  T,,, ',
  ]);

  // == MARKET ISLE - the middle of the river ===============================
  // The square, paved and still standing. Two bridges leave its north shore
  // side by side - the plank one goes home, the towered one goes east and is
  // held, with a banner either hand of it - and whoever comes off either finds
  // the fountain in front of them.
  map.draw(22, 32, [
    '.,,,,####,,,,,  ',
    '.,,,,####,,,,,  ',
    '..PPPPPPPPPPPP  ',
    '#.PPPPPPPPPPPP  ',
    '#.PPPPPPPPPPPP  ',
    ',,PPPPPPPPPPPP,,',
    ',,PPPPPPPPPPPP,,',
    '#.PPPPPPPPPPPP.#',
  ]);
  map.plant(23, 28, 'bridge');
  map.plant(31, 28, 'stoneBridge');
  map.plant(26, 34, 'stripedStall');
  map.plant(32, 37, 'stoneFountain');
  map.plant(24, 35, 'cratePair');
  map.plant(23, 38, 'sack');
  map.plant(31, 33, 'banner');
  map.plant(35, 33, 'banner');

  // The ford to Old Town. The one to the orchard is `gates.ts`'s to open; its
  // far landing climbs the bank and comes into the orchard between two rows.
  map.draw(19, 37, ['www', 'www']);
  map.draw(41, 33, ['  ,,', '  , ', '  , ', '  , ', ',,, ']);

  // == OLD TOWN - the south-west ===========================================
  // The footpath down from the reeds wanders in through the trees behind the
  // houses - it was never a road. Then the street the water came up, and still
  // is up: the river's shallows do not stop at the bank, they run on between
  // the houses and away down the lane south, so this is the one district that
  // is waded through. Two houses behind their front hedges, the old tree the
  // street has always gone round, and south of it the chapel - round, under a
  // cone of a roof - standing in the pool that was the green.
  map.draw(3, 29, [
    '   ,            ',
    ',,,,            ',
    ',    .......... ',
    ',    .......... ',
    ',,,, .......... ',
    '   , .......... ',
    '   , .......... ',
    '   ,,##P##PPPPPP',
    '   ,PPPP...wwwwC',
    '   ,PPPP.o.wwwww',
    '    PPPPPPPPPwwP',
    '     wwwwwwwwww ',
    '     wwwwwwwwCw ',
    '     wwwwwwwwPP ',
    '     wwwwwwwwPP ',
  ]);
  map.plant(8, 31, 'house');
  map.plant(13, 31, 'house');
  // The town's chapel, round under a cone of a roof, standing in what was its
  // green. It is the one building on this map shaped like that.
  map.plant(9, 40, 'roundhouse');
  // What says town, and says drowned. A second stranger placed every exit and
  // every gate on this map from memory and still drew this district as "two
  // barns" and "a chapel by a pond": the street was earth with a lipped pool
  // beside it. So it is paved, with the pavement still showing along both
  // sides of the water that has taken its east end; there is a mooring post on
  // a street corner, which is the whole story in one object; and the
  // churchyard's stones stand in the chapel's pool. Nothing else on the map
  // has a gravestone on it.
  map.plant(15, 38, 'mooringPost');
  map.plant(12, 42, 'gravestone');
  map.plant(14, 40, 'gravestoneWorn');

  // South of the river: the towpath in its reeds, the last house, and the
  // road down to the gate. The road is the town's own paving all the way from
  // the drowned street to the arch - three screens of wood lie between the
  // houses, the chapel, the last house and the gate, and the paving underfoot
  // is what says they are one town.
  map.draw(3, 44, [
    '             PC           ',
    '             PP           ',
    '       T     PP           ',
    '             PP,ggggCggggg',
    '           PPPPTgggggggggg',
    '           PP        ..   ',
    '   .....   PP        ..   ',
    '   .....   PP,,,,,,, ..   ',
    '   .....   PP    ,,  ,,   ',
    '   .....   PP    ,,,,,,,,,',
    '   .....   PP         ,,,,',
    '    PPPPPPPPPP            ',
    '            PPPP          ',
    '              PP          ',
    '              PP         T',
    '              PP          ',
    '              PP          ',
  ]);
  map.plant(6, 50, 'house');
  map.plant(24, 49, 'hut');
  // The South Gate: the one way out of this map that is always open, and until
  // now a road that stopped in a wood. The road runs through the arch.
  map.plant(16, 57, 'stoneArch');

  // == MILL WEIR - the east bank, north ====================================
  // The towered bridge lands here. The road from it runs up to the towpath
  // along the race, and the towpath forks: on to the gatehouse, or east past
  // the mill on its pond and round into the orchard. The toll road is a cart
  // road, two wide with a passing place at the toll house door; the way down
  // to the orchard is what pickers' feet wore, one tile and never straight.
  map.draw(30, 17, [
    '                               ',
    '                               ',
    '                               ',
    '       T                       ',
    '                               ',
    '      ,,,,,,,,, ,,,,,          ',
    '      ,,     ,,,,,,,,          ',
    '    T ,,, T   ,    ,,          ',
    '      ,,,     ,    ........    ',
    '    T ,,  T  ,, T  ........    ',
    '  ,,,,,,     ,  t  ........    ',
    '  ,,,        ,,,,  ........    ',
  ]);
  // The mill's own doorstep, a row south of the rest of its yard.
  map.draw(49, 29, ['........']);
  map.plant(52, 25, 'house');
  map.plant(50, 26, 'bigStump');
  // What says mill: the weir the district is named for, set in the race between
  // the gatehouse and the pond, and flour sacks stacked by the door. Without
  // them this was a house by a square pond, and a stranger who toured the map
  // once named the place after the gate instead.
  map.plant(50, 20, 'wetRock');
  map.plant(50, 28, 'sack');
  map.plant(51, 28, 'sack');
  // The toll house, door to the road, where the towered bridge lands. The road
  // north of the isle had nothing on it to remember it by.
  map.plant(34, 24, 'hut');

  // The gatehouse in the race, and the stone that runs under it. Nothing else
  // crosses the race: the water either side of these three tiles is the wall.
  map.draw(46, 15, ['MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM', 'MMM']);
  map.plant(45, 15, 'gatehouse');

  // == THE ORCHARD - the east bank, south ==================================
  // Planted in rows, because an orchard is, and the rows are still there:
  // fruit bushes on mown turf, a lane between each pair. It is the one place
  // on this map that is regular on purpose, which is what says somebody
  // planted it. Alternate rows are set half a step over, so no gap lines up
  // with the next and the rows can be threaded but never run.
  map.draw(41, 29, [
    '    ,,              ',
    '    ,,,,,,,,,,      ',
    '    #"#"#"#"#"#"    ',
    '      ,,,,,,,,,,    ',
    '    "#"#"#"#"#"#    ',
    '    ,,,,,,,,,,      ',
    '    #"#"#"#"#"#"    ',
    '      ,,,,,,,,,,    ',
    '    "#"#"#"#"#"#    ',
    '    ,,,,,,,,,,      ',
    '    #"#"#"#"#"#"    ',
    '  T   ,,,,,,,,,,    ',
    '    "#"#"#"#"#"#    ',
    '    ,,,,,,,,,,      ',
    '            ,,      ',
    '     T  T   ,,   T  ',
    'FFFFFFFFFFFF,,FFFFFF',
  ]);

  // == BEACON KEEP - the north-east ========================================
  // The tower, and the court it stood over. The court is laid in the same stone
  // as the causeway and the passage under the gatehouse, so the three read as
  // one built thing - which is what tells you, the day the causeway comes up,
  // that it was always the keep's. Its wall is down to rubble with gaps in it,
  // and the statue stands in one of the gaps, looking into the court. Moated on
  // two sides by the river and on the third by the race, so the only dry way in
  // is under the gatehouse - until the water drops.
  // The one tile of stone south of the neck under the tower is the Signal Fire's:
  // the exit stood in the neck itself, and an open exit takes whoever steps on
  // it, so the walk from the court to the risen causeway ended the raid.
  map.draw(43, 3, [
    '    ...           ',
    '    ...  T        ',
    '    ... CC CCCC   ',
    '    ...CMMMMMMC   ',
    'MMMM...MMMMMMMC   ',
    'MMMM...MMMMMMM    ',
    '   M...CMMMMMMC   ',
    '   MMMMMMMM C     ',
    '     M MM         ',
    '       MM         ',
    '       MM         ',
    '   MMMMMM         ',
  ]);
  map.plant(47, 3, 'tower');
  map.plant(53, 3, 'statue');

  // The keep's own wood. The forest is one species from edge to edge, which is
  // most of why its lattice reads as a lattice; round the court the nearest ring
  // of it is pine. A pine is two tiles across where a broadleaf is three, so each
  // leaves a tile of thicket showing beside it. The map's border stays broadleaf.
  map.draw(46, 4, [
    '         p  p ',
    '              ',
    '            p ',
    '              ',
    '            p ',
    '              ',
    '            p ',
    '              ',
    'p        p  p ',
    '              ',
  ]);

  // == THE VAULT - the south-east ==========================================
  // Behind the orchard's back fence, and the end of the chain. What is left of
  // the relay's store-house is its floor: stone, with a corner of rubble, and
  // the cellar trapdoor in the middle of it thrown open - somebody has been
  // here since the flood. The flood is still here too: south of the yard the
  // ground is a pond in its reeds, with the culvert mouth on its bank that the
  // water came in by and that the way out goes through - the reeds stop at its
  // mouth, so the exit is the end of them and nothing lies past it. The path round to it
  // leaves the yard by its own side, so the yard has two ways out. The way back
  // west to the causeway is a footpath, one tile wide: no cart ever went there.
  map.draw(33, 46, [
    '          T  T  T   ,,      ',
    ' ggggCggg           ,,      ',
    ' ggggCggg T  T   ,,,,,   T  ',
    '  ,,,,,,,,,      ,,         ',
    '   ,     CMMMMMv,,,   T     ',
    '   ,     vMMMMMv            ',
    '   ,     vMMMMMv            ',
    '  ,,,,,,,vvvvvvv            ',
    'MM  ,,     ,,               ',
    'MM,,,,     ,,               ',
    '    ,,,,,,,,,               ',
    '        gWWWWWW             ',
    ' T      gWWWWWWg            ',
    '        gggggggg            ',
  ]);
  map.plant(45, 51, 'trapdoorOpen');
  map.plant(42, 52, 'barrel');
  map.plant(47, 52, 'crateStack');
  map.plant(49, 57, 'culvert');

  // The causeway from the vault to the south road. `gates.ts` owns the middle.
  map.draw(29, 54, ['MMMM', 'MMMM']);

  // <<<NEWGROUND>>>

  // == THE WOOD, CARRIED ON ================================================
  // The same forest over the ground the flood reached. It is two more blocks
  // rather than one bigger one on purpose: the 64x64 picture above is still
  // the picture that was drawn and reviewed, and everything below this line is
  // ground added beside it, so a diff says which is which.
  map.draw(64, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);


  map.draw(0, 64, [
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);


  // == THE RIVER BELOW THE TOWN ============================================
  // It leaves between Old Town and the isle and keeps going, and what it does
  // on the way down is the whole shape of the south: one reach south, one
  // square bend east, one reach south into the tide. West of it is the
  // grazing marsh and the wharf the barges loaded at; east of it the fields
  // the water never gave back. The two sides do not meet again until the sands
  // at the very bottom of the map, and that crossing is a door somebody holds.
  map.draw(30, 64, [
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
  ]);

  // The square bend. A shore drawn as a staircase reads as a staircase.
  map.draw(30, 86, [
    'WWWWWWWWWWWWW',
    'WWWWWWWWWWWWW',
    'WWWWWWWWWWWWW',
  ]);

  // The last reach, down to the tide.
  map.draw(40, 89, [
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
  ]);


  // == THE TIDE ============================================================
  // The bottom of the map is salt water and the sand it goes off at low water.
  // The banks are drawn over this in THE MUDS; what is laid here is the water
  // they stand in, so a bank nudged by a tile cannot leave a seam.
  map.draw(2, 112, [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);


  // The lagoon. The sea came through the wall and has not gone back, so the
  // hundred behind it is a sheet of water with its own hedge banks standing in
  // it - which is what tells a player, before anything says so, what the flood
  // that took the relay actually was.
  map.draw(58, 98, [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);

  // The breach: four rows of sea wall simply gone.
  map.draw(71, 108, [
    'WWWWW',
    'WWWWW',
    'WWWWW',
    'WWWWW',
  ]);


  // == THE CUT =============================================================
  // The one water here nobody's flood made: a drain taken dead straight from
  // the kilns to the wall to keep the levels dry, culverted twice and not a
  // third time. Everything east of it is reached over one of those two.
  map.draw(97, 34, [
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
  ]);


  // == HOLLOW BECK =========================================================
  // Where the mill's water comes from: off the levels, west under the quarry
  // and north into the mill pond - so the pond, the race, the gatehouse and
  // the weir turn out to be one thing with a beginning.
  map.draw(70, 28, [
    'WWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);

  // The leg north to the pond, two tiles wide under the quarry wall.
  map.draw(68, 21, [
    'WW',
    'WW',
    'WW',
    'WW',
    'WW',
    'WW',
    'WW',
    'WW',
  ]);

  // And in at the pond's east end, under the wood.
  map.draw(59, 20, [
    'WWWWWWWWWWW',
    'WWWWWWWWWWW',
  ]);


  // The quarry's own water: the pit the diggers stopped at, full to the brim
  // since the day the river came up.
  map.draw(68, 13, [
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWW',
  ]);


  // == THE QUARRY - east of the keep =======================================
  // Where the keep, the gatehouse, the causeway and the quay were all cut
  // from. The haul road leaves the back of the court and climbs to the top
  // bench; everything under that is face, and the only way down is the
  // self-acting incline FOREMAN RUDD stands at the head of. The benches are
  // stepped and littered, so no run along one is the same two rows twice.
  map.draw(57, 7, [
    'vCvvvvv    ',
    'vvvCvvv    ',
    '   vvvv    ',
    '   vvvvvvvv',
    '   vvvvvvvv',
  ]);

  // The rim, the top bench, and the spoil that has come down onto it.
  map.draw(64, 9, [
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'vvvvvvCvvvvvCvvvvvCvvvvvCvvvvvvvv',
    'vvvvvvvvvCvvvvvCvvvvvCvvvvvCvvvvv',
  ]);


  // The face, the incline down it, and the floor round the pit. Shut, the
  // incline is bare rock and the whole of the workings below is a place a
  // player can look into and not get to.
  map.draw(64, 12, [
    ',,CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ',,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC',
    ',,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC',
    ',,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC',
    ',,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC',
    ',,CCWWWWWWWWWWWWWWWWWWWWWWWvvvvvv',
    'vvvvvvCvvvvvvCvvvvvCvvvvvvvvvCvvv',
    'vvvCvvvvvCvvvvvvCvvvvvCvvvvvCvvvv',
  ]);


  // The hillside the quarry is cut into, and the level driven through it. The
  // adit is the foreman's second door: six tiles of dark that come out on the
  // beck, which is the mill's own water and a road the player already walked -
  // so the long way in past the keep is never the way back.
  map.draw(71, 20, [
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]);

  // The level, two tiles wide, with a mouth cut at each end.
  map.draw(88, 20, [
    'MM',
    'MM',
    'MM',
    'MM',
    'MM',
    'MM',
  ]);


  // The cart track off the top bench to the old quarry road, and the pocket at
  // the head of it the QUARRY ROAD exit stands in.
  map.draw(92, 3, [
    'vv',
    'vv',
    'vv',
    'vv',
    'vv',
    'vv',
    'vv',
  ]);


  // == HOLLOW BECK - the cleft under the workings ==========================
  // A wooded valley with the beck in the bottom of it, the quarry's rock along
  // the north side and the adit's mouth halfway up that. The track from the
  // mill yard comes in at the west end, which is what makes the whole east
  // bank a ring rather than a spur. It is thicket and rough grass with the
  // trees left where the stone was never worth taking, so it is walked along
  // and not across.
  // The valley's west floor, between the beck's leg and the mill's wood.
  map.draw(59, 22, [
    '.g..T..g.',
    '.g.....g.',
    '.g..T..g.',
    'T.TTTTTT.',
    '.g.....g.',
    '.g..T..g.',
    '.g..T..g.',
    'TT.TT.TTT',
    '.g..T..g.',
    '.g..T..g.',
    '.g.....g.',
    'TTT.TT.TT',
  ]);

  // The shelf the adit comes out on, and the head of the beck round it.
  map.draw(71, 26, [
    '..g..g..gT.g.....g.Tg..g.',
    '..g.Tg..g..g..T..g..g..gT',
  ]);


  map.draw(95, 26, [
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
  ]);

  // The south bank, which is the way west to the mill and east to the cut.
  map.draw(59, 30, [
    '.g..T..g.Tg..g..g..T..g.Tg..g..g..T..g',
    '.g.....g.Tg..gT.g.....g.Tg..gT.g.....g',
    '.g..T..g..g..gT.g..T..g..g..gT.g..T..g',
    '.TTTTTT.TT.TTTTTT.TT.TTTTTT.TT.TTTTTT.',
  ]);


  // == THE CIDER YARD - behind the orchard =================================
  // Where the orchard's fruit went, and the reason the orchard is there at
  // all. Old standards planted wide in hedged closes - which is what makes the
  // warden's tight rows read as the young planting they are - then the press
  // house and the store on the only paving east of the river that is not the
  // keep's, and the cart road that carried it all out to the drove.
  map.draw(61, 34, [
    '""""#""""#TTTT#""""#""""#TTTT#""""#"',
    'g""g#"g""#TTTT#g""g#"g""#TTTT#g""g""',
    '""""#""""#TTTT#"""""""""#TTTT#""""#"',
    'g""g""g""#TTTT#g""g#"g""#TTTT#g""g#"',
    '###"##"#########"######"#########"##',
    'g""g#"g""#""g"#g""g""g""#""g"#g""g#"',
    ',,,,,,,,,#,,,,#,,,,#,,,,,,,,,#,,,,#,',
    ',,,,#,,,,,,,,,#,,,,#,,,,#,,,,,,,,,#,',
    '""""#""""#"""""""""#""""#""""#""""""',
    '"######"##"######"##"######"##"#####',
    '""""#"""""""""#""""#""""#"""""""""#"',
    'g""g#"g""#""g""g""g#"g""#""g"#g""g""',
    '""""#""""#""""#"""""""""#""""#""""#"',
    'g""g""g""#""g"#g""g#"g"""""g"#g""g#"',
    '########"##"#########"######"#######',
    'TTTT#"g""#""g"#TTTT#"g""#""g"#TTTT#"',
    'TTTT#""""#""""#TTTT#"""""""""#TTTT#"',
    'TTTT#"g"""""g"#TTTT#"g""#""g"#TTTT#"',
    'TTTT#""""#""""#TTTT#""""#""""#TTTT#"',
    '#####"######"#########"##"#########"',
    '""""#"""""""""#""""#""""#"""""""""#"',
    'g""g#"g""#""g""g""g#"g""#""g"#g""g""',
  ]);


  // The yard: the press house on the paving, the store beside it, and the road
  // out east to the culvert over the cut. South of it the ground goes rough -
  // nothing was ever built there, because the water gets to it.
  map.draw(61, 45, [
    'PPPP#PPPP#PPPP#g""""""g"#""""#""""#"',
    'PPPPPPPPP#PPPP#""g"#"""""""""#"g""#"',
    'PPPP#PPPP#PPPP#""""#""""#"g""""""g#"',
    'PPPP#PPPP#PPPP#""""#"g""#"""g#"""""g',
    '#"######"#########"#########"##"####',
    ',,,,,,,,,,,,,,#,,,,#,,,,#,,,,,,,,,#,',
    ',,,,#,,,,#,,,,,,,,,#,,,,#,,,,#,,,,,,',
    '"g""#"""g#""""#g"""#TTTT#""""#""""#"',
    '"""g"""""#g"""#""g"#TTTT#""""#"g""#"',
    '##"##"######"##"#########"#########"',
    'g"""#""g"#""""#""""""g""#"""g#TTTT#g',
    '""g""""""#""""#"g""#"""g"""""#TTTT#"',
  ]);

  // The gap in the orchard's back hedge, and the cart road through it.
  map.draw(57, 40, [
    ',,,,',
    ',,,,',
  ]);

  // The track down out of the beck into the head of the yard.
  map.draw(66, 32, [
    '..',
    '..',
  ]);

  // And the track on south through the wood to the withy beds.
  map.draw(66, 56, [
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
  ]);


  // == THE KILNS - the heath above the levels ==============================
  // Where the quarry's stone was burnt. A bank of draw kilns cut into the
  // hillside with the tramway running along their floor from the quarry's top
  // bench, the burner's yard behind them, and heath in closes the rest of the
  // way down to the head of the cut. It is the top of the east side, and the
  // one place on this map that looks out over the whole of it.
  map.draw(97, 5, [
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'vvvvvvvCvvvvvvvvCvvvvvvvvCvvvv',
    'vvvCvvvvvvvvCvvvvvvvvCvvvvvvvv',
    'vvvvvCvvvvvvvvCvvvvvvvvCvvvvvv',
    'vCvvvvvvvvCvvvvvvvvCvvvvvvvvCv',
    '######"######"#########"##"###',
    '""g""g""g#"g""#TTTT#g""g#"g""#',
    '""g"#g""g""g""#TTTT#g""g""g""#',
    '""g"#g""g#"g""#TTTT#g""g#"g"""',
    '"######"##"#########"######"##',
    '""g"#g""g""g""#""g"#g""g""g""#',
    '""g"#g""g#"g"""""g"#g""g#"g""#',
    '""g""g""g#"g""#""g""g""g#"g""#',
    '#"######"#########"##"######"#',
    '""g"#g""g#TTTT#""g"#g""g#"g"""',
    '""g""g""g#TTTT#""g""g""g#"g""#',
    '""g"#g""g#TTTT#""g"#g""g""g""#',
    '##"##"#########"######"#######',
    '""g""g""g#"g""#""g""g""g#TTTT#',
    '""g"#g""g""g""#""g"#g""g#TTTT#',
    '""g"#g""g#"g"""""g"#g""g#TTTT#',
    '###"#########"##"######"######',
    '""g"#TTTT#"g""#""g"#g""g""g""#',
    '""g"#TTTT#"g"""""g"#g""g#"g"""',
    '""g"#TTTT#"g""#""g""g""g#"g""#',
  ]);

  // The head of the drove, where the kilns' heath runs out onto the levels.
  map.draw(97, 32, [
    ',,,',
    ',,,',
  ]);


  // == THE LEVELS - the drained fen east of the cut ========================
  // The one part of this map somebody laid out with a ruler, and it shows: a
  // drove road down the cut's east bank with a pollard willow standing in it
  // every third rod, and fields three rows deep between one-tile drains all
  // the way to the edge of the map. It is the quick way south on this side of
  // the river, and every step off the drove is fen.
  map.draw(100, 32, [
    'T,,"ggg#"gggg"gg#g"gggg"gTT',
    ',,,g#gg"gggg"#ggg"gggg#ggTT',
    ',,,ggg"#ggg"gggg#gggg"gggTT',
    ',T,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,g"ggg#"gggg"gg#g"gggg"TT',
    ',,,"g#gg"gggg"#ggg"gggg#gTT',
    ',,Tgggg"#ggg"gggg#gggg"ggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gg"ggg#"gggg"gg#g"ggggTT',
    'T,,g"g#gg"gggg"#ggg"gggg#TT',
    ',,,"gggg"#ggg"gggg#gggg"gTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',T,ggg"#ggg"gggg#gggg"gggTT',
    ',,,g#"gggg"gg#g"gggg"g#ggTT',
    ',,,g"gg#g"gggg"g#gg"gggg"TT',
    ',,TWWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gggg"#ggg"gggg#gggg"ggTT',
    ',,,gg#"gggg"gg#g"gggg"g#gTT',
    'T,,gg"gg#g"gggg"g#gg"ggggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,"gggg"#ggg"gggg#gggg"gTT',
    ',T,ggg#"gggg"gg#g"gggg"g#TT',
    ',,,ggg"gg#g"gggg"g#gg"gggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,Tg"gg#g"gggg"g#gg"gggg"TT',
    ',,,"#ggg"gggg#gggg"ggg#"gTT',
    ',,,gggg#gggg"ggg#"gggg"ggTT',
    'T,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gg"gg#g"gggg"g#gg"ggggTT',
    ',,,g"#ggg"gggg#gggg"ggg#"TT',
    ',T,"gggg#gggg"ggg#"gggg"gTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,ggg"gg#g"gggg"g#gg"gggTT',
    ',,Tgg"#ggg"gggg#gggg"ggg#TT',
    ',,,g"gggg#gggg"ggg#"gggg"TT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    'T,,gggg#gggg"ggg#"gggg"ggTT',
    ',,,g#g"gggg"g#gg"gggg"#ggTT',
    ',,,gg"g#gg"gggg"#ggg"ggggTT',
    ',T,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,"gggg#gggg"ggg#"gggg"gTT',
    ',,,gg#g"gggg"g#gg"gggg"#gTT',
    ',,Tggg"g#gg"gggg"#ggg"gggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,g"gggg#gggg"ggg#"gggg"TT',
    'T,,"gg#g"gggg"g#gg"gggg"#TT',
    ',,,gggg"g#gg"gggg"#ggg"ggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',T,gg"g#gg"gggg"#ggg"ggggTT',
    ',,,g#gggg"ggg#"gggg"gg#g"TT',
    ',,,"ggg#"gggg"gg#g"gggg"gTT',
    ',,TWWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,ggg"g#gg"gggg"#ggg"gggTT',
    ',,,gg#gggg"ggg#"gggg"gg#gTT',
    'T,,g"ggg#"gggg"gg#g"gggg"TT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gggg"g#gg"gggg"#ggg"ggTT',
    ',T,ggg#gggg"ggg#"gggg"gg#TT',
    ',,,gg"ggg#"gggg"gg#g"ggggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,T"ggg#"gggg"gg#g"gggg"gTT',
    ',,,g#gg"gggg"#ggg"gggg#ggTT',
    ',,,ggg"#ggg"gggg#gggg"gggTT',
    'T,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,g"ggg#"gggg"gg#g"gggg"TT',
    ',,,"g#gg"gggg"#ggg"gggg#gTT',
    ',T,gggg"#ggg"gggg#gggg"ggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gg"ggg#"gggg"gg#g"ggggTT',
    ',,Tg"g#gg"gggg"#ggg"gggg#TT',
    ',,,"gggg"#ggg"gggg#gggg"gTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWWWW',
    'T,,ggg"#ggg"gggg#gggg"gggTT',
    ',,,g#"gggg"gg#g"gggg"g#ggTT',
    ',,,g"gg#g"gggg"g#gg"gggg"TT',
    ',T,WWWWWWWWWWWWWWWWWWWWWWWW',
    ',,,gggg"#ggg"gggg#gggg"ggTT',
  ]);


  // Where the cut is culverted and the cart road and the drove are one road.
  // Two crossings - one off the cider yard, one off the withy beds - and
  // nothing else gets over this drain at all.
  map.draw(97, 45, [
    'PPP',
    'PPP',
  ]);


  map.draw(97, 80, [
    'PPP',
    'PPP',
  ]);


  // == THE DROVE - out of Old Town, south ==================================
  // The road to the South Gate forks at the last house, and the other arm of
  // it is this: a drove, hedged and two carts wide, going down to the grazing
  // marsh. It is the one piece of the new ground a raid that has beaten
  // nobody can walk to, which is on purpose - a fresh save should be left
  // somewhere to wonder about that it can actually get to.
  map.draw(7, 56, [
    ',,  ',
    ',,  ',
    ',,  ',
    ',,  ',
    ',,,,',
  ]);


  map.draw(9, 61, [
    ',,',
    ',,',
    ',,',
    ',,',
  ]);


  // == THE SALTINGS - the grazing marsh ====================================
  // Level grazing cut to pieces by creeks that fill on every tide and fenced
  // into closes nobody has mended since the flood, with the drove going
  // straight down the middle of it. Each creek is crossed in one place and
  // one only, so the marsh is walked in bands and never across.
  map.draw(2, 64, [
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    'WWWWWWWwwWWWWWWWWWWWWWWWWWWW',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    'FF"FF"FF,FFF"FF"FFFFFF"FF"FF',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    'WWWWWWWwwWWWWWWWWWWWWWWWWWWW',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"FFFFFFF,F"FFFFFF"FF"FFFFFF"',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    'WWWWWWWwwWWWWWWWWWWWWWWWWWWW',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    'FF"FF"FF,FFF"FF"FFFFFF"FF"FF',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    'WWWWWWWwwWWWWWWWWWWWWWWWWWWW',
    '"g""""",,Fg""gF"g"""""g"Fg""',
    '"g""F"",,"g""gF"g""F""g""g""',
    '"g""F"",,Fg""g""g""F""g"Fg""',
    '"FFFFFFF,F"FFFFFF"FF"FFFFFF"',
  ]);


  // == THE STAITHE - the wharf at the river's mouth ========================
  // Where the barges loaded before the flood: a stone quay down the river's
  // west bank, a lime kiln, a crane bed, and two rows of cottages behind them
  // with the lanes running between. It is the far end of the marsh road and
  // the bottom-left corner of the map, and until somebody opens the hard in
  // the quay wall it is where the west side of the world stops.
  map.draw(2, 96, [
    '"PP"PP"PP#PP"P######P"PP#PP"P#"PP"CPPP',
    '"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPP',
    '"PP"#P"PP#PP"P######P"PP#PP"PP"PP"PCPP',
    '##P##P######P#########P##P######P#PPPP',
    '"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPCP',
    '"PP"#P"PP#PP"P######P"PP#PP"PP"PP"PPPP',
    '"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PPPC',
    '###P##P######P#########P##P######PCPPP',
    '"PP"#P"PP#PP"P######P"PP#PP"PP"PP"PPPP',
    '"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PCPP',
    '"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPP',
    'P######P##P#########P######P##P###PPCP',
    '"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PPPP',
    '"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPC',
    '"PP"#P"PP#PP"P######P"PP#PP"PP"PP"CPPP',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]);


  // == THE DROWNED HUNDRED - the fields under the water ====================
  // A whole parish of small fields with a foot of water standing in them and
  // nothing above it but the hedge banks - so the field pattern is still
  // there to be read and walked, gateway by gateway, and that is the only way
  // through. It is waded, not swum; what makes it slow is the reed.
  map.draw(33, 64, [
    'wwwwwwwww######wwwwwwwww####',
    'gggg#gggg######gggg#gggg####',
    'wwww#wwww######wwww#wwww####',
    '###w##w#########w######w####',
    'wwww#wwwwwwwww#wwww#wwwwwwww',
    'gggg#gggg#ggggwgggg#gggg#ggg',
    'wwwwwwwww#wwww#wwwwwwwww#www',
    'w######w##w######w##w######w',
    'wwww#wwww#wwwwwwwww#wwww#www',
    'ggggwgggg#gggg#ggggwgggg#ggg',
    'wwww#wwwwwwwww#wwww#wwwwwwww',
    '########w##w#########w######',
    '#####wwww#wwww######wwww#www',
    '#####ggggwgggg######ggggwggg',
    '#####wwww#wwww######wwww#www',
    '#####w######w#########w##w##',
    'wwww#wwwwwwwww#wwww#wwwwwwww',
    'gggg#gggg#ggggwgggg#gggg#ggg',
    'wwwwwwwww#wwww#wwwwwwwww#www',
    '###w##w######w##w######w##w#',
    'wwww#wwww#wwwwwwwww#wwww#www',
    'ggggwgggg#gggg#ggggwgggg#ggg',
    'wwww#wwwwwwwww#wwww#wwwwwwww',
    'w#########w######w#########w',
    'wwww######wwww#wwww######www',
  ]);


  // == THE WITHY BEDS - the osier grounds ==================================
  // Willow grown on purpose, in beds, and cut on a rotation - so it is rows
  // again, like the orchard and the levels, but rows of something planted in
  // standing water. The lanes between the beds are ankle deep, and a bed
  // itself is a wall you can see over and not walk through.
  map.draw(61, 64, [
    'www#www#www#####www#wwwwwww#www#####',
    'gggwggg#ggg#####ggg#ggg#gggwggg#####',
    'www#wwwwwww#####wwwwwww#www#www#####',
    '#w##w#####w#####w#####w##w##w#######',
    'wwwwwww#www#####www#www#wwwwwww#####',
    'ggg#gggwggg#####gggwggg#ggg#ggg#####',
    'www#www#www#####www#wwwwwww#www#####',
    '##w##w##w########w##w#####w##w######',
    'www#wwwwwww#####wwwwwww#www#www#####',
    'ggg#ggg#ggg#####ggg#gggwggg#ggg#####',
    'wwwwwww#www#####www#www#wwwwwww#####',
    'w#####w##w########w##w##w#####w#####',
    'www#www#www#####www#wwwwwww#www#####',
    'gggwggg#ggg#####ggg#ggg#gggwggg#####',
    'www#wwwwwww#####wwwwwww#www#www#####',
    '#w##w#####w#####w#####w##w##w#######',
    'wwwwwww#www#####www#www#wwwwwww#####',
    'ggg#gggwggg#####gggwggg#ggg#ggg#####',
    'www#www#www#####www#wwwwwww#www#####',
    '##w##w##w########w##w#####w##w######',
    'www#wwwwwww#####wwwwwww#www#www#####',
    'ggg#ggg#ggg#####ggg#gggwggg#ggg#####',
    'wwwwwww#www#####www#www#wwwwwww#####',
    'w#####w##w########w##w##w#####w#####',
    'www#www#www#####www#wwwwwww#www#####',
    'gggwggg#ggg#####ggg#ggg#gggwggg#####',
    'www#wwwwwww#####wwwwwww#www#www#####',
    '#w##w#####w#####w#####w##w##w#######',
    'wwwwwww#www#####www#www#wwwwwww#####',
    'ggg#gggwggg#####gggwggg#ggg#ggg#####',
    'www#www#www#####www#wwwwwww#www#####',
    '##w##w##w########w##w#####w##w######',
  ]);


  // One bed at the beds' south-east corner that nothing gets into: the ride
  // into it grew over, and what a coppicer left in it is still there. It is
  // `../gates.ts`'s CUT door, and a dead end on purpose - a field move on this
  // map opens ground, never a short cut.
  map.draw(90, 85, [
    '######',
    '#ww"w#',
    '#w"ww#',
    '#ww"w#',
    '######',
  ]);


  // == THE SEA WALL and THE BREACH =========================================
  // The bank that was supposed to keep all of this dry. Behind it is rough
  // saltmarsh grazing on both sides of a hole in the world: the lagoon the sea
  // made when the wall went, open to the tide through the gap still, with the
  // hedge banks of the hundred standing out of it. BANKSMAN NYE has the stile
  // onto the crest, because the crest is the only dry road along the bottom of
  // this map and the only way down onto the sands.
  map.draw(44, 96, [
    '""g"Tg""g""g""T""g"Tg""g""g""T""g"Tg""g""g""T""g"Tg""g""g""T"',
    '""g"Tg""gT"g"""""g"Tg""gT"g"""""g"Tg""gT"g"""""g"Tg""gT"g""""',
    '""g""g""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg""g""gT"g""T"',
    'T"TTTTTT"TT"TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"TT"TTTTTT"TT',
    '""g"Tg""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg""gT"g""""',
    '""g""g""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg""g""gT"g""T"',
    '""g"Tg""g""g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg""g""g""T"',
    'TT"TTTTTTTTT"TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTT"TTTTTTTT',
    '""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT"',
    '""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT"',
    '""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT"',
    'TTT"TTTTTTTTT"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTT"TTTTTTT',
    '""g"Tg""g""g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg""g""g""T"',
  ]);

  // The crest, the groynes set in it, and the gap the sea comes through.
  map.draw(44, 109, [
    ',,,,C,,,,,,,,C,,,,,,,,C,,,,wwwww,,,,,,,,C,,,,,,,,C,,,,,,,,C,,,',
    'C,,,,,,,,C,,,,,,,,C,,,,,,,,wwwww,,,,C,,,,,,,,C,,,,,,,,C,,,,,,,',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCwwwwwCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]);


  // == THE MUDS - what the tide goes off ===================================
  // Sand banks and the gutways between them, which is what the bottom of an
  // estuary is: every bank is joined to the next at one shallow and nowhere
  // else. It is the only ground here that touches both sides of the river, so
  // with the hard open it is the way from the wharf to the breach - and until
  // the banksman falls there is no way onto it at all.
  map.draw(6, 112, [
    'ddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWdddd',
    'ddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWdddd',
    'ddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwdddd',
    'WWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWW',
    'ddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWdddd',
    'ddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwdddd',
    'ddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWdddd',
    'WWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWW',
    'ddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwdddd',
    'ddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWdddd',
    'ddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWdddd',
    'wWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwW',
    'ddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWdddd',
    'ddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWdddd',
    'ddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwdddd',
  ]);


  // == THE LIGHT - the point, and the pier =================================
  // The far corner. A stone pier out into the tide with the light on the head
  // of it, the keeper's house behind, and nothing past that but water: this is
  // where the map stops and the sea starts. The keep's tower is the first
  // thing a raid ever looks at; this is the last thing it finds.
  map.draw(105, 98, [
    '"g""T""g"Tg""g""g""T""',
    '"g"""""g"Tg""gT"g"""""',
    '"g""T""g""g""gT"g""T""',
    'TTTTTT"TTTTTTTTT"TTTTT',
    'TTTTT""g"TTTTTT"g""TTT',
    'TTTTT""g"TTTTTT"g""TTT',
    'TTTTT""g"TTTTTT"g""TTT',
    'TTTTTTT"TTTTTTTTT"TTTT',
    '"g""T""g""g""gT"g""T""',
    '"g""T""g"Tg""g""g""T""',
    '"g"""""g"Tg""gT"g"""""',
    'T"TTTTTT"TT"TTTTTT"TT"',
    '"g""T""g"Tg""g""g""T""',
    '"g"""""g"Tg""gT"g"""""',
    'WWWWWWWCMMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWMMMCWWWWWWWWWWW',
    'WWWWWWWMCMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWMMCMWWWWWWWWWWW',
    'WWWWWWWCMMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWMMMCWWWWWWWWWWW',
    'WWWWWWWMCMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWMMMMWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
  ]);

  // The wall's east end, and the road along it to the pier.
  map.draw(100, 109, [
    ',,,,,',
    ',,,,,',
  ]);


  // == THE WAYS THROUGH ====================================================
  // The track out of the mill yard, east under the beck's leg into the cleft.
  map.draw(57, 26, [
    'T.',
    '..',
  ]);

  // The quarry's haul road, out of the back of the keep's court.
  map.draw(96, 10, [
    'v',
    'v',
  ]);

  // The tramway off the top bench onto the kilns' floor.
  map.draw(97, 8, [
    'vvv',
    'vvv',
    'vvv',
    'vvv',
  ]);

  // The cart road over the first culvert, out of the cider yard.
  map.draw(96, 45, [
    'P',
    'P',
  ]);

  // And the second, up out of the withy beds onto the drove.
  map.draw(96, 80, [
    'w',
    'w',
  ]);


  // The hundred's east hedge, and the one gateway through it. Without it the
  // fields and the beds are one place with nothing between them, which is the
  // opposite of what a hedge bank is for.
  map.draw(59, 64, [
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    'ww',
    'ww',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
    '##',
  ]);


  // Off the beds and the hundred onto the saltmarsh behind the wall. The
  // whole bottom of the map is reached through these four tiles and no other,
  // which is what makes the crest worth holding.
  map.draw(63, 94, [
    'ww',
    'ww',
  ]);

  // And the hundred's own way south, west of the beds.
  map.draw(45, 89, [
    '""""',
    '""""',
    '""""',
    '""""',
    '""""',
    '""""',
    '""""',
  ]);

  // The drove, off the levels onto the wall road.
  map.draw(100, 107, [
    ',,,',
    ',,,',
  ]);

  // And the wall road east to the pier and the light.
  map.draw(105, 109, [
    ',,,,,,,,',
    ',,,,,,,,',
  ]);

  // The hard: the slipway cut through the quay wall onto the sands.
  map.draw(24, 111, [
    'dd',
  ]);

  // The drove, off the marsh road into the saltings.
  map.draw(9, 64, [
    ',,',
    ',,',
  ]);


  // == THE POCKETS A RAID LEAVES BY ========================================
  // An open exit takes whoever steps on it with no prompt, so it is a wall to
  // anybody who is not leaving: every one of these is a nub of ground with
  // nothing on the far side of it, off the lane rather than in it.
  // The cart lodge behind the cider yard - the CIDER ROAD.
  map.draw(73, 56, [
    '""',
    '""',
    '""',
  ]);

  // The lane west off the marsh, and the gate at the end of it - DROVE GATE.
  map.draw(1, 84, [
    ',,,,,',
    ',,,,,',
  ]);

  // The steps up off the wharf onto the old road - STAITHE STEPS.
  map.draw(30, 92, [
    'PP',
    'PP',
    'PP',
    'PP',
  ]);

  // The stair cut through the kiln bank, and the road away - KILN ROAD.
  map.draw(121, 3, [
    'MM',
    'MM',
    'MM',
    'MM',
    'MM',
  ]);


  // The light keeper's yard: three tiles of paving, a wall round it and one
  // way in. It is the only built thing on the point and the only place on it
  // a raid can be dropped into.
  map.draw(116, 104, [
    'TTTTT',
    'TPPPT',
    'TPPPT',
    'TTPTT',
  ]);

  // And the marsh road on into the wharf lanes.
  map.draw(9, 94, [
    ',,',
    ',,',
    ',,',
  ]);


  // == GATE POSTS, STILES AND WHAT FELL IN THE ROAD ========================
  // A lane a player can hold one direction down for ever is a lane nobody has
  // to think in, and a patch of ground with nothing within three steps of it
  // is a field. Every tile below was found by walking the finished map
  // (`tools/tileset/mapReport.mts -- floodplain-relay --runs`) and is the
  // smallest thing that answers it where it stands: a gate hung across a
  // drove, spoil come down off a face, a groyne head set in a sea wall,
  // bramble over a track nobody has cut since the water came.
  map.set(58, 88, '#');                  // the last of a hedge bank, standing on its own in the bend
  map.set(82, 49, ',');                  // the gateway out of the yard's fourth close, which was hedged in
  map.set(103, 46, '#');                 // a thorn in the drove where the culvert road joins it
  map.set(33, 101, 'C');                 // a bollard set in the wharf's top lane
  map.set(33, 104, 'C');                 // and another, two lanes down
  map.set(46, 93, '#');                  // thorn in the hundred's own way south
  map.set(67, 36, '#');                  // a hedge stub in the track down out of the beck
  map.set(9, 65, 'F');                   // a field gate hung across the drove
  map.set(10, 69, 'F');                  // and the next, hung the other side of the road
  map.set(10, 79, 'F');                  // and the next
  map.set(10, 89, 'F');                  // and the last, above the wharf lanes
  map.set(9, 93, 'F');                   // the marsh road's own gate
  map.set(57, 40, 'C');                  // a stone set in the orchard's back road
  map.set(67, 50, 'C');                  // a staddle stone left standing in the cider yard
  map.set(66, 59, '#');                  // bramble grown across the track down to the beds
  map.set(67, 57, '#');                  // and more of it, a few paces up
  map.set(66, 11, 'C');                  // spoil come down onto the top bench
  map.set(95, 10, 'C');                  // and more of it, at the bench's east end
  map.set(99, 11, 'C');                  // a fallen block left lying on the tramway
  map.set(99, 19, '#');                  // thorn grown up through the kilns' floor
  map.set(93, 27, '#');                  // a fallen tree across the adit's shelf
  map.set(96, 31, '#');                  // and another, down on the beck
  map.set(60, 74, '#');                  // the hundred's own hedge, grown back over its gateway
  map.set(45, 96, '#');                  // thicket on the saltmarsh
  map.set(96, 108, '#');                 // and more of it, under the wall
  map.set(71, 110, 'C');                 // a groyne head standing in the breach
  map.set(75, 109, 'C');                 // and its pair, on the far side of the gap
  map.set(103, 109, 'C');                // a groyne head set in the wall road
  map.set(96, 110, 'C');                 // a groyne head west of the stile, on the crest itself
  map.set(106, 110, 'C');                // and the last of them, short of the pier


  // == WHAT STANDS ON THE NEW GROUND =======================================
  // The landmarks. Every one was tried against the finished collision before
  // it went in (`tools/tileset/props.mts` draws what each one is; the map's
  // own structure rules say where one may stand), because a building is solid
  // and a building in the wrong place is a lane that stops being one.
  // -- THE QUARRY
  map.plant(86, 20, 'mineMouth');       // a level driven into the south face, west of the adit
  map.plant(90, 20, 'mineMouth');       // and its pair, east of it - three ways into the hill and one of them open
  map.plant(76, 19, 'boulders');        // spoil on the floor, where it came off the face
  map.plant(72, 11, 'crates');          // stone cut and stacked on the top bench, waiting for a cart
  // -- THE KILNS
  map.plant(100, 5, 'mineMouth');       // the first of the draw kilns, cut into the bank
  map.plant(106, 5, 'mineMouth');       // the second
  map.plant(112, 5, 'mineMouth');       // the third
  map.plant(118, 5, 'mineMouth');       // and the fourth, at the east end of the bank
  map.plant(99, 15, 'hut');             // the burner's own house, behind his kilns
  map.plant(110, 9, 'crateTower');      // lime stacked on the kiln floor
  map.plant(104, 10, 'log');            // cordwood off the tramway
  map.plant(116, 10, 'sack');           // and a sack of it nobody carried in
  // -- THE CIDER YARD
  map.plant(67, 46, 'barn');                 // the press house, on the yard's own paving
  map.plant(71, 45, 'house');           // the store, on the yard's own paving
  map.plant(66, 52, 'barrelPair');      // casks stood out in the rough ground behind it
  map.plant(78, 47, 'produceCrate');    // and the picking crates, still where the last cart left them
  map.plant(83, 46, 'sack');            // a sack of pomace that never went on the heap
  // -- THE SALTINGS
  map.plant(17, 80, 'hut');             // the shepherd's hut, on its wheels in the middle of the grazing
  map.plant(6, 72, 'log');              // driftwood the tide left in a close
  // -- THE STAITHE
  map.plant(5, 97, 'house');            // the top row of cottages
  map.plant(11, 97, 'house');           // and the second of them
  map.plant(3, 108, 'mineMouth');       // the lime kiln at the bottom of the lanes
  map.plant(38, 105, 'jetty');          // the loading stage, out over the river
  map.plant(36, 99, 'mooringPost');     // a bollard on the quay
  map.plant(26, 104, 'crateTower');     // cargo stacked in a lane and never fetched
  map.plant(16, 107, 'barrelPair');     // and casks against a wall
  // -- THE DROWNED HUNDRED and THE WITHY BEDS
  map.plant(46, 70, 'wetRock');         // a stone in a flooded field, which is all that is left of a gatepost
  map.plant(64, 72, 'stump');           // a withy stool cut off at the water
  map.plant(70, 90, 'log');             // and a bundle of cut osier, left where it was tied
  // -- THE SEA WALL and THE BREACH
  map.plant(50, 99, 'deadStump');       // a thorn the salt killed on the marsh behind the wall
  map.plant(96, 105, 'signboard');      // the board at the foot of the stile, which nobody has read in a year
  // -- THE MUDS
  map.plant(40, 117, 'wetRock');        // a rock on the sand that the tide goes round
  map.plant(60, 114, 'mooringPost');    // a mooring post standing on dry sand, which is the whole story
  map.plant(80, 120, 'log');            // and a baulk of timber the sea put down
  // -- THE LIGHT
  map.plant(109, 102, 'tower');              // the light itself, on the point - the last thing this map has to find
  map.plant(122, 100, 'hut');                // the keeper's house, behind its own yard
  map.plant(112, 120, 'mooringPost');        // and a bollard half way out the pier
  map.plant(114, 116, 'mooringPost');        // and its pair   // and a bollard half way out the pier
  // <<<ENDNEWGROUND>>>

  // == WHAT GROWS IN THE HEDGES =============================================
  // The lanes here are packed so close that the forest between them is only a
  // hedge thick: a broadleaf needs three tiles by two and fits in thirty-one
  // places on the whole map. Left alone that is a carpet of one round bush,
  // which reads as generated just as a lattice of trees does. So what grows in
  // it is what fits - pines, two tiles across, in small clumps where the hedge
  // is widest, and tall bushes, one tile across, along the rest - placed by hand
  // and unevenly, with undergrowth left between. The same pines are swapped in
  // for some of the border's trees, so the frame stops reading as a fence.
  map.draw(0, 2, [
    '       p                 p                    p        p        ',
    '                                                                ',
    '                                                                ',
    '                                       b      b                 ',
    '    p                                       p                p  ',
    '                                                                ',
    ' p       p                                                      ',
    '                                                                ',
    '                                                                ',
    '                                           p                    ',
    '           p                                                    ',
    '                                             b  p   p           ',
    '                                           p                    ',
    '                                                                ',
    '                                                             p  ',
    '                                                                ',
    '                                           p                    ',
    '                          b                                     ',
    '                                                                ',
    '                                                                ',
    ' p                 b                                            ',
    '                                                                ',
    '                    p                                           ',
    '                                                                ',
    '                                                                ',
    '                                          b                     ',
    '                                      b         b               ',
    '       p                                                        ',
    '                                                             p  ',
    '                                                                ',
    '     p                                                          ',
    '       b          b                                             ',
    '                                                                ',
    '                                    p                           ',
    ' p                                                              ',
    '                                                                ',
    '                                                                ',
    '                                           p                    ',
    '                                                          p     ',
    '                                                                ',
    '                      p                                         ',
    '                  b                 p                           ',
    '                                                             p  ',
    '               b                                                ',
    '    p                                                           ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    ' p          p                    p                              ',
    '                                                                ',
    '                                     p                    p     ',
    '           p                                                    ',
    '                 p                                              ',
    '                   b                    p                       ',
    '                                              p              p  ',
    '                           p                                    ',
    '    p                                                           ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '             p                       p           p              ',
  ]);

  // == THE SHOAL ===========================================================
  // The flood took a bar of sand out of the wood under Market Isle's south
  // shore and left it standing in the great reach, with deep water in front of
  // it and the unfelled wood at its back. You can see it from Old Town's reeds
  // on your first raid and there is no way to it on foot at all, which is this
  // map's own rule: water is the wall, the landmark, and the sightline that
  // shows the place you cannot reach yet.
  //
  // `../gates.ts` authors the two rows of water at 25-26, 45-46 as the SURF
  // door. Swim it once and it stays a known crossing - drawn as a ford, which
  // is what a shoal shelving under you is - on this raid and every raid after.
  //
  // It is a place and not a short cut. Every straight crossing this river has
  // was measured (see the PR): the best of them saves twenty-two steps, which
  // is three seconds of a five-minute raid, so nothing a field move opens here
  // could be worth carrying for the walk. What it opens is ground nobody has
  // stood on, its own wildlife, and what the flood left on the bar.
  //            2222222
  //            3456789
  // Two offset rows rather than a rectangle, for the same reason the coppice
  // in Viridian Forest is not a room: the hunter needs five walking steps of
  // ground from wherever the player stands, and a seven-by-two bar holds four.
  // A strand with two ends is also what a bar in a river looks like.
  // The south row also stops short of 27, which is five tiles due south of the
  // Market Isle landing: `hunter.test.ts` holds that landing up as the case
  // where all four straight lines from a drop-in are walled off, and a bar tile
  // there would have made that true by accident rather than by drawing.
  //            2222222222
  //            2345678901
  map.draw(22, 43, [
    ' gdddddddd',
    'ggddd     ',
  ]);
  // What the lighter was carrying, at the bar's east end. One tile, and at the
  // end rather than in the middle: a two-tile prop across the middle of a bar
  // two rows deep cuts it into two islands, and the cache was on the far one.
  map.plant(31, 43, 'crate');

  return map;
}
