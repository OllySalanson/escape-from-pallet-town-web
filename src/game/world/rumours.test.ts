import { describe, expect, it } from 'vitest';
import { millRumour, RUMOURS, rumourFrom } from './rumours';

const NOTHING_FOUND = { secretsFound: [], giftsReceived: [] };

describe('THE RUMOUR MILL', () => {
  it('sells its own slips first, then whatever the harbour has not told yet, and never one heard', () => {
    const heard: string[] = [];
    const sold: string[] = [];
    for (let rumour = millRumour(NOTHING_FOUND, heard); rumour; rumour = millRumour(NOTHING_FOUND, heard)) {
      sold.push(rumour.id);
      heard.push(rumour.id);
    }
    const own = RUMOURS.filter((rumour) => rumour.source === 'mill').map((rumour) => rumour.id);
    expect(own.length).toBeGreaterThan(0);
    expect(sold.slice(0, own.length)).toEqual(own);
    expect(new Set(sold).size).toBe(RUMOURS.length);
  });

  it('gives, for a secret the harbour also has a rumour of, the facts the harbour leaves out', () => {
    for (const slip of RUMOURS.filter((rumour) => rumour.source === 'mill')) {
      const others = RUMOURS.filter((rumour) => rumour.secret === slip.secret && rumour.source !== 'mill');
      expect(others.length, slip.id).toBeGreaterThan(0);
      const told = new Set([...slip.gives, ...others.flatMap((rumour) => rumour.gives)]);
      expect([slip.id, [...told].sort()]).toEqual([slip.id, ['bring', 'when', 'where']]);
    }
  });

  it('says nothing about a secret already spent, and its slips are never the harbour’s to say', () => {
    expect(millRumour({ secretsFound: ['the-red-one/gyarados'], giftsReceived: [] }, [])?.secret).not.toBe('the-red-one');
    for (const source of ['board', 'angler', 'spyglass', 'sailor', 'bill'] as const) {
      for (let day = 0; day < 8; day += 1) {
        expect(rumourFrom(source, NOTHING_FOUND, day)?.source ?? source).toBe(source);
      }
    }
  });
});
