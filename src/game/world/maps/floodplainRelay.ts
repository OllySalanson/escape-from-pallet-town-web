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
 * `C` rock, `F` fence. And this map's own letters: `t` is a tree of the forest,
 * `o` one that stands in grass - an orchard row, a landmark - `p` a pine and
 * `b` a tall bush one tile wide, each drawn where its trunk stands - the two rows at and above
 * the letter are solid, and the crown above those is walked behind.
 */
export function sketchFloodplainRelay(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 64,
    height: 64,
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
    ' ,,         ,,,,,,,MMMWWWWWWMMMM',
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
  // dash, which two sacks at the player's feet used to do and looked it.
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
    '  .ggCgggg..Cgggg  ,    ',
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
    '   ,,##,####,## ',
    '   ,,,,,...wwwwC',
    '   ,,,,,.o.wwwww',
    '     ,,,,,,, ww ',
    '     wwwwww  ww ',
    '     wwwwww  Cw ',
    '     wwwwww  ,, ',
    '     wwwwww  ,, ',
  ]);
  map.plant(8, 31, 'house');
  map.plant(13, 31, 'house');
  // The town's chapel, round under a cone of a roof, standing in what was its
  // green. It is the one building on this map shaped like that.
  map.plant(9, 40, 'roundhouse');

  // South of the river: the towpath in its reeds, the last house, and the
  // road down to the gate.
  map.draw(3, 44, [
    '             ,C           ',
    '             ,,           ',
    '       T     ,,           ',
    '             ,,,ggggCggggg',
    '           ,,,,Tgggggggggg',
    '           ,,        ..   ',
    '   .....   ,,        ..   ',
    '   .....   ,,,,,,,,, ..   ',
    '   .....   ,,    ,,  ,,   ',
    '   .....   ,,    ,,,,,,,,,',
    '   .....   ,,         ,,,,',
    '    ,,,,,,,,,,            ',
    '            ,,,,          ',
    '              ,,          ',
    '              ,,         T',
    '              ,,          ',
    '              ,,          ',
  ]);
  map.plant(6, 50, 'house');
  map.plant(24, 49, 'hut');
  // The South Gate: the one way out of this map that is always open, and until
  // now a road that stopped in a wood. The road runs through the arch.
  map.plant(16, 57, 'stoneArch');

  // == MILL WEIR - the east bank, north ====================================
  // The towered bridge lands here. The road from it runs up to the towpath
  // along the race, and the towpath forks: on to the gatehouse, or east past
  // the mill on its pond and round into the orchard.
  map.draw(30, 17, [
    '                               ',
    '                               ',
    '                               ',
    '                               ',
    '                               ',
    '      ,,,,,,,,, ,,,,,          ',
    '      ,,     ,,,,,,,,          ',
    '      ,,  T  ,,    ,,          ',
    '      ,,     ,,    ........    ',
    '      ,,     ,,    ........    ',
    '  ,,,,,,     ,,    ........    ',
    '  ,,,        ,,,,  ........    ',
  ]);
  // The mill's own doorstep, a row south of the rest of its yard.
  map.draw(49, 29, ['........']);
  map.plant(52, 25, 'house');
  map.plant(50, 26, 'bigStump');

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
    '        T   ,,   T  ',
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
  map.draw(43, 3, [
    '    ...           ',
    '    ...  T        ',
    '    ... CC CCCC   ',
    '    ...CMMMMMMC   ',
    'MMMM...MMMMMMMC   ',
    'MMMM...MMMMMMM    ',
    '   M...CMMMMMMC   ',
    '   MMMMMMMM C     ',
    '       MM         ',
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
  // water came in by and that the way out goes through. The path round to it
  // leaves the yard by its own side, so the yard has two ways out.
  map.draw(33, 46, [
    '          T  T  T   ,,      ',
    ' ggggCggg           ,,      ',
    ' ggggCggg T  T   ,,,,,   T  ',
    '  ,,,,,,,,,      ,,         ',
    '  ,,     CMMMMMv,,,         ',
    '  ,,     vMMMMMv            ',
    '  ,,     vMMMMMv            ',
    '  ,,,,,,,vvvvvvv            ',
    'MM  ,,     ,,               ',
    'MM,,,,     ,,               ',
    '    ,,,,,,,,,               ',
    '        gWWWWWWg            ',
    ' T      gWWWWWWg            ',
    '        gggggggg            ',
  ]);
  map.plant(45, 51, 'trapdoorOpen');
  map.plant(42, 52, 'barrel');
  map.plant(47, 52, 'crateStack');
  map.plant(49, 57, 'culvert');

  // The causeway from the vault to the south road. `gates.ts` owns the middle.
  map.draw(29, 54, ['MMMM', 'MMMM']);

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
    '           p b                                                  ',
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
    '                                      b                         ',
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
    '               b                                                ',
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
    '           p                     p                              ',
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

  return map;
}
