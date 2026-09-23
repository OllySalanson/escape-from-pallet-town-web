import { getWorkshopUpgrade, takePayment, type PaymentCheck } from '../hub/workshop';
import { clampPendingRecoveryMs, clampWardTreatmentsUsed } from '../hub/recovery';
import {
  DEFAULT_SECURE_PREFERENCE,
  readSecurePreference,
  type SecurePreference,
} from '../hub/secureAutofill';
import {
  CURRENCY_ITEM_ID as TRADER_CURRENCY_ITEM_ID,
  EMPTY_ARRANGEMENT,
  currentItemId,
  formatMoney,
  readArrangement,
  type GridArrangement,
} from '../items';
import {
  TRADER_BERTH_PRICE,
  checkBarter,
  checkBerth,
  checkPurchase,
  clampTraderBarters,
  clampTraderCount,
  formatTraderStacks,
  type TraderCounter,
  type TraderProgress,
} from '../hub/trader';
import {
  contractUnlockedInsertionIds,
  FIRST_CONTRACT_ID,
  getContract,
  secureGrid,
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
  type StashBox,
} from '../stash/Stash';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import { mergeSurvey, type SurveyRecord } from '../world/survey';
import { activeSaveSlot, PLAYTEST_SAVE_KEY, type SaveSlot } from '../dev/playtestMode';

export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const SAVE_VERSION = 6;
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
  /** Moves waiting on the player's choice of what to forget. Absent in older saves. */
  readonly pendingMoves?: readonly string[];
  readonly primaryStatus: PrimaryStatus | null;
  /**
   * The gear this Pokemon is carrying, or null for an empty slot.
   *
   * Absent on every save written before held items existed, which reads as an
   * empty slot - so versions 1 to 5 keep loading exactly as they did. An id the
   * catalogue no longer knows also reads as empty rather than as a name nothing
   * can price (`Pokemon.giveHeldItem`).
   */
  readonly heldItemId?: string | null;
}

export interface SavedStashedPokemon {
  readonly id: string;
  readonly pokemon: SavedPokemon;
}

export interface SavedStashBox {
  readonly name: string;
  readonly pokemonIds: readonly string[];
}

