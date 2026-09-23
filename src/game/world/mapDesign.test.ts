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
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T',
  'TT.....TT.....TTT.ggg.##.gggg.TTTTTTvvvvvvTTTTTTTTTTTTTTTTTTTTTT',
  'TT.....TT.....TT.ggTTT##gTTTg.TT.TTTvvvvvTTTTTT.TT.TT.TTTTT.TT.T',
  '.T......T......T.gg...g.g...gg.,,,,TvvvvvvTTTTTTTTTTTTTTTTTTTTTT',
  'TT............TT,,g...ggg...g..,,,,TvvvvvvTg.ggg.T.TT.TT.TTTTT.T',
  'TT............TT,,gggg.C.gggg,,TT,,,,,,,,TT.gg.g.TTTTTTTTTTTTTTT',
  '.TPPPPPPPPPPPP,,,,..ggC.ggg..,,TT,,,,,,,,TTgg..g.TTTT.TT.TT.TTTT',
  'TTPPPPPPPPPPPP,,,,.....#.....,,TTTTTTTT,,,,,,,,TTTTTTTTTTTTTTTTT',
  'TTPPPPPPPPPPPP#TTTTTTTTTTTTTT,,TTTTTTTT,,,,,,,,TTTTTTTTT.TTTTT.T',
  '.TPPPPPPPPPPPP#TTTT........T.,,TTTTTTTTTTTTTT,,,,,,,,TTTTTTTTTTT',
  'TTPPPPPPPPPPPP#..............TTT.TT.TTTTTTTTT,,,,,,,,TTTTTT.TT.T',
  'TT###,,#######......WWWWWWW,,TTTTTTTTTTTTTTTTTTTT,,,,,,,TTTTTTTT',
  '.T""",,,,,,,,#......WWWWWWW,,,.TTTT.TT.TT.TTTTTTT,,TTvvvvvvvvT.T',
  'TT""",,,,,,,,#......WWWWWWWT,,TTTTTTTTTTTTTTTTTTT,,TTvvCCvvvvv.T',
  'TT#"""""TTT,,#......WWWWWWWT,,TT.TT.TT.TTTTT.TT.T,,TTvCCCvvvvv.T',
  'TT""""""...,,,,,,,,,WWWWWWWT,,TTTTTTTTTTTTTT,,,,,,,TTvvvvvvTTTTT',
  'TT..""""...,,,,,,,,,TTTTWW,,,,TT.TT.TT,,,,,,,TTTTTTTTvvvvvvTTTTT',
  'TT,,...ggg#,,...ggg#...gWW,,...TTTTTTT,,ggg..TTTTTTTTvvWWWvvTTTT',
  '.T,,...ggg#,,...ggg#...gWW,,...TTTT.T.gg.Tg..TT.TT.TvvvWWWvvvT.T',
  'TT#....ggg......ggg.....WW,,...TTTTTT..g.gg.TTTTTTTTvvvWWWWvvTTT',
  'TTggg.....###..#........WW.....TTTTT.gg..g..MMMCCCCCCCvWWWWvvTTT',
  '.Tggg#.##.ggg...##.g###.WW.....TTTTT.g.WW.g.CCMCCCCCCCvvWWvvvTTT',
  'TTg#g#..g.ggg#....gg..g.WWTT,,TT.TTT..gWW..gCCMCCCCCCMvvvvvvvTTT',
  'TTggg..gg.g#g#..#ggg..g.WWTT,,TTTTTTT.g..gg.CCvvvCCvvMCvvvvvTTTT',
  '.T..........TTTT........WWTT,,TT.TTTTT.ggg.TCCvvvCCvvMCvvvvTTT.T',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,,,TTTTTTTTTTTTTTCCvvvMMMMMCvvvvTTTTT',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,TTTT.TT.TTTTTTTTCCCCCCCCCCCCvvvTTT.T',
  '.TWWWWWwwWWWWWWWWWWWwwWWWW,,TTTTTTTTTTTTTTTTTTTTTTTTTTCCvvvTTTTT',
  'TTWWWWW..gg#TTTTTTTT..MMMMM,,,,,,,,TTT.TT.TTTTT.TTTTT.TTvvvTTT.T',
  'TTWWWWW..ggFF.FFFTTT..MMMMM,,,,,,,,TTTTTTTTTTTTTTTTTTTTTCCCTTTTT',
  '.TWWWWW##ggg#,,TT.FFFFMMMMM#TTTTT,,TTT.TTTTTTTT.TT.TT.TTTTTTTT.T',
  'TTWWWWWgggg.#,,#TTgggg.gggg.TTTTT,,TTTTTTTTTTTTTTTTvvvvCCvvvvvvT',
  'TTWWWWWgCgg.#,,,,#gggg.gggg.TTTTT,,TTTTTT.TT.TT.TTTvvCCCCCCvvvvT',
  '.TWWWWWgggC.g,,,,FFF.F.FF.F.TTTTT,,,,,,TTTTTTTTTTvvvvCCCCCCvvvvT',
  'TTT....ggg#g###,,#gggg.gg...TTTTTTTTT,,TT.TTTTT.TvvvvCCCCvvvvvvT',
  'TTT....g.gg####,,....#..gg.TTTTTTTTTT,,TTTTTTTTTTvvvvvvCCvvvvvTT',
  'TTTTT......TTT#,,......TTTTTT.TT.TT.T,,,,,,T.TT.TvvvvvvvCCvvvTTT',
  'TTTTTTT..TTTTT.,,.T,,TTTTTTTTTTTTTTTTTTTT,,TTTTTTvvvvvvCvvvvTTTT',
  'TT.T.....TTT.T.,,.T,,TTTTT.TT.TTTTT.TTTTT,,,,,,TTvvvvvCCvvvTTT.T',
  'TTTT,,gWWg#TTT.,,.g,,TTTTTTTTTTTTTTTTTTTTTTTT,,TTTTvvvvvvvTTTTTT',
  'TT.T,,gWWg.TTTT,,Tg,,,,,,gTTT.TT.TTTTT.TTTTTT,,,,,,,,TTTTTTTTT.T',
  'TTTT,,g.gg#TTTTTT######,,#######TTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTT',
  'TT.T,,##WW##TTTTT#.gg.#,,#gg.g.#.TT.TTTTT.T######,,#########TT.T',
  'TTTT,,,,,,,gTTTTT#..g.#,,#.gg..#TTTTTTTTTTT#.gg.#,,#g.g..g.#TTTT',
  'TT.TWWW..,,#gT.TT#g..g.,,#g..gg#.TT.TT.TT.T#g..g#,,..g..g.g#TT.T',
  'TTTTWWWg.,,g.TTTT#.g.g#,,.g...g#TTTTTTTTTTT#.g.g#,,#.gg.g.g#TTTT',
  'TTTT#WWg.,,ggT.TT######,,#######.TTTTT.TT.T#g.gg.,,#g..g.g.#TT.T',
  'TTTT#WWg.,,g.TTTTTTTTTT,,,,,,,TTTTTTTTTTTTT#T####,,#########TTTT',
  'TT.TWW.g.,,ggT.TT.TT.TTTTTTT,,TTTTT.TTTTT.T,,,,,,,,TTTTTTTTTTT.T',
  'TTTT#####,,###TTTTTTTTTTTTTT,,vvvvvvTTTTTTT,,######TTTTTTTTTTTTT',
  'TTTT,,,,,,,ggT.TT.TT.TT.TT.T,,vvvvvvTT.TTTT,,#.g.g#TT.TT.TT.TT.T',
  'TTTT,,gg.WWggTTTTTTTTTTTTTTT,,vvvvvTTTTTTTT,,#g..g#TTTTTTTTTTTTT',
  'TT.T,,g.gWWg.T.TT.TT.TT.TT.T,,vvvvvvTTTTT.T,,..gg.#TT.TT.TT.TT.T',
  'TTTT,,gWWg.ggTTTTTTTTTTTTT,,,,vvvvTTTTTTTTT,,#g.g.#TTTTTTTTTTTTT',
  'TTTT,,gWWg.g.T.TT.TT.TT.WW,,TTTFFFFTFT.TT.T,,#..g.#TT.TT.TT.TT.T',
  'TTTT,,########TTTTTTTTTTWW,,TTTFg.ggFTTTTTT,,#g.gg#TTTTTTTTTTTTT',
  'TT.T,,,,,,,g.T.TT.TTT.g.WW,,....g.g.FTTTT.T,,,,,,,,TT.TT.TT.TT.T',
  'TTTT##WW.,,ggTTTTTTTTg..WW,,TTTF.gg.FTTTTTTTTTTTT,,,,,TTTTTTTTTT',
  'TTTT.ggWW,,g.T.TT.TTT..wwww,TTTFg..gFT.TT.TT########,,########.T',
  'TTTTgg.g.,,ggTTTTTTTT.g.WW,,TTTFFFFFFTTTTTTT#.g.g.##,,#g..g.g#TT',
  'TT.T.gg.g,,g.T.TT.TTTgg.WW,,T.TTTTTTTTTTT.TT#g.g...#,,#.g.gg.#.T',
  'TTTTg.gg.,,ggTTTTTTTTg..WW,,TTTTTTTTTTTTTTTT#.gg.g,,,,#g.g..g#TT',
  'TTTTg.g.gggWWWWWWWWWWg.g.gg.TTTT.TT.TT.TT.TT#g.g.g##,,..g.gg.#TT',
  'TTTTWWWWWwwWWWWWWWWWwwWWWWWWTTTTTTTTTTTTTTTT########,,########TT',
  'TT.TWWWWWwwWWWWWWWWWwwWWWWWWT.TT.TT.TT.TT.TTTTTTTTTT,,,,TTTTTT.T',
  'TTTTg.g.MMMMWWg.g.gg..WMMMMWTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTT',
  'TT.T.gg.MWWMg..g.Wg.gggMWWMWTTTTTTT.TT.TT.TT.TT.TT.T,,,,,,T.TT.T',
  'TTTTWWWWWWWWWWWWWWWWwwWWWWWWTTTTTTTTTTTTTTTTTTCC""""""CC"""""""T',
  'TT.TWWWWWWWWWWWWWWWWwwWWWWWWTTTTTTTTTTTTT.TT.CCC""""""CC"""""""T',
  'TTTT.gg.WWg.gg.gWWg.g.gWWg.gg.gCgg.gTTTTTTTTCC"""""""""CC""""""T',
  'TTddddFdddddddddFddddddddddFMMMMMMMCMMMMCMMMCC""C""""""CC""""""T',
  'TTdddddddddFdddddddddFddddddMMCMMMMCMCMMMMMMCCCC"""""""CC""""""T',
  'TT~~~~~~~~~C~~~~~~~~~C~~~~~~~~~C~~~~~~~C~~~~WWWWWW""""""WWWWWWWW',
  'TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

