/**
 * REEDMERE, the marsh in the south-west of Greystone Vale.
 *
 * The one idea: boardwalks over reed beds round a still mere - tall grass
 * everywhere, and the dry way is the long way. The lane comes down from
 * Millbrook onto a boardwalk that goes round: east past the mere to the trail
 * for Gull Strand, then south and west the long way to the Mere Path, the way
 * off the map. Anyone in a hurry wades straight through the reeds instead, and
 * pays for it in fights.
 *
 * Redrawn on 31 October 2026, the second ring out from Mill Square, because
 * walking it was a lane round a pond: what the boardwalk goes round now is a
 * working fen, and every screen of it is somebody's. Going round from the reed
 * yard: Pond Boy's pond and the Long Drain that runs out of it past the lock
 * hut; the frog pools and the old drainage pump; the staithe, where the punt
 * leaves for Duck Island; MERE END, the marsh's own hamlet, stilt houses on the
 * bay with the street a plank deck along their fronts and the Drowned Duck on
 * it; the turbary behind the eel market, where the peat comes from; Tess's duck
 * hide on its decoy pond; the withy beds; and the Last House on the way out. A
 * way nobody signs still goes south to Smugglers' Cove, past a birdwatcher who
 * has never seen a bird.
 *
 * The boardwalks are the Sevii Islands' plank decking (`boardsSheet.ts`), laid
 * straight through the reeds and over the water alike; the wood round the marsh
 * is drawn a letter a lattice cell.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapProgram } from '../../program';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { INN_ROOM, withInside } from './insides';
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
  'TTggggggggggggggggggggggggggggTT',
  'TTggggggggggggggggggggggggggggTT',
  'TTggggggggggggggggggggggggggggTT',
  '..ggggggggggggggggggggggggggggTT',
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
  'TTTTggggggggggTTTgggggggTTTTTTTT',
  'TTTTTgggggggggTTTgggggggTTTTTTTT',
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

/** Where the punt ties up: the end of the staithe, and the little deck on Duck Island. */
const STAITHE_END = { x: 40, y: 30 };
const ISLAND_DECK = { x: 27, y: 30 };

