import { MapSketch } from '../mapGrid';
import type { KantoPropName } from '../tileset/kantoTileset';

/**
 * Viridian City - the crossroads.
 *
 * 72x76, drawn on `KANTO_TILESET`: FireRed's own route conifer, fence, paving
 * and Viridian's own buildings. The one town in Kanto every player has walked
 * through, and the one piece of the game's own geography the raid maps did not
 * have: Route 1 comes up from Pallet into its south side, the Forest's South
 * Road leaves from its north, and west of it is the League road.
 *
 * The idea is the town's canon one, three roads out of a hub, and every road is
 * a different kind of ground with a different price:
 *
 * - **south**, THE SOUTH TERRACES: Route 1's ledges. Down is three hops; up is
 *   the long road round every one of them, with a trainer on it.
 * - **north**, THE FOREST ROAD: Route 2's grass beds between tree walls, to the
 *   Forest gatehouse.
 * - **west**, THE LEAGUE ROAD: Route 22's ponds and ledges, up a tree-walled
 *   lane to the Pokemon League Front Gate - and a keeper at its fence.
 *
 * The town between them is fast and bare: paved streets, buildings on their
 * lots, fences, and nothing that costs a fight. The wood to the east has a way
 * out nobody is watching.
 *
 * Trees stand on FireRed's lattice (`tileset/lattice.ts`): a wood is drawn in
 * whole trees, two tiles wide, bodies on even rows - so every `T` mass here
 * starts on an even column and an even row and ends on odd ones. A `T` no whole
 * tree covers draws as a bush, which is what the few beside the League gate are.
 *
 * Legend: `.` grass, `"` mown turf, `g` tall grass, `d` sand road, `P` paving,
 * `T` wood, `C` rock, `W` water, `F` fence, `#` hedge; `<` `=` `>` a ledge's
 * west end, run and east end; `f` flowers on grass and `r` on turf; `o` a bush
 * on grass, `u` on turf and `k` on paving.
 */
