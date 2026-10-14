import { describe, expect, it } from 'vitest';
import { linkKey } from '../movement/gridMovement';
import { MAP_FILE_FORMAT, readMapFile, type MapFile } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { composeMapFile } from './mapAreas';
import {
  boardingPrompt,
  boatAt,
  boatAwayLines,
  boatCaption,
  coursePath,
  courseFaults,
  playerLinks,
  sailingLinks,
  sailingOf,
  sailingState,
  voyage,
} from './sailing';

/**
 * A boat, as a map file has one and as the game plays it: a link between two
 * jetties, sailed across the water a tile a step while the tide lets it, and
 * a way only the player has.
 */

/** Two shores and the sea between, a jetty on each, and the boat between them. */
function twoShores(changes: Partial<MapFile> = {}): MapFile {
  const row = '......WWWWWWWW......';
  return {
    format: MAP_FILE_FORMAT,
    id: 'two-shores',
    name: 'Two Shores',
    maker: 'test',
    width: 20,
    height: 16,
    ground: Array.from({ length: 16 }, () => row),
    buildings: [],
    dropIns: [{ x: 1, y: 1, name: 'West Shore' }],
    exits: [{ x: 18, y: 14, name: 'East Steps', opens: { when: 'always' } }],
    itemSpots: [],
    wildlife: 'meadow',
    links: [
      {
        ends: [
          { x: 5, y: 8, toward: 'right', look: 'boat' },
          { x: 14, y: 8, toward: 'left', look: 'boat' },
        ],
        sails: { name: 'The Ferry', from: 30, until: 120, course: [] },
      },
    ],
    ...changes,
  };
}

