import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { FIELD_MOVES, type FieldMoveId } from './fieldMoves';
import type { MapSketch, PlantedProp } from './mapGrid';
import { MATERIAL_CHARS, type Material } from './tileset/materials';

/**
 * How a gate looks in one of its two states, in the same two words a map is
 * drawn in: a material for the gate's own tiles, and any landmarks planted
 * while the gate is in this state - a gatehouse across a shut door, a pair of
 * posts left standing either side of an open one. Nothing here is a tile
 * number, so a gate survives a change of sheet exactly as the map around it
 * does; which tile draws a `fence` or a named prop is the catalogue's business.
 */
export interface GateAppearance {
  /** What every tile of the gate is drawn as in this state. */
  readonly material: Material;
  /**
   * Landmarks that stand only while the gate is in this state, by the name the
   * map's own tileset catalogue knows them under. A prop's solid cells block
   * like any planted landmark's, so they must stay on the gate's own tiles or
   * on ground that is solid in both states - `gates.test.ts` holds that.
   */
  readonly props?: readonly PlantedProp[];
}

/**
 * A door in the map, and what opens it.
 *
 * A gate is plain authored data, like a landmark: a set of tiles that are solid
 * until the door has been opened and ground for good after that. The author
 * supplies both states - what the door is made of and what is left when it is
 * gone - and the gate, not the sketch, is the authority for its own tiles in
 * both, so nothing drawn underneath it can leave a door that looks shut and
 * walks open.
 *
 * **Two keys, one door.** A gate is either held by a boss, whose defeat opens
 * it, or by a **field move** - a `MapGate` with a `fieldMove` instead of a
 * `bossId`, opened by walking up to it with a Pokemon that knows Cut or Surf
 * and pressing the interact key (`fieldMoves.ts`, `WorldScene.tryFieldMove`).
 * The two are one type rather than two because everything downstream of a gate
 * - the collision it writes, the map `getWorldMap` builds per state, the
 * caption, the structure rules, the drop-in screen's dark - cares only that a
 * door is shut or open and never about which key turned it. A sibling type
 * would have meant a second `applyGates`, a second `gateStateKey`, a second
 * list in every rule that walks a map in every state, and the first thing
 * anybody would have written is a function that turned one into the other.
 *
 * So what a gate carries is a **key**: a string that has to be in the list of
 * doors this save has opened. For a boss gate it is the `bossId`, which is why
 * one fight opens a door at each end of a region and why nothing about the boss
 * half changed; for a field-move gate it is the gate's own id, recorded in
 * `raidProgress.openedGates` on the step that opened it.
 */
interface MapGateBase {
  readonly id: string;
  readonly mapId: WorldMapId;
  /** What the door is called on the map, in the capitals every caption uses. */
  readonly label: string;
  readonly tiles: readonly GridPosition[];
  /** Every tile of the gate must come out solid in this state. */
  readonly closed: GateAppearance;
  /** Every tile of the gate must come out walkable in this state. */
  readonly open: GateAppearance;
}

/**
 * One boss per gate. Several gates may name the same boss, which is how one
 * fight opens a door at each end of a region.
 */
export interface BossGate extends MapGateBase {
  /** The `bossId` of the trainer whose defeat opens this gate. */
  readonly bossId: string;
  readonly fieldMove?: undefined;
}

/**
 * A door opened by what a Pokemon knows. One gate per door here - a field move
 * is spent on the lock in front of it and nothing else - and the gate's own id
 * is the key, so two doors of the same kind on one map are two separate things
 * to go and open.
 */
export interface FieldMoveGate extends MapGateBase {
  readonly fieldMove: FieldMoveId;
  readonly bossId?: undefined;
}

export type MapGate = BossGate | FieldMoveGate;

/**
 * What has to have been done for this door to stand open, as one string: the
 * boss's id, or the gate's own. Everything that asks whether a door is open
 * asks it of one flat list of these, so a save's beaten bosses and its opened
 * field gates are the same kind of fact by the time a map is built.
 */