export function sketchViridianCity(): MapSketch<KantoPropName> {
  const map = new MapSketch<KantoPropName>({
    width: 72,
    height: 76,
    fill: 'T',
    stamps: {
      '<': { prop: 'bankWest', anchor: [0, 0], ground: '.' },
      '=': { prop: 'bank', anchor: [0, 0], ground: '.' },
      '>': { prop: 'bankEast', anchor: [0, 0], ground: '.' },
      f: { prop: 'flowers', anchor: [0, 0], ground: '.' },
      r: { prop: 'flowers', anchor: [0, 0], ground: '"' },
      o: { prop: 'shrub', anchor: [0, 0], ground: '.' },
      u: { prop: 'shrub', anchor: [0, 0], ground: '"' },
      k: { prop: 'shrub', anchor: [0, 0], ground: 'P' },
    },
  });

  // == THE NORTH: the League gate, Route 2 and Diglett's hill ===============
  map.draw(0, 0, [
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTPPPPPPPPP""""""""FTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTr""PPPP""""urrru"FTTTTTTTTTTTTPPPPPPPPTTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTTru"PPPP"u""""""""F..............dddd..TTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTT"""PPPPPPPPPPPPPPFdddddddddddd..dddd..TTTTTTTTTTCCCCCCCCCCTTTTTTTTTT',
    'TTTT"""PPPPPPPPPPPPPPFdddddddddddd..TTTT......TT..............TTTTTTTTTT',
    'TTTT""rPPPP""""""""""Fggggggg.......TTTT......TT..............TTTTTTTTTT',
    'TTTT"urPPPP"u""urrru"Fggggggggdddddddddd..TTgggggg..................TTTT',
    'TTTT"""PPPP""""""""""Fggggggggdddddddddd..TTgggggg....FFFFFFFFFFFFFFTTTT',
    'TTTTFFFFFFFFFFFFFFFFFFggggTTggddTTTTTTTT..TTgggggg....F............FTTTT',
    'TTTT####......CCCCCCCCggggTTggddTTTTTTTT..TTgggggg....F............FTTTT',
    'TTTTTTTTdd..TTCCCCCCCCggggggggddTTTTTTTT..TTgggggg....F............FTTTT',
    'TTTTTTTTdd..TTCCCCCCCCggggggggddTTTTTTTT..TTgggggg....F............FTTTT',
    'TTTTTTTTdd..TTCCCCCCCCggggggggdddddddddd..<======>TTTTF............FTTTT',
    'TTTTTTTTdd..TTCCCCCCCCggggggggdddddddddd..........TTTTFFFFFFFFFFFFFFTTTT',
    'TTTTTTTTdd..TTCCCCCCCCTTTTTTTTTTTTTTddddTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTdd..TTCCCCCCCCTTTTTTTTTTTTTTddddTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // == THE TOWN, with the League road west of it and the wood east ==========
  map.draw(0, 22, [
    'TTTTTTTTddgggggg..TTTTTT""""""""TTTTddddTTTT..PPPPPPPPPP..TTTTTTTTTTTTTT',
    'TTTTTTTTddgggggg..TTTTTT""""""""TTTTddddTTTT..PPPPPPPPPP..TTTTTTTTTTTTTT',
    'TTTTTTTTddggWWWWWWW...TT""""""""TTTTPPTTTTTT..PPPPPPPPPP..TTTTTTTTTTTTTT',
    'TTTTTTTTddggWWWWWWW...TT""""""""TTTTPPTTTTTT..PPPPPPPPPP..TTTTTTTTTTTTTT',
    'TTTTTT..ddggWWWWWWW...TT""""""""TTTTPPPP......PPPPPPPPPP......TTTTTTTTTT',
    'TTTTTT..ddggWWWWWWW...TT""""""""TTTTPPPP..r"..PPPPPPPPPP..r"..TTTTTTTTTT',
    'TTTTTTTTddggWWWWWWW...TT""""""""TTTTTTPP.."r..PPPPPPPPPP.."r..TTTTTTTTTT',
    'TTTTTTTTddgggggggggg..TT""""""""TTTTTTPP......PPPPPPPPPP......TTTTTTTTTT',
    'TTTTTTTTdd............TTFFF..FFF....PPPPPPPPPPPPPPPPPPPPPPPPPPTTTTTTTTTT',
    'TTTTTTTTddo<=========>TT............PPPPo<===================>TTTTTTTTTT',
    'TTTTTT..ddddddddddddddTTPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTTTTTTTT',
    'TTTTTT..ddddddddddddddTTPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTTTTTTTT',
    'TTTTTT..ddddddddddddddTTPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTTTTTTTT',
    'TTTTTTgg.....ddd..ddddTT............PPPPFFFFFFFF...FFFFFFFFFFFTTTTTTTTTT',
    'TTTTgggg.....ddd..dddddd........TTTTPPPP........................TTTTTTTT',
    'TTTTgggg.....ddd..dddddd........TTTTPPPP........................TTTTTTTT',
    'TTTTgggg.....dddCCCCCCTT.WWWWWW.TTTTPPPP........................TTTTTTTT',
    'TTTTgggg.....dddCCCCCCTT.WWWWWW.TTTTPPPP........................TTTTTTTT',
    'TTTTggggTTTT.dddCCCCCCTT.WWWWWW.TTTTPPPP........................f.....TT',
    'TTTTggggTTTT.dddCCCCCCTT.WWWWWW.TTTTPPPP.............................fTT',
    'TTTTggggTTTT.dddCCCCCCTT.WWWWWW.....PPPPPkPPPPPkPPPPPPPPPPPPPPTT......TT',
    'TTTTggggTTTT.dddCCCCCCTT.WWWWWW.....PPPPPPPPPPPPPPPPPPPPPPPPPPTT......TT',
    '.............ddd......TT............PPPPP#######r"r"PPPPTTTTTTTT........',
    'TT...........ddd......TT.f...f......PPPPP"r"r"r"""""PPPPTTTTTTTTf.....TT',
    'TTTTTTgg..gg.ddd..TTTTTT..f......f..PPPPP""""""""r"rPPPPTTTTTTTTTT..TTTT',
    'TTTTTTgg..gg.ddd..TTTTTT............PPPPP""r"r"r""""PPPPTTTTTTTTTT..TTTT',
    'TTTTTTgg..gg.ddd..TTTTTTFFFFFFFF....TTPPFFFFFFFF....FFFFFFF...TTTT..TTTT',
    'TTTTTTgg..gg.ddd..TTTTTT""""""".....TTPP."""""".....""""""....TTTT..TTTT',
    'TTTTTTgg..ggTTTT..TTTTTT""""""".TTTTPPPPf"""""".TTTT""""""TTTTTTTT..TTTT',
    'TTTTTTgg..ggTTTT..TTTTTT""""""".TTTTPPPP."""""".TTTT""""""TTTTTTTT..TTTT',
    'TTTTTTTT....TTTT..TTTTTT""""""".TTTTPPTT."""""".TTTT"""""rTTTTTTTT..TTTT',
    'TTTTTTTT....TTTT..TTTTTT""""""".TTTTPPTT."""""".TTTT""""""TTTTTTTT..TTTT',
    'TTTTTTTT.....ddd..TTTTTTPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTT..TTTT',
    'TTTTTTTT.....ddd..TTTTTTPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTT..TTTT',
    'TTTTTTTT.....dddTTTTTTTT<=========>oddddo<===================>TTTT..TTTT',
    'TTTTTTTT.....dddTTTTTTTT............dddd......................TTTT..TTTT',
  ]);

  // == THE SOUTH: Route 1's terraces, and the ranger's hut ==================
  map.draw(0, 58, [
    'TTTTTTgggggg...dddggggTT..dddddddddddddd.gggggggggTTTTTT............TTTT',
    'TTTTTTgggggg...dddggggTT..dddddddddddddd.gggggggggTTTTTT............TTTT',
    'TTTTTTgggggg...dddggggTT..dddddddddddddd.gggggggggTTTTTT......TTTTTTTTTT',
    'TTTTTTgggggg...dddggggTT..dddd..ff.......gggggggggTTTTTT......TTTTTTTTTT',
    'TTTTTTgggggg...dddggggTT..dddd.......ff...............TTTTTTTTTTTTTTTTTT',
    'TTTTTT.........dddggggTT..dddd<============>o<=======>TTTTTTTTTTTTTTTTTT',
    'TTTTTT.........dddddddddddddTTdddddddddddddddddddddddd..TTTTTTTTTTTTTTTT',
    'TTTTTT.........dddddddddddddTTdddddddddddddddddddddddd..TTTTTTTTTTTTTTTT',
    'TTTTTT.........dddddddddddddddddddddddddTTdddddddddddd..TTTTTTTTTTTTTTTT',
    'TTTTTT..""""".............ggggggggggggggTTggggggggdddd..TTTTTTTTTTTTTTTT',
    'TTTTTT..""""".............gggggggogggggggggggoggggdddd........TTTTTTTTTT',
    'TTTTTT.."""""...........o<======================>odddd........TTTTTTTTTT',
    'TTTTTT""""""""""""TTTT..............dddddddddddddddddd..TTTT..TTTTTTTTTT',
    'TTTTTT"r"r""r"r"""TTTT..............dddddddddddddddddd..TTTT..TTTTTTTTTT',
    'TTTTTT""""""""""""TTTT..TTTTTTTTTTTTddddTTdddddddddddd..TTTT..TTTTTTTTTT',
    'TTTTTT""r""""r""""TTTT..TTTTTTTTTTTTddddTT..............TTTT..TTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTddTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTdTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);

  // Every building is FireRed's own, planted whole; the prop is the last word
  // on its own tiles (`kantoTileset.ts`).
  map.plant(4, 0, 'leagueGate');
  map.plant(34, 0, 'forestGate');
  map.plant(56, 9, 'caveMouth');
  map.plant(59, 14, 'cottageDoor');
  map.plant(25, 23, 'houseDoor');
  map.plant(48, 24, 'gym');
  map.plant(47, 27, 'signGym');
  map.plant(42, 37, 'pokemonCenterDoor');
  map.plant(51, 38, 'pokeMartDoor');
  map.plant(56, 38, 'house');
  map.plant(24, 49, 'house');
  map.plant(41, 49, 'houseFlowers');
  map.plant(52, 49, 'house');
  map.plant(8, 67, 'cottageDoor');

  return map;
}
