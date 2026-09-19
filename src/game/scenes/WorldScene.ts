import Phaser from 'phaser';
import {
  nextTileFromDirection,
  planNextGridStep,
  type Direction,
  type GridBounds,
  type GridInputState,
  type GridPosition,
} from '../movement/gridMovement';
import { KeyPresses } from '../input/KeyPresses';
import { PressLatch } from '../input/pressLatch';
import { advanceStepClock } from '../movement/stepClock';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_HEAD_PIXEL_Y,
  getIdleFrame,
  getWalkAnimationKey,
} from '../playerFrames';
import type { CharacterDesignId } from '../world/characterDesigns';
import {
  getWorldCharacterAppearance,
  NO_TINT,
  PLAYER_MARKER_DEPTH,
  PLAYER_MARKER_GROUND_LAYERS,
  PLAYER_MARKER_HEAD_LAYERS,
  SHARED_CHARACTER_TEXTURE,
  worldCharacterIdleFrame,
  type MarkerLayer,
  type WorldCharacterAppearance,
  type WorldCharacterRole,
} from '../world/characterPresentation';
import {
  getWarpAt,
  getWorldMap,
  isTallGrassInMap,
  TILE_SIZE,
  WORLD_MAP_NAMES,
  type MapWarp,
  type TileLayer,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import { type WorldEntity } from '../world/npcs';
import { PARTY_LIMIT, Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { createGiftPokemon, giftGivenBy, isGiftSpoken, type PokemonGift } from '../world/gifts';
import { DialogBox } from '../ui/DialogBox';
import { WORLD_ICONS, iconTextureKey, itemIconName } from '../ui/icons';
import { rollEncounter } from '../world/wildEncounters';
import { encounterTableAt } from '../world/localEncounters';
import { hasPlayerSetOff } from '../world/hunterArrival';
import { SpentPresses } from '../world/spentPresses';
import { consumeTeachingEncounter } from '../world/teachingEncounter';
import { audioManager } from '../audio/AudioManager';
import {
  entersTallGrass,
  HUNTER_NEAR_STEPS,
  nextBump,
  nextHunterProximity,
} from '../audio/worldSounds';
import { DEFAULT_RAID_PROGRESS, SaveManager, type RestoredGame } from '../save/SaveManager';
import { Bag, ITEMS, footprintOf, getItemById, type ItemId } from '../items';
import {
  areContractStopsComplete,
  completedObjectiveRewards,
  contractCarryIn,
  contractReportLine,
  formatStacks,
  isContractBankable,
  missingCarryIn,
  remainingMarkers,
  rewardPokemon,
  type ContractMarker,
  type StandingBoardProgress,
} from '../objectives';
import { RunPhase } from '../run/RunManager';
import { compassBearing } from '../world/bearing';
import { buildExtractionReport, type ExtractionReport } from '../run/extractionReport';
import {
  buildRaidSettlement,
  buildWipeSettlement,
  deployedRaidCondition,
} from '../run/raidSettlement';
import { BASE_STAGE_WIDTH } from '../display/stage';
import { RaidHud } from '../ui/RaidHud';
import { WorldLabel, type WorldLabelTone } from '../ui/WorldLabel';
import { ChoicePrompt } from '../ui/ChoicePrompt';
import { placeCaptions, placeDialog, type Rect } from '../ui/labelPlacement';
import { advanceLookMs, isLooking } from '../ui/captionReveal';
import { GAME_FONT } from '../ui/gameFont';
import { DIALOG_FONT_SIZE } from '../ui/screenType';
import {
  CAPTION_BAND,
  FIGURE_BAND,
  MARKER_BAND,
  CANOPY_BAND,
  TERRAIN_DEPTH,
  WATCH_SHADING_DEPTH,
  atRow,
} from '../world/depths';
import { districtAt } from '../world/districts';
import { WINDOW_CREAM } from '../ui/pixelWindow';
import {
  OBJECTIVE_DETAIL_MS,
  PLACE_PLATE_MS,
  openRaidCue,
  hunterChipView,
  objectiveChipLines,
  placePlateLine,
  raidClockAlertTier,
  raidClockView,
} from './raidHud';
import { createBattleReturnLocation, type ActiveRunSession, type RaidLocation } from '../run/RunSession';
import type { RaidCarriage } from '../run/raidCarriage';
import type { BattleSceneData } from './BattleScene';
import {
  bossEncounters,
  bossGearDropped,
  createRunTrainerEncounters,
  withoutDefeatedBosses,
  type RunTrainerEncounter,
} from '../world/trainers';
import {
  gateCaption,
  gatesByKeeper,
  gatesOpenedLines,
  isGateOpen,
  jointGateCaption,
  WORLD_GATES,
  type MapGate,
} from '../world/gates';
import { dropInCaption, dropInReachedLine } from '../world/dropIns';
import { insertionAt, isDropInPoint, RUN_INSERTIONS } from '../run/runGeneration';
import {
  approachFrameAt,
  planTrainerApproach,
  type TrainerApproach,
} from '../world/trainerApproach';
import { findWatchingTrainer, trainerSightTiles } from '../world/trainerSight';
import {
  trainerChallengePrompt,
  trainerDeclinedMessage,
  trainerWatchCaption,
} from '../world/trainerEngagement';
import { hasHunterIntel } from '../hub/outfitter';
import { BEACON_EXIT_LABEL } from '../run/runGeneration';
import { getVisibleLoot, tryCollectLoot } from '../world/loot';
import { tryActivatePoi } from '../world/pois';
import {
  EXTRACTION_POINTS,
  extractionCaption,
  extractionRequirementText,
  isExtractionAvailable,
  type ExtractionPoint,
} from '../world/extractionPoints';
import {
  findHunterPursuitPath,
  findHunterBreakawayTile,
  findHunterSpawnTile,
  HUNTER_BREAKAWAY_DISTANCE,
  applyHunterBreakaway,
  isHunterSearching,
  tickHunterSearch,
  createHunterState,
  createHunterTrainer,
  DEFAULT_HUNTER_TUNING,
  HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP,
  HUNTER_SPAWN_MS,
  isHunterEligibleForFirstContract,
  isHunterContactingPlayer,
  type HunterState,
  hunterIntelFor,
} from '../world/hunter';

const CAMERA_ZOOM = 1;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
/** Hair to soles, inclusive: the part of a figure's frame that is drawn on. */
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;
const HUNTER_FIGURE_ID = 'rival-hunter';

/** The rectangle of map a tile covers - what a caption naming that tile is seated around. */
const tileRect = (tile: GridPosition): Rect => ({
  x: tile.x * TILE_SIZE,
  y: tile.y * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
});

/** The rectangle a figure standing on a tile is drawn on: taller than the tile, soles just under it. */
const figureRect = (tile: GridPosition): Rect => ({
  x: tile.x * TILE_SIZE,
  y: tile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET + CHARACTER_HEAD_PIXEL_Y,
  width: TILE_SIZE,
  height: FIGURE_HEIGHT,
});
/** Long enough for the extraction flash and shake to read before the result screen. */
const RUN_RESULT_DELAY_MS = 700;
/** The player's chevron stands this far above their hair. */
const CHEVRON_HEIGHT = 6;

/** A tile the player is expected to be standing on: the figure, and the chevron over it. */
const landingRect = (tile: GridPosition): Rect => {
  const figure = figureRect(tile);
  return { ...figure, y: figure.y - CHEVRON_HEIGHT, height: figure.height + CHEVRON_HEIGHT };
};

/**
 * Map captions share the raid HUD's window, in a darker weight: screen furniture
 * is cream, world annotation is a tinted panel with a coloured frame. Each tone
 * keeps the colour the caption already carried, so nothing changes meaning.
 */
const LABEL_TONES: Readonly<
  Record<
    | 'station'
    | 'exitOpen'
    | 'exitShut'
    | 'route'
    | 'watch'
    | 'contract'
    | 'gateShut'
    | 'gateOpen'
    | 'dropIn',
    WorldLabelTone
  >
> = {
  station: { fill: 0x14243a, border: 0x7fb2e5, ink: '#dff0ff' },
  // Contract stops are the one thing on the map the raid was taken for, so they
  // are the only violet on it and cannot be mistaken for a cache or a gate.
  contract: { fill: 0x281a3d, border: 0xc4b5fd, ink: '#ede9fe' },
  exitOpen: { fill: 0x123d22, border: 0x86efac, ink: '#dcfce7' },
  exitShut: { fill: 0x3d1414, border: 0xfca5a5, ink: '#fecaca' },
  route: { fill: 0x3a2408, border: 0xf1bf63, ink: '#fef3c7' },
  // A trainer's watch is the one caption that is a threat rather than a place,
  // so it borrows the hunter chip's red rather than the sealed exit's.
  watch: { fill: 0x3f1220, border: 0xf87171, ink: '#ffe4e6' },
  // A boss-held gate is iron: neither an exit's red nor a threat's. Once it is
  // open it fades to the quietest caption on the map - it is a fact about the
  // fence now, not something to act on.
  gateShut: { fill: 0x2a2a33, border: 0xe4e4e7, ink: '#fafafa' },
  gateOpen: { fill: 0x1f2630, border: 0x8b95a5, ink: '#cbd5e1' },
  // A drop-in point is the one teal on the map: somewhere a later raid can
  // start, which no cache, exit or contract stop is.
  dropIn: { fill: 0x0f3a3d, border: 0x5eead4, ink: '#ccfbf1' },
};

/** The landing pad drawn on a drop-in point, as filled pixel rects. */
const DROP_IN_TINT = 0x5eead4;

/** How the ground a trainer is watching is shaded. */
const WATCH_TINT = 0xf87171;
const WATCH_FILL_ALPHA = 0.16;
const WATCH_EDGE_ALPHA = 0.42;
/**
 * When a beaten trainer's watch is lifted the shading is not just removed: it
 * lets go tile by tile from the trainer's end, so the player sees the route open
 * rather than infer it from a missing colour. Times are wall-clock tweens, which
 * are frame-rate safe and touch no raid clock.
 */
const WATCH_LIFT_DELAY_MS = 260;
const WATCH_LIFT_TILE_MS = 90;
const WATCH_LIFT_FADE_MS = 520;
/** The "!" over a trainer who has seen you: a cream bubble, ink border, red mark. */
const SPOTTED_INK = 0x171717;
const SPOTTED_CREAM = 0xfdf6e3;
const SPOTTED_MARK = 0xdc2626;
/**
 * Compass letters rather than arrow glyphs: the caption font is 7px, and an
 * arrow at that size renders as a tick with no head. The raid HUD already gives
 * the hunter and the objective a bearing, so this is the language the player is
 * reading directions in anyway.
 */
const WATCH_BEARING: Readonly<Record<Direction, string>> = {
  up: 'N',
  down: 'S',
  left: 'W',
  right: 'E',
};
/**
 * The dialogue frame keeps the authored size it was written for and is centred
 * on the bottom of whatever screen it is on. Stretching it to a wide window
 * turns four lines of narration into a billboard across half the map.
 */
const DIALOG_WIDTH = BASE_STAGE_WIDTH - 16;
const DIALOG_HEIGHT = 80;
const DIALOG_MARGIN = 8;

interface ControlKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  party: Phaser.Input.Keyboard.Key;
  bag: Phaser.Input.Keyboard.Key;
  save: Phaser.Input.Keyboard.Key;
  objectives: Phaser.Input.Keyboard.Key;
  /** The look: every name on the screen while it is held - see `captionReveal.ts`. */
  look: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key[];
}

/**
 * What the world is started with. The hub supplies the carriage's deployment
 * half (party, bag, session); a battle hands back the whole of it.
 */
export interface WorldSceneData extends Partial<RaidCarriage> {
  readonly savedGame?: RestoredGame;
}

/** The fight itself - the only part of a battle payload a call site writes. */
type BattleEncounter =
  | Required<Pick<BattleSceneData, 'wild' | 'teachingBattle'>>
  | Required<Pick<BattleSceneData, 'trainer' | 'hunterBattle'>>;

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export class WorldScene extends Phaser.Scene {
  private bounds: GridBounds = { width: 0, height: 0 };
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();

  private player!: Phaser.GameObjects.Sprite;
  /** Travel with the player so which figure is yours never has to be guessed. */
  private playerGroundMark!: Phaser.GameObjects.Graphics;
  private playerHeadMark!: Phaser.GameObjects.Graphics;
  private dialogBox!: DialogBox;
  private controls!: ControlKeys;
  private collisionData!: boolean[][];
  private currentMap: WorldMapDefinition = getWorldMap('pallet-town');
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly npcAppearances = new Map<string, WorldCharacterAppearance>();
  private party = new PokemonParty([new Pokemon(CHARMANDER, 5)]);
  private caughtPokemonStash: Pokemon[] = [];
  private bag = new Bag({ potion: 3, antidote: 1, 'poke-ball': 5, 'great-ball': 1 });
  private currentTile: GridPosition = { x: 6, y: 8 };
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'down';
  private stepProgress = 0;
  /**
   * Game time the last finished step did not need, or null when the last frame
   * finished no step. It belongs to the step the very next frame begins and to
   * nothing else, so `update` takes it on entry and any frame that does something
   * other than walk on lets it go.
   */
  private stepCarryMs: number | null = null;
  private readonly directionPresses = new PressLatch<Direction>();
  /** Every `JustDown` this scene would ask goes through here - see `KeyPresses`. */
  private readonly keyPresses = new KeyPresses(() => this.currentFrame());
  private isWarping = false;
  private extractionMarkers: Array<{
    readonly point: ExtractionPoint;
    readonly marker: Phaser.GameObjects.Image;
    readonly label: WorldLabel;
  }> = [];
  /** Every map caption, so each one can be asked whether it speaks and seated each frame. */
  private worldLabels: WorldLabel[] = [];
  /**
   * What is left of the glance a tap of the look key bought. Held down, the key
   * itself keeps the look open; this is only so that a tap is longer than a
   * frame. See `advanceLookMs`.
   */
  private lookMs = 0;
  private canopyInViewCache: { readonly key: string; readonly runs: readonly Rect[] } | null = null;
  /** Ground a trainer is watching: shaded to be read, so no caption may sit on it. */
  private watchedGround: Rect[] = [];
  private raidHud: RaidHud | undefined;
  /** The cue the objective chip is currently showing, so a change can be noticed. */
  private objectiveCue = '';
  /** Counts down the window in which a changed objective shows its extra line. */
  private objectiveDetailMs = 0;
  /** The district the player is standing in, and how long its arrival plate has left. */
  private districtId: string | null = null;
  private placeName: string | null = null;
  private placePlateMs = 0;
  /** True when this build of the scene is a battle handing the raid back. */
  private arrivedFromBattle = false;
  private runSession: ActiveRunSession | undefined;
  private pendingHubTransition = false;
  /** Set once a finished raid is on its way to the result screen. */
  private pendingResultScreen = false;
  private trainerEncounters: readonly RunTrainerEncounter[] = [];
  private readonly defeatedTrainerIds = new Set<string>();
  private readonly collectedLootIds = new Set<string>();
  private readonly lootSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly activatedPoiIds = new Set<string>();
  private readonly poiSprites = new Map<string, Phaser.GameObjects.Container>();
  private readonly poiLabels = new Map<string, WorldLabel>();
  /** One drawn stop per outstanding contract marker, keyed by marker id. */
  private readonly contractMarkers = new Map<
    string,
    { readonly image: Phaser.GameObjects.Image; readonly label: WorldLabel }
  >();
  /**
   * The confirmation standing between the interact key and an authored trainer
   * fight. It owns the keyboard while it is open, exactly as a dialogue does.
   */
  private trainerPrompt: ChoicePrompt | undefined;
  /**
   * The beat between a watch catching the player and the trainer speaking: the
   * mark, the walk up, the arrival. Driven from `update()` by elapsed time - see
   * `../world/trainerApproach`. Only one can be live, because it is only ever
   * begun on the step that starts a fight.
   */
  private trainerApproach:
    | {
        readonly trainerId: string;
        readonly plan: TrainerApproach;
        readonly lines: readonly string[];
        readonly mark: Phaser.GameObjects.Graphics;
        elapsedMs: number;
      }
    | undefined;
  private pendingTrainerBattle:
    | {
        readonly trainer: RunTrainerEncounter['trainer'];
        readonly introLines: readonly string[];
        readonly isHunter: boolean;
      }
    | undefined;
  /**
   * True while a dialogue the player did not open is on screen - the hunter's
   * arrival, a trainer's line of sight, being caught. It is the difference
   * between a box you asked for and one that landed in front of you, and it is
   * what lets a direction key get you out of the second kind.
   */
  private unsolicitedDialog = false;
  /** True while the dialogue box is seated at the top, clear of someone it announced. */
  private dialogRaised = false;
  /**
   * True while the deployment briefing is still on screen. It is the one box
   * the raid opens on its own first frame, before the player has touched a key,
   * and the raid clock does not run behind it - see `advanceRunClock()`.
   */
  private openingBriefingOpen = false;
  /**
   * Direction presses already spent on answering a dialogue, which movement
   * must not read again. See `spentPresses.ts` for the whole argument.
   */
  private spentPresses = new SpentPresses<Phaser.Input.Keyboard.Key>();
  private hunterState: HunterState = createHunterState();
  private timerThreat: 'normal' | 'urgent' | 'enraged' = 'normal';
  /**
   * Every boss beaten as of this moment: the ones the save already held when
   * the raid deployed, plus the ones beaten during it. It decides which gates
   * stand open, so the map is always asked for through `mapFor()`.
   */
  private defeatedBosses: readonly string[] = [];
  /** Insertions the lobby already offers, so the map only announces a new one. */
  private readonly knownInsertionIds = new Set<string>();
  /** The caption over each drop-in point, so reaching one can change what it says. */
  private readonly dropInLabels = new Map<string, WorldLabel>();
  /** The wall the player is already leaning on, so it thuds once. See `nextBump`. */
  private pushingAgainst: Direction | null = null;
  /** Whether the hunter's approach has already been announced. See `nextHunterProximity`. */
  private hunterNear = false;

  public constructor() {
    super('world');
  }

  /**
   * Clears everything the previous raid left on this instance.
   *
   * Phaser reuses one WorldScene object for every `scene.start('world')`, so a field
   * describing the raid in progress outlives that raid unless it is cleared here.
   * `pendingHubTransition` is the one that ends the game: an extraction or an expired
   * run sets it, and while it is set `update()` returns before the player can take a
   * step - so the next raid builds a world that renders and never responds. Anything
   * scoped to a single raid belongs in this list, not in a guard at the point it is read.
   */
  private resetStateFromPreviousRaid(): void {
    this.lookMs = 0;
    this.canopyInViewCache = null;
    this.pendingHubTransition = false;
    // Set on the way to the result screen, and read by handleRunResolutionComplete
    // to keep a dialogue from completing past it - so it is exactly the shape of
    // flag that froze the second raid, and belongs on this list.
    this.pendingResultScreen = false;
    this.pendingTrainerBattle = undefined;
    this.trainerApproach = undefined;
    this.unsolicitedDialog = false;
    // The box itself is rebuilt at the bottom by create(), so the note that it was moved goes too.
    this.dialogRaised = false;
    this.openingBriefingOpen = false;
    this.spentPresses = new SpentPresses();
    // Phaser destroyed the object with the last raid's scene, so this only has
    // to stop pointing at it - and it does have to, or the first frame of the
    // next raid hands the keyboard to a dead panel.
    this.trainerPrompt = undefined;
    this.isWarping = false;
    this.targetTile = null;
    this.stepProgress = 0;
    this.stepCarryMs = null;
    this.directionPresses.clear();
    this.facing = 'down';
    this.caughtPokemonStash = [];
    this.extractionMarkers = [];
    this.timerThreat = 'normal';
    // A gate opened in the last raid is in the save, and is read back from it;
    // what must not survive is this instance's own copy of the list.
    this.defeatedBosses = [];
    this.knownInsertionIds.clear();
    this.pushingAgainst = null;
    this.hunterNear = false;
    // Where the last raid ended is not where this one starts, and the plate
    // that named it must not flash up over the next insertion.
    this.districtId = null;
    this.placeName = null;
    this.placePlateMs = 0;
    this.arrivedFromBattle = false;
  }

  /**
   * This scene is rebuilt every time a battle hands the raid back, and a threat
   * the player was already warned about is not news on the way out of a fight.
   * Starting from `normal` each time replayed the clock's flash and sting after
   * every battle of a raid's last minute - one event, sounded again and again.
   */
  private resumeThreatsAlreadyAnnounced(): void {
    const manager = this.runSession?.manager;
    if (manager) {
      this.timerThreat = manager.isEnraged
        ? 'enraged'
        : raidClockAlertTier(manager.snapshot().remainingMs);
    }
    const hunter = this.hunterState.position;
    this.hunterNear =
      hunter !== undefined &&
      hunter !== null &&
      this.hunterState.mapId === this.currentMap.id &&
      Math.abs(hunter.x - this.currentTile.x) + Math.abs(hunter.y - this.currentTile.y) <=
        HUNTER_NEAR_STEPS;
  }

  public create(data: WorldSceneData = {}): void {
    this.resetStateFromPreviousRaid();
    this.runSession = data.runSession;
    // Trainers and who has been beaten come first: which gates are open is
    // derived from them, and the map cannot be asked for until that is known.
    this.defeatedTrainerIds.clear();
    data.defeatedTrainerIds?.forEach((id) => this.defeatedTrainerIds.add(id));
    const openedGates = this.settleBossProgress(data.savedGame);
    if (!this.runSession) {
      this.restoreSavedGame(data.savedGame);
    } else if (data.returnLocation) {
      this.arrivedFromBattle = true;
      this.currentMap = this.mapFor(data.returnLocation.mapId);
      this.currentTile = { ...data.returnLocation.position };
      this.facing = data.returnLocation.facing;
    } else if (this.runSession.plan) {
      this.currentMap = this.mapFor(this.runSession.plan.insertion.mapId);
      this.currentTile = { ...this.runSession.plan.insertion.position };
    }
    this.cameras.main.fadeIn?.(180, 0, 0, 0);
    void audioManager.startTheme('overworld');
    if (data.party) {
      this.party = data.party;
    }
    if (data.bag) {
      this.bag = data.bag;
    }
    if (data.caughtPokemonStash) {
      this.caughtPokemonStash = data.caughtPokemonStash;
    }
    this.collectedLootIds.clear();
    data.collectedLootIds?.forEach((id) => this.collectedLootIds.add(id));
    this.activatedPoiIds.clear();
    data.activatedPoiIds?.forEach((id) => this.activatedPoiIds.add(id));
    this.hunterState = data.hunterState ?? createHunterState();
    this.resumeThreatsAlreadyAnnounced();
    this.createMap();
    this.applyPendingHunterBreakaway();
    this.createEntities();
    this.liftBeatenWatches();
    this.createPlayer();
    this.createDialogBox();
    this.bindControls();
    this.configureCamera();
    this.createRunTimerHud();
    if (this.raidHud) {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyRunTimerHud());
    }
    const relayout = () => this.layoutForStage();
    this.scale.on?.(Phaser.Scale.Events.RESIZE, relayout);
    this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off?.(Phaser.Scale.Events.RESIZE, relayout),
    );
    this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () => this.clearMap());
    this.showFirstDeploymentBriefing();
    if (openedGates.length > 0) {
      // Said on the return from the fight that won it, and raised as an
      // interruption so the key already held walks the player at the door.
      this.interrupt(openedGates);
    }
  }

  /**
   * Works out which bosses are beaten, writes any new win to the save, and
   * returns what to say about the gates that win opened.
   *
   * A boss fight returns here like any trainer fight: the scene restarts with
   * the beaten trainer's id in its payload. That is the moment the door opens,
   * so it is also the moment it is recorded - a gate is the map changing, not
   * loot being carried out, and a raid that beats the boss and is then lost has
   * still opened it. The list this scene acts on is built from the raid's own
   * data rather than read back from storage, so the door opens in the raid that
   * won it even in a browser that cannot save.
   */
  private settleBossProgress(savedGame: RestoredGame | undefined): readonly string[] {
    const saveManager = new SaveManager();
    const stored = (saveManager.load() ?? savedGame)?.raidProgress;
    const deployedWith = this.runSession?.plan?.defeatedBosses ?? stored?.defeatedBosses ?? [];
    this.trainerEncounters = this.runSession
      ? (this.runSession.plan?.trainers ??
        withoutDefeatedBosses(createRunTrainerEncounters(), deployedWith))
      : [];
    const beatenThisRaid = bossEncounters(this.trainerEncounters)
      .filter((boss) => this.defeatedTrainerIds.has(boss.trainer.id))
      .map((boss) => boss.bossId);
    this.defeatedBosses = [...new Set([...deployedWith, ...beatenThisRaid])];
    for (const id of [...(stored?.unlockedInsertions ?? []), ...(stored?.reachedInsertions ?? [])]) {
      this.knownInsertionIds.add(id);
    }

    const newlyBeaten = saveManager.recordDefeatedBosses(beatenThisRaid);
    return [
      ...gatesOpenedLines(WORLD_GATES.filter((gate) => newlyBeaten.includes(gate.bossId))),
      ...this.takeBossGear(newlyBeaten),
    ];
  }

  /**
   * Puts what a beaten boss was carrying into this raid's own pack, and says so.
   *
   * It is hung on `recordDefeatedBosses`, which answers with the bosses recorded
   * for the *first* time and nothing else, so the gear is handed over exactly
   * once per save however many times the scene is rebuilt - a battle return runs
   * `create()` again, and a boss already in the save pays nothing.
   *
   * Into the pack rather than into the vault, because gear is meant to be
   * carried out: from here it is one more thing in the bag, so the wipe ledger,
   * the supply delta and the result screen all already know what to do with it.
   */
  private takeBossGear(newlyBeaten: readonly string[]): readonly string[] {
    return bossGearDropped(this.trainerEncounters, newlyBeaten).flatMap((drop) => {
      if (!this.bag.add(drop.itemId, 1)) {
        // Gear comes off a boss once per save and the win is already written,
        // so a full pack loses it for good. That is said out loud rather than
        // swallowed: a player who packed to the last square is owed the reason.
        const gear = getItemById(drop.itemId);
        return [
          `${drop.name} was carrying a ${gear?.displayName.toUpperCase() ?? 'PIECE OF GEAR'} - and your pack has no room for it.`,
          'It stays where it fell. Deploy with a square to spare next time.',
        ];
      }
      const item = getItemById(drop.itemId);
      return [
        `${drop.name} was carrying a ${item?.displayName.toUpperCase() ?? 'PIECE OF GEAR'}. You take it.`,
        `${item?.description ?? ''} Give it to a POKéMON from the party screen - and get it home.`,
      ];
    });
  }

  /** The map as it stands for this player: every gate their wins have opened, open. */
  private mapFor(mapId: WorldMapId): WorldMapDefinition {
    return getWorldMap(mapId, this.defeatedBosses);
  }

  public update(_time: number, deltaMs: number): void {
    const stepCarryMs = this.stepCarryMs;
    this.stepCarryMs = null;
    // Before the captions are seated, and before any of the early returns
    // below: the look is a way of reading the map, so it answers while a
    // dialogue box is open exactly as it does while walking.
    this.lookMs = advanceLookMs(this.lookMs, this.keyPresses.justPressed(this.controls.look), deltaMs);
    this.containWorldLabels();
    if (this.keyPresses.justPressed(this.controls.objectives)) {
      this.openObjectives();
      return;
    }

    this.dialogBox.update(deltaMs);

    this.advanceRunClock(deltaMs);
    if (this.pendingHubTransition) {
      this.handleDialogInput();
      return;
    }

    if (this.isWarping) {
      return;
    }

    // A decision the player is being asked to take comes before everything,
    // including walking: the map must not move under an open question.
    if (this.trainerPrompt) {
      this.handleTrainerPromptInput();
      return;
    }

    // A trainer coming for the player is not something to walk away from: the
    // map is theirs until they have arrived and spoken.
    if (this.trainerApproach) {
      this.advanceTrainerApproach(deltaMs);
      return;
    }

    if (this.dialogBox.visible) {
      this.handleDialogInput();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.party)) {
      this.openParty();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.bag)) {
      this.openBag();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.save)) {
      this.saveGame();
      return;
    }

    if (this.targetTile) {
      this.advanceStep(deltaMs);
      return;
    }

    if (this.tryExtractWhereStanding()) {
      return;
    }

    if (this.isInteractionPressed()) {
      this.tryInteract();
      return;
    }

    const input = this.readInput();
    const decision = planNextGridStep({
      position: this.currentTile,
      facing: this.facing,
      input,
      bounds: this.bounds,
      isBlocked: (tile) => this.isBlocked(tile),
    });

    const pushing = input.up || input.down || input.left || input.right;
    const bump = nextBump(this.pushingAgainst, !decision.target && pushing ? decision.facing : null);
    this.pushingAgainst = bump.pushingAgainst;
    if (bump.thud) {
      audioManager.play('bump');
    }
    this.facing = decision.facing;

    if (decision.target) {
      this.beginStep(decision.target);
      // Walking on from a step that ended part-way through the last frame: this
      // one started then, not now. A step begun from rest starts from nothing.
      if (stepCarryMs !== null) {
        this.advanceStep(deltaMs + stepCarryMs);
      }
      return;
    }

    this.showIdlePose();
  }

  /**
   * The single entry point for future world-item pickups. Keeping registration
   * beside the inventory mutation prevents found loot from being lost at
   * extraction.
   */
  public collectRunItem(itemId: ItemId, quantity = 1): boolean {
    if (!this.bag.add(itemId, quantity)) {
      return false;
    }
    this.runSession?.manager.registerFoundItem(itemId, quantity);
    return true;
  }

  private createMap(): void {
    this.collisionData = this.currentMap.collision.map((row) => [...row]);
    this.bounds = { width: this.currentMap.width, height: this.currentMap.height };

    const { tileset, layers } = this.currentMap;
    const map = this.make.tilemap({
      width: this.currentMap.width,
      height: this.currentMap.height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    // A map may draw its ground from one sheet and the things standing on it
    // from another, so every source is registered against the same tilemap with
    // its own first index and the layers carry one shared numbering.
    const sheets = tileset.sources.map((source) => {
      const sheet = map.addTilesetImage(
        source.textureKey,
        source.textureKey,
        TILE_SIZE,
        TILE_SIZE,
        0,
        0,
        source.firstIndex,
      );
      if (!sheet) {
        throw new Error(`Tileset '${source.textureKey}' failed to load.`);
      }
      return sheet;
    });

    // Four bands, drawn in this order: what the ground is, what stands on it,
    // what is planted on it, and the crowns a figure walks behind. Only the
    // last is above the player, which is what lets a wood have an inside.
    for (const [name, layer, depth] of [
      ['ground', layers.ground, atRow(TERRAIN_DEPTH, 0)],
      ['overlay', layers.overlay, atRow(TERRAIN_DEPTH, 1)],
      ['detail', layers.detail, atRow(TERRAIN_DEPTH, 2)],
      ['canopy', layers.canopy, CANOPY_BAND],
    ] as const) {
      this.createTileLayer(map, sheets, name, layer, depth);
    }

    this.createExtractionPoints();
    this.createRouteTransitionLabels();
    this.createGateLabels();
    this.createDropInMarkers();
  }

  /**
   * Names every boss-held gate, in the state it is in. The tiles themselves are
   * already drawn shut or open - the map was built that way - so this is only
   * the sentence: who is holding a shut one, and that an open one is open. It
   * hangs below the gate, because the boss and their watch caption stand level
   * with it and a caption above would land on top of theirs.
   */
  private createGateLabels(): void {
    if (!this.runSession) {
      return;
    }
    const spanOf = (gate: MapGate): { rect: Rect; bottom: number } => {
      const left = Math.min(...gate.tiles.map((tile) => tile.x));
      const right = Math.max(...gate.tiles.map((tile) => tile.x));
      const top = Math.min(...gate.tiles.map((tile) => tile.y));
      const bottom = Math.max(...gate.tiles.map((tile) => tile.y));
      return {
        // A gate is named as the whole door, however many tiles it spans.
        rect: {
          x: left * TILE_SIZE,
          y: top * TILE_SIZE,
          width: (right - left + 1) * TILE_SIZE,
          height: (bottom - top + 1) * TILE_SIZE,
        },
        bottom,
      };
    };
    for (const doors of gatesByKeeper(this.currentMap.gates)) {
      const [front] = doors;
      const open = isGateOpen(front, this.defeatedBosses);
      const tone = open ? LABEL_TONES.gateOpen : LABEL_TONES.gateShut;
      const boss = bossEncounters(createRunTrainerEncounters()).find(
        (candidate) => candidate.bossId === front.bossId,
      );
      const group = doors.length > 1 ? `gates:${front.bossId}` : undefined;
      for (const gate of doors) {
        const { rect, bottom } = spanOf(gate);
        this.worldLabels.push(
          new WorldLabel(this, {
            subject: rect,
            text: gateCaption(gate, open, boss?.trainer.name),
            tone,
            depth: atRow(CAPTION_BAND, bottom),
            placement: 'below',
            speech: { voice: 'name', tiles: gate.tiles },
            grouping: { group },
          }),
        );
      }
      // One keeper's doors on one screen are named in one caption: seated one
      // each, the second door lost its ground to the first and to the keeper's
      // warning, and from the road nothing said the Overlook had steps.
      if (group) {
        const { rect, bottom } = spanOf(front);
        this.worldLabels.push(
          new WorldLabel(this, {
            subject: rect,
            text: jointGateCaption(doors, open, boss?.trainer.name),
            tone,
            depth: atRow(CAPTION_BAND, bottom),
            placement: 'below',
            // Near either door: whichever the player walks up to, the sentence
            // about both is the one that is allowed to speak.
            speech: { voice: 'name', tiles: doors.flatMap((door) => door.tiles) },
            grouping: { speaksFor: group },
          }),
        );
      }
    }
  }

  /**
   * Marks every drop-in point on the map other than the one this raid started
   * on. It is drawn whether or not it has been reached, because a landing seen
   * across a fence is the reason to come back for the boss holding it.
   */
  private createDropInMarkers(): void {
    const session = this.runSession;
    if (!session) {
      return;
    }
    for (const insertion of Object.values(RUN_INSERTIONS)) {
      // A map's front door is not marked: it is where a raid on this map has
      // always started, and a caption over it would announce nothing.
      if (
        insertion.mapId !== this.currentMap.id ||
        insertion.id === session.plan?.insertion.id ||
        !isDropInPoint(insertion)
      ) {
        continue;
      }
      const x = insertion.position.x * TILE_SIZE;
      const y = insertion.position.y * TILE_SIZE;
      // A landing pad: four corner brackets, so the ground shows through and
      // the mark never reads as something to pick up.
      const pad = this.add.graphics().setDepth(atRow(MARKER_BAND, insertion.position.y));
      pad.fillStyle(DROP_IN_TINT, 1);
      for (const [cx, cy, dx, dy] of [
        [2, 2, 1, 1],
        [13, 2, -1, 1],
        [2, 13, 1, -1],
        [13, 13, -1, -1],
      ] as const) {
        pad.fillRect(x + Math.min(cx, cx + dx * 3), y + cy, 4, 1);
        pad.fillRect(x + cx, y + Math.min(cy, cy + dy * 3), 1, 4);
      }
      pad.fillRect(x + 7, y + 7, 2, 2);
      this.mapObjects.push(pad);
      const label = new WorldLabel(this, {
        subject: tileRect(insertion.position),
        text: dropInCaption(this.knownInsertionIds.has(insertion.id)),
        tone: LABEL_TONES.dropIn,
        depth: atRow(CAPTION_BAND, insertion.position.y),
        speech: { voice: 'name', tiles: [insertion.position] },
      });
      this.worldLabels.push(label);
      this.dropInLabels.set(insertion.id, label);
    }
  }

  /**
   * Standing on a drop-in point is what unlocks it, for good and at once: it is
   * somewhere the player has been, not something they are carrying, so it does
   * not wait on extraction. Returns the line to say, as a pickup does, so a
   * landing on watched ground arrives in the same dialogue as the challenge.
   */
  private tryReachDropInAt(position: GridPosition): string | null {
    const session = this.runSession;
    const insertion = session ? insertionAt(this.currentMap.id, position) : undefined;
    if (
      !insertion ||
      insertion.id === session?.plan?.insertion.id ||
      this.knownInsertionIds.has(insertion.id)
    ) {
      return null;
    }
    this.knownInsertionIds.add(insertion.id);
    if (!new SaveManager().recordReachedInsertion(insertion.id)) {
      return null;
    }
    this.dropInLabels.get(insertion.id)?.setText(dropInCaption(true), LABEL_TONES.dropIn);
    // A place reached rather than a thing picked up, so it sounds like a
    // landmark and not like loot.
    audioManager.play('landmarkWorked');
    this.cameras.main.flash(120, 94, 234, 212, false);
    return dropInReachedLine(insertion.label);
  }

  private createTileLayer(
    map: Phaser.Tilemaps.Tilemap,
    sheets: Phaser.Tilemaps.Tileset[],
    name: string,
    layer: TileLayer,
    depth: number,
  ): void {
    const created = map.createBlankLayer(name, sheets);
    if (!created) {
      throw new Error(`Tilemap layer '${name}' failed to initialize.`);
    }
    created.putTilesAt(
      layer.tiles.map((row) => [...row]),
      0,
      0,
    );
    created.setDepth(depth);
    // Tints come off the catalogue rather than off a set of tile numbers held
    // here, because the two sheets need different ones: the classic set has no
    // water art and its hedge and its tall grass are one drawing.
    created.forEachTile((tile) => {
      const tint = layer.tints[tile.y]?.[tile.x] ?? -1;
      if (tint >= 0) {
        tile.tint = tint;
      }
    });
    this.mapObjects.push(created);
  }

  private createExtractionPoints(): void {
    if (!this.runSession) {
      return;
    }

    for (const point of this.extractionPointsForCurrentMap()) {
      const isOpen = this.isExtractionOpen(point);
      const x = point.position.x * TILE_SIZE + TILE_SIZE / 2;
      const y = point.position.y * TILE_SIZE + TILE_SIZE / 2;
      const marker = this.add
        .image(x, y, extractionIconKey(isOpen))
        .setDepth(atRow(MARKER_BAND, point.position.y));
      // The beacon stands on the landing, which is the one exit the player is
      // guaranteed to be standing on when it is first drawn, so its caption is
      // seated around a marked figure instead of lying across their head and chevron.
      const label = new WorldLabel(this, {
        subject:
          point.label === BEACON_EXIT_LABEL ? landingRect(point.position) : tileRect(point.position),
        text: extractionCaption(point, isOpen, this.runSession.manager.snapshot().elapsedMs),
        tone: isOpen ? LABEL_TONES.exitOpen : LABEL_TONES.exitShut,
        depth: atRow(CAPTION_BAND, point.position.y),
        // The one caption that speaks for itself without being walked up to,
        // and only while it is open and the clock has gone red.
        speech: { voice: 'exit', tiles: [point.position], open: isOpen },
      });
      this.mapObjects.push(marker);
      this.worldLabels.push(label);
      this.extractionMarkers.push({ point, marker, label });
    }
  }


  private createEntities(): void {
    this.createLoot();
    this.createPois();
    this.createContractMarkers();

    for (const entity of this.currentMap.entities) {
      if (entity.kind === 'sign') {
        this.createSign(entity);
        continue;
      }

      this.createFigure(entity.id, entity.position, entity.facing, 'npc', entity.design);
    }

    for (const encounter of this.trainersForCurrentMap()) {
      this.createFigure(
        encounter.trainer.id,
        encounter.position,
        encounter.facing,
        'trainer',
        encounter.design,
      );
      this.createTrainerWatch(encounter);
    }

    this.createHunterSprite();
  }

  /**
   * Draws what a watching trainer costs, before the player is inside it.
   *
   * Every figure on the map is the same sprite in a different tint, so a facing
   * alone cannot say "this one will fight you and these tiles are where". The
   * watched ground is shaded and the trainer is captioned, which is the same
   * treatment the map already gives an exit or a cache - the point of all three
   * is that the player decides with the price on screen rather than after it.
   */
  private createTrainerWatch(encounter: RunTrainerEncounter): void {
    const watched = trainerSightTiles(encounter, (tile) => this.isSightBlocked(tile));
    if (watched.length === 0) {
      return;
    }

    // Outlined as one strip rather than as a row of boxes: the edge is only
    // drawn where the watch stops, so three watched tiles read as one lane the
    // trainer is looking down.
    const inWatch = new Set(watched.map((tile) => `${tile.x},${tile.y}`));
    const shading = this.add.graphics().setDepth(WATCH_SHADING_DEPTH);
    for (const tile of watched) {
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      shading.fillStyle(WATCH_TINT, WATCH_FILL_ALPHA);
      shading.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      shading.fillStyle(WATCH_TINT, WATCH_EDGE_ALPHA);
      if (!inWatch.has(`${tile.x},${tile.y - 1}`)) {
        shading.fillRect(x, y, TILE_SIZE, 1);
      }
      if (!inWatch.has(`${tile.x},${tile.y + 1}`)) {
        shading.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
      }
      if (!inWatch.has(`${tile.x - 1},${tile.y}`)) {
        shading.fillRect(x, y, 1, TILE_SIZE);
      }
      if (!inWatch.has(`${tile.x + 1},${tile.y}`)) {
        shading.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      }
    }
    this.mapObjects.push(shading);
    this.watchedGround.push(...watched.map(tileRect));

    // The caption hangs on the trainer's blind side, so it never covers the
    // shaded ground it is there to explain.
    const placement = encounter.facing === 'up' ? 'below' : 'above';
    this.worldLabels.push(
      new WorldLabel(this, {
        subject: figureRect(encounter.position),
        // The third line is the price the shading cannot show: this fight has no
        // exit, and the player has to know that before the step into the lane,
        // not from inside the battle.
        text: trainerWatchCaption(encounter.trainer.name, WATCH_BEARING[encounter.facing]),
        tone: LABEL_TONES.watch,
        depth: atRow(CAPTION_BAND, encounter.position.y),
        placement,
        // The one caption that is a price rather than a name. It is seated
        // before the gate its keeper stands at and the exit beside that, and it
        // is the one caption nobody has to walk up to: a step into the shading
        // is decided from wherever the shading can be seen.
        speech: { voice: 'warning', tiles: [encounter.position, ...watched] },
      }),
    );
  }

  /**
   * The payoff for a toll paid: a beaten trainer's watch lets go of the route.
   *
   * A beaten trainer is simply not rebuilt, so on the return from the fight the
   * red ground was just gone - the player never saw the route open. The shading
   * is redrawn here for one last moment and released tile by tile, trainer's end
   * first, which is the direction they were looking. It is played once per
   * trainer (`ActiveRunSession.watchesLifted`), on the return from the win.
   */
  private liftBeatenWatches(): void {
    const session = this.runSession;
    // The scene test doubles have no tween manager, as they have no scale one.
    if (!session || !this.tweens) {
      return;
    }
    const lifted = (session.watchesLifted ??= []);
    for (const encounter of this.trainerEncounters) {
      if (
        encounter.mapId !== this.currentMap.id ||
        !this.defeatedTrainerIds.has(encounter.trainer.id) ||
        lifted.includes(encounter.trainer.id)
      ) {
        continue;
      }
      lifted.push(encounter.trainer.id);
      const watched = trainerSightTiles(encounter, (tile) => this.isSightBlocked(tile));
      watched.forEach((tile, index) => {
        const shade = this.add
          .graphics()
          .setDepth(WATCH_SHADING_DEPTH)
          .fillStyle(WATCH_TINT, WATCH_FILL_ALPHA * 2)
          .fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.mapObjects.push(shade);
        this.tweens.add({
          targets: shade,
          alpha: 0,
          delay: WATCH_LIFT_DELAY_MS + index * WATCH_LIFT_TILE_MS,
          duration: WATCH_LIFT_FADE_MS,
          onComplete: () => shade.destroy(),
        });
      });
    }
  }

  /**
   * Every stop this contract still wants, drawn where it stands and captioned
   * with what it is. A contract can ask for three of them, so nothing here may
   * assume the single unlabelled field-kit icon the first contract shipped with.
   */
  private createContractMarkers(): void {
    const session = this.runSession;
    const contract = session?.plan?.contract;
    if (!contract || contract.mapId !== this.currentMap.id) {
      return;
    }

    for (const marker of remainingMarkers(contract, session.manager.snapshot().contractSteps)) {
      const x = marker.position.x * TILE_SIZE + TILE_SIZE / 2;
      const y = marker.position.y * TILE_SIZE + TILE_SIZE / 2;
      const image = this.add
        .image(x, y, iconTextureKey(contractMarkerIcon(marker)))
        .setDepth(atRow(MARKER_BAND, marker.position.y));
      const label = new WorldLabel(this, {
        subject: tileRect(marker.position),
        text: marker.label,
        tone: LABEL_TONES.contract,
        depth: atRow(CAPTION_BAND, marker.position.y),
        // The objective chip already names this stop and its bearing every
        // frame, so the window over it is only for arriving at.
        speech: { voice: 'name', tiles: [marker.position] },
      });
      this.worldLabels.push(label);
      this.contractMarkers.set(marker.id, { image, label });
      this.mapObjects.push(image);
    }
  }

  private createLoot(): void {
    for (const loot of getVisibleLoot(
      this.lootForCurrentMap(),
      this.isLootAvailable(),
      this.collectedLootIds,
    )) {
      const marker = this.add
        .image(
          loot.position.x * TILE_SIZE + TILE_SIZE / 2,
          loot.position.y * TILE_SIZE + TILE_SIZE / 2,
          iconTextureKey(itemIconName(loot.itemId)),
        )
        .setDepth(atRow(MARKER_BAND, loot.position.y));
      this.lootSprites.set(loot.id, marker);
      this.mapObjects.push(marker);
    }
  }

  private createPois(): void {
    if (!this.isLootAvailable()) {
      return;
    }

    for (const poi of this.currentMap.pois) {
      if (this.activatedPoiIds.has(poi.id)) {
        continue;
      }
      const x = poi.position.x * TILE_SIZE + TILE_SIZE / 2;
      const y = poi.position.y * TILE_SIZE + TILE_SIZE / 2;
      const station = this.add.container(x, y).setDepth(atRow(MARKER_BAND, poi.position.y));
      // A landmark that opens an exit and a landmark that holds supplies are
      // different objects, so they are drawn as different things rather than
      // one shared box. Every map now has one of each.
      station.add(
        this.add.image(
          0,
          0,
          iconTextureKey(
            poi.effect === 'unlock-extraction' ? WORLD_ICONS.radioMast : WORLD_ICONS.supplyCache,
          ),
        ),
      );
      const label = new WorldLabel(this, {
        subject: tileRect(poi.position),
        // Oak's Field Station is both a sealed exit and a cache, so the label
        // has to say so - the mast art can only show one of the two.
        text: `${poi.label}\n${poi.effect === 'unlock-extraction'
          ? `${poi.unlockedExtractionLabel ?? 'EXIT'}: SEALED${poi.reward.length > 0 ? ' + CACHE' : ''}`
          : `CACHE: ${formatPoiReward(poi)}`}`,
        tone: LABEL_TONES.station,
        depth: atRow(CAPTION_BAND, poi.position.y),
        speech: { voice: 'name', tiles: [poi.position] },
      });
      this.worldLabels.push(label);
      this.poiLabels.set(poi.id, label);
      this.poiSprites.set(poi.id, station);
      this.mapObjects.push(station);
    }
  }

  /** Every raid boundary names where it leads, so no route has to be guessed. */
  private createRouteTransitionLabels(): void {
    const session = this.runSession;
    if (!session) {
      return;
    }
    const contract = session.plan?.contract;

    for (const warp of this.currentMap.warps) {
      // While a first contract is running, only the areas it needs are named,
      // so a new player is never invited deeper than their objective.
      if (
        contract &&
        warp.destinationMapId !== contract.mapId &&
        warp.destinationMapId !== session.plan?.insertion.mapId
      ) {
        continue;
      }
      this.worldLabels.push(
        new WorldLabel(this, {
          // A boundary is two tiles wide and is named from between them.
          subject: { ...tileRect(warp.source), width: TILE_SIZE * 2 },
          text: `${WORLD_MAP_NAMES[warp.destinationMapId].toUpperCase()} ${this.warpArrow(warp)}`,
          tone: LABEL_TONES.route,
          depth: atRow(CAPTION_BAND, warp.source.y),
          speech: {
            voice: 'name',
            tiles: [warp.source, { x: warp.source.x + 1, y: warp.source.y }],
          },
        }),
      );
    }
  }

  private warpArrow(warp: MapWarp): string {
    if (warp.source.y === 0) return '↑';
    if (warp.source.y === this.currentMap.height - 1) return '↓';
    return warp.source.x === 0 ? '←' : '→';
  }

  private createHunterSprite(): void {
    if (!this.isHunterOnCurrentMap()) {
      return;
    }
    this.createFigure(HUNTER_FIGURE_ID, this.hunterState.position!, 'down', 'hunter');
  }

  /**
   * Every figure that is not the player is made here, so which sheet it is
   * drawn from and how its facing becomes a frame are decided once - by
   * `getWorldCharacterAppearance` - and `faceFigure` can turn it later without
   * knowing which sheet that was.
   */
  private createFigure(
    id: string,
    position: GridPosition,
    facing: Direction,
    role: WorldCharacterRole,
    design?: CharacterDesignId,
  ): void {
    const appearance = getWorldCharacterAppearance(role, design);
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE,
        position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
        appearance.textureKey,
        worldCharacterIdleFrame(appearance, facing),
      )
      .setOrigin(0, 0)
      .setTint(appearance.tint ?? NO_TINT)
      .setDepth(atRow(FIGURE_BAND, position.y));
    this.npcSprites.set(id, sprite);
    this.npcAppearances.set(id, appearance);
    this.mapObjects.push(sprite);
  }

  private faceFigure(id: string, facing: Direction): void {
    const appearance = this.npcAppearances.get(id);
    if (appearance) {
      this.npcSprites.get(id)?.setFrame(worldCharacterIdleFrame(appearance, facing));
    }
  }

  private createSign(entity: WorldEntity): void {
    // Map art rather than a figure: a signpost that outranked a caption put its
    // post through the middle of the cache list beside it.
    const sign = this.add
      .image(
        entity.position.x * TILE_SIZE + TILE_SIZE / 2,
        entity.position.y * TILE_SIZE + TILE_SIZE / 2,
        iconTextureKey(WORLD_ICONS.signPost),
      )
      .setDepth(atRow(MARKER_BAND, entity.position.y));
    this.mapObjects.push(sign);
  }

  private createPlayer(): void {
    this.player = this.add
      .sprite(0, 0, SHARED_CHARACTER_TEXTURE, getIdleFrame(this.facing))
      .setOrigin(0, 0);
    // Painted after the sprite so the ring covers the player's own feet while
    // still sorting behind anything standing in front of them.
    this.playerGroundMark = this.paintPlayerMark(PLAYER_MARKER_GROUND_LAYERS);
    this.playerHeadMark =
      this.paintPlayerMark(PLAYER_MARKER_HEAD_LAYERS).setDepth(PLAYER_MARKER_DEPTH);
    this.setPlayerPosition(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
  }

  /**
   * The marker is painted a pixel at a time so it stays as crisp as the sprite
   * art it sits against. Its layers are authored in `characterPresentation.ts`;
   * this only puts them on screen.
   */
  private paintPlayerMark(layers: readonly MarkerLayer[]): Phaser.GameObjects.Graphics {
    const mark = this.add.graphics();

    for (const layer of layers) {
      mark.fillStyle(layer.colour, layer.alpha);
      for (const rect of layer.rects) {
        mark.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    return mark;
  }

  /**
   * The one place the player moves. Both marks are positioned with the sprite
   * rather than chased in `update`, so neither can lag a step behind.
   */
  private setPlayerPosition(x: number, y: number): void {
    this.player.setPosition(x, y);
    // Sorted into the same `2 + tile y / 1000` band as every other figure, so
    // an NPC to the south is drawn in front of the player and one to the north
    // behind. A flat depth left the player behind every NPC on the map.
    const depth = atRow(FIGURE_BAND, (y - PLAYER_SPRITE_Y_OFFSET) / TILE_SIZE);
    this.player.setDepth(depth);
    this.playerGroundMark.setPosition(x, y).setDepth(depth);
    this.playerHeadMark.setPosition(x, y);
  }

  private createDialogBox(): void {
    this.dialogBox = new DialogBox(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      padding: 10,
      // The same window the raid HUD and the map captions are drawn with, so the
      // overworld has one frame rather than a rounded bubble beside them. Text
      // metrics are untouched: authored narration still wraps exactly as before.
      pixelWindow: true,
      borderColor: WINDOW_CREAM,
      backgroundColor: 0x0e1828,
      // The same face as the battle's dialogue and the map's captions. It is
      // narrower than the browser monospace it replaces at every size, so
      // authored narration wraps to the same lines or fewer, never more.
      textStyle: { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE },
      indicatorStyle: { fontFamily: GAME_FONT, fontSize: '12px' },
      onComplete: () => this.handleRunResolutionComplete(),
    }).setScrollFactor(0, 0, true);
  }

  /**
   * The screen resizes with the browser window, so anything anchored to an edge
   * has to be re-anchored rather than left where it was built. The dialogue box
   * is rebuilt because its frame is drawn at a fixed width.
   */
  private layoutForStage(): void {
    if (!this.dialogBox) {
      return;
    }
    this.dialogBox.setPosition(
      Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
    );
    this.refreshRunTimerHud();
  }

  private createRunTimerHud(): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return;
    }

    this.raidHud = new RaidHud(this);
    this.objectiveCue = '';
    this.objectiveDetailMs = OBJECTIVE_DETAIL_MS;
    this.noteDistrict(this.arrivedFromBattle);
    this.refreshRunTimerHud();
  }

  /**
   * Keeps track of the district the player is standing in, and raises its name
   * when they walk into it. Dropping into a raid is an arrival; coming back
   * from a fight is not - the scene is rebuilt after every battle, and a plate
   * naming the place the player never left would be an announcement of nothing.
   */
  private noteDistrict(silently = false): void {
    const district = districtAt(this.currentMap.id, this.currentTile);
    if (!district || district.id === this.districtId) {
      return;
    }
    this.districtId = district.id;
    this.placeName = district.name;
    this.placePlateMs = silently ? 0 : PLACE_PLATE_MS;
  }

  /**
   * Redraws the three chips from the raid's own state.
   *
   * Everything the player has to be able to answer at a glance - what am I
   * doing, how long have I got, where is the hunter - is a corner chip sized to
   * its own text. The panel this replaced was a 164x37 slab pinned over the
   * top-left of the map, which is exactly where the road ahead is.
   */
  private refreshRunTimerHud(deltaMs = 0): void {
    const hud = this.raidHud;
    const session = this.runSession;
    const manager = session?.manager;
    if (!hud || !session || !manager || manager.phase !== RunPhase.InRun) {
      return;
    }

    const snapshot = manager.snapshot();
    const navigationCue = this.contractNavigationCue(snapshot.contractSteps)
      ?? session.objectives.find((objective) => !objective.progress(snapshot).complete)?.description
      ?? openRaidCue({ items: snapshot.foundItems.length, pokemon: snapshot.caughtPokemon.length });
    if (navigationCue !== this.objectiveCue) {
      this.objectiveCue = navigationCue;
      this.objectiveDetailMs = OBJECTIVE_DETAIL_MS;
    } else {
      this.objectiveDetailMs = Math.max(0, this.objectiveDetailMs - deltaMs);
    }
    // The plate's time is reading time. A raid opens on its briefing, and a
    // plate that ran out behind that box had named the Landing to nobody.
    if (deltaMs > 0 && !this.dialogBox.visible) {
      this.placePlateMs = Math.max(0, this.placePlateMs - deltaMs);
    }
    this.noteDistrict();

    if (manager.isEnraged) {
      if (this.timerThreat !== 'enraged') {
        this.timerThreat = 'enraged';
        this.cameras.main.flash(160, 239, 68, 68, false);
        audioManager.play('clockEnraged');
      }
    } else {
      const tier = raidClockAlertTier(snapshot.remainingMs);
      if (tier !== this.timerThreat) {
        this.timerThreat = tier;
        this.cameras.main.flash(120, 251, 191, 36, false);
        audioManager.play('clockUrgent');
      }
    }

    hud.render(
      {
        clock: raidClockView(
          snapshot.remainingMs,
          manager.isEnraged,
          snapshot.enrageGraceRemainingMs,
        ),
        objectiveLines: objectiveChipLines(navigationCue, this.objectiveDetailMs > 0),
        place: placePlateLine(this.placeName, this.placePlateMs),
        hunter: hunterChipView({
          searching: isHunterSearching(this.hunterState),
          searchRemainingMs: this.hunterState.searchRemainingMs,
          distance: this.hunterStepsAway(),
          direction: this.hunterBearing(),
          // The radio mast reports on a hunter that is still coming or still
          // here. One that has been beaten is out of the raid, and a line about
          // its next team would be a warning about nothing.
          ...(hasHunterIntel(session.outfitterUpgrades) && !this.hunterState.defeated
            ? {
              intel: hunterIntelFor(
                snapshot.elapsedMs,
                snapshot.durationMs,
                manager.isEnraged,
                session.plan?.hunter,
              ),
            }
            : {}),
        }),
      },
      this.time.now,
    );
  }

  /** Steps to the hunter, or null when it is not on this map. */
  private hunterStepsAway(): number | null {
    if (!this.isHunterOnCurrentMap() || !this.hunterState.position) {
      return null;
    }
    const hunter = this.hunterState.position;
    return (
      Math.abs(hunter.x - this.currentTile.x) + Math.abs(hunter.y - this.currentTile.y)
    );
  }

  private hunterBearing(): string {
    const hunter = this.hunterState.position;
    return hunter ? directionTo(this.currentTile, hunter) : 'HERE';
  }

  private destroyRunTimerHud(): void {
    this.raidHud?.destroy();
    this.raidHud = undefined;
  }

  private bindControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    const cursors = this.input.keyboard.createCursorKeys();
    const wasdKeys = this.input.keyboard.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.P,
      Phaser.Input.Keyboard.KeyCodes.B,
      Phaser.Input.Keyboard.KeyCodes.K,
    ]);
    this.input.keyboard.on?.('keydown-M', () => audioManager.toggleMute());

    this.controls = {
      up: cursors.up,
      down: cursors.down,
      left: cursors.left,
      right: cursors.right,
      w: wasdKeys.W,
      a: wasdKeys.A,
      s: wasdKeys.S,
      d: wasdKeys.D,
      party: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      bag: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B),
      save: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      objectives: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O),
      look: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      interact: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ],
    };
    this.latchDirectionPresses();
    this.keyPresses.watch([
      ...this.directionKeys,
      ...this.controls.interact,
      this.controls.party,
      this.controls.bag,
      this.controls.save,
      this.controls.objectives,
    ]);
  }

  private configureCamera(): void {
    const worldWidth = this.currentMap.width * TILE_SIZE;
    const worldHeight = this.currentMap.height * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true);
  }

  /**
   * A direction counts if its key is down, or went down in the events this frame
   * processed - see `PressLatch` for the tap that was otherwise never seen.
   */
  private readInput(): GridInputState {
    const frame = this.currentFrame();
    const held = (key: Phaser.Input.Keyboard.Key): boolean => this.spentPresses.isFreshlyDown(key);
    const tapped = (direction: Direction): boolean =>
      this.directionPresses.wasPressedOn(direction, frame);
    return {
      up: held(this.controls.up) || held(this.controls.w) || tapped('up'),
      down: held(this.controls.down) || held(this.controls.s) || tapped('down'),
      left: held(this.controls.left) || held(this.controls.a) || tapped('left'),
      right: held(this.controls.right) || held(this.controls.d) || tapped('right'),
    };
  }

  private get directionKeys(): readonly Phaser.Input.Keyboard.Key[] {
    const { up, down, left, right, w, a, s, d } = this.controls;
    return [up, down, left, right, w, a, s, d];
  }

  private currentFrame(): number {
    return this.game.loop.frame;
  }

  private latchDirectionPresses(): void {
    const keys: Record<Direction, readonly Phaser.Input.Keyboard.Key[]> = {
      up: [this.controls.up, this.controls.w],
      down: [this.controls.down, this.controls.s],
      left: [this.controls.left, this.controls.a],
      right: [this.controls.right, this.controls.d],
    };
    for (const direction of Object.keys(keys) as Direction[]) {
      for (const key of keys[direction]) {
        key.on('down', () => this.directionPresses.press(direction, this.currentFrame()));
      }
    }
  }

  private isInteractionPressed(): boolean {
    return this.controls.interact.some((key) => this.keyPresses.justPressed(key));
  }

  /**
   * A dialogue the player opened advances on the interact keys. A challenge they did
   * not open - the hunter's capture, a trainer's line of sight - also advances on a
   * direction key: trying to walk away is what a player actually does when something
   * they did not ask for lands in front of them, and a key that does nothing reads as
   * the game having frozen on them.
   */
  private isDialogAdvancePressed(): boolean {
    if (this.isInteractionPressed()) {
      return true;
    }
    return (
      this.unsolicitedDialog &&
      this.directionKeys.some((key) => this.keyPresses.justPressed(key))
    );
  }

  private handleDialogInput(): void {
    if (!this.isDialogAdvancePressed()) {
      return;
    }

    // The press that answers a dialogue is spent on answering it: a direction
    // key still held when the box closes must not also walk a tile.
    this.spentPresses.spendHeld(this.directionKeys);

    if (this.dialogBox.isCurrentMessageComplete) {
      audioManager.play('textAdvance');
      this.dialogBox.advance();
      this.unsolicitedDialog = this.unsolicitedDialog && this.dialogBox.visible;
      if (!this.dialogBox.visible) {
        // Back to the bottom, where every line the player asks for is said.
        this.seatDialog([]);
      }
      return;
    }

    this.dialogBox.skip();
  }

  /**
   * Raises a dialogue the player did not ask for. See `unsolicitedDialog`.
   *
   * @param about Tiles of the people the line is about. The box is seated clear
   * of them by `placeDialog` - the hunter's arrival used to be announced by a
   * box drawn over the hunter.
   */
  private interrupt(lines: readonly string[], about: readonly GridPosition[] = []): void {
    this.unsolicitedDialog = true;
    this.seatDialog(about);
    this.dialogBox.showMessages([...lines]);
  }

  private seatDialog(about: readonly GridPosition[]): void {
    if (about.length === 0 && !this.dialogRaised) {
      return;
    }
    const view = this.cameras.main.worldView;
    const seat = placeDialog({
      viewHeight: this.scale.height,
      box: { x: this.dialogBox.x, width: DIALOG_WIDTH, height: DIALOG_HEIGHT },
      margin: DIALOG_MARGIN,
      about: about.map((tile) => {
        const figure = figureRect(tile);
        return { ...figure, x: figure.x - view.left, y: figure.y - view.top };
      }),
    });
    this.dialogBox.setY(seat.y);
    this.dialogRaised = seat.edge === 'top';
  }

  private tryInteract(): void {
    const targetTile = nextTileFromDirection(this.currentTile, this.facing);
    const warp = getWarpAt(this.currentMap, targetTile, 'interact');
    if (warp) {
      this.warp(warp);
      return;
    }

    const picked = this.tryCollectLootAt(targetTile);
    if (picked !== null) {
      this.dialogBox.showMessage(picked);
      return;
    }
    const worked = this.tryActivatePoiAt(targetTile);
    if (worked !== null) {
      this.dialogBox.showMessages([...worked]);
      return;
    }

    const entity = this.currentMap.entities.find(
      (candidate) => candidate.position.x === targetTile.x && candidate.position.y === targetTile.y,
    );
    const trainer = this.trainersForCurrentMap().find(
      (candidate) => candidate.position.x === targetTile.x && candidate.position.y === targetTile.y,
    );
    if (!entity && !trainer) {
      return;
    }

    if (trainer) {
      this.faceFigure(trainer.trainer.id, OPPOSITE_DIRECTION[this.facing]);
      this.askForTrainerChallenge(trainer);
      return;
    }

    if (entity?.kind === 'npc') {
      this.faceFigure(entity.id, OPPOSITE_DIRECTION[this.facing]);
    }

    const gift = entity ? giftGivenBy(entity.id) : undefined;
    if (gift) {
      this.dialogBox.showMessages([...this.speakForGift(gift, entity!.dialogLines)]);
      return;
    }

    this.dialogBox.showMessages([...entity!.dialogLines]);
  }

  /**
   * What a giver says, handing the Pokemon over the first time. It goes into the
   * raid's pack like a catch - into the party while there is room, otherwise
   * the raid's stash - and is recorded as received only when the raid banks it.
   */
  private speakForGift(gift: PokemonGift, after: readonly string[]): readonly string[] {
    const carried = this.runSession?.manager.snapshot().giftIds ?? [];
    const banked = new SaveManager().load()?.raidProgress.giftsReceived ?? [];
    if (!this.runSession || isGiftSpoken(gift, banked, carried)) {
      return after;
    }
    const pokemon = createGiftPokemon(gift);
    this.runSession.manager.registerGiftedPokemon(gift.id, pokemon);
    audioManager.play('catchSuccess');
    if (this.party.pokemon.length < PARTY_LIMIT) {
      this.party.addPokemon(pokemon);
      return gift.offer;
    }
    this.caughtPokemonStash.push(pokemon);
    return [...gift.offer.slice(0, -1), gift.offerPackLine];
  }

  private openParty(): void {
    audioManager.play('menuOpen');
    this.scene.pause();
    this.scene.launch('party', { party: this.party, bag: this.bag });
  }

  private openBag(): void {
    audioManager.play('menuOpen');
    this.scene.pause();
    this.scene.launch('bag', {
      bag: this.bag,
      party: this.party,
      onItemUsed: () => this.saveGame(),
    });
  }

  private openObjectives(): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun || this.pendingHubTransition) {
      return;
    }

    audioManager.play('menuOpen');
    this.scene.pause();
    this.scene.launch('objectives', {
      runSession: this.runSession,
      currentMapId: this.currentMap.id,
      currentPosition: this.currentTile,
      activatedPoiIds: [...this.activatedPoiIds],
      pausedWorld: true,
    });
  }

  /**
   * The corner chip's one line: the next contract stop and which way it is, or
   * - once every stop is made - the exit that actually banks the contract. A
   * contract that only banks one way must say so on the map, not only in the
   * guide, because the temptation is a gate the player is walking past.
   */
  private contractNavigationCue(contractSteps: readonly string[]): string | undefined {
    const contract = this.runSession?.plan?.contract;
    if (!contract) {
      return undefined;
    }
    if (this.currentMap.id !== contract.mapId) {
      return `TRAVEL TO ${WORLD_MAP_NAMES[contract.mapId].toUpperCase()}`;
    }
    const outstanding = remainingMarkers(contract, contractSteps);
    if (outstanding.length === 0) {
      return contract.requiredExitLabel
        ? `BANK VIA ${contract.requiredExitLabel}`
        : undefined;
    }
    // Straight-line distance, not a path search: the chip names the stop the
    // player is closest to so it changes as they move, and running that search
    // every frame would buy nothing a bearing does not already say.
    const next = outstanding.reduce((closest, marker) =>
      manhattan(this.currentTile, marker.position) < manhattan(this.currentTile, closest.position)
        ? marker
        : closest,
    );
    const remaining = outstanding.length > 1 ? ` (${outstanding.length} LEFT)` : '';
    return `${next.cue}: ${directionTo(this.currentTile, next.position)}${remaining}`;
  }

  private showFirstDeploymentBriefing(): void {
    const session = this.runSession;
    const contract = session?.plan?.contract;
    if (!contract || session.firstDeploymentBriefingShown) {
      return;
    }
    session.firstDeploymentBriefingShown = true;
    this.openingBriefingOpen = true;
    // A contract that needs supplies out of the pack says so before the first
    // step, because arriving at the drop without them wastes the whole raid.
    const missing = missingCarryIn(contractCarryIn(contract), (itemId) => this.bag.count(itemId));
    this.dialogBox.showMessage(
      missing.length === 0
        ? contract.deploymentBriefing
        : `You are still short ${formatStacks(missing)} for this contract's drop. It will refuse you.`,
    );
  }

  /**
   * What stops a trainer seeing further. Terrain only: a figure standing in the
   * lane is not cover, because a rule the player cannot see is not a rule they
   * can play around, and the shaded ground has to stay true whoever is on it.
   */
  private isSightBlocked(tile: GridPosition): boolean {
    return this.collisionData[tile.y]?.[tile.x] !== false;
  }

  /**
   * The price of walking a watched route. The player turns to face whoever
   * caught them and the fight starts from the intro lines, which is the same
   * path as speaking to a trainer - what differs is who started it.
   */
  private tryTrainerChallengeAt(tile: GridPosition, lead: readonly string[] = []): boolean {
    const watcher = findWatchingTrainer(this.trainersForCurrentMap(), tile, (candidate) =>
      this.isSightBlocked(candidate),
    );
    if (!watcher) {
      return false;
    }

    this.facing = OPPOSITE_DIRECTION[watcher.facing];
    this.showIdlePose();
    audioManager.play('trainerSpotted');
    this.pendingTrainerBattle = {
      trainer: watcher.trainer,
      introLines: watcher.introLines,
      isHunter: false,
    };
    const lines = [...lead, ...watcher.introLines];
    const approach = planTrainerApproach(
      watcher.position,
      watcher.facing,
      tile,
      watcher.sightRange ?? 0,
    );
    if (approach) {
      this.beginTrainerApproach(watcher, approach, lines);
    } else {
      this.interrupt(lines, [watcher.position]);
    }
    return true;
  }

  /**
   * The mark goes up over the trainer, and `advanceTrainerApproach` takes it
   * from there. The player has already been turned to face them.
   */
  private beginTrainerApproach(
    watcher: RunTrainerEncounter,
    plan: TrainerApproach,
    lines: readonly string[],
  ): void {
    const mark = this.add.graphics().setDepth(atRow(CANOPY_BAND, watcher.position.y) + 0.1);
    this.mapObjects.push(mark);
    this.trainerApproach = { trainerId: watcher.trainer.id, plan, lines, mark, elapsedMs: 0 };
    this.paintSpottedMark(mark);
    this.placeSpottedMark(mark, watcher.position.x, watcher.position.y, 0);
  }

  private advanceTrainerApproach(deltaMs: number): void {
    const approach = this.trainerApproach;
    if (!approach) {
      return;
    }
    approach.elapsedMs += deltaMs;
    const frame = approachFrameAt(approach.plan, approach.elapsedMs);
    const sprite = this.npcSprites.get(approach.trainerId);
    sprite?.setPosition(frame.x * TILE_SIZE, frame.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);
    sprite?.setDepth(atRow(FIGURE_BAND, frame.y));

    if (frame.phase === 'alert') {
      this.placeSpottedMark(approach.mark, frame.x, frame.y, approach.elapsedMs);
      return;
    }
    approach.mark.setVisible(false);
    if (frame.phase !== 'done') {
      return;
    }
    this.trainerApproach = undefined;
    approach.mark.destroy();
    this.interrupt(approach.lines, [{ x: Math.round(frame.x), y: Math.round(frame.y) }]);
  }

  /** Drawn a pixel at a time, like the player's own marks, so it stays as crisp as the art. */
  private paintSpottedMark(mark: Phaser.GameObjects.Graphics): void {
    const box = (color: number, x: number, y: number, w: number, h: number) =>
      mark.fillStyle(color, 1).fillRect(x, y, w, h);
    box(SPOTTED_INK, 0, 0, 11, 13);
    box(SPOTTED_CREAM, 1, 1, 9, 11);
    box(SPOTTED_INK, 4, 13, 3, 1);
    box(SPOTTED_CREAM, 5, 13, 1, 1);
    box(SPOTTED_INK, 5, 14, 1, 1);
    box(SPOTTED_MARK, 4, 2, 3, 5);
    box(SPOTTED_MARK, 4, 8, 3, 2);
  }

  /** Over the trainer's head; it pops up three pixels high and settles. */
  private placeSpottedMark(
    mark: Phaser.GameObjects.Graphics,
    tileX: number,
    tileY: number,
    elapsedMs: number,
  ): void {
    const pop = elapsedMs < 90 ? 3 : 0;
    mark.setPosition(
      tileX * TILE_SIZE + TILE_SIZE / 2 - 5,
      tileY * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET - 14 - pop,
    );
  }

  /**
   * The interact key at a trainer opens a question, not a fight.
   *
   * Speaking to an authored trainer used to commit the player silently: two
   * lines of flavour and then a battle with no exit, discovered from inside it.
   * The commitment is kept - see `../world/trainerEngagement` for why a trainer
   * that could be declined mid-fight would make every route it prices free -
   * and what is added is the sentence before it.
   */
  private askForTrainerChallenge(encounter: RunTrainerEncounter): void {
    const prompt = trainerChallengePrompt(encounter.trainer.name);
    this.trainerPrompt = new ChoicePrompt(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      padding: 10,
      lines: prompt.lines,
      options: prompt.options,
      selected: prompt.selected,
      onChoose: (index) => this.resolveTrainerChallenge(encounter, index === 0),
    });
  }

  private resolveTrainerChallenge(encounter: RunTrainerEncounter, accepted: boolean): void {
    this.trainerPrompt?.destroy();
    this.trainerPrompt = undefined;
    if (!accepted) {
      audioManager.play('cancel');
      // Raised as an interruption, so the player who just chose to walk away
      // can walk away on the next key rather than having to read a box first.
      this.interrupt([trainerDeclinedMessage(encounter.trainer.name)]);
      return;
    }

    audioManager.play('trainerSpotted');
    this.pendingTrainerBattle = {
      trainer: encounter.trainer,
      introLines: encounter.introLines,
      isHunter: false,
    };
    this.dialogBox.showMessages([...encounter.introLines]);
  }

  private handleTrainerPromptInput(): void {
    const prompt = this.trainerPrompt;
    if (!prompt) {
      return;
    }
    if (
      this.keyPresses.justPressed(this.controls.left) ||
      this.keyPresses.justPressed(this.controls.a) ||
      this.keyPresses.justPressed(this.controls.up) ||
      this.keyPresses.justPressed(this.controls.w)
    ) {
      prompt.moveSelection(-1);
      audioManager.play('select');
      return;
    }
    if (
      this.keyPresses.justPressed(this.controls.right) ||
      this.keyPresses.justPressed(this.controls.d) ||
      this.keyPresses.justPressed(this.controls.down) ||
      this.keyPresses.justPressed(this.controls.s)
    ) {
      prompt.moveSelection(1);
      audioManager.play('select');
      return;
    }
    if (this.isInteractionPressed()) {
      prompt.confirm();
    }
  }

  private isBlocked(tile: GridPosition): boolean {
    return (
      this.collisionData[tile.y][tile.x] ||
      this.currentMap.entities.some(
        (entity) => entity.position.x === tile.x && entity.position.y === tile.y,
      ) ||
      this.trainersForCurrentMap().some(
        (trainer) => trainer.position.x === tile.x && trainer.position.y === tile.y,
      ) ||
      (this.isHunterOnCurrentMap() &&
        this.hunterState.position!.x === tile.x &&
        this.hunterState.position!.y === tile.y)
    );
  }

  private beginStep(targetTile: GridPosition): void {
    this.targetTile = targetTile;
    this.stepProgress = 0;

    this.stepStart.set(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
    this.stepEnd.set(targetTile.x * TILE_SIZE, targetTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);

    this.player.play(getWalkAnimationKey(this.facing), true);
  }

  /**
   * The one footstep the raid has: stepping *into* tall grass rustles, because
   * that is the step that puts a risk under your feet. A sound under every step
   * - even every step of grass, which on the Floodplain is most of them - is the
   * kind of thing the captain turned the music off to be rid of. Anything the
   * step goes on to find - loot, a wild Pokemon, a door - takes the same
   * channel and is heard instead.
   */
  private soundFootstep(from: GridPosition): void {
    if (
      entersTallGrass(
        isTallGrassInMap(this.currentMap, from),
        isTallGrassInMap(this.currentMap, this.currentTile),
      )
    ) {
      audioManager.play('grassRustle');
    }
  }

  private advanceStep(deltaMs: number): void {
    const tick = advanceStepClock(this.stepProgress, deltaMs);
    this.stepProgress = tick.progress;

    this.setPlayerPosition(
      Phaser.Math.Linear(this.stepStart.x, this.stepEnd.x, this.stepProgress),
      Phaser.Math.Linear(this.stepStart.y, this.stepEnd.y, this.stepProgress),
    );

    if (this.stepProgress < 1 || !this.targetTile) {
      return;
    }

    this.stepCarryMs = tick.overflowMs;
    const steppedFrom = this.currentTile;
    this.currentTile = { ...this.targetTile };
    this.targetTile = null;
    if (this.runSession) {
      this.runSession.stepsTaken = (this.runSession.stepsTaken ?? 0) + 1;
    }
    this.setPlayerPosition(this.stepEnd.x, this.stepEnd.y);
    this.showIdlePose();
    this.saveGame();
    this.soundFootstep(steppedFrom);

    const warp = getWarpAt(this.currentMap, this.currentTile, 'step');
    if (warp) {
      this.warp(warp);
      return;
    }

    // Taking something off a watched tile is still being seen taking it: the
    // pickup lands, and the challenge follows it in the same dialogue. Without
    // this the collection returned early and the road could be walked free by
    // whichever tile a generated cache happened to land on.
    //
    // Standing on a landmark works it too, as well as facing it from beside it.
    // Movement has no free turn onto walkable ground, so a landmark whose only
    // approach lane is a dead end could never be faced at all: the Sluice Wheel
    // sits between a hedge and the leat, and the West Culvert it opens had
    // therefore never been openable. Reaching a landmark is the cost of it, not
    // standing on the correct side of it - and it is on the same footing as a
    // pickup here, so a watched landmark cannot be worked for free either.
    const pickup =
      this.tryCollectLootAt(this.currentTile) ??
      this.tryMakeContractStopAt(this.currentTile) ??
      this.tryReachDropInAt(this.currentTile);
    const spoken = pickup === null ? this.tryActivatePoiAt(this.currentTile) : [pickup];
    if (spoken !== null && spoken.length > 0) {
      if (!this.tryTrainerChallengeAt(this.currentTile, spoken)) {
        this.dialogBox.showMessages([...spoken]);
      }
      return;
    }

    if (this.tryStartHunterBattle()) {
      return;
    }
    this.advanceHunterPursuit();
    if (this.tryStartHunterBattle()) {
      return;
    }

    // Extraction is a deliberate destination, so it beats a random roll. Several
    // authored exits stand in tall grass, and rolling first used to resolve the
    // raid and then start a wild battle in the same tick: the scene the result
    // screen was scheduled on was torn down for the battle, so the raid banked
    // but the player came back to a dead world with no way out of it.
    if (this.tryExtract()) {
      return;
    }

    // A trainer who saw you coming is authored content and beats a dice roll,
    // so the challenge is resolved before the tall grass is.
    if (this.tryTrainerChallengeAt(this.currentTile)) {
      return;
    }

    const encounters = this.encountersAtCurrentTile();
    if (isTallGrassInMap(this.currentMap, this.currentTile) && encounters) {
      const rng = this.runSession?.rng;
      // The authored teaching fight replaces the first roll of a first-contract
      // raid, so a new player's opening battle is winnable and explicable.
      const teaching = consumeTeachingEncounter(this.runSession);
      // The fight repeats while the contract is open; the lesson does not. A
      // player who lost their first raid met the same Pidgey with the same
      // three lines explaining a screen they had just spent a raid reading.
      const teachingBattle = teaching !== null && new SaveManager().claimBattleLesson();
      const wild =
        teaching ?? rollEncounter(encounters, rng === undefined ? undefined : () => rng.next());
      if (wild) {
        audioManager.play('encounter');
        this.transitionToBattle({ wild, teachingBattle });
      }
    }
  }

  private showIdlePose(): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }

  private warp(warp: MapWarp): void {
    audioManager.play('warp');
    this.isWarping = true;
    this.player.stop();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.clearMap();
      this.currentMap = this.mapFor(warp.destinationMapId);
      this.runSession?.manager.setMap(this.currentMap.id);
      this.currentTile = { ...warp.destination };
      this.facing = warp.facing;
      this.targetTile = null;
      this.createMap();
      this.moveHunterToCurrentMap();
      this.createEntities();
      this.setPlayerPosition(
        this.currentTile.x * TILE_SIZE,
        this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
      );
      this.showIdlePose();
      this.configureCamera();
      this.saveGame();
      this.cameras.main.fadeIn(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isWarping = false;
      });
    });
  }

  /**
   * Starts a fight. The caller names only the fight; what the raid carries
   * through it is packed here, once, for every kind of battle - a payload
   * written out per call site is how a wild fight came to forget the hunter.
   */
  private transitionToBattle(encounter: BattleEncounter): void {
    const data: BattleSceneData = { ...this.raidCarriage(), ...encounter };
    this.isWarping = true;
    this.player.stop();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('battle', data);
    });
  }

  /** The raid state that exists only on this scene - see `RaidCarriage`. */
  private raidCarriage(): RaidCarriage {
    return {
      party: this.party,
      // The raid's own supplies go into the fight with the party. A battle
      // that had to reach for the persisted bag instead would be spending an
      // inventory this raid never deployed with.
      bag: this.bag,
      caughtPokemonStash: this.caughtPokemonStash,
      runSession: this.runSession,
      defeatedTrainerIds: [...this.defeatedTrainerIds],
      collectedLootIds: [...this.collectedLootIds],
      activatedPoiIds: [...this.activatedPoiIds],
      hunterState: this.hunterState,
      returnLocation: this.returnLocation(),
    };
  }

  private clearMap(): void {
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    this.worldLabels.forEach((label) => label.destroy());
    this.worldLabels = [];
    this.watchedGround = [];
    this.npcSprites.clear();
    this.npcAppearances.clear();
    this.lootSprites.clear();
    this.poiSprites.clear();
    this.poiLabels.clear();
    this.contractMarkers.clear();
    this.dropInLabels.clear();
    this.extractionMarkers = [];
  }

  private removeWorldLabel(label: WorldLabel | undefined): void {
    if (!label) {
      return;
    }
    label.destroy();
    this.worldLabels = this.worldLabels.filter((candidate) => candidate !== label);
  }

  /**
   * Asks every caption whether it speaks this frame, and seats the ones that do.
   *
   * Two rules, in two files. `captionReveal.ts` decides whether a caption is on
   * the screen at all - almost none of them are, almost all of the time - and
   * `labelPlacement.ts` seats what is left, against the view's edges, the raid
   * HUD's chips, the map art, the canopy, the player and each other. Both are
   * asked again every frame because the player, the view and the chips all move.
   */
  private containWorldLabels(): void {
    if (this.worldLabels.length === 0) {
      return;
    }
    const looking = isLooking(this.lookMs, this.controls.look.isDown);
    const audience = {
      player: this.currentTile,
      looking,
      raidRemainingMs: this.runSession?.manager.snapshot().remainingMs ?? Number.POSITIVE_INFINITY,
    };
    this.worldLabels.forEach((label) => label.describe(audience));
    const view = this.cameras.main.worldView;
    const bounds: Rect = {
      x: view.left,
      y: view.top,
      width: view.width,
      height: view.height,
    };
    // The HUD is pinned to the screen and the captions live in the world, so
    // the chips are translated into world space before they are avoided.
    const furniture = (this.raidHud?.occupied ?? []).map((chip) => ({
      x: chip.x + view.left,
      y: chip.y + view.top,
      width: chip.width,
      height: chip.height,
    }));
    const placements = placeCaptions(
      this.worldLabels.map((label) => label.request()),
      {
        bounds,
        furniture,
        keepClear: this.captionKeepClear(),
        canopy: this.canopyInView(bounds),
        player: this.captionPlayer(),
      },
    );
    this.worldLabels.forEach((label, index) => label.seat(placements[index]));
  }

  /**
   * The canopy a caption could end up under: every crown and walk-under span in
   * the camera's view, as one rectangle per unbroken run along a row. A wooded
   * map has hundreds of crowns and this is asked every frame, so it is worked
   * out again only when the view crosses onto a different tile.
   */
  private canopyInView(view: Rect): readonly Rect[] {
    const canopy = this.currentMap.layers.canopy.tiles;
    const left = Math.max(0, Math.floor(view.x / TILE_SIZE));
    const top = Math.max(0, Math.floor(view.y / TILE_SIZE));
    const right = Math.min(this.currentMap.width - 1, Math.floor((view.x + view.width) / TILE_SIZE));
    const bottom = Math.min(this.currentMap.height - 1, Math.floor((view.y + view.height) / TILE_SIZE));
    const key = `${this.currentMap.id}|${this.defeatedBosses.join('+')}|${left},${top},${right},${bottom}`;
    if (this.canopyInViewCache?.key === key) {
      return this.canopyInViewCache.runs;
    }
    const runs: Rect[] = [];
    for (let y = top; y <= bottom; y += 1) {
      let start = -1;
      for (let x = left; x <= right + 1; x += 1) {
        const covered = x <= right && (canopy[y]?.[x] ?? -1) >= 0;
        if (covered && start < 0) {
          start = x;
        } else if (!covered && start >= 0) {
          runs.push({
            x: start * TILE_SIZE,
            y: y * TILE_SIZE,
            width: (x - start) * TILE_SIZE,
            height: TILE_SIZE,
          });
          start = -1;
        }
      }
    }
    this.canopyInViewCache = { key, runs };
    return runs;
  }

  /**
   * What stands on this map that a caption may not cover, beyond the things the
   * captions themselves name: signs, crates, the ground a trainer watches, and
   * everyone standing still. The hunter is left out on purpose: it walks, a
   * caption that dodged it would chase around the screen, and `depths.ts`
   * already draws every figure over every caption. The player walks too, and is
   * `captionPlayer()`'s business rather than this list's, because a caption
   * gives the player room only while it has somewhere else to sit.
   */
  private captionKeepClear(): Rect[] {
    const signs = this.currentMap.entities
      .filter((entity) => entity.kind === 'sign')
      .map((entity) => tileRect(entity.position));
    const crates = [...this.lootSprites.values()].map((crate) => ({
      x: crate.x - TILE_SIZE / 2,
      y: crate.y - TILE_SIZE / 2,
      width: TILE_SIZE,
      height: TILE_SIZE,
    }));
    const standing = [...this.npcSprites.entries()]
      .filter(([id]) => id !== HUNTER_FIGURE_ID)
      .map(([, sprite]) => ({
        x: sprite.x,
        y: sprite.y + CHARACTER_HEAD_PIXEL_Y,
        width: TILE_SIZE,
        height: FIGURE_HEIGHT,
      }));
    return [...signs, ...crates, ...standing, ...this.watchedGround];
  }

  /**
   * Where the player is, as captions see them: the figure and its chevron on
   * the tile they stand on, and on the tile they are stepping to. Whole tiles
   * rather than the sprite's own position, so the answer changes when a step
   * begins and not on every frame of it - a caption in the way moves once, as
   * the player sets off towards it, instead of sliding along ahead of them.
   */
  private captionPlayer(): Rect[] {
    return [this.currentTile, ...(this.targetTile ? [this.targetTile] : [])].map(landingRect);
  }

  private isLootAvailable(): boolean {
    return this.runSession?.manager.phase === RunPhase.InRun;
  }

  /**
   * Collects what is on a tile and returns what to say about it, or null if
   * there was nothing. The caller shows the line, because a step can also be
   * the step a trainer challenges on, and then both facts have to be said in
   * one dialogue rather than one of them overwriting the other.
   */
  private tryCollectLootAt(position: GridPosition): string | null {
    const loot = this.lootForCurrentMap().find(
      (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
    );
    const result = tryCollectLoot(
      loot,
      this.isLootAvailable(),
      this.collectedLootIds,
      (itemId, quantity) => this.collectRunItem(itemId, quantity),
    );
    if (result === 'unavailable') {
      return null;
    }
    if (result === 'bag-full') {
      audioManager.play('denied');
      // The Tarkov moment, and the whole point of a pack with squares in it:
      // the thing is still on the ground, so the choice is what comes out to
      // make room for it. It names both so the choice can be made from here.
      const wanted = ITEMS[loot!.itemId];
      const footprint = footprintOf(loot!.itemId);
      const squares = footprint.width * footprint.height;
      return `No room for ${wanted.displayName.toUpperCase()} - it needs ${squares} ${squares === 1 ? 'square' : 'squares'}. Drop something from the BAG and come back for it.`;
    }

    const marker = this.lootSprites.get(loot!.id);
    this.cameras.main.flash(100, 250, 204, 21, false);
    audioManager.play('lootPickup');
    marker?.destroy();
    this.lootSprites.delete(loot!.id);
    const item = ITEMS[loot!.itemId];
    const quantity = loot!.quantity > 1 ? ` x${loot!.quantity}` : '';
    return `Found ${item.displayName}${quantity}!`;
  }

  /**
   * Works a landmark and returns what to say about it, or null if there was
   * nothing to work. Lines rather than a boolean for the same reason
   * `tryCollectLootAt` does it: a landmark can stand on ground a trainer is
   * watching, and then both facts belong in one dialogue.
   */
  private tryActivatePoiAt(position: GridPosition): readonly string[] | null {
    const poi = this.currentMap.pois.find(
      (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
    );
    const result = tryActivatePoi(
      poi,
      this.isLootAvailable(),
      this.activatedPoiIds,
      (itemId, quantity) => this.collectRunItem(itemId, quantity),
    );
    if (result === 'unavailable') {
      return null;
    }
    if (result === 'bag-full') {
      audioManager.play('denied');
      return ['Bag is full. The marked cache remains sealed.'];
    }

    this.poiSprites.get(poi!.id)?.destroy();
    this.poiSprites.delete(poi!.id);
    this.removeWorldLabel(this.poiLabels.get(poi!.id));
    this.poiLabels.delete(poi!.id);
    this.cameras.main.flash(140, 56, 189, 248, false);
    // A cache pays out; a landmark is worked. They are different deeds on the
    // map and the field guide, so they are different sounds.
    audioManager.play(poi!.effect === 'unlock-extraction' ? 'landmarkWorked' : 'cacheOpen');
    const reward = poi!.reward
      .map(({ itemId, quantity }) => `${quantity}× ${ITEMS[itemId].displayName}`)
      .join(' + ');
    if (poi!.effect === 'unlock-extraction') {
      const exit = poi!.unlockedExtractionLabel ?? 'A NEW EXIT';
      this.refreshExtractionMarkers();
      return [
        `${poi!.label}: ${exit} is open.`,
        this.rangerForecast(),
        ...(reward ? [`${reward} secured. Extract to bank it.`] : []),
      ];
    }
    return [`${poi!.label}: ${reward} secured. Detour reward is LOST ON WIPE - extract to bank it.`];
  }

  private restoreSavedGame(savedGame: RestoredGame | undefined): void {
    if (!savedGame) {
      return;
    }

    this.party = savedGame.party;
    this.bag = savedGame.bag;
    this.currentMap = this.mapFor(savedGame.mapId);
    this.currentTile = { ...savedGame.position };
  }

  private saveGame(): void {
    if (this.runSession) {
      return;
    }
    const saveManager = new SaveManager();
    const existingGame = saveManager.load();
    saveManager.save({
      party: this.party,
      mapId: this.currentMap.id,
      position: this.currentTile,
      bag: this.bag,
      stash: existingGame?.stash,
      // A free-roam save only owns the party, position and bag. Everything else
      // has to be carried through verbatim or it is silently reset: contract
      // progress, the chosen starter, and recovery time already booked.
      raidProgress: existingGame?.raidProgress,
      starterSpeciesId: existingGame?.starterSpeciesId,
      pendingRecoveryMs: existingGame?.pendingRecoveryMs,
    });
  }

  /**
   * Makes a contract stop by standing on it, and - as `tryCollectLootAt` -
   * returns what to say about it so the caller can merge that line with a
   * trainer challenge on the same tile rather than one silencing the other.
   *
   * A drop that asks for supplies takes them out of the bag here, and refuses
   * the stop when they are not there: the warden's resupply is a delivery, so
   * arriving without the Potions has to be a readable "not yet" rather than a
   * silent nothing. It still returns a line, because the player did stop for it
   * and an encounter roll on the same tick would bury the message.
   */
  private tryMakeContractStopAt(position: GridPosition): string | null {
    const session = this.runSession;
    const contract = session?.plan?.contract;
    if (!contract || contract.mapId !== this.currentMap.id) {
      return null;
    }

    const steps = session.manager.snapshot().contractSteps;
    const marker = contract.markers.find(
      (candidate) =>
        !steps.includes(candidate.id) &&
        candidate.position.x === position.x &&
        candidate.position.y === position.y,
    );
    if (!marker) {
      return null;
    }

    const carriedIn = marker.carriedIn ?? [];
    if (missingCarryIn(carriedIn, (itemId) => this.bag.count(itemId)).length > 0) {
      audioManager.play('denied');
      return marker.shortMessage ?? 'You are not carrying what this drop needs.';
    }
    for (const { itemId, quantity } of carriedIn) {
      this.bag.remove(itemId, quantity);
    }

    session.manager.registerContractStep(marker.id);
    const drawn = this.contractMarkers.get(marker.id);
    drawn?.image.destroy();
    this.removeWorldLabel(drawn?.label);
    this.contractMarkers.delete(marker.id);
    this.cameras.main.flash(120, 96, 165, 250, false);
    audioManager.play('contractStop');
    this.refreshRunTimerHud();
    this.saveGame();
    return marker.collectedMessage;
  }

  private returnLocation(): RaidLocation {
    return createBattleReturnLocation({
      mapId: this.currentMap.id,
      position: { ...this.currentTile },
      facing: this.facing,
    });
  }

  private extractionPointsForCurrentMap(): readonly ExtractionPoint[] {
    return (this.runSession?.plan?.extractionPoints ?? EXTRACTION_POINTS).filter(
      (point) => point.mapId === this.currentMap.id,
    );
  }

  private trainersForCurrentMap(): readonly RunTrainerEncounter[] {
    return this.trainerEncounters.filter(
      (trainer) =>
        trainer.mapId === this.currentMap.id && !this.defeatedTrainerIds.has(trainer.trainer.id),
    );
  }

  private lootForCurrentMap() {
    return this.runSession?.plan?.loot[this.currentMap.id] ?? this.currentMap.loot;
  }

  /** The wildlife of the place being stood in, then of the map it is on. */
  private encountersAtCurrentTile() {
    return encounterTableAt(
      this.currentMap.id,
      this.currentTile,
      this.runSession?.plan?.encounters[this.currentMap.id] ?? this.currentMap.encounters,
      this.runSession?.plan?.districtEncounters,
    );
  }

  private isExtractionOpen(point: ExtractionPoint): boolean {
    return isExtractionAvailable(
      point,
      this.runSession?.manager.snapshot().elapsedMs ?? 0,
      this.activatedPoiIds,
    );
  }

  private rangerForecast(): string {
    const elapsedMs = this.runSession?.manager.snapshot().elapsedMs ?? 0;
    const spawnDelayMs = this.runSession?.plan?.hunter.spawnDelayMs ?? HUNTER_SPAWN_MS;
    if (this.hunterState.spawned && !this.hunterState.defeated) {
      return 'HUNTER FORECAST: active in this area. Break its line of sight and keep moving.';
    }
    const seconds = Math.max(0, Math.ceil((spawnDelayMs - elapsedMs) / 1_000));
    return `HUNTER FORECAST: trail enters this area in about ${seconds}s. Waiting for a timed exit may cost you.`;
  }

  /** The exit the player is standing on, if this raid offers one there. */
  private exitUnderPlayer(): ExtractionPoint | undefined {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return undefined;
    }
    return this.extractionPointsForCurrentMap().find(
      (candidate) =>
        candidate.position.x === this.currentTile.x && candidate.position.y === this.currentTile.y,
    );
  }

  /**
   * @returns Whether this step ended the raid, or was spent on a locked exit,
   *   so the caller stops rather than rolling anything else into the same tick.
   */
  private tryExtract(): boolean {
    const point = this.exitUnderPlayer();
    if (!point || !this.runSession) {
      return false;
    }

    if (!this.isExtractionOpen(point)) {
      audioManager.play('denied');
      this.dialogBox.showMessage(
        `${point.label} is LOCKED: ${extractionRequirementText(point, this.runSession.manager.snapshot().elapsedMs)}.`,
      );
      return true;
    }

    this.extractThrough(point);
    return true;
  }

  /**
   * An exit that opens under the player takes them, exactly as stepping onto it
   * open would have. Waiting on a timed exit is the natural thing to do - its
   * locked line counts the seconds down - and extraction used to be asked only
   * when a step finished, so a raid was lost to the clock by someone standing on
   * the Ferry Dock under a green EXTRACT OPEN. It is the rule for every exit
   * rather than a timer's special case: the Outfitter's beacon opens on the
   * insertion tile, and a battle can hand the raid back on one. `update()` asks
   * only while the player is at rest with nothing on screen to read, so the
   * locked line is never talked over.
   *
   * @returns Whether the raid ended.
   */
  private tryExtractWhereStanding(): boolean {
    const point = this.exitUnderPlayer();
    if (!point || !this.isExtractionOpen(point)) {
      return false;
    }
    this.extractThrough(point);
    return true;
  }

  private extractThrough(point: ExtractionPoint): void {
    if (!this.runSession) {
      return;
    }
    this.runSession.manager.resolveEscape();
    this.destroyRunTimerHud();
    this.cameras.main.flash(240, 134, 239, 172, false);
    this.cameras.main.shake(120, 0.004);
    audioManager.play('extract');
    const snapshot = this.runSession.manager.snapshot();
    const contract = this.runSession.plan?.contract;
    // Whether this exit banks the contract, not merely whether its stops were
    // made: the cordon ledger is finished by leaving the right way, so walking
    // out of the South Gate with it in hand completes nothing.
    const banksContract = contract !== undefined && isContractBankable(contract, snapshot, point.label);
    // Contract rewards are granted by the save, once and permanently, rather
    // than as a repeatable per-run objective item.
    const objectiveRewards = contract
      ? []
      : completedObjectiveRewards(this.runSession.objectives, snapshot);
    // Loot found in the field is already in the bag, so it comes home through
    // the settlement's supply delta. Only rewards granted at base are banked
    // separately, or the same antidote would arrive twice.
    const runResult = {
      pokemon: snapshot.caughtPokemon,
      items: objectiveRewards,
      gifts: snapshot.giftIds,
    };
    // What the raid itself cost, settled the same way whichever ending fires.
    const settlement = buildRaidSettlement(
      this.runSession.broughtPokemonIds,
      snapshot,
      this.bag.toJSON(),
    );
    const contractResult = banksContract
      ? new SaveManager().bankContract(contract, runResult, settlement)
      : { saved: new SaveManager().bankRun(runResult, settlement), granted: false };
    this.pendingHubTransition = true;
    this.showRunResult(
      buildExtractionReport({
        outcome: 'ESCAPED',
        snapshot,
        durationMs: snapshot.durationMs,
        exitLabel: point.label,
        // The contract's payout is granted by the save rather than by the run,
        // so the report is handed exactly what the stash received. Field loot
        // arrives as the settlement's own positive delta rather than as the
        // pickups the run recorded: a Potion found and then drunk left the
        // stash no better off, and listing it as banked beside the line that
        // says it was spent is the screen disagreeing with itself.
        banked: {
          // A standing contract can pay in Pokemon, and those arrive at base
          // beside the ones the raid caught.
          pokemon: [
            ...runResult.pokemon,
            ...(contractResult.granted ? rewardPokemon(contract!.reward) : []),
          ],
          items: [
            ...settlement.supplies.filter(({ quantity }) => quantity > 0),
            ...objectiveRewards,
            ...(contractResult.granted ? contract!.reward.items : []),
          ],
        },
        ...(contract
          ? {
            contract: {
              description: contract.description,
              complete: banksContract,
              reward: contractReportLine(contract, {
                banked: banksContract,
                granted: contractResult.granted,
                stopsComplete: areContractStopsComplete(contract, snapshot.contractSteps),
                exitLabel: point.label,
                progressAfter: this.progressAfterRaid(),
              }),
            },
          }
          : {}),
        carriedOut: this.bag.toJSON(),
        saved: contractResult.saved,
      }),
    );
  }

  /**
   * What the next board will be dealt from: the save as this raid left it, and
   * where nothing can be saved, the bosses this raid is already acting on.
   */
  private progressAfterRaid(): StandingBoardProgress {
    return (
      new SaveManager().load()?.raidProgress ?? {
        ...DEFAULT_RAID_PROGRESS,
        defeatedBosses: this.defeatedBosses,
      }
    );
  }

  /**
   * Hands a finished raid to the result screen. The world is left standing for a
   * beat first, which is the only reason this is delayed: the extraction flash
   * and the wipe shake have to land on the map they happened on.
   */
  private showRunResult(report: ExtractionReport): void {
    // The clock can expire while a sign is still on screen. Retiring the dialogue
    // here stops its next advance from completing into the old hub hand-off and
    // skipping the result the raid just earned.
    this.pendingResultScreen = true;
    this.dialogBox.setVisible(false);
    this.time.delayedCall(RUN_RESULT_DELAY_MS, () => {
      if (this.scene.manager.keys.extraction) {
        this.scene.start('extraction', { report });
        return;
      }
      this.scene.start(this.scene.manager.keys.hub ? 'hub' : 'title');
    });
  }

  private advanceRunClock(deltaMs: number): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return;
    }

    // A battle is free of the raid clock, and the challenge that announces one is
    // the battle's first beat rather than the world's last. Billing the player for
    // reading "FOUND YOU." is billing them for being caught twice: the hunter's
    // capture is not a dialogue they chose to open, they cannot walk out of it, and
    // watching the clock drain behind it is the only thing the box lets them do.
    //
    // The deployment briefing is free for a plainer reason. Dialogue costs time
    // because opening it is a choice; this box is raised by the raid itself on
    // its first frame, to teach the controls, and the chip read 4:58 before it
    // had finished typing. The raid starts when the player can first act in it.
    this.openingBriefingOpen = this.openingBriefingOpen && this.dialogBox.visible;
    const clockMs = this.pendingTrainerBattle || this.openingBriefingOpen ? 0 : deltaMs;
    const snapshot = this.runSession.manager.tick(clockMs);
    this.advanceHunterSearch(clockMs);
    this.placeHunterIfDue(snapshot.elapsedMs);
    this.refreshExtractionMarkers();
    this.refreshRunTimerHud(deltaMs);
    if (snapshot.isEnraged && this.runSession.manager.isEnrageGraceExpired) {
      this.resolveExpiredRun();
    }
  }

  private refreshExtractionMarkers(): void {
    for (const { point, marker, label } of this.extractionMarkers) {
      const isOpen = this.isExtractionOpen(point);
      marker.setTexture(extractionIconKey(isOpen));
      label.setText(
        extractionCaption(point, isOpen, this.runSession?.manager.snapshot().elapsedMs ?? 0),
        isOpen ? LABEL_TONES.exitOpen : LABEL_TONES.exitShut,
      );
      // An exit that has just opened is now a way out rather than a locked
      // sign, which is what lets it call for itself in the last of the raid.
      label.setOpen(isOpen);
    }
  }

  private resolveExpiredRun(): void {
    if (!this.runSession || this.pendingHubTransition) {
      return;
    }

    const result = this.runSession.manager.resolveWipe(this.runSession.secureSlot);
    const snapshot = this.runSession.manager.snapshot();
    this.destroyRunTimerHud();
    this.cameras.main.flash(220, 239, 68, 68, false);
    this.cameras.main.shake(180, 0.009);
    audioManager.play('clockExpired');
    const carriedOut = this.bag.toJSON();
    // The pack the clock ran out on is what divides the loss: only a secured
    // supply still in it comes home, and only what is still in it was lost with
    // the raid. Anything missing from it was spent, and is reported as spent.
    const wipe = buildWipeSettlement(this.runSession.secureSlot.items ?? [], carriedOut);
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      { ...this.runSession.stashSecureSlot, items: wipe.securedItems },
      // A secured Pokemon comes home in the state the raid left it in.
      deployedRaidCondition(this.runSession.broughtPokemonIds, snapshot),
    );
    this.pendingHubTransition = true;
    this.showRunResult(
      buildExtractionReport({
        outcome: 'WIPED',
        cause: 'timer',
        snapshot,
        durationMs: snapshot.durationMs,
        lost: { pokemon: result.lostPokemon, items: wipe.destroyedItems },
        carriedOut,
        saved,
      }),
    );
  }

  private handleRunResolutionComplete(): void {
    if (this.pendingResultScreen) {
      return;
    }

    if (this.pendingTrainerBattle) {
      const battle = this.pendingTrainerBattle;
      this.pendingTrainerBattle = undefined;
      this.transitionToBattle({ trainer: battle.trainer, hunterBattle: battle.isHunter });
      return;
    }

    if (!this.pendingHubTransition) {
      return;
    }

    if (this.scene.manager.keys.hub) {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('hub');
      });
      return;
    }
    this.scene.start('title');
  }

  /**
   * Brings the hunter into the raid, and re-places one that arrived somewhere unfair.
   *
   * Both cases retry every tick rather than settle for a bad tile: the spawn search
   * only comes up empty in a pocket too small to hold a fair arrival, and the player
   * walking out of that pocket is what fixes it.
   */
  private placeHunterIfDue(elapsedMs: number): void {
    if (
      !this.runSession ||
      this.runSession.manager.phase !== RunPhase.InRun ||
      this.hunterState.defeated
    ) {
      return;
    }
    const awaitingSpawn =
      !this.hunterState.spawned &&
      this.isHunterEligible() &&
      hasPlayerSetOff(this.runSession.stepsTaken) &&
      elapsedMs >= (this.runSession.plan?.hunter.spawnDelayMs ?? HUNTER_SPAWN_MS);
    const awaitingPlacement =
      this.hunterState.spawned &&
      this.hunterState.mapId === this.currentMap.id &&
      !this.hunterState.position;
    if (!awaitingSpawn && !awaitingPlacement) {
      return;
    }
    const position = this.findHunterSpawnTile();
    if (!position) {
      return;
    }
    this.hunterState = {
      ...this.hunterState,
      spawned: true,
      defeated: false,
      mapId: this.currentMap.id,
      position,
    };
    this.createHunterSprite();
    if (awaitingSpawn) {
      audioManager.play('hunterArrival');
      this.interrupt(['A RIVAL HUNTER is on your trail!'], [position]);
    }
  }

  private isHunterEligible(): boolean {
    return isHunterEligibleForFirstContract(
      this.currentMap.id,
      this.runSession?.plan?.contract?.mapId,
      this.activatedPoiIds.size > 0,
    );
  }

  private findHunterSpawnTile(): GridPosition | null {
    const rng = this.runSession?.rng;
    return findHunterSpawnTile(
      this.currentTile,
      this.bounds,
      (tile) => this.isBlockedForHunter(tile),
      // Wrapped rather than passed by reference so the RNG keeps its own `this`.
      rng ? (candidates) => rng.pick(candidates) : undefined,
    );
  }

  /**
   * Re-places the hunter after a warp. Must run once the destination map's collision
   * is loaded, or the spawn search reads the map the player just left.
   */
  private moveHunterToCurrentMap(): void {
    if (!this.hunterState.spawned || this.hunterState.defeated) {
      return;
    }
    this.hunterState = {
      ...this.hunterState,
      mapId: this.currentMap.id,
      position: this.findHunterSpawnTile() ?? undefined,
    };
  }

  private isHunterOnCurrentMap(): boolean {
    return (
      this.runSession?.manager.phase === RunPhase.InRun &&
      this.hunterState.spawned &&
      !this.hunterState.defeated &&
      this.hunterState.mapId === this.currentMap.id &&
      this.hunterState.position !== undefined
    );
  }

  private advanceHunterPursuit(): void {
    if (!this.isHunterOnCurrentMap() || !this.hunterState.position) {
      return;
    }
    // A hunter that lost the trail holds where the player slipped away from it.
    if (isHunterSearching(this.hunterState)) {
      return;
    }
    const aggression = this.runSession?.plan?.hunter.aggressionStepsPerPlayerStep
      ?? DEFAULT_HUNTER_TUNING.aggressionStepsPerPlayerStep;
    const steps = this.runSession?.manager.isEnraged
      ? Math.max(aggression, HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP)
      : aggression;
    let position = this.hunterState.position;
    // The player holds still for the whole tick, so one search covers every step it takes.
    const path = findHunterPursuitPath(position, this.currentTile, this.bounds, (tile) =>
      this.isBlockedForHunter(tile),
    );
    for (let index = 0; index < steps && index < path.length; index += 1) {
      position = path[index];
      if (isHunterContactingPlayer(position, this.currentTile)) {
        break;
      }
    }
    this.hunterState = { ...this.hunterState, position };
    const moved = Math.min(steps, path.length);
    const proximity = nextHunterProximity(
      this.hunterNear,
      path.length === 0 ? null : path.length - moved,
    );
    this.hunterNear = proximity.near;
    // Contact has its own sting on this same tick; the warning is for the
    // steps before it.
    if (proximity.warn && !isHunterContactingPlayer(position, this.currentTile)) {
      audioManager.play('hunterNear');
    }
    const sprite = this.npcSprites.get(HUNTER_FIGURE_ID);
    sprite
      ?.setPosition(position.x * TILE_SIZE, position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET)
      .setDepth(atRow(FIGURE_BAND, position.y));
  }

  /**
   * Moves a hunter the player just escaped from onto its fallback tile.
   *
   * BattleScene marks the escape but cannot choose the tile: only the rebuilt world
   * knows the map's collision. Running before createEntities() means the sprite is
   * built where the hunter now stands, never where the battle left it.
   */
  private applyPendingHunterBreakaway(): void {
    if (!this.hunterState.pendingBreakaway || !this.hunterState.position) {
      return;
    }
    if (this.hunterState.mapId !== this.currentMap.id) {
      this.hunterState = { ...this.hunterState, pendingBreakaway: false };
      return;
    }
    this.hunterState = applyHunterBreakaway(
      this.hunterState,
      findHunterBreakawayTile(
        this.hunterState.position,
        this.currentTile,
        this.bounds,
        (tile) => this.isBlockedForHunter(tile),
        HUNTER_BREAKAWAY_DISTANCE,
        // The way the player was walking when they were caught is the only read the
        // world has on where they are going, and it is enough to keep the hunter from
        // falling back onto the ground they are about to cross.
        this.facing,
      ),
    );
  }

  private advanceHunterSearch(deltaMs: number): void {
    if (!isHunterSearching(this.hunterState)) {
      return;
    }
    this.hunterState = tickHunterSearch(this.hunterState, deltaMs);
    if (isHunterSearching(this.hunterState)) {
      return;
    }
    // The same flash-and-warning language the raid timer uses for a threat change,
    // rather than a dialogue box that would freeze the player exactly as pursuit resumes.
    this.cameras.main.flash(120, 251, 191, 36, false);
    audioManager.play('hunterResume');
  }

  private isBlockedForHunter(tile: GridPosition): boolean {
    return (
      this.collisionData[tile.y][tile.x] ||
      this.currentMap.entities.some(
        (entity) => entity.position.x === tile.x && entity.position.y === tile.y,
      ) ||
      this.trainersForCurrentMap().some(
        (trainer) => trainer.position.x === tile.x && trainer.position.y === tile.y,
      )
    );
  }

  private tryStartHunterBattle(): boolean {
    if (
      !this.isHunterOnCurrentMap() ||
      !this.hunterState.position ||
      isHunterSearching(this.hunterState) ||
      !isHunterContactingPlayer(this.hunterState.position, this.currentTile)
    ) {
      return false;
    }
    this.pendingTrainerBattle = {
      trainer: createHunterTrainer(
        this.runSession!.manager.snapshot().elapsedMs,
        this.runSession!.manager.isEnraged,
        this.runSession!.plan?.hunter,
      ),
      introLines: ['FOUND YOU.', 'There is nowhere left to run!'],
      isHunter: true,
    };
    audioManager.play('hunterContact');
    this.interrupt(this.pendingTrainerBattle.introLines, [this.hunterState.position]);
    return true;
  }
}

/**
 * An exit is one object in two states, so the open and the locked pad are the
 * same silhouette in two colours rather than two different marks.
 */
function extractionIconKey(isOpen: boolean): string {
  return iconTextureKey(isOpen ? WORLD_ICONS.extractionOpen : WORLD_ICONS.extractionLocked);
}

/**
 * What the result screen says about the contract, including the case the whole
 * cordon ledger exists for: every stop made and the wrong gate taken.
 */

function manhattan(from: GridPosition, to: GridPosition): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function contractMarkerIcon(marker: ContractMarker): string {
  return marker.icon === 'supply-cache' ? WORLD_ICONS.supplyCache : WORLD_ICONS.fieldKit;
}

function directionTo(from: GridPosition, to: GridPosition): string {
  return compassBearing(from, to) ?? 'HERE';
}

function formatPoiReward(poi: { readonly reward: readonly { readonly itemId: ItemId; readonly quantity: number }[] }): string {
  return poi.reward
    .map(({ itemId, quantity }) => `${quantity}× ${ITEMS[itemId].displayName.toUpperCase()}`)
    .join(' + ');
}
