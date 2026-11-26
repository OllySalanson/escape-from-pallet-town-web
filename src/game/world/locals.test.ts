import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { placeOfLocal, placeOnMapLine, placesOnMapTiles, taleLines } from './locals';
import { knownOnChart } from './chartKnown';

const vale = getWorldMap('greystone-vale');
const locals = vale.entities.filter((entity) => entity.local);

/** The vale's places a player can stand in: every 64-tile square of its plan that is drawn. */
const DRAWN_SQUARES = [
  'MILLBROOK',
  'HIGH MOOR',
  'GREYSTONE PEAKS',
  'PINE HOLLOW',
  'THE CROSSING',
  'TANGLEWOOD',
  'REEDMERE',
  'GULL STRAND',
  'ORCHARD TERRACES',
  'THE POWER STATION',
  'SAFARI MARSH',
  'THE WRECK',
  'THE SUNKEN QUARTER',
  "SMUGGLERS' COVE",
  'STORMCROWN',
  'THE MOOR CHAPEL',
  'THE LOST GARDEN',
  'FROSTREEF',
  'EMBER ISLE',
];

describe("the vale's locals", () => {
  it('stand one in every drawn square of the vale, and only one', () => {
    const places = locals.map((local) => placeOfLocal('greystone-vale', local.position)?.name);
    expect([...places].sort()).toEqual([...DRAWN_SQUARES].sort());
  });

  it('are each a square of the plan, so a tale lights a whole square', () => {
    for (const local of locals) {
      const place = placeOfLocal('greystone-vale', local.position)!;
      expect(place.areas, place.name).toEqual([expect.objectContaining({ width: 64, height: 64 })]);
    }
  });

  it('say who they are first, in capitals, as the box that inks the map in names them', () => {
    for (const local of locals) {
      const name = local.local!.name;
      expect(name).toBe(name.toUpperCase());
      expect(local.dialogLines[0].startsWith(name), name).toBe(true);
    }
  });

  it('stand still, so the "!" over an unheard one stays over their head', () => {
    for (const local of locals) {
      expect(local.idle, local.local!.name).toBeUndefined();
    }
  });

  it('are people with nothing else to do: no secret, no race, no gift', () => {
    for (const local of locals) {
      expect(local.secret, local.local!.name).toBeUndefined();
      expect(local.pokemon, local.local!.name).toBeUndefined();
    }
  });
});

describe('a tale heard to the end', () => {
  it('ends with the local filling the place in on the MAP, the first time only', () => {
    expect(taleLines('AUNTIE MAB', ['One.', 'Two.'], 'MILLBROOK', false)).toEqual([
      'One.',
      'Two.',
      'AUNTIE MAB filled in MILLBROOK on your MAP!',
    ]);
    expect(taleLines('AUNTIE MAB', ['One.', 'Two.'], 'MILLBROOK', true)).toEqual(['One.', 'Two.']);
    expect(placeOnMapLine('OLD FLINT', 'GREYSTONE PEAKS')).not.toMatch(/unlock|congratulations/i);
  });

  it('lights every tile of the square on THE MAP, walked or not', () => {
    const millbrook = placeOfLocal('greystone-vale', locals.find((local) => local.local!.name === 'AUNTIE MAB')!.position)!;
    const tiles = placesOnMapTiles('greystone-vale', vale.width, [millbrook.name]);
    expect(tiles.size).toBe(64 * 64);
    const known = knownOnChart('greystone-vale', vale.width, { trodden: {}, placesOnMap: { 'greystone-vale': [millbrook.name] } });
    const corner = millbrook.areas[0];
    expect(known.has(corner.y * vale.width + corner.x)).toBe(true);
    expect(known.has((corner.y + 63) * vale.width + corner.x + 63)).toBe(true);
    expect(known.has((corner.y + 64) * vale.width + corner.x)).toBe(false);
  });
});
