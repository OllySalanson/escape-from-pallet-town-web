import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Route 1 - the long braid.
 *
 * 64x72. The shipped 32x32 map is the top-left quarter of this one and is
 * unchanged tile for tile: the Route Head, the two roads, the Meadows with the
 * fenced Middle Field in them, Oak's field station and the Overlook on its
 * bank are all exactly where players learned them. What is new is what the old
 * map's sealed border was standing in the way of - the country east of the
 * station and the whole of the route south of the Outpost - and the braid is
 * the thing that carries into it.
 *
 * The idea is unchanged and is repeated at the new scale. Two roads run the
 * length of the map, quick and bare, stepping sideways every eight or nine
 * tiles so neither is a sprint; everything between them is grass, so crossing
 * from one to the other is always the shorter way and always the one that
 * costs fights. Above the Outpost that is the Meadows. Below it the roads
 * become THE DROVE and THE OLD ROAD, and what they run either side of is THE
 * COMMON - the same bargain, a map further on.
 *
 * Across the middle is the one thing the old map had none of: water. THE BROOK
 * runs the full width of the map and is never more than three tiles wide, so
 * the far bank is always in view and the crossings are the decisions. There
 * are three, and they are deliberately unlike each other - the plank bridge
 * carries the west road, the ford carries the east one, and the stepping
 * stones below the steading are a private crossing for whoever went that way.
 *
 * Nineteen places. Eight are the shipped map's: ROUTE HEAD (the front door and
 * the fork), WEST ROAD, EAST ROAD, THE MEADOWS, OAK'S FIELD STATION, THE
 * OVERLOOK on its bank, WEST GATE and THE OUTPOST. Eleven are new: THE ORCHARD
 * walled on the turf east of the station, the THORN DELL grown shut in the wood
 * above it, THE PADDOCKS below, THE STEADING that works them, THE POUND on the
 * old road, THE DROVE and THE OLD ROAD themselves, THE BROOK, THE WATER
 * MEADOWS in the wet west, THE COMMON, THE CHARCOAL BURN in the south-east and
 * SOUTH GATE where the two roads meet again and the route goes on to Viridian.
 *
 * The bank the Overlook stands on is this sheet's ledge, and nothing in this
 * game hops down one: it is only ever stood where nobody can get on top of it,
 * with a fence along its brow, so that it reads as the wall it is.
 *
 * Drawn in the Floodplain's hand; legend as `floodplainRelay.ts`, plus `<`, `=`
 * and `>` for the west end, the run and the east end of a bank.
 */
