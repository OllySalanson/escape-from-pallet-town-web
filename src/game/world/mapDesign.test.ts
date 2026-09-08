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

const APPROVED_FLOODPLAIN_RELAY = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWW.WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW.I.WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWS.,...WWWWWWWWWWWWW',
  'WWWWWggggWggggg,WW.WWWWWWWWWWWWW',
  'WWWWWgWWgWWgWWW,...WWWWWWWWWWWWW',
  'WWWWWggggWggg,,,W.*...WWWWWWWWWW',
  'WWWWWgWWWWWWW,WWWWWXW.WWWWWWWWWW',
  'WWWWggggWgggg,WWWWWWW.WWWWWWWWWW',
  'WWWWWWgWWWgWW,WWWWWWW....WWWWWWW',
  'WWWWgggggWggg,,,WWWWWWWW.WWWWWWW',
  'WWWWWWWLWWgWWWW,WWWWWWWW....WWWW',
  'WWWWggggWgggWWW,,,,,,WWWWWW.WWWW',
  'WWWWWgWWWgWWWWW,WWWS,WWWWWW.WWWW',
  'WWWWggggWggLWWW,WWWW,,,WWW,*WWWW',
  'WWWWWWgWWWgWW,,HWWWWWW,,,,,WWWWW',
  'WWWWgggggWggg,WWWWWWWWWWWWWWWWWW',
  'WWWWWgWWgWWgW,WWWWWWWWWWWWWWWWWW',
  'WWWWgggWggggg,WWWWWWWWWWWWWWWWWW',
  'WWWWWWgWgWgWW,,,WWWWWWWWWWWWWWWW',
  'WWWWgggXgWggWWW,WWWWWWWWWWWWWWWW',
  'WWWWWWgWWWgWWWW,WWWWWWWWWWWWWWWW',
  'WWWWggggWggOWWW,WWWWWWWWWWWWWWWW',
  'WWWWW.WWWWWWWWW,WWWWWWWWWWWWWWWW',
  'WWWWW.WW....W,,,,,WWWWWWWWWWWWWW',
  'WWWWW....WW.W,WWW,WWWWWWWWWWWWWW',
  'WWWWWWWWWWW..,,,,,WWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWXWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
