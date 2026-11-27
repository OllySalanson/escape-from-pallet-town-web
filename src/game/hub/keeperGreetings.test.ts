import { describe, expect, it } from 'vitest';
import { shareLine } from '../ui/dialogBoxes';
import { FRIEND_BOARD_QUESTION, heldRoomQuestion, KEEPER_GREETINGS, OAK_POKEDEX_QUESTION } from './keeperGreetings';

/**
 * The harbour's dialogue box, as words: two rows of about 38 characters,
 * wrapped a whole word at a time as Phaser wraps them (`ui/dialogBoxes.test.ts`
 * has the same measure).
 */
const wrap = (text: string): string[] => {
  const rows: string[] = [];
  for (const word of text.split(' ')) {
    const last = rows[rows.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= 38) {
      rows[rows.length - 1] = `${last} ${word}`;
    } else {
      rows.push(word);
    }
  }
  return rows;
};

/** What a line that explains a rule, a key or how to do something sounds like (PR #980's rule). */
const EXPLAINS = /\b(press|walk up|tap|click|SPACE|ENTER|ESC|only|costs?|once a|each day|every day|bank \d|\d+ jobs?|rule)\b|\[[A-Z]\]/i;

describe("every keeper's greeting", () => {
  it.each(Object.entries(KEEPER_GREETINGS))('%s fits one box', (_screen, greeting) => {
    expect(shareLine(greeting, 2, wrap)).toEqual([greeting]);
  });

  it.each(Object.entries(KEEPER_GREETINGS))('%s says hello in their own voice, and explains nothing', (_screen, greeting) => {
    expect(greeting).not.toMatch(EXPLAINS);
    expect(greeting).not.toContain('\u2014');
  });

  it('is a welcome each, not the same line for everybody', () => {
    expect(new Set(Object.values(KEEPER_GREETINGS)).size).toBe(Object.keys(KEEPER_GREETINGS).length);
  });
});

describe('the questions that follow a greeting', () => {
  it.each([OAK_POKEDEX_QUESTION, FRIEND_BOARD_QUESTION, heldRoomQuestion('BRKT')])('fits the box: %s', (question) => {
    expect(wrap(question).length).toBeLessThanOrEqual(2);
    expect(question).not.toMatch(EXPLAINS);
  });
});
