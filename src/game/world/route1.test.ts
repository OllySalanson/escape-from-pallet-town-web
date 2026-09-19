import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { districtAt } from './districts';
import { gatesForMap } from './gates';
import { WORLD_POIS } from './pois';
import { exitTile, steps, trainerTile } from './redrawnMaps.testkit';

const MAP = 'route-1';
const JUNE = 'route-lass-june';
const WREN = 'overlook-warden-wren';
const WON = ['overlook-warden'];
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
});
