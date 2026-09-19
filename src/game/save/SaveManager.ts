import { getOutfitterUpgrade, takePayment, type PaymentCheck } from '../hub/outfitter';
import { clampPendingRecoveryMs, clampWardTreatmentsUsed } from '../hub/recovery';
import {
  contractUnlockedInsertionIds,
  FIRST_CONTRACT_ID,
  getContract,
  secureItemStackLimit,
  securePokemonLimit,
  type RaidContract,
} from '../objectives/contracts';
import {
  isStandingBoardOpen,
  isStandingContractId,
  rewardPokemon,
  standingRoundOf,
} from '../objectives/standingBoard';
import {
  Move,
  Pokemon,
  PokemonParty,
  evolutionFamily,
  experienceForLevel,
  getSpeciesById,
  type MoveBase,
} from '../pokemon';
import { Bag, type BagContents } from '../items/Bag';
import type { PrimaryStatus } from '../pokemon/battle/status';
import type { GridPosition } from '../movement/gridMovement';
import {
  getStarterSpecies,
  Stash,
  type RaidCondition,
  type RaidSettlement,
  type RunResult,
  type SecureSlot,
  type StarterSpeciesId,
} from '../stash/Stash';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';

export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const SAVE_VERSION = 5;
const PRIMARY_STATUSES = new Set<PrimaryStatus>([
  'poison',
  'burn',
  'paralysis',
  'sleep',
  'freeze',
]);

export interface SavedPokemon {
  readonly speciesId: string;
  readonly level: number;
  readonly currentHp: number;
  readonly xp: number;
  readonly moves: readonly string[];
  readonly primaryStatus: PrimaryStatus | null;
}

export interface SavedStashedPokemon {
  readonly id: string;
  readonly pokemon: SavedPokemon;
}

export interface SavedStash {
  readonly pokemon: readonly SavedStashedPokemon[];
  readonly items: BagContents;
}

export interface RaidProgress {
  readonly firstContractExtracted: boolean;
  readonly unlockedInsertions: readonly string[];
  /**
   * Every contract banked for good, by id. It is the whole record of contract
   * progression: which contracts the board still offers, how many stacks the
   * secure slot protects and what base restocks are all derived from it, so
   * nothing can disagree with it.
   */
  readonly completedContracts: readonly string[];
  /**
   * Every boss beaten, by `bossId`, for good. Which gates stand open and which
   * bosses are still on the map are both derived from this list - see
   * `getWorldMap()` and `withoutDefeatedBosses()` - so a door can never be
   * recorded open while the boss who holds it is still standing in front of it.
   */
  readonly defeatedBosses: readonly string[];
  /**
   * Every insertion the player has stood on in any raid. Reaching a drop-in
   * point is what makes it selectable at base; `availableInsertionIds()` adds
   * these to the insertions contracts have unlocked.
   */
  readonly reachedInsertions: readonly string[];
  /**
   * Every Outfitter upgrade built at base, by id. Like `completedContracts` it
   * is the whole record: every effect an upgrade has is derived from this list
   * by the system that owns it, so no effect is ever stored beside it. Saves
   * written before the Outfitter simply have none built.
   */
  readonly outfitterUpgrades: readonly string[];
  /**
   * Set once the authored opening fight has explained the battle screen. The
   * fight itself repeats for as long as the first contract is open, because a
   * raid carrying that contract still needs an opening it can win; the three
   * lines that teach the screen are said once per save. Absent on every save
   * written before it existed, which reads as "not yet" and costs such a player
   * one more hearing at worst.
   */
  readonly battleLessonGiven?: boolean;
  /**
   * How many standing contracts have been banked. It is the only thing the save
   * keeps about the standing board: which contracts are on offer, how much
   * hunter they add and what they pay are all derived from it - see
   * `../objectives/standingBoard` - so a generated contract is never stored.
   */
  readonly standingContractsBanked: number;
}

