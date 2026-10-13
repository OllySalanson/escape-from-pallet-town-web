import { describe, expect, it } from 'vitest';
import { DeploymentFlow } from '../hub/deploymentFlow';
import { CHARMANDER, Pokemon } from '../pokemon';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { createStartingStash } from '../stash';
import { WORLD_ENTITIES } from './npcs';
import { WORLD_POIS } from './pois';
import { createRunTrainerEncounters } from './trainers';

/**
 * The game writes the name as FireRed does - Pokémon, Poké Ball, Poké Mart,
 * POKéMON LEAGUE - on every screen it draws: the Pokémon Center, the starter
 * picker, the battle's lists. A line spelled without its accent reads as a
 * second hand wrote it, and a dozen did: the drop-in screen's Viridian City
 * landings, a townsperson's directions, Camper Liam's challenge, the League
 * gate's signs, three caches' descriptions and the loadout's own refusals.
 */
const UNACCENTED = /\bPoke(?:mon|dex|dollars?| Balls?| Marts?)\b|\bPOKE(?:MON|DEX| BALLS?| MARTS?)\b/;

/** Every string an authored table holds, however deep, with where it was found. */
function textsIn(value: unknown, where: string, seen = new Set<unknown>()): Array<{ where: string; text: string }> {
  if (typeof value === 'string') {
    return [{ where, text: value }];
  }
  if (value === null || typeof value !== 'object' || seen.has(value) || value instanceof Pokemon) {
    return [];
  }
  seen.add(value);
  return Object.entries(value).flatMap(([key, inner]) => textsIn(inner, `${where}.${key}`, seen));
}

function misspelt(texts: ReadonlyArray<{ where: string; text: string }>): string[] {
  return texts.filter(({ text }) => UNACCENTED.test(text)).map(({ where, text }) => `${where}: ${text}`);
}

describe('the name is spelled with its accent wherever the game writes it', () => {
  it('in what townsfolk, signs and givers say', () => {
    expect(misspelt(textsIn(WORLD_ENTITIES, 'entities'))).toEqual([]);
  });

  it('in every landmark and cache', () => {
    expect(misspelt(textsIn(WORLD_POIS, 'pois'))).toEqual([]);
  });

  it('in what every trainer says', () => {
    expect(misspelt(textsIn(createRunTrainerEncounters(), 'trainers'))).toEqual([]);
  });

  it('in every drop-in the lobby describes', () => {
    expect(misspelt(textsIn(RUN_INSERTIONS, 'insertions'))).toEqual([]);
  });

  it("in the loadout's refusals", () => {
    const stash = createStartingStash();
    const empty = new DeploymentFlow(stash);
    const refusals = [empty.advance()];

    const fainted = createStartingStash();
    const partner = fainted.listPokemon()[0];
    partner.pokemon.currentHp = 0;
    const down = new DeploymentFlow(fainted);
    down.togglePokemon(partner.id);
    refusals.push(down.advance());

    const crowded = createStartingStash();
    const full = new DeploymentFlow(crowded);
    for (let index = 0; index < 7; index += 1) {
      crowded.addPokemon(new Pokemon(CHARMANDER, 5), `charmander-${index + 10}`);
    }
    refusals.push(
      ...crowded.listPokemon().map((stored) => full.togglePokemon(stored.id)),
    );

    const said = refusals.filter((line): line is string => typeof line === 'string');
    expect(said.length).toBeGreaterThanOrEqual(3);
    expect(misspelt(said.map((text) => ({ where: 'loadout', text })))).toEqual([]);
  });
});