export function gateKey(gate: MapGate): string {
  return gate.bossId ?? gate.id;
}

/** The field-move door on these tiles, if one of them is a tile of one. */
export function fieldMoveGateAt(
  gates: readonly MapGate[],
  tile: GridPosition,
): FieldMoveGate | undefined {
  return gates
    .filter((gate): gate is FieldMoveGate => gate.fieldMove !== undefined)
    .find((gate) => gate.tiles.some((own) => own.x === tile.x && own.y === tile.y));
}

export const WORLD_GATES: readonly MapGate[] = [
  {
    // The proving ground for the mechanic: one fence panel across the spur off
    // Route 1's east road, with the Overlook loop, its landing and its own exit
    // behind it.
    id: 'route-1-overlook-gate',
    mapId: 'route-1',
    bossId: 'overlook-warden',
    label: 'OVERLOOK GATE',
    tiles: [{ x: 26, y: 7 }],
    closed: { material: 'fence' },
    open: { material: 'grass' },
  },
  {
    // Wren's second door, as every boss on the Floodplain has one: the Overlook
    // stands on a bank above Oak's field station, and the way down it is choked
    // with rock until the warden gives the place up. The way in is the long
    // walk up the east road to the gate; the way back lands in the station
    // yard, a few steps from the relay exit.
    id: 'route-1-overlook-steps',
    mapId: 'route-1',
    bossId: 'overlook-warden',
    label: 'OVERLOOK STEPS',
    tiles: [{ x: 29, y: 8 }, { x: 29, y: 9 }],
    closed: { material: 'cliff' },
    open: { material: 'grass' },
  },
  {
    // The second door on Route 1, and the only one no fight opens. The mouth of
    // a ride into a hollow in the wood above the orchard, grown shut: what is
    // behind it is the hollow and nothing else, so a Cut here shortens no walk
    // the map already had and what it buys is twenty-five tiles nobody has
    // stood on. A dead stool either side of the mouth in both states, as the
    // forest's own Cut door has, because a hedge tile in a lattice of broadleaf
    // is the same green as the wall it is in and a door nobody can see is a
    // wall.
    id: 'route-1-thorn-gate',
    mapId: 'route-1',
    fieldMove: 'cut',
    label: 'THORN GATE',
    tiles: [{ x: 51, y: 9 }],
    closed: {
      material: 'hedge',
      props: [{ name: 'deadStump', x: 50, y: 9 }, { name: 'deadStump', x: 52, y: 9 }],
    },
    open: {
      material: 'grass',
      props: [{ name: 'deadStump', x: 50, y: 9 }, { name: 'deadStump', x: 52, y: 9 }],
    },
  },

  // -- Pallet Town -----------------------------------------------------------
  // The far bank of the millpond is a towpath with an end at each end: the head
  // of it, off the pond lane a dozen steps from the square, and the foot of it,
  // on the sluice apron the east ford lands on. Shut at both, it is the one part
  // of the town nobody walks - and the Mill Stair, the only way out that never
  // crosses the leat, is on it. Miller Vance holds the head, standing on the
  // lane in front of it; beating him opens the foot as well, and the town turns
  // out to be a ring: square to South Gate without crossing the water once.
  {
    id: 'pallet-towpath-gate',
    mapId: 'pallet-town',
    bossId: 'pallet-mill-keeper',
    label: 'TOWPATH GATE',
    tiles: [{ x: 27, y: 13 }, { x: 28, y: 13 }],
    closed: { material: 'fence' },
    open: { material: 'earth' },
  },
  {
    id: 'pallet-towpath-steps',
    mapId: 'pallet-town',
    bossId: 'pallet-mill-keeper',
    label: 'TOWPATH STEPS',
    // Rock off the race wall, choking the last two rows of the towpath above
    // the sluice apron - the same door the Overlook's steps are, and for the
    // same reason: what is behind it is ground the player already stood on.
    tiles: [{ x: 26, y: 28 }, { x: 27, y: 28 }],
    closed: { material: 'cliff' },
    open: { material: 'earth' },
  },

  // The headland is a place of its own: one neck onto it from the old fields,
  // and a flight of steps cut down its west face onto the hard. Salter Cobb
  // keeps the neck, standing on it; beating her opens the steps as well, and
  // the whole south turns out to be a ring - the Gate Lane down through the
  // meadows, the marsh, the strand, the hard, the headland, the old fields and
  // the drove back up to the sluice apron, without going through the town once.
  {
    id: 'pallet-cobb-gate',
    mapId: 'pallet-town',
    bossId: 'pallet-salt-keeper',
    label: 'COBB GATE',
    tiles: [{ x: 54, y: 67 }, { x: 55, y: 67 }],
    closed: { material: 'fence' },
    open: { material: 'earth' },
  },
  {
    id: 'pallet-cobb-steps',
    mapId: 'pallet-town',
    bossId: 'pallet-salt-keeper',
    label: 'COBB STEPS',
    // Cut down the headland's west face onto the stone of the hard - ground a
    // player coming the long way round has already walked.
    tiles: [{ x: 44, y: 72 }, { x: 45, y: 72 }],
    closed: { material: 'cliff' },
    open: { material: 'turf' },
  },

  // -- Viridian Forest -------------------------------------------------------
  // The rock the fire tower is built against runs east along the top of the
  // wood to the head of the Tower Steps. The way up is the nub at the tower's
  // foot, which until now went nowhere; the way down is the rake of steps into
  // the stair clearing. Lookout Pell holds the ridge, and beating him is the
  // forest turning out to be a fifth as wide as it walks: light the tower and
  // the exit it opens is a dozen steps along the top rather than the long way
  // round the whole map.
  {
    id: 'forest-ridge-gate',
    mapId: 'viridian-forest',
    bossId: 'forest-ridge-keeper',
    label: 'RIDGE GATE',
    tiles: [{ x: 19, y: 4 }],
    closed: { material: 'fence' },
    open: { material: 'grass' },
  },
  {
    id: 'forest-ridge-stair',
    mapId: 'viridian-forest',
    bossId: 'forest-ridge-keeper',
    label: 'RIDGE STAIR',
    tiles: [{ x: 25, y: 6 }, { x: 25, y: 7 }],
    closed: { material: 'cliff' },
    open: { material: 'grass' },
  },

  {
    // The mouth of an old ride off the trail under DEEP STAND, grown shut.
    // Nothing is behind it but the coppice it leads to, which is the point: a
    // cut here buys four steps at most (the wood is two-connected throughout),
    // so what it is worth is the twelve tiles of clearing nobody has walked.
    //
    // A stool either side of the mouth, in **both** states, and the growth
    // between them is the door. The same answer the Orchard Ford needed and for
    // the same reason: this wood is drawn as a lattice of bushes, so a hedge
    // tile in it is the same green as the wall it is in, and a door nobody can
    // see is a wall. Two brown stumps are the one thing on that row that is an
    // object - the mark a coppicer leaves - and after the cut they are what the
    // gap is still between.
    id: 'forest-coppice-ride',
    mapId: 'viridian-forest',
    fieldMove: 'cut',
    label: 'COPPICE RIDE',
    tiles: [{ x: 15, y: 27 }],
    closed: {
      material: 'hedge',
      props: [{ name: 'stump', x: 14, y: 27 }, { name: 'stump', x: 16, y: 27 }],
    },
    open: {
      material: 'grass',
      props: [{ name: 'stump', x: 14, y: 27 }, { name: 'stump', x: 16, y: 27 }],
    },
  },

  {
    // The quarry mouth, and the only way in from the wood. Quarryman Mott
    // stands in the lane above it - which a boss may, because a beaten one is
    // never rebuilt and the tile comes back for good.
    id: 'forest-quarry-gate',
    mapId: 'viridian-forest',
    bossId: 'forest-quarry-keeper',
    label: 'QUARRY GATE',
    tiles: [{ x: 37, y: 51 }],
    closed: { material: 'fence' },
    open: { material: 'gravel' },
  },
  {
    // His second door, and the same shape every boss in this game holds: the
    // stair cut out of the floor at the back of the working, coming out on
    // Beech Flat - which is a dozen steps from the road out, where the way in
    // by the gate is thirty-eight from the sawpit. Beaten, the quarry stops
    // being a pocket you have to come back out of and becomes the short way
    // from the south of the wood to the SOUTH GATE.
    id: 'forest-quarry-stair',
    mapId: 'viridian-forest',
    bossId: 'forest-quarry-keeper',
    label: 'QUARRY STAIR',
    tiles: [{ x: 38, y: 64 }],
    closed: { material: 'cliff' },
    open: { material: 'gravel' },
  },

  // -- Floodplain Relay ------------------------------------------------------
  // Three bosses, two doors each. The first of each pair is the door in front
  // of the player; the second is somewhere they have already stood, and opens
  // onto it, so the way back from a won district is always shorter than the
  // way in was - and one of them is the map turning out to be a ring.
  {
    // The towered bridge off Market Isle. Its deck is a landmark laid over the
    // river, and a landmark is the last word on its own tiles, so a fence drawn
    // under it would look shut and walk open: what shuts this door is the
    // barricade standing on the deck, which is also the only way to see it.
    id: 'floodplain-toll-bridge',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-toll-keeper',
    label: 'TOLL BRIDGE',
    tiles: [
      { x: 32, y: 30 }, { x: 33, y: 30 }, { x: 34, y: 30 },
      { x: 32, y: 31 }, { x: 33, y: 31 }, { x: 34, y: 31 },
    ],
    closed: {
      material: 'fence',
      props: [
        { name: 'cratePair', x: 32, y: 30 },
        { name: 'barrel', x: 34, y: 30 },
      ],
    },
    open: { material: 'stone' },
  },
  {
    id: 'floodplain-orchard-ford',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-toll-keeper',
    label: 'ORCHARD FORD',
    tiles: [{ x: 38, y: 37 }, { x: 39, y: 37 }, { x: 40, y: 37 }],
    // Shut, a ford is deep water, and deep water with nothing in it is just
    // river: a stranger touring the map read this door's caption as the
    // fountain's. So the chain Briggs keeps across it hangs from a post at each
    // end while it is shut, and goes with him.
    closed: {
      material: 'water',
      props: [
        { name: 'mooringPost', x: 38, y: 36 },
        { name: 'mooringPost', x: 40, y: 36 },
      ],
    },
    open: { material: 'ford' },
  },
  {
    // The arch of the gatehouse. Its passage is drawn over whoever is under it
    // and blocks nothing, so here the material is the door: bars in the arch.
    id: 'floodplain-sluice-gate',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-sluice-keeper',
    label: 'SLUICE GATE',
    tiles: [{ x: 46, y: 20 }, { x: 47, y: 20 }, { x: 48, y: 20 }],
    closed: { material: 'fence' },
    open: { material: 'stone' },
  },
  {
    // The drowned causeway. Deep while the sluice is held shut; once it is let
    // go the river drops and the stones are out of the water - the quay's own
    // paving, running straight across to the keep. It was a ford at first, and
    // in the game a ford is a small pool with a bank all round it: the reveal
    // read as a pond appearing rather than as a way across.
    id: 'floodplain-relay-causeway',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-sluice-keeper',
    label: 'RELAY CAUSEWAY',
    tiles: [
      { x: 40, y: 7 }, { x: 41, y: 7 }, { x: 42, y: 7 },
      { x: 40, y: 8 }, { x: 41, y: 8 }, { x: 42, y: 8 },
    ],
    closed: { material: 'water' },
    open: { material: 'stone' },
  },
  {
    // The one door on this map that no fight opens. The bar under Market Isle's
    // south treeline can be seen from Old Town's reeds on a fresh save's first
    // raid and there is no way to it on foot at all - two rows of deep water in
    // front of it, and the unfelled wood at its back. Swum once, the shoal is a
    // crossing the player knows, and the map draws the shallow it shelves on.
    //
    // Deep water shut and a ford open is the same pair the Relay Causeway
    // uses, and for the same reason: shut, a ford reads as somewhere you could
    // already wade, and open, plain water would look like a door that had not
    // moved.
    id: 'floodplain-shoal-crossing',
    mapId: 'floodplain-relay',
    fieldMove: 'surf',
    label: 'SHOAL CROSSING',
    tiles: [
      { x: 25, y: 45 }, { x: 26, y: 45 },
      { x: 25, y: 46 }, { x: 26, y: 46 },
    ],
    closed: { material: 'water' },
    open: { material: 'ford' },
  },
  {
    // The self-acting incline down the quarry face. Shut it is bare rock, and
    // the whole of the workings below - the floor, the pit, the level through
    // the hill - is a place a player can stand on the bench and look into.
    id: 'floodplain-quarry-incline',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-quarry-foreman',
    label: 'INCLINE HEAD',
    tiles: [{ x: 64, y: 12 }, { x: 65, y: 12 }],
    closed: { material: 'cliff' },
    open: { material: 'gravel' },
  },
  {
    // The foreman's second door, and the reason the quarry is not a spur: the
    // level driven through the hillside comes out on Hollow Beck, which is the
    // mill's own water and a road the player walked to get here.
    id: 'floodplain-quarry-adit',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-quarry-foreman',
    label: 'THE ADIT',
    tiles: [{ x: 88, y: 23 }, { x: 89, y: 23 }],
    closed: { material: 'cliff' },
    open: { material: 'stone' },
  },
  {
    // The stile onto the crest of the sea wall. The crest is the only dry road
    // along the bottom of the map and the only way down onto the sands, so one
    // panel of fence holds the breach, the muds and the whole south shore.
    id: 'floodplain-wall-stile',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-sea-wall-keeper',
    label: 'WALL STILE',
    tiles: [{ x: 98, y: 109 }, { x: 98, y: 110 }],
    closed: { material: 'fence' },
    open: { material: 'earth' },
  },
  {
    // And the banksman's second door, at the other end of the sands: the hard
    // cut through the wharf's quay wall. Beaten, the walk from the breach back
    // to the Staithe is along the bottom of the map at low water, and the
    // Staithe is ground a fresh save already knows. Called the WHARF HARD and
    // not the ferry hard because Pallet Town's valley has a FERRY HARD of its
    // own, and two things with one name in one game is a thing a player
    // notices before a reviewer does.
    id: 'floodplain-wharf-hard',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-sea-wall-keeper',
    label: 'WHARF HARD',
    tiles: [{ x: 24, y: 111 }, { x: 25, y: 111 }],
    closed: { material: 'cliff' },
    open: { material: 'sand' },
  },
  {
    // The second CUT door in the game, and the same shape as the first: one
    // bed at the corner of the withy grounds whose ride grew over, with the
    // cutter's store still standing in it. A dead end on purpose - a field
    // move on this map opens ground, never a short cut.
    id: 'floodplain-osier-ride',
    mapId: 'floodplain-relay',
    fieldMove: 'cut',
    label: 'OSIER RIDE',
    tiles: [{ x: 90, y: 88 }],
    closed: {
      material: 'hedge',
      props: [{ name: 'stump', x: 90, y: 87 }, { name: 'stump', x: 90, y: 89 }],
    },
    open: {
      material: 'ford',
      props: [{ name: 'stump', x: 90, y: 87 }, { name: 'stump', x: 90, y: 89 }],
    },
  },
  {
    id: 'floodplain-vault-fence',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-orchard-warden',
    label: 'ORCHARD FENCE',
    tiles: [{ x: 53, y: 45 }, { x: 54, y: 45 }],
    closed: { material: 'fence' },
    open: { material: 'earth' },
  },
  {
    id: 'floodplain-vault-causeway',
    mapId: 'floodplain-relay',
    bossId: 'floodplain-orchard-warden',
    label: 'VAULT CAUSEWAY',
    tiles: [{ x: 31, y: 54 }, { x: 31, y: 55 }],
    closed: { material: 'fence' },
    open: { material: 'stone' },
  },
];

