import { describe, expect, it } from 'vitest';
import { sketchFloodplainRelay } from './maps/floodplainRelay';
import { sketchPalletTown } from './maps/palletTown';
import { sketchRoute1 } from './maps/route1';
import { sketchViridianForest } from './maps/viridianForest';

/**
 * The four raid maps exactly as they are drawn, one character per tile.
 *
 * None of these is a signed-off design. The grids that first stood here were:
 * three maps authored and measured before any of this was built, reviewed tile
 * by tile and approved as drawn. Every map has since been redrawn by hand on
 * the FireRed sheet - the Floodplain because the captain asked for the approved
 * one to be replaced outright, then Pallet Town, Route 1 and Viridian Forest in
 * the same hand - and each grid below is the drawing PROPOSED in an approved
 * one's place, pinned so that the change which proposes it is also where it is
 * reviewed tile by tile. Until the captain approves one as drawn, no grid in
 * this file is more than that.
 *
 * What the pin is for has not changed. A map file composes its picture from
 * layered blocks - the water and the forest first, each place cut out of them
 * after - which is readable and easy to nudge, and that is precisely why the
 * grid it produces is held here: a stray tile in a lane is invisible in a diff
 * of overlapping blocks and obvious in a diff of these. It is also the one
 * place a finished map can be read whole.
 *
 * Legend: `T` thicket, `.` grass, `"` mown turf, `g` tall grass, `,` trodden
 * earth, `P` paving, `M` stone, `v` gravel, `#` hedge, `C` rock, `F` fence,
 * `W` deep water, `w` a ford you can wade. A landmark stamped into a drawing is
 * pinned as the ground its letter stands on: a forest tree or a pine is the
 * tile of grass under its trunk - `.` inside a run of `T` - a tall bush is
 * thicket, and a length of the Overlook's rock bank is grass. A landmark
 * planted by name is not in the grid at all, so a bridge reads as the deep
 * water under its deck. And none of these drawings marks content any more:
 * insertions, exits, landmarks, trainers and signs are authored in their own
 * files, and `worldMap.test.ts` and `mapStructure.test.ts` hold them to this
 * ground.
 */

/**
 * Pallet Town as redrawn: the mill town on the leat, in the shipped 32x44
 * footprint, cut out of lattice forest, and NOT yet signed off. The grid that
 * stood here was the approved design - a fenced market square and a town of
 * one-tile lanes, drawn for the classic tiles - and this is the drawing
 * proposed in its place.
 *
 * One water is the whole of its shape: the millpond in the east, its race
 * running south out of it, the leat turning west across the town, and the
 * Flood the leat ends in. The leat has three crossings and the grid shows two
 * of them, the fords at either end; the bridge between them is planted.
 */
