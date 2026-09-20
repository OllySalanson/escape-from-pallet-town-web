import { describe, expect, it } from 'vitest';

import {
  cursorMayDescribe,
  describeKey,
  describedKey,
  isPreviewing,
  POINTER_ONLY,
  previewAfterPointer,
  splitDescribeKey,
} from './hoverDescribe';

describe('what a screen is describing', () => {
  it('is what the player chose while nothing is being pointed at', () => {
    expect(describedKey({ pointer: null, cursor: null, selected: 'item:potion' })).toBe('item:potion');
  });

  it('is what the pointer is on, without that becoming the selection', () => {
    const sources = { pointer: 'item:antidote', cursor: null, selected: 'item:potion' };
    expect(describedKey(sources)).toBe('item:antidote');
    // The rule cannot write a selection - it only reads one - which is the
    // whole of "pointing does not commit".
    expect(sources.selected).toBe('item:potion');
    expect(isPreviewing(sources)).toBe(true);
  });

  it('goes back to the selection the moment the pointer leaves', () => {
    expect(describedKey({ pointer: null, cursor: null, selected: 'item:potion' })).toBe('item:potion');
  });

  it('prefers the pointer to the keyboard cursor, and the cursor to the selection', () => {
    expect(describedKey({ pointer: 'item:a', cursor: 'item:b', selected: 'item:c' })).toBe('item:a');
    expect(describedKey({ pointer: null, cursor: 'item:b', selected: 'item:c' })).toBe('item:b');
  });

  it('is nothing at all on a screen with nothing on it', () => {
    expect(describedKey({ pointer: null, cursor: null, selected: null })).toBeNull();
    expect(isPreviewing({ pointer: null, cursor: null, selected: null })).toBe(false);
  });

  it('is not previewing when the pointer is on the thing already chosen', () => {
    expect(isPreviewing({ pointer: 'item:potion', cursor: null, selected: 'item:potion' })).toBe(false);
  });
});

describe('the pointer crossing a list', () => {
  it('takes the answer from whatever it lands on', () => {
    expect(previewAfterPointer(null, { on: 'item:potion', withinGroup: true })).toBe('item:potion');
  });

  /**
   * The gap between two rows is a frame the pointer spends on the list itself.
   * Reading that as "on nothing" flickered the panel back to the selection and
   * out again on every row the pointer passed over.
   */
  it('keeps the last answer while it is still inside the list', () => {
    expect(previewAfterPointer('item:potion', { on: null, withinGroup: true })).toBe('item:potion');
  });

  it('forgets it once it has left the list', () => {
    expect(previewAfterPointer('item:potion', { on: null, withinGroup: false })).toBeNull();
  });
});

describe('a thing only the pointer may describe', () => {
  it('is written as an attribute a screen can put on a row', () => {
    expect(POINTER_ONLY).toBe('data-describes-on="pointer"');
  });

  it('lets the cursor describe everything else', () => {
    expect(cursorMayDescribe(undefined)).toBe(true);
    expect(cursorMayDescribe('pointer')).toBe(false);
  });
});

describe('a describe key', () => {
  it('names a kind and a thing, so two elements can mean the same thing', () => {
    expect(describeKey('item', 'potion')).toBe('item:potion');
    expect(describeKey('member', 2)).toBe('member:2');
  });

  it('splits back, leaving an id that holds colons alone', () => {
    expect(splitDescribeKey('item:tm40-aerial-ace')).toEqual({ kind: 'item', id: 'tm40-aerial-ace' });
    expect(splitDescribeKey('cargo:caught:1')).toEqual({ kind: 'cargo', id: 'caught:1' });
    expect(splitDescribeKey('nothing')).toEqual({ kind: 'nothing', id: '' });
  });
});
