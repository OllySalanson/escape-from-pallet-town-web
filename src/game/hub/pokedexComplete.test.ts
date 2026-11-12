import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_SPECIES, getSpeciesById } from '../pokemon/species';
import { districtsForMap } from '../world/districts';
import { isMapOffered, retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { KANTO_POKEDEX_SIZE } from './pokedex';
import { sourceLines, sourcesOf, waysToOwn, type KindSource } from './pokedexSources';

/**
 * The endgame bug hunt (12 Nov 2026), finding 1: Oak promises his best reward
 * for all 151 kinds, and 14 of them could not be had anywhere, so a save topped
 * out at 137. This asks the game itself where every kind comes from - the
 * vale's grass and floors by day and by night, its fishing, the Pokémon standing
 * on it, its secrets, and everything at base that hands one over - and closes
 * that over evolution, so the next map change cannot quietly take a kind away.
 *
 * It asks what the shipped roster offers: the suite runs with nothing retired
 * (`world/mapRoster.testkit.ts`), so the real list is put back first.
 */
describe('the Pokédex, on the maps a player is offered', () => {
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));

  /**
   * Every kind a raid or the base can put in the vault, by the first way it
   * comes: `waysToOwn` (`pokedexSources.ts`), the same walk the Pokédex screen
   * prints its pages from, said here in a word or two. `withSecrets` false
   * leaves the vale's secrets out (`world/secrets.ts`), the Pokemon they stand
   * on the map among them: a secret is a second, rarer way to a kind, open only
   * under its condition, and never the reason a kind can be had.
   */
  const said = (source: KindSource): string => {
    switch (source.kind) {
      case 'wild':
        return `${source.mapId} ${source.when === 'night' ? 'night' : 'day'} wild`;
      case 'fishing':
        return `${source.mapId} fishing`;
      case 'standing':
        return `${source.mapId} standing`;
      case 'secret':
        return `secret ${source.secretId}`;
      case 'fossil':
        return `fossil ${source.itemId}`;
      case 'gift':
        return `gift ${source.giftId}`;
      case 'prize':
        return 'Game Corner prize';
      case 'errand':
        return `errand ${source.errandId}`;
      case 'starter':
        return 'starter';
      case 'dojo':
        return `dojo prize from ${source.master}`;
      case 'evolution':
        return `evolves from ${source.from}${source.trigger.kind === 'trade' ? ', traded and back' : ''}`;
      case 'trade':
        return `the TRADER's ${source.nickname}, for ${source.wants}`;
    }
  };
  const sources = (withSecrets = true): Map<string, string> => {
    expect(isMapOffered('greystone-vale')).toBe(true);
    return new Map([...waysToOwn(withSecrets)].map(([speciesId, source]) => [speciesId, said(source)]));
  };

  it('has a way to own every one of Kanto’s 151 kinds', () => {
    const from = sources();
    const missing = ALL_SPECIES.filter((species) => species.dexId <= KANTO_POKEDEX_SIZE && !from.has(species.id))
      .sort((a, b) => a.dexId - b.dexId)
      .map((species) => species.id);

    expect(missing).toEqual([]);
    // The sixteen the hunt found with no source, and where each comes from now -
    // asked with the secrets left out, because five of them are also a secret's
    // since (THE LOST PICNIC, THE STICKY TONGUE, THE SILENT PICKET, THE SHADOW
    // IN THE CRYPT, THE ELEVENTH STONE) and a way that is open one raid in several is not the way
    // a kind is promised by.
    const promised = sources(false);
    const once = ['ekans', 'arbok', 'growlithe', 'arcanine', 'abra', 'kadabra', 'alakazam', 'gengar', 'drowzee', 'hypno',
      'hitmonlee', 'hitmonchan', 'lickitung', 'mr-mime', 'ditto', 'aerodactyl'];
    expect(Object.fromEntries(once.map((id) => [id, promised.get(id)]))).toEqual({
      ekans: 'greystone-vale day wild',
      arbok: 'evolves from ekans',
      growlithe: 'greystone-vale day wild',
      arcanine: 'evolves from growlithe',
      abra: 'Game Corner prize',
      kadabra: 'evolves from abra',
      alakazam: 'evolves from kadabra, traded and back',
      gengar: 'evolves from haunter, traded and back',
      drowzee: 'greystone-vale day wild',
      hypno: 'evolves from drowzee',
      hitmonlee: 'dojo prize from HITOSHI',
      hitmonchan: 'dojo prize from AARON',
      lickitung: "the TRADER's MARC, for golduck",
      'mr-mime': "the TRADER's MIMIEN, for abra",
      ditto: 'greystone-vale day wild',
      aerodactyl: 'fossil old-amber',
    });
    expect([...from.keys()].filter((id) => (getSpeciesById(id)?.dexId ?? 0) <= KANTO_POKEDEX_SIZE)).toHaveLength(
      KANTO_POKEDEX_SIZE,
    );
    // What the third wave of secrets adds is a second way to four of them, each met and not handed over.
    expect(['hypno', 'lickitung', 'mr-mime', 'gengar'].map((id) => from.get(id))).toEqual([
      'secret the-lost-picnic',
      'secret the-sticky-tongue',
      'secret the-silent-picket',
      'secret the-shadow-in-the-crypt',
    ]);
    // And the fourth, to a fifth: the Alakazam among the Little Stones.
    expect(from.get('alakazam')).toBe('secret the-eleventh-stone');
  });
  /**
   * The Pokédex prints these (`ui/pokedexView.ts`): a page may only ever name a
   * place the game holds, so every line is asked of the same walk.
   */
  it('has somewhere to say every kind is found, and names only places the vale has', () => {
    const places = new Set(districtsForMap('greystone-vale').map((district) => district.name));
    for (const species of ALL_SPECIES.filter((each) => each.dexId <= KANTO_POKEDEX_SIZE)) {
      const sources = sourcesOf(species.id);
      expect(sourceLines(sources).length, species.id).toBeGreaterThan(0);
      for (const source of sources) {
        if (source.kind === 'wild' || source.kind === 'standing') {
          expect(places.has(source.place), `${species.id} in ${source.place}`).toBe(true);
        }
      }
    }
  });

  it('says where in the words a page prints: the commonest places first, the rest counted', () => {
    expect(sourceLines(sourcesOf('raichu'))).toEqual(['Evolves from PIKACHU with a Thunder Stone']);
    expect(sourceLines(sourcesOf('abra'))).toEqual(['A prize at THE GAME CORNER']);
    expect(sourceLines(sourcesOf('alakazam'))).toEqual(['One of the vale’s secrets', 'Evolves from KADABRA, traded to the TRADER and back']);
    expect(sourceLines(sourcesOf('machamp')).at(-1)).toBe('Evolves from MACHOKE, traded to the TRADER and back');
    expect(sourceLines(sourcesOf('hitmonlee'))).toEqual(['HITOSHI’s prize at THE BATTLE ARENA']);
    expect(sourceLines(sourcesOf('aerodactyl'))).toEqual(['Woken from an Old Amber on the FOSSIL MACHINE']);
    expect(sourceLines(sourcesOf('lickitung'))).toEqual(['One of the vale’s secrets', 'The TRADER gives one for a GOLDUCK']);
    expect(sourceLines(sourcesOf('mew'))).toEqual(['A legend, standing in THE CAIRN']);
    expect(sourceLines(sourcesOf('bulbasaur')).at(-1)).toBe('One of the three on Professor Oak’s table');
    expect(sourceLines(sourcesOf('magikarp')).at(-1)).toBe('Fished from rivers and ponds with any rod');
    // A kind in dozens of places names three and counts the rest.
    expect(sourceLines(sourcesOf('pidgey'))[0]).toMatch(/^Wild in [^,]+, [^,]+, .+ and \d+ more places$/);
    expect(sourceLines(sourcesOf('clefairy'))[0]).toMatch(/^Wild at night in /);
    expect(sourceLines(sourcesOf('ekans'))[0]).toMatch(/^Wild by day in /);
  });
});
