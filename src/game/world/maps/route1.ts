import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Route 1 - the braid.
 *
 * 32x32, the shipped footprint. Two roads leave the Route Head and run the
 * length of the map, stepping west and east as they go so that no leg of
 * either is a sprint, and meet again on the Outpost's apron. They are quick and
 * bare. Everything between them is the Meadows, and every way across is tall
 * grass, so crossing the braid is always the shorter way and always the one
 * that costs fights.
 *
 * Eight places: ROUTE HEAD (the front door, and the fork), WEST ROAD, EAST
 * ROAD, THE MEADOWS (the north meadow, the fenced middle field with its two
 * north doors, and the gap south of it where Lass June stands - one tile wide,
 * so she is both the third way across and the field's south door), OAK'S FIELD
 * STATION in its paved yard, THE OVERLOOK on the bank above it, WEST GATE
 * through its arch, and THE OUTPOST.
 *
 * The Overlook is the sealed place, and it is drawn to be looked at: it stands
 * on a bank over the station yard, fenced along its brow, in plain view of
 * anyone who walks up to the station. Warden Wren holds both its doors
 * (`../gates.ts`): the gate in the spur off the east road, and the steps down
 * the bank, choked with rock until the warden gives the place up. So the way
 * back from the Overlook lands in the yard the player already knows.
 *
 * The bank is this sheet's ledge, and nothing in this game hops down one: it
 * is only ever stood where nobody can get on top of it, with a fence along its
 * brow, so that it reads as the wall it is.
 *
 * Drawn in the Floodplain's hand; legend as `floodplainRelay.ts`, plus `<`, `=`
 * and `>` for the west end, the run and the east end of a bank.
 */
export function sketchRoute1(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 32,
    height: 32,
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


  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTTTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTTTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTTTTtTTtTTtTTtTTTTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTTTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTtTTTTTTTTTTTtTTtTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTTTTTTTTTTtTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
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
  map.plant(25, 11, 'building');
  map.plant(28, 4, 'bigStump');
  map.plant(2, 26, 'stoneArch');
  map.plant(12, 27, 'hut');
  map.plant(28, 16, 'crateStack');
  map.plant(19, 26, 'banner');







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
