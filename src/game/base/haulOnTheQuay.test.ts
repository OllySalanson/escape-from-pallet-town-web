import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import type { ReportGroup } from '../run/extractionReport';
import { BASE_LANDING, BASE_SIGNS, getBaseMap } from './baseMap';
import { BASE_DOORS } from './doors';
import { HARBOUR_LIFE } from './harbourLife';
import { haulFromReport, haulLaidOut, HAUL_SPOTS } from './haulOnTheQuay';

const found = (items: readonly string[], pokemon = 0): ReportGroup => ({
  items: items.map((itemId) => ({ itemId, label: itemId, quantity: 1 })),
  pokemon: Array.from({ length: pokemon }, () => ({ name: 'Pidgey', dexId: 16, level: 3, currentHp: 10, maxHp: 10 })),
});

describe('the haul on the quay', () => {
  it('is what the raid itself brought out, an item a kind and a ball a Pokémon', () => {
    expect(haulFromReport({ outcome: 'ESCAPED', ledgerFound: found(['potion', 'money'], 2) })).toEqual(['potion', 'money', 'poke-ball', 'poke-ball']);
  });

  it('is nothing at all from a lost raid, whose ledger is what was lost', () => {
    expect(haulFromReport({ outcome: 'WIPED', ledgerFound: found(['potion'], 1) })).toEqual([]);
  });

  it('stands no more than the quay has room for, each on a spot of its own', () => {
    const many = Array.from({ length: HAUL_SPOTS.length + 5 }, (_, index) => `item-${index}`);
    const laid = haulLaidOut(many);
    expect(laid).toHaveLength(HAUL_SPOTS.length);
    expect(new Set(laid.map(({ at }) => `${at.x},${at.y}`)).size).toBe(HAUL_SPOTS.length);
  });

  it('stands on open quay, however much Brock has built', () => {
    for (const built of [[], WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)]) {
      const { collision } = getBaseMap(built);
      for (const spot of HAUL_SPOTS) {
        expect(collision[spot.y][spot.x], `${spot.x},${spot.y} with ${built.length} built`).toBe(false);
      }
    }
  });

  it('never stands where somebody works, reads or lands', () => {
    const taken = new Set(
      [
        BASE_LANDING,
        ...BASE_SIGNS,
        ...BASE_DOORS.flatMap((door) => door.tiles),
        ...HARBOUR_LIFE.flatMap((figure) => [
          figure.position,
          ...(figure.idle.roam ?? []),
          ...(figure.night ? [figure.night.position, ...(figure.night.idle.roam ?? [])] : []),
        ]),
      ].map(({ x, y }) => `${x},${y}`),
    );
    for (const spot of HAUL_SPOTS) {
      expect(taken.has(`${spot.x},${spot.y}`), `${spot.x},${spot.y}`).toBe(false);
    }
  });
});
