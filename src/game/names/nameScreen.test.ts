import { describe, expect, it } from 'vitest';
import { CONSOLE_GAMES } from '../console/consoleGames';
import { gamesMenuMarkup } from '../console/gamesMenu';
import { PLAYER_NAME_MAX_LENGTH, typedPlayerName } from '../console/playerName';
import { YOUR_NAME_TITLE, nameClaimLine, nameCountLine, nameProblemLine, nameScreenHints, nameScreenMarkup } from './nameScreen';

/**
 * The characters a line under a name field lists as allowed: whatever stands
 * after its last " and ", one character a word, to the end of the line.
 */
function listedCharacters(line: string): string[] {
  return line.slice(line.lastIndexOf(' and ') + ' and '.length).trim().split(' ');
}

describe('YOUR NAME?', () => {
  it('says under both name fields every mark a name may hold, the dash and the space included', () => {
    // What the rule takes, asked of the rule: every printable mark that is not a letter or a number.
    const marks = Array.from({ length: 95 }, (_, at) => String.fromCharCode(32 + at))
      .filter((mark) => !/[A-Za-z0-9 ]/.test(mark) && typedPlayerName(`A${mark}A`) === `A${mark}A`);
    expect(marks).toContain('-');
    expect(typedPlayerName('A A')).toBe('A A');

    const help = /data-name-field[^>]*data-help="([^"]*)"/.exec(nameScreenMarkup({ where: 'house', value: '' }))?.[1];
    const consoleLine = /On every board[^<]*/.exec(
      gamesMenuMarkup({ games: CONSOLE_GAMES, boards: new Map(), playerName: null, naming: { value: '' } }),
    )?.[0];
    for (const line of [help, consoleLine]) {
      expect(line).toBeDefined();
      // Listed last, so nothing after the dash makes it read as a break in the sentence.
      expect(listedCharacters(line!).sort()).toEqual([...marks].sort());
      expect(line).toContain('spaces');
    }
  });

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