export interface SavedStash {
  readonly pokemon: readonly SavedStashedPokemon[];
  readonly items: BagContents;
  /**
   * The stash's boxes, in order. Absent on every save written before boxes
   * existed, which reads as one box holding everything - so versions 1 to 6
   * keep loading and a flat stash becomes box one - and so needs no version
   * bump. Anything a box names that is not in `pokemon` is dropped on load, and
   * anything no box names is put in the first box with room (`Stash`).
   */
  readonly boxes?: readonly SavedStashBox[];
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
   * Every field-move door worked open, by gate id, for good (`world/gates.ts`).
   *
   * It is the other half of `defeatedBosses`: a door is a door, and which
   * gates stand open is derived from the two lists together - see
   * `openedDoors()` below, which is what every caller hands to `getWorldMap`.
   * It is written the moment the move is used rather than at extraction, for
   * the same reason a boss's win is: a gate is the map changing, not loot being
   * carried out, so a raid that cuts the wood and is then lost has still cut
   * it. Absent on every save written before field moves, which reads as a
   * player who has opened none - true of every such save.
   */
  readonly openedGates?: readonly string[];
  /**
   * Every insertion the player has stood on in any raid. Reaching a drop-in
   * point is what makes it selectable at base; `availableInsertionIds()` adds
   * these to the insertions contracts have unlocked.
   */
  readonly reachedInsertions: readonly string[];
  /**
   * Every workshop upgrade built at base, by id. Like `completedContracts` it
   * is the whole record: every effect an upgrade has is derived from this list
   * by the system that owns it, so no effect is ever stored beside it. Saves
   * written before Brock simply have none built.
   */
  readonly workshopUpgrades: readonly string[];
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
  /**
   * Every gift an NPC has handed over and the raid has carried home, by gift id
   * (`world/gifts.ts`). Whether a giver still has something to give is derived
   * from it, so a save can never disagree. A gift lost with a wiped raid is not
   * here, and is offered again.
   */
  readonly giftsReceived: readonly string[];
  /**
   * Pokedollars that have crossed Bill's counter, ever. It is turnover, not a
   * balance: a player's money is what is in the vault and nothing else
   * (`../hub/trader`), and this only records what was spent, because standing
   * with him is derived from it. Absent on every save written before he tied
   * up, which reads as nothing spent; written as `traderScripSpent` before the
   * money was the Pokedollar, which is read as the same number.
   */
  readonly traderMoneySpent?: number;
  /**
   * Barters that may only be taken once, by barter id - the gear he brings up
   * from the hold. Like `workshopUpgrades` it is the whole record: what is
   * still on his table is derived from it. Absent on older saves, which have
   * taken none.
   */
  readonly traderBarters?: readonly string[];
  /**
   * What the secure container was filled with last time it was deployed: a flag
   * for whether it leads with Pokemon, and whatever else was in it.
   *
   * The container fills itself now (`../hub/secureAutofill`), and this is what
   * it fills itself *from* - so a player running raid after raid is not
   * re-picking from scratch. It is a preference rather than a state: the
   * Pokemon half is a policy ("lead with the highest level"), because the ids
   * change every raid. Absent on every save written before it, which reads as
   * the default, which is the policy anyway - so no version bump.
   */
  readonly securePreference?: SecurePreference;
  /**
   * How the player last laid the two containers out, as lists of seats
   * (`items/itemGrid.ts`). A pack somebody arranged by hand comes back the way
   * they left it - across screens, across a save and across a raid - because an
   * auto-tidy that undoes that work is worse than no arranging at all (the
   * captain's ruling, 2026-09-20).
   *
   * They are seats and never a grid, for the reason every other permanent
   * effect in this save is a list of ids: a blob can disagree with the contents
   * it describes. A seat names a piece and a square, the packer drops any seat
   * that no longer works, and whatever is left over is packed automatically.
   * Absent on every save written before it, which reads as a container nobody
   * has arranged - which is the automatic pack, so no version bump.
   */
  readonly packArrangement?: GridArrangement;
  readonly secureArrangement?: GridArrangement;
  /**
   * How many raids each map has seen, by map id: deployed, and how each of
   * those ended. It is a record of what the player has done rather than a
   * reward - the drop-in screen reads it back so choosing where to go is made
   * against your own history of the place. Nothing else is stored: how many
   * bosses a map has left, how much of it has been walked and which of its
   * districts have been reached are all derived, here from `defeatedBosses`
   * and there from `surveyed`. Absent on every save written before it, which
   * reads as a player who has been nowhere - true of the record, and the
   * screen says so rather than claiming a zero it invented.
   */
  readonly raidRecord?: Readonly<Record<string, MapRaidRecord>>;
  /**
   * The ground the player has walked, per map, as a bitset (`world/survey.ts`).
   * The drop-in screen's bird's-eye picture is dark everywhere this does not
   * reach, so this is the whole of what makes that picture a record. Absent on
   * older saves, which is a map nobody has walked - and every insertion the
   * player holds lights its own landing anyway, so such a save opens on a map
   * with a way in on it rather than on a black square.
   */
  readonly surveyed?: SurveyRecord;
}