describe('a course', () => {
  it('is every tile from turn to turn, a step apart', () => {
    expect(coursePath([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('is sailed straight from turn to turn, and says so when it is not', () => {
    expect(courseFaults([{ x: 0, y: 0 }, { x: 0, y: 3 }])).toEqual([]);
    expect(courseFaults([{ x: 0, y: 0 }, { x: 3, y: 3 }])).toHaveLength(1);
  });
});

describe('the tide', () => {
  const sailing = sailingOf(twoShores().links![0]);

  it('lets the boat sail only inside its window', () => {
    expect(sailingState(sailing, 29_999)).toBe('not-yet');
    expect(sailingState(sailing, 30_000)).toBe('sailing');
    expect(sailingState(sailing, 119_999)).toBe('sailing');
    expect(sailingState(sailing, 120_000)).toBe('gone');
  });

  it('is said on the jetty: when it sails, how long it has, and that it has gone', () => {
    expect(boatCaption(sailing, 'not-yet', 0)).toBe('SAILS IN 30s');
    expect(boatCaption(sailing, 'sailing', 100_000)).toBe('SAILING 20s');
    expect(boatCaption(sailing, 'gone', 200_000)).toBe('SAILED');
    expect(boatAwayLines(sailing, 'not-yet', 0).join(' ')).toContain('in 30s, and sails for 90s');
    expect(boatAwayLines(sailing, 'gone', 200_000).join(' ')).toContain('will not sail again');
  });

  it('counts down to the tide as the raid clock does, never in time since the drop', () => {
    // The raid clock counts down, so "SAILS AT 0:30" read off a clock showing
    // 4:50 sent a player to wait for a boat that had already sailed. A jetty
    // says how long until, as an exit's OPENS IN does.
    expect(boatCaption(sailing, 'not-yet', 20_000)).toBe('SAILS IN 10s');
    expect(boatCaption(sailing, 'not-yet', 29_001)).toBe('SAILS IN 1s');
    expect(boatAwayLines(sailing, 'not-yet', 20_000).join(' ')).toContain('in 10s, and sails for 90s');
    for (const elapsed of [0, 20_000]) {
      expect(boatCaption(sailing, 'not-yet', elapsed)).not.toMatch(/\d:\d\d/);
      expect(boatAwayLines(sailing, 'not-yet', elapsed).join(' ')).not.toMatch(/\d:\d\d/);
    }
  });

  it("asks before it takes anybody, in FireRed's sailor's words, the cursor on staying ashore", () => {
    const prompt = boardingPrompt(sailing, 'East Shore');
    expect(prompt.lines).toEqual(['Ahoy, there!', 'Sail THE FERRY to EAST SHORE?']);
    expect(prompt.options[prompt.selected]).toBe('STAY ASHORE');
  });
});

describe('a voyage', () => {
  const sailing = sailingOf(twoShores().links![0]);

  it('is boarded from a jetty pressing out to sea, from either end', () => {
    expect(boatAt([sailing], { x: 5, y: 8 }, 'right')).toEqual({ sailing, from: 0 });
    expect(boatAt([sailing], { x: 14, y: 8 }, 'left')).toEqual({ sailing, from: 1 });
    expect(boatAt([sailing], { x: 5, y: 8 }, 'up')).toBeUndefined();
  });

  it('crosses the water a tile at a time and puts the player ashore on the far jetty', () => {
    const there = voyage(sailing, 0);
    expect(there[0]).toEqual({ x: 6, y: 8 });
    expect(there.at(-2)).toEqual({ x: 13, y: 8 });
    expect(there.at(-1)).toEqual({ x: 14, y: 8 });
    expect(there).toHaveLength(9);
    const back = voyage(sailing, 1);
    expect(back[0]).toEqual({ x: 13, y: 8 });
    expect(back.at(-1)).toEqual({ x: 5, y: 8 });
  });
});

describe('a boat in a map file', () => {
  it('is read, and rebuilt with nothing but its own fields', () => {
    const file = twoShores();
    const read = readMapFile({
      ...file,
      links: [{ ...file.links![0], sails: { ...file.links![0].sails!, stowaway: true } }],
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.file.links![0].sails).toEqual(file.links![0].sails);
    }
  });

  it('is refused with one end indoors, a window outside the raid, or no word of when it sails', () => {
    const file = twoShores();
    const [a, b] = file.links![0].ends;
    const refused = (links: unknown) => readMapFile({ ...file, links }).ok;
    expect(refused([{ ends: [a, { ...b, look: 'door' }], sails: file.links![0].sails }])).toBe(false);
    expect(refused([{ ends: [a, b], sails: { ...file.links![0].sails, until: 999 } }])).toBe(false);
    expect(refused([{ ends: [a, b] }])).toBe(false);
  });

  it('is laid out as a boat, never as a way through the hunter walks', () => {
    const composed = composeMapFile(twoShores());
    expect(composed.doorways).toEqual([]);
    expect(composed.sailings).toHaveLength(1);
  });

  it('takes the player across to ground no walk reaches, and the hunter nowhere', () => {
    const composed = composeMapFile(twoShores());
    const links = sailingLinks(composed.sailings);
    expect(links).toHaveLength(2);
    const map = { width: composed.width, sailings: composed.sailings };
    const table = playerLinks(map)!;
    expect(table.get(linkKey(8 * 20 + 5, 3))).toBe(8 * 20 + 14);
    expect(playerLinks({ width: 20 })).toBeUndefined();
  });

  it('passes the checks only moored in deep water and sailing over it', () => {
    expect(checkMapFile(twoShores()).every((check) => check.passed)).toBe(true);
    const aground = twoShores({
      ground: Array.from({ length: 16 }, (_, y) => (y === 8 ? '......WWWW.WWW......' : '......WWWWWWWW......')),
    });
    const doors = checkMapFile(aground).find((check) => check.id === 'doors');
    expect(doors?.passed).toBe(false);
    expect(doors?.problems.join(' ')).toContain('runs aground');
  });

  it('is the only way to an exit across the water, and the checks know it', () => {
    const noBoat = twoShores({ links: [] });
    expect(checkMapFile(noBoat).find((check) => check.id === 'way-out')?.passed).toBe(false);
    expect(checkMapFile(twoShores()).find((check) => check.id === 'way-out')?.passed).toBe(true);
  });
});
