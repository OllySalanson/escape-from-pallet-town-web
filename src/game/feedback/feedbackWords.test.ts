import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as words from './feedbackWords';

const source = await readFile(new URL('./feedbackWords.ts', import.meta.url), 'utf8');

describe("the feedback panel's words", () => {
  it('says MESSAGE EXTRACTED only for a message the server holds', () => {
    expect(words.outcomeWords('sent').headline).toBe('Message extracted.');
    expect(words.outcomeWords('queued').headline).not.toMatch(/extracted/i);
    expect(words.outcomeWords('held').headline).not.toMatch(/extracted/i);
  });

  it('says plainly when the bot check is why a message is still in the pack, and offers TRY AGAIN only then', () => {
    expect(words.outcomeAfterCheck('queued', 'failed')).toBe('check-failed');
    expect(words.outcomeAfterCheck('queued', 'unavailable')).toBe('check-missing');
    expect(words.outcomeAfterCheck('queued', 'offline')).toBe('queued');
    expect(words.outcomeAfterCheck('queued', undefined)).toBe('queued');
    // The day's limit and a message the lab refused say what they always said.
    expect(words.outcomeAfterCheck('held', 'failed')).toBe('held');
    expect(words.outcomeAfterCheck('sent', undefined)).toBe('sent');
    for (const outcome of ['check-failed', 'check-missing'] as const) {
      expect(words.outcomeWords(outcome).line).toMatch(/bot check/);
      expect(words.outcomeWords(outcome).line).toMatch(/safe in your pack/);
      expect(words.canTryTheCheckAgain(outcome)).toBe(true);
    }
    for (const outcome of ['sent', 'queued', 'held', 'refused'] as const) {
      expect(words.canTryTheCheckAgain(outcome)).toBe(false);
    }
  });

  it('keeps the tab one plain word, so nobody has to guess what it is', () => {
    expect(words.FEEDBACK_TAB_LABEL.toUpperCase()).toBe('FEEDBACK');
  });

  it('never names the tools behind the game, and never types an em dash', () => {
    expect(source).not.toMatch(/claude|\bAI\b/i);
    const strings = [...source.matchAll(/'([^']*)'|`([^`]*)`|"([^"]*)"/g)].map((match) => match.slice(1).join(''));
    expect(strings.filter((line) => line.includes('—'))).toEqual([]);
  });
});