/** One map's raid history. Every other number on the drop-in screen is derived. */
export interface MapRaidRecord {
  readonly deployed: number;
  readonly extracted: number;
  readonly wiped: number;
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

/**
 * The last version that could write a Bulbasaur without its level-1 Tackle. It
 * is pinned rather than compared against the current version: read as "anything
 * older than today", every later version bump would quietly re-open the repair
 * on saves that never had the fault.
 */
const LAST_MISSING_TACKLE_SAVE_VERSION = 4;

export const DEFAULT_RAID_PROGRESS: RaidProgress = {
  firstContractExtracted: false,
  unlockedInsertions: ['floodplain-relay'],
  completedContracts: [],
  defeatedBosses: [],
  openedGates: [],
  reachedInsertions: [],
  workshopUpgrades: [],
  standingContractsBanked: 0,
  giftsReceived: [],
  traderMoneySpent: 0,
  traderBarters: [],
  securePreference: DEFAULT_SECURE_PREFERENCE,
  packArrangement: EMPTY_ARRANGEMENT,
  secureArrangement: EMPTY_ARRANGEMENT,
  raidRecord: {},
  surveyed: {},
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
  /**
   * Units of Bill's stock already bought before the coming raid. It is
   * per-raid state rather than an effect, so it is stored, and it is cleared by
   * the same `RAID_RESOLVED` as the ward's bed for the same reason: a reload
   * must not hand the ration back. Absent on older saves, which have bought
   * none.
   */
  readonly traderRationUsed: number;
  /**
   * Whether a berth in Bill's hold is paid for on the coming raid - one
   * more column of the secure container, this trip only. Cleared when the raid resolves
   * whether or not the stack was used, because what was bought was the trip.
   */
  readonly traderBerthPaid: boolean;
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
  readonly traderRationUsed: number;
  readonly traderBerthPaid: boolean;
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
  readonly traderRationUsed?: number;
  readonly traderBerthPaid?: boolean;
}

/**
 * A gift is received when it is banked, not when it is handed over: the
 * Pokemon rides in the raid's pack, so a raid that loses it has not received it
 * and the giver still has it to give. The record is the only thing the save
 * keeps about a gift - the giver's lines and whether they have anything left to
 * give are derived from it (`world/gifts.ts`).
 */
function withGiftsReceived(game: RestoredGame, result: RunResult): RestoredGame {
  const gifts = result.gifts ?? [];
  if (gifts.length === 0) {
    return game;
  }
  return {
    ...game,
    raidProgress: {
      ...game.raidProgress,
      giftsReceived: [...new Set([...game.raidProgress.giftsReceived, ...gifts])],
    },
  };
}

/** What every raid ending clears: the recovery a resolved raid has now paid for. */
const RAID_RESOLVED = {
  pendingRecoveryMs: 0,
  wardTreatmentsUsed: 0,
  traderRationUsed: 0,
  traderBerthPaid: false,
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * What the title screen needs to know about the one save there is, without
 * handing it the game: whether there is one to continue, and enough of it to
 * recognise it as theirs.
 *
 * `unreadable` is its own answer rather than `none` because the two are told
 * apart by what is in storage, not by what parses - a file the loader refuses
 * is still somebody's game, and a title that called it empty would offer to
 * start over it without a word.
 */
export type SaveSummary =
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable' }
  | {
      readonly kind: 'game';
      readonly pokemon: number;
      readonly contracts: number;
      readonly raids: number;
    };

export class SaveManager {
  private readonly storage: StorageLike | null;
  /**
   * Which of the two games this manager is reading and writing, or null for
   * "whichever is being played" - see `dev/playtestMode.ts`. Every scene
   * constructs a manager with no arguments and so follows the live slot, which
   * is what lets the explorer run be a whole second save without a single call
   * site learning there are two. A slot is named only by the title screen,
   * which has to describe the other game without switching into it.
   */
  private readonly slot: SaveSlot | null;

  public constructor(
    storage: StorageLike | null = getBrowserStorage(),
    slot: SaveSlot | null = null,
  ) {
    this.storage = storage;
    this.slot = slot;
  }

  /** Resolved per call, never cached: the slot can change between two reads. */
  private get key(): string {
    return (this.slot ?? activeSaveSlot()) === 'playtest' ? PLAYTEST_SAVE_KEY : SAVE_KEY;
  }

  public hasSave(): boolean {
    return this.load() !== null;
  }

  /** See `SaveSummary`. Reads the save once and keeps none of it. */
  public describe(): SaveSummary {
    try {
      if (!this.storage?.getItem(this.key)) {
        return { kind: 'none' };
      }
    } catch {
      return { kind: 'none' };
    }
    const game = this.load();
    if (!game) {
      return { kind: 'unreadable' };
    }
    const progress = game.raidProgress;
    return {
      kind: 'game',
      pokemon: game.stash.listPokemon().length,
      contracts: progress.completedContracts.length + progress.standingContractsBanked,
      raids: Object.values(progress.raidRecord ?? {}).reduce((total, record) => total + record.deployed, 0),
    };
  }

  public save(state: SaveGameState): boolean {
    if (!this.storage) {
      return false;
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(serializeGame(state)));
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
      const rawSave = this.storage.getItem(this.key);
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
      this.storage?.removeItem(this.key);
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
    const loaded = this.load();
    if (!loaded) {
      return false;
    }
    const game = withGiftsReceived(loaded, result);

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
    const loaded = this.load();
    if (!loaded) {
      return { saved: false, granted: false };
    }
    const game = withGiftsReceived(loaded, result);

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
   * Records field-move doors opened in the raid in progress, and reports which
   * of them were new.
   *
   * The same promise `recordDefeatedBosses` makes, for the same reason: the
   * door is written at the moment the move is used, not at extraction, so a
   * raid that opens the wood and is then lost to the hunter has still opened
   * it. Nothing but `raidProgress` is touched - the vault in storage is the
   * pre-raid vault and has to stay that way until the raid settles.
   */
  public recordOpenedGates(gateIds: readonly string[]): readonly string[] {
    const game = this.load();
    if (!game) {
      return [];
    }
    const already = game.raidProgress.openedGates ?? [];
    const fresh = [...new Set(gateIds)].filter((gateId) => !already.includes(gateId));
    if (fresh.length === 0) {
      return [];
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      openedGates: [...already, ...fresh],
    };
    return this.save({ ...game, raidProgress }) ? fresh : [];
  }

  /**
   * Counts one raid deployed to a map, at the moment the player commits to it.
   *
   * Deployments are counted where they are made rather than where they end,
   * because a raid nobody came back from is still a raid you went on - and it
   * is the difference between the two numbers that says how a place has treated
   * you. Nothing else in a save is touched.
   */
  public recordDeployment(mapId: string): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }
    return this.save({ ...game, raidProgress: bumpRaid(game.raidProgress, mapId, 'deployed') });
  }

  /**
   * Closes a raid's entry in the record: how it ended, and the ground it walked.
   *
   * The survey is written here rather than a tile at a time because a save is
   * the whole game serialised and a step is 150ms - a write a step would be a
   * write four hundred times a raid. A raid that is abandoned by closing the
   * tab therefore surveys nothing, which is the same answer the rest of the
   * save gives about it.
   */
  public recordRaidEnded(
    mapId: string,
    outcome: 'extracted' | 'wiped',
    survey: { readonly width: number; readonly walked: Iterable<number> } | undefined = undefined,
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }
    let raidProgress = bumpRaid(game.raidProgress, mapId, outcome);
    if (survey && survey.width > 0) {
      raidProgress = {
        ...raidProgress,
        surveyed: {
          ...(raidProgress.surveyed ?? {}),
          [mapId]: mergeSurvey(raidProgress.surveyed?.[mapId], survey.width, survey.walked),
        },
      };
    }
    return this.save({ ...game, raidProgress });
  }

