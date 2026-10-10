import { describe, expect, it } from 'vitest';
import { buildFeedbackContext, contextLines, providesFeedbackContext, screenName } from './feedbackContext';

const inputs = {
  scenes: ['world', 'bag'],
  details: [{ label: 'Map', value: 'Route 1' }],
  viewport: { width: 1280, height: 800, pixelRatio: 1.25 },
  stage: { width: 400, height: 256, zoom: 3 },
  browser: 'Mozilla/5.0 test',
  mode: 'normal',
  now: new Date('2026-10-10T10:00:00Z'),
};

describe('where the player was', () => {
  it('names the screen in front of them, never the panel itself', () => {
    expect(screenName(['world', 'bag', 'feedback'])).toBe('Raid pack');
    expect(screenName(['world'])).toBe('Raid');
    expect(screenName(['some-new-scene'])).toBe('some-new-scene');
    expect(screenName([])).toBe('Unknown');
  });

  it('lists everything that rides along, the way SEE IT ALL shows it', () => {
    const context = buildFeedbackContext(inputs);
    expect(context.takenAt).toBe('2026-10-10T10:00:00.000Z');
    expect(contextLines(context)).toEqual([
      { label: 'Game version', value: 'dev' },
      { label: 'Screen', value: 'Raid pack' },
      { label: 'Map', value: 'Route 1' },
      { label: 'Window', value: '1280x800 at 1.25x, game 400x256 drawn 3x' },
      { label: 'Browser', value: 'Mozilla/5.0 test' },
    ]);
  });

  it('says so when the game is not the ordinary one', () => {
    expect(contextLines(buildFeedbackContext({ ...inputs, mode: 'try-it' }))).toContainEqual({ label: 'Mode', value: 'try-it' });
  });

  it('asks a scene for more only if it has something to say', () => {
    expect(providesFeedbackContext({ feedbackContext: () => [] })).toBe(true);
    expect(providesFeedbackContext({})).toBe(false);
    expect(providesFeedbackContext(null)).toBe(false);
  });
});
