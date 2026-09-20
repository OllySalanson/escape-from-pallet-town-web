import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Pallet Town - the mill town on the leat, and the valley it stands in.
 *
 * 64x88. It was 32x44 and it was the town alone; the town is unchanged, tile
 * for tile, and everything round it is new. What the extra ground is *for* is
 * the thing a five-minute raid on a vast map is for: you drop in at one corner
 * of a parish, walk a part of it, and leave knowing what you did not get to.
 * Crossing the whole valley - the quarry in the east hills to the hard at the
 * mouth - is 171 steps, a ninth of the clock, so a raid is one end of it or the
 * other and never both.
 *
 * **One water, from the spring to the tide.** The old map's promise was that
 * the water is the whole of its shape, and it still is, only longer: the spring
 * rises in the hanger above the far bank, the millpond it feeds runs the mill,
 * the race carries it south, the leat cuts the town in two, and the Flood is
 * where the leat dies and the culvert takes it under the ridge. Below the ridge
 * nothing is fresh: the tide comes up the creeks into the saltings, the salt
 * pans are worked between them, and the strand and the hard are the sea's.
 * Salt and fresh never meet on this map, which is why the south is entered by
 * two roads over dry land rather than by following the water down.
 *
 * **Twenty-one places.** The seven the town always had:
 *
 * - MARKET SQUARE (north-west) - the two houses and the paved square. The front door.
 * - THE NORTH FIELD (north) - tall grass round two old trees; the way round the pond.
 * - THE MILLPOND (east) - the mill, and the stair cut in the rock on the far bank.
 * - THE GREEN (west) - the town pump, the bench and the oak, under the square.
 * - THE ALLOTMENTS (middle) - three sheds gone to seed. The ledger is in there.
 * - THE STOCKYARD (south) - the bridge foot, the paddocks, the sluice, the gate road.
 * - THE FLOOD (south-west) - the leat's drowned end, and the culvert on its shore.
 *
 * Five up the valley, east of the town, reached by the ride out of the north
 * field and by the kiln road off the sluice apron - and the two are separate
 * countries, because the wood between them stands on the rock the Mill Stair is
 * cut into:
 *
 * - THE HIGH WOOD (north-east) - the ride in three short reaches, the charcoal
 *   hearth off its first turn, a glade with a fallen tree off its second.
 * - THE HANGER (east) - beech wood on the slope, and the spring house in it.
 * - THE QUARRY (far east) - the stone the town is built of, its pit flooded, its
 *   adit open, and its own track out to the north-east.
 * - THE DROVE (south-east) - the walled road off the apron, stepping east down
 *   the hill in six short reaches.
 * - THE KILNS (far east, below the quarry) - lime kilns cut into the rock, and
 *   the lime road out. The quarry's south bench stands over them, and the drop
 *   off it is the one route only the player has (`ledges.ts`).
 *
 * And nine down the valley, south of the town, entered by the Gate Lane out of
 * the stockyard or by the withy causeway off the Flood's shore:
 *
 * - THE WITHY BEDS (south-west) - osier cut in wet plots, standing water either
 *   side of the causeway for twenty steps.
 * - THE WATER MEADOWS (south) - hedged hay closes off the Gate Lane, the
 *   rickyard at the foot of them, and the brook rising under it.
 * - THE POUND (south, in the wood) - the parish pound at the head of a green
 *   spur, and a dead end on purpose.
 * - THE OLD FIELDS (south-east) - small closes nobody has ploughed since the
 *   flood, off a green lane that zig-zags down to the sea wall.
 * - THE SALTINGS (far south-west) - salt marsh, two creeks with one ford each,
 *   and the pans worked between them.
 * - THE STRAND (far south) - groyned sand between the marsh and the sea.
 * - THE HARD (far south) - the stone slip the ferry lies off.
 * - THE NESS (far south-east) - the neck of the headland, and the gate across it.
 * - THE BEACON (far south-east) - the headland: bare turf, a rock spine, the light.
 *
 * **Two keepers, two doors each.** Miller Vance holds the far bank as he always
 * did; Salter Cobb holds the headland at the other end of the map, with the
 * gate across the ness and the steps down its west face onto the hard. Each is
 * the same shape: the door in front of you, and a second that opens onto ground
 * you already walked. Beaten, the town is a ring and so is the south.
 *
 * **Seven ways out**, because the valley is long and a raid that drops into one
 * end of it must never be stranded there: SOUTH GATE and WEST CULVERT and MILL
 * STAIR in the town, QUARRY TRACK above and LIME ROAD below in the east hills,
 * FERRY HARD on the shore and HEADLAND STEPS behind the salter's doors. From
 * every landing the nearest of them is under a tenth of the clock away, which
 * `palletTown.test.ts` holds against `RAID_DURATION_MS` rather than a number.
 *
 * Three crossings of the leat, three prices (`palletTown.test.ts` holds them):
 * the bridge is the quick way and Scout Lee stands in the one gap at its foot;
 * the west ford lands in the Flood's reeds, where nothing is free; the east ford
 * is dry all the way to the gate, and the long way round. A fourth way goes
 * round the head of the water altogether, past the Mill Stair, and is twice as
 * long again. None of the new ground adds a fifth: everything east of the town
 * is either north of the water or south of it and never both.
 *
 * Drawn as character art, one character per tile, in the Floodplain's hand: the
 * base is solid wood with a tree on a lattice, and every place is cut out of
 * it. Legend as `floodplainRelay.ts`: `W` deep water, `w` a ford, `.` grass,
 * the double quote mown turf, `g` tall grass, `,` trodden earth, `P` paving,
 * `M` stone, `v` gravel, `d` dry sand, `~` beach at the waterline, `#` hedge,
 * `T` thicket, `C` rock, `F` fence; `t` a tree of the forest, `a` the other
 * broadleaf, `o` one that stands in grass, `p` and `q` the two pines, `b` a tall
 * bush. Earth and paving are laid two tiles wide or not at all - this sheet
 * draws a lane's edge on one side of a tile, so a one-tile lane has a fringe
 * down one side and a bare cut down the other - and what is one tile wide is
 * grass, which has no edge to get wrong.
 *
 * The blocks below are in drawing order and the order matters twice: the ground
 * comes before what grows on it, and the planting pass comes before the two
 * places cut *after* it, so a pine the planting stood in the pound is felled by
 * the pound's own ground rather than left standing in a hurdle ring.
 */