/**
 * The two lists a save keeps about doors, which every caller reads as one.
 *
 * Structural rather than `RaidProgress` so `gates.ts` stays at the bottom of
 * the import graph; `SaveManager`'s record satisfies it, and so does a run
 * plan's own copy of both lists.
 */
export interface OpenedDoorRecord {
  readonly defeatedBosses: readonly string[];
  readonly openedGates?: readonly string[];
}

/**
 * Every door this save has opened, as one flat list of gate keys.
 *
 * A beaten boss and a cut tree are the same fact by the time a map is built -
 * see `gateKey` - so this is what goes into `getWorldMap`, `isGateOpen` and
 * `gateStateKey`, and no caller downstream of it has to carry two lists.
 */
export function openedDoors(record: OpenedDoorRecord): readonly string[] {
  return [...record.defeatedBosses, ...(record.openedGates ?? [])];
}

export function gatesForMap(mapId: WorldMapId): readonly MapGate[] {
  return WORLD_GATES.filter((gate) => gate.mapId === mapId);
}

/**
 * Whether this door stands open for a player who has done these things.
 *
 * `opened` is one flat list of gate keys - beaten boss ids and the ids of field
 * gates already worked open - because by the time a map is built the two are
 * the same fact. `openedDoors()` in `SaveManager` is what puts a save's two
 * lists together; nothing here needs to know which half a key came from.
 */
