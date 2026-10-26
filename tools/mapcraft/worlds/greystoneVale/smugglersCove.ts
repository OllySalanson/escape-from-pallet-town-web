/**
 * SMUGGLERS' COVE, under the cliffs south of Reedmere.
 *
 * The one idea: a cove nobody is meant to find. The marsh drains out of
 * Reedmere through the wood in a brook, and a deer path nobody signs comes
 * down beside it to the cliff top, where the Cove Steps are cut down the face.
 * Below them the cove: a beach in the arms of the cliffs, the smugglers' jetty
 * running out across the water to their boat - the way off the map, which
 * sails when the tide turns - and their contraband stacked in a nook of the
 * rocks under the jetty, with a grunt on guard. A cleft in the east cliff is
 * the shore path round to the Sunken Quarter.
 *
 * Stone laid over water is the jetty, as at Gull Strand; the sea runs out to
 * the map's west edge, which needs no wood to seal it.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { openingsOf, openingTiles, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The wood above the cliffs, a letter a lattice cell: T the wood, g the reeds, W the pool and its brook. */
const WOOD = [
  'TTTTTTTTTT.TTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTgTTTTTTTTTTTTTTTTTTTTT',
  'TTTTgggggTggTTTTTTTTTTTTTTTTTTTT',
  'TTTTgWWWggTgTTTTTTTTTTTTTTTTTTTT',
  'TTTggWWWWgggTTTTTTTTTTTTTTTTTTTT',
  'TTTTgWWWggTggTTTTTTTTTTTTTTTTTTT',
  'TTTTggWggTTTgTTTTTTTTTTTTTTTTTTT',
  'TTTTTTWTTTTTggTTTTTTTTTTTTTTTTTT',
  'TTTTTTWTTTTTTgggTTTTTTTTTTTTTTTT',
  'TTTTTTWTTTTTTTT.......TTTTTTTTTT',
  'TTTTTTWTTT..............TTTTTTTT',
  'TTTTTTWTTT...............TTTTTTT',
];