  /**
   * Records an insertion the player has just stood on, and reports whether that
   * made it newly selectable - false for one a contract had already unlocked,
   * so the map only ever announces a drop-in the lobby did not already offer.
   */
  /**
   * Remembers what the secure container was filled with, at the moment a raid
   * deploys. It is written on the way out rather than on the way home, because
   * it is what the player *chose*, and a raid that wipes chose it too.
   */
  public recordSecurePreference(preference: SecurePreference): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }
    const raidProgress: RaidProgress = { ...game.raidProgress, securePreference: preference };
    return this.save({ ...game, raidProgress });
  }

  /**
   * Remembers how the two containers were laid out.
   *
   * Written on the way out of the lobby, as the secure preference is, and again
   * when a raid ends - because the pack is arranged in the field as much as at
   * base, and a layout that did not survive the raid it was made in would be
   * the one promise this feature cannot break.
   */
  public recordContainerArrangements(
    pack: GridArrangement,
    secure?: GridArrangement,
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      packArrangement: pack,
      ...(secure ? { secureArrangement: secure } : {}),
    };
    return this.save({ ...game, raidProgress });
  }

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
   * Builds one workshop upgrade, paying for it with exactly the Pokemon the
   * player named and the supplies it lists. This is the only path that spends:
   * it reloads the vault, so the payment is checked against what is really
   * banked rather than against whatever a screen was showing, and it records
   * the upgrade in the same write that removes the payment, so a save can never
   * hold one without the other.
   *
   * An upgrade already built is refused rather than charged again, which makes
   * a repeated click a no-op instead of a second payment.
   */
  public buildWorkshopUpgrade(
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
      game.raidProgress.workshopUpgrades,
      upgradeId,
      pokemonIds,
    );
    if (!payment.ok) {
      return { ...payment, saved: false };
    }
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      workshopUpgrades: [...game.raidProgress.workshopUpgrades, payment.upgrade.id],
    };
    return { ...payment, saved: this.save({ ...game, raidProgress }) };
  }

  /**
   * What Bill is looking at, for this save: the vault he is paid out
   * of, the record he reads standing off, and the two per-raid facts.
   *
   * It is built here, from the loaded save alone, so the lobby that draws his
   * counter and the methods that spend at it can never be judging different
   * states. Undefined when there is no save to deal against.
   */
  public traderCounter(): TraderCounter | undefined {
    const game = this.load();
    return game === null ? undefined : traderCounterFor(game);
  }

  /**
   * Buys one unit off Bill's shelf.
   *
   * Nothing moves unless the whole deal stands - standing, ration and price all
   * checked against the save that is about to be written - so a refused
   * purchase costs nothing. The ration is spent here rather than at the shelf,
   * and the price is added to turnover, which is what raises standing: money
   * spent is the only kind he counts.
   */
  public buyTraderStock(itemId: string, quantity = 1): TraderPurchaseResult {
    const game = this.load();
    if (!game) {
      return { ok: false, message: 'There is no saved game to deal on.', saved: false };
    }
    const offer = checkPurchase(traderCounterFor(game), itemId, quantity);
    if (!offer) {
      return { ok: false, message: 'He does not stock that.', saved: false };
    }
    if (offer.refusal !== undefined) {
      return { ok: false, message: offer.message ?? 'He will not deal.', saved: false };
    }
    const total = offer.item.price * quantity;
    game.stash.removeItem(TRADER_CURRENCY_ITEM_ID, total);
    game.stash.addItem(offer.item.itemId, quantity);
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      traderMoneySpent: clampTraderCount(game.raidProgress.traderMoneySpent) + total,
    };
    return {
      ok: true,
      message: quantity === 1 ? `Bought one for ${formatMoney(total)}.` : `Bought ${quantity} for ${formatMoney(total)}.`,
      saved: this.save({
        ...game,
        raidProgress,
        traderRationUsed: clampTraderCount(game.traderRationUsed) + quantity,
      }),
    };
  }

  /**
   * Takes one barter: found goods across the counter, gear or a stone back.
   *
   * No money changes hands here and none may - these are the things the
   * captain's ruling puts beyond money - so this path deliberately never
   * touches turnover. A barter offered once is recorded the moment it is taken,
   * which is what stops the boat becoming a gear faucet.
   */
  public takeTraderBarter(barterId: string, quantity = 1): TraderPurchaseResult {
    const game = this.load();
    if (!game) {
      return { ok: false, message: 'There is no saved game to deal on.', saved: false };
    }
    const offer = checkBarter(traderCounterFor(game), barterId, quantity);
    if (!offer) {
      return { ok: false, message: 'He has nothing like that.', saved: false };
    }
    if (offer.refusal !== undefined) {
      return { ok: false, message: offer.message ?? 'He will not deal.', saved: false };
    }
    const times = quantity;
    for (const { itemId, quantity } of offer.barter.takes) {
      game.stash.removeItem(itemId, quantity * times);
    }
    game.stash.addItem(offer.barter.gives.itemId, offer.barter.gives.quantity * times);
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      traderBarters: offer.barter.once
        ? [...new Set([...clampTraderBarters(game.raidProgress.traderBarters), offer.barter.id])]
        : clampTraderBarters(game.raidProgress.traderBarters),
    };
    return {
      ok: true,
      message:
        times === 1
          ? `Traded ${formatTraderStacks(offer.barter.takes)} for a ${offer.barter.name}.`
          : `Traded ${formatTraderStacks(offer.barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * times })))} for ${times} ${offer.barter.name}s.`,
      saved: this.save({ ...game, raidProgress }),
    };
  }

  /**
   * Rents a berth in his hold for the coming raid: one more column of the
   * secure container, cleared with everything else when that raid resolves.
   *
   * The column itself is never stored - `secureGrid` derives it from this flag,
   * exactly as it derives the banked and built ones - so a save can only ever
   * hold the fact that the berth was paid for.
   */
  public buyTraderBerth(): TraderPurchaseResult {
    const game = this.load();
    if (!game) {
      return { ok: false, message: 'There is no saved game to deal on.', saved: false };
    }
    const offer = checkBerth(traderCounterFor(game));
    if (offer.refusal !== undefined) {
      return { ok: false, message: offer.message ?? 'He will not deal.', saved: false };
    }
    game.stash.removeItem(TRADER_CURRENCY_ITEM_ID, TRADER_BERTH_PRICE);
    const raidProgress: RaidProgress = {
      ...game.raidProgress,
      traderMoneySpent: clampTraderCount(game.raidProgress.traderMoneySpent) + TRADER_BERTH_PRICE,
    };
    return {
      ok: true,
      message: `Berth paid. One more stack comes home from this raid.`,
      saved: this.save({ ...game, raidProgress, traderBerthPaid: true }),
    };
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
    packItemId?: string,
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    game.stash.applyRaidCondition(condition);
    game.stash.applyWipeLoss(broughtPokemonIds, broughtItems, secureSlot, {
      pokemon: securePokemonLimit(game.raidProgress.workshopUpgrades),
      grid: secureGrid(
        game.raidProgress.completedContracts,
        game.raidProgress.workshopUpgrades,
        // A berth is paid for before the raid and read here, at the end of it,
        // because a rented stack has to protect a haul from the wipe it was
        // rented against. `RAID_RESOLVED` below is what takes it away again.
        game.traderBerthPaid,
      ),
    });
    // The pack the raid was lost in goes with it, and it is taken *after* the
    // accounting above rather than before, because the two are about different
    // objects that share an id. The pack being worn was never in the bag - it
    // *is* the bag - so nothing above can see it and the secure container
    // cannot protect it: the container is something the pack is carried past,
    // not something the pack is inside. A *spare* pack found in the field is
    // ordinary loot, is in the bag, and is protected by the container exactly
    // as a material is - so a player who wore a Ranger pack and found another
    // keeps the one they secured and loses the one they wore.
    if (packItemId !== undefined) {
      game.stash.removeItem(packItemId, 1);
    }
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

/** One more raid of a kind on one map, leaving every other map's count alone. */
function bumpRaid(
  progress: RaidProgress,
  mapId: string,
  field: keyof MapRaidRecord,
): RaidProgress {
  const held = progress.raidRecord?.[mapId] ?? { deployed: 0, extracted: 0, wiped: 0 };
  return {
    ...progress,
    raidRecord: {
      ...(progress.raidRecord ?? {}),
      [mapId]: { ...held, [field]: held[field] + 1 },
    },
  };
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
    traderRationUsed: clampTraderCount(state.traderRationUsed),
    traderBerthPaid: state.traderBerthPaid === true,
  };
}

