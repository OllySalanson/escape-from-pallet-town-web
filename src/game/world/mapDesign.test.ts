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
  'TT.....TT.....TT.ggTTT##gTTTg.TT.TTTvvvvvTTT.TT.TT.TT.TT.TT.TT.T',
  '.T......T......T.gg...g.g...gg.,,,,TvvvvvvTTTTTTTTTTTTTTTTTTTTTT',
  'TT............TT,,g...ggg...g..,,,,TvvvvvvTg.ggg.T.TT.TT.TT.TT.T',
  'TT............TT,,gggg.C.gggg,,TT,,,,,,,,TT.gg.g.TTTTTTTTTTTTTTT',
  '.TPPPPPPPPPPPP,,,,..ggC.ggg..,,TT,,,,,,,,TTgg..g.T.TT.TT.TT.TT.T',
  'TTPPPPPPPPPPPP,,,,.....#.....,,TTTTTTTT,,,,,,,,TTTTTTTTTTTTTTTTT',
  'TTPPPPPPPPPPPP#TTTTTTTTTTTTTT,,T.TT.TTT,,,,,,,,.TTTTT.TT.TT.TT.T',
  '.TPPPPPPPPPPPP#TTTT........T.,,TTTTTTTTTTTTTT,,,,,,,,TTTTTTTTTTT',
  'TTPPPPPPPPPPPP#..............TTT.TT.TT.TT.TTT,,,,,,,,TTT.TT.TT.T',
  'TT###,,#######......WWWWWWW,,TTTTTTTTTTTTTTTTTTTT,,,,,,,TTTTTTTT',
  '.T""",,,,,,,,#......WWWWWWW,,,.TTTT.TT.TT.TT.TT.T,,TTvvvvvvvvT.T',
  'TT""",,,,,,,,#......WWWWWWWT,,TTTTTTTTTTTTTTTTTTT,,TTvvCCvvvvv.T',
  'TT#"""""TTT,,#......WWWWWWWT,,TT.TT.TT.TTTTT.TT.T,,TTvCCCvvvvv.T',
  'TT""""""...,,,,,,,,,WWWWWWWT,,TTTTTTTTTTTTTT,,,,,,,TTvvvvvvTTTTT',
  'TT..""""...,,,,,,,,,TTTTWW,,,,TT.TT.TT,,,,,,,TTTTTTTTvvvvvvTTT.T',
  'TT,,...ggg#,,...ggg#...gWW,,...TTTTTTT,,ggg..TTTTTTTTvvWWWvvTTTT',
  '.T,,...ggg#,,...ggg#...gWW,,...TTTT.T.gg.Tg..TT.TT.TvvvWWWvvvT.T',
  'TT#....ggg......ggg.....WW,,...TTTTTT..g.gg.TTTTTTTTvvvWWWWvvTTT',
  'TTggg.....###..#........WW.....TTTTT.gg..g..TTT.TT.TCCvWWWWvvTTT',
  '.Tggg#.##.ggg...##.g###.WW.....TTTTT.g.WW.g.TTTTTTTTCCvvWWvvvTTT',
  'TTg#g#..g.ggg#....gg..g.WWTT,,TT.TTT..gWW..g.TT.TT.TTCvvvvvvvTTT',
  'TTggg..gg.g#g#..#ggg..g.WWTT,,TTTTTTT.g..gg.TTTTTTTTTCCvvvvvTTTT',
  '.T..........TTTT........WWTT,,TT.TT.TT.ggg.TTTT.TT.TTCCvvvvTTT.T',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,,,TTTTTTTTTTTTTTTTTTTTTTTTCvvvvTTTTT',
  'TTWWWWWwwWWWWWWWWWWWwwWWWW,,TTTT.TT.TT.TT.TT.TT.TT.TTTCCvvvTTT.T',
  '.TWWWWWwwWWWWWWWWWWWwwWWWW,,TTTTTTTTTTTTTTTTTTTTTTTTTTCCvvvTTTTT',
  'TTWWWWW..gg#TTTTTTTT..MMMMM,,,,,,,,TTT.TT.TT.TT.TT.TT.TTvvvTTT.T',
  'TTWWWWW..ggFF.FFFTTT..MMMMM,,,,,,,,TTTTTTTTTTTTTTTTTTTTTCCCTTTTT',
  '.TWWWWW##ggg#,,TT.FFFFMMMMM#TTTTT,,TTT.TT.TTTTT.TT.TT.TT.TT.TT.T',
  'TTWWWWWgggg.#,,#TTgggg.gggg.TTTTT,,TTTTTTTTTTTTTTTTvvvvCCvvvvvvT',
  'TTWWWWWgCgg.#,,,,#gggg.gggg.TTTTT,,TTT.TT.TT.TT.TTTvvCCCCCCvvvvT',
  '.TWWWWWgggC.g,,,,FFF.F.FF.F.TTTTT,,,,,,TTTTTTTTTTvvvvCCCCCCvvvvT',
  'TTT....ggg#g###,,#gggg.gg...TTTTTTTTT,,TT.TT.TT.TvvvvCCCCvvvvvvT',
  'TTT....g.gg####,,....#..gg.TTTTTTTTTT,,TTTTTTTTTTvvvvvvCCvvvvvTT',
  'TTTTT......TTT#,,......TTTTTT.TT.TT.T,,,,,,T.TT.TvvvvvvvCCvvvT.T',
  'TTTTTTT..TTTTT.,,.T,,TTTTTTTTTTTTTTTTTTTT,,TTTTTTvvvvvvCvvvvTTTT',
  'TT.T.....TTT.T.,,.T,,TTTTT.TT.TTTTT.TT.TT,,,,,,TTvvvvvCCvvvTTT.T',
  'TTTT,,gWWg#TTT.,,.g,,TTTTTTTTTTTTTTTTTTTTTTTT,,TTTTvvvvvvvTTTTTT',
  'TT.T,,gWWg.TTTT,,Tg,,,,,,gTTT.TT.TT.TT.TT.TTT,,,,,,,,TTTTTT.TT.T',
  'TTTT,,g.gg#TTTTTT######,,#######TTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTT',
  'TT.T,,##WW##TT.TT#.gg.#,,#gg.g.#.TT.TT.TT.T######,,#########TT.T',
  'TTTT,,,,,,,gTTTTT#..g.#,,#.gg..#TTTTTTTTTTT#.gg.#,,#g.g..g.#TTTT',
  'TT.TWWW..,,#gT.TT#g..g.,,#g..gg#.TT.TT.TT.T#g..g#,,..g..g.g#TT.T',
  'TTTTWWWg.,,g.TTTT#.g.g#,,.g...g#TTTTTTTTTTT#.g.g#,,#.gg.g.g#TTTT',
  'TT.T#WWg.,,ggT.TT######,,#######.TT.TT.TT.T#g.gg.,,#g..g.g.#TT.T',
  'TTTT#WWg.,,g.TTTTTTTTTT,,,,,,,TTTTTTTTTTTTT#T####,,#########TTTT',
  'TT.TWW.g.,,ggT.TT.TT.TTTTTTT,,TT.TT.TT.TT.T,,,,,,,,TT.TT.TT.TT.T',
  'TTTT#####,,###TTTTTTTTTTTTTT,,vvvvvvTTTTTTT,,######TTTTTTTTTTTTT',
  'TT.T,,,,,,,ggT.TT.TT.TT.TT.T,,vvvvvvTT.TT.T,,#.g.g#TT.TT.TT.TT.T',
  'TTTT,,gg.WWggTTTTTTTTTTTTTTT,,vvvvvTTTTTTTT,,#g..g#TTTTTTTTTTTTT',
  'TT.T,,g.gWWg.T.TT.TT.TT.TT.T,,vvvvvvTT.TT.T,,..gg.#TT.TT.TT.TT.T',
  'TTTT,,gWWg.ggTTTTTTTTTTTTT,,,,vvvvTTTTTTTTT,,#g.g.#TTTTTTTTTTTTT',
  'TT.T,,gWWg.g.T.TT.TT.TT.WW,,TTTFFFFTFT.TT.T,,#..g.#TT.TT.TT.TT.T',
  'TTTT,,########TTTTTTTTTTWW,,TTTFg.ggFTTTTTT,,#g.gg#TTTTTTTTTTTTT',
  'TT.T,,,,,,,g.T.TT.TTT.g.WW,,....g.g.FT.TT.T,,,,,,,,TT.TT.TT.TT.T',
  'TTTT##WW.,,ggTTTTTTTTg..WW,,TTTF.gg.FTTTTTTTTTTTT,,,,,TTTTTTTTTT',
  'TT.T.ggWW,,g.T.TT.TTT..wwww,TTTFg..gFT.TT.TT########,,########.T',
  'TTTTgg.g.,,ggTTTTTTTT.g.WW,,TTTFFFFFFTTTTTTT#.g.g.##,,#g..g.g#TT',
  'TT.T.gg.g,,g.T.TT.TTTgg.WW,,T.TT.TT.TT.TT.TT#g.g...#,,#.g.gg.#.T',
  'TTTTg.gg.,,ggTTTTTTTTg..WW,,TTTTTTTTTTTTTTTT#.gg.g,,,,#g.g..g#TT',
  'TT.Tg.g.gggWWWWWWWWWWg.g.gg.T.TT.TT.TT.TT.TT#g.g.g##,,..g.gg.#.T',
  'TTTTWWWWWwwWWWWWWWWWwwWWWWWWTTTTTTTTTTTTTTTT########,,########TT',
  'TT.TWWWWWwwWWWWWWWWWwwWWWWWWT.TT.TT.TT.TT.TT.TTTTT.T,,,,TTTTTT.T',
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
  'TT.TT.TT.TT.T.T...T.TTTTTTT........C......TT.TT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTT.....TTTTTTTT...............TTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT,,,,,,,,,,TTT...............TT.TT.T......T.TT.TT.T',
  'TTTTTTTT,,,,,,,,,T,,,,,,TTT.........C.....TTTTTTT......TTTTTTTTT',
  'TT.TT.TT,,gggggTTTTTTT,,TTT......C...FFFFFTTTTTTT......T.TT.TT.T',
  'TTTTTTTT,,TggTTTgggTTT,,..T....FFFFFF.....TT..TTT......TTTTTTTTT',
  'TT.TT.TT,,Tgg...ggggggg,TTTFFCF......TTTTTTT..TTT......T.TT.TT.T',
  'TTTTT,,,,,Tg.....ggT,,,,TT...C.TTTFFFFFFFFFF.FFTTTTTTTTTTTTTTTTT',
  'TT.TT,,,,,Tgggg.gCgg,,,,T.........F...........FTTTT.T.TT.TT.TT.T',
  'TTTTT,,TTTTgggg.gggT,,TTT......TT.F...........FTTTT.TTTTTTTTTTTT',
  'TT.TT,,gggggggCggggT,,TTT......TT.............F.TT..T.TT.TT.TT.T',
  'TTggg,,TTTTFF.FFF.FF,,TTT......TTTF...........FTTT.TTTTTTTTTTTTT',
  'TTgg.,,TTTT#ggg.ggg#,,TTT......T.TF...........F.TT.TT.TT.TT.TT.T',
  '.TTTT,,T.TT#g.gggCg#,,,,TPPPP..TTTF...........FT...TTTTTTTTTTTTT',
  'TTTTT,,,,,T#gggg.gg#,,,,,PPPPP.TTTF...........FT.TTTT.TT.TT.TT.T',
  'TTTTT,,,,,T#gg.gggg#TT,,TPPPPP.TTTF...........FT.TTTTTTTTTTTTTTT',
  'TT.TTTTT,,TFFFFF.FFFTT,,TTTTTTTTTTF..........."...TTT.TT.TT.TT.T',
  'TTTTTTTT,,Tggggg.ggTTT,,TTTTTTTTTTF...........FT..TTTTTTTTTTTTTT',
  'TT.TT.TT,,gggg.gTggggg,,TTTTTTTT.TF...........FT..FFFFFFFFFFFFFT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTTTTF...........FT..FgggggFgggggFT',
  'TTTTTTTT,,TTTTTTTTTT,,,,TTTTTTTT.TF....PP.....FTT.ggg.ggFgggggFT',
  'T.T,,,,,,,TTTTTT.TTT,,TTTTTTTTTTTTF....PP.....FT..FgggggggggggFT',
  'TTT,,,,,,,TTTTTTTTTT,,TTTTTTTTTT.TF....PP.....FT..FgggggFgggggFT',
  'TTT,,T,,TTTTTTTTT.TT,,,,TTTTTTTTTTFFFFFF.FFFFFFT..FFFFFFFFFFFFFT',
  'TTT,,T,,TT,,,,PPPPPT,,,,TT.TT.TT.TTTTTTT.TTT.TTT.TFgggggggggggFT',
  'TTT,,T,,TT,,,,PPPPPTTT,,TTTTTTTTTTTTTTTT..TTTTTT..Fggg.ggg.gggFT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TT.TT.TT.TT.TT.TT.TT.TTT..ggggggggggggFT',
  'TTT,,T,,,,,,TTPPPPP,,,,,TTTTTTTTTTTTTTTTT..TTTTT..FgggggggggggFT',
  'TTTTTT,,TTTTTTTTPPTTTT,,TT.TT.TT.TT.TT.TTT.T.TTTT.FgggggggggggFT',
  'TTTTTT,,,,TTTTTTTTTTTT,,,,TTTTTTTTTTTTTTTT.TTTTT..FFFFFFFFFFFFFT',
  'TT.TTTTT,,T.TT.TT.TT.TTT,,TTT.TT.TT.TT.TTT..TTTT..TTTTTTTTT.TT.T',
  'TTTTTTTT,,TTTTTTTTFFFFFF,,TTTTTTTTTTTTTTTTT.TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,T.TT.TT.FggggF,,TTT.TT.TT.TT.TT.T.TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTT,,TTTTTTTTFggggF,,TTTTTTTTT......TT.TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,T.TT.TT.Fggggg,,TTT.TT.TT.T....T..TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTT,,TTTTTTTTFggggF,,TTTTTTTTT......T.TTvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT,,,,TT.TT.FggggF,,,,T.TT.TT......T.TTvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTTTT,,TTTTTTFggggFTT,,TTTTTTT....T.T..TvvvvvvvvvvvvvvvvTTT',
  'TT.TT.TT.T,,TT.TT.FFFFFFTT,,T.TT.TT......TT.TvvvvvvvvvvvvvvvvT.T',
  'TTTTTTTTTT,,TTTTTTTTTTTTTT,,TTTTTTTTTTTT.TT.TTvT.TTTTTT..TTTTTTT',
  'TT.TT.TT.T,,TT.TT.TT.TT.TT,,,,TT.TT.TT.T.......T.TTTT.T..TT.TT.T',
  'TTTTTTTTTT,,,,TTTTTTTTTTTTTT,,..TTTT......TTTTTTTTTTTTT..TTTTTTT',
  'TT.TT.TT.TTT,,TTT.TTWWWWWW.T,,T......TTTTTTT.TT.TT.TT.T..TT.TT.T',
  'TTTTTTTTTTTTWWWWWWWWWWWWWWWWwwWWTTTTTTTTTTTTTTTTTTTTT....TTTTTTT',
  'TT.TT.TTWWWWWWWWWWWWWWWWWWWWwwWWWWWWWWWTT.TT.TT.TT.TT..TTTT.TT.T',
  'TWWWWWWWWWWWWWWWWWWWTTTTTTWWwwWWWWWWWWWWWWWWWWWTTTTTTwwWWTTTTTTT',
  'TWWWWWWWWWWW,,TTT.TT.TT.TT.T,,TTWWWWWWWWWWWWWWWWWWWWWwwWWWWWWWWT',
  'TWWWWWWWTTTT,,TTggggCgggTgTT,,TTTTTTTTTWWWWWWWWWWWWWWwwWWWWWWWWT',
  'TT.TT.TT.TTT,,,,gTggggCggg,,,,TT.TT.TT.TT.TT.TTWWWWWW..T.WWWWWWT',
  'TTTTTTTTTTTTTT,,gggCgg.ggT,,TTTTTTT....TTTTTTTTTTTTTT..TTTTTTTTT',
  'TT.TT.TT......,,T.gggCggCg,,T.TT.T......T.TT.TT.TT.TT..T.TT.TT.T',
  'TggTgggC.gTTTT,,ggCggggT.g,,TTTTT.....T.TTTTTTvvvTvvvCvvvvTvvvTT',
  'TCgggW.g.TT.TT,,CggggggggT,,..TTT.......T.TT.TvC.vvvTvCvvCvvvTTT',
  'Tg....ggTgTTTT,,ggTgggCggg,,T...T.T.....TTTTTTvvvvTvvvvCv.vTvvTT',
  'Tg....gWggT.TT,,gCg.gTggCg,,TTT........TT.TT.TCvvvvvvvvvvvCvvCTT',
  'Tg.....ggTTT,,,,gggTgggggC,,TTTTTT....TTTTTTTTvvTvvvvvvvvvv.TvTT',
  'TgW.gggCggTT,,TTggCgggTg,,,,T.TT.TTTTTTTT.TT.Tv.vvCvvvTvvvvCvvTT',
  'TgggggCggTTT,,g.CgggTggC,,TTTTTTTTTTTTTTTTTTTTvvvvvvCvvvvvvvvCTT',
  'TggCgggW.TTT,,TgggCggCgg,,TTT.TT.TT.TT.TT.TT.Tvvvvvvvv.TvvvvvvTT',
  'TggggTggggTT,,ggTggCgggT,,TTTTTTTTTTTTTTTTTTTTvCvvvvvvvvCvvTvvTT',
  'T.WggggCggTT,,gCgT.ggCgg,,TTT.TT.TT.TT.TT.TT.Tvvvv.vvTvvvvCvvTTT',
  'TgggCgggTgTT,,,,,,,,,TTT,,TTTTTTTTTTTTTTTTTT....TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTT,,,,,,,,,TTT,,TTT.TT.TTT.........TTTTT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTPPPPPPPT.........TTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TTPPPPPPP..TTTTTTTTT.TT.TT.TT.TT.TT.TT.TT.TT.T',
  'TTTTTTTTTTTTTTTTTTTTTTPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT.TT.TT.TT.TT.TT.TTTTPPTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T',
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
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTTT...TTTTT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTT.TT.TT.TT.TT.TT.TT.TT.TTMMT.TTT',
  'TTTTTTTTTTT,,,,#######,,,,TTTTTTTTTTTTTTWWWTTTT...TCCTCCCCTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'T.TT.TT.TTT,,,,#######,,,,TT.TT.TT.TT.TTWWWT.TT...CMMMMMMC.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'TTTTTTTTTTT,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMvCvvvvvTTTTTTTTTTTTTTTTTTTTTTTTTTTTvvTTTCCCCCCCCCCCCCCCCCCCCCCCCMMCCCCT',
  'T.TT.TT.T.T,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWMMMM...MMMMMMMvvvCvvvTTT.TT.TT.TT.TT.TT.TT.TT.TTTvvTTTvvvvvvvCvvvvvvvvCvvvvvvvvCvvvvT',
  'TTTTTTTTT,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWTTTM...CMMMMMMCTTvvvvCCCCCCCCCCCCCCCCCCCCCCCCCCCCvvCCCvvvCvvvvvvvvCvvvvvvvvCvvvvvvvvT',
  'T.TT.TT.T,,,,,,,,,,,,,,,,,,MMMWWWWWWMMMMWWWTTTMMMMMMMMTCTT.TvvvvvvvvvvCvvvvvCvvvvvCvvvvvCvvvvvvCvvvvvvCvvvvvvvvCvvvvvvvvCvvvvvvT',
  'TTTTTTTTT,,TT,,,,,TT,,,,,,,MMMWWWWWWMMMMWWW.TTTTMTMMTTTTTTTTvvvvvvCvvvvvvCvvvvvCvvvvvCvvvvvCvvvvvvvCvvvvvvvCvvvvvvvvCvvvvvvvvCvT',
  'T.TT.TT.T,,.TTTTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTT.TTTMMTTT.TT.TTTTT,,CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC######"######"#########"##"###T',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTTTT.TMM.TTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC""g""g""g#"g""#TTTT#g""g#"g""#T',
  'T.TT.TT.T,,T..TT.TT.TT.TT.TWWWWWWWWWWWWWWWW.TTMMMMMMTTT.TT.TT.TT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC""g"#g""g""g""#TTTT#g""g""g""#T',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTMMMTTTTTTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC""g"#g""g#"g""#TTTT#g""g#"g"""T',
  'T.TT.TT.T,,,,,,,,,T.TT.TT.TWWWWWWWWWWWWWWWWTTTMMMTTT.TT.TT.TT.TT,,CCWWWWWWWWWWWWWWWWWWWWWWWCCCCCC"######"##"#########"######"##T',
  'TTTTggg....Cgg..,,,,TTTTTTTWWWTTTTTTTTTTWWWTTTMMMTTTTTTTTTTTTTTT,,CCWWWWWWWWWWWWWWWWWWWWWWWvvvvvv""g"#g""g""g""#""g"#g""g""g""#T',
  'T.TgggggCggggg..T,,,,,,,,,TWWWTTTTTTTTTTWWW.TTMMMTTTWWWWWWWTT.TTvvvvvvCvvvvvvCvvvvvCvvvvvvvvvCvvv""g"#g""g#"g"""""g"#g""g#"g""#T',
  'TTTgggggWWWgggg.C,,,,,,,,,TWWWTTTTTTTTTTWWWTTTMMMTTTWWWWWWWTTTTTvvvCvvvvvCvvvvvvCvvvvvCvvvvvCvvvv""#""g""g#"g""#""g""g""g#"g""#T',
  'T.TTggggWWW.ggggCggT...,,.CWWWT.TT.TTTTTWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWTCCCCCCCCCCCCCCCCCMMCCCCCCC#"######"#########"##"######"#T',
  'TTTTT.gWW.gg...ggggTTC.,,.TWWWTTTTTTTTTTWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWTCCCCCCCCCCCCCCCCCMMCCCCCCC""g"#g""g#TTTT#""g"#g""g#"g"""T',
  'T.TTggWWWWWWWWWWWWWTTT,TTTTWWWT.TT.T,,,,,,,,,T,,,,,TWWWWWWW.g..T..g.WW.CCCCCCCCCCCCCCCCCMMCCCCCCC""g""g""g#TTTT#""g""g""g#"g""#T',
  'TTTT..WWWWWWWWWWWWWgTT,TTTTWWWTTTTTT,,TTTTT,,,,,,,,TWWWWWWW.g.....g.WWTCCCCCCCCCCCCCCCCCMMCCCCCCC""g"#g""g#TTTT#""g"#g""g""g""#T',
  'T.TT..ggCgggg..Cgggg.T,TT.TWWWT.TTTT,,,TTTTT,TTTT,,TWWWWWWW.g..T..g.WW.CCCCCCCCCCCCCCCCCMMCCCCCCC##"##"#########"######"#######T',
  'TTTTggggggCggggggggT,,,,,,TWWWTTTTTT,,,TTTTT,TTTT........TTT.TTTTTT.WWTCCCCCCCCCCCCCCCCCMMCCCCCCC""g""g""g#"g""#""g""g""g#TTTT#T',
  'T.TTgggggCggggCggggg...T,,TWWWT.TTTT,,TTTTT,,TTTT........T..g.....g.WWT..g..g..gT.g.....g.Tg..g..""g"#g""g""g""#""g"#g""g#TTTT#T',
  'TTTTTT,TTTTTTTTTTTTTgggg,,TWWWTT,,,,,,TTTTT,TT.TT...........g..T..g.WWT..g.Tg..g..g..T..g..g.#g..""g"#g""g#"g"""""g"#g""g#TTTT#T',
  'T.TT.T,TTT.TT.TT.TTTTTT,,,TWWWTT,,,TTTTT.TT,,,,TT........TT.g..T..g.WWWWWWWWWWWWWWWWWWWWWWWWWWW..###"#########"##"######"######T',
  'TTTTTT,.TTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTT,,TT........TTTT.TT.TTTTTWWWWWWWWWWWWWWWWWWWWWWWWW..""g"#TTTT#"g""#""g"#g""g""g""#T',
  'T.T,,,,TTT.TT.TT.TTWWWWWWWWWWWWWWWWWWWWWWTT.T,,,,,,,,,,TTTT.g..T..g.Tg..g..g..T..g.Tg..g..g..T..g""g"#TTTT#"g"""""g"#g""g#"g"""T',
  'TTT,TTTT..........TWWWWWWWWWWWWWWWWWWWWWWTTTT#"#"#"#"#"#"TT.g.....g.Tg..gT.g.....g.Tg..gT.g.....#""g"#TTTT#"g""#""g""g""g#"g""#T',
  'T.T,T.TT..........TWWW.,,,,####,,,,,TTWWWTT.TTT,,,,,,,,,,TT.g..T.....g..gT.g..T..g..g..gT.g..T..g,,,T,,"ggg#"gggg"gg#g"gggg"gTTT',
  'TTT,,,,T..........TWWW.,,,,####,,,,,TTWWWTT,,"#"#"#"#"#"#TT.TTTTTT..T.TTTTTT.TT.TTTTTT.TT.TTTTTT.,,,,,,g#gg"gggg"#ggg"gggg#ggTTT',
  'T.TTTT,T..........TWWW..PPPPPPPPPPPPTTWWWTT,T,,,,,,,,,,TTTTTT""""#""""#TTTT#""""#""""#TTTT#""""#"WWW,,,ggg"#ggg"gggg#gggg"gggTTT',
  'TTTTTT,T..........TWWW#.PPPPPPPPPPPP.TWWWTT,T#"#"#"#"#"#"TTTTg""g#"g""#TTTT#g""g#"g""#TTTT#g""g""WWW,T,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.T,,##P##PPPPPPWWW#.PPPPPPPPPPPPTTWWWTT,TTT,,,,,,,,,,T.TT""""#"#""#TTTT#"""""""""#TTTT#""""#"WWW,,,g"ggg#"gggg"gg#g"gggg"TTT',
  'TTTTTT,PPPP...wwwwCwww,,PPPPPPPPPPPP,,WWW,,,T"#"#"#"#"#"#TTTTg""g""g""#TTTT#g""g#"g""#TTTT#g""g#"WWW,,,"g#gg"gggg"#ggg"gggg#gTTT',
  'T.TT.T,PPPP...wwwwwwww,,PPPPPPPPPPPP,,WWWTTTT,,,,,,,,,,TTT.TT###"##"#########"######"#########"##WWW,,Tgggg"#ggg"gggg#gggg"ggTTT',
  'TTTTTTTPPPPPPPPPwwPWWW#.PPPPPPPPPPPP.#WWWTT.T#"#"#"#"#"#"TTTTg""g#"g""#""g"#g""g""g""#""g"#g""g#"WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.TTTwwwwwwwwwwTWWWTTTTTTTTTTTTTTTTWWWTTTTTT,,,,,,,,,,C.,,,,,,,,,,,#,,,,#,,,,#,,,,,,,,,#,,,,#,WWW,,,gg"ggg#"gggg"gg#g"ggggTTT',
  'TTTTTTTTwwwwwwwwCwTWWWTTTTTTTTTTTTTTTTWWWTTTT"#"#"#"#"#"#,,,,,,,,#,,,,,,,,,#,,,,#,,,,#,,,,,,,,,#,WWWT,,g"g#gg"gggg"#ggg"gggg#TTT',
  'T.TT.TTTwwwwwwwwPPTWWW.TT.TT.TT.TT.TTTWWWTT.T,,,,,,,,,,TTTTTT""""#""""#"""""""""#""""#""""#""""""WWW,,,"gggg"#ggg"gggg#gggg"gTTT',
  'TTTTTTTTwwwwwwwwPPTWWWTgddddddddTTTT.TWWWTTTTTTTTTTTT,,TTTTTT"######"##"######"##"######"##"#####WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.TTTTTTTTTTTPCTWWWggdddWWWWWWWWWWWWWWTT.TTTTTTTTT,,TTTTTT."""#"""""""""#""""#""""#"""""""""#"WWW,T,ggg"#ggg"gggg#gggg"gggTTT',
  'TTTTTTTTTTTTTTTTPPTWWWWWWWWWWWWWWWWWWWWWWFFFFFFFFFFFF,,FFFFFFPPPP#PPPP#PPPP#g""""""g"#""""#""""#PPPP,,,g#"gggg"gg#g"gggg"g#ggTTT',
  'T.TT.TT.TTTTT.TTPPTWWWWWWWWWWWWWWWWWWWWWWTTTTTTTTTTTT,,TTT.TTPPPPPPPPP#PPPP#""g"#"""""""""#"g""#PPPP,,,#"gg#g"gggg"g#gg"gggg"TTT',
  'TTTTTTTTTTTTTTTTPP,ggggCgggggTWWWTggggCgggTTTTTTTTTTT,,TTTTTTPPPP#PPPP#PPPP#""""#""""#"g""""""g#"WWW,,TWWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.TT.TT.TTTPPPPTggggggggggTWWWTggggCgggTTTTTTTT,,,,,TTTTTTPPPP#PPPP#PPPP#""""#"g""#"""g#"""""gWWW,,,gggg"#ggg"gggg#gggg"ggTTT',
  'TTTTTTTTTTTTTTPPTTTTTTTT..TTTTWWWTT,,,,,,,,,TTTTTT,,TTTTTTTTT#"######"#########"##,######"##"####WWW,,,gg#"gggg"gg#g"gggg"g#gTTT',
  'T.TT.T.....T.TPPTTT.TT.T..TT.TWWW.TT,TTTTTCMMMMMv,,,TTTTTT.TT,,,,,,C,,,,,,,#,,,,#,,,,#,,,,,,,,,#,WWWT,,gg"gg#g"gggg"g#gg"ggggTTT',
  'TTTTTT.....TTTPP,,,,,,,T..TTTTWWWTTT,TTTTTvMMMMMvTTTTTTTTTTTT,,,,#,,,,#,,,,,,,,,#,,,,#,,,,#,,,,,,WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.T.....TTTPPTTTT,,TT,,TT.TWWWT.T,.TT.TvMMMMMvTTT.TT.TT.TT"g""#"""g#""""#g"""#TTTT#""""#""""#"WWW,,,"gggg"#ggg"gggg#gggg"gTTT',
  'TTTTTT......TTPPTTTT,,,,,,,,,TWWWTT,,,,,,,vvvvvvvTTTTTTTTTTTT"""g"""""#g"""#""g"#TTTT#""""#"g""#"WWW,T,ggg#"gggg"gg#g"gggg"g#TTT',
  'T.TT.T.....TTTPPT.TTTTTTT,,,,MMMMMMTT,,TTTTT,,TTTTTT.TT.TT.TT##"##"######"##"#########"#########"WWW,,,ggg"gg#g"gggg"g#gg"gggTTT',
  'TTTTTTTPPPPPPPPPPTTTTTTTTTTTTMMMMMM,,,,T.TTT,,TTTTTTTTTTTTTTTg"""#""g"#""""#""""""g""#"""g#TTTT#gWWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.TT,,TTTTTTPPPPTTT.TT.TTTTWWWTTTT,,,,,,,,,.TT.TT.TT.TT.TT."g""..""#""""#"g""#"""g"""""#TTTT#"WWW,,Tg"gg#g"gggg"g#gg"gggg"TTT',
  'TTTTTTT,,TTTTTTTTPPTTTTTTTT.TTWWWTTTTTTTTgWWWWWWTTTTTTTTTTTTTTTTTT.#TTTTT""TTTTTTTTTTTTTTTTTTTTTTWWW,,,"#ggg"gggg#gggg"ggg#"gTTT',
  'T.TT.TT,,T.TT.TTTPPTTT.TT.TTTTWWWTTTT.TTTgWWWWWWgTTT.TT.TT.TT.TT.T..TT.TT""T.TT.TT.TT.TT.TT.TT.TTWWW,,,gggg#gggg"ggg#"gggg"ggTTT',
  'TTTTTTT,,TTTTTTTTPPTTTTTTTTTTTWWWTTTTTTTTggggggggTTTTTTTTTTTTTTTTT#.TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWT,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'T.TT.TT,,,,TT.TTTPPTTT.TT.TT.TWWWT.TT.TTTTTTTTTTTTTT.TT.TT.TT.TT.T..TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWW,,,gg"gg#g"gggg"g#gg"ggggTTT',
  'TTTTTTTTT,,TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWW,,,g"#ggg"gggg#gggg"ggg#"TTT',
  'T.TT.TT.T,,TT.TTTTTTTTTTT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.T..TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWW,T,"gggg#gggg"ggg#"gggg"gTTT',
  'TTTTTTTTT,,TTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwwwwwwwww######wwwwwwwww####www#www#www#####www#wwwwwww#www#####WWW,,,ggg"gg#g"gggg"g#gg"gggTTT',
  'TT"g"""""F,Fg""gF"g"""""g"Fg""WWWgggg#gggg######gggg#gggg####gggwggg#ggg#####ggg#ggg#gggwggg#####WWW,,Tgg"#ggg"gggg#gggg"ggg#TTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWwwww#wwww######wwww#wwww####www#wwwwwww#####wwwwwww#www#www#####WWW,,,g"gggg#gggg"ggg#"gggg"TTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWW###w##w#########w######w#####w##w#####w#####w#####w##w##w#######WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWwwww#wwwwwwwww#wwww#wwwwww##wwwwwww#www#####www#www#wwwwwww#####WWWT,,gggg#gggg"ggg#"gggg"ggTTT',
  'TT"g""F"",F"g""gF"g""F""g""g""WWWgggg#gggg#ggggwgggg#gggg#g##ggg#gggwggg#####gggwggg#ggg#ggg#####WWW,,,g#g"gggg"g#gg"gggg"#ggTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwwwwwwwww#wwww#wwwwwwwww#w##www#www#www#####www#wwwwwww#www#####WWW,,,gg"g#gg"gggg"#ggg"ggggTTT',
  'TTFF"FF"FF,FFF"FF"FFFFFF"FF"FFWWWw######w##w######w##w#########w##w##w########w##w#####w##w######WWW,T,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWwwww#wwww#wwwwwwwww#wwww#w##www#wwwwwww#####wwwwwww#www#www#####WWW,,,"gggg#gggg"ggg#"gggg"gTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWggggwgggg#gggg#ggggwgggg#g##ggg#ggg#ggg#####ggg#gggwggg#ggg#####WWW,,,gg#g"gggg"g#gg"gggg"#gTTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWwwww#wwwwwwwww#wwww#wwwwwww#wwwwwww#www#####www#www#wwwwwww#####WWW,,Tggg"g#gg"gggg"#ggg"gggTTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWW########w##w#########w####www#####w##w########w##w##w#####w#####WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWW#####wwww#wwww######wwww#w##www#www#www#####www#wwwwwww#www#####WWW,,,g"gggg#gggg"ggg#"gggg"TTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWW#####ggggwgggg######ggggwg##gggwggg#ggg#####ggg#ggg#gggwggg#####WWWT,,"gg#g"gggg"g#gg"gggg"#TTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWW#####wwww#wwww######wwww#w##www#wwwwwww#####wwwwwww#www#www#####WWW,,,gggg"g#gg"gggg"#ggg"ggTTT',
  'TT"FFFFFFFFF"FFFFFF"FF"FFFFFF"WWW#####w######w#########w##w###w##w#####w#####w#####w##w##w#######WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWwwww#wwwwwwwww#wwww#wwwwww##wwwwwww#www#####www#www#wwwwwww####wPPP,T,gg"g#gg"gggg"#ggg"ggggTTT',
  'TT"g""F"",,"g""gF"g""F""g""g""WWWgggg#gggg#ggggwgggg#gggg#g##ggg#gggwggg#####gggwggg#ggg#ggg####wPPP,,,g#gggg"ggg#"gggg"gg#g"TTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwwwwwwwww#wwww#wwwwwwwww#w##www#www#www#####www#wwwwwww#www#####WWW,,,"ggg#"gggg"gg#g"gggg"gTTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWWWW###w##w######w##w######w######w##w##w########w##w#####w##w######WWW,,TWWWWWWWWWWWWWWWWWWWWWWWWT',
  'T,,,,,F"",,"g""gF"g""F""g""g""WWWwwww#wwww#wwwwwwwww#wwww#w##www#wwwwwww#####wwwwwww#www#www#####WWW,,,ggg"g#gg"gggg"#ggg"gggTTT',
  'T,,,,,F"",,Fg""g""g""F""g"Fg""WWWggggwgggg#gggg#ggggwgggg#g##ggg#ggg#ggg#####ggg#gggwggg#g#######WWW,,,gg#gggg"ggg#"gggg"gg#gTTT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""WWWwwww#wwwwwwwww#wwww#wwwwww##wwwwwww#www#####www#www#wwwww#ww"w##WWWT,,g"ggg#"gggg"gg#g"gggg"TTT',
  'TTFF"FF"FF,FFF"FF"FFFFFF"FF"FFWWWw#########w######w##########w#####w##w########w##w##w#####w"ww##WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""WWWwwww######wwww#wwww#########www#www#www#####www#wwwwwww#w#ww"w##WWW,,,gggg"g#gg"gggg"#ggg"ggTTT',
  'TT"g""""",FFg""gF"g"""""g"Fg""TTTTTTTTTTWWWTT""""TTTTTTTTTT##gggwggg#ggg#####ggg#ggg#gggwg#######WWW,T,ggg#gggg"ggg#"gggg"gg#TTT',
  'TT"g""F"",,"g""gF"g""F""g""g""T.TT.TT.TTWWW.T""""TTT.TT.TT.##www#wwwwwww#####wwwwwww#www#www#####WWW,,,gg"ggg#"gggg"gg#g"ggggTTT',
  'TTWWWWWWWwwWWWWWWWWWWWWWWWWWWWTTTTTTTTTTWWWTT""""TTTTTTTTTT###w##w#####w#####w#####w##w##w#######WWW,,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"g""""",,Fg""gF"g"""""g"Fg""PPTT.TT.TTWWW.T""""TTT.TT.TT.##wwwwwww#www#####www#www#wwwwwww#####WWW,,T"ggg#"gggg"gg#g"gggg"gTTT',
  'TT"g""F""F,"g""gF"g""F""g""g""PPTTTTTTTTWWWTT"#""TTTTTTTTTT##ggg#gggwggg#####gggwggg#ggg#ggg#####WWW,,,g#gg"gggg"#ggg"gggg#ggTTT',
  'TT"g""F"",,Fg""g""g""F""g"Fg""PPTT.TT.TTWWW.T""""TTT.TT.TT.##wwwwwww#www#####www#wwwwwww#www#####WWW,,,ggg"#ggg"gggg#gggg"gggTTT',
  'TT"FFFFFF,,F"FFFFFF"FF"FFFFFF"PPTTTTTTTTWWWTT""""TTTTTTTTTT####ww#w##w########w##w#####w##w######WWWT,,WWWWWWWWWWWWWWWWWWWWWWWWT',
  'TT"PP"PP",,#PP"P######P"PP#PP"P#"PP"CPPPWWWT"#g"Tg""g""g""T""g"Tg""g""g""T""g"Tg""g""g""T""g"Tg""g""g""T"ggg#"gggg"gg#g"gggg"TTT',
  'TT"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPPWWWT""g"Tg""gT"g"""""g"Tg""gT"g"""""g"Tg""gT"g"""""g"Tg""gT"g""""#gg"gggg"#ggg"gggg#gTTT',
  'TT"PP"#P"PP#PP"P######P"PP#PP"PP"PP"PCPPWWWT""g""g""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg""g""gT"g""T""g""T""g"Tg""g""g""T""T',
  'TT##P##P######P#########P##P######P#PPPPWWWTT"TTTTTT"TT"TTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT"TT"TTTTTT"TT"g"""""g"Tg""gT"g"""""T',
  'TT"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPCPWWWT""g"Tg""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg""gT"g"""""g""T""g""g""gT"g""T""T',
  'TT"PP"#P"PP#PP"P######P"PP#PP"PP"CP"PPPPWWWT""g""g""gT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg""g""gT"g""T"TTTTTT"TTTTTTTTT"TTTTTT',
  'TT"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PPPCWWWT""g"Tg""g""g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg""g""g""T"TTTTT""g"TTTTTT"g""TTTT',
  'TT###P##P######P#########P##P######PCPPPWWWTTT"TTTTTTTTT"TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTT"TTTTTTTTTTTTT""g"TTTTTT"g""TTTT',
  'TT"PP"#P"PP#PP"P######P"PP#PP"PP"CP"PPPPWWWT""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT"TTTTT""g"TTTTTTTg""TTTT',
  'TT"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PCPPWWWT""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT"TTTTTTT"TTTTPPPTT"TTTTT',
  'TT"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPPWWWT""g"TTTTTT"g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTg""gTTTTTT""g""T""g""gTPPPTg""T""T',
  'TTP######P##P#########P######P##P###PPCPWWWTTTT"TTTTTTTTT"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWTTTTTT"TT,,,TT"g""T""g"TgTTPTTg""T""T',
  'TT"PP"PP"PP#PP"P######P"PP#PP"P#"PP"PPPPWWWT""g"Tg""g""g""WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWg"Tg"#g"",,,T""g"""""g"Tg""gT"g"""""T',
  'TT"PP"#P"PPPPP"P######P"PPPPP"P#"PP"PPPCWWWT,,,,C,,,,,,,,C,,,,,,,,C,,,,wwwwC,,,,,,,,C,,,,,,,,C,,,,,,,,,C,,,,,,,,,"TT"TTTTTT"TT"T',
  'TT"PP"#P"PP#PP"P######P"PP#PP"PP"PP"CPPPWWWTC,,,,,,,,C,,,,,,,,C,,,,,,,,Cwwww,,,,C,,,,,,,,C,,,,,,C,C,,,,,,,C,,,,,,"Tg""g""g""T""T',
  'TTCCCCCCCCCCCCCCCCCCCCCCddCCCCCCCCCCCCCCWWWTCCCCCCCCCCCCCCCCCCCCCCCCCCCwwwwwCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"g"""""g"Tg""gT"g"""""T',
  'T.WWWWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddWWWWWWWCMMMWWWWWWWWWWWW',
  'TTWWWWddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWWWWWWWMMMCWWWWWWWWWWWW',
  'TTWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWWWWWMCMMWWWWWWWWWWWW',
  'T.WWWWddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddWWWWWWWMMCMWWWWWWWWWWWW',
  'TTWWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWWWWCMMMWWWWWWWWWWWW',
  'T.WWWWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddWWWWWWWMMMCWWWWWWWWWWWW',
  'T.WWWWddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWWWWWWWMCMMWWWWWWWWWWWW',
  'TTWWWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWwWWWWWWwWWWWWWWWMMMMWWWWWWWWWWWW',
  'T.WWWWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddWWWWWWWMMMMWWWWWWWWWWWW',
  'TTWWWWddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWWWWWWWWWWWWWWWWWWWWWWW',
  'TTWWWWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWddddWddddwddddWWWWWWWWWWWWWWWWWWWWWWW',
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
