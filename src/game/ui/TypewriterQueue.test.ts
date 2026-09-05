import { describe, expect, it } from 'vitest';
import { TypewriterQueue } from './TypewriterQueue';

describe('TypewriterQueue', () => {
  it('reveals text progressively across update calls', () => {
    const queue = new TypewriterQueue(['HELLO'], { charsPerSecond: 2 });

    queue.update(250);
    expect(queue.visibleText).toBe('');
    expect(queue.isComplete).toBe(false);

    queue.update(250);
    expect(queue.visibleText).toBe('H');

    queue.update(1000);
    expect(queue.visibleText).toBe('HEL');
    expect(queue.isComplete).toBe(false);

    queue.update(1000);
    expect(queue.visibleText).toBe('HELLO');
    expect(queue.isComplete).toBe(true);
  });

  it('respects chars-per-second timing with fractional updates', () => {
    const queue = new TypewriterQueue(['ABCDE'], { charsPerSecond: 5 });

    queue.update(199);
    expect(queue.visibleText).toBe('');

    queue.update(1);
    expect(queue.visibleText).toBe('A');

    queue.update(400);
    expect(queue.visibleText).toBe('ABC');

    queue.update(400);
    expect(queue.visibleText).toBe('ABCDE');
    expect(queue.isComplete).toBe(true);
  });

  it('skip reveals the full current message immediately', () => {
    const queue = new TypewriterQueue(['This is a longer message.'], { charsPerSecond: 1 });

    queue.update(500);
    expect(queue.visibleText).toBe('');
    expect(queue.isComplete).toBe(false);

    queue.skip();
    expect(queue.visibleText).toBe('This is a longer message.');
    expect(queue.isComplete).toBe(true);
  });

  it('does not advance to the next message until current message is complete', () => {
    const queue = new TypewriterQueue(['One', 'Two'], { charsPerSecond: 3 });

    queue.update(1000);
    expect(queue.visibleText).toBe('One');
    expect(queue.isComplete).toBe(true);

    expect(queue.advance()).toBe(true);
    expect(queue.visibleText).toBe('');
    expect(queue.currentMessage).toBe('Two');
    expect(queue.isComplete).toBe(false);
    expect(queue.isDone).toBe(false);

    expect(queue.advance()).toBe(false);
    expect(queue.currentMessage).toBe('Two');
  });

  it('reports done only after the final complete message advances', () => {
    const queue = new TypewriterQueue(['A', 'B'], { charsPerSecond: 100 });

    queue.update(20);
    expect(queue.visibleText).toBe('A');
    expect(queue.advance()).toBe(true);
    expect(queue.isDone).toBe(false);

    queue.update(20);
    expect(queue.visibleText).toBe('B');
    expect(queue.advance()).toBe(false);
    expect(queue.isDone).toBe(true);
    expect(queue.visibleText).toBe('');
    expect(queue.currentMessage).toBeNull();
  });

  it('starts done for an empty queue', () => {
    const queue = new TypewriterQueue([]);

    expect(queue.isDone).toBe(true);
    expect(queue.isComplete).toBe(true);
    expect(queue.visibleText).toBe('');
    expect(queue.advance()).toBe(false);
  });

  it('rejects invalid chars-per-second values', () => {
    expect(() => new TypewriterQueue(['text'], { charsPerSecond: 0 })).toThrowError(
      'charsPerSecond must be a finite number greater than zero.',
    );
  });
});