export function isGateOpen(gate: MapGate, opened: readonly string[]): boolean {
  return opened.includes(gateKey(gate));
}

/**
 * Writes every gate onto a sketch in the state the player has earned. Done on
 * the sketch rather than on finished layers because a material is drawn from
 * what stands beside it: the autotiler gives a fence its end posts and a lane
 * its edges from the eight neighbours, so taking a panel out afterwards would
 * leave the run either side of it drawn as though it were still there.
 */
export function applyGates(
  sketch: MapSketch,
  gates: readonly MapGate[],
  opened: readonly string[],
): MapSketch {
  for (const gate of gates) {
    const appearance = isGateOpen(gate, opened) ? gate.open : gate.closed;
    for (const tile of gate.tiles) {
      sketch.raw(tile.x, tile.y, MATERIAL_CHARS[appearance.material]);
    }
    for (const prop of appearance.props ?? []) {
      sketch.plant(prop.x, prop.y, prop.name);
    }
  }
  return sketch;
}

/**
 * Which of a map's gates are open, as one string. Two sets of opened doors that
 * leave the same gates open are the same map, so this - and not the key list -
 * is what a built map is remembered under.
 */
export function gateStateKey(gates: readonly MapGate[], opened: readonly string[]): string {
  return gates
    .filter((gate) => isGateOpen(gate, opened))
    .map((gate) => gate.id)
    .sort()
    .join('+');
}

