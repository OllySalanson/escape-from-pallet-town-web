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

  // == THE WOOD THE NEW GROUND IS CUT OUT OF ===============================
  // The forest carried on east and south of the old footprint, and until now
  // the map simply stopped at it. These are the two strips of lattice the rest
  // of this file carves: the same thicket with a broadleaf on every third
  // column of every second row that the north-west quarter is cut from, laid
  // so the rows line up across the seam - a wood does not change its planting
  // at a map boundary nobody drew.
  //
  // Everything after this block takes ground *away* from the wood. Nothing is
  // built up out of blocks that have to meet, which is what stops a walkable
  // seam appearing down a join (see `../mapGrid.ts`). Three trees are missing
  // from the first column: the old drawing already stands a tall bush at x31 on
  // those rows, and a broadleaf drawn over a bush is two plants in one tile.
  //            3         4         5         6
  //            23456789012345678901234567890123
  map.draw(32, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'tTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);
  //            0         1         2         3
  //            01234567890123456789012345678901
  map.draw(0, 36, [
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
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
  // either way, so the hollow keeps every one of its own tiles. The pair at the
  // mouth belongs to the door rather than to the drawing - see `../gates.ts` -
  // because they are what makes the growth between them read as a way through.
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

  // ========================================================================
  // ==  THE EAST WOOD                                                     ==
  // ========================================================================

  // == CINDER RIDGE ========================================================
  // The rock does not stop at the Tower Steps. It runs the whole top of the
  // wood, and everything said about THE RIDGE holds the length of it: two rows
  // of bare shelf between knuckles, the crest drawn as the map's own north
  // edge, and not one tile of tall grass. Beating the lookout used to buy a
  // dozen steps between two doors; now it buys the only dry road in a forest
  // twice as wide, and the one place you can look down on ground you have not
  // walked yet.
  //            3         4         5
  //            1234567890123456789012
  map.draw(31, 0, [
    'CCCCCCCCCCCCCCCCCCCCCC',
    '..C....C...C..C....C..',
    'C...C....C...C...C....',
    '.C....C..C.C....C..C.C',
    'CCCCCCCCCCCCCCCCCCCCCC',
    '                      ',
  ]);

  // == RAVEN CRAG ==========================================================
  // Where the shelf ends: a head of rock standing out over the east wood, and
  // the far end of the longest walk in the game that costs no fights. The path
  // off it is a notch in the point (`../extractionPoints.ts`, CRAG PATH) - the
  // ridge is a road with a door at each end and no way down in between, so
  // dropping in on it is a raid played entirely above the forest.
  //            5         6
  //            34567890123
  map.draw(53, 0, [
    'CCCCCCCCCCC',
    '..C....C..C',
    '...C.....CC',
    '.C....C...C',
    'CCCCC...C.C',
    'CCCCCC..CCC',
    'CCCCCC..CCC',
    'CCCCCCC..CC',
    'CCCCCCCC.CC',
    'CCCCCCCCCCC',
  ]);

  // == THE BURN ============================================================
  // Why there is a fire tower. The east of this wood went up a generation ago
  // and has not closed since: bare earth where the fire ran, ash gravel lying
  // in the hollows, the black snags still standing in it, and bramble coming
  // back along the south edge where the wood is winning. It is the one part of
  // this forest you can see across, which after twenty clearings the size of a
  // room is the whole point of it.
  //
  // The way in is the firebreak east out of the Tower Steps clearing and
  // nothing else: unburnt wood on every other side, and it stays a wall.
  //            3         4         5
  //            2345678901234567890
  map.draw(32, 6, [
    'vvvv               ',
    'vvvv               ',
    'vvvvvv             ',
    ' vvvv,vvv          ',
    '  vvv,,vvvv        ',
    '  vvv,,vv vvvv     ',
    ' gvvv,v vvvvvv     ',
    ' ggvvvv  vvvvvvv   ',
    '  gvvv   vvvvvvvvv ',
    '   vvvv  vvvvvvvvg ',
    '   vvvvv vvvv vvg  ',
    '    gvvvvv vvvvg   ',
    '     ggvvvv  ggg   ',
    '       gggggggg    ',
    '          ggg      ',
  ]);
  // The firebreak somebody cut and failed to hold: two rows, as this sheet's
  // earth has to be, joining the burn to the  ower Steps clearing.
  map.draw(31, 6, [',', ',']);
  // The snags. A burn is open ground with dead trees standing in it - and that
  // is also what keeps it from being the one field on a map whose whole rule is
  // that it has none, so the picture and the structure are the same decision.
  map.plant(35, 11, 'deadStump');
  map.plant(37, 13, 'deadStump');
  map.plant(41, 10, 'deadStump');
  map.plant(44, 13, 'deadStump');
  map.plant(39, 16, 'deadStump');
  map.plant(46, 15, 'deadStump');

  // == THE TARN ============================================================
  // Still black water under the trees, and the one thing in this forest that
  // is not a clearing, a trail or a rock. The wood stands to the waterline on
  // the east side and there is no way round it: you come in over the shingle
  // at the north cove, walk the west shore, and leave by the bay at the foot.
  // A tarn is a landmark you steer by precisely because you cannot cross it.
  //            4         5         6
  //            901234567890123456789012
  map.draw(49, 12, [
    '               ',
    '    ~~~~       ',
    'g  ~~WWWWW     ',
    'g~~~WWWWWWW    ',
    'g~~WWWWWWWWW   ',
    ' ~~WWWWWWWWWW  ',
    ' ~~WWWWWWWWWW  ',
    ' g~~WWWWWWWWW  ',
    '  g~~WWWWWWW   ',
    '   g~~~WWWW    ',
    '    g~~~~~~    ',
    '     g....g    ',
    '      g..g     ',
    '       ggg     ',
    '        g      ',
  ]);

  // == HORNET GLADE ========================================================
  // The one clearing in the east wood, and the reason the burn has a south
  // door. A split oak went over in it and never rotted; what lives in it now
  // is in `../districts.ts`. Two trails leave the foot rather than one, which
  // is what keeps this a junction rather than a room.
  //            3         4
  //            67890123456
  map.draw(36, 21, [
    '      ggg  ',
    '    gg...g ',
    '  g.....gg ',
    '  g.....g  ',
    ' g......g  ',
    ' g.....gg  ',
    '  g....g   ',
    '   gg.gg   ',
    '    gg ggg ',
    '   g    g  ',
  ]);
  map.plant(41, 24, 'bigStump');
  map.plant(39, 26, 'log');
  map.plant(43, 22, 'stump');

  // == THE SEAMS INTO THE OLD WOOD =========================================
  // Two more ways east, so the burn's firebreak is not the only one and the
  // east wood is a part of this forest rather than a wing off it. The first
  // leaves EAST RISE under its brow; the second winds out of THE CLEARING's
  // north-east corner, turning twice, because a trail in this wood never runs
  // more than a few steps before it turns.
  //            3
  //            01234567
  map.draw(30, 21, [
    'gggg    ',
    '   g    ',
    '   ggg  ',
    '     g  ',
    '     gg ',
  ]);
  //            2         3
  //            3456789012
  map.draw(23, 27, [
    '    gg    ',
    '  ggggg   ',
    'ggg   gggg',
  ]);
  // And on into the wood: the middle way east, which is what stops the burn's
  // firebreak being the only door between the old forest and the new.
  //            3
  //            234567
  map.draw(32, 29, [
    'gg    ',
    ' gg   ',
    '  gg  ',
    '   gg ',
    '    g ',
  ]);

  // == THE BLOWDOWN ========================================================
  // A gale took the canopy off ten acres of this wood and the timber was never
  // taken out. What is left is the one place in Viridian you cannot walk in a
  // straight line for other than the usual reason: the ground is open and it is
  // full of fallen trees, so the logs are the walls and the gaps between them
  // are the map. It is drawn as a clearing and it plays as a maze.
  //            3         4
  //            334444444444
  //            345678901234
  map.draw(33, 30, [
    '      g    g   ',
    '     gg.g..gg  ',
    '    gg...g..g  ',
    '   g....g...g  ',
    '  g.....g...g  ',
    '  g..g...g..g  ',
    '  gg.g...g.gg  ',
    '   g.g...g.g   ',
    '   gg.g.gg.g   ',
    '    gg.g..gg   ',
    '     gg..gg    ',
    '      ggggg    ',
  ]);
  // The timber itself. A log lies across three tiles, so where one fell is
  // where the way round starts - these are the walls of the maze, and every one
  // of them is also the thing that stops the clearing being open ground.
  map.plant(41, 32, 'log');
  map.plant(37, 34, 'log');
  map.plant(43, 35, 'log');
  map.plant(39, 36, 'log');
  map.plant(36, 38, 'log');
  map.plant(41, 39, 'log');
  map.plant(43, 33, 'bigStump');

  // == CHARCOAL BURN =======================================================
  // Somebody still works this wood. The pitsteads are the two circles of burnt
  // ground the kilns stood on, the yard between them is beaten earth, and the
  // hut, the stacked cordwood and the sacks are what a collier leaves between
  // burns. It is the only place in this forest that is *kept*, which is what
  // makes it worth dropping into and worth walking to.
  //            4         5         6
  //            890123456789012
  map.draw(48, 27, [
    '        ggg    ',
    '      gg...g   ',
    '     gg.....g  ',
    '    gg..MM...g ',
    '   gg...MM.... ',
    '   g....,,,... ',
    '  g.....,,,..g ',
    '  g.....,,,.gg ',
    '  gg....,,,.g  ',
    '   g....,,,,g  ',
    '   gg...,,,g   ',
    '    gg..,,g    ',
    '     ggggg     ',
    '       gg      ',
  ]);
  map.plant(54, 31, 'hut');
  map.plant(53, 34, 'crateStack');
  map.plant(56, 33, 'crateStack');
  map.plant(58, 34, 'sack');
  map.plant(59, 35, 'sack');
  map.plant(55, 38, 'stump');
  map.plant(51, 29, 'log');
  map.plant(58, 30, 'barrelPair');
  // A rock standing in the shallows at the foot of the tarn.
  map.plant(57, 23, 'wetRock');

  // The haul between the two: the collier's own path west to the timber.
  //            444444
  //            567890
  map.draw(45, 33, [
    'ggg   ',
    '  gg  ',
    '   ggg',
  ]);

  // ========================================================================
  // ==  THE SOUTH WOOD                                                    ==
  // ========================================================================

  // The way down out of THE CLEARING, which until the wood got bigger was a
  // two-tile pocket in its south-east corner that went nowhere.
  //            2
  //            0123
  map.draw(20, 32, [
    ' gg ',
    '  g ',
    ' gg ',
    ' g  ',
    ' g  ',
  ]);

  // == THE BROOK, CARRIED ON ===============================================
  // It used to stop at the old map's foot because the map did. It runs on down
  // the west edge and ends in the mere - which is what a brook does, and which
  // gives the whole west side of this forest one thing to steer by.
  map.draw(0, 28, [
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
    ' WW ',
  ]);

  // == BROOK FOOT ==========================================================
  // The last clearing on the brook before the water spreads out, and the way
  // west off the sawpit's track.
  //            0
  //            3456789012
  map.draw(3, 38, [
    '  ...     ',
    ' .....    ',
    ' .....g   ',
    ' ....g    ',
    '  ...g    ',
    '   ..g    ',
    '    gg    ',
  ]);
  map.draw(9, 40, [
    'gg       ',
    ' ggg     ',
    '   gggggg',
  ]);
  // The timber landing. The sawpit's cut went down the brook from here, and
  // what is left is what was waiting for the water the day it stopped: this is
  // the thing that makes BROOK FOOT a place rather than a clearing on the way.
  map.plant(4, 39, 'log');
  map.plant(4, 41, 'barrelPair');

  // == THE SAWPIT ==========================================================
  // Where the timber off this wood was cut up. The floor is beaten earth two
  // rows wide as the sheet requires, the saw bench still stands over the pit,
  // and the cordwood is stacked where it was left. It is the busiest-looking
  // place in the forest and nobody has been here for years.
  //            1111111222
  //            7890123456
  map.draw(17, 37, [
    '    gg    ',
    '   g..g   ',
    '  g....gg ',
    ' g,,,,,.g ',
    'g.,,,,,,g ',
    'gg,,,,,,,g',
    ' g,,,,,.g ',
    '  gg...g  ',
    '   g..g   ',
    '    g     ',
  ]);
  map.plant(21, 41, 'bigStump');
  map.plant(19, 41, 'crateStack');
  map.plant(23, 43, 'log');
  map.plant(20, 39, 'stump');

  // == THE MERE ============================================================
  // The brook's foot: still water under the trees with a shingle strand round
  // the south of it, and the plank jetty somebody floated timber off. The wood
  // stands to the waterline everywhere else, so like the tarn it is a wall you
  // steer by rather than a place you cross.
  //            0         1
  //            12345678901234
  map.draw(1, 47, [
    'WW            ',
    'WWW           ',
    'WWWW          ',
    'WWWWWW        ',
    'WWWWWWW       ',
    'WWWWWWW~g     ',
    'WWWWWW~~gg    ',
    'WWWWW~~~~g    ',
    'WWW~~~~~~g    ',
    'W~~~~~~~gg    ',
    '   ...ggg.    ',
    '   ggggg..    ',
  ]);
  map.plant(5, 55, 'jetty');
  map.plant(6, 58, 'log');
  map.plant(8, 56, 'wetRock');

  // == THE WARREN ==========================================================
  // A sand scarp in the south-west corner, riddled with burrows and standing
  // out of the wood because sand in a forest is a thing you remember. Nothing
  // here is laid: this is the bank falling away, which is why it is the one
  // ground on the map with no straight edge anywhere in it.
  //            0         1
  //            234567890123456
  map.draw(2, 59, [
    '   gggg.gg     ',
    '  dddd...gg    ',
    ' ddddd....g    ',
    ' dddd.....g    ',
    '  ddd....gg    ',
    '   dd..gg.g    ',
    '    g..g..g    ',
    '    gg..gg     ',
    '     gggg      ',
  ]);
  map.plant(4, 63, 'wetRock');
  map.plant(7, 62, 'wetRock');
  map.plant(10, 61, 'deadStump');
  map.plant(6, 65, 'deadStump');

  // == THE HOLLOW WAY ======================================================
  // A lane worn down between rock banks - two tiles wide the whole way, which
  // is the point: the hunter cannot corner anybody in it and nothing standing
  // in it is a door. It is the one route on this map you can see the whole
  // length of, and it runs from the sawpit's foot to the road out.
  //            1         2         3
  //            78901234567890
  map.draw(17, 47, [
    '    g         ',
    '   CggC       ',
    '   C..C       ',
    '   C..C       ',
    '   CC..C      ',
    '    C..C      ',
    '    C...g     ',
    '    CC..C     ',
    '     C..C     ',
    '     C..CC    ',
    '     CC..C    ',
    '      C..C    ',
    '      C...C   ',
    '      CC..C   ',
    '       C..C   ',
  ]);

  // The fork above the hollow way's head: west, the long way down to the mere
  // and the sand, turning at every other step as a trail in this wood does.
  //            1         2
  //            11111111112
  //            12345678901
  map.draw(11, 47, [
    '        ggg',
    '        g  ',
    '      ggg  ',
    '      g    ',
    '    ggg    ',
    '    g      ',
    '  ggg      ',
    '  g        ',
    ' gg        ',
    ' g         ',
    ' g         ',
    'gg         ',
  ]);

  // == THE SOUTH ROAD ======================================================
  // The made road out of the forest, and the only paving on the map. It is laid
  // two tiles wide because the sheet draws it that way, it runs out through the
  // gap in the wall at the wood's foot, and the SOUTH GATE is the one tile of
  // this map's own edge anybody may stand on.
  //            2         3
  //            2345678901234
  map.draw(22, 62, [
    '   PP        ',
    '   PP        ',
    '   PP        ',
    '   PPPPP     ',
    '      PP     ',
    '      PP     ',
    '      PP     ',
    '  CCCCPPCCCC ',
    '      PP     ',
    '      P      ',
  ]);
  map.plant(30, 66, 'signboard');

  // The way along the foot of the wood, joining the sand banks to the road: it
  // steps between two rows the whole way rather than running along one, which
  // is how every trail on this map has been drawn since the first of them.
  //            1         2
  //            111111111122222222
  //            234567890123456789
  map.draw(12, 65, [
    ' gg               ',
    '  ggg ggg ggg     ',
    '    ggg ggg gggg  ',
  ]);

  // == STONE ROW ===========================================================
  // Somebody walled this wood once. What is left of it is a line of tumbled
  // rock running east across the middle of the south, with a gateway in it and
  // one gap where the stones went. It is the only straight thing in the forest
  // and it is the thing everybody steers by: north of the wall is the sawpit
  // and the timber, south of it is the quarry.
  //            2         3         4
  //            6789012345678901234
  map.draw(26, 42, [
    'g              g   ',
    'ggg           gg   ',
    '  gg.....    gg    ',
    '   g.....  ggg     ',
    '   CC..CCCCgCCCC   ',
    '   g....gggg       ',
    '    ggg    g       ',
    '     g     g       ',
    '     g             ',
  ]);
  map.plant(35, 45, 'gravestoneWorn');

  // == THE QUARRY ==========================================================
  // Where the wall's stone came from. A bowl cut into the rock with benches
  // and spoil heaps left in it, the adit at the back, and one gateway at the
  // top - Quarryman Mott holds it (`../gates.ts`), and what beating him opens
  // is the stair down the west face onto the hollow way you walked in by.
  //            3         4         5
  //            2345678901234567890
  map.draw(32, 50, [
    '     g             ',
    '  CCCgCCCCCCCCCCC  ',
    ' CCvvvvvCCCvvvvCC  ',
    ' CvvvvvvvCCvvvvvC  ',
    ' CvvCCvvvvvvvvvvC  ',
    ' CvvCCCvvvvCCvvvCC ',
    ' CvvvCCvvvvCCvvvCC ',
    ' CvvvvCCvvvvvvvvC  ',
    ' CCvvvCCvvvvvvvvC  ',
    '  CvvCCCvvvvCCvvC  ',
    '  CvvvCvvvvvCCvvC  ',
    '  CCvvvvvvvvvvvCC  ',
    '   CCvvvCCvvvvvC   ',
    '    CCvvCCCvvCC    ',
    '     CvCCCCCCC     ',
  ]);
  map.plant(44, 61, 'mineMouth');
  map.plant(45, 55, 'wetRock');
  map.plant(35, 59, 'wetRock');

  // The trail down the wood between Stone Row and the hollow way, so the two
  // halves of the south are a ring rather than a fork: it comes out at the
  // hollow way's east door, which is the one gap in its banks.
  //            2         3
  //            567890123
  map.draw(25, 48, [
    '      g  ',
    '     gg  ',
    '     g   ',
    '    gg   ',
    '    g    ',
    'ggggg    ',
  ]);

  // And the path off the quarry stair, which is the door Mott's fall opens: it
  // drops out of the floor of the working onto Beech Flat, so the way home from
  // the deepest cache on the map is the road rather than the way you came in.
  //            33
  //            78
  map.draw(37, 65, [
    ' g',
    'gg',
    'g ',
  ]);

  // == THE LONG DRIVE ======================================================
  // A ride cut through the east wood to bring the charcoal out: two rows of
  // beaten earth, because that is the only width this sheet draws a lane at,
  // dog-legging four times on its way south so that nothing about it is a
  // straight run. It is the fastest ground in the south and the most exposed.
  //            5         6
  //            0123456789012
  map.draw(50, 41, [
    '     ,,      ',
    '     ,,      ',
    '     ,,      ',
    '     ,,,,    ',
    '       ,,    ',
    '       ,,    ',
    '       ,,    ',
    '     ,,,,    ',
    '     ,,      ',
    '     ,,      ',
    '     ,,      ',
    '     ,,,,,   ',
    '        ,,   ',
    '        ,,   ',
    '        ,,   ',
    '        ,,   ',
  ]);

  // == THE ROOKERY =========================================================
  // The south-east corner, and the last thing this wood shows you: a knuckle
  // of rock standing clear of the canopy with the birds on it. The drive comes
  // down into it from the kilns and the beech flat goes out of it west, so it
  // is a corner you pass through rather than a corner you end up in.
  //            4         5         6
  //            90123456789012
  map.draw(49, 57, [
    '        g..g  ',
    '       g....g ',
    '      g.....g ',
    '     g...CC.g ',
    '    g...CCC.g ',
    '    g...CC..g ',
    '     g.....gg ',
    '     g....g   ',
    '    gg...gg   ',
    '   g...gg     ',
    '  g...gg      ',
    ' gg..gg       ',
    ' g..gg        ',
    ' ggg          ',
  ]);
  map.plant(57, 61, 'deadStump');
  // The one beech that came down, and the reason the flat is not a lawn.
  map.plant(40, 69, 'bigStump');

  // == BEECH FLAT ==========================================================
  // Big smooth trunks and nothing under them, which after the blowdown and the
  // sand is the calmest ground on the map - and it is the spur that makes the
  // south a ring: road, flat, rookery, drive, kilns.
  //            3         4         5
  //            012345678901234567890
  map.draw(30, 65, [
    'gg                   ',
    ' ggg                 ',
    '   ggg               ',
    '     gg.....gg       ',
    '      g......gg      ',
    '       gg...ggg      ',
  ]);
  //            4444444
  //            4567890
  map.draw(44, 68, [
    '       ',
    ' gg    ',
    '  ggggg',
  ]);

  // == THE TWO NEW DOORS OUT ===============================================
  // A cart nook off the kiln yard, and the stone staith the mere's timber was
  // floated off. Both are pockets a player steps into on purpose: an open exit
  // takes whoever stands on it, so none of them may be a tile on the way to
  // anywhere (`../extractionPoints.ts`, and the rule in `mapStructure.test.ts`).
  map.draw(62, 31, ['.']);
  map.draw(3, 58, ['.']);

  return map;
}
