import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { pokemonDossier } from './pokemonDossier';
import { detailStepIndex } from './spatialFocus';

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

describe('the Tab mark', () => {
  /**
   * Where Tab from the pane's own row lands (`detailStepIndex`), read off the
   * pane's markup as `MenuOverlay` reads it off the page: every button in it, in
   * document order, enabled unless `aria-disabled`. Answers with the label of
   * the block the control is in.
   */
  const tabLandsUnder = (html: string): string | undefined => {
    const blocks = [...html.matchAll(/<small class="px-label">([^<]*)<\/small>(.*?)(?=<small class="px-label">|$)/g)];
    const controls = blocks.flatMap(([, label, body]) =>
      [...body.matchAll(/<button\b([^>]*)>/g)].map(([, attributes]) => ({
        label: label.replace(/ · Tab$/, ''),
        actionable: !attributes.includes('aria-disabled="true"'),
      })),
    );
    const refs = [{ shows: 'member-0', actionable: true }, ...controls.map(({ actionable }) => ({ inPane: 'member-0', actionable }))];
    const target = detailStepIndex(refs, 0);
    return target === undefined || target === 0 ? undefined : controls[target - 1].label;
  };
  const markedLabels = (html: string) =>
    [...html.matchAll(/<small class="px-label">([^<]*)<\/small>/g)].map(([, label]) => label).filter((label) => label.endsWith(' · Tab'));
  const paneWith = (chips: string) =>
    pokemonDossier({
      pokemon: new Pokemon(getSpeciesById('charmander')!, 5),
      id: 'member-0',
      first: true,
      holding: 'Holding nothing',
      deeds: { label: 'Gear', chips: () => chips },
    });

  it('is on the deeds when there is one to do', () => {
    const html = paneWith('<button class="px-window px-chip" data-gear-give="leftovers">Give Leftovers</button>');
    expect(tabLandsUnder(html)).toBe('Gear');
    expect(markedLabels(html)).toEqual(['Gear · Tab']);
  });

  it('is on the moves when the deeds are only a note, because that is where Tab goes', () => {
    // The raid's party screen with no gear about: GEAR said Tab, and Tab
    // landed on SCRATCH.
    const html = paneWith('<span class="px-note">Nothing held, and no gear in the pack.</span>');
    expect(tabLandsUnder(html)).toMatch(/^Moves/);
    expect(markedLabels(html)).toEqual(['Moves · 2 of 4 known · Tab']);
  });

  it('is on the moves when every deed is one that would do nothing', () => {
    const html = paneWith('<button class="px-window px-chip" aria-disabled="true">Potion</button>');
    expect(tabLandsUnder(html)).toMatch(/^Moves/);
    expect(markedLabels(html)).toHaveLength(1);
    expect(markedLabels(html)[0]).toMatch(/^Moves/);
  });
});
