/**
 * Greystone Vale: a new raid map, planned coarse and drawn a district at a time
 * (`tools/mapcraft/README.md`, "A huge map").
 *
 * Nine districts of 64 tiles, 192 square, with room left to grow a column east
 * and a row south inside a map file's 256. The vale reads as one place from the
 * top down: a moor and the Greystone peaks in the north, where the river is
 * born; the village in the west, where every road starts; the river through the
 * middle, crossed three ways; two woods in the east, one dark pine and one a
 * broadleaf maze, joined by a deer path nobody signs; and the marsh, the strand
 * and the orchards stepping down to the sea. Under it, the Greystone Caves: five
 * floors with mouths in the peaks, the sea cliffs and the wood, so a group can
 * go in at one end of the vale and come out at another.
 *
 * Every district has one idea, written below, and every crossing between them
 * is fixed here before either side is drawn; a district's program is written to
 * its idea and starts from `startDistrict`.
 */
import type { WorldPlan } from '../../worldPlan';

export const GREYSTONE_VALE: WorldPlan = {
  id: 'greystone-vale',
  name: 'Greystone Vale',
  maker: 'Pallet Town',
  districtSize: 64,
  wildlife: 'meadow',
  // The game's own map: its stitched file is read as `builtInFileMap` reads
  // it, against `BUILT_IN_MAP_FILE_LIMITS` (more landings, ways out and places
  // than a player's map), which a vale of sixteen districts needs.
  builtIn: true,
  // The village first: the first landing a map file lists is its front door.
  districts: [
    {
      id: 'millbrook',
      name: 'MILLBROOK',
      cell: [0, 1],
      terrain: 'town',
      wildlife: 'town',
      idea: 'The mill village on the brook: a square, the mill race, cottages and the Centre. Every road starts here.',
    },
    {
      id: 'high-moor',
      name: 'HIGH MOOR',
      cell: [0, 0],
      terrain: 'moor',
      wildlife: 'meadow',
      idea: 'Open heather moor: the old drove road crosses between standing stones and drops south to the village by stacked ledges.',
    },
    {
      id: 'greystone-peaks',
      name: 'GREYSTONE PEAKS',
      cell: [1, 0],
      terrain: 'mountain',
      wildlife: 'field',
      idea: 'A switchback pass climbs past quarry benches to the mouth of the Greystone Caves; the river is born in a tarn under the summit.',
    },
    {
      id: 'pine-hollow',
      name: 'PINE HOLLOW',
      cell: [2, 0],
      terrain: 'forest',
      wildlife: 'woodland',
      idea: 'A dark pine wood where one hidden trail threads three clearings; the way south is a deer path nobody signs.',
    },
    {
      id: 'the-crossing',
      name: 'THE CROSSING',
      cell: [1, 1],
      terrain: 'river',
      wildlife: 'wetland',
      idea: 'The river splits the vale. A stone bridge, a shallow ford and stepping stones are the three ways over, each a different walk.',
    },
    {
      id: 'tanglewood',
      name: 'TANGLEWOOD',
      cell: [2, 1],
      terrain: 'forest',
      wildlife: 'woodland',
      idea: 'A broadleaf maze of paths that loop and fork, opening onto a ruined shrine in a glade.',
    },
    {
      id: 'reedmere',
      name: 'REEDMERE',
      cell: [0, 2],
      terrain: 'marsh',
      wildlife: 'wetland',
      idea: 'Boardwalks over reed beds round a still mere: tall grass everywhere, and the dry way is the long way.',
    },
    {
      id: 'gull-strand',
      name: 'GULL STRAND',
      cell: [1, 2],
      terrain: 'coast',
      wildlife: 'shore',
      idea: 'Sea cliffs and a strand where the river meets the sea; a sea cave runs back under the cliffs into the Greystone Caves.',
    },
    {
      id: 'orchard-terraces',
      name: 'ORCHARD TERRACES',
      cell: [2, 2],
      terrain: 'farmland',
      wildlife: 'field',
      idea: 'Orchards and fenced pastures step down to the sea; the ledges on the farm road are the quick way home.',
    },
  ],
  crossings: [
    // East and west, measured down the shared edge from its north end.
    { between: ['high-moor', 'greystone-peaks'], at: 36, kind: 'trail' },
    { between: ['greystone-peaks', 'pine-hollow'], at: 22, kind: 'trail', hidden: true },
    { between: ['millbrook', 'the-crossing'], at: 30, kind: 'road' },
    { between: ['the-crossing', 'tanglewood'], at: 32, kind: 'road' },
    { between: ['the-crossing', 'tanglewood'], at: 52, kind: 'trail', hidden: true },
    { between: ['reedmere', 'gull-strand'], at: 18, kind: 'trail' },
    { between: ['gull-strand', 'orchard-terraces'], at: 14, kind: 'road' },
    // North and south, measured along the shared edge from its west end.
    { between: ['high-moor', 'millbrook'], at: 30, kind: 'road' },
    { between: ['greystone-peaks', 'the-crossing'], at: 28, kind: 'river' },
    { between: ['greystone-peaks', 'the-crossing'], at: 46, kind: 'trail' },
    { between: ['pine-hollow', 'tanglewood'], at: 18, kind: 'trail', hidden: true },
    { between: ['millbrook', 'reedmere'], at: 40, kind: 'trail' },
    { between: ['the-crossing', 'gull-strand'], at: 28, kind: 'river' },
    { between: ['the-crossing', 'gull-strand'], at: 46, kind: 'road' },
    { between: ['tanglewood', 'orchard-terraces'], at: 36, kind: 'trail' },
  ],
  exits: [
    { district: 'millbrook', side: 'west', at: 30, name: 'Westward Road' },
    { district: 'high-moor', side: 'north', at: 28, name: 'Moor Gate', kind: 'trail' },
    { district: 'reedmere', side: 'west', at: 26, name: 'Mere Path', kind: 'trail' },
    { district: 'pine-hollow', side: 'east', at: 26, name: 'Pine Trail', kind: 'trail' },
    { district: 'tanglewood', side: 'east', at: 40, name: 'Eastern Track' },
    { district: 'orchard-terraces', side: 'east', at: 30, name: 'Orchard Lane' },
    // The boat to the jetty comes in a while into the raid: the vale's one way
  // out that is not open from the first second.
  { district: 'gull-strand', side: 'south', at: 44, name: "Fisher's Jetty", opens: { when: 'after', seconds: 90 } },
  ],
  landmarks: [
    { district: 'millbrook', name: 'Mill Square', at: [30, 32], kind: 'landing' },
    { district: 'millbrook', name: 'The Mill', at: [44, 18], kind: 'landmark' },
    { district: 'high-moor', name: 'Standing Stones', at: [24, 20], kind: 'landmark' },
    { district: 'high-moor', name: 'Moor Top', at: [34, 44], kind: 'landing' },
    { district: 'greystone-peaks', name: 'The Tarn', at: [16, 26], kind: 'landmark' },
    { district: 'pine-hollow', name: 'Three Clearings', at: [34, 34], kind: 'secret' },
    { district: 'the-crossing', name: 'Stone Bridge', at: [24, 30], kind: 'landmark' },
    { district: 'the-crossing', name: 'Stepping Stones', at: [26, 52], kind: 'landmark' },
    { district: 'the-crossing', name: 'The Ford', at: [44, 40], kind: 'landing' },
    { district: 'tanglewood', name: 'Ruined Shrine', at: [40, 28], kind: 'landmark' },
    { district: 'reedmere', name: 'The Mere', at: [30, 32], kind: 'landmark' },
    { district: 'reedmere', name: 'Duck Hide', at: [12, 50], kind: 'secret' },
    { district: 'gull-strand', name: 'The Strand', at: [42, 40], kind: 'landing' },
    { district: 'gull-strand', name: 'River Mouth', at: [28, 54], kind: 'landmark' },
    { district: 'orchard-terraces', name: 'Farmhouse', at: [30, 20], kind: 'landing' },
  ],
  caves: [
    {
      id: 'greystone-caves',
      name: 'Greystone Caves',
      floors: 5,
      mouths: [
        { district: 'greystone-peaks', at: [42, 22] },
        { district: 'tanglewood', at: [52, 20] },
        { district: 'gull-strand', at: [14, 36] },
      ],
    },
  ],
};
