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

  it('keeps the tab one plain word, so nobody has to guess what it is', () => {
    expect(words.FEEDBACK_TAB_LABEL.toUpperCase()).toBe('FEEDBACK');
  });

  it('never names the tools behind the game, and never types an em dash', () => {
    expect(source).not.toMatch(/firstmate|claude|\bAI\b/i);
    const strings = [...source.matchAll(/'([^']*)'|`([^`]*)`|"([^"]*)"/g)].map((match) => match.slice(1).join(''));
    expect(strings.filter((line) => line.includes('—'))).toEqual([]);
  });
});