/**
 * Floodplain Relay is the area every save starts with: it is where the first
 * contract lives. Every other insertion is the first contract's reward.
 */
/**
 * Extracting the first contract opens every other level at once. They are three
 * different maps rather than three doors into one, which is the whole point of
 * the unlock.
 */
export const CONTRACT_REWARD_INSERTIONS: readonly string[] =
  contractUnlockedInsertionIds([FIRST_CONTRACT_ID]);

/**
 * `south-verge` was a second insertion on the Pallet Town map whose entire
 * route was contained in the Town Square route - the same level under two
 * names. It is gone; saves that unlocked it keep Town Square instead.
 */
const RETIRED_INSERTIONS: Readonly<Record<string, string>> = { 'south-verge': 'town-square' };

/**
 * The last save version that could be written by the free-roam game, where the
 * player's team lived in `party` and their supplies in `bag`. The extraction
 * game reads neither - the vault is the team, and a raid party is a selection
 * out of it - so a save at or below this version whose vault is empty is
 * holding everything the player owns in fields nothing will ever look at again.
 *
 * Version 1 always looks like that: its `WorldScene.saveGame()` wrote party,
 * position and bag and nothing else. Versions 2 and 3 can, because the vault
 * arrived before free roam left and that same save call kept overwriting the
 * vault with an empty one until it learned to carry it through.
 */
const LAST_FREE_ROAM_SAVE_VERSION = 3;

export const DEFAULT_RAID_PROGRESS: RaidProgress = {
  firstContractExtracted: false,
  unlockedInsertions: ['floodplain-relay'],
  completedContracts: [],
  defeatedBosses: [],
  reachedInsertions: [],
  outfitterUpgrades: [],
  standingContractsBanked: 0,
};

export interface SaveData {
  readonly version: typeof SAVE_VERSION;
  readonly party: readonly SavedPokemon[];
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly bag: BagContents;
  readonly stash: SavedStash;
  readonly raidProgress: RaidProgress;
  readonly starterSpeciesId: StarterSpeciesId | null;
  /**
   * Raid time owed for recovery already carried out at base, subtracted from
   * the next raid's clock. Saves written before recovery existed simply have no
   * debt, so they keep loading unchanged and need no version bump.
   */
  readonly pendingRecoveryMs: number;
  /**
   * Quarantine ward beds already used before the coming raid. It is cleared
   * with `pendingRecoveryMs`, when that raid resolves, for the same reason: a
   * page reload must not hand the bed back. Absent on older saves, which have
   * used none.
   */
  readonly wardTreatmentsUsed: number;
}

export interface RestoredGame {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly bag: Bag;
  readonly stash: Stash;
  readonly raidProgress: RaidProgress;
  readonly starterSpeciesId: StarterSpeciesId | null;
  readonly pendingRecoveryMs: number;
  readonly wardTreatmentsUsed: number;
}

export interface SaveGameState {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items?: readonly string[];
  readonly bag?: Bag;
  readonly stash?: Stash;
  readonly raidProgress?: RaidProgress;
  readonly starterSpeciesId?: StarterSpeciesId | null;
  readonly pendingRecoveryMs?: number;
  readonly wardTreatmentsUsed?: number;
}

