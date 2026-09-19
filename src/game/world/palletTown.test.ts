import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
import { WORLD_POIS } from './pois';
import { exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'pallet-town';
const LEE = 'grass-scout-lee';
const VANCE = 'pallet-mill-keeper-vance';
/** The miller beaten: both ends of the towpath open. */
const WON = ['pallet-mill-keeper'];
const square = RUN_INSERTIONS['town-square'].position;
const farBank = RUN_INSERTIONS['pallet-far-bank'].position;
const ledger = RAID_CONTRACTS.find((contract) => contract.id === 'cordon-ledger')!.markers[0].position;
const sluice = WORLD_POIS.find((poi) => poi.id === 'pallet-sluice-wheel')!.position;
const southGate = exitTile(MAP, 'SOUTH GATE');
const millStair = exitTile(MAP, 'MILL STAIR');
const culvert = exitTile(MAP, 'WEST CULVERT');

/** One tile of each crossing of the leat, mid-stream. */
const WEST_FORD = [{ x: 7, y: 28 }, { x: 8, y: 28 }];
const BRIDGE = [{ x: 13, y: 28 }, { x: 14, y: 28 }];
const EAST_FORD = [{ x: 20, y: 28 }, { x: 21, y: 28 }];
/** The far bank's path, where it passes the head of the leat. */
const ROUND_BY_THE_STAIR = [{ x: 26, y: 28 }, { x: 27, y: 28 }];

describe('Pallet Town', () => {
  /**
   * The leat cuts the town in two and every way out but the Mill Stair is south
   * of it, so the map is its crossings. They have to be three different prices
   * or they are one crossing drawn three times.
   */
  it('makes the three crossings three prices: the bridge quick and held, the west ford in the reeds, the east ford dry and long', () => {
    const by = (open: readonly { x: number; y: number }[], beaten: boolean): number =>
      steps(MAP, ledger, southGate, {
        beaten: WON,
        standing: beaten ? [] : [LEE],
        without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].filter((way) => way !== open).flat(),
      });

    expect({
      bridge: by(BRIDGE, true),
      westFord: by(WEST_FORD, false),
      eastFord: by(EAST_FORD, false),
      roundByTheStair: by(ROUND_BY_THE_STAIR, false),
    }).toEqual({ bridge: 25, westFord: 29, eastFord: 37, roundByTheStair: 75 });

    // There are three crossings until the miller is beaten, and four after:
    // the way round the head of the water is the towpath, and he has both ends
    // of it. It is twice as long again as the longest crossing, which is what
    // makes it a fact about the map rather than a fourth route to price.
    expect(
      steps(MAP, ledger, southGate, {
        standing: [LEE, VANCE],
        without: [WEST_FORD, BRIDGE, EAST_FORD].flat(),
      }),
    ).toBe(-1);

    // Lee stands in the one gap at the bridge foot: until he is beaten the
    // bridge is not a way over at all, which is what makes it a toll.
    expect(by(BRIDGE, false)).toBe(-1);
    // The west ford lands in the Flood's reeds and there is no way through them
    // that costs nothing; the east ford is the one crossing that stays dry. Asked
    // from the leat's north bank, because the ledger itself lies in a bed.
    const northBank = { x: 16, y: 26 };
    const dryBy = (open: readonly { x: number; y: number }[]): number =>
      steps(MAP, northBank, southGate, {
        beaten: WON,
        standing: [LEE],
        dry: true,
        without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].filter((way) => way !== open).flat(),
      });
    expect({ westFord: dryBy(WEST_FORD), eastFord: dryBy(EAST_FORD) }).toEqual({ westFord: -1, eastFord: 29 });
  });

  /**
   * The square says "east for the field and the mill" on its sign, in its
   * guide's mouth and on the lobby row, and for a day it was a lie: a planter
   * by the door and a flag two tiles wide shut the east side between them. The
   * ground was still one connected place - round by the green and the mill
   * lane - so nothing failed. A door is pinned by how far away the other side
   * of it is.
   */
  it('lets the square out by both its doors: east onto the field road, south onto the green', () => {
    expect({
      eastDoor: steps(MAP, square, { x: 14, y: 8 }),
      southDoor: steps(MAP, square, { x: 5, y: 13 }),
    }).toEqual({ eastDoor: 10, southDoor: 6 });
  });

  it('lets a fresh raid walk to every landmark and to both unheld exits with Lee still standing', () => {
    const walk = { standing: [LEE, VANCE] };
    for (const point of EXTRACTION_POINTS.filter((candidate) => candidate.mapId === MAP)) {
      // The Mill Stair is on the far bank, which is what the miller holds. A
      // fresh save still has two ways out: the gate road and the culvert.
      const reachable = point.label !== 'MILL STAIR';
      expect(`${point.label}: ${steps(MAP, square, point.position, walk) > 0}`).toBe(
        `${point.label}: ${reachable}`,
      );
      expect(`${point.label} once he is beaten: ${steps(MAP, square, point.position, { ...walk, beaten: WON }) > 0}`)
        .toBe(`${point.label} once he is beaten: true`);
    }
    for (const poi of getWorldMap(MAP).pois) {
      expect(`${poi.label}: ${steps(MAP, square, poi.position, walk) > 0}`).toBe(`${poi.label}: true`);
    }
  });

  /**
   * Pallet's one boss, and the shape every boss in this game has: the door in
   * front of the player, and a second one that opens onto ground they already
   * know. The way in is the whole town away - round the pond and in at the head
   * of the towpath - and the way back is the steps at its foot, which land on
   * the sluice apron the east ford comes up on.
   */
  it('gives the far bank a way back that is shorter than the way in', () => {
    const gate = gatesForMap(MAP).find((candidate) => candidate.id === 'pallet-towpath-gate')!.tiles;
    const stepsDown = gatesForMap(MAP).find((candidate) => candidate.id === 'pallet-towpath-steps')!.tiles;

    // Shut, the far bank is its own place: nothing on the map reaches it.
    expect(steps(MAP, square, millStair, { standing: [LEE, VANCE] })).toBe(-1);
    expect(steps(MAP, sluice, millStair, { standing: [LEE, VANCE] })).toBe(-1);
    // And a raid that drops in there is never trapped: the stair is its way out.
    expect(steps(MAP, farBank, millStair, { beaten: WON })).toBe(3);

    expect({
      inByTheGate: steps(MAP, sluice, millStair, { beaten: WON, without: stepsDown }),
      backByTheSteps: steps(MAP, sluice, millStair, { beaten: WON, without: gate }),
    }).toEqual({ inByTheGate: 52, backByTheSteps: 14 });
    // The gate is the front door from the square, and it is a long walk.
    expect(steps(MAP, square, millStair, { beaten: WON, without: stepsDown })).toBe(48);
  });

  /**
   * The reveal. Three crossings of the leat and every way out but one south of
   * it, so the town is its water - until the miller is beaten, when the towpath
   * joins the pond to the sluice and the place turns out to be a ring: you can
   * walk from the square to the South Gate without wetting a boot.
   */
  it('turns the town into a ring once the miller is beaten', () => {
    const overTheWater = [WEST_FORD, BRIDGE, EAST_FORD].flat();
    expect(steps(MAP, square, southGate, { standing: [LEE], without: overTheWater })).toBe(-1);
    expect(steps(MAP, square, southGate, { beaten: WON, standing: [LEE], without: overTheWater })).toBe(79);
    // It is the long way round on purpose - half as long again as the quickest
    // crossing - so the ring is a thing the town turns out to be, not a route
    // that makes the three crossings pointless.
    expect(steps(MAP, square, southGate, { beaten: WON })).toBe(49);
  });

  /**
   * The cordon ledger only banks through the West Culvert, and the culvert
   * only opens from the sluice at the other end of the south bank. So the South
   * Gate, which every route to either of them passes, is the temptation: the
   * raid is a short walk from banked the moment the ledger is lifted.
   */
  it('prices the ledger contract as a long way round past an open gate', () => {
    const walk = { standing: [LEE, VANCE] };
    const toLedger = steps(MAP, square, ledger, walk);
    const homeNow = steps(MAP, ledger, southGate, walk);
    const theErrand = steps(MAP, ledger, sluice, walk) + steps(MAP, sluice, culvert, walk);
    expect({ toLedger, homeNow, theErrand }).toEqual({ toLedger: 26, homeNow: 29, theErrand: 56 });
    // Sluice first is the worse order, and not by a step or two: the ledger is
    // on the way to the sluice, so there is a route to be read off the map.
    const sluiceFirst =
      steps(MAP, square, sluice, walk) + steps(MAP, sluice, ledger, walk) + steps(MAP, ledger, culvert, walk);
    expect(sluiceFirst - (toLedger + theErrand)).toBe(10);
  });

  it('keeps the Mill Stair the one way out that never crosses the leat', () => {
    const north = steps(MAP, square, millStair, {
      beaten: WON,
      standing: [LEE],
      without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].flat(),
    });
    expect(north).toBe(48);
    expect(
      steps(MAP, square, southGate, {
        beaten: WON,
        without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].flat(),
      }),
    ).toBe(-1);
  });
});