export function sketchRoute1(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 64,
    height: 72,
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
      '<': { prop: 'bankWest', anchor: [0, 0], ground: '.' },
      '=': { prop: 'bank', anchor: [0, 0], ground: '.' },
      '>': { prop: 'bankEast', anchor: [0, 0], ground: '.' },
    },
  });

  // == THE WOOD THE WHOLE ROUTE IS CUT OUT OF ===============================
  // A lattice of broadleaf, thinned where a caption needs a band of sky. Every
  // place below is carved out of this rather than built up on it.
  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTTTTtTTtTTtTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTtTTTTTTTTTTTtTTtTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTTTTTTTTTTtTTTTTTTTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
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

  // == THE ROADS ============================================================
  // The head is a small apron under the route board with the fork below it:
  // the east arm leaves a row higher than the west, so which road is a choice
  // made on the first step. Each road is earth, two tiles wide, and steps
  // sideways by two every eight or nine tiles - a jog of one would leave a row
  // in common and the road would still be a sprint. The west road ends at the
  // West Gate's arch in the south-west corner; both come round to the
  // Outpost's paved apron, the hut beside it and the way out south.
  map.draw(0, 2, [
    '               ...              ',
    '              .....             ',
    '              ,,,,,,,,,,        ',
    '        ,,,,,,,,, ,,,,,,        ',
    '        ,,            ,,        ',
    '        ,,            ,,..      ',
    '        ,,            ,,        ',
    '     ,,,,,          ,,,,        ',
    '     ,,,,,          ,,,,        ',
    '     ,,             ,,          ',
    '     ,,             ,,          ',
    '  ggg,,             ,,          ',
    '  gg.,,             ,,          ',
    '     ,,             ,,,,        ',
    '     ,,,,,          ,,,,,,      ',
    '     ,,,,,            ,,        ',
    '        ,,            ,,        ',
    '        ,,            ,,        ',
    '        ,,            ,,        ',
    '        ,,          ,,,,        ',
    '        ,,          ,,,,        ',
    '   ,,,,,,,          ,,          ',
    '   ,,,,,,,          ,,          ',
    '   ,, ,,            ,,,,        ',
    '   ,, ,,  ,,,,PPPPP ,,,,        ',
    '   ,, ,,  ,,,,PPPPP   ,,        ',
    '   ,, ,,,,,,  PPPPP,,,,,        ',
    '   ,, ,,,,,,  PPPPP,,,,,        ',
    '                PP              ',
  ]);

  // == THE MEADOWS ==========================================================
  // Between the roads. The north meadow is open tall grass round one old tree,
  // entered from the west road at its top and from the east road lower down,
  // so no row of it runs road to road. Below it a second way across runs along
  // the middle field's north fence, which has two doors in it. The field is
  // fenced all round, and its south door opens onto the one tile where June
  // stands, with the third way across passing through that same tile.
  map.draw(0, 6, [
    '          ggggg                 ',
    '           ggTTTggg             ',
    '           gg...ggggggg         ',
    '           g..o..gg             ',
    '           gggg.gCgg            ',
    '           gggg.ggg             ',
    '       gggggggCgggg             ',
    '           FF.FFF.FF            ',
    '           #ggg.ggg#            ',
    '           #g.gggCg#            ',
    '           #gggg.gg#            ',
    '           #gg.gggg#            ',
    '           FFFFF.FFF            ',
    '           ggggg.gg             ',
    '          gggg.g ggggg          ',
  ]);

  // == OAK'S FIELD STATION, AND THE OVERLOOK ABOVE IT =======================
  // The Overlook is a small shelf of grass round a great stump, with the fence
  // along its brow and the bank below that. The rock in the fence and in the
  // bank, at their east end, is the steps, which `../gates.ts` owns in both
  // states. Its four captioned things stand apart on purpose - the gate west,
  // the stile on the north edge (two tiles clear of the corner, which is the
  // raid clock's), the steps south-east, the landing on the west side -
  // because drawn closer together their captions fought for the same seats
  // and the gate went unnamed from the road. Under the bank
  // a strip of grass runs along its foot and round the station - the one
  // building on the route, door to its paved yard, crates stacked where the
  // relay's spur leaves east.
  map.draw(0, 2, [
    '                           .... ',
    '                           .... ',
    '                           .... ',
    '                           .... ',
    '                           .... ',
    '                           .... ',
    '                           FFCF ',
    '                          <==C> ',
    '                         ...... ',
    '                         ...... ',
    '                         ...... ',
    '                         ...... ',
    '                         ...... ',
    '                         PPPP.. ',
    '                         PPPPP. ',
    '                         PPPPP. ',
  ]);

  // == THE WAYS OUT OF THE OLD FOOTPRINT ===================================
  // The shipped map was a 32x32 arena with a sealed forest border, and that
  // border is the only part of it this change touches - twenty-one tiles of it,
  // every one in the east column or the two south rows, and nothing inside them.
  // The Outpost's two roads run on south, a grass path leaves the station yard
  // east, and the Overlook's shelf, its fence and its bank carry east onto
  // ground that was the edge of the world. The Outpost apron keeps its own dead
  // end, so the exit standing in it is still a pocket a player steps into rather
  // than a tile the road runs over.
  map.draw(6, 30, [
    ',,              ,,  ',
    ',,,,            ,,,,',
  ]);
  map.draw(31, 2, ['.', '.', '.', '.', '.', 'F', '<', ' ', '.']);

  // == THE EAST COUNTRY: THE ORCHARD, THE THORN DELL, THE PADDOCKS =========
  // A walled fruit garden on mown turf, reached by the grass path out of the
  // station yard, with its own arch out at the north; a hollow in the wood
  // above it that the growth closed and a Cut opens; and below both, the
  // steading's fenced fields either side of the drove lane, whose tall grass is
  // the price of the short way south.
  map.draw(32, 0, [
    '                                ',
    '                                ',
    '...C......                      ',
    '........o.                      ',
    '.o........       ......         ',
    '....C.....       ......         ',
    '.C...FFFFF  TT T ......         ',
    'FFFFF<===>  ..   ......         ',
    '====>       .. T ......         ',
    '  FFFFFFFFFF.FF    T            ',
    '..F...........FT   .            ',
    ' .F..o...o....F    .            ',
    ' .............F   ..            ',
    '  F...........F   .             ',
    '  F.........o.F   .             ',
    '  F...........F ...             ',
    'T F.o...o.....F .               ',
    '  F...........F .               ',
    'T F..........."...              ',
    '  F...........F ..              ',
    '  F..o....o...F ..FFFFFFFFFFFFF ',
    '  F...........F ..FgggggFgggggF ',
    '  F....PP.....F b.gggoggFgggggF ',
    '  F....PP.....F ..FgggggggggggF ',
    '  F....PP.....F ..FgggggFggoggF ',
    '  FFFFFF.FFFFFF ..FFFFFFFFFFFFF ',
    '   T  T .       .bFgggggggggggF ',
    '        ..      ..FgggogggogggF ',
    '         .      ..ggggggggggggF ',
    '         ..     ..FgggggggggggF ',
    '          .     b.FgggggggggggF ',
    '          .     ..FFFFFFFFFFFFF ',
  ]);

  // == THE SOUTH COUNTRY ===================================================
  // The braid again, a map further on. The two roads leave the Outpost and run
  // the length of this half, stepping sideways as they go; THE COMMON lies
  // between them and every crossing of it is grass. THE BROOK cuts the whole
  // width and has three crossings, none of them like another. West of the
  // drove the ground goes wet; east of the old road the steading's track drops
  // over the stepping stones into the charcoal burn. The two roads meet again
  // on the South Gate apron, under the arch the route goes on through.
  map.draw(0, 32, [
    '        ,,              ,,                ..    ..   T  T       ',
    '        ,,        FFFFFF,,                 . vvvvvvvvvvvvvvvv   ',
    '        ,,        FggggF,,                 . vvvvvvvvvvvvvvvv   ',
    '        ,,        FggggF,,         ......  . vvvvvvvvvvvvvvvv   ',
    '        ,,        Fggggg,,         .T.... .. vvvvvvvvvvvvvvvv   ',
    '        ,,        FggggF,,         ...... .  vvvvvvvvvvvvvvvv   ',
    '        ,,,,      FggggF,,,,       ...... .  vvvvvvvvvvvvvvvv   ',
    '          ,,      FggggF  ,,       ....T. .. vvvvvvvvvvvvvvvv   ',
    '          ,,      FFFFFF  ,,       ......  . vvvvvvvvvvvvvvvv   ',
    '          ,,              ,,            .  .  v .      ..       ',
    '          ,,              ,,,,          ....... . T    ..       ',
    '          ,,,,              ,,..    ......             ..       ',
    '            ,,      WWWWWW  ,, ......                  ..       ',
    '            WWWWWWWWWWWWWWWWwwWW                     ....       ',
    '        WWWWWWWWWWWWWWWWWWWWwwWWWWWWWWW              ..         ',
    ' WWWWWWWWWWWWWWWWWWW      WWwwWWWWWWWWWWWWWWWWW      wwWW       ',
    ' WWWWWWWWWWW,,              ,,  WWWWWWWWWWWWWWWWWWWWWwwWWWWWWWW ',
    ' WWWWWWW    ,,  ggggCgggTg  ,,         WWWWWWWWWWWWWWwwWWWWWWWW ',
    '            ,,,,gTggggCggg,,,,                 WWWWWW..  WWWWWW ',
    '              ,,gggCgg.ggT,,       ....              ..         ',
    '        ......,,T.gggCggCg,,      ......             ..         ',
    ' ggTgggC.g    ,,ggCggggT.g,,     .....T.      vvvTvvvCvvvvTvvv  ',
    ' CgggW.g.T    ,,CggggggggT,,..   .......      vC.vvvTvCvvCvvvT  ',
    ' g....ggTg    ,,ggTgggCggg,, ... .T.....      vvvvTvvvvCv.vTvv  ',
    ' g....gWgg    ,,gCg.gTggCg,,   ........       CvvvvvvvvvvvCvvC  ',
    ' g.....ggT  ,,,,gggTgggggC,,      ....        vvTvvvvvvvvvv.Tv  ',
    ' gW.gggCgg  ,,TTggCgggTg,,,,                  v.vvCvvvTvvvvCvv  ',
    ' gggggCggT  ,,g.CgggTggC,,                    vvvvvvCvvvvvvvvC  ',
    ' ggCgggW.T  ,,TgggCggCgg,,                    vvvvvvvv.Tvvvvvv  ',
    ' ggggTgggg  ,,ggTggCgggT,,                    vCvvvvvvvvCvvTvv  ',
    ' .WggggCgg  ,,gCgT.ggCgg,,                    vvvv.vvTvvvvCvvT  ',
    ' gggCgggTg  ,,,,,,,,,   ,,                  ....                ',
    '            ,,,,,,,,,   ,,          .........                   ',
    '                    PPPPPPP .........                           ',
    '                    PPPPPPP..                                   ',
    '                      PP                                        ',
    '                    T PP                                        ',
    '                      PP                                        ',
    '                    T                                           ',
    '                                                                ',
  ]);

  map.plant(25, 11, 'building');
  map.plant(28, 4, 'bigStump');
  map.plant(2, 26, 'stoneArch');
  map.plant(12, 27, 'hut');
  map.plant(28, 16, 'crateStack');
  map.plant(19, 26, 'banner');

  // The orchard: the arch over its north gate, the packing shed built into its
  // south wall, and the crop standing about its turf. Each of these is also a
  // break in a row or a column of it, because eleven tiles of mown turf with
  // nothing in them is a lawn you can cross at a run.
  map.plant(43, 6, 'stoneArch');
  map.plant(35, 21, 'barn');
  map.plant(38, 12, 'produceCrate');
  map.plant(41, 22, 'produce');
  map.plant(42, 17, 'crate');
  map.plant(44, 18, 'crate');
  map.plant(40, 21, 'crate');
  map.plant(45, 21, 'potPlant');

  // The thorn dell, and the paddocks below the orchard.
  map.plant(50, 5, 'boulder');
  map.plant(53, 7, 'deadStump');
  map.plant(57, 28, 'log');
  map.plant(54, 29, 'wetRock');

  // The steading: barn and house either side of its gravel, the hut on the
  // south side, and what nobody has put away.
  map.plant(45, 33, 'barn');
  map.plant(53, 33, 'house');
  map.plant(50, 38, 'hut');
  map.plant(58, 38, 'crateStack');
  map.plant(59, 33, 'cratePair');
  map.plant(49, 34, 'crate');

  map.plant(37, 37, 'bigStump');

  // The three crossings. The plank bridge carries the west road over the
  // brook; the other two are the water itself.
  map.plant(11, 44, 'bridge');

  // The water meadows, the cairn on the common, and the burn.
  map.plant(2, 55, 'rockStair');
  map.plant(20, 54, 'boulder');
  map.plant(52, 56, 'mineMouth');
  map.plant(49, 60, 'log');
  map.plant(55, 57, 'log');
  map.plant(46, 59, 'deadStump');
  map.plant(57, 59, 'deadStump');
  map.plant(51, 61, 'deadStump');
  map.plant(35, 52, 'shrine');
  map.plant(36, 55, 'bench');
  map.plant(21, 67, 'stoneArch');







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
    'b            p     t            ',
    '                                ',
    '                                ',
    'b                               ',
    '                                ',
    '                                ',
    '                                ',
    '                                ',
    '          b                     ',
    'b   b                           ',
    '                                ',
    '                                ',
    '                                ',
    'p       t                       ',
    '                                ',
    '    b                          b',
    '          b                     ',
    '                                ',
    '       b                        ',
    'b                               ',
    '                                ',
    ' t              p               ',
    '                                ',
    '                 t      b       ',
    '                                ',
    '                                ',
    '                                ',
    '                        b       ',
    '                                ',
    '                                ',
  ]);

  return map;
}
