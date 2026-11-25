import { describe, expect, it } from 'vitest';
import { COURSE_GATE_FRONT, HARBOUR_LANDMARKS, landmarkHint, OUTDOOR_GAME_LANDMARKS } from './landmarks';

describe('the hint line at a landmark', () => {
  // The AI playtests of 22 Nov 2026: players walked round THE DIG's sign
  // pressing SPACE in every direction, because the line under them said only
  // [ARROWS] WALK, even while they faced the sign.
  it('names THE DIG when facing its sign from where the AI players stood', () => {
    expect(landmarkHint({ x: 70, y: 19 })).toBe('[SPACE] THE DIG');
  });

  it('names every landmark on every tile that answers SPACE', () => {
    for (const landmark of HARBOUR_LANDMARKS) {
      for (const tile of landmark.faced ?? [landmark.at]) {
        expect(landmarkHint(tile)).toBe(`[SPACE] ${landmark.name}`);
      }
    }
    expect(OUTDOOR_GAME_LANDMARKS.map((game) => game.id)).toContain('dig');
  });

  it('names the course at its gate, and says nothing on open ground', () => {
    for (const tile of COURSE_GATE_FRONT) {
      expect(landmarkHint(tile)).toBe('[SPACE] FIELD-MOVE COURSE');
    }
    expect(landmarkHint({ x: 0, y: 0 })).toBeUndefined();
  });
});
