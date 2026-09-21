import { ITEMS, cellsFor, type ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

export interface WorldPoi {
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly label: string;
  readonly description: string;
  readonly reward: readonly { readonly itemId: ItemId; readonly quantity: number }[];
  /**
   * A landmark can change the route state even when it has no item reward.
   * Every map has exactly one exit that opens this way, and it is always at the
   * other end of the map from the landmark that opens it.
   */
  readonly effect?: 'unlock-extraction';
  /** What that exit is called, so the landmark can name it when it opens. */
  readonly unlockedExtractionLabel?: string;
}

export type PoiActivationResult = 'activated' | 'unavailable' | 'bag-full';

/**
 * Fixed landmarks belong to authored map content, not the seeded loot pool.
 * They can only be activated once during an active extraction raid.
 */
export function tryActivatePoi(
  poi: WorldPoi | undefined,
  isRunActive: boolean,
  activatedPoiIds: Set<string>,
  collectRunItem: (itemId: ItemId, quantity: number) => boolean,
  hasRoomForAll: (reward: WorldPoi['reward']) => boolean,
): PoiActivationResult {
  if (!poi || !isRunActive || activatedPoiIds.has(poi.id)) {
    return 'unavailable';
  }

  // Whole or not at all. Taken a piece at a time, two Poke Balls that fit and a
  // Potion that does not left the balls in the pack with the landmark still
  // unworked - so walking over it again paid the balls out a second time.
  if (!hasRoomForAll(poi.reward)) {
    return 'bag-full';
  }
  poi.reward.forEach((item) => collectRunItem(item.itemId, item.quantity));

  activatedPoiIds.add(poi.id);
  return 'activated';
}

export const WORLD_POIS: readonly WorldPoi[] = [
  {
    id: 'pallet-town-pump',
    mapId: 'pallet-town',
    position: { x: 3, y: 16 },
    label: 'TOWN PUMP',
    description:
      'The town\'s own pump on the Green, and the box the parish keeps beside it: clean water, two Potions and an Antidote.',
    reward: [
      { itemId: 'potion', quantity: 2 },
      { itemId: 'antidote', quantity: 1 },
    ],
  },
  {
    id: 'pallet-sluice-wheel',
    mapId: 'pallet-town',
    position: { x: 25, y: 31 },
    label: 'SLUICE WHEEL',
    description: 'The hatch at the head of the leat, below the mill race. Winding it shut drains the culvert on the far shore of the Flood and opens it as an exit.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'WEST CULVERT',
  },
  {
    // The charcoal burner's floor in the high wood, off the first turn of the
    // ride. Whatever he was cutting for, he left the hut standing.
    id: 'pallet-charcoal-hearth',
    mapId: 'pallet-town',
    position: { x: 38, y: 4 },
    label: 'CHARCOAL HEARTH',
    description:
      'The burner\'s floor in the high wood, a short climb east of the north field. His tin of lamp oil is still under the hut and there is a Potion on the stump.',
    reward: [
      { itemId: 'lamp-oil', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    // The level driven into the quarry's west face. The quarry is a raid's
    // whole width from the town, so what is in it pays for the walk.
    id: 'pallet-quarry-adit',
    mapId: 'pallet-town',
    position: { x: 53, y: 17 },
    label: 'THE ADIT',
    description:
      'The level driven into the quarry face, still shored and still stocked: a crate of the hasps and bolts the shoring is hung on, and the oil they worked by.',
    reward: [
      { itemId: 'parts-crate', quantity: 1 },
      { itemId: 'lamp-oil', quantity: 1 },
    ],
  },
  {
    // The salt works in the middle of the marsh: the one thing on the saltings
    // anybody kept up, and the only reason to leave the causeway.
    id: 'pallet-salt-pans',
    mapId: 'pallet-town',
    position: { x: 8, y: 67 },
    label: 'THE SALT PANS',
    description:
      'The pans worked between the two creeks, and the barrels stacked on the walk between them. Two Antidotes off the brine shelf and a roll of the linen they strain through.',
    reward: [
      { itemId: 'antidote', quantity: 2 },
      { itemId: 'linen-roll', quantity: 1 },
    ],
  },
  {
    // Behind both of Salter Cobb's doors, on the seaward side of the light.
    // The only cache on this map that costs a boss.
    id: 'pallet-beacon-light',
    mapId: 'pallet-town',
    position: { x: 57, y: 71 },
    label: 'BEACON LIGHT',
    description:
      'The lamp store on the seaward side of the beacon, behind the salter\'s two doors. Oil for the light, and the cable that used to carry its warning inland.',
    reward: [
      { itemId: 'lamp-oil', quantity: 1 },
      { itemId: 'cable-coil', quantity: 1 },
    ],
  },
  {
    // The spring the millpond is fed by, under a stone house in the hanger.
    // The mill's own water, half a valley from the mill.
    id: 'pallet-spring-house',
    mapId: 'pallet-town',
    position: { x: 37, y: 22 },
    label: 'SPRING HOUSE',
    description:
      'The stone house over the spring in the hanger, where the millpond starts. Cold all year, which is why the good medicine is kept in it.',
    reward: [
      { itemId: 'super-potion', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ],
  },
  {
    // The quarry's south bay is a dead end four tiles wide and seven deep, and
    // a dead end is only worth walking if there is something at the end of it.
    id: 'pallet-powder-store',
    mapId: 'pallet-town',
    position: { x: 56, y: 28 },
    label: 'THE POWDER STORE',
    description:
      'The blasting store cut into the back of the quarry, well away from the face. Charges and fuse line: a parts crate and a coil of cable.',
    reward: [
      { itemId: 'parts-crate', quantity: 1 },
      { itemId: 'cable-coil', quantity: 1 },
    ],
  },
  {
    // The meadow corner north of the withy beds, the last pocket of the map
    // with nothing in it. The hatch is what makes a water meadow one.
    id: 'pallet-meadow-hatch',
    mapId: 'pallet-town',
    position: { x: 28, y: 46 },
    label: 'THE MEADOW HATCH',
    description:
      'The hatch that used to flood the meadows off the carrier, seized open since the flood. Nobody came back for the ironwork stacked beside it.',
    reward: [{ itemId: 'parts-crate', quantity: 1 }],
  },
  {
    // The top of the north field is the first tall grass out of the square and
    // was the emptiest ground on the map - nineteen steps from anything
    // authored, further than any tile of the new valley. The bird-scarer's post
    // is what the field is worked from, so it is what stands in it.
    id: 'pallet-scare-post',
    mapId: 'pallet-town',
    position: { x: 17, y: 7 },
    label: 'THE SCARE POST',
    description:
      'The bird-scarer\'s post at the head of the north field, with the lad\'s tin and two spare Poke Balls wedged in the crook of it.',
    reward: [{ itemId: 'poke-ball', quantity: 2 }],
  },
  {
    // The wet pocket east of the rickyard is a dead end, and a dead end is
    // only worth walking if something is at the end of it. The decoy pipe is
    // the reason a fowler ever came out this far.
    id: 'pallet-decoy-pond',
    mapId: 'pallet-town',
    position: { x: 35, y: 59 },
    label: 'THE DECOY',
    description:
      'The duck decoy in the wet corner of the water meadows, its pipe still netted. The fowler\'s own balls are in the hide, the good one included.',
    reward: [
      { itemId: 'great-ball', quantity: 1 },
      { itemId: 'poke-ball', quantity: 1 },
    ],
  },
  {
    // The old landing stage out in the marsh, from when the saltings were
    // worked by boat rather than walked. The one thing to make for out there.
    id: 'pallet-staithe',
    mapId: 'pallet-town',
    position: { x: 19, y: 71 },
    label: 'THE STAITHE',
    description:
      'The old landing stage out on the saltings, between the two creeks. A coil of tarred rope still on the bollard, and a Potion in what is left of the locker.',
    reward: [
      { itemId: 'mooring-rope', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'oak-field-station-relay',
    mapId: 'route-1',
    position: { x: 26, y: 15 },
    label: "OAK'S FIELD STATION",
    description:
      'Marked supply cache at the station door: 2 Poké Balls and 1 Potion. Switching its relay on opens the Station Relay exit at the east end of the yard.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'STATION RELAY',
  },
  {
    // The store at the packing shed door, inside the orchard wall. The one
    // cache on this map a player can reach without leaving mown ground.
    id: 'route-1-orchard-store',
    mapId: 'route-1',
    position: { x: 39, y: 23 },
    label: 'ORCHARD STORE',
    description:
      'The picker\'s store built into the orchard wall: a roll of the sacking they pick into, and the cider they keep for a long day.',
    reward: [
      { itemId: 'linen-roll', quantity: 1 },
      { itemId: 'potion', quantity: 2 },
    ],
  },
  {
    // Behind the THORN GATE, and the whole of what that door is worth. Nothing
    // else is in the hollow, which is the point: a Cut here shortens no walk
    // the map already had.
    id: 'route-1-thorn-cache',
    mapId: 'route-1',
    position: { x: 52, y: 6 },
    label: 'THORN DELL',
    description:
      'A hollow in the wood that the thorn closed over. Whatever has been living in it since is worth a good ball, and there are two on the shelf.',
    reward: [{ itemId: 'great-ball', quantity: 2 }],
  },
  {
    // The map's second sealed exit, at the far end of it from the first. The
    // kiln is at the west side of the burn and the cart road out is a nook in
    // the rock at the east, so working it is the errand rather than the reward.
    id: 'route-1-charcoal-kiln',
    mapId: 'route-1',
    position: { x: 54, y: 56 },
    label: 'THE CHARCOAL KILN',
    description: 'The burner\u2019s kiln, still warm. Drawing it opens the KILN ROAD, the cart track out of the east side of the burn.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'KILN ROAD',
  },
  {
    // A clearing off the steading track that is on the way to nothing.
    id: 'route-1-hollow-oak',
    mapId: 'route-1',
    position: { x: 38, y: 39 },
    label: 'THE HOLLOW OAK',
    description:
      'The stump of an oak nobody could shift, in a clearing off the steading track. The ranger keeps one good ball and a flask dry in the hollow of it.',
    reward: [
      { itemId: 'great-ball', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    // The paddocks' far pen is a dead end behind a gate in the middle of the
    // fence, so it needed the thing worth going in for rather than another
    // stretch of grass to walk through.
    id: 'route-1-stock-trough',
    mapId: 'route-1',
    position: { x: 59, y: 22 },
    label: 'THE STOCK TROUGH',
    description:
      'The stone trough in the steading\'s far field. The drench kit is under the lip of it, where the stockman left it: two Antidotes and a Potion.',
    reward: [
      { itemId: 'antidote', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    // The far corner of the steading's yard, behind the house: reachable only
    // the long way round, and the furthest ground on this map from anything
    // authored until the well went in it.
    id: 'route-1-farm-well',
    mapId: 'route-1',
    position: { x: 59, y: 35 },
    label: 'THE FARM WELL',
    description:
      'The well at the back of the farmhouse, out of the way of everything. The house\'s linen is on the line above it and its good medicine on the sill.',
    reward: [
      { itemId: 'super-potion', quantity: 1 },
      { itemId: 'linen-roll', quantity: 1 },
    ],
  },
  {
    // The clearing off the Old Road that is on the way to nothing.
    id: 'route-1-wayside-shrine',
    mapId: 'route-1',
    position: { x: 34, y: 54 },
    label: 'THE WAYSIDE SHRINE',
    description:
      'A shrine in a clearing off the Old Road, with a bench in front of it. Travellers leave what a shrine is given: cloth, and oil for the lamp.',
    reward: [
      { itemId: 'linen-roll', quantity: 1 },
      { itemId: 'lamp-oil', quantity: 1 },
    ],
  },
  {
    // On the common, in the tall grass between the two roads: the one cache on
    // this map you cannot reach without paying for it in fights.
    id: 'route-1-drovers-cairn',
    mapId: 'route-1',
    position: { x: 19, y: 55 },
    label: "DROVER'S CAIRN",
    description:
      'The cairn the drovers pile on the common, out in the gorse with a road either side of it. Every man who passes leaves one small thing on it.',
    reward: [
      { itemId: 'poke-ball', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ],
  },
  {
    id: 'forest-fire-tower',
    mapId: 'viridian-forest',
    position: { x: 14, y: 4 },
    label: 'FIRE TOWER',
    description: 'The stone tower that stands above the canopy. Lighting it opens the Tower Steps, the stair in the rock on the east ridge.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'TOWER STEPS',
  },
  {
    // Behind the CUT door, and the whole of what that door is worth. A cache
    // rather than a route: the wood is two-connected, so a cut anywhere in it
    // saves four steps, and what makes an HM worth carrying is the clearing on
    // the other side of one.
    id: 'forest-coppice-store',
    mapId: 'viridian-forest',
    position: { x: 13, y: 29 },
    label: "COPPICER'S STORE",
    description:
      'The store in the old coppice, behind the growth that closed the ride. His billhooks and wedges are still crated, and the medicine he kept for a slip with them is still good.',
    reward: [
      { itemId: 'parts-crate', quantity: 1 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    // The east half's own cache. Between the firebreak and the collier's yard
    // there was nothing to turn aside for, and the quietest ground on the map
    // by a distance was the shingle at the head of the tarn - so what stands on
    // it is a hide, which is the one thing anybody builds on a pool like that.
    id: 'forest-tarn-hide',
    mapId: 'viridian-forest',
    position: { x: 54, y: 13 },
    label: 'THE TARN HIDE',
    description:
      'A watcher\'s hide on the shingle at the head of the tarn, with the box of tackle whoever built it left under the bench. Three balls in it, and nothing else worth the walk.',
    reward: [{ itemId: 'poke-ball', quantity: 3 }],
  },
  {
    // The south's own cache, in the timber yard everybody walks through on the
    // way to the hollow way. Nothing seals behind it: it is the ordinary kind
    // of landmark, which a map this size needs more than one of.
    id: 'forest-sawyers-store',
    mapId: 'viridian-forest',
    position: { x: 20, y: 44 },
    label: "SAWYER'S STORE",
    description:
      'The lean-to at the foot of the sawpit, with the lamp they worked the dark end of the day by still on its hook - and the bottle they kept for a slip with a pit saw.',
    reward: [
      { itemId: 'lamp-oil', quantity: 1 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    // Behind Quarryman Mott, beside the adit that is also the way home. The
    // best cache on the map because it is behind the deepest door on it.
    id: 'forest-adit-store',
    mapId: 'viridian-forest',
    position: { x: 42, y: 62 },
    label: 'ADIT STORE',
    description:
      'The quarrymen\'s store at the back of the working, under the adit mouth. Nobody has been down here since the gate was hung, and two crates are still stacked against the wall.',
    reward: [
      { itemId: 'parts-crate', quantity: 2 },
      { itemId: 'lamp-oil', quantity: 1 },
    ],
  },
  {
    // The far south-west corner, which is the longest walk on the map from any
    // landing. What is out there has to be worth the walk out there.
    id: 'forest-warren-dig',
    mapId: 'viridian-forest',
    position: { x: 9, y: 62 },
    label: 'THE OLD DIG',
    description:
      'Somebody dug into the sand bank a long time ago and roofed it with a board. They were after what lives in the bank, and they came out for it properly equipped: two Great Balls and a spare.',
    reward: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'poke-ball', quantity: 1 },
    ],
  },
  {
    // The home bank's own cache. The supply vault was this map's only one, and
    // it is behind two bosses now; a fresh save had nothing left to detour for.
    id: 'floodplain-drowned-chapel',
    mapId: 'floodplain-relay',
    position: { x: 12, y: 41 },
    label: 'DROWNED CHAPEL',
    description:
      'Old Town\'s chapel, standing in what was its green. What was high enough to keep is still on the shelf above the waterline: the altar linen, and a Potion.',
    reward: [
      { itemId: 'linen-roll', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'floodplain-supply-vault',
    mapId: 'floodplain-relay',
    position: { x: 44, y: 50 },
    label: 'FLOODED SUPPLY VAULT',
    description:
      'High-value cache under the open trapdoor - and the one store on this map that was stocked as a store. The causeway west is the short way out once the orchard warden is beaten.',
    reward: [
      { itemId: 'super-potion', quantity: 2 },
      { itemId: 'great-ball', quantity: 2 },
    ],
  },
  {
    // On the bar in the great reach, across the SURF door. What the flood took
    // off the quay and put down again where nobody could follow it.
    id: 'floodplain-shoal-cache',
    mapId: 'floodplain-relay',
    position: { x: 28, y: 43 },
    label: 'STRANDED LIGHTER',
    description:
      'A relay lighter left on the bar when the water dropped, still holding what it was carrying up to the keep: her warp on the bitts and a valve in the crate under them.',
    reward: [
      { itemId: 'mooring-rope', quantity: 1 },
      { itemId: 'radio-valve', quantity: 1 },
    ],
  },
  {
    // The quarry's magazine, cut into the bench behind the crane bed. It is
    // the one cache on the top of the workings, and it is there whether or not
    // the foreman has let anybody down the incline.
    id: 'floodplain-powder-house',
    mapId: 'floodplain-relay',
    position: { x: 68, y: 10 },
    label: 'POWDER HOUSE',
    description:
      'The magazine cut into the quarry bench. Locked when the water came up, and the fuse line is still coiled on its reels: two of them.',
    reward: [{ itemId: 'cable-coil', quantity: 2 }],
  },
  {
    id: 'floodplain-press-house',
    mapId: 'floodplain-relay',
    position: { x: 66, y: 47 },
    label: 'THE PRESS HOUSE',
    description:
      'The cider press behind the orchard, with the pickers\' kit still stacked against the wall. What comes off a press is stronger than what goes into it.',
    reward: [
      { itemId: 'super-potion', quantity: 1 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    // The second landmark on this map that opens a way out, and the only one a
    // fresh save can reach: swinging the crane drops the old steps at the top
    // of the wharf, which is the whole length of the quay away from it.
    id: 'floodplain-staithe-crane',
    mapId: 'floodplain-relay',
    position: { x: 37, y: 101 },
    label: 'STAITHE CRANE',
    description: 'The hand crane on the wharf, still barred. Swinging the jib back clears the old steps at the top of the lanes and opens them as a way out.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'STAITHE STEPS',
  },
  {
    id: 'floodplain-shepherds-hut',
    mapId: 'floodplain-relay',
    position: { x: 19, y: 81 },
    label: "SHEPHERD'S HUT",
    description:
      'A hut on wheels in the middle of the grazing, with the lambing kit in it that somebody kept stocked for a season nobody came back for: cloths and a drench.',
    reward: [
      { itemId: 'linen-roll', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ],
  },
  {
    // Behind the CUT door, exactly as Viridian's store is: the ride into this
    // bed grew over and what was cut and stacked in it is still stacked.
    id: 'floodplain-osier-store',
    mapId: 'floodplain-relay',
    position: { x: 92, y: 87 },
    label: "OSIER CUTTER'S STORE",
    description:
      'A withy bed nobody has cut since the ride into it grew shut, and the cutter\'s own store still standing in the middle of it, with his bundles banded and stacked.',
    reward: [
      { itemId: 'linen-roll', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'floodplain-pumping-engine',
    mapId: 'floodplain-relay',
    position: { x: 106, y: 60 },
    label: 'PUMPING ENGINE',
    description:
      'The engine that kept the levels dry, standing over its own drain with the fire long out. Its spares are crated beside it and nobody has opened them.',
    reward: [{ itemId: 'parts-crate', quantity: 2 }],
  },
  {
    // Behind the banksman, out on the sands. Nothing else on this map is
    // reached by walking out onto the bed of an estuary at low water.
    id: 'floodplain-stranded-barge',
    mapId: 'floodplain-relay',
    position: { x: 28, y: 116 },
    label: 'STRANDED BARGE',
    description:
      'A relay barge left on the sand when the tide went out and never floated again. She was carrying valves up to the keep, and they are still under her hatches.',
    reward: [{ itemId: 'radio-valve', quantity: 2 }],
  },
  {
    id: 'floodplain-church-farm',
    mapId: 'floodplain-relay',
    position: { x: 45, y: 76 },
    label: 'CHURCH FARM',
    description:
      'The farm that stood by the church, with a foot of water in its yard and its kitchen door still on the latch. The kitchen shelf is where a farm keeps its medicine, and there are three Potions on it.',
    reward: [{ itemId: 'potion', quantity: 3 }],
  },
  {
    id: 'floodplain-decoy',
    mapId: 'floodplain-relay',
    position: { x: 44, y: 98 },
    label: 'THE DECOY',
    description:
      'A duck decoy: a pond with curved pipes of netting off it, and the fowler\'s kit still in the screen at the end of one.',
    reward: [
      { itemId: 'great-ball', quantity: 1 },
      { itemId: 'poke-ball', quantity: 2 },
    ],
  },
  {
    id: 'floodplain-wreck',
    mapId: 'floodplain-relay',
    position: { x: 81, y: 122 },
    label: 'THE WRECK',
    description:
      'A trading smack driven onto the bar and left there. What was worth taking went a year ago; what nobody could be bothered to cut free is her two warps.',
    reward: [{ itemId: 'mooring-rope', quantity: 2 }],
  },
  {
    id: 'floodplain-ranger-radio',
    mapId: 'floodplain-relay',
    position: { x: 12, y: 16 },
    label: 'RANGER STATION',
    description: 'Hunter forecast: the shore road is exposed, the reeds break sightlines, and switching this on opens the Radio Exit out west in the marsh.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'RADIO EXIT',
  },
];

export function poisForMap(mapId: WorldMapId): readonly WorldPoi[] {
  return WORLD_POIS.filter((poi) => poi.mapId === mapId);
}

/**
 * What a landmark says when its cache will not go into the pack.
 *
 * It names the cache and the squares it needs, exactly as ground loot does:
 * "bag is full" on its own is a wall, and the grid's promise is that a refusal
 * hands the player the decision. Nothing is taken and nothing is worked, so
 * the answer is to put something down and step back on to it.
 */
export function cacheRefusalLine(poi: WorldPoi): string {
  const squares = poi.reward.reduce(
    (total, { itemId, quantity }) => total + cellsFor(itemId, quantity),
    0,
  );
  const names = poi.reward
    .map(({ itemId, quantity }) => `${quantity}\u00d7 ${ITEMS[itemId].displayName.toUpperCase()}`)
    .join(' and ');
  return `No room for ${names} - the cache needs ${
    squares === 1 ? '1 square' : `${squares} squares`
  }.`;
}
