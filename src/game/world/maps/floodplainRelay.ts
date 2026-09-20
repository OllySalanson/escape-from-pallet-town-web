import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Floodplain Relay - the river town the flood took, and the country it took it
 * from.
 *
 * It is 128 tiles square, and the town is the top-left quarter of it. That
 * quarter is the map that was drawn and reviewed - the same river, the same
 * eight places, tile for tile - and everything east and south of it is ground
 * added beside it, so a raid that drops in at the Landing can still walk the
 * whole of the map it used to know and be nowhere near the edge of this one.
 * That is the point of the size rather than a side effect of it: a raid is
 * five minutes, the clock has not moved, and what four times the ground buys
 * is not a longer walk but somewhere to have not been.
 *
 * One river comes in from the north, turns west, runs south, splits round an
 * island, and keeps going: out of the town, down past a grazing marsh, round
 * one square bend and into the tide at the bottom of the map. It is never more
 * than three tiles across, so wherever you stand on a bank the other bank is on
 * the screen with you: the water is the wall between every district and the
 * next, the thing you steer by, and the sightline that shows you the place you
 * cannot reach yet. Below the town it is also the thing that cuts the south in
 * half - the marsh and the wharf on one side, the drowned fields and the wall
 * on the other - and the two sides do not meet again until the sands at the
 * very bottom, which is a door somebody holds.
 *
 * Twenty-one places. The eight the town was drawn as:
 *
 * - THE LANDING (north-west) - the quay, the relay office, the boathouse and
 *   the ferry jetty. The front door.
 * - THE REEDBEDS (west) - the shore road south, fast and watched, with the
 *   reeds inland of it: slower, costly, and the only cover on this bank.
 * - MARKET ISLE (middle) - the square, its fountain and its stalls, ringed by
 *   the river, with two bridges off its north shore.
 * - OLD TOWN (south-west) - the drowned street, the chapel and the South Gate.
 *   The road forks at the last house now: one arm to the gate, one arm south.
 * - MILL WEIR and THE ORCHARD (east bank) - the mill on its pond, and the rows
 *   the town's fruit came from. Behind the toll bridge.
 * - BEACON KEEP (north-east) - moated by the mill race, entered through the
 *   gatehouse that stands in it, one drowned causeway from the Landing.
 * - THE VAULT (south-east of the town) - what the relay kept, under a trapdoor
 *   behind the orchard's back fence.
 * - THE SHOAL - a bar standing in the great reach, with no way to it on foot.
 *
 * And the thirteen the map grew into. East of the keep and the orchard, the
 * ground the town was built out of:
 *
 * - THE QUARRY - where the keep, the gatehouse, the causeway and the quay were
 *   all cut from. Stepped benches, a flooded pit and FOREMAN RUDD at the head
 *   of the only incline down.
 * - HOLLOW BECK - the wooded cleft under the workings, with the water that
 *   feeds the mill in the bottom of it and the quarry's adit halfway up.
 * - THE KILNS - where the stone was burnt, on the heath at the top of the map.
 * - THE CIDER YARD - what the orchard's fruit went to: hedged closes, old
 *   standards, the press house, and the cart road out.
 * - THE LEVELS - drained fen laid out with a ruler, a drove road down the
 *   east bank of a dead straight cut, and the one fast route on this side.
 *
 * And south of the town, the country the flood came over:
 *
 * - THE SALTINGS - grazing marsh cut into bands by tidal creeks, with the
 *   drove down the middle of it. Reachable on a save that has beaten nobody.
 * - THE STAITHE - the wharf at the river mouth, and the far end of that drove.
 * - THE DROWNED HUNDRED - a parish of small fields with a foot of water in
 *   them, walked gateway by gateway along the tops of its hedge banks.
 * - THE WITHY BEDS - willow grown in beds and cut on a rotation, standing in
 *   ankle-deep water, with one bed nobody has been into since its ride closed.
 * - THE SEA WALL - the bank that was supposed to keep all of this dry, and
 *   BANKSMAN NYE, who has the only stile onto it.
 * - THE BREACH - the hole in that wall, and the lagoon the sea made through it.
 *   This is what the flood *was*, and it is the last thing on the map you are
 *   shown.
 * - THE MUDS - sand banks and the gutways between them, which touch both sides
 *   of the river at low water and are the only thing that does.
 * - THE LIGHT - the point, the pier and the light on the head of it. The keep's
 *   tower is the first thing a raid ever looks at; this is the last thing it
 *   finds.
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
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
    '.gT.g.Tg.',
    '.g..g..g.',
    'T.TTTTTTT',
    '.g.Tg..g.',
    '.g..g.Tg.',
    '.g.Tg.Tg.',
    'T.TTTTTTT',
    '.gT.g.Tg.',
    '.g..g.Tg.',
    'TTT.TTTT.',
    '.gT.g.Tg.',
    '.g..g..g.',
  ]);

  // The shelf the adit comes out on, and the head of the beck round it.
  map.draw(71, 26, [
    '..g..g..g..g........g..g.',
    '..g.Tg.Tg.Tg..T..T..g.Tg.',
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
    '.gT.g.Tg..g..gT.g........T..gT.g.Tg..g',
    'T.TTT.....T.TTTTTT..TT.T.TTT...TTTTTT.',
    '.gT.g.Tg.Tg..gT.g..T..T..T..gT.g.Tg..g',
    '.g..g.Tg.Tg..g..g..T........gT.g..g..g',
  ]);


  // == THE CIDER YARD - behind the orchard =================================
  // Where the orchard's fruit went, and the reason the orchard is there at
  // all. Old standards planted wide in hedged closes - which is what makes the
  // warden's tight rows read as the young planting they are - then the press
  // house and the store on the only paving east of the river that is not the
  // keep's, and the cart road that carried it all out to the drove.
  map.draw(61, 34, [
    '""#""""TTT#""#""#""#TTTT#""#"""#""""',
    '"""""g#TTT#g"#g""g""TTTT#"g""g""g""g',
    '""##"####"#""#""#""#TTTT##"###"##"##',
    '""#""g#"g"#g""g"#g"#TTTT#TT#"g"#TTTT',
    '#"#"""#"""###"###########TT#"""#TTTT',
    'TT#""g""g""g""#""g#"g#"g#TT#"g""TTTT',
    ',,#,####,##,,,#,,,#,,,,,,,,,,#,#####',
    ',,,,,,,,,,#,,,#,,,#,,#,,#,,#,,,#,,,,',
    '""#""""#""#""""""""""#""#""#""""""""',
    '"""""g"#g"###"#####"#""###"##"#"g""g',
    '###"#######""""#TT#""#TT#""#TTT##"#"',
    'TT#""g"#g"#g""g"TT#"g#TT#"g#TTT#TTT"',
    'TT"""""#""#""""#TT#""#TT#"""TTT#TTT"',
    'TT#"""""g"#g""g#TT#"g"TT######"####"',
    '#####"########""#########""#""""""""',
    '""#""g#"g"#g""g#"g"#g""g#"g""g"#g""g',
    '""#"""#""""""""""""#""""#####"####"#',
    '""#""g#"g"#g""g##"#"g""g""g"""TT#""g',
    '#""#"###"###"###TTT##"###""""#TT#"""',
    'TT"""g#TTT#g""g#TTT#g""g####"##"##"#',
    'TT#"""#TTT#"""""TTT#""""#""""#""#"""',
    'TT#""g"TTT"g""g#TTT#g""g#"g""#"""""g',
  ]);


  // The yard: the press house on the paving, the store beside it, and the road
  // out east to the culvert over the cut. South of it the ground goes rough -
  // nothing was ever built there, because the water gets to it.
  map.draw(61, 45, [
    'PP#PPPP#PP#PP#""g#""#TTTT#""""g""#""',
    'PP#PPPP#PP#PP#""""g""""""""""#""g#""',
    'P####P#PPPPPP#"""#""#TT"T##"##"##""#',
    'PP#PPPP###P#######"####"##TTT#"""#""',
    '"""g"""#"""""""""#""#"""g"TTT""g""""',
    ',##,,###,,#,,,,,,,,,#,,,,######,,###',
    ',,,,,,,,,,#,,#,###,#,,#,##,,,,,#,,,,',
    '""g#"""###""##TTT#""#""g"#TT#"g#""""',
    '"""#g""#TT#g"#TTT#g"#""""#TT#"""g"""',
    '#"###"##TT#""#"######"########"#"###',
    '"g"#T"T#TT"""""g""""#"g""#"""g""TTTT',
    '"""#T""#TT#""#"""#""#"""g#""#""#TTTT',
  ]);


  // The gap in the orchard's back hedge, and the cart road through it. It
  // takes the orchard's hedge row as well as its lane, so that a gate post can
  // stand in the lane: a lane that runs straight on into another lane is a
  // lane a player crosses the map down with one key held.
  map.draw(56, 40, [
    ',,,,,',
    ',,,,,',
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
    'TT"T#g"#g"###"########"###"###',
    'TT"T#g"""##TTTT#"g#"g""g"#g""g',
    '##"#####g"#"####"g#"g#"g"#g""g',
    '""""TTT#g""g""g#"g""g###"###"#',
    '""g#TTT#g"#g""g#"##"##TTT#g""g',
    '#######""#######"g"TT#TTT"g""g',
    '""#TT#""#TTT""g##"########"##"',
    '""#TT#""#TTT#"g""g""g#"g"TT""g',
    '""#TT"""#"######"g#"g""g#TT#"g',
    '"#""##"##""g"TT#############"#',
    '""#""#""#"##""##"g#TTTT#""g""g',
    '"""""""""""g#"g#"g#TTTT#""g#"g',
    '""#""#""#""g#"g#"##"########"#',
    '######"######"##"g#"g""#TTT""g',
    '""g#"g""g"TT#"g#"g""g"""TTT#"g',
    '""g""g#"g#TT#"g##"##"#######"#',
    '""g#"g#"g#TT#"g""g#TTTT#""g"TT',
    '##"#"##"##"##"##"####"###"##"#',
    'TTT""g#"g#"g""g#"g""g""#""g#"g',
    'TTT#"g#"g#"g#"g#"g#"g"""""g""g',
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
    'T,,#gggg#g#gg"ggg#"gggg"#TT',
    ',,,ggg#"#ggg"#ggg"gg#g"ggTT',
    ',,,ggg"gg#g"gggg#gggg"g#gTT',
    ',T,WWWWWWWPWWWWWWWWWWWWWWWW',
    ',,,g"ggg#"gggg"#ggg"gg#g"TT',
    ',,,"#ggg"gg#g"gggg#gggg"gTT',
    ',,Tgggg##ggg"g#gg"ggg#"ggTT',
    ',,,WWWWWWWWWWWWWWPWWWWWWWWW',
    ',,,gg"#ggg"gg#g"gggg#ggggTT',
    'T,,g"gggg#gggg"##gg"ggg#"TT',
    ',,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',,,gggg"#ggg"gg#g"gggg#ggTT',
    ',T,g#g"gggg#gggg"g#gg"#ggTT',
    ',,,gg"g#gg"ggg#"gggg"##ggTT',
    ',,,#"gggg"#ggg"gg#g"gggg#TT',
    ',,TWWWWWWWPWWWWWWWWWWWWWWWW',
    ',,,gggg"##gg"ggg#"gggg"#gTT',
    ',,,gg#"gggg"#ggg"gg#g"gggTT',
    'T,,WWWWWWWWWWWWWWPWWWWWWWWW',
    ',,,g#gggg"g#gg"#gg#"gggg"TT',
    ',,,"ggg#"gggg"#ggg"gg#g"gTT',
    ',T,#ggg"gg#g"gg#g#gggg"g#TT',
    ',,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',,,gg"ggg#"gggg"#ggg"gg#gTT',
    ',,Tg"#ggg"gg#g"gggg#gg#g"TT',
    ',,,"gggg#gggg"g#gg"ggg#"gTT',
    ',,,WWWWWWWPWWWWWWWWWWWWWWWW',
    'T,,ggg"##gg"gg#g"gggg#gggTT',
    ',,,#g"gg#g#gggg"g#gg"ggg#TT',
    ',,,WWWWWWWWWWWWWWPWWWWWWWWW',
    ',T,"gggg"#ggg"g##g"gggg#gTT',
    ',,,gg#g"gggg#gg#g"g#gg"ggTT',
    ',,,ggg"g#gg"ggg#"gggg"#ggTT',
    ',,Tg#"gggg"#ggg#gg#g"ggggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',,,#gggg"g#gg"ggg#"gggg"#TT',
    'T,,ggg#"gggg"#ggg"gg#g#ggTT',
    ',,,ggg"gg#g"gggg#gggg"##gTT',
    ',,,WWWWWWWPWWWWWWWWWWWWWWWW',
    ',T,g"ggg#"gggg"#ggg"gg#g"TT',
    ',,,"#ggg#gg#g"gggg#gggg"gTT',
    ',,,WWWWWWWWWWWWWWPWWWWWWWWW',
    ',,T#gg"ggg#"ggg#"#ggg"gg#TT',
    ',,,gg"#ggg"gg#g#gggg#ggggTT',
    ',,,g"gggg#gggg"g#gg"ggg#"TT',
    'T,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',,,gggg"#ggg"gg#g"gggg#ggTT',
    ',,,g#g"gggg#gggg"g#gg"gggTT',
    ',T,WWWWWWWPWWWWWWWWWWWWWWWW',
    ',,,#"ggg#"#ggg"gg#g"gggg#TT',
    ',,,"gg#g"gggg#gggg"g#gg"gTT',
    ',,Tgggg"##gg"ggg#"gggg"#gTT',
    ',,,gg#"g#gg"#ggg"gg#g"gggTT',
    ',,,WWWWWWWWWWWWWWPWWWWWWWWW',
    'T,,g#gggg"g#gg"#gg#"gggg"TT',
    ',,,"ggg#"gggg"##gg"gg#g"gTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',T,ggg#gggg"g#gg"ggg#"#ggTT',
    ',,,gg"ggg#"gggg"#ggg"g##gTT',
    ',,,g"#ggg"gg#g"gggg#gggg"TT',
    ',,TWWWWWWWPWWWWWWWWWWWWWWWW',
    ',,,g#gg"#gg#"gggg"#ggg"ggTT',
    ',,,ggg"#ggg"gg#g"gggg#gggTT',
    'T,,#g"gg#g#gggg"g#gg"ggg#TT',
    ',,,WWWWWWWWWWWWWWPWWWWWWWWW',
    ',,,"gggg"#ggg"gg#g"gggg#gTT',
    ',T,gg#g"gggg#gg#g"g#gg"ggTT',
    ',,,WWWWWWWWWWWWWWWWWWWWWPWW',
    ',,,g#"gggg"#ggg"gg#g"ggggTT',
    ',,Tg"gg#g"gggg#gggg"g##g"TT',
    ',,,#gggg"g#gg"ggg#"ggg#"#TT',
    ',,,ggg#"gggg"#ggg"gg#g"ggTT',
    'T,,WWWWWWWPWWWWWWWWWWWWWWWW',
    ',,,gg#gg#g"g#gg"ggg#"ggggTT',
    ',,,g"ggg#"gggg"#ggg"gg#g"TT',
    ',T,"#ggg#gg#g"gggg#gggg"gTT',
    ',,,gggg##ggg"g#gg"ggg#"ggTT',
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
    'PP#PP"PPPPP"P#"PP"P#"PP#PP"PPP#P"#CPPP',
    'PPPPP"P####"PP"P#"PP"PPPPP"#P"PP"PPPPP',
    'P##P#####P#####P####P##P####P##P#PPCPP',
    '###PP"P#"PP####PP"P####P###PP"P##PPPPP',
    '##PPP"PP"P#######"P####P####P"###PPPCP',
    '##P##############P########PPP####PPPPP',
    'PP"PP"PPPPPP###PP"PPPPP####PP"#P"#PPPC',
    'PP"#P####P##P##PP"P#"PP#####P"#P##CPPP',
    'P#######PPP#PPPPP"P#P#PP##P####P"PPPPP',
    '#########PP#PP#P####"PP#PP"P###P"#PCPP',
    '#########P##P#######"PPPPP"####P##PPPP',
    '###PP"PPPPP#########P##########P##PPCP',
    'P##P##P##P##P####P##"PP#PP"P###P##PPPP',
    'PP"P#####PPPPP#PP"P#"PPPPP"###PP"#PPPC',
    'PP"######PP#PPPPP"P#"PPPPP"####P"#CPPP',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]);


  // == THE DROWNED HUNDRED - the fields under the water ====================
  // A whole parish of small fields with a foot of water standing in them and
  // nothing above it but the hedge banks - so the field pattern is still
  // there to be read and walked, gateway by gateway, and that is the only way
  // through. It is waded, not swum; what makes it slow is the reed.
  map.draw(33, 64, [
    'www#wwwww#####ww####www#####',
    'ggg#gggg######gg#####gg#####',
    'wwwwwwwwwwwwwwwww##w##ww####',
    'w#w###w##w####gg#gggw#w###w#',
    'w###wwww#wwww#ww#www##w#wwww',
    'w###gggg#gggg##w##w###w#w###',
    'w#########w###wwwwwwwww#wwww',
    'gg#ggwggwgggg#gggg#gggg#gggg',
    'w####w#####w#######w####w###',
    '##wwwwggw#########wggwgggw##',
    '##w###ww###########ww#www##w',
    '##w###############ww#######w',
    'www######wwww###wwwwwwwwwwww',
    'ggg######gggg####gg#w###w#w#',
    'www###wwwwwww####ww###www###',
    '##w###w##w######ww#####gg###',
    'wwwwwwww######www#####ww####',
    'ggg#gggg######gg####gggwgggg',
    'w####w#w######ww####www#wwww',
    'ggw###wgggw#######www#######',
    'ww#####www#########ww#wwwwww',
    'gg#####ggg#########ggwggg#gg',
    'w###w######w##w####w##w###w#',
    'gg#ggg#gggwggwggggww#####wgg',
    'wwwwww#www#wwwwwww########ww',
  ]);


  // == THE WITHY BEDS - the osier grounds ==================================
  // Willow grown on purpose, in beds, and cut on a rotation - so it is rows
  // again, like the orchard and the levels, but rows of something planted in
  // standing water. The lanes between the beds are ankle deep, and a bed
  // itself is a wall you can see over and not walk through.
  map.draw(61, 64, [
    'wwwwwwwwwwwwwwwwwww#wwwwwwwwwwwwww##',
    '#w##w#w##w##w##w##www##w#w#####gg###',
    '#w#ww###ww#####w###w###w######ww####',
    '#w#######w#####w#######w####ggg#####',
    '#w#######w#####w#######w####wwwww#w#',
    'gg###wggww#####w######gg#####w##gwgg',
    'w#####ww#####w#ww#####ww#######ww#ww',
    '####www#####gggwgg###wgg####w###w##w',
    '#########w##www#ww###w###w##www##www',
    'w##w##w##ggww###w####wggwggwggg###gg',
    'ww#wwwwwwww####www####ww#ww###w#w###',
    'wgwgg#gg#gg#####gg#####w#w####wwgw##',
    '##w##ww##w######w#####www#######w###',
    '#wgg####ww#############g########w###',
    '##ww###############w###w####wwwww###',
    'www################ggwww#gg#ggg#w#w#',
    '#www###www##w###w##ww##wwww#w###wwww',
    '##ggwggg#gg#gggwgg#gg####gg#####g#gw',
    '##ww#www#wwwwww#ww#######w###w##w###',
    'www######w######w#######wgg#ggg#wwgg',
    '#www####www####www#######wwwwwww##ww',
    '##ggw####gg#####gg#######w#####ww###',
    '##w#w####w#######w###ww##w#####wwwww',
    '####www##w######ggwggg#w#w#####w##gg',
    '#####w##########ww#www#wwww##w####w#',
    '#####w#########wgg#ggg#g#ggwggg##wgg',
    'w##w#w#w##w#####w##w###w####www###ww',
    'ggwgggwgg#gggwwwggw##wggw#########w#',
    'ww#www#ww#www###ww####ww#########ww#',
    'w#######w######ww###########w##w##w#',
    'wwww#wwww##wwwwwwwwww###wwwwwwwww#ww',
    'ggww##gg####ggg###gg#####gg#gg#ggwgg',
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
    '"""""""""""""g""g"T"""""""""""""""gT"g"TTTTT""gT"g""g""""""""',
    '"g""gTTTTTT""g"Tg"Tg"TTTT"""TTTT""g""g""""""""g""TTTT"TT"TT"T',
    '"gT"gTTTTTT""gWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTg""T"""TT',
    'TTTT"TTT"TT"TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTg""T""TTT',
    'TT""gT"g"""TTTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTT""TT',
    'TTT"g""g""TTTTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"gT"gT"g""TTT',
    'T"""TTTTTTTTT"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"gT"g""g""TTT',
    '"gTTTT"gTTTTTgWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"gT"gT"g"""TT',
    '"gTTTT"gTTTTTgWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW""TT""TTTTTTTT',
    '"g"TTT"gTTTT"gWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"g""g""TT""""',
    'T"TTTT"TT"TTTTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"TTTT"TT""T"T',
    '"g""gT"g""g""TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTT"g"Tg""TTT',
    '"gT"g""gT"g"TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTT"""g"""""TTT',
  ]);

  // The crest, the groynes set in it, and the gap the sea comes through.
  map.draw(44, 109, [
    ',,,,C,,,,,,,,C,,,,,,,,C,,,,wwwww,,,,,,,,C,,,,,,,,C,,,,,,,,C,,,',
    'C,,,,,,,,C,,,,,,,,C,,,,,,,,wwwww,,,,C,,,,,,,,C,,,,,,,,C,,,,,,,',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCwwwwwCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]);


  // == THE MUDS - what the tide goes off ===================================
  // Sand bars and the gutways between them: every bar is cut through where a
  // gutway crossed it, and joined to the next at one shallow. It is the only
  // ground on this map that touches both sides of the river, so with the hard
  // open it is the way from the wharf to the breach - and until the banksman
  // falls there is no way onto it at all.
  map.draw(6, 112, [
    'dddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddddd',
    'WdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdd',
    'WWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWW',
    'ddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddW',
    'dddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddddd',
    'WWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWW',
    'dddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddd',
    'ddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddW',
    'WWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWW',
    'ddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddd',
    'dddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddd',
  ]);


  // == THE LIGHT - the point, and the pier =================================
  // The far corner. A stone pier out into the tide with the light on the head
  // of it, the keeper's house behind, and nothing past that but water: this is
  // where the map stops and the sea starts. The keep's tower is the first
  // thing a raid ever looks at; this is the last thing it finds.
  map.draw(105, 98, [
    '"g""TTTT""gT"gT"g"Tg""',
    '"g""TT""""g""g""g""g""',
    'T"TTTT"TTTTTTTTTT"TT"T',
    '"g""T""TTTTTTTT"g"TTTT',
    '"g""T"""TTTTTTT"g"TTTT',
    '"g"""""TTTT"""""g"TTTT',
    '"TTTTTTTT"""TTTT"TTTTT',
    '"gTTTT"gT"gTT"TTg"TTTT',
    '"gTT""T"""""""TTg""TTT',
    'T"T"gTTTT"gT"g"TTT""TT',
    '"g""gTTTT"gT""""g"TTTT',
    '"gTT"T"TTTTTTTTTT"T"TT',
    '"gT"g""T""TTTTTTg"Tg""',
    'T"T"g""""""TTTTTg""g""',
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
  map.set(75, 18, 'v');                  // the quarry floor, which two stones had cut in three
  map.set(73, 18, 'C');                  // a block left standing on the floor, with the lane going round it
  map.set(73, 19, 'v');                  // and the lane round it
  map.set(77, 18, 'v');                  // the quarry floor, which a stone had cut in two
  map.set(63, 54, '"');                  // a gap out of the last close in the cider yard
  map.set(57, 40, 'C');                  // the gate post at the orchard's back gap
  map.set(111, 102, '"');                // a gap worn through a hedge bank
  map.set(97, 14, '"');                  // a gap worn through a hedge bank
  map.set(102, 14, '"');                 // a gap worn through a hedge bank
  map.set(83, 43, '"');                  // a gap worn through a hedge bank
  map.set(65, 54, '"');                  // a gap worn through a hedge bank
  map.set(56, 64, 'w');                  // a shallow worn through a bed
  map.set(54, 66, 'w');                  // a shallow worn through a bed
  map.set(95, 66, 'w');                  // a shallow worn through a bed
  map.set(74, 69, 'w');                  // a shallow worn through a bed
  map.set(75, 69, 'w');                  // a shallow worn through a bed
  map.set(93, 70, 'w');                  // a shallow worn through a bed
  map.set(94, 70, 'w');                  // a shallow worn through a bed
  map.set(52, 75, 'w');                  // a shallow worn through a bed
  map.set(77, 81, 'w');                  // a shallow worn through a bed
  map.set(89, 85, 'w');                  // a shallow worn through a bed
  map.set(91, 85, 'w');                  // a shallow worn through a bed
  map.set(95, 86, 'w');                  // a shallow worn through a bed
  map.set(95, 85, 'w');                  // a shallow worn through a bed
  map.set(94, 82, 'w');                  // a shallow worn through a bed
  map.set(57, 86, 'w');                  // a shallow worn through a bed
  map.set(57, 87, 'w');                  // a shallow worn through a bed
  map.set(36, 96, 'P');                  // a step through a wharf wall
  map.set(10, 100, 'P');                 // a step through a wharf wall
  map.set(10, 98, 'P');                  // a step through a wharf wall
  map.set(31, 100, 'P');                 // a step through a wharf wall
  map.set(117, 100, '"');                // a gap worn through a hedge bank
  map.set(7, 102, 'P');                  // a step through a wharf wall
  map.set(10, 102, 'P');                 // a step through a wharf wall
  map.set(113, 105, '"');                // a gap worn through a hedge bank
  map.set(116, 105, 'P');                // a step cut through a wall
  map.set(2, 107, 'P');                  // a step cut through a wall
  map.set(15, 107, 'P');                 // a step cut through a wall
  map.set(10, 81, 'C');                  // a stone set in the way
  map.set(83, 26, '#');                  // thorn grown across it
  map.set(102, 110, 'C');                // a stone set in the way
  map.set(10, 70, 'C');                  // a stone set in the way
  map.set(10, 92, 'C');                  // a stone set in the way
  map.set(103, 109, 'C');                // a stone set in the way
  map.set(70, 70, '#');                  // thorn grown across it
  map.set(84, 97, '#');                  // thorn grown across it
  map.set(118, 99, '#');                 // thorn grown across it
  map.set(75, 109, '#');                 // thorn grown across it
  map.set(71, 110, '#');                 // thorn grown across it
  map.set(91, 26, '#');                  // thorn grown across it
  map.set(99, 96, '#');                  // thorn grown across it
  map.set(99, 11, 'C');                  // a stone set in the way
  map.set(96, 33, '#');                  // thorn grown across it
  map.set(47, 91, '#');                  // thorn grown across it
  map.set(48, 94, '#');                  // thorn grown across it
  map.set(110, 27, '#');                 // thorn grown across it
  map.set(61, 41, 'C');                  // a stone set in the way
  map.set(86, 70, '#');                  // thorn grown across it
  map.set(46, 87, '#');                  // thorn grown across it
  map.set(95, 10, 'C');                  // a stone set in the way
  map.set(125, 26, '#');                 // thorn grown across it
  map.set(37, 83, '#');                  // thorn grown across it
  map.set(74, 84, '#');                  // thorn grown across it
  map.set(65, 11, 'C');                  // a stone set in the way
  map.set(60, 26, '#');                  // thorn grown across it
  map.set(102, 23, '#');                 // thorn grown across it
  map.set(73, 26, '#');                  // thorn grown across it
  map.set(100, 46, 'C');                 // a stone set in the way
  map.set(66, 59, '#');                  // thorn grown across it
  map.set(74, 55, '#');                  // thorn grown across it
  map.set(86, 82, '#');                  // thorn grown across it
  map.set(45, 92, '#');                  // thorn grown across it
  map.set(72, 91, '#');                  // thorn grown across it
  map.set(33, 96, 'C');                  // a stone set in the way
  map.set(52, 97, '#');                  // thorn grown across it
  map.set(95, 110, 'C');                 // a stone set in the way
  map.set(108, 110, 'C');                // a stone set in the way
  map.set(118, 26, '#');                 // thorn grown across it
  map.set(91, 37, '#');                  // thorn grown across it
  map.set(69, 39, '#');                  // thorn grown across it
  map.set(67, 57, '#');                  // thorn grown across it
  map.set(9, 65, 'C');                   // a stone set in the way
  map.set(91, 64, '#');                  // thorn grown across it
  map.set(100, 12, '"');                 // a gap worn through a hedge bank
  map.set(98, 14, '"');                  // a gap worn through a hedge bank
  map.set(126, 27, '"');                 // a gap worn through a hedge bank
  map.set(115, 36, 'g');                 // reed grown through a gap in a bank
  map.set(117, 36, 'g');                 // reed grown through a gap in a bank
  map.set(106, 40, 'g');                 // reed grown through a gap in a bank
  map.set(109, 40, '"');                 // a gap worn through a hedge bank
  map.set(104, 44, 'g');                 // reed grown through a gap in a bank
  map.set(107, 44, 'g');                 // reed grown through a gap in a bank
  map.set(68, 45, 'P');                  // a step cut through a wall
  map.set(123, 48, 'g');                 // reed grown through a gap in a bank
  map.set(107, 52, '"');                 // a gap worn through a hedge bank
  map.set(109, 52, 'g');                 // reed grown through a gap in a bank
  map.set(118, 52, 'g');                 // reed grown through a gap in a bank
  map.set(62, 55, '"');                  // a gap worn through a hedge bank
  map.set(105, 56, 'g');                 // reed grown through a gap in a bank
  map.set(107, 56, 'g');                 // reed grown through a gap in a bank
  map.set(116, 56, 'g');                 // reed grown through a gap in a bank
  map.set(123, 61, '"');                 // a gap worn through a hedge bank
  map.set(91, 64, 'w');                  // a shallow worn through a bed
  map.set(115, 64, '"');                 // a gap worn through a hedge bank
  map.set(118, 64, 'g');                 // reed grown through a gap in a bank
  map.set(95, 67, 'w');                  // a shallow worn through a bed
  map.set(113, 68, 'g');                 // reed grown through a gap in a bank
  map.set(116, 68, '"');                 // a gap worn through a hedge bank
  map.set(108, 72, 'g');                 // reed grown through a gap in a bank
  map.set(116, 76, 'g');                 // reed grown through a gap in a bank
  map.set(118, 76, '"');                 // a gap worn through a hedge bank
  map.set(123, 76, '"');                 // a gap worn through a hedge bank
  map.set(114, 80, '"');                 // a gap worn through a hedge bank
  map.set(116, 80, 'g');                 // reed grown through a gap in a bank
  map.set(105, 84, '"');                 // a gap worn through a hedge bank
  map.set(108, 84, 'g');                 // reed grown through a gap in a bank
  map.set(96, 88, 'g');                  // reed grown through a gap in a bank
  map.set(123, 90, 'g');                 // reed grown through a gap in a bank
  map.set(122, 92, '"');                 // a gap worn through a hedge bank
  map.set(10, 97, 'P');                  // a step cut through a wall
  map.set(10, 101, 'P');                 // a step cut through a wall
  map.set(120, 100, '"');                // a gap worn through a hedge bank
  map.set(56, 106, '"');                 // a gap worn through a hedge bank
  map.set(27, 106, 'P');                 // a step cut through a wall
  map.set(28, 107, 'P');                 // a step cut through a wall
  map.set(116, 104, '"');                // a gap worn through a hedge bank
  map.set(5, 110, 'P');                  // a step cut through a wall
  map.set(14, 107, 'P');                 // a step cut through a wall
  map.set(70, 64, '#');                  // thorn grown across it
  map.set(71, 65, 'w');                  // a shallow worn through a bed
  map.set(52, 96, '#');                  // thorn grown across it
  map.set(39, 66, '#');                  // thorn grown across it
  map.set(40, 67, 'w');                  // a shallow worn through a bed
  map.set(70, 96, '#');                  // thorn grown across it
  map.set(117, 76, '#');                 // thorn grown across it
  map.set(104, 52, '#');                 // thorn grown across it
  map.set(93, 64, '#');                  // thorn grown across it
  map.set(94, 65, 'w');                  // a shallow worn through a bed
  map.set(112, 36, '#');                 // thorn grown across it
  map.set(104, 40, '#');                 // thorn grown across it
  map.set(111, 80, '#');                 // thorn grown across it
  map.set(82, 64, '#');                  // thorn grown across it
  map.set(69, 65, 'w');                  // a shallow worn through a bed
  map.set(111, 64, '#');                 // thorn grown across it
  map.set(109, 68, '#');                 // thorn grown across it
  map.set(63, 76, '#');                  // thorn grown across it
  map.set(62, 76, 'w');                  // a shallow worn through a bed
  map.set(101, 84, 'C');                 // a stone set in the way
  map.set(30, 93, 'C');                  // a stone set in the way
  map.set(3, 102, 'C');                  // a stone set in the way
  map.set(117, 31, '#');                 // thorn grown across it
  map.set(87, 35, '#');                  // thorn grown across it
  map.set(88, 36, '"');                  // a gap worn through a hedge bank
  map.set(104, 51, 'g');                 // reed grown through a gap in a bank
  map.set(123, 54, 'P');                 // a step cut through a wall
  map.set(100, 45, 'C');                 // a stone set in the way
  map.set(102, 51, 'C');                 // a stone set in the way


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
