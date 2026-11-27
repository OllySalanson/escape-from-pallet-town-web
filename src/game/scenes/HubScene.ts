import { honoursWorn } from '../look/gymHonours';
import { namesSeenTwice, rimNameOf, rimTeamLine } from '../hub/rimTeam';
import { raidConditions } from '../world/secrets';
import { chartWhole, NO_TREASURE_HUNT } from '../treasure/treasureMap';
import Phaser from 'phaser';
import { readLook } from '../look/look';
import { countPlay, mapDetail } from '../analytics/playCounter';
import type { FeedbackDetail } from '../feedback/feedbackContext';
import { audioManager } from '../audio/AudioManager';
import type {
  DeploymentFlow} from '../hub';
import {
  beaconUnlockAtMs,
  checkBerth,
  formatRecoveryClock,
  getWorkshopUpgrade,
  hasBeacon,
  WORKSHOP_UPGRADES,
  workshopOffers,
  raidClockAfterRecovery,
  spendableSupply,
  buildDropInBriefing,
  doorHolder,
  largestMapSize,
  doorPromise,
  stillToFind,
  type DropInBriefing,
  TRADER_BERTH_PRICE,
  TRADER_BERTH_STANDING,
  traderBarterLimit,
  traderBarterOffers,
  traderStockLimit,
  traderStockLimitReason,
  traderStanding,
  traderStandingPoints,
  traderStockOffers,
  nextTraderStanding,
  rationLeft,
  moneyHeld,
  STANDING_PER_BOSS,
  STANDING_PER_CONTRACT,
  POKEDOLLARS_PER_STANDING,
  berthSquares,
  barterDetail as barterDetailOnOffer,
  type Deployment,
  type TraderBarterOffer,
  type TraderCounter,
  type TraderStockOffer,
  type WorkshopOffer,
  type WorkshopUpgrade,
  type WorkshopVault,
} from '../hub';
import {
  Bag,
  CURRENCY_ITEM_ID,
  formatMoney,
  itemCountTag,
  ITEM_DEFINITIONS,
  getItemById,
  isCurrency,
  isFoundOnly,
  itemAmountFor,
  itemAmountsFor,
  type ItemDefinition,
  type ItemId,
  MATERIAL_IDS,
} from '../items';
import { } from '../ui/gridArranging';
import { ItemHoverHelp } from '../ui/itemHoverHelp';
import { flowForGame, offeredInsertions, type ArenaKit } from '../base/arenaKit';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
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
  frontDoorFor,
  generateRunPlan,
  generateRoomLoot,
  withRoomLoot,
  type RunInsertion,
  type RunInsertionId,
  landingPlace,
  requireInsertion,
} from '../run/runGeneration';
import {
  contractCarryIn,
  jobChoice,
  jobsForMap,
  mayTurnJobDown,
  noJobChoice,
  formatStacks,
  missingCarryIn,
  objectivesForContract,
  type RaidContract,
} from '../objectives';
import { deferPendingMoves, nextPendingMoveOffer } from '../hub/pendingMoves';
import { benchRailWarning, rimOpensAwayFromJumpIn, type RailWarning } from '../hub/railWarning';
import {
  cycleChoice,
  rimChoiceRow,
  rimClock,
  rimHunterTile,
  rimJobTile,
  rimArrowDirection,
  rimLandingToward,
  rimTabStep,
  rimLandingOrder,
  rimPackTile,
  rimSkyValue,
  rimTeamTile,
  type RimChoiceRowOptions,
  type RimRowId,
} from '../hub/rimCard';
import { nextGym } from '../world/valeQuarters';
import { jobAsks } from '../hub/rimJob';
import { raidsDeployed, SaveManager, spareAtBase, traderProgressOf, type RestoredGame } from '../save/SaveManager';
import {
  searchPokemon,
  sortPokemon,
  nextStashSort,
  STASH_SORT_HELP,
  STASH_SORT_LABELS,
  type StashSort,
} from '../hub/stashBrowser';
import {
  getStarterSpecies,
  starterInConditionOf,
  type StarterSpeciesId,
  type Stash,
  type StashedPokemon,
} from '../stash';
import { iconMarkup, itemIcon } from '../ui/icons';
import { hunterThreatFor, hunterThreatLine, type HunterThreat } from '../world/hunterThreat';
import { hunterRival, rivalForRaid } from '../world/hunters';
import { HUNTER_TIERS } from '../world/hunter';
import { isNightRaid } from '../world/nightRaids';
import { clockAfterWaiting, raidSky, waitableSkies, waitedSkyNote, WAIT_FOR_DARK_MS } from '../base/raidSky';
import { windowLight, type WindowLight } from '../base/homeClock';
import type { GridPosition } from '../movement/gridMovement';
import { type WorldMapId, worldMapIds, worldMapMaker, worldMapName } from '../worldMap';
import { MINIMAP_PALETTE, type Minimap } from '../world/minimap';
import { fitMapPictures, mapPictureFrame, pictureRowAttributes } from '../ui/mapPicture';
import { wallMapContext, wallMapOrder, wallMapEntries, wallMapNote, wallMapPicture, type WallMapEntry } from '../base/wallMap';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { moveChoiceMessage } from '../ui/moveChooser';
import { MenuOverlay } from '../ui/MenuOverlay';
import { conditionLine } from '../ui/condition';
import { drawFixtureScaled, fixtureArt, fixtureDivisor } from '../ui/fixturePicture';
import { canBeMoved } from '../base/fixtures';
import { drawRoomPicture, fitRoomPictures, roomPictureMark, roomPictureMarkup, watchRoomPictures } from '../ui/roomPicture';
import { workshopEffectPicture } from '../ui/workshopEffect';
import { partTag, partTags, shopCardPane } from '../ui/shopCard';
import { buildRoom, roomNamed, type BuiltRoom } from '../base/rooms';
import { roomPosterPicture } from '../base/roomPosters';
import { TRADER_STANDINGS } from '../hub/trader';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelFigure,
  pixelScreen,
  pixelTag,
  pixelWindow,
  takeDownPixelStatus,
} from '../ui/pixelUi';
import {
  pricePart,
  SHORT_MARK,
  type ShopPricePart,
} from '../ui/shopDetail';
import { starterCards } from '../ui/starterPicker';
import { askedDealIndex, focusDirectionForKey, RELEASE_ARMING_MS } from '../ui/spatialFocus';
import { clampCount, countKeyTarget, countSelector, COUNT_BIG_STEP, neighbourCountIndex } from '../ui/countSelector';
import {
  errandLoot,
  errandPlace,
  errandRewardFor,
  errandSquares,
  errandThing,
  errandsInHand,
  errandsToLay,
  errandForItem,
} from '../hub/errands';
import { pokedexOwned } from '../hub/pokedex';
import { caughtLegends } from '../world/legends';
import { awayOnRaid, createRaidInFlight, outOnRaidLine, raidHeartbeat } from '../run/raidInFlight';
import { isFirstRaid } from '../hub/firstRaid';
import { hasRaidStake } from '../world/raidStake';
import { JOB_WALK_ALLOWANCE, quickerLandingFor, rewardLine, standingJobWalk } from '../objectives/standingBoard';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { joyRailLine } from '../hub/centerCounter';
import { DAY_CARE_LEAST_RAID_MS, dayCareRefusal, leftLines, raidsCompleted } from '../hub/dayCare';
import { dayCareBody } from '../hub/dayCareView';
import { tradesBody } from '../hub/tradesView';
import { tradeDealFor, tradeHelp, tradeQuestion, tradeRefusal } from '../hub/trades';
import { TRADER_POSITION } from '../base/harbourLife';
import { skyNote, skyTurns } from '../base/homeClock';
import { friendRoom, friendRoomsOffered, raidName } from '../raidRoom/friendRoom';
import { typedRoomCode } from '../raidRoom/roomCode';
import { friendRoomView, friendStatusLine, type RoomMapChoice } from '../hub/friendRoomView';
import { keyHint } from '../input/keyBindings';
import { withArticle } from '../ui/article';


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
  /** Over the fence at once, with the card never drawn: there is nothing on it to decide (`hub/firstRaid.ts`). */
  readonly straightOver?: boolean;
  /**
   * BROCK'S WORKSHOP's card the cursor starts on: the build Brock has just
   * talked about, or the chalked bay the player walked up to.
   */
  readonly build?: string;
  /**
   * The rim's card opened by a player just home from a raid, who has not taken
   * a step: the cursor starts on the card's first row, so SPACE pressed through the result
   * screen does not carry on over the fence (`BaseScene.homeOnTheRail`).
   */
  readonly justHome?: boolean;
}

/**
 * What the hall's panels show: who comes (`bench`), what they carry (`rack`),
 * what comes home whatever happens (`locker`), and where they would land (`rim`).
 */
/**
 * A station of THE RAID ARENA's hall. Only the rim is a panel of this scene:
 * the bench opens YOUR TEAM and the rack and the locker YOUR THINGS
 * (`BaseScene.openHallPanel`).
 */
export type ArenaPanel = 'bench' | 'rack' | 'locker' | 'rim';
type HubPanel = Extract<ArenaPanel, 'rim'>;

const ARENA_PANELS: readonly string[] = ['rim'] satisfies readonly HubPanel[];

/** Every base screen, and the hall's panels. */
type HubView = HubPanel | 'reselect' | 'workshop' | 'trader' | 'wallmap' | 'daycare' | 'trades' | 'friend';

/**
 * How much of the menu layer a panel over the hall may take, in game pixels: as
 * little as the smallest screen every screen is authored against, or a little
 * over half of a big window, so the hall is always there beside it. The rim's
 * lies along the foot of the window, because what it is looking at is the pit.
 */
/** The purse rolls down to what a buy leaves in this many steps, this far apart (`rollMoney`). */
const MONEY_ROLL_STEPS = 8;
const MONEY_ROLL_STEP_MS = 40;
/** A build lands with two knocks this far apart, and its card's gold stars last this long. */
const BUILD_KNOCK_GAP_MS = 160;
const BUILD_STARS_MS = 900;

/**
 * A build's name as its card along the bottom of Brock's Workshop says it, in
 * one line - LOCKER I, HEALING II, WARD, as the mock-up has them. The card on
 * the right and the help bar say it in full.
 */
export function cardName(name: string): string {
  return name.replace(/^Healing machine/, 'Healing').replace(/^The ward$/, 'Ward');
}
const PANEL_MIN_WIDTH = 320;
const PANEL_SHARE = 0.56;
/** The rim card's heading while nobody can go: what the card is saying, before where it would have gone. */
export const RIM_REFUSED_TITLE = 'Nobody can jump yet';

/** Below this many game pixels across, the rim card's tiles say each fact in its short form. */
const RIM_NARROW_WIDTH = 560;
/** How wide the rim's card is when it stands down the right of the window, in the panel's units. */
const RIM_SIDE_WIDTH = 228;
/** How much room it must leave the portal, against the window's height, to stand there. */
const RIM_SIDE_ROOM = 0.65;
/** The least height of window a card down the side is tall enough in. */
const RIM_SIDE_LEAST_HEIGHT = 300;

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

/**
 * What `traderArmed` holds for a shelf row: the item under a prefix of its
 * own, because an item id and a barter id are two namespaces and the one
 * armed field must never read one as the other.
 */
function stockDeal(itemId: string): string {
  return `stock:${itemId}`;
}

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

/**
 * How much longer than a straight walk a job really takes: the stops, getting
 * your bearings and the lines read on the way. The playtests of 22 Nov 2026
 * took two to three times the straight walk, and a player who trusted the
 * straight figure alone ran out of clock (tester 4's release blocker 3).
 */