/**
 * Route 1 as redrawn and then extended: the long braid, 64x72, and NOT yet
 * signed off.
 *
 * The shipped 32x32 map is the top-left quarter of this grid and nothing
 * inside its old sealed border changes at all. Twenty-one tiles OF that border
 * do: the two south roads out of the Outpost, the grass path east out of the
 * station yard, and the Overlook's shelf, fence and bank carrying east onto
 * ground that used to be the edge of the world. Everything from row 32 down and
 * from column 32 across is new.
 *
 * Two roads run from the Route Head to the Outpost apron with the Meadows
 * between them and the fenced Middle Field in the middle of those, and Oak's
 * Field Station in the east under the rock bank the Overlook stands on. Below
 * the Outpost the same two roads become THE DROVE and THE OLD ROAD either side
 * of THE COMMON, cross THE BROOK by a plank bridge and a ford, and meet again
 * on the South Gate apron. East of the station are the walled ORCHARD, the
 * grown-shut THORN DELL, THE PADDOCKS and THE STEADING that works them; below
 * the steading's stepping stones is THE CHARCOAL BURN.
 */
const DRAWN_ROUTE_1 = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.T.T...T.TTTTTTT.....TTTC......TT.TT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTT.....TTTTTTTT...............TTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT,,,,,,,,,,TTT...............TT.TT.T......T.TT.TT.T',
  'TTTTTTTT,,,,,,,,,T,,,,,,TTT.........C.....TTTTTTT......TTTTTTTTT',
  'TT.TT.TT,,gggggTTTTTTT,,TTT......C...FFFFFTTTTTTT......T.TT.TT.T',
  'TTTTTTTT,,TggTTTgggTTT,,..T....FFFFFF.....TT..TTT......TTTTTTTTT',
  'TT.TT.TT,,Tgg...ggggggg,TTTFFCF......TTTTTTT..TTT......T.TT.TT.T',
  'TTTTT,,,,,Tg.....ggT,,,,TT...C.TTTFFFFFFFFFF.FFTTTTTTTTTTTTTTTTT',
  'TT.TT,,,,,Tgggg.gCgg,,,,T.........F...........FTTTT.TTTT.TT.TT.T',
  'TTTTT,,TTTTgggg.gggT,,TTT......TT.F...........FTTTT.TTTTTTTTTTTT',
  'TT.TT,,gggggggCggggT,,TTT......TT.............F.TT..T.TT.TT.TT.T',
  'TTggg,,TTTTFF.FFF.FF,,TTT......TTTF........TTTFTTT.TTTTTTTTTTTTT',
  'TTgg.,,TTTT#ggg.ggg#,,TTT......TTTFTTT.TTT....F.TT.TT.TT.TT.TT.T',
  '.TTTT,,T.TT#g.gggCg#,,,,TPPPP..TTTF...........FT...TTTTTTTTTTTTT',
  'TTTTT,,,,,T#gggg.gg#,,,,,PPPPP.TTTF...........FT.TTTT.TT.TT.TT.T',
  'TTTTT,,,,,T#gg.gggg#TT,,TPPPPP.TTTF...........FT.TTTTTTTTTTTTTTT',
  'TT.TTTTT,,TFFFFF.FFFTT,,TTTTTTTTTTF.TTT......."...TTT.TT.TT.TT.T',
  'TTTTTTTT,,Tggggg.ggTTT,,TTTTTTTTTTF......TTT..FT..TTTTTTTTTTTTTT',
  'TT.TT.TT,,gggg.gTggggg,,TTTTTTTT.TF...........FTT.FFFFFFFFFFFFFT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTTTTF...........FT..FgggggFgggggFT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTT.TF....PP.....FTT.ggg.ggFgggggFT',
  'T.T,,,,,,,TTTTTT.TTT,,TTTTTTTTTTTTF....PP.....FT..FgggggggggggFT',
  'TTT,,,,,,,TTTTTTTTTT,,TTTTTTTTTT.TF....PP.....FT.TFgggggFgggggFT',
  'TTT,,T,,TTTTTTTTT.TT,,,,TTTTTTTTTTFFFFFF.FFFFFFT..FFFFFFFFFFFFFT',
  'TTT,,T,,TT,,,,PPPPPT,,,,TT.TT.TT.TTTTTTT.TTTTTTT.TFgggggggggggFT',
  'TTT,,T,,TT,,,,PPPPPTTT,,TTTTTTTTTTTTTTTT..TTTTTT..Fggg.ggg.gggFT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TT.TT.TT.TT.TT.TT.TT.TTTT.ggggggggggggFT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TTTTTTTTTTTTTTTTT..TTTTT..FgggggggggggFT',
  'TTTTTT,,TTTTTTTTPPTTTT,,TT.TT.TT.TT.TT.TTT.T.TTTT.FgggggggggggFT',
  'TTTTTT,,,,TTTTTTTTTTTT,,,,TTTTTTTTTTTTTTTT.TTTTT..FFFFFFFFFFFFFT',
  'TT.TTTTT,,T.TT.TTTTT.TTT,,TTT.TT.TT.TT.TTT..TTTT..TTTTTTTTTTTTTT',
  'TTTTTTTT,,TTTTTTTTFFFFFF,,TTTTTTTTTTTTTTTTT.TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,T.TT.TT.FggggF,,TTT.TT.TT.TT.TTTT.TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTT,,TTTTTTTTFggggF,,TTTTTTTTT......TT.TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,T.TT.TT.Fggggg,,TTT.TT.TT.T....T..TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTT,,TTTTTTTTFggggF,,TTTTTTTTT......T.TTvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,,,TT.TT.FggggF,,,,T.TT.TT......T.TTvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTTTT,,TTTTTTFggggFTT,,TTTTTTT....T.T..TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TTTT,,TT.TT.FFFFFFTT,,T.TT.TT......TT.TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTTTT,,TTTTTTTTTTTTTT,,TTTTTTTTTTTT.TT.TTvT.TTTTTT..TTTTTTT',
  'TT.TT.TT.T,,TT.TT.TT.TT.TT,,,,TT.TTTTTTT.......T.TTTTTT..TTTTT.T',
  'TTTTTTTTTT,,,,TTTTTTTTTTTTTT,,..TTTT......TTTTTTTTTTTTT..TTTTTTT',
  'TT.TT.TT.TTT,,TTT.TTWWWWWWTT,,T......TTTTTTTTTTTTT.TT.T..TT.TT.T',
  'TTTTTTTTTTTTWWWWWWWWWWWWWWWWwwWWTTTTTTTTTTTTTTTTTTTTT....TTTTTTT',
  'TT.TT.TTWWWWWWWWWWWWWWWWWWWWwwWWWWWWWWWTT.TT.TT.TT.TT..TTTT.TT.T',
  'TWWWWWWWWWWWWWWWWWWWTTTTTTWWwwWWWWWWWWWWWWWWWWWTTTTTTwwWWTTTTTTT',
  'TWWWWWWWWWWW,,TTT.TT.TT.TT.T,,TTWWWWWWWWWWWWWWWWWWWWWwwWWWWWWWWT',
  'TWWWWWWWTTTT,,TTggggCgggTgTT,,TTTTTTTTTWWWWWWWWWWWWWWwwWWWWWWWWT',
  'TT.TT.TT.TTT,,,,gTggggCggg,,,,TT.TT.TT.TT.TT.TTWWWWWW..T.WWWWWWT',
  'TTTTTTTTTTTTTT,,gggCgg.ggT,,TTTTTTT....TTTTTTTTTTTTTT..TTTTTTTTT',
  'TT.TT.TT......,,T.gggCggCg,,TTTT.T......T.TT.TT.TT.TT..T.TT.TT.T',
  'TggTgggC.gTTTT,,ggCggggT.g,,TTTTT.....T.TTTTTTvvvTvvvCvvvvTvvvTT',
  'TCgggW.g.TTTTT,,CggggggggT,,..TTT.......T.TT.TvC.vvvTvCvvCvvvTTT',
  'Tg....ggTgTTTT,,ggTgggCggg,,T...T.T.....TTTTTTvvvvTvvvvCv.vTvvTT',
  'Tg....gWggT.TT,,gCg.gTggCg,,TTT........TT.TT.TCvvvvvvvvvvvCvvCTT',
  'Tg.....ggTTT,,,,gggTgggggC,,TTTTTT....TTTTTTTTvvTvvvvvvvvvv.TvTT',
  'TgW.gggCggTT,,TTggCgggTg,,,,T.TTTTTTTTTTT.TT.Tv.vvCvvvTvvvvCvvTT',
  'TgggggCggTTT,,g.CgggTggC,,TTTTTTTTTTTTTTTTTTTTvvvvvvCvvvvvvvvCTT',
  'TggCgggW.TTT,,TgggCggCgg,,TTT.TT.TT.TT.TT.TT.Tvvvvvvvv.TvvvvvvTT',
  'TggggTggggTT,,ggTggCgggT,,TTTTTTTTTTTTTTTTTTTTvCvvvvvvvvCvvTvvTT',
  'T.WggggCggTT,,gCgT.ggCgg,,TTT.TT.TT.TT.TT.TT.Tvvvv.vvTvvvvCvvTTT',
  'TgggCgggTgTT,,,,,,,,,TTT,,TTTTTTTTTTTTTTTTTT....TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT,,,,,,,,,TTT,,TTT.TT.TTT.........TTTTTTTTTTTTTTTTT.T',
  'TTTTTTTTTTTTTTTTTTTTPPPPPPPT.........TTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TTTTTTTTTTTPPPPPPP..TTTTTTTTTTTTTTTTTT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TTTTPPTTTTTTTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TTTTTTTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/**
 * Floodplain Relay as redrawn and then grown: a 128x128 river country cut out
 * of solid forest, and NOT yet signed off. The grid that stood here was the
 * approved 32x32 design, replaced at the captain's word by a 64x64 river town;
 * this is that town with four times the ground round it, and the town itself
 * is in it tile for tile - the top-left sixty-four columns of the top-left
 * sixty-four rows are the drawing that was reviewed, unchanged except where a
 * new way out of it was cut through the wood at its edge.
 */
