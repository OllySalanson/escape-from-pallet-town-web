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
import { BLACK_BELTS } from '../arena/classes';
import { ERRANDS } from './errands';
import { FOSSIL_KINDS } from './fossils';
import { IN_GAME_TRADES, tradeEvolution } from './trades';
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
    // A fossil is laid by a secret, or by an errand that goes on laying its
    // thing once it is done (Bill's amber, `errands.ts`).
    const fossilsFound = new Set<string>([
      ...SECRETS.flatMap((secret) => secret.rewards.flatMap((reward) => (reward.kind === 'item' ? [reward.itemId] : []))),
      ...ERRANDS.filter((errand) => errand.afterwards && isMapOffered(errand.mapId)).map((errand) => errand.itemId),
    ]);
    for (const [itemId, speciesId] of Object.entries(FOSSIL_KINDS)) {
      if (fossilsFound.has(itemId)) add(speciesId, `fossil ${itemId}`);
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
    for (const head of BLACK_BELTS) {
      if (head.prize) add(head.prize, `dojo prize from ${head.name}`);
    }

    // Evolution - a level, a stone (Bill barters every stone, and Oak hands a
    // set out at 50 and 125 kinds) or the TRADER's trade and back - and his
    // trades, each for a kind already in reach, until nothing more is.
    for (let grew = true; grew; ) {
      grew = false;
      for (const rule of EVOLUTIONS) {
        const reached = rule.trigger.kind !== 'trade' || tradeEvolution(rule.from)?.id === rule.to;
        if (from.has(rule.from) && !from.has(rule.to) && reached) {
          add(rule.to, `evolves from ${rule.from}${rule.trigger.kind === 'trade' ? ', traded and back' : ''}`);
          grew = true;
        }
      }
      for (const trade of IN_GAME_TRADES) {
        if (from.has(trade.wants) && !from.has(trade.gives)) {
          add(trade.gives, `the TRADER's ${trade.nickname}, for ${trade.wants}`);
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
    // The sixteen the hunt found with no source, and where each comes from now.
    const once = ['ekans', 'arbok', 'growlithe', 'arcanine', 'abra', 'kadabra', 'alakazam', 'gengar', 'drowzee', 'hypno',
      'hitmonlee', 'hitmonchan', 'lickitung', 'mr-mime', 'ditto', 'aerodactyl'];
    expect(Object.fromEntries(once.map((id) => [id, from.get(id)]))).toEqual({
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
  });
});