/** What every raid ending clears: the recovery a resolved raid has now paid for. */
const RAID_RESOLVED = { pendingRecoveryMs: 0, wardTreatmentsUsed: 0 } as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveManager {
  private readonly storage: StorageLike | null;

  public constructor(storage: StorageLike | null = getBrowserStorage()) {
    this.storage = storage;
  }

  public hasSave(): boolean {
    return this.load() !== null;
  }

  public save(state: SaveGameState): boolean {
    if (!this.storage) {
      return false;
    }

    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
      return true;
    } catch {
      return false;
    }
  }

  public load(): RestoredGame | null {
    if (!this.storage) {
      return null;
    }

    try {
      const rawSave = this.storage.getItem(SAVE_KEY);
      if (!rawSave) {
        return null;
      }

      return deserializeGame(JSON.parse(rawSave));
    } catch {
      return null;
    }
  }

  public clear(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // Browser storage can be unavailable or full. A failed clear must not break play.
    }
  }

  /**
   * Adds successful extraction rewards to the persisted vault. The active save
   * must exist because its world state is retained while only the stash changes.
   *
   * The settlement is what the raid itself cost - the condition every deployed
   * Pokemon came home in, and the supplies that did not come home. It is applied
   * before the rewards so a raid is never free, and it is optional only so that
   * callers with nothing to settle (tests, and any future reward-only banking)
   * stay honest rather than passing an invented one.
   */
  public bankRun(result: RunResult, settlement?: RaidSettlement): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    applySettlement(game.stash, settlement);
    game.stash.bankRun(result);
    // The raid this debt paid for has now resolved, so it is settled. Charging
    // on resolution rather than on deployment is what stops a player healing,
    // deploying into the shortened raid and reloading the page to shed the bill.
    return this.save({ ...game, ...RAID_RESOLVED });
  }

  /**
   * Banks a raid that completed a contract, and applies that contract's
   * permanent reward exactly once. The persisted `completedContracts` list makes
   * repeated extraction handling idempotent, and it is the same path for every
   * contract: the first one is not a special case, it is just the one whose
   * reward happens to be insertions.
   *
   * An authored contract is named by id and looked up here. A standing contract
   * is handed over whole, because it was generated for the raid that carried it
   * and that raid may have changed the progress it was generated from; what
   * makes it pay once is the round in its id, which has to be the save's own.
   */
  public bankContract(
    carried: string | RaidContract,
    result: RunResult,
    settlement?: RaidSettlement,
  ): { readonly saved: boolean; readonly granted: boolean } {
    const game = this.load();
    if (!game) {
      return { saved: false, granted: false };
    }

    applySettlement(game.stash, settlement);
    game.stash.bankRun(result);
    const contractId = typeof carried === 'string' ? carried : carried.id;
    if (typeof carried !== 'string' && isStandingContractId(contractId)) {
      if (
        !isStandingBoardOpen(game.raidProgress.completedContracts) ||
        standingRoundOf(contractId) !== game.raidProgress.standingContractsBanked
      ) {
        return { saved: this.save({ ...game, ...RAID_RESOLVED }), granted: false };
      }
      for (const { itemId, quantity } of carried.reward.items) {
        game.stash.addItem(itemId, quantity);
      }
      for (const pokemon of rewardPokemon(carried.reward)) {
        game.stash.addPokemon(pokemon);
      }
      const raidProgress: RaidProgress = {
        ...game.raidProgress,
        standingContractsBanked: game.raidProgress.standingContractsBanked + 1,
      };
      return { saved: this.save({ ...game, raidProgress, ...RAID_RESOLVED }), granted: true };
    }

    const contract = getContract(contractId);
    if (!contract || game.raidProgress.completedContracts.includes(contractId)) {
      return { saved: this.save({ ...game, ...RAID_RESOLVED }), granted: false };
    }

    const completedContracts = [...game.raidProgress.completedContracts, contractId];
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      firstContractExtracted:
        game.raidProgress.firstContractExtracted || contractId === FIRST_CONTRACT_ID,
      unlockedInsertions: [
        ...new Set([
          ...game.raidProgress.unlockedInsertions,
          ...(contract.reward.unlockedInsertionIds ?? []),
        ]),
      ],
      completedContracts,
    };
    for (const { itemId, quantity } of contract.reward.items) {
      game.stash.addItem(itemId, quantity);
    }
    return {
      saved: this.save({ ...game, raidProgress, ...RAID_RESOLVED }),
      granted: true,
    };
  }

  /**
   * Whether the opening fight still owes this save its lesson, recording that
   * it has now been given. Asked at the moment the fight is handed to the
   * battle screen, so a raid lost inside that very fight does not buy the
   * lecture a second time. With no save to remember it in, the lesson is given.
   */
  public claimBattleLesson(): boolean {
    const game = this.load();
    if (!game) {
      return true;
    }
    if (game.raidProgress.battleLessonGiven === true) {
      return false;
    }
    this.save({ ...game, raidProgress: { ...game.raidProgress, battleLessonGiven: true } });
    return true;
  }

  /** The first contract's banking path, named for the one raid that uses it. */
  public bankFirstContractRun(
    result: RunResult,
    settlement?: RaidSettlement,
  ): { readonly saved: boolean; readonly granted: boolean } {
    return this.bankContract(FIRST_CONTRACT_ID, result, settlement);
  }

  /**
   * Records bosses beaten in the raid in progress, and reports which of them
   * were new. It is written at the moment of the win rather than at extraction:
   * a gate is the map changing, not loot being carried out, so a raid that beats
   * the boss and is then lost to the hunter has still opened the door. Nothing
   * but `raidProgress` is touched - the vault in storage is the pre-raid vault
   * and has to stay that way until the raid settles.
   */
  public recordDefeatedBosses(bossIds: readonly string[]): readonly string[] {
    const game = this.load();
    if (!game) {
      return [];
    }
    const fresh = [...new Set(bossIds)].filter(
      (bossId) => !game.raidProgress.defeatedBosses.includes(bossId),
    );
    if (fresh.length === 0) {
      return [];
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      defeatedBosses: [...game.raidProgress.defeatedBosses, ...fresh],
    };
    return this.save({ ...game, raidProgress }) ? fresh : [];
  }

  /**
   * Records an insertion the player has just stood on, and reports whether that
   * made it newly selectable - false for one a contract had already unlocked,
   * so the map only ever announces a drop-in the lobby did not already offer.
   */
  public recordReachedInsertion(insertionId: string): boolean {
    const game = this.load();
    if (
      !game ||
      game.raidProgress.reachedInsertions.includes(insertionId) ||
      game.raidProgress.unlockedInsertions.includes(insertionId)
    ) {
      return false;
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      reachedInsertions: [...game.raidProgress.reachedInsertions, insertionId],
    };
    return this.save({ ...game, raidProgress });
  }

  /**
   * Trades the player's sole remaining Pokemon for a fresh level-5 starter and
   * records the new species, so later wipe re-grants restore what the player
   * has just chosen rather than the species they picked on their first run.
   *
   * @returns Whether the swap was applied and persisted.
   */
  public reselectStarter(starterId: StarterSpeciesId): boolean {
    const game = this.load();
    if (
      !game ||
      !game.stash.swapStarter(getStarterSpecies(starterId))
    ) {
      return false;
    }

    return this.save({ ...game, starterSpeciesId: starterId });
  }

  /**
   * Builds one Outfitter upgrade, paying for it with exactly the Pokemon the
   * player named and the supplies it lists. This is the only path that spends:
   * it reloads the vault, so the payment is checked against what is really
   * banked rather than against whatever a screen was showing, and it records
   * the upgrade in the same write that removes the payment, so a save can never
   * hold one without the other.
   *
   * An upgrade already built is refused rather than charged again, which makes
   * a repeated click a no-op instead of a second payment.
   */
  public buildOutfitterUpgrade(
    upgradeId: string,
    pokemonIds: readonly string[],
  ): PaymentCheck & { readonly saved: boolean } {
    const game = this.load();
    if (!game) {
      return {
        ok: false,
        refusal: 'unknown-upgrade',
        message: 'There is no saved game to build on.',
        saved: false,
      };
    }

    const payment = takePayment(
      {
        stash: game.stash,
        starterSpeciesId: game.starterSpeciesId,
      },
      game.raidProgress.outfitterUpgrades,
      upgradeId,
      pokemonIds,
    );
    if (!payment.ok) {
      return { ...payment, saved: false };
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      outfitterUpgrades: [...game.raidProgress.outfitterUpgrades, payment.upgrade.id],
    };
    return { ...payment, saved: this.save({ ...game, raidProgress }) };
  }

  /**
   * Persists a wipe after permanently deleting deployed assets outside the
   * secure slot. How much the slot protects is read from the save itself - the
   * contracts banked and the upgrades built - so no caller can under-report it.
   *
   * Only the condition half of a settlement applies here: a secured Pokemon
   * comes home in the state the raid left it in, usually fainted, while every
   * other deployed Pokemon and the whole deployed supply are removed outright,
   * so a supply delta would only take the same items away twice.
   */
  public applyWipeLoss(
    broughtPokemonIds: readonly string[],
    broughtItems: readonly { readonly itemId: string; readonly quantity: number }[],
    secureSlot: SecureSlot = {},
    condition: readonly RaidCondition[] = [],
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    game.stash.applyRaidCondition(condition);
    game.stash.applyWipeLoss(broughtPokemonIds, broughtItems, secureSlot, {
      pokemon: securePokemonLimit(game.raidProgress.outfitterUpgrades),
      itemStacks: secureItemStackLimit(
        game.raidProgress.completedContracts,
        game.raidProgress.outfitterUpgrades,
      ),
    });
    // A wipe must never hand the player back a run they cannot attempt: a fresh
    // starter when none survived, and whatever the kit is short of either way,
    // including when the secure slot saved a Pokemon but no items. It is the
    // last resort and adds nothing to a vault that can already field a raid.
    game.stash.ensurePlayable(
      game.starterSpeciesId ? getStarterSpecies(game.starterSpeciesId) : undefined,
    );
    game.stash.restockMinimumSupplies();
    return this.save({ ...game, ...RAID_RESOLVED });
  }
}

