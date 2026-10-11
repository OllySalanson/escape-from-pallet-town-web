import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../run/rng';
import { Pokemon } from './Pokemon';
import { pokemonSpritePath, pokemonTextureKey } from './pokemonSprites';
import { SHINY_ODDS, rollShiny, shinyTexturesFor } from './shiny';
import { BULBASAUR, CHARMANDER, PIDGEY, getSpeciesById } from './species';

describe('shiny Pokemon', () => {
  it('are one in five hundred: rare, and not FireRed\'s one in 8,192', () => {
    expect(SHINY_ODDS).toBe(500);
    expect(rollShiny({ next: () => 1 / 500 - 1e-9 })).toBe(true);
    expect(rollShiny({ next: () => 1 / 500 })).toBe(false);
  });

  it('come up about as often as the odds say over a long seeded run', () => {
    const rng = createSeededRng(20261011);
    let shiny = 0;
    const rolls = 500_000;
    for (let roll = 0; roll < rolls; roll += 1) {
      if (rollShiny(rng)) {
        shiny += 1;
      }
    }
    // A thousand expected; a few standard deviations either side.
    expect(shiny).toBeGreaterThan(900);
    expect(shiny).toBeLessThan(1100);
  });

  it('are never shiny unless something rolled it', () => {
    expect(new Pokemon(PIDGEY, 3).shiny).toBe(false);
  });

  it('keep their colours through an evolution', () => {
    const charmander = new Pokemon(CHARMANDER, 15);
    charmander.shiny = true;
    charmander.evolveInto(getSpeciesById('charmeleon')!);
    expect(charmander.base.id).toBe('charmeleon');
    expect(charmander.shiny).toBe(true);
  });

  it('are drawn from the shiny rip beside the ordinary one', () => {
    expect(pokemonSpritePath('front', 25)).toBe('assets/pokemon/front/25.png');
    expect(pokemonSpritePath('back', 25, true)).toBe('assets/pokemon/shiny/back/25.png');
    expect(pokemonTextureKey('front', 25)).toBe('pokemon-front-25');
    expect(pokemonTextureKey('front', 25, true)).toBe('pokemon-shiny-front-25');
  });

  it('fetch both sides of a shiny\'s whole line for a fight, and nothing for anyone else', () => {
    const shiny = new Pokemon(BULBASAUR, 5);
    shiny.shiny = true;
    const textures = shinyTexturesFor([shiny, new Pokemon(PIDGEY, 3)]);

    expect(textures.map(({ key }) => key).sort()).toEqual(
      [1, 2, 3].flatMap((dexId) => [`pokemon-shiny-back-${dexId}`, `pokemon-shiny-front-${dexId}`]).sort(),
    );
    expect(textures).toContainEqual({ key: 'pokemon-shiny-front-2', path: 'assets/pokemon/shiny/front/2.png' });
    expect(shinyTexturesFor([new Pokemon(PIDGEY, 3)])).toEqual([]);
  });
});