const DRAWN_FLOODPLAIN_RELAY = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTT...TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTvvTTTTTTTTTTTTTTTTTTTTTTTTTTTMMTTTTT',
  'T.TT.TTTTT.TT.TT.TT.TT.TTTTT.TT.TT.TT.TTWWWTTTT...TTTTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTT.TT.TT.TT.TT.TT.TT.TT.TTMMT.TTT',
  'TTTTTTTTTTT,,,,#######,,,,TTTTTTTTTTTTTTWWWTTTT...TCCTCCCCTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'T.TT.TT.TTT,,,,#######,,,,TT.TT.TT.TT.TTWWWT.TT...CMMMMMMC.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'TTTTTTTTTTT,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMvCvvvvvTTTTTTTTTTTTTTTTTTTTTTTTTTTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'T.TTTTT.T.T,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMvvvCvvvTTT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTTvvvvvvvCvvvvvvvvCvvvvvvvvCvvvvT',
  'TTTTTTTTT,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWTTTM...CMMMMMMCTTvvvvCCCCCCCCCCCCCCCCCCCCCCCCCCCCvvCCCvvvCvvvvvvvvCvvvvvvvvCvvvvvvvvT',
  'TTTT.TT.T,,,,,,,,,,,,,,,,,,MMMWWWWWWMMMMWWWTTTMMMMMMMMTCTTTTvvvvvvvvvvCvvvvvCvvvvvCvvvvvCvvvvvvCvvvvvvCvvvvvvvvCvvvvvvvvCvvvvvvT',
  'TTTTTTTTT,,TT,,,,,TT,,,,,,,MMMWWWWWWMMMMWWW.TTTTMTMMTTTTTTTTvvvvvCvvvvvvvCvvvvvCvvvvvCvvvvvCvvvvvvvCvvvvvvvCvvvvvvvvCvvvvvvvvCvT',
  'T.TT.TT.T,,TTTTTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTTTTTTMMTTT.TT.TTTTT,,CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCTT""#g"#g"###"########"###"###T',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTTTTTTMM.TTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCCTT"T#g"""##TTTT#"g#"g""g"#g""gT',
  'T.TT.TT.T,,T..TT.TT.TT.TT.TWWWWWWWWWWWWWWWW.TTMMMMMMTTTTTTTTT.TT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC"""##"##g"#"####"g#"g#"g"#g""gT',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTMMMTTTTTTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC""""TTT#g""g""g#"g""g###"###"#T',
  'T.TT.TT.T,,,,,,,,,T.TT.TT.TWWWWWWWWWWWWWWWWTTTMMMTTTTTT.TT.TT.TT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC""g#TTT#g"#g""g#"##"##TTT#g""gT',
  'TTTTggg....Cgg..,,,,TTTTTTTWWWTTTTTTTTTTWWWTTTMMMTTTTTTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWvvvvvv#######""#######"g"TT#TTT"g""gT',
  'T.TgggggCggggg..T,,,,,,,,,TWWWTTTTTTTTTTWWW.TTMMMTTTWWWWWWWTTTTTvvvvvvCvvCvvvvvvvvvCvvvvvvvvvCvvv""#TT#""#TTT""g##"########"##"T',
  'TTTgggggWWWgTTT.C,,,,,,,,,TWWWTTTTTTTTTTWWWTTTMMMTTTWWWWWWWTTTTTvvvCvvvvvvvvvvvvCvvvvvCvvvvvCvvvv""#TT#""#TTT#"g""g""g#"g"TT""gT',
  'T.TTggggWWW.ggggCggT...,,.CWWWT.TT.TTTTTWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWTCCCCCCCCCCCCCCCCCMMCCCCCCC""#TT"""#"######"g#"g""g#TT#"gT',
  'TTTTT.gWW.gg...ggggTTC.,,.TWWWTTTTTTTTTTWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWTCCCCCCCCCCCCCCCCCMMCCCCCCC"#""##"##""g"TT#############"#T',
  'T.TTggWWWWWWWWWWWWWTTT,TTTTWWWT.TT.T,,,,,,,,,T,,,,,TWWWWWWW.gT.g.Tg.WW.TTTTTTTTTTTTTTTTTMMTTTTTTT""#""#""#"##""##"g#TTTT#""g""gT',
  'TTTT..WWWWWWWWWWWWWgTT,TTTTWWWTTTTTT,,TTTTT,,,,,,,,TWWWWWWW.g..g..g.WWTTTTTTTTTTTTTTTTTTMMTTTTTTT"""""#"""""g#"g#"g#TTTT#""g#"gT',
  'TTTT..ggCgggg..Cgggg.T,TT.TWWWT.TTTT,,,TTTTT,TTTT,,TWWWWWWWT.TTTTTTTWW.TTTTTTTTTTTTTTTTTMMTTTTTTT""#""#""#""g#"g#"##"########"#T',
  'TTTTggggggCggggggggT,,,,,,TWWWTTTTTT,,,TTTTT,TTTT........TT.g.Tg..g.WWTTTTTTTTTTTTTTTTTTMMTTTTTTT######"######"##"g#"g""#TTT""gT',
  'T.TTgggggCggggCggggg...T,,TWWWT.TTTT,,TTTTT,,TTTT........T..#..g.Tg.WWT..#..g..g..g#.......#..g..""g#"g""g"TT#"g#"g""g#""TTT##gT',
  'TTTTTT,TTTTTTTTTTTTTgggg,,TWWWTT,,,,,,TTTTT,TT.TT...........g.Tg.Tg.WWT..g.Tg.Tg.Tg..T..T..g.Tg..""g""g#"g#TT##g##"##"#######""T',
  'T.TTTT,TTTTTTTTTTTTTTTT,,,TWWWTT,,,TTTTT.TT,,,,TT........TTT.TTTTTTTWWWWWWWWWWWWWWWWWWWWWWWWWWW..""g#"g#"g#TT#"g""g#TTTT#""g"TTT',
  'TTTTTT,.TTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTT,,TT........TT.gT.g.Tg.TTWWWWWWWWWWWWWWWWWWWWWWWWW..##"#"##"##"##"##"####"###"##"#T',
  'T.T,,,,TTT.TT.TT.TTWWWWWWWWWWWWWWWWWWWWWWTTTT,,,,,,,,,,TTTT.g..g.Tg..g..gT.g........T..gT.g.Tg..gTTT""g#"g#"g""g#"g""g""#""g#"gT',
  'TTT,TTTT..........TWWWWWWWWWWWWWWWWWWWWWWTTTT#"#"#"#"#"#"TTT.TTT.....T.TTTTTT..TT.T.TTT...TTTTTT.TTT#"g#"g#"g#"g#"g#"#"""""g""gT',
  'T.T,TTTT..........TWWW.,,,,####,,,,,TTWWWTT.TTT,,,,,,,,,,TT.gT.g.T..Tg..gT.g..T..T..T..gT.g.Tg..g,,,T,,#gggg#g#gg"ggg#"gggg"#TTT',
  'TTT,,,,T..........TWWW.,,,,####,,,,,TTWWWTT,,"#"#"#"#"#"#TT.g..g.T..Tg..g..g..T........gT.g..g..#,,,,,,ggg#"#ggg"#ggg"gg#g"ggTTT',
  'T.TTTT,T..........TWWW..PPPPPPPPPPPPTTWWWTT,T,,,,,,,,,,TTTTTT""#""""TTT#""#""#""#TTTT#""#"""#""""WWW,,,ggg"gg#g"gggg#gggg"g#gTTT',
  'TTTTTT,T..........TWWW#.PPPPPPPPPPPP.TWWWTT,T#"#"#"#"#"#"TTTT"""""g#TTT#g"#g""g""TTTT#"#""g""g""gWWW,T,WWWWWWWPWWWWWWWWWWWWWWWWT',
  'T.TT.T,,##P###PPPPPWWW#.PPPPPPPPPPPPTTWWWTT,TTT,,,,,,,,,,T.TT""##"####"#""#""#""#TTTT##""##"##"##WWW,,,g"ggg#"gg#g"gggg"gg#g"TTT',
  'TTTTTT,PPPP...wwwwCwww,,PPPPPPPPPPPP,,WWW,,,T"#"#"#"#"#"#TTTT""#""g#"g"#g""g"#g"#TTTT#TT#"g##TTTTWWW,,,"#ggg"gg#g"gggg#gggg"gTTT',
  'TTTT.T,PPPP...wwwwwwww,,PPPPPPPPPPPP,,WWWTTTT,,,,,,,,,,TTT.TT#"#"""#"""###"###########TT#"""#TTTTWWW,,Tgggg##ggg"g#gg"ggg#"ggTTT',
  'TTTTTTTPPPPPPPPPwwPWWW#.PPPPPPPPPPPP.#WWWTTTT#"#"#"#"#"#"TTTTTT#""g""#""g""#""g#"g#"g#TT#"g""TTTTWWW,,,WWWWWWWWWWWWWWPWWWWWWWWWT',
  'T.TT.TTTwwwwwwwwwwTWWWTTTTTTTTTTTTTTTTWWWTTTTTT,,,,,,,,,,C.,,,,#,####,##,,,#,,,#,,,,,,,,,,#,#####WWW,,,g#"ggg""gg#g"gggg#ggggTTT',
  'TTTTTTTTwwwwwwwwCwTWWWTTTTTTTTTTTTTTTTWWWTTTT"#"#"#"#"#",,,,,C,,,,,,,,,#,,,#,,,#,,#,,#,,#,,,#,,,,WWWT,,g"gggg#gggg"##gg"ggg#"TTT',
  'T.TT.TTTwwwwwwwwPPTWWW.TT.TT.TT.TT.TTTWWWTT.T,,,,,,,,,,TTTTTT""#""""#""#""""""""""#""#""#""""""""WWW,,,WWWWWWWWWWWWWWWWWWWWWPWWT',
  'TTTTTTTTwwwwwwwwPPTWWWTgddddddddTTTT.TWWWTTTTTTTTTTTT,,TTTTTT"""""g"#g"###"#####"#""###"##"#"g""gWWW,,,gggg"#ggg"gg#g"gggg#ggTTT',
  'T.TT.TTTTTTTTTTTPCTWWWggdddWWWWWWWWWWWWWWTT.TTTTTTTTT,,TTTTTT###"#######""""#TT#""#TT#""#TTT##"#"WWW,T,ggg"gggg#gggg"g#gg"#ggTTT',
  'TTTTTTTTTTTTTTTTPPTWWWWWWWWWWWWWWWWWWWWWWFFFFFFFFFFFF,,FFFFFFPP#PPPPPPP#PP#""g#""#TTTT#""""g""#"PPPPC,,gg"g#gg"ggg#"gggg"##ggTTT',
  'T.TT.TT.TTTTT.TTPPTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTT,,TTT.TTPP#PPPP#PP#PP#""""g""""""""""#""g#"PPPPC,,#"gggg"#ggg"gg#g"gggg#TTT',
  'TTTTTTTTTTTTTTTTPP,ggggCgggggTWWWTggggCgggTTTTTTTTTTT,,TTTTTTP####P#PPPPPP#"""#""#TT"T##"##"##""#WWW,,TWWWWWWWPWWWWWWWWWWWWWWWWT',
  'T.TTTTT.TT.TTTPPPPTggggggggggTWWWTggggCgggTTTTTTTT,,,,,TTTTTTPP#PPPP###P#######"####"##TTT#"""#""WWW,,,gggg"##gg"ggg#"gggg"ggTTT',
  'TTTTTTTTTTTTTTPPTTTTTTTT..TTTTWWWTT,,,,,,,,,TTTTTT,,TTTTTTTTT"""g"""#"""""""""#""#"""g"TTT""g""""WWW,,,gg#"gggg"#ggg"gg#g"gggTTT',
  'T.TT.T.....T.TPPTTTTTTTT..TTTTWWWTTT,TTTTTCMMMMMv,,,TTTTTT.TT,##,,###,,#,,,,,,,,,#,,,,######,,###WWWT,,WWWWWWWWWWWWWWPWWWWWWWWWT',
  'TTTTTT.....TTTPP,,,,,,,T..TTTTWWWTTT,TTTTTvMMMMMvTTTTTTTTTTTT,,,,,,,,,,#,,#,###,#,,#,##,,,,,#,,,,WWW,,Cgggggg"g#gg"#gg#"gggg"TTT',
  'TTTT.T.....TTTPPTTTT,,TT,,TT.TWWWT.T,.TT.TvMMMMMvTTTTTT.TT.TT""g#"""###""##TTT#""#""g"#TT#"g#""""WWW,,,"#gg""gggg"#gggggg#g"gTTT',
  'TTTTTT......TTPPTTTT,,,,,,,,,TWWWTT,,,,,,,vvvvvvvTTTTTTTTTTTT"""#g""#TT#g"#TTT#g"#""""#TT#"""g"""WWW,T,#ggg"gg#g"gg#g#gggg"g#TTT',
  'T.TT.T.....TTTPPT.TTTTTTT,,,,MMMMMMTT,,TTTTT,,TTTTTT.TT.TTTTT#""#""##TT#""#"######"########"#"###WWW,,,WWWWWWWWWWWWWWWWWWWWPPWWT',
  'TTTTTTTPPPPPPPPPPTTTTTTTTTTTTMMMMMM,,,,TTTTT,,TTTTTTTTTTTTTTT"""#T"T#TT"""#"g""""#"g""#"""g""TTTTWWW,,,gg"ggg#"gggg"#ggg"gg#gTTT',
  'T.TT.TT,,TTTTTTPPPPTTT.TTTTTTTWWWTTTT,,,,,,,,,.TT.TT.TT.TT.TT"""#T..#TT#""""""#""#"""g#""#""#TTTTWWW,,Tg"gggg"gg#g"gggg#gg#g"TTT',
  'TTTTTTT,,TTTTTTTTPPTTTTTTTT.TTWWWTTTTTTTTgWWWWWWTTTTTTTTTTTTTTTTTT.#TTTTT""TTTTTTTTTTTTTTTTTTTTTTWWW,,,"gggg#gggg"g#gg"ggg#"gTTT',
  'T.TT.TT,,T.TT.TTTPPTTT.TT.TTTTWWWTTTTTTTTgWWWWWWgTTT.TT.TT.TTTTTTT..TT.TT""TTTTTTTTTTTTTTTTTTT.TTWWW,,,WWWWWWWPWWWWWWWWWWWWWWWWT',
  'TTTTTTT,,TTTTTTTTPPTTTTTTTTTTTWWWTTTTTTTTggggggggTTTTTTTTTTTTTTTTT#.TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWT,,ggg"##gg"gg#g"gggg#gggTTT',
  'T.TTTTT,,,,TT.TTTPPTTT.TT.TT.TWWWT.TT.TTTTTTTTTTTTTT.TT.TT.TT.TT.T..TT.TTTTT.TT.TT.TT.TT.TT.TT.TTWWW,,,#g"gg#g#gggg"g#gg"ggg#TTT',
  'TTTTTTTTT,,TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWW,,,WWWWWWWWWWWWWWPWWWWW"WWWT',
  'T.TT.TTTT,,TT.TTTTTTTTTTT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T..TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWW,T,"gggg"#ggg"g##g"gggg#gTTT',
  'TTTTTTTTT,,TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWW,,,gg#g"gggg#gg#g"g#gg"ggTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwww#wwwww#####ww####wwww####wwwwwwwww#wwwwwwwww#w#wwwwwwwwww#w##WWW,,,ggg"g#gg#ggg""gggg"#ggTTT',
  'TT"g"""""C,Fg""gF"g"""""g"Fg""WWWggg#gggg######gg#####gg######w##w#w#www#w##w##www##w#w#####ggw##WWW,,Tg#"gggg"#ggg#gg#g"ggggTTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWwwwwww#wwwwwwwwww##w#www#####w#ww###ww#####w###w###w######ww##w#WWW,,,WWWWWWWWWWWWWWWWWWWWWPWWT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWWw#w###ww#w####gg#gggw#w######w#######w#####w#######w####ggg###w#WWW,,,#gggg"g#gg"ggg#"gggg"#TTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWw###wwww#wwww#ww#www##w#ww###w#######w#####w#######w####wwwww#w#WWWT,,ggg#"g#gg"ggg""gg#g#ggTTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWw###gggg#gggg##w##w###w#w###gg###wggww###www######gg#####w##gwggWWW,,,ggg"gg#g"gggg#gggg"##gTTT',
  'TT"g""F"",CFg""g""g""F""g"Fg""WWWw#########w###wwwwwwwww#ww##w#####ww#####w#ww#####ww#######wwwwwWWW,,,WWWWWWWPWWWWWWWWWWWWWWWWT',
  'TTFF"FF"FF,FFF"FF"FFFFFF"FF"FFWWWgg#ggwggwgggg#gggg#gggg#gg######www#####gggwgg###wgg####w###w##wWWW,T,g"ggg#"gggg"#ggg"gg#g"TTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWw####w#####w#######w####w############w##www#ww###w###w##www##wwwWWW,,,"#gggggg#g"gggg#gggg"gTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWW##wwwwggw#########wggwgggw##w##w##w##ggww###w####wggwggwggg###ggWWW,,,WWWWWWWWWWWWWWPWWWWWWWWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWW##w###ww###########ww#www#wwww#wwwwwwww####www####ww#ww###w#w###WWW,,T#gg"ggg#"ggg#"#ggg"gg#TTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWW##w###############ww######wwwgwgg#gg#gg#####gg#####w#w####wwgw##WWW,,,gg"#ggg"gg#g#gggg#ggggTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwww######wwww###wwwwwwwwww###w###ww##w######w#####www#######w###WWW,,,g"gggg#gggg"gg#""ggg""TTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWggg######gggg####gg#w###w####wgg####ww#############g########w###WWWT,,WWWWWWWWWWWWWWWWWWWWWPWWT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWwww###wwwwwww####ww###www#####ww###############w###w####wwwww###WWW,,,gggg"#ggg"gg#g"gggg#ggTTT',
  'TT"FFFFFFF,F"FFFFFF"FF"FFFFFF"WWW##w###w##w######ww#####gg###www################ggwww#gg#ggg#w#w#WWW,,,g#g"gggg#gggg"g#gg"gggTTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWwwwwwwww######www#####ww#####www###www##w###w##ww##wwww#w###wwwwPPP,T,WWWWWWWP#WW"WgWWWWWWWWWWT',
  'TT"g""F"",C"g""gF"g""F""g""g""WWWggg#gggg######gg####gggwgg####ggwggg#gg#gggwwg#gg####gg#####g#gwPPP,,,#"ggg#"#ggg"gg#g"gggg#TTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWw####w#w######ww####www#ww####ww#www#wwwwww#ww###########w##ww##WWW,,,"gg#g"gggg#gggg"g#gg"gTTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWWggw###wgggw#######www#######www######w######w#######wgg#ggg#wwggWWW,,Tgggg"##gg"ggg#"gggg"#gTTT',
  'T,,,,,F"",,"g""gF"g""F""g""g""WWWww#####www#########ww#wwww###www####www####www#######wwwwwww##wwWWW,C,gg""gggg"#ggg"gg#g"gggTTT',
  'T,,,,,F"",,Fg""g""g""F""g"Fg""WWWgg#####ggg#########ggwggg#####ggw####gg#####gg#######w##w#w###w#WWW,,,WWWWWWWWWWWWWWPWWWWWWWWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWw###w######w##w####w##w#w#####w#w####w#######w###ww##w####ww"wwwWWWT,,g#gggg"g#gg"#gg#"gggg"TTT',
  'TTFF"FF"FF,FFF"FF"FFFFFF"FF"FFWWWgg#ggg#gggwgg#ggggww####ww######www##w######ggwggg#w#w####w"ww#gWWW,,,"ggg#"gggg"##gg"gg#g"gTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwwwwww#www#wwwwwww###############w##########ww#www#wwww###ww"w#gWWW,,,WWWWWWWWWWWWWWWWWWWWWPWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""TTTTTTTTTTWWWTT""""TTTTTTTTTT#######w#########wgg#ggg#g#ggwg######gWWW,T,ggg#gggg"g#gg"ggg#"#ggTTT',
  'TT"g""F"",,"g""gF"g""F""g""g""T.TTTTTTTTWWWTT""""TTT.TT.TTT##w##w#w#w##w#####w##w###w####www###wwWWW,,,gg"ggg#"gggg"#ggg"g#ggTTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWTTTTTTTTTTWWWTT""#"TTTTTTTTTT##ggwgggwgg#g#gwwwggw##wggw#########w#WWW,,,g"#ggg"gg#g"gggg#gggg"TTT',
  'TT"g""""",CFg""gF"g"""""g"Fg""PPTT.TT.TTWWW.T#"""TTT.TT.TT.##ww#www#ww#www###ww####ww#########ww#WWW,,TWWWWWWWPWWWWWWWWWWW"WWWWT',
  'TT"g""F"",,"g""gF"g""F""g""g""CPTTTTTTTTWWWTT""""TTTTTTTTTT##w#######w######ww###########w##w##w#WWW,,,g#gg"#gg#"gggg"#ggg"ggTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""PPTT.TT.TTWWW.T"""#TTT.TT.TT.##wwww#wwww##wwwwwwwwww###wwwwwwwww#wwWWW,,,ggg"#ggg"gg#g"gggg#gggTTT',
  'TT"FFFFFF,,F"FFFFFF"FF"FFFFFF"PPTTTTTTTTWWWTT""""TTTTTTTTTT##ggww##gg####ggg###gg#####gg#gg#ggwggWWWT,,#g"gg#g#gggg"g#gg"ggg#TTT',
  'TTPPBPP"P,,PP"PB"PP"PB"PPBPP"PPPBC"BPPPPWWWT""""""""#""""g""g"T"""""""#"""""""gT"g"TTTTT""gT"g""g""#,,,""WWWWWWWWWWWWPWWWWWWWWWT',
  'TTPPPPP"PBPBB"PP"PB"PP"PPPPP"BP"PP"PPPPPWWWT"g""gTTT#TT""g"Tg"Tg"TTTT"""TTTT""g""g""#"""""g""TTTT"TT,,,"Tggg"#ggg"gg#g"gggg#gTTT',
  'TTPBBPBBBBPPBBBBBPBBBBPBBPBBBBPBBPBPPCPPWWWT"gT"gTTTTTT""gWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTg""T,T,TT"g""TTTT""gT"gT"g"Tg""T',
  'TTBBBPP"PB"PPBBBBPP"PBBBBPBBBPP"PBBPPPPPWWWTTTTT"TTT"TT"TTWWW#WWWWWW#WWWWWW#WWWWWW#WWWWWW#WTTTTTg""T,,,TT"g""TT""""g""#""g""g""T',
  'TTBBPPP"PPPPBBBBBBB"PBBBBPBBBBPPBBBPPPCPWWWTTT""gT"g"""TTT#W################W##############TTTTTTTTT,,,TTT"TTTT"TTTTT"TT"T"TT"TT',
  'TTBBPBBBBBPBBBBBBBBPBBBBBBBBPPPBBBBPPPPPWWWTTTT"g""g""TTTTWWW#WWWWWW#WWWWWW#WWWWWW#WWWWWW#WT"gT"gT"g,,TTT"g""T""TTTTTTTT"g"TTTTT',
  'TTPC"PPPPPPPPPBBBPP"PPPPPBBBBPP"BP"BPPPCWWW.T"""TTTTTTTTT"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"gT"g""g,,,TT"g""T"""TTTTTTT"g"TTTTT',
  'TTPP"BPBBBBPBBPBBPP"PB"PPBBBBBP"BPBBCPPPWWWT"gTTTT"gTTTTTgWWW#WWWWWW#WWWWWW#WWWWWW#WWWWWW#WT"gT"gT"g,,,TT"g"""""TTTT"""""g"TTTTT',
  'TTPBBBBBBBPPPBPPPPP"PBPBPPBBPBBBBP"PPPPPWWWT"gTTTT"gTTTTTg##W################W#############""TT""TTTT,,TT"TTTTTTTT"""TTTT"TTTTTT',
  'TTBBBBBBBBBPPBPPBPBBBB"PPBPP"PBBBP"BPCPPWWWT"g"TTT"gTTTT"gWWW#WWWWWW#WWWWWW#WWWWWW#WWWWWW#WT"g""g""T,,,"""gTTTT"g""gPPPPTg"TTTTT',
  'TTBBBBBBBBBPBBPBBBBBBB"PPPPP"BBBBPBBPPPPWWWTT"TTTT"TT"TT"TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"TTTT"TT,,,"T"gTT""T""""TPPPTg""TTTT',
  'TTPBBPP"PPPPPBPPBBBBBBPBBBBBPBBBBPBBPPCPWWWT"g""gT"g""g""TWWW#WWWWWW#WWWWWW#WWWWWW#WWWWWW#WTTTT"g"Tg,T,TTT"T"gTTTT"gTTPTTTT""TTT',
  'TTPBBPBBPBBPBBPBBBBPBB"PPBPP"PBBBPBBPPPPWWWT"gT"g""gT"g"TT####################W############TT"""g""",,,TT"g""gTTTT"gT""""g"TTTTT',
  'TTPP"PBBBBBPPPPPBPP"PB"PPPPP"BBBPP"BPPPCWWWT,,,,C,,,,,,,,C,,,,,,,,C,,,,wwww#,,,,,,,,C,,,,,,,,C,,,,,,,,,C,,,,,,,,,TTTTTTTTT"T"TTT',
  'TTPP"PBBBBBPPBPPPPP"PB"PPPPP"BBBBP"BCPPPWWWTC,,,,,,,,C,,,,,,,,C,,,,,,,,#wwww,,,,C,,,,,,,,C,,,,,C,,C,,,C,,,,,C,,,,""TTTTTTg"Tg""T',
  'TTCCCCCCCCCCCCCCCCCCCCCCddCCCCCCCCCCCCCCWWWTCCCCCCCCCCCCCCCCCCCCCCCCCCCwwwwwCCCCCCCCCCCCCCCCCCCCCCCCCCCCCT"T"g""""""TTTTTg""g""T',
  'TTWWWWdddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddWWWWWWWCMMMWWWWWWWWWWWW',
  'TTWWWWWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWWWWWWMMMCWWWWWWWWWWWW',
  'TTWWWWddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWWWWWWWWMCMMWWWWWWWWWWWW',
  'T.WWWWdddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddWWWWWWWMMCMWWWWWWWWWWWW',
  'TTWWWWddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWWWWWWWWCMMMWWWWWWWWWWWW',
  'T.WWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWwWWWWWWWWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWMddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWddddddWWWWWWWMMMCWWWWWWWWWWWW',
  'T.WWWWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddddddWdddWWWWWWWMCMMWWWWWWWWWWWW',
  'TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
  'TT.....g.TT.T,,,,T.TTTTggWW.TTTTTTvvv,,vvvvT.TT.TT.TT.TT.TT.TTTT',
  'TT...g.gggTTT,,TTTTTTTTT..g.TTTTTTvvv,,vvTvvvvTTTTTTTTTTTTTTTTTT',
  'TT.T.gTTTgT.T,,..TTTTTTTTTgTTTTTTgvvv,vTvvvvvvT.TT.TT.TT.TT.TT.T',
  'TWWTTgTTTg,,,,,,,.TTTTTTTTgggTTTTggvvvvTTvvvvvvvTTTTT~~~~TTTTTTT',
  'TWWgggT.TT,,,,,,,,gT.TT.TTTTgTTTTTgvvvTTTvvvvvvvvgTT~~WWWWW.TT.T',
  'TWWgTTTTTTTTT,,..TgTTTTTTTTTgT.TTTTvvvvTTvvvvvvvvg~~~WWWWWWWTTTT',
  'TWWggTTTTTTTT,,TTTggTTT.T.TggTTT.TTvvvvvTvvvvTvvgg~~WWWWWWWWWT.T',
  'TWW.g.TTTTTgggTTT..g.TTTTTTgTTTTTTTTgvvvvvTvvvvgTT~~WWWWWWWWWWTT',
  'TWW..gggTTTgTTT.....ggggTTTggT.T.TTTTggvvvvTTgggTT~~WWWWWWWWWW.T',
  'Tww...TgTTTgTTT......TTgTT..g.TTTTTTTTTggggggggTTTg~~WWWWWWWWWTT',
  'Tww...TgggTgTTTTT...gTTgggg...TT.TT.TTTTTTgggTTTTTTg~~WWWWWWWT.T',
  'TWWTTTTTTgTgg...TTTTgTTTTT....ggggTTTTTTTTgggTTTTTTTg~~~WWWWTTTT',
  'TWWTTTTTTgTT....TTTTgTTTTT..g..TTgT.TT.Tgg...gT.TTTTTg~~~~~~TT.T',
  'TWWTTTT.Tgggg...TTTTgggT.FFFgFFTTgggTTg.....ggTTTTTTTTg....gTTTT',
  'TWWTT.TTTTTTT.g.T.TTTTg.....g..TTTTgTTg.....gTT.TT.TTTTg..gTTT.T',
  'TWWTTTTTTTTTTTgTTTTTTggTTTgggTTTTTTggg......gTTTTTTTTTTTgggTTTTT',
  'TWWTT.TT.TTTTTggggg.TgTTTTgTTTTT.TTTTg.....ggTT.TT.TT.TTTgTTTT.T',
  'TWWTTTTTTTTTTTT.TTgTTgTggggggTTTTTTTTTg....gTTTTTTTTTTTTgggTTTTT',
  'TWWTT.TT.TT.T....Tg..gggTgggggTT.TT.TTTgg.ggTTT.TT.TTTgg...gTT.T',
  'TWWTTTTTTTTTT....T.....gggTTTgggggTTTTTTggTgggTTTTTTTgg.....gTTT',
  'TWWTT.TT.TT.T....T.....TTTTTTTTTTggTTTTgTTTTgTT.TT.Tgg..MM...gTT',
  'TWWTTTTTTTTTTgTTTT.....TTTTTTTTTTTggTTgg.g..ggTTTTTgg...MM.....T',
  'TWWTT.TT.TT.TgTTTTTTTggTTT.TT.TTTTTgggg...g..gT.TTTg....,,,...TT',
  'TWWTTTTTTgggggTTTTTTTTgTTTTTTTTTTTTTg....g...gggTTg.....,,,..gTT',
  'TWWTT.TTTTTTTTTTT.TTTggTTT.TT.TTTTTg.....g...gTggTg.....,,,.ggTT',
  'TWWTTTTTTTTTTTTTTTTTTgTTTTTTTTTTTTTg..g...g..gTTgggg....,,,.gTTT',
  'TWWTT.TT.TT.TT.TT.TTTgTTTT.TT.TTTTTgg.g...g.ggTTTTTg....,,,,gTTT',
  'TWWTTTTTTTTTTTTTTTTTTggTTTTTTTTTTTTTg.g...g.gTTTTTTgg...,,,gTTTT',
  'TWWTT...TTT.TT.TT.TTg..gTT.TT.TT.TTTgg.g.gg.gTT.TTTTgg..,,gTTT.T',
  'TWWT.....TTTTTTTTTTg....ggTTTTTTTTTTTgg.g..ggTTTTTTTTgggggTTTTTT',
  'TWWT.....ggTTT.TTTg,,,,,.gTTT.TT.TTTTTgg..ggTTT.TT.TTTTggTTTTT.T',
  'TWWT....gTgggTTTTg.,,,,,,gTTTTTTTTTTTTTgggggTTTTTTTTTTT,,TTTTTTT',
  'TWWTT...gTTTggggggg,,,,,,,gTT.TT.TT.TTTTTgTTTTT.TT.TT.T,,TT.TT.T',
  'TWWTTT..gTTTTTTTTTg,,,,,.ggggTTTTTTTTTTTggTTTTTTTTTTTTT,,TTTTTTT',
  'TWWTTTTggTTTTTTTTTTgg...gTTTgg.....TTTTggTTT.TT.TT.TT.T,,,,TTT.T',
  'TWWTTTTTTTTTTTTTTTTTg..gTTTTTg.....TTgggTTTTTTTTTTTTTTTTT,,TTTTT',
  'TWWTT.TTTTT.TT.TT.TTTgTTTT.TTCC..CCCCgCCCCTT.TT.TT.TT.TTT,,TTT.T',
  'TWWTTTTTTTTTTTTTTTTgggTTTTTTTg....ggggTTTTTTTTTTTTTTTTTTT,,TTTTT',
  'TWWWT.TT.TT.TT.TT.TgCggCTT.TTTgggTTTTgTTT.TT.TT.TT.TT.T,,,,TTT.T',
  'TWWWWTTTTTTTTTTTTgggC..CTTTTTTggTTTTTgTTTTTTTTTTTTTTTTT,,TTTTTTT',
  'TWWWWWWT.TT.TT.TTgTTC..CTT.TTTggTTT.TgTTT.TT.TT.TT.TT.T,,TTTTT.T',
  'TWWWWWWWTTTTTTTgggTTCC..CTTTTggTTTCCCgCCCCCCCCCCCTTTTTT,,TTTTTTT',
  'TWWWWWWW~gT.TTTgTTTTTC..CT.TTgTTTCCvvvvvCCCvvvvCCT.TT.T,,,,,TT.T',
  'TWWWWWW~~ggTTgggTTTTTC...gggggTTTCvvvvvvvCCvvvvvCTTTTTTTTT,,TTTT',
  'TWWWWW~~~~gTTgTTT.TT.CC..CTTTTTT.CvvCCvvvvvvvvvvCT.TT.TTTT,,TT.T',
  'TWWW~~~~~~gTggTTTTTTTTC..CTTTTTTTCvvCCCvvvvCCvvvCCTTTTTTTT,,TTTT',
  'TW~~~~~~~ggTgTTTT.TT.TC..CCTT.TT.CvvvCCvvvvCCvvvCC.TT.TT.T,,TT.T',
  'TTTT...ggg.TgTTTTTTTTTCC..CTTTTTTCvvvvCCvvvvvvvvCTTTTTTTTg..gTTT',
  'TTT.ggggg..ggT.TT.TT.TTC..CTT.TT.CCvvvCCvvvvvvvvCT.TT.TTg....gTT',
  'TTTTTgggg.ggTTTTTTTTTTTC...CTTTTTTCvvCCCvvvvCCvvCTTTTTTg.....gTT',
  'TTTTdddd...ggT.TT.TT.TTCC..CT.TT.TCvvvCvvvvvCCvvCT.TTTg...CC.gTT',
  'TTTddddd....gTTTTTTTTTTTC..CTTTTTTCCvvvvvvvvvvvCCTTTTg...CCC.gTT',
  'TTTdddd.....gT.TT.TT.TT.TPPTT.TT.TTCCvvvCCvvvvvCTT.TTg...CC..gTT',
  'TTTTddd....ggTTTTTTTTTTTTPPTTTTTTTTTCCvvCCCvvCCTTTTTTTg.....ggTT',
  'TTTTTdd..gg.gT.TT.TT.TT.TPPTT.TT.TT.TCvCCCCCCCTTTT.TTTg....gTTTT',
  'TTTTTTg..g..gggTTTTTTTTTTPPPPPggTTTTTTgTTTTTTTTTTTTTTgg...ggTTTT',
  'TT.TTTgg..ggTTgggTgggTgggTTTPPTgggT.TggTT.TT.TT.TT.Tg...ggTTTT.T',
  'TTTTTTTggggTTTTTgggTgggTggggPPTTTgggTgTTTTTTTTTTTTTg...ggTTTTTTT',
  'TT.TTTTTTTTTTTTTTTTTTTTTTTTTPPTTTTTgg.....ggTTT.TTgg..ggTTT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTTTCCCCPPCCCCTTg......ggggTTTg..ggTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TT.TT.TT.TPPTT.TTTTgg...gggTgggggggTTTTTT.TT.T',
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
