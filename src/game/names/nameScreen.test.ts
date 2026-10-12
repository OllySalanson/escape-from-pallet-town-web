import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_MAX_LENGTH } from '../console/playerName';
import { YOUR_NAME_TITLE, nameClaimLine, nameCountLine, nameProblemLine, nameScreenHints, nameScreenMarkup } from './nameScreen';

describe('YOUR NAME?', () => {
  it("asks in FireRed's words, with one line of ten letters and OK, wherever it is asked", () => {
    for (const where of ['new-game', 'continue', 'house'] as const) {
      const markup = nameScreenMarkup({ where, value: '' });
      expect(markup).toContain(YOUR_NAME_TITLE);
      expect(markup).toContain(`maxlength="${PLAYER_NAME_MAX_LENGTH}"`);
      expect(markup).toContain('data-name-ok');
      expect(markup).toContain('data-name-away');
      expect(markup).toContain(nameScreenHints(where));
      expect(markup).toContain('nobody else can have it');
    }
  });

  it('lets a NEW GAME go back to the title or start without a name, CONTINUE put it off, and the house be left', () => {
    const newGame = nameScreenMarkup({ where: 'new-game', value: '' });
    expect(newGame).toContain('data-name-later');
    expect(newGame).toContain('>Back<');
    expect(nameScreenMarkup({ where: 'continue', value: '' })).toContain('>Later<');
    expect(nameScreenMarkup({ where: 'house', value: '' })).toContain('>Back outside<');
    expect(nameScreenMarkup({ where: 'house', value: '' })).not.toContain('data-name-later');
  });

  it('says under the line whether anybody else has the name, once there is a name to ask about', () => {
    expect(nameCountLine('', 'free')).toBe(`0 of ${PLAYER_NAME_MAX_LENGTH} letters`);
    expect(nameCountLine('ASH')).toBe(`3 of ${PLAYER_NAME_MAX_LENGTH} letters`);
    expect(nameCountLine('ASH', 'asking')).toBe(`3 of ${PLAYER_NAME_MAX_LENGTH} letters · asking...`);
    expect(nameCountLine('ASH', 'free')).toMatch(/· free$/);
    expect(nameCountLine('ASH', 'taken')).toMatch(/· taken$/);
    expect(nameCountLine('ASH', 'yours')).toMatch(/· yours$/);
  });

  it('says plainly why a name could not be had', () => {
    expect(nameClaimLine('taken', 'new-game')).toBe('Somebody already has that name. Pick another.');
    expect(nameClaimLine('refused', 'house')).toBe(nameProblemLine('unkind'));
    expect(nameClaimLine('offline', 'continue')).toMatch(/LATER/);
    expect(nameClaimLine('offline', 'house')).not.toMatch(/LATER/);
    expect(nameProblemLine('empty')).toMatch(/Type a name first/);
  });
});