export function deserializeGame(value: unknown): RestoredGame | null {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    ![1, 2, 3, 4, 5, SAVE_VERSION].includes(value.version)
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
  // A save written before the pack was gear holds no pack at all, and would
  // load into a loadout with nothing to pack into. It is issued the starting
  // one - eighteen squares, exactly what that save was played with - so the
  // change costs nobody a square. It cannot be farmed: every wipe restocks the
  // Satchel (`MINIMUM_SUPPLIES`), so a vault that has ever been loaded since is
  // never packless again.
  stash.ensureAPack();
  return {
    party: new PokemonParty(carriedIntoVault ? [] : pokemon),
    mapId,
    position: { ...position },
    items: carriedIntoVault ? [] : stringArray(value.items),
    // The persisted bag is the free-roam inventory, which no raid reads and
    // which never had a size; a raid's own pack is built from the loadout.
    bag: new Bag(carriedIntoVault ? {} : bagContents(value.bag), null),
    stash,
    raidProgress: deserializeRaidProgress(value.raidProgress),
    starterSpeciesId: deserializeStarterSpeciesId(value.starterSpeciesId) ?? inferStarterSpeciesId(stash),
    pendingRecoveryMs: clampPendingRecoveryMs(value.pendingRecoveryMs),
    wardTreatmentsUsed: clampWardTreatmentsUsed(value.wardTreatmentsUsed),
    traderRationUsed: clampTraderCount(value.traderRationUsed),
    traderBerthPaid: value.traderBerthPaid === true,
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
  //
  // `outfitterUpgrades` is what this list was called before the base's four
  // people had names, and a save written then is still holding it under that
  // key. A field is wire format rather than a name anybody reads, so it is
  // read here and never written: dropping it would have silently un-built
  // every rung somebody had paid for. `SaveManager.test.ts` pins it.
  const savedUpgrades = Array.isArray(value.workshopUpgrades)
    ? value.workshopUpgrades
    : Array.isArray(value.outfitterUpgrades)
      ? value.outfitterUpgrades
      : [];
  const workshopUpgrades = [
    ...new Set(
      savedUpgrades.filter(
        (id): id is string => typeof id === 'string' && getWorkshopUpgrade(id) !== undefined,
      ),
    ),
  ];
  return {
    firstContractExtracted,
    completedContracts,
    // Saves written before gates and drop-in points existed have beaten no boss
    // and reached nowhere, which is exactly what a missing list reads as.
    defeatedBosses: uniqueStrings(value.defeatedBosses),
    openedGates: uniqueStrings(value.openedGates),
    reachedInsertions: uniqueStrings(value.reachedInsertions),
    workshopUpgrades,
    // Saves written before gifts existed have received none.
    giftsReceived: uniqueStrings(value.giftsReceived),
    ...(value.battleLessonGiven === true ? { battleLessonGiven: true } : {}),
    // A save written before the standing board has banked none of it.
    standingContractsBanked:
      typeof value.standingContractsBanked === 'number' &&
      Number.isSafeInteger(value.standingContractsBanked) &&
      value.standingContractsBanked > 0
        ? value.standingContractsBanked
        : 0,
    // Absent on every save written before Bill tied up, which reads as
    // nothing spent and nothing bartered - so such a save simply meets him as a
    // stranger who has banked whatever it banked.
    traderMoneySpent: clampTraderCount(value.traderMoneySpent ?? value.traderScripSpent),
    traderBarters: clampTraderBarters(value.traderBarters),
    // A save written before the container filled itself has no preference, and
    // the default is exactly what such a player wants: lead with the Pokemon.
    securePreference: readSecurePreference(value.securePreference),
    packArrangement: readArrangement(value.packArrangement),
    secureArrangement: readArrangement(value.secureArrangement),
    // A save written before the record was kept has been nowhere, which is
    // what an empty record says: the drop-in screen reads that as "you have
    // not been here" rather than as a raid that went badly.
    raidRecord: clampRaidRecord(value.raidRecord),
    surveyed: clampSurvey(value.surveyed),
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

/** Only whole, non-negative counts, on maps that still exist. */
function clampRaidRecord(value: unknown): Readonly<Record<string, MapRaidRecord>> {
  if (!isRecord(value)) {
    return {};
  }
  const count = (entry: unknown): number =>
    typeof entry === 'number' && Number.isSafeInteger(entry) && entry > 0 ? entry : 0;
  const record: Record<string, MapRaidRecord> = {};
  for (const [mapId, held] of Object.entries(value)) {
    if (!(mapId in WORLD_MAPS) || !isRecord(held)) {
      continue;
    }
    record[mapId] = {
      deployed: count(held.deployed),
      extracted: count(held.extracted),
      wiped: count(held.wiped),
    };
  }
  return record;
}

/**
 * A survey is only ever read back through `world/survey.ts`, which clips it to
 * the map as it is drawn today, so all that is checked here is its shape.
 */
function clampSurvey(value: unknown): SurveyRecord {
  if (!isRecord(value)) {
    return {};
  }
  const record: Record<string, { width: number; tiles: string }> = {};
  for (const [mapId, held] of Object.entries(value)) {
    if (
      !(mapId in WORLD_MAPS) ||
      !isRecord(held) ||
      typeof held.width !== 'number' ||
      !Number.isSafeInteger(held.width) ||
      held.width <= 0 ||
      typeof held.tiles !== 'string'
    ) {
      continue;
    }
    record[mapId] = { width: held.width, tiles: held.tiles };
  }
  return record;
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
    pendingMoves: pokemon.pendingMoves.map((move) => move.name),
    primaryStatus: pokemon.primaryStatus,
    heldItemId: pokemon.heldItemId,
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
  pokemon.giveHeldItem(typeof value.heldItemId === 'string' ? value.heldItemId : null);

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

  if (Array.isArray(value.pendingMoves)) {
    pokemon.restoreMoveset(
      pokemon.moves.map((move) => move.base.name),
      value.pendingMoves.filter((name): name is string => typeof name === 'string'),
    );
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
    boxes: stash.listBoxes().map(({ name, pokemonIds }) => ({ name, pokemonIds: [...pokemonIds] })),
  };
}

function deserializeBoxes(value: unknown): StashBox[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      name: typeof entry.name === 'string' ? entry.name : '',
      pokemonIds: Array.isArray(entry.pokemonIds)
        ? entry.pokemonIds.filter((id): id is string => typeof id === 'string')
        : [],
    }));
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
  return new Stash({ pokemon, items: bagContents(value.items), boxes: deserializeBoxes(value.boxes) });
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
  if (
    saveVersion > LAST_MISSING_TACKLE_SAVE_VERSION ||
    speciesId !== 'bulbasaur' ||
    moves.length >= 4
  ) {
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
      // Read under the name the item goes by now, so a save written before a
      // rename keeps what it held - `scrip` is the Pokedollars.
      const current = currentItemId(itemId);
      contents[current] = (contents[current] ?? 0) + quantity;
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
  for (const itemId of stringArray(value).map(currentItemId)) {
    contents[itemId] = (contents[itemId] ?? 0) + 1;
  }
  return contents;
}


/** The result of one deal across the counter, in the one line the lobby prints. */
export interface TraderPurchaseResult {
  readonly ok: boolean;
  readonly message: string;
  readonly saved: boolean;
}

/**
 * Bill's view of one loaded save. It is a function rather than a field
 * so it is always read off the save that is about to be written, never off a
 * snapshot the lobby happens to be holding.
 */
function traderCounterFor(game: RestoredGame): TraderCounter {
  return {
    stash: game.stash,
    progress: traderProgressOf(game.raidProgress),
    rationUsed: clampTraderCount(game.traderRationUsed),
    berthPaid: game.traderBerthPaid,
  };
}

/** The part of a save's raid progress Bill reads standing off. */
export function traderProgressOf(raidProgress: RaidProgress): TraderProgress {
  return {
    completedContracts: raidProgress.completedContracts,
    standingContractsBanked: raidProgress.standingContractsBanked,
    defeatedBosses: raidProgress.defeatedBosses,
    traderMoneySpent: clampTraderCount(raidProgress.traderMoneySpent),
    traderBarters: clampTraderBarters(raidProgress.traderBarters),
  };
}
