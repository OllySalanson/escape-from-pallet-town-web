import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Pallet Town - the mill town on the leat.
 *
 * 32x44, the shipped footprint and not a tile bigger: dense, not vast. One
 * water runs through it and is the whole of its shape. The millpond stands in
 * the east; its race runs south out of it; the race turns west as the leat and
 * cuts the town in two; and the leat ends in the Flood, the pool in the
 * south-west that the culvert drains. So the water is the wall between north
 * and south, the ways over it are the prices of the map, and the sluice at the
 * head of the leat is what the far end of it answers to.
 *
 * Seven places:
 *
 * - MARKET SQUARE (north-west) - the two houses side by side, as this town has
 *   always been drawn, and the paved square in front of them. The front door.
 * - THE NORTH FIELD (north-east) - meadow gone to tall grass round two old
 *   trees, and the only way round the pond.
 * - THE MILLPOND (east) - the mill on its west bank, and on the far bank the
 *   stair cut into the rock: the one way out that never crosses the leat.
 * - THE GREEN (west) - the town pump, the bench and the oak, under the square.
 * - THE ALLOTMENTS (middle) - three sheds and their beds gone to seed. The
 *   ledger is in there, and nothing in there is free.
 * - THE STOCKYARD (south) - the bridge foot and who holds it, the paddocks, the
 *   sluice at the east end of the bank, and the road down to the South Gate.
 * - THE FLOOD (south-west) - the leat's drowned end, its reeds, and the culvert
 *   mouth on the far shore.
 *
 * Three crossings, three prices (`palletTown.test.ts` holds them): the bridge is
 * the quick way and Scout Lee stands in the one gap at its foot; the west ford
 * lands in the Flood's reeds, where nothing is free; the east ford is dry all
 * the way to the gate, and the long way round. A fourth way goes round the head
 * of the water altogether, past the Mill Stair, and is twice as long again.
 *
 * Drawn as character art, one character per tile, in the Floodplain's hand: the
 * base is solid wood with a tree on a lattice, and every place is cut out of
 * it. Legend as `floodplainRelay.ts`: `W` deep water, `w` a ford, `.` grass,
 * the double quote mown turf, `g` tall grass, `,` trodden earth, `P` paving,
 * `M` stone, `#` hedge, `T` thicket, `C` rock, `F` fence; `t` a tree of the
 * forest, `o` one that stands in grass, `p` a pine, `b` a tall bush. Earth and
 * paving are laid two tiles wide or not at all - this sheet draws a lane's edge
 * on one side of a tile, so a one-tile lane has a fringe down one side and a
 * bare cut down the other - and what is one tile wide is grass, which has no
 * edge to get wrong.
 */
