import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { conditionLine, healthLine, teamConditionLine } from './condition';

const partySceneSource = await readFile(new URL('../scenes/PartyScene.ts', import.meta.url), 'utf8');
const hubSceneSource = await readFile(new URL('../scenes/HubScene.ts', import.meta.url), 'utf8');
const dossierSource = await readFile(new URL('./pokemonDossier.ts', import.meta.url), 'utf8');

const pokemon = (over: Partial<Parameters<typeof conditionLine>[0]> = {}) => ({
  level: 5,
  currentHp: 16,
  maxHp: 16,
  isFainted: false,
  primaryStatus: null,
  ...over,
});

describe('the condition line a Pokemon carries', () => {
  it('states level and HP, and stays silent when there is nothing wrong', () => {
    expect(conditionLine(pokemon())).toBe('Level 5 · 16/16\u00a0HP');
  });

  it('names a status, because a raid no longer washes one off', () => {
    expect(conditionLine(pokemon({ currentHp: 9, primaryStatus: 'poison' }))).toBe(
      'Level 5 · 9/16\u00a0HP · poison',
    );
  });

  it('leads with a faint, which the Pokemon Center - not a medicine - answers', () => {
    expect(conditionLine(pokemon({ currentHp: 0, isFainted: true, primaryStatus: 'burn' }))).toBe(
      'Level 5 · 0/16\u00a0HP · fainted · burn',
    );
  });

  it('never parts an HP figure from its unit across a line', () => {
    // A level 99 Charizard's "186/186 HP" wrapped on the result screen with
    // "HP" alone on the line below it (gnhf 20, the explorer run's Stormcrown).
    for (const line of [
      conditionLine(pokemon({ level: 99, currentHp: 186, maxHp: 186 })),
      healthLine(pokemon({ currentHp: 0, isFainted: true })),
    ]) {
      expect(line).toMatch(/\d\u00a0HP/);
      expect(line).not.toMatch(/ HP/);
    }
  });

  it('drops only the level where the level is already printed', () => {
    expect(healthLine(pokemon({ currentHp: 9, primaryStatus: 'poison' }))).toBe('9/16\u00a0HP · poison');
    expect(conditionLine(pokemon({ currentHp: 9, primaryStatus: 'poison' }))).toBe(
      `Level 5 · ${healthLine(pokemon({ currentHp: 9, primaryStatus: 'poison' }))}`,
    );
  });

  it('is the same line at base and mid-raid', () => {
    // HP and status survive a raid, so the in-raid party screen is a preview of
    // what the stash will hold. Two phrasings of that would be two answers.
    // The list row says it, and so does the pane under the list - which is
    // built for every member, so pointing at one shows it with no re-render.
    expect(partySceneSource).toContain('conditionLine(pokemon)');
    expect(hubSceneSource).toContain('return conditionLine(stored.pokemon);');
    // The pane under either list is one module, so the line under the health
    // bar is the same sentence in a raid as it is at base - less the level,
    // which the pane prints beside the name.
    expect(dossierSource).toContain('healthLine(pokemon)');
  });
});

describe('what the base says of the whole team', () => {
  const member = (name: string, over: { isFainted?: boolean; needsTreatment?: boolean } = {}) => ({
    name,
    isFainted: false,
    needsTreatment: false,
    ...over,
  });
  const fainted = { isFainted: true, needsTreatment: true };
  const hurt = { needsTreatment: true };

  it('says nothing of a fit team', () => {
    expect(teamConditionLine([member('Bulbasaur'), member('Pidgey')])).toBeNull();
  });

  it('calls a scratch hurt', () => {
    expect(teamConditionLine([member('Bulbasaur', hurt), member('Pidgey', hurt)])).toBe('2 Pokémon came home hurt');
  });

  it('names one Pokemon rather than counting it', () => {
    expect(teamConditionLine([member('Bulbasaur', hurt)])).toBe('Bulbasaur came home hurt');
    expect(teamConditionLine([member('Bulbasaur', hurt), member('Pidgey')])).toBe('Bulbasaur came home hurt');
    expect(teamConditionLine([member('Bulbasaur', fainted), member('Pidgey')])).toBe('Bulbasaur fainted');
  });

  it('never calls a faint hurt, and counts the two apart', () => {
    expect(teamConditionLine([member('Bulbasaur', fainted), member('Pidgey', hurt), member('Rattata')])).toBe(
      'Bulbasaur fainted and Pidgey came home hurt',
    );
    expect(
      teamConditionLine([
        member('Bulbasaur', fainted),
        member('Oddish', fainted),
        member('Pidgey', hurt),
        member('Rattata', hurt),
        member('Zubat'),
      ]),
    ).toBe('2 Pokémon fainted and 2 came home hurt');
  });

  it('says when nobody is left standing to raid with', () => {
    expect(teamConditionLine([member('Bulbasaur', fainted)])).toBe('Bulbasaur has fainted, so nobody can raid');
    expect(teamConditionLine([member('Bulbasaur', fainted), member('Pidgey', fainted)])).toBe(
      'All 2 Pokémon have fainted, so nobody can raid',
    );
  });
});
