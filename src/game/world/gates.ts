import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
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
 * A door in the map that a boss holds shut.
 *
 * A gate is plain authored data, like a landmark: a set of tiles that are solid
 * until the boss named by `bossId` has been beaten, and ground for good after
 * that. The author supplies both states - what the door is made of and what is
 * left when it is gone - and the gate, not the sketch, is the authority for its
 * own tiles in both, so nothing drawn underneath it can leave a door that looks
 * shut and walks open.
 *
 * One boss per gate. Several gates may name the same boss, which is how one
 * fight opens a door at each end of a region.
 */
export interface MapGate {
  readonly id: string;
  readonly mapId: WorldMapId;
  /** The `bossId` of the trainer whose defeat opens this gate. */
  readonly bossId: string;
  /** What the door is called on the map, in the capitals every caption uses. */
  readonly label: string;
  readonly tiles: readonly GridPosition[];
  /** Every tile of the gate must come out solid in this state. */
  readonly closed: GateAppearance;
  /** Every tile of the gate must come out walkable in this state. */
  readonly open: GateAppearance;
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

export function gatesForMap(mapId: WorldMapId): readonly MapGate[] {
  return WORLD_GATES.filter((gate) => gate.mapId === mapId);
}

export function isGateOpen(gate: MapGate, defeatedBosses: readonly string[]): boolean {
  return defeatedBosses.includes(gate.bossId);
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
  defeatedBosses: readonly string[],
): MapSketch {
  for (const gate of gates) {
    const appearance = isGateOpen(gate, defeatedBosses) ? gate.open : gate.closed;
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
 * Which of a map's gates are open, as one string. Two lists of beaten bosses
 * that open the same doors are the same map, so this - and not the boss list -
 * is what a built map is remembered under.
 */
export function gateStateKey(gates: readonly MapGate[], defeatedBosses: readonly string[]): string {
  return gates
    .filter((gate) => isGateOpen(gate, defeatedBosses))
    .map((gate) => gate.id)
    .sort()
    .join('+');
}

/** Every boss that holds a gate on these gates' map, once each, in authored order. */
export function gateBossIds(gates: readonly MapGate[]): readonly string[] {
  return [...new Set(gates.map((gate) => gate.bossId))];
}

/**
 * The gate states a map is tested in: every door shut, each boss beaten alone,
 * and every door open. A map with no gates has the one state it always had.
 */
export function gateStatesToVerify(gates: readonly MapGate[]): readonly (readonly string[])[] {
  const bosses = gateBossIds(gates);
  if (bosses.length === 0) {
    return [[]];
  }
  const states: (readonly string[])[] = [[], ...bosses.map((boss) => [boss])];
  if (bosses.length > 1) {
    states.push(bosses);
  }
  return states;
}

/**
 * What the map says over a gate. A shut door names who is holding it, because
 * that is the whole instruction; an open one says so, because a door the player
 * opened three raids ago is otherwise one more gap in a fence.
 */
export function gateCaption(gate: MapGate, open: boolean, bossName: string | undefined): string {
  if (open) {
    return `${gate.label}\nOPEN`;
  }
  return bossName ? `${gate.label}\nHELD BY ${bossName}` : `${gate.label}\nSHUT`;
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
