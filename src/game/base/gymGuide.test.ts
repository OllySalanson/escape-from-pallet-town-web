import { afterEach, describe, expect, it } from 'vitest';
import { buildContractBoard } from '../hub/contractBoard';
import { errandOf, harbourGiver, withErrandAsked } from '../hub/errands';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { gymGuideLines } from './gymGuide';

/**
 * The Gym Guide at the Raid Arena's door says the day's work in the dialogue
 * box: what the board has, what it pays, and whose favours are in hand - the
 * quest said by a person, a box a line, rather than read off a list.
 */
describe("the Gym Guide's word on the day's work", () => {
  afterEach(() => retireMapsForTests([]));

  it("says the board's job, what it asks and what it pays, as the board itself words them", () => {
    // The roster as shipped: the standing board deals on Greystone Vale.
    retireMapsForTests(RETIRED_MAPS);
    const [job] = buildContractBoard(DEFAULT_RAID_PROGRESS).rows;
    const lines = gymGuideLines(DEFAULT_RAID_PROGRESS);
    expect(lines[0]).toBe(`Yo, champ! Today's job: ${job.name.toUpperCase()}.`);
    expect(lines).toContain(`${job.description}.`);
    expect(lines.some((line) => line.startsWith('It pays ') && line.includes(job.reward.replace(/\.$/, '')))).toBe(true);
    if (job.asks) {
      expect(lines.join(' ')).toContain(job.asks);
    }
    expect(lines.at(-1)).toBe('Kit up through that door!');
    // A box a line, and few of them: it is said, not read off a list. (The
    // suite always has a published player map, whose job is "more on the board".)
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it('names every favour in hand, whose it is and where its thing lies', () => {
    const errands = withErrandAsked(withErrandAsked(undefined, 'old-amber'), 'gold-teeth');
    const lines = gymGuideLines({ ...DEFAULT_RAID_PROGRESS, errands });
    expect(lines).toContain('Bill is waiting on OLD AMBER, from PINE HOLLOW.');
    expect(lines).toContain('Warden Fenwick is waiting on GOLD TEETH, from SAFARI MARSH.');
    expect(errandOf(harbourGiver('safari-warden'))?.id).toBe('gold-teeth');
    // Nobody waiting, nothing said about favours.
    expect(gymGuideLines(DEFAULT_RAID_PROGRESS).join(' ')).not.toContain('waiting on');
  });
});
