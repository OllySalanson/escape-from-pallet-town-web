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
import type { MapProgram } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The basin, a letter a lattice cell: T the wood round it, g the reeds that are its floor. */
const BASIN = [
  'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTggggggggTTTTTTTT',
  'TTTTTTTTgggggTTTgggggggggggTTTTT',
  'TTTTTgTggggggTTTggggggggggggTTTT',
  'TTTTggTggggggTTTgggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTgggggggggggggggggggggggggggTT',
  'TTTgggggggggggggggggggggggggggTT',
  'TTTgggggggggggggggggggggggTgg...',
  'TTggggggggggggggggggggggggTTggTT',
  'TTgggggggggggggggggggggggTTggTTT',
  'TTgggggggggggggggggggggggTTggTTT',
  '..gggggggggggggggggggggggTTggTTT',
  'TTTTTggggggggggggggggggggggggTTT',
  'TTTTTggggggggggggggggggggggggTTT',
  'TTTTTTggggggggggggggggggggggggTT',
  'TTTTTTggggggggggggggggggggggggTT',
  'TTTTTggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTggggggggggggggggggggggggggTTT',
  'TTTgggggggggggggggggggggTTTgTTTT',
  'TTTTggggggggggggggggggggTTTgTTTT',
  'TTTTggggggggggggggggggggTTTTTTTT',
  'TTTTggggggggggggggggggggTTTTTTTT',
  'TTTTggggggggggTTTgggggggggTTTTTT',
  'TTTTTgggggggggTTTggggggggTTTTTTT',
  'TTTTTTgggggggggggggggggTTTTTTTTT',
  'TTTTTTTTgggggggggggTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

/**
 * Reed beds with clean edges: a reed with one reed beside it or none is
 * trodden flat, a bare tile walled by reeds on three sides grows over, and a
 * bed of fewer than ten reeds goes. Judged blind, the slivers and nibbles a
 * marsh drawn stroke by stroke leaves were what read as generated.
 */
function settleReeds(p: MapProgram): void {
  const at = (x: number, y: number) => p.at(x, y);
  for (let pass = 0; pass < 2; pass += 1) {
    const flips: [number, number, string][] = [];
    for (let y = 1; y < p.height - 1; y += 1) {
      for (let x = 1; x < p.width - 1; x += 1) {
        const reeds = [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)].filter(
          (letter) => letter === 'g',
        ).length;
        if (at(x, y) === 'g' && reeds <= 1) flips.push([x, y, '.']);
        if (at(x, y) === '.' && reeds >= 3) flips.push([x, y, 'g']);
      }
    }
    for (const [x, y, letter] of flips) p.put(x, y, letter);
  }
  const seen = new Set<string>();
  for (let y = 0; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      if (at(x, y) !== 'g' || seen.has(`${x},${y}`)) continue;
      const bed: [number, number][] = [];
      const queue: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        bed.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (at(nx, ny) === 'g' && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            queue.push([nx, ny]);
          }
        }
      }
      if (bed.length < 10) for (const [bx, by] of bed) p.put(bx, by, '.');
    }
  }
}

export function reedmere(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'reedmere');
  p.cells(BASIN);

  // A verge of trodden grass either side of the boardwalk (laid below), so it
  // reads as a walk through the reeds.
  const verge = (points: readonly (readonly [number, number])[]) =>
    p.road(points.map(([x, y]) => [x - 1, y - 1] as const), { width: 4, letter: '.' });
  verge([[40, 2], [40, 10], [46, 10], [46, 18], [61, 18]]);
  verge([[46, 18], [46, 34], [44, 34], [44, 44], [30, 44], [30, 46], [12, 46], [12, 26], [2, 26]]);

  // -- Ground the reeds give way to: the hummock in the north-west, and the
  // mere's north bank. Everything else not water or boardwalk is reeds.
  p.draw(14, 9, [
    '     ..........      ',
    '  ................   ',
    ' ....................',
    '.....................',
    ' ................... ',
    '   ..............    ',
    '      ........       ',
  ]);
  p.draw(22, 22, ['    ............    ', '  ................  ']);

  // Trodden lanes through the reeds, where the wildfowlers walk: they part the
  // marsh into beds, and none of them is the dry way.
  p.trail([[20, 15], [20, 19], [8, 19], [8, 22]]);
  p.trail([[50, 22], [56, 22], [56, 32]]);
  p.trail([[16, 35], [16, 44]]);

  // -- The mere, still and wide, its north bank grassed, reed to the water elsewhere
  p.draw(18, 24, [
    '      WWWWWWWWWWWW      ',
    '    WWWWWWWWWWWWWWWW    ',
    '  WWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWWWW  ',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    '  WWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWW    ',
    '    WWWWWWWWWWWWWW      ',
    '      WWWWWWWWWW        ',
  ]);
  // One pond in the north-east reeds, where the trail for the strand turns off.
  p.draw(50, 6, ['  WWWWWW', 'WWWWWWWW', 'WWWWWWWW', '  WWWW  ']);

  // -- Dry ground: where the lane comes in, the west end, the hide ------------
  p.meadow(38, 4, 6, 4).meadow(4, 24, 8, 6).meadow(6, 48, 10, 6);

  settleReeds(p);

  // -- The boardwalk: the dry way, and the long way, over the channels
  p.road([[40, 2], [40, 10], [46, 10], [46, 18], [61, 18]], { letter: ',' });
  p.road([[46, 18], [46, 34], [44, 34], [44, 44], [30, 44], [30, 46], [12, 46], [12, 26], [2, 26]], {
    letter: ',',
  });
  p.road([[46, 30], [38, 30]], { letter: ',' }); // the jetty, out over the mere
  p.draw(36, 33, [' dddd', 'ddddd', 'dddd ']); // a strand of sand where the jetty meets the water
  // Rails along the boardwalk where it runs between the water and the reeds.
  p.fenceLine([[32, 43], [42, 43]]);
  p.road([[12, 46], [12, 50]], { letter: ',' }); // the spur to the hide
  p.building('shed', 9, 49, { lot: '.' });

  // A way nobody signs, down from the reeds through the wood to Smugglers' Cove.
  p.trail([[20, 54], [20, 61]]);

  const file = districtFile(GREYSTONE_VALE, 'reedmere', p, {
    dropIns: [],
    itemSpots: [{ x: 38, y: 31 }, { x: 54, y: 12, hidden: true }, { x: 22, y: 52 }],
    extra: {
      berryTrees: [{ x: 22, y: 11, berry: 'cheri' }],
      // What the reeds are full of, standing where a raid wading them meets it:
      // a Farfetch'd at the reed bed's foot, Poliwag by the water, Venonat and
      // Oddish deep in the beds, Bellsprout on the east bank.
      pokemon: [
        { x: 31, y: 48, species: 'farfetchd', level: 9 },
        { x: 24, y: 36, species: 'poliwag', level: 8 },
        { x: 14, y: 20, species: 'poliwag' },
        { x: 35, y: 19, species: 'venonat', level: 8 },
        { x: 8, y: 14, species: 'oddish' },
        { x: 55, y: 40, species: 'bellsprout', level: 8 },
      ],
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
        {
          x: 56,
          y: 17,
          name: 'Reed Cutter',
          look: 'straw-hat',
          facing: 'left',
          lines: ['We cut the reeds for thatch.', 'Wade through them if you like. The boardwalk is longer, but you stay dry.'],
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
