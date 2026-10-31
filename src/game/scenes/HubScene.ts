import Phaser from 'phaser';
import { readLook } from '../look/look';
import { countPlay, mapDetail } from '../analytics/playCounter';
import type { FeedbackDetail } from '../feedback/feedbackContext';
import { audioManager } from '../audio/AudioManager';
import type { SoundEffectName } from '../audio/soundEffects';
import type {
  DeploymentFlow} from '../hub';
import {
  applyRecovery,
  beaconUnlockAtMs,
  checkBerth,
  faintedRefusal,
  FAINTED_TREATMENT_NOTE,
  formatRecoveryClock,
  getWorkshopUpgrade,
  hasBeacon,
  MAX_RUN_PARTY,
  needsRecovery,
  WORKSHOP_UPGRADES,
  workshopOffers,
  pokemonNeedingRecovery,
  raidClockAfterRecovery,
  recoveryCostMs,
  spendableSupply,
  buildDropInBriefing,
  doorHolder,
  largestMapSize,
  doorPromise,
  stillToFind,
  type DropInBriefing,
  TRADER_BERTH_PRICE,
  traderBarterLimit,
  traderBarterOffers,
  traderStockLimit,
  traderStockLimitReason,
  traderStanding,
  traderStandingPoints,
  traderStockOffers,
  treatmentOptions,
  treatWithItem,
  formatTraderStacks,
  nextTraderStanding,
  rationLeft,
  moneyHeld,
  STANDING_PER_BOSS,
  STANDING_PER_CONTRACT,
  POKEDOLLARS_PER_STANDING,
  wardBedIds,
  berthSquares,
  type Deployment,
  type TraderBarterOffer,
  type TraderCounter,
  type TraderStockOffer,
  type WorkshopOffer,
  type WorkshopUpgrade,
  type WorkshopVault,
  type RecoveryTerms,
  type TreatmentOption,
} from '../hub';
import {
  Bag,
  CURRENCY_ITEM_ID,
  formatMoney,
  itemCountTag,
  HELD_ITEM_DEFINITIONS,
  ITEM_DEFINITIONS,
  FOUND_ONLY_IDS,
  isErrandItem,
  blocksFor,
  cargoCells,
  footprintOf,
  getHeldItem,
  getItemById,
  gridCells,
  isFoundOnly,
  isFurniture,
  isWearableItem,
  itemAmountsFor,
  READ_IN_A_RAID,
  type ItemDefinition,
  type ItemId,
  type PackItemId,
  type GridPieceRef,
} from '../items';
import { GridArranging } from '../ui/gridArranging';
import { describeKey } from '../ui/hoverDescribe';
import { ItemHoverHelp } from '../ui/itemHoverHelp';
import { flowForGame, offeredInsertions, type ArenaKit } from '../base/arenaKit';
import { cargoSquaresLabel, pokemonCargo } from '../pokemon/pokemonCargo';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { activeRunManager } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import {
  activeSaveSlot,
  isPlaytestRun,
  PLAYTEST_PLACE_LABEL,
  PLAYTEST_RAID_DURATION_MS,
} from '../dev/playtestMode';
import { createActiveRunSession } from '../run/RunSession';
import {
  FIRST_CONTRACT,
  frontDoorFor,
  generateRunPlan,
  generateRoomLoot,
  withRoomLoot,
  type RunInsertion,
  type RunInsertionId,
  requireInsertion,
} from '../run/runGeneration';
import {
  availableContracts,
  boardContractForMap,
  contractCarryIn,
  formatStacks,
  missingCarryIn,
  objectivesForContract,
  type RaidContract,
} from '../objectives';
import { deferPendingMoves, nextPendingMoveOffer } from '../hub/pendingMoves';
import { raidsDeployed, raidsLost, SaveManager, traderProgressOf, type RestoredGame } from '../save/SaveManager';
import {
  searchPokemon,
  sortPokemon,
  nextStashSort,
  STASH_SORT_HELP,
  STASH_SORT_LABELS,
  type StashSort,
} from '../hub/stashBrowser';
import {
  BOX_CAPACITY,
  MAX_BOX_NAME_LENGTH,
  getStarterSpecies,
  starterInConditionOf,
  type StarterSpeciesId,
  type Stash,
  type StashedPokemon,
} from '../stash';
import { iconMarkup, itemIcon } from '../ui/icons';
import { hunterThreatFor, hunterThreatLine, type HunterThreat } from '../world/hunterThreat';
import { rivalForRaid } from '../world/hunters';
import { isNightRaid } from '../world/nightRaids';
import type { GridPosition } from '../movement/gridMovement';
import { type WorldMapId, worldMapIds, worldMapMaker, worldMapName } from '../worldMap';
import { MINIMAP_PALETTE, type Minimap } from '../world/minimap';
import { fitMapPictures, mapPictureFrame, pictureRowAttributes } from '../ui/mapPicture';
import { wallMapContext, wallMapOrder, wallMapEntries, wallMapNote, wallMapPicture, type WallMapEntry } from '../base/wallMap';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { moveChoiceMessage } from '../ui/moveChooser';
import { MenuOverlay } from '../ui/MenuOverlay';
import { conditionLine } from '../ui/condition';
import { pokemonDossier } from '../ui/pokemonDossier';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelFigure,
  pixelHpBar,
  pixelScreen,
  pixelGrid,
  pixelTag,
  pixelWindow,
  takeDownPixelStatus,
  pixelPokemonName,
} from '../ui/pixelUi';
import {
  pricePart,
  shopDetailPane,
  shopPaidColumn,
  shopPriceColumn,
  SHORT_MARK_LEGEND,
  type ShopPricePart,
} from '../ui/shopDetail';
import { starterCards } from '../ui/starterPicker';
import { askedDealIndex, focusDirectionForKey, RELEASE_ARMING_MS } from '../ui/spatialFocus';
import { clampCount, countKeyTarget, countSelector, COUNT_BIG_STEP, neighbourCountIndex } from '../ui/countSelector';
import {
  errandLoot,
  errandPlace,
  errandSquares,
  errandThing,
  errandsInHand,
  errandsToLay,
  errandForItem,
} from '../hub/errands';
import { pokedexOwned } from '../hub/pokedex';
import { caughtLegends } from '../world/legends';
import { createRaidInFlight, raidHeartbeat } from '../run/raidInFlight';
import { recoveryTermsFor } from '../hub/centerCounter';
import { dayCareRefusal, leftLines, raidsCompleted } from '../hub/dayCare';
import { friendRoom, friendRoomsOffered, raidName } from '../raidRoom/friendRoom';
import { typedRoomCode } from '../raidRoom/roomCode';
import { friendRoomView, friendStatusLine, type RoomMapChoice } from '../hub/friendRoomView';
import { keyHint, RAID_KEY_LETTERS } from '../input/keyBindings';
import { wayInToward } from '../base/valeOverview';
import { withArticle } from '../ui/article';

/**
 * What the help bar says while the cursor is on a block of a container.
 *
 * It is one line because it is read while the player is looking at the squares
 * rather than at the words, and it names the three keys that do anything:
 * taking, turning and putting down. The pointer needs no instructions.
 */
/**
 * The same, on a container at base whose pieces go back to the vault with a
 * right-click or DEL (`GridArrangingHost.remove`): one at a time, so a stack of
 * Poké Balls is taken down a ball a click.
 */
const ARRANGE_AND_REMOVE_HELP =
  'ENTER picks this up · arrows carry it · R turns it · RIGHT-CLICK or DEL takes one out.';

export interface HubSceneData {
  readonly savedGame?: RestoredGame;
  /**
   * Which room the player walked into. The base is a map now
   * (`scenes/BaseScene.ts`), so a screen is reached by walking to its door
   * rather than by choosing its row, and the door says which screen it is.
   */
  readonly view?: HubView;
  /** The room they came in from, so backing out puts them back in it. */
  readonly from?: string;
  /**
   * Where in that room they stood to open this, when it was not the door mat:
   * the wall map is read from in front of it, and backing out stands the
   * player back there.
   */
  readonly at?: GridPosition;
  /**
   * What the player is getting ready with, when this is a panel over THE RAID
   * ARENA's hall rather than a screen of its own: the hall owns it, stays on
   * screen beside the panel, and is told when the panel is done with.
   */
  readonly kit?: ArenaKit;
}

/**
 * What the hall's panels show: who comes (`bench`), what they carry (`rack`),
 * what comes home whatever happens (`locker`), and where they would land (`rim`).
 */
export type ArenaPanel = 'bench' | 'rack' | 'locker' | 'rim';

const ARENA_PANELS: readonly string[] = ['bench', 'rack', 'locker', 'rim'] satisfies readonly ArenaPanel[];

/** Every base screen, and the hall's panels. */
type HubView = 'stash' | ArenaPanel | 'reselect' | 'workshop' | 'trader' | 'wallmap' | 'daycare' | 'friend';

/**
 * How much of the menu layer a panel over the hall may take, in game pixels: as
 * little as the smallest screen every screen is authored against, or a little
 * over half of a big window, so the hall is always there beside it. The rim's
 * lies along the foot of the window, because what it is looking at is the pit.
 */
const PANEL_MIN_WIDTH = 320;
const PANEL_SHARE = 0.56;
/** Which way on the map each arrow key points, on the rim. */
const RIM_ARROWS: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Game pixels a card on the wall map takes beyond its picture: its window's
 * two frame pixels, the cursor's margin on the left, a pixel of room on the
 * right, and the picture's own ring.
 */
const WALL_CARD_OVERHEAD = 2 + 9 + 3 + 2;
/** The gap between two cards, which is the body's own (`.px-body` in style.css). */
const WALL_CARD_GAP = 4;

/** What `traderArmed` holds for the berth, which is the one deal with no id. */
const BERTH_DEAL = 'berth';

/** How often a held raid room is asked who is in it while the player gets ready. */
const ROOM_TICK_MS = 250;

/**
 * How long after a deal that releases something for good is armed a pointer
 * click on its confirm button is still read as the second half of the
 * double-click that armed it. Half a second is the double-click interval
 * Windows ships with, the longest of the common defaults.
 */
export { RELEASE_ARMING_MS };

