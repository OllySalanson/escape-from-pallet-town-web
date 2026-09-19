import { MapSketch } from '../mapGrid';
import type { FloodTownPropName } from '../tileset/floodTownTileset';

/**
 * Viridian Forest.
 *
 * 32x36, the shipped footprint. Trees are the default, and this is the one map
 * where that is the whole design: eleven clearings joined by seventeen trails,
 * every clearing dry and every trail tall grass, so distance is priced in
 * fights rather than steps and the only question is which clearings to chain.
 * There is no fast lane. It is two-connected throughout - no one blocked tile
 * seals a clearing off from every exit - which is why Warden Ivy can stand in
 * the middle of her hub and still be walked round.
 *
 * The trails are the approved skeleton, kept tile for tile, because it already
 * was a network of passages and every authored fact on it still stands where it
 * stood. What is new is everything that says *forest*: the wood is cut from the
 * same lattice of trees as the Floodplain, and wherever the trails leave a
 * hedge too thin for a broadleaf it is planted with what fits - pines, and
 * tall bushes along the rest. The FIRE TOWER is a stone tower that stands
 * above the canopy; the brook runs down the west edge to the BROOK FORD; the
 * sap pool is a pool; and the TOWER STEPS are a stair in the rock of the east
 * ridge.
 *
 * Every clearing has a name, and until now only the design notes knew them:
 * `../districts.ts` puts each on the arrival plate, because a wood is the one
 * kind of map where every screen looks like the last.
 *
 * Legend as `floodplainRelay.ts`.
 */
export function sketchViridianForest(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: 32,
    height: 36,
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
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTTTTtTTtTTTTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTWWTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTWWTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTTTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTTTTtTTtTTtTTTTTtTTTTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTTTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TWWTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTtTTtTTtTTTTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTTTTtTTtTTtTTTTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // == THE CLEARINGS AND THE TRAILS ========================================
  // The approved skeleton, as a drawing. A clearing is grass; a trail is tall
  // grass, one tile wide, and never runs more than a few steps before it turns.
  // The column of grass at the top is the ground the fire tower stands on, the
  // pale reach in the brook is the ford, and the three tiles above the east
  // ridge's clearing are the ground under the stair.
  //            0         1         2         3
  //            01234567890123456789012345678901
  map.draw(0, 0, [
    '               ...              ',
    '               ...              ',
    '      ....     ...              ',
    '      ....     ...              ',
    '      g.g.    .....         ... ',
    '      g g  ggg.....         ... ',
    '    ggg g  g  ....gggg      ... ',
    '    g   gggg  ..g..  g      ... ',
    '  ..g.          g    g  ....... ',
    '  ...ggg      ggg    ggg.  gg.. ',
    '  .... g      g        gg  .    ',
    '  ...g ggg    g         ..g.    ',
    '     g   g   .g..         g     ',
    '     g   gggg....         ggg   ',
    '   ggg       ...ggg         g   ',
    '   g         g... g         g   ',
    '   gg        g    gg       gg   ',
    '   .g.     ggg   ..g.      g    ',
    '   ..ggg   g     ...gggg   gg   ',
    ' ww... g   g     ....  g  ..g.  ',
    ' ww... ggg g     ...g  gggg...  ',
    '         g gg...    g     ....  ',
    '         g  ....    g     ..g.  ',
    '         gggg...    ggg     g   ',
    '            ..g.      g     g   ',
    '              g      gg   ggg   ',
    '              ggggg  g    g     ',
    '                  g  g gggg     ',
    '                  g..ggg        ',
    '                  .....         ',
    '                  .....         ',
    '                  .....         ',
  ]);

  map.plant(15, 0, 'tower');
  map.plant(28, 4, 'rockStair');
  map.plant(14, 21, 'bigStump');
  map.plant(29, 19, 'sack');
  map.plant(29, 22, 'sack');
  map.plant(18, 31, 'log');





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
    'b   p        p                  ',
    '                                ',
    '                                ',
    'b   p                           ',
    '          b                     ',
    '                                ',
    '            bb                  ',
    'p                               ',
    '        p         t b           ',
    '                                ',
    '                               b',
    '                 p              ',
    '       t                        ',
    'b                             t ',
    '                         p      ',
    '      b                         ',
    '               t              t ',
    '                                ',
    '            b                   ',
    '                                ',
    '                b             p ',
    '       p           b    t       ',
    'b  b                            ',
    '                              t ',
    '                   p    t       ',
    '   b                            ',
    'b                          b    ',
    '                                ',
    '                                ',
    '                                ',
    '                p              b',
    'b                               ',
    '                                ',
    '                               b',
  ]);

  return map;
}