/** Settles the raid's own cost before anything it earned is added. */
function applySettlement(stash: Stash, settlement: RaidSettlement | undefined): void {
  if (!settlement) {
    return;
  }
  stash.applyRaidCondition(settlement.condition);
  stash.applyRaidSupplies(settlement.supplies);
}

export function serializeGame(state: SaveGameState): SaveData {
  return {
    version: SAVE_VERSION,
    party: state.party.pokemon.map(serializePokemon),
    mapId: state.mapId,
    position: { ...state.position },
    items: [...(state.items ?? [])],
    bag: state.bag?.toJSON() ?? {},
    stash: serializeStash(state.stash ?? new Stash()),
    raidProgress: state.raidProgress ?? DEFAULT_RAID_PROGRESS,
    starterSpeciesId: state.starterSpeciesId ?? inferStarterSpeciesId(state.stash),
    pendingRecoveryMs: clampPendingRecoveryMs(state.pendingRecoveryMs),
    wardTreatmentsUsed: clampWardTreatmentsUsed(state.wardTreatmentsUsed),
  };
}

export function deserializeGame(value: unknown): RestoredGame | null {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    ![1, 2, 3, 4, SAVE_VERSION].includes(value.version)
  ) {
    return null;
  }

  const mapId = value.mapId;
  const position = value.position;
  const party = value.party;
  if (
    !isWorldMapId(mapId) ||
    !isGridPosition(position) ||
    position.x >= WORLD_MAPS[mapId].width ||
    position.y >= WORLD_MAPS[mapId].height ||
    !Array.isArray(party)
  ) {
    return null;
  }

  const pokemon: Pokemon[] = [];
  for (const savedPokemon of party) {
    const restoredPokemon = deserializePokemon(savedPokemon, value.version);
    if (!restoredPokemon) {
      return null;
    }
    pokemon.push(restoredPokemon);
  }

  const stash = deserializeStash(value.stash, value.version);
  const carriedIntoVault = moveFreeRoamHoldingsIntoVault(
    value.version,
    pokemon,
    // Both halves, added rather than one shadowing the other: the earliest
    // saves carried picked-up items as a list of ids and the Bag replaced it,
    // so a save from the changeover can hold supplies in either field.
    addBagContents(bagContents(value.bag), stringArrayToBagContents(value.items)),
    stash,
  );
  return {
    party: new PokemonParty(carriedIntoVault ? [] : pokemon),
    mapId,
    position: { ...position },
    items: carriedIntoVault ? [] : stringArray(value.items),
    bag: new Bag(carriedIntoVault ? {} : bagContents(value.bag)),
    stash,
    raidProgress: deserializeRaidProgress(value.raidProgress),
    starterSpeciesId: deserializeStarterSpeciesId(value.starterSpeciesId) ?? inferStarterSpeciesId(stash),
    pendingRecoveryMs: clampPendingRecoveryMs(value.pendingRecoveryMs),
    wardTreatmentsUsed: clampWardTreatmentsUsed(value.wardTreatmentsUsed),
  };
}

