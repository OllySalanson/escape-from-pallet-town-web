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
import { DEFAULT_RAID_PROGRESS, type RaidProgress, type RestoredGame, type SaveGameState } from '../save/SaveManager';
import { Stash } from '../stash/Stash';
import { gateKey, gatesForMap } from '../world/gates';
import { encodeSurvey, type SurveyRecord } from '../world/survey';
import { getWorldMap, worldMapIds } from '../worldMap';
import { FIRST_WORDS_IDS } from '../hub/firstWords';
import { LEARNABLE_KEYS } from '../input/keyBindings';
import { addPlaytestKit, withEveryDerbyLevel, withEveryLeaderMet, withPlaytestTickets } from './playtestKit';
import { CHART_PIECES, CHEST_ITEM_ID, pieceForItem } from '../treasure/treasureMap';

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
    // Asked per map: `WORLD_GATES` does not list the doors of a map drawn as a file.
    openedGates: [...new Set(worldMapIds().flatMap((id) => gatesForMap(id)).map((gate) => gateKey(gate)))],
    battleLessonGiven: true,
    // Somebody exploring the maps is not a newcomer to the game: nobody speaks
    // first words on this save, and the HUDs teach no keys.
    firstWordsHeard: [...FIRST_WORDS_IDS],
    arenaIntroSeen: true,
    keysLearned: [...LEARNABLE_KEYS],
    // Bill deals with whoever has turned money over his counter, so an
    // explorer run arrives as a partner rather than a stranger with an empty
    // shelf - derived from his own top tier, so a retuned ladder moves with it.
    traderMoneySpent: POKEDOLLARS_PER_STANDING * (TRADER_STANDINGS.at(-1)?.points ?? 0),
    surveyed: everythingSurveyed(),
    gameCorner: withPlaytestTickets(DEFAULT_RAID_PROGRESS).gameCorner,
    gymsMet: withEveryLeaderMet(DEFAULT_RAID_PROGRESS).gymsMet,
    derbyCleared: withEveryDerbyLevel(DEFAULT_RAID_PROGRESS).derbyCleared,
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

/**
 * How many of a thing a new explorer run holds. Twenty of every supply, with
 * THE TREASURE MAP's two exceptions (`treasure/treasureMap.ts`): **one** of
 * each piece of the chart, so the board can be filled the night it is looked
 * at without twenty torn corners of one sheet in the vault, and **no** SEA
 * CHEST, because the chest is what the whole chart sends a raid to dig up -
 * dealt one, MARLOW opened it the moment the last piece went up and nobody
 * was ever sent anywhere (the owner's playtest of 12 Nov 2026). MARLOW's
 * board says the pieces are the kit's (`PLAYTEST_PIECES_LINE`).
 */
export function playtestStock(itemId: string): number {
  if (itemId === CURRENCY_ITEM_ID) {
    return MONEY_STOCK;
  }
  if (itemId === CHEST_ITEM_ID) {
    return 0;
  }
  return pieceForItem(itemId) ? 1 : SUPPLY_STOCK;
}

/**
 * An explorer run dealt the treasure map the old way - twenty of each piece
 * and twenty chests - brought to the rule above: a piece on the board is out
 * of the vault, a piece still to pin is one piece, and the chests the kit
 * dealt are taken back, so the whole chart sends the run to the X as it sends
 * anybody. A chest the run dug up itself is one more than the kit dealt, and
 * is kept. The one place a resumed run loses anything, and only what no raid
 * of its own found. Returns whether anything changed.
 */
export function withoutKitTreasure(stash: Stash, pinned: readonly string[]): boolean {
  let changed = false;
  for (const piece of CHART_PIECES) {
    const spare = stash.itemCount(piece.itemId) - (pinned.includes(piece.id) ? 0 : 1);
    if (spare > 0) {
      stash.removeItem(piece.itemId, spare);
      changed = true;
    }
  }
  const chests = stash.itemCount(CHEST_ITEM_ID);
  // Twenty were dealt, and MARLOW may have opened one of them already.
  if (chests >= SUPPLY_STOCK - 1) {
    stash.removeItem(CHEST_ITEM_ID, Math.min(chests, SUPPLY_STOCK));
    changed = true;
  }
  return changed;
}

export function createPlaytestStash(): Stash {
  const stash = new Stash();
  // The Charizard is the partner, so the explorer run has someone at its heel.
  stash.adoptPartner(stash.addPokemon(built(CHARIZARD, 99, CHARIZARD_MOVES)));
  for (const [base, level] of BENCH) {
    stash.addPokemon(built(base, level));
  }
  for (const item of ITEM_DEFINITIONS) {
    const stock = playtestStock(item.id);
    if (stock > 0) {
      stash.addItem(item.id, stock);
    }
  }
  // What every harbour game is played with (`playtestKit.ts`).
  addPlaytestKit(stash);
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

/**
 * A resumed explorer run brought up to date: every map current
 * (`withEverythingCurrent`), every row of the playtest kit it does not hold
 * yet, and the treasure map dealt as a new run's is (`withoutKitTreasure`). Returns the same object when there was nothing to add, so the caller
 * writes the save back only when it changed.
 */
export function withPlaytestCurrent(game: RestoredGame): RestoredGame {
  const progress = withEveryDerbyLevel(withEveryLeaderMet(withPlaytestTickets(withEverythingCurrent(game.raidProgress))));
  const kitAdded = addPlaytestKit(game.stash);
  const treasureTidied = withoutKitTreasure(game.stash, game.raidProgress.treasureHunt?.pinned ?? []);
  if (!kitAdded && !treasureTidied && progress === game.raidProgress) {
    return game;
  }
  return { ...game, raidProgress: progress };
}
