import { describe, expect, it } from 'vitest';
import { districtsForMap } from '../world/districts';
import { builtInFileMap } from '../world/playerMaps';
import { RUMOURS } from '../world/rumours';
import { SECRETS, rewardKey } from '../world/secrets';
import { ringCard, ringChalk, ringMarkTile, rumourRings } from './rumourRings';

/**
 * The chalk rings on THE RAID ARENA's telescope (`rumourRings.ts`): a ring over
 * the district of every rumour heard, which never reveals ground - it says no
 * more than the rumour did, and nothing about where in its district the secret
 * lies.
 */

const VALE = 'greystone-vale';
const NOTHING_FOUND = { secretsFound: [], giftsReceived: [] };
const ALL_HEARD = RUMOURS.map((rumour) => rumour.id);

describe("the telescope's rumour rings", () => {
  const districts = districtsForMap(VALE);
  const file = builtInFileMap(VALE)!.file;
  const inside = (area: { x: number; y: number; width: number; height: number }, tile: { x: number; y: number }): boolean =>
    tile.x >= area.x && tile.y >= area.y && tile.x < area.x + area.width && tile.y < area.y + area.height;
  const planDistrict = (name: string) => districts.find((district) => district.name === name)!;

  it.each(RUMOURS.map((rumour) => [rumour.id, rumour] as const))(
    '%s is ringed over the district its place is in, or whose mouth opens onto it',
    (_id, rumour) => {
      const ring = planDistrict(rumour.ringsOver);
      expect(ring, rumour.ringsOver).toBeDefined();
      // A plan district: one whole 64-tile cell of the vale.
      expect(ring.areas).toHaveLength(1);
      expect(ring.areas[0].width).toBe(64);
      const place = districts.find((district) => district.name === rumour.names);
      if (place && place.areas.every((area) => inside({ x: 0, y: 0, width: 384, height: 384 }, area))) {
        for (const area of place.areas) {
          expect(inside(ring.areas[0], area), `${rumour.names} in ${rumour.ringsOver}`).toBe(true);
        }
        return;
      }
      // A floor under a roof or a hill: a way from it comes out inside the ringed
      // district - straight out of the rock, or up through the floors above it
      // (the crypt under the Moor Chapel comes out through its nave).
      const floor = file.areas?.find((area) => area.name === rumour.names);
      expect(floor, rumour.names).toBeDefined();
      const floors = new Set([floor!.id]);
      const mouths: { readonly x: number; readonly y: number }[] = [];
      // Only as far up as the first floor with a way out: a floor with a mouth of its own is held to it.
      for (let grown = true; grown && mouths.length === 0; ) {
        grown = false;
        for (const link of file.links ?? []) {
          if (!link.ends.some((end) => end.area !== undefined && floors.has(end.area))) continue;
          for (const end of link.ends) {
            if (end.area === undefined) {
              if (!mouths.some((mouth) => mouth.x === end.x && mouth.y === end.y)) mouths.push(end);
            } else if (!floors.has(end.area)) {
              floors.add(end.area);
              grown = true;
            }
          }
        }
      }
      expect(mouths.some((mouth) => inside(ring.areas[0], mouth)), `a mouth onto ${rumour.names}`).toBe(true);
    },
  );

  it('rings only what has been heard, one ring a district', () => {
    expect(rumourRings(VALE, [], NOTHING_FOUND)).toEqual([]);
    const one = rumourRings(VALE, ['board-long-shadow'], NOTHING_FOUND);
    expect(one).toHaveLength(1);
    expect(one[0].district).toBe('HIGH MOOR');
    const moor = rumourRings(VALE, ['board-long-shadow', 'spyglass-lost-fold'], NOTHING_FOUND);
    expect(moor).toHaveLength(1);
    expect(moor[0].rumours.map((rumour) => rumour.id)).toEqual(['board-long-shadow', 'spyglass-lost-fold']);
    expect(rumourRings(VALE, ALL_HEARD, NOTHING_FOUND)).toHaveLength(new Set(RUMOURS.map((rumour) => rumour.ringsOver)).size);
    // Nothing on any other map, and nothing for an id the game does not know.
    expect(rumourRings('route-1', ALL_HEARD, NOTHING_FOUND)).toEqual([]);
    expect(rumourRings(VALE, ['no-such-rumour'], NOTHING_FOUND)).toEqual([]);
  });

  it('never reveals ground: a ring is its district alone, whatever rumour or secret is in it', () => {
    const rings = rumourRings(VALE, ALL_HEARD, NOTHING_FOUND);
    for (const ring of rings) {
      const district = planDistrict(ring.district).areas[0];
      // The same ring as any one of its rumours alone would chalk.
      for (const rumour of ring.rumours) {
        const [alone] = rumourRings(VALE, [rumour.id], NOTHING_FOUND);
        expect([alone.centre, alone.radius]).toEqual([ring.centre, ring.radius]);
      }
      // In the district's middle, and well inside it, mark and all.
      expect(ring.centre).toEqual({ x: district.x + district.width / 2, y: district.y + district.height / 2 });
      expect(ring.radius).toBeLessThan(district.width / 2 - 4);
      expect(inside(district, ringMarkTile(ring))).toBe(true);
      // What it says is the rumours' own words and nothing else: never the
      // name of the district it is over, unless a rumour said it first.
      const said = [ringCard(ring).title, ...ringCard(ring).lines].join(' ');
      const heardWords = ring.rumours.map((rumour) => rumour.words).join(' ');
      if (!heardWords.includes(ring.district)) {
        expect(said).not.toContain(ring.district);
      }
      for (const rumour of ring.rumours) {
        expect(said).toContain(rumour.words);
      }
    }
  });

  it("chalks a '?' until every secret in it is run to ground, then a tick, and the ring stays", () => {
    const shadow = SECRETS.find((secret) => secret.id === 'the-long-shadow')!;
    const fold = SECRETS.find((secret) => secret.id === 'the-lost-fold')!;
    const heard = ['board-long-shadow', 'spyglass-lost-fold'];
    const half = { secretsFound: [rewardKey(shadow, shadow.rewards[0])], giftsReceived: [] };
    const [partly] = rumourRings(VALE, heard, half);
    expect(partly.allFound).toBe(false);
    expect(partly.rumours.map((rumour) => rumour.found)).toEqual([true, false]);
    expect(ringCard(partly).title).toBe('A RUMOUR HEARD');
    expect(ringCard(partly).lines[0]).toContain('LOST FOLD');
    expect(ringCard(partly).lines.at(-1)).toBe('One more here run to ground.');
    expect(ringChalk(partly, 1).some((square) => square.ink === 'mark')).toBe(true);
    expect(ringChalk(partly, 1).some((square) => square.ink === 'tick')).toBe(false);

    const done = { secretsFound: [...half.secretsFound, rewardKey(fold, fold.rewards[0])], giftsReceived: [] };
    const [ticked] = rumourRings(VALE, heard, done);
    expect(ticked.allFound).toBe(true);
    expect(ringCard(ticked).title).toBe('RUN TO GROUND');
    expect(ringChalk(ticked, 1).some((square) => square.ink === 'tick')).toBe(true);
    expect(ringChalk(ticked, 1).some((square) => square.ink === 'mark')).toBe(false);
  });

  it('draws its chalk round its middle, as big as its district at every level of the glass', () => {
    const [ring] = rumourRings(VALE, ['board-long-shadow'], NOTHING_FOUND);
    for (const zoom of [0.58, 1, 2]) {
      const squares = ringChalk(ring, zoom);
      const radius = Math.max(6, Math.round(ring.radius * zoom));
      const dashes = squares.filter((square) => square.ink === 'chalk');
      expect(dashes.length).toBeGreaterThan(12);
      for (const dash of dashes) {
        expect(Math.abs(Math.hypot(dash.x, dash.y) - radius)).toBeLessThanOrEqual(1);
      }
      // The mark sits on its top.
      const mark = squares.filter((square) => square.ink === 'mark');
      expect(Math.min(...mark.map((square) => square.y))).toBeLessThan(-radius);
      expect(Math.max(...mark.map((square) => Math.abs(square.x)))).toBeLessThanOrEqual(2);
    }
  });
});