const DRAWN_PALLET_TOWN = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TT.....TT.....TTT.ggg.##.gggg.TT',
  'TT.....TT.....TT.ggTTT##gTTTg.TT',
  '.T......T......T.gg...g.g...gg.T',
  'TT............TT,,g...ggg...g..T',
  'TT............TT,,gggg.C.gggg,,T',
  '.TPPPPPPPPPPPP,,,,..ggC.ggg..,,T',
  'TTPPPPPPPPPPPP,,,,.....#.....,,T',
  'TTPPPPPPPPPPPP#TTTTTTTTTTTTTT,,T',
  '.TPPPPPPPPPPPP#TTTT........T.,,T',
  'TTPPPPPPPPPPPP#..............TTT',
  'TT###,,#######......WWWWWWW,,TTT',
  '.T""",,,,,,,,#......WWWWWWW,,,.T',
  'TT""",,,,,,,,#......WWWWWWWT,,TT',
  'TT#"""""TTT,,#......WWWWWWWT,,TT',
  'TT""""""...,,,,,,,,,WWWWWWWT,,TT',
  'TT..""""...,,,,,,,,,TTTTWW,,,,TT',
  'TT,,...ggg#,,...ggg#...gWW,,...T',
  '.T,,...ggg#,,...ggg#...gWW,,...T',
  'TT#....ggg......ggg.....WW,,...T',
  'TTggg.....###..#........WW.....T',
  '.Tggg#.##.ggg...##.g###.WW.....T',
  'TTg#g#..g.ggg#....gg..g.WWTT,,TT',
  'TTggg..gg.g#g#..#ggg..g.WWTT,,TT',
  '.T..........TTTT........WWTT,,TT',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,,,TT',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,TTTT',
  '.TWWWWWwwWWWWWWWWWWWwwWWWW,,TTTT',
  'TTWWWWW..gg#TTTTTTTT..MMMMMTTTTT',
  'TTWWWWW..ggFF.FFFTTT..MMMMMTTTTT',
  '.TWWWWW##ggg#,,TT.FFFFMMMMM#TTTT',
  'TTWWWWWgggg.#,,#TTgggg.gggg.TTTT',
  'TTWWWWWgCgg.#,,,,#gggg.gggg.TTTT',
  '.TWWWWWgggC.g,,,,FFF.F.FF.F.TTTT',
  'TTT....ggg#g###,,#gggg.gg...TTTT',
  'TTT....g.gg####,,....#..gg.TTTTT',
  'TTTTT......TTT#,,......TTTTTT.TT',
  'TTTTTTTTTTTTTT.,,.TTTTTTTTTTTTTT',
  'TT.TTTTTTTTT.T.,,.TTTTTTTT.TT.TT',
  'TTTTTTTTTTTTTT.,,.TTTTTTTTTTTTTT',
  'TT.TT.TT.TTTTTT,,TTTTTT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/**
 * Route 1 as redrawn: the braid, in the shipped 32x32 footprint, and NOT yet
 * signed off. It had no grid here while it was built out of polylines, so
 * there is no approved drawing it replaces; it is pinned now for the reason
 * the others are.
 *
 * Two roads run from the Route Head to the Outpost apron with the Meadows
 * between them, the fenced Middle Field in the middle of those, and Oak's
 * Field Station in the east under the rock bank the Overlook stands on.
 */
const DRAWN_ROUTE_1 = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.T.T...T.TTTTTTT....T',
  'TTTTTTTTTTTTTT.....TTTTTTTT....T',
  'TT.TT.TT.TT.TT,,,,,,,,,,TTT....T',
  'TTTTTTTT,,,,,,,,,T,,,,,,TTT....T',
  'TT.TT.TT,,gggggTTTTTTT,,TTT....T',
  'TTTTTTTT,,TggTTTgggTTT,,..T....T',
  'TT.TT.TT,,Tgg...ggggggg,TTTFFCFT',
  'TTTTT,,,,,Tg.....ggT,,,,TT...C.T',
  'TT.TT,,,,,Tgggg.gCgg,,,,T......T',
  'TTTTT,,TTTTgggg.gggT,,TTT......T',
  'TT.TT,,gggggggCggggT,,TTT......T',
  'TTggg,,TTTTFF.FFF.FF,,TTT......T',
  'TTgg.,,TTTT#ggg.ggg#,,TTT......T',
  '.TTTT,,T.TT#g.gggCg#,,,,TPPPP..T',
  'TTTTT,,,,,T#gggg.gg#,,,,,PPPPP.T',
  'TTTTT,,,,,T#gg.gggg#TT,,TPPPPP.T',
  'TT.TTTTT,,TFFFFF.FFFTT,,TTTTTTTT',
  'TTTTTTTT,,Tggggg.ggTTT,,TTTTTTTT',
  'TT.TT.TT,,gggg.gTggggg,,TTTTTTTT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTT',
  'T.T,,,,,,,TTTTTT.TTT,,TTTTTTTTTT',
  'TTT,,,,,,,TTTTTTTTTT,,TTTTTTTTTT',
  'TTT,,T,,TTTTTTTTT.TT,,,,TTTTTTTT',
  'TTT,,T,,TT,,,,PPPPPT,,,,TT.TT.TT',
  'TTT,,T,,TT,,,,PPPPPTTT,,TTTTTTTT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TT.TT.TT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TTTTTTTT',
  'TTTTTTTTTTTTTTTTPPTTTTTTTT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/**
 * Floodplain Relay as redrawn: a 64x64 river town cut out of solid forest, and
 * NOT yet signed off. The grid that stood here was the approved 32x32 design,
 * which the captain has since asked to be replaced outright; this is the
 * drawing proposed in its place, and the first of the four to be redrawn - the
 * other three are in its hand.
 */