/** What a screen left open says when the game moved on in another tab. */
export const STALE_SAVE_REFUSAL =
  'The game moved on in another tab, so this screen has caught up. Nothing was changed: try again.';

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  /**
   * The save as storage held it when this screen read it (`SaveManager.stamp`).
   * Another tab may write the save while this one sits open, and this screen
   * writes its whole copy of the game, so it never writes once storage has
   * moved on from this - see `movedOnElsewhere`.
   */
  private saveStamp: string | null = null;
  private flow!: DeploymentFlow;
  /** What the hall handed over, when this is one of its panels. */
  private kit: ArenaKit | undefined;
  private overlay!: MenuOverlay;
  private view: HubView = 'stash';
  /** Which screen `render` last drew, so a redraw of it keeps its scroll. */
  private drawnScreen: string | undefined;
  /** The base door this screen was walked in through, if any - see `leaveToBase`. */
  private enteredFrom: string | undefined;
  /** Where in that room the player stood to open it, when it was not the mat. */
  private enteredAt: GridPosition | undefined;
  /** The map on Oak's wall being read close up, or undefined while all four are. */
  private wallMapInspect: WorldMapId | undefined;
  /**
   * Picking a piece up and putting it down, in both containers.
   *
   * The two grids on this screen are one controller because only one piece is
   * ever in the player's hand: the pack and the secure container are two
   * containers, not two cursors. What the rules are lives in
   * `items/gridArrange.ts`; what is being carried lives here.
   */
  private arrangingValue: GridArranging | undefined;
  /** What an item does, after the pointer or the cursor rests on it (`ui/itemHoverHelp.ts`). */
  private hoverHelp: ItemHoverHelp | undefined;
  /** Whose summary is on screen, while the summary view is the one showing. */
  private reselectStarterId: StarterSpeciesId = 'bulbasaur';
  /** A swap only runs from an explicit second click, so a misclick cannot delete a survivor. */
  private swapArmed = false;
  /**
   * The rung on Brock's ladder asked but not yet built. Materials are spent for
   * good, so a rung is struck from an explicit second press, as Bill's deals
   * are (`armedDeal`).
   */
  private workshopArmed: string | undefined;
  /**
   * The deal on the boat asked but not yet struck: a barter id, or `BERTH_DEAL`.
   *
   * Found goods and a berth are spent for good, so neither goes through on one
   * press. It is one at a time, because arming a second disarms the first.
   */
  private traderArmed: string | undefined;
  /**
   * When the last irreversible deal was armed (`armRelease`), so a pointer
   * click that lands on its confirm button straight away can be told for the
   * second half of the double-click that armed it.
   */
  private releaseArmedAt = Number.NEGATIVE_INFINITY;
  /**
   * Set once a raid has been committed to. The screen stays up and keeps its
   * cursor on `Enter the raid` for the length of the fade, so a second press of
   * the key that started the raid used to start it again and throw.
   */
  private deploying = false;
  /** Whether the raid room's database is being asked something (`raidRoom/`). */
  private roomBusy = false;
  /** What is typed in the room code field. */
  private roomTyped = '';
  /**
   * How the player is looking at their Pokemon: which box, in what order, and
   * for whom. It is not saved - it is where the cursor is, not what is owned.
   */
  private boxScope: number | 'all' = 0;
  private stashSort: StashSort = 'kept';
  private stashSearch = '';
  /** How many Bill's counter is being asked for, by `buy:` or `barter:` and id. Never saved. */
  private counterCounts = new Map<string, number>();
  /** The one text field on screen, if any: naming a box or searching. */
  private boxEditing: 'rename' | 'find' | undefined;
  /** The Pokemon picked up to be put in another box, by stash id. */
  private boxMoving: string | undefined;
  private status = '';
  /** The one pending removal of the status line; see `setStatus()`. */
  private statusTimer: Phaser.Time.TimerEvent | undefined;

  public constructor() {
    super('hub');
  }

  /**
   * The stored save wins over any handed-in snapshot. Phaser reuses a scene's
   * previous start payload when a later `scene.start('hub')` passes none, so a
   * raid that banked a contract used to return to a hub still rendering the
   * snapshot captured at game start. Storage is written before every hand-off,
   * so the passed game is only a fallback for storage-less browsers.
   */
  /** Which base screen this is, for a feedback message. See `feedback/feedbackContext.ts`. */
  public feedbackContext(): readonly FeedbackDetail[] {
    return [{ label: 'Base screen', value: this.view }];
  }

  public init(data: HubSceneData = {}): void {
    const loaded = this.saveManager.load() ?? data.kit?.game ?? data.savedGame;
    if (!loaded) {
      throw new Error('HubScene requires a saved game.');
    }

    this.kit = data.kit;
    this.drawnScreen = undefined;
    this.applyLoadedGame(loaded);
    // The save wins over the payload for the *game*; the payload wins for which
    // room this is, because that is the door the player just walked through and
    // storage knows nothing about it.
    this.view = data.view ?? 'stash';
    this.enteredFrom = data.from;
    this.enteredAt = data.at;
    // Looking down from the rim is looking the plan over, as far as it can be.
    if (this.view === 'rim') {
      this.pointAtHeldRoom();
      this.flow.advance();
    }
  }

  private applyLoadedGame(loaded: RestoredGame): void {
    this.savedGame = loaded;
    this.saveStamp = this.saveManager.stamp();
    this.stash = loaded.stash;
    // An explorer run comes home whole. Its Pokemon cannot be knocked out, so
    // they come back from every raid on one hit point; charging raid time to
    // undo that would make the one mode built for wandering the slowest one to
    // set off again in.
    if (isPlaytestRun()) {
      for (const stored of this.stash.listPokemon()) {
        this.stash.recoverPokemon(stored.id);
      }
    }
    // Nothing is pre-selected: the raid party is always something the player
    // picked. A panel carries on with what the hall is holding, against the
    // vault as it now stands.
    if (this.kit) {
      this.kit.game = loaded;
      this.kit.flow.rebase(loaded.stash);
      this.flow = this.kit.flow;
    } else {
      this.flow = flowForGame(loaded);
    }
    this.arranging.release();
    this.view = 'stash';
    this.reselectStarterId = this.startingStarterId();
    this.swapArmed = false;
    this.workshopArmed = undefined;
    this.traderArmed = undefined;
    this.wallMapInspect = undefined;
    this.deploying = false;
    // A fresh look at a freshly loaded vault: nothing narrowed, nothing picked up.
    this.boxScope = 0;
    this.stashSort = 'kept';
    this.stashSearch = '';
    this.boxEditing = undefined;
    this.boxMoving = undefined;
    this.status = '';
    // The clock that owned it died with the last hub, so only the pointer is left.
    this.statusTimer = undefined;
  }

  public create(): void {
    // A panel opens over the hall, which goes on burning behind it: a camera
    // fading in here would black the whole canvas out first.
    if (!this.isPanel) {
      this.cameras.main.fadeIn?.(180, 0, 0, 0);
    }
    this.overlay = new MenuOverlay(
      this,
      `hub-menu pixel-ui${this.isPanel ? ` arena-panel is-${this.view}` : ''}`,
      (event) => this.handleKey(event),
    );
    this.hoverHelp = new ItemHoverHelp(this.overlay.root);
    // A map picture is as big as the window it is in, which only the browser
    // can say once the screen is laid out (`ui/mapPicture.ts`).
    this.overlay.onMeasure = (unit) => {
      this.dockPanel(unit);
      fitMapPictures(this.overlay.root, unit, (key, step) => this.drawPicture(key, step));
    };
    this.render();
    this.offerPendingMoves();
    // A held room stays on its channel while the player gets ready, saying
    // they are at the lab and hearing whether the friend is.
    if (this.roomsOffered) {
      friendRoom()?.atLab();
      let last = this.time.now;
      this.time.addEvent({
        delay: ROOM_TICK_MS,
        loop: true,
        callback: () => {
          const now = this.time.now;
          this.tickRoom(now, now - last);
          last = now;
        },
      });
    }
  }

  /**
   * A level-up that found four moves already known queues the new one on the
   * Pokemon instead of forgetting anything, and base is where the player is
   * around to answer - a raid that settles has nobody watching. Asked one at a
   * time; "decide later" puts that Pokemon off until the next raid and asks
   * the next one (`hub/pendingMoves.ts`).
   */
  private offerPendingMoves(): void {
    const raids = raidsDeployed(this.savedGame.raidProgress);
    const waiting = nextPendingMoveOffer(this.stashPokemon, raids);
    if (!waiting) {
      return;
    }
    const move = waiting.pokemon.pendingMoves[0];
    openMoveChooser(this, { pokemon: waiting.pokemon, incoming: move, canDefer: true }, (choice) => {
      if (choice.kind === 'later') {
        deferPendingMoves(waiting.id, raids);
        this.offerPendingMoves();
        return;
      }
      if (this.movedOnElsewhere()) {
        return;
      }
      const result = waiting.pokemon.resolvePendingMove(
        move,
        choice.kind === 'forget' ? choice.index : null,
      );
      const said = moveChoiceMessage(waiting.pokemon.name, move, result?.forgotten ?? null);
      this.setStatus(
        this.writeGame()
          ? said
          : `${said} It could not be saved.`,
      );
      this.offerPendingMoves();
    });
  }

  private get stashPokemon(): readonly StashedPokemon[] {
    return this.stash.listPokemon();
  }

  /**
   * Every Pokemon at base in the order the player asked for and answering their
   * search - across all boxes, which is what the loadout is drawn from. A
   * Pokemon about to be deployed is never
   * hidden by the box it is kept in.
   */
  private get findablePokemon(): readonly StashedPokemon[] {
    return sortPokemon(searchPokemon(this.stash.listPokemon(), this.stashSearch), this.stashSort);
  }

  /** The Pokemon the stash window lists: this box, or all of them while looking for one. */
  private get shownPokemon(): readonly StashedPokemon[] {
    const scope = this.boxScope === 'all' || this.stashSearch.trim() !== '' ? undefined : this.boxScope;
    const list = scope === undefined ? this.stash.listPokemon() : this.stash.listBoxPokemon(scope);
    return sortPokemon(searchPokemon(list, this.stashSearch), this.stashSort);
  }

  /** Where the stash window is looking, always a box that exists. */
  private get scopeBox(): number | 'all' {
    return this.boxScope === 'all' ? 'all' : Math.min(this.boxScope, this.stash.listBoxes().length - 1);
  }

  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.stash.itemCount(item.id) > 0);
  }

  /**
   * Whether the first contract is still on the board. A save that has banked it
   * is past it, and so is every save while its map is retired
   * (`world/mapRoster.ts`), which is what lets a new game drop straight in
   * wherever the game is played.
   */
  private get firstContractActive(): boolean {
    return availableContracts(this.savedGame.raidProgress.completedContracts).includes(FIRST_CONTRACT);
  }

  /**
   * The contract a raid inserting here would carry. A contract belongs to its
   * map, so the insertion list *is* the contract board: choosing where to drop
   * in is choosing which contract to take, and no separate acceptance step can
   * fall out of step with it.
   */
  private contractFor(insertionId: RunInsertionId): RaidContract | undefined {
    return boardContractForMap(requireInsertion(insertionId).mapId, this.savedGame.raidProgress);
  }

  /**
   * What the party costs in hunter on the raid this insertion would start: the
   * loadout's own tier plus whatever the contract carried there adds. The final
   * check prints it and the deploy spends it, so both ask here.
   */
  private hunterThreatAt(insertionId: RunInsertionId, party: readonly StashedPokemon[]): HunterThreat {
    return hunterThreatFor(
      party.map((stored) => stored.pokemon),
      this.contractFor(insertionId)?.hunterPressure,
      // Whose turn it is: read before `startRun` counts this raid, so the name
      // the final check prints is the one the raid is hunted by.
      rivalForRaid(raidsDeployed(this.savedGame.raidProgress)),
    );
  }

  /**
   * Unlocked entries, narrowed to the active contract's own area while one is
   * running, so a first raid can never be deployed somewhere its objective is
   * unreachable. Every unlocked insertion returns the moment it is banked.
   */
  private get unlockedInsertions(): readonly [RunInsertionId, RunInsertion][] {
    return offeredInsertions(this.savedGame.raidProgress).map((insertion) => [insertion.id, insertion]);
  }

  /** Whether this is a panel over THE RAID ARENA's hall rather than a screen of its own. */
  private get isPanel(): boolean {
    return this.kit !== undefined && ARENA_PANELS.includes(this.view);
  }

  /**
   * Sizes a panel to whole game pixels, which only the browser can do once it
   * knows how many game pixels the window is: the bench, the rack and the locker
   * stand down the right of the window and the rim lies along its foot.
   */
  private dockPanel(unit: number): void {
    if (!this.isPanel) {
      return;
    }
    const layer = this.overlay.root.parentElement;
    const wide = Math.floor((layer?.clientWidth ?? 0) / unit);
    // The rim's is as tall as what it says (`.arena-panel.is-rim`).
    if (this.view !== 'rim') {
      this.overlay.root.style.setProperty('--dock', String(Math.min(wide, Math.max(PANEL_MIN_WIDTH, Math.floor(wide * PANEL_SHARE)))));
    }
  }

  /** Everyone at base who a recovery would actually change. */
  private get injuredPokemon(): readonly StashedPokemon[] {
    return pokemonNeedingRecovery(this.stash);
  }

  private get pendingRecoveryMs(): number {
    return this.savedGame.pendingRecoveryMs;
  }

  /**
   * The clock the next raid starts with, once recovery is taken out of it.
   *
   * An explorer run gets `PLAYTEST_RAID_DURATION_MS` instead, and gets it
   * whole: recovery is priced as a share of a raid, and a mode whose point is
   * an unhurried look at a map must not be able to be pulled out of one.
   */
  private get raidClockMs(): number {
    return isPlaytestRun()
      ? PLAYTEST_RAID_DURATION_MS
      : raidClockAfterRecovery(RAID_DURATION_MS, this.pendingRecoveryMs);
  }

  /** Every workshop upgrade standing at base, by id. */
  private get builtUpgradeIds(): readonly string[] {
    return this.savedGame.raidProgress.workshopUpgrades;
  }

  /**
   * What this base charges for recovery: the bay's discount, and however many of
   * the ward's beds are still unused before the coming raid. Both are derived
   * from the upgrade list on every read, so the lobby cannot quote a price the
   * treatment does not charge.
   */
  private get recoveryTerms(): RecoveryTerms {
    return recoveryTermsFor(this.builtUpgradeIds, this.savedGame.wardTreatmentsUsed);
  }

  /** Whether the ward's free bed would go to this Pokemon if it were treated now. */
  private inWardBed(stored: StashedPokemon): boolean {
    return wardBedIds(this.injuredPokemon, this.recoveryTerms).has(stored.id);
  }

  /** What treating this one Pokemon at the bay costs right now. */
  private recoveryPriceMs(stored: StashedPokemon): number {
    return recoveryCostMs(stored.pokemon, this.recoveryTerms, this.inWardBed(stored));
  }

  /**
   * A recovery price as a tag says it - `Center −0:30`, or `Ward free` when the
   * ward's bed would take this one. Short, because it shares a row with a name
   * and a health bar; the help bar below is where it is spelt out.
   */
  private recoveryPriceLabel(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    return `${this.inWardBed(stored) ? 'Ward' : 'Center'} ${priceMs === 0 ? 'free' : `−${formatRecoveryClock(priceMs)}`}`;
  }

  /**
   * The price alone, for a stash row: beside a ten-letter name and its health
   * bar there is room for `−0:45` and not for the word in front of it.
   */
  private recoveryPriceTag(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    return priceMs === 0 ? 'Free' : `−${formatRecoveryClock(priceMs)}`;
  }

  /** The same price in a sentence, for the help bar of the control that pays it. */
  private recoveryHelp(stored: StashedPokemon): string {
    const priceMs = this.recoveryPriceMs(stored);
    const place = this.inWardBed(stored) ? 'Ward bed' : 'Pokémon Center';
    return priceMs === 0
      ? `${place}: full restore, and it costs this raid nothing.`
      : `${place}: full restore for −${formatRecoveryClock(priceMs)} of raid time.`;
  }

  /**
   * Restores Pokemon at base and books the time to the next raid clock. The
   * scene's own stash is the one treated, so a half-built loadout keeps pointing
   * at the same Pokemon it did before, now healed.
   */
  private recover(ids: readonly string[]): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    const outcome = applyRecovery(this.stash, this.pendingRecoveryMs, ids, this.recoveryTerms);
    if (outcome.recoveredIds.length === 0) {
      this.refuse('Everyone there is already fit.');
      return;
    }

    audioManager.play('heal');
    this.flow?.packRevivedLonePokemon();
    this.savedGame = { ...this.savedGame, pendingRecoveryMs: outcome.pendingRecoveryMs };
    this.savedGame = {
      ...this.savedGame,
      pendingRecoveryMs: outcome.pendingRecoveryMs,
      wardTreatmentsUsed: this.savedGame.wardTreatmentsUsed + outcome.wardTreatmentsUsed,
    };
    const treated =
      outcome.recoveredIds.length === 1
        ? (this.stash.listPokemon().find((stored) => stored.id === outcome.recoveredIds[0])?.pokemon
            .name ?? 'Your Pokémon')
        : `${outcome.recoveredIds.length} Pokémon`;
    const cost =
      outcome.chargedMs === 0
        ? 'no extra raid time'
        : `${formatRecoveryClock(outcome.chargedMs)} of raid time`;
    this.setStatus(
      this.writeGame()
        ? `${treated} recovered for ${cost}. Next raid clock: ${formatRecoveryClock(this.raidClockMs)}.`
        : `${treated} recovered, but the recovery could not be saved.`,
    );
  }

  /**
   * Spends one medicine out of the stash on a Pokemon at base.
   *
   * The stash is the same vault the half-built loadout draws from, so the
   * loadout's own supply counts shrink with it and a deployed stack can never
   * outgrow what is actually held - see `DeploymentFlow.items`.
   */
  private treat(pokemonId: string, itemId: string): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    const result = treatWithItem(this.stash, pokemonId, itemId);
    if (!result.used) {
      this.refuse(result.message);
      return;
    }

    audioManager.play('heal');

    this.setStatus(
      this.writeGame()
        ? result.message
        : `${result.message} The treatment could not be saved.`,
    );
  }

  /**
   * Gives one piece of gear out of the stash to a stashed Pokemon.
   *
   * The stash owns the move in both directions (`Stash.giveHeldItem`), so the
   * piece is either in the supplies or on a Pokemon and never in both, and the
   * loadout's own supply counts shrink with it exactly as a treatment's do.
   */
  private giveGear(pokemonId: string, itemId: string): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    if (!this.stash.giveHeldItem(pokemonId, itemId)) {
      this.refuse('That gear is not at base any more.');
      return;
    }
    audioManager.play('select');
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.name;
    const gear = this.itemName(itemId);
    this.setStatus(
      this.writeGame()
        ? `${name ?? 'Your Pokémon'} is holding the ${gear}. It rides into the raid, and a wipe takes it unless ${name ?? 'it'} is secured.`
        : `${name ?? 'Your Pokémon'} is holding the ${gear}, but it could not be saved.`,
    );
  }

  /** Takes a stashed Pokemon's gear back into the stash's supplies. */
  private takeGear(pokemonId: string): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.name;
    if (!this.stash.takeHeldItem(pokemonId)) {
      this.refuse('There is nothing to take.');
      return;
    }
    audioManager.play('cancel');
    this.setStatus(
      this.writeGame()
        ? `Took the gear back off ${name ?? 'your Pokémon'}. It stays at base.`
        : `Took the gear back off ${name ?? 'your Pokémon'}, but it could not be saved.`,
    );
  }

  /**
   * What this Pokemon carries, and what the stash could give it instead.
   *
   * The chips live in the pane about the Pokemon they act on rather than under
   * every row in the list: gear is a fact about one Pokemon, and repeated on
   * twenty rows it was most of what the stash had on screen. Nothing is
   * `disabled` - the cursor is how this screen explains itself.
   */
  private gearChips(stored: StashedPokemon, shows: string): string {
    const held = getHeldItem(stored.pokemon.heldItemId);
    const offers = HELD_ITEM_DEFINITIONS.filter(
      (item) => this.stash.itemCount(item.id) > 0 && item.id !== stored.pokemon.heldItemId,
    );
    const take = held
      // The chip says the action, because the row above it already says what is
      // held: two lines for one fact is one of them going stale. No glyph on it
      // either - the game's typeface has no cross, and a character it lacks is
      // drawn in whatever face the browser falls back to.
      ? `<button class="px-window px-chip" data-gear-take="${stored.id}" ${shows} data-help="${escapeAttribute(`${held.displayName}: ${held.description} Press to take it back into storage.`)}">Take ${held.displayName}</button>`
      : '';
    const give = offers
      .map(
        (item) =>
          // The verb, for the same reason the take chip carries one: a chip that
          // is only a name reads as a label rather than something to press.
          `<button class="px-window px-chip" data-gear-give="${item.id}" data-gear-pokemon="${stored.id}" ${shows} data-help="${escapeAttribute(`${item.displayName}: ${item.description} Lost with ${stored.pokemon.name} on a wipe.`)}">Give ${item.displayName} ×${this.stash.itemCount(item.id)}</button>`,
      )
      .join('');
    return `${take}${give}${take || give ? '' : '<span class="px-note">No gear at base to give.</span>'}`;
  }

  /** The lone Pokemon a swap would trade away, or undefined while a team remains. */
  private get sparePartner(): StashedPokemon | undefined {
    return this.stash.canSwapStarter() ? this.stashPokemon[0] : undefined;
  }

  /** Preselects the species already held so a swap is never armed by default. */
  private startingStarterId(): StarterSpeciesId {
    const heldId = this.stash.listPokemon()[0]?.pokemon.base.id;
    return heldId === 'charmander' || heldId === 'squirtle' ? heldId : 'bulbasaur';
  }

  /**
   * The strip under a container: what is in your hand, and the way out of it.
   *
   * TIDY is the automatic pack made into a deed rather than the only behaviour
   * there is - the packer will turn a piece on its side to make a mix fit, and
   * a player who does not want to fiddle should have that without fiddling. It
   * says what it will do, because it throws away an arrangement somebody made.
   */
  private arrangeBar(name: 'pack' | 'secure'): string {
    const what = name === 'pack' ? 'pack' : 'container';
    // The chip and nothing else. What the keys do is the help bar's line, said
    // while the cursor is on a block - which is the only moment it is wanted,
    // and the only place on this screen with room for a sentence: the pack
    // stands in a column a third of the stage wide, where a line of
    // instructions wrapped to three rows and clipped the chip in half.
    return `<div class="px-grid-bar"><button class="px-window px-chip" data-tidy="${name}" data-help="${escapeAttribute(`Pack the ${what} again from scratch, turning pieces on their side where that is what makes the mix fit. It replaces how you have laid it out.`)}">Tidy</button></div>`;
  }

  /**
   * Built on first use rather than as a field, because a scene is a Phaser
   * scene: nothing guarantees the constructor ran before `init` does, and the
   * suite drives this one off the prototype.
   */
  private get arranging(): GridArranging {
    this.arrangingValue ??= new GridArranging({
      packing: (name) => (name === 'secure' ? this.flow.secureLayout() : this.flow.bagLayout()),
      commit: (name, arrangement) => {
        if (name === 'secure') {
          this.flow.arrangeSecure(arrangement);
        } else {
          this.flow.arrangeBag(arrangement);
        }
        this.render();
      },
      redraw: () => this.render(),
      remove: (name, ref) => {
        this.removeFromContainer(name, ref);
        return true;
      },
      say: (message) => this.setStatus(message),
      sound: (kind) =>
        audioManager.play(kind === 'refused' ? 'denied' : kind === 'take' ? 'menuOpen' : 'select'),
    });
    return this.arrangingValue;
  }

  /**
   * One of a piece back to the vault, as its row's minus would: one of an item
   * out of the pack, one square of it out of the secure container, a secured
   * Pokémon out of the container whole.
   */
  private removeFromContainer(name: string, ref: GridPieceRef): void {
    if (ref.kind === 'cargo') {
      if (name === 'secure') {
        this.answer(this.flow.toggleSecurePokemon(ref.cargoId), 'cancel');
      }
      return;
    }
    const itemId = ref.itemId as ItemId;
    const item = this.itemName(itemId);
    const left = this.flow.itemQuantity(itemId) - 1;
    const refusal =
      name === 'secure' ? this.flow.adjustSecureItem(itemId, -1) : this.flow.setItemQuantity(itemId, left);
    if (refusal !== undefined) {
      this.refuse(refusal);
      return;
    }
    audioManager.play('cancel');
    this.setStatus(
      name === 'secure'
        ? `Took a square of ${item} out of the container.`
        : left > 0
          ? `Took one ${item} out of the pack. ${left} still packed.`
          : `Took ${item} out of the pack.`,
    );
  }

  private setView(view: HubView): void {
    // A status line answers something done on the screen it was raised on, so
    // it does not follow the player to another: the Pokemon Center's "recovered
    // for 0:50 of raid time" was still in Brock's help bar. A caller
    // that changes screen *and* has something to say sets its status after.
    if (view !== this.view) {
      this.statusTimer?.remove();
      this.statusTimer = undefined;
      this.status = '';
    }
    this.view = view;
    this.swapArmed = false;
    this.workshopArmed = undefined;
    this.traderArmed = undefined;
    this.wallMapInspect = undefined;
    if (view === 'reselect') {
      this.reselectStarterId = this.startingStarterId();
    }
  }

  private confirmSwap(): void {
    if (!this.sparePartner) {
      this.setView('stash');
      this.refuse('Swapping is only offered while one Pokémon remains at base.');
      return;
    }
    if (!this.saveManager.reselectStarter(this.reselectStarterId)) {
      this.setView('stash');
      this.refuse('That swap could not be saved.');
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow, so a swapped-away Pokemon can
      // never linger in a half-built loadout.
      this.applyLoadedGame(reloaded);
    }
    this.setView('stash');
    audioManager.play('confirm');
    this.setStatus(`${getStarterSpecies(this.reselectStarterId).name} is your new partner.`);
  }

  /** Notes the moment an irreversible deal was armed. */
  private armRelease(): void {
    this.releaseArmedAt = performance.now();
  }

  /**
   * Whether a pointer click on a just-armed deal's confirm button is the second
   * half of the double-click that armed it. The armed question is drawn under
   * the pointer the first click left there, so a double-click on SWAP FOR X
   * released the partner for good. Such a click is swallowed and the cursor
   * goes back to the answer that changes nothing. A key press is never one -
   * its click has no `detail` - because the cursor starts on Keep and reaching
   * the confirm button is already a deliberate move.
   */
  private clickedTooSoon(event: MouseEvent, keep: string): boolean {
    if (event.detail === 0 || performance.now() - this.releaseArmedAt >= RELEASE_ARMING_MS) {
      return false;
    }
    this.render();
    this.overlay.focus(keep);
    return true;
  }

  /** What a payment may touch in this save. The rules live in `../hub/workshop`. */
  private get workshopVault(): WorkshopVault {
    return { stash: this.stash };
  }

  /**
   * Arms a rung. A rung that cannot be paid for is still a control - the cursor
   * has to be able to reach it to read what it does - so choosing one is
   * answered with what it is waiting on rather than ignored.
   */
  private armUpgrade(upgradeId: string): void {
    const offer = this.workshopLadder.find((candidate) => candidate.upgrade.id === upgradeId);
    if (!offer || offer.state === 'built') {
      return;
    }
    if (!offer.affordable) {
      this.refuse(this.shortfallLine(offer));
      return;
    }
    this.workshopArmed = upgradeId;
    this.armRelease();
    this.render();
  }

  private buildUpgrade(upgradeId: string): void {
    this.workshopArmed = undefined;
    const result = this.saveManager.buildWorkshopUpgrade(upgradeId);
    if (!result.ok) {
      this.refuse(result.message);
      return;
    }
    if (!result.saved) {
      this.refuse(`${result.upgrade.name} could not be saved, so nothing was spent.`);
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow against the new vault and the new
      // secure slot.
      this.applyLoadedGame(reloaded);
    }
    this.setView('workshop');
    audioManager.play('confirm');
    this.setStatus(`${result.upgrade.name} built.`);
  }

  /**
   * Preparation is opened by walking through the Raid Arena's door, and it
   * never picks a party. A room is a map to raid together, so while one is
   * held the drop-in is on its map: the one chosen if it is, else the first
   * way in there.
   */
  private pointAtHeldRoom(): void {
    const room = this.heldRoom;
    if (room && requireInsertion(this.flow.insertionId).mapId !== room.mapId) {
      const there = this.insertionFor(room.mapId);
      if (there) {
        this.flow.chooseInsertion(there[0]);
      }
    }
  }

  /**
   * Backing out of a screen puts the player back in the room it is kept in.
   *
   * The lobby used to be a screen these four were reached from, so backing out
   * of one meant `setView('home')`. They are keepers in rooms now
   * (`base/rooms.ts`), so leaving one starts the base again inside the room
   * the player walked into - on its door mat, where one key opens the screen
   * again and one step down leaves, and where whatever was just built is now
   * standing.
   */
  private leaveToBase(): void {
    this.flow.restart();
    // Out of a panel is back on the tile it was opened from, in the same hall.
    if (this.kit) {
      this.kit.close();
      return;
    }
    // Out of a keeper's screen is back into their room.
    this.scene.start('base', {
      savedGame: this.savedGame,
      ...(this.enteredFrom === undefined ? {} : { room: this.enteredFrom }),
      ...(this.enteredAt === undefined ? {} : { at: this.enteredAt }),
    });
  }

  /** The only way into a raid: a plan the player walked through and confirmed. */
  private startRun(): void {
    if (this.deploying) {
      return;
    }
    // One raid at a time. A raid still under way in another window is that
    // window's to finish; one nobody is playing was abandoned, and the base is
    // where an abandoned raid is settled and said.
    const underWay = this.saveManager.load()?.raidInFlight;
    if (underWay) {
      if (raidHeartbeat.liveElsewhere(underWay.id)) {
        this.refuse('A raid is already under way in another window. Finish it there first.');
      } else {
        this.leaveToBase();
      }
      return;
    }
    // A raid is played on the vault's own Pokemon and supplies, so a loadout
    // built against a picture of the game another tab has since moved on from
    // - a wipe there took the Pokemon and the gear this one is about to send -
    // must not deploy. The flow is rebuilt against the vault as it stands.
    if (this.movedOnElsewhere()) {
      return;
    }
    const room = this.heldRoom;
    if (room && requireInsertion(this.flow.insertionId).mapId !== room.mapId) {
      this.refuse(`You are in room ${room.code} on ${worldMapName(room.mapId)}. Leave it at the lab to raid somewhere else.`);
      return;
    }
    let deployment: Deployment;
    try {
      deployment = this.flow.deploy();
    } catch {
      this.refuse(this.flow.notReady ?? 'Look down from the rim before you jump.');
      return;
    }

    this.deploying = true;
    audioManager.play('deploy');
    // Counted where it is committed to rather than where it ends: a raid
    // nobody came back from is still a raid you went on, and the difference
    // between the two numbers is what the drop-in screen reads back.
    this.saveManager.recordDeployment(requireInsertion(deployment.insertionId).mapId);
    if (activeSaveSlot() !== 'try-it') {
      countPlay({ kind: 'raid-start', detail: mapDetail(requireInsertion(deployment.insertionId).mapId) });
    }
    const items = deployment.items;
    // And recorded as under way until it ends, so a raid left by closing the
    // tab costs its pack rather than nothing (`run/raidInFlight.ts`).
    const inFlight = createRaidInFlight(
      requireInsertion(deployment.insertionId).mapId,
      items,
      deployment.stashSecureSlot.items ?? [],
      deployment.packItemId,
    );
    if (this.saveManager.recordRaidInFlight(inFlight)) {
      raidHeartbeat.start(inFlight.id);
    }
    activeRunManager.startRun(
      {
        party: deployment.party.map((stored) => stored.pokemon),
        items,
        // The pack is part of the loadout because it is the one thing out of
        // the vault that is risked without ever being in the bag.
        ...(deployment.packItemId === undefined ? {} : { packItemId: deployment.packItemId }),
      },
      // The base clock, less whatever recovery has already been booked against it.
      {
        mapId: requireInsertion(deployment.insertionId).mapId,
        durationMs: this.raidClockMs,
        secureGrid: this.flow.secureGrid,
        securePokemonLimit: this.flow.securePokemonSlots,
        secureFilledForYou: deployment.secureFilledForYou,
      },
      deployment.secureSlot,
    );
    // Remembered on the way out rather than on the way home, because it is what
    // the player chose and a raid that goes badly chose it too.
    new SaveManager().recordSecurePreference(deployment.securePreference);
    new SaveManager().recordBench(deployment.party.map((stored) => stored.id));
    // The same moment, for the same reason: it is what the player chose, and a
    // raid that goes badly chose it too.
    new SaveManager().recordContainerArrangements(
      deployment.bagArrangement,
      deployment.secureArrangement,
    );
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const ownPlan = generateRunPlan(
      seed,
      undefined,
      deployment.insertionId,
      this.contractFor(deployment.insertionId),
      // The same derivation the final check printed, from the same party.
      this.hunterThreatAt(deployment.insertionId, deployment.party),
      // Which bosses are gone, and which of their gates stand open.
      this.savedGame.raidProgress.defeatedBosses,
      // The beacon opens against the clock this raid actually deploys with, so
      // booked recovery shortens the wait for it along with everything else.
      // So does every timed exit and every boat's tide, which come as much
      // sooner as the clock is short and stand as far before its end as drawn.
      {
        raidClockMs: this.raidClockMs,
        ...(hasBeacon(this.builtUpgradeIds) ? { beaconUnlockAtMs: beaconUnlockAtMs(this.raidClockMs) } : {}),
      },
      // Which landmarks the world keeps worked, and whose exits therefore
      // stand open from the first second - the same list the lobby's map read.
      this.savedGame.raidProgress.completedContracts,
      // And the doors a field move has already opened, which are as much a part
      // of this raid's collision as a beaten boss's are.
      this.savedGame.raidProgress.openedGates ?? [],
      // Night by the player's own clock, read as the raid leaves - the same
      // reading the drop-in screen's wildlife was just shown in.
      isNightRaid(new Date()),
      // The legends the Pokedex owns, which stand nowhere this raid.
      caughtLegends(pokedexOwned(this.savedGame.raidProgress.pokedexOwned, this.stash)),
      // What the people at base are waiting on, each laid in its own place.
      errandsToLay(this.savedGame.raidProgress, (itemId) => this.stash.itemCount(itemId)).map(errandLoot),
    );
    // A raid with friends shares its map's ground: the room's loot, laid from
    // the room's seed, in place of this raid's own (`raidRoom/roomLoot.ts`).
    // An errand's thing stays this player's - somebody at their base is waiting.
    const plan =
      room && room.mapId === ownPlan.insertion.mapId
        ? withRoomLoot(ownPlan, generateRoomLoot(room.mapId, room.seed), (loot) => errandForItem(loot.itemId) !== undefined)
        : ownPlan;
    const runSession = createActiveRunSession(
      activeRunManager,
      deployment.secureSlot,
      deployment.stashSecureSlot,
      deployment.party.map((stored) => stored.id),
      items,
      plan.contract ? objectivesForContract(plan.contract) : [],
      plan,
      this.builtUpgradeIds,
      deployment.packItemId,
      deployment.party.find((stored) => stored.id === this.savedGame.stash.partnerId())?.pokemon,
      readLook(this.savedGame.raidProgress.look) ?? undefined,
    );
    const world = {
      party: new PokemonParty(deployment.party.map((stored) => stored.pokemon)),
      // The pack goes into the raid at the size the loadout was packed
      // against, so what the grid refused at base it refuses in the field.
      bag: new Bag(
        Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])),
        this.flow.bagGrid,
        deployment.bagArrangement,
      ),
      runSession,
    };
    // From the rim it is the player who goes: over the fence and down.
    if (this.kit) {
      this.kit.jump(world);
      return;
    }
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('world', world);
    });
  }

  private goBack(): void {
    // The swap is reached from the stash, so backing out of it returns there
    // rather than dropping the player two screens out to the base.
    if (this.view === 'reselect') {
      this.setView('stash');
      this.render();
      return;
    }
    // Reading one map close up backs out to all four, not out of the lab.
    if (this.view === 'wallmap' && this.wallMapInspect !== undefined) {
      this.wallMapInspect = undefined;
      this.render();
      return;
    }
    // Backing out of a rung that is asking puts the question down, not the screen.
    if (this.view === 'workshop' && this.workshopArmed !== undefined) {
      this.workshopArmed = undefined;
      this.render();
      return;
    }
    this.leaveToBase();
  }

  private handleKey(event: KeyboardEvent): void {
    // A piece in the player's hand owns the arrow keys, R, ENTER and ESC, so it
    // is asked before the cursor is: carrying something and pressing Left has
    // exactly one meaning, and it is not "move to the pane on the left".
    if (this.arranging.handleKey(event, document.activeElement)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && (this.boxMoving || this.boxEditing)) {
      event.preventDefault();
      audioManager.play('cancel');
      this.boxMoving = undefined;
      this.boxEditing = undefined;
      this.render();
      return;
    }
    // A deal asked again is a YES/NO box, and ESC on one is NO, as B is in
    // FireRed: it puts the question down and stays at the counter.
    if (event.key === 'Escape' && (this.swapArmed || this.workshopArmed !== undefined || this.traderArmed !== undefined)) {
      event.preventDefault();
      audioManager.play('cancel');
      this.swapArmed = false;
      this.workshopArmed = undefined;
      this.traderArmed = undefined;
      this.render();
      return;
    }
    // Every room has a way out now, Oak's Lab included, and `goBack` knows
    // where each one leads: a step of preparation back to the lab, and the lab
    // itself back out into the yard.
    if (event.key === 'Escape') {
      event.preventDefault(); audioManager.play('cancel'); this.goBack(); return;
    }
    const group = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.px-count');
    if (group) {
      const value = Number(group.dataset.countValue);
      const min = Number(group.dataset.countMin);
      const max = Number(group.dataset.countMax);
      const target = countKeyTarget(event.key, event.shiftKey, value, min, max);
      if (target !== undefined) {
        event.preventDefault();
        this.stepCount(group, target - value + (target === value && (event.key === 'ArrowRight' || event.key === 'PageUp') ? 1 : 0));
        return;
      }
      if (this.stepToNeighbourCount(group, event.key)) {
        event.preventDefault();
        return;
      }
    }
    // On the rim the arrows point at the map, and the cursor stays on JUMP IN.
    if (this.view === 'rim') {
      const way = RIM_ARROWS[event.key];
      if (way) {
        event.preventDefault();
        this.stepToWayIn(way);
        return;
      }
    }
    // A deal being asked again is a YES/NO box, and the arrows stay in it.
    const answers = [...this.overlay.root.querySelectorAll<HTMLElement>('.px-arming .px-bar-actions button')];
    if (answers.length > 0 && focusDirectionForKey(event.key)) {
      event.preventDefault();
      answers[askedDealIndex(event.key, answers.indexOf(document.activeElement as HTMLElement), answers.length)]?.focus();
      return;
    }
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Up or Down from a count selector to the next one of the same kind, in the
   * list's reading order (`neighbourCountIndex`), landing on the same end of
   * it - or on the other end, when that one is shut (a minus at nothing).
   * False off either end of the list, so the ordinary cursor takes the key.
   */
  private stepToNeighbourCount(group: HTMLElement, key: string): boolean {
    const kind = group.dataset.count?.split(':')[0];
    const groups = [...document.querySelectorAll<HTMLElement>('.px-count')].filter(
      (other) => other.dataset.count?.split(':')[0] === kind && other.offsetParent !== null,
    );
    const next = groups[neighbourCountIndex(key, groups.indexOf(group), groups.length) ?? -1];
    if (!next) {
      return false;
    }
    const dir = (document.activeElement as HTMLElement | null)?.dataset.countDir ?? '1';
    const buttons = [...next.querySelectorAll<HTMLButtonElement>('button[data-count-dir]')].filter((button) => !button.disabled);
    (buttons.find((button) => button.dataset.countDir === dir) ?? buttons[0])?.focus();
    return true;
  }

  /**
   * Moves one count selector by `delta`, wherever it stands. A selector's
   * ceiling is already every real limit cut down, so a move that lands is
   * accepted as asked and one that cannot go anywhere says why on the status
   * line rather than doing nothing - the same words the plus carries when it
   * is inert.
   */
  private stepCount(group: HTMLElement | null, delta: number): void {
    if (!group) {
      return;
    }
    const [kind, ...rest] = (group.dataset.count ?? '').split(':');
    const id = rest.join(':');
    const value = Number(group.dataset.countValue);
    const min = Number(group.dataset.countMin);
    const max = Number(group.dataset.countMax);
    const target = clampCount(value + delta, min, max);
    if (target === value) {
      const step = group.querySelector<HTMLElement>(`[data-count-dir="${delta > 0 ? 1 : -1}"]`);
      if (delta > 0) {
        this.refuse(step?.dataset.help ?? 'That is as many as there is room for.');
      } else if (delta < 0 && step?.dataset.help) {
        this.refuse(step.dataset.help);
      }
      return;
    }
    if (kind === 'item') {
      this.answer(this.flow.setItemQuantity(id as ItemId, target), 'select');
    } else if (kind === 'secure') {
      this.answer(this.flow.setSecureSquares(id as ItemId, target), 'select');
    } else if (kind === 'buy' || kind === 'barter') {
      this.counterCounts.set(`${kind}:${id}`, target);
      audioManager.play('select');
    } else {
      return;
    }
    this.render();
  }

  /**
   * Every room is headed with the name over the door the player walked through
   * (`base/doors.ts`), because the two being different is the one thing a
   * walkable base can get wrong that a lobby could not: a building captioned
   * BROCK'S WORKSHOP opening onto a screen headed `The Outfitter` reads as two
   * places. What each keeper *trades in* - the Outfitter's ladder, the
   * Ferryman's counters - is unchanged everywhere it is said inside.
   */
  private get heading(): string {
    if (this.view === 'stash') return 'Bill’s PC';
    if (this.view === 'reselect') return 'Swap your partner';
    if (this.view === 'workshop') return 'Brock’s Workshop';
    if (this.view === 'trader') return 'Bill’s Cottage';
    if (this.view === 'wallmap') return this.wallMapInspect ? worldMapName(this.wallMapInspect) : 'The wall map';
    if (this.view === 'daycare') return 'Day-Care';
    if (this.view === 'friend') return 'Raid with a friend';
    if (this.view === 'bench') return 'The bench';
    if (this.view === 'rack') return 'The armoury rack';
    if (this.view === 'locker') return 'The locker';
    return 'The rim';
  }

  private get backLabel(): string {
    if (this.view === 'reselect') return 'Center';
    // Out of a screen is back into the room it is kept in (`base/rooms.ts`),
    // so the label names the room that puts you in.
    if (this.view === 'stash') return 'Center';
    if (this.view === 'workshop') return 'Workshop';
    if (this.view === 'trader') return 'Cottage';
    if (this.view === 'wallmap') return this.wallMapInspect ? 'Wall map' : 'Lab';
    // He stands in the yard, so out of his screen is out into it.
    if (this.view === 'daycare') return 'Yard';
    if (this.view === 'friend') return 'Lab';
    return 'Hall';
  }

  /** What the keys do, said once along the bottom of every screen. */
  private get hints(): string {
    return 'ARROWS move · ENTER choose · ESC back';
  }

  private render(): void {
    const root = this.overlay.root;
    // A redraw of the screen already showing keeps its lists where they were
    // scrolled (`MenuOverlay.redraw`); arriving at another screen starts it at
    // the top.
    const screen = `${this.view}:${this.wallMapInspect ?? ''}`;
    const sameScreen = screen === this.drawnScreen;
    this.drawnScreen = screen;
    const markup = pixelScreen({
      // Said once, on the screen the player arrives at. Every other view is
      // reached from it and carries its own way back, so repeating the town on
      // all five of them only spent the one line of the screen that is short of
      // room - at the smallest stage Brock's old payment screen had a back
      // label, a place, a title and a count on 320 pixels.
      // Which of the two games this is, on every view of it, because the one
      // thing a player must never be unsure of is whether what they are about
      // to spend is real (`dev/playtestMode.ts`).
      // Which of the two games this is, and nothing else: where the player is
      // standing is said by the way out, which every room now carries. Said in
      // both places it read `THE HARBOUR THE HARBOUR OAK'S LAB`.
      place: isPlaytestRun() ? PLAYTEST_PLACE_LABEL : undefined,
      title: this.heading,
      // Every room has a way out now, Oak's Lab included: it is a building the
      // player walked into rather than the screen everything else hangs off.
      back: { label: this.backLabel, attribute: 'data-back' },
      aside:
        this.isPanel || ARENA_PANELS.includes(this.view)
          ? this.panelAside()
          : this.view === 'reselect'
            ? undefined
            : // On the stash the counts are the two lists on screen, so the
              // aside carries the one fact the screen turns on instead - the
              // clock the Pokemon Center is spending. It was said by the Pokémon
              // window's own note and again by the bay's line under it.
              this.view === 'stash'
              ? `Next raid clock ${formatRecoveryClock(this.raidClockMs)}`
              // On the boat the one fact every deal turns on is the money, so
              // it is the title bar's aside rather than a line inside a pane
              // that scrolls away from the row being priced.
              : this.view === 'trader'
                ? formatMoney(moneyHeld(this.stash))
                : this.view === 'wallmap'
                  ? wallMapNote(this.savedGame)
                  : this.view === 'daycare'
                    ? `${this.stashPokemon.length} Pokémon at base`
                    // Kinds, as the Pokémon Center's own pane counts them:
                    // "7 items" over three Potions and three Poké Balls read
                    // as a miscount (playtest 6).
                    : `${this.stashPokemon.length} Pokémon · ${this.stashItems.length} ${this.stashItems.length === 1 ? 'kind' : 'kinds'} of item`,
      body: this.content(),
      hints: this.hints,
      status: this.status || undefined,
    });
    if (sameScreen) {
      this.overlay.redraw(markup);
    } else {
      root.innerHTML = markup;
    }
    const on = (selector: string, handler: (button: HTMLButtonElement, event: MouseEvent) => void): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = (event) => handler(button, event);
      });
    };
    const rerender = (change: () => void): void => {
      change();
      this.render();
    };
    this.arranging.attach(root);
    this.hoverHelp?.redrawn();
    on('[data-tidy]', (button) => {
      if (button.dataset.tidy === 'secure') {
        this.flow.tidySecure();
      } else {
        this.flow.tidyBag();
      }
      this.arranging.release();
      audioManager.play('select');
      this.render();
    });
    on('[data-back]', () => this.goBack());
    on('[data-view]', (button) => rerender(() => this.setView(button.dataset.view as HubView)));
    on('[data-starter]', (button) =>
      rerender(() => {
        this.reselectStarterId = button.dataset.starter as StarterSpeciesId;
        this.swapArmed = false;
      }),
    );
    on('[data-box-step]', (button) => this.stepBox(Number(button.dataset.boxStep)));
    on('[data-box-sort]', () => rerender(() => { this.stashSort = nextStashSort(this.stashSort); }));
    on('[data-box-find]', () => rerender(() => { this.boxEditing = 'find'; }));
    on('[data-box-clear]', () => rerender(() => { this.stashSearch = ''; }));
    on('[data-box-rename]', () => rerender(() => { this.boxEditing = 'rename'; }));
    on('[data-box-new]', () => this.addBoxAndShow());
    on('[data-box-delete]', () => this.deleteBox());
    on('[data-box-move]', (button) =>
      this.boxMoving === button.dataset.boxMove
        ? rerender(() => { this.boxMoving = undefined; })
        : this.pickUp(button.dataset.boxMove!),
    );
    on('[data-box-drop]', (button) => this.putDown(button.dataset.boxDrop!));
    on('[data-box-cancel]', () => rerender(() => { this.boxEditing = undefined; this.boxMoving = undefined; }));
    this.wireBoxForm(root);
    on('[data-swap-arm]', () => rerender(() => { this.swapArmed = true; this.armRelease(); }));
    on('[data-swap-cancel]', () => rerender(() => { this.swapArmed = false; }));
    on('[data-swap-confirm]', (_button, event) => {
      if (!this.clickedTooSoon(event, '[data-swap-cancel]')) this.confirmSwap();
    });
    // Materials are spent for good, so a rung asks before it takes them: the
    // first press arms it and the second is a different button, with the cursor
    // on the one that keeps them (`armedDeal`), exactly as Bill's barters do.
    on('[data-outfit]', (button) => this.armUpgrade(button.dataset.outfit!));
    on('[data-built]', (button) =>
      this.setStatus(`${getWorkshopUpgrade(button.dataset.built!)?.name ?? 'That upgrade'} already stands at base.`),
    );
    on('[data-outfit-confirm]', (button, event) => {
      if (!this.clickedTooSoon(event, '[data-deal-cancel]')) this.buildUpgrade(button.dataset.outfitConfirm!);
    });
    on('[data-buy]', (button) => {
      const count = this.counterCounts.get(`buy:${button.dataset.buy}`) ?? 1;
      this.counterCounts.delete(`buy:${button.dataset.buy}`);
      this.dealAtCounter(() => this.saveManager.buyTraderStock(button.dataset.buy!, count));
    });
    // Found goods are gone for good, so the row asks before it takes them: the
    // first press arms the deal and the second is a different button, with the
    // cursor on the one that keeps them (`armedDeal`).
    on('[data-barter]', (button) => rerender(() => { this.traderArmed = button.dataset.barter; this.armRelease(); }));
    on('[data-deal-cancel]', () => rerender(() => { this.traderArmed = undefined; this.workshopArmed = undefined; }));
    on('[data-barter-confirm]', (button, event) => {
      if (this.clickedTooSoon(event, '[data-deal-cancel]')) return;
      const barterId = button.dataset.barterConfirm!;
      const count = this.counterCounts.get(`barter:${barterId}`) ?? 1;
      this.counterCounts.delete(`barter:${barterId}`);
      this.traderArmed = undefined;
      this.dealAtCounter(() => this.saveManager.takeTraderBarter(barterId, count));
    });
    on('[data-count-dir]', (button, event) =>
      this.stepCount(button.closest<HTMLElement>('.px-count'), Number(button.dataset.countDir) * (event.shiftKey ? COUNT_BIG_STEP : 1)),
    );
    on('[data-berth]', () => rerender(() => { this.traderArmed = BERTH_DEAL; this.armRelease(); }));
    on('[data-berth-confirm]', (_button, event) => {
      if (this.clickedTooSoon(event, '[data-deal-cancel]')) return;
      this.traderArmed = undefined;
      this.dealAtCounter(() => this.saveManager.buyTraderBerth());
    });
    on('[data-refused]', (button) => this.setStatus(button.dataset.refused));
    on('[data-recover]', (button) => this.recover([button.dataset.recover!]));
    on('[data-supply]', (button) => this.setStatus(button.dataset.help));
    on('[data-fit]', (button) => {
      const name = this.stashPokemon.find((stored) => stored.id === button.dataset.fit)?.pokemon.name;
      this.setStatus(`${name ?? 'That Pokémon'} is fit. There is nothing to recover.`);
    });
    on('[data-pokemon]', (button) => this.answer(this.flow.togglePokemon(button.dataset.pokemon!), 'select'));
    on('[data-pack]', (button) => this.answer(this.flow.choosePack(button.dataset.pack! as PackItemId), 'select'));
    on('[data-treat-item]', (button) => this.treat(button.dataset.treatPokemon!, button.dataset.treatItem!));
    on('[data-gear-give]', (button) => this.giveGear(button.dataset.gearPokemon!, button.dataset.gearGive!));
    on('[data-gear-take]', (button) => this.takeGear(button.dataset.gearTake!));
    on('[data-secure-pokemon]', (button) => {
      // It refuses by the squares now, so the message is the whole point of the
      // press: an Ivysaur that will not go into a 2x2 container says why, on
      // the same status line every other refusal on this screen uses.
      const refusal = this.flow.toggleSecurePokemon(button.dataset.securePokemon!);
      if (refusal) {
        this.answer(refusal, 'select');
        return;
      }
      rerender(() => undefined);
    });
    // Another map to look down on.
    on('[data-insertion]', (button) => {
      this.pointAtLanding(button.dataset.insertion as RunInsertionId);
    });
    on('[data-wall-map]', (button) =>
      rerender(() => {
        this.wallMapInspect = button.dataset.wallMap as WorldMapId;
      }),
    );
    on('[data-start]', () => this.startRun());
    on('[data-room-map]', (button) => this.makeRoom(button.dataset.roomMap!));
    on('[data-room-leave]', () => this.leaveRoom());
    this.wireRoomForm(root);
    on('[data-day-care-leave]', (button) => this.leaveAtDayCare(button.dataset.dayCareLeave!));
    // The way in the player is stood over is in view in its list, whichever it is.
    root.querySelector<HTMLElement>('[data-insertion].is-selected')?.scrollIntoView?.({ block: 'nearest' });
    // The cursor starts on what the screen is for, never on the way out of it.
    this.overlay.refocus('.px-field', '[data-cursor-start]', '.px-body button:not([disabled])', 'button');
  }

  /**
   * The picture a canvas on this screen asks for, at the step the overlay
   * fitted it to (`ui/mapPicture.ts`): a map on Oak's wall.
   */
  private drawPicture(key: string, step: number): Minimap | undefined {
    const [kind, id] = key.split(':');
    if (kind === 'wall' && (wallMapOrder(this.savedGame) as readonly string[]).includes(id)) {
      return wallMapPicture(this.savedGame, id as WorldMapId, step);
    }
    return undefined;
  }

  /** What a panel's title bar says at a glance: the number that panel is about. */
  private panelAside(): string {
    if (this.view === 'bench') return `${this.flow.party.length}/${MAX_RUN_PARTY} Pokémon`;
    if (this.view === 'rack') return `${this.flow.bagCells.used}/${this.flow.bagCells.total} squares`;
    if (this.view === 'locker') return `${this.flow.secureCells.used}/${this.flow.secureCells.total} squares`;
    return isPlaytestRun() ? '' : formatRecoveryClock(this.raidClockMs);
  }

  private content(): string {
    if (this.view === 'stash') return this.stashView();
    if (this.view === 'reselect') return this.reselectView();
    if (this.view === 'workshop') return this.workshopView();
    if (this.view === 'trader') return this.traderView();
    if (this.view === 'wallmap') return this.wallMapView();
    if (this.view === 'daycare') return this.dayCareView();
    if (this.view === 'friend') return this.friendView();
    if (this.view === 'bench') return this.benchView();
    if (this.view === 'rack') return this.rackView();
    if (this.view === 'locker') return this.lockerView();
    return this.rimView();
  }

  private get roomsOffered(): boolean {
    return friendRoomsOffered();
  }

  /** The room this browser holds, if raiding with a friend is offered here at all. */
  private get heldRoom(): {
    readonly code: string;
    readonly mapId: WorldMapId;
    readonly hostName: string | null;
    readonly seed: number;
  } | null {
    const room = this.roomsOffered ? friendRoom()?.room : null;
    return room ? { code: room.code, mapId: room.mapId as WorldMapId, hostName: room.hostName, seed: room.seed } : null;
  }

  /** The line preparation carries while a room is held: whose room, and that the raid is on its map. */
  private roomNote(): string {
    const room = this.heldRoom;
    return room
      ? `<small class="px-wrap room-note">${room.hostName ? `${room.hostName}’s room` : 'Your room'} ${room.code} · you each raid ${worldMapName(room.mapId)} on your own clock</small>`
      : '';
  }

  /** The maps a room can be made on: every map this save can drop into, once each. */
  private get roomMaps(): readonly RoomMapChoice[] {
    const seen = new Set<string>();
    return this.unlockedInsertions.flatMap(([, insertion]) => {
      if (seen.has(insertion.mapId)) {
        return [];
      }
      seen.add(insertion.mapId);
      return [{ mapId: insertion.mapId, name: worldMapName(insertion.mapId) }];
    });
  }

  private friendView(): string {
    const room = this.heldRoom;
    const mapName = room ? worldMapName(room.mapId) : '';
    return friendRoomView({
      room: room ? { code: room.code, mapName, hostName: room.hostName } : null,
      friendLine: room ? friendStatusLine(friendRoom()?.friends() ?? [], room.code, mapName) : '',
      maps: this.roomMaps,
      name: raidName(),
      busy: this.roomBusy,
      typed: this.roomTyped,
    });
  }

  /** Makes a room on this map and shows its code. */
  private makeRoom(mapId: string): void {
    const name = raidName();
    const rooms = friendRoom();
    if (this.roomBusy || !name || !rooms || !this.roomMaps.some((map) => map.mapId === mapId)) {
      return;
    }
    this.askRoom(() => rooms.open(mapId, name), 'Your room is open.');
  }

  /** Joins the room with the code typed, if this save can drop into its map. */
  private joinRoom(typed: string): void {
    const name = raidName();
    const rooms = friendRoom();
    const code = typedRoomCode(typed);
    this.roomTyped = code;
    if (this.roomBusy || !name || !rooms) {
      return;
    }
    if (code.length < 4) {
      this.refuse('A room code is four letters.');
      return;
    }
    this.askRoom(async () => {
      const answer = await rooms.join(code, name);
      if (!answer.ok) {
        return answer;
      }
      // The friend's map has to be one this save can drop into: a room is a
      // map to raid together, never a way past the door this save has not
      // opened yet.
      const mapId = answer.room.mapId;
      if (!worldMapIds().includes(mapId as WorldMapId) || !this.insertionFor(mapId as WorldMapId)) {
        rooms.leave();
        return {
          ok: false,
          reason: worldMapIds().includes(mapId as WorldMapId)
            ? `That room is on ${worldMapName(mapId as WorldMapId)}, which you cannot drop into yet.`
            : 'That room is on a map this game does not have.',
        } as const;
      }
      return answer;
    }, 'You are in the room.');
  }

  private askRoom(ask: () => Promise<{ readonly ok: boolean; readonly reason?: string }>, done: string): void {
    this.roomBusy = true;
    this.render();
    void ask().then((answer) => {
      this.roomBusy = false;
      if (!this.sys.isActive() || this.view !== 'friend') {
        return;
      }
      if (answer.ok) {
        this.roomTyped = '';
        audioManager.play('confirm');
        this.render();
        this.setStatus(done);
      } else {
        this.render();
        this.refuse(answer.reason ?? 'That did not work. Try again.');
      }
    });
  }

  private leaveRoom(): void {
    friendRoom()?.leave();
    this.render();
    this.setStatus('You left the room.');
  }

  private wireRoomForm(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>('[data-room-form]');
    const field = form?.querySelector<HTMLInputElement>('.px-field');
    if (!form || !field) {
      return;
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      this.joinRoom(field.value);
    };
    // Only the letters a code is made of, in capitals, as they are typed.
    field.oninput = () => {
      const tidy = typedRoomCode(field.value);
      if (tidy !== field.value) {
        field.value = tidy;
      }
      this.roomTyped = tidy;
    };
    // As the stash's fields: key up is what reaches a field, so the arrows
    // step off it here and Escape backs out of the screen.
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        this.goBack();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.overlay.moveCursor(event.key);
      }
    };
  }

  /**
   * Says who is in the room without rebuilding the screen (a rebuild between
   * a press and its release eats the click): only the friend's line changes.
   */
  private tickRoom(nowMs: number, deltaMs: number): void {
    const rooms = this.roomsOffered ? friendRoom() : null;
    if (!rooms) {
      return;
    }
    rooms.tick(nowMs, deltaMs);
    const room = this.heldRoom;
    const line = this.overlay?.root.querySelector<HTMLElement>('[data-room-friend]');
    if (room && line) {
      const said = friendStatusLine(rooms.friends(), room.code, worldMapName(room.mapId));
      if (line.textContent !== said) {
        line.textContent = said;
      }
    }
  }

  /** The unlocked insertion a contract is taken from, if the player can reach it yet. */
  private insertionFor(
    mapId: WorldMapId,
  ): readonly [RunInsertionId, RunInsertion] | undefined {
    return this.unlockedInsertions.find(([, insertion]) => insertion.mapId === mapId);
  }

  /** One line of condition, so "fainted" is never hidden behind an HP number. */
  private conditionLine(stored: StashedPokemon): string {
    return conditionLine(stored.pokemon);
  }

  /**
   * Name, health bar and state on one line; the condition in words under it,
   * and the gear it is carrying on the end of that.
   *
   * The gear is said here rather than only in the stash, because this one line
   * is every list a Pokemon appears in at base - the stash, the loadout, the
   * secure slot and the final check - and what a Pokemon takes into the raid is
   * exactly the thing the last two of those are asking about.
   */
  private pokemonRowBody(stored: StashedPokemon, tag: string, boxName?: string): string {
    const { pokemon } = stored;
    const held = getHeldItem(pokemon.heldItemId);
    return `<span class="px-row-main"><span class="px-row-line">${pixelPokemonName(pokemon)}${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${this.conditionLine(stored)}${held ? ` \u00b7 holding ${held.displayName}` : ''}${boxName ? ` \u00b7 ${escapeAttribute(boxName)}` : ''}</small></span>${tag}`;
  }

  /**
   * The treatment surface, in the pane about the Pokemon it would treat.
   *
   * It offers both prices side by side before either is paid: one medicine out
   * of the stash, or a full restore at the Pokemon Center for raid time. What
   * each would do is in the help bar the moment the cursor is on it, and a
   * medicine that would do nothing can still be pointed at to be told why - a
   * player should never have to spend a Potion to find out what it does.
   *
   * It used to be a strip under every hurt row, which on a stash of two dozen
   * made half the rows three lines tall and the list unscannable - and it is
   * about the one Pokemon the cursor is on, which is what a detail pane is.
   */
  private careChips(stored: StashedPokemon, shows: string): string {
    const { pokemon } = stored;
    if (!needsRecovery(pokemon)) {
      return '<span class="px-note">Fit to raid.</span>';
    }
    const options = treatmentOptions(this.stash, pokemon);
    const medicine = options.length
      ? options.map((option) => this.careOption(stored.id, option, shows)).join('')
      : '<span class="px-note">No medicine at base.</span>';
    const bay = `<button class="px-window px-chip" data-recover="${stored.id}" ${shows} data-help="${this.recoveryHelp(stored)}">${this.recoveryPriceLabel(stored)}</button>`;
    return `${pokemon.isFainted ? `<span class="px-note px-wrap">${FAINTED_TREATMENT_NOTE}</span>` : ''}${medicine}${bay}`;
  }

  private careOption(pokemonId: string, option: TreatmentOption, shows = ''): string {
    // Not `disabled`: a disabled control cannot take the cursor, and the cursor
    // is how this screen says why a medicine would do nothing.
    return `<button class="px-window px-chip" data-treat-pokemon="${pokemonId}" data-treat-item="${option.itemId}" ${shows} data-help="${escapeAttribute(`${option.displayName}: ${option.effect}.`)}"${option.usable ? '' : ' aria-disabled="true"'}>${option.displayName} ×${option.held}</button>`;
  }

  /**
   * Writes this screen's game - the one place the Pokemon Center, the
   * treatment bench, gear and the boxes save. Refused, with nothing written,
   * once another tab has written the save since this screen read it: this is
   * a whole copy of the game, and written over a newer one it erased a banked
   * contract or undid a wipe. Every action that ends here asks
   * `movedOnElsewhere` before it changes anything, so in play a refusal here
   * is only ever a backstop.
   */
  private writeGame(): boolean {
    if (this.saveManager.stamp() !== this.saveStamp) {
      return false;
    }
    const saved = this.saveManager.save({ ...this.savedGame, stash: this.stash });
    this.saveStamp = this.saveManager.stamp();
    return saved;
  }

  /**
   * Whether the save has moved on since this screen read it - another tab
   * banked a raid, lost one, built or bought something - and if so, brings the
   * screen up to date and says so instead of doing what was asked. The press
   * was made against a picture of a game that no longer exists (the Pokemon it
   * named may have been wiped), so it is refused rather than replayed.
   */
  private movedOnElsewhere(): boolean {
    if (this.saveManager.stamp() === this.saveStamp) {
      return false;
    }
    const reloaded = this.saveManager.load();
    if (reloaded) {
      const view = this.view;
      this.applyLoadedGame(reloaded);
      this.view = view;
    }
    this.refuse(STALE_SAVE_REFUSAL);
    return true;
  }

  private saveStash(said: string, failed: string): void {
    this.setStatus(this.writeGame() ? said : failed);
  }

  private chip(attributes: string, help: string, label: string, disabled = false): string {
    return `<button class="px-window px-chip" ${attributes} data-help="${escapeAttribute(help)}"${disabled ? ' aria-disabled="true"' : ''}>${label}</button>`;
  }

  /**
   * The strip that leads every list of Pokemon at base: where you are looking
   * (the stash only), the order, and a search. It is sticky at the top of its
   * own scroll pane, so however long the list is the way to narrow it is on
   * screen. A field replaces it while one is being typed into, and picking a
   * Pokemon up replaces it with the boxes it could go to.
   */
  private browseBar(inStash: boolean, manage = ''): string {
    const boxes = this.stash.listBoxes();
    if (this.boxEditing) {
      const renaming = this.boxEditing === 'rename';
      const scope = this.scopeBox;
      const value = renaming && scope !== 'all' ? boxes[scope].name : this.stashSearch;
      return `<form class="box-bar box-form" data-box-form="${this.boxEditing}"><input class="px-window px-field" name="text" value="${escapeAttribute(value)}" maxlength="${renaming ? MAX_BOX_NAME_LENGTH : 16}" autocomplete="off" spellcheck="false" aria-label="${renaming ? 'Box name' : 'Find a Pokémon'}" placeholder="${renaming ? 'Box name' : 'A name, e.g. pika'}" /><button type="submit" class="px-window px-chip" data-help="${renaming ? 'Keep this name.' : 'Show only Pokémon whose name begins with this. Empty shows everyone.'}">${renaming ? 'Save' : 'Find'}</button><button type="button" class="px-window px-chip" data-box-cancel data-help="Leave it as it was.">Cancel</button></form>`;
    }
    const moving = this.boxMoving ? this.stash.listPokemon().find((entry) => entry.id === this.boxMoving) : undefined;
    if (inStash && moving) {
      const from = this.stash.boxIndexOf(moving.id);
      const destinations = boxes
        .map((box, index) => {
          const here = index === from;
          const full = !this.stash.boxHasRoom(index);
          return this.chip(
            `data-box-drop="${index}"`,
            here
              ? `${moving.pokemon.name} is already in ${box.name}.`
              : full
                ? `${box.name} is full (${BOX_CAPACITY}).`
                : `Put ${moving.pokemon.name} in ${box.name}, which holds ${box.pokemonIds.length} of ${BOX_CAPACITY}.`,
            box.name,
            here || full,
          );
        })
        .join('');
      return `<div class="box-bar"><div class="box-line"><span class="box-title">Put ${moving.pokemon.name} in</span>${this.chip('data-box-cancel', 'Leave it where it is.', 'Cancel')}</div><div class="box-line">${destinations}${this.chip('data-box-drop="new"', `A new empty box, and ${moving.pokemon.name} goes in it.`, 'New box')}</div></div>`;
    }
    const sort = this.chip(
      'data-box-sort',
      `Ordered: ${STASH_SORT_LABELS[this.stashSort]}. ${STASH_SORT_HELP[this.stashSort]} Press for the next order.`,
      `Sort: ${STASH_SORT_LABELS[this.stashSort]}`,
    );
    const searching = this.stashSearch.trim() !== '';
    const find = this.chip(
      'data-box-find',
      searching ? 'Change what you are looking for.' : 'Find a Pokémon by name, in every box.',
      searching ? `Find: ${escapeAttribute(this.stashSearch.trim())}` : 'Find',
    );
    const clear = searching ? this.chip('data-box-clear', 'Show everyone again.', 'Clear') : '';
    if (!inStash) {
      return `<div class="box-bar"><div class="box-line">${sort}${find}${clear}</div></div>`;
    }
    const scope = this.scopeBox;
    const box = scope === 'all' ? undefined : boxes[scope];
    const label = searching
      ? `Found \u00b7 ${this.shownPokemon.length}`
      : box
        ? `${box.name} \u00b7 ${box.pokemonIds.length}/${BOX_CAPACITY}`
        : `All boxes \u00b7 ${this.stashPokemon.length}`;
    if (searching) {
      // Looking for one across every box: the boxes themselves are not the
      // question, so their controls give way to the ones that narrow it.
      return `<div class="box-bar"><div class="box-line"><span class="box-title">${escapeAttribute(label)}</span></div><div class="box-line">${sort}${find}${clear}</div></div>`;
    }
    // Naming and adding boxes is the third line of the one strip rather than a
    // row of the list under it: outside the strip it scrolled, and a strip that
    // sticks to the top of the pane then clipped it through the middle.
    return `<div class="box-bar"><div class="box-line">${this.chip('data-box-step="-1"', 'The box before this one.', 'Prev')}<span class="box-title">${escapeAttribute(label)}</span>${this.chip('data-box-step="1"', 'The next box. After the last is every box at once.', 'Next')}</div><div class="box-line">${sort}${find}</div>${manage}</div>`;
  }

  /**
   * Naming, adding and taking away boxes: the last line of the strip that leads
   * the list, beside where you are looking and how it is ordered.
   */
  private boxManage(): string {
    const scope = this.scopeBox;
    if (this.boxMoving || this.boxEditing || this.stashSearch.trim() !== '') {
      return '';
    }
    const boxes = this.stash.listBoxes();
    const box = scope === 'all' ? undefined : boxes[scope];
    const rename = box ? this.chip('data-box-rename', `Give ${box.name} another name.`, 'Rename') : '';
    const remove =
      box && box.pokemonIds.length === 0 && boxes.length > 1
        ? this.chip('data-box-delete', `${box.name} is empty. Take it away.`, 'Delete')
        : '';
    return `<div class="box-line box-manage">${rename}${this.chip('data-box-new', 'Add an empty box on the end.', 'New box')}${remove}</div>`;
  }

  /** Prev and Next walk the boxes and then a last stop that is all of them. */
  private stepBox(direction: number): void {
    const stops = this.stash.listBoxes().length + 1;
    const at = this.scopeBox === 'all' ? stops - 1 : this.scopeBox;
    const next = (at + direction + stops) % stops;
    this.boxScope = next === stops - 1 ? 'all' : next;
    this.render();
  }

  private pickUp(pokemonId: string): void {
    this.boxMoving = pokemonId;
    this.boxEditing = undefined;
    audioManager.play('select');
    this.render();
  }

  private putDown(destination: string): void {
    const id = this.boxMoving;
    const stored = this.stash.listPokemon().find((entry) => entry.id === id);
    if (!id || !stored || this.movedOnElsewhere()) {
      return;
    }
    const index = destination === 'new' ? this.stash.addBox() : Number(destination);
    if (!this.stash.movePokemon(id, index)) {
      this.refuse(`${this.stash.listBoxes()[index]?.name ?? 'That box'} cannot take ${stored.pokemon.name}.`);
      return;
    }
    this.boxMoving = undefined;
    audioManager.play('confirm');
    const name = this.stash.listBoxes()[index].name;
    this.saveStash(
      `${stored.pokemon.name} is in ${name}.`,
      `${stored.pokemon.name} is in ${name}, but it could not be saved.`,
    );
  }

  private addBoxAndShow(): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    this.boxScope = this.stash.addBox();
    audioManager.play('confirm');
    this.saveStash(
      `${this.stash.listBoxes()[this.boxScope].name} added.`,
      'A box was added, but it could not be saved.',
    );
  }

  private deleteBox(): void {
    const scope = this.scopeBox;
    if (scope === 'all' || this.movedOnElsewhere()) {
      return;
    }
    const name = this.stash.listBoxes()[scope]?.name ?? 'That box';
    if (!this.stash.removeBox(scope)) {
      this.refuse(`${name} is not empty, or is the last box.`);
      return;
    }
    this.boxScope = Math.max(0, scope - 1);
    audioManager.play('cancel');
    this.saveStash(`${name} taken away.`, `${name} was taken away, but it could not be saved.`);
  }

  private submitBoxForm(text: string): void {
    const editing = this.boxEditing;
    this.boxEditing = undefined;
    if (editing === 'find') {
      this.stashSearch = text.trim();
      audioManager.play('select');
      this.render();
      return;
    }
    const scope = this.scopeBox;
    if (scope === 'all') {
      this.render();
      return;
    }
    if (this.movedOnElsewhere()) {
      return;
    }
    if (!this.stash.renameBox(scope, text)) {
      this.refuse('That name is empty or another box already has it.');
      return;
    }
    audioManager.play('confirm');
    this.saveStash(
      `Renamed to ${this.stash.listBoxes()[scope].name}.`,
      'Renamed, but it could not be saved.',
    );
  }

  /** Puts a text field's own keys back where the keyboard owner left them. */
  private wireBoxForm(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>('[data-box-form]');
    const field = form?.querySelector<HTMLInputElement>('.px-field');
    if (!form || !field) {
      return;
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      this.submitBoxForm(field.value);
    };
    // Key *up* is the one thing the overlay keyboard lets through to a field, so
    // this is where a field hands the cursor back: Escape leaves it, and the
    // arrows step off it to the controls around it.
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        this.boxEditing = undefined;
        this.render();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.overlay.moveCursor(event.key);
      }
    };
  }

  /**
   * The stash: every Pokemon at base as a grid you read at a glance, and
   * everything about the one under the cursor in a single pane beneath it.
   *
   * This was five things behind one another. The list was one column however
   * wide the window was, every row carried three to five chips of its own -
   * MOVE, SUMMARY, TAKE, GIVE - and the one that mattered opened a whole second
   * screen, so twenty Pokemon were a scroll wheel of clutter with the answer
   * hidden a layer down. It is the PC box instead: the collection fills the
   * width it has (`ui/columnLayout.ts`), a row is the two lines that tell one
   * Pokemon from another, and what you came for - its condition, its
   * experience, its stats, its moves and everything you can do to it - is the
   * detail pane the cursor fills as it walks, the same pane the contract board
   * and Brock's ladder already use.
   */
  private stashView(): string {
    const pokemon = this.stashPokemon;
    const shown = this.shownPokemon;
    const inBoxes = this.scopeBox === 'all' || this.stashSearch.trim() !== '';
    const boxNames = this.stash.listBoxes().map((box) => box.name);
    const rows = shown
      .map((stored, index) => {
        const hurt = needsRecovery(stored.pokemon);
        const wiring = hurt
          ? `data-recover="${stored.id}" data-help="${this.recoveryHelp(stored)}"`
          : `data-fit="${stored.id}" data-help="${escapeAttribute(stored.pokemon.name)} is fit to raid."`;
        const tag = hurt
          ? pixelTag(this.recoveryPriceTag(stored), 'risk')
          : pixelTag('Fit', 'good', true);
        const boxed = boxNames[this.stash.boxIndexOf(stored.id)];
        const moving = this.boxMoving === stored.id;
        return `<button class="px-row${moving ? ' is-selected' : ''}" ${wiring} data-shows="${stored.id}"${index === 0 ? ' data-cursor-start' : ''}>${this.pokemonRowBody(stored, tag, inBoxes ? boxed : undefined)}</button>`;
      })
      .join('');
    const details = shown
      .map((stored, index) =>
        this.pokemonDetail(stored, index === 0, {
          label: 'Keeping',
          chips: (shows) => `${this.boxChip(stored, shows)}${this.gearChips(stored, shows)}`,
        }),
      )
      .join('');
    const supplyRow = (item: ItemDefinition): string =>
      // One line a supply, as a bag lists them: what it does is said by the
      // help bar when it is pointed at, which is why the row is a control.
      `<button class="px-row has-icon" data-supply="${item.id}" data-help="${escapeAttribute(`${item.displayName}: ${item.description}${usedInARaid(item)}`)}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong></span><span class="px-tag">${itemCountTag(item.id, this.stash.itemCount(item.id))}</span></button>`;
    const materialRows = this.stashItems
      .filter((item) => isFoundOnly(item.id) && !isFurniture(item.id) && !isWearableItem(item.id))
      .map(supplyRow)
      .join('');
    const furnitureRows = this.stashItems.filter((item) => isFurniture(item.id)).map(supplyRow).join('');
    const clothesRows = this.stashItems.filter((item) => isWearableItem(item.id)).map(supplyRow).join('');
    const supplies = `${this.stashItems.filter((item) => !isFoundOnly(item.id)).map(supplyRow).join('')}${
      // Found goods are their own list: nothing in it can be packed or used,
      // and Brock and Bill are where all of it goes.
      materialRows ? `<h3 class="px-subheading">Found goods</h3>${materialRows}` : ''
    }${
      // And furniture is its own again: it goes nowhere but THE BOLTHOLE.
      furnitureRows ? `<h3 class="px-subheading">Furniture</h3>${furnitureRows}` : ''
    }${
      // And clothes a raid found, which are worn from the wardrobe at home.
      clothesRows ? `<h3 class="px-subheading">Clothes</h3>${clothesRows}` : ''
    }`;
    return `<main class="px-body stash-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${this.browseBar(true, this.boxManage())}${rows || `<p class="px-empty">${this.stashSearch.trim() ? 'No Pokémon answers that.' : pokemon.length === 0 ? 'No Pokémon in storage.' : 'This box is empty.'}</p>`}${this.swapPanel()}</div>${details}`,
      { className: 'stash-roster', heading: 'Pokémon', note: `${pokemon.length} stored` },
    )}<div class="stash-side">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.supply)}>${supplies || '<p class="px-empty">No supplies in storage.</p>'}</div>`,
      { heading: 'Supplies', note: `${this.stashItems.length} ${this.stashItems.length === 1 ? 'kind' : 'kinds'}` },
    )}</div></main>`;
  }

  /**
   * Everything about one Pokemon, in the pane under the list.
   *
   * It holds what the summary screen used to be a whole screen for, and the
   * deeds that used to be chips on every row: which box it is in, and the one
   * piece of gear it can carry. The pane itself is `ui/pokemonDossier.ts`,
   * shared with the raid's own party screen, so the two cannot drift.
   */
  private pokemonDetail(
    stored: StashedPokemon,
    first: boolean,
    deeds: { readonly label: string; readonly chips: (shows: string) => string },
  ): string {
    const held = getHeldItem(stored.pokemon.heldItemId);
    return pokemonDossier({
      pokemon: stored.pokemon,
      id: stored.id,
      first,
      holding: held ? `Holding ${held.displayName}` : 'Holding nothing',
      deeds,
    });
  }

  /** Where this Pokemon is kept, and the press that moves it somewhere else. */
  private boxChip(stored: StashedPokemon, shows: string): string {
    const boxed = this.stash.listBoxes()[this.stash.boxIndexOf(stored.id)]?.name;
    const moving = this.boxMoving === stored.id;
    const name = escapeAttribute(stored.pokemon.name);
    return this.chip(
      `data-box-move="${stored.id}" ${shows}`,
      moving ? `Put ${name} down again.` : `Move ${name} to another box. It is in ${escapeAttribute(boxed ?? 'no box')}.`,
      // The verb first, then where it is now: a chip that is only a name reads
      // as a label rather than as something to press.
      moving ? 'Putting down' : `Move · ${escapeAttribute(boxed ?? 'no box')}`,
    );
  }

  /** What the pack and the party cannot do, which every panel on the way to the rim says the same way. */
  private packWarning({ balls = true } = {}): string {
    const party = this.flow.party;
    const nobodyStanding = this.stashPokemon.length > 0 && this.stashPokemon.every((stored) => stored.pokemon.isFainted);
    const allFainted = party.length > 0 ? !this.flow.isDeployable : nobodyStanding;
    if (allFainted) {
      return 'Every Pokémon here has fainted. Nurse Joy can revive them, out of the door and across the yard.';
    }
    // The default packs medicine and never a ball, so a first raid could not
    // catch and nothing said so (playtests 7, 10, 13, 18 and 34). The pack is
    // still the player's to choose; the panel says what it cannot do.
    if (balls && party.length > 0 && !this.flow.packsABall) {
      return this.flow.ballAtBase
        ? 'No Poké Balls on the rack, so nothing can be caught this raid.'
        : 'No Poké Balls at base, so nothing can be caught this raid.';
    }
    return '';
  }

  /**
   * THE BENCH: who comes. Everything at base, the row under the cursor answered
   * by its dossier, which is also where a hurt Pokémon is treated and gear is
   * given or taken. Whoever is ticked here sits on the stone in the hall.
   */
  private benchView(): string {
    const party = this.flow.party;
    const single = this.stashPokemon.length === 1;
    const nobodyStanding = this.stashPokemon.length > 0 && this.stashPokemon.every((stored) => stored.pokemon.isFainted);
    // A faint is not a hurt: medicine cannot revive, so "treat them first"
    // over a fainted partner pointed at Potion chips that refuse it.
    const faintedCount = this.injuredPokemon.filter((stored) => stored.pokemon.isFainted).length;
    const hurtCount = this.injuredPokemon.length - faintedCount;
    const stashNote = faintedCount === 0
      ? hurtCount ? `${hurtCount} hurt · treat them first` : ''
      : hurtCount ? `${faintedCount} fainted · ${hurtCount} hurt` : `${faintedCount} fainted · see Nurse Joy`;
    const summary = party.length === 0
      ? nobodyStanding ? 'Nobody fit to go.' : 'Nobody on the bench yet.'
      : party.map((stored) => stored.pokemon.name).join(', ');
    // The rack and the rim say what is not packed; on the bench it is about nothing in view.
    const warning = this.packWarning({ balls: false });
    const pokemonRows = this.findablePokemon
      .map((stored, index) => {
        const added = this.flow.includesPokemon(stored.id);
        const name = escapeAttribute(stored.pokemon.name);
        // The cursor starts on the first Pokemon, not on the sort chip above
        // the list: an Enter on arrival re-sorted the stash (playtest 44 #2).
        // A fainted Pokemon is refused by the flow (`togglePokemon`), so its row
        // is a cursor stop that says why rather than an ADD that does nothing.
        const fainted = !added && stored.pokemon.isFainted;
        return `<button class="px-row${added ? ' is-selected' : ''}" data-pokemon="${stored.id}" data-shows="${stored.id}"${index === 0 ? ' data-cursor-start' : ''}${fainted ? ' aria-disabled="true"' : ''} data-help="${added ? `Take ${name} back off the bench.` : fainted ? faintedRefusal(name, single) : `Put ${name}${single ? ', your only Pokémon,' : ''} on the bench. Lost on a wipe unless it is in the locker.`}">${this.pokemonRowBody(
          stored,
          // A tick, as every chosen row on these screens is marked: a ten-letter
          // name and its health bar leave no room for a word beside them.
          added ? pixelTag('', 'good', true) : fainted ? pixelTag('Fainted', 'risk') : pixelTag('Add'),
        )}</button>`;
      })
      .join('');
    const details = this.findablePokemon
      .map((stored, index) =>
        this.pokemonDetail(stored, index === 0, {
          label: 'Condition',
          chips: (shows) => this.careChips(stored, shows),
        }),
      )
      .join('');
    return `<main class="px-body loadout-layout bench-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${this.browseBar(false)}${pokemonRows || '<p class="px-empty">No Pokémon answers that.</p>'}</div>${details}`,
      { className: 'loadout-stash', heading: 'At base', note: stashNote },
    )}${pixelCommitBar({
      title: `${party.length}/${MAX_RUN_PARTY} on the bench`,
      lines: [
        `<span class="px-wrap">${summary}</span>`,
        ...(warning ? [`<small class="px-wrap px-warning">${warning}</small>`] : []),
      ],
      actions: `<button class="px-window px-button is-primary" data-back data-help="Back to the hall.">Done</button>`,
    })}</main>`;
  }

  /**
   * THE ARMOURY RACK: what this raid carries. What goes in the pack, how it is
   * laid out, and which pack it is, because a pack is gear the player chooses
   * and loses rather than a size the game gives them.
   */
  private rackView(): string {
    const supplyRows = this.stashItems
      .filter((item) => !isFoundOnly(item.id))
      .map((item, index) => {
        const packed = this.flow.itemQuantity(item.id as ItemId);
        const held = this.stash.itemCount(item.id);
        const footprint = footprintOf(item.id);
        const size = footprint.width === 1 && footprint.height === 1
          ? '1 square'
          : `${footprint.width * footprint.height} squares`;
        // Medicine goes in by default (`MEDICINE_PREPACK_SHARE`), and the row
        // says so for as long as it is the default rather than a choice, so
        // the player can see what was packed for them and take it back out.
        const prepacked = this.flow.isPrepacked(item.id as ItemId);
        const help = escapeAttribute(
          `${item.displayName}: ${item.description}${usedInARaid(item)} ${size} each, ${held} at base.${
            prepacked ? ' Packed for you - medicine goes in by default. Take it out if you want the squares.' : ''
          }`,
        );
        // The pack is the second cap after the vault, so a row says both: what
        // it costs in squares, and how many of it the base still holds. A plus
        // that would not fit is left reachable and refuses out loud, because a
        // control the cursor cannot land on can never say why.
        const limit = this.flow.packLimit(item.id as ItemId);
        // A plus that stops short because of how the pack is *laid out* is not
        // the same fact as a pack that is full, and the row owes the difference:
        // one of them has Tidy as its answer and the other has nothing.
        const tidied = this.flow.packLimitTidied(item.id as ItemId);
        const limitReason = limit < held
          ? tidied > limit
            ? `The pack has room for ${limit} ${item.displayName} as you have laid it out - ${tidied} if it is packed again. Tidy is under the squares.`
            : `The pack has room for ${limit} ${item.displayName} beside what else is packed.`
          : `All ${held} at base are packed.`;
        // Each fact is held together, so a row too narrow for all three breaks
        // between them: "packed for you" wrapped "you" onto a line of its own
        // (playtest 47).
        const facts = [size, `${held} at base`, ...(prepacked ? ['packed for you'] : [])]
          .map((fact) => fact.replace(/ /g, '&nbsp;'))
          .join(' · ');
        return `<div class="px-row has-icon${packed ? ' is-selected' : ''}" data-describes="${describeKey('item', item.id)}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong>${item.displayName}</strong><small>${facts}</small></span>${countSelector({ kind: 'item', id: item.id, label: item.displayName, value: packed, max: limit, help, limit: limitReason, cursorStart: index === 0 })}</div>`;
      })
      .join('');
    const cells = this.flow.bagCells;
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const warning = this.packWarning();
    const firstCount = supplyRows.indexOf('data-count-dir');
    return `<main class="px-body loadout-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.countedSupply)}>${firstCount < 0 ? '<p class="px-empty">No supplies at base.</p>' : supplyRows}</div>`,
      { className: 'loadout-stash', heading: 'Supplies' },
    )}<div class="loadout-side">${pixelWindow(
      `<div class="pack-body px-scroll">${pixelGrid(this.flow.bagLayout(), (itemId) => itemIcon(itemId, this.itemName(itemId)), {
        label: `Pack, ${cells.used} of ${cells.total} squares full`,
        arrange: { name: 'pack', ghost: this.arranging.ghostFor('pack'), help: ARRANGE_AND_REMOVE_HELP },
      })}${this.arrangeBar('pack')}${this.packRows()}</div>`,
      {
        className: 'pack-window',
        heading: 'Pack',
        note: `${cells.used}/${cells.total} squares`,
      },
    )}</div>${pixelCommitBar({
      title: this.flow.packName,
      lines: [
        `<small class="px-wrap${warning ? ' px-warning' : ''}">${warning || `${supplies} ${supplies === 1 ? 'supply' : 'supplies'} packed. Lost on a wipe unless they are in the locker, and the ${this.flow.packName} goes either way.`}</small>`,
      ],
      // The cursor starts on what the rack is for, never on the way out.
      actions: `<button class="px-window px-button is-primary" data-back${firstCount < 0 ? ' data-cursor-start' : ''} data-help="Back to the hall.">Done</button>`,
    })}</main>`;
  }

  /**
   * The packs at base, under the squares they would give you.
   *
   * It is a list of rows rather than a cycling control because the choice is
   * the point: a Hauler frame carries a fortune home and is a fortune to lose,
   * a Satchel risks almost nothing because it holds almost nothing, and the row
   * says both numbers before anything is chosen. A pack too small for what is
   * already packed is still reachable and refuses out loud - a control the
   * cursor cannot land on can never say why.
   */
  private packRows(): string {
    const choices = this.flow.packChoices;
    if (choices.length === 0) {
      return '<p class="px-empty">No pack at base.</p>';
    }
    const rows = choices
      .map((choice) => {
        const spare = choice.held - 1;
        const help = escapeAttribute(
          `${choice.name}: ${choice.squares} squares. ${
            choice.wouldNotHold ??
            (spare > 0
              ? `${spare} spare at base, so losing this one is not losing them all.`
              : 'Your only one. Lose this raid and it is gone.')
          }`,
        );
        return `<button class="px-row has-icon${choice.chosen ? ' is-selected' : ''}" data-pack="${choice.itemId}" data-help="${help}">${itemIcon(choice.itemId, choice.name)}<span class="px-row-main"><strong class="px-name">${choice.name}</strong><small>${choice.squares} squares${choice.held > 1 ? ` · ${choice.held} at base` : ''}</small></span>${
          choice.chosen ? pixelTag('', 'good', true) : pixelTag(choice.wouldNotHold ? 'Full' : 'Wear')
        }</button>`;
      })
      .join('');
    return `<h3 class="px-subheading">Wearing</h3><div class="px-list pack-choices">${rows}</div>`;
  }

  /**
   * THE RIM: looking down over the fence, and the last thing before a jump. The pit
   * behind it is the map, with every way in lit on it, so this says only what the
   * map cannot - what going has at stake - and has the one button that goes.
   *
   * Nothing here is a list. Another way in is pointed at on the map: the arrow keys
   * go to whichever lies that way (`stepToWayIn`), a click on a light chooses it, and
   * the pit swings round to it. A player who walked up to the place they wanted
   * presses straight through. What a whole map holds is on Oak's wall map.
   */
  private rimView(): string {
    const chosen = this.flow.insertionId;
    const refusal = this.flow.notReady;
    const warning = refusal ?? this.packWarning();
    const ways = this.waysFromHere().length;
    const nextMap = this.nextMapWayIn();
    return `<main class="px-body rim-layout">${pixelCommitBar({
      title: `<span data-rim-title>${this.rimTitle(chosen)}</span>`,
      lines: [
        `<div data-rim-about>${this.rimStakes(chosen)}</div>`,
        this.roomNote(),
        ...(this.firstContractActive ? ['<small class="px-wrap">More ways in open up when you bring this contract home.</small>'] : []),
        ...(warning ? [`<small class="px-wrap px-warning">${warning}</small>`] : []),
        ...(ways > 1 || nextMap
          ? [
              `<div class="rim-ways">${ways > 1 ? `<small>${keyHint('ARROWS', 'OR CLICK A LIGHT: ANOTHER WAY IN')}</small>` : ''}${
                nextMap
                  ? `<button class="px-window px-button" data-insertion="${nextMap.id}" data-help="${escapeAttribute(`Look down on ${worldMapName(nextMap.mapId)} instead${worldMapMaker(nextMap.mapId) ? `, a map by ${worldMapMaker(nextMap.mapId)}` : ''}.`)}">${worldMapName(nextMap.mapId)}</button>`
                  : ''
              }</div>`,
            ]
          : []),
      ].filter((line) => line !== ''),
      actions: `<button class="px-window px-button" data-back data-help="Stay on the rim. Everything you have chosen stays as it is.">Not yet</button><button class="px-window px-button is-primary" data-start data-cursor-start${refusal ? ` aria-disabled="true" data-help="${escapeAttribute(refusal)}"` : ' data-help="Over the fence. There is no way back from here: the raid starts."'}>Jump in</button>`,
    })}</main>`;
  }

  /** Every way in on offer, while a room is held only those on its map. */
  private get offeredWays(): readonly (readonly [RunInsertionId, RunInsertion])[] {
    const room = this.heldRoom;
    return this.unlockedInsertions.filter(([, insertion]) => !room || insertion.mapId === room.mapId);
  }

  /** The ways in on the map in the pit. */
  private waysFromHere(): readonly { readonly id: RunInsertionId; readonly tile: { readonly x: number; readonly y: number } }[] {
    const { mapId } = requireInsertion(this.flow.insertionId);
    return this.offeredWays
      .filter(([, insertion]) => insertion.mapId === mapId)
      .map(([id, insertion]) => ({ id, tile: insertion.position }));
  }

  /** The first way in on the next map round, when there is another map to look down on. */
  private nextMapWayIn(): RunInsertion | null {
    const { mapId } = requireInsertion(this.flow.insertionId);
    const maps = [...new Set(this.offeredWays.map(([, insertion]) => insertion.mapId))];
    if (maps.length < 2) {
      return null;
    }
    const next = maps[(maps.indexOf(mapId) + 1) % maps.length];
    return this.offeredWays.find(([, insertion]) => insertion.mapId === next)?.[1] ?? null;
  }

  /** An arrow key on the rim: to the way in that lies that way on the map, if one does. */
  private stepToWayIn(way: { readonly x: number; readonly y: number }): void {
    const next = wayInToward(this.waysFromHere(), this.flow.insertionId, way);
    if (next) {
      audioManager.play('select');
      this.pointAtLanding(next.id);
    } else {
      audioManager.play('bump');
    }
  }

  private rimTitle(insertionId: RunInsertionId): string {
    return `Jump in at ${requireInsertion(insertionId).label}`;
  }

  /**
   * What a raid from here risks and keeps, and the hunter it draws: each a line,
   * because this pane has perhaps five of them before it has to scroll and these
   * are what cannot be taken back.
   */
  private rimStakes(insertionId: RunInsertionId): string {
    const securedPokemon = this.flow.securedPokemon;
    const securedItems = this.flow.securedItems;
    const stack = (item: { readonly itemId: ItemId; readonly quantity: number }): string =>
      `${this.itemName(item.itemId)} ${itemCountTag(item.itemId, item.quantity)}`;
    // The pack leads, because it is the biggest single thing a wipe takes and
    // the one nothing in the locker beside it can protect.
    const lost = [
      ...(this.flow.packItemId === undefined ? [] : [`the ${this.flow.packName}`]),
      ...this.flow.riskedPokemon.map((stored) => stored.pokemon.name),
      ...this.flow.riskedItems.map(stack),
    ];
    const kept = [...securedPokemon.map((stored) => stored.pokemon.name), ...securedItems.map(stack)];
    const threat = this.hunterThreatAt(insertionId, this.flow.party);
    const hunter = hunterThreatLine(threat);
    const contract = this.contractFor(insertionId);
    const required = contract ? contractCarryIn(contract) : [];
    const short = required.length === 0 ? [] : missingCarryIn(required, (itemId) => this.flow.itemQuantity(itemId));
    const line = (label: string, body: string, warn = false): string =>
      `<div><dt>${label}</dt><dd class="px-wrap${warn ? ' px-warning' : ''}">${body}</dd></div>`;
    return `<dl class="dropin-facts rim-stakes">${line('At risk', lost.length === 0 ? 'nothing: all of it is in the locker' : lost.join(', '))}${line('Safe', kept.length === 0 ? 'nothing: a wipe costs you everything' : kept.join(', '), kept.length === 0)}${
      required.length === 0
        ? ''
        : line('Drop', short.length === 0 ? `${itemAmountsFor(required)} packed for ${contract!.name}` : `${contract!.name} needs ${itemAmountsFor(required)}. Still short: ${itemAmountsFor(short)}`, short.length > 0)
    }${line('Hunter', `<span data-hunter-tier="${threat.tierOffset + 1}">${hunter.heading.replace(/^Hunter: /, '')}: ${hunter.detail}</span>`, threat.tierOffset > 0)}${this.clockIsNews ? line('Clock', this.clockNote()) : ''}</dl>`;
  }

  /** Whether the clock is worth a line: it is on the title bar, and only a night or a shortened one has more to say. */
  private get clockIsNews(): boolean {
    return this.pendingRecoveryMs > 0 || isPlaytestRun() || isNightRaid(new Date());
  }

  /**
   * Another way in has been pointed at, by a key or a click on the pit: it is chosen,
   * the panel says so, and the pit behind it swings round to it. It commits nothing.
   */
  public pointAtLanding(insertionId: RunInsertionId): void {
    if (this.flow.insertionId === insertionId) {
      return;
    }
    this.flow.chooseInsertion(insertionId);
    this.kit?.aim(insertionId);
    this.render();
  }

  /**
   * The wall map in Oak's Lab, read on a screen (`base/wallMap.ts`).
   *
   * All four maps side by side at one scale - the scale the biggest fits at -
   * so the Floodplain hangs four times the size of Route 1 because it is, lit
   * where a raid has walked and dark everywhere else, with a sign pinned under
   * each for every keeper beaten there. That is the glance: how far across the
   * whole game the player has got. Choosing a map is the inspect: that one map
   * as big as the window takes, with what is on it listed beside it.
   */
  private wallMapView(): string {
    const entries = wallMapEntries(this.savedGame);
    const inspected = entries.find((entry) => entry.mapId === this.wallMapInspect);
    if (inspected) {
      return this.wallMapInspectView(inspected, entries);
    }
    const cards = entries
      .map((entry) => {
        const known = Math.round(entry.known * 100);
        const signs =
          entry.signs.length === 0
            ? `<small class="wallmap-none">${entry.held === 0 ? 'Nobody holds a door here' : `${entry.held} keeper${entry.held === 1 ? '' : 's'} still holding doors`}</small>`
            : entry.signs.map((sign) => this.wallSign(sign.keeper)).join('');
        const help = `${entry.name}: ${known}% of it known, ${entry.districtsKnown} of ${entry.districts} places reached${entry.signs.length === 0 ? '' : `, ${entry.signs.length} keeper${entry.signs.length === 1 ? '' : 's'} beaten`}. ENTER reads it close up.`;
        return `<button class="px-window px-card wallmap-card" data-wall-map="${entry.mapId}" data-help="${escapeAttribute(help)}"><span class="wallmap-card-head"><strong>${entry.name}</strong><small>${entry.walked ? `${known}% known` : 'never walked'}</small></span>${mapPictureFrame({
          key: `wall:${entry.mapId}`,
          label: `${entry.name}, ${known}% known`,
          size: entry.size,
          mode: 'shared',
          className: 'wallmap-picture',
        })}<span class="wallmap-signs">${signs}</span></button>`;
      })
      .join('');
    // Each card as wide as its map is, beside the others, plus its own frame
    // and the cursor's margin (`WALL_CARD_OVERHEAD`); see `shareTracks`.
    return `<main class="px-body wallmap-layout" ${pictureRowAttributes(
      entries.map((entry) => entry.size.width),
      WALL_CARD_GAP,
      WALL_CARD_OVERHEAD,
    )}>${cards}</main>`;
  }

  /** A keeper's sign, pinned: the name they held the doors under. */
  private wallSign(keeper: string): string {
    return `<span class="wallmap-sign"><i class="wallmap-pin" aria-hidden="true"></i>${keeper}</span>`;
  }

  /**
   * One map from the wall, close up: the picture as big as the window takes
   * down the left, exactly as the drop-in screen draws it, and beside it the
   * four maps to move between and what this one has on it - the signs pinned
   * under it, its doors and its ways out, each with a swatch in the ink the
   * picture draws it in, so the list is the legend.
   */
  private wallMapInspectView(entry: WallMapEntry, entries: readonly WallMapEntry[]): string {
    const door = frontDoorFor(entry.mapId);
    const progress = this.savedGame.raidProgress;
    const briefing = door
      ? buildDropInBriefing(door.id, {
          ...wallMapContext(this.savedGame, entry.mapId),
          raidRecord: progress.raidRecord,
          partyLevels: [],
          contract: undefined,
          night: isNightRaid(new Date()),
        })
      : undefined;
    const told = (body: string, help: string, className = ''): string =>
      `<button class="px-row${className}" aria-disabled="true" data-help="${escapeAttribute(help)}">${body}</button>`;
    const maps = entries
      .map((other) => {
        const chosen = other.mapId === entry.mapId;
        return `<button class="px-row${chosen ? ' is-selected' : ''}" data-wall-map="${other.mapId}" data-help="${escapeAttribute(`${other.name}: ${Math.round(other.known * 100)}% known.`)}"><span class="px-row-main"><strong class="px-name">${other.name}</strong><small>${other.walked ? `${Math.round(other.known * 100)}% known · ${other.districtsKnown}/${other.districts} places` : 'never walked'}</small></span>${chosen ? pixelTag('', 'good', true) : ''}</button>`;
      })
      .join('');
    const signs = `<h3 class="px-subheading">Signs pinned here</h3>${
      entry.signs.length === 0
        ? `<p class="px-empty px-wrap">${entry.held === 0 ? 'Nobody holds a door on this map.' : `No keeper beaten here yet. Beat one and their sign goes up.`}</p>`
        : entry.signs
            .map((sign) =>
              told(
                `<span class="px-row-main"><strong>${this.wallSign(sign.keeper)}</strong><small class="px-wrap">${sign.doors} · open for good</small></span>`,
                `You beat ${sign.keeper}. ${sign.doors} stand${sign.doors.includes('+') ? '' : 's'} open on every raid from now on.`,
                ' px-tall',
              ),
            )
            .join('')
    }`;
    // Only what has been found is named, as on the drop-in screen: the rest is
    // a count, because a list of every door and way out of a map nobody has
    // walked hands over in words what the dark picture beside it keeps.
    const foundDoors = briefing?.doors.filter((line) => line.known) ?? [];
    const foundExits = briefing?.exits.filter((exit) => exit.known) ?? [];
    const doors = !briefing || briefing.doors.length === 0
      ? ''
      : `<h3 class="px-subheading">Doors</h3>${foundDoors
          .map((line) =>
            told(
              `${this.pip(line.open ? 'O' : 'H')}<span class="px-row-main"><strong>${line.label}</strong><small>${line.open ? 'open' : doorHolder(line)}</small></span>`,
              doorPromise(line),
              ' has-pip',
            ),
          )
          .join('')}${this.toFind(briefing.doors.length - foundDoors.length, foundDoors.length, 'door')}`;
    const exits = !briefing
      ? ''
      : `<h3 class="px-subheading">Ways out</h3>${foundExits
          .map((exit) =>
            told(
              `${this.pip(exit.worked ? 'K' : 'X')}<span class="px-row-main"><strong>${exit.label}</strong><small>${exit.worked ? 'open for good' : exit.opens === 'OPEN' ? 'open from the first second' : exit.opens.toLowerCase()}</small></span>`,
              `${exit.label}: ${exit.opens === 'OPEN' ? 'open from the first second of a raid' : exit.opens.toLowerCase()}.`,
              ' has-pip',
            ),
          )
          .join('')}${this.toFind(briefing.exits.length - foundExits.length, foundExits.length, 'way out')}`;
    const known = Math.round(entry.known * 100);
    return `<main class="px-body wallmap-inspect">${pixelWindow(
      mapPictureFrame({
        key: `wall:${entry.mapId}`,
        label: `${entry.name}, ${known}% known`,
        size: entry.size,
        reference: largestMapSize(wallMapOrder(this.savedGame)),
        mode: 'own',
        // The line measure alone, not the drop-in's allowance beside it: the
        // side here is one column of one-line rows, which stands a little
        // under its measure at the smallest stage, and the allowance left the
        // biggest map six pixels short of a tile a pixel there - so whether a
        // map was drawn whole or at half scale hung on how long its name was.
        leave: COLUMN_MEASURES.line,
        className: 'dropin-picture',
      }),
      {
        className: 'wallmap-place',
        heading: entry.name,
        note: entry.walked ? `${known}% known` : 'Never walked',
      },
    )}${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.line)}>${maps}${briefing ? this.placeFacts(briefing) : ''}${signs}${briefing ? this.placeWorth(briefing) : ''}${doors}${exits}${briefing ? this.placeWildlife(briefing) : ''}</div>`,
      { className: 'wallmap-about', heading: 'On the wall', note: `${entry.districtsKnown}/${entry.districts} places` },
    )}</main>`;
  }

  /**
   * The five short facts about the place, across the head of what it holds:
   * they were beside the picture when the picture was a thumbnail, and the
   * picture wants that room now. They scroll with the rest, because at the
   * smallest stage five lines pinned over the pane were most of it.
   */
  private placeFacts(briefing: DropInBriefing): string {
    const { grade, record } = briefing;
    const walked = Math.round(record.surveyed * 100);
    return `<dl class="dropin-facts">${
      // A second entrance does not carry its map's name, so it says which map
      // it is on. A front door is the map.
      briefing.isDropIn ? `<div><dt>Map</dt><dd>${briefing.mapName}</dd></div>` : ''
    }<div><dt>Wild</dt><dd>${grade.wild.max === 0 ? 'none' : `Lv ${grade.wild.min}-${grade.wild.max}`}</dd></div><div><dt>Fights</dt><dd>${grade.trainers === 0 ? 'none' : `${grade.trainers} · Lv ${grade.trainer}`}</dd></div><div><dt>Doors</dt><dd>${grade.bossesHeld === 0 ? (grade.bossesBeaten === 0 ? 'none' : 'all yours') : `${grade.bossesHeld} held`}</dd></div><div><dt>Raids</dt><dd>${record.deployed === 0 ? 'none yet' : `${record.deployed} · ${record.extracted} out`}</dd></div><div><dt>Known</dt><dd>${record.districts === 0 ? `${walked}%` : `${record.districtsKnown}/${record.districts} · ${walked}%`}</dd></div></dl>`;
  }

  /** The count under a list of ways out or doors of the ones not found yet. */
  private toFind(hidden: number, found: number, what: 'way out' | 'door'): string {
    const line = stillToFind(hidden, found, what);
    return line === '' ? '' : `<p class="${found === 0 ? 'px-empty' : 'px-note'} px-wrap">${line}</p>`;
  }

  /** A swatch in the same ink the map draws that thing in, so the list is the legend. */
  private pip(char: string): string {
    return `<i class="px-pip" style="--pip:${MINIMAP_PALETTE[char]}" aria-hidden="true"></i>`;
  }

  /**
   * What a map is worth going to, on Oak's wall: what somebody at base is waiting on
   * from it and its rare finds, and where they lie. It keeps the dark: a place nobody
   * has walked keeps what is in it, so it reads as an invitation on a fresh map and
   * as a plan on a walked one.
   */
  private placeWorth(briefing: DropInBriefing): string {
    // Every row is a control the cursor can land on, even though none of them does
    // anything: a pane with no controls in it cannot be scrolled with the arrow keys.
    const told = (body: string, help: string, className = ''): string =>
      `<button class="px-row${className}" aria-disabled="true" data-help="${escapeAttribute(help)}">${body}</button>`;
    // What somebody at base is waiting on from this map, said under the
    // contract because it is the other reason to come here: where it lies, who
    // it is for and what it costs the pack. The giver named the place, so it is
    // named here whether or not the survey has reached it.
    const inHand = errandsInHand(this.savedGame.raidProgress).filter((errand) => errand.mapId === briefing.mapId);
    const errands = inHand.length === 0
      ? ''
      : `<h3 class="px-subheading">Errands</h3>${inHand
          .map((errand) => {
            const thing = errandThing(errand);
            const squares = errandSquares(errand);
            const home = this.stash.itemCount(errand.itemId) > 0;
            return told(
              `<span class="px-row-main"><strong>${thing}</strong><small class="px-wrap">${
                home
                  ? `already home - take it to ${errand.name}`
                  : `for ${errand.name} · ${errandPlace(errand)} · ${squares} ${squares === 1 ? 'square' : 'squares'}`
              }</small></span>`,
              home
                ? `${thing} is already in your stash. Speak to ${errand.name} and it is handed over.`
                : `${thing}: ${errand.name} asked for it. It lies in ${errandPlace(errand)}, takes ${squares} ${squares === 1 ? 'square' : 'squares'} of the pack, and is lost with the pack if you do not walk out. ${errand.name} pays ${errand.reward.summary.toLowerCase()} for it.`,
              ' px-tall',
            );
          })
          .join('')}`;
    const foundPrizes = briefing.prizes.filter((prize) => prize.known);
    const hiddenPrizes = briefing.prizes.length - foundPrizes.length;
    const prizes = briefing.prizes.length === 0
      ? ''
      : `<h3 class="px-subheading">Worth going for</h3>${foundPrizes
          .map((prize) =>
            told(
              `<span class="px-row-main"><strong>${prize.name}</strong><small class="px-wrap">${prize.place} · about one raid in ${Math.max(2, Math.round(1 / prize.chance))}</small></span>`,
              `${prize.name}: lies in ${prize.place}, on about one raid in ${Math.max(2, Math.round(1 / prize.chance))}. You will see it from a distance, and it burns with the pack if you do not walk out.`,
              ' px-tall',
            ),
          )
          .join('')}${
          foundPrizes.length === 0
            ? '<p class="px-empty px-wrap">Rare things are found on this map, but not in any country you have walked.</p>'
            : hiddenPrizes === 0
              ? ''
              : `<p class="px-note px-wrap">${hiddenPrizes} more, in places nobody here has walked.</p>`
        }`;
    return `${errands}${prizes}`;
  }

  /**
   * What lives in each place walked, on Oak's wall. Only places the survey has
   * reached: what lives somewhere nobody has been is not something base could tell
   * you. The count of places still unknown is said instead, which is the invitation.
   */
  private placeWildlife(briefing: DropInBriefing): string {
    const told = (body: string, help: string, className = ''): string =>
      `<button class="px-row${className}" aria-disabled="true" data-help="${escapeAttribute(help)}">${body}</button>`;
    const seen = briefing.wildlife.filter((place) => place.known);
    const unseen = briefing.wildlife.length - seen.length;
    const wildlife = briefing.wildlife.length === 0
      ? ''
      : `<h3 class="px-subheading">${briefing.night ? 'Wildlife by night' : 'Wildlife'}</h3>${seen
          .map((place) => {
            const living = place.species
              .map((entry) => `${entry.name} ${entry.min}-${entry.max}`)
              .join(' · ');
            return told(
              `<span class="px-row-main"><strong>${place.place}</strong><small class="px-wrap">${living}</small></span>`,
              `${place.place}: ${living}. Rolled for on every step through that place's tall grass${
                briefing.night ? ', and it is night: some of it only comes out after dark' : ''
              }.`,
              ' px-tall',
            );
          })
          .join('')}${
          seen.length === 0
            ? '<p class="px-empty px-wrap">You have walked none of this map. Whatever lives here, nobody at base can tell you.</p>'
            : unseen === 0
              ? ''
              : `<p class="px-note px-wrap">${unseen} more place${unseen === 1 ? '' : 's'} on this map nobody here has walked.</p>`
        }`;
    return wildlife;
  }

  /** THE LOCKER: what comes home whatever happens to the raid. */
  private lockerView(): string {
    const party = this.flow.party;
    const slots = this.flow.securePokemonSlots;
    // A Pokemon costs squares of the same container its supplies do, four, six
    // or nine by how far along its line it is, so the row says the price before
    // the press and the help bar says what it would buy or cost.
    const pokemonRows = party
      .map((stored) => {
        const secured = this.flow.securesPokemon(stored.id);
        const squares = cargoSquaresLabel(cargoCells(pokemonCargo(stored.id, stored.pokemon)));
        const help = secured
          ? `Secured: it comes home even if you wipe. It is taking ${squares} of the container.`
          : `Secure this Pokémon so a wipe cannot take it. It needs ${squares} of the container.`;
        // The price is on the row whether or not it is paid: a secured Pokemon
        // still says what it is taking, because the next question the screen is
        // asked is what would fit if it came out.
        return `<button class="px-row${secured ? ' is-secured' : ''}" data-secure-pokemon="${stored.id}" data-shows="${stored.id}" data-help="${escapeAttribute(help)}">${this.pokemonRowBody(stored, secured ? pixelTag(squares.toUpperCase(), 'secure', true) : pixelTag(squares.toUpperCase(), 'plain'))}</button>`;
      })
      .join('');
    // One stepper a kind, exactly as the loadout packs: the container is squares
    // now, so "how much of this comes home" is a number rather than a tick, and
    // the same two keys answer it on both screens.
    // The pane is narrow: the row says how many squares one costs and nothing
    // else, because a second clause wrapped every row onto three lines and a
    // list of three-line rows is a list nobody scrolls. What is packed, and
    // what a material's room is for, are in the help bar the cursor fills.
    const secureRow = (itemId: ItemId, help: string): string => {
      // Squares, not units. They are the same number for everything a square
      // holds one of, and for money - a bundle to a square - the stepper
      // would otherwise count in hundreds in a box four characters wide.
      const held = blocksFor(itemId, this.flow.secureQuantity(itemId));
      const footprint = footprintOf(itemId);
      const size = footprint.width * footprint.height;
      const limit = this.flow.secureLimit(itemId);
      const packed = this.flow.itemQuantity(itemId);
      const roomLine = held >= limit
        ? 'The container cannot seat any more of this beside what is in it.'
        : `The container has room for ${limit} square${limit === 1 ? '' : 's'} of this beside what is in it.`;
      const limitReason = isFoundOnly(itemId)
        ? roomLine
        : packed === 0
          ? 'Pack some of this first - the container protects what you carry.'
          : limit >= blocksFor(itemId, packed)
            ? 'Everything you packed of this is already in the container.'
            : roomLine;
      return `<div class="px-row has-icon${held ? ' is-secured' : ''}">${itemIcon(itemId, this.itemName(itemId))}<span class="px-row-main"><strong>${this.itemName(itemId)}</strong><small>${size === 1 ? '1 square' : `${size} squares`}</small></span>${countSelector({ kind: 'secure', id: itemId, label: this.itemName(itemId), value: held, max: limit, help, limit: limitReason })}</div>`;
    };
    const itemRows = this.flow.items
      .map((item) =>
        secureRow(
          item.itemId,
          `${this.itemName(item.itemId)}: ${item.quantity} packed. What you put in the container comes home even if you wipe.`,
        ),
      )
      .join('');
    // A material, and the money beside it, are found rather than packed, so the
    // container holds room for them: whatever of that kind is still in the pack
    // when the raid is lost comes home, up to the squares set aside here. Money
    // no room was kept for is money a wipe takes.
    // Somebody's errand is offered only while its thing is out there to be
    // found: four squares kept for a crate that is already home, or that
    // nobody has asked for, would be four squares kept for nothing.
    const wanted = errandsToLay(this.savedGame.raidProgress, (itemId) => this.stash.itemCount(itemId)).map(
      (errand) => errand.itemId as string,
    );
    // Furniture is found-only too, and the one kind no room is kept for: a
    // trophy comes home in a pack that comes home (`items.ts`, FOUND_ONLY_IDS).
    const materialRows = FOUND_ONLY_IDS.filter(
      (itemId) => !isFurniture(itemId) && !isWearableItem(itemId) && (!isErrandItem(itemId) || wanted.includes(itemId)),
    ).map((itemId) =>
      secureRow(
        itemId,
        `${this.itemName(itemId)}: room kept for what you find. It is never packed, so this is squares held open for it.`,
      ),
    ).join('');
    const cells = this.flow.secureCells;
    return `<main class="px-body secure-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${pokemonRows || '<p class="px-empty">Nobody is on the bench yet.</p>'}</div>${this.secureRoomNote()}`,
      { className: 'secure-group', heading: 'Pokémon', note: `${this.flow.securedPokemon.length}/${slots} ${slots === 1 ? 'slot' : 'slots'}` },
    )}${pixelWindow(
      // The squares and the list are one child of the window, or the window's
      // second row takes both and the container scrolls away with the list.
      `<div class="secure-body">${pixelGrid(this.flow.secureLayout(), (itemId) => itemIcon(itemId, this.itemName(itemId)), {
        className: 'is-secure',
        label: `Secure container, ${cells.used} of ${cells.total} squares full${this.flow.securedCargo.length ? `, holding ${this.flow.securedCargo.map((piece) => piece.name).join(' and ')}` : ''}`,
        arrange: { name: 'secure', ghost: this.arranging.ghostFor('secure'), help: ARRANGE_AND_REMOVE_HELP },
      })}${this.arrangeBar('secure')}<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.countedSupply)}>${itemRows ? `${itemRows}<h3 class="px-subheading">Found goods</h3>` : ''}${materialRows}</div></div>`,
      {
        className: 'secure-group',
        heading: 'Container',
        note: `${cells.used}/${cells.total} squares`,
      },
    )}${pixelCommitBar({
      className: 'px-tone-secure secure-intro',
      title: 'Comes home whatever happens',
      lines: [
        // The two lids above already count the squares and what fills them, so
        // this line says only what the counting does not: the rest is gone.
        '<span class="px-wrap">Everything else you take is lost on a wipe.</span>',
      ],
      actions: `<button class="px-window px-button is-primary" data-back data-help="Back to the hall.">Done</button>`,
    })}</main>`;
  }

  /**
   * Why the container holds what it holds, said rather than left to be deduced.
   *
   * The base container is four squares and a first-stage Pokemon is four
   * squares, so filling itself with your best Pokemon fills it completely -
   * that is the design, but a player who finds the plus buttons dead deserves
   * the sentence rather than the silence. The same line says what would change
   * it: a bigger container, or letting the Pokemon go.
   */
  private secureRoomNote(): string {
    const cargo = this.flow.securedCargo;
    const free = gridCells(this.flow.secureGrid) - this.flow.secureCells.used;
    if (cargo.length === 0) {
      // Nothing is protected. That is only worth a line when it is because
      // nothing *can* be - an all-evolved party against a container that has
      // not grown - because otherwise the player put the Pokemon out on purpose.
      const smallest = this.flow.party
        .map((stored) => cargoCells(pokemonCargo(stored.id, stored.pokemon)))
        .sort((a, b) => a - b)[0];
      return smallest !== undefined && smallest > free
        ? `<p class="px-note px-wrap">Nothing in this party fits: the container is ${this.flow.secureGrid.width}x${this.flow.secureGrid.height} and the smallest here needs ${cargoSquaresLabel(smallest)}. Grow it at Brock's Workshop, or bank a cordon ledger.</p>`
        : '';
    }
    const names = cargo.map((piece) => piece.name.toUpperCase()).join(' and ');
    return free === 0
      ? `<p class="px-note px-wrap">${names} ${cargo.length === 1 ? 'fills' : 'fill'} the container - there is no room left for supplies. Let ${cargo.length === 1 ? 'it' : 'them'} go to carry gear instead, or grow the container.</p>`
      : `<p class="px-note px-wrap">${names} ${cargo.length === 1 ? 'leaves' : 'leave'} ${cargoSquaresLabel(free)} for supplies.</p>`;
  }

  /**
   * The rim's word on the clock, as the raid's clock chip will put it.
   *
   * An explorer run's clock is eight hours and its chip never counts them, so
   * the screen says what that means rather than printing it as `480:00`, and
   * takes nothing off for recovery, because `raidClockMs` does not.
   */
  private clockNote(): string {
    const night = isNightRaid(new Date());
    if (isPlaytestRun()) {
      return `${night ? 'night raid' : 'raid'} with no clock to beat: an explorer run lasts ${PLAYTEST_RAID_DURATION_MS / 3_600_000} hours`;
    }
    return `${night ? 'night raid clock' : 'raid clock'} ${formatRecoveryClock(this.raidClockMs)}${this.pendingRecoveryMs === 0 ? '' : ` (${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery)`}`;
  }

  /**
   * The third card on the base screen. It is a next step rather than a recovery
   * route - it is what extraction is *for* - so it sits with the other two, and
   * it says how far along the base is so the card is a standing goal rather
   * than a door the player has to open to find out.
   */
  /** What Bill is looking at: this save's vault, record and trip. */
  private get traderCounter(): TraderCounter {
    return {
      stash: this.stash,
      progress: traderProgressOf(this.savedGame.raidProgress),
      rationUsed: this.savedGame.traderRationUsed,
      berthPaid: this.savedGame.traderBerthPaid,
    };
  }

  /**
   * The boat: standing at the top, then the two halves of what he does.
   *
   * They are two windows and never one list, because the whole design rests on
   * the difference - the shelf is money and supplies and is rationed, the
   * barter table is found goods for the things money may not buy. A player who
   * cannot see which is which will read the screen as a shop.
   */
  private traderView(): string {
    const counter = this.traderCounter;
    const standing = traderStanding(counter.progress);
    const next = nextTraderStanding(counter.progress);
    const left = rationLeft(counter);
    const stock = traderStockOffers(counter);
    const barters = traderBarterOffers(counter);
    // Where the cursor lands on this screen - and nowhere, while a deal is
    // asking: `refocus` takes the *first* `data-cursor-start` in the document,
    // so a shelf row still carrying one took the cursor off the armed strip and
    // the second press of the key that armed the deal bought a Poke Ball.
    const first =
      this.traderArmed !== undefined
        ? undefined
        : (stock.find((offer) => offer.refusal === undefined) ??
          barters.find((offer) => offer.refusal === undefined));

    const standingNote = next
      ? `${traderStandingPoints(counter.progress)} with him · ${next.pointsShort} more for ${next.tier.name}`
      : `${traderStandingPoints(counter.progress)} with him · nothing held back`;
    // Two lines at most. What raises standing is said only while there is a
    // tier left to raise it to, and said as the three prices rather than as a
    // sentence about them: the paragraph that was here took a third of the
    // screen off the two lists the screen is actually for.
    const standingPane = pixelWindow(
      `<div class="px-lead">${pixelFigure('bill', 'Bill')}<p class="px-wrap">${standing.note}</p></div>${
        next
          ? `<p class="px-wrap px-note">Bank a contract +${STANDING_PER_CONTRACT}, beat a boss +${STANDING_PER_BOSS}, spend ${formatMoney(POKEDOLLARS_PER_STANDING)} +1.</p>`
          : ''
      }`,
      { className: 'trader-standing', heading: `Standing · ${standing.name}`, note: standingNote },
    );

    const shelf = stock
      .map((offer) => {
        const name = this.itemName(offer.item.itemId);
        const limit = traderStockLimit(counter, offer.item);
        const what = getItemById(offer.item.itemId)?.description ?? '';
        const open = offer.refusal === undefined && limit > 0;
        const count = open ? clampCount(this.counterCounts.get(`buy:${offer.item.itemId}`) ?? 1, 1, limit) : 1;
        const price = shopPriceColumn([
          {
            ask: formatMoney(offer.item.price * count),
            short: offer.refusal === 'money-short' || moneyHeld(this.stash) < offer.item.price * count,
          },
        ]);
        if (open) {
          const help = `Buy ${count} ${name} for ${formatMoney(offer.item.price * count)}. ${limit === 1 ? 'That is all this trip allows' : `Up to ${limit} this trip`}.`;
          // The row is a pair, because a quantity is a control of its own: the
          // row still buys, and the selector beside it says how many. What the
          // thing *does* is the row's own line either way - a shelf that only
          // priced its stock told a player nothing they did not already know.
          return `<div class="px-pair"><button class="px-row has-icon px-tall px-priced" data-buy="${offer.item.itemId}" data-shows="${offer.item.itemId}" data-help="${escapeAttribute(help)}"${offer === first ? ' data-cursor-start' : ''}>${itemIcon(offer.item.itemId, name)}<span class="px-row-main"><strong class="px-name">${name}${count > 1 ? ` ×${count}` : ''}</strong><small class="px-wrap">${what}</small></span>${price}</button>${countSelector({ kind: 'buy', id: offer.item.itemId, label: name, value: count, min: 1, max: limit, help, limit: traderStockLimitReason(counter, offer.item) })}</div>`;
        }
        const tag = pixelTag(offer.refusal === 'money-short' ? 'Short' : offer.refusal === 'ration-spent' ? 'Spent' : 'Locked');
        // Never `disabled`: the cursor has to reach a row to say why it is shut.
        const wiring = `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
        return `<button class="px-row has-icon px-tall px-priced" ${wiring} data-shows="${offer.item.itemId}">${itemIcon(offer.item.itemId, name)}<span class="px-row-main"><strong class="px-name">${name}</strong><small class="px-wrap">${what}</small></span>${price}${tag}</button>`;
      })
      .join('');
    const shelfShown = stock.find((offer) => offer.refusal === undefined) ?? stock[0];
    const shelfDetails = stock
      .map((offer) => this.stockDetail(counter, offer, offer === shelfShown))
      .join('');
    const shelfPane = pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pricedCounted)}>${shelf}</div>${shelfDetails}${this.berthRow(counter)}`,
      {
        className: 'objectives-panel trader-shelf',
        heading: 'Off the deck',
        // A heading bar's note clips at about the width of the longest one that
        // has to fit, and this pane is the narrow half of the screen: "He sells
        // a stranger nothing" came out as "HE SELLS A STRANGER NOTHIN". Why he
        // is selling nothing is the standing pane's line, right above it.
        note: standing.ration === 0 ? 'Nothing for you yet' : `${left} of ${standing.ration} left this trip`,
      },
    );

    const table = barters
      .map((offer) => {
        const { barter } = offer;
        const taken = offer.refusal === 'already-taken';
        const limit = traderBarterLimit(counter, barter);
        const what = getItemById(barter.gives.itemId)?.description ?? barter.detail;
        const repeats = offer.refusal === undefined && !barter.once && limit > 1;
        const count = repeats ? clampCount(this.counterCounts.get(`barter:${barter.id}`) ?? 1, 1, limit) : 1;
        if (this.traderArmed === barter.id) {
          return this.armedDeal({
            id: barter.id,
            icon: iconMarkup(barter.icon, barter.name),
            name: count > 1 ? `${barter.name} ×${count}` : barter.name,
            question: `Hand over ${itemAmountsFor(barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * count })))} for good?`,
            confirm: `data-barter-confirm="${barter.id}"`,
            confirmLabel: 'Hand it over',
            confirmHelp: `Spends ${escapeAttribute(itemAmountsFor(barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * count }))))} for good.`,
          });
        }
        // A struck deal's price column says it is paid, as a built rung's does:
        // "Traded" there stood beside the TRADED tag and said one word twice.
        const price = taken
          ? shopPaidColumn('Paid')
          : shopPriceColumn(
              barter.takes.map(({ itemId, quantity }) =>
                pricePart(
                  formatTraderStacks([{ itemId, quantity: quantity * count }]),
                  this.stash.itemCount(itemId),
                  quantity * count,
                  'in the vault',
                  itemIcon(itemId, this.itemName(itemId)),
                ),
              ),
            );
        const tag = taken
          ? pixelTag('Traded', 'secure', true)
          : offer.refusal === undefined
            ? pixelTag('Trade', 'good')
            : pixelTag(offer.refusal === 'goods-short' ? 'Short' : 'Locked');
        const goods = barter.takes.map(({ itemId }) => this.itemName(itemId).toLowerCase()).join(' and ');
        const help =
          offer.refusal === undefined
            ? `Hand over ${itemAmountsFor(barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * count })))} for ${count === 1 ? withArticle(barter.name) : `${count} ${barter.name}s`}. He asks again.`
            : offer.message ?? '';
        const wiring =
          offer.refusal === undefined
            ? `data-barter="${barter.id}" data-help="${escapeAttribute(help)}"`
            : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(help)}"`;
        const row = `<button class="px-row has-icon px-tall px-priced${taken ? ' is-secured' : ''}" ${wiring} data-shows="${barter.id}"${offer === first ? ' data-cursor-start' : ''}>${iconMarkup(barter.icon, barter.name)}<span class="px-row-main"><strong class="px-name">${barter.name}</strong><small class="px-wrap">${what}</small></span>${price}${taken ? tag : repeats ? '' : tag}</button>`;
        return repeats
          ? `<div class="px-pair">${row}${countSelector({ kind: 'barter', id: barter.id, label: barter.name, value: count, min: 1, max: limit, help, limit: `Your ${goods} cover ${limit} at most.` })}</div>`
          : row;
      })
      .join('');
    const shown = barters.find((offer) => offer.refusal === undefined) ?? barters[0];
    const details = barters.map((offer) => this.barterDetail(offer, offer === shown)).join('');
    const tablePane = pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pricedCounted)}>${table}</div>${details}`, {
      className: 'objectives-panel trader-table',
      heading: 'Out of the hold',
      // Short, because a heading bar's note clips: "Found goods only · no scrip
      // buys these" came out as "FOUND GOODS ONLY · NO SI" on the real stage.
      note: 'No money buys these',
    });

    return `<main class="px-body trader-layout">${standingPane}${shelfPane}${tablePane}</main>`;
  }

  /**
   * The berth, along the bottom of his shelf: one more column of the secure
   * container, this raid only.
   *
   * It stands in the shelf's own window rather than in a third pane because it
   * is the other thing money buys, and it says "this raid only" in the row
   * itself - the words that keep it distinct from Brock's locker, which
   * is the same stack for good. That comparison is the help bar's, not the
   * row's: spelled out on the row it wrapped to three lines and took the shelf
   * above it down to two and a half. Its price is the row's own price column,
   * as every other price on these two screens now is.
   */
  private berthRow(counter: TraderCounter): string {
    const offer = checkBerth(counter);
    const paid = offer.refusal === 'already-paid';
    const squares = berthSquares(this.flow.secureGrid);
    const heading = '<h3 class="px-subheading">A berth in the hold</h3>';
    if (this.traderArmed === BERTH_DEAL) {
      return `<div class="px-list">${heading}${this.armedDeal({
        id: BERTH_DEAL,
        icon: iconMarkup('supply-crate', 'Berth'),
        name: 'Berth',
        question: `Pay ${formatMoney(TRADER_BERTH_PRICE)} for one raid, used or not?`,
        confirm: 'data-berth-confirm',
        confirmLabel: 'Pay for it',
        confirmHelp: `Spends ${formatMoney(TRADER_BERTH_PRICE)} on the coming raid.`,
      })}</div>`;
    }
    const wiring = paid
      ? `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`
      : offer.refusal === undefined
        ? `data-berth data-help="${escapeAttribute(`One more protected stack for one raid. Brock builds one for good.`)}"`
        : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
    const tag = paid
      ? pixelTag('Paid', 'secure', true)
      : offer.refusal === undefined
        ? pixelTag('Rent', 'good')
        : pixelTag(offer.refusal === 'money-short' ? 'Short' : 'Locked');
    const price = paid
      ? shopPaidColumn(formatMoney(TRADER_BERTH_PRICE))
      : shopPriceColumn([
          { ask: formatMoney(TRADER_BERTH_PRICE), short: offer.refusal === 'money-short' },
        ]);
    return `<div class="px-list">${heading}<button class="px-row has-icon px-tall px-priced${paid ? ' is-secured' : ''}" ${wiring}>${iconMarkup('supply-crate', 'Berth')}<span class="px-row-main"><strong class="px-name">Berth</strong><small class="px-wrap">+${squares} protected squares, this raid.</small></span>${price}${tag}</button></div>`;
  }

  /** What the shelf's pointed-at row is, what it costs, and what is shutting it. */
  private stockDetail(counter: TraderCounter, offer: TraderStockOffer, shown: boolean): string {
    const { item } = offer;
    const held = moneyHeld(this.stash);
    const left = rationLeft(counter);
    const ration = traderStanding(counter.progress).ration;
    const footprint = footprintOf(item.itemId);
    const squares = footprint.width * footprint.height;
    return shopDetailPane({
      id: item.itemId,
      shown,
      effect: getItemById(item.itemId)?.description ?? this.itemName(item.itemId),
      // Short on purpose: this pane stands in the narrow half of the screen,
      // under a list of five, and the row above it has already said what the
      // thing does. What it adds is the room it takes and the two gates.
      detail: `${squares} ${squares === 1 ? 'square' : 'squares'} in the pack.`,
      priceLabel: 'Price',
      price: [
        // Money is held as a sum, so both halves are written as one: ₽120 against ₽300.
        {
          ask: formatMoney(item.price),
          held: `${formatMoney(held)} in the vault`,
          short: held < item.price,
          icon: itemIcon(CURRENCY_ITEM_ID, this.itemName(CURRENCY_ITEM_ID)),
        },
        {
          ask: '1 of his ration',
          held: ration === 0 ? 'he sells you nothing yet' : `${left} of ${ration} left this trip`,
          short: left <= 0,
        },
      ],
      ...(offer.refusal === undefined
        ? { note: 'A ration not spent is gone with the trip.' }
        : { blocked: offer.message ?? '' }),
    });
  }

  /** What one barter hands over and what it hands back, before either is spent. */
  private barterDetail(offer: TraderBarterOffer, shown: boolean): string {
    const { barter } = offer;
    const taken = offer.refusal === 'already-taken';
    const count = barter.once
      ? 1
      : clampCount(this.counterCounts.get(`barter:${barter.id}`) ?? 1, 1, Math.max(1, traderBarterLimit(this.traderCounter, barter)));
    return shopDetailPane({
      id: barter.id,
      shown,
      effect: getItemById(barter.gives.itemId)?.description ?? barter.name,
      detail: barter.detail,
      priceLabel: taken ? 'What it took' : 'You hand over',
      price: barter.takes.map(({ itemId, quantity }) =>
        taken
          ? { ask: formatTraderStacks([{ itemId, quantity }]), icon: itemIcon(itemId, this.itemName(itemId)) }
          : pricePart(
              formatTraderStacks([{ itemId, quantity: quantity * count }]),
              this.stash.itemCount(itemId),
              quantity * count,
              'in the vault',
              itemIcon(itemId, this.itemName(itemId)),
            ),
      ),
      ...(taken
        ? { note: 'Traded, and he only had the one.' }
        : offer.refusal === undefined
          ? { note: 'No money changes hands, and found goods are the only thing that buys this.' }
          : { blocked: offer.message ?? '' }),
    });
  }

  /**
   * A deal asked again before it is struck.
   *
   * Found goods, a berth and the materials a workshop rung takes are all spent
   * for good on one press, so each is asked twice, without a screen of its
   * own: the row becomes the question and two buttons, with the cursor on the
   * one that changes nothing - because the key that armed the deal is still
   * under the player's finger, which is why `trainerChallengePrompt` opens on
   * BACK AWAY. Nothing about the shelf is armed: a Potion for Pokedollars is an ordinary
   * purchase, already rationed, and asking twice for one would be friction.
   */
  private armedDeal(deal: {
    readonly id: string;
    readonly icon: string;
    readonly name: string;
    readonly question: string;
    readonly confirm: string;
    readonly confirmLabel: string;
    readonly confirmHelp: string;
  }): string {
    return `<div class="px-pair px-arming" data-shows="${deal.id}"><div class="px-row has-icon px-tall">${deal.icon}<span class="px-row-main"><strong class="px-name">${deal.name}</strong><small class="px-wrap px-warning">${deal.question}</small></span></div><div class="px-bar-actions"><button class="px-window px-button" data-deal-cancel data-cursor-start data-shows="${deal.id}" data-help="Nothing changes.">Keep them</button><button class="px-window px-button is-danger" ${deal.confirm} data-shows="${deal.id}" data-help="${deal.confirmHelp}">${deal.confirmLabel}</button></div></div>`;
  }

  /**
   * One deal across the counter. Every path through it reloads the save the
   * deal was struck against, because the vault it spends is the stored one and
   * the screen is only a picture of it.
   */
  private dealAtCounter(deal: () => { readonly ok: boolean; readonly message: string }): void {
    const result = deal();
    if (result.ok) {
      audioManager.play('confirm');
      const reloaded = this.saveManager.load();
      if (reloaded) {
        const view = this.view;
        this.applyLoadedGame(reloaded);
        this.view = view;
      }
    } else {
      audioManager.play('cancel');
    }
    this.setStatus(result.message);
  }

  private get workshopLadder(): readonly WorkshopOffer[] {
    return workshopOffers(this.workshopVault, this.builtUpgradeIds);
  }

  /**
   * A rung's price against this vault: one part a line, each carrying what the
   * base actually holds towards it, and red on whatever it cannot cover.
   *
   * It is counted the way it is *spent* rather than owned - by
   * `spendableSupply`, which is what stands above the wipe kit. A price beside
   * a number the player cannot spend is worse than no number at all.
   */
  private pricedAgainstVault(offer: WorkshopOffer): readonly ShopPricePart[] {
    const { cost } = offer.upgrade;
    return [
      ...cost.supplies.map(({ itemId, quantity }) =>
        pricePart(
          formatStacks([{ itemId, quantity }]),
          spendableSupply(this.workshopVault, itemId),
          quantity,
          'spare at base',
          itemIcon(itemId, this.itemName(itemId)),
        ),
      ),
    ];
  }

  /** The same price with nothing said about the vault: what a built rung cost. */
  private priceAsPaid(upgrade: WorkshopUpgrade): readonly ShopPricePart[] {
    return [
      ...upgrade.cost.supplies.map(({ itemId, quantity }) => ({
        ask: formatStacks([{ itemId, quantity }]),
        icon: itemIcon(itemId, this.itemName(itemId)),
      })),
    ];
  }

  /** Why a rung cannot be built yet, as the status line says it when one is chosen. */
  private shortfallLine(offer: WorkshopOffer): string {
    if (offer.state === 'locked') {
      return `${offer.upgrade.name} is built after ${offer.requires?.name ?? 'an earlier upgrade'}.`;
    }
    return `${offer.upgrade.name} still needs ${itemAmountsFor(offer.suppliesShort)}.`;
  }

  /**
   * The ladder. Every rung is listed whether or not it can be afforded, with
   * what it still needs, because a goal the player cannot see is not a goal.
   *
   * A rung's own line is **what it does**, built or not. It used to be the
   * price while unbought and the effect once built, which hid what a thing was
   * at exactly the moment a player was deciding whether to buy it and explained
   * the purchase only once the money was gone. The price is a column of its own
   * on the right, the way a shop shelf has always answered both questions at
   * once, and the whole picture - the longer promise, the price against this
   * vault, and whatever is stopping it - is the pane under the list, which
   * follows the cursor. See `ui/shopDetail.ts`.
   */
  private workshopView(): string {
    const ladder = this.workshopLadder;
    const first = ladder.find((offer) => offer.affordable) ?? ladder.find((offer) => offer.state !== 'built');
    const rows = ladder
      .map((offer) => {
        const { upgrade } = offer;
        if (this.workshopArmed === upgrade.id) {
          const spent = itemAmountsFor(upgrade.cost.supplies);
          return this.armedDeal({
            id: upgrade.id,
            icon: iconMarkup(upgrade.icon, upgrade.name),
            name: upgrade.name,
            question: `Spend ${spent} on it for good?`,
            confirm: `data-outfit-confirm="${upgrade.id}"`,
            confirmLabel: 'Build it',
            confirmHelp: `Spends ${escapeAttribute(spent)} for good.`,
          });
        }
        const built = offer.state === 'built';
        const tag = built
          ? pixelTag('Built', 'secure', true)
          : offer.affordable
            ? pixelTag('Build', 'good')
            : pixelTag(offer.state === 'locked' ? 'Locked' : 'Short');
        // A locked rung says which door it is behind on the row as well as in
        // the pane: "Locked" alone sends the player looking for the answer.
        const gate =
          offer.state === 'locked'
            ? `<small class="px-wrap px-note">After ${offer.requires?.name ?? 'an earlier upgrade'}</small>`
            : '';
        const price = built
          ? shopPaidColumn('Paid')
          : shopPriceColumn(this.pricedAgainstVault(offer));
        // Not `disabled`: the cursor has to reach a rung to say what it does.
        const wiring = built
          ? `data-built="${upgrade.id}"`
          : `data-outfit="${upgrade.id}"${offer.affordable ? '' : ' aria-disabled="true"'}`;
        // One line of the help bar, which is 26 game pixels deep and clips: at
        // the smallest stage a second line hangs a pixel over its own bar. The
        // price is on the row and the whole of it is in the pane, so the bar
        // says what pressing this does and nothing else.
        const help = built
          ? `${upgrade.name} already stands at base.`
          : offer.affordable
            ? `Build ${upgrade.name}: you are asked once more before anything is spent.`
            : this.shortfallLine(offer);
        // While a rung is asking, only its Keep may start the cursor.
        const start = offer === first && this.workshopArmed === undefined;
        return `<button class="px-row has-icon px-tall px-priced${built ? ' is-secured' : ''}" ${wiring}${start ? ' data-cursor-start' : ''} data-shows="${upgrade.id}" data-help="${escapeAttribute(help)}">${iconMarkup(upgrade.icon, upgrade.name)}<span class="px-row-main"><strong class="px-name">${upgrade.name}</strong><small class="px-wrap">${upgrade.effect}</small>${gate}</span>${price}${tag}</button>`;
      })
      .join('');
    const shown = first ?? ladder[0];
    const details = ladder.map((offer) => this.workshopDetail(offer, offer === shown)).join('');
    // Brock leads his own screen the way Bill leads his: the person, then what
    // he will do for you. One line, because the ladder under it is the screen.
    const brock = pixelWindow(
      `<div class="px-lead">${pixelFigure('brock', 'Brock')}<p class="px-wrap">Bring him the right salvage and he builds it into the base. He builds; he does not deal.</p></div>`,
      // The title bar has already said where this is, so the pane says who: the
      // person, not the place again.
      { className: 'trader-standing workshop-lead', heading: 'Brock', note: `${ladder.filter((offer) => offer.state === 'built').length}/${WORKSHOP_UPGRADES.length} built` },
    );
    return `<main class="px-body workshop-layout">${brock}${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.priced)}>${rows}</div>${details}`,
      {
        className: 'objectives-panel',
        heading: 'What extraction buys',
        note: SHORT_MARK_LEGEND,
      },
    )}</main>`;
  }

  /** One rung, whole: what it does, what it costs against this vault, and its gate. */
  private workshopDetail(offer: WorkshopOffer, shown: boolean): string {
    const { upgrade } = offer;
    const built = offer.state === 'built';
    return shopDetailPane({
      id: upgrade.id,
      shown,
      effect: upgrade.effect,
      detail: upgrade.detail,
      priceLabel: built ? 'What it cost' : 'Price',
      price: built ? this.priceAsPaid(upgrade) : this.pricedAgainstVault(offer),
      ...(built
        ? { note: 'Built. It stands at base for good, on every raid from here.' }
        : offer.state === 'locked'
          ? {
              blocked: `Built only after ${offer.requires?.name ?? 'an earlier upgrade'}, which is still unbuilt.`,
            }
          : offer.affordable
            ? { note: 'You can pay for this now. You are asked once more before anything is spent.' }
            : { blocked: this.shortfallLine(offer) }),
    });
  }

  private swapPanel(): string {
    const spare = this.sparePartner;
    if (!spare) return '';
    // Said as an option to a player who has lost nothing yet, whose one Pokemon
    // is the partner they chose a moment ago, and as the news it is to one a
    // wipe has left with one (playtest 47).
    const afterALoss = raidsLost(this.savedGame.raidProgress) > 0;
    const heading = afterALoss ? 'Down to one Pokémon' : 'Swap your partner';
    const lead = afterALoss
      ? `${spare.pokemon.name} is all you have left. You can trade it`
      : `While ${spare.pokemon.name} is your only Pokémon, you can trade it`;
    return `<section class="swap-panel"><h3 class="px-subheading">${heading}</h3><p class="px-note px-wrap">${lead} for a level 5 starter, which arrives in the condition ${spare.pokemon.name} is in now - the species you settle on is the one you are re-issued after a wipe.</p><button class="px-window px-button" data-view="reselect" data-help="Only offered while one Pokémon is left at base.">Choose a new partner</button></section>`;
  }

  private reselectView(): string {
    const spare = this.sparePartner;
    if (!spare) return '<main class="px-body"><p class="px-window px-empty">You have more than one Pokémon, so there is nothing to swap.</p></main>';
    const chosen = getStarterSpecies(this.reselectStarterId);
    const held = `${spare.pokemon.name} (Level ${spare.pokemon.level})`;
    return `<main class="px-body starter-shell reselect-shell"><p class="starter-brief">${held} is your last Pokémon. Swapping releases it for good for a level 5 starter as hurt as it is now, with no supplies: a change of direction, never an upgrade or a heal.</p><div class="starter-grid" ${pixelColumns(100, { maximum: 3, widest: 132 })}>${starterCards(this.reselectStarterId, { heldSpeciesId: spare.pokemon.base.id, selectHelp: 'Swap to this starter.' })}</div>${this.swapFooter(spare, chosen)}</main>`;
  }

  private swapFooter(spare: StashedPokemon, chosen: PokemonBase): string {
    if (spare.pokemon.base.id === chosen.id) {
      return pixelCommitBar({
        title: chosen.name,
        lines: ['<span class="px-wrap">Already yours. Pick a different starter to swap.</span>'],
        actions: `<button class="px-window px-button is-primary" disabled>Swap for ${chosen.name}</button>`,
      });
    }
    if (!this.swapArmed) {
      return pixelCommitBar({
        title: chosen.name,
        lines: [`<span class="px-wrap" data-swap-condition>Arrives as: ${this.swapArrival(spare, chosen)}</span>`],
        actions: `<button class="px-window px-button is-primary" data-swap-arm data-help="You will be asked once more before anything is released.">Swap for ${chosen.name}</button>`,
      });
    }
    return pixelCommitBar({
      className: 'is-arming',
      title: `Release ${spare.pokemon.name} (Level ${spare.pokemon.level})?`,
      lines: [`<span class="px-wrap px-warning" data-swap-condition>This cannot be undone. It is gone for good. ${chosen.name} arrives as ${conditionLine(starterInConditionOf(spare.pokemon, chosen))}.</span>`],
      // Keep stands last, in the seat the swap button had, so the second click
      // of a double-click lands on the answer that changes nothing.
      actions: `<button class="px-window px-button is-danger" data-swap-confirm data-help="Releases ${escapeAttribute(spare.pokemon.name)} for good.">Release and take ${chosen.name}</button><button class="px-window px-button" data-swap-cancel data-cursor-start data-help="Nothing changes.">Keep ${spare.pokemon.name}</button>`,
    });
  }

  /**
   * What the swap hands over, worded the way the stash will word it a click
   * later: the old partner's condition on the new species, then its moves.
   */
  private swapArrival(spare: StashedPokemon, chosen: PokemonBase): string {
    const incoming = starterInConditionOf(spare.pokemon, chosen);
    return `${conditionLine(incoming)} · ${incoming.moves.map((move) => move.base.name).join(', ')}`;
  }

  /** Raids that have ended on this save: what the Day-Care's growth is counted in. */
  private get raidsEnded(): number {
    return raidsCompleted(this.savedGame.raidProgress, this.savedGame.raidInFlight);
  }

  /**
   * THE DAY-CARE's pick list (`hub/dayCare.ts`). The man has said his piece in
   * the yard before it opens (`BaseScene.speakToDayCareMan`) and says the rest
   * there when it closes: every Pokémon at base, each saying whether he would
   * take it and, when not, why.
   */
  private dayCareView(): string {
    const shown = this.findablePokemon;
    const rows = shown
      .map((stored, index) => {
        const refusal = dayCareRefusal(this.stash, stored.id);
        const name = escapeAttribute(stored.pokemon.name);
        const wiring =
          refusal === undefined
            ? `data-day-care-leave="${stored.id}" data-help="Leave ${name} with him. It grows half a level with every raid you go on."`
            : `data-refused="${escapeAttribute(refusal)}" aria-disabled="true" data-help="${escapeAttribute(refusal)}"`;
        return `<button class="px-row" ${wiring} data-shows="${stored.id}"${index === 0 ? ' data-cursor-start' : ''}>${this.pokemonRowBody(stored, refusal === undefined ? pixelTag('Leave') : '')}</button>`;
      })
      .join('');
    const details = shown
      .map((stored, index) =>
        this.pokemonDetail(stored, index === 0, {
          label: 'Day-Care',
          chips: (shows) => {
            const refusal = dayCareRefusal(this.stash, stored.id);
            return this.chip(
              refusal === undefined ? `data-day-care-leave="${stored.id}" ${shows}` : `data-refused="${escapeAttribute(refusal)}" ${shows}`,
              refusal ?? `Leave ${stored.pokemon.name} with him.`,
              'Leave it with him',
              refusal !== undefined,
            );
          },
        }),
      )
      .join('');
    return `<main class="px-body daycare-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${this.browseBar(false)}${rows || '<p class="px-empty">No Pokémon answers that.</p>'}</div>${details}`,
      { className: 'stash-roster', heading: 'Which Pokémon should I raise?', note: `${this.stashPokemon.length} at base` },
    )}</main>`;
  }

  /** Hands one Pokémon to the Day-Care Man, if he will take it. */
  private leaveAtDayCare(pokemonId: string): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    const refusal = dayCareRefusal(this.stash, pokemonId);
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.name;
    if (refusal !== undefined || name === undefined) {
      this.refuse(refusal ?? 'That Pokémon isn’t at base.');
      return;
    }
    this.stash.leaveAtDayCare(pokemonId, this.raidsEnded);
    if (!this.writeGame()) {
      this.reloadAfterFailedWrite('He could not take it: the game could not be saved.');
      return;
    }
    // He says so in the yard, where he and the pen it is walking about in are.
    audioManager.play('confirm');
    this.scene.start('base', {
      savedGame: this.saveManager.load() ?? this.savedGame,
      ...(this.enteredAt === undefined ? {} : { at: this.enteredAt }),
      said: leftLines(name),
    });
  }

  /**
   * Reads the game back out of storage onto this screen, staying on it. A
   * Pokémon going to or coming back from the Day-Care changes who is at base,
   * and the loadout this screen keeps was built against who was there before.
   */
  private readTheGameAgain(): void {
    const reloaded = this.saveManager.load();
    if (reloaded) {
      const view = this.view;
      this.applyLoadedGame(reloaded);
      this.view = view;
    }
  }

  /** A write that did not land leaves this screen's copy ahead of storage, so it is read again. */
  private reloadAfterFailedWrite(message: string): void {
    this.readTheGameAgain();
    this.refuse(message);
  }

  private itemName(itemId: string): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  /** A status line that is the game saying no. */
  private refuse(message: string): void {
    audioManager.play('denied');
    this.setStatus(message);
  }

  /**
   * The deployment flow answers a request with a message only when it refuses
   * it, so the message's presence is what decides the sound.
   */
  private answer(refusal: string | undefined, accepted?: SoundEffectName): void {
    if (refusal !== undefined) {
      this.refuse(refusal);
      return;
    }
    if (accepted) {
      audioManager.play(accepted);
    }
    this.setStatus(undefined);
  }

  /**
   * Shows a status line, and takes it down again without touching the screen.
   *
   * Taking it down used to be a whole `render()` on a 2.2s timer, and a render
   * replaces every button on the screen. One that fired between a mousedown and
   * its mouseup left the press on a button that no longer existed, so the click
   * never happened: "Enter the raid" took focus and did nothing, and the second
   * click worked. It also threw the keyboard back to the first button on the
   * screen under a player who was mid-way down a list. Timers stacked as well,
   * so an old message's timer cut a newer message short. There is now at most
   * one, and all it removes is the line it was started for.
   */
  private setStatus(message: string | undefined): void {
    this.statusTimer?.remove();
    this.statusTimer = undefined;
    this.status = message ?? '';
    this.render();
    if (message !== undefined) {
      this.statusTimer = this.time.delayedCall(2200, () => this.clearStatus());
    }
  }

  private clearStatus(): void {
    this.statusTimer = undefined;
    this.status = '';
    takeDownPixelStatus(this.overlay.root);
  }
}

/**
 * What a supply row owes a player about where it is used, when that is not
 * here. A disc and a stone are read from the raid pack and nowhere else (the
 * treatment bench takes medicine only), and the Center listed TM40 with what
 * it teaches and nothing about how (playtest 47).
 */
function usedInARaid(item: ItemDefinition): string {
  switch (item.effect.type) {
    case 'machine':
      return ` ${READ_IN_A_RAID}`;
    case 'evolution-stone':
      return ` Pack it, then use it from your pack (${RAID_KEY_LETTERS.bag}) in a raid.`;
    default:
      return '';
  }
}