/**
 * Moves a free-roam save's team and supplies into the vault, and reports
 * whether it did.
 *
 * Without this the loader accepted such a save and handed back a hub with an
 * empty vault: `Stash.ensurePlayable()` filled it with a fresh level-5 starter
 * and `TitleScene` wrote that back over the file at the current version. A
 * levelled team was destroyed, and the loader said yes throughout. Refusing to
 * load would have been better than that; migrating is better still, because the
 * team is right there in the save - only in the wrong field.
 *
 * The move is gated on the vault being entirely empty, which is the signature
 * of a free-roam save and of nothing else. A legacy save whose vault holds
 * anything is a save the vault-era game wrote, and its party is a raid
 * selection taken out of that vault, so merging it would bank the same Pokemon
 * twice. Everything migrated is moved rather than copied, for the same reason.
 */
function moveFreeRoamHoldingsIntoVault(
  saveVersion: number,
  party: readonly Pokemon[],
  supplies: BagContents,
  stash: Stash,
): boolean {
  if (
    saveVersion > LAST_FREE_ROAM_SAVE_VERSION ||
    stash.listPokemon().length > 0 ||
    Object.keys(stash.listItems()).length > 0 ||
    (party.length === 0 && Object.keys(supplies).length === 0)
  ) {
    return false;
  }

  for (const pokemon of party) {
    stash.addPokemon(pokemon);
  }
  for (const [itemId, quantity] of Object.entries(supplies)) {
    stash.addItem(itemId, quantity);
  }
  return true;
}

