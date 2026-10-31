import { describe, expect, it } from 'vitest';
import {
  CLOSE_CALL_CLOCK_MS,
  closeCallLine,
  MARKS_KEPT,
  clockLine,
  fellLine,
  marksOn,
  newWalk,
  noteWalked,
  outLine,
  readRaidMemory,
  remembering,
  trailDots,
} from './raidMemory';

const walked = (steps: number) => {
  const walk = newWalk();
  for (let step = 0; step < steps; step += 1) {
    noteWalked(walk, { x: step % 300, y: 40 + Math.floor(step / 300) });
  }
  return walk;
};

describe('how close a raid out was', () => {
  const left = (ms: number, reads: string) => ({ ms, reads });

  it('says nothing of a raid with time in hand and nobody behind it', () => {
    expect(closeCallLine(left(CLOSE_CALL_CLOCK_MS + 1, '0:31'), null)).toBeNull();
  });

  it('names the clock once it has gone red, and that before anybody on its tail', () => {
    expect(closeCallLine(left(8000, '0:08'), null)).toBe('OUT WITH 0:08 LEFT');
    expect(closeCallLine(left(CLOSE_CALL_CLOCK_MS, '0:30'), 'Blue')).toBe('OUT WITH 0:30 LEFT');
  });

  it('names whoever was on its tail, and fits a mark', () => {
    expect(closeCallLine(left(200_000, '3:20'), 'LT. SURGE')).toBe('OUT WITH LT. SURGE ON YOUR TAIL');
    expect(closeCallLine(left(200_000, '3:20'), 'LT. SURGE')!.length).toBeLessThanOrEqual(40);
  });
});

describe("the pit's memory of a raid", () => {
  it('leaves a mark where it ended, whatever was last walked, and the walk of the raid just gone', () => {
    const memory = remembering(undefined, 'greystone-vale', walked(10), { kind: 'fell', line: fellLine('Charizard') });
    expect(memory?.marks).toEqual([{ mapId: 'greystone-vale', x: 9, y: 40, kind: 'fell', line: 'CHARIZARD FELL HERE' }]);
    const dots = trailDots(memory, 'greystone-vale');
    expect(dots[0]).toEqual({ x: 0, y: 40 });
    expect(dots[dots.length - 1]).toEqual({ x: 9, y: 40 });
    expect(trailDots(memory, 'somewhere-else')).toEqual([]);
  });

  it('leaves nothing if the raid never set foot outdoors', () => {
    expect(remembering(undefined, 'greystone-vale', newWalk(), { kind: 'out', line: outLine('x') })).toBeUndefined();
    expect(remembering(undefined, 'greystone-vale', undefined, { kind: 'out', line: outLine('x') })).toBeUndefined();
  });

  it('keeps the last dozen, oldest going first, and only the last raid\'s walk', () => {
    let memory = undefined as ReturnType<typeof remembering>;
    for (let raid = 0; raid < MARKS_KEPT + 3; raid += 1) {
      memory = remembering(memory, 'greystone-vale', walked(raid + 1), { kind: 'out', line: outLine(`Exit ${raid}`) });
    }
    expect(memory?.marks).toHaveLength(MARKS_KEPT);
    expect(memory?.marks[0].line).toBe('OUT BY EXIT 3');
    const on = marksOn(memory, 'greystone-vale');
    expect(on[on.length - 1].age).toBe(0);
    expect(on[0].age).toBe(MARKS_KEPT - 1);
    expect(trailDots(memory, 'greystone-vale').length).toBeLessThan(10);
  });

  it('holds a long walk to a size a save can carry, thinned rather than cut off', () => {
    const walk = walked(6000);
    expect(walk.points.length).toBeLessThanOrEqual(530);
    const memory = remembering(undefined, 'greystone-vale', walk, { kind: 'out', line: outLine('x') });
    const dots = trailDots(memory, 'greystone-vale');
    expect(dots[0].y).toBe(40);
    expect(dots[dots.length - 1]).toEqual(walk.last);
  });

  it('says what happened in few enough words for a plate', () => {
    expect(clockLine()).toBe('THE CLOCK RAN OUT HERE');
    expect(outLine('A Very Long Name For A Way Out Of Somewhere Indeed').length).toBeLessThanOrEqual(40);
    expect(fellLine('Bulbasaur')).toBe('BULBASAUR FELL HERE');
  });

  it('reads back only what is one, from any old save', () => {
    expect(readRaidMemory(undefined)).toBeUndefined();
    expect(readRaidMemory('lots')).toBeUndefined();
    const read = readRaidMemory({
      marks: [
        { mapId: 'a', x: 1, y: 2, kind: 'out', line: 'OUT' },
        { mapId: 'a', x: -1, y: 2, kind: 'out', line: 'OUT' },
        { mapId: 'a', x: 1, y: 2, kind: 'exploded', line: 'OUT' },
        null,
      ],
      trail: { mapId: 'a', points: [1, 2, 3] },
    });
    expect(read?.marks).toHaveLength(1);
    expect(read?.trail?.points).toEqual([1, 2]);
    expect(readRaidMemory({ marks: [], trail: { mapId: 'a', points: 'no' } })?.trail).toBeUndefined();
  });
});