/**
 * Every boss that holds a gate on these gates' map, once each, in authored
 * order. Bosses only: this is what the standing board draws a sealed contract
 * from and what a tool means by "open this map up", and a field-move door has
 * no keeper to name.
 */
export function gateBossIds(gates: readonly MapGate[]): readonly string[] {
  return [...new Set(gates.flatMap((gate) => (gate.bossId === undefined ? [] : [gate.bossId])))];
}

/** Every key that opens something on this map, once each, in authored order. */
export function gateKeys(gates: readonly MapGate[]): readonly string[] {
  return [...new Set(gates.map(gateKey))];
}

/**
 * The gate states a map is tested in: every door shut, each key turned alone,
 * and every door open. A map with no gates has the one state it always had.
 *
 * A field-move door is a state here exactly as a boss is, which is the whole
 * reason the two are one type: every rule a map is held to is asked again with
 * the wood cut and the reach swum, and again with neither.
 */
export function gateStatesToVerify(gates: readonly MapGate[]): readonly (readonly string[])[] {
  const keys = gateKeys(gates);
  if (keys.length === 0) {
    return [[]];
  }
  const states: (readonly string[])[] = [[], ...keys.map((key) => [key])];
  if (keys.length > 1) {
    states.push(keys);
  }
  return states;
}