function deserializeRaidProgress(value: unknown): RaidProgress {
  if (!isRecord(value)) {
    return DEFAULT_RAID_PROGRESS;
  }

  const unlockedInsertions = (
    Array.isArray(value.unlockedInsertions)
      ? value.unlockedInsertions.filter((insertion): insertion is string => typeof insertion === 'string')
      : DEFAULT_RAID_PROGRESS.unlockedInsertions
  ).map((insertion) => RETIRED_INSERTIONS[insertion] ?? insertion);
  const savedContracts = Array.isArray(value.completedContracts)
    ? value.completedContracts.filter((id): id is string => typeof id === 'string')
    : [];
  // A save written before contracts were a list still records the first one as
  // a flag, so a player who banked it keeps its reward and is offered the next
  // contract rather than being asked to recover the field kit twice.
  const firstContractExtracted =
    value.firstContractExtracted === true || savedContracts.includes(FIRST_CONTRACT_ID);
  const completedContracts = [
    ...new Set([...(firstContractExtracted ? [FIRST_CONTRACT_ID] : []), ...savedContracts]),
  ];
  // Only upgrades the ladder still knows are kept, once each: an id nothing
  // derives an effect from is not an upgrade, and a duplicate must not be able
  // to count a locker twice.
  const outfitterUpgrades = [
    ...new Set(
      (Array.isArray(value.outfitterUpgrades) ? value.outfitterUpgrades : []).filter(
        (id): id is string => typeof id === 'string' && getOutfitterUpgrade(id) !== undefined,
      ),
    ),
  ];
  return {
    firstContractExtracted,
    completedContracts,
    // Saves written before gates and drop-in points existed have beaten no boss
    // and reached nowhere, which is exactly what a missing list reads as.
    defeatedBosses: uniqueStrings(value.defeatedBosses),
    reachedInsertions: uniqueStrings(value.reachedInsertions),
    outfitterUpgrades,
    ...(value.battleLessonGiven === true ? { battleLessonGiven: true } : {}),
    // A save written before the standing board has banked none of it.
    standingContractsBanked:
      typeof value.standingContractsBanked === 'number' &&
      Number.isSafeInteger(value.standingContractsBanked) &&
      value.standingContractsBanked > 0
        ? value.standingContractsBanked
        : 0,
    // The starting area is never lost, so a save written before Floodplain Relay
    // became the first raid still opens on an insertion the player can use, and
    // a save that already banked the contract gets every level the contract now
    // pays out rather than only the ones that existed when it was written.
    unlockedInsertions: [
      ...new Set([
        'floodplain-relay',
        ...unlockedInsertions,
        ...(firstContractExtracted ? CONTRACT_REWARD_INSERTIONS : []),
      ]),
    ],
  };
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))]
    : [];
}

