/**
 * REEDMERE, the marsh in the south-west of Greystone Vale.
 *
 * The one idea: boardwalks over reed beds round a still mere - tall grass
 * everywhere, and the dry way is the long way. The lane comes down from
 * Millbrook onto a boardwalk that goes round: east past the mere to the trail
 * for Gull Strand, then south and west the long way to the Mere Path, the way
 * off the map. Anyone in a hurry wades straight through the reeds instead, and
 * pays for it in fights. A jetty runs out into the mere, and a spur through the
 * reeds in the south-west ends at the duck hide.
 *
 * The boardwalks are earth, two wide (a raised causeway is what reads as one
 * on this sheet); the wood round the marsh is drawn a letter a lattice cell.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The basin, a letter a lattice cell: T the wood round it, g the reed beds. */
const BASIN = [
  'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTgggg.gggTTTTTTTT',
  'TTTTTTTTgggggggggggggggggggTTTTT',
  'TTTTTgTgggggggggggggggggggggTTTT',
  'TTTTggTggggggggggggggggggggggTTT',
  'TTTgggggggggTggggggggggggggggTTT',
  'TTTgggggggggggggggggggggggggggTT',
  'TTTgggggggggggggggggggggggggggTT',
  'TTTgggggggggggggggggggggggTgg...',
  'TTggggggggggggggggggggggggTTggTT',
  'TTgggggggggggggggggggggggggggTTT',
  'TTgggggggggggggggggggggggggggTTT',
  '..gggggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTgggggggggggggggggggggggggggTT',
  'TTTggggggggggggggggggggggggTggTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTgggggggggggggggggggggggggTTTT',
  'TTTTgTggggggggggggggggggggggTTTT',
  'TTTTgggggggggggggggggggggggTTTTT',
  'TTTTgggggggggggggggggggggggTTTTT',
  'TTTTggggggggggggggggggggggTTTTTT',
  'TTTTTgggggggggggggggggTggTTTTTTT',
  'TTTTTTgggggggggggggggggTTTTTTTTT',
  'TTTTTTTTgggggggggggTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export function reedmere(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'reedmere');
  p.cells(BASIN);

  // -- The hummock: dry ground in the north-west where the reeds give out ------
  p.draw(14, 10, [
    '    ..........    ',
    '  ..............  ',
    ' .................',
    '..................',
    ' ................ ',
    '   ...........    ',
    '      ......      ',
  ]);

  // -- The mere, still and wide, its north bank grassed, reed to the water elsewhere
  p.draw(20, 22, ['     ............     ', '  ..................  ']);
  p.draw(18, 25, [
    '      WWWWWWWWWW        ',
    '   WWWWWWWWWWWWWWWW     ',
    '  WWWWWWWWWWWWWWWWWWW   ',
    ' WWWWWWWWWWWWWWWWWWWWW  ',
    'WWWWWWWWWWWWWWWWWWWWWWW ',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWW ',
    ' WWWWWWWWWWWWWWWWWWWWWW ',
    ' WWWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWWW   ',
    '    WWWWWWWWWWWWWWWW    ',
    '       WWWWWWWWW        ',
  ]);
  // Pools left in the reeds, each its own shape.
  p.draw(50, 6, ['  WWWW', 'WWWWWW', 'WWWWW ', ' WW   ']);
  p.draw(10, 10, [' WWW  ', 'WWWWWW', ' WWWWW']);
  p.draw(52, 38, ['WWW ', 'WWWW', 'WWWW', ' WW ']);
  // Channels: the pool in the north-east drains down to the mere, and the mere
  // out to the south-west, each winding through the reeds.
  p.river([[52, 10], [52, 15], [48, 15], [48, 22], [42, 22], [42, 26]], { width: 2 });
  p.river([[22, 36], [22, 41], [18, 41], [18, 48], [24, 48], [24, 53]], { width: 2 });

  // -- Dry ground: where the lane comes in, the west end, the hide ------------
  p.meadow(38, 4, 6, 4).meadow(4, 24, 8, 6).meadow(6, 48, 10, 6);

  // -- The boardwalk: the dry way, and the long way ---------------------------
  p.road([[40, 2], [40, 10], [46, 10], [46, 18], [61, 18]], { letter: ',' });
  p.road([[46, 18], [46, 34], [44, 34], [44, 44], [30, 44], [30, 46], [12, 46], [12, 26], [2, 26]], {
    letter: ',',
  });
  p.road([[46, 30], [38, 30]], { letter: ',' }); // the jetty, out over the mere
  p.road([[12, 46], [12, 50]], { letter: ',' }); // the spur to the hide
  p.building('shed', 9, 49, { lot: '.' });

  const file = districtFile(GREYSTONE_VALE, 'reedmere', p, {
    dropIns: [],
    itemSpots: [{ x: 38, y: 31 }, { x: 54, y: 12, hidden: true }, { x: 22, y: 52 }],
    extra: {
      landmarks: [
        { x: 39, y: 30, name: 'The Mere', kind: 'jetty' },
        { x: 13, y: 52, name: 'Duck Hide', kind: 'hide' },
      ],
      signs: [
        { x: 42, y: 4, lines: ['REEDMERE', 'The boardwalk goes round. The reeds go through.'] },
      ],
      people: [
        {
          x: 15,
          y: 51,
          name: 'Birder Tess',
          look: 'old-woman',
          facing: 'left',
          lines: ['Hush. The ducks only come in when nobody wades the reeds.'],
        },
      ],
      trainers: [
        {
          x: 44,
          y: 31,
          name: 'Netter Fen',
          team: 'netter',
          look: 'fisherman',
          facing: 'left',
          sight: 2,
          lines: ['The mere is mine at this hour. Fight for it!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
