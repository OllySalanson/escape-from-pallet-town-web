import { describe, expect, it } from 'vitest';
import {
  HARBOUR_PHRASES,
  PHRASE_SHOWN_MS,
  PhraseBoard,
  PhrasePace,
  SAY_BURST,
  SAY_BURST_MS,
  SAY_EVERY_MS,
  isHarbourPhraseId,
  phraseWords,
} from './harbourPhrases';
import { readHarbourSay } from './harbourProtocol';

const AMY = '22222222-2222-4222-8222-222222222222';

describe("the harbour's quick phrases", () => {
  it('are a dozen or so, each with an id of its own', () => {
    expect(HARBOUR_PHRASES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(HARBOUR_PHRASES.map((phrase) => phrase.id)).size).toBe(HARBOUR_PHRASES.length);
  });

  it('are short enough for a bubble, and safe to print anywhere', () => {
    for (const { words } of HARBOUR_PHRASES) {
      expect(words.length).toBeLessThanOrEqual(16);
      expect(words).not.toMatch(/[<>&"]/);
    }
  });

  it('knows only its own ids', () => {
    for (const { id, words } of HARBOUR_PHRASES) {
      expect(isHarbourPhraseId(id)).toBe(true);
      expect(phraseWords(id)).toBe(words);
    }
    for (const stranger of ['HELLO!', 'hello ', 'constructor', 'toString', '__proto__', '', 0, 1, null, undefined, {}, ['hello']]) {
      expect(isHarbourPhraseId(stranger)).toBe(false);
    }
  });
});

describe('a phrase heard from another browser', () => {
  it('is believed as one of the phrases, in a known place, from a player id', () => {
    expect(readHarbourSay({ u: AMY, p: 'yard', n: 'hello' })).toEqual({ from: AMY, place: 'yard', phrase: 'hello' });
  });

  it('is dropped whole as anything else', () => {
    for (const payload of [
      { u: AMY, p: 'yard', n: 'you are a ...' },
      { u: AMY, p: 'yard', n: 0 },
      { u: AMY, p: 'yard', n: 'constructor' },
      { u: AMY, p: 'yard' },
      { u: AMY, p: 'the moon', n: 'hello' },
      { u: 'AMY', p: 'yard', n: 'hello' },
      null,
      'hello',
    ]) {
      expect(readHarbourSay(payload)).toBeNull();
    }
  });
});

describe('the pace a player talks at', () => {
  it('takes one phrase, and none from the same player again for a moment', () => {
    const pace = new PhrasePace();
    expect(pace.allow(AMY, 0)).toBe(true);
    expect(pace.allow(AMY, SAY_EVERY_MS - 1)).toBe(false);
    expect(pace.allow('someone-else', 1)).toBe(true);
    expect(pace.allow(AMY, SAY_EVERY_MS)).toBe(true);
  });

  it('takes only a few in a while, however they are spaced', () => {
    const pace = new PhrasePace();
    for (let said = 0; said < SAY_BURST; said += 1) {
      expect(pace.allow(AMY, said * SAY_EVERY_MS)).toBe(true);
    }
    expect(pace.allow(AMY, SAY_BURST * SAY_EVERY_MS)).toBe(false);
    expect(pace.allow(AMY, SAY_BURST_MS)).toBe(true);
  });

  it('is not reset by a refused phrase: hammering the key never gets one through sooner', () => {
    const pace = new PhrasePace();
    pace.allow(AMY, 0);
    for (let at = 100; at < SAY_EVERY_MS; at += 100) {
      expect(pace.allow(AMY, at)).toBe(false);
    }
    expect(pace.allow(AMY, SAY_EVERY_MS)).toBe(true);
  });
});

describe('what each speaker is saying', () => {
  it('shows a phrase for a few seconds, then takes it down', () => {
    const board = new PhraseBoard();
    expect(board.hear(AMY, 'gg', 1_000)).toBe(true);
    expect(board.saying(AMY, 1_000 + PHRASE_SHOWN_MS - 1)).toBe('GG!');
    expect(board.saying(AMY, 1_000 + PHRASE_SHOWN_MS)).toBeNull();
  });

  it('keeps the first of two said too close together', () => {
    const board = new PhraseBoard();
    board.hear(AMY, 'hello', 0);
    expect(board.hear(AMY, 'bye', 10)).toBe(false);
    expect(board.saying(AMY, 10)).toBe('HELLO!');
  });

  it('forgets what a player said when they leave, but not how fast they were talking', () => {
    const board = new PhraseBoard();
    board.hear(AMY, 'hello', 0);
    board.forget(AMY);
    expect(board.saying(AMY, 1)).toBeNull();
    expect(board.hear(AMY, 'hello', 1)).toBe(false);
  });
});