function serializePokemon(pokemon: Pokemon): SavedPokemon {
  return {
    speciesId: pokemon.base.id,
    level: pokemon.level,
    currentHp: pokemon.currentHp,
    xp: getPokemonXp(pokemon),
    moves: pokemon.moves.map((move) => move.base.name),
    primaryStatus: pokemon.primaryStatus,
  };
}

function deserializePokemon(value: unknown, saveVersion = SAVE_VERSION): Pokemon | null {
  if (!isRecord(value) || typeof value.speciesId !== 'string' || !isPositiveInteger(value.level)) {
    return null;
  }

  const species = getSpeciesById(value.speciesId);
  if (!species) {
    return null;
  }

  const pokemon = new Pokemon(species, value.level);
  pokemon.currentHp = clampInteger(value.currentHp, 0, pokemon.maxHp, pokemon.maxHp);
  pokemon.primaryStatus = isPrimaryStatus(value.primaryStatus) ? value.primaryStatus : null;

  if (Array.isArray(value.moves)) {
    // The whole line, not this species alone. An Ivysaur that evolved out of
    // this game's Bulbasaur still knows the Super Sonic only Bulbasaur teaches,
    // and a lookup confined to Ivysaur's own learnset would have deleted it on
    // the next load without saying so. Widening it to the line rather than to
    // every move in the game is what stops a corrupt save handing a Pidgey a
    // Hydro Pump.
    const movesByName = new Map(
      evolutionFamily(species.id).flatMap((member) =>
        member.learnset.map((entry) => [entry.move.name, entry.move] as const),
      ),
    );
    const savedMoves = value.moves
      .filter((move): move is string => typeof move === 'string')
      .map((name) => movesByName.get(name))
      .filter((move): move is NonNullable<typeof move> => move !== undefined)
      .slice(0, 4);
    reconcileLegacyBulbasaurMoves(species.id, savedMoves, saveVersion);
    if (savedMoves.length > 0) {
      pokemon.moves.splice(0, pokemon.moves.length, ...savedMoves.map((move) => new Move(move)));
    }
  }

  // Experience is floored at the level's own total rather than at zero. A save
  // written before XP was recorded has a level and no XP, and reading that as
  // "level 5 with 0 XP" would make the next level cost the whole curve from
  // scratch - so a returning player would be charged twice for progress they
  // had already made.
  setPokemonXp(
    pokemon,
    Math.max(
      experienceForLevel(pokemon.level),
      clampInteger(value.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    ),
  );
  return pokemon;
}

function serializeStash(stash: Stash): SavedStash {
  return {
    pokemon: stash.listPokemon().map(({ id, pokemon }) => ({ id, pokemon: serializePokemon(pokemon) })),
    items: stash.listItems(),
  };
}

function deserializeStash(value: unknown, saveVersion: number): Stash {
  if (!isRecord(value)) {
    return new Stash();
  }

  if (saveVersion === 1) {
    const pokemon = Array.isArray(value.pokemon)
      ? value.pokemon
          .map((entry, index) => {
            const restored = deserializePokemon(entry, saveVersion);
            return restored ? { id: `legacy-${index + 1}`, pokemon: restored } : null;
          })
          .filter((entry): entry is { id: string; pokemon: Pokemon } => entry !== null)
      : [];
    return new Stash({ pokemon, items: stringArrayToBagContents(value.items) });
  }

  const pokemon = Array.isArray(value.pokemon)
    ? value.pokemon
        .map((entry) => deserializeStashedPokemon(entry, saveVersion))
        .filter((entry): entry is { id: string; pokemon: Pokemon } => entry !== null)
    : [];
  return new Stash({ pokemon, items: bagContents(value.items) });
}

function deserializeStashedPokemon(
  value: unknown,
  saveVersion: number,
): { id: string; pokemon: Pokemon } | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  const pokemon = deserializePokemon(value.pokemon, saveVersion);
  return pokemon ? { id: value.id, pokemon } : null;
}