export function sketchPalletTown(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 64,
    height: 76,
    fill: '.',
    stamps: {
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
      // A second broadleaf and a second pine, so a wood is not one crown
      // repeated: the lattice is regular by construction and the planting pass
      // below is what stops it reading as a printed pattern.
      a: {
        prop: 'treeAlt',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
      q: { prop: 'pineAlt', anchor: [0, 2], ground: '.', blocks: [[0, -1], [1, -1], [1, 0]] },
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTWWWWWWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTWWWWWWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTWWWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTTWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTWWWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTtTTtTTtTTtTTtTTtTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTWWWWWTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTWWWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTTTTTTTTTTtTTtTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTTTTtTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
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





  // Two lattice trees felled for the sluice's sake: their crowns hung in the
  // band of sky the Sluice Wheel's caption has to sit in, and canopy is ground
  // a caption may not take. Three of the thicket's own plantings below went the
  // same way - the pines over the towpath gate and the far bank's landing, and
  // the bush beside the miller. `tools/tileset/crowns.mts` names all five.
  map.draw(29, 34, ['T']);
  map.draw(29, 36, ['T']);


  // == THE HIGH WOOD ========================================================
  // The ride leaves the north field by a gap in the wood bank and climbs east
  // in three short reaches, never one run - the same staircase the mill lane
  // makes down in the town. Off its first turn is the charcoal hearth: a burnt
  // floor with the burner's hut on it, cordwood stacked and a ring of stumps.
  // Off its second is a glade of tall grass with a fallen tree across it. The
  // third reach ends at the wood gate and the quarry's own track.
  map.draw(29, 3, [
    '       vvvvvv                      ',
    '       vvvvvv                      ',
    '  ,,,, vvvvvv                      ',
    '  ,,,, vvvvvv g.ggg.               ',
    '    ,,,,,,,,  .gg.g.               ',
    '    ,,,,,,,,  gg..g.               ',
    '          ,,,,,,,,                 ',
    '          ,,,,,,,,                 ',
    '                ,,,,,,,,           ',
    '                ,,,,,,,,           ',
  ]);
  map.plant(36, 3, 'hut');
  map.plant(40, 3, 'crateStack');
  map.plant(40, 5, 'bigStump');
  map.plant(44, 7, 'log');
  map.plant(47, 6, 'deadStump');

  // == THE SCARP, THE HANGER AND THE QUARRY =================================
  // The rock the Mill Stair is cut into does not stop at the stair: it runs the
  // whole length of the far bank and turns the corner, so the towpath below and
  // the wood above never meet. On top of it is the hanger - a beech wood on the
  // slope, with the spring the millpond is fed by rising in the middle of it
  // and going under the scarp - and east of that the quarry the town is built
  // out of, its floor flooded at the deep end and its track out to the
  // north-east. The quarry's south bench stands over the kilns and is the only
  // way down that is not the whole valley round: see `ledges.ts`.
  map.draw(31, 13, [
    '                  ,,,,,,,        ',
    '                  ,,  vvvvvvvv   ',
    '                  ,,  vvCCvvvvv. ',
    '                  ,,  vCCCvvvvv. ',
    '             ,,,,,,,  vvvvvv     ',
    '       ,,,,,,,        vvvvvv     ',
    '       ,,ggg..        vvWWWvv    ',
    '      .gg..g..       vvvWWWvvv   ',
    '      ..g.gg.        vvvWWWWvv   ',
    '     .gg..g..        CCvWWWWvv   ',
    '     .g.WW.g.        CCvvWWvvv   ',
    '     ..gWW..g         Cvvvvvvv   ',
    '      .g..gg.         CCvvvvv    ',
    '       .ggg.          CCvvvv     ',
    '                       Cvvvv     ',
    '                       CCvvv     ',
    '                       CCvvv     ',
    '                         vvv     ',
    '                         CCC     ',
  ]);
  map.plant(38, 22, 'shrine');
  map.plant(56, 14, 'mineMouth');
  map.plant(59, 17, 'crateTower');
  map.plant(53, 26, 'boulder');
  map.plant(59, 24, 'boulder');
  map.plant(60, 21, 'barrelPair');

  // == THE KILN ROAD ========================================================
  // East off the sluice apron, under the scarp: the road the lime went out by.
  map.draw(27, 30, [
    ',,,,,,,,',
    ',,,,,,,,',
  ]);

  // == THE DROVE AND THE KILNS ==============================================
  // Below the scarp the ground is the town's other trade: the lime kilns cut
  // into the bank, their burnt floor, and the walled drove road that the stone
  // and the stock both came down. The drove runs south out of the valley.
  map.draw(31, 32, [
    '  ,,                             ',
    '  ,,                vvvvCCvvvvvv ',
    '  ,,                vvCCCCCCvvvv ',
    '  ,,,,,,          vvvvCCCCCCvvvv ',
    '      ,,          vvvvCCCCvvvvvv ',
    '      ,,          vvvvvvCCvvvvv  ',
    '      ,,,,,,      vvvvvvvCCvvv   ',
    '          ,,      vvvvvvCvvvv    ',
    '          ,,,,,,  vvvvvCCvvv     ',
    '              ,,    vvvvvvv      ',
    '              ,,,,,,,,           ',
    '                  ,,             ',
    '                  ,,             ',
  ]);


  // == THE WITHY BEDS AND THE WATER MEADOWS =================================
  // Two ways out of the town's south bank, and two different countries. The
  // west one drops off the Flood's shore into the withy beds - osier cut in
  // wet plots with a causeway between them, standing water either side of you
  // for twenty steps. The east one is the Gate Lane out of the stockyard, into
  // hedged hay meadows with a rickyard at the foot of them, and past the
  // rickyard the brook rises and runs south to the tide.
  map.draw(0, 39, [
    '       ..          ,,               ',
    '    .....          ,,               ',
    '    ,,gWWg#       g,,g              ',
    '    ,,gWWg.       g,,,,,,g          ',
    '    ,,g.gg#      ######,,#######    ',
    '    ,,##WW##     #.gg.#,,#gg.g.#    ',
    '    ,,,,,,,g     #..g.#,,#.gg..#    ',
    '    WWW..,,#g    #g..g.,,#g..gg#    ',
    '    WWWg.,,g.    #.g.g#,,.g...g#    ',
    '    #WWg.,,gg    ######,,#######    ',
    '    #WWg.,,g.          ,,,,,,,      ',
    '    WW.g.,,gg               ,,      ',
    '    #####,,###              ,,vvvvvv',
    '    ,,,,,,,gg               ,,vvvvvv',
    '    ,,gg.WWgg               ,,vvvvvv',
    '    ,,g.gWWg.               ,,vvvvvv',
    '    ,,gWWg.gg             ,,,,vvvv  ',
    '    ,,gWWg.g.           WW,,        ',
    '    ,,########          WW,,        ',
    '    ,,,,,,,g.        .g.WW,,        ',
    '    ##WW.,,gg        g..WW,,        ',
    '    .ggWW,,g.        ..wwww,        ',
    '    gg.g.,,gg        .g.WW,,        ',
    '    .gg.g,,g.        gg.WW,,        ',
    '    g.gg.,,gg        g..WW,,        ',
  ]);
  map.plant(32, 51, 'barn');
  map.plant(30, 53, 'crateStack');
  map.plant(30, 51, 'sack');
  map.plant(9, 44, 'deadStump');

  // == THE OLD FIELDS =======================================================
  // East of the meadows the hill is walled into small closes that nobody has
  // taken a plough through since the flood - a green lane between them, the
  // sheep fold still standing at the top of it, and the lane going on south to
  // the sea wall. The drove off the kiln road comes in at the head of it.
  map.draw(36, 44, [
    '       ######,,#########    ',
    '       #.gg.#,,#g.g..g.#    ',
    '       #g..g#,,..g..g.g#    ',
    '       #.g.g#,,#.gg.g.g#    ',
    '       #g.gg.,,#g..g.g.#    ',
    '       ######,,#########    ',
    '       ,,,,,,,,             ',
    '       ,,######             ',
    '       ,,#.g.g#             ',
    '       ,,#g..g#             ',
    '       ,,..gg.#             ',
    '       ,,#g.g.#             ',
    '       ,,#..g.#             ',
    '       ,,#g.gg#             ',
    '       ,,,,,,,,             ',
    '             ,,,,,          ',
    '        ########,,########  ',
    '        #.g.g.##,,#g..g.g#  ',
    '        #g.g...#,,#.g.gg.#  ',
    '        #.gg.g,,,,#g.g..g#  ',
  ]);
  map.plant(57, 62, 'hut');
  map.plant(45, 56, 'boulder');



  // == THE SALTINGS, THE STRAND, THE HARD AND THE BEACON ====================
  // Where the valley ends. Salt and fresh never meet on this map: the leat's
  // water goes under the ridge at the Flood and is gone, and everything from
  // here down belongs to the tide. The marsh is cut by two creeks with one ford
  // each, the salt pans are worked in the middle of it, the strand below is
  // groyned, and the stone hard east of it is where the ferry lies off. The
  // headland is a place of its own behind SALTER COBB's two doors.
  map.draw(0, 64, [
    '    g.g.gggWWWWWWWWWWg.g.gg.                #g.g.g##,,..g.gg.#  ',
    '    WWWWWwwWWWWWWWWWwwWWWWWW                ########,,########  ',
    '    WWWWWwwWWWWWWWWWwwWWWWWW                        ,,,,        ',
    '    g.g.MMMMWWg.g.gg..WMMMMW                          ,,        ',
    '    .gg.MWWMg..g.Wg.gggMWWMW                        ,,,,,,      ',
    '    WWWWWWWWWWWWWWWWwwWWWWWW                  CC""""""CC""""""" ',
    '    WWWWWWWWWWWWWWWWwwWWWWWW                 CCC""""""CC""""""" ',
    '    .gg.WWg.gg.gWWg.g.gWWg.gg.gCgg.g        CC"""""""""CC"""""" ',
    '  ddddFdddddddddFddddddddddFMMMMMMMCMMMMCMMMCC""C""""""CC"""""" ',
    '  dddddddddFdddddddddFddddddMMCMMMMCMCMMMMMMCCCC"""""""CC"""""" ',
    '  ~~~~~~~~~C~~~~~~~~~C~~~~~~~~~C~~~~~~~C~~~~WWWWWW""""""WWWWWWWW',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);

  map.plant(60, 69, 'roundhouse');
  // What stands on the new ground. A place is remembered as the things in it,
  // so every one of these is something somebody left: the hanger's felled
  // timber, the kilns' own mouths, the salt house on its pan walk, the boat
  // shed above the hard, and the pier the ferry comes to.
  map.plant(41, 20, 'log');
  map.plant(43, 25, 'deadStump');
  map.plant(59, 28, 'cratePair');
  map.plant(53, 35, 'mineMouth');
  map.plant(55, 37, 'mineMouth');
  map.plant(50, 39, 'crateStack');
  map.plant(6, 61, 'stump');
  map.plant(31, 73, 'mooringPost');
  map.plant(35, 73, 'jetty');
  map.plant(36, 74, 'mooringPost');
  map.plant(36, 69, 'barrelPair');
  map.plant(25, 67, 'crateStack');
  map.plant(23, 70, 'boulder');
  map.plant(26, 74, 'mooringPost');
  map.plant(21, 62, 'stump');
  map.plant(33, 69, 'crateStack');
  map.plant(30, 68, 'hut');
  map.plant(48, 73, 'gravestoneWorn');


  // == WHAT GROWS IN THE NEW GROUND ========================================
  // The lattice under everything above is a regular grid of one broadleaf, and
  // left alone that is what it reads as - a printed pattern, not a wood. This
  // thins it in clumps, stands pines on the dry high ground where a pine
  // belongs, puts a second crown among the broadleaves, and sets tall bushes
  // along the edges people walk past. Same hand as the town's own thicket pass
  // above, over four times the ground: every letter here stands on ground
  // nobody walks, so the wood changes and the map does not.
  map.draw(32, 0, [
    '                                ',
    '                                ',
    '            p  q        q  p    ',
    '                                ',
    '         T     p           a    ',
    '                                ',
    '                  q           p ',
    '                                ',
    '                     a     q    ',
    '                                ',
    '               p  T     a       ',
    '                                ',
    '                                ',
    '                                ',
    '               q                ',
    '                                ',
    '         T  p                   ',
    '                                ',
    '                                ',
    '                                ',
    '         T        p             ',
    '                                ',
    '               p                ',
    '                                ',
    '            q     a             ',
    '                                ',
    '               a                ',
    '                                ',
    '            p     q             ',
    '                                ',
    '         q                      ',
    '                                ',
    '      p     T                   ',
    '                                ',
    '            a                   ',
    '                                ',
    '         p                      ',
    '                                ',
    '            q                 p ',
    '                                ',
    '   a                            ',
    '                                ',
    '      p                    a    ',
    '                                ',
  ]);
  map.draw(0, 44, [
    '                                                                ',
    '                                                                ',
    '  q                             a  q                            ',
    '                                                                ',
    '                                q     a                         ',
    '                                            T                   ',
    '  p                                p     q                      ',
    '                                                                ',
    '                                      q                         ',
    '                                   T                            ',
    '  a                                                             ',
    '                                                                ',
    '                                      p                         ',
    '                                         T                      ',
    '  q                          p     q                            ',
    '                                                                ',
    '                                q     a                       p ',
    '                             T                                  ',
    '  p                          a     p                          q ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
  ]);

  // == THE POUND ===========================================================
  // A green spur east off the meadow lane, into the wood between the meadows
  // and the old fields, and at the head of it the parish pound: a hurdle ring
  // where strays off the drove were shut up until somebody claimed them. It is
  // the one reason to leave the lane on that stretch, and it is a dead end on
  // purpose - a vast map needs somewhere you went and came back from.
  map.draw(28, 56, [
    '   FFFFFF',
    '   Fg.ggF',
    '....g.g.F',
    '   F.gg.F',
    '   Fg..gF',
    '   FFFFFF',
  ]);
  map.plant(33, 57, 'barrelPair');

  // What is growing in the closes, what is lying in the creeks, and what the
  // sea has put up the strand. Beds and lilies are walked over, and a rock in
  // a creek stands in water that was already a wall, so none of this moves a
  // tile of the map - it is the difference between a hedged square and a field
  // somebody works.
  map.plant(44, 45, 'bedYellowCrop');
  map.plant(44, 46, 'bedRedCrop');
  map.plant(44, 47, 'bedSeedlings');
  map.plant(53, 45, 'bedRedCrop');
  map.plant(53, 46, 'bedSeedlings');
  map.plant(53, 47, 'bedYellowCrop');
  map.plant(47, 62, 'bedSeedlings');
  map.plant(47, 63, 'bedYellowCrop');
  map.plant(47, 64, 'bedRedCrop');
  map.plant(51, 61, 'produceCrate');
  map.plant(13, 65, 'wetRock');
  map.plant(22, 65, 'wetRock');
  map.plant(6, 65, 'wetRock');
  map.plant(24, 65, 'wetRock');

  // == THE LATTICE, THINNED ================================================
  // Eight trees of the lattice stood where the new ground put something else:
  // over the Mill Stair's rock, in the quarry, under the rickyard's barn.
  // A tree is felled by cutting the ground its letter stands on.
  map.draw(29, 60, ['T']);
  map.draw(29, 68, ['T']);
  map.draw(32, 68, ['T']);
  map.draw(29, 70, ['T']);
  map.draw(32, 70, ['T']);
  map.draw(35, 70, ['T']);
  map.draw(38, 70, ['T']);
  map.draw(47, 66, ['T']);
  map.draw(59, 66, ['T']);
  map.draw(32, 14, ['T']);
  map.draw(32, 20, ['T']);
  map.draw(32, 22, ['T']);
  map.draw(62, 22, ['T']);
  map.draw(62, 24, ['T']);
  map.draw(53, 28, ['T']);
  map.draw(32, 40, ['T']);
  map.draw(35, 56, ['T']);

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
    '                                ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
    '                                ',
    '                                ',
    'p                               ',
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