export function smugglersCove(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'smugglers-cove');
  // The sea needs no wood to seal it: free the rim of the cove and below.
  const kept = new Set(
    openingsOf(GREYSTONE_VALE, 'smugglers-cove')
      .filter((opening) => opening.side !== 'west')
      .flatMap((opening) => openingTiles(p.width, opening, 4).map(([x, y]) => `${x},${y}`)),
  );
  const rim: [number, number][] = [];
  for (let y = 24; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1)
      if ((x < 4 || y >= p.height - 2 || x >= p.width - 2) && !kept.has(`${x},${y}`)) rim.push([x, y]);
  p.unlock(rim);
  p.cells(WOOD);
  // A gap in the wood west of the pool, where the eel-catchers go out: the
  // marsh end is past the hunter's blind window from the boat and the roads.
  p.block(4, 8, 2, 2, '.');
  // The pool the marsh drains into, shaped by hand rather than by the lattice.
  p.block(8, 6, 12, 6, 'g');
  p.blob(13, 8, 4.6, 2.6, 'W');

  // -- The cliff top: heather and rock above the drop ---------------------------
  p.bedRows([18, 40, 45], [19, 39, 46], [20, 40, 44], [20, 18, 22], [21, 17, 23], [22, 18, 21]);
  p.building('rock', 33, 17).building('rock', 37, 21).building('rock', 43, 22);
  p.bushes([28, 20], [36, 20]); // gorse either side of where you land

  // -- The cove: the sea comes in from the west to a beach in the cliffs -------
  // The high ground round the cove is wood; the sea and the sand are cut out
  // of it and a cliff face stands wherever the wood meets them (below).
  p.block(0, 24, 64, 40, 'T');
  p.draw(0, 26, [
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW~~~~~~',
    'WWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWW',
    'WWWWWWWWWWW',
    'WWWWWWWW',
    'WWWWW',
    'WWW',
  ]);
  // The cliff: three tiles of face wherever the high ground meets the cove.
  const cove = (x: number, y: number) => ['W', '~'].includes(p.at(x, y) ?? '');
  const face: [number, number][] = [];
  for (let y = 24; y < p.height; y += 1)
    for (let x = 0; x < p.width; x += 1) {
      if (p.at(x, y) !== 'T') continue;
      let near = false;
      for (let j = -3; j <= 3 && !near; j += 1)
        for (let i = -3; i <= 3 && !near; i += 1) near = cove(x + i, y + j) && Math.abs(i) + Math.abs(j) <= 4;
      if (near) face.push([x, y]);
    }
  for (const [x, y] of face) p.put(x, y, 'C');
  // A face is whole lattice cells, or the wood behind it leaves a sliver of grass.
  for (let y = 24; y < p.height; y += 2)
    for (let x = 0; x < p.width; x += 2) {
      const cell = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const;
      if (cell.some(([i, j]) => p.at(i, j) === 'C'))
        for (const [i, j] of cell) if (p.at(i, j) === 'T') p.put(i, j, 'C');
    }
  // The brook comes down a cleft in the cliff and runs out over the sand.
  p.block(12, 24, 2, 3, 'W');
  // The Cove Steps, cut down the face from the cliff top to the sand.
  p.block(30, 23, 2, 4, 'd');

  // -- The smugglers' jetty, out across the cove to their boat -----------------
  p.block(0, 40, 30, 2, 'M');
  p.put(0, 41, 'W');
  p.building('ferry', 2, 42, { lot: 'W' });
  p.building('mooring-post', 12, 38, { lot: 'W' }).building('mooring-post', 26, 42, { lot: 'W' });

  // -- The contraband, stacked in a nook of the rocks under the jetty ----------
  p.draw(14, 42, ['MM', '~~~~~~~~', '~~~~~~~~', '~~~~~~~~', ' ~~~~~~']);
  p.building('crate-stack', 20, 43, { lot: '~' }).building('crate-pair', 18, 45, { lot: '~' });
  p.building('barrels', 20, 45, { lot: '~' }).building('sack', 15, 46, { lot: '~' });

  // -- The beach: rocks at the tide line, and the cleft east to the quarter ----
  // A spur of the cliff runs down onto the sand, and marram grass holds the
  // back of the beach; the smugglers' gear waits at the head of the jetty.
  p.draw(35, 30, ['   CC', '  CCCC', ' CCCCC', ' CCCCC', '  CCCC', '   CC']);
  p.bedRows([28, 27, 31], [29, 27, 32], [30, 28, 32], [44, 31, 35], [45, 30, 35], [46, 31, 34]);
  p.building('crate-pair', 31, 37, { lot: '~' }).building('barrel', 34, 37, { lot: '~' });
  p.road([[38, 40], [63, 40]]); // the cleft east, through the high ground to the quarter
  p.block(40, 38, 22, 2, 'C').block(40, 42, 22, 2, 'C');

  const file = districtFile(GREYSTONE_VALE, 'smugglers-cove', p, {
    exits: [{ x: 4, y: 8, name: 'Eel Gap', opens: { when: 'always' } }],
    dropIns: [{ x: 32, y: 20, name: 'Cove Steps', description: 'The cliff top over the cove, where the steps go down.' }],
    itemSpots: [{ x: 17, y: 46, hidden: true }, { x: 44, y: 18 }, { x: 36, y: 44 }],
    extra: {
      landmarks: [{ x: 28, y: 40, name: "Smugglers' Jetty", kind: 'jetty' }],
      // The smugglers' ship's cat on the bluff, a Poliwhirl in the lake reeds
      // and a Staryu on the beach.
      pokemon: [
        { x: 46, y: 21, species: 'meowth' },
        { x: 16, y: 11, species: 'poliwhirl', level: 12 },
        { x: 34, y: 30, species: 'staryu' },
      ],
      people: [
        {
          x: 9,
          y: 40,
          name: 'Old Rook',
          look: 'fisherman',
          facing: 'down',
          lines: ['The boat goes out when the tide turns, and not before.', 'You never saw this cove. Nobody ever has.'],
        },
      ],
      trainers: [
        {
          x: 15,
          y: 45,
          name: 'Grunt',
          team: 'raider',
          look: 'rocket-grunt',
          facing: 'up',
          sight: 2,
          lines: ['Hey! That cargo is spoken for!'],
        },
      ],
    },
  });
  return { file, notes: p.notes };
}