/**
 * Version 4 and earlier could persist Bulbasaur without its required level-1
 * Tackle. Add only that omitted move, leaving all legitimate saved moves and
 * any full custom moveset untouched.
 */
function reconcileLegacyBulbasaurMoves(
  speciesId: string,
  moves: MoveBase[],
  saveVersion: number,
): void {
  if (saveVersion >= SAVE_VERSION || speciesId !== 'bulbasaur' || moves.length >= 4) {
    return;
  }

  const tackle = getSpeciesById('bulbasaur')?.learnset.find(
    ({ level, move }) => level === 1 && move.name === 'Tackle',
  )?.move;
  if (tackle && !moves.some((move) => move.name === tackle.name)) {
    moves.unshift(tackle);
  }
}

function deserializeStarterSpeciesId(value: unknown): StarterSpeciesId | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' && isStarterSpeciesId(value) ? value : null;
}

function inferStarterSpeciesId(stash: Stash | undefined): StarterSpeciesId | null {
  const speciesId = stash?.listPokemon().find(({ pokemon }) => isStarterSpeciesId(pokemon.base.id))?.pokemon.base.id;
  return speciesId && isStarterSpeciesId(speciesId) ? speciesId : null;
}

function isStarterSpeciesId(value: string): value is StarterSpeciesId {
  return value === 'bulbasaur' || value === 'charmander' || value === 'squirtle';
}

function getPokemonXp(pokemon: Pokemon): number {
  const value = pokemon.experience;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function setPokemonXp(pokemon: Pokemon, xp: number): void {
  pokemon.experience = xp;
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorldMapId(value: unknown): value is WorldMapId {
  return typeof value === 'string' && value in WORLD_MAPS;
}

function isGridPosition(value: unknown): value is GridPosition {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.x) &&
    isNonNegativeInteger(value.y)
  );
}

function isPrimaryStatus(value: unknown): value is PrimaryStatus | null {
  return value === null || (typeof value === 'string' && PRIMARY_STATUSES.has(value as PrimaryStatus));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function bagContents(value: unknown): BagContents {
  if (!isRecord(value)) {
    return {};
  }

  const contents: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(value)) {
    if (typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0) {
      contents[itemId] = quantity;
    }
  }
  return contents;
}

function addBagContents(first: BagContents, second: BagContents): BagContents {
  const contents: Record<string, number> = { ...first };
  for (const [itemId, quantity] of Object.entries(second)) {
    contents[itemId] = (contents[itemId] ?? 0) + quantity;
  }
  return contents;
}

function stringArrayToBagContents(value: unknown): BagContents {
  const contents: Record<string, number> = {};
  for (const itemId of stringArray(value)) {
    contents[itemId] = (contents[itemId] ?? 0) + 1;
  }
  return contents;
}
