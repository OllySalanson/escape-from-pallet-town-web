import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { districtAt } from './districts';
import { stepDistances, walkableTiles } from './mapStructure';
import { gatesForMap } from './gates';
import { WORLD_POIS } from './pois';
import { cheapestWalk, exitTile, steps, trainerTile } from './redrawnMaps.testkit';
import { EXTRACTION_POINTS, isExtractionAvailable } from './extractionPoints';
import { RAID_DURATION_MS } from '../run/raidClock';
import { STEP_DURATION_MS } from '../movement/stepClock';

const MAP = 'route-1';
const JUNE = 'route-lass-june';
const WREN = 'overlook-warden-wren';
const NELL = 'route-orchardist-nell';
const GIL = 'route-drover-gil';
const OSK = 'route-collier-osk';
const EVERYONE = [JUNE, WREN, NELL, GIL, OSK];
const WON = ['overlook-warden'];
const at = (x: number, y: number) => ({ x, y });
const head = RUN_INSERTIONS['route-1'].position;
const landing = RUN_INSERTIONS['route-1-overlook'].position;
const station = WORLD_POIS.find((poi) => poi.id === 'oak-field-station-relay')!.position;
const survey = RAID_CONTRACTS.find((contract) => contract.id === 'survey-the-braid')!;
const stake = (id: string) => survey.markers.find((marker) => marker.id === id)!.position;
const [west, field, east] = ['braid-stake-west', 'braid-stake-field', 'braid-stake-east'].map(stake);