const DRAWN_FLOODPLAIN_RELAY = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTT...TTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTTT...TTTTT.TT.TT.TT',
  'TTTTTTTTTTT,,,,#######,,,,TTTTTTTTTTTTTTWWWTTTT...TCCTCCCCTTTTTT',
  'T.TT.TT.TTT,,,,#######,,,,TT.TT.TT.TT.TTWWWT.TT...CMMMMMMC.TT.TT',
  'TTTTTTTTTTT,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMCTTTTTT',
  'T.TT.TT.T.T,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMT.TT.TT',
  'TTTTTTTTT,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWTTTM...CMMMMMMCTTTTTT',
  'T.TT.TT.T,,,,,,,,,,,,,,,,,,MMMWWWWWWMMMMWWWTTTMMMMMMMMTCTT.TT.TT',
  'TTTTTTTTT,,TT,,,,,TT,,,,,,,MMMWWWWWWMMMMWWW.TTTTMTMMTTTTTTTTTTTT',
  'T.TT.TT.T,,.TTTTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTT.TTTMMTTT.TT.TT.TT',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTTTT.TMM.TTTTTTTTTTT',
  'T.TT.TT.T,,T..TT.TT.TT.TT.TWWWWWWWWWWWWWWWW.TTMMMMMMTTT.TT.TT.TT',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTMMMTTTTTTTTTTTTTTT',
  'T.TT.TT.T,,,,,,,,,T.TT.TT.TWWWWWWWWWWWWWWWWTTTMMMTTT.TT.TT.TT.TT',
  'TTTTggg....Cgg..,,,,TTTTTTTWWWTTTTTTTTTTWWWTTTMMMTTTTTTTTTTTTTTT',
  'T.TgggggCggggg..T,,,,,,,,,TWWWTTTTTTTTTTWWW.TTMMMTTTWWWWWWWTT.TT',
  'TTTgggggWWWgggg.C,,,,,,,,,TWWWTTTTTTTTTTWWWTTTMMMTTTWWWWWWWTTTTT',
  'T.TTggggWWW.ggggCggT...,,.CWWWT.TT.TTTTTWWWWWWMMMWWWWWWWWWWTT.TT',
  'TTTTT.gWW.gg...ggggTTC.,,.TWWWTTTTTTTTTTWWWWWWMMMWWWWWWWWWWTTTTT',
  'T.TTggWWWWWWWWWWWWWTTT,TTTTWWWT.TT.T,,,,,,,,,T,,,,,TWWWWWWWTT.TT',
  'TTTT..WWWWWWWWWWWWWgTT,TTTTWWWTTTTTT,,TTTTT,,,,,,,,TWWWWWWWTTTTT',
  'T.TT..ggCgggg..Cgggg.T,TT.TWWWT.TTTT,,,TTTTT,TTTT,,TWWWWWWWTT.TT',
  'TTTTggggggCggggggggT,,,,,,TWWWTTTTTT,,,TTTTT,TTTT........TTTTTTT',
  'T.TTgggggCggggCggggg...T,,TWWWT.TTTT,,TTTTT,,TTTT........TTTT.TT',
  'TTTTTT,TTTTTTTTTTTTTgggg,,TWWWTT,,,,,,TTTTT,TT.TT........TTTTTTT',
  'T.TT.T,TTT.TT.TT.TTTTTT,,,TWWWTT,,,TTTTT.TT,,,,TT........T.TT.TT',
  'TTTTTT,.TTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTT,,TT........TTTTTTT',
  'T.T,,,,TTT.TT.TT.TTWWWWWWWWWWWWWWWWWWWWWWTT.T,,,,,,,,,,TTT.TT.TT',
  'TTT,TTTT..........TWWWWWWWWWWWWWWWWWWWWWWTTTT#"#"#"#"#"#"TTTTTTT',
  'T.T,T.TT..........TWWW.,,,,####,,,,,TTWWWTT.TTT,,,,,,,,,,T.TT.TT',
  'TTT,,,,T..........TWWW.,,,,####,,,,,TTWWWTT,,"#"#"#"#"#"#TTTTTTT',
  'T.TTTT,T..........TWWW..PPPPPPPPPPPPTTWWWTT,T,,,,,,,,,,TTT.TT.TT',
  'TTTTTT,T..........TWWW#.PPPPPPPPPPPP.TWWWTT,T#"#"#"#"#"#"TTTTTTT',
  'T.TT.T,,##P##PPPPPPWWW#.PPPPPPPPPPPPTTWWWTT,TTT,,,,,,,,,,T.TT.TT',
  'TTTTTT,PPPP...wwwwCwww,,PPPPPPPPPPPP,,WWW,,,T"#"#"#"#"#"#TTTTTTT',
  'T.TT.T,PPPP...wwwwwwww,,PPPPPPPPPPPP,,WWWTTTT,,,,,,,,,,TTT.TT.TT',
  'TTTTTTTPPPPPPPPPwwPWWW#.PPPPPPPPPPPP.#WWWTT.T#"#"#"#"#"#"TTTTTTT',
  'T.TT.TTTwwwwwwwwwwTWWWTTTTTTTTTTTTTTTTWWWTTTTTT,,,,,,,,,,T.TT.TT',
  'TTTTTTTTwwwwwwwwCwTWWWTTTTTTTTTTTTTTTTWWWTTTT"#"#"#"#"#"#TTTTTTT',
  'T.TT.TTTwwwwwwwwPPTWWW.TT.TT.TT.TT.TTTWWWTT.T,,,,,,,,,,TTT.TT.TT',
  'TTTTTTTTwwwwwwwwPPTWWWTgddddddddTTTT.TWWWTTTTTTTTTTTT,,TTTTTTTTT',
  'T.TT.TTTTTTTTTTTPCTWWWggdddWWWWWWWWWWWWWWTT.TTTTTTTTT,,TTTTTT.TT',
  'TTTTTTTTTTTTTTTTPPTWWWWWWWWWWWWWWWWWWWWWWFFFFFFFFFFFF,,FFFFFFTTT',
  'T.TT.TT.TTTTT.TTPPTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTT,,TTT.TT.TT',
  'TTTTTTTTTTTTTTTTPP,ggggCgggggTWWWTggggCgggTTTTTTTTTTT,,TTTTTTTTT',
  'T.TT.TT.TT.TTTPPPPTggggggggggTWWWTggggCgggTTTTTTTT,,,,,TTTTTT.TT',
  'TTTTTTTTTTTTTTPPTTTTTTTT..TTTTWWWTT,,,,,,,,,TTTTTT,,TTTTTTTTTTTT',
  'T.TT.T.....T.TPPTTT.TT.T..TT.TWWW.TT,TTTTTCMMMMMv,,,TTTTTT.TT.TT',
  'TTTTTT.....TTTPP,,,,,,,T..TTTTWWWTTT,TTTTTvMMMMMvTTTTTTTTTTTTTTT',
  'T.TT.T.....TTTPPTTTT,,TT,,TT.TWWWT.T,.TT.TvMMMMMvTTT.TT.TT.TT.TT',
  'TTTTTT......TTPPTTTT,,,,,,,,,TWWWTT,,,,,,,vvvvvvvTTTTTTTTTTTTTTT',
  'T.TT.T.....TTTPPT.TTTTTTT,,,,MMMMMMTT,,TTTTT,,TTTTTT.TT.TT.TT.TT',
  'TTTTTTTPPPPPPPPPPTTTTTTTTTTTTMMMMMM,,,,T.TTT,,TTTTTTTTTTTTTTTTTT',
  'T.TT.TTTTTTTTTTPPPPTTT.TT.TTTTWWWTTTT,,,,,,,,,.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTPPTTTTTTTT.TTWWWTTTTTTTTgWWWWWWTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TTTPPTTT.TT.TTTTWWWTTTT.TTTgWWWWWWgTTT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTPPTTTTTTTTTTTWWWTTTTTTTTggggggggTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TTTPPTTT.TT.TT.TWWWT.TT.TTTTTTTTTTTTTT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TTTTTTTTTTT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/**
 * Viridian Forest, four times the footprint it shipped in - 64x72 - and NOT yet
 * signed off. The approved design's clearings and one-tile trails are kept
 * where they were, so this is the nearest of the four to a drawing that was
 * signed off - but the wood they are cut from is new, and so are the glade
 * under the fire tower, the rock stair in the north-east, the pool in the east
 * and the brook down the west edge with the ford in it, and none of that has
 * been approved. Nor has what a stranger's memory test added since: the earth
 * cross at the Crossroads, the rim ground the Hollow's and the Cut's stumps
 * stand on, the East Rise's ledge, and the Deep Stand's closed south-west nub.
 *
 * Newest of all, and the one piece of this map that is not forest: THE RIDGE,
 * the rock shelf along the top of the wood from the nub at the fire tower's
 * foot to the head of the Tower Steps, with the crest of it drawn as the map's
 * own north edge. It is behind Lookout Pell's two doors and it is the only
 * ground in the forest with no tall grass on it.
 *
 * The north-west quarter of the grid below is the drawing that stood here
 * before, tile for tile: every clearing, every trail and every authored fact on
 * the old map is where it was, so a player who knows this forest still knows
 * it. What is new is everything east of x31 and everything south of y35 - the
 * ridge carried on to RAVEN CRAG, THE BURN, THE TARN, HORNET GLADE, THE
 * BLOWDOWN and the CHARCOAL BURN in the east; THE SAWPIT, BROOK FOOT, THE MERE,
 * THE WARREN, STONE ROW, THE HOLLOW WAY, THE QUARRY, THE LONG DRIVE, THE
 * ROOKERY, BEECH FLAT and THE SOUTH ROAD in the south - plus the four seams
 * that join the two: the firebreak east of the Tower Steps, the trail east
 * under East Rise's brow, the middle way out of The Clearing's north-east
 * corner, and the way down out of its south-east pocket.
 */
