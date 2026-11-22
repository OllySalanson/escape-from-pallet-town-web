import { describe, expect, it } from 'vitest';
import greystoneVale from './greystoneVale.json';

/**
 * The vale's words are written in the district programs under
 * `tools/mapcraft/worlds/greystoneVale/` and shipped in this file, so it is
 * this file that is asked. BREAKER DUNN said "Put your Pokemon down there"
 * when everywhere else the game writes Pokémon (the overnight playtest of
 * 20 Nov 2026).
 */
describe("Greystone Vale's words", () => {
  it('never spells Pokémon without its accent', () => {
    const said = JSON.stringify(greystoneVale);
    expect(said.match(/[^"]*\bPokemon\b[^"]*/g) ?? []).toEqual([]);
  });
});