/** What the rim says of a raid another window is playing, on the card and on the press. */
const RAID_ELSEWHERE_LINE = 'A raid is already under way in another window. Finish it there first.';

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
  private view: HubView = 'workshop';
  /** Which screen `render` last drew, so a redraw of it keeps its scroll. */
  private drawnScreen: string | undefined;
  /** The base door this screen was walked in through, if any - see `leaveToBase`. */
  private enteredFrom: string | undefined;
  /** Where in that room the player stood to open it, when it was not the mat. */
  private enteredAt: GridPosition | undefined;
  /** The map on Oak's wall being read close up, or undefined while all four are. */
  private wallMapInspect: WorldMapId | undefined;
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
  /** The build BROCK'S WORKSHOP opened on (`HubSceneData.build`). */
  private workshopStartsOn: string | undefined;
  /**
   * The deal on the boat asked but not yet struck: a barter id, `BERTH_DEAL`,
   * or a shelf row's `stockDeal`.
   *
   * Found goods, money and the trip's ration are all spent for good, so nothing
   * at his counter goes through on one press. It is one at a time, because
   * arming a second disarms the first.
   */
  private traderArmed: string | undefined;
  /** The Pokémon THE TRADER's list is asking about (`hub/trades.ts`), by stash id. */
  private tradeArmed: string | undefined;
  /** Bill's card just dealt, which the cursor goes back to while it is still open. */
  private traderLastDeal: string | undefined;
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
  private straightOver = false;
  private justHome = false;
  /**
   * A darker sky the rim was asked to wait for (`base/raidSky.ts`): the moor's
   * dusk or the fold's night for a player whose own clock is not there. It is
   * this visit's choice only, and costs the raid a minute of its clock.
   */
  private waitedSky: WindowLight | undefined;
  /**
   * The job chosen at the rim for this raid (`jobChoice`): a job's id, its
   * `noJobChoice` to go without one, or undefined for the board's own. This
   * visit's choice only, as the sky is.
   */
  private jobPick: string | undefined;
  /** Whether the browser is being asked if another window's raid is still there. */
  private askingElsewhere = false;
  private deploying = false;
  /** Whether the raid room's database is being asked something (`raidRoom/`). */
  private roomBusy = false;
  /** What is typed in the room code field. */
  private roomTyped = '';
  /**
   * How the player is looking at their Pokemon: in what order, and for whom.
   * It is not saved - it is where the cursor is, not what is owned.
   */
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
    // Each visit to a screen starts its cursor afresh (`traderView`).
    this.traderLastDeal = undefined;
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
    this.view = data.view ?? 'workshop';
    this.enteredFrom = data.from;
    this.enteredAt = data.at;
    this.straightOver = data.straightOver === true;
    this.workshopStartsOn = data.build;
    this.justHome = data.justHome === true;
    this.waitedSky = undefined;
    this.jobPick = undefined;
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
    this.reselectStarterId = this.startingStarterId();
    this.swapArmed = false;
    this.workshopArmed = undefined;
    this.traderArmed = undefined;
    this.tradeArmed = undefined;
    this.wallMapInspect = undefined;
    this.deploying = false;
    // A fresh look at a freshly loaded vault: nothing narrowed, nothing picked up.
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
      fitRoomPictures(this.overlay.root, unit);
    };
    if (this.goOverIfThereIsNothingToRead()) {
      return;
    }
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

  /** Nothing to read and nothing to choose: over the fence, unless something refuses, and then the card is there to say what. */
  private goOverIfThereIsNothingToRead(): boolean {
    if (!this.straightOver) {
      return false;
    }
    this.startRun();
    return this.deploying;
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
    // Not one out on a raid in another window: its ending writes its moves back.
    const away = awayOnRaid(this.savedGame);
    const waiting = nextPendingMoveOffer(this.stashPokemon.filter((stored) => !away.has(stored.id)), raids);
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
      if (this.movedOnElsewhere() || this.outOnRaid(waiting.id)) {
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

  /**
   * The supplies at base: what a raid out in another window packed is that
   * raid's until it ends (`spareAtBase`), so it is not counted here.
   */
  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.spare(item.id) > 0);
  }

  private spare(itemId: string): number {
    return spareAtBase(this.savedGameNow, itemId);
  }

  /**
   * The contract a raid inserting here would carry. A contract belongs to its
   * map, so the insertion list *is* the contract board: choosing where to drop
   * in is choosing which contract to take, and no separate acceptance step can
   * fall out of step with it.
   */
  private contractFor(insertionId: RunInsertionId): RaidContract | undefined {
    // The first raid is for finding out what a raid is (`hub/firstRaid.ts`).
    if (isFirstRaid(this.savedGame.raidProgress)) {
      return undefined;
    }
    return jobChoice(this.jobsAt(insertionId), this.jobPick);
  }

  /** The jobs a raid inserting here may carry (`jobsForMap`), none on a first raid. */
  private jobsAt(insertionId: RunInsertionId): readonly RaidContract[] {
    return isFirstRaid(this.savedGame.raidProgress) ? [] : jobsForMap(requireInsertion(insertionId).mapId, this.savedGame.raidProgress);
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
    // The rim's is as tall as what it says (`.arena-panel.is-rim`), and in a
    // narrow window (a phone on its side) its tiles say the short form of each fact.
    const tall = Math.floor((layer?.clientHeight ?? 0) / unit);
    // A window with room beside the portal for it stands the card down its right, as
    // the other panels stand, and leaves the pit seen whole on the left
    // (`base/arenaPortal.ts`); a tall or small one keeps it along its foot.
    const side = this.view === 'rim' && wide - RIM_SIDE_WIDTH >= tall * RIM_SIDE_ROOM && tall >= RIM_SIDE_LEAST_HEIGHT;
    this.overlay.root.toggleAttribute('data-rim-side', side);
    this.overlay.root.toggleAttribute('data-rim-narrow', this.view === 'rim' && !side && wide < RIM_NARROW_WIDTH);
    if (side) {
      this.overlay.root.style.setProperty('--dock', String(RIM_SIDE_WIDTH));
    } else if (this.view !== 'rim') {
      this.overlay.root.style.setProperty('--dock', String(Math.min(wide, Math.max(PANEL_MIN_WIDTH, Math.floor(wide * PANEL_SHARE)))));
    }
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
      : clockAfterWaiting(raidClockAfterRecovery(RAID_DURATION_MS, this.pendingRecoveryMs), this.waitingForSky);
  }

  /** Whether this raid waits on the rim for a darker sky, and can: an explorer run never waits. */
  private get waitingForSky(): boolean {
    return !isPlaytestRun() && this.waitedSky !== undefined && waitableSkies(new Date()).includes(this.waitedSky);
  }

  /** The sky a raid jumped now will have: the one waited for, else the player's own clock. */
  private get raidLight(): WindowLight {
    return this.waitingForSky ? raidSky(new Date(), this.waitedSky) : windowLight(new Date());
  }

  /** Every workshop upgrade standing at base, by id. */
  private get builtUpgradeIds(): readonly string[] {
    return this.savedGame.raidProgress.workshopUpgrades;
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
    this.tradeArmed = undefined;
    this.wallMapInspect = undefined;
    if (view === 'reselect') {
      this.reselectStarterId = this.startingStarterId();
    }
  }

  private confirmSwap(): void {
    if (!this.sparePartner) {
      this.swapArmed = false;
      this.refuse('Swapping is only offered while one Pokémon remains at base.');
      return;
    }
    if (awayOnRaid(this.savedGame).has(this.sparePartner.id)) {
      this.swapArmed = false;
      this.outOnRaid(this.sparePartner.id);
      return;
    }
    if (!this.saveManager.reselectStarter(this.reselectStarterId)) {
      this.swapArmed = false;
      this.refuse('That swap could not be saved.');
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow, so a swapped-away Pokemon can
      // never linger in a half-built loadout.
      this.applyLoadedGame(reloaded);
    }
    // Still on the swap, now holding the new partner: the X takes the player back.
    this.swapArmed = false;
    this.reselectStarterId = this.startingStarterId();
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

  /**
   * Answers the asked deal with NOT NOW: nothing is spent, and the cursor goes
   * back to the row that asked rather than to the top of the list, because the
   * player was choosing that one and may only have changed the count.
   */
  private putDealDown(): void {
    const traded = this.traderArmed;
    const row =
      this.workshopArmed !== undefined
        ? `[data-outfit="${this.workshopArmed}"]`
        : this.tradeArmed !== undefined
          ? `[data-trade="${this.tradeArmed}"]`
          : traded === undefined
          ? undefined
          : traded === BERTH_DEAL
            ? '[data-berth]'
            : traded.startsWith(stockDeal(''))
              ? `[data-buy="${traded.slice(stockDeal('').length)}"]`
              : `[data-barter="${traded}"]`;
    this.workshopArmed = undefined;
    this.traderArmed = undefined;
    this.tradeArmed = undefined;
    this.render();
    if (row) {
      this.overlay.focus(row);
    }
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
    this.setStatus(`${result.upgrade.name} built.`);
    // Two knocks of Brock's hammer, and a burst of gold stars over the card
    // of what he has just built.
    audioManager.play('bump');
    this.time.delayedCall(BUILD_KNOCK_GAP_MS, () => audioManager.play('bump'));
    const card = this.overlay?.root.querySelector<HTMLElement>(`[data-built="${upgradeId}"]`);
    card?.classList.add('is-just-built');
    this.time.delayedCall(BUILD_STARS_MS, () => card?.classList.remove('is-just-built'));
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

  /**
   * Out into the yard to choose where a build stands (`base/fixturePlacing.ts`):
   * BUILD IT spends its parts when it is put down there, MOVE IT costs nothing.
   */
  private placeInYard(upgradeId: string, mode: 'build' | 'move'): void {
    // Two tabs share one save: one that has moved on is caught up instead.
    if (this.movedOnElsewhere()) {
      return;
    }
    audioManager.play('confirm');
    this.scene.start('base', { savedGame: this.saveManager.load() ?? this.savedGame, placing: { upgradeId, mode } });
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
        this.askWhetherLiveElsewhere(underWay.id);
      } else if (this.kit) {
        // Closing a panel stays in the same hall, which settles nothing, and
        // JUMP IN would only ever close the panel again.
        this.scene.start('base', { room: 'raid-arena' });
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

    const items = deployment.items;
    // The raid is started in memory before anything about it is written, so a
    // raid the manager refuses costs nothing. Written first, a refusal left a
    // raid recorded as under way that never began, the player hanging over the
    // pit, and a reload that settled it as abandoned and took the pack (the
    // raids bug hunt of 9 Nov 2026, fault 1).
    try {
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
    } catch (error) {
      console.error(error);
      this.refuse('That raid could not be started. Nothing was taken - try the jump again.');
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
    // And recorded as under way until it ends, so a raid left by closing the
    // tab costs its pack rather than nothing (`run/raidInFlight.ts`).
    // It names the Pokemon that went, which are the raid's until it ends: two
    // tabs share one save, and the base in the other may not touch them.
    const inFlight = {
      ...createRaidInFlight(
        requireInsertion(deployment.insertionId).mapId,
        items,
        deployment.stashSecureSlot.items ?? [],
        deployment.packItemId,
        deployment.party.map((stored) => stored.id),
      ),
      // Where it went in, for the raid log (`run/raidLog.ts`).
      insertionId: deployment.insertionId,
    };
    const recorded = this.saveManager.recordRaidInFlight(inFlight);
    if (recorded) {
      raidHeartbeat.start(inFlight.id, () => new SaveManager().raidInFlightId() === inFlight.id);
    }
    // Remembered on the way out rather than on the way home, because it is what
    // the player chose and a raid that goes badly chose it too.
    new SaveManager().recordSecurePreference(deployment.securePreference);
    // The one the hall stood on an empty bench is not the team (`benchIsStandIn`):
    // recorded, the partner it stood in for was left at home once healed.
    if (!this.flow.benchIsStandIn) {
      new SaveManager().recordBench(deployment.party.map((stored) => stored.id));
    }
    new SaveManager().choosePack(Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])), this.flow.leftOut);
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
        // Read before this raid is counted. The explorer's walk and a maker's try are not a first raid.
        ...(isFirstRaid(this.savedGame.raidProgress) && !isPlaytestRun() && hasRaidStake(requireInsertion(deployment.insertionId).mapId)
          ? { firstRaid: true }
          : {}),
      },
      // Which landmarks the world keeps worked, and whose exits therefore
      // stand open from the first second - the same list the lobby's map read.
      this.savedGame.raidProgress.completedContracts,
      // And the doors a field move has already opened, which are as much a part
      // of this raid's collision as a beaten boss's are.
      this.savedGame.raidProgress.openedGates ?? [],
      // Night by the player's own clock, read as the raid leaves - the same
      // reading the drop-in screen's wildlife was just shown in - or the night
      // the rim was asked to wait for.
      this.raidLight === 'night',
      // The legends the Pokedex owns, which stand nowhere this raid.
      caughtLegends(pokedexOwned(this.savedGame.raidProgress.pokedexOwned, this.stash)),
      // What the people at base are waiting on, each laid in its own place.
      errandsToLay(this.savedGame.raidProgress, (itemId) => this.heldOrOnTheMachine(itemId), (speciesId) => this.pokedexOwns(speciesId)).map(errandLoot),
      // What the vale's secrets wait for, fixed now for the whole raid: the
      // hour, the day, who leads, what is packed and the badges in the case
      // (`world/secrets.ts`).
      {
        conditions: raidConditions(
          new Date(),
          deployment.party.map((stored) => stored.pokemon),
          items,
          chartWhole(this.savedGame.raidProgress.treasureHunt ?? NO_TREASURE_HUNT),
          this.savedGame.raidProgress.defeatedBosses,
          this.raidLight,
        ),
        known: {
          secretsFound: this.savedGame.raidProgress.secretsFound ?? [],
          giftsReceived: this.savedGame.raidProgress.giftsReceived,
        },
      },
    );
    // A raid with friends shares its map's ground: the room's loot, laid from
    // the room's seed, in place of this raid's own (`raidRoom/roomLoot.ts`).
    // What is this player's own stays theirs (`isRaidsOwnLoot`): the stake, a
    // secret's reward, and an errand's thing - somebody at their base is waiting.
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
      // Every ending settles this raid and no other (`SaveManager.ownsRaid`).
      recorded ? inFlight.id : undefined,
      honoursWorn(this.savedGame.raidProgress),
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

  /**
   * A fresh pulse says the raid in the save is being played in another window,
   * but a crashed window leaves one too. The browser is asked whether that
   * window is still there before the jump is refused; when it is not, its
   * pulse is taken away and the jump goes on to settle the raid it left
   * (`RaidHeartbeat.stillLiveElsewhere`).
   */
  private askWhetherLiveElsewhere(raidId: string): void {
    if (this.askingElsewhere) {
      return;
    }
    this.askingElsewhere = true;
    const view = this.view;
    void raidHeartbeat.stillLiveElsewhere(raidId).then((live) => {
      this.askingElsewhere = false;
      if (!this.sys.isActive() || this.view !== view) {
        return;
      }
      if (live) {
        this.refuse(RAID_ELSEWHERE_LINE);
      } else {
        this.startRun();
      }
    });
  }

  private goBack(): void {
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
    if (
      event.key === 'Escape' &&
      (this.swapArmed || this.workshopArmed !== undefined || this.traderArmed !== undefined || this.tradeArmed !== undefined)
    ) {
      event.preventDefault();
      audioManager.play('cancel');
      this.swapArmed = false;
      this.putDealDown();
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
    // On the rim each key does one thing (`hub/rimCard.ts`): the arrows move
    // between the drop-ins and nothing else, Enter jumps in, and Tab takes
    // the highlight down the card's rows. The arrows used to walk the rows and
    // change them, so reaching a landing was three presses up and then a walk
    // west to east (the captain, 26 Nov 2026).
    if (this.view === 'rim' && this.rimKey(event)) {
      event.preventDefault();
      return;
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
    if (kind === 'buy' || kind === 'barter') {
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
    if (this.view === 'reselect') return 'Swap your partner';
    if (this.view === 'workshop') return 'Brock’s Workshop';
    if (this.view === 'trader') return 'Bill’s Cottage';
    if (this.view === 'wallmap') return this.wallMapInspect ? worldMapName(this.wallMapInspect) : 'The wall map';
    if (this.view === 'daycare') return 'Day-Care';
    if (this.view === 'trades') return 'The Trader';
    if (this.view === 'friend') return 'Raid with a friend';
    return 'The rim';
  }

  /**
   * A step back up inside the screen, named for where it goes: the partner
   * swap is reached from the PC, and one map close up from all four. Every
   * other view's only way out is the X, back into the room it is kept in.
   */
  private get stepBack(): { readonly label: string; readonly attribute: string } | undefined {
    // Named for the PC it was opened from: `atHome` is the PC's own view, so asked here it was never true.
    if (this.view === 'wallmap' && this.wallMapInspect) return { label: 'Wall map', attribute: 'data-back' };
    return undefined;
  }

  /** What the keys do, said once along the bottom of every screen, on a line of its own that never goes. */
  private get hints(): string {
    // A map close up is mostly reading, and only PG DN reads past what fits:
    // the line said ARROWS alone, and ArrowDown on a new save moved nothing
    // (the harbour critic tour, 26 Nov 2026).
    if (this.view === 'wallmap' && this.wallMapInspect) return 'ARROWS move · PG DN read on · ESC back';
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
      // Every room has a way out, Oak's Lab included: the X puts the screen
      // away and leaves the player in the room it is kept in.
      ...(this.stepBack ? { back: this.stepBack } : {}),
      close: { attribute: 'data-close' },
      aside:
        this.isPanel || ARENA_PANELS.includes(this.view)
          ? this.panelAside()
          : this.view === 'reselect'
            ? undefined
            : // On the boat the one fact every deal turns on is the money, so
              // it is the title bar's aside rather than a line inside a pane
              // that scrolls away from the row being priced.
              this.view === 'trader'
                ? `${itemIcon(CURRENCY_ITEM_ID, '')}<span data-money-roll>${formatMoney(moneyHeld(this.stash))}</span>`
                : this.view === 'workshop'
                  ? this.workshopPartsAside()
                  : this.view === 'wallmap'
                  ? wallMapNote(this.savedGame)
                  : this.view === 'daycare' || this.view === 'trades'
                    ? `${this.stashPokemon.filter((stored) => !awayOnRaid(this.savedGame).has(stored.id)).length} Pokémon at base`
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
    // A keeper's room, as the yard draws it for this save (`ui/roomPicture.ts`).
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-room-picture]').forEach((canvas) => {
      const built = this.builtRoom(canvas.dataset.roomPicture ?? '');
      if (built) {
        drawRoomPicture(
          canvas,
          built,
          (key) => (this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as CanvasImageSource) : undefined),
          (index) => roomPosterPicture(this.savedGame, built.posters[index]),
        );
      }
    });
    // Once painted, so the floor it is framed in can be read off the room.
    if (typeof getComputedStyle === 'function' && root.querySelector('.room-pic')) {
      const unit = (): number => Number.parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 0;
      fitRoomPictures(root, unit());
      watchRoomPictures(root, unit);
    }
    // Brock's rungs are pictures of what they build, drawn from the base's own
    // sheets, which the yard under this screen has already loaded.
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-fixture]').forEach((canvas) => {
      const art = fixtureArt(canvas.dataset.fixture ?? '');
      if (art) {
        const image = (key: string) =>
          this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as CanvasImageSource) : undefined;
        drawFixtureScaled(canvas, art, image, Number(canvas.dataset.fixtureDivisor ?? 1));
      }
    });
    const on = (selector: string, handler: (button: HTMLButtonElement, event: MouseEvent) => void): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = (event) => handler(button, event);
      });
    };
    const rerender = (change: () => void): void => {
      change();
      this.render();
    };
    this.hoverHelp?.redrawn();
    on('[data-back]', () => this.goBack());
    on('[data-close]', () => this.leaveToBase());
    // A value row on the rim's card: its left arrow goes back, anywhere else on it goes on.
    on('[data-rim-row]', (button, event) => {
      // A key on the LAND row is a bump: the arrows move the landing, and SPACE
      // mashed through the result screen must never move it. SPACE on JOB or
      // SKY, reached by Tab, steps it on. A click (a pointer's click has a
      // count; a key's has none) steps any row.
      if (event.detail === 0 && button.dataset.rimRow === 'landing') {
        audioManager.play('bump');
        return;
      }
      const back = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-rim-step]')?.dataset.rimStep === '-1';
      if (button.classList.contains('is-fixed')) {
        audioManager.play('bump');
        return;
      }
      this.stepRimRow(button.dataset.rimRow as RimRowId, back ? -1 : 1);
    });
    // A tile is no control, so the cursor never lands on it; pointing at one
    // (or a finger on it) puts its whole sentence on the help line, and the line
    // goes back to the highlighted control's when the pointer leaves.
    const rimHelp = root.querySelector<HTMLElement>('.rim-help');
    if (rimHelp) {
      const highlighted = (): string =>
        (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-help]')?.dataset.help ?? rimHelp.dataset.helpDefault ?? '';
      root.querySelectorAll<HTMLElement>('[data-rim-tile]').forEach((tile) => {
        tile.onpointerenter = () => {
          rimHelp.textContent = tile.dataset.help ?? '';
        };
        tile.onpointerleave = () => {
          rimHelp.textContent = highlighted();
        };
      });
    }
    on('[data-view]', (button) => rerender(() => this.setView(button.dataset.view as HubView)));
    on('[data-starter]', (button) =>
      rerender(() => {
        this.reselectStarterId = button.dataset.starter as StarterSpeciesId;
        this.swapArmed = false;
      }),
    );
    on('[data-box-sort]', () => rerender(() => { this.stashSort = nextStashSort(this.stashSort); }));
    on('[data-box-find]', () => rerender(() => { this.boxEditing = 'find'; }));
    on('[data-box-clear]', () => rerender(() => { this.stashSearch = ''; }));
    on('[data-box-cancel]', () => rerender(() => { this.boxEditing = undefined; }));
    this.wireBoxForm(root);
    on('[data-swap-arm]', () => rerender(() => { this.swapArmed = true; this.armRelease(); }));
    // The swap's button names the starter under the cursor: it named the one
    // clicked last while the gold ring stood on another, on a screen that
    // releases a Pokémon for good (the harbour re-critic). Only the bar is
    // redrawn, never the screen under the cursor.
    root.querySelectorAll<HTMLButtonElement>('[data-starter]').forEach((card) => {
      card.onfocus = () => {
        const id = card.dataset.starter as StarterSpeciesId;
        const spare = this.sparePartner;
        const bar = root.querySelector<HTMLElement>('[data-swap-footer]');
        if (!spare || !bar || id === this.reselectStarterId) return;
        this.reselectStarterId = id;
        this.swapArmed = false;
        root.querySelectorAll<HTMLElement>('[data-starter]').forEach((each) => {
          each.classList.toggle('is-selected', each === card);
          each.setAttribute('aria-pressed', String(each === card));
        });
        bar.innerHTML = this.swapFooter(spare, getStarterSpecies(id));
        const arm = bar.querySelector<HTMLButtonElement>('[data-swap-arm]');
        if (arm) arm.onclick = () => rerender(() => { this.swapArmed = true; this.armRelease(); });
      };
    });
    on('[data-swap-cancel]', () => rerender(() => { this.swapArmed = false; }));
    on('[data-swap-confirm]', (_button, event) => {
      if (!this.clickedTooSoon(event, '[data-swap-cancel]')) this.confirmSwap();
    });
    // Materials are spent for good, so a rung asks before it takes them: the
    // first press arms it and the second is a different button, with the cursor
    // on the one that keeps them (`armedDeal`), exactly as Bill's barters do.
    on('[data-outfit]', (button) => this.armUpgrade(button.dataset.outfit!));
    on('[data-built]', (button) => {
      const upgradeId = button.dataset.built!;
      // A build with somewhere else to stand is moved out in the yard, for nothing.
      if (canBeMoved(upgradeId)) {
        this.placeInYard(upgradeId, 'move');
      } else {
        this.setStatus(`${getWorkshopUpgrade(upgradeId)?.name ?? 'That upgrade'} already stands at base.`);
      }
    });
    on('[data-outfit-confirm]', (button, event) => {
      if (this.clickedTooSoon(event, '[data-deal-cancel]')) return;
      const upgradeId = button.dataset.outfitConfirm!;
      // Where it stands is chosen out in the yard, and the parts are spent
      // there, when it is put down; a build with one place is built here.
      if (canBeMoved(upgradeId)) {
        this.workshopArmed = undefined;
        this.placeInYard(upgradeId, 'build');
      } else {
        this.buildUpgrade(upgradeId);
      }
    });
    // Money and the trip's ration are spent for good too, so a shelf row asks
    // before it buys, as the barters below do: a double ENTER on a Potion
    // bought two and spent a TRUSTED save's whole ration while the status line
    // said "Bought one" (the midgame bug hunt of 11 Nov 2026).
    on('[data-buy]', (button) => rerender(() => { this.traderArmed = stockDeal(button.dataset.buy!); this.armRelease(); }));
    on('[data-buy-confirm]', (button, event) => {
      if (this.clickedTooSoon(event, '[data-deal-cancel]')) return;
      const itemId = button.dataset.buyConfirm!;
      const count = this.counterCounts.get(`buy:${itemId}`) ?? 1;
      this.counterCounts.delete(`buy:${itemId}`);
      this.traderArmed = undefined;
      this.traderLastDeal = itemId;
      this.dealAtCounter(() => this.saveManager.buyTraderStock(itemId, count));
    });
    // Found goods are gone for good, so the row asks before it takes them: the
    // first press arms the deal and the second is a different button, with the
    // cursor on the one that keeps them (`armedDeal`).
    on('[data-barter]', (button) => rerender(() => { this.traderArmed = button.dataset.barter; this.armRelease(); }));
    on('[data-deal-cancel]', () => this.putDealDown());
    on('[data-barter-confirm]', (button, event) => {
      if (this.clickedTooSoon(event, '[data-deal-cancel]')) return;
      const barterId = button.dataset.barterConfirm!;
      const count = this.counterCounts.get(`barter:${barterId}`) ?? 1;
      this.counterCounts.delete(`barter:${barterId}`);
      this.traderArmed = undefined;
      this.traderLastDeal = barterId;
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
    // A trade of his is for good, so the row asks before it is made, as Bill's
    // barters do: the first press arms it, and the second is a different button.
    // The chip that asked stays on the card, so the cursor would stay on it,
    // scrolled out of sight under the card's MORE, and a second press asked
    // again rather than reaching the bar (scenario loop, 23 Nov 2026). It goes
    // to KEEP IT, where the shelf's and the barters' own questions leave it.
    on('[data-trade]', (button) => {
      rerender(() => { this.tradeArmed = button.dataset.trade; this.armRelease(); });
      this.overlay.focus('[data-deal-cancel]');
    });
    on('[data-trade-confirm]', (button, event) => {
      if (!this.clickedTooSoon(event, '[data-deal-cancel]')) this.makeTrade(button.dataset.tradeConfirm!);
    });
    // The way in the player is stood over is in view in its list, whichever it is.
    root.querySelector<HTMLElement>('[data-insertion].is-selected')?.scrollIntoView?.({ block: 'nearest' });
    // The cursor starts on what the screen is for, never on the way out of it:
    // a screen with nothing to choose yet (raiding with a friend before a name
    // is chosen) starts with no cursor at all, and ESC or the X still close it.
    this.overlay.refocus('.px-field', '[data-cursor-start]', '.px-body button:not([disabled])', 'button:not(.px-close, [data-close])');
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

  /** The room last built for a picture, and the save it was built from: built again only when the save is. */
  private builtRooms: { readonly game: RestoredGame; readonly rooms: Map<string, BuiltRoom> } | undefined;

  /** A room of the base as this save has it, for its keeper's screen to show. */
  private builtRoom(id: string): BuiltRoom | undefined {
    const room = roomNamed(id);
    if (!room || !this.savedGame) {
      return undefined;
    }
    if (this.builtRooms?.game !== this.savedGame) {
      this.builtRooms = { game: this.savedGame, rooms: new Map() };
    }
    let built = this.builtRooms.rooms.get(id);
    if (!built) {
      built = buildRoom(room, this.savedGame);
      this.builtRooms.rooms.set(id, built);
    }
    return built;
  }

  /** The markup for a keeper's room as a picture; painted once the screen is on the page. */
  private roomPicture(id: string, label: string, marks = ''): string {
    const built = this.builtRoom(id);
    return built ? roomPictureMarkup(built, label, marks) : '';
  }

  /** What a panel's title bar says at a glance: the number that panel is about. */
  private panelAside(): string {
    return isPlaytestRun() ? '' : formatRecoveryClock(this.raidClockMs);
  }

  private content(): string {
    if (this.view === 'reselect') return this.reselectView();
    if (this.view === 'workshop') return this.workshopView();
    if (this.view === 'trader') return this.traderView();
    if (this.view === 'wallmap') return this.wallMapView();
    if (this.view === 'daycare') return this.dayCareView();
    if (this.view === 'trades') return this.tradesView();
    if (this.view === 'friend') return this.friendView();
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
      ? `<small class="px-wrap room-note">${room.hostName ? `${room.hostName}’s room` : 'Your room'} ${room.code} · ${worldMapName(room.mapId)}</small>`
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
      friendLine: room ? friendStatusLine(friendRoom()?.friends() ?? [], mapName) : '',
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
            ? `That room is on ${worldMapName(mapId as WorldMapId)}, which you cannot jump into yet.`
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
      const said = friendStatusLine(rooms.friends(), worldMapName(room.mapId));
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

  private chip(attributes: string, help: string, label: string, disabled = false): string {
    return `<button class="px-window px-chip" ${attributes} data-help="${escapeAttribute(help)}"${disabled ? ' aria-disabled="true"' : ''}>${label}</button>`;
  }

  /**
   * The strip that leads every list of Pokemon at base: the order, and a
   * search. It is sticky at the top of its own scroll pane, so however long the
   * list is the way to narrow it is on screen. A field replaces it while one is
   * being typed into.
   */
  private browseBar(): string {
    if (this.boxEditing) {
      return `<form class="box-bar box-form" data-box-form="find"><input class="px-window px-field" name="text" value="${escapeAttribute(this.stashSearch)}" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Find a Pokémon" placeholder="A name, e.g. pika" /><button type="submit" class="px-window px-chip" data-help="Show only Pokémon whose name begins with this. Empty shows everyone.">Find</button><button type="button" class="px-window px-chip" data-box-cancel data-help="Leave it as it was.">Cancel</button></form>`;
    }
    const sort = this.chip(
      'data-box-sort',
      `Ordered: ${STASH_SORT_LABELS[this.stashSort]}. ${STASH_SORT_HELP[this.stashSort]} Press for the next order.`,
      `Sort: ${STASH_SORT_LABELS[this.stashSort]}`,
    );
    const searching = this.stashSearch.trim() !== '';
    const find = this.chip(
      'data-box-find',
      searching ? 'Change what you are looking for.' : 'Find a Pokémon by name.',
      searching ? `Find: ${escapeAttribute(this.stashSearch.trim())}` : 'Find',
    );
    const clear = searching ? this.chip('data-box-clear', 'Show everyone again.', 'Clear') : '';
    return `<div class="box-bar"><div class="box-line">${sort}${find}${clear}</div></div>`;
  }

  private submitBoxForm(text: string): void {
    this.boxEditing = undefined;
    this.stashSearch = text.trim();
    audioManager.play('select');
    this.render();
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

  /** The save as this screen holds it: the vault it is changing, and the progress it read. */
  private get savedGameNow(): RestoredGame {
    return { ...this.savedGame, stash: this.stash };
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
        ? 'No Poké Balls packed, so you can only catch with a ball you find out there.'
        : 'No Poké Balls at base, so you can only catch with a ball you find out there.';
    }
    if (balls && party.length > 0 && !this.flow.packHasRoomForACatch) {
      return 'Your pack is full, so a catch has nowhere to go: a Pokémon needs 4 free squares.';
    }
    return '';
  }

  /**
   * THE RIM: looking down over the fence, and the last thing before a jump. The pit
   * behind it is the map, with every way in lit on it, so the card says what the
   * map cannot - what going has at stake - in pictures and numbers
   * (`hub/rimCard.ts`), with the one button that goes.
   *
   * On the left, what is chosen: where to land, the job and the sky, each a
   * `< VALUE >` row that Left and Right change, the clock those leave, and the
   * buttons. On the right, what it means: who comes and who is safe, what a wipe
   * takes, who hunts, and what the job pays against its walk. Each tile's whole
   * sentence is the help line's, under whatever is pointed at or highlighted.
   * A click on a light in the pit chooses that landing, as the LAND row does.
   */
  private rimView(): string {
    const chosen = this.flow.insertionId;
    const refusal = this.flow.notReady;
    // A raid another window is playing is said before JUMP IN is pressed, not
    // only after: a second tab's card offered the jump as usual and refused it
    // on the press (break-it test, 23 Nov 2026). The button stays live, because
    // a crashed window leaves a pulse too and the press asks the browser.
    const underWay = this.saveManager.load()?.raidInFlight;
    const elsewhere = underWay ? raidHeartbeat.liveElsewhere(underWay.id) : false;
    const warning = refusal ? undefined : this.packWarning();
    const stay = rimOpensAwayFromJumpIn(this.flow, this.justHome);
    const rows = this.rimRows(chosen);
    // Why nobody can go heads the card, in red, where the eye starts. At the
    // foot, in the small print under the stakes, it was missed: a player home
    // from a first raid lost in seconds found JUMP IN greyed out and could not
    // see why (the captain, 22 Nov 2026).
    const head = [
      ...(refusal
        ? [`<p class="px-wrap px-warning rim-refusal"><span data-rim-title>${RIM_REFUSED_TITLE}:</span> ${refusal}</p>`]
        : elsewhere
          ? [`<p class="px-wrap px-warning rim-refusal">${RAID_ELSEWHERE_LINE}</p>`]
          : []),
      this.roomNote(),
      ...(warning ? [`<small class="px-wrap px-warning">${warning}</small>`] : []),
    ].filter((line) => line !== '');
    // With nobody able to go, a team about to be finished by the first thing
    // it meets, or a player only just home and still pressing through the
    // result, the cursor starts on the card's first row rather than on JUMP
    // IN, so SPACE does not spend the raid. The X and ESC are the way back.
    const actions = `<div class="px-bar-actions rim-actions"><button class="px-window px-button is-primary" data-start${stay ? '' : ' data-cursor-start'}${refusal ? ` aria-disabled="true" data-help="${escapeAttribute(refusal)}"` : ` data-help="${escapeAttribute(this.rimJumpHelp(chosen))}"`}>Jump in</button></div>`;
    const landing = requireInsertion(chosen);
    const keys = [keyHint('ARROWS', 'LAND'), keyHint('ENTER', 'JUMP IN'), keyHint('TAB', 'JOB, SKY')].join(' ');
    const card = pixelWindow(
      // The card has no title bar, so its X stands in its own top corner, on
      // the line with whatever heads the card.
      `<div class="rim-top"><div class="rim-top-lines">${head.join('')}</div><button class="px-close rim-close" data-close aria-label="Close"></button></div><div class="rim-grid"><div class="rim-controls">${rows.map((row, index) => (index === 0 && stay ? rimChoiceRow(row).replace('<button ', '<button data-cursor-start ') : rimChoiceRow(row))).join('')}${this.rimClockView()}${actions}</div><div class="rim-board" data-rim-about>${this.rimBoard(chosen)}</div></div><p class="rim-foot"><small class="rim-keys">${keys}</small><span class="rim-help" data-help-text data-help-default="${escapeAttribute(landing.description)}">${landing.description}</span></p>`,
      { className: 'confirm-bar rim-card', tag: 'div' },
    );
    return `<main class="px-body rim-layout">${card}</main>`;
  }

  /**
   * What JUMP IN says on the help line: the one or two things that matter most
   * about going now - a hurt team, a Pokémon a wipe would lose for good, a job
   * longer than the clock - before the warning that there is no way back.
   */
  private rimJumpHelp(insertionId: RunInsertionId): string {
    const job = this.rimJob(insertionId);
    const lost = this.flow.riskedPokemon.map(({ pokemon }) => pokemon.name);
    const hurt = this.railHurt();
    const pressing = [
      ...(hurt ? [hurt.line] : []),
      ...(lost.length > 0 ? [`A wipe loses ${lost.join(' and ')} for good.`] : []),
      ...(job.tooLong && job.walk !== undefined
        ? [`The job needs ${formatRecoveryClock(job.walk * STEP_DURATION_MS * JOB_WALK_ALLOWANCE)} of your ${formatRecoveryClock(this.raidClockMs)}.`]
        : []),
    ].slice(0, 2);
    return `${pressing.length > 0 ? `${pressing.join(' ')} ` : ''}Down into the pit: there is no way back from here, and the raid starts.`;
  }

  /** The card's value rows, top to bottom: where, which job, which sky. */
  private rimRows(insertionId: RunInsertionId): readonly RimChoiceRowOptions[] {
    const landings = this.rimLandings();
    const landing = requireInsertion(insertionId);
    const where: RimChoiceRowOptions = {
      id: 'landing',
      label: 'Land',
      value: `<strong>${landingPlace(landing)}</strong>`,
      choices: landings.length,
      at: landings.findIndex((way) => way.id === insertionId) + 1,
      // A landing on another map says whose map it is (`worldMapMaker`), as the button that went there did.
      help: `${landing.description}${landings.length > 1 ? ' The arrows go between the lights on the map, or click one.' : ''}${
        new Set(landings.map((way) => way.mapId)).size > 1
          ? ` On ${worldMapName(landing.mapId)}${worldMapMaker(landing.mapId) ? `, a map by ${worldMapMaker(landing.mapId)}` : ''}.`
          : ''
      }`,
    };
    const jobs = this.rimJobChoices(insertionId);
    const job = this.rimJob(insertionId);
    const jobRow: RimChoiceRowOptions[] =
      jobs.length === 0
        ? []
        : [
            {
              id: 'job',
              label: 'Job',
              value: job.contract ? job.contract.name : 'No job',
              choices: jobs.length,
              at: jobs.indexOf(job.contract?.id ?? noJobChoice(this.jobsAt(insertionId)) ?? '') + 1,
              help: job.sentence,
              warn: job.warn,
            },
          ];
    const skies = this.rimSkyChoices();
    const sky = this.waitingForSky ? this.waitedSky : undefined;
    const skyRow: RimChoiceRowOptions[] = isPlaytestRun()
      ? []
      : [{ id: 'sky', label: 'Sky', value: rimSkyValue(this.raidLight, sky !== undefined, sky !== undefined ? `WAIT ${formatRecoveryClock(WAIT_FOR_DARK_MS)}` : skyTurns(new Date())), choices: skies.length, help: this.rimSkyHelp() }];
    return [where, ...jobRow, ...skyRow];
  }

  /** Every way in the LAND row goes through, in its order (`rimLandingOrder`). */
  private rimLandings(): readonly RunInsertion[] {
    return rimLandingOrder(this.offeredWays.map(([, insertion]) => insertion));
  }

  /** The JOB row's values: each job on offer, and none where a job may be turned down. */
  private rimJobChoices(insertionId: RunInsertionId): readonly string[] {
    const jobs = this.jobsAt(insertionId);
    const none = mayTurnJobDown(jobs) ? noJobChoice(jobs) : undefined;
    return [...jobs.map((job) => job.id), ...(none === undefined ? [] : [none])];
  }

  /** The SKY row's values: now, and each darker sky that can be waited for. */
  private rimSkyChoices(): readonly (WindowLight | undefined)[] {
    return [undefined, ...waitableSkies(new Date())];
  }

  /** The SKY row's sentence: what the clock gives, and what a wait costs. */
  private rimSkyHelp(): string {
    const now = new Date();
    if (this.waitingForSky) {
      return `${waitedSkyNote(this.raidLight)}. SPACE to go now instead.`;
    }
    const waits = waitableSkies(now);
    return waits.length === 0
      ? skyNote(now)
      : `${skyNote(now)}. SPACE to wait on the rim for ${waits.map((sky) => (sky === 'night' ? 'full dark' : 'dusk')).join(' or ')}: some things in the vale only happen then, and it costs ${formatRecoveryClock(WAIT_FOR_DARK_MS)} of the raid clock.`;
  }

  /** A value row changed by Left or Right, or by a press on its arrows: it commits nothing. */
  private stepRimRow(row: RimRowId, by: -1 | 1): void {
    audioManager.play('select');
    if (row === 'landing') {
      const ways = this.rimLandings();
      const current = ways.find((way) => way.id === this.flow.insertionId) ?? ways[0];
      if (current) {
        this.pointAtLanding(cycleChoice(ways, current, by).id);
      }
    } else if (row === 'job') {
      const insertionId = this.flow.insertionId;
      const current = this.contractFor(insertionId)?.id ?? noJobChoice(this.jobsAt(insertionId));
      this.jobPick = cycleChoice(this.rimJobChoices(insertionId), current, by);
      this.render();
    } else {
      this.waitedSky = cycleChoice(this.rimSkyChoices(), this.waitingForSky ? this.waitedSky : undefined, by);
      this.render();
    }
    this.overlay.root.querySelector<HTMLElement>(`[data-rim-row="${row}"]`)?.focus();
  }

  /**
   * A key on the card, answered when it is one of the card's: an arrow to the
   * drop-in that lies that way, Enter to jump in, Tab round the rows.
   */
  private rimKey(event: KeyboardEvent): boolean {
    const direction = rimArrowDirection(event.key);
    if (direction) {
      const next = rimLandingToward(this.rimLandings(), this.flow.insertionId, direction);
      if (next && next !== this.flow.insertionId) {
        audioManager.play('select');
        this.pointAtLanding(next as RunInsertionId);
      } else {
        audioManager.play('bump');
      }
      return true;
    }
    if (event.key === 'Enter') {
      this.rimEnter();
      return true;
    }
    if (event.key === 'Tab') {
      const stops = [...this.overlay.root.querySelectorAll<HTMLElement>('[data-rim-row], .rim-actions button')];
      const at = stops.indexOf(document.activeElement as HTMLElement);
      stops[rimTabStep(stops.length, at, event.shiftKey)]?.focus();
      audioManager.play('select');
      return true;
    }
    return false;
  }

  /**
   * Enter jumps in. A card that opened off JUMP IN (a hurt team, nobody able
   * to go, a player just home and still pressing through the result) takes a
   * first Enter to put the highlight on JUMP IN, so a press meant for the
   * screen before never spends the raid; the next one goes.
   */
  private rimEnter(): void {
    const jump = this.overlay.root.querySelector<HTMLElement>('.rim-actions [data-start]');
    if (!jump) {
      return;
    }
    if (document.activeElement !== jump && rimOpensAwayFromJumpIn(this.flow, this.justHome)) {
      jump.focus();
      audioManager.play('select');
      return;
    }
    jump.focus();
    jump.click();
  }

  /** The raid clock, large, under the rows that set it. */
  private rimClockView(): string {
    const night = this.raidLight === 'night';
    if (isPlaytestRun()) {
      return rimClock({ clock: 'NO CLOCK', night, help: this.clockNote() });
    }
    const off = [
      ...(this.pendingRecoveryMs > 0 ? [`−${formatRecoveryClock(this.pendingRecoveryMs)} HEALING`] : []),
      ...(this.waitingForSky ? [`−${formatRecoveryClock(WAIT_FOR_DARK_MS)} WAIT`] : []),
    ].join(' ');
    return rimClock({ clock: formatRecoveryClock(this.raidClockMs), ...(off ? { off } : {}), night, help: this.clockNote() });
  }

  /**
   * Where a raid with no job is going: the next gym (`WorldScene.gymDoorNear`).
   * The card said only "nothing to fetch", and a friend who chose NO JOB landed
   * to an arrow pointing at MISTY with no word of why (persona playtest, 23 Nov
   * 2026). The card is only ever read before a later raid, which draws no arrow
   * until its last thirty seconds (`world/raidArrow.ts`), so it names the gym
   * and leaves the way to the chip and Oak.
   */
  private noJobArrow(): string {
    const gym = nextGym(this.savedGame.raidProgress.defeatedBosses);
    return gym ? ` The next gym is ${gym.building.toUpperCase()}, where ${gym.leader.toUpperCase()} waits.` : '';
  }

  /** What the rail says of a hurt team (`hub/railWarning.ts`). A team that cannot lose has nothing to be told. */
  private railHurt(): RailWarning | null {
    return benchRailWarning(this.flow, joyRailLine(this.savedGame));
  }

  /** Every way in on offer, while a room is held only those on its map. */
  private get offeredWays(): readonly (readonly [RunInsertionId, RunInsertion])[] {
    const room = this.heldRoom;
    return this.unlockedInsertions.filter(([, insertion]) => !room || insertion.mapId === room.mapId);
  }

  /**
   * The job a raid from here carries and what the card says of it: the whole
   * sentence for the help line, the walk against the clock for the tile, and
   * whether either is said in red.
   */
  private rimJob(insertionId: RunInsertionId): {
    readonly contract: RaidContract | undefined;
    readonly sentence: string;
    readonly warn: boolean;
    readonly walk?: number;
    readonly tooLong: boolean;
    readonly short: readonly { readonly itemId: ItemId; readonly quantity: number }[];
    readonly quicker?: { readonly id: string; readonly label: string; readonly ms: number };
  } {
    const contract = this.contractFor(insertionId);
    const required = contract ? contractCarryIn(contract) : [];
    const short = required.length === 0 ? [] : missingCarryIn(required, (itemId) => this.flow.itemQuantity(itemId));
    // What the job on the board asks and pays, because a job nobody reads the price of is a job imposed.
    // And how much of the clock it is just walking, because a step count means
    // nothing beside 5:00 and a job across the vale leaves little room for
    // anything else (the characters bug hunt, 11 Nov 2026). Fights are free.
    const walk = contract ? standingJobWalk(contract, requireInsertion(insertionId).position, this.savedGame.raidProgress) : undefined;
    // A job's stops are placed off the front door, so from a way in across the
    // map it can be most of the raid: say which way in on offer walks it much
    // quicker (the north bug hunt, 11 Nov 2026).
    const quicker =
      contract && walk !== undefined
        ? quickerLandingFor(
            contract,
            requireInsertion(insertionId).position,
            this.offeredWays.filter(([, way]) => way.mapId === contract.mapId).map(([, way]) => way),
            this.savedGame.raidProgress,
          )
        : undefined;
    // An allowance past the whole clock is said in red, beside the figures: a
    // Line survey reading "2:45 of your 4:00; allow 6:52" was offered first and
    // taken, by a friend who had not done the sum (AI playtest, 23 Nov 2026).
    const tooLong =
      walk !== undefined && !isPlaytestRun() && walk * STEP_DURATION_MS * JOB_WALK_ALLOWANCE > this.raidClockMs;
    const walking =
      walk === undefined
        ? ''
        : ` Walked straight with no stops, it takes ${formatRecoveryClock(walk * STEP_DURATION_MS)}${isPlaytestRun() ? ' of walking' : ` of your ${formatRecoveryClock(this.raidClockMs)}`}; allow ${formatRecoveryClock(walk * STEP_DURATION_MS * JOB_WALK_ALLOWANCE)}.${
            tooLong ? ' That is longer than this raid.' : ''
          }${quicker ? ` From ${quicker.landing.label} it takes ${formatRecoveryClock(quicker.walk * STEP_DURATION_MS)}.` : ''}`;
    const sentence = contract
      ? short.length > 0
        ? `${contract.name} needs ${itemAmountsFor(required)}. Still short: ${itemAmountsFor(short)}`
        : // What the job asks, not only its name: offered SEALED DISPATCH beside
          // a Line survey, a newcomer could not tell what either meant (scenario
          // loop, 22 Nov 2026).
          `${contract.name}: ${jobAsks(contract.description)}. ${required.length > 0 ? `Hand over ${itemAmountsFor(required)}, and it pays` : 'It pays'} ${rewardLine(contract.reward)}.${walking}`
      : `None this raid: nothing to fetch.${this.noJobArrow()}`;
    return {
      contract,
      sentence,
      warn: short.length > 0 || tooLong,
      ...(walk === undefined ? {} : { walk }),
      tooLong,
      short,
      ...(quicker ? { quicker: { id: quicker.landing.id, label: quicker.landing.label, ms: quicker.walk * STEP_DURATION_MS } } : {}),
    };
  }

  /**
   * The four tiles: who comes and who is safe, what a wipe takes, who hunts,
   * and what the job pays. Each is pictures and numbers, and carries the whole
   * sentence it stands for as its help.
   */
  private rimBoard(insertionId: RunInsertionId): string {
    const securedPokemon = this.flow.securedPokemon;
    const securedItems = this.flow.securedItems;
    const stack = (item: { readonly itemId: ItemId; readonly quantity: number }): string =>
      `${this.itemName(item.itemId)} ${itemCountTag(item.itemId, item.quantity)}`;
    // The pack leads, because it is the biggest single thing a wipe takes and
    // the one nothing in the locker beside it can protect.
    const lost = [
      ...(this.flow.packItemId === undefined ? [] : [`the ${this.flow.packName}`]),
      ...this.flow.riskedItems.map(stack),
    ];
    // Who comes and who stays home, named (`hub/rimTeam.ts`): '1 Pokémon to
    // your 1' left a new catch at home and a hurt partner unremarked.
    const away = awayOnRaid(this.savedGame);
    const coming = new Set(this.flow.party.map((stored) => stored.id));
    const member = ({ pokemon }: StashedPokemon) => ({ name: pokemon.name, level: pokemon.level, currentHp: pokemon.currentHp, maxHp: pokemon.maxHp });
    const home = this.stash
      .listPokemon()
      .filter((stored) => !coming.has(stored.id) && !away.has(stored.id) && !stored.pokemon.isFainted)
      .map(member);
    const fainted = this.stash
      .listPokemon()
      .filter((stored) => !coming.has(stored.id) && !away.has(stored.id) && stored.pokemon.isFainted)
      .map(member);
    // Two of a kind are told apart by level on every line here, as the Team line does.
    const twice = namesSeenTwice([...this.flow.party.map(member), ...home, ...fainted]);
    const named = ({ pokemon }: StashedPokemon): string => rimNameOf(pokemon, twice);
    // Said apart and said plainly, because "at risk" never told a FireRed player
    // that a Pokémon lost here is not coming back.
    // The partner is never among them: it has a place of its own that no wipe
    // can touch, so it leads what is safe instead.
    const goneForGood = this.flow.riskedPokemon.map(named);
    const hurt = this.railHurt();
    const partner = this.flow.partnerOnRaid;
    const kept = [
      ...(partner === undefined ? [] : [`${named(partner)} (your partner)`]),
      ...securedPokemon.map(named),
      // A found good is never packed, so what the locker holds for it is room:
      // listed as a stack, "Torn chart (moor) x1" told an explorer they carried
      // a chart they had never found (the overnight retest, 23 Nov 2026).
      ...securedItems.map((item) => (isFoundOnly(item.itemId) ? roomKeptFor(item, this.itemName(item.itemId)) : stack(item))),
    ];
    // With nobody able to go the head already says why, and a red "a wipe costs
    // you everything" over a raid that cannot start only frightened; and since
    // the partner never goes down with a wipe, "everything" was never true
    // either - it is what you take (the first-hour bug hunt, 11 Nov 2026).
    const safeSentence = !this.flow.isDeployable
      ? ''
      : ` Safe: ${kept.length === 0 ? 'nothing: a wipe costs everything you take' : kept.join(', ')}.`;
    const safeIds = new Set([...(partner === undefined ? [] : [partner.id]), ...securedPokemon.map((stored) => stored.id)]);
    const teamSentence =
      this.flow.party.length === 0 ? 'Team: nobody yet.' : `Team: ${rimTeamLine(this.flow.party.map(member), home, fainted)}`;
    const team = rimTeamTile({
      members: this.flow.party.map(({ id, pokemon }) => ({
        name: pokemon.name,
        speciesId: pokemon.base.id,
        level: pokemon.level,
        currentHp: pokemon.currentHp,
        maxHp: pokemon.maxHp,
        safe: safeIds.has(id),
        partner: partner?.id === id,
      })),
      home: home.length + fainted.length,
      ...(hurt ? { hurt: 'HURT' } : {}),
      help: `${teamSentence}${hurt ? ` Hurt: ${hurt.line}` : ''}${safeSentence}`,
    });
    const risk = rimPackTile({
      risked: [
        ...(this.flow.packItemId === undefined ? [] : [{ itemId: this.flow.packItemId, name: this.flow.packName }]),
        ...this.flow.riskedItems.map((item) => ({ itemId: item.itemId, name: this.itemName(item.itemId), quantity: item.quantity })),
      ],
      // Room kept for a find is room, never a stack: "Pokédollars ×250" stood
      // on the card of a save holding ₽0, the slot's size read as money
      // carried (the harbour critic tour, 26 Nov 2026).
      kept: securedItems.map((item) =>
        isFoundOnly(item.itemId)
          ? { itemId: item.itemId, name: `room for ${this.itemName(item.itemId)}` }
          : { itemId: item.itemId, name: this.itemName(item.itemId), quantity: item.quantity },
      ),
      lostPokemon: this.flow.riskedPokemon.map(({ pokemon }) => ({ speciesId: pokemon.base.id, name: pokemon.name })),
      help: `At risk: ${lost.length === 0 ? 'nothing: all of it is in the locker' : lost.join(', ')}.${
        goneForGood.length === 0 ? '' : ` A wipe: ${goneForGood.join(', ')}: lost for good.`
      }${safeSentence}`,
    });
    const threat = this.hunterThreatAt(insertionId, this.flow.party);
    // A raid alone meets a pack; a room shares one hunter (`WorldScene.hunterPackHere`).
    const pack = !friendRoom()?.room;
    const hunter = hunterThreatLine(threat, pack);
    const rival = hunterRival(threat.rival);
    const lead = threat.openingTeam[0];
    const hunters = rimHunterTile({
      name: rival.name,
      design: rival.design,
      pack,
      rung: threat.tierOffset + 1,
      rungs: HUNTER_TIERS.length,
      ...(threat.matchedTo ? { count: threat.openingTeam.length } : {}),
      ...(threat.matchedTo && lead ? { lead: { theirs: lead.level, yours: threat.matchedTo.level } } : {}),
      soonerSeconds: Math.round(threat.arrivesSoonerMs / 1_000),
      help: `${hunter.heading}: ${hunter.detail}`,
    }).replace('data-rim-tile="hunters"', `data-rim-tile="hunters" data-hunter-tier="${threat.tierOffset + 1}"`);
    const job = this.rimJob(insertionId);
    const jobTile = job.contract
      ? rimJobTile({
          kind: 'job',
          pay: {
            items: job.contract.reward.items.map((item) => ({ itemId: item.itemId, name: this.itemName(item.itemId as ItemId), quantity: item.quantity })),
            pokemon: (job.contract.reward.pokemon ?? []).map(({ speciesId, level }) => ({ speciesId, level, name: getSpeciesById(speciesId)?.name ?? speciesId })),
          },
          ...(job.walk === undefined
            ? {}
            : { walkMs: job.walk * STEP_DURATION_MS, allowMs: job.walk * STEP_DURATION_MS * JOB_WALK_ALLOWANCE }),
          clockMs: this.raidClockMs,
          tooLong: job.tooLong,
          short: job.short.map((item) => ({ itemId: item.itemId, name: this.itemName(item.itemId), quantity: item.quantity })),
          ...(job.quicker ? { quicker: job.quicker } : {}),
          help: job.sentence,
          format: formatRecoveryClock,
        })
      : this.jobsAt(insertionId).length > 0 || this.rimJobChoices(insertionId).length > 0
        ? rimJobTile({ kind: 'none', ...(this.noJobGym() ? { nextGym: this.noJobGym() } : {}), help: job.sentence })
        : rimJobTile({ kind: 'none', help: 'No job this raid: nothing to fetch. Walk it, find what it has, and get out.' });
    return `${team}${hunters}${risk}${jobTile}`;
  }

  /** The gym a raid with no job is out for, by its leader's name. */
  private noJobGym(): string | undefined {
    return nextGym(this.savedGame.raidProgress.defeatedBosses)?.leader.toUpperCase();
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
            ? `<small class="wallmap-none">${entry.held === 0 ? 'No boss here' : `${entry.held} ${entry.held === 1 ? 'boss' : 'bosses'} still to beat`}</small>`
            : entry.signs.map((sign) => this.wallSign(sign.keeper)).join('');
        const gym = entry.nextGym
          ? `<small class="wallmap-none wallmap-next-gym">Next gym: ${entry.nextGym.building}, ${entry.nextGym.standsIn}</small>`
          : '';
        const help = `${entry.name}: ${known}% of it known, ${entry.districtsKnown} of ${entry.districts} places reached${entry.signs.length === 0 ? '' : `, ${entry.signs.length} boss${entry.signs.length === 1 ? '' : 'es'} beaten`}. ENTER reads it close up.`;
        return `<button class="px-window px-card wallmap-card" data-wall-map="${entry.mapId}" data-help="${escapeAttribute(help)}"><span class="wallmap-card-head"><strong>${entry.name}</strong><small>${entry.walked ? `${known}% known` : 'never walked'}</small></span>${mapPictureFrame({
          key: `wall:${entry.mapId}`,
          label: `${entry.name}, ${known}% known`,
          size: entry.size,
          mode: 'shared',
          className: 'wallmap-picture',
        })}<span class="wallmap-signs">${signs}${gym}</span></button>`;
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
    const gym = entry.nextGym
      ? `<p class="px-empty px-wrap">Next gym: ${entry.nextGym.building} in ${entry.nextGym.standsIn}, where ${entry.nextGym.leader} waits.</p>`
      : '';
    const signs = `<h3 class="px-subheading">Signs pinned here</h3>${gym}${
      entry.signs.length === 0
        ? `<p class="px-empty px-wrap">${entry.held === 0 ? 'No boss on this map.' : 'No boss beaten here yet.'}</p>`
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
              `${this.pip(exit.worked ? 'K' : 'X')}<span class="px-row-main"><strong>${exit.label}</strong><small>${exit.worked ? 'open for good' : exit.opens === 'OPEN' ? 'always open' : exit.opens.toLowerCase()}</small></span>`,
              `${exit.label}: ${exit.opens === 'OPEN' ? 'open on every raid, from the moment you land' : exit.opens.toLowerCase()}.`,
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
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.line)}>${maps}${briefing ? this.placeFacts(briefing, entry.known) : ''}${signs}${briefing ? this.placeWorth(briefing) : ''}${doors}${exits}${briefing ? this.placeWildlife(briefing) : ''}</div>`,
      { className: 'wallmap-about', heading: 'On the wall', note: `${entry.districtsKnown}/${entry.districts} places` },
    )}</main>`;
  }

  /**
   * The five short facts about the place, across the head of what it holds:
   * they were beside the picture when the picture was a thumbnail, and the
   * picture wants that room now. They scroll with the rest, because at the
   * smallest stage five lines pinned over the pane were most of it.
   */
  private placeFacts(briefing: DropInBriefing, known: number): string {
    const { grade, record } = briefing;
    // The share the picture beside it is lit by, which counts the ground round
    // your own doors as known as well as the ground walked: counted from the
    // walked tiles alone, one screen said '9% KNOWN' over 'Known 22/204 · 6%'
    // (AI playtest, 22 Nov 2026).
    const walked = Math.round(known * 100);
    return `<dl class="dropin-facts">${
      // A second entrance does not carry its map's name, so it says which map
      // it is on. A front door is the map.
      briefing.isDropIn ? `<div><dt>Map</dt><dd>${briefing.mapName}</dd></div>` : ''
    }<div><dt>Wild</dt><dd>${grade.wild.max === 0 ? 'none' : `Lv ${grade.wild.min}-${grade.wild.max}`}</dd></div><div><dt>Fights</dt><dd>${grade.trainers === 0 ? 'none' : `${grade.trainers} · Lv ${grade.trainer}`}</dd></div><div><dt>Bosses</dt><dd>${grade.bossesHeld === 0 ? (grade.bossesBeaten === 0 ? 'none' : 'all beaten') : `${grade.bossesHeld} to beat`}</dd></div><div><dt>Raids</dt><dd>${record.deployed === 0 ? 'none yet' : `${record.deployed} · ${record.extracted} out`}</dd></div><div><dt>Known</dt><dd>${record.districts === 0 ? `${walked}%` : `${record.districtsKnown}/${record.districts} · ${walked}%`}</dd></div></dl>`;
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
                ? `${thing} is already on BILL’S PC. Speak to ${errand.name} and it is handed over.`
                : `${thing}: ${errand.name} asked for it. It lies in ${errandPlace(errand)}, takes ${squares} ${squares === 1 ? 'square' : 'squares'} of the pack, and is lost with the pack if you do not walk out. ${errand.name} pays ${errandRewardFor(errand, (itemId) => this.stash.itemCount(itemId) > 0).summary.toLowerCase()} for it.`,
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
              `${prize.name}: lies in ${prize.place}, on about one raid in ${Math.max(2, Math.round(1 / prize.chance))}. You will see it from a distance, and you lose it if you don't make it out.`,
              ' px-tall',
            ),
          )
          .join('')}${
          foundPrizes.length === 0
            ? '<p class="px-empty px-wrap">Rare things are found on this map, but not in any place you have walked.</p>'
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
      : `<h3 class="px-subheading">${briefing.night ? 'Wildlife by night' : 'Wildlife'}</h3>${wildlifeGroups(seen)
          .map(({ places, species }) => {
            const living = species.map((entry) => `${entry.name} ${entry.min}-${entry.max}`).join(' · ');
            const shown = wildlifeKinds(species);
            // Places with the same Pokémon at the same levels are one row: eleven
            // rows of the same six in a 60-row list was the wall map's wall of
            // text (the harbour critic tour, 26 Nov 2026).
            const named = places.length === 1 ? places[0] : `${places[0]} and ${places.length - 1} more`;
            return told(
              `<span class="px-row-main"><strong>${named}</strong><small class="px-wrap">${shown}</small></span>`,
              // Not "in the tall grass": a cave's floor rolls on every step, and
              // GREYSTONE CAVES has no grass at all (the harbour re-critic).
              `${places.join(', ')}: ${living}. Met there in the wild${
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

  /**
   * The rim's word on the clock, as the raid's clock chip will put it.
   *
   * An explorer run's clock is eight hours and its chip never counts them, so
   * the screen says what that means rather than printing it as `480:00`, and
   * takes nothing off for recovery, because `raidClockMs` does not.
   */
  private clockNote(): string {
    const night = this.raidLight === 'night';
    if (isPlaytestRun()) {
      return `${night ? 'night raid' : 'raid'} with no clock to beat: an explorer run lasts ${PLAYTEST_RAID_DURATION_MS / 3_600_000} hours`;
    }
    const clock = `${night ? 'night raid clock' : 'raid clock'} ${formatRecoveryClock(this.raidClockMs)}`;
    const waited = this.waitingForSky ? ` − ${formatRecoveryClock(WAIT_FOR_DARK_MS)} waiting` : '';
    if (this.pendingRecoveryMs === 0) {
      return waited ? `${clock} (${formatRecoveryClock(RAID_DURATION_MS)} base${waited})` : clock;
    }
    // A debt a raid was too short to pay is the same healing, still owed: said
    // as plain recovery it read as Nurse Joy charging twice.
    return this.savedGame.recoveryCarried
      ? `${clock}: Nurse Joy's healing is still unpaid - your last raid was under ${formatRecoveryClock(DAY_CARE_LEAST_RAID_MS)}${waited ? `, and ${formatRecoveryClock(WAIT_FOR_DARK_MS)} is the wait` : ''}`
      : `${clock} (${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery${waited})`;
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
    const stock = traderStockOffers(counter);
    const barters = traderBarterOffers(counter);
    // Where the cursor lands on this screen - and nowhere, while a deal is
    // asking: `refocus` takes the *first* `data-cursor-start` in the document,
    // so a card still carrying one took the cursor off the armed question and
    // the second press of the key that armed the deal bought a Poke Ball.
    // After a deal, back on the card just dealt while it is still open: the
    // cursor jumped to the first open card, once onto a barter for Lamp oil,
    // where a second ENTER for another Poké Ball would have armed the swap
    // (the harbour critic tour, 26 Nov 2026).
    const dealtAgain =
      this.traderLastDeal === undefined
        ? undefined
        : (stock.find((offer) => offer.refusal === undefined && offer.item.itemId === this.traderLastDeal) ??
          barters.find((offer) => offer.refusal === undefined && offer.barter.id === this.traderLastDeal));
    const first =
      this.traderArmed !== undefined
        ? undefined
        : (dealtAgain ??
          stock.find((offer) => offer.refusal === undefined) ??
          barters.find((offer) => offer.refusal === undefined));
    const firstId = first === undefined ? undefined : 'item' in first ? first.item.itemId : first.barter.id;
    // The one card on the right answers for whichever card the cursor is on
    // (`MenuOverlay.showDetailFor`): none of the card rows holds a pane, so the
    // panes are swapped across the whole screen.
    const shownId = this.traderArmed ?? firstId ?? stock[0]?.item.itemId;

    const shelf = [
      ...stock.map((offer) => this.stockCard(counter, offer, offer === first)),
      this.berthCard(counter),
    ].join('');
    const left = rationLeft(counter);
    const standing = traderStanding(counter.progress);
    const shelfPane = pixelWindow(`<div class="trader-cards px-scroll">${shelf}</div>`, {
      className: 'objectives-panel trader-shelf',
      heading: 'For money',
      // Potions and Balls are off the ration, and "2 OF 2 LEFT TILL YOU RAID"
      // over a shelf that starts with them read as two Balls a raid (break-it
      // test, 23 Nov 2026). Bill's own words: "and 2 other things till you raid".
      note: standing.ration === 0 ? 'Potions and Balls for now' : `${left} other${left === 1 ? '' : 's'} till you raid`,
    });
    const table = barters.map((offer) => this.barterCard(counter, offer, offer === first)).join('');
    const tablePane = pixelWindow(`<div class="trader-cards is-parts px-scroll">${table}</div>`, {
      className: 'objectives-panel trader-table',
      heading: 'For parts',
      note: 'No money buys these',
    });
    const details = [
      ...stock.map((offer) => this.stockDetail(counter, offer, offer.item.itemId === shownId)),
      this.berthDetail(counter, shownId === BERTH_DEAL),
      ...barters.map((offer) => this.barterDetail(offer, offer.barter.id === shownId)),
    ].join('');
    const detailCard = `<section class="px-window trader-detail-card">${details}</section>`;
    return `<main class="px-body trader-layout"><div class="trader-goods">${shelfPane}${tablePane}</div><div class="trader-side">${detailCard}${this.billCard(counter)}</div></main>`;
  }

  /**
   * Bill himself, in his room: the cottage as the yard draws it, and how far
   * along his trust the player is - one bar, a stretch a standing, and the next
   * standing named at its end.
   */
  private billCard(counter: TraderCounter): string {
    const standing = traderStanding(counter.progress);
    const next = nextTraderStanding(counter.progress);
    const points = traderStandingPoints(counter.progress);
    const tiers = TRADER_STANDINGS;
    const segments = tiers
      .slice(1)
      .map((tier, index) => {
        const from = tiers[index].points;
        const fill = Math.max(0, Math.min(1, (points - from) / (tier.points - from)));
        return `<i style="--fill:${Math.round(fill * 100)}%"></i>`;
      })
      .join('');
    const room = this.roomPicture('bills-cottage', 'Bill in his cottage');
    const raise = next
      ? `Bank a job +${STANDING_PER_CONTRACT}, beat a boss +${STANDING_PER_BOSS}, spend ${formatMoney(POKEDOLLARS_PER_STANDING)} +1.`
      : standing.note;
    return `<section class="px-window trader-standing">${room}<div class="trader-trust" data-help="${escapeAttribute(raise)}"><p class="trader-trust-head"><strong>Bill</strong><span class="trader-rank">${standing.name}</span></p><span class="trader-trust-bar" role="img" aria-label="${escapeAttribute(`${points} points`)}">${segments}</span><small>${
      next ? `${points} / ${next.tier.points}<span class="trader-trust-to"></span>${next.tier.name}` : `${points} · nothing held back`
    }</small></div></section>`;
  }

  /** A card on his shelf: the thing, big, its name, and its price on a gold tag. */
  private stockCard(counter: TraderCounter, offer: TraderStockOffer, start: boolean): string {
    const id = offer.item.itemId;
    const name = this.itemName(id);
    const limit = traderStockLimit(counter, offer.item);
    const open = offer.refusal === undefined && limit > 0;
    const count = open ? clampCount(this.counterCounts.get(`buy:${id}`) ?? 1, 1, limit) : 1;
    const total = formatMoney(offer.item.price * count);
    if (open && this.traderArmed === stockDeal(id)) {
      const left = rationLeft(counter);
      return this.armedDeal({
        id,
        icon: itemIcon(id, name),
        name: count > 1 ? `${name} ×${count}` : name,
        question: `Pay ${total} for ${count === 1 ? withArticle(name) : `${count} ${name}s`}?${offer.item.rationed && count === left ? " That's your last till you raid." : ''}`,
        confirm: `data-buy-confirm="${id}"`,
        confirmLabel: 'Buy',
        confirmHelp: `Spends ${total} of your ${formatMoney(moneyHeld(this.stash))}.`,
        tone: 'primary',
      });
    }
    const short = offer.refusal === 'money-short' || moneyHeld(this.stash) < offer.item.price * count;
    const price = `<span class="price-tag${open ? '' : ' is-off'}${short ? ' is-short' : ''}">${total}</span>`;
    const why =
      offer.refusal === 'standing-short'
        ? `<span class="trader-lock">${iconMarkup('padlock', 'Locked')}${this.standingName(offer.item.standing)}</span>`
        : offer.refusal === 'ration-spent'
          ? '<span class="trader-lock">Next raid</span>'
          : offer.item.rationed
            ? '<span class="trader-limit">Rationed</span>'
            : '';
    const art = `<span class="trader-art">${itemIcon(id, name)}</span>`;
    const label = `<strong class="px-name">${name}${count > 1 ? ` ×${count}` : ''}</strong>`;
    if (open) {
      const ceiling = offer.item.rationed
        ? limit === 1
          ? "That's all till you raid"
          : `Up to ${limit} till you raid`
        : limit === 1
          ? "That's all your money covers"
          : `Your money covers ${limit}`;
      const help = `Buy ${itemAmountFor(id, count)} for ${total}. ${ceiling}.`;
      // The card buys; how many is the < 1 > in the card on the right, a
      // control of its own that Tab crosses to.
      return `<div class="trader-slot"><button class="px-window px-card trader-card" data-buy="${id}" data-shows="${id}" data-help="${escapeAttribute(help)}"${start ? ' data-cursor-start' : ''}>${art}${label}${why}${price}</button></div>`;
    }
    // Never `disabled`: the cursor has to reach a card to say why it is shut.
    const wiring = `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
    const state = offer.refusal === 'money-short' ? 'is-short' : 'is-locked';
    return `<div class="trader-slot"><button class="px-window px-card trader-card ${state}" ${wiring} data-shows="${id}">${art}${label}${why}${price}</button></div>`;
  }

  /** The standing a locked deal waits for, in the one word the card has room for. */
  private standingName(id: string): string {
    return TRADER_STANDINGS.find((tier) => tier.id === id)?.name ?? id;
  }

  /**
   * The berth, at the end of his shelf: one more column of THE LOCKER, this raid
   * only - the words that keep it apart from Brock's locker, which is the same
   * column for good.
   */
  private berthCard(counter: TraderCounter): string {
    const offer = checkBerth(counter);
    const paid = offer.refusal === 'already-paid';
    if (this.traderArmed === BERTH_DEAL) {
      return this.armedDeal({
        id: BERTH_DEAL,
        icon: iconMarkup('supply-crate', 'Locker shelf'),
        name: 'Locker shelf',
        question: `Pay ${formatMoney(TRADER_BERTH_PRICE)} for one raid, used or not?`,
        confirm: 'data-berth-confirm',
        confirmLabel: 'Pay for it',
        confirmHelp: `Spends ${formatMoney(TRADER_BERTH_PRICE)} on the coming raid.`,
      });
    }
    const wiring = paid
      ? `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`
      : offer.refusal === undefined
        ? `data-berth data-help="${escapeAttribute('Two more squares in THE LOCKER for one raid. Brock builds them for good.')}"`
        : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(offer.message ?? '')}"`;
    const state = paid ? 'is-secured' : offer.refusal === undefined ? '' : offer.refusal === 'money-short' ? 'is-short' : 'is-locked';
    const price = paid
      ? pixelTag('Paid', 'secure', true)
      : `<span class="price-tag${offer.refusal === undefined ? '' : ' is-off'}">${formatMoney(TRADER_BERTH_PRICE)}</span>`;
    return `<div class="trader-slot"><button class="px-window px-card trader-card ${state}" ${wiring} data-shows="${BERTH_DEAL}"><span class="trader-art">${iconMarkup('supply-crate', 'Locker shelf')}</span><strong class="px-name">Locker shelf</strong>${
      // Locked as every other card is locked, with its padlock and its tier:
      // greyed with "This raid" it read as merely too dear (the harbour critic tour).
      offer.refusal === 'standing-short'
        ? `<span class="trader-lock">${iconMarkup('padlock', 'Locked')}${this.standingName(TRADER_BERTH_STANDING)}</span>`
        : '<span class="trader-limit">This raid</span>'
    }${price}</button></div>`;
  }

  /** A card on his barter table: the thing, big, its name, and the parts it takes as tags. */
  private barterCard(counter: TraderCounter, offer: TraderBarterOffer, start: boolean): string {
    const { barter } = offer;
    const taken = offer.refusal === 'already-taken';
    const limit = traderBarterLimit(counter, barter);
    const repeats = offer.refusal === undefined && !barter.once && limit > 1;
    const count = repeats ? clampCount(this.counterCounts.get(`barter:${barter.id}`) ?? 1, 1, limit) : 1;
    const takes = barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * count }));
    if (this.traderArmed === barter.id) {
      return this.armedDeal({
        id: barter.id,
        icon: iconMarkup(barter.icon, barter.name),
        name: count > 1 ? `${barter.name} ×${count}` : barter.name,
        question: `Hand over ${itemAmountsFor(takes)} for good?`,
        confirm: `data-barter-confirm="${barter.id}"`,
        confirmLabel: 'Hand it over',
        confirmHelp: `Spends ${escapeAttribute(itemAmountsFor(takes))} for good.`,
      });
    }
    const parts = taken
      ? pixelTag('Traded', 'secure', true)
      : `<span class="part-tags">${takes
          .map(({ itemId, quantity }) => this.partTag(itemId, quantity, this.stash.itemCount(itemId)))
          .join('')}</span>`;
    const why =
      offer.refusal === 'standing-short'
        ? `<span class="trader-lock">${iconMarkup('padlock', 'Locked')}${this.standingName(barter.standing)}</span>`
        : '';
    const help = this.barterHelp(offer, count);
    const wiring =
      offer.refusal === undefined
        ? `data-barter="${barter.id}" data-help="${escapeAttribute(help)}"`
        : `data-refused="${escapeAttribute(offer.message ?? '')}" aria-disabled="true" data-help="${escapeAttribute(help)}"`;
    const state = taken ? ' is-secured' : offer.refusal === undefined ? '' : offer.refusal === 'goods-short' ? ' is-short' : ' is-locked';
    const card = `<button class="px-window px-card trader-card${state}" ${wiring} data-shows="${barter.id}"${start ? ' data-cursor-start' : ''}><span class="trader-art">${iconMarkup(barter.icon, barter.name)}</span><strong class="px-name">${barter.name}${count > 1 ? ` ×${count}` : ''}</strong>${why}${parts}</button>`;
    return `<div class="trader-slot">${card}</div>`;
  }

  /** What the help bar says on a barter's card, for how many of it. */
  private barterHelp(offer: TraderBarterOffer, count: number): string {
    const { barter } = offer;
    const takes = barter.takes.map((stack) => ({ ...stack, quantity: stack.quantity * count }));
    return offer.refusal === undefined
      ? `Hand over ${itemAmountsFor(takes)} for ${count === 1 ? withArticle(barter.name) : `${count} ${barter.name}s`}.`
      : offer.message ?? '';
  }

  /** One part a deal or a build takes, as a tag (`ui/shopCard.ts`). */
  private partTag(itemId: string, quantity: number, held: number): string {
    return partTag(itemIcon(itemId, this.itemName(itemId)), quantity, held);
  }

  /**
   * The card on the right for a thing on his shelf: the thing big, how many
   * (the < 1 > count, Left and Right as on every count), the money before and
   * after, one line of what it does, and the key that buys it.
   */
  private stockDetail(counter: TraderCounter, offer: TraderStockOffer, shown: boolean): string {
    const { item } = offer;
    const held = moneyHeld(this.stash);
    const limit = traderStockLimit(counter, item);
    const open = offer.refusal === undefined && limit > 0;
    const count = open ? clampCount(this.counterCounts.get(`buy:${item.itemId}`) ?? 1, 1, limit) : 1;
    const cost = item.price * count;
    const name = this.itemName(item.itemId);
    const help = `Buy ${itemAmountFor(item.itemId, count)} for ${formatMoney(cost)}.`;
    // The count is a control in the card, so it carries the card's own
    // `data-shows` and the cursor moving into it keeps this card up.
    const pick = open
      ? `<span class="shop-pick" data-shows="${item.itemId}">${countSelector({ kind: 'buy', id: item.itemId, label: name, value: count, min: 1, max: limit, help, limit: traderStockLimitReason(counter, item) })}</span>`
      : '';
    return shopCardPane({
      id: item.itemId,
      shown,
      head: { title: name, note: `${formatMoney(item.price)} each`, tone: 'gold' },
      art: itemIcon(item.itemId, name),
      show: `<div class="shop-money">${pick}${this.moneyLine(held, cost)}</div>`,
      line: getItemById(item.itemId)?.description ?? name,
      ...(offer.refusal === undefined ? {} : { blocked: offer.message ?? '' }),
      ...(open ? { go: { key: 'ENTER', label: count === 1 ? 'Buy one' : `Buy ${count}` } } : {}),
    });
  }

  /** The purse before and after, as the number it will roll down to: ₽640 ▸ ₽550. */
  private moneyLine(held: number, cost: number): string {
    return `<p class="shop-roll">${itemIcon(CURRENCY_ITEM_ID, this.itemName(CURRENCY_ITEM_ID))}<span>${formatMoney(held)}</span><span class="shop-arrow"></span><strong class="${held < cost ? 'is-short' : ''}">${formatMoney(Math.max(0, held - cost))}</strong></p>`;
  }

  /** The locker shelf, whole: what it adds to the coming raid and the money it leaves. */
  private berthDetail(counter: TraderCounter, shown: boolean): string {
    const offer = checkBerth(counter);
    const paid = offer.refusal === 'already-paid';
    const squares = berthSquares(this.flow.secureGrid);
    return shopCardPane({
      id: BERTH_DEAL,
      shown,
      head: { title: 'Locker shelf', note: paid ? 'Paid' : 'This raid', tone: 'gold' },
      art: iconMarkup('supply-crate', 'Locker shelf'),
      show: paid ? '' : `<div class="shop-money">${this.moneyLine(moneyHeld(this.stash), TRADER_BERTH_PRICE)}</div>`,
      line: `+${squares} safe squares, this raid.`,
      ...(paid || offer.refusal === undefined ? {} : { blocked: offer.message ?? '' }),
      ...(offer.refusal === undefined ? { go: { key: 'ENTER', label: 'Rent it' } } : {}),
    });
  }

  /** The card on the right for a barter: the thing big, the parts it takes as tags, and the key. */
  private barterDetail(offer: TraderBarterOffer, shown: boolean): string {
    const { barter } = offer;
    const taken = offer.refusal === 'already-taken';
    const limit = traderBarterLimit(this.traderCounter, barter);
    const repeats = offer.refusal === undefined && !barter.once && limit > 1;
    const count = repeats ? clampCount(this.counterCounts.get(`barter:${barter.id}`) ?? 1, 1, limit) : 1;
    const goods = barter.takes.map(({ itemId }) => this.itemName(itemId).toLowerCase()).join(' and ');
    const pick = repeats
      ? `<span class="shop-pick" data-shows="${barter.id}">${countSelector({ kind: 'barter', id: barter.id, label: barter.name, value: count, min: 1, max: limit, help: this.barterHelp(offer, count), limit: `Your ${goods} cover ${limit} at most.` })}</span>`
      : '';
    // Held back for his trust, the lock and the standing it waits for stand
    // where ALL HERE would: the parts being in hand is not the question.
    const held = offer.refusal === 'standing-short';
    const parts = taken
      ? ''
      : partTags(
          barter.takes.map(({ itemId, quantity }) => ({
            icon: itemIcon(itemId, this.itemName(itemId)),
            quantity: quantity * count,
            held: this.stash.itemCount(itemId),
          })),
          'You hand over',
          held ? `<span class="trader-lock">${iconMarkup('padlock', 'Locked')}${this.standingName(barter.standing)}</span>` : undefined,
        );
    return shopCardPane({
      id: barter.id,
      shown,
      head: { title: barter.name, note: taken ? 'Traded' : barter.once ? 'Only one' : 'For parts', tone: 'gold' },
      art: iconMarkup(barter.icon, barter.name),
      ...(pick ? { show: `<div class="shop-money">${pick}</div>` } : {}),
      line: getItemById(barter.gives.itemId)?.description ?? barterDetailOnOffer(barter),
      parts,
      ...(taken || held || offer.refusal === undefined ? {} : { blocked: offer.message ?? '' }),
      ...(offer.refusal === undefined ? { go: { key: 'ENTER', label: 'Trade' } } : {}),
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
   * BACK AWAY. The shelf asks too: a Potion for Pokedollars is an ordinary
   * purchase, but the money and the trip's ration are spent for good, and a
   * shelf that bought on the press bought twice on a double ENTER. Its BUY is
   * the plain primary button, because spending money is not a loss the way
   * handing over found goods is.
   */
  private armedDeal(deal: {
    readonly id: string;
    readonly icon: string;
    readonly name: string;
    readonly question: string;
    readonly confirm: string;
    readonly confirmLabel: string;
    readonly confirmHelp: string;
    readonly tone?: 'danger' | 'primary';
  }): string {
    return `<div class="px-pair px-arming" data-shows="${deal.id}"><div class="px-row has-icon px-tall">${deal.icon}<span class="px-row-main"><strong class="px-name">${deal.name}</strong><small class="px-wrap px-warning">${deal.question}</small></span></div><div class="px-bar-actions"><button class="px-window px-button" data-deal-cancel data-cursor-start data-shows="${deal.id}" data-help="Nothing changes.">Not now</button><button class="px-window px-button is-${deal.tone ?? 'danger'}" ${deal.confirm} data-shows="${deal.id}" data-help="${deal.confirmHelp}">${deal.confirmLabel}</button></div></div>`;
  }

  /**
   * One deal across the counter. Every path through it reloads the save the
   * deal was struck against, because the vault it spends is the stored one and
   * the screen is only a picture of it.
   */
  private dealAtCounter(deal: () => { readonly ok: boolean; readonly message: string }): void {
    const before = moneyHeld(this.stash);
    const result = deal();
    let after = before;
    if (result.ok) {
      const reloaded = this.saveManager.load();
      if (reloaded) {
        const view = this.view;
        this.applyLoadedGame(reloaded);
        this.view = view;
      }
      after = moneyHeld(this.stash);
      // Money over the counter is a coin's sound; parts handed over are a deal.
      audioManager.play(after < before ? 'coinToss' : 'confirm');
    } else {
      audioManager.play('cancel');
    }
    this.setStatus(result.message);
    if (after < before) {
      this.rollMoney(before, after);
    }
  }

  /**
   * The purse in the title pill counts down to what is left, a step a frame
   * or so, on the scene's own clock - so a stepped test-mode game rolls it too.
   */
  private rollMoney(from: number, to: number): void {
    const steps = MONEY_ROLL_STEPS;
    const show = (value: number) => {
      const pill = this.overlay?.root.querySelector<HTMLElement>('[data-money-roll]');
      if (pill) {
        pill.textContent = formatMoney(value);
      }
    };
    show(from);
    for (let step = 1; step <= steps; step += 1) {
      this.time.delayedCall(MONEY_ROLL_STEP_MS * step, () => show(Math.round(from + ((to - from) * step) / steps)));
    }
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
    const first =
      ladder.find((offer) => offer.upgrade.id === this.workshopStartsOn) ??
      ladder.find((offer) => offer.affordable) ??
      ladder.find((offer) => offer.state !== 'built');
    const rows = ladder
      .map((offer) => {
        const { upgrade } = offer;
        const art = fixtureArt(upgrade.id);
        // A machine taller than the card's picture box (the beacon, the mast)
        // is drawn smaller by a whole number rather than cut through its top:
        // every build is whole on its card (`fixtureDivisor`).
        const divisor = art ? fixtureDivisor(art) : 1;
        const shown = art ? { width: Math.ceil(art.width / divisor), height: Math.ceil(art.height / divisor) } : undefined;
        const picture = art && shown
          ? `<canvas class="px-fixture" data-fixture="${upgrade.id}" data-fixture-divisor="${divisor}" width="${shown.width}" height="${shown.height}" style="--w:${shown.width};--h:${shown.height}" role="img" aria-label="${escapeAttribute(upgrade.name)}"></canvas>`
          : iconMarkup(upgrade.icon, upgrade.name);
        if (this.workshopArmed === upgrade.id) {
          const spent = itemAmountsFor(upgrade.cost.supplies);
          // Asked in the card's own place along the row, the building over the
          // question.
          return this.armedDeal({
            id: upgrade.id,
            icon: `<span class="workshop-stage">${picture}</span>`,
            // One line, as the card it stands in for: the row stays low.
            name: cardName(upgrade.name),
            // Short enough for one line of the card: three lines of it made the
            // card taller than the row, and the room above halved its size the
            // moment BUILD IT was pressed. The parts are named on the card on
            // the right and in the help bar under BUILD IT.
            question: 'Spend the parts for good?',
            confirm: `data-outfit-confirm="${upgrade.id}"`,
            confirmLabel: 'Build it',
            confirmHelp: `Spends ${escapeAttribute(spent)} for good.`,
            // Green, the look's go: a build is a gain, and red is for what can be lost.
            tone: 'primary',
          });
        }
        const built = offer.state === 'built';
        const tag = built ? pixelTag('Built', 'secure', true) : '';
        // Not `disabled`: the cursor has to reach a build to say what it does.
        const wiring = built
          ? `data-built="${upgrade.id}"`
          : `data-outfit="${upgrade.id}"${offer.affordable ? '' : ' aria-disabled="true"'}`;
        // One line of the help bar: what pressing this does and nothing else.
        const help = built
          ? canBeMoved(upgrade.id)
            ? `Move ${upgrade.name}: pick another place for it in the yard. It costs nothing.`
            : `${upgrade.name} already stands at base.`
          : offer.affordable
            ? canBeMoved(upgrade.id)
              ? `Build ${upgrade.name}: you are asked once more, then pick where it stands in the yard.`
              : `Build ${upgrade.name}: you are asked once more before anything is spent.`
            : offer.state === 'locked'
              ? `Locked: built only after ${offer.requires?.name ?? 'an earlier upgrade'}.`
              : this.shortfallLine(offer);
        // While a build is asking, only its Not now may start the cursor.
        const start = offer === first && this.workshopArmed === undefined;
        // The card is what the build is, as it stands in the room
        // (`ui/fixturePicture.ts`): in its colours once built, a grey blueprint
        // before. Under it its price as the parts' own icons, counted, crossed
        // and grey where the base is short - or, for a build that waits on
        // another, the lock and what it waits for.
        const parts = built ? this.priceAsPaid(upgrade) : this.pricedAgainstVault(offer);
        const cost =
          offer.state === 'locked'
            ? // The padlock and the build it waits for, in one line: AFTER is the
              // card on the right's and the help bar's, where there is room.
              `<span class="workshop-after" aria-label="${escapeAttribute(`After ${offer.requires?.name ?? 'an earlier one'}`)}">${iconMarkup('padlock', 'Locked')}${cardName(offer.requires?.name ?? 'an earlier one')}</span>`
            : parts
                .map((part) => {
                  const count = /^(\d+)×/.exec(part.ask)?.[1];
                  // Short is a shape as well as a colour: the drawn cross the
                  // legend over the row names, as the shelves have it.
                  return `<span class="workshop-cost${part.short ? ' is-short' : ''}">${part.short ? SHORT_MARK : ''}${part.icon ?? ''}<small>${count ? `×${count}` : part.ask}</small></span>`;
                })
                .join('');
        const state = built ? 'is-built' : offer.affordable ? 'is-ready' : offer.state === 'locked' ? 'is-locked' : 'is-short';
        return `<button class="px-window px-card workshop-card ${state}" ${wiring}${start ? ' data-cursor-start' : ''} data-shows="${upgrade.id}" data-help="${escapeAttribute(help)}"><span class="workshop-stage">${picture}</span><strong class="px-name">${cardName(upgrade.name).replace(/ ([IVX]+)$/, ' $1')}</strong><small class="px-wrap workshop-effect">${upgrade.effect}</small><span class="workshop-costs">${cost}</span>${tag}</button>`;
      })
      .join('');
    const shown = (this.workshopArmed !== undefined ? ladder.find((offer) => offer.upgrade.id === this.workshopArmed) : undefined) ?? first ?? ladder[0];
    const details = ladder.map((offer) => this.workshopDetail(offer, offer === shown)).join('');
    // The room is the stage: Brock in his workshop, whole, with chalk on the
    // floor where every machine not built yet will stand, and the chosen
    // build's bay ringed in gold - the gold ring follows the cursor along the row.
    const marks = this.workshopBays()
      .map(({ upgradeId, area }) => roomPictureMark(upgradeId, area, upgradeId === shown?.upgrade.id))
      .join('');
    const room = `<section class="px-window workshop-room">${this.roomPicture('brocks-workshop', 'Brock in his workshop', marks)}</section>`;
    const info = `<section class="px-window workshop-info">${details}</section>`;
    // The builds' row carries no heading strip: how many are built is the
    // card's BUILT n OF 7, and a short part is the crossed grey tag itself -
    // the strip's height is what lets the room above be drawn whole.
    return `<main class="px-body workshop-layout"><div class="workshop-top">${room}${info}</div>${pixelWindow(
      `<div class="workshop-skyline px-scroll">${rows}</div>`,
      { className: 'objectives-panel workshop-ladder' },
    )}</main>`;
  }

  /** Where each build stands, or will stand, in Brock's room: a chalked bay, or the tiles of the thing built. */
  private workshopBays(): readonly { readonly upgradeId: string; readonly area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } }[] {
    const built = this.builtRoom('brocks-workshop');
    if (!built) {
      return [];
    }
    const chalked = built.posters.flatMap((poster) => (poster.kind === 'chalk-bay' ? [{ upgradeId: poster.upgradeId, area: poster.area }] : []));
    const standing = built.things.flatMap((thing) => {
      if (!thing.upgradeId || thing.tiles.length === 0 || chalked.some((bay) => bay.upgradeId === thing.upgradeId)) {
        return [];
      }
      const xs = thing.tiles.map((tile) => tile.x);
      const ys = thing.tiles.map((tile) => tile.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return [{ upgradeId: thing.upgradeId, area: { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 } }];
    });
    return [...chalked, ...standing];
  }

  /** What Brock's parts come to at base: each part's picture and how many are spare. */
  private workshopPartsAside(): string {
    const parts = MATERIAL_IDS.map((itemId) => ({ itemId, held: spendableSupply(this.workshopVault, itemId) })).filter(({ held }) => held > 0);
    if (parts.length === 0) {
      return 'No parts yet';
    }
    return `Parts ${parts.map(({ itemId, held }) => `${itemIcon(itemId, this.itemName(itemId))}${held}`).join(' ')}`;
  }

  /**
   * One build, in pictures: what it does in a raid, the parts it is built with
   * as tags against what is spare at base (ALL HERE when every one is), who
   * builds it and how many are built, and the key that builds it.
   */
  private workshopDetail(offer: WorkshopOffer, shown: boolean): string {
    const { upgrade } = offer;
    const built = offer.state === 'built';
    const builtCount = this.builtUpgradeIds.length;
    const picture = workshopEffectPicture(upgrade.id);
    const show = picture ? `<div class="ws-raid"><small class="px-label">In a raid</small><div class="ws-picture">${picture}</div></div>` : '';
    const parts =
      offer.state === 'locked'
        ? `<p class="workshop-after">${iconMarkup('padlock', 'Locked')}After ${offer.requires?.name ?? 'an earlier one'}</p>`
        : partTags(
            upgrade.cost.supplies.map(({ itemId, quantity }) => ({
              icon: itemIcon(itemId, this.itemName(itemId)),
              quantity,
              held: built ? quantity : spendableSupply(this.workshopVault, itemId),
            })),
            built ? 'Built with' : 'Builds with',
            // ALL HERE is about a price still to pay: on a build that stands it
            // read as if the parts were still at base.
            built ? '' : undefined,
          );
    return shopCardPane({
      id: upgrade.id,
      shown,
      head: {
        title: upgrade.name,
        note: built ? 'Built' : offer.affordable ? 'Ready' : offer.state === 'locked' ? 'Locked' : 'Short',
        tone: built || offer.affordable ? 'green' : 'ink',
      },
      show,
      parts,
      ...(offer.affordable
        ? { go: { key: 'ENTER', label: 'Build it' } }
        : built && canBeMoved(upgrade.id)
          ? { go: { key: 'ENTER', label: 'Move it' } }
          : {}),
      foot: `<p class="ws-tally">${pixelFigure('brock', 'Brock')}<small>Built ${builtCount} of ${WORKSHOP_UPGRADES.length}</small></p>`,
    });
  }

  private reselectView(): string {
    const spare = this.sparePartner;
    if (!spare) return '<main class="px-body"><p class="px-window px-empty">You have more than one Pokémon, so there is nothing to swap.</p></main>';
    const chosen = getStarterSpecies(this.reselectStarterId);
    const held = `${spare.pokemon.name} (Level ${spare.pokemon.level})`;
    return `<main class="px-body starter-shell reselect-shell"><p class="starter-brief">${held} is your last Pokémon. Swapping releases it for good for a level 5 starter as hurt as it is now, with no supplies.</p><div class="starter-grid" ${pixelColumns(100, { maximum: 3, widest: 132 })}>${starterCards(this.reselectStarterId, { heldSpeciesId: spare.pokemon.base.id, selectHelp: 'Swap to this starter.' })}</div><div data-swap-footer>${this.swapFooter(spare, chosen)}</div></main>`;
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
    // Everybody at base, those he would take first (`ui/boxPicker.ts`'s promises).
    const away = awayOnRaid(this.savedGame);
    const takes = (stored: StashedPokemon): boolean => dayCareRefusal(this.stash, stored.id, away) === undefined;
    const found = this.findablePokemon;
    const shown = [...found.filter(takes), ...found.filter((stored) => !takes(stored))];
    const partner = this.stash.partner()?.id;
    return dayCareBody(
      shown.map((stored) => {
        const refusal = dayCareRefusal(this.stash, stored.id, away);
        return {
          id: stored.id,
          pokemon: stored.pokemon,
          ...(refusal === undefined ? {} : { refusal }),
          away: away.has(stored.id),
          partner: stored.id === partner,
        };
      }),
      { browse: this.browseBar(), note: this.atBaseNote(away) },
    );
  }

  /**
   * THE TRADER's list (`hub/trades.ts`). He has said what he is after on the
   * lawn before it opens (`BaseScene`): every Pokémon at base, those he would
   * trade first, each saying what it would come back as - or why not.
   */
  private tradesView(): string {
    const away = awayOnRaid(this.savedGame);
    const made = this.savedGame.raidProgress.tradesMade ?? [];
    const refusal = (stored: StashedPokemon): string | undefined => tradeRefusal(this.stash, stored.id, away, made);
    const dealOf = (stored: StashedPokemon) =>
      refusal(stored) === undefined ? tradeDealFor(stored.pokemon.base.id, made) : undefined;
    const found = this.findablePokemon;
    const shown = [...found.filter((stored) => refusal(stored) === undefined), ...found.filter((stored) => refusal(stored) !== undefined)];
    const armed = shown.find((stored) => stored.id === this.tradeArmed);
    const armedDeal = armed ? dealOf(armed) : undefined;
    // A trade of his is for good, so it is asked, in the bar the partner swap
    // asks in: Keep stands last, in the seat a double press lands on.
    const asking =
      armed && armedDeal
        ? pixelCommitBar({
            className: 'is-arming',
            title: armedDeal.kind === 'swap' ? `Trade ${armed.pokemon.name.toUpperCase()}?` : `Send ${armed.pokemon.name.toUpperCase()} over and back?`,
            lines: [`<span class="px-wrap px-warning">${escapeAttribute(tradeQuestion(armed.pokemon.name, armedDeal))}</span>`],
            actions: `<button class="px-window px-button is-${armedDeal.kind === 'swap' ? 'danger' : 'primary'}" data-trade-confirm="${armed.id}" data-shows="${armed.id}" data-help="${escapeAttribute(tradeHelp(armed.pokemon.name, armedDeal))}">${armedDeal.kind === 'swap' ? `Trade for ${armedDeal.trade.nickname}` : 'Trade and back'}</button><button class="px-window px-button" data-deal-cancel data-cursor-start data-shows="${armed.id}" data-help="Nothing changes.">Keep it</button>`,
          })
        : '';
    const partner = this.stash.partner()?.id;
    return tradesBody(
      shown.map((stored) => {
        const why = refusal(stored);
        const deal = dealOf(stored);
        return {
          id: stored.id,
          pokemon: stored.pokemon,
          ...(deal ? { deal } : {}),
          ...(why === undefined ? {} : { refusal: why }),
          away: away.has(stored.id),
          partner: stored.id === partner,
        };
      }),
      {
        browse: this.browseBar(),
        note: this.atBaseNote(away),
        owned: new Set(this.savedGame.raidProgress.pokedexOwned ?? []),
        ...(this.tradeArmed === undefined ? {} : { armed: this.tradeArmed }),
        asking,
      },
    );
  }

  /** One trade with THE TRADER, made in one write, and said back on the lawn. */
  private makeTrade(pokemonId: string): void {
    this.tradeArmed = undefined;
    if (this.movedOnElsewhere()) {
      return;
    }
    const made = this.saveManager.makeTrade(pokemonId);
    if (!made) {
      this.readTheGameAgain();
      this.refuse(
        tradeRefusal(this.stash, pokemonId, awayOnRaid(this.savedGame), this.savedGame.raidProgress.tradesMade ?? []) ??
          'He could not trade: the game could not be saved.',
      );
      return;
    }
    audioManager.play('itemObtained');
    this.scene.start('base', {
      savedGame: this.saveManager.load() ?? this.savedGame,
      ...(this.enteredAt === undefined ? {} : { at: this.enteredAt }),
      said: made.lines,
      saidBy: TRADER_POSITION,
    });
  }

  /** Hands one Pokémon to the Day-Care Man, if he will take it. */
  private leaveAtDayCare(pokemonId: string): void {
    if (this.movedOnElsewhere()) {
      return;
    }
    const refusal = dayCareRefusal(this.stash, pokemonId, awayOnRaid(this.savedGame));
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

  /** How many of a thing the save holds: the vault's, and one on Oak's fossil machine. */
  private heldOrOnTheMachine(itemId: string): number {
    return this.stash.itemCount(itemId) + (this.savedGame.raidProgress.fossil?.itemId === itemId ? 1 : 0);
  }

  /** Whether the Pokédex owns a kind: the save's register and the vault's own. */
  private pokedexOwns(speciesId: string): boolean {
    const dexId = getSpeciesById(speciesId)?.dexId;
    return dexId !== undefined && pokedexOwned(this.savedGame.raidProgress.pokedexOwned, this.stash).includes(dexId);
  }

  private itemName(itemId: string): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  /**
   * Whether `pokemonId` is out on the raid in flight in another window, saying
   * so when it is. Two tabs share one save, and that raid's ending writes its
   * own copy of every Pokemon it took back over the vault, so whatever this
   * screen did to one - a heal, gear, a move - would be undone or doubled.
   * `SaveManager.save` refuses the write regardless (`raidHoldRefusal`); this is
   * that refusal said before anything changes.
   */
  private outOnRaid(pokemonId: string): boolean {
    if (!awayOnRaid(this.savedGame).has(pokemonId)) {
      return false;
    }
    const name = this.stashPokemon.find((stored) => stored.id === pokemonId)?.pokemon.name ?? 'That Pokémon';
    this.refuse(outOnRaidLine(name));
    return true;
  }

  /** How many Pokemon are at base, not counting those out on a raid in another window. */
  private atBaseNote(away: ReadonlySet<string>): string {
    const out = this.stashPokemon.filter((stored) => away.has(stored.id)).length;
    const here = this.stashPokemon.length - out;
    return out === 0 ? `${here} at base` : `${here} at base · ${out} on a raid`;
  }

  /** A status line that is the game saying no. */
  private refuse(message: string): void {
    audioManager.play('denied');
    this.setStatus(message);
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
 * What the rim's Safe line says of room the locker keeps for a found good: it
 * is never packed, so it is room, not a thing carried.
 */
export function roomKeptFor(item: { readonly itemId: string; readonly quantity: number }, name: string): string {
  return isCurrency(item.itemId)
    ? `room for ${itemCountTag(item.itemId, item.quantity)}`
    : `room for ${item.quantity === 1 ? 'a' : item.quantity} ${name}`;
}

/**
 * A place's wildlife on Oak's wall, each kind and its levels kept as one unit:
 * the line broke "Pidgey 3-" from its "4" at 1366x768 (scenario loop, 23 Nov
 * 2026). It wraps between kinds (`.wildlife-kind` in `style.css`).
 */
export function wildlifeKinds(species: readonly { readonly name: string; readonly min: number; readonly max: number }[]): string {
  return species.map((entry) => `<span class="wildlife-kind">${entry.name} ${entry.min}-${entry.max}</span>`).join(' · ');
}

/** Walked places grouped by what lives in them, in the order each kind of place is first met. */
function wildlifeGroups<Entry extends { readonly name: string; readonly min: number; readonly max: number }>(
  seen: readonly { readonly place: string; readonly species: readonly Entry[] }[],
): readonly { readonly places: readonly string[]; readonly species: readonly Entry[] }[] {
  const groups = new Map<string, { places: string[]; species: readonly Entry[] }>();
  for (const place of seen) {
    const key = place.species.map((entry) => `${entry.name} ${entry.min}-${entry.max}`).join('|');
    const group = groups.get(key);
    if (group) group.places.push(place.place);
    else groups.set(key, { places: [place.place], species: place.species });
  }
  return [...groups.values()];
}
