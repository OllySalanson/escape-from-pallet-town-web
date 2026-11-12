import { describe, expect, it } from 'vitest';
import type { HouseService, VisitState } from './houseService';
import { HouseVisitWatch, OWNER_GONE_AFTER_MS, VISIT_CHECK_EVERY_MS } from './houseVisit';

/**
 * A visit lasts until the visitor walks out or the owner sees them out (the
 * captain, 12 Nov 2026: a yes used to stand for ten minutes). These are the
 * ways one ends, from the visitor's side, and the ways it does not.
 */
function visiting(owner = 'pip-id') {
  const asked: string[] = [];
  const left: string[] = [];
  let state: VisitState | 'trouble' = 'in';
  let standing: boolean | null = true;
  const service = {
    stillVisiting: (who: string) => {
      asked.push(who);
      return state === 'trouble' ? Promise.reject(new Error('no line')) : Promise.resolve(state);
    },
    leaveHouse: (who: string) => {
      left.push(who);
      return Promise.resolve();
    },
  } as unknown as HouseService;
  const watch = new HouseVisitWatch(service, owner, () => standing);
  return {
    watch,
    asked,
    left,
    answer: (next: VisitState | 'trouble') => {
      state = next;
    },
    ownerStanding: (next: boolean | null) => {
      standing = next;
    },
  };
}

const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('a visit to somebody else\'s house', () => {
  it('has no time limit: an hour in, it still stands, and is held open all the while', async () => {
    const visit = visiting();
    const hour = 60 * 60_000;
    for (let now = 0; now <= hour; now += 1_000) {
      visit.watch.tick(now);
      await settle();
    }
    expect(visit.watch.ended).toBeNull();
    // Asked - which is what holds it open on the database - every ten seconds.
    expect(visit.asked.length).toBe(hour / VISIT_CHECK_EVERY_MS + 1);
    expect(visit.left).toEqual([]);
  });

  it('ends when the owner sees the visitor out, heard at once when nudged', async () => {
    const visit = visiting();
    visit.watch.tick(0);
    await settle();
    visit.answer('shown-out');
    visit.watch.tick(1_000);
    await settle();
    expect(visit.watch.ended).toBeNull();
    visit.watch.nudged();
    visit.watch.tick(1_100);
    await settle();
    expect(visit.watch.ended).toBe('shown-out');
    expect(visit.left).toEqual(['pip-id']);
  });

  it('hears a show-out within the next ask even without the nudge', async () => {
    const visit = visiting();
    visit.watch.tick(0);
    await settle();
    visit.answer('shown-out');
    visit.watch.tick(VISIT_CHECK_EVERY_MS);
    await settle();
    expect(visit.watch.ended).toBe('shown-out');
  });

  it('ends once the owner has stood nowhere in the harbour for a while - offline, or gone off it', () => {
    const visit = visiting();
    visit.watch.tick(0);
    visit.ownerStanding(false);
    visit.watch.tick(1_000);
    visit.watch.tick(1_000 + OWNER_GONE_AFTER_MS - 1);
    expect(visit.watch.ended).toBeNull();
    visit.watch.tick(1_000 + OWNER_GONE_AFTER_MS);
    expect(visit.watch.ended).toBe('owner-gone');
    expect(visit.left).toEqual(['pip-id']);
  });

  it('keeps standing while the owner only looks at a menu and comes back', () => {
    const visit = visiting();
    visit.ownerStanding(false);
    visit.watch.tick(0);
    visit.watch.tick(OWNER_GONE_AFTER_MS - 1);
    visit.ownerStanding(true);
    visit.watch.tick(OWNER_GONE_AFTER_MS);
    visit.ownerStanding(false);
    visit.watch.tick(OWNER_GONE_AFTER_MS + 1);
    visit.watch.tick(2 * OWNER_GONE_AFTER_MS);
    expect(visit.watch.ended).toBeNull();
  });

  it('counts nothing against the owner while this page cannot tell who is in the harbour', () => {
    const visit = visiting();
    visit.ownerStanding(null);
    visit.watch.tick(0);
    visit.watch.tick(10 * OWNER_GONE_AFTER_MS);
    expect(visit.watch.ended).toBeNull();
  });

  it('ends when the database says it is over - the visitor was quiet too long, after a dropped line', async () => {
    const visit = visiting();
    visit.answer('over');
    visit.watch.tick(0);
    await settle();
    expect(visit.watch.ended).toBe('over');
  });

  it('never sends anybody home for a question that got no answer', async () => {
    const visit = visiting();
    visit.answer('trouble');
    for (let now = 0; now <= 10 * VISIT_CHECK_EVERY_MS; now += VISIT_CHECK_EVERY_MS) {
      visit.watch.tick(now);
      await settle();
    }
    expect(visit.watch.ended).toBeNull();
    expect(visit.asked.length).toBe(11);
  });

  it('tells the database once when the visitor walks out, and asks nothing after', async () => {
    const visit = visiting();
    visit.watch.tick(0);
    await settle();
    visit.watch.leave();
    visit.watch.leave();
    visit.watch.tick(5 * VISIT_CHECK_EVERY_MS);
    await settle();
    expect(visit.left).toEqual(['pip-id']);
    expect(visit.asked).toEqual(['pip-id']);
    expect(visit.watch.ended).toBeNull();
  });
});
