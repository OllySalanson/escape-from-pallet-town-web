import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_SPECIES, getSpeciesById } from '../pokemon/species';
import { EVOLUTIONS } from '../pokemon/evolution';
import { STARTER_SPECIES } from '../stash';
import { getWorldMap } from '../worldMap';
import { districtEncounterTables, encounterTableAt, stepRolls } from '../world/localEncounters';
import { fishingTable, fishingWaterAt, isFishingWater, ROD_ITEM_IDS } from '../world/fishing';
import { fileMap } from '../world/playerMaps';
import { SECRETS } from '../world/secrets';
import { POKEMON_GIFTS } from '../world/gifts';
import { isMapOffered, retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { TICKET_PRIZES } from '../minigames/tickets';
import { ERRANDS } from './errands';
import { FOSSIL_KINDS } from './fossils';
import { KANTO_POKEDEX_SIZE } from './pokedex';

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

  /** Every kind a raid or the base can put in the vault, by where it comes from. */
  const sources = (): Map<string, string> => {
    const from = new Map<string, string>();
    const add = (speciesId: string, where: string): void => {
      if (!from.has(speciesId)) from.set(speciesId, where);
    };
    for (const mapId of ['greystone-vale'] as const) {
      expect(isMapOffered(mapId)).toBe(true);
      const map = getWorldMap(mapId);
      const tables = [false, true].map((night) => districtEncounterTables(mapId, night));
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const tile = { x, y };
          if (stepRolls(map, tile)) {
            tables.forEach((own, night) => {
              for (const entry of encounterTableAt(mapId, tile, map.encounters, own)?.entries ?? []) {
                add(entry.speciesId, `${mapId} ${night ? 'night' : 'day'} wild`);
              }
            });
          }
          if (isFishingWater(map, tile)) {
            for (const rod of ROD_ITEM_IDS) {
              for (const entry of fishingTable(fishingWaterAt(mapId, tile), rod).entries) {
                add(entry.speciesId, `${mapId} fishing`);
              }
            }
          }
        }
      }
      for (const entity of fileMap(mapId)?.entities ?? []) {
        if (entity.pokemon && (entity.wildLevel !== undefined || entity.legendary)) {
          add(entity.pokemon, `${mapId} standing`);
        }
      }
    }
    for (const secret of SECRETS) {
      for (const reward of secret.rewards) {
        if (reward.kind === 'meet') add(reward.speciesId, `secret ${secret.id}`);
        if (reward.kind === 'gift') add(reward.gift.speciesId, `secret ${secret.id}`);
      }
    }
    const fossilsFound = new Set(
      SECRETS.flatMap((secret) => secret.rewards.flatMap((reward) => (reward.kind === 'item' ? [reward.itemId] : []))),
    );
    for (const [itemId, speciesId] of Object.entries(FOSSIL_KINDS)) {
      if (fossilsFound.has(itemId as never)) add(speciesId, `fossil ${itemId}`);
    }
    for (const gift of POKEMON_GIFTS.filter((each) => isMapOffered(each.mapId))) {
      add(gift.speciesId, `gift ${gift.id}`);
    }
    for (const prize of TICKET_PRIZES) {
      if (prize.gives.kind === 'pokemon') add(prize.gives.speciesId, `Game Corner prize`);
    }
    for (const errand of ERRANDS.filter((each) => isMapOffered(each.mapId))) {
      for (const pokemon of errand.reward.pokemon ?? []) add(pokemon.speciesId, `errand ${errand.id}`);
    }
    for (const starter of STARTER_SPECIES) add(starter.id, 'starter');

    // Evolution, as far as it can be reached here: a level, or a stone (Bill
    // barters every stone, and Oak hands a set out at 50 and 125 kinds).
    for (let grew = true; grew; ) {
      grew = false;
      for (const rule of EVOLUTIONS) {
        if (from.has(rule.from) && !from.has(rule.to) && rule.trigger.kind !== 'trade') {
          add(rule.to, `evolves from ${rule.from}`);
          grew = true;
        }
      }
    }
    return from;
  };

  it('has a way to own every one of Kanto’s 151 kinds', () => {
    const from = sources();
    const missing = ALL_SPECIES.filter((species) => species.dexId <= KANTO_POKEDEX_SIZE && !from.has(species.id))
      .sort((a, b) => a.dexId - b.dexId)
      .map((species) => species.id);

    expect(missing).toEqual([]);
    expect([...from.keys()].filter((id) => (getSpeciesById(id)?.dexId ?? 0) <= KANTO_POKEDEX_SIZE)).toHaveLength(
      KANTO_POKEDEX_SIZE,
    );
  });
});
