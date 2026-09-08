import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { conditionLine } from './condition';

const partySceneSource = await readFile(new URL('../scenes/PartyScene.ts', import.meta.url), 'utf8');
const hubSceneSource = await readFile(new URL('../scenes/HubScene.ts', import.meta.url), 'utf8');

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
    expect(conditionLine(pokemon())).toBe('Level 5 · 16/16 HP');
  });

  it('names a status, because a raid no longer washes one off', () => {
    expect(conditionLine(pokemon({ currentHp: 9, primaryStatus: 'poison' }))).toBe(
      'Level 5 · 9/16 HP · poison',
    );
  });

  it('leads with a faint, which the recovery bay - not a medicine - answers', () => {
    expect(conditionLine(pokemon({ currentHp: 0, isFainted: true, primaryStatus: 'burn' }))).toBe(
      'Level 5 · 0/16 HP · fainted · burn',
    );
  });

  it('is the same line at base and mid-raid', () => {
    // HP and status survive a raid, so the in-raid party screen is a preview of
    // what the stash will hold. Two phrasings of that would be two answers.
    expect(partySceneSource).toContain('conditionLine(pokemon)');
    expect(partySceneSource).toContain('conditionLine(selected)');
    expect(hubSceneSource).toContain('return conditionLine(stored.pokemon);');
  });
});
