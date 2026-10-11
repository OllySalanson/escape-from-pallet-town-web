import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { namingCountLine, namingScreenMarkup, namingTitle } from './namingScreen';

const words = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe("FireRed's naming screen", () => {
  const pidgey = new Pokemon(getSpeciesById('pidgey')!, 3);
  const html = namingScreenMarkup({ pokemon: pidgey });

  it("asks FireRed's question, over the Pokemon being named", () => {
    expect(namingTitle('Pidgey')).toBe("PIDGEY's nickname?");
    expect(words(html)).toContain("PIDGEY's nickname?");
    expect(html).toContain(`assets/pokemon/front/${pidgey.base.dexId}.png`);
  });

  it('takes ten letters, and says the species name is kept when it is left blank', () => {
    expect(html).toContain('maxlength="10"');
    expect(html).toContain('placeholder="PIDGEY"');
    expect(words(html)).toContain('Left blank, it goes by PIDGEY');
    expect(namingCountLine('')).toBe('0 of 10 letters');
    expect(namingCountLine('Sparky')).toBe('6 of 10 letters');
  });

  it('offers OK and no nickname, and starts on the line to type into', () => {
    expect(html).toContain('data-naming-ok');
    expect(html).toContain('data-naming-skip');
    expect(html).toContain('data-naming-field');
    expect(words(html)).toContain('ENTER OK · ESC no nickname');
  });
});
