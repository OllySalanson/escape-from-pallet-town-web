import { describe, expect, it } from 'vitest';
import { getItemById, useFieldItem } from '../items';
import { Pokemon } from './Pokemon';
import { NICKNAME_LENGTH, nicknameCharacters, tidyNickname } from './nickname';
import { getSpeciesById } from './species';

const pidgey = (): Pokemon => new Pokemon(getSpeciesById('pidgey')!, 17);

describe('a nickname, on FireRed rules', () => {
  it("holds FireRed's ten characters and no more", () => {
    expect(NICKNAME_LENGTH).toBe(10);
    expect(tidyNickname('Featherweight', 'Pidgey')).toBe('Featherwei');
    expect(nicknameCharacters('Featherweight')).toBe('Featherwei');
  });

  it('keeps the species name for a name left blank, or spelled as the species', () => {
    expect(tidyNickname('', 'Pidgey')).toBeNull();
    expect(tidyNickname('    ', 'Pidgey')).toBeNull();
    expect(tidyNickname(null, 'Pidgey')).toBeNull();
    expect(tidyNickname('PIDGEY', 'Pidgey')).toBeNull();
  });

  it('takes out what a screen could read as markup, and anything the typeface cannot draw', () => {
    expect(tidyNickname('<b>Sky</b>', 'Pidgey')).toBe('bSky/b');
    expect(tidyNickname('Ace & "Co"', 'Pidgey')).toBe('Ace Co');
    expect(tidyNickname('Pipé♂', 'Pidgey')).toBe('Pip');
    expect(tidyNickname("  Mr.  O'Hare ", 'Pidgey')).toBe("Mr. O'Hare");
  });

  it('is what the Pokemon is called, while its species stays the species', () => {
    const named = pidgey();
    expect(named.name).toBe('Pidgey');
    expect(named.giveNickname('Sparky')).toBe('Sparky');
    expect(named.name).toBe('Sparky');
    expect(named.base.name).toBe('Pidgey');
    expect(named.giveNickname(null)).toBe('Pidgey');
    expect(named.nickname).toBeNull();
  });

  it('survives evolution, as it does in FireRed', () => {
    const named = pidgey();
    named.giveNickname('Sparky');
    const result = named.gainExperience(10_000);

    expect(result.evolutions.map((evolution) => evolution.to.name)).toContain('Pidgeotto');
    expect(named.name).toBe('Sparky');
  });

  it('lets an unnamed Pokemon take its new species name when it evolves', () => {
    const plain = pidgey();
    plain.giveNickname('pidgey');
    plain.gainExperience(10_000);

    expect(plain.name).toBe('Pidgeotto');
  });

  it('is the name a stone evolution is announced under', () => {
    const pikachu = new Pokemon(getSpeciesById('pikachu')!, 12);
    pikachu.giveNickname('Volt');
    const result = useFieldItem(getItemById('thunder-stone')!, pikachu);

    expect(result.message).toBe('Congratulations! Your Volt evolved into Raichu!');
    expect(pikachu.name).toBe('Volt');
  });
});
