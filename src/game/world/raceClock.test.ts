import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, countdownWord, formatGap, formatRaceTime, racerPlace } from './raceClock';
import { chargeFight, MERE_DASH, newRace } from './races';

const line = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
];

describe('the racer on their line', () => {
  it('is wherever the clock puts them, part-way between tiles', () => {
    expect(racerPlace(line, 150, 0)).toMatchObject({ tile: { x: 0, y: 0 }, next: { x: 1, y: 0 }, between: 0, facing: 'right', home: false });
    expect(racerPlace(line, 150, 225)).toMatchObject({ tile: { x: 1, y: 0 }, between: 0.5, facing: 'right' });
    expect(racerPlace(line, 150, 330)).toMatchObject({ tile: { x: 2, y: 0 }, next: { x: 2, y: 1 }, facing: 'down' });
  });

  it('stops at the end of the line, facing the way they came in', () => {
    expect(racerPlace(line, 150, 10_000)).toMatchObject({ tile: { x: 2, y: 1 }, between: 0, home: true, facing: 'down' });
  });

  it('moves the same whatever the frames: a schedule, not a walker', () => {
    expect(racerPlace(line, 150, 100 + 100 + 100)).toEqual(racerPlace(line, 150, 300));
  });
});

describe('the countdown and the clock', () => {
  it('counts 3, 2, 1 and is over at its end', () => {
    expect(countdownWord(0)).toBe('3');
    expect(countdownWord(COUNTDOWN_MS / 3)).toBe('2');
    expect(countdownWord(COUNTDOWN_MS - 1)).toBe('1');
    expect(countdownWord(COUNTDOWN_MS)).toBeNull();
  });

  it('reads as a stopwatch does', () => {
    expect(formatRaceTime(0)).toBe('0:00.0');
    expect(formatRaceTime(15_249)).toBe('0:15.2');
    expect(formatRaceTime(75_000)).toBe('1:15.0');
    expect(formatGap(2449)).toBe('2.4s');
  });

  it('charges a fight to a race that is running, and to nothing else', () => {
    const race = newRace(MERE_DASH, [{ x: 0, y: 0 }, ...MERE_DASH.finish.tiles]);
    expect(race.racerMs).toBe(150);
    chargeFight(race, 500);
    expect(race.clockMs).toBe(0);
    race.phase = 'running';
    chargeFight(race, 500);
    expect(race.clockMs).toBe(500);
    race.phase = 'over';
    chargeFight(race, 500);
    expect(race.clockMs).toBe(500);
    chargeFight(undefined, 500);
  });
});
