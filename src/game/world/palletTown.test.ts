import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { RAID_DURATION_MS } from '../run/raidClock';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
import { WORLD_INTERIORS } from './interiors';
import { WORLD_POIS } from './pois';
import { exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'pallet-town';
const LEE = 'grass-scout-lee';
const VANCE = 'pallet-mill-keeper-vance';
const COBB = 'pallet-salt-keeper-cobb';
const FINN = 'pallet-quarry-breaker-finn';
const ASH = 'pallet-drover-ash';
const PIKE = 'pallet-netter-pike';
/** Every trainer on the map still standing: a fresh save's collision. */
const STANDING = [LEE, VANCE, COBB, FINN, ASH, PIKE];
/** The miller beaten: both ends of the towpath open. */
const WON = ['pallet-mill-keeper'];
/** Both keepers beaten: the town is a ring and so is the south. */
const ALL_WON = ['pallet-mill-keeper', 'pallet-salt-keeper'];
const quarry = RUN_INSERTIONS['pallet-quarry'].position;
const hard = RUN_INSERTIONS['pallet-strand'].position;
const ferryHard = exitTile(MAP, 'FERRY HARD');
const quarryTrack = exitTile(MAP, 'QUARRY TRACK');
const headland = exitTile(MAP, 'HEADLAND STEPS');
/** The neck of the headland, one step above Salter Cobb's gate. */
const NESS = { x: 53, y: 66 };
/** The Flood's south shore, where the withy causeway leaves the town. */
const FLOOD_SHORE = { x: 8, y: 38 };
/** The head of the Gate Lane, where the other road south leaves the stockyard. */
const GATE_LANE = [{ x: 19, y: 39 }, { x: 20, y: 39 }];
const WITHY_PATH = [{ x: 7, y: 39 }, { x: 8, y: 39 }];
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

  /**
   * What a fresh save can walk to, and what each keeper is worth.
   *
   * The map is four times what it was and is entered at one corner of it, so
   * "can a raid reach the thing it was sent for" is no longer obvious by
   * looking. Two keepers hold two places between them - the far bank behind
   * the miller, the headland behind the salter - and everything else is open
   * from the first second, however far away it is.
   */
  it('lets a fresh raid walk to everything but the two places a keeper holds', () => {
    const walk = { standing: STANDING };
    const held = new Set(['MILL STAIR', 'HEADLAND STEPS', 'BEACON LIGHT']);
    for (const point of EXTRACTION_POINTS.filter((candidate) => candidate.mapId === MAP)) {
      expect(`${point.label}: ${steps(MAP, square, point.position, walk) > 0}`)
        .toBe(`${point.label}: ${!held.has(point.label)}`);
      expect(`${point.label} with both keepers beaten: ${steps(MAP, square, point.position, { ...walk, beaten: ALL_WON }) > 0}`)
        .toBe(`${point.label} with both keepers beaten: true`);
    }
    for (const poi of getWorldMap(MAP).pois) {
      expect(`${poi.label}: ${steps(MAP, square, poi.position, walk) > 0}`)
        .toBe(`${poi.label}: ${!held.has(poi.label)}`);
      expect(`${poi.label} with both keepers beaten: ${steps(MAP, square, poi.position, { ...walk, beaten: ALL_WON }) > 0}`)
        .toBe(`${poi.label} with both keepers beaten: true`);
    }
  });

  /**
   * The one thing a map four times the size can get wrong that a small one
   * cannot: a raid that drops in somewhere and cannot get home before the
   * clock runs out. Every landing is pinned against the clock rather than
   * against a number typed here, so shortening the raid fails this rather than
   * quietly stranding somebody - the same discipline `recovery.ts` follows.
   *
   * The worst of them is the front door, and it is seven seconds of walking
   * out of five minutes. That is the design: the valley is long, and what it
   * spends the clock on is everything you stopped for on the way.
   */
  it('gives every landing a way home inside a tenth of the clock', () => {
    const walk = { standing: STANDING };
    const home = Object.fromEntries(
      Object.values(RUN_INSERTIONS)
        .filter((insertion) => insertion.mapId === MAP)
        .map((insertion) => {
          const reachable = EXTRACTION_POINTS.filter((point) => point.mapId === MAP)
            // An exit a landmark has to open is not a way home until it is open.
            .filter((point) => point.requirement?.kind !== 'poi-activated')
            .map((point) => steps(MAP, insertion.position, point.position, walk))
            .filter((count) => count > 0);
          return [insertion.label, Math.min(...reachable)];
        }),
    );
    expect(home).toEqual({ 'Town Square': 49, 'The Far Bank': 3, 'The Quarry': 9, 'The Hard': 6 });
    for (const [label, count] of Object.entries(home)) {
      expect(`${label}: ${((count * STEP_DURATION_MS) / RAID_DURATION_MS) < 0.1}`).toBe(`${label}: true`);
    }
  });

  /**
   * And the other half of the same fact: the map is genuinely long. The two
   * landings furthest apart are the quarry in the east hills and the hard at
   * the mouth of the valley, and walking between them is a quarter of a minute
   * of a five-minute raid - far enough that a raid is one end of the valley or
   * the other, and never both.
   */
  it('is a valley you cannot see the far end of, and can still walk out of', () => {
    const acrossTheValley = steps(MAP, quarry, hard, { beaten: ALL_WON });
    expect(acrossTheValley).toBe(144);
    const share = (acrossTheValley * STEP_DURATION_MS) / RAID_DURATION_MS;
    expect(`crossing the valley is ${(share * 100).toFixed(0)}% of the clock`)
      .toBe('crossing the valley is 7% of the clock');
    expect({
      squareToTheFerry: steps(MAP, square, ferryHard, { standing: STANDING }),
      squareToTheQuarryTrack: steps(MAP, square, quarryTrack, { standing: STANDING }),
    }).toEqual({ squareToTheFerry: 118, squareToTheQuarryTrack: 75 });
  });

  /**
   * Two roads out of the town's south bank, and they are two different
   * countries. The Gate Lane leaves the stockyard into hedged hay meadows; the
   * withy causeway drops off the Flood's shore into osier beds with standing
   * water either side of it. They meet again on the saltings, so shutting
   * either one still leaves a way to the sea - which is what stops the south
   * being one corridor with the whole map behind it.
   */
  it('gives the south two heads that meet on the marsh', () => {
    expect({
      byTheWithyBeds: steps(MAP, FLOOD_SHORE, hard, { without: GATE_LANE }),
      byTheGateLane: steps(MAP, FLOOD_SHORE, hard, { without: WITHY_PATH }),
    }).toEqual({ byTheWithyBeds: 76, byTheGateLane: 82 });
  });

  /**
   * Salter Cobb is the far end of the map from Miller Vance and holds the same
   * shape of door: the gate across the headland's neck, and the steps down its
   * west face onto the hard. Shut, the headland is the one place on the south
   * that nothing reaches; open, the whole south is a ring - the Gate Lane down
   * through the meadows, the marsh, the strand, the hard, the headland, the old
   * fields and the drove back up to the sluice apron.
   */
  it('turns the south into a ring once the salter is beaten', () => {
    expect(steps(MAP, hard, headland, { standing: STANDING })).toBe(-1);
    expect({
      roundByTheDrove: steps(MAP, hard, NESS, {}),
      overTheSteps: steps(MAP, hard, NESS, { beaten: ALL_WON }),
    }).toEqual({ roundByTheDrove: 147, overTheSteps: 33 });
    // The steps land on ground a player coming the long way round has already
    // walked, which is what every second door in this game is for.
    expect(steps(MAP, hard, headland, { beaten: ALL_WON })).toBe(28);
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

  /**
   * What the delve is for, in steps: a way through the quarry hill that is
   * worth knowing and never worth taking blind.
   *
   * It is the map's one roofed place (`interiors.ts`), and the point of it is
   * that the hanger and the quarry floor are thirty-seven steps apart round the
   * hill and nineteen through it - a real alternative, and small enough that
   * the valley does not shrink round it. What it charges is fights: every step of
   * its floor rolls, so the short way is the one that costs, which is the same
   * bargain Route 1's grass makes and the reason it is not simply better.
   */
  it('makes the delve a short way through the hill that costs fights rather than steps', () => {
    const delve = WORLD_INTERIORS.find((interior) => interior.id === 'pallet-delve')!;
    const [hangerMouth, quarryMouth] = delve.mouths;
    const hanger = { x: hangerMouth.x - 1, y: hangerMouth.y };
    const floor = { x: quarryMouth.x + 1, y: quarryMouth.y };
    expect(steps(MAP, hanger, floor)).toBe(19);
    // The hill sealed is the surface walk, and it is the one the map had
    // before the level was driven.
    const throughTheHill: { x: number; y: number }[] = [];
    for (let y = delve.roof.y; y < delve.roof.y + delve.roof.height; y += 1) {
      for (let x = delve.roof.x; x < delve.roof.x + delve.roof.width; x += 1) {
        throughTheHill.push({ x, y });
      }
    }
    expect(steps(MAP, hanger, floor, { without: throughTheHill })).toBe(37);
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