export function sketchPalletTown(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 32,
    height: 44,
    fill: '.',
    stamps: {
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
      o: { prop: 'tree', anchor: [1, 2], ground: '.' },
      p: { prop: 'pine', anchor: [0, 2], ground: '.', blocks: [[0, -1], [1, -1], [1, 0]] },
      b: { prop: 'tallBush', anchor: [0, 2], ground: 'T' },
    },
  });

  // == THE WATER, AND THE WOOD IT RUNS THROUGH ==============================
  // Laid down first, because everything else is cut out of it: the pond, the
  // race out of its south side, the leat the race turns into, and the Flood the
  // leat ends in. One water, in long reaches with square bends - this sheet's
  // bank is a lip that runs. The race is two tiles across where the leat is
  // three, because a race is a cut and a leat is a stream, and no tree of the
  // lattice is left standing where its crown would hang in water.
  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTtTTTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTT',
    'TTtTTtTTtTTtTTtTTtTTWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTT',
    'TTtTTtTTtTTtTTtTTtTTWWWWWWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTTWWTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTTTT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTtTT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTTTT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTtTTtTTtTTtTTtTTtTTtTTTTT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTTTTTTTTTTtTTtTTTTTTTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTTTTtTTtTTTTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  //            0         1         2         3
  //            01234567890123456789012345678901

  // == MARKET SQUARE, AND THE NORTH FIELD ===================================
  // The two houses stand shoulder to shoulder under the wood with a pine
  // between them, a planter either side of each door, and the square is what
  // they look out on: the awning stall, the produce crates, a bench, a big
  // pot by the road east - one tile square, because the flag that stood there
  // first was two and, with the planter beside the door, shut the square's
  // east side completely.
  // It is paved and it is small - nothing in this town is a field to sprint
  // across. The road leaves east and turns north into the field, which is tall
  // grass round two old trees and a pair of rocks, with the way on down the
  // pond's far bank leaving from its south-east corner.
  map.draw(0, 3, [
    '  .....TT.....   .ggg.##.gggg.  ',
    '  .....TT.....  .ggTTT##gTTTg.  ',
    '  .....TT.....  .gg...g.g...gg. ',
    '  ............  ,,g.o.ggg.o.g.. ',
    '  .....p......  ,,gggg.C.gggg,, ',
    '  PPPPPPPPPPPP,,,,..ggC.ggg..,, ',
    '  PPPPPPPPPPPP,,,,.....#.....,, ',
    '  PPPPPPPPPPPP#              ,, ',
    '  PPPPPPPPPPPP#    ........ .,, ',
    '  PPPPPPPPPPPP#..............   ',
  ]);
  map.plant(2, 3, 'house');
  map.plant(9, 3, 'house');
  map.plant(3, 8, 'planter');
  map.plant(5, 8, 'planter');
  map.plant(10, 8, 'planter');
  map.plant(12, 8, 'planter');
  map.plant(2, 8, 'barrel');
  map.plant(12, 9, 'pot');
  map.plant(2, 10, 'marketStall');
  map.plant(6, 11, 'produce');
  map.plant(11, 11, 'bench');

  // == THE GREEN, THE MILL AND ITS POND =====================================
  // South of the square's hedge: the green, mown, with the pump in its corner,
  // a bench, and the oak the lane goes round - bushes grown up behind it, so
  // nobody walks under its crown. The lane steps down two rows on
  // its way east so it is never one long run, passes the mill's door - sacks
  // stacked against its west wall - and stops at the towpath. East of the pond
  // the far bank's path runs down past the stair in the rock, which is the Mill
  // Stair, and on to the head of the leat: the long way round everything.
  map.draw(0, 13, [
    '  ###,,#######......       ,,   ',
    '  """,,,,,,,,#......       ,,,  ',
    '  """,,,,,,,,#......        ,,  ',
    '  #"""""TTT,,#......        ,,  ',
    '  """"""...,,,,,,,,,        ,,  ',
    '  .."""".o.,,,,,,,,,      ,,,,  ',
    '                          ,,... ',
    '                          ,,... ',
    '                          ,,... ',
    '                          ..... ',
    '                          ..... ',
    '                            ,,  ',
    '                            ,,  ',
    '                            ,,  ',
    '                          ,,,,  ',
    '                          ,,    ',
    '                          ,,    ',
  ]);
  map.plant(15, 12, 'barn');
  map.plant(14, 13, 'sack');
  map.plant(14, 14, 'sack');
  map.plant(2, 14, 'fountain');
  map.plant(5, 17, 'bench');
  map.plant(28, 19, 'rockStair');

  // == THE ALLOTMENTS =======================================================
  // Three sheds in a row, each with its bed beside it, and below them the
  // plots nobody has dug since: tall grass between what is left of their
  // hedges. It is a garden, so it is nearly regular, and it has gone to seed,
  // so it is not. The ledger lies in the bed south of the middle shed. The one
  // gap that leads straight down onto the bridge is two tiles east of it.
  map.draw(0, 19, [
    '  ,,...ggg#,,...ggg#...g        ',
    '  ,,...ggg#,,...ggg#...g        ',
    '  #....ggg......ggg.....        ',
    '  ggg.....###..#........        ',
    '  ggg#.##.ggg...##.g###.        ',
    '  g#g#..g.ggg#....gg..g.        ',
    '  ggg..gg.g#g#..#ggg..g.        ',
    '  ..........    ........        ',
  ]);
  map.plant(4, 19, 'hut');
  map.plant(13, 19, 'hut');
  map.plant(21, 19, 'hut');
  // What says allotment rather than kennel: a stranger toured the town, saw
  // three small huts in grass pens and called the band the Stockyard, because
  // there was not a vegetable in it and the produce was all up in the market.
  // So each shed has a dug row down its open side - something up in most of
  // it - and two plots still have a crate of the year's crop standing in their
  // hedge. The rows lie on ground that was already open and are walked over,
  // and the crates stand where hedge stood, so no way through has changed.
  const rows = ['bedSeedlings', 'bedYellowCrop', 'bedRedCrop'] as const;
  for (const [x, order] of [[6, [0, 1, 2]], [15, [1, 2, 0]], [20, [2, 0, 1]]] as const) {
    order.forEach((row, index) => map.plant(x, 19 + index, rows[row]));
  }
  map.plant(5, 23, 'produceCrate');
  map.plant(13, 24, 'produceCrate');

  // == THE LEAT'S THREE CROSSINGS ===========================================
  // Two fords and a bridge. A ford is the same river running pale over stones,
  // banked only where it meets land (`joins`, in the catalogue); the bridge is
  // the town's own, plank-decked, and lands in a fence with one gap in it.
  map.draw(0, 27, [
    '       ww           ww          ',
    '       ww           ww          ',
    '       ww           ww          ',
  ]);
  map.plant(12, 26, 'bridge');

  // == THE SOUTH BANK =======================================================
  // Each crossing lands in its own third of the south. The west ford comes up
  // in the Flood's reeds, with the culvert mouth on the pool's far shore. The
  // bridge comes down into the fence Scout Lee holds the gap in, and the road
  // from there runs to the South Gate's arch. The east ford lands on the
  // sluice's stone apron - the hatch at the head of the leat is the Sluice
  // Wheel - above the stockyard's two paddocks, and its way to the gate road
  // is the dry lane along the paddocks' south side: the quiet way, and the long
  // one. The apron is three rows deep because the hatch is two: drawn two deep
  // it walled the ford off from the sluice, and nothing but a measured route
  // noticed.
  map.draw(0, 30, [
    '       ..gg#        ..MMMMM     ',
    '       ..ggFF.FFF   ..MMMMM     ',
    '       ##ggg#,,   FFFFMMMMM#    ',
    '       gggg.#,,#  gggg.gggg.    ',
    '       gCgg.#,,,,#gggg.gggg.    ',
    '       gggC.g,,,,FFF.F.FF.F.    ',
    '   ....ggg#g###,,#gggg.gg...    ',
    '   ....g.gg####,,....#..gg.     ',
    '     ......   #,,......         ',
    '              .,,.              ',
    '              .,,.              ',
    '              .,,.              ',
    '               ,,               ',
  ]);
  map.plant(3, 36, 'culvert');
  map.plant(14, 39, 'stoneArch');
  map.plant(23, 30, 'cellarDoors');





  // == WHAT GROWS IN THE THICKET ===========================================
  // The lanes are packed so close that the wood between them is mostly a hedge
  // thick, and the lattice only fits a broadleaf where three tiles by two are
  // left standing. Left alone that is a carpet of one round bush. So wherever
  // the thicket is deep enough it is planted with what fits - a broadleaf off
  // the lattice, a pine where there are two tiles, a tall bush where there is
  // one - unevenly, with undergrowth left between. A crown here only ever hangs
  // over thicket: a crown tile has grass baked into it, so over a road it is a
  // green square, and over ground anyone walks it hides them. The lattice is
  // held to the same rule, which is why some of its trees are down to a bush -
  // and to one more: beside everything the map captions, one band of sky is
  // left clear for the caption to sit in.
  map.draw(0, 0, [
    '                                ',
    '                                ',
    'b                               ',
    '                                ',
    '                                ',
    'p      p      p                 ',
    '                                ',
    '                               b',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
    '                               b',
    '                                ',
    'p                             p ',
    '                                ',
    '                                ',
    '                                ',
    '                              p ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                             p ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                              b',
    '                                ',
    '                                ',
    'p                              b',
    '                                ',
    '                                ',
    '                                ',
    '                                ',
    '            t          b       b',
    '                     b          ',
    'b                               ',
    '                                ',
  ]);

  return map;
}