describe('Route 1', () => {
  it('stands one survey stake on each road and one in the fenced field between them', () => {
    expect([west, field, east].map((tile) => districtAt(MAP, tile)?.name)).toEqual([
      'WEST ROAD',
      'THE MEADOWS',
      'EAST ROAD',
    ]);
  });

  /**
   * June is spoken to, not watched, so she is only a price because she stands
   * in a gap one tile wide - and that gap is both the third way across the
   * braid and the middle field's south door. Standing, she is a locked door
   * and the survey goes the long way round her; beaten, she is a short cut.
   */
  it('makes June a door: the braid is twice as long round her as through her', () => {
    expect({
      roundHer: steps(MAP, west, east, { standing: [JUNE, WREN] }),
      throughHer: steps(MAP, west, east, { standing: [WREN] }),
    }).toEqual({ roundHer: 38, throughHer: 18 });
    expect({
      fieldToEastRoundHer: steps(MAP, field, east, { standing: [JUNE, WREN] }),
      fieldToEastThroughHer: steps(MAP, field, east, { standing: [WREN] }),
    }).toEqual({ fieldToEastRoundHer: 24, fieldToEastThroughHer: 12 });
    // She never seals anything: the field's two north doors are not hers.
    expect(steps(MAP, head, field, { standing: [JUNE, WREN] })).toBeGreaterThan(0);
  });

  /**
   * The Overlook stands on a bank above Oak's field station, in plain view of
   * its yard. Wren holds both its doors, as every boss on the Floodplain holds
   * two: the gate off the east road is the way in, and the steps down the bank
   * land in the station yard - so the way back from the Overlook is shorter
   * than the way in was, and it comes out on ground the player already knows.
   */
  it('gives the Overlook a way back that is shorter than the way in', () => {
    const gate = gatesForMap(MAP).find((candidate) => candidate.id === 'route-1-overlook-gate')!.tiles;
    const stepsDown = gatesForMap(MAP).find((candidate) => candidate.id === 'route-1-overlook-steps')!.tiles;

    // Shut, the Overlook is its own place: nothing on the route reaches it.
    expect(steps(MAP, head, landing, { standing: [WREN] })).toBe(-1);
    // And a raid that drops in there is never trapped: the stile is always open.
    expect(steps(MAP, landing, exitTile(MAP, 'OVERLOOK STILE'))).toBe(3);

    expect({
      inByTheGate: steps(MAP, station, landing, { beaten: WON, without: stepsDown }),
      backByTheSteps: steps(MAP, landing, station, { beaten: WON, without: gate }),
    }).toEqual({ inByTheGate: 24, backByTheSteps: 16 });
    // And the relay exit the station opens is half as far by the steps.
    expect({
      relayByTheSteps: steps(MAP, landing, exitTile(MAP, 'STATION RELAY'), { beaten: WON }),
      relayByTheGate: steps(MAP, landing, exitTile(MAP, 'STATION RELAY'), { beaten: WON, without: stepsDown }),
    }).toEqual({ relayByTheSteps: 16, relayByTheGate: 30 });
  });

  it('keeps Wren off the road: her watch is the spur, and the east road passes it free', () => {
    const wren = trainerTile(WREN);
    expect(districtAt(MAP, wren)?.name).toBe('EAST ROAD');
    // The east road runs on south past the spur with her standing in it.
    expect(steps(MAP, head, east, { standing: [JUNE, WREN], without: [{ x: wren.x - 1, y: wren.y }] })).toBe(
      steps(MAP, head, east, { standing: [JUNE, WREN] }),
    );
  });

  /**
   * The braid, a map further on. Below the Outpost the two roads become THE
   * DROVE and THE OLD ROAD and THE COMMON lies between them, so the bargain the
   * Meadows make at the top of the map is the one the common makes at the
   * bottom: across is half the distance and every tile of it is grass.
   */
  it('makes the common the same bargain the meadows are', () => {
    const drove = at(14, 54);
    const oldRoad = at(27, 54);
    expect({
      across: steps(MAP, drove, oldRoad, { standing: EVERYONE }),
      round: steps(MAP, drove, oldRoad, { standing: EVERYONE, dry: true }),
    }).toEqual({ across: 19, round: 37 });
    // And the way round really is dry: the roads are bare the whole way.
    expect(cheapestWalk(MAP, [], drove, oldRoad)).toEqual({ grass: 0, steps: 37 });
  });

  /**
   * Nell holds the drove between the steading's paddocks, which is the third
   * way south and the short one - so she is June's counterpart on the east side
   * of the map. The way round her is the orchard's own south lane, and it is
   * worth twenty-two steps, which is what June is worth too.
   */
  it('makes Nell a door on the drove, with the orchard lane as the way round', () => {
    const orchard = RUN_INSERTIONS['route-1-orchard'].position;
    const steading = RUN_INSERTIONS['route-1-steading'].position;
    expect({
      throughHer: steps(MAP, orchard, steading, { standing: [JUNE, WREN, GIL, OSK] }),
      roundHer: steps(MAP, orchard, steading, { standing: EVERYONE }),
    }).toEqual({ throughHer: 30, roundHer: 52 });
    // She seals nothing: the steading is still reached with her standing.
    expect(steps(MAP, orchard, steading, { standing: EVERYONE })).toBeGreaterThan(0);
  });

  /**
   * The brook has three crossings and no two are the same price. The plank
   * bridge carries the west road and is free; the ford carries the east one and
   * DROVER GIL stands on it, watching the one tile of it he is not standing on,
   * so the east road cannot be walked past him; and the stepping stones below
   * the steading are a private crossing nobody tolls.
   */
  it('prices the brook three different ways', () => {
    // Gil's body and the tile he watches are the whole crossing.
    const ford = [at(28, 44), at(29, 44)];
    expect({
      overTheFord: steps(MAP, at(26, 40), at(28, 50)),
      roundHim: steps(MAP, at(26, 40), at(28, 50), { without: ford }),
    }).toEqual({ overTheFord: 12, roundHim: 82 });
    // On the walk the whole map is about, he is a toll rather than a wall: the
    // west road and its plank bridge are twelve steps longer and cost nothing.
    expect({
      overTheFord: steps(MAP, exitTile(MAP, 'ROUTE OUTPOST'), exitTile(MAP, 'SOUTH GATE')),
      byTheBridge: steps(MAP, exitTile(MAP, 'ROUTE OUTPOST'), exitTile(MAP, 'SOUTH GATE'), {
        without: ford,
      }),
    }).toEqual({ overTheFord: 59, byTheBridge: 71 });
    // And the stepping stones are the steading's own way into the burn.
    expect(steps(MAP, RUN_INSERTIONS['route-1-steading'].position, at(54, 56), { standing: EVERYONE }))
      .toBe(30);
  });

  /**
   * The kiln is the map's second sealed exit and it is authored the way the
   * field station is: the landmark at one end of a place and the door it opens
   * at the other, so working it is the errand rather than the reward.
   */
  it('puts the kiln at the far end of the burn from the road it opens', () => {
    expect(steps(MAP, at(54, 56), exitTile(MAP, 'KILN ROAD'), { standing: EVERYONE })).toBe(20);
    expect(districtAt(MAP, at(54, 56))?.name).toBe('THE CHARCOAL BURN');
    expect(districtAt(MAP, exitTile(MAP, 'KILN ROAD'))?.name).toBe('THE CHARCOAL BURN');
  });

  /**
   * The vastness is meant to live in what a raid did not get to, not in longer
   * walks, so the clock does not grow with the map. What that needs is that
   * every landing has a way home well inside it: the worst of them is the front
   * door's, and the walk there is under a tenth of the raid.
   */
  it('leaves every landing a way home well inside the clock', () => {
    const exits = EXTRACTION_POINTS.filter((point) => point.mapId === MAP);
    const walks = Object.values(RUN_INSERTIONS)
      .filter((insertion) => insertion.mapId === MAP)
      .map((insertion) => {
        const reachable = exits
          .map((exit) => ({
            exit,
            walk: steps(MAP, insertion.position, exit.position, { standing: EVERYONE }),
          }))
          .filter((row) => row.walk >= 0);
        const open = reachable.filter((row) => isExtractionAvailable(row.exit, RAID_DURATION_MS, new Set()));
        return [insertion.label, Math.min(...open.map((row) => row.walk))] as const;
      });
    expect(Object.fromEntries(walks)).toEqual({
      'Route 1': 43,
      'Overlook Landing': 3,
      'The Orchard': 12,
      'The Steading': 10,
      'The Common': 23,
    });
    // The longest of those is under a tenth of the clock, which is the margin
    // the map is drawn to: a fight or two on the way home and still time over.
    const worst = Math.max(...walks.map(([, walk]) => walk));
    expect(worst * STEP_DURATION_MS).toBeLessThan(RAID_DURATION_MS / 8);
  });

  /**
   * The Overlook was twenty tiles of shelf - fewer than the map's loot pool has
   * pieces, so a raid that dropped in there had nowhere to lay half of it and
   * the generator fell back on tiles behind the shut gate. It carries east now.
   * Held as the rule rather than the number: a region a raid can start in has
   * room for everything that raid can be promised.
   */
  it('gives the sealed Overlook room for everything a raid there can find', () => {
    const shelf = getWorldMap(MAP);
    const landing = RUN_INSERTIONS['route-1-overlook'].position;
    const reach = stepDistances(shelf.collision, landing);
    const room = walkableTiles(shelf.collision).filter((tile) => reach[tile.y][tile.x] >= 0).length;
    expect(room).toBeGreaterThan(shelf.loot.length);
  });
});
