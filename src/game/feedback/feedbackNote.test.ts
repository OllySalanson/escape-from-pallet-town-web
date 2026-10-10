import { describe, expect, it } from 'vitest';
import { countOneMore, feedbackTag, hasSomethingToSay, localDay, sendsToday, startOfNextDay } from './feedbackNote';

describe('a feedback tag', () => {
  it('is FB- and four characters a person can read back without confusing 0/O or 1/I', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(feedbackTag()).toMatch(/^FB-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('never falls off the end of its alphabet, even on a random() of almost one', () => {
    expect(feedbackTag(() => 0.999999999)).toBe('FB-9999');
    expect(feedbackTag(() => 0)).toBe('FB-AAAA');
  });
});

describe('the daily count', () => {
  const morning = new Date(2026, 9, 10, 8, 0);
  const evening = new Date(2026, 9, 10, 23, 59);
  const tomorrow = new Date(2026, 9, 11, 0, 1);

  it('counts sends on the local calendar day and starts again the next', () => {
    let record = countOneMore(null, morning);
    record = countOneMore(record, evening);
    expect(sendsToday(record, evening)).toBe(2);
    expect(sendsToday(record, tomorrow)).toBe(0);
    expect(countOneMore(record, tomorrow)).toEqual({ day: localDay(tomorrow), count: 1 });
  });

  it('holds a message over the limit until the first instant of the next day', () => {
    expect(startOfNextDay(evening).getTime()).toBe(new Date(2026, 9, 11, 0, 0).getTime());
  });
});

it('treats a message of nothing but spaces as nothing', () => {
  expect(hasSomethingToSay('  \n ')).toBe(false);
  expect(hasSomethingToSay(' stuck ')).toBe(true);
});
