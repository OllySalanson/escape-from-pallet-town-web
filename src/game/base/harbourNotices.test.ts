import { describe, expect, it } from 'vitest';
import { HARBOUR_NOTICES, noticeFor } from './harbourNotices';

describe('today\'s notice on the harbour board', () => {
  it('stays up all day and changes at midnight, by the player\'s clock', () => {
    const morning = new Date(2026, 9, 26, 7, 0);
    const night = new Date(2026, 9, 26, 23, 59);
    const tomorrow = new Date(2026, 9, 27, 0, 1);
    expect(noticeFor(morning)).toBe(noticeFor(night));
    expect(noticeFor(tomorrow)).not.toBe(noticeFor(morning));
  });

  it('goes round every notice before it says one twice', () => {
    const seen = new Set<string>();
    for (let day = 0; day < HARBOUR_NOTICES.length; day += 1) {
      seen.add(noticeFor(new Date(2026, 0, 1 + day, 12)));
    }
    expect(seen.size).toBe(HARBOUR_NOTICES.length);
  });

  it('keeps each notice short enough to read on the board without scrolling past it', () => {
    for (const notice of HARBOUR_NOTICES) {
      expect([notice, notice.length <= 110]).toEqual([notice, true]);
    }
  });
});
