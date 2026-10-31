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
 * Filled on 31 October 2026, the third ring out from Mill Square. The cove nobody
 * is meant to find has a village's worth of people in it now, every one of them
 * very firmly not a smuggler: the eel catchers on the pool, the signs down the
 * deer path saying there is nothing down the deer path, the Revenue man on the
 * cliff top looking out to sea with his back to all of it, the fish stall with no
 * fish, the coopers' fish barrels, the boat shed and the landing stage, and in the
 * cleft the Cut, where the good stuff waits for a cart.
 *
 * Stone laid over water is the jetty, as at Gull Strand; the sea runs out to
 * the map's west edge, which needs no wood to seal it.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { openingsOf, openingTiles, planLimits, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
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
  'TTTTTTWTTTTTTgggTTTT........TTTT',
  'TTTTTTWTTTTTTTT.............TTTT',
  'TTTTTTWTTT..................TTTT',
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

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

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
  // The Revenue house and its lamp, on the cliff top, with their backs to the cove.
  p.building('grey-house', 42, 15);
  p.building('roundhouse', 50, 15);
  stand('bench', 36, 18);
  p.flowers([41, 19], [48, 16], [49, 20], [54, 18], [30, 17], [40, 16]);

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
  p.bedRows([28, 27, 30], [29, 27, 31], [30, 28, 30], [43, 35, 37], [44, 34, 37], [45, 34, 36]);
  p.building('crate-pair', 31, 37, { lot: '~' }).building('barrel', 34, 37, { lot: '~' });
  p.road([[38, 40], [63, 40]]); // the cleft east, through the high ground to the quarter
  p.block(40, 38, 22, 2, 'C').block(40, 42, 22, 2, 'C');

  // -- The Cut: two bays hacked out of the cleft, where the cargo waits for a cart ------------
  p.block(46, 36, 6, 4, 'd');
  p.block(54, 42, 6, 4, 'd');
  stand('crate-stack', 46, 36);
  stand('crate-tower', 50, 36);
  stand('barrels', 48, 36);
  stand('crate-pair', 58, 44);
  stand('sack', 54, 45);
  stand('barrel', 54, 43);

  // -- The cove's own: everybody here is a fisherman --------------------------------------------
  // Aunt Lizzie's, up against the cliff; the stall with no fish; the coopers' yard;
  // and the boat shed down the sand.
  stand('hut', 33, 27, '~');
  stand('striped-stall', 30, 31, '~');
  stand('barrels', 28, 36, '~');
  stand('log', 35, 39, '~');
  stand('big-stump', 36, 37, '~');
  p.building('shed', 30, 44, { lot: '~' });
  stand('crate-pair', 34, 47, '~');
  stand('fence-post', 28, 39, '~');
  // The landing stage, on piles, for whatever comes in the small boats by night.
  p.road([[22, 33], [28, 33]], { letter: '_' });
  stand('mooring-post', 22, 31, 'W');
  stand('mooring-post', 26, 35, 'W');
  stand('wet-rock', 16, 30, 'W');
  stand('wet-rock', 6, 34, 'W');
  stand('wet-rock', 18, 51, 'W');

  // -- The eel pool, where the marsh drains out ----------------------------------------------
  stand('water-lily', 12, 7, 'W');
  stand('water-lily', 15, 10, 'W');
  stand('mooring-post', 18, 8, 'g');
  p.block(9, 12, 3, 2, '.');
  stand('barrel', 11, 12);

  const file = districtFile(GREYSTONE_VALE, 'smugglers-cove', p, {
    exits: [{ x: 4, y: 8, name: 'Eel Gap', opens: { when: 'always' } }],
    dropIns: [{ x: 32, y: 20, name: 'Cove Steps', description: 'The cliff top over the cove, where the steps go down.' }],
    itemSpots: [
      { x: 17, y: 46, hidden: true },
      { x: 41, y: 17 },
      { x: 36, y: 41 },
      { x: 56, y: 44, hidden: true },
      { x: 48, y: 38, hidden: true },
      { x: 27, y: 34 },
    ],
    extra: {
      districts: [
        { name: 'THE EEL POOL', x: 4, y: 4, width: 22, height: 12, wildlife: 'shore' },
        { name: 'THE REVENUE POST', x: 36, y: 14, width: 20, height: 9, wildlife: 'shore' },
        { name: 'THE LANDING STAGE', x: 20, y: 30, width: 8, height: 6, wildlife: 'shore' },
        { name: 'THE CONTRABAND', x: 14, y: 42, width: 8, height: 6, wildlife: 'shore' },
        { name: 'FISHER’S ROW', x: 28, y: 26, width: 12, height: 15, wildlife: 'shore' },
        { name: 'THE BOAT SHED', x: 26, y: 41, width: 14, height: 9, wildlife: 'shore' },
        { name: 'THE CUT', x: 40, y: 36, width: 24, height: 10, wildlife: 'shore' },
      ],
      landmarks: [
        { x: 28, y: 40, name: "Smugglers' Jetty", kind: 'jetty' },
        { x: 53, y: 20, name: 'The Signal Lamp', kind: 'shed' },
        { x: 37, y: 41, name: 'Cooperage', kind: 'shed' },
      ],
      signs: [
        { x: 22, y: 5, lines: ['NOTHING DOWN THIS PATH', 'Still nothing. Told you.'] },
        { x: 27, y: 14, lines: ['DEFINITELY NO COVE', 'And if there were, it would be closed. Go home.'] },
        { x: 29, y: 21, lines: ['DANGER: CLIFFS', 'No steps here. No, those are not steps. Those are a landslip. Very tidy landslip.'] },
        { x: 47, y: 19, lines: ['HIS MAJESTY’S REVENUE', 'All landings to be declared at this office. Hours: when he is looking.'] },
        { x: 32, y: 36, lines: ['FRESH FISH', 'Ask for Sid. Do not ask for fish.'] },
        { x: 36, y: 40, lines: ['FISHER’S ROW', 'A fishing village. Look at all the nets. There is a net somewhere.'] },
        { x: 42, y: 41, lines: ['THE CUT', 'East to the shingle and the Sunken Quarter. Carts by night. Do not count them.'] },
        { x: 29, y: 35, lines: ['THE LANDING STAGE', 'For small boats, by night, in fog, for no reason.'] },
      ],
      // The smugglers' ship's cat on the bluff, a Poliwhirl in the lake reeds
      // and a Staryu on the beach, and what else the tide leaves.
      pokemon: [
        { x: 44, y: 22, species: 'meowth', beat: { everyMs: 2200, roam: [[1, 0]] } },
        { x: 16, y: 11, species: 'poliwhirl', level: 12 },
        { x: 29, y: 32, species: 'staryu' },
        { x: 31, y: 42, species: 'krabby', beat: { everyMs: 1400, roam: [[0, -1]] } },
        { x: 35, y: 46, species: 'shellder', level: 11 },
        { x: 38, y: 36, species: 'krabby', level: 9 },
        { x: 23, y: 34, species: 'slowpoke' },
        { x: 33, y: 42, species: 'meowth', beat: { everyMs: 2400, roam: [[1, 0]] } },
        { x: 33, y: 22, species: 'spearow', beat: { everyMs: 1300, roam: [[1, 0]] } },
        { x: 55, y: 19, species: 'pidgey', beat: { everyMs: 1500, roam: [[0, 1]] } },
        { x: 8, y: 12, species: 'poliwag', beat: { everyMs: 2000, roam: [[0, 1]] } },
        { x: 24, y: 12, species: 'slowpoke', level: 10 },
        { x: 57, y: 45, species: 'rattata' },
        { x: 47, y: 39, species: 'rattata', level: 9 },
      ],
      berryTrees: [
        { x: 31, y: 18, berry: 'oran' },
        { x: 26, y: 17, berry: 'chesto' },
      ],
      people: [
        // -- The eel pool ----------------------------------------------------------------
        { x: 10, y: 13, name: 'Eel Catcher', look: 'fisherman', facing: 'up', lines: ['Everything the marsh drains comes down this brook, and I catch it.', 'Eels. I catch eels. There has never been a keg in this pool, and I have told him so.'], beat: { everyMs: 3300, glances: ['up', 'right'] }, calls: ['Eels! Only eels!'] },
        { x: 20, y: 9, name: 'Eel Girl', look: 'tuber-girl', facing: 'left', lines: ['There is a gap in the trees past the pool. You go out that way, if a man in a hat comes.', 'I do not know why. Dad says it is for the eels.'], beat: { everyMs: 2100, roam: [[-1, 0]], glances: ['left'] }, calls: ['Hat coming!'] },
        // -- The deer path and the cliff top --------------------------------------------------------
        { x: 32, y: 19, name: 'Lookout Boy', look: 'youngster', facing: 'right', lines: ['I am not a lookout. I just stand here and whistle if somebody comes.', 'That is you. Pretend I whistled.'], beat: { everyMs: 1900, glances: ['left', 'right'] }, calls: ['*whistling, not at you*'] },
        { x: 47, y: 21, name: 'Officer Pym', look: 'policeman', facing: 'down', lines: ['Thirty years I have watched this sea for smugglers. Not one sail, and I have the logbook to prove it.', 'You will not get brandy like this anywhere else. It comes from somewhere. Very reasonable.'], beat: { everyMs: 3700, glances: ['down', 'right'] }, calls: ['Nothing to report!'] },
        { x: 52, y: 21, name: 'Lamp Boy', look: 'little-boy', facing: 'up', lines: ['One flash is the coast is clear. Two is the coast is not clear.', 'Mister Pym says it is for ships. He has never asked why I do it when there is no ships.'], beat: { everyMs: 2300, roam: [[-1, 0]], glances: ['up'] }, calls: ['One flash or two?'] },
        // -- Fisher's Row ----------------------------------------------------------------------------------
        { x: 32, y: 35, name: 'Sid', look: 'heavy-man', facing: 'down', lines: ['Fresh fish. We are out of fish. We are always out of fish. We have silk.', 'I have got a very good silk haddock.'], calls: ['Fresh fish! Well. Fish.'] },
        { x: 35, y: 29, name: 'Aunt Lizzie', look: 'old-woman', facing: 'left', lines: ['Ask no questions and you will be told no lies. Turn your face to the wall.', 'My lot took a cargo to the burning island for years. The skiff off the jetty still goes, when the tide lets it.'], beat: { everyMs: 4200, glances: ['down', 'left'] }, calls: ['Face to the wall, love.'] },
        { x: 35, y: 38, name: 'Cooper', look: 'worker', facing: 'up', lines: ['Fish barrels. These are all fish barrels. That is the smell of fish.', 'A very strong fish. About forty per cent.'], beat: { everyMs: 2900, glances: ['up'] }, calls: ['Mind your toes.'] },
        { x: 25, y: 33, name: 'Stage Hand', look: 'sailor', facing: 'left', lines: ['Boats come in here at night. Fishing boats. For fishing.', 'They fish at night, in fog, with no lamp, for kegs. I mean eels.'], beat: { everyMs: 3100, glances: ['left', 'down'] }, calls: ['Nothing to see!'] },
        { x: 25, y: 40, name: 'Skiffman', look: 'sailor', facing: 'down', lines: ['The skiff runs out round the headland to Ember Isle once the tide is up. A minute in, say.', 'Stops when the big boat sails. After that you swim. It is not a swimming sort of water.'], beat: { everyMs: 3500, glances: ['down', 'left'] }, calls: ['Skiff! Mind the gap!'] },
        { x: 9, y: 40, name: 'Old Rook', look: 'fisherman', facing: 'down', lines: ['The boat goes out when the tide turns, and not before.', 'You never saw this cove. Nobody ever has.'], calls: ['Never saw you.'] },
        // -- The boat shed ---------------------------------------------------------------------------------------
        { x: 30, y: 43, name: 'Boat Builder', look: 'bald-man', facing: 'right', lines: ['Fastest fishing boat in the vale, this. Black sails, no name.', 'Fish are very quick round here.'], beat: { everyMs: 3000, glances: ['right', 'down'] }, calls: ['Do not touch the tar.'] },
        { x: 33, y: 41, name: 'Tide Girl', look: 'lass', facing: 'down', lines: ['Things wash up on this beach, if you know when to look.', 'And dig. It washes up very deep, some of it.'], beat: { everyMs: 2000, roam: [[-1, 0]], glances: ['left'] }, calls: ['Finders keepers!'] },
        // -- The Cut ---------------------------------------------------------------------------------------------------
        { x: 49, y: 39, name: 'Tallyman', look: 'clerk', facing: 'down', lines: ['Forty tubs in, thirty-eight tubs out, and I shall write down forty.', 'Nobody has ever checked. Nobody knows there is a book.'], beat: { everyMs: 3400, glances: ['left', 'right'] }, calls: ['Thirty-nine. Forty. Forty.'] },
      ],
      trainers: [
        { x: 15, y: 45, name: 'Grunt', team: 'raider', look: 'rocket-grunt', facing: 'up', sight: 2, lines: ['Hey! That cargo is spoken for!'] },
        { x: 56, y: 43, name: 'Carter Mags', team: 'drover', look: 'rocket-grunt-woman', facing: 'up', sight: 0, lines: ['You never saw this cart. You never saw me. You are about to not see my Pokémon!'] },
        { x: 38, y: 42, name: 'Wrecker Tobin', team: 'netter', look: 'rocker', facing: 'left', sight: 0, lines: ['That light on the headland? That is to help the ships. Help them onto the rocks!'] },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The doors of the cove: everybody has somebody at home who has seen nothing. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'cove', 'grey-house', 42, 15, 'The Revenue House', [
    { x: 3, y: 3, name: 'Mrs Pym', look: 'woman', facing: 'down', lines: ['He has never once looked behind him. Thirty years.', 'I let them know when he has gone to bed. They bring me the good tea.'] },
  ], { itemSpots: [{ x: 1, y: 6, hidden: true }] });
  next = withInside(next, 'cove', 'hut', 33, 27, 'Aunt Lizzie’s', [
    { x: 3, y: 3, name: 'Old Gaffer', look: 'old-man', facing: 'down', lines: ['Sixty years a fisherman. I have caught nineteen fish.', 'I paid for this whole house out of those fish.'] },
  ]);
  next = withInside(next, 'cove', 'shed', 30, 44, 'The Sail Loft', [], { itemSpots: [{ x: 7, y: 5 }] });
  return next;
}
