import { describe, expect, it } from 'vitest';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getIdleFrame,
  getWalkAnimationKey,
  getWalkFrames,
} from './playerFrames';

describe('playerFrames', () => {
  it('uses the sprite sheet frame size from the measured sheet layout', () => {
    expect(CHARACTER_FRAME_WIDTH).toBe(16);
    expect(CHARACTER_FRAME_HEIGHT).toBe(32);
  });

  it('maps each direction to the selected player character rows', () => {
    expect(getIdleFrame('down')).toBe(0);
    expect(getIdleFrame('left')).toBe(51);
    expect(getIdleFrame('up')).toBe(34);
    expect(getIdleFrame('right')).toBe(17);
  });

  it('uses the intended walk cycle frames for each direction', () => {
    expect(getWalkFrames('down')).toEqual([1, 0, 3, 0]);
    expect(getWalkFrames('left')).toEqual([52, 51, 54, 51]);
    expect(getWalkFrames('up')).toEqual([35, 34, 37, 34]);
    expect(getWalkFrames('right')).toEqual([18, 17, 20, 17]);
  });

  it('builds stable animation keys per direction', () => {
    expect(getWalkAnimationKey('down')).toBe('player-walk-down');
    expect(getWalkAnimationKey('left')).toBe('player-walk-left');
    expect(getWalkAnimationKey('up')).toBe('player-walk-up');
    expect(getWalkAnimationKey('right')).toBe('player-walk-right');
  });
});