const DRAWN_VIRIDIAN_FOREST = [
  'TTTTTTTTTTTTTTT...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'TTTTTTTTTTTTTTT...TC...C....C....C....C...C..C....C....C....C..C',
  'TT.T.T....T.T.T...T..C...C.....C...C....C...C...C.......C.....CC',
  'TTTTTT....TTTTT...T.CC.C...C.C..C....C..C.C....C..C.C.C....C...C',
  'TT.TTTg.g.TTTT......CCCCC.CC...CCCCCCCCCCCCCCCCCCCCCCCCCCC...C.C',
  'TTTT.TgTgTTggg.....TTTTTT.TT...TTTTTTTTTTTTTTTTTTTTTTCCCCCC..CCC',
  'TT.TgggTgTTgTT....ggggTTT.TT...,vvvvTT.TT.TT.TT.TT.TTCCCCCC..CCC',
  'TTT.gT.TggggTT..g..TTgTTT.TT...,vvvvTTTTTTTTTTTTTTTTTCCCCCCC..CC',
  'TT..g..TTTTTTTTTgTTTTgTT.......TvvvvvvTTT.TT.TT.TT.TTCCCCCCCC.CC',
  '.T...gggTTTTT,,,,TTTTggg.WWgg..TTvvvv,vvvTTTTTTTTTTTTCCCCCCCCCCC',
  'TT.....g.TT.T,,,,T.TTTTggWW.TTTTTTvvv,,vvvvT.TT.TT.TT.TT.TT.TT.T',
  'TT...g.gggTTT,,TTTTTTTTT..g.TTTTTTvvv,,vvTvvvvTTTTTTTTTTTTTTTTTT',
  'TT.T.gTTTgT.T,,..TTTTTTTTTgTTTTTTgvvv,vTvvvvvvT.TT.TT.TT.TT.TT.T',
  'TWWTTgTTTg,,,,,,,.TTTTTTTTgggTTTTggvvvvTTvvvvvvvTTTTT~~~~TTTTTTT',
  'TWWgggT.TT,,,,,,,,gT.TT.TTTTgTTTTTgvvvTTTvvvvvvvvgTT~~WWWWW.TT.T',
  'TWWgTTTTTTTTT,,..TgTTTTTTTTTgT.TTTTvvvvTTvvvvvvvvg~~~WWWWWWWTTTT',
  'TWWggTTT.TTTT,,TTTggTTT.T.TggTTT.TTvvvvvTvvvvTvvgg~~WWWWWWWWWT.T',
  'TWW.g.TTTTTgggTTT..g.TTTTTTgTTTTTTTTgvvvvvTvvvvgTT~~WWWWWWWWWWTT',
  'TWW..gggTTTgTTT.....ggggTTTggT.T.TTTTggvvvvTTgggTT~~WWWWWWWWWW.T',
  'Tww...TgTTTgTTT......TTgTT..g.TTTTTTTTTggggggggTTTg~~WWWWWWWWWTT',
  'Tww...TgggTgTTTTT...gTTgggg...TT.TT.TTTTTTgggTTTTTTg~~WWWWWWWT.T',
  'TWWTTTTTTgTgg...TTTTgTTTTT....ggggTTTTTTTTgggTTTTTTTg~~~WWWWTTTT',
  'TWWTTTTTTgTT....TTTTgTTTTT..g..TTgT.TT.Tgg...gT.TT.TTg~~~~~~TT.T',
  'TWWTTTT.Tgggg...TTTTgggT.FFFgFFTTgggTTg.....ggTTTTTTTTg....gTTTT',
  'TWWTT.TTTTTTT.g.T.TTTTg.....g..TTTTgTTg.....gTT.TT.TTTTg..gTTT.T',
  'TWWTTTTTTTTTTTgTTTTTTggTTTgggTTTTTTggg......gTTTTTTTTTTTgggTTTTT',
  'TWWTT.TT.TT.TTggggg.TgTTTTgTTTTT.TTTTg.....ggTT.TT.TT.TTTgTTTT.T',
  'TWWTTTTTTTTTTTT.TTgTTgTggggggTTTTTTTTTg....gTTTTTTTTTTTTgggTTTTT',
  'TWWTT.TT.TT.T....Tg..gggTgggggTT.TT.TTTgg.ggTTT.TT.TTTgg...gTT.T',
  'TWWTTTTTTTTTT....T.....gggTTTgggggTTTTTTggTgggTTTTTTTgg.....gTTT',
  'TWWTT.TT.TT.T....T.....TTTTTTTTTTggTTTTgTTTTgTT.TT.Tgg..MM...gTT',
  'TWWTTTTTTTTTTgTTTT.....TTTTTTTTTTTggTTgg.g..ggTTTTTgg...MM.....T',
  'TWWTT.TT.TT.TgTT.TTTTggTTT.TT.TTTTTgggg...g..gT.TTTg....,,,...TT',
  'TWWTTTTTTgggggTTTTTTTTgTTTTTTTTTTTTTg....g...gggTTg.....,,,..gTT',
  'TWWTT.TTTTTTTTTTT.TTTggTTT.TT.TTTTTg.....g...gTggTg.....,,,.ggTT',
  'TWWTTTTTTTTTTTTTTTTTTgTTTTTTTTTTTTTg..g...g..gTTgggg....,,,.gTTT',
  'TWWTT.TT.TT.TT.TT.TTTgT.TT.TT.TTTTTgg.g...g.ggTTTTTg....,,,,gT.T',
  'TWWTTTTTTTTTTTTTTTTTTggTTTTTTTTTTTTTg.g...g.gTTTTTTgg...,,,gTTTT',
  'TWWTT...TTT.TT.TT.TTg..gTT.TT.TT.TTTgg.g.gg.gTT.TTTTgg..,,gTTT.T',
  'TWWT.....TTTTTTTTTTg....ggTTTTTTTTTTTgg.g..ggTTTTTTTTgggggTTTTTT',
  'TWWT.....ggTTT.TTTg,,,,,.gTTT.TT.TT.TTgg..ggTTT.TT.TTTTggTT.TT.T',
  'TWWT....gTgggTTTTg.,,,,,,gTTTTTTTTTTTTTgggggTTTTTTTTTTT,,TTTTTTT',
  'TWWTT...gTTTggggggg,,,,,,,gTT.TT.TT.TTTTTgTTTTT.TT.TT.T,,TT.TT.T',
  'TWWTTT..gTTTTTTTTTg,,,,,.ggggTTTTTTTTTTTggTTTTTTTTTTTTT,,TTTTTTT',
  'TWWTTTTggTT.TT.TTTTgg...gTTTgg.....TTTTggTTT.TT.TT.TT.T,,,,TTT.T',
  'TWWTTTTTTTTTTTTTTTTTg..gTTTTTg.....TTgggTTTTTTTTTTTTTTTTT,,TTTTT',
  'TWWTT.TT.TT.TT.TT.TTTgTTTT.TTCC..CCCCgCCCCTT.TT.TT.TT.TTT,,TTT.T',
  'TWWTTTTTTTTTTTTTTTTgggTTTTTTTg....ggggTTTTTTTTTTTTTTTTTTT,,TTTTT',
  'TWWWT.TT.TT.TT.TT.TgCggCTT.TTTgggTTTTgTTT.TT.TT.TT.TT.T,,,,TTT.T',
  'TWWWWTTTTTTTTTTTTgggC..CTTTTTTggTTTTTgTTTTTTTTTTTTTTTTT,,TTTTTTT',
  'TWWWWWWT.TT.TT.TTgTTC..CTT.TTTggTTT.TgTTT.TT.TT.TT.TT.T,,TT.TT.T',
  'TWWWWWWWTTTTTTTgggTTCC..CTTTTggTTTCCCgCCCCCCCCCCCTTTTTT,,TTTTTTT',
  'TWWWWWWW~gT.TTTgTTTT.C..CT.TTgTT.CCvvvvvCCCvvvvCCT.TT.T,,,,,TT.T',
  'TWWWWWW~~ggTTgggTTTTTC...gggggTTTCvvvvvvvCCvvvvvCTTTTTTTTT,,TTTT',
  'TWWWWW~~~~gTTgTTT.TT.CC..CTTTTTT.CvvCCvvvvvvvvvvCT.TT.TT.T,,TT.T',
  'TWWW~~~~~~gTggTTTTTTTTC..CTTTTTTTCvvCCCvvvvCCvvvCCTTTTTTTT,,TTTT',
  'TW~~~~~~~ggTgTTTT.TT.TC..CCTT.TT.CvvvCCvvvvCCvvvCC.TT.TT.T,,TT.T',
  'TTTT...ggg.TgTTTTTTTTTCC..CTTTTTTCvvvvCCvvvvvvvvCTTTTTTTTg..gTTT',
  'TTT.ggggg..ggT.TT.TT.TTC..CTT.TT.CCvvvCCvvvvvvvvCT.TT.TTg....gTT',
  'TTTTTgggg.ggTTTTTTTTTTTC...CTTTTTTCvvCCCvvvvCCvvCTTTTTTg.....gTT',
  'TT.Tdddd...ggT.TT.TT.TTCC..CT.TT.TCvvvCvvvvvCCvvCT.TTTg...CC.gTT',
  'TTTddddd....gTTTTTTTTTTTC..CTTTTTTCCvvvvvvvvvvvCCTTTTg...CCC.gTT',
  'TTTdddd.....gT.TT.TT.TT.TPPTT.TT.TTCCvvvCCvvvvvCTT.TTg...CC..gTT',
  'TTTTddd....ggTTTTTTTTTTTTPPTTTTTTTTTCCvvCCCvvCCTTTTTTTg.....ggTT',
  'TT.TTdd..gg.gT.TT.TT.TT.TPPTT.TT.TT.TCvCCCCCCCT.TT.TTTg....gTTTT',
  'TTTTTTg..g..gggTTTTTTTTTTPPPPPggTTTTTTgTTTTTTTTTTTTTTgg...ggTTTT',
  'TT.TTTgg..ggTTgggTgggTgggTTTPPTgggT.TggTT.TT.TT.TT.Tg...ggTTTT.T',
  'TTTTTTTggggTTTTTgggTgggTggggPPTTTgggTgTTTTTTTTTTTTTg...ggTTTTTTT',
  'TT.TT.TTTTTTTT.TTTTTTTTTTTTTPPTTTTTgg.....ggTTT.TTgg..ggTTT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTTTCCCCPPCCCCTTg......ggggTTTg..ggTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TT.TT.TT.TPPTT.TTTTgg...gggTgggggggTTT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

describe('map designs, as drawn', () => {
  it.each([
    ['Pallet Town', sketchPalletTown, DRAWN_PALLET_TOWN],
    ['Route 1', sketchRoute1, DRAWN_ROUTE_1],
    ['Floodplain Relay', sketchFloodplainRelay, DRAWN_FLOODPLAIN_RELAY],
    ['Viridian Forest', sketchViridianForest, DRAWN_VIRIDIAN_FOREST],
  ])('builds %s exactly as it was drawn', (_name, sketch, drawn) => {
    expect(sketch().toGrid()).toEqual(drawn);
  });
});