export function reedmere(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'reedmere');
  p.cells(BASIN);

  /** A broadleaf with thicket under its crown, so nobody stands hidden under one. */
  const tree = (x: number, y: number, kind: 'tree' | 'tree-2' = 'tree') => {
    p.building(kind, x, y);
    p.block(x, y, 3, 1, '#');
  };
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };
  /** Lilies on the water, and the odd rock showing through it. */
  const lilies = (...spots: readonly (readonly [number, number])[]) => {
    for (const [x, y] of spots) stand('water-lily', x, y, 'W');
  };

  // -- Dry ground the reeds give way to -----------------------------------------------
  // The Hummock in the north-west, the mere's north bank, the staithe's hard, and a
  // bank along the backs of Mere End.
  p.draw(14, 9, [
    '     ..........      ',
    '  ................   ',
    ' ....................',
    '.....................',
    ' ................... ',
    '   ..............    ',
    '      ........       ',
  ]);
  p.draw(22, 21, ['      ........      ', '    ............    ', '  ................  ']);
  p.meadow(42, 26, 4, 8);
  p.meadow(38, 4, 6, 4).meadow(4, 24, 8, 6).meadow(6, 48, 12, 6);
  p.meadow(14, 40, 18, 6);
  p.meadow(4, 38, 8, 8);
  p.meadow(50, 38, 8, 4);
  p.meadow(48, 27, 12, 11);
  p.meadow(34, 50, 12, 6);
  p.meadow(48, 12, 8, 4);

  // Trodden lanes through the reeds, where the wildfowlers walk: they part the
  // marsh into beds, and none of them is the dry way.
  p.trail([[20, 15], [20, 19], [8, 19], [8, 22]]);
  p.trail([[16, 35], [16, 40]]);

  // -- The mere, still and wide, with the bay Mere End stands on ------------------------
  p.draw(14, 24, [
    '          WWWWWWWWWWWW        ',
    '        WWWWWWWWWWWWWWWW      ',
    '      WWWWWWWWWWWWWWWWWWWW    ',
    '    WWWWWWWWWWWWWWWWWWWWWW    ',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWWWWWWWWWWWWWW  ',
    '    WWWWWWWWWWWWWWWWWWWWWW    ',
    '    WWWWWWWWWWWWWWWWWWWW      ',
    '      WWWWWWWWWWWWWWWWWWWWWWWW',
    '        WWWWWWWWWWWWWWWWWWWWWW',
    '           WWWWWWWWWWWWWWWWWWW',
    '             WWWWWWWWWWWWWWWWW',
    '             WWWWWWWWWWWWWWWWW',
    '             WWWWWWWWWWWWWWWWW',
    '                WWWWWWWWWWWWWW',
    '                WWWWWWWWWWWWWW',
    '                WWWWWWWWWWWWWW',
    '                WWWWWWWWWWWWWW',
  ]);
  // Pond Boy's pond in the north-east reeds.
  p.draw(50, 6, ['  WWWWWW', 'WWWWWWWW', 'WWWWWWWW', '  WWWW  ']);
  // The Long Drain, ruled straight by somebody long dead, from the pond to the frog pools.
  p.block(50, 9, 2, 13, 'W');
  p.block(50, 20, 6, 2, 'W');
  p.draw(52, 22, ['  WWWWW ', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', ' WWWWW  ']);
  // Black pools in the deep of the beds, where nothing has ever been dry.
  p.draw(36, 14, [' WWWW ', 'WWWWWW', ' WWW  ']);
  p.draw(9, 15, [' WWW ', 'WWWWW', ' WWWW']);
  // The decoy pond, under the hide's window.
  p.draw(14, 50, ['  WWWWWW ', ' WWWWWWWW', 'WWWWWWWWW', 'WWWWWWWW ', ' WWWWW   ']);

  settleReeds(p);

  // -- The reed yard, where the lane comes down from the village ----------------------
  // What the marsh is for: the thatchers' store, the day's bundles stacked to dry
  // and somebody tying more.
  p.meadow(32, 4, 8, 6).meadow(42, 4, 4, 5);
  p.building('shed', 33, 4);
  p.building('crate-pair', 37, 4).building('sack', 39, 4).building('sack', 38, 6).building('sack', 39, 7);
  p.building('barrel', 43, 5);
  p.flowers([32, 8], [44, 7]);

  // -- The Hummock: a dry bank somebody has been coming back to for years ------------
  tree(30, 10, 'tree-2');
  p.building('big-stump', 26, 13).building('log', 18, 13);
  p.building('stump', 23, 14).building('stump', 28, 13);
  p.flowers([24, 11], [28, 10], [20, 12], [17, 12]);
  // The north bank, and the fisher's boards out over the water.
  p.building('bench', 33, 22);
  p.flowers([26, 22], [36, 23]);

  // -- The boardwalk: the dry way, and the long way -------------------------------------
  p.road([[40, 0], [40, 9]], { letter: ',' }); // the lane, down through the yard
  p.road([[40, 10], [46, 10], [46, 18], [55, 18]], { letter: '_' });
  p.road([[56, 18], [61, 18]], { letter: ',' }); // ...and the bank on to Gull Strand
  p.road([[46, 18], [46, 34], [44, 34], [44, 44], [30, 44], [30, 46], [6, 46]], { letter: '_' });
  p.road([[12, 46], [12, 26], [6, 26]], { letter: '_' });
  p.road([[2, 26], [5, 26]], { letter: ',' }); // the Mere Path, out through the wood
  p.road([[48, 12], [55, 12]], { letter: '_' }); // Pond Boy's boards, over the drain
  p.road([[48, 34], [51, 34]], { letter: '_' }); // the walk out to the pump

  // -- The pond and the drain ---------------------------------------------------------
  p.road([[54, 8], [54, 10]], { letter: '_' });
  lilies([51, 7], [53, 6], [57, 8], [56, 7]);
  stand('wet-rock', 55, 6, 'W');
  stand('hut', 52, 13);
  stand('barrels', 53, 15 + 1);
  stand('mooring-post', 49, 14);
  p.flowers([48, 15], [55, 14]);

  // -- The frog pools and the old drainage pump ----------------------------------------
  stand('roundhouse', 53, 30);
  stand('stump', 52, 35);
  stand('crate-stack', 50, 31);
  stand('log', 48, 36);
  lilies([54, 23], [57, 22], [59, 25], [55, 25], [58, 24]);
  stand('wet-rock', 56, 24, 'W');
  p.flowers([49, 33], [57, 31], [50, 36]);

  // -- The staithe, where the mere meets the boardwalk ------------------------------------
  p.road([[STAITHE_END.x, STAITHE_END.y], [45, STAITHE_END.y]], { letter: '_' });
  stand('shed', 42, 22, '.');
  stand('barrels', 44, 26);
  stand('crate-pair', 42, 32);
  stand('mooring-post', 42, 28);
  p.road([[30, 23], [30, 25]], { letter: '_' });

  // -- Duck Island, out in the mere: the punt's the only way ----------------------------
  p.draw(20, 27, ['  ......', ' .......', '........', '........', '........', ' .......', '  .....']);
  p.block(26, ISLAND_DECK.y, 2, 2, '_');
  tree(21, 28);
  stand('stump', 25, 28);
  stand('log', 22, 32);
  p.bedRows([31, 21, 24], [32, 25, 26]);
  p.flowers([26, 29], [21, 30], [27, 28]);
  lilies([33, 26], [36, 33], [18, 30], [31, 35], [19, 33], [28, 25]);
  stand('wet-rock', 35, 27, 'W');
  stand('wet-rock', 30, 33, 'W');

  // -- MERE END: stilt houses on the bay, the street a deck along their fronts --------------
  p.building('warden-house', 38, 39, { lot: 'W' }); // the Drowned Duck
  p.building('cottage', 32, 41, { lot: 'W' });
  p.put(37, 43, '_');
  stand('mooring-post', 31, 42, 'W');
  stand('mooring-post', 37, 41, 'W');
  lilies([31, 38], [36, 37], [42, 36], [39, 37]);
  // West of the bay, the row on dry ground: the net loft, the smokehouse and the
  // cottage at the end.
  p.building('timber-house', 24, 41);
  p.building('hut', 21, 43);
  p.building('cottage', 15, 43);
  p.flowers([20, 45], [23, 44], [14, 45]);
  stand('barrel', 29, 44);
  stand('fence-post', 18, 41);
  // The eel market, on the widened deck: what Mere End does for a living.
  p.block(33, 46, 9, 4, '_');
  stand('striped-stall', 35, 46);
  stand('barrels', 40, 48);
  stand('produce-crate', 40, 46);
  stand('crate-pair', 33, 46);
  // Behind it the boards run on, south to the peat.
  p.road([[42, 46], [42, 51]], { letter: '_' });

  // -- The turbary: the peat, cut in strips and stacked to dry --------------------------------
  p.block(34, 50, 7, 2, ',').block(34, 53, 8, 2, ',');
  stand('shed', 44, 50);
  stand('log', 38, 52);
  stand('log', 34, 52);
  stand('crate-stack', 44, 54);
  stand('stump', 41, 52);

  // -- The duck hide, on its pond --------------------------------------------------------------
  p.road([[12, 46], [12, 50]], { letter: '_' });
  p.building('shed', 8, 48, { lot: '.' });
  stand('bench', 9, 53);
  stand('lapras-doll', 17, 51, 'W');
  lilies([20, 53], [15, 53], [20, 51], [16, 50]);
  stand('wet-rock', 21, 52, 'W');

  // -- The withy beds, west of the boardwalk: the osiers in rows -----------------------------------
  for (const x of [5, 7, 9]) {
    stand('tall-bush', x, 39);
    p.put(x, 39, '#');
  }
  stand('hut', 6, 43);
  stand('crate-pair', 8, 43);
  stand('barrel', 10, 44);
  p.flowers([4, 42], [11, 44]);

  // -- The Last House, on the way out -----------------------------------------------------------------
  p.building('grey-house', 5, 22, { lot: '.' });
  p.flowers([4, 24], [10, 24], [10, 29]);
  stand('bench', 7, 28);

  // -- The bog oak, in the eastern reeds ---------------------------------------------------------------
  stand('dead-stump', 54, 40);
  stand('log', 51, 39);
  stand('big-stump', 56, 38);

  // A way nobody signs, down from the reeds through the wood to Smugglers' Cove.
  p.trail([[20, 54], [20, 61]]);
  p.meadow(22, 54, 4, 4);
  stand('crate-stack', 24, 54);
  stand('barrels', 22, 54);
  p.bushes([25, 56]);

  const file = districtFile(GREYSTONE_VALE, 'reedmere', p, {
    dropIns: [],
    itemSpots: [
      { x: 42, y: 30 + 1 },
      { x: 54, y: 13, hidden: true },
      { x: 24, y: 56, hidden: true },
      { x: 35, y: 9, hidden: true },
      { x: 24, y: 30, hidden: true },
      { x: 50, y: 39, hidden: true },
      { x: 37, y: 52 + 3 },
    ],
    extra: {
      links: [
        {
          ends: [
            { x: STAITHE_END.x, y: STAITHE_END.y, toward: 'left', look: 'boat' },
            { x: ISLAND_DECK.x, y: ISLAND_DECK.y, toward: 'right', look: 'boat' },
          ],
          sails: { name: 'The Mere Punt', craft: 'punt', from: 0, until: 300, course: [] },
        },
      ],
      districts: [
        { name: 'MERE END', x: 14, y: 39, width: 32, height: 12, wildlife: 'wetland' },
        { name: 'THE STAITHE', x: 38, y: 26, width: 10, height: 8, wildlife: 'wetland' },
        { name: 'DUCK ISLAND', x: 20, y: 26, width: 9, height: 8, wildlife: 'wetland' },
        { name: 'THE HUMMOCK', x: 14, y: 8, width: 22, height: 8, wildlife: 'wetland' },
        { name: 'THE LONG DRAIN', x: 48, y: 8, width: 12, height: 14, wildlife: 'wetland' },
        { name: 'THE OLD PUMP', x: 48, y: 22, width: 12, height: 16, wildlife: 'wetland' },
        { name: 'THE TURBARY', x: 32, y: 51, width: 16, height: 7, wildlife: 'wetland' },
        { name: 'THE DUCK HIDE', x: 6, y: 47, width: 18, height: 10, wildlife: 'wetland' },
        { name: 'THE WITHY BEDS', x: 2, y: 34, width: 10, height: 12, wildlife: 'wetland' },
        { name: 'THE LAST HOUSE', x: 2, y: 20, width: 10, height: 12, wildlife: 'wetland' },
      ],
      berryTrees: [
        { x: 22, y: 11, berry: 'cheri' },
        { x: 26, y: 31, berry: 'sitrus' },
        { x: 11, y: 41, berry: 'chesto' },
      ],
      pokemon: [
        // The yard's Pidgey and the Hummock's Psyduck, as they were.
        { x: 42, y: 7, species: 'pidgey', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 29, y: 13, species: 'psyduck', beat: { everyMs: 2700, roam: [[0, -1]] } },
        // What the reeds are full of, standing where a raid wading them meets it.
        { x: 24, y: 19, species: 'venonat', level: 8 },
        { x: 8, y: 14, species: 'oddish' },
        { x: 40, y: 18, species: 'venonat', beat: { everyMs: 2100, roam: [[0, 1]] } },
        // Pond Boy's Poliwag, and the Drain's Slowpoke, who has not moved since the Drain was dug.
        { x: 56, y: 11, species: 'poliwag', beat: { everyMs: 1900, roam: [[-1, 0]] } },
        { x: 49, y: 16, species: 'slowpoke' },
        // The frog pools.
        { x: 52, y: 28, species: 'poliwag', level: 8, beat: { everyMs: 1400, roam: [[0, 1]] } },
        { x: 58, y: 27, species: 'poliwag', beat: { everyMs: 1700, roam: [[-1, 0], [-1, 1]] } },
        { x: 55, y: 28, species: 'poliwhirl', level: 11 },
        // The staithe's cat, who knows what is in the barrels.
        { x: 42, y: 27, species: 'meowth', beat: { everyMs: 1800, roam: [[1, 0]] } },
        // Duck Island: the ducks.
        { x: 24, y: 28, species: 'psyduck', beat: { everyMs: 2300, roam: [[0, 1], [1, 1]] } },
        { x: 26, y: 28, species: 'psyduck', beat: { everyMs: 2900, roam: [[0, 1]] } },
        { x: 26, y: 33, species: 'golduck', level: 14 },
        // The Farfetch'd on the deck that everybody in Mere End pretends not to feed.
        { x: 35, y: 50 + 1 - 1, species: 'farfetchd', level: 9, beat: { everyMs: 2200, roam: [[1, 0], [2, 0]] } },
        { x: 28, y: 48, species: 'poliwag', level: 8 },
        // The turbary's Diglett, doing the work for free.
        { x: 40, y: 54, species: 'diglett', beat: { everyMs: 1300, roam: [[-1, 0], [-2, 0]] } },
        { x: 38, y: 53, species: 'diglett', level: 8, beat: { everyMs: 1600, roam: [[1, 0]] } },
        // The real ducks on Tess's pond: a Farfetch'd on the bank, and she has counted.
        { x: 22, y: 49, species: 'farfetchd', beat: { everyMs: 2600, roam: [[1, 0]] } },
        // The withy beds' caterpillars.
        { x: 4, y: 40, species: 'metapod' },
        { x: 10, y: 39, species: 'caterpie', level: 7, beat: { everyMs: 2400, roam: [[0, 1]] } },
        // A Bellsprout by the oak.
        { x: 52, y: 40, species: 'bellsprout', level: 8 },
      ],
      landmarks: [
        { x: 41, y: 31, name: 'The Mere', kind: 'jetty' },
        { x: 14, y: 49, name: 'Duck Hide', kind: 'hide' },
        { x: 52, y: 37, name: 'Drainage Pump', kind: 'shed' },
      ],
      signs: [
        { x: 42, y: 8, lines: ['REEDMERE', 'The boardwalk goes round. The reeds go through.'] },
        { x: 21, y: 15, lines: ['THE HUMMOCK', 'The only dry ground for a mile. Please leave some of it for the next person.'] },
        { x: 48, y: 11, lines: ['PRIVATE POND', 'Not on any map. Keep out. This means you. Signed, the Owner (age nine).'] },
        { x: 48, y: 17, lines: ['THE LONG DRAIN', 'Dug by hand in the old days, by people who had been told it would help.'] },
        { x: 48, y: 33, lines: ['THE OLD PUMP', 'It drained this whole fen once. Then it rained.'] },
        { x: 44, y: 29, lines: ['THE MERE PUNT', 'Out to Duck Island and back. No charge. Mind the ducks. They do not mind you.'] },
        { x: 34, y: 49 + 1, lines: ['EELS', 'Smoked, jellied, or looked at. Ask at the stall.'] },
        { x: 30, y: 48, lines: ['MERE END', 'East: the staithe, the old pump and Gull Strand. West: the duck hide and the Mere Path.'] },
        { x: 37, y: 43, lines: ['THE DROWNED DUCK', 'Beds. Ale. No, you may not see the duck.'] },
        { x: 15, y: 48, lines: ['THE DUCK HIDE', 'QUIET PLEASE. The ones on the bank are real. The one in the water is a doll. Tess knows.'] },
        { x: 11, y: 36, lines: ['THE WITHY BEDS', 'Cut every seven years. Do not lean on them.'] },
        { x: 10, y: 25, lines: ['THE MERE PATH', 'West, out of the marsh. Last dry bed for a long way. Ask at the house.'] },
        { x: 19, y: 55, lines: ['NOTHING DOWN THIS PATH', 'Nothing at all. Certainly not a cove. Go back.'] },
        { x: 40, y: 50, lines: ['THE TURBARY', 'Peat for the whole marsh. Cut it, stack it, turn it, swear at it.'] },
      ],
      people: [
        // -- The reed yard and the road down ------------------------------------------
        { x: 37, y: 8, name: 'Thatcher', look: 'straw-hat', facing: 'up', lines: ['Half of Millbrook sleeps under this marsh. It keeps the rain off, mostly.', 'If you are in a hurry, do not wade. It only feels quicker.'], beat: { everyMs: 3100, roam: [[-1, 0], [-2, 0]], glances: ['left'] }, calls: ['Mind the bundles!'] },
        { x: 44, y: 14, name: 'Reed Boy', look: 'boy', facing: 'right', lines: ['I carry the bundles up to the yard. Then they give me more bundles.', 'That is the whole job. I thought there would be more to it.'], beat: { everyMs: 2800, roam: [[0, 1]], glances: ['up', 'down'] }, calls: ['Coming through!'] },
        // -- The Hummock and the north bank --------------------------------------------
        { x: 25, y: 12, name: 'Wildfowler', look: 'camper', facing: 'right', lines: ['Sit very still on this bank and the whole marsh comes to you.', 'Then a raider wades through and it all goes home again.'], beat: { everyMs: 3900, glances: ['down', 'left'] }, calls: ['Shh. Sit still.'] },
        { x: 21, y: 11, name: 'Old Bittern', look: 'old-man', facing: 'down', lines: ['Sixty years I have come out here and I have shot nothing.', 'I do not own a gun. I just like the hat.'], beat: { everyMs: 4300, glances: ['right'] }, calls: ['Nice hat, eh?'] },
        { x: 30, y: 26, name: 'Mere Fisher', look: 'fisherman', facing: 'down', lines: ['Still as a plate, this mere. I have fished it forty years.', 'Nothing yet.'], calls: ['Any minute now.'] },
        // -- The pond and the drain ------------------------------------------------------
        { x: 52, y: 11, name: 'Pond Boy', look: 'tuber-boy', facing: 'up', lines: ['This pond is not on the map. I checked. So it is mine.', 'You can look. Looking is free. Fishing is one Poké Ball. Nobody has paid yet.'], beat: { everyMs: 2500, roam: [[1, 0]], glances: ['left'] }, calls: ['My pond!', 'Oi! Private!'] },
        { x: 55, y: 15, name: 'Lock Keeper', look: 'worker', facing: 'left', lines: ['I open the sluice when the water comes up and shut it when it goes down.', 'Nobody has told me what happens if I stop. I am not going to be the one who finds out.'], beat: { everyMs: 3300, roam: [[1, 0]], glances: ['up', 'down'] }, calls: ['Level is up a thumb.'] },
        { x: 57, y: 17, name: 'Reed Cutter', look: 'straw-hat', facing: 'left', lines: ['We cut the reeds for thatch.', 'Wade through them if you like. The boardwalk is longer, but you stay dry.'], beat: { everyMs: 3700, glances: ['down'] } },
        // -- The frog pools and the pump -----------------------------------------------------
        { x: 49, y: 29, name: 'Tadpole Nan', look: 'little-girl', facing: 'right', lines: ['There are eleven frogs. I have named them all Gerald.', 'The big one is Big Gerald. He will fight you. He fights everybody.'], beat: { everyMs: 1900, roam: [[0, 1], [1, 1]], glances: ['up'] }, calls: ['Gerald! Not you, Gerald!'] },
        { x: 56, y: 33, name: 'Old Seth', look: 'old-man', facing: 'left', lines: ['My father ran this pump, and his father. It has not pumped anything since the rain.', 'I still oil it. You do not stop oiling a thing just because it has stopped.'], beat: { everyMs: 4100, roam: [[0, 1]], glances: ['left'] }, calls: ['She will go again one day.'] },
        // -- The staithe --------------------------------------------------------------------------
        { x: 43, y: 31, name: 'Puntman', look: 'sailor', facing: 'left', lines: ['Punt goes out to Duck Island and comes back. Walk to the end of the boards and press on.', 'No, there is nothing out there. Nothing you can eat. There is a hermit. He is not for eating either.'], beat: { everyMs: 3000, glances: ['up', 'left'] }, calls: ['Punt! Duck Island!', 'Mind the pole.'] },
        { x: 44, y: 28, name: 'Eel Wife', look: 'old-woman', facing: 'down', lines: ['Eels go up the drain at night. You can hear them, if you have nothing else to do.', 'I have nothing else to do.'], beat: { everyMs: 3500, glances: ['down'] } },
        // -- Duck Island ------------------------------------------------------------------------------
        { x: 25, y: 31, name: 'Hermit Moss', look: 'bald-man', facing: 'right', lines: ['I came out here to be alone with my thoughts.', 'There were not as many as I had hoped.', 'Something is dug in under my good tree. It came with the island. I never looked.'], beat: { everyMs: 4700, glances: ['up', 'right'] }, calls: ['Oh. A person. Oh dear.'] },
        // -- Mere End -----------------------------------------------------------------------------------
        { x: 41, y: 47, name: 'Eel Seller', look: 'heavy-man', facing: 'left', lines: ['Smoked is the good one. Jellied is the one I have got most of.', 'If you have a rod, the bay is full of them. Please do not. It is my living.'], beat: { everyMs: 2600, roam: [[0, -1]], glances: ['left', 'down'] }, calls: ['Eels! Lovely eels!', 'Jellied! Who wants jellied?'] },
        { x: 32, y: 49, name: 'Mrs Pike', look: 'woman', facing: 'up', lines: ['Last winter the bay came up through my floor and took the good chair.', 'We got it back. It was in the Drowned Duck. They said it floated in.'], beat: { everyMs: 3400, roam: [[-1, 0]], glances: ['up'] }, calls: ['Too dear, that is.'] },
        { x: 30, y: 49, name: 'Wren', look: 'tuber-girl', facing: 'left', lines: ['I can swim to the island. Mum says I cannot. I can, though. I just have not.'], beat: { everyMs: 1700, roam: [[-1, 0], [-2, 0]], glances: ['down'] }, calls: ['Bet you cannot catch one!'] },
        { x: 26, y: 48, name: 'Netmaker', look: 'man', facing: 'up', lines: ['Every net in the vale came out of that loft, and every hole in them came out of the Krabby.', 'Down the coast they pay double. Down the coast they have Krabby.'], beat: { everyMs: 3200, roam: [[1, 0]], glances: ['up'] }, calls: ['Good net, that.'] },
        { x: 19, y: 41, name: 'Smoker', look: 'bald-man', facing: 'down', lines: ['You smell of smoke now. You will always smell of smoke now.', 'It is a good smell. You will not get a table anywhere, mind.'], beat: { everyMs: 3800, glances: ['right'] }, calls: ['Mind the smoke.'] },
        // -- The turbary --------------------------------------------------------------------------------------
        { x: 42, y: 54 + 1, name: 'Turf Cutter', look: 'hiker', facing: 'left', lines: ['Peat is just a marsh that gave up. Cut it, dry it, burn it.', 'It takes a thousand years to grow a spade of it. I do about four hundred a day.'], beat: { everyMs: 2900, glances: ['left', 'down'] }, calls: ['Mind the strips.'] },
        { x: 35, y: 55, name: 'Turf Boy', look: 'youngster', facing: 'up', lines: ['Dad says those Diglett do more than I do.', 'They do. They are very good. They do not take a wage. I have spoken to them about it.'], beat: { everyMs: 2200, roam: [[1, 0]], glances: ['up'] }, calls: ['Diglett! Other way!'] },
        // -- The duck hide -------------------------------------------------------------------------------------
        { x: 12, y: 53, name: 'Birder Tess', look: 'old-woman', facing: 'right', lines: ['Hush. The ducks only come in when nobody wades the reeds.', 'One of those has not moved in a week. I am beginning to think it is a Lapras doll.'], beat: { everyMs: 4500, glances: ['down'] }, calls: ['Hush!', 'Quiet, please!'] },
        // -- The withy beds ---------------------------------------------------------------------------------------
        { x: 10, y: 42, name: 'Mrs Osier', look: 'woman', facing: 'left', lines: ['Baskets for the eels, baskets for the peat, baskets to put the other baskets in.', 'My sister at The Crossing says hers are better. They are not. Do not tell her I said so.'], beat: { everyMs: 3100, roam: [[0, -1]], glances: ['left'] }, calls: ['Baskets! Good baskets!'] },
        // -- The Last House --------------------------------------------------------------------------------------------
        { x: 10, y: 28, name: 'Old Reeve', look: 'gentleman', facing: 'left', lines: ['I collected the toll on the Mere Path for thirty years. There is no toll now.', 'I still sit here. Somebody ought to.', 'West, and do not stop for anybody on the path. Nobody good is out there.'], beat: { everyMs: 4200, glances: ['right'] }, calls: ['Toll is nothing. Mind it.'] },
        // -- The way nobody signs -----------------------------------------------------------------------------------------
        { x: 8, y: 11 + 2 - 1, name: 'Snipe Shooter', look: 'camper', facing: 'right', lines: ['You have walked all this way into the reeds to talk to me. I do not know what to do with that.', 'Nobody comes up here. That is what it is for.'], beat: { everyMs: 3900, glances: ['down'] }, calls: ['Oh. Hello. Why?'] },
        { x: 22, y: 56, name: 'Birdwatcher', look: 'rocker', facing: 'left', lines: ['Birdwatching. That is what I am doing. With these crates. Which are for birds.', 'Cove? What cove? There is no cove down that path. Very rocky, the no cove.'], beat: { everyMs: 2700, glances: ['up', 'down'] }, calls: ['Lovely... bird, that.'] },
      ],
      trainers: [
        { x: 45, y: 33, name: 'Netter Fen', team: 'netter', look: 'fisherman', facing: 'left', sight: 0, lines: ['The mere is mine at this hour. Fight for it!'] },
        { x: 29, y: 16, name: 'Fowler Hugh', team: 'drover', look: 'camper', facing: 'left', sight: 0, lines: ['You have put up every bird on the marsh. You can pay for them.'] },
        { x: 57, y: 40, name: 'Bog Walker Rue', team: 'scout', look: 'picnicker', facing: 'left', sight: 0, lines: ['I walk the bog for my health. It is terrible for my health. Battle me!'] },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** Mere End's doors, and the hide's. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(
    file,
    'reedmere',
    'warden-house',
    38,
    39,
    'The Drowned Duck',
    [
      { x: 4, y: 2, name: 'Landlady', look: 'woman', facing: 'down', lines: ['Beds are full. Beds are always full. There are two of them.', 'The duck is not for looking at. It is stuffed. It is a very sad story and it costs extra.'] },
      { x: 5, y: 4, name: 'Old Soak', look: 'old-man', facing: 'left', lines: ['There is a hermit on that island owes me eleven years of ale.', 'Tell him I said hello. Tell him I said eleven.'] },
      { x: 6, y: 6, name: 'Eel Man', look: 'fisherman', facing: 'left', lines: ['Same seat, same pint, forty years. I have asked them to move the door, it lets the bay in.', 'They have asked me to move.'] },
    ],
    { room: INN_ROOM, itemSpots: [{ x: 11, y: 8, hidden: true }], pokemon: [{ x: 9, y: 2, species: 'psyduck' }] },
  );
  next = withInside(next, 'reedmere', 'cottage', 32, 41, 'Mrs Pike’s', [
    { x: 3, y: 3, name: 'Young Pike', look: 'little-boy', facing: 'down', lines: ['Mum says we have to keep the door shut or the bay gets in.', 'It got in anyway. Look at the floor.'] },
  ]);
  next = withInside(next, 'reedmere', 'timber-house', 24, 41, 'The Net Loft', [
    { x: 9, y: 5, name: 'Net Mender', look: 'worker-woman', facing: 'down', lines: ['Every hole in every net in the vale comes through this room.', 'You would not believe the holes. I have seen a hole that was mostly hole.'] },
  ], { itemSpots: [{ x: 1, y: 6, hidden: true }] });
  next = withInside(next, 'reedmere', 'shed', 8, 48, 'Tess’s Hide', [], { itemSpots: [{ x: 7, y: 5 }] });
  return next;
}
