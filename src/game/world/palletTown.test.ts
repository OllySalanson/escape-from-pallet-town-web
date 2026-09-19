import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { WORLD_POIS } from './pois';
import { exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'pallet-town';
const LEE = 'grass-scout-lee';
const square = RUN_INSERTIONS['town-square'].position;
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
        standing: beaten ? [] : [LEE],
        without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].filter((way) => way !== open).flat(),
      });

    expect({
      bridge: by(BRIDGE, true),
      westFord: by(WEST_FORD, false),
      eastFord: by(EAST_FORD, false),
      roundByTheStair: by(ROUND_BY_THE_STAIR, false),
    }).toEqual({ bridge: 25, westFord: 29, eastFord: 37, roundByTheStair: 75 });

    // Lee stands in the one gap at the bridge foot: until he is beaten the
    // bridge is not a way over at all, which is what makes it a toll.
    expect(by(BRIDGE, false)).toBe(-1);
    // The west ford lands in the Flood's reeds and there is no way through them
    // that costs nothing; the east ford is the one crossing that stays dry. Asked
    // from the leat's north bank, because the ledger itself lies in a bed.
    const northBank = { x: 16, y: 26 };
    const dryBy = (open: readonly { x: number; y: number }[]): number =>
      steps(MAP, northBank, southGate, {
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

  it('lets a fresh raid walk to every exit and landmark with Lee still standing', () => {
    for (const point of EXTRACTION_POINTS.filter((candidate) => candidate.mapId === MAP)) {
      expect(`${point.label}: ${steps(MAP, square, point.position, { standing: [LEE] }) > 0}`).toBe(
        `${point.label}: true`,
      );
    }
    for (const poi of getWorldMap(MAP).pois) {
      expect(`${poi.label}: ${steps(MAP, square, poi.position, { standing: [LEE] }) > 0}`).toBe(
        `${poi.label}: true`,
      );
    }
  });

  /**
   * The cordon ledger only banks through the West Culvert, and the culvert
   * only opens from the sluice at the other end of the south bank. So the South
   * Gate, which every route to either of them passes, is the temptation: the
   * raid is a short walk from banked the moment the ledger is lifted.
   */
  it('prices the ledger contract as a long way round past an open gate', () => {
    const walk = { standing: [LEE] };
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
      standing: [LEE],
      without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].flat(),
    });
    expect(north).toBe(48);
    expect(
      steps(MAP, square, southGate, { without: [WEST_FORD, BRIDGE, EAST_FORD, ROUND_BY_THE_STAIR].flat() }),
    ).toBe(-1);
  });
});