/**
 * What the map says over a gate. A shut door says what would open it, because
 * that is the whole instruction - a keeper's name, or the move it wants; an
 * open one says so, because a door the player opened three raids ago is
 * otherwise one more gap in a fence.
 */
export function gateCaption(gate: MapGate, open: boolean, bossName: string | undefined): string {
  if (open) {
    return `${gate.label}\nOPEN`;
  }
  if (gate.fieldMove) {
    return `${gate.label}\n${FIELD_MOVES[gate.fieldMove].doorNote}`;
  }
  return bossName ? `${gate.label}\nHELD BY ${bossName}` : `${gate.label}\nSHUT`;
}

/**
 * The doors of a map, keeper by keeper, in authored order - which is front door
 * first. A keeper with one door is a group of one.
 */
export function gatesByKeeper(gates: readonly MapGate[]): readonly (readonly MapGate[])[] {
  return gateKeys(gates).map((key) => gates.filter((gate) => gateKey(gate) === key));
}

/**
 * Several doors named in one breath. Doors that share their first words say
 * them once - OVERLOOK GATE + STEPS - and doors that share none take a line
 * each, because a caption is read at a glance and TOLL BRIDGE + ORCHARD FORD on
 * one line is wider than the ground either door has beside it.
 */
export function jointGateLabel(gates: readonly MapGate[]): string {
  const [first, ...rest] = gates.map((gate) => gate.label.split(' '));
  if (!first) {
    return '';
  }
  let shared = 0;
  while (
    shared < first.length - 1 &&
    rest.every((words) => shared < words.length - 1 && words[shared] === first[shared])
  ) {
    shared += 1;
  }
  const names = [first.join(' '), ...rest.map((words) => words.slice(shared).join(' '))];
  return names.join(shared > 0 ? ' + ' : ' +\n');
}

/**
 * What the map says when two or more of one keeper's doors are on screen at
 * once: one caption naming them all, in place of each door's own. One boss per
 * gate and one fight for all of that boss's gates, so they are always in the
 * same state.
 */
export function jointGateCaption(
  gates: readonly MapGate[],
  open: boolean,
  bossName: string | undefined,
): string {
  const label = jointGateLabel(gates);
  if (open) {
    return `${label}\nOPEN`;
  }
  return bossName ? `${label}\nHELD BY ${bossName}` : `${label}\nSHUT`;
}

/** The line spoken once, on the return from the fight that opened these gates. */
export function gatesOpenedLines(opened: readonly MapGate[]): readonly string[] {
  if (opened.length === 0) {
    return [];
  }
  const names = opened.map((gate) => gate.label);
  const listed =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return [
    `${listed} ${names.length === 1 ? 'is' : 'are'} open - and ${names.length === 1 ? 'stays' : 'stay'} open on every raid from now on.`,
  ];
}
