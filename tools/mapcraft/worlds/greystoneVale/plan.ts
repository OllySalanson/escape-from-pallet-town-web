/**
 * Greystone Vale: a new raid map, planned coarse and drawn a district at a time
 * (`tools/mapcraft/README.md`, "A huge map").
 *
 * Fourteen districts of 64 tiles in a map file's 256 square: the nine the vale
 * was planned as, and five it grew into once they were drawn - a column east
 * and a coast south. The vale reads as one place from the top down: a moor and
 * the Greystone peaks in the north, where the river is born; the village in the
 * west, where every road starts; the river through the middle, crossed at a
 * bridge and stepping stones; two woods in the east, one dark pine and one a
 * broadleaf maze, joined by a deer path nobody signs; and the marsh, the strand
 * and the orchards stepping down to the sea. Under it, the Greystone Caves: five
 * floors with mouths in the peaks, the sea cliffs and the wood, so a group can
 * go in at one end of the vale and come out at another.
 *
 * What it grew into is the vale's grit, each a place a raid goes for something
 * it cannot get anywhere else: east of the pines a derelict power station on
 * the falls, a safari marsh behind FireRed's own gate where the rarest Pokemon
 * live, and a liner wrecked on the reef off the east cape; along the coast the
 * drowned lower quarter of the old port and the smugglers' cove under the
 * cliffs. Three of their ways out are boats and the tide, so they open a while
 * into a raid.
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
      idea: 'Heather moor: the old drove road crosses past the Grey Stones, a tor, and drops south to the village by stacked ledges.',
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
      idea: 'The river splits the vale. A stone bridge and stepping stones are the two ways over, each a different walk.',
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
    // What the vale grew into: a column east and a coast south.
    {
      id: 'power-station',
      name: 'THE POWER STATION',
      cell: [3, 0],
      terrain: 'mountain',
      wildlife: 'field',
      idea: 'A derelict hydro-electric station on the falls below the pines: a fenced compound, the turbine hall inside, and a substation gate only its card key opens.',
    },
    {
      id: 'safari-marsh',
      name: 'SAFARI MARSH',
      cell: [3, 1],
      terrain: 'marsh',
      wildlife: 'wetland',
      idea: "Behind the Safari Zone's own gate, a warden's reserve of reed beds and pools where the vale's rarest Pokemon live; the rest huts are the only dry ground.",
    },
    {
      id: 'the-wreck',
      name: 'THE WRECK',
      cell: [3, 2],
      terrain: 'coast',
      wildlife: 'shore',
      idea: 'A liner run aground on the reef off the east cape: the salvage camp picks it over, and the reef is the only way out to the wreck and its scattered cargo.',
    },
    {
      id: 'sunken-quarter',
      name: 'THE SUNKEN QUARTER',
      cell: [1, 3],
      terrain: 'coast',
      wildlife: 'shore',
      idea: 'The drowned lower town of the old port, reached along the jetty from the strand: streets under the tide, roofs and a mansion standing in the shallows.',
    },
    {
      id: 'smugglers-cove',
      name: "SMUGGLERS' COVE",
      cell: [0, 3],
      terrain: 'coast',
      wildlife: 'shore',
      idea: "A hidden cove under the cliffs where the marsh drains to the sea: the smugglers' jetty, their boat, and contraband stacked in the rocks.",
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
    // Where the vale grew: each of the old ways out east is the way on now.
    { between: ['pine-hollow', 'power-station'], at: 26, kind: 'trail' },
    { between: ['tanglewood', 'safari-marsh'], at: 40, kind: 'road' },
    { between: ['orchard-terraces', 'the-wreck'], at: 30, kind: 'road' },
    { between: ['smugglers-cove', 'sunken-quarter'], at: 40, kind: 'trail' },
    // North and south, measured along the shared edge from its west end.
    { between: ['high-moor', 'millbrook'], at: 30, kind: 'road' },
    { between: ['greystone-peaks', 'the-crossing'], at: 28, kind: 'river' },
    { between: ['greystone-peaks', 'the-crossing'], at: 46, kind: 'trail' },
    { between: ['pine-hollow', 'tanglewood'], at: 18, kind: 'trail', hidden: true },
    { between: ['millbrook', 'reedmere'], at: 40, kind: 'trail' },
    { between: ['the-crossing', 'gull-strand'], at: 28, kind: 'river' },
    { between: ['the-crossing', 'gull-strand'], at: 46, kind: 'road' },
    { between: ['tanglewood', 'orchard-terraces'], at: 36, kind: 'trail' },
    { between: ['power-station', 'safari-marsh'], at: 30, kind: 'road' },
    { between: ['safari-marsh', 'the-wreck'], at: 20, kind: 'trail' },
    // The jetty runs on from the strand to the drowned quarter, and a way nobody
    // signs goes down through the reeds to the cove.
    { between: ['gull-strand', 'sunken-quarter'], at: 44, kind: 'road' },
    { between: ['reedmere', 'smugglers-cove'], at: 20, kind: 'trail', hidden: true },
  ],
  exits: [
    { district: 'millbrook', side: 'west', at: 30, name: 'Westward Road' },
    { district: 'high-moor', side: 'north', at: 28, name: 'Moor Gate', kind: 'trail' },
    { district: 'reedmere', side: 'west', at: 26, name: 'Mere Path', kind: 'trail' },
    { district: 'power-station', side: 'north', at: 30, name: 'Pylon Road' },
    { district: 'safari-marsh', side: 'east', at: 30, name: "Ranger's Track", kind: 'trail' },
    // Boats and the tide: the ways out that open a while into a raid.
    { district: 'the-wreck', side: 'east', at: 40, name: 'Salvage Launch', opens: { when: 'after', seconds: 120 } },
    { district: 'sunken-quarter', side: 'south', at: 30, name: 'Low Water Stair', opens: { when: 'after', seconds: 90 } },
    { district: 'smugglers-cove', side: 'west', at: 40, name: "Smugglers' Boat", opens: { when: 'after', seconds: 150 } },
  ],
  landmarks: [
    { district: 'millbrook', name: 'Mill Square', at: [30, 32], kind: 'landing' },
    { district: 'millbrook', name: 'The Mill', at: [44, 18], kind: 'landmark' },
    { district: 'high-moor', name: 'The Grey Stones', at: [24, 16], kind: 'landmark' },
    { district: 'high-moor', name: 'Moor Top', at: [22, 37], kind: 'landing' },
    { district: 'greystone-peaks', name: 'The Tarn', at: [26, 10], kind: 'landmark' },
    { district: 'greystone-peaks', name: 'The Quarry', at: [56, 13], kind: 'landing' },
    { district: 'pine-hollow', name: 'Three Clearings', at: [34, 34], kind: 'secret' },
    { district: 'the-crossing', name: 'Stone Bridge', at: [24, 30], kind: 'landmark' },
    { district: 'the-crossing', name: 'Stepping Stones', at: [40, 56], kind: 'landing' },
    { district: 'tanglewood', name: 'Ruined Shrine', at: [40, 28], kind: 'landmark' },
    { district: 'reedmere', name: 'The Mere', at: [30, 32], kind: 'landmark' },
    { district: 'reedmere', name: 'Duck Hide', at: [12, 50], kind: 'secret' },
    { district: 'gull-strand', name: 'The Strand', at: [42, 40], kind: 'landing' },
    { district: 'gull-strand', name: 'River Mouth', at: [28, 54], kind: 'landmark' },
    { district: 'orchard-terraces', name: 'Farmhouse', at: [30, 20], kind: 'landing' },
    { district: 'power-station', name: 'Turbine Hall', at: [32, 30], kind: 'landmark' },
    { district: 'power-station', name: 'Substation', at: [48, 16], kind: 'secret' },
    { district: 'safari-marsh', name: 'Rest House', at: [30, 30], kind: 'landing' },
    { district: 'the-wreck', name: 'The Wreck', at: [44, 40], kind: 'landmark' },
    { district: 'the-wreck', name: 'Salvage Camp', at: [20, 30], kind: 'landing' },
    { district: 'sunken-quarter', name: 'Drowned Mansion', at: [30, 36], kind: 'landmark' },
    { district: 'sunken-quarter', name: 'Old Quay', at: [44, 12], kind: 'landing' },
    { district: 'smugglers-cove', name: 'Contraband', at: [16, 44], kind: 'secret' },
    { district: 'smugglers-cove', name: 'Cove Steps', at: [30, 20], kind: 'landing' },
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
