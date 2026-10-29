import { describe, expect, it } from 'vitest';
import { HARBOUR_PHRASES, PHRASE_SHOWN_MS, SAY_EVERY_MS } from '../harbour/harbourPhrases';
import {
  HarbourTalk,
  OWN_SPEAKER,
  REGULAR_ANSWERS,
  REGULAR_ANSWERS_WITHIN,
  REGULAR_ANSWER_AFTER_MS,
} from './harbourTalk';
import { isPlayerId } from '../harbour/harbourProtocol';

/** Dice that roll these numbers in turn. */
const rolls = (...values: number[]) => () => values.shift() ?? 0;

describe("this player's quick phrases, and the regulars' answers", () => {
  it('puts what this player says over them, paced as everybody is', () => {
    const talk = new HarbourTalk();
    expect(talk.say('hello', 0)).toBe(true);
    expect(talk.saying(OWN_SPEAKER, 1)).toBe('HELLO!');
    expect(talk.say('bye', 1)).toBe(false);
    expect(talk.say('bye', SAY_EVERY_MS)).toBe(true);
    expect(talk.saying(OWN_SPEAKER, SAY_EVERY_MS + PHRASE_SHOWN_MS)).toBeNull();
  });

  it('is never a player anybody could hear as', () => {
    expect(isPlayerId(OWN_SPEAKER)).toBe(false);
  });

  it('has the nearest regular answer, a breath later, when the dice say so', () => {
    const talk = new HarbourTalk();
    talk.say('outfit', 0);
    talk.answer('outfit', 0, [{ id: 'far', steps: 4 }, { id: 'near', steps: 2 }], rolls(0, 0));
    talk.tick(REGULAR_ANSWER_AFTER_MS[0] - 1);
    expect(talk.saying('near', REGULAR_ANSWER_AFTER_MS[0] - 1)).toBeNull();
    talk.tick(REGULAR_ANSWER_AFTER_MS[0]);
    expect(talk.saying('near', REGULAR_ANSWER_AFTER_MS[0])).toBe('THANKS!');
    expect(talk.saying('far', REGULAR_ANSWER_AFTER_MS[0])).toBeNull();
  });

  it('only now and then', () => {
    const talk = new HarbourTalk();
    talk.answer('hello', 0, [{ id: 'near', steps: 1 }], rolls(0.99));
    talk.tick(10_000);
    expect(talk.saying('near', 10_000)).toBeNull();
  });

  it('from nobody out of earshot', () => {
    const talk = new HarbourTalk();
    talk.answer('hello', 0, [{ id: 'far', steps: REGULAR_ANSWERS_WITHIN + 1 }], rolls(0, 0));
    talk.tick(10_000);
    expect(talk.saying('far', 10_000)).toBeNull();
  });

  it('answers only with phrases from the list, and says nothing back to some', () => {
    const ids = HARBOUR_PHRASES.map((phrase) => phrase.id);
    for (const answers of Object.values(REGULAR_ANSWERS)) {
      expect(answers.every((answer) => (ids as readonly string[]).includes(answer))).toBe(true);
    }
    const talk = new HarbourTalk();
    talk.answer('thanks', 0, [{ id: 'near', steps: 1 }], rolls(0, 0));
    talk.tick(10_000);
    expect(talk.saying('near', 10_000)).toBeNull();
  });
});
