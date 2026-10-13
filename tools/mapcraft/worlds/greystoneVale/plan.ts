/**
 * Greystone Vale: a new raid map, planned coarse and drawn a district at a time
 * (`tools/mapcraft/README.md`, "A huge map").
 *
 * Districts of 64 tiles on a 6x6 grid, 384 tiles square: the fourteen the vale
 * was drawn as in the middle, and a ring round them. The vale reads as one
 * place from the top down: a moor and the Greystone peaks in the north, where
 * the river is born; the village in the west, where every road starts; the
 * river through the middle, crossed at a bridge and stepping stones; two woods
 * in the east, one dark pine and one a broadleaf maze, joined by a deer path
 * nobody signs; and the marsh, the strand and the orchards stepping down to the
 * sea. Under it, the Greystone Caves: floors with mouths in the peaks, the sea
 * cliffs and the wood, so a group can go in at one end of the vale and come out
 * at another.
 *
 * What it grew into first is the vale's grit, each a place a raid goes for
 * something it cannot get anywhere else: east of the pines a derelict power
 * station on the falls, a safari marsh behind FireRed's own gate where the
 * rarest Pokemon live, and a liner wrecked on the reef off the east cape; along
 * the coast the drowned lower quarter of the old port and the smugglers' cove
 * under the cliffs. Three of their ways out are boats and the tide, so they
 * open a while into a raid.
 *
 * The ring is the vale's far places, six of them, each hard to get to in a way
 * of its own - the showcase: Stormcrown above the peaks, only from the deepest
 * cave floor and a climb; the Moor Chapel west of the moor, only on a night
 * raid; the Lost Garden behind the station's falls, only through a boulder
 * puzzle; the Bunker under the station, only with the Card Key and its lift
 * running; and two islands out in the open sea, Frostreef and Ember Isle, only
 * by boat while the tide lets one sail. The rest of the ring is that open sea,
 * south of the coast, and wild wood beyond the moor and the pines that no road
 * goes into yet. None of the six has a landing: the getting there is the raid.
 *
 * Every district has one idea, written below, and every crossing, boat and
 * cave between them is fixed here before either side is drawn; a district's
 * program is written to its idea and starts from `startDistrict`. A far place
 * also carries its `reach`: how a raid gets in, why that is hard, what is found
 * only there, and what the game still has to learn to build it.
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
  // than a player's map, and 384 tiles square where a player's is 256), which
  // a vale of six by six districts needs.
  builtIn: true,
  // South of the orchards and the cape is the open sea, and it runs on round
  // the coast: west of the cove, south of the drowned quarter, east of the
  // cape, between the two islands - so the coast faces water to the map's edge,
  // and a boat to an island is a trip across open water rather than a step.
  seas: [
    [2, 3],
    [3, 3],
    [-1, 3],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 2],
    [4, 3],
  ],
  // The station's service gate, and the card to it lost in the pines next door.
  cardKey: { lock: 'power-station', card: 'pine-hollow' },
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
      idea: 'The farm cut out of the hillside wood as two slopes down to the sea, the terraces and the lane, and the ledges are the quick way down.',
    },
    // What the vale grew into: a column east and a coast south.
    {
      id: 'power-station',
      name: 'THE POWER STATION',
      cell: [3, 0],
      terrain: 'mountain',
      wildlife: 'power-plant',
      idea: 'A hydro-electric station run down under its dam below the pines: the turbine hall in its pocket, the switchyard gone to grass, and a service gate only the Card Key opens.',
    },
    {
      id: 'safari-marsh',
      name: 'SAFARI MARSH',
      cell: [3, 1],
      terrain: 'marsh',
      wildlife: 'safari',
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
    // The far places: a ring round the vale, none of them with a landing.
    {
      id: 'stormcrown',
      name: 'STORMCROWN',
      cell: [1, -1],
      terrain: 'mountain',
      wildlife: 'summit',
      // The storm: every fight up there is in the rain.
      rain: true,
      idea: 'The storm-struck summit above the peaks, reached only from the deepest cave floor and a climb; Mew watches from the cairn.',
      reach: {
        wayIn:
          "Only from below. A hole in the far corner of the Greystone Caves' B4F drops to a sixth floor, B5F, the deepest, which runs north under the peaks to the Chimney, a cave mouth on Stormcrown's lower shoulder. From there a path climbs round three bands of crag to the summit.",
        hard:
          'It is the bottom of a five-floor maze with no landing near it - the sea cave at Gull Strand opens onto B4F, the peaks onto the top floor - and then a climb that only goes one way in places: the ledges are the quick way back down and never a way up. No road on the surface comes within a district of it, and every fight up there is in the storm.',
        onlyHere:
          "Mew, at level 50 by the cairn on the summit: the vale's legendary boss, fought as the shipped legends are, with one throw once it is beaten. The storm bird would fit the storm, but Zapdos already stands on Route 1's Overlook and a legend stands until its kind is owned, so a second would leave the summit empty for anyone who caught the first; Mew is the one Pokemon of the 151 no map has. And the cache under the cairn.",
        needs: [
          'B5F: a sixth Greystone Caves floor, built as a maze of its own (its own seed) so the five floors that ship do not move, joined to B4F by one hole and opening on the Chimney.',
          "A legendary on a map file: a placed Pokemon marked legendary that fights as `world/legends.ts`'s do - no ball while it can fight, one throw once it is beaten, gone once its kind is owned.",
          'Rain over the summit (`MapFileDistrict.rain`, which exists) and a summit habitat measured as every table is.',
        ],
      },
    },
    {
      id: 'moor-chapel',
      name: 'THE MOOR CHAPEL',
      cell: [-1, 0],
      terrain: 'moor',
      wildlife: 'meadow',
      idea: 'A ruined chapel on the fell west of the moor, in a fog that lifts only after dark: its graveyard, its crypt and its ghosts.',
      reach: {
        wayIn:
          "From the shepherd's clearing on High Moor, a sheep track nobody signs goes west through the wood into the fog. On a night raid it comes out on the fell the chapel stands on.",
        hard:
          "Only on a night raid - the player's own clock, nine at night until five in the morning, decided when the raid deploys (`RunPlan.night`). By day the fog turns the track back, and nothing on the moor points to it but the shepherd.",
        onlyHere:
          "Ghost Pokemon, which no map has yet: Gastly, Haunter and Cubone, FireRed's Pokemon Tower, in the graveyard grass and on every step of the crypt. The crypt under the chapel holds what the drovers buried with their dead, and the Spell Tag.",
        needs: [
          'A night door: a gate shut by day and open on a night raid, built per state as a field-move door is, so the hunter and every check read it.',
          "A haunted habitat (FireRed's Pokemon Tower); nobody walks the fell by day, so it needs no night table.",
          "FireRed's Pokemon Tower as a room style for the chapel and the crypt, cut by `scripts/cut-frlg-areas.mjs`.",
          'The Spell Tag as a fifth piece of gear (`pokemon/battle/heldItems.ts`).',
        ],
      },
    },
    {
      id: 'lost-garden',
      name: 'THE LOST GARDEN',
      cell: [4, 0],
      terrain: 'forest',
      wildlife: 'garden',
      idea: "A valley sealed by cliffs behind the station's falls: the station master's garden gone wild, where the rarest grass Pokemon grow.",
      reach: {
        wayIn:
          'Behind the falls. Where the tailrace spills through the dam beside the power station, a cave mouth hides behind the water; the Falls Cave runs east through the hill and comes out in the garden. The garden has no other way in.',
        hard:
          "Nothing signs the mouth, and inside the cave a rock barrier closes the way until Strength boulders are pushed onto the floor's switches - FireRed's Victory Road rule - so a raid needs a Pokemon that knows Strength (HM04, Bill's barter) and the order to push them in.",
        onlyHere:
          "The rarest grass Pokemon in the game - Tangela and Exeggcute, and a wild Bulbasaur once in a hundred steps if the captain wants a starter met in the wild - the station master's berry trees, and the Miracle Seed.",
        needs: [
          'A switch: a floor plate a boulder rests on (or a lever) that opens a barrier for the rest of the raid. The Bunker needs the same switch for its generator; whoever is drawn first builds it.',
          'Strength boulders in a cave floor (`MapFile.boulders` placed in an area).',
          'A garden habitat, measured as every table is.',
          'The Miracle Seed as a piece of gear.',
        ],
      },
    },
    {
      id: 'frostreef',
      name: 'FROSTREEF',
      cell: [4, 4],
      island: true,
      terrain: 'coast',
      wildlife: 'shore',
      idea: "An island of ice on the outer reef, by boat on the tide from the wreck's pier: a frozen lagoon, and a cave of sliding ice.",
      reach: {
        wayIn:
          "Only by sea. The salvage launch that puts in at the Wreck's pier two minutes into a raid runs out to the reef on the flood tide - The Ice Run, two cells of open sea - and back, from 2:00 until 4:00 on the raid clock and never otherwise.",
        hard:
          "Miss the tide and the reef is out of reach that raid, and the voyage costs clock both ways. The island's best ground is through Berg Cave, whose floor is FireRed's sliding ice (Icefall Cave): a step on it carries on until something stops it, so crossing is a puzzle of where to stop.",
        onlyHere:
          'Ice Pokemon no other place has - Seel, Dewgong, Shellder and Jynx - a Lapras waiting on the frozen lagoon, and the NeverMeltIce.',
        needs: [
          "Sailing, shared with Ember Isle (the first of the two drawn builds it): a boat boarded at a jetty that carries the player tile by tile along the plan's route across the open sea, inside its window, charged to the raid clock as walking is; the hunter cannot follow over the water.",
          "Sliding ice: FireRed's Icefall Cave floor, cut from pret, on which a step carries on the same way until it is stopped.",
          "An ice habitat (FireRed's Seafoam Islands and Icefall Cave), measured as every table is.",
          'The NeverMeltIce as a piece of gear.',
        ],
      },
    },
    {
      id: 'ember-isle',
      name: 'EMBER ISLE',
      cell: [-1, 4],
      island: true,
      terrain: 'mountain',
      wildlife: 'field',
      idea: "A volcano island beyond the smugglers' cove, by their skiff: a climb round the cone to the crater, the vale's richest and worst ground.",
      reach: {
        wayIn:
          "Only by sea from the cove: the smugglers' skiff, moored off their jetty, runs out to the island - The Smugglers' Run, round the cove's headland into the open sea - from 1:00 until their own boat sails at 2:30.",
        hard:
          "The cove is a way nobody signs, and the skiff stops when the smugglers sail. On the island the crater is reached only through the Lava Tube; every step on its floor rolls an encounter, as a cave floor does, among the vale's strongest wild Pokemon, and the smugglers' best guard the hoard.",
        onlyHere:
          "The richest ground in the vale: the smugglers' hoard in the crater - more item spots than any other place, money and the rarest materials - Fire Pokemon no other place has (Ponyta, Rapidash and Magmar, FireRed's Mt. Ember), and Charcoal.",
        needs: [
          'Sailing (shared with Frostreef).',
          "A volcano habitat (FireRed's Mt. Ember), measured as every table is.",
          'Ground outdoors that rolls on every step, as a cave floor does: a named place flagged so.',
          'Charcoal as a piece of gear.',
        ],
      },
    },
  ],
  crossings: [
    // East and west, measured down the shared edge from its north end.
    { between: ['high-moor', 'greystone-peaks'], at: 36, kind: 'road' },
    { between: ['greystone-peaks', 'pine-hollow'], at: 22, kind: 'trail', hidden: true },
    { between: ['millbrook', 'the-crossing'], at: 30, kind: 'road' },
    { between: ['the-crossing', 'tanglewood'], at: 32, kind: 'road' },
    { between: ['the-crossing', 'tanglewood'], at: 52, kind: 'trail', hidden: true },
    { between: ['reedmere', 'gull-strand'], at: 18, kind: 'trail' },
    { between: ['gull-strand', 'orchard-terraces'], at: 14, kind: 'road' },
    // Where the vale grew: each of the old ways out east is the way on now.
    { between: ['pine-hollow', 'power-station'], at: 26, kind: 'road' },
    { between: ['tanglewood', 'safari-marsh'], at: 40, kind: 'road' },
    { between: ['orchard-terraces', 'the-wreck'], at: 30, kind: 'road' },
    { between: ['smugglers-cove', 'sunken-quarter'], at: 40, kind: 'trail' },
    // North and south, measured along the shared edge from its west end.
    { between: ['high-moor', 'millbrook'], at: 30, kind: 'road' },
    { between: ['greystone-peaks', 'the-crossing'], at: 28, kind: 'river' },
    { between: ['greystone-peaks', 'the-crossing'], at: 46, kind: 'road', width: 4 },
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
    // The one far place a raid walks into, and only after dark: the sheep track
    // west from the shepherd's clearing into the fog.
    { between: ['moor-chapel', 'high-moor'], at: 18, kind: 'trail', hidden: true, opens: 'night' },
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
    // The far places' own: a raid that got there need not go all the way back,
    // and the hunter's blind window needs a way out near every tile
    // (`hunterFlee.test.ts`). The islands' are boats that sail late.
    { district: 'stormcrown', side: 'north', at: 40, name: 'Cloud Stair', kind: 'trail' },
    { district: 'moor-chapel', side: 'west', at: 40, name: 'Corpse Road', kind: 'trail' },
    { district: 'lost-garden', side: 'east', at: 36, name: "Gardener's Gate", kind: 'trail' },
    { district: 'frostreef', side: 'east', at: 30, name: "Whaler's Boat", opens: { when: 'after', seconds: 220 } },
    { district: 'ember-isle', side: 'west', at: 40, name: 'Cinder Boat', opens: { when: 'after', seconds: 200 } },
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
    { district: 'power-station', name: 'The Dam', at: [30, 28], kind: 'landing' },
    { district: 'power-station', name: 'Turbine Hall', at: [31, 21], kind: 'landmark' },
    { district: 'power-station', name: 'Switchyard', at: [30, 37], kind: 'secret' },
    { district: 'safari-marsh', name: 'Rest House', at: [30, 30], kind: 'landing' },
    { district: 'the-wreck', name: 'The Wreck', at: [44, 40], kind: 'landmark' },
    { district: 'the-wreck', name: 'Salvage Camp', at: [20, 30], kind: 'landing' },
    { district: 'sunken-quarter', name: 'Drowned Mansion', at: [30, 36], kind: 'landmark' },
    { district: 'sunken-quarter', name: 'Old Quay', at: [44, 12], kind: 'landing' },
    { district: 'smugglers-cove', name: 'Contraband', at: [16, 44], kind: 'secret' },
    { district: 'smugglers-cove', name: 'Cove Steps', at: [30, 20], kind: 'landing' },
    { district: 'stormcrown', name: 'Storm Shelter', at: [44, 34], kind: 'landmark' },
    { district: 'stormcrown', name: 'The Cairn', at: [30, 18], kind: 'secret' },
    { district: 'moor-chapel', name: 'The Chapel', at: [28, 24], kind: 'landmark' },
    { district: 'moor-chapel', name: 'Lantern Cross', at: [52, 18], kind: 'landmark' },
    { district: 'lost-garden', name: 'The Glasshouse', at: [30, 30], kind: 'landmark' },
    { district: 'lost-garden', name: 'The Old Bloom', at: [46, 50], kind: 'secret' },
    { district: 'frostreef', name: 'Ice Jetty', at: [30, 20], kind: 'landmark' },
    { district: 'frostreef', name: 'The Frozen Lagoon', at: [34, 36], kind: 'landmark' },
    { district: 'ember-isle', name: "Smugglers' Landing", at: [50, 20], kind: 'landmark' },
    { district: 'ember-isle', name: 'The Crater', at: [28, 34], kind: 'landmark' },
    { district: 'ember-isle', name: 'The Hoard', at: [30, 38], kind: 'secret' },
  ],
  caves: [
    {
      id: 'greystone-caves',
      name: 'Greystone Caves',
      // Five floors ship; the sixth, B5F, is Stormcrown's way in.
      floors: 6,
      mouths: [
        { district: 'greystone-peaks', at: [42, 22], floor: 1 },
        { district: 'tanglewood', at: [52, 20], floor: 2 },
        { district: 'gull-strand', at: [14, 36], floor: 5 },
        { district: 'stormcrown', at: [24, 54], floor: 6 },
      ],
    },
    {
      // The Lost Garden's way in, behind the water at the foot of the dam.
      id: 'falls-cave',
      name: 'Falls Cave',
      floors: 1,
      mouths: [
        { district: 'power-station', at: [48, 18], floor: 1 },
        { district: 'lost-garden', at: [8, 32], floor: 1 },
      ],
    },
    {
      id: 'the-bunker',
      name: 'The Bunker',
      floors: 4,
      style: 'hideout',
      // Through the station's own door, and a steel door at the back of the
      // turbine hall.
      mouths: [{ district: 'power-station', at: [31, 23], floor: 1, locked: 'card-key' }],
      idea: 'A wartime hideout under the power station: a Card Key door in the turbine hall, four floors down, and a lift that needs its power back on.',
      reach: {
        wayIn:
          "Through the power station's door into the turbine hall - the Power Plant gets its inside - and through a steel door at the back of it that only the Card Key opens. Stairs go down to B1F and B2F.",
        hard:
          "The Card Key lies in Pine Hollow one raid in five, and it is the same card that opens the switchyard's Service Gate, so a raid carrying it chooses which. B3F and B4F have no stairs: the lift reaches them, and the lift is dead until the generator on B2F is switched back on - across a floor of FireRed's Rocket Hideout spinner tiles that carry you on until something stops you.",
        onlyHere:
          "The war room on B4F and its strongroom: the vale's locked crate, the richest cache under the vale, and the bunker's own dark - Grimer, Koffing, Voltorb and Magnemite. An escape hatch from B4F is its own way out.",
        needs: [
          "An inside for the station's Power Plant, the turbine hall.",
          'A door the Card Key opens: a locked way between two places, held open for the raid that opened it.',
          'A lift: one doorway that offers its floors and goes to the one chosen, running only once its switch is on.',
          'A switch (shared with the Lost Garden).',
          "Spinner floors (FireRed's Rocket Hideout arrows): the same rule as Frostreef's ice, a floor that carries you on until something stops you; whoever is drawn first builds it.",
          "FireRed's Rocket Hideout as a room style, cut by `scripts/cut-frlg-areas.mjs`.",
        ],
      },
    },
    {
      id: 'berg-cave',
      name: 'Berg Cave',
      floors: 2,
      style: 'ice',
      mouths: [{ district: 'frostreef', at: [46, 22], floor: 1 }],
    },
    {
      // The only way into Ember Isle's crater: in on the cone's flank, out on
      // the crater floor.
      id: 'lava-tube',
      name: 'Lava Tube',
      floors: 1,
      mouths: [
        { district: 'ember-isle', at: [44, 26], floor: 1 },
        { district: 'ember-isle', at: [30, 30], floor: 1 },
      ],
    },
    {
      id: 'chapel-crypt',
      name: 'The Crypt',
      floors: 2,
      style: 'tower',
      // The chapel's door, and under its nave the crypt.
      mouths: [{ district: 'moor-chapel', at: [28, 30], floor: 1 }],
    },
  ],
  // The boats to the two islands, each a trip across open sea that runs only
  // while the tide lets it.
  sailings: [
    {
      name: 'The Ice Run',
      from: { district: 'the-wreck', at: [56, 41] },
      to: { district: 'frostreef', at: [30, 20] },
      via: [
        [4, 2],
        [4, 3],
      ],
      runs: { from: 120, until: 240 },
    },
    {
      name: "The Smugglers' Run",
      from: { district: 'smugglers-cove', at: [22, 41] },
      to: { district: 'ember-isle', at: [50, 20] },
      via: [[-1, 3]],
      runs: { from: 60, until: 150 },
    },
  ],
};
