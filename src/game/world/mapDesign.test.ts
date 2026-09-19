import { describe, expect, it } from 'vitest';
import { sketchFloodplainRelay } from './maps/floodplainRelay';
import { sketchPalletTown } from './maps/palletTown';
import { sketchViridianForest } from './maps/viridianForest';

/**
 * The three approved maps, exactly as they were drawn and signed off, one
 * character per tile.
 *
 * These are the design, not a snapshot of the code: they were authored and
 * measured before any of this was built, reviewed tile by tile, and approved as
 * drawn. The authoring functions are readable and easy to nudge, which is
 * precisely why the grid they produce is pinned here - a stray tile in a lane is
 * invisible in a diff of polylines and obvious in a diff of these.
 *
 * Legend: T hedge or tree, F fence, W water, `.` grass, `,` lane, P paved,
 * g tall grass; I insertion, X extraction, O objective, L cache, H trainer,
 * S sign, N townsfolk, * landmark.
 */
const APPROVED_PALLET_TOWN = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTT,,,,,,,,FLgggggWWWWWWWWT...T',
  'TTT,FFFF,FF,FTTTTgTWWWWWWWWT.T.T',
  'T*.,FPPPPSF,FggggggWWWWWWWW....T',
  'TST,,PPPPPF,FTgTTTTWWWWWWWW.TT.T',
  'T..,FPPIPPF,,ggggggWWWWWWWW....T',
  'TT.,FNPPPP,,FTTTTgTWWWWWWWWT.T.T',
  'T.T,FPPPPPF,FggggggWWWWWWWW...TT',
  'T..,FF,FFFF,F,T,T.,N.WW.....TT.T',
  'TTT,,,,,,,,,F,,,,T,,,T,,,T,,,T,T',
  'TTTT..T...,FF,FFFFF,FFFF,F,FFT,T',
  'TFFFF.F.FF,FggggggF,FLgF,FggFT,T',
  'TFL...F...TFgggggg,,Fgg,,FggFT,T',
  'TFFFF.FFFF,FFFFgFFF,FFFF,FFF,T,T',
  'TTT.......,FggFgggF,,,,,,,,T,,,T',
  'TFF.FTF.FF,,ggggggF,FFFFF,FF,FFT',
  'TFL.FTF..F,FggFgggF,,gggF,,ggLFT',
  'TFFFFTF.FF,F,FFF,FF,FFFFF,FFFFFT',
  'TFFFFFF,FF,F,FFF,FFFFF....TTTTTT',
  'TLggggFgggggggFggggggF.TT.TTTTXX',
  'TFgFFFFFgFFFgFFFFFFgFFHTT......T',
  'TggFggggggFggggggFgggF.TTTT.TTTT',
  'TFgFFgFFFgFFFgFFFFgFFF.TTTT.TTTT',
  'TgggggFggggggOFggggggF........TT',
  'TFgFFFFFgFFFgFFgFFFgFF.TT.TTTLTT',
  'TLgFggggggFggggggFggg,.TT.....TT',
  'TFFFFFFF,FFFFFFF,FFFFFTTT.TTTTTT',
  'TWWWWWWW,WWWWWWW,WWWWWWWW,WWWWWT',
  'TWWWWWW,,WWWWWW,,WWWWWWW,,WWWWWT',
  'TWWWWWW,WWWWWWWHWWWWWWWW,WWWWWWT',
  'TT,,,,,,,,T,,,,,,T,,,T,,,,T.*T.T',
  'X,,TTT,,,,,T,,,,,T,,,,,T,,,..T.T',
  'TWWWWWT,,FFFFF,FFFFF,FFFFF,TT..T',
  'TWWWWWT,,FLggF,,gggF,FgggF,TT.TT',
  'TWWWWWT,,,gggF,FgggF,,gggF,TT..T',
  'TWWWWW,,,FFFFF,FFFFF,FFFFF,TTT.T',
  'TWWWWW,T,,,,,F,,,,,,,,,,F,,..T.T',
  'TWWWWW,TTT,FFFFF,FFFFF,FFFFF...T',
  'TWWWWW,TTT,,ggg,,FLggF,,Lgg...TT',
  'TWWWWW,TTT,FgggF,,gggF,FgggF...T',
  'TT......TT,FFFFF,FFFFF,FFFFF.T.T',
  'TT....T.,,,,T,,X,,,,,T,,,,T....T',
  'TTTTTTTTTTTTTTTXTTTTTTTTTTTTTTTT',
];

