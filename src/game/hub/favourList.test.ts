import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemId } from '../items';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import {
  declineErrand,
  ERRANDS,
  errandOf,
  errandThing,
  forgetDeclinedErrands,
  harbourGiver,
  withErrandAsked,
  withErrandCompleted,
  type ErrandProgress,
} from './errands';
import { favourEntries, favourGiverWhere, favourListMarkup } from './favourList';

const nothing = (): number => 0;

/**
 * The quiet place a favour's detail is read: every favour, where it stands,
 * grouped, with the whole of the one the cursor is on - opened with O at base
 * rather than laid over anybody's screen.
 */
describe('the favours list', () => {
  // The roster as shipped: Greystone Vale alone, which a new save can drop into.
  beforeEach(() => {
    retireMapsForTests(RETIRED_MAPS);
    forgetDeclinedErrands();
  });
  afterEach(() => {
    retireMapsForTests([]);
    forgetDeclinedErrands();
  });

  it('lists every favour a new save can be asked, by who asks it and where they are found', () => {
    const entries = favourEntries(DEFAULT_RAID_PROGRESS, nothing, 0);
    expect(entries.map((entry) => entry.errand.id).sort()).toEqual(ERRANDS.map((errand) => errand.id).sort());
    expect(entries.every((entry) => entry.standing === 'ask')).toBe(true);
    expect(favourGiverWhere(errandOf('lab')!)).toBe('OAK’S LAB');
    expect(favourGiverWhere(errandOf('workshop')!)).toBe('BROCK’S WORKSHOP');
    expect(favourGiverWhere(errandOf(harbourGiver('ss-anne-captain'))!)).toBe('THE LONG PIER');
    expect(favourGiverWhere(errandOf(harbourGiver('safari-warden'))!)).toBe('THE COVE');
  });

  it('never names a favour nobody has asked yet: the giver says what it is', () => {
    const markup = favourListMarkup(favourEntries(DEFAULT_RAID_PROGRESS, nothing, 0));
    for (const errand of ERRANDS) {
      expect(markup, errand.id).toContain(errand.name);
      expect(markup, errand.id).not.toContain(errandThing(errand));
    }
    expect(markup).toContain('Somebody wants a word');
  });

  it('orders what to hand over first, then what is in hand, who wants a word, and what is done', () => {
    const [oak, joy, brock, bill] = ['lab', 'stash', 'workshop', 'trader'].map((giver) => errandOf(giver as never)!);
    let errands = withErrandAsked(withErrandAsked(withErrandAsked(undefined, oak.id), joy.id), brock.id);
    errands = withErrandCompleted(errands, brock.id);
    declineErrand(bill.id, 0);
    const progress: ErrandProgress = { ...DEFAULT_RAID_PROGRESS, errands };
    const joyHome = (itemId: ItemId): number => (itemId === joy.itemId ? 1 : 0);
    const entries = favourEntries(progress, joyHome, 0);
    const standing = Object.fromEntries(entries.map((entry) => [entry.errand.id, entry.standing]));
    expect(standing).toMatchObject({ [joy.id]: 'home', [oak.id]: 'in-hand', [bill.id]: 'ask-later', [brock.id]: 'done' });
    expect(entries[0].errand).toBe(joy);
    expect(entries.at(-1)!.errand).toBe(brock);

    const markup = favourListMarkup(entries);
    // In hand: where it lies and how big, and what it pays below.
    expect(markup).toContain('In MILLBROOK, Greystone Vale. 2 squares of your pack.');
    expect(markup).toContain('Lost with the pack if you wipe.');
    expect(markup).toContain('Home. Speak to Nurse Joy at POKÉMON CENTER.');
    expect(markup).toContain(`Done. ${brock.reward.summary}.`);
    expect(markup).toContain('2 in hand · 1 done');
    // A NOT NOW is still on the list, and says when it comes round again.
    expect(markup).toContain('Asked again after your next raid');
    // The first row is where the cursor starts, and its pane is the one shown.
    expect(markup.match(/data-cursor-start/g)).toHaveLength(1);
    expect(markup).toContain(`data-shown-by="favour-${joy.id}">`);
  });

  it('says so when there is nothing to list', () => {
    const everyDone = ERRANDS.reduce(
      (records, errand) => withErrandCompleted(withErrandAsked(records, errand.id), errand.id),
      withErrandAsked(undefined, ERRANDS[0].id),
    );
    expect(favourEntries({ ...DEFAULT_RAID_PROGRESS, errands: everyDone }, nothing, 0).every((entry) => entry.standing === 'done')).toBe(true);
    expect(favourListMarkup([])).toContain('Nobody has a favour to ask yet.');
  });
});
