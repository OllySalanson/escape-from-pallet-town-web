import { describe, expect, it } from 'vitest';
import { ACTION_LINE_LENGTH, ActionLog, buttonWords, errorLine } from './actionLog';

describe('the action log', () => {
  it('keeps only the last thirty things, oldest first', () => {
    let now = 0;
    const log = new ActionLog(() => (now += 1000));
    for (let index = 1; index <= 40; index += 1) {
      log.record(`step ${index}`);
    }
    const lines = log.recent();
    expect(lines).toHaveLength(30);
    expect(lines[0].what).toBe('step 11');
    expect(lines[29].what).toBe('step 40');
    expect(lines[29].at).toBe(40);
  });

  it('counts one thing that happened twice in a row once', () => {
    const log = new ActionLog(() => 0);
    log.record('Pressed Use Potion');
    log.record('Pressed  Use   Potion ');
    log.record('Opened Raid pack');
    log.record('Pressed Use Potion');
    expect(log.recent().map((line) => line.what)).toEqual(['Pressed Use Potion', 'Opened Raid pack', 'Pressed Use Potion']);
  });

  it('cuts a long line short so an error with a stack cannot crowd out the rest', () => {
    const log = new ActionLog(() => 0);
    log.record('x'.repeat(500));
    expect(log.recent()[0].what).toHaveLength(ACTION_LINE_LENGTH);
  });

  it('hands out a copy, so a message cannot change after it was taken', () => {
    const log = new ActionLog(() => 0);
    log.record('one');
    const taken = log.recent();
    log.record('two');
    expect(taken).toHaveLength(1);
  });
});

it('reads a button by the words on it, on one line', () => {
  expect(buttonWords({ textContent: '\n  Use\n  Potion  ' })).toBe('Use Potion');
  expect(buttonWords({ textContent: null })).toBe('');
});

it('writes an error as one line naming the file it came from', () => {
  expect(errorLine(new TypeError('x is undefined'), { file: 'http://host/assets/index-abc.js', line: 12 })).toBe(
    'ERROR TypeError: x is undefined (index-abc.js:12)',
  );
  expect(errorLine('plain')).toBe('ERROR plain');
});