/**
 * Floodplain Relay as redrawn: a 64x64 river town cut out of solid forest, and
 * NOT yet signed off. The grid that stood here was the approved 32x32 design,
 * which the captain has since asked to be replaced outright; this is the
 * drawing proposed in its place, pinned so that the change which proposes it
 * is also where it is reviewed tile by tile. Until it is approved as drawn, read
 * "approved" above as true of the other two maps only.
 *
 * The map file composes this from layered blocks - the river and the forest
 * first, each district cut out of them after - so this is the one place the
 * finished picture can be read whole. A forest tree is drawn as the tile of
 * grass its trunk stands on, in thicket: `.` inside a run of `T`. Legend as
 * above, plus `w` ford, `M` stone, `v` gravel, `#` hedge, `C` rock and the
 * double quote for mown turf.
 */
const APPROVED_FLOODPLAIN_RELAY = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTT...TTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TTWWWTTTT...TT.TT.TT.TT.TT',
  'TTTTTTTTTTT,,,,#######,,,,TTTTTTTTTTTTTTWWWTTTT...TTTTTTTTTTTTTT',
  'T.TT.TT.TTT,,,,#######,,,,TT.TT.TT.TT.TTWWWTTTT...TvvvvvvT.TT.TT',
  'TTTTTTTTTTT,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWW,,,,...,vvvvvvTTTTTTT',
  'T.TT.TT.TTT,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWW,,,,...,vvvvvvT.TT.TT',
  'TTTTTTTTT,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMWWWTTT,...TTvvvvvTTTTTTT',
  'T.TT.TT.T,,,,,,,,,,,,,,,,,,MMMWWWWWWMMMMWWWTTT,,,,,,,,TTTT.TT.TT',
  'TTTTTTTTT,,TTTTTTTTT,,,,,,,MMMWWWWWWMMMMWWWTTTTTTT,,TTTTTTTTTTTT',
  'T.TT.TT.T,,TTTTTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTT.TTT,,TTT.TT.TT.TT',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTMMMWWWWWWMMMMWWWTTTTTTT,,TTTTTTTTTTTT',
  'T.TT.TT.T,,T..TT.TT.TT.TT.TWWWWWWWWWWWWWWWWTTT,,,,,,TTT.TT.TT.TT',
  'TTTTTTTTT,,T..TTTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTMMMTTTTTTTTTTTTTTT',
  'T.TT.TT.T,,,,,,,,,T.TT.TT.TWWWWWWWWWWWWWWWWTTTMMMTTT.TT.TT.TT.TT',
  'TTTTggg....Cgg..,,,,TTTTTTTWWWTTTTTTTTTTWWWTTTMMMTTTTTTTTTTTTTTT',
  'T.TgggggCggggg..T,,,,,,,,,TWWWTTTTTTTTTTWWWTTTMMMTTTWWWWWWWTT.TT',
  'TTTgggggWWWgggg.C,,,,,,,,,TWWWTTTTTTTTTTWWWTTTMMMTTTWWWWWWWTTTTT',
  'T.TTggggWWWgggggCggT...,,.CWWWT.TT.TT.TTWWWWWWMMMWWWWWWWWWWTT.TT',
  'TTTTT.gWW.gg...ggggTTC.,,.TWWWTTTTTTTTTTWWWWWWMMMWWWWWWWWWWTTTTT',
  'T.TTggWWWWWWWWWWWWWTTT,TTTTWWWT.TT.T,,,,,,,,,T,,,,,TWWWWWWWTT.TT',
  'TTTT..WWWWWWWWWWWWWgTT,TTTTWWWTTTTTT,,TTTTT,,,,,,,,TWWWWWWWTTTTT',
  'T.TTT.ggCgggg..CggggTT,TT.TWWWT.TT.T,,TTTTT,,TTTT,,TWWWWWWWTT.TT',
  'TTTTggggggggggCggggT,,,,,,TWWWTTTTTT,,TTTTT,,TTTT........TTTTTTT',
  'T.TTgggggCggggCggggg...T,,TWWWT.TT.T,,TT.TT,,T.TT........TTTT.TT',
  'TTTTTT,TTTTTTTTTTTTTgggg,,TWWWTT,,,,,,TTTTT,,TTTT........TTTTTTT',
  'T.TT.T,TTT.TT.TT.TTTTTT,,,TWWWTT,,,TTTTT.TT,,,,TT........T.TT.TT',
  'TTTTTT,TTTTTTTTTTTTWWWWWWWWWWWWWWWWWWWWWWTTTT,,TT........TTTTTTT',
  'T.T,,,,TTT.TT.TT.TTWWWWWWWWWWWWWWWWWWWWWWTT.T,,,,,,,,,,TTT.TT.TT',
  'TTT,TTTT..........TWWWWWWWWWWWWWWWWWWWWWWTTTT#"#"#"#"#"#"TTTTTTT',
  'T.T,TTTT..........TWWW.,,,,####,,,,,TTWWWTT.TTT,,,,,,,,,,T.TT.TT',
  'TTT,,,,T..........TWWW.,,,,####,,,,,TTWWWTT,,"#"#"#"#"#"#TTTTTTT',
  'T.TTTT,T..........TWWW..PPPPPPPPPPPPTTWWWTT,T,,,,,,,,,,TTT.TT.TT',
  'TTTTTT,T..........TWWW#.PPPPPPPPPPPPTTWWWTT,T#"#"#"#"#"#"TTTTTTT',
  'T.TT.T,,##,####,##TWWW#.PPPPPPPPPPPPTTWWWTT,TTT,,,,,,,,,,T.TT.TT',
  'TTTTTT,,,,,...,,,,Cwww,,PPPPPPPPPPPP,,WWW,,,T"#"#"#"#"#"#TTTTTTT',
  'T.TT.T,,,,,...,,,,,www,,PPPPPPPPPPPP,,WWWTTTT,,,,,,,,,,TTT.TT.TT',
  'TTTTTTTT,,,,,,,T,,TWWW#.PPPPPPPPPPPP.#WWWTTTT#"#"#"#"#"#"TTTTTTT',
  'T.TT.TTT""""""TT,,TWWWTTTTTTTTTTTTTTTTWWWTT.TTT,,,,,,,,,,T.TT.TT',
  'TTTTTTTT""""""TTC,TWWWTTTTTTTTTTTTTTTTWWWTTTT"#"#"#"#"#"#TTTTTTT',
  'T.TT.TTT######TT,,TWWWTTT.TT.TT.TT.TTTWWWTT.T,,,,,,,,,,TTT.TT.TT',
  'TTTTTTTTTTTTTTTT,,TWWWTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTT,,TTTTTTTTT',
  'T.TT.TT.TT.TT.TT,CTWWWWWWWWWWWWWWWWWWWWWWTT.TT.TT.TTT,,TTT.TT.TT',
  'TTTTTTTTTTTTTTTT,,TWWWWWWWWWWWWWWWWWWWWWWFFFFFFFFFFFF,,FFFFFFTTT',
  'T.TT.TT.TT.TT.TT,,TWWWWWWWWWWWWWWWWWWWWWWTT.TT.TT.TTT,,TTT.TT.TT',
  'TTTTTTTTTTTTTTTT,,,ggggCgggggTWWWTggggCgggTTTTTTTTTTT,,TTTTTTTTT',
  'T.TT.TT.TT.TTT,,,,TggggggggggTWWWTggggCgggT.TT.TTT,,,,,TTT.TT.TT',
  'TTTTTTTTTTTTTT,,TTTTTTTT..TTTTWWWTT,,,,,,,,,TTTTTT,,TTTTTTTTTTTT',
  'T.TT.T.....TTT,,TTT.TT.T..TT.TWWWTT,,TTTTTvvvvvvv,,,TTT.TT.TT.TT',
  'TTTTTT.....TTT,,,,,,,,,T..TTTTWWWTT,,TTTTTvvvvvvvTTTTTTTTTTTTTTT',
  'T.TT.T.....TTT,,TTTT,,TTTTTT.TWWWTT,,TTT.TvvvvvvvTTT.TT.TT.TT.TT',
  'TTTTTT.....TTT,,TTTT,,,,,,,,,TWWWTT,,,,,,,vvvvvvvTTTTTTTTTTTTTTT',
  'T.TT.T.....TTT,,TTTTTTTTT,,,,MMMMMMTT,,TTTTTTTTTTTTT.TT.TT.TT.TT',
  'TTTTTTT,,,,,,,,,,TTTTTTTTTTTTMMMMMM,,,,TTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TTTTTTTTTT,,TT.TT.TT.TTTTWWWTTTTTTT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTT,,,,,,,TTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TTTTTT,,TTT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTT,,,,,TTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TTT,,TTTTTT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T.TT.TT.TT.TT.TT.TT.TT.TT.TT.TWWWT.TT.TT.TT.TT.TT.TT.TT.TT.TT.TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const APPROVED_VIRIDIAN_FOREST = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTT.I..TTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTT....TTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTg.g.TTTT.....TTTTTTTTTTTTT',
  'TTTTTTgTgTTggg.....TTTTTTTTTTTTT',
  'TTTTgggTgTTgTT..*.ggggTTTTTT...T',
  'TTTTgTTTggggTT..g..TTgTTTTTT...T',
  'TT..g.TTTTTTTTTTgTTTTgTT......XT',
  'TT.L.gggTTTTTTgggTTTTggg...gg..T',
  'TT....TgTTTTTTgTTTTTTTTggL..TTTT',
  'TT...gTgggTTTTgTTTTTTTTT..g.TTTT',
  'TTTTTgTTTgTTT.g..TTTTTTTTTgTTTTT',
  'TTTTTgTTTgggg..L.TTTTTTTTTgggTTT',
  'TTTgggTTTTTTT...gggTTTTTTTTTgTTT',
  'TTTgTTTTTTTTTg...TgTTTTTTTTTgTTT',
  'TTTggTTTTTTTTgTTTTggTTTTTTTggTTT',
  'TT..g.TTTTTgggTTT..g.TTTTTTgTTTT',
  'TT..LgggTTTgTTTTT.H.ggggTTTggTTT',
  'TT....TgTTTgTTTTT..L.TTgTT..g.TT',
  'TXg...TgggTgTTTTT...gTTgggg...TT',
  'TTTTTTTTTgTgg...TTTTgTTTTT.L.LTT',
  'TTTTTTTTTgTT..L.TTTTgTTTTT..g.TT',
  'TTTTTTTTTggggL..TTTTgggTTTTTgTTT',
  'TTTTTTTTTTTT..g.TTTTTTgTTTTTgTTT',
  'TTTTTTTTTTTTTTgTTTTTTggTTTgggTTT',
  'TTTTTTTTTTTTTTgggggTTgTTTTgTTTTT',
  'TTTTTTTTTTTTTTTTTTgTTgTggggTTTTT',
  'TTTTTTTTTTTTTTTTTTg..gggTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.....TTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT..XL.TTTTTTTTT',
  'TTTTTTTTTTTTTTTTTT.....TTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

describe('approved map designs', () => {
  it.each([
    ['Pallet Town', sketchPalletTown, APPROVED_PALLET_TOWN],
    ['Floodplain Relay', sketchFloodplainRelay, APPROVED_FLOODPLAIN_RELAY],
    ['Viridian Forest', sketchViridianForest, APPROVED_VIRIDIAN_FOREST],
  ])('builds %s exactly as it was drawn', (_name, sketch, approved) => {
    expect(sketch().toGrid()).toEqual(approved);
  });
});
