import { Bag } from '../items';
import { CURRENCY_ITEM_ID, ITEM_DEFINITIONS } from '../items/items';
import { POKEDOLLARS_PER_STANDING, TRADER_STANDINGS } from '../hub/trader';
import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import { Move, Pokemon, PokemonParty } from '../pokemon';
import {
  BLASTOISE,
  BUTTERFREE,
  CHARIZARD,
  PIDGEOT,
  RAICHU,
  VENUSAUR,
} from '../pokemon/species';
import type { PokemonBase } from '../pokemon/PokemonBase';
import { runInsertions } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, type RaidProgress, type SaveGameState } from '../save/SaveManager';
import { Stash } from '../stash/Stash';
import { gateKey, WORLD_GATES } from '../world/gates';
import { encodeSurvey, type SurveyRecord } from '../world/survey';
import { getWorldMap, worldMapIds } from '../worldMap';

/**
 * What an explorer run starts as. See `playtestMode.ts` for what the mode is
 * and why; this is only the one save it deals.
 *
 * Two things about it are deliberate rather than generous. **Every door is
 * open, and every keeper is still standing**: the doors are opened through
 * `openedGates` rather than by marking the bosses beaten, because a beaten boss
 * is taken off the map (`withoutDefeatedBosses`) and the point of the mode is
 * to be able to walk the ground *and* still fight what lives on it - Holt's
 * double battle included. A keeper standing at an open door is a trainer you
 * walk up to, which the map rules already guarantee is payable rather than a
 * wall. And **the whole survey is lit**, so the drop-in screen's picture of each
 * map shows the country rather than the dark, which is the thing being looked at.
 */

/** Enough of everything that nothing in the mode is rationed. */
const SUPPLY_STOCK = 20;
const MONEY_STOCK = 5_000;

/**
 * The partner. A level-99 Charizard built the way every other Pokemon in this
 * game is - stats from `computePokemonStats`, moves off its own FireRed
 * learnset - and given the four it would actually be carrying rather than the
 * last four it happens to reach: Heat Wave is in there because it is the one
 * spread move the line learns, so a double battle can be tested with it.
 */
const CHARIZARD_MOVES = ['Flamethrower', 'Wing Attack', 'Slash', 'Heat Wave'] as const;

/** The bench: one of every other type of thing to fight with, at a level that can. */
const BENCH: readonly (readonly [PokemonBase, number])[] = [
  [BLASTOISE, 50],
  [VENUSAUR, 50],
  [PIDGEOT, 50],
  [RAICHU, 50],
  [BUTTERFREE, 50],
];

/** A Pokemon at a level, carrying named moves from its own learnset. */
function built(base: PokemonBase, level: number, moveNames?: readonly string[]): Pokemon {
  const pokemon = new Pokemon(base, level);
  if (moveNames) {
    const chosen = moveNames
      .map((name) => base.learnset.find((entry) => entry.move.name === name)?.move)
      .filter((move): move is NonNullable<typeof move> => move !== undefined)
      .map((move) => new Move(move));
    if (chosen.length > 0) {
      pokemon.moves = chosen;
    }
  }
  return pokemon;
}

/** Every tile of every map, so no minimap opens dark on a mode built for looking. */
function everythingSurveyed(): SurveyRecord {
  const record: Record<string, ReturnType<typeof encodeSurvey>> = {};
  for (const map of worldMapIds().map((id) => getWorldMap(id))) {
    const tiles = new Set<number>();
    for (let index = 0; index < map.width * map.height; index += 1) {
      tiles.add(index);
    }
    record[map.id] = encodeSurvey(map.width, tiles);
  }
  return record;
}

export function playtestRaidProgress(): RaidProgress {
  return {
    ...DEFAULT_RAID_PROGRESS,
    firstContractExtracted: true,
    completedContracts: [FIRST_CONTRACT_ID],
    unlockedInsertions: runInsertions().map((insertion) => insertion.id),
    reachedInsertions: runInsertions().map((insertion) => insertion.id),
    // Doors, not wins: see the note at the top of this file.
    defeatedBosses: [],
    openedGates: [...new Set(WORLD_GATES.map((gate) => gateKey(gate)))],
    battleLessonGiven: true,
    // Bill deals with whoever has turned money over his counter, so an
    // explorer run arrives as a partner rather than a stranger with an empty
    // shelf - derived from his own top tier, so a retuned ladder moves with it.
    traderMoneySpent: POKEDOLLARS_PER_STANDING * (TRADER_STANDINGS.at(-1)?.points ?? 0),
    surveyed: everythingSurveyed(),
  };
}

/**
 * An explorer run kept from before the game had the maps it has now, brought
 * up to date: every landing there is now unlocked and every door open, and any
 * map it has never seen surveyed. A run is resumed for months while maps are
 * added - a new file map most of all - and a run that could not see them would
 * be the one place nobody can look at them. Nothing it already has is taken
 * away, so a resumed run keeps every step it walked. Returns the same object
 * when there was nothing to add.
 */
export function withEverythingCurrent(progress: RaidProgress): RaidProgress {
  const fresh = playtestRaidProgress();
  const union = (held: readonly string[], all: readonly string[]): readonly string[] => [
    ...held,
    ...all.filter((id) => !held.includes(id)),
  ];
  const unlockedInsertions = union(progress.unlockedInsertions, fresh.unlockedInsertions);
  const reachedInsertions = union(progress.reachedInsertions, fresh.reachedInsertions);
  const heldGates = progress.openedGates ?? [];
  const openedGates = union(heldGates, fresh.openedGates ?? []);
  const unsurveyed = Object.entries(fresh.surveyed ?? {}).filter(([mapId]) => !progress.surveyed?.[mapId]);
  const added =
    unlockedInsertions.length !== progress.unlockedInsertions.length ||
    reachedInsertions.length !== progress.reachedInsertions.length ||
    openedGates.length !== heldGates.length ||
    unsurveyed.length > 0;
  if (!added) {
    return progress;
  }
  return {
    ...progress,
    unlockedInsertions,
    reachedInsertions,
    openedGates,
    surveyed: { ...progress.surveyed, ...Object.fromEntries(unsurveyed) },
  };
}

export function createPlaytestStash(): Stash {
  const stash = new Stash();
  // The Charizard is the partner, so the explorer run has someone at its heel.
  stash.adoptPartner(stash.addPokemon(built(CHARIZARD, 99, CHARIZARD_MOVES)));
  for (const [base, level] of BENCH) {
    stash.addPokemon(built(base, level));
  }
  for (const item of ITEM_DEFINITIONS) {
    stash.addItem(item.id, item.id === CURRENCY_ITEM_ID ? MONEY_STOCK : SUPPLY_STOCK);
  }
  return stash;
}

/**
 * A whole fresh explorer run, ready to be written to the playtest slot. The
 * starter species is Charmander because the partner is its final stage: nothing
 * in a save names the original starter except this field, and a Charizard whose
 * line the swap and wipe rules did not recognise would be a stranger in its own
 * vault.
 */
export function createPlaytestGame(): SaveGameState {
  return {
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    items: [],
    bag: new Bag(),
    stash: createPlaytestStash(),
    starterSpeciesId: 'charmander',
    raidProgress: playtestRaidProgress(),
  };
}
