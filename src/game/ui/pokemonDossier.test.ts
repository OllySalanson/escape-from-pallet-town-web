import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { pokemonDossier } from './pokemonDossier';

const dossierOf = (pokemon: Pokemon) =>
  pokemonDossier({
    pokemon,
    id: 'member-0',
    first: true,
    holding: 'Holding nothing',
    deeds: { label: 'Gear', chips: () => '' },
  });

/** The pane's first block - name, level, health bar and condition - as words. */
const vitalsText = (html: string) =>
  (html.match(/<div class="px-dossier-vitals">(.*?)<\/div>/)?.[1] ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('the pane about one Pokemon', () => {
  it('says the level once, beside the name, and not again under the health bar', () => {
    const bulbasaur = new Pokemon(getSpeciesById('bulbasaur')!, 5);
    bulbasaur.currentHp = 9;
    const vitals = vitalsText(dossierOf(bulbasaur));
    expect(vitals).toContain('Bulbasaur Lv 5');
    expect(vitals).toContain(`9/${bulbasaur.maxHp} HP`);
    expect(vitals).not.toContain('Level 5');
  });

  it('still names a faint and a status under the health bar', () => {
    const bulbasaur = new Pokemon(getSpeciesById('bulbasaur')!, 5);
    bulbasaur.currentHp = 0;
    bulbasaur.primaryStatus = 'poison';
    expect(vitalsText(dossierOf(bulbasaur))).toContain(`0/${bulbasaur.maxHp} HP · fainted · poison`);
  });
});

describe('a shiny in the pane', () => {
  it('is drawn in its shiny colours with FireRed\'s star, and starred beside its name', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 5);
    pidgey.shiny = true;
    const html = dossierOf(pidgey);
    expect(html).toContain('assets/pokemon/shiny/front/16.png');
    expect(html).toContain('aria-label="Shiny Pidgey"');
    expect(html.match(/<div class="px-dossier-vitals">.*?<\/div>/)?.[0]).toContain('class="px-shiny"');
  });

  it('marks nothing on an ordinary Pokemon', () => {
    const html = dossierOf(new Pokemon(getSpeciesById('pidgey')!, 5));
    expect(html).toContain('assets/pokemon/front/16.png');
    expect(html).not.toContain('px-shiny');
  });
});

describe('the pane about a Pokemon with a nickname', () => {
  it('leads with the nickname and still says what species it is', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 9);
    pidgey.giveNickname('Sparky');
    const vitals = vitalsText(dossierOf(pidgey));
    expect(vitals).toContain('Sparky Lv 9 · Pidgey');
  });
});
