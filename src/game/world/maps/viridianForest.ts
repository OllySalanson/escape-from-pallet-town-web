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
 * seals a clearing off from every exit - which is why Ivy the bug catcher can
 * stand in the middle of her hub and still be walked round.
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
 * Every clearing has a name, and `../districts.ts` puts each on the arrival
 * plate - but a plate is read once, so every clearing also holds the thing its
 * name says (see WHAT EACH CLEARING IS, below): a wood is the one kind of map
 * where every screen otherwise looks like the last.
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
    'TWWTTtTTtTTTTTtTTtTTtTTtTTtTTtTT',
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
  map.plant(29, 19, 'sack');
  map.plant(29, 22, 'sack');
  map.plant(18, 31, 'log');

  // == WHAT EACH CLEARING IS ===============================================
  // A stranger toured this map once and drew it from memory: the four corners
  // that hold an object - tower, stair, brook, log - came back placed, and the
  // inside came back as "a lawn with four pins in it", because every other
  // clearing was the same three plants under a different plate. A plate is
  // read once; a place is remembered because it looks like something. So each
  // named clearing that had nothing now has the thing its name says, and none
  // of it moves a trail: what is planted stands on the thicket round a
  // clearing, never in the way through it.
  //
  // THE CROSSROADS is the one place in the wood where worn ground crosses:
  // trodden earth, two wide as the sheet requires, and each arm sets off up its
  // own trail - the north one turning east for the tower as the trail does -
  // for as far as it can while every trail still ends in grass. The forest's
  // rule is that nothing is reached dry, and the arms stop short of breaking
  // it. Drawn first as a square plus, a second stranger called it a helipad:
  // a crossing has to be seen going somewhere.
  map.draw(10, 9, [
    '   ,,,, ',
    '   ,,,, ',
    '   ,,   ',
    '   ,,   ',
    ',,,,,,,,',
    ',,,,,,,,',
    '   ,,   ',
    '   ,,   ',
  ]);

  // BEETLE HOLLOW is a rotten trunk lying across the hollow with the stumps of
  // what fell round it - the log leaves the east side open, where the trails
  // pass. WARDEN'S CUT is what the warden cut: the great stump, which stood one
  // clearing south under DEEP STAND's plate and was filed here by everyone who
  // saw it anyway. It stands on the rim so that Ivy's hub keeps every way round
  // her, and alone: small stumps on that rim read as rocks, one of them
  // sitting on the head of anybody walking the east trail.
  map.draw(1, 7, [
    '  .  .',
    '     .',
    '      ',
    '     .',
    '     .',
    ' . .  ',
  ]);
  map.plant(2, 10, 'log');
  map.plant(3, 7, 'deadStump');
  map.plant(6, 7, 'stump');
  map.plant(6, 8, 'deadStump');
  map.plant(6, 10, 'stump');
  map.plant(6, 11, 'deadStump');
  map.plant(2, 12, 'stump');
  map.plant(4, 12, 'deadStump');

  map.draw(15, 18, ['..', '..']);
  map.plant(15, 18, 'bigStump');

  // EAST RISE is a rise: the sheet's ledge runs under its brow, either side of
  // the trail that climbs to it, with a rail along the top as the Overlook has.
  // The rail and the ledge stand on what was thicket, a row and two rows below
  // the clearing; without the rail it read as a brown stripe in the hedge.
  //
  // This is the one ledge in the game that may be gone over, and it is
  // authored as one in `../ledges.ts` rather than drawn: the brow at 26,22 and
  // 27,22 drops south onto the trail at row 25. Nothing here changes to allow
  // it - the ledge is solid and stays solid, which is exactly why the hunter
  // cannot follow - so the way round is still the only way *up*, and still the
  // only way anything but the player gets down.
  map.draw(23, 23, [
    '  FFF FF',
    '<===> <>',
  ]);

  // DEEP STAND is the solid stand of broadleaves south-west of its clearing -
  // what a player calls deep whatever a plate says, so `../districts.ts` puts
  // the name on it. The nub at the clearing's south-west corner ran under the
  // stand's nearest crown, which hid whoever stood on it; it is thicket again.
  map.draw(12, 24, ['T']);

  // == THE COPPICE =========================================================
  // The one clearing in this wood nobody has walked, and the only way in is
  // through the growth that closed it - the mouth of an old ride off the trail
  // below DEEP STAND, grown over shoulder high (`../gates.ts`, the CUT gate at
  // 15,27). Cut it and it stays cut, on this raid and every raid after.
  //
  // It is a **place**, not a short cut, and that was measured rather than
  // chosen: this wood is two-connected throughout, so the best a single cut
  // anywhere in it could buy is four steps and the best a run of four could buy
  // is eight (see the PR). A field move that saved eight steps of a five-minute
  // raid would be a move nobody would carry. So what Cut opens is ground -
  // twenty tiles the survey has never lit, wildlife of its own, and the
  // coppicer's store standing in the hollow.
  //
  // It is a hollow with the **haul road** running out of it, not a room: a room
  // is a pocket in which the hunter has nowhere fair to arrive (it needs five
  // walking steps from wherever you stand, `hunter.test.ts`), and this map's own
  // standard is a network of passages rather than ground. So the ride comes in
  // at the top, the hollow is four by three, and the road it was hauled out by
  // runs south and then west along the foot of the wood.
  //
  // Sealed on every side but the ride: the trail at row 26 passes over its head,
  // THE CLEARING lies one tile east of the hollow's east wall, and the road's
  // far end stops one row short of the map's own edge. Every structural rule is
  // asked of the wood with this shut and again with it open.
  //            111111 1
  //            901234 5 6
  // The hollow is dry and the road out of it is not, which is this map's own
  // rule everywhere else: a clearing is grass, a trail is tall grass, so
  // distance in this wood is priced in fights rather than steps.
  map.draw(9, 27, [
    '      . ',
    '    ....',
    '    ....',
    '    ....',
    '    g   ',
    '    g   ',
    'ggggg   ',
  ]);
  // Stools on the rim: what coppicing leaves, standing on thicket that is solid
  // either way, so the hollow keeps every one of its own tiles.
  map.plant(13, 27, 'stump');
  map.plant(17, 31, 'deadStump');
  map.plant(12, 30, 'stump');
  map.plant(9, 32, 'deadStump');

  // == THE RIDGE ===========================================================
  // The rock the fire tower is built against does not stop at the tower: it
  // runs east along the top of the wood and comes out over the head of the
  // Tower Steps. Lookout Pell holds both ends of it, so until he is beaten this
  // is the one part of the forest nobody has stood on - and it is the one part
  // with no tall grass in it, which is the whole point of it. `no dry way to
  // anywhere` is this map's pinned rule for a fresh save; the ridge is what
  // beating a boss buys, and it turns the walk from the tower to the stair it
  // lights from half a map into a dozen steps.
  //
  // Bare shelf between rock knuckles, two rows deep and never a straight run,
  // with the crest along the map's top edge and a rake of steps down into the
  // stair clearing at 25,5-25,7. The nub at 18,4, which until now was a single
  // step of ground that went nowhere, is the foot of the way up: 19,4 is the
  // gate, 25,6-25,7 the stair, and the pocket at 28,3 is the RIDGE GAP.
  //            1         2         3
  //            8901234567890 1
  map.draw(18, 0, [
    'CCCCCCCCCCCCCC',
    'TC...C....C..C',
    'T..C...C.....C',
    'T.CC.C...C.C.C',
    '..CCCCC.CC    ',
    '       .      ',
    '       .      ',
    '       .      ',
  ]);
  // The lookout's own: a signal flag on the crest, which is what the ridge is
  // for and the thing that makes it a place rather than a gap in the rocks. It
  // stands on rock that is solid either way, so it takes no ground.
  map.plant(18, 0, 'flag');

  // Four crowns felled for the ridge's sake. A crown is drawn over the figures
  // and canopy is ground a caption may not take, so a door ringed by them is a
  // door with no name on it: the stair's caption had no seat left in the whole
  // view. `tools/tileset/crowns.mts` names the offenders; these are theirs.
  map.draw(23, 6, ['T']);
  map.draw(20, 12, ['T']);
  map.draw(29, 12, ['T']);

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
    '        p         t             ',
    '                                ',
    '                               b',
    '                 p              ',
    '       t                        ',
    'b                             t ',
    '                         p      ',
    '      b                         ',
    '                              t ',
    '                                ',
    '            b                   ',
    '                                ',
    '                b             p ',
    '       p           b    t       ',
    'b  b                            ',
    '                                ',
    '                   p            ',
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
