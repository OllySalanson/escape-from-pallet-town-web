import Phaser from 'phaser';
import { feedbackTabOverGame } from '../feedback/feedbackTabCover';
import { homeAfterRaid } from '../maker/tryIt';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail } from '../feedback/feedbackContext';
import {
  nextTileFromDirection,
  planNextGridStep,
  type Direction,
  type GridBounds,
  type GridInputState,
  type GridPosition,
} from '../movement/gridMovement';
import { KeyPresses } from '../input/KeyPresses';
import { RAID_KEY_LETTERS, ROOM_KEY_LETTERS, roomKeyHintLine, type LearnableKeyId } from '../input/keyBindings';
import { PressLatch } from '../input/pressLatch';
import { STEP_DURATION_MS, advanceStepClock } from '../movement/stepClock';
import { hunterComes, isPlaytestRun, PLAYTEST_RUN_DIVISOR } from '../dev/playtestMode';
import {
  BICYCLE_ITEM_ID,
  BIKE_HEAD_DROP,
  BIKE_ORIGIN_X,
  BIKE_SHEET_COLUMNS,
  BIKE_TEXTURE,
  stepDurationFor,
  stillRiding,
  toggleBike,
  type RidePlace,
  type RideState,
} from '../world/bicycle';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_HEAD_PIXEL_Y,
  getIdleFrame,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import type { CharacterDesignId } from '../world/characterDesigns';
import {
  getWorldCharacterAppearance,
  headMarkCoversSomebody,
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
  POKEMON_ICON_FRAME_MS,
  POKEMON_ICON_TEXTURE,
  pokemonIconFrames,
  pokemonSoleDrop,
  type FigureSpeciesId,
} from '../world/pokemonFigures';
import {
  BERRY_TREE_SWAY_MS,
  BERRY_TREE_TEXTURE,
  berryItemId,
  berryName,
  berryTreeFrames,
  berryTreeLines,
  type BerryId,
} from '../world/berries';
import {
  boardingPrompt,
  boatAt,
  boatAwayLines,
  boatCaption,
  castOffLine,
  playerLinks,
  sailingState,
  shoreLeftBehind,
  voyage,
  type MapSailing,
} from '../world/sailing';
import { carriedOn, spinsOn } from '../world/slidingFloor';
import { MAP_FILE_EXIT_KEY } from '../world/mapFile';
import {
  DEAD_LIFT_LINES,
  floorPrompt,
  LIFT_RUNNING_LINES,
  liftAt,
  liftRuns,
  type MapLift,
} from '../world/lifts';
import { HIDEOUT_SHEET_SOURCE } from '../world/tileset/hideoutSheet';
import { HIDEOUT_PIECES } from '../world/generated/hideoutPieces';
import { boulderDestination, canStillReach } from '../world/boulders';
import {
  barriersOpenedBy,
  isBarrierOpen,
  LEVER_LINES,
  SEATED_BOULDER_LINES,
  switchAt,
  switchesOn,
  type WorldSwitch,
} from '../world/switches';
import { AREA_SHEET_SOURCE } from '../world/tileset/areaSheet';
import { AREA_PIECES } from '../world/generated/areaPieces';
import { TOWN_PIECES } from '../world/generated/townPieces';
import { TOWN_SHEET_SOURCE } from '../world/tileset/townSheet';
import {
  getWarpAt,
  getWorldMap,
  isTallGrassInMap,
  TILE_SIZE,
  
  type MapWarp,
  type TileLayer,
  type WorldMapDefinition,
  type WorldMapId,
  worldMapName,
} from '../worldMap';
import { spokenLines, type WorldEntity } from '../world/npcs';
import {
  advanceIdleFigures,
  createIdleFigures,
  idleFrames,
  idleHeldTiles,
  type IdleFigure,
} from '../world/npcIdle';
import {
  LEDGE_HOP_DURATION_MS,
  LEDGE_HOP_RISE,
  ledgeCaption,
  ledgeHopAt,
  ledgeHopTiles,
  ledgesForMap,
} from '../world/ledges';
import { PARTY_LIMIT, Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { createGiftPokemon, giftGivenBy, giftNicknamePrompt, isGiftSpoken, type PokemonGift } from '../world/gifts';
import { DialogBox } from '../ui/DialogBox';
import { flashScreen } from '../ui/screenFlash';
import { WORLD_ICONS, iconTextureKey, itemIconName } from '../ui/icons';
import { rollEncounter, type WildEncounter } from '../world/wildEncounters';
import { caughtLegends, legendCaught } from '../world/legends';
import {
  NOT_EVEN_A_NIBBLE,
  ON_THE_HOOK,
  bestRod,
  castDurationMs,
  dotsShown,
  fishingTable,
  fishingWaterAt,
  isFishingWater,
  planCast,
  type CastPlan,
  type RodItemId,
} from '../world/fishing';
import { rollShiny } from '../pokemon/shiny';
import { encounterTableAt, stepRolls } from '../world/localEncounters';
import { hasPlayerSetOff } from '../world/hunterArrival';
import { SpentPresses } from '../world/spentPresses';
import { consumeTeachingEncounter } from '../world/teachingEncounter';
import { audioManager } from '../audio/AudioManager';
import { SOUND_EFFECTS, soundEffectLength } from '../audio/soundEffects';
import { getSpeciesById } from '../pokemon/species';
import {
  entersTallGrass,
  HUNTER_NEAR_STEPS,
  nextBump,
  nextHunterProximity,
} from '../audio/worldSounds';
import { DEFAULT_RAID_PROGRESS, SaveManager, type RestoredGame } from '../save/SaveManager';
import { Bag, ITEMS, formatMoney, getItemById, isCurrency, itemAmountsFor, type ItemId } from '../items';
import {
  areContractStopsComplete,
  completedObjectiveRewards,
  contractCarryIn,
  contractReportLine,
  contractStopMessage,
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
import { clearPackRoomForPokemon, packFullForPokemonLine, syncPackCargo } from '../run/raidCargo';
import {
  buildRaidSettlement,
  buildWipeSettlement,
  deployedRaidCondition,
} from '../run/raidSettlement';
import { BASE_STAGE_WIDTH } from '../display/stage';
import { RaidHud } from '../ui/RaidHud';
import { WorldLabel, type WorldLabelSpec, type WorldLabelTone } from '../ui/WorldLabel';
import { ChoicePrompt } from '../ui/ChoicePrompt';
import { PRESS_ARROWS } from '../ui/pressArrows';
import { openNamingScreen } from '../ui/NamingScreenOverlay';
import { placeCaptions, placeDialog, type CaptionPlacement, type Rect } from '../ui/labelPlacement';
import { arrivalPlace } from '../base/partner';
import { PartnerFigure, type PartnerHost } from '../base/partnerFigure';
import { raidFollower, sameFollower, type RaidFollower } from '../world/raidFollower';
import { advanceLookMs, isLooking } from '../ui/captionReveal';
import { GAME_FONT } from '../ui/gameFont';
import { DIALOG_FONT_SIZE } from '../ui/screenType';
import { PausePlate } from '../ui/PausePlate';
import { WINDOW_PAUSE_LINES, WINDOW_PAUSE_TITLE, type PausesForWindow } from '../world/windowPause';
import {
  CAPTION_BAND,
  FIGURE_BAND,
  MARKER_BAND,
  CANOPY_BAND,
  ROOF_BAND,
  INTERIOR_DIM_DEPTH,
  TERRAIN_DEPTH,
  WATCH_SHADING_DEPTH,
  AREA_DARK_DEPTH,
  RAID_NAME_PLATE_DEPTH,
  atRow,
} from '../world/depths';
import { hiddenInArea, placedAreaAt, type PlacedArea } from '../world/mapAreas';
import { friendRoom } from '../raidRoom/friendRoom';
import { hunterKeeper, nearestQuarry, type SharedHunter } from '../raidRoom/groupHunter';
import { ROOM_PHRASES, TALK_LIST_OPEN_MS } from '../raidRoom/roomTalk';
import { roomOpenedDoors } from '../raidRoom/roomBosses';
import { HarbourFigures } from '../base/harbourFigures';
import { nearestOpenExit, walkingStepsFrom } from '../world/nearestExit';
import { wayTowards } from '../world/areaRoutes';
import { districtAt, weatherAt } from '../world/districts';
import { stepDirection } from '../world/npcIdle';
import { brimRuns, type MapLayers } from '../world/tiles';
import {
  INTERIOR_COVER_MS,
  interiorAt,
  isInsideRect,
  type MapInterior,
} from '../world/interiors';
import type { WeatherId } from '../pokemon/battle/weather';
import { SURVEY_RADIUS, tilesAround } from '../world/minimap';
import { WINDOW_CREAM } from '../ui/pixelWindow';
import {
  OBJECTIVE_DETAIL_MS,
  PLACE_PLATE_MS,
  openRaidCue,
  hunterChipView,
  objectiveChipLines,
  placePlateLine,
  weatherChipLine,
  prizeChipView,
  friendChipLines,
  friendChipPing,
  placeApart,
  type PrizeChipInput,
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
  fieldMoveGateAt,
  gateCaption,
  gateKey,
  gatesByKeeper,
  gatesForMap,
  gatesOpenedLines,
  isGateOpen,
  jointGateCaption,
  NIGHT_TRACK_LINES,
  nightDoors,
  nightGateAt,
  openedDoors,
  WORLD_GATES,
  type MapGate,
} from '../world/gates';
import {
  fieldMoveLines,
  fieldMoveOpenedLine,
  fieldMoveUser,
} from '../world/fieldMoves';
import { dropInCaption, dropInReachedLine } from '../world/dropIns';
import { insertionAt, insertionsOn, isDropInPoint } from '../run/runGeneration';
import { planTrainerApproach } from '../world/trainerApproach';
import {
  CutscenePlayer,
  PLAYER_ACTOR,
  type Cutscene,
  type CutsceneActorFrame,
} from '../cutscene/cutscene';
import { bearingFrom, hunterCatchCutscene, trainerApproachCutscene } from '../world/cutscenes';
import { findWatchingTrainer, trainerSightTiles } from '../world/trainerSight';
import {
  trainerChallengePrompt,
  trainerDeclinedMessage,
  trainerWatchCaption,
} from '../world/trainerEngagement';
import { hasHunterIntel } from '../hub/workshop';
import { anyoneFitToRaid } from '../hub/recovery';
import { errandForItem } from '../hub/errands';
import { BEACON_EXIT_LABEL } from '../run/runGeneration';
import {
  getVisibleLoot,
  isPrize,
  lootRefusalLine,
  prizesLeftBehind,
  tryCollectLoot,
  type WorldLoot,
} from '../world/loot';
import { cachePayoutLine, cacheRefusalLine, lockedCrateLines, tryActivatePoi } from '../world/pois';
import {
  isLandmarkWorked,
  withWorkedExitsOpen,
  workedLandmarkCaption,
} from '../world/workedLandmarks';
import {
  extractionPointsOn,
  extractionCaption,
  extractionRequirementText,
  isBarredExit,
  isDugExit,
  itemThatOpens,
  isExtractionAvailable,
  type ExtractionPoint,
} from '../world/extractionPoints';
import {
  findHunterPursuitPath,
  findHunterBreakawayTile,
  findHunterSpawnTile,
  HUNTER_SPAWN_DISTANCE,
  HUNTER_BREAKAWAY_DISTANCE,
  applyHunterBreakaway,
  isHunterSearching,
  isHunterOffTheScent,
  hunterQuarry,
  tickHunterSearch,
  createHunterState,
  createHunterTrainer,
  hunterAtEnrage,
  hunterIdleSteps,
  DEFAULT_HUNTER_TUNING,
  HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP,
  HUNTER_SPAWN_MS,
  isHunterEligibleForFirstContract,
  isHunterContactingPlayer,
  type HunterState,
  hunterIntelFor,
} from '../world/hunter';
import { FIRST_HUNTER_RIVAL, hunterRival, type HunterRival } from '../world/hunters';
import { hunterForecastLine } from '../world/hunterForecast';

const CAMERA_ZOOM = 1;
/** The dark a doorway is gone through in, each way: FireRed's own door is about this quick. */
const DOOR_FADE_MS = 180;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;

/**
 * A fishing float, centred on its own origin: red over white in the shared
 * outline, sitting on two flecks of ripple - or, taken under by a bite, only
 * its red tip showing in a wider ring of them.
 */
function paintFloat(float: Phaser.GameObjects.Graphics, sunk: boolean): Phaser.GameObjects.Graphics {
  const ripple = 0xa8d0f0;
  if (sunk) {
    float.fillStyle(0x241f2e, 1).fillRect(-2, 0, 4, 3);
    float.fillStyle(0xe04848, 1).fillRect(-1, 1, 2, 2);
    return float.fillStyle(ripple, 1).fillRect(-6, 3, 3, 1).fillRect(3, 3, 3, 1).fillRect(-4, 5, 8, 1);
  }
  float.fillStyle(0x241f2e, 1).fillRect(-3, -4, 6, 7);
  float.fillStyle(0xe04848, 1).fillRect(-2, -3, 4, 3);
  float.fillStyle(0xf8f8f0, 1).fillRect(-2, 0, 4, 2);
  return float.fillStyle(ripple, 1).fillRect(-5, 3, 2, 1).fillRect(3, 3, 2, 1);
}
/** Hair to soles, inclusive: the part of a figure's frame that is drawn on. */
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;
const HUNTER_FIGURE_ID = 'rival-hunter';

/** This raid's part in a room's one hunter (`WorldScene.huntRole`). */
type HuntRole = 'solo' | 'keeper' | 'follower';

/** How often a room's keeper says the hunter again when nothing about it has changed. */
const HUNTER_RESAY_MS = 3_000;

/**
 * A line the world says unasked, and whether it is FireRed's obtained-an-item
 * beat: put up to its jingle (`itemObtained`), with the prompt held back until
 * the jingle has played, as FireRed's text waits out its fanfare - so a key
 * pressed through the lines before it is not also pressed past it.
 */
type WorldLine = string | { readonly text: string; readonly obtained: true };

/** How long an obtained line is held before a key moves it on: its jingle, and never under a second. */
const OBTAINED_HOLD_MS = Math.max(1_000, Math.ceil(soundEffectLength(SOUND_EFFECTS.itemObtained) * 1000));

/** The colour of a ping's mark: the prize gleam's warm gold would read as loot, so a clear sky blue. */
const PING_COLOUR = 0x5ec8f2;

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

/**
 * A rare find's tile and the light standing over it, so a caption is seated
 * clear of the gleam rather than through the middle of it - the same rule the
 * player's own chevron gets from `landingRect` below.
 */
const prizeRect = (tile: GridPosition): Rect => {
  const rect = tileRect(tile);
  return { ...rect, y: rect.y - PRIZE_GLEAM_REACH, height: rect.height + PRIZE_GLEAM_REACH };
};

/** A tile the player is expected to be standing on: the figure, and the chevron over it. */
const landingRect = (tile: GridPosition): Rect => {
  const figure = figureRect(tile);
  return { ...figure, y: figure.y - CHEVRON_HEIGHT, height: figure.height + CHEVRON_HEIGHT };
};

/**
 * The light a rare find is drawn under: gold, the same gold as its caption and
 * its HUD chip, so the three read as one thing. The reach is two tiles across
 * and the pulse is slow enough to be noticed from the edge of the screen
 * without being the thing the eye is stuck on.
 */
const PRIZE_GLEAM_COLOUR = 0xfacc15;
const PRIZE_GLEAM_REACH = 8;
const PRIZE_GLEAM_PULSE_MS = 900;

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
    | 'boat'
    | 'route'
    | 'watch'
    | 'contract'
    | 'gateShut'
    | 'gateOpen'
    | 'worked'
    | 'dropIn'
    | 'interior'
    | 'ledge'
    | 'prize',
    WorldLabelTone
  >
> = {
  station: { fill: 0x14243a, border: 0x7fb2e5, ink: '#dff0ff' },
  // A landmark this save finished with for good. It is the station's own blue
  // gone quiet, the way an open gate is an iron one gone quiet: still a place,
  // no longer something to act on.
  worked: { fill: 0x16222c, border: 0x6f97b4, ink: '#c6dced' },
  // Contract stops are the one thing on the map the raid was taken for, so they
  // are the only violet on it and cannot be mistaken for a cache or a gate.
  contract: { fill: 0x281a3d, border: 0xc4b5fd, ink: '#ede9fe' },
  exitOpen: { fill: 0x123d22, border: 0x86efac, ink: '#dcfce7' },
  exitShut: { fill: 0x3d1414, border: 0xfca5a5, ink: '#fecaca' },
  // A boat is the sea's way across, the one place on a map that is water you
  // can go over: open-water blue while it sails, iron while it does not.
  boat: { fill: 0x0c2a4a, border: 0x7dd3fc, ink: '#e0f2fe' },
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
  // A mouth is a way into the hill: the ledge's stone gone darker, because what
  // is behind it is the one ground on the map with no sky over it.
  interior: { fill: 0x141a24, border: 0xa9b6c6, ink: '#e8eef6' },
  // A rare find. The same gold as its chip and its gleam, and the brightest
  // frame on the map, because this is the one caption meant to be read from
  // the other side of a clearing rather than walked up to.
  prize: { fill: 0x3d2c05, border: 0xfacc15, ink: '#fffbe6' },
  // A ledge is the ground itself, so it is stone: not an exit's green or red,
  // not a threat, not a place a raid is sent to.
  ledge: { fill: 0x1c2733, border: 0x9fb3c8, ink: '#e2e8f0' },
};

/** The landing pad drawn on a drop-in point, as filled pixel rects. */
const DROP_IN_TINT = 0x5eead4;

/**
 * The chevrons painted on a ledge's brow, in the ledge caption's own stone.
 *
 * A caption cannot be relied on to teach this one: a name speaks only once the
 * player has walked up to the thing, which on a brow is the tile they are
 * standing on, and in a wood there is often no sky for it to sit in. Map art
 * has neither problem - the drop-in point's landing pad is the same answer to
 * the same question - and a mark on the ground is what a player reads as
 * "something happens here" without being told.
 */
const LEDGE_MARK_TINT = 0xd6e4f0;
const LEDGE_MARK_SHADE = 0x1c2733;

/** How the ground a trainer is watching is shaded. */
const WATCH_TINT = 0xf87171;
const WATCH_FILL_ALPHA = 0.16;
const WATCH_EDGE_ALPHA = 0.42;
/**
 * A pale red over a sand road is a change of hue with almost no change of
 * light, so for red-green and colour-blind players the watch was not there at
 * all (playtest 40, finding 1). The shading therefore also carries a shape:
 * diagonal hatching and a border in dark ink, which read in any vision. The
 * hatch runs across tile joins (it is laid on map pixels, not per tile), so a
 * watched lane is one striped strip.
 */
const WATCH_INK = 0x171717;
const WATCH_HATCH_ALPHA = 0.34;
const WATCH_INK_EDGE_ALPHA = 0.6;
const WATCH_HATCH_SPACING = 6;
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
  /** A raid room's phrase list, the six phrase keys, and the ping (`raidRoom/roomTalk.ts`). */
  talk: Phaser.Input.Keyboard.Key;
  phrases: readonly Phaser.Input.Keyboard.Key[];
  ping: Phaser.Input.Keyboard.Key;
  /**
   * Held, it walks an explorer run three times faster. It does nothing at all
   * in an ordinary raid: the raid clock is spent on walking, so a run key would
   * be a difficulty setting rather than a convenience (`dev/playtestMode.ts`).
   */
  run: Phaser.Input.Keyboard.Key;
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

export class WorldScene extends Phaser.Scene implements PausesForWindow {
  private bounds: GridBounds = { width: 0, height: 0 };
  /** The dark round the place the player is in, on a map made of several (`frameArea`). */
  private areaDark: Phaser.GameObjects.Rectangle[] = [];
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
  /** The townsfolk keeping a beat on this map, and where each of them stands now. */
  private idleFigures: IdleFigure[] = [];
  /**
   * What this step costs in game time. A walked tile is `STEP_DURATION_MS`; a
   * ledge hop covers three tiles and takes longer than one of them, which is
   * what makes it read as a jump and still be the quick way.
   */
  private stepDurationMs = STEP_DURATION_MS;
  /** True while the step in progress is a ledge hop, so the figure arcs over it. */
  private hopping = false;
  /**
   * The spin the player is in on the Rocket Hideout's arrows, if they are in
   * one: the way it is carrying them, and how far round the figure has turned.
   */
  private spin: { readonly heading: Direction; readonly turn: number } | null = null;
  /** The caption on every lift door on the map, and the lift it is. */
  private liftLabels: { readonly lift: MapLift; readonly label: WorldLabel }[] = [];
  /**
   * Whether the player is on the Bicycle (`world/bicycle.ts`). Mirrored onto
   * the run session, which is what carries it through a fight; asked again on
   * every rebuild, every door and every change to the pack (`settleRiding`).
   */
  private riding = false;
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
  /** The boats moored at this map's jetties, each drawn while it sails (`sailing.ts`). */
  private boats: Array<{
    readonly sailing: MapSailing;
    readonly end: 0 | 1;
    readonly sprite: Phaser.GameObjects.Image;
    readonly label: WorldLabel;
  }> = [];
  /**
   * The jetty a push out to sea has already been told the boat is away on,
   * until the player steps off it: told once a visit, and a bump after that,
   * so a held key does not put the same lines up again and again.
   */
  private boatAwayToldAt: GridPosition | null = null;
  /** A boat the player has said yes to, casting off once its line is read. */
  private pendingVoyage: { readonly sailing: MapSailing; readonly from: 0 | 1 } | undefined;
  /** The boat the player is aboard, and how far along its course it is. */
  private voyaging:
    | {
        readonly sailing: MapSailing;
        readonly from: 0 | 1;
        readonly tiles: readonly GridPosition[];
        index: number;
        progress: number;
        readonly boat: Phaser.GameObjects.Image;
        /** The shore the player was across the water from before casting off, if any. */
        readonly shoreBefore: GridPosition | undefined;
      }
    | undefined;
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

  /**
   * The lid over each interior, kept by id so a step in or out lifts exactly
   * one, and rebuilt with the rest of the map - so nothing here survives a
   * raid. The veil that darkens a floor is not kept: it never changes, and
   * while the lid is down the lid is over it.
   */
  private roofLayers = new Map<string, Phaser.Tilemaps.TilemapLayer[]>();

  /** The interior the player is standing in, or null out in the open. */
  private currentInterior: MapInterior | null = null;
  /** Ground a trainer is watching: shaded to be read, so no caption may sit on it. */
  private watchedGround: Rect[] = [];
  private raidHud: RaidHud | undefined;
  /** The plate the raid stands under while the window is not in use (`world/windowPause.ts`). */
  private windowPausePlate: PausePlate | null = null;
  /** The cue the objective chip is currently showing, so a change can be noticed. */
  private objectiveCue = '';
  /** The nearest open exit the chip names, and what it was asked for (`nearestExitCue`). */
  private exitCue: { readonly label: string; readonly heading: string } | undefined;
  private exitCueKey = '';
  /** The collision the cue was walked over: a door opened mid-raid rebuilds it. */
  private exitCueGrid: readonly (readonly boolean[])[] | undefined;
  /** Counts down the window in which a changed objective shows its extra line. */
  private objectiveDetailMs = 0;
  /** The district the player is standing in, and how long its arrival plate has left. */
  private districtId: string | null = null;
  /** The tile the survey was last taken from, so it is taken once a step. */
  private surveyedFrom: number | null = null;
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
  /**
   * Gear a beaten boss dropped that the pack had no room for. It waits here
   * rather than being destroyed - see `claimBossGear` - and rides through a
   * fight in the carriage.
   */
  private unclaimedBossGear: RaidCarriage['unclaimedBossGear'] = [];
  private readonly collectedLootIds = new Set<string>();
  /**
   * The current map's barred exits - rubble a Pickaxe digs out, gates only
   * their own key opens - read once per map (`barredExitAt`).
   */
  private barredExits: { readonly mapId: string; readonly points: readonly ExtractionPoint[] } | undefined;
  /**
   * Rare finds this raid has laid eyes on, by loot id. The prize chip keeps
   * asking about these for the rest of the raid - see `prizeChipView`.
   */
  private readonly seenPrizeIds = new Set<string>();
  private readonly lootSprites = new Map<string, Phaser.GameObjects.Image>();
  /** A rare find's caption, so picking it up takes the writing with it. */
  private readonly prizeLabels = new Map<string, WorldLabel>();
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
   * A gift just handed over, whose nickname is asked once the hand-over has
   * been read. The question takes `trainerPrompt`'s seat: it is the one open
   * question the map has, and it owns the keyboard the same way.
   */
  private pendingGiftNickname: Pokemon | undefined;
  /**
   * The authored beat playing over the map: a watch catching the player, the
   * hunter running them down. Driven from `update()` by elapsed time - see
   * `../cutscene/cutscene.ts` for the machine and `../world/cutscenes.ts` for
   * every beat there is. Only one can be live: a cutscene owns the frame, so
   * nothing that could start a second one runs while one is playing.
   */
  private cutscene:
    | {
        readonly player: CutscenePlayer;
        /** The mark graphics raised over each actor, by actor id. */
        readonly marks: Map<string, Phaser.GameObjects.Graphics>;
        waitingForPlayer: boolean;
      }
    | undefined;
  /**
   * A rod cast into the water and not yet answered (`../world/fishing.ts`). It
   * owns the frame while it runs, as FireRed's cast locks the controls, and the
   * raid clock runs through it - standing at the water is time spent.
   */
  private fishing:
    | {
        readonly rod: RodItemId;
        readonly water: ReturnType<typeof fishingWaterAt>;
        readonly plan: CastPlan;
        readonly float: Phaser.GameObjects.Graphics;
        /** Where the float rests on the water, which it bobs a pixel below. */
        readonly floatY: number;
        elapsedMs: number;
        dots: number;
      }
    | undefined;
  /** A standing Pokemon met by speaking to it: the fight that follows its cry. */
  private pendingWildBattle: WildEncounter | undefined;
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
  /**
   * The contracts this save had banked when the raid deployed - which landmarks
   * the world keeps worked. A contract banks on the way out, so unlike a boss
   * this can never change mid-raid; it is read off the plan rather than storage
   * for the same reason `defeatedBosses` is.
   */
  private completedContracts: readonly string[] = [];
  /**
   * The legends this save has already caught, by entity id, none of which
   * stands this raid (`world/legends.ts`). Off the plan, like the contracts.
   */
  private caughtLegends: readonly string[] = [];
  /**
   * Every field-move door open as of this moment: the ones the save already
   * held when the raid deployed, plus the ones cut or swum during it. The other
   * half of `defeatedBosses`, and read through `openedDoors()` for the same
   * reason - a door is a door.
   */
  private openedGates: readonly string[] = [];
  /** The keys this save has used, so the chip names only the rest. See `learnKey`. */
  private keysLearned = new Set<string>();
  /** Insertions the lobby already offers, so the map only announces a new one. */
  private readonly knownInsertionIds = new Set<string>();
  /** The caption over each drop-in point, so reaching one can change what it says. */
  private readonly dropInLabels = new Map<string, WorldLabel>();
  /** The wall the player is already leaning on, so it thuds once. See `nextBump`. */
  private pushingAgainst: Direction | null = null;
  /** Whether the hunter's approach has already been announced. See `nextHunterProximity`. */
  private hunterNear = false;
  /**
   * The way the hunter last walked. Scene state rather than hunter state: it
   * is how the figure is drawn, and after a battle it starts facing down again
   * like every other figure the rebuilt world stands up.
   */
  private hunterFacing: Direction = 'down';
  /**
   * Raid clock the player has spent standing still since the hunter last took
   * a step, which it takes anyway every `HUNTER_IDLE_STEP_MS`. Scene state, so
   * a fight starts the count again: a battle is not standing still.
   */
  private hunterStillMs = 0;
  /**
   * The Pokemon walking at the player's heel, or null when nobody is: the
   * party's lead, else the partner (`world/raidFollower.ts`), drawn by the
   * harbour's own `PartnerFigure`. It is never collision and never charged to
   * the clock - it only ever goes where the player has been.
   */
  private partner: PartnerFigure | null = null;
  /** The other player in a raid room, drawn where they walk (`raidRoom/`). */
  private friendFigures: HarbourFigures | null = null;
  /** This raid's part in the room's one hunter last frame (`huntRole`). */
  private huntRoleWas: HuntRole = 'solo';
  /** When the room's word on the hunter was last taken (`HunterBoard.latest.at`). */
  private hunterHeardAt = -1;
  /** What this browser last said of the hunter, and when, so it says it again only when it changes. */
  private hunterSaidKey = '';
  private hunterSaidAt = Number.NEGATIVE_INFINITY;
  /** Each friend's tile last frame, so the keeper can step the hunter when its quarry steps. */
  private friendTiles = new Map<string, string>();
  /** Whose art the hunter's figure was drawn in, so a room's rival can redraw it. */
  private hunterDrawnAs: string | null = null;
  /** How long the room's phrase list stays open, while it is (`roomTalk.ts`). */
  private talkOpenMs = 0;
  /** The room-opened doors the map was last built with (`roomDoors`), so a new one rebuilds it. */
  private roomDoorsBuilt = '';
  /** Each friend's tile last surveyed round, so their walk lights this raid's ground too. */
  private friendSurveyed = new Map<string, number>();
  /** The pings on the map, drawn, by who sent each. */
  private pingMarks = new Map<string, { readonly tile: string; readonly mark: Phaser.GameObjects.Graphics }>();

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
  /**
   * A key used for the first time on this save: the chip stops naming it
   * (`input/keyBindings.ts`). Remembered at once for the rest of the raid, and
   * written so the next raid and the next rebuild know it too.
   */
  private learnKey(key: LearnableKeyId): void {
    if (this.keysLearned.has(key)) {
      return;
    }
    this.keysLearned.add(key);
    new SaveManager().learnKeys([key]);
  }

  private resetStateFromPreviousRaid(): void {
    this.lookMs = 0;
    this.spin = null;
    // Phaser destroyed the plate with the scene; only the reference outlives it.
    this.windowPausePlate = null;
    this.canopyInViewCache = null;
    this.pendingHubTransition = false;
    // Set on the way to the result screen, and read by handleRunResolutionComplete
    // to keep a dialogue from completing past it - so it is exactly the shape of
    // flag that froze the second raid, and belongs on this list.
    this.pendingResultScreen = false;
    this.pendingTrainerBattle = undefined;
    this.pendingWildBattle = undefined;
    // Phaser destroyed the float with the last raid's scene; only the state goes.
    this.fishing = undefined;
    this.endCutscene();
    this.unsolicitedDialog = false;
    this.packReseated = false;
    // The box itself is rebuilt at the bottom by create(), so the note that it was moved goes too.
    this.dialogRaised = false;
    this.openingBriefingOpen = false;
    this.spentPresses = new SpentPresses();
    // Phaser destroyed the object with the last raid's scene, so this only has
    // to stop pointing at it - and it does have to, or the first frame of the
    // next raid hands the keyboard to a dead panel.
    this.trainerPrompt = undefined;
    this.pendingGiftNickname = undefined;
    this.isWarping = false;
    this.targetTile = null;
    this.stepProgress = 0;
    this.stepCarryMs = null;
    this.directionPresses.clear();
    this.facing = 'down';
    this.caughtPokemonStash = [];
    this.unclaimedBossGear = [];
    this.extractionMarkers = [];
    this.boats = [];
    this.pendingVoyage = undefined;
    this.voyaging = undefined;
    this.boatAwayToldAt = null;
    this.timerThreat = 'normal';
    this.exitCue = undefined;
    this.exitCueKey = '';
    this.exitCueGrid = undefined;
    // A gate opened in the last raid is in the save, and is read back from it;
    // what must not survive is this instance's own copy of the list.
    this.defeatedBosses = [];
    this.completedContracts = [];
    this.caughtLegends = [];
    this.openedGates = [];
    this.knownInsertionIds.clear();
    this.pushingAgainst = null;
    this.hunterNear = false;
    this.hunterFacing = 'down';
    this.hunterStillMs = 0;
    // Phaser destroyed its sprite with the scene; this only stops pointing at it.
    this.partner = null;
    // And the friend's, for the same reason.
    this.friendFigures = null;
    // The room's hunter is read afresh after every rebuild: the last word heard
    // is taken again, and nothing said before is assumed still said.
    this.huntRoleWas = 'solo';
    this.hunterHeardAt = -1;
    this.hunterSaidKey = '';
    this.hunterSaidAt = Number.NEGATIVE_INFINITY;
    this.friendTiles = new Map();
    this.hunterDrawnAs = null;
    this.talkOpenMs = 0;
    this.roomDoorsBuilt = '';
    this.friendSurveyed = new Map();
    // Phaser destroyed the marks with the scene; the next frame draws them again.
    this.pingMarks = new Map();
    // Where the last raid ended is not where this one starts, and the plate
    // that named it must not flash up over the next insertion.
    this.districtId = null;
    this.surveyedFrom = null;
    this.placeName = null;
    this.placePlateMs = 0;
    this.arrivedFromBattle = false;
    // Where the last raid's townsfolk had wandered to, and whoever was half-way
    // through a step when it ended: `createEntities` stands them all back on
    // their marks, and a stale vacated tile would be a wall nobody was on.
    this.idleFigures = [];
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
    // Gear still owed from a boss beaten earlier in this raid comes back before
    // the new wins are settled, so one list is claimed in the order it was won.
    this.unclaimedBossGear = data.unclaimedBossGear ?? [];
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
    // The world is rebuilt after every fight, so the pack is re-told what the
    // raid is carrying rather than trusting a count it kept across the tear-down.
    if (this.runSession) {
      syncPackCargo(this.bag, this.runSession.manager.snapshot());
    }
    this.collectedLootIds.clear();
    data.collectedLootIds?.forEach((id) => this.collectedLootIds.add(id));
    this.seenPrizeIds.clear();
    data.seenPrizeIds?.forEach((id) => this.seenPrizeIds.add(id));
    this.activatedPoiIds.clear();
    data.activatedPoiIds?.forEach((id) => this.activatedPoiIds.add(id));
    this.hunterState = data.hunterState ?? createHunterState();
    this.resumeThreatsAlreadyAnnounced();
    this.createMap();
    this.applyPendingHunterBreakaway();
    this.createEntities();
    this.liftBeatenWatches();
    this.createPlayer();
    this.joinFriendRoom();
    // Back on the Bicycle after a fight, if it is still in the pack.
    this.setRiding(stillRiding({ ...this.rideState(), riding: this.runSession?.riding === true }));
    this.createDialogBox();
    // After the dialogue box, which the partner asks whether a line is being read.
    this.createPartner(!data.returnLocation);
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
  private settleBossProgress(savedGame: RestoredGame | undefined): readonly WorldLine[] {
    const saveManager = new SaveManager();
    const stored = (saveManager.load() ?? savedGame)?.raidProgress;
    const deployedWith = this.runSession?.plan?.defeatedBosses ?? stored?.defeatedBosses ?? [];
    // The doors a field move already opened travel the same way: off the plan
    // in a raid, off the save outside one. Nothing opens one on this path -
    // that happens on the step that works it - so it is only restored here.
    this.openedGates = this.runSession?.plan?.openedGates ?? stored?.openedGates ?? [];
    // The keys the chip has stopped naming, read once a rebuild like the rest.
    this.keysLearned = new Set(stored?.keysLearned ?? []);
    this.trainerEncounters = this.runSession
      ? (this.runSession.plan?.trainers ??
        withoutDefeatedBosses(createRunTrainerEncounters(), deployedWith))
      : [];
    const beatenThisRaid = bossEncounters(this.trainerEncounters)
      .filter((boss) => this.defeatedTrainerIds.has(boss.trainer.id))
      .map((boss) => boss.bossId);
    this.defeatedBosses = [...new Set([...deployedWith, ...beatenThisRaid])];
    this.completedContracts =
      this.runSession?.plan?.completedContracts ?? stored?.completedContracts ?? [];
    this.caughtLegends =
      this.runSession?.plan?.caughtLegends ?? caughtLegends(stored?.pokedexOwned ?? []);
    for (const id of [...(stored?.unlockedInsertions ?? []), ...(stored?.reachedInsertions ?? [])]) {
      this.knownInsertionIds.add(id);
    }

    const newlyBeaten = saveManager.recordDefeatedBosses(beatenThisRaid);
    return [
      ...gatesOpenedLines(
        WORLD_GATES.filter((gate) => gate.bossId !== undefined && newlyBeaten.includes(gate.bossId)),
      ),
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
  private takeBossGear(newlyBeaten: readonly string[]): readonly WorldLine[] {
    this.unclaimedBossGear = [
      ...this.unclaimedBossGear,
      ...bossGearDropped(this.trainerEncounters, newlyBeaten).map(({ itemId, name }) => ({
        itemId,
        name,
      })),
    ];
    return this.claimBossGear();
  }

  /**
   * Hands over whatever gear is waiting and the pack now has room for.
   *
   * Gear comes off a boss once per save, at the moment the win is written, and
   * a full pack used to destroy it: the player was told after the fact, with
   * nothing they could have done from where they stood. It waits instead - in
   * the carriage, so it survives the next fight - and `update()` asks again
   * whenever the pack has changed, so the answer to "make room" is simply to
   * make room. Nothing is claimed twice: a piece leaves this list only when the
   * pack has actually taken it.
   */
  private claimBossGear(): readonly WorldLine[] {
    if (this.unclaimedBossGear.length === 0) {
      return [];
    }
    const waiting: { itemId: string; name: string }[] = [];
    const lines: WorldLine[] = [];
    for (const drop of this.unclaimedBossGear) {
      const item = getItemById(drop.itemId);
      const gearName = item?.displayName.toUpperCase() ?? 'PIECE OF GEAR';
      if (this.bag.takeFind(drop.itemId, 1) === 'refused') {
        waiting.push({ ...drop });
        lines.push(
          `${drop.name} was carrying a ${gearName} - and your pack has no room for it.`,
          'It is yours the moment you make room: drop something from the PACK.',
        );
        continue;
      }
      // Gear is the rarest thing a raid hands over, and it used to go by as
      // one more line pressed through after the fight (playtest 42): it is
      // FireRed's obtained-an-item beat now, a jingle with the line held.
      lines.push(
        { text: `${drop.name} was carrying a ${gearName}. You take it.${this.reseatNote()}`, obtained: true },
        `${item?.description ?? ''} Give it to a POKéMON from the party screen - and get it home.`,
      );
    }
    this.unclaimedBossGear = waiting;
    return lines;
  }

  /**
   * The map as it stands for this player: every door they have opened, open -
   * the gates their wins took and the ones a field move cut or swam.
   */
  private mapFor(mapId: WorldMapId): WorldMapDefinition {
    return getWorldMap(mapId, this.openedDoorKeys(mapId));
  }

  /**
   * Both halves of the door state as the one list every gate rule reads - and,
   * in a raid room, the doors a friend's win opened for this raid alone
   * (`raidRoom/roomBosses.ts`), which are never written to this save.
   */
  private openedDoorKeys(mapId: WorldMapId = this.currentMap.id): readonly string[] {
    return [
      ...openedDoors({ defeatedBosses: this.defeatedBosses, openedGates: this.openedGates }),
      ...this.roomDoors(mapId),
      // The hour's: a night track stands open for the whole of a night raid.
      ...nightDoors(this.runSession?.plan?.night),
    ];
  }

  /** The doors a room's wins open on this map this raid, whoever won them. */
  private roomDoors(mapId: WorldMapId = this.currentMap.id): readonly string[] {
    const rooms = friendRoom();
    if (!this.runSession || rooms?.room?.mapId !== mapId) {
      return [];
    }
    const bosses = gatesForMap(mapId).flatMap((gate) => (gate.bossId === undefined ? [] : [gate.bossId]));
    return roomOpenedDoors(rooms.bossesWon, bosses);
  }

  public update(_time: number, deltaMs: number): void {
    // Before the raid's own frame, which steps and catches with the hunter the
    // room shares (`raidRoom/groupHunter.ts`).
    this.updateGroupHunter();
    this.updateRaid(deltaMs);
    this.settleHeadMark();
    // Last, so it is drawn where this frame's step has put the player.
    this.updatePartner(deltaMs);
    this.updateFriend(deltaMs);
  }

  /**
   * The raid room this raid is in, if any: this raid's map is the room's, and
   * the player is said to be standing on it. Asked on every rebuild - the
   * world is started again after every fight - and the other player has stood
   * where they last walked all through it.
   */
  private joinFriendRoom(): void {
    const rooms = friendRoom();
    if (!this.runSession || rooms?.room?.mapId !== this.currentMap.id) {
      return;
    }
    rooms.inRaid(this.currentMap.id, this.currentTile, this.facing);
    this.friendFigures = new HarbourFigures(this, () => RAID_NAME_PLATE_DEPTH);
    // Anything the others took before this player dropped in, or while they
    // were in a fight, is already gone.
    rooms.askWhatWasTaken();
    this.sayRoomWins();
    this.roomDoorsBuilt = this.roomDoors().join();
    // Back from a fight: the room is told it is over, and after the hunter's
    // own fight what it left of the hunter - fled from, and where it fell back
    // to, or beaten for everybody.
    const was = rooms.fighting;
    rooms.fighting = null;
    if (was === 'hunter') {
      rooms.sayHunter({ kind: 'after', from: rooms.room.me, hunter: this.sharedHunterNow() });
    } else if (was === 'wild') {
      rooms.sayHunter({ kind: 'busy', from: rooms.room.me, busy: false, withHunter: false });
    }
  }

  /** A boss this player beat this raid opens its doors for everybody in the room (`roomBosses.ts`). */
  private sayRoomWins(): void {
    friendRoom()?.won(
      bossEncounters(this.trainerEncounters)
        .filter((boss) => boss.mapId === this.currentMap.id && this.defeatedTrainerIds.has(boss.trainer.id))
        .map((boss) => boss.bossId),
    );
  }

  /**
   * This raid's part in the room's one hunter: alone on the map (`solo`, the
   * hunter is this raid's own, as ever), running it for everybody (`keeper`),
   * or drawing it where the keeper says (`follower`).
   */
  private huntRole(): HuntRole {
    const rooms = friendRoom();
    const room = rooms?.room;
    if (!rooms || !room || !this.runSession || room.mapId !== this.currentMap.id) {
      return 'solo';
    }
    const others = rooms.othersOn(this.currentMap.id).map((friend) => friend.id);
    if (others.length === 0) {
      return 'solo';
    }
    return hunterKeeper(room.me, others, rooms.hunters.busy) === room.me ? 'keeper' : 'follower';
  }

  /**
   * The room's one hunter, each frame. A follower takes whatever the keeper
   * last said; a keeper takes over from the last word heard when the keeping
   * passes to it, and from a fight's ending, then says the hunter again
   * whenever it changes - and steps it when the friend it is chasing steps.
   */
  private updateGroupHunter(): void {
    const rooms = friendRoom();
    const room = rooms?.room;
    const role = this.huntRole();
    const was = this.huntRoleWas;
    this.huntRoleWas = role;
    if (!rooms || !room || role === 'solo') {
      return;
    }
    const latest = rooms.hunters.latest;
    const fresh = latest && latest.from !== room.me && latest.at > this.hunterHeardAt ? latest : null;
    if (role === 'follower') {
      if (fresh || was !== 'follower') {
        this.takeSharedHunter(fresh ?? latest, role);
      }
      return;
    }
    if (fresh && (was !== 'keeper' || fresh.after)) {
      this.takeSharedHunter(fresh, role);
    } else if (fresh) {
      this.hunterHeardAt = fresh.at;
    }
    this.stepForFriends(rooms.figuresOn(this.currentMap.id));
    this.sayHunterIfChanged();
  }

  /** The hunter as the room shares it, from this raid's own state. */
  private sharedHunterNow(): SharedHunter {
    return {
      spawned: this.hunterState.spawned,
      defeated: this.hunterState.defeated,
      position: this.hunterState.mapId === this.currentMap.id ? (this.hunterState.position ?? null) : null,
      facing: this.hunterFacing,
      searchMs: this.hunterState.searchRemainingMs ?? 0,
      rivalId: this.hunterRival().id,
    };
  }

  /** The keeper's word on the hunter: said when it changes, and again now and then for anybody who missed it. */
  private sayHunterIfChanged(): void {
    const rooms = friendRoom();
    const room = rooms?.room;
    // Silent while somebody fights it: the fight's end is the next word on the
    // hunter, and a word from before it arriving after it would undo it.
    if (!rooms || !room || rooms.hunters.hunterHeld) {
      return;
    }
    const shared = this.sharedHunterNow();
    const key = [
      shared.spawned,
      shared.defeated,
      shared.position?.x,
      shared.position?.y,
      shared.facing,
      shared.searchMs > 0,
      shared.rivalId,
    ].join();
    const now = this.time.now;
    if (key === this.hunterSaidKey && now - this.hunterSaidAt < HUNTER_RESAY_MS) {
      return;
    }
    if (rooms.sayHunter({ kind: 'hunter', from: room.me, hunter: shared })) {
      this.hunterSaidKey = key;
      this.hunterSaidAt = now;
    }
  }

  /** Takes the room's word on the hunter as this raid's own, and draws it there. */
  private takeSharedHunter(
    heard: { readonly hunter: SharedHunter; readonly at: number } | null,
    role: HuntRole,
  ): void {
    if (!heard) {
      // A follower who has heard nothing yet: the keeper's hunter has not come.
      if (role === 'follower' && this.hunterState.spawned && !this.hunterState.defeated) {
        this.hunterState = { ...this.hunterState, spawned: false, position: undefined };
        this.drawSharedHunter();
      }
      return;
    }
    this.hunterHeardAt = heard.at;
    const hunter = heard.hunter;
    const arriving = role === 'follower' && hunter.spawned && !hunter.defeated && hunter.position !== null &&
      !(this.hunterState.spawned && !this.hunterState.defeated && this.hunterState.position);
    this.hunterState = {
      ...this.hunterState,
      spawned: hunter.spawned,
      defeated: hunter.defeated,
      mapId: this.currentMap.id,
      position: hunter.position ?? undefined,
      searchRemainingMs: hunter.searchMs,
    };
    this.hunterFacing = hunter.facing;
    this.drawSharedHunter();
    if (arriving && hunter.position) {
      audioManager.play('hunterArrival');
      this.interrupt([this.hunterRival().arrival], [hunter.position]);
    }
  }

  /** The hunter's figure where the room's word puts it, in the room's rival's art. */
  private drawSharedHunter(): void {
    const sprite = this.npcSprites.get(HUNTER_FIGURE_ID);
    const rival = this.hunterRival().id;
    if (sprite && this.hunterDrawnAs !== null && this.hunterDrawnAs !== rival) {
      sprite.destroy();
      this.npcSprites.delete(HUNTER_FIGURE_ID);
      this.npcAppearances.delete(HUNTER_FIGURE_ID);
    }
    if (!this.isHunterOnCurrentMap() || !this.hunterState.position) {
      this.npcSprites.get(HUNTER_FIGURE_ID)?.setVisible(false);
      return;
    }
    if (!this.npcSprites.has(HUNTER_FIGURE_ID)) {
      this.createHunterSprite();
      return;
    }
    const { x, y } = this.hunterState.position;
    this.placeFigure(HUNTER_FIGURE_ID, x, y, this.hunterFacing);
  }

  /**
   * The keeper steps the hunter when the friend it is chasing steps, as a raid
   * alone steps it when its player does - so the hunter is no faster for being
   * shared, and no slower for chasing somebody else.
   */
  private stepForFriends(figures: readonly { readonly id: string; readonly tile: GridPosition }[]): void {
    const seen = new Map<string, string>();
    const stepped: string[] = [];
    for (const figure of figures) {
      const key = `${figure.tile.x},${figure.tile.y}`;
      seen.set(figure.id, key);
      const before = this.friendTiles.get(figure.id);
      if (before !== undefined && before !== key) {
        stepped.push(figure.id);
      }
    }
    this.friendTiles = seen;
    const chased = this.groupQuarry();
    if (chased && stepped.includes(chased.id)) {
      this.hunterStillMs = 0;
      this.advanceHunterPursuit(chased.id);
    }
  }

  /**
   * Who the room's hunter is after: the nearest of everybody on the map who is
   * not in a fight, this player included. Null when the hunter is this raid's
   * alone, or not out.
   */
  private groupQuarry(): { readonly id: string; readonly tile: GridPosition } | null {
    const rooms = friendRoom();
    const room = rooms?.room;
    const hunter = this.hunterState.position;
    if (!rooms || !room || !hunter || this.huntRole() === 'solo') {
      return null;
    }
    const busy = rooms.hunters.busy;
    const onMap = new Set(rooms.othersOn(this.currentMap.id).map((friend) => friend.id));
    const friends = rooms
      .figuresOn(this.currentMap.id)
      .filter((figure) => onMap.has(figure.id) && !busy.has(figure.id))
      .map((figure) => ({ id: figure.id, tile: figure.tile }));
    return nearestQuarry(hunter, [{ id: room.me, tile: this.currentTile }, ...friends]);
  }

  /**
   * Tells the room where the player stands - a step, a door or a warp are all
   * only a new tile - and draws the friend where they walk. Off the raid clock
   * and before nothing: the friend is the world going on around the player.
   */
  private updateFriend(deltaMs: number): void {
    const rooms = friendRoom();
    if (!this.friendFigures || !rooms?.room) {
      return;
    }
    rooms.moved(this.currentTile, this.facing);
    rooms.tick(this.time.now, deltaMs);
    // What somebody is saying rides on their name plate while it is said. Two
    // friends dropping in by the same door land on one tile, and a friend's
    // bare name over the head they share reads as this player's own, so it is
    // left off until one of them walks away; a plate saying something is kept.
    this.friendFigures.update(
      rooms.figuresOn(this.currentMap.id).map((figure) => {
        const said = rooms.talk.saying(figure.id, this.time.now);
        return said ? { ...figure, name: `${figure.name}: ${said}`, speaking: true } : figure;
      }),
      this.player,
    );
    this.settleRoomLoot();
    this.talkInTheRoom(deltaMs);
    this.drawPings();
    this.openRoomDoors();
    this.surveyWithFriends(rooms.figuresOn(this.currentMap.id));
  }

  /** The friend as drawn, for a playtest to read (`tools/playtest/friendRaid.mjs`). */
  public get friendFiguresShown(): readonly { readonly name: string; readonly tile: GridPosition }[] {
    if (!this.friendFigures) {
      return [];
    }
    return (friendRoom()?.figuresOn(this.currentMap.id) ?? []).map((figure) => ({ name: figure.name, tile: { ...figure.tile } }));
  }

  /** The friend chip's lines, while this raid is in a room (`friendChipLines`). */
  private friendChip(): readonly string[] | null {
    const rooms = friendRoom();
    const room = rooms?.room;
    if (!rooms || !room || room.mapId !== this.currentMap.id || !this.runSession) {
      return null;
    }
    const news = rooms.news();
    const drawn = rooms.figuresOn(this.currentMap.id);
    const areas = this.currentMap.areas;
    const pings = rooms.talk.pings(this.time.now);
    const lines = friendChipLines({
      code: room.code,
      news: news ? { name: news.name, came: news.came, ...(news.line ? { line: news.line } : {}) } : null,
      friends: rooms.friends().map((friend) => {
        const figure = drawn.find((each) => each.id === friend.id);
        const elsewhere = figure ? placeApart(areas, this.currentTile, figure.tile) : null;
        return {
          name: friend.name,
          atLab: friend.place === 'lab',
          fighting: rooms.hunters.fightOf(friend.id),
          ...(pings.has(friend.id)
            ? {
                ping: friendChipPing(areas, this.currentTile, pings.get(friend.id)!, this.headingTo(pings.get(friend.id)!)),
              }
            : {}),
          heading: figure ? this.headingTo(figure.tile) : null,
          distance:
            figure && !elsewhere
              ? Math.abs(figure.tile.x - this.currentTile.x) + Math.abs(figure.tile.y - this.currentTile.y)
              : null,
          elsewhere,
        };
      }),
    });
    // The phrase list while it is open, else the room's two keys until each is used.
    const talk =
      this.talkOpenMs > 0
        ? ROOM_PHRASES.map((phrase, index) => `${index + 1} ${phrase}`)
        : [roomKeyHintLine(this.keysLearned)].filter(Boolean);
    return [...lines, ...talk];
  }


  private updateRaid(deltaMs: number): void {
    const stepCarryMs = this.stepCarryMs;
    this.stepCarryMs = null;
    // Before the captions are seated, and before any of the early returns
    // below: the look is a way of reading the map, so it answers while a
    // dialogue box is open exactly as it does while walking.
    const looked = this.keyPresses.justPressed(this.controls.look);
    if (looked) {
      this.learnKey('look');
    }
    this.lookMs = advanceLookMs(this.lookMs, looked, deltaMs);
    this.containWorldLabels();
    if (this.keyPresses.justPressed(this.controls.objectives)) {
      this.learnKey('objectives');
      this.openObjectives();
      return;
    }

    this.dialogBox.update(deltaMs);

    this.advanceRunClock(deltaMs);
    // Outside the clock and before the early returns: the townsfolk are the
    // world going on around the raid, and they cost the player nothing.
    this.advanceIdleFigures(deltaMs);
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

    // A figure coming for the player is not something to walk away from: the
    // map is theirs until they have arrived and spoken. While a cutscene waits
    // on a line to be read it hands the frame back, so the dialogue box below
    // answers the key exactly as it does for any other box.
    if (this.cutscene && this.advanceCutscene(deltaMs)) {
      return;
    }

    // A cast owns the frame until it is answered: nothing the player presses
    // moves it on, exactly as FireRed locks the controls while the dots run.
    if (this.fishing) {
      this.advanceFishing(deltaMs);
      return;
    }

    if (this.dialogBox.visible) {
      this.handleDialogInput();
      return;
    }

    // Aboard, the boat has the frame: nothing the player presses steers it.
    if (this.pendingVoyage) {
      this.castOff();
      return;
    }
    if (this.voyaging) {
      this.advanceVoyage(deltaMs);
      return;
    }

    if (this.keyPresses.justPressed(this.controls.party)) {
      this.learnKey('party');
      this.openParty();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.bag)) {
      this.learnKey('bag');
      this.openBag();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.save)) {
      this.saveGame();
      return;
    }

    // What is left of this frame for walking, and the game time a step that
    // finished part-way through a frame hands to the step that follows it.
    let frameLeftMs = deltaMs;
    let carriedMs = stepCarryMs;
    if (this.targetTile) {
      this.advanceStep(deltaMs);
      // A step that ends part-way through a frame walks straight on into the
      // next one in the same frame. Begun on the following frame instead, the
      // arrival frame moved short and the next one moved two frames' worth -
      // once a tile, with the camera following, so the whole map judders while
      // a direction is held (playtest 28, F1). The arrival may have started
      // something that owns the frame - a door, a fight, a line to read - and
      // then the walk stops here, exactly as the next frame would have.
      if (this.targetTile || this.stepCarryMs === null || !this.mayWalkOnFromArrival()) {
        return;
      }
      carriedMs = this.stepCarryMs;
      this.stepCarryMs = null;
      frameLeftMs = 0;
    }

    // A hunter that walked up to a player standing still - its idle step, or
    // a step taken while a box was being read - catches them here, the first
    // moment there is nothing on screen to read. Before the exit, because it
    // reached them first.
    if (this.tryStartHunterBattle()) {
      return;
    }

    if (this.tryExtractWhereStanding()) {
      return;
    }

    // Gear a boss dropped into a pack that had no room for it is handed over
    // the moment there is room, whatever bought it - a Potion drunk, a crate
    // put down. Asked here because this is where the player is at rest with
    // nothing on screen to read, and guarded by an empty list, which is what it
    // holds on every frame of almost every raid.
    if (this.unclaimedBossGear.length > 0 && this.tryClaimWaitingBossGear()) {
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
    // The water off a jetty is solid, and pressing out into it while the
    // boat is in is asking to board.
    if (!decision.target && pushing && this.tryBoard(decision.facing, false)) {
      return;
    }
    // A lift's door is in the wall, and pressing up into it calls the lift -
    // the moment the press begins, so a held key asks once.
    if (!decision.target && pushing && this.tryRideLift(decision.facing, this.pushingAgainst !== decision.facing)) {
      return;
    }
    // A doorway is solid too - a door, the dark past a room's mat - and
    // pressing into one is going through it.
    if (!decision.target && pushing && this.tryPushThrough(decision.facing)) {
      return;
    }
    // Before the bump: a ledge is solid, so walking into one is refused by the
    // step planner, and the hop is what the refusal means on these tiles.
    if (!decision.target && pushing && this.tryLedgeHop(decision.facing)) {
      return;
    }
    // A boulder is solid too, and walking into one with Strength is the push.
    if (!decision.target && pushing && this.tryPushBoulder(decision.facing)) {
      return;
    }
    // And the other refusal that means something: the hunter is a person, so
    // its tile is collision, and walking into the person chasing you is being
    // caught by them.
    if (!decision.target && pushing && this.tryWalkIntoHunter(decision.facing)) {
      return;
    }
    const bump = nextBump(this.pushingAgainst, !decision.target && pushing ? decision.facing : null);
    this.pushingAgainst = bump.pushingAgainst;
    if (bump.thud) {
      audioManager.play('bump');
    }
    this.facing = decision.facing;

    if (decision.target) {
      // A step the player chose is never a spin.
      this.spin = null;
      this.beginStep(decision.target);
      // Walking on from a step that ended part-way through a frame: this one
      // started then, not now. A step begun from rest starts from nothing.
      if (carriedMs !== null) {
        this.advanceStep(frameLeftMs + carriedMs);
      }
      return;
    }

    this.showIdlePose();
  }

  /**
   * Whether the tile just reached left the world as `update` finds it at the
   * top of a frame with nothing to answer first - the same guards, in the same
   * order - so walking on from it in the same frame is what the next frame
   * would have done anyway.
   */
  private mayWalkOnFromArrival(): boolean {
    return (
      !this.pendingHubTransition &&
      !this.isWarping &&
      !this.trainerPrompt &&
      !this.cutscene &&
      !this.fishing &&
      !this.dialogBox.visible &&
      this.pendingTrainerBattle === undefined &&
      this.pendingWildBattle === undefined
    );
  }

  /**
   * The single entry point for future world-item pickups. Keeping registration
   * beside the inventory mutation prevents found loot from being lost at
   * extraction.
   */
  /** Set while a find has just made the pack re-seat itself, so the line says so. */
  private packReseated = false;

  public collectRunItem(itemId: ItemId, quantity = 1): boolean {
    // A find is not on a screen the player can rearrange from: it is on the
    // ground in front of them, and "no room, the way you have packed it" is a
    // refusal they cannot act on without walking away from it. So the pack
    // re-seats itself around a find when that is the only way it goes in - and
    // says so, because changing somebody's arrangement silently would be the
    // one promise this cannot break.
    const taken = this.bag.takeFind(itemId, quantity);
    if (taken === 'refused') {
      return false;
    }
    this.packReseated = this.packReseated || taken === 'reseated';
    this.runSession?.manager.registerFoundItem(itemId, quantity);
    return true;
  }

  /** What is added to a pickup's line when the pack shuffled to take it. */
  private reseatNote(): string {
    if (!this.packReseated) {
      return '';
    }
    this.packReseated = false;
    return ' Your pack re-packed itself to fit it.';
  }

  private createMap(): void {
    this.collisionData = this.currentMap.collision.map((row) => [...row]);
    this.bounds = {
      width: this.currentMap.width,
      height: this.currentMap.height,
      // The ways through between a map's places, which every search the
      // hunter makes reads as one more step (`GridBounds.links`).
      ...(this.currentMap.links ? { links: this.currentMap.links } : {}),
    };

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
    // last is above the player, which is what lets a wood have an inside. The
    // tops of the crowns go in that band too, after the crowns themselves,
    // because a tree's brim is in front of whatever stands in the row behind it.
    for (const [name, layer, depth] of [
      ['ground', layers.ground, atRow(TERRAIN_DEPTH, 0)],
      ['overlay', layers.overlay, atRow(TERRAIN_DEPTH, 1)],
      ['detail', layers.detail, atRow(TERRAIN_DEPTH, 2)],
      ['canopy', layers.canopy, CANOPY_BAND],
      ['brim', layers.brim, CANOPY_BAND],
    ] as const) {
      this.createTileLayer(map, sheets, name, layer, depth);
    }
    this.createInteriors(map, sheets, layers);

    this.createExtractionPoints();
    this.createBoats();
    this.createLiftLabels();
    this.createRouteTransitionLabels();
    this.createDoorwayLabels();
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
    // A night track is a way nobody signs, by day or by night: nothing names it.
    for (const doors of gatesByKeeper(this.currentMap.gates.filter((gate) => gate.night !== true))) {
      const [front] = doors;
      const open = isGateOpen(front, this.openedDoorKeys());
      const tone = open ? LABEL_TONES.gateOpen : LABEL_TONES.gateShut;
      const boss = bossEncounters(createRunTrainerEncounters()).find(
        (candidate) => candidate.bossId === front.bossId,
      );
      const group = doors.length > 1 ? `gates:${gateKey(front)}` : undefined;
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
    for (const insertion of insertionsOn(this.currentMap.id)) {
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
    flashScreen(this.cameras.main, 120, [94, 234, 212]);
    return dropInReachedLine(insertion.label);
  }

  /**
   * Draws every roofed place on the map: its lid, above the figures, and the
   * veil that makes the floor under it dim.
   *
   * The lid is an ordinary tile layer of the map's own art (`interiors.ts`
   * says what it is made of, `buildMapLayers` paints it), and the only layer
   * in the game the scene ever hides. The veil sits over the ground and under
   * every figure - so in a cave the rock is dark and whoever is standing on it
   * is not, which is the whole of the dark here. It is never a lock: a cave you
   * needed an item to walk through would be the corridor this game refuses.
   */
  private createInteriors(
    map: Phaser.Tilemaps.Tilemap,
    sheets: Phaser.Tilemaps.Tileset[],
    layers: MapLayers,
  ): void {
    this.roofLayers.clear();
    // Cleared before the early return, not after it: the scene instance is
    // reused for every raid (`resetStateFromPreviousRaid`), so a map with no
    // interior on it must not inherit the last raid's cave.
    this.currentInterior = interiorAt(this.currentMap.id, this.currentTile) ?? null;
    if (this.currentMap.interiors.length === 0) {
      return;
    }
    // Two layers for the whole map's lids - the hillside and what stands on it
    // - keyed per interior: a map with two caves on it lifts the pair for
    // whichever one the player is in, and two caves are never entered at once.
    const lid = [
      this.createTileLayer(map, sheets, 'roofGround', layers.roofGround, ROOF_BAND),
      this.createTileLayer(map, sheets, 'roof', layers.roof, ROOF_BAND + 0.01),
    ];
    for (const interior of this.currentMap.interiors) {
      this.roofLayers.set(interior.id, lid);
      this.mapObjects.push(
        this.add
          .rectangle(
            interior.roof.x * TILE_SIZE,
            interior.roof.y * TILE_SIZE,
            interior.roof.width * TILE_SIZE,
            interior.roof.height * TILE_SIZE,
            0x0b1020,
            interior.dim,
          )
          .setOrigin(0, 0)
          .setDepth(INTERIOR_DIM_DEPTH),
      );
    }
    // The map is rebuilt after every battle and every warp, so a player who was
    // standing in a cave when a wild fight started comes back to a cave with
    // its lid still off - and without the quarter second of it lifting again.
    this.applyInteriorCover(false);
    this.createInteriorLabels();
  }

  /**
   * Lifts or lowers the lid over the place the player is in.
   *
   * `animated` is false when the world is being built - a roof that faded in
   * over a player already standing under it would be the hillside closing on
   * them - and true for a step, where the quarter second is the hill coming
   * off and is short enough that it never delays a move.
   */
  private applyInteriorCover(animated: boolean): void {
    for (const [id, layers] of this.roofLayers) {
      const inside = this.currentInterior?.id === id;
      const alpha = inside ? 0 : 1;
      if (!animated) {
        for (const layer of layers) {
          layer.setAlpha(alpha);
        }
        continue;
      }
      // Whatever the lid was doing, it stops: walking in and straight back out
      // otherwise leaves the tween that was lifting the hill fighting the one
      // putting it back, and the hill settles half drawn over the cave.
      this.tweens.killTweensOf(layers);
      this.tweens.add({ targets: layers, alpha, duration: INTERIOR_COVER_MS });
    }
  }

  /**
   * Notices a step in or out of a roofed place.
   *
   * Called on the tile the step *finished* on, because the lid is about what
   * the player is standing in rather than what they are walking towards - and
   * because a mouth is the first tile of the inside, the hill is already off by
   * the time they are under it.
   */
  private noteInterior(): void {
    const interior = interiorAt(this.currentMap.id, this.currentTile) ?? null;
    if (interior?.id === this.currentInterior?.id) {
      return;
    }
    this.currentInterior = interior;
    this.applyInteriorCover(true);
    audioManager.play(interior ? 'interiorEnter' : 'interiorLeave');
  }

  /** Whether the hunter can see the player from where it is standing. */
  private playerIsHidden(): boolean {
    // Inside a building with two doors out of it, the way the Delve's lid
    // hides you (`buildingInsides.ts`).
    if (
      hiddenInArea(
        this.currentMap.areas,
        this.currentTile,
        this.isHunterOnCurrentMap() ? this.hunterState.position : undefined,
      )
    ) {
      return true;
    }
    if (this.currentInterior === null) {
      return false;
    }
    const hunter = this.hunterState.position;
    if (!hunter || !this.isHunterOnCurrentMap()) {
      return true;
    }
    // A cave you are both standing in is not a hiding place.
    return interiorAt(this.currentMap.id, hunter)?.id !== this.currentInterior.id;
  }

  /**
   * Names each mouth of each roofed place.
   *
   * Without it a cave is invisible: the lid is the hillside's own art, so from
   * outside there is nothing to tell a mouth from a shadow in the rock. The
   * caption speaks within five steps like every other name (`captionReveal.ts`),
   * so it is a thing you find by walking up to the hill rather than a signpost
   * across the valley - and holding L still shows every one in view.
   */
  private createInteriorLabels(): void {
    // Captions are raid furniture, like every other one on the map: the world
    // is also built outside a raid (the title screen's backdrop, and a scene
    // created with no session in the suite) and nothing is being named then.
    if (!this.runSession) {
      return;
    }
    for (const interior of this.currentMap.interiors) {
      for (const mouth of interior.mouths) {
        // The subject is the mouth *and* the ground outside it, which is what
        // gives the caption somewhere to sit. A lid is drawn over the captions
        // exactly as a crown is, so every seat inside the hill is forbidden
        // ground (`lidsInView`); anchored on the mouth alone, the name of the
        // delve's quarry-side mouth had nowhere left and went undrawn.
        const outside = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ]
          .map((step) => ({ x: mouth.x + step.x, y: mouth.y + step.y }))
          .filter(
            (tile) =>
              !isInsideRect(interior.roof, tile) && this.collisionData[tile.y]?.[tile.x] === false,
          );
        const about = [mouth, ...outside];
        const left = Math.min(...about.map((tile) => tile.x));
        const right = Math.max(...about.map((tile) => tile.x));
        const top = Math.min(...about.map((tile) => tile.y));
        const bottom = Math.max(...about.map((tile) => tile.y));
        this.worldLabels.push(
          new WorldLabel(this, {
            subject: {
              x: left * TILE_SIZE,
              y: top * TILE_SIZE,
              width: (right - left + 1) * TILE_SIZE,
              height: (bottom - top + 1) * TILE_SIZE,
            },
            text: interior.label,
            tone: LABEL_TONES.interior,
            depth: atRow(CAPTION_BAND, mouth.y),
            speech: { voice: 'name', tiles: about },
          }),
        );
      }
    }
  }

  private createTileLayer(
    map: Phaser.Tilemaps.Tilemap,
    sheets: Phaser.Tilemaps.Tileset[],
    name: string,
    layer: TileLayer,
    depth: number,
  ): Phaser.Tilemaps.TilemapLayer {
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
      if (layer.flips[tile.y]?.[tile.x]) {
        tile.flipX = true;
      }
    });
    this.mapObjects.push(created);
    return created;
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
        .image(x, y, extractionIconKey(point, isOpen))
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
    this.createSwitchPlates();
    this.createLoot();
    this.createPois();
    this.createContractMarkers();

    this.createLedgeLabels();
    this.idleFigures = createIdleFigures(this.currentMap.entities, Math.random);
    for (const entity of this.currentMap.entities) {
      if (this.wasMet(entity)) {
        continue;
      }
      if (entity.kind === 'sign') {
        this.createSign(entity);
        continue;
      }

      if (entity.pokemon) {
        this.createPokemonFigure(entity.id, entity.position, entity.pokemon);
        continue;
      }
      if (entity.berry) {
        this.createBerryTree(entity.id, entity.position, entity.berry);
        continue;
      }
      if (entity.boulder) {
        this.createBoulder(entity.id, this.boulderAt(entity));
        continue;
      }
      if (entity.barrier) {
        if (!this.barrierIsOpen(entity.barrier.id)) {
          this.createBarrier(entity.id, entity.position, entity.barrier.top, entity.barrier.cell);
        }
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
      shading.fillStyle(WATCH_INK, WATCH_HATCH_ALPHA);
      for (let row = 0; row < TILE_SIZE; row += 1) {
        // One ink pixel a row, stepping along the diagonal from map pixel 0, so
        // neighbouring tiles continue each other's stripes.
        const first = (WATCH_HATCH_SPACING - ((x + y + row) % WATCH_HATCH_SPACING)) % WATCH_HATCH_SPACING;
        for (let column = first; column < TILE_SIZE; column += WATCH_HATCH_SPACING) {
          shading.fillRect(x + column, y + row, 1, 1);
        }
      }
      const edges: Array<readonly [number, number, number, number]> = [];
      if (!inWatch.has(`${tile.x},${tile.y - 1}`)) {
        edges.push([x, y, TILE_SIZE, 1]);
      }
      if (!inWatch.has(`${tile.x},${tile.y + 1}`)) {
        edges.push([x, y + TILE_SIZE - 1, TILE_SIZE, 1]);
      }
      if (!inWatch.has(`${tile.x - 1},${tile.y}`)) {
        edges.push([x, y, 1, TILE_SIZE]);
      }
      if (!inWatch.has(`${tile.x + 1},${tile.y}`)) {
        edges.push([x + TILE_SIZE - 1, y, 1, TILE_SIZE]);
      }
      // The red edge over a dark one: the colour still says "red", and the ink
      // under it is what says "edge" to anyone who cannot see red.
      for (const [inkStyle, alpha] of [
        [WATCH_INK, WATCH_INK_EDGE_ALPHA],
        [WATCH_TINT, WATCH_EDGE_ALPHA],
      ] as const) {
        shading.fillStyle(inkStyle, alpha);
        for (const [ex, ey, width, height] of edges) {
          shading.fillRect(ex, ey, width, height);
        }
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
        text: trainerWatchCaption(encounter.trainer.name, encounter.facing),
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
      // A hidden spot is drawn as nothing at all, as FireRed hides an item in
      // a tile: it is found by walking onto it, and only then said.
      if (loot.hidden) {
        continue;
      }
      const x = loot.position.x * TILE_SIZE + TILE_SIZE / 2;
      const y = loot.position.y * TILE_SIZE + TILE_SIZE / 2;
      const marker = this.add
        .image(x, y, iconTextureKey(itemIconName(loot.itemId)))
        .setDepth(atRow(MARKER_BAND, loot.position.y));
      this.lootSprites.set(loot.id, marker);
      this.mapObjects.push(marker);
      if (isPrize(loot)) {
        this.createPrizeGleam(loot, x, y);
      }
    }
  }

  /**
   * What makes a rare find a decision rather than a surprise: a light over it
   * and its name beside it, both readable from across a clearing.
   *
   * The gleam is drawn in `CANOPY_BAND`, the one band above the figures, which
   * is deliberate and is the whole reason it works in a wood: the light shows
   * over a tree crown, so a Leaf Stone in the withy beds is a thing you notice
   * from the bank rather than a thing you tread on. It is the only mark in that
   * band that is not a crown, and it is two tiles of nothing being taken from
   * the map - the icon under it is still the thing.
   *
   * The caption speaks with the `prize` voice, so unlike every other name on
   * the map it does not wait to be walked up to (`ui/captionReveal.ts`).
   */
  private createPrizeGleam(loot: WorldLoot, x: number, y: number): void {
    const gleam = this.add
      .graphics()
      .setDepth(atRow(CANOPY_BAND, loot.position.y))
      .fillStyle(PRIZE_GLEAM_COLOUR, 1);
    // A four-pointed star: two crossed bars and a bright centre, drawn rather
    // than loaded, because it is four rectangles and an asset for it would be
    // an asset to keep in provenance for no gain.
    gleam.fillRect(-1, -PRIZE_GLEAM_REACH, 2, PRIZE_GLEAM_REACH * 2);
    gleam.fillRect(-PRIZE_GLEAM_REACH, -1, PRIZE_GLEAM_REACH * 2, 2);
    gleam.fillRect(-2, -2, 4, 4);
    gleam.setPosition(x, y - TILE_SIZE / 2 - 2);
    this.tweens.add({
      targets: gleam,
      alpha: { from: 1, to: 0.35 },
      scale: { from: 1, to: 0.6 },
      duration: PRIZE_GLEAM_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.mapObjects.push(gleam);

    const label = new WorldLabel(this, {
      subject: prizeRect(loot.position),
      text: ITEMS[loot.itemId].displayName.toUpperCase(),
      tone: LABEL_TONES.prize,
      depth: atRow(CAPTION_BAND, loot.position.y),
      speech: { voice: 'prize', tiles: [loot.position] },
    });
    this.worldLabels.push(label);
    this.prizeLabels.set(loot.id, label);
  }

  /**
   * Every prize on this map that the camera can currently see, remembered for
   * the rest of the raid.
   *
   * Seeing is the camera's view rather than the survey disc: the survey is what
   * the drop-in map lights and is deliberately tighter than a screen, and a
   * prize the player has looked straight at but not walked within four tiles of
   * is exactly the case the chip exists for.
   */
  private notePrizesInView(): void {
    if (!this.isLootAvailable()) {
      return;
    }
    const view = this.cameras.main.worldView;
    for (const loot of getVisibleLoot(
      this.lootForCurrentMap(),
      true,
      this.collectedLootIds,
    )) {
      if (!isPrize(loot) || this.seenPrizeIds.has(loot.id)) {
        continue;
      }
      const x = loot.position.x * TILE_SIZE + TILE_SIZE / 2;
      const y = loot.position.y * TILE_SIZE + TILE_SIZE / 2;
      if (x >= view.left && x <= view.right && y >= view.top && y <= view.bottom) {
        this.seenPrizeIds.add(loot.id);
        audioManager.play('prizeSighted');
      }
    }
  }

  /**
   * Rare finds this raid saw and is leaving on the ground, for the result
   * screen. Every map the raid could have walked, because a prize is left
   * behind on the map it was seen on, not on the one the exit is.
   */
  private prizesLeftBehindNow(): readonly string[] {
    const plan = this.runSession?.plan;
    return prizesLeftBehind(
      plan?.loot ?? { [this.currentMap.id]: this.currentMap.loot },
      this.seenPrizeIds,
      this.collectedLootIds,
    ).map((itemId) => ITEMS[itemId].displayName);
  }

  /**
   * The nearest prize this raid has seen and not picked up, for the chip - or
   * null, which is most raids.
   */
  private prizeInMind(): PrizeChipInput | null {
    if (!this.isLootAvailable()) {
      return null;
    }
    let nearest: { readonly loot: WorldLoot; readonly steps: number } | null = null;
    for (const loot of getVisibleLoot(this.lootForCurrentMap(), true, this.collectedLootIds)) {
      if (!this.seenPrizeIds.has(loot.id)) {
        continue;
      }
      const steps = manhattan(this.currentTile, loot.position);
      if (nearest === null || steps < nearest.steps) {
        nearest = { loot, steps };
      }
    }
    return nearest === null
      ? null
      : {
        name: ITEMS[nearest.loot.itemId].displayName,
        direction: this.headingTo(nearest.loot.position),
        distance: nearest.steps,
      };
  }

  private createPois(): void {
    if (!this.isLootAvailable()) {
      return;
    }

    for (const poi of this.currentMap.pois) {
      if (this.activatedPoiIds.has(poi.id)) {
        continue;
      }
      // A landmark a banked contract finished with for good. It still stands -
      // taking it off the map would leave the player nothing to read their own
      // work off - but it is drawn done: the finished icon, the quiet tone, and
      // a caption saying what it is now rather than what working it would open.
      const worked = isLandmarkWorked(poi.id, this.completedContracts);
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
            worked
              ? WORLD_ICONS.landmarkWorked
              : poi.effect === 'unlock-extraction'
                ? WORLD_ICONS.radioMast
                : poi.locked
                  ? WORLD_ICONS.lockedCrate
                  : WORLD_ICONS.supplyCache,
          ),
        ),
      );
      const label = new WorldLabel(this, {
        subject: tileRect(poi.position),
        // Oak's Field Station is both a sealed exit and a cache, so the label
        // has to say so - the mast art can only show one of the two.
        text: worked
          ? workedLandmarkCaption(poi, worked)
          : `${poi.label}\n${poi.effect === 'unlock-extraction'
            ? `${poi.unlockedExtractionLabel ?? 'EXIT'}: SEALED${poi.reward.length > 0 ? ' + CACHE' : ''}`
            : // A locked crate keeps what is in it to itself: the lock is the
              // line, and the whole cache on a third one was a caption too wide
              // to find a seat beside the crate.
              poi.locked
              ? 'LOCKED: NEEDS A LOCKPICK'
              : `CACHE: ${formatPoiReward(poi)}`}`,
        tone: worked ? LABEL_TONES.worked : LABEL_TONES.station,
        depth: atRow(CAPTION_BAND, poi.position.y),
        speech: { voice: 'name', tiles: [poi.position] },
      });
      this.worldLabels.push(label);
      this.poiLabels.set(poi.id, label);
      this.poiSprites.set(poi.id, station);
      this.mapObjects.push(station);
    }
  }

  /**
   * The one route on the map only the player has, named so it is not guessed at.
   *
   * A bank is drawn all over these maps and none of the others may be hopped,
   * so the one that may says so - and says the only thing that matters about
   * it, which is that there is no way back up. It speaks like any other name:
   * within five walking steps, or on a held look.
   */
  private createLedgeLabels(): void {
    for (const ledge of ledgesForMap(this.currentMap.id)) {
      for (const tile of ledge.brow) {
        this.paintLedgeMark(tile, ledge.drop);
      }
      // The bank rather than the brow, because the brow is the tile the player
      // is standing on when the caption speaks - and a caption gives the player
      // room while any other seat is clear, so one named after the ground under
      // their feet has nowhere left to sit. Seated on the far side of the drop,
      // it is on the ground the hop lands on: exactly what it is about.
      const tiles = [...ledge.brow, ...ledge.brow.flatMap((from) => ledgeHopTiles(ledge, from).slice(0, -1))];
      const left = Math.min(...tiles.map((tile) => tile.x));
      const top = Math.min(...tiles.map((tile) => tile.y));
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: {
            x: left * TILE_SIZE,
            y: top * TILE_SIZE,
            width: (Math.max(...tiles.map((tile) => tile.x)) - left + 1) * TILE_SIZE,
            height: (Math.max(...tiles.map((tile) => tile.y)) - top + 1) * TILE_SIZE,
          },
          text: ledgeCaption(ledge),
          tone: LABEL_TONES.ledge,
          depth: atRow(CAPTION_BAND, top),
          placement: ledge.drop === 'up' ? 'above' : 'below',
          speech: { voice: 'name', tiles: ledge.brow },
        }),
      );
    }
  }

  /**
   * Two chevrons on the brow, pointing the way the drop goes.
   *
   * Painted a pixel at a time, as the player's own marker and the drop-in pad
   * are, so it stays as crisp as the art it lies on. The dark row under each
   * one is what keeps it readable on grass, which is the only ground a brow has
   * been drawn on so far.
   */
  private paintLedgeMark(tile: GridPosition, drop: Direction): void {
    const mark = this.add.graphics().setDepth(atRow(MARKER_BAND, tile.y));
    const originX = tile.x * TILE_SIZE;
    const originY = tile.y * TILE_SIZE;
    // Tile-local pixels of a shallow V pointing down, drawn twice; every other
    // direction is the same V turned.
    const turn = (x: number, y: number): [number, number] =>
      drop === 'down'
        ? [x, y]
        : drop === 'up'
          ? [x, TILE_SIZE - 1 - y]
          : drop === 'right'
            ? [y, x]
            : [TILE_SIZE - 1 - y, x];
    for (const shade of [true, false]) {
      mark.fillStyle(shade ? LEDGE_MARK_SHADE : LEDGE_MARK_TINT, shade ? 0.5 : 1);
      for (const top of [6, 10]) {
        for (let step = 0; step < 4; step += 1) {
          for (const x of [4 + step, 11 - step]) {
            const [px, py] = turn(x, top + step + (shade ? 1 : 0));
            mark.fillRect(originX + px, originY + py, 1, 1);
          }
        }
      }
    }
    this.mapObjects.push(mark);
  }

  /** Every raid boundary names where it leads, so no route has to be guessed. */
  private createRouteTransitionLabels(): void {
    const session = this.runSession;
    if (!session) {
      return;
    }
    const contract = session.plan?.contract;

    for (const warp of this.currentMap.warps) {
      // A way through to another place of this same map is a door, named by
      // the place it leads into (`createDoorwayLabels`).
      if (warp.destinationMapId === this.currentMap.id) {
        continue;
      }
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
          text: `${worldMapName(warp.destinationMapId).toUpperCase()} ${this.warpArrow(warp)}`,
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

  /**
   * Names every way through on a map made of several places by where it
   * leads: the house's name over its door, the street's over the mat inside,
   * with the way to press. A door is a name like any other, spoken once the
   * player has walked up to it - from across a street every front door saying
   * what it is would bury the street.
   */
  private createDoorwayLabels(): void {
    const areas = this.currentMap.areas;
    if (!this.runSession || !areas) {
      return;
    }
    const doorways: { readonly spec: WorldLabelSpec; readonly key: string }[] = [];
    for (const warp of this.currentMap.warps) {
      if (
        warp.destinationMapId !== this.currentMap.id ||
        warp.activation !== 'push' ||
        !warp.toward ||
        warp.secondary
      ) {
        continue;
      }
      const leadsTo = placedAreaAt(areas, warp.destination);
      if (!leadsTo) {
        continue;
      }
      const doorway = nextTileFromDirection(warp.source, warp.toward);
      // The doorway, the tile it is gone through from, and what is drawn to
      // go through it: the caption sits by the whole of it - beside a
      // stairwell, not on its steps - rather than on the person standing at it.
      const art = warp.art ?? { x: doorway.x, y: doorway.y, width: 1, height: 1 };
      const left = Math.min(warp.source.x, doorway.x, art.x);
      const top = Math.min(warp.source.y, doorway.y, art.y);
      const right = Math.max(warp.source.x, doorway.x, art.x + art.width - 1);
      const bottom = Math.max(warp.source.y, doorway.y, art.y + art.height - 1);
      // Named for the place it comes out in, as the plate that rises there
      // will name it: the room, or the district outside its door.
      const text = `${districtAt(this.currentMap.id, warp.destination)?.name ?? leadsTo.name.toUpperCase()} ${PRESS_ARROWS[warp.toward]}`;
      doorways.push({
        key: `doors:${placedAreaAt(areas, warp.source)?.id ?? ''}:${text}`,
        spec: {
          subject: {
            x: left * TILE_SIZE,
            y: top * TILE_SIZE,
            width: (right - left + 1) * TILE_SIZE,
            height: (bottom - top + 1) * TILE_SIZE,
          },
          text,
          tone: LABEL_TONES.route,
          depth: atRow(CAPTION_BAND, warp.source.y),
          // On the near side of the doorway, so it never covers the door or
          // the stairs it names: under the tile in front of a door, over a mat.
          placement: warp.toward === 'down' ? 'above' : 'below',
          speech: { voice: 'name', tiles: [warp.source] },
        },
      });
    }
    // Two doors into the same room side by side are one sentence, said once
    // when both are on screen, as one keeper's two gates are: a building you
    // can walk into has two doors (`buildingInsides.ts`), and captioned one
    // each the street read THE PRESS HOUSE twice.
    for (const { spec, key } of doorways) {
      const together = doorways.filter((other) => other.key === key);
      if (together.length < 2) {
        this.worldLabels.push(new WorldLabel(this, spec));
        continue;
      }
      this.worldLabels.push(new WorldLabel(this, { ...spec, grouping: { group: key } }));
      if (together[0].spec === spec) {
        this.worldLabels.push(
          new WorldLabel(this, {
            ...spec,
            speech: { voice: 'name', tiles: together.flatMap((door) => door.spec.speech.tiles) },
            grouping: { speaksFor: key },
          }),
        );
      }
    }
  }

  private warpArrow(warp: MapWarp): string {
    if (warp.source.y === 0) return PRESS_ARROWS.up;
    if (warp.source.y === this.currentMap.height - 1) return PRESS_ARROWS.down;
    return warp.source.x === 0 ? PRESS_ARROWS.left : PRESS_ARROWS.right;
  }

  private createHunterSprite(): void {
    if (!this.isHunterOnCurrentMap()) {
      return;
    }
    // Drawn as this raid's rival (`hunters.ts`) - Blue, Misty and the rest are
    // their own FireRed art, which is what tells the hunter from everybody else
    // on the map now that it no longer wears the red tint.
    this.createFigure(
      HUNTER_FIGURE_ID,
      this.hunterState.position!,
      this.hunterFacing,
      'hunter',
      this.hunterRival().design,
    );
    this.hunterDrawnAs = this.hunterRival().id;
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

  /**
   * Whether an authored figure is on this tile right now.
   *
   * A sign and a trainer are where they were put; a townsperson with a beat may
   * have shifted a tile, and owns the tile they are stepping off until the step
   * has finished drawing.
   */
  private entityHolds(entity: WorldEntity, tile: GridPosition): boolean {
    if (this.wasMet(entity)) {
      return false;
    }
    if (entity.boulder) {
      const stands = this.boulderAt(entity);
      return stands.x === tile.x && stands.y === tile.y;
    }
    if (entity.barrier && this.barrierIsOpen(entity.barrier.id)) {
      return false;
    }
    const figure = this.idleFigures.find((standing) => standing.id === entity.id);
    const held: readonly GridPosition[] = figure ? idleHeldTiles(figure) : [entity.position];
    return held.some((stood) => stood.x === tile.x && stood.y === tile.y);
  }

  /**
   * Moves the townsfolk on their own small schedules.
   *
   * It is driven by the frame rather than by the raid clock, and it runs before
   * any of `update`'s early returns so a figure mid-step still finishes it while
   * the player is reading - but the beats themselves stop dead while anything is
   * on screen to read, because a person who walked off mid-sentence would leave
   * their own words hanging in the air. Nothing here spends raid time, and
   * nothing here touches the run's own randomness, so a seed plays the same raid
   * whatever the street happens to be doing.
   */
  private advanceIdleFigures(deltaMs: number): void {
    if (this.idleFigures.length === 0) {
      return;
    }
    const frozen =
      this.isWarping ||
      this.pendingHubTransition ||
      this.trainerPrompt !== undefined ||
      this.dialogBox.visible;
    this.idleFigures = advanceIdleFigures(this.idleFigures, {
      deltaMs,
      frozen,
      isTileFree: (tile) => !this.isBlocked(tile) && !this.isPlayerOn(tile),
      random: Math.random,
    });
    for (const frame of idleFrames(this.idleFigures)) {
      this.placeFigure(frame.id, frame.x, frame.y, frame.facing, { striding: frame.striding });
    }
  }

  /** The two tiles the player owns: the one they are on, and the one they are crossing to. */
  private isPlayerOn(tile: GridPosition): boolean {
    return (
      (this.currentTile.x === tile.x && this.currentTile.y === tile.y) ||
      (this.targetTile !== null && this.targetTile.x === tile.x && this.targetTile.y === tile.y)
    );
  }

  /**
   * Puts one figure on the map, in fractional tiles.
   *
   * The one place a figure that is not the player is positioned, sorted and
   * posed, so a cutscene's actor and a townsperson keeping their own schedule
   * are moved by the same code: both answer in fractional tiles, and both of
   * them walk a tile on elapsed milliseconds rather than on a tween, which is
   * what makes a 100ms test-mode frame play the same as six 16ms ones.
   */
  private placeFigure(
    id: string,
    x: number,
    y: number,
    facing: Direction,
    options: { readonly visible?: boolean; readonly striding?: boolean } = {},
  ): void {
    const sprite = this.npcSprites.get(id);
    if (!sprite) {
      return;
    }
    sprite
      .setPosition(x * TILE_SIZE, y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET)
      .setDepth(atRow(FIGURE_BAND, y))
      .setVisible(options.visible ?? true);
    const appearance = this.npcAppearances.get(id);
    if (!appearance) {
      return;
    }
    // One stride frame rather than an animation: a shift of a single tile is
    // one pace, and a looping cycle on it reads as somebody jogging on the spot.
    sprite.setFrame(
      options.striding
        ? getWalkFrames(facing, appearance.sheetColumns)[0]
        : worldCharacterIdleFrame(appearance, facing),
    );
  }

  /**
   * A Pokemon a map maker stood in the world: its party icon, bobbing between
   * its two frames as FireRed's party menu draws it, standing on its tile with
   * its feet where a person's are. It is solid like a person - the map's
   * entities already block their tiles - and never turns, because an icon has
   * one facing.
   */
  private createPokemonFigure(id: string, position: GridPosition, species: FigureSpeciesId): void {
    const [first, second] = pokemonIconFrames(species);
    const key = `pokemon-icon-${species}`;
    if (!this.anims.exists(key)) {
      this.anims.create({
        key,
        frames: [
          { key: POKEMON_ICON_TEXTURE, frame: first },
          { key: POKEMON_ICON_TEXTURE, frame: second },
        ],
        frameRate: 1000 / POKEMON_ICON_FRAME_MS,
        repeat: -1,
      });
    }
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE + TILE_SIZE / 2,
        (position.y + 1) * TILE_SIZE + pokemonSoleDrop(species),
        POKEMON_ICON_TEXTURE,
        first,
      )
      .setOrigin(0.5, 1)
      .setDepth(atRow(FIGURE_BAND, position.y))
      .play(key);
    this.npcSprites.set(id, sprite);
    this.mapObjects.push(sprite);
    // Fetched as it is stood up, so the cry it gives when spoken to is its own
    // rather than the stand-in tone a sample still on its way sounds.
    const dexId = getSpeciesById(species)?.dexId;
    if (dexId !== undefined) {
      void audioManager.loadCries([dexId]);
    }
  }

  /**
   * A berry tree a map maker planted: Emerald's own tree, standing on its tile
   * with its feet on the tile's last row and its crown in the tile above, as a
   * person's head is. Ripe, it sways between its two berried frames; picked
   * this raid, it stands bare.
   */
  private createBerryTree(id: string, position: GridPosition, berry: BerryId): void {
    const frames = berryTreeFrames(berry);
    const key = `berry-tree-${berry}`;
    if (!this.anims.exists(key)) {
      this.anims.create({
        key,
        frames: frames.ripe.map((frame) => ({ key: BERRY_TREE_TEXTURE, frame })),
        frameRate: 1000 / BERRY_TREE_SWAY_MS,
        repeat: -1,
      });
    }
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE + TILE_SIZE / 2,
        (position.y + 1) * TILE_SIZE,
        BERRY_TREE_TEXTURE,
        frames.bare,
      )
      .setOrigin(0.5, 1)
      .setDepth(atRow(FIGURE_BAND, position.y));
    if (!this.wasPicked(id)) {
      sprite.play(key);
    }
    this.npcSprites.set(id, sprite);
    this.mapObjects.push(sprite);
  }

  /**
   * A Strength boulder: FireRed's own, off the town sheet, drawn as a figure
   * rather than a tile because it moves.
   */
  private createBoulder(id: string, position: GridPosition): void {
    const texture = this.textures.get(TOWN_SHEET_SOURCE.source.textureKey);
    if (!texture.has(BOULDER_FRAME)) {
      const piece = TOWN_PIECES.strengthBoulder;
      texture.add(BOULDER_FRAME, 0, piece.column * TILE_SIZE, piece.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE + TILE_SIZE / 2,
        position.y * TILE_SIZE + TILE_SIZE / 2,
        TOWN_SHEET_SOURCE.source.textureKey,
        BOULDER_FRAME,
      )
      .setDepth(atRow(FIGURE_BAND, position.y));
    this.npcSprites.set(id, sprite);
    this.mapObjects.push(sprite);
  }

  /** Where a boulder stands this raid: where it was pushed to, else where the map put it. */
  private boulderAt(entity: WorldEntity): GridPosition {
    return this.runSession?.bouldersMoved?.[entity.id] ?? entity.position;
  }

  /** Whether a berry tree has been picked this raid. */
  private wasPicked(id: string): boolean {
    return (this.runSession?.berriesPicked ?? []).includes(id);
  }

  /**
   * A berry tree faced and spoken to: picked into the pack like a find, or
   * left on the tree with the pack's refusal when there is no room - the tree
   * keeps it, and is still ripe when the player comes back with a square free.
   */
  private pickBerry(entity: WorldEntity, berry: BerryId): readonly string[] {
    if (!this.runSession || this.wasPicked(entity.id)) {
      return berryTreeLines(berry, true);
    }
    const itemId = berryItemId(berry);
    if (!this.collectRunItem(itemId, 1)) {
      audioManager.play('denied');
      return [...berryTreeLines(berry, false), lootRefusalLine(itemId, 1, this.bag.count(itemId))];
    }
    (this.runSession.berriesPicked ??= []).push(entity.id);
    audioManager.play('lootPickup');
    const sprite = this.npcSprites.get(entity.id);
    sprite?.stop();
    sprite?.setFrame(berryTreeFrames(berry).bare);
    return [
      ...berryTreeLines(berry, false),
      `You picked the ${berryName(berry).toUpperCase()}!${this.reseatNote()}`,
    ];
  }

  /**
   * Walking into a boulder with a Pokemon that knows Strength pushes it a
   * tile, exactly as FireRed does - and is refused, as a bump, where it would
   * come to rest on anything a raid is for, and with a line where it would
   * wall the player off from every way out (`boulders.ts`).
   */
  private tryPushBoulder(facing: Direction): boolean {
    const target = nextTileFromDirection(this.currentTile, facing);
    const boulder = this.currentMap.entities.find(
      (entity) => entity.boulder && this.entityHolds(entity, target),
    );
    if (!boulder || !this.runSession || !fieldMoveUser(this.party.pokemon, 'strength')) {
      return false;
    }
    // A boulder that has fallen onto its switch stays there, as Victory Road's
    // does: pushed off again it could be walked to the next switch, and a
    // floor of switches would be one boulder's work.
    if (this.boulderIsSeated(boulder)) {
      return false;
    }
    const destination = boulderDestination(target, facing);
    if (!this.boulderMayRest(destination)) {
      return false;
    }
    const goals = this.reachableExitPositions();
    const blockedWith = (standing: GridPosition) => (tile: GridPosition) =>
      this.collisionData[tile.y][tile.x] ||
      (tile.x === standing.x && tile.y === standing.y) ||
      this.barredExitAt(tile) !== undefined ||
      this.currentMap.entities.some(
        (entity) => entity.id !== boulder.id && this.entityHolds(entity, tile),
      );
    const doorways = this.currentMap.warps.filter(
      (warp) => warp.destinationMapId === this.currentMap.id,
    );
    if (
      canStillReach(this.currentTile, goals, this.bounds, blockedWith(target), doorways) &&
      !canStillReach(this.currentTile, goals, this.bounds, blockedWith(destination), doorways)
    ) {
      audioManager.play('denied');
      this.facing = facing;
      this.dialogBox.showMessage(
        "The boulder won't go that way: it would wall off every way out.",
      );
      return true;
    }
    this.runSession.bouldersMoved = { ...this.runSession.bouldersMoved, [boulder.id]: destination };
    this.facing = facing;
    this.pushingAgainst = null;
    this.player.setFrame(this.playerIdleFrame(facing));
    const sprite = this.npcSprites.get(boulder.id);
    if (sprite) {
      sprite.setDepth(atRow(FIGURE_BAND, Math.max(target.y, destination.y)));
      this.tweens.add({
        targets: sprite,
        x: destination.x * TILE_SIZE + TILE_SIZE / 2,
        y: destination.y * TILE_SIZE + TILE_SIZE / 2,
        duration: STEP_DURATION_MS,
        onComplete: () => sprite.setDepth(atRow(FIGURE_BAND, destination.y)),
      });
    }
    audioManager.play('bump');
    const plate = switchAt(this.switchesHere(), destination);
    if (plate?.kind === 'plate' && !this.switchThrown(plate)) {
      this.time.delayedCall(STEP_DURATION_MS, () => this.throwSwitch(plate));
    }
    return true;
  }

  /** The switches of the map the raid is on. */
  private switchesHere(): readonly WorldSwitch[] {
    return switchesOn(this.currentMap.id);
  }

  private switchThrown(thrown: WorldSwitch): boolean {
    return (this.runSession?.switchesThrown ?? []).includes(thrown.id);
  }

  /** Whether a barrier stands open this raid: every switch that opens it thrown. */
  private barrierIsOpen(barrier: string): boolean {
    return isBarrierOpen(barrier, this.switchesHere(), this.runSession?.switchesThrown ?? []);
  }

  /** Whether a boulder stands on a floor switch it has thrown, where it stays. */
  private boulderIsSeated(boulder: WorldEntity): boolean {
    const plate = switchAt(this.switchesHere(), this.boulderAt(boulder));
    return plate?.kind === 'plate' && this.switchThrown(plate);
  }

  /**
   * Throws a switch for the rest of the raid, and lifts every barrier that was
   * waiting on it last: the rock goes with FireRed's crack and nothing else,
   * because Victory Road's barrier lifts without a word.
   */
  private throwSwitch(thrown: WorldSwitch): void {
    if (!this.runSession || this.switchThrown(thrown)) {
      return;
    }
    const before = this.runSession.switchesThrown ?? [];
    const opened = barriersOpenedBy(thrown, this.switchesHere(), before);
    this.runSession.switchesThrown = [...before, thrown.id];
    this.refreshLiftLabels();
    if (opened.length === 0) {
      audioManager.play('select');
      return;
    }
    if (thrown.kind === 'key') {
      // A door opened with its card slides back; nothing cracks.
      audioManager.play('landmarkWorked');
    } else {
      audioManager.play('barrierLifts');
      this.cameras.main.shake(120, 0.003);
    }
    for (const entity of this.currentMap.entities) {
      if (entity.barrier && opened.includes(entity.barrier.id)) {
        const sprite = this.npcSprites.get(entity.id);
        sprite?.destroy();
        this.npcSprites.delete(entity.id);
      }
    }
  }

  /**
   * Victory Road's floor switches, drawn on the floor under everything that
   * stands: a plate is ground a boulder is pushed onto, never a figure.
   */
  private createSwitchPlates(): void {
    const plates = this.switchesHere().filter((candidate) => candidate.kind === 'plate');
    if (plates.length === 0) {
      return;
    }
    const texture = this.textures.get(AREA_SHEET_SOURCE.source.textureKey);
    if (!texture.has(SWITCH_UP_FRAME)) {
      const piece = AREA_PIECES['cave.switch'];
      texture.add(SWITCH_UP_FRAME, 0, piece.column * TILE_SIZE, piece.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    for (const plate of plates) {
      const sprite = this.add
        .sprite(
          plate.position.x * TILE_SIZE + TILE_SIZE / 2,
          plate.position.y * TILE_SIZE + TILE_SIZE / 2,
          AREA_SHEET_SOURCE.source.textureKey,
          SWITCH_UP_FRAME,
        )
        .setDepth(atRow(MARKER_BAND, plate.position.y));
      this.mapObjects.push(sprite);
    }
  }

  /**
   * One tile of a barrier: a rock barrier's top on its first row and its foot
   * below, or the cell of the hideout's shutter it is.
   */
  private createBarrier(
    id: string,
    position: GridPosition,
    top: boolean,
    shutterCell?: { readonly dx: number; readonly dy: number },
  ): void {
    if (shutterCell) {
      const sheet = this.textures.get(HIDEOUT_SHEET_SOURCE.source.textureKey);
      const frame = SHUTTER_FRAME(shutterCell.dx, shutterCell.dy);
      if (!sheet.has(frame)) {
        const piece = HIDEOUT_PIECES['hideout.shutter'];
        sheet.add(
          frame,
          0,
          (piece.column + shutterCell.dx) * TILE_SIZE,
          (piece.row + shutterCell.dy) * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
      const sprite = this.add
        .sprite(
          position.x * TILE_SIZE + TILE_SIZE / 2,
          position.y * TILE_SIZE + TILE_SIZE / 2,
          HIDEOUT_SHEET_SOURCE.source.textureKey,
          frame,
        )
        // The shutter is a door in the floor, not a figure: drawn under them.
        .setDepth(atRow(MARKER_BAND, position.y));
      this.npcSprites.set(id, sprite);
      this.mapObjects.push(sprite);
      return;
    }
    const texture = this.textures.get(AREA_SHEET_SOURCE.source.textureKey);
    if (!texture.has(BARRIER_TOP_FRAME)) {
      const piece = AREA_PIECES['cave.barrier'];
      texture.add(BARRIER_TOP_FRAME, 0, piece.column * TILE_SIZE, piece.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      texture.add(BARRIER_FOOT_FRAME, 0, piece.column * TILE_SIZE, (piece.row + 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE + TILE_SIZE / 2,
        position.y * TILE_SIZE + TILE_SIZE / 2,
        AREA_SHEET_SOURCE.source.textureKey,
        top ? BARRIER_TOP_FRAME : BARRIER_FOOT_FRAME,
      )
      .setDepth(atRow(FIGURE_BAND, position.y));
    this.npcSprites.set(id, sprite);
    this.mapObjects.push(sprite);
  }

  /**
   * Leaving a cave puts its boulders back where they started, as FireRed's
   * are put back whenever a map is loaded again - all but those that fell onto
   * a switch - so a floor pushed wrong is a walk out and back in, never a raid
   * lost. Nobody is in the place left behind to see it.
   */
  private resetBouldersLeftIn(area: PlacedArea | null): void {
    const moved = this.runSession?.bouldersMoved;
    if (!area || !moved) {
      return;
    }
    const inside = (tile: GridPosition) =>
      tile.x >= area.rect.x &&
      tile.y >= area.rect.y &&
      tile.x < area.rect.x + area.rect.width &&
      tile.y < area.rect.y + area.rect.height;
    const kept: Record<string, GridPosition> = {};
    for (const entity of this.currentMap.entities) {
      const at = moved[entity.id];
      if (!entity.boulder || !at) {
        continue;
      }
      const hunterOnStart =
        this.isHunterOnCurrentMap() &&
        this.hunterState.position!.x === entity.position.x &&
        this.hunterState.position!.y === entity.position.y;
      if (!inside(entity.position) || this.boulderIsSeated(entity) || hunterOnStart) {
        kept[entity.id] = at;
        continue;
      }
      this.npcSprites
        .get(entity.id)
        ?.setPosition(entity.position.x * TILE_SIZE + TILE_SIZE / 2, entity.position.y * TILE_SIZE + TILE_SIZE / 2)
        .setDepth(atRow(FIGURE_BAND, entity.position.y));
    }
    this.runSession!.bouldersMoved = kept;
  }

  /**
   * Where a boulder may come to rest: open ground nobody is standing on, and
   * nothing a raid is for - an exit, a drop-in, an item, a landmark, a door, a
   * warp - because a boulder parked on one of those is that thing gone.
   */
  private boulderMayRest(tile: GridPosition): boolean {
    if (
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= this.bounds.width ||
      tile.y >= this.bounds.height ||
      this.isBlocked(tile)
    ) {
      return false;
    }
    const here = (spot: GridPosition): boolean => spot.x === tile.x && spot.y === tile.y;
    return !(
      this.extractionPointsForCurrentMap().some((point) => here(point.position)) ||
      insertionsOn(this.currentMap.id).some((insertion) => here(insertion.position)) ||
      getVisibleLoot(this.lootForCurrentMap(), true, this.collectedLootIds).some((loot) =>
        here(loot.position),
      ) ||
      this.currentMap.pois.some((poi) => here(poi.position)) ||
      this.currentMap.gates.some((gate) => gate.tiles.some(here)) ||
      this.currentMap.warps.some((warp) => here(warp.source))
    );
  }

  /**
   * An exit still barred on this tile - under its rubble, or behind a gate its
   * key has not opened: a wall until it is opened.
   */
  private barredExitAt(tile: GridPosition): ExtractionPoint | undefined {
    // Asked of every tile the hunter's search touches, so the map's barred
    // exits are read once per map rather than once per tile - and a map with
    // none answers before anything else is looked at.
    if (this.barredExits?.mapId !== this.currentMap.id) {
      this.barredExits = {
        mapId: this.currentMap.id,
        points: extractionPointsOn(this.currentMap.id).filter(isBarredExit),
      };
    }
    return this.barredExits.points.find(
      (point) =>
        point.position.x === tile.x &&
        point.position.y === tile.y &&
        !this.isExtractionOpen(point),
    );
  }

  /**
   * A barred exit faced with the interact key: rubble dug out with a Pickaxe,
   * or a locked gate opened with its own key. Either way the exit is open for
   * the rest of this raid - not for good, so the tool is worth its squares
   * every raid it is carried on, and neither is used up. Null where there is
   * no barred exit.
   */
  private tryOpenBarredExitAt(tile: GridPosition): readonly string[] | null {
    const point = this.barredExitAt(tile);
    const opener = point ? itemThatOpens(point) : undefined;
    if (!point || !opener || !this.runSession) {
      return null;
    }
    const keyName = ITEMS[opener].displayName;
    if (this.bag.count(opener) === 0) {
      audioManager.play('denied');
      return isDugExit(point)
        ? [
            'Rubble, packed hard. There is a way out somewhere behind it.',
            'A Pickaxe in the pack would dig it out. Bill trades them.',
          ]
        : // FireRed's own words for a locked door, then for the key it wants
          // (`CinnabarIsland_Text_DoorIsLocked`, `Text_ItNeedsCardKey`).
          // Then where that key comes from, as the rubble and the water say
          // Bill trades their tools: a key is never sold, it is a prize laid
          // on its own gate's map, and a player who did not know that went
          // looking for it at Bill's.
          [
            `${point.label}: the gate is locked…`,
            `No! It needs the ${keyName}!`,
            ...(this.currentMap.loot.some((loot) => loot.itemId === opener)
              ? [`The ${keyName} is a rare find, somewhere on this map.`]
              : []),
          ];
    }
    this.runSession.exitsOpened = [...(this.runSession.exitsOpened ?? []), point.label];
    audioManager.play('landmarkWorked');
    if (isDugExit(point)) {
      this.cameras.main.shake(120, 0.004);
    }
    this.refreshExtractionMarkers();
    return [
      isDugExit(point)
        ? 'You swung the Pickaxe into the rubble and dug it out.'
        : // FireRed's `Text_CardKeyOpenedDoor`, with this gate's key in it.
          `Bingo! The ${keyName} opened the gate!`,
      `${point.label} is open: a way out, for this raid.`,
    ];
  }

  /**
   * Where this raid's exits are that a player can walk into now: every exit
   * but a barred one nobody has opened, which is a wall. The hunter and a
   * pushed boulder are both told these, never a gate the player cannot open.
   */
  private reachableExitPositions(): GridPosition[] {
    return this.extractionPointsForCurrentMap()
      .filter((point) => !isBarredExit(point) || this.isExtractionOpen(point))
      .map((point) => point.position);
  }

  /**
   * Open water faced with the interact key: a cast with the best rod in the
   * pack, or a line saying what would reach what lives there. Anything else in
   * front of the player is left alone.
   */
  private tryFishAt(tile: GridPosition): void {
    if (!this.runSession || !isFishingWater(this.currentMap, tile)) {
      return;
    }
    const rod = bestRod((itemId) => this.bag.count(itemId));
    if (!rod) {
      this.dialogBox.showMessages([
        'The water is deep, and something is moving in it.',
        'A fishing rod in the pack would reach it. Bill trades them.',
      ]);
      return;
    }
    const rng = this.runSession.rng;
    const plan = planCast(rng === undefined ? undefined : () => rng.next());
    const float = this.drawFloat(tile);
    this.fishing = {
      rod,
      water: fishingWaterAt(this.currentMap.id, tile),
      plan,
      float,
      floatY: float.y,
      elapsedMs: 0,
      dots: 0,
    };
    this.showIdlePose();
    audioManager.play('rodCast');
    // The float is what a cast is watched on, so the box goes to the top
    // rather than over it when the water is low on the screen.
    this.seatDialog([tile]);
    this.dialogBox.showProgress('');
  }

  /**
   * The float, on the water the line went into: red over white, as these games
   * draw one, a pixel of bob while it waits and under the surface on a bite.
   */
  private drawFloat(tile: GridPosition): Phaser.GameObjects.Graphics {
    return paintFloat(this.add.graphics(), false)
      .setPosition(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2)
      .setDepth(atRow(MARKER_BAND, tile.y));
  }

  /**
   * One frame of a cast: the dots come up a third of a second apart after a
   * second's cast, and when the last is up the water answers - nothing, or a
   * Pokemon on the hook, whose fight starts when the line is read.
   */
  private advanceFishing(deltaMs: number): void {
    const cast = this.fishing;
    if (!cast) {
      return;
    }
    cast.elapsedMs += deltaMs;
    const dots = dotsShown(cast.plan, cast.elapsedMs);
    if (dots !== cast.dots) {
      cast.dots = dots;
      this.dialogBox.showProgress(Array.from({ length: dots }, () => '·').join(' '));
    }
    cast.float.setY(cast.floatY + (Math.floor(cast.elapsedMs / 400) % 2));
    if (cast.elapsedMs < castDurationMs(cast.plan)) {
      return;
    }
    if (!cast.plan.bites) {
      this.stopFishing();
      this.dialogBox.showMessages([NOT_EVEN_A_NIBBLE]);
      return;
    }
    const rng = this.runSession?.rng;
    const wild = rollEncounter(
      fishingTable(cast.water, cast.rod),
      rng === undefined ? undefined : () => rng.next(),
    );
    paintFloat(cast.float.clear(), true).setY(cast.floatY);
    audioManager.play('fishBite');
    this.cameras.main.shake(90, 0.003);
    this.fishing = undefined;
    // The float stays under until the fight takes the screen; the line is read
    // first, and the fight follows it as a standing Pokemon's does.
    this.mapObjects.push(cast.float);
    this.pendingWildBattle = wild ?? undefined;
    this.dialogBox.showMessages([ON_THE_HOOK]);
  }

  /** Puts a cast away unanswered: the float out of the water and the box down. */
  private stopFishing(): void {
    if (!this.fishing) {
      return;
    }
    this.fishing.float.destroy();
    this.fishing = undefined;
    this.dialogBox.setVisible(false);
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
    // Dressed on foot; `settleRiding` puts a rider back on straight after.
    this.riding = false;
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
    this.playerHeadMark.setPosition(x, y + (this.riding ? BIKE_HEAD_DROP : 0));
  }

  /**
   * The chevron gives way to anybody standing in the tile above the player,
   * where it would be drawn over their face (`headMarkCoversSomebody`). Asked
   * every frame, after the step and the townsfolk have moved, so a trainer
   * walking up or a neighbour stepping in is cleared the frame they arrive.
   */
  private settleHeadMark(): void {
    if (!this.player || !this.playerHeadMark) {
      return;
    }
    const figures: Phaser.GameObjects.Sprite[] = [];
    for (const id of this.npcAppearances.keys()) {
      const sprite = this.npcSprites.get(id);
      if (sprite?.visible) {
        figures.push(sprite);
      }
    }
    this.playerHeadMark.setAlpha(headMarkCoversSomebody(this.player, figures, TILE_SIZE) ? 0 : 1);
  }

  // -- the partner -----------------------------------------------------------

  /** Who walks at the player's heel as the raid now stands (`world/raidFollower.ts`). */
  private followerNow(): RaidFollower | null {
    return raidFollower({
      party: this.party.pokemon,
      ...(this.runSession?.partner === undefined ? {} : { partner: this.runSession.partner }),
    });
  }

  /**
   * The follower, standing where it would have walked in: behind the player,
   * else beside them (`arrivalPlace`). Dropping in, it comes out of its ball
   * after them; back from a fight, it is simply there, as the player is.
   */
  private createPartner(fadeIn: boolean): void {
    const who = this.followerNow();
    if (!who) {
      return;
    }
    const place = arrivalPlace(this.currentTile, this.facing, (tile) => this.partnerCanStand(tile));
    this.partner = new PartnerFigure(this, this.partnerHost(), who, place, { fadeIn });
  }

  /** The player, as the partner reads them (`PartnerHost`). */
  private partnerHost(): PartnerHost {
    return {
      playerTile: () => this.currentTile,
      playerStepping: () => this.targetTile !== null,
      stepProgress: () => this.stepProgress,
      player: this.player,
      playerHeadMark: this.playerHeadMark,
      reading: () => this.dialogBox.visible,
      standingAbout: () => this.targetTile === null && !this.isWarping,
      quiet: () => this.cutscene !== undefined || this.trainerPrompt !== undefined,
    };
  }

  /**
   * Ground the follower may arrive on: on the map, open, nobody on it, and not
   * a doorway - a building is drawn over whoever stands in one.
   */
  private partnerCanStand(tile: GridPosition): boolean {
    return (
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x < this.bounds.width &&
      tile.y < this.bounds.height &&
      !this.isBlocked(tile) &&
      getWarpAt(this.currentMap, tile, 'step') === undefined
    );
  }

  /** Through a door or off a warp: the follower stands beside the player on the far side. */
  private standPartnerBesidePlayer(): void {
    this.partner?.standAt(arrivalPlace(this.currentTile, this.facing, (tile) => this.partnerCanStand(tile)));
  }

  /**
   * The follower's frame. Who it is is asked again first, so a party put in
   * a new order, an evolution or a gift changes it on the spot; and it gets
   * out of the way of anybody who steps onto its tile - the hunter, a
   * townsperson keeping their beat - by going after the player into theirs.
   */
  private updatePartner(deltaMs: number): void {
    const who = this.followerNow();
    const current = this.partner;
    if (!sameFollower(who, current && { pokemon: current.pokemon, species: current.species })) {
      const place = current?.place;
      current?.destroy();
      this.partner = who
        ? new PartnerFigure(
          this,
          this.partnerHost(),
          who,
          place?.out ? place : arrivalPlace(this.currentTile, this.facing, (tile) => this.partnerCanStand(tile)),
        )
        : null;
    }
    const partner = this.partner;
    if (!partner) {
      return;
    }
    if (partner.place.out && !partner.tucking && this.isBlocked(partner.place.tile)) {
      partner.tuckIn();
    }
    partner.update(deltaMs);
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
    this.surveyGround();
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
    recordAction(`Walked into ${district.name}`);
  }

  /**
   * Whether losing the window would cost this raid anything: a raid being
   * walked, with its clock running. Not while the pack, the party or the field
   * guide has the world paused (the clock is already stopped), and not once
   * the raid has ended and is on its way to the result screen.
   */
  public canPauseForWindow(): boolean {
    return (
      this.windowPausePlate === null &&
      this.sys.isActive() &&
      this.runSession?.manager.phase === RunPhase.InRun &&
      !this.pendingHubTransition
    );
  }

  /**
   * Stops the raid where it stands - the clock, the hunter, every tween and
   * timer the scene owns, because a paused scene is not stepped at all - and
   * puts the plate over it. The plate is drawn before the pause, and a paused
   * scene is still drawn.
   */
  public pauseForWindow(): void {
    this.windowPausePlate = new PausePlate(this, WINDOW_PAUSE_TITLE, WINDOW_PAUSE_LINES);
    recordAction('Paused: the window lost focus');
    // At once, not through `this.scene.pause()`: that is queued for the next
    // frame, and a window that has gone to the back may not draw one until it
    // is in front again - which left the raid unpaused under its plate.
    this.sys.pause();
  }

  public resumeFromWindowPause(): void {
    this.windowPausePlate?.destroy();
    this.windowPausePlate = null;
    if (this.sys.isPaused()) {
      recordAction('Resumed the raid');
      this.sys.resume();
    }
  }

  /** Where the raid is, for a feedback message. See `feedback/feedbackContext.ts`. */
  public feedbackContext(): readonly FeedbackDetail[] {
    const manager = this.runSession?.manager;
    const snapshot = manager?.snapshot();
    return [
      { label: 'Map', value: worldMapName(this.currentMap.id) },
      ...(this.placeName ? [{ label: 'Place', value: this.placeName }] : []),
      { label: 'Tile', value: `${this.currentTile.x}, ${this.currentTile.y}` },
      ...(manager && snapshot
        ? [
            {
              label: 'Raid clock',
              value: raidClockView(
                snapshot.remainingMs,
                manager.isEnraged,
                snapshot.enrageGraceRemainingMs,
                isPlaytestRun(),
                this.runSession?.plan?.night,
              ).label,
            },
          ]
        : []),
    ];
  }

  /** The weather of the district the player is standing in, or null. */
  private currentWeather(): WeatherId | null {
    return weatherAt(this.currentMap.id, this.currentTile);
  }

  /**
   * Writes the ground round the player into this raid's survey, which is what
   * the drop-in screen's picture of the map is drawn from.
   *
   * A disc rather than the camera's view: what the screen shows is most of a
   * district at once, and a map uncovered a screen at a time is uncovered in
   * two raids and never dark again. A disc the width of the shading a trainer
   * watches follows the road the player actually took, which is what makes the
   * picture at base a record of a journey rather than of a rectangle.
   */
  private surveyGround(): void {
    const session = this.runSession;
    if (!session || session.manager.phase !== RunPhase.InRun) {
      return;
    }
    const index = this.currentTile.y * this.currentMap.width + this.currentTile.x;
    if (this.surveyedFrom === index) {
      return;
    }
    this.surveyedFrom = index;
    this.surveyAround(this.currentTile);
  }

  /** The survey's disc round one tile, kept to the place of the map that tile is in. */
  private surveyAround(centre: GridPosition): void {
    const session = this.runSession;
    if (!session || session.manager.phase !== RunPhase.InRun) {
      return;
    }
    const surveyed = session.surveyed ?? new Set<number>();
    session.surveyed = surveyed;
    // Only the place the tile is in: on a map of several places laid side by
    // side, a disc round someone standing in a house would otherwise reach
    // across the dark into the edge of the outdoors.
    const areas = this.currentMap.areas;
    const area = areas ? (placedAreaAt(areas, centre) ?? areas[0])?.rect : undefined;
    const width = this.currentMap.width;
    for (const tile of tilesAround(
      centre,
      SURVEY_RADIUS,
      this.currentMap.width,
      this.currentMap.height,
    )) {
      if (area) {
        const x = tile % width;
        const y = (tile - x) / width;
        if (x < area.x || y < area.y || x >= area.x + area.width || y >= area.y + area.height) {
          continue;
        }
      }
      surveyed.add(tile);
    }
  }

  /**
   * Closes this raid's entry in the record kept at base: how it ended, and the
   * ground it walked. Called from every ending, because a raid lost on the last
   * step surveyed exactly as much ground as one that got home.
   */
  private recordRaid(outcome: 'extracted' | 'wiped'): void {
    this.surveyGround();
    new SaveManager().recordRaidEnded(this.currentMap.id, outcome, {
      width: this.currentMap.width,
      walked: this.runSession?.surveyed ?? [],
    });
    // The pack is laid out in the field as much as at base - a find is seated
    // in the room that is left and moved where the player wants it - so the
    // layout comes home with the raid, however the raid ended. It is seats and
    // never contents: a wipe still takes what it takes.
    new SaveManager().recordContainerArrangements(this.bag.arrangement);
  }

  /**
   * Redraws the corner chips from the raid's own state.
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
      ?? openRaidCue(
        { items: snapshot.foundItems.length, pokemon: snapshot.caughtPokemon.length },
        this.nearestExitCue(),
      );
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
    this.noteInterior();
    this.surveyGround();
    this.notePrizesInView();

    if (manager.isEnraged) {
      if (this.timerThreat !== 'enraged') {
        this.timerThreat = 'enraged';
        flashScreen(this.cameras.main, 160, [239, 68, 68]);
        audioManager.play('clockEnraged');
      }
    } else {
      const tier = raidClockAlertTier(snapshot.remainingMs);
      if (tier !== this.timerThreat) {
        this.timerThreat = tier;
        flashScreen(this.cameras.main, 120, [251, 191, 36]);
        audioManager.play('clockUrgent');
      }
    }

    // A box drawn across the top of the screen is drawn over the chips, which
    // stuck out either side of it half cut; while one is up they stand aside.
    const dialogOver = this.dialogBox.visible
      ? { x: this.dialogBox.x, y: this.dialogBox.y, width: DIALOG_WIDTH, height: DIALOG_HEIGHT }
      : null;
    hud.render(
      {
        clock: raidClockView(
          snapshot.remainingMs,
          manager.isEnraged,
          snapshot.enrageGraceRemainingMs,
          isPlaytestRun(),
          this.runSession?.plan?.night,
        ),
        objectiveLines: objectiveChipLines(navigationCue, this.objectiveDetailMs > 0, isPlaytestRun(), this.keysLearned),
        place: placePlateLine(this.placeName, this.placePlateMs),
        // Read off the tile rather than remembered with the district name: the
        // chip and the fight that is about to start have to be reading the same
        // thing, and `transitionToBattle` reads the tile too.
        weather: weatherChipLine(this.currentWeather()),
        // What the raid could still be for. Null until something rare has
        // actually been laid eyes on, which is most raids.
        prize: prizeChipView(this.prizeInMind()),
        friend: this.friendChip(),
        hunter: hunterChipView({
          searching: isHunterSearching(this.hunterState),
          searchRemainingMs: this.hunterState.searchRemainingMs,
          distance: this.hunterStepsAway(),
          direction: this.hunterBearing(),
          offTheScent:
            this.playerIsHidden() && isHunterOffTheScent(this.hunterState, this.currentTile),
          // The radio mast reports on a hunter that is still coming or still
          // here. One that has been beaten is out of the raid, and a line about
          // its next team would be a warning about nothing.
          ...(hasHunterIntel(session.workshopUpgrades) && !this.hunterState.defeated
            ? {
              intel: hunterIntelFor(
                snapshot.elapsedMs,
                snapshot.durationMs,
                manager.isEnraged,
                session.plan?.hunter,
                this.party.pokemon,
              ),
            }
            : {}),
        }),
      },
      this.time.now,
      dialogOver,
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
    return hunter ? this.headingTo(hunter) : 'HERE';
  }

  /**
   * Which way to go for a tile: straight at it, or on a map of several places
   * at the door the walk there goes through (`areaRoutes.ts`).
   */
  private headingTo(target: GridPosition): string {
    return directionTo(this.currentTile, wayTowards(this.currentMap, this.currentTile, target));
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
      Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.party],
      Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.bag],
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
      // The four letters the chip names are bound from the table it names them
      // from (`input/keyBindings.ts`), so a hint can never teach the wrong key.
      party: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.party]),
      bag: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.bag]),
      save: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      objectives: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.objectives]),
      look: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.look]),
      talk: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[ROOM_KEY_LETTERS.talk]),
      phrases: (['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'] as const).map((digit) =>
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes[digit]),
      ),
      ping: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[ROOM_KEY_LETTERS.ping]),
      // Never captured: an overlay above the world must keep its own shift.
      run: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false),
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
      this.controls.talk,
      this.controls.ping,
      ...this.controls.phrases,
    ]);
  }

  private configureCamera(): void {
    const area = this.currentArea();
    if (area) {
      this.frameArea(area);
    } else {
      const worldWidth = this.currentMap.width * TILE_SIZE;
      const worldHeight = this.currentMap.height * TILE_SIZE;
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    }
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true);
  }

  /**
   * The place of the map the player is in, on a map made of several - the
   * outdoors, or the inside of a building - and null on a map that is one.
   */
  private currentArea(): PlacedArea | null {
    const areas = this.currentMap.areas;
    if (!areas) {
      return null;
    }
    return placedAreaAt(areas, this.currentTile) ?? areas[0];
  }

  /**
   * Frames one place of a map made of several: the camera keeps to it, a room
   * smaller than the screen stands still in the middle of it the way a FireRed
   * room does (and the way the base's rooms already do), and everything outside
   * it is dark - the places are laid side by side in one grid, and the house
   * next door must never show through the gap.
   */
  private frameArea(area: PlacedArea): void {
    const camera = this.cameras.main;
    const x = area.rect.x * TILE_SIZE;
    const y = area.rect.y * TILE_SIZE;
    const width = area.rect.width * TILE_SIZE;
    const height = area.rect.height * TILE_SIZE;
    const viewWidth = this.scale.width / CAMERA_ZOOM;
    const viewHeight = this.scale.height / CAMERA_ZOOM;
    const left = width < viewWidth ? x + Math.floor((width - viewWidth) / 2) : x;
    const top = height < viewHeight ? y + Math.floor((height - viewHeight) / 2) : y;
    camera.setBackgroundColor(0x000000);
    camera.setBounds(left, top, Math.max(width, viewWidth), Math.max(height, viewHeight));
    // Four slabs of dark round the place, each reaching a screen past it, so
    // nothing of the grid beyond it is drawn whatever the camera does.
    const reach = Math.max(viewWidth, viewHeight) * 2;
    const slabs: readonly (readonly [number, number, number, number])[] = [
      [x - reach, y - reach, width + reach * 2, reach],
      [x - reach, y + height, width + reach * 2, reach],
      [x - reach, y, reach, height],
      [x + width, y, reach, height],
    ];
    this.areaDark.forEach((slab) => slab.destroy());
    this.areaDark = slabs.map(([sx, sy, sw, sh]) =>
      this.add.rectangle(sx, sy, sw, sh, 0x000000, 1).setOrigin(0, 0).setDepth(AREA_DARK_DEPTH),
    );
  }

  /**
   * Goes through a doorway, if the player is standing at one and pressing into
   * it: a building's door from the tile in front of it, or the edge of a room
   * from its mat. It is FireRed's rule for a door mat, and on a player's map it
   * is how every way through is gone through (`mapAreas.ts`). Somebody standing
   * on the far side is a wall like anyone else - unless it is the hunter, and
   * walking into the hunter, through a door or not, is being caught.
   */
  private tryPushThrough(facing: Direction): boolean {
    const warp = getWarpAt(this.currentMap, this.currentTile, 'push', facing);
    if (!warp) {
      return false;
    }
    const hunter = this.isHunterOnCurrentMap() ? this.hunterState.position : undefined;
    if (hunter && hunter.x === warp.destination.x && hunter.y === warp.destination.y) {
      this.facing = facing;
      this.catchPlayer(hunter);
      return true;
    }
    if (this.isBlocked(warp.destination)) {
      return false;
    }
    this.facing = facing;
    this.pushingAgainst = null;
    this.warp(warp);
    return true;
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
  private interrupt(lines: readonly WorldLine[], about: readonly GridPosition[] = []): void {
    // Whatever landed in front of the player takes the box the cast was using,
    // and the cast with it: a line that arrives unasked is read, not fished past.
    this.stopFishing();
    this.unsolicitedDialog = true;
    this.seatDialog(about);
    this.dialogBox.showMessages(
      lines.map((line) => (typeof line === 'string' ? line : line.text)),
      (index) => {
        const line = lines[index];
        if (typeof line !== 'string' && line?.obtained) {
          audioManager.play('itemObtained');
          this.dialogBox.hold(OBTAINED_HOLD_MS);
        }
      },
    );
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
    // A boat off a jetty, before the water it lies in is fished.
    if (this.tryBoard(this.facing, true)) {
      return;
    }
    if (this.tryRideLift(this.facing, true)) {
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
    const opened = this.tryFieldMoveAt(targetTile);
    if (opened !== null) {
      this.dialogBox.showMessages([...opened]);
      return;
    }
    const unbarred = this.tryOpenBarredExitAt(targetTile);
    if (unbarred !== null) {
      this.dialogBox.showMessages([...unbarred]);
      return;
    }
    const lever = switchAt(this.switchesHere(), targetTile);
    if (lever?.kind === 'lever') {
      if (!this.switchThrown(lever)) {
        // A lever that runs a lift is the generator that powers it, and says so.
        const powers = (this.currentMap.lifts ?? []).some((lift) => lift.id === lever.opens);
        this.dialogBox.showMessages(powers ? [...LIFT_RUNNING_LINES] : [...LEVER_LINES]);
        this.throwSwitch(lever);
      }
      return;
    }

    const entity = this.currentMap.entities.find((candidate) =>
      this.entityHolds(candidate, targetTile),
    );
    const trainer = this.trainersForCurrentMap().find(
      (candidate) => candidate.position.x === targetTile.x && candidate.position.y === targetTile.y,
    );
    if (!entity && !trainer) {
      this.tryFishAt(targetTile);
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

    // A Pokemon spoken to cries as its line goes up, as one stood in FireRed's
    // world does - fought or not, it is the same Pokemon saying the same thing.
    const cryOf = entity?.pokemon ? getSpeciesById(entity.pokemon)?.dexId : undefined;
    if (cryOf !== undefined) {
      audioManager.play('cry', { species: cryOf });
    }

    if (entity?.berry) {
      this.dialogBox.showMessages([...this.pickBerry(entity, entity.berry)]);
      return;
    }
    // FireRed's rock barrier is scenery: facing it says nothing. A door with
    // a lock in it is a door: faced, it asks for its card.
    if (entity?.barrier) {
      const lock = this.switchesHere().find(
        (candidate) => candidate.kind === 'key' && candidate.opens === entity.barrier!.id,
      );
      if (lock && !this.switchThrown(lock)) {
        this.dialogBox.showMessages([...this.turnKeyIn(lock)]);
      }
      return;
    }
    if (entity?.boulder) {
      this.dialogBox.showMessages([
        ...(this.boulderIsSeated(entity)
          ? SEATED_BOULDER_LINES
          : fieldMoveLines('strength', fieldMoveUser(this.party.pokemon, 'strength'))),
      ]);
      return;
    }

    if (entity?.pokemon && entity.wildLevel !== undefined) {
      this.meetPokemon(entity, entity.pokemon, entity.wildLevel);
      return;
    }

    const gift = entity ? giftGivenBy(entity.id) : undefined;
    if (gift) {
      this.dialogBox.showMessages([...this.speakForGift(gift, entity!.dialogLines)]);
      return;
    }

    this.dialogBox.showMessages(spokenLines(entity!.dialogLines, this.hunterRival().name));
  }

  /**
   * A standing Pokemon that fights: it cries, and when the line is read the
   * fight begins, as a wild one - beaten, caught or fled from, it is not there
   * again this raid (`ActiveRunSession.pokemonMet`), because the world is
   * rebuilt on the return from the fight and would otherwise stand it back up.
   * It is marked met as the fight is promised, so even a raid lost inside it
   * does not meet it twice.
   */
  private meetPokemon(entity: WorldEntity, species: FigureSpeciesId, level: number): void {
    if (this.runSession) {
      (this.runSession.pokemonMet ??= []).push(entity.id);
    }
    this.pendingWildBattle = {
      speciesId: species,
      level,
      // A legend is a boss you can keep: no ball until it is beaten, then one.
      ...(entity.legendary ? { legendary: true } : {}),
    };
    this.dialogBox.showMessages([...entity.dialogLines]);
  }

  /**
   * Whether a standing Pokemon is not there: fought already this raid, or a
   * legend this save has caught, which never stands again.
   */
  private wasMet(entity: WorldEntity): boolean {
    return (
      entity.pokemon !== undefined &&
      ((this.runSession?.pokemonMet ?? []).includes(entity.id) || legendCaught(entity, this.caughtLegends))
    );
  }

  /**
   * The field-move door in front of the player, worked or refused.
   *
   * Null when the tile is not one - every other reading of the interact key is
   * unaffected - and a pair of lines otherwise: what is in the way, and either
   * who moved it or why nobody could. An already-open door is not one of these,
   * because there is nothing left to do to it and the caption over it says OPEN.
   *
   * **The door opens for good, here, on this press.** It is written to the save
   * the moment it is worked rather than at extraction, exactly as a boss's win
   * is (`SaveManager.recordOpenedGates`), because a gate is the map changing and
   * not loot being carried out - a raid that cuts the wood and is then lost to
   * the hunter has still cut it. The list the scene then acts on is its own,
   * never a read-back from storage, so the door opens in the raid that opened it
   * even in a browser that cannot save.
   */
  private tryFieldMoveAt(tile: GridPosition): readonly string[] | null {
    // A night track pressed at by daylight is the other door here a press is
    // answered at: it says why there is no way through, and when there is one.
    const track = nightGateAt(this.currentMap.gates, tile);
    if (track && !isGateOpen(track, this.openedDoorKeys())) {
      return NIGHT_TRACK_LINES;
    }
    const gate = fieldMoveGateAt(this.currentMap.gates, tile);
    if (!gate || isGateOpen(gate, this.openedDoorKeys())) {
      return null;
    }
    const user = fieldMoveUser(this.party.pokemon, gate.fieldMove);
    const lines = fieldMoveLines(gate.fieldMove, user, gate.obstacle);
    if (!user) {
      audioManager.play('denied');
      return lines;
    }
    this.openedGates = [...new Set([...this.openedGates, gate.id])];
    new SaveManager().recordOpenedGates([gate.id]);
    // The same sound a landmark makes: the world changed because the player
    // did something to it, which is the whole of what these two events share.
    audioManager.play('landmarkWorked');
    // The map is a different map now: rebuilt from its sketch in the new gate
    // state, with the player left standing exactly where they were.
    this.currentMap = this.mapFor(this.currentMap.id);
    this.rebuildMapInPlace();
    return [...lines, fieldMoveOpenedLine(gate.label)];
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
    // A gift costs pack squares exactly as a catch does. With none to spare the
    // hand-over does not happen at all: the giver says so, nothing is recorded,
    // and they still have it when the player comes back with room.
    // Where only the arrangement was in the way the pack re-packs itself rather
    // than turning the gift away: a refusal has to mean there is no room.
    const room = clearPackRoomForPokemon(this.bag, pokemon);
    if (!room.fits) {
      audioManager.play('denied');
      return [
        ...gift.offer.slice(0, -1),
        `${packFullForPokemonLine(pokemon)} ${gift.offerNoRoomLine}`,
      ];
    }
    this.runSession.manager.registerGiftedPokemon(gift.id, pokemon);
    this.pendingGiftNickname = pokemon;
    this.packReseated = this.packReseated || room.reseated;
    syncPackCargo(this.bag, this.runSession.manager.snapshot());
    audioManager.play('catchSuccess');
    if (this.party.pokemon.length < PARTY_LIMIT) {
      this.party.addPokemon(pokemon);
      return room.reseated
        ? [...gift.offer.slice(0, -1), `${gift.offer[gift.offer.length - 1]}${this.reseatNote()}`]
        : gift.offer;
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
      onItemUsed: () => {
        // A Bicycle put down on the pack screen is not ridden away on.
        this.settleRiding();
        this.saveGame();
      },
      onItemDropped: (itemId: string, quantity: number) =>
        this.runSession?.manager.registerDroppedItem(itemId as ItemId, quantity),
      bike: { riding: this.riding, toggle: () => this.toggleBike() },
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
      // Headings across a door point at the door (`areaRoutes.ts`).
      towards: (target: GridPosition) => wayTowards(this.currentMap, this.currentTile, target),
      activatedPoiIds: [...this.activatedPoiIds],
      carried: (itemId: string) => this.bag.count(itemId),
      ...this.nearestOpenExitHere(),
      stepsTo: walkingStepsFrom(this.currentTile, this.collisionData, playerLinks(this.currentMap)),
      defeatedTrainerIds: [...this.defeatedTrainerIds],
      pausedWorld: true,
    });
  }

  /**
   * The open exit the fewest walking steps away and which way it is, for the
   * objective chip. The chip is drawn every frame and the search walks the
   * whole map, so it is asked again only when the player's tile, the map or
   * which exits are open has changed.
   */
  private nearestExitCue(): { readonly label: string; readonly heading: string } | undefined {
    const exits = (this.runSession?.plan?.extractionPoints ?? []).filter((point) => point.mapId === this.currentMap.id);
    const open = exits.filter((point) => this.isExtractionOpen(point)).map((point) => point.label).join('|');
    const key = `${this.currentMap.id}:${this.currentTile.x},${this.currentTile.y}:${open}`;
    if (this.exitCueKey !== key || this.exitCueGrid !== this.collisionData) {
      this.exitCueKey = key;
      this.exitCueGrid = this.collisionData;
      const exit = this.nearestOpenExitHere().nearestOpenExit;
      this.exitCue = exit ? { label: exit.label, heading: this.headingTo(exit.position) } : undefined;
    }
    return this.exitCue;
  }

  /** The open exit the fewest walking steps from the player, for the field guide. */
  private nearestOpenExitHere(): { readonly nearestOpenExit?: { readonly label: string; readonly position: GridPosition } } {
    const exit = nearestOpenExit(
      (this.runSession?.plan?.extractionPoints ?? []).filter((point) => point.mapId === this.currentMap.id),
      this.currentTile,
      this.collisionData,
      (point) => this.isExtractionOpen(point),
      this.currentMap.links,
    );
    return exit ? { nearestOpenExit: { label: exit.label, position: exit.position } } : {};
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
      return `TRAVEL TO ${worldMapName(contract.mapId).toUpperCase()}`;
    }
    const outstanding = remainingMarkers(contract, contractSteps);
    if (outstanding.length === 0) {
      if (contract.requiredExitLabel) {
        return this.requiredExitCue(contract.requiredExitLabel);
      }
      // The job is done and only walking out banks it, so the chip names the
      // way out - with an empty pack it fell through to FIND LOOT, THEN
      // EXTRACT, which sends a player holding a finished survey off looking.
      const exit = this.nearestExitCue();
      return exit ? `BANK VIA ${exit.label.toUpperCase()}: ${exit.heading}` : 'EXTRACT TO BANK THE CONTRACT';
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
    return `${next.cue}: ${this.headingTo(next.position)}${remaining}`;
  }

  /**
   * The chip once a contract's stops are made and only one exit banks it: which
   * way that exit is, or - while a landmark still seals it - which way the
   * landmark is, because walking to a shut gate with the job in hand is the
   * one wrong turn this contract is built round.
   */
  private requiredExitCue(label: string): string {
    const exit = this.extractionPointsForCurrentMap().find((point) => point.label === label);
    if (!exit) {
      return `BANK VIA ${label}`;
    }
    const seal = exit.requirement;
    const sealedBy =
      seal?.kind === 'poi-activated' && !this.isExtractionOpen(exit)
        ? this.currentMap.pois.find((poi) => poi.id === seal.poiId)
        : undefined;
    if (sealedBy) {
      return `${sealedBy.label}: ${this.headingTo(sealedBy.position)}, THEN ${label}`;
    }
    return `BANK VIA ${label}: ${this.headingTo(exit.position)}`;
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
    // step, because arriving at the drop without them wastes the whole raid -
    // after the briefing, never instead of it, or the raid opens without saying
    // where the drop is or which key is the field guide (playtest 47).
    const missing = missingCarryIn(contractCarryIn(contract), (itemId) => this.bag.count(itemId));
    this.dialogBox.showMessages(
      missing.length === 0
        ? [contract.deploymentBriefing]
        : [
            contract.deploymentBriefing,
            `You are still short ${itemAmountsFor(missing)} for this contract's drop. It will refuse you.`,
          ],
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

    this.pendingTrainerBattle = {
      trainer: watcher.trainer,
      introLines: watcher.introLines,
      isHunter: false,
    };
    this.playCutscene(
      trainerApproachCutscene(
        watcher.trainer.id,
        watcher.position,
        watcher.facing,
        tile,
        [...lead, ...watcher.introLines],
        planTrainerApproach(watcher.position, watcher.facing, tile, watcher.sightRange ?? 0),
      ),
    );
    return true;
  }

  /**
   * Starts an authored beat, on the tick that called for it.
   *
   * Nothing is posed here by hand: the cutscene's own first instant is played
   * immediately, with no time passing, so the turn and the sting land on the
   * tick the player was caught on rather than a frame later - and an opening
   * pose can never disagree with the sequence that owns it. A second cutscene
   * is refused rather than queued: there is no beat in this game a player can
   * reach while another is playing, and a queue would be a way to hold the
   * frame twice.
   */
  private playCutscene(cutscene: Cutscene): boolean {
    if (this.cutscene) {
      return false;
    }
    this.cutscene = {
      player: new CutscenePlayer(cutscene),
      marks: new Map(),
      waitingForPlayer: false,
    };
    this.advanceCutscene(0);
    return true;
  }

  /**
   * Plays one tick of the live cutscene.
   *
   * @returns whether the cutscene still owns this frame. It gives it back while
   * it waits on a line to be read, so `update()` falls through to the dialogue
   * box, and for good once the last beat is done.
   */
  private advanceCutscene(deltaMs: number): boolean {
    const running = this.cutscene;
    if (!running) {
      return false;
    }
    // The box the cutscene raised has been read and closed, which is the answer
    // the waiting beat was waiting for.
    if (running.waitingForPlayer && !this.dialogBox.visible) {
      running.player.dialogueClosed();
    }
    const frame = running.player.advance(deltaMs);
    for (const [actorId, actor] of frame.actors) {
      this.placeCutsceneActor(running.marks, actorId, actor);
    }
    for (const effect of frame.sounds) {
      audioManager.play(effect);
    }
    if (frame.fade) {
      const { to, durationMs } = frame.fade;
      if (to === 'black') {
        this.cameras.main.fadeOut(durationMs, 0, 0, 0);
      } else {
        this.cameras.main.fadeIn(durationMs, 0, 0, 0);
      }
    }
    if (frame.speech) {
      this.interrupt(frame.speech.lines, frame.speech.about);
    }
    running.waitingForPlayer = frame.waitingForPlayer;
    if (frame.done) {
      this.endCutscene();
      return false;
    }
    return !frame.waitingForPlayer;
  }

  /** One actor, this instant: where it stands, which way it looks, its mark. */
  private placeCutsceneActor(
    marks: Map<string, Phaser.GameObjects.Graphics>,
    actorId: string,
    actor: CutsceneActorFrame,
  ): void {
    if (actorId === PLAYER_ACTOR) {
      // A cutscene may only turn the player - see `checkCutscene` - so their
      // tile is untouched here and only the pose changes.
      this.facing = actor.facing;
      this.showIdlePose();
    } else {
      this.npcSprites
        .get(actorId)
        ?.setPosition(actor.x * TILE_SIZE, actor.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET)
        .setDepth(atRow(FIGURE_BAND, actor.y))
        .setVisible(actor.visible);
      this.faceFigure(actorId, actor.facing);
    }
    if (!actor.emote) {
      marks.get(actorId)?.destroy();
      marks.delete(actorId);
      return;
    }
    let mark = marks.get(actorId);
    if (!mark) {
      mark = this.add.graphics().setDepth(atRow(CANOPY_BAND, actor.y) + 0.1);
      this.mapObjects.push(mark);
      this.paintSpottedMark(mark);
      marks.set(actorId, mark);
    }
    this.placeSpottedMark(mark, actor.x, actor.y, actor.emote.elapsedMs);
  }

  /**
   * The beat is over - or the thing it was leading to has taken over: a battle,
   * the result screen, the next raid on this same scene instance. Either way
   * the marks come down and nothing is left holding the frame.
   */
  private endCutscene(): void {
    for (const mark of this.cutscene?.marks.values() ?? []) {
      mark.destroy();
    }
    this.cutscene = undefined;
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

  private askGiftNickname(pokemon: Pokemon): void {
    this.pendingGiftNickname = undefined;
    const prompt = giftNicknamePrompt(pokemon.base.name);
    this.trainerPrompt = new ChoicePrompt(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      padding: 10,
      lines: prompt.lines,
      options: prompt.options,
      selected: prompt.selected,
      onChoose: (index) => this.answerGiftNickname(pokemon, index === 0),
    });
  }

  /**
   * The naming screen is a menu over the world, so the world waits under it as
   * it does under the pack: no clock, no hunter, while a name is typed.
   */
  private answerGiftNickname(pokemon: Pokemon, naming: boolean): void {
    this.trainerPrompt?.destroy();
    this.trainerPrompt = undefined;
    if (!naming) {
      audioManager.play('cancel');
      return;
    }
    this.scene.pause();
    openNamingScreen(this, { pokemon }, (typed) => {
      pokemon.giveNickname(typed);
      this.scene.resume();
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
      if (prompt.moveSelection(-1)) {
        audioManager.play('select');
      }
      return;
    }
    if (
      this.keyPresses.justPressed(this.controls.right) ||
      this.keyPresses.justPressed(this.controls.d) ||
      this.keyPresses.justPressed(this.controls.down) ||
      this.keyPresses.justPressed(this.controls.s)
    ) {
      if (prompt.moveSelection(1)) {
        audioManager.play('select');
      }
      return;
    }
    if (this.isInteractionPressed()) {
      prompt.confirm();
    }
  }

  private isBlocked(tile: GridPosition): boolean {
    return (
      this.collisionData[tile.y][tile.x] ||
      this.barredExitAt(tile) !== undefined ||
      this.currentMap.entities.some((entity) => this.entityHolds(entity, tile)) ||
      this.trainersForCurrentMap().some(
        (trainer) => trainer.position.x === tile.x && trainer.position.y === tile.y,
      ) ||
      (this.isHunterOnCurrentMap() &&
        this.hunterState.position!.x === tile.x &&
        this.hunterState.position!.y === tile.y)
    );
  }

  /**
   * Whether this step is a run. Only ever true in an explorer run: a map that
   * is 64 by 72 is a long way at 150ms a tile when what you are there to do is
   * look at the far corner of it, and the raid clock is charged for the time
   * either way - so outside that mode this is a lever on difficulty and is not
   * offered.
   */
  private isRunning(): boolean {
    return isPlaytestRun() && this.controls?.run?.isDown === true;
  }

  private beginStep(targetTile: GridPosition): void {
    this.targetTile = targetTile;
    this.stepProgress = 0;
    // A ridden tile is quicker and is still one step: the hunter, the grass
    // and the watch all pay for it as they pay for a walked one.
    this.stepDurationMs = stepDurationFor(this.riding, this.isRunning() ? PLAYTEST_RUN_DIVISOR : null);
    this.hopping = false;
    this.partner?.follow(this.currentTile, targetTile);

    this.stepStart.set(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
    this.stepEnd.set(targetTile.x * TILE_SIZE, targetTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);

    this.player.play(this.playerWalkKey(), true);
  }

  /**
   * Goes over a ledge, if the player is standing on one facing the way down.
   *
   * It is a whole step of the raid - the clock is charged for the time it
   * takes, the landing rolls tall grass and works whatever it lands on exactly
   * as a walked tile does - and it is refused the moment anything is standing
   * where it would land. What it is not is reversible: `ledgeHopAt` only ever
   * answers the authored direction, so walking back up the bank is the wall it
   * has always been.
   */
  private tryLedgeHop(facing: Direction): boolean {
    const hop = ledgeHopAt(this.currentMap.id, this.currentTile, facing);
    if (!hop) {
      return false;
    }
    if (
      hop.landing.x < 0 ||
      hop.landing.y < 0 ||
      hop.landing.x >= this.bounds.width ||
      hop.landing.y >= this.bounds.height ||
      this.isBlocked(hop.landing)
    ) {
      return false;
    }
    this.facing = facing;
    this.pushingAgainst = null;
    // Nobody stands behind a ledge's landing but the bank, so the partner goes
    // after the player into the brow and comes out again on their next step.
    this.partner?.tuckIn();
    this.beginStep(hop.landing);
    this.stepDurationMs = LEDGE_HOP_DURATION_MS;
    this.hopping = true;
    audioManager.play('ledgeHop');
    return true;
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
    const tick = advanceStepClock(this.stepProgress, deltaMs, this.stepDurationMs);
    this.stepProgress = tick.progress;

    // A hop leaves the ground: the same straight line between the two tiles,
    // lifted over its middle, so the figure goes over the bank rather than
    // sliding through it.
    const rise = this.hopping ? Math.sin(this.stepProgress * Math.PI) * LEDGE_HOP_RISE : 0;
    this.setPlayerPosition(
      Phaser.Math.Linear(this.stepStart.x, this.stepEnd.x, this.stepProgress),
      Phaser.Math.Linear(this.stepStart.y, this.stepEnd.y, this.stepProgress) - rise,
    );

    if (this.stepProgress < 1 || !this.targetTile) {
      return;
    }

    this.stepCarryMs = tick.overflowMs;
    const steppedFrom = this.currentTile;
    this.currentTile = { ...this.targetTile };
    this.targetTile = null;
    this.boatAwayToldAt = null;
    this.partner?.arrived();
    if (this.runSession) {
      this.runSession.stepsTaken = (this.runSession.stepsTaken ?? 0) + 1;
    }
    // A step is the hunter's step: standing still starts counting again from here.
    this.hunterStillMs = 0;
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

    // Ice carries a step on until something stops it (`slidingFloor.ts`), and
    // nothing rolls for a wild Pokemon until it has.
    if (this.trySlideOn()) {
      return;
    }

    const encounters = this.encountersAtCurrentTile();
    if (stepRolls(this.currentMap, this.currentTile) && encounters) {
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

  /**
   * Carries the step just finished on across ice, if it landed on ice and the
   * next tile the same way can be walked onto: a whole step of the raid, taken
   * standing, as FireRed's player slides. Whatever the landing worked, opened
   * or started has already had its turn - a slide only ever continues a step
   * that nothing stopped.
   */
  private trySlideOn(): boolean {
    const terrain = this.currentMap.terrain;
    // A spin begins on an arrow and goes on over plain floor until it stops.
    const spinning = this.spin !== null || spinsOn(terrain[this.currentTile.y]?.[this.currentTile.x]) !== undefined;
    const carried = carriedOn(terrain, this.currentTile, this.spin?.heading ?? this.facing, spinning);
    const next = carried === null ? null : nextTileFromDirection(this.currentTile, carried);
    if (
      carried === null ||
      next === null ||
      next.x < 0 ||
      next.y < 0 ||
      next.x >= this.bounds.width ||
      next.y >= this.bounds.height ||
      this.isBlocked(next)
    ) {
      // Stopped: on a plate, against something, or never carried at all. A
      // spin leaves the player facing the way it was carrying them.
      if (this.spin) {
        this.facing = this.spin.heading;
        this.showIdlePose();
        this.spin = null;
      }
      return false;
    }
    if (spinning) {
      // FireRed's player turns round and round while an arrow carries them,
      // and the spin says so as it starts (`PlaySpinSound`).
      const turn = (this.spin?.turn ?? -1) + 1;
      if (this.spin === null || this.spin.heading !== carried) {
        audioManager.play('spin');
      }
      this.spin = { heading: carried, turn };
      this.facing = carried;
      this.beginStep(next);
      this.player.stop();
      this.player.setFrame(this.playerIdleFrame(SPIN_TURNS[turn % SPIN_TURNS.length]));
      return true;
    }
    this.beginStep(next);
    this.player.stop();
    this.player.setFrame(this.playerIdleFrame(this.facing));
    return true;
  }

  private showIdlePose(): void {
    this.player.stop();
    this.player.setFrame(this.playerIdleFrame(this.facing));
  }

  // -- the Bicycle -----------------------------------------------------------

  /** The player's standing frame, on foot or on the Bicycle. */
  private playerIdleFrame(facing: Direction): number {
    return this.riding ? getIdleFrame(facing, BIKE_SHEET_COLUMNS) : getIdleFrame(facing);
  }

  /** The player's walk - or pedal - cycle for the way they face. */
  private playerWalkKey(): string {
    return this.riding ? getWalkAnimationKey(this.facing, BIKE_TEXTURE) : getWalkAnimationKey(this.facing);
  }

  /** Where riding stands, as `world/bicycle.ts` asks it. */
  private rideState(): RideState {
    return { riding: this.riding, carried: this.bag.count(BICYCLE_ITEM_ID) > 0, place: this.ridePlace() };
  }

  private ridePlace(): RidePlace {
    return this.currentArea()?.kind ?? 'outdoors';
  }

  /**
   * Gets the player off the Bicycle if they may not be on it any more - through
   * a door into a room, or with the Bicycle out of the pack - and dresses the
   * figure either way. Asked wherever either can have changed.
   */
  private settleRiding(): void {
    this.setRiding(stillRiding(this.rideState()));
  }

  private setRiding(riding: boolean): void {
    const changed = this.riding !== riding;
    this.riding = riding;
    if (this.runSession) {
      this.runSession.riding = riding;
    }
    if (!changed || !this.player) {
      return;
    }
    this.player.setTexture(riding ? BIKE_TEXTURE : SHARED_CHARACTER_TEXTURE, this.playerIdleFrame(this.facing));
    // The ridden frame is two tiles wide: a quarter in is the middle of the tile.
    this.player.setOrigin(riding ? BIKE_ORIGIN_X : 0, 0);
    this.playerHeadMark.setY(this.player.y + (riding ? BIKE_HEAD_DROP : 0));
    if (this.targetTile) {
      this.player.play(this.playerWalkKey(), true);
    }
  }

  /**
   * The pack's USE or WALK on the Bicycle. Null when it was done and the pack
   * should close, as FireRed's does; otherwise the line to say there.
   */
  private toggleBike(): string | null {
    const answer = toggleBike(this.rideState());
    if (answer.kind === 'refused') {
      return answer.message;
    }
    if (answer.kind === 'mount') {
      audioManager.play('bikeBell');
    }
    this.setRiding(answer.kind === 'mount');
    this.saveGame();
    return null;
  }

  private warp(warp: MapWarp): void {
    if (warp.destinationMapId === this.currentMap.id) {
      this.walkThrough(warp);
      return;
    }
    audioManager.play('warp');
    this.isWarping = true;
    this.player.stop();
    this.partner?.tuckIn();
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
      this.settleRiding();
      this.showIdlePose();
      this.standPartnerBesidePlayer();
      this.configureCamera();
      this.saveGame();
      this.cameras.main.fadeIn(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isWarping = false;
      });
    });
  }

  /**
   * Goes through a doorway into another place of the same map: the screen goes
   * dark, the player is stood on the far side facing away from it, and the
   * screen comes back on the place they are now in. Nothing is rebuilt - every
   * place of a player's map is already in the one grid (`mapAreas.ts`) - so the
   * hunter, the loot and everything else carry on exactly where they were, and
   * a hunter on the player's heels comes through the same door after them.
   *
   * The clock runs through the fade, as it runs through every step: a door is
   * walked through, not a pause.
   */
  private walkThrough(warp: MapWarp): void {
    audioManager.play('warp');
    this.isWarping = true;
    this.player.stop();
    this.showIdlePose();
    this.partner?.tuckIn();
    this.cameras.main.fadeOut(DOOR_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const left = this.currentArea();
      this.currentTile = { ...warp.destination };
      if (this.currentArea() !== left) {
        this.resetBouldersLeftIn(left);
      }
      this.facing = warp.facing;
      this.targetTile = null;
      this.setPlayerPosition(
        this.currentTile.x * TILE_SIZE,
        this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
      );
      // Through a door into a room is off the Bicycle, as a FireRed warp into a
      // map with no cycling is; and coming back out is on foot too.
      this.settleRiding();
      this.showIdlePose();
      this.standPartnerBesidePlayer();
      // The key that would take the player straight back through is spent:
      // coming out of a doorway with it still held must not walk them back in.
      const back = nextTileFromDirection({ x: 0, y: 0 }, warp.facing);
      this.spentPresses.spendHeld(
        back.y > 0 ? [this.controls.up, this.controls.w]
        : back.y < 0 ? [this.controls.down, this.controls.s]
        : back.x > 0 ? [this.controls.left, this.controls.a]
        : [this.controls.right, this.controls.d],
      );
      this.configureCamera();
      this.cameras.main.centerOn(this.player.x, this.player.y);
      this.saveGame();
      this.noteDistrict();
      this.surveyGround();
      this.refreshRunTimerHud();
      this.cameras.main.fadeIn(DOOR_FADE_MS, 0, 0, 0);
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
    // Whatever beat was playing has been overtaken by the fight it was leading
    // to, so it lets go of the frame before the world is torn down.
    this.endCutscene();
    // A room is told: a player in a fight is nobody's quarry and nobody's
    // keeper, and while it is the hunter's own fight the hunter holds still.
    const rooms = friendRoom();
    if (rooms?.room && rooms.room.mapId === this.currentMap.id && this.runSession) {
      const withHunter = 'hunterBattle' in encounter && encounter.hunterBattle;
      rooms.fighting = withHunter ? 'hunter' : 'wild';
      rooms.sayHunter({ kind: 'busy', from: rooms.room.me, busy: true, withHunter });
    }
    // Weather is not carried through the fight the way the hunter and the pack
    // are: it is a fact about the tile the player is standing on, so it is read
    // fresh here and never stored. A fight is fought in the weather of the
    // place it started in, whichever kind of fight it is.
    const data: BattleSceneData = {
      ...this.raidCarriage(),
      ...encounter,
      // Every wild Pokemon is met here, whatever produced it - the grass, a
      // cave floor, a Pokemon a map maker stood in the world - so this is the
      // one place its shininess is rolled, on the raid's own shiny stream.
      ...('wild' in encounter
        ? { wild: { ...encounter.wild, shiny: encounter.wild.shiny ?? rollShiny(this.runSession?.shinyRng) } }
        : {}),
      weather: this.currentWeather(),
    };
    // The fight's first line can be a cry - a wild Pokemon appearing - so the
    // cast's cries are fetched now, while the screen fades, rather than by the
    // battle once its first line is already up.
    const cast = [...this.party.pokemon, ...(data.trainer?.party ?? [])].map((pokemon) => pokemon.base.dexId);
    const wildDexId = data.wild ? getSpeciesById(data.wild.speciesId)?.dexId : undefined;
    void audioManager.loadCries(wildDexId === undefined ? cast : [...cast, wildDexId]);
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
      unclaimedBossGear: this.unclaimedBossGear,
      collectedLootIds: [...this.collectedLootIds],
      seenPrizeIds: [...this.seenPrizeIds],
      activatedPoiIds: [...this.activatedPoiIds],
      hunterState: this.hunterState,
      returnLocation: this.returnLocation(),
    };
  }

  /**
   * Redraws the map the player is already standing on, in the gate state it has
   * just changed into.
   *
   * The same three calls a warp makes, minus everything about arriving
   * somewhere: the player keeps their tile, their facing and their step, and
   * the hunter, the loot already taken and the beaten trainers are all rebuilt
   * from the lists the scene is holding. A field move is the one thing that
   * changes a map's collision without a battle or a warp between, so this is
   * the one place that has to say so.
   */
  private rebuildMapInPlace(): void {
    this.clearMap();
    this.createMap();
    this.createEntities();
    this.liftBeatenWatches();
    this.configureCamera();
  }

  private clearMap(): void {
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    this.worldLabels.forEach((label) => label.destroy());
    this.worldLabels = [];
    this.watchedGround = [];
    this.npcSprites.clear();
    this.npcAppearances.clear();
    this.idleFigures = [];
    this.lootSprites.clear();
    this.prizeLabels.clear();
    this.poiSprites.clear();
    this.poiLabels.clear();
    this.contractMarkers.clear();
    this.dropInLabels.clear();
    this.extractionMarkers = [];
    this.boats = [];
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
  /**
   * The part of the screen a caption may be seated in: all of it, or on a map
   * made of several places only the part over the place the player is in -
   * the rest is the dark round it, and a caption seated there is a caption
   * drawn under the dark. Whatever stands in another place has no seat at all.
   */
  private captionGround(view: Phaser.Geom.Rectangle): Rect {
    const whole = { x: view.left, y: view.top, width: view.width, height: view.height };
    const area = this.currentArea()?.rect;
    if (!area) {
      return whole;
    }
    const left = Math.max(whole.x, area.x * TILE_SIZE);
    const top = Math.max(whole.y, area.y * TILE_SIZE);
    const right = Math.min(whole.x + whole.width, (area.x + area.width) * TILE_SIZE);
    const bottom = Math.min(whole.y + whole.height, (area.y + area.height) * TILE_SIZE);
    return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }

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
    const bounds: Rect = this.captionGround(view);
    // The HUD is pinned to the screen and the captions live in the world, so
    // the chips are translated into world space before they are avoided.
    // The dialogue box is pinned to the screen in the same way, and it is drawn
    // over the captions: a trainer's CANNOT BE FLED came out half under the
    // drop-in briefing. While a box is up it is ground no caption may take.
    const dialog = this.dialogBox?.visible
      ? [{ x: this.dialogBox.x, y: this.dialogBox.y, width: DIALOG_WIDTH, height: DIALOG_HEIGHT }]
      : [];
    // The FEEDBACK tab stands over the right edge of the screen (`feedbackTabCover.ts`).
    const tab = feedbackTabOverGame(this.game?.canvas, this.scale?.gameSize);
    const furniture = [...(tab ? [tab] : []), ...(this.raidHud?.occupied ?? []), ...dialog].map((chip) => ({
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
        canopy: [...this.canopyInView(bounds), ...this.lidsInView()],
        player: this.captionPlayer(),
        follower: this.partner?.shown ? [this.partner.rect()] : [],
      },
    );
    this.worldLabels.forEach((label, index) => label.seat(placements[index]));
    this.veilPartnerUnderCaptions(placements);
  }

  /**
   * The follower gives way to writing rather than the other way round: a
   * caption that had nowhere to sit but behind it is read through it.
   */
  private veilPartnerUnderCaptions(placements: readonly CaptionPlacement[]): void {
    const partner = this.partner;
    if (!partner) {
      return;
    }
    const figure = partner.rect();
    partner.setVeiled(
      placements.some((placement, index) => {
        if (!placement.visible) {
          return false;
        }
        const { width, height } = this.worldLabels[index].request();
        return (
          placement.x < figure.x + figure.width &&
          placement.x + width > figure.x &&
          placement.y < figure.y + figure.height &&
          placement.y + height > figure.y
        );
      }),
    );
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
    const key = `${this.currentMap.id}|${this.openedDoorKeys().join('+')}|${left},${top},${right},${bottom}`;
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
    runs.push(...brimRuns(this.currentMap.layers, { left, top, right, bottom }, TILE_SIZE));
    this.canopyInViewCache = { key, runs };
    return runs;
  }

  /**
   * The lids that are down, as the captions' seating sees them.
   *
   * A lid is drawn above the captions exactly as a tree's crown is, so it is
   * ground a caption may not take by the same rule - a mouth's own name came
   * out half washed out under the hillside it was naming. The one the player is
   * standing in is left out, because a lifted lid covers nothing.
   */
  private lidsInView(): Rect[] {
    return this.currentMap.interiors
      .filter((interior) => interior.id !== this.currentInterior?.id)
      .map((interior) => ({
        x: interior.roof.x * TILE_SIZE,
        y: interior.roof.y * TILE_SIZE,
        width: interior.roof.width * TILE_SIZE,
        height: interior.roof.height * TILE_SIZE,
      }));
  }

  /**
   * What stands on this map that a caption may not cover, beyond the things the
   * captions themselves name: signs, crates, the ground a trainer watches, and
   * everyone standing still - the hunter among them. It walks, but it is
   * placed a whole tile at a time, so a caption it walks into moves once per
   * step rather than chasing it; left out, a landmark's name was drawn straight
   * across the hunter standing beside it (playtest 45). The player walks too,
   * and is `captionPlayer()`'s business rather than this list's, because a
   * caption gives the player room only while it has somewhere else to sit.
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
    const standing = [...this.npcSprites.values()]
      .filter((sprite) => sprite.visible)
      .map((sprite) => ({
        x: sprite.x,
        y: sprite.y + CHARACTER_HEAD_PIXEL_Y,
        width: TILE_SIZE,
        height: FIGURE_HEIGHT,
      }));
    // A door, a staircase or a mat is the thing its caption names, and writing
    // seated over it hides it.
    const doorways = this.currentMap.warps.flatMap((warp) =>
      warp.art
        ? [
            {
              x: warp.art.x * TILE_SIZE,
              y: warp.art.y * TILE_SIZE,
              width: warp.art.width * TILE_SIZE,
              height: warp.art.height * TILE_SIZE,
            },
          ]
        : [],
    );
    // A boat at its jetty is the thing its caption names too.
    const boats = (this.boats ?? [])
      .filter(({ sprite }) => sprite.visible)
      .map(({ sprite }) => ({
        x: sprite.x - sprite.width / 2,
        y: sprite.y - sprite.height / 2,
        width: sprite.width,
        height: sprite.height,
      }));
    return [...signs, ...crates, ...standing, ...this.watchedGround, ...doorways, ...boats];
  }

  /**
   * Where the player is, as captions see them: the figure and its chevron on
   * the tile they stand on, and on the tile they are stepping to. Whole tiles
   * rather than the sprite's own position, so the answer changes when a step
   * begins and not on every frame of it - a caption in the way moves once, as
   * the player sets off towards it, instead of sliding along ahead of them.
   */
  private captionPlayer(): Rect[] {
    return [this.currentTile, ...(this.targetTile ? [this.targetTile] : []), ...this.steppingAshore()].map(
      landingRect,
    );
  }

  /**
   * The jetty a voyage's last step is walking the player onto. That step is
   * not a `targetTile` - the voyage owns it - so without this the far jetty's
   * own caption, which names that very tile, was seated across the head of the
   * player stepping off the boat until the frame after they landed.
   */
  private steppingAshore(): GridPosition[] {
    const trip = this.voyaging;
    return trip && trip.index === trip.tiles.length - 2 ? [trip.tiles[trip.tiles.length - 1]] : [];
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
    // The room's ground is picked up by whoever the database says was first
    // (`raidRoom/roomLoot.ts`): a step onto a piece nobody holds yet is the
    // claim, and the piece is collected on the frame the answer is this
    // player's (`settleRoomLoot`). Held by somebody else, it is already gone.
    if (loot && this.isSharedLoot(loot) && this.isLootAvailable() && !this.collectedLootIds.has(loot.id)) {
      const rooms = friendRoom()!;
      const holder = rooms.loot.holder(loot.id);
      if (holder === undefined) {
        rooms.claimLoot(loot.id);
        return null;
      }
      if (holder !== rooms.room!.me) {
        return null;
      }
    }
    return this.collectLootHere(loot);
  }

  /**
   * The room's phrases and ping (`raidRoom/roomTalk.ts`): T opens the list,
   * a number says a phrase from it, G marks the tile the player stands on.
   * Nothing here pauses the world or costs the clock anything but the press.
   */
  private talkInTheRoom(deltaMs: number): void {
    const rooms = friendRoom();
    if (!rooms?.room || this.pendingHubTransition) {
      return;
    }
    this.talkOpenMs = Math.max(0, this.talkOpenMs - deltaMs);
    if (this.keyPresses.justPressed(this.controls.talk)) {
      this.learnKey('talk');
      this.talkOpenMs = this.talkOpenMs > 0 ? 0 : TALK_LIST_OPEN_MS;
      audioManager.play('select');
    }
    if (this.talkOpenMs > 0) {
      const phrase = this.controls.phrases.findIndex((key) => this.keyPresses.justPressed(key));
      if (phrase >= 0) {
        this.talkOpenMs = 0;
        audioManager.play(rooms.say(phrase) ? 'confirm' : 'denied');
      }
    }
    if (this.keyPresses.justPressed(this.controls.ping)) {
      this.learnKey('ping');
      audioManager.play(rooms.ping(this.currentTile) ? 'confirm' : 'denied');
    }
  }

  /**
   * A friend beat a boss: its doors open in this raid too, now. The map is
   * rebuilt in the new gate state under a player who has not moved, as a
   * field move rebuilds it, and the keeper is no longer standing in the lane.
   */
  private openRoomDoors(): void {
    const doors = this.roomDoors();
    const key = doors.join();
    if (key === this.roomDoorsBuilt || this.isWarping || this.pendingHubTransition || this.targetTile) {
      return;
    }
    const opened = doors.filter((bossId) => !this.roomDoorsBuilt.split(',').includes(bossId));
    this.roomDoorsBuilt = key;
    this.currentMap = this.mapFor(this.currentMap.id);
    this.rebuildMapInPlace();
    const rooms = friendRoom();
    // One line a keeper, by the keeper's name: a keeper can hold two doors, and
    // which ones is what the map now shows.
    for (const bossId of opened) {
      const winner = rooms?.bossesWon.get(bossId);
      const keeper = this.trainerEncounters.find((encounter) => encounter.bossId === bossId)?.trainer.name;
      audioManager.play('landmarkWorked');
      rooms?.tell(`${(winner && rooms.nameOf(winner)) ?? 'A FRIEND'} BEAT ${(keeper ?? 'A KEEPER').toUpperCase()}`);
    }
  }

  /**
   * The ground a friend walks is ground this raid has seen: the same disc
   * round them as round the player, written with the raid's own survey when it
   * ends, so the drop-in map's dark lifts over everywhere the room went.
   */
  private surveyWithFriends(figures: readonly { readonly id: string; readonly tile: GridPosition }[]): void {
    for (const figure of figures) {
      const index = figure.tile.y * this.currentMap.width + figure.tile.x;
      if (this.friendSurveyed.get(figure.id) !== index) {
        this.friendSurveyed.set(figure.id, index);
        this.surveyAround(figure.tile);
      }
    }
  }

  /** Every ping still showing, drawn on its tile: a ring above the canopy, so it shows in a wood. */
  private drawPings(): void {
    const rooms = friendRoom();
    const showing = rooms?.room ? rooms.talk.pings(this.time.now) : new Map<string, GridPosition>();
    for (const [id, drawn] of this.pingMarks) {
      const tile = showing.get(id);
      if (!tile || `${tile.x},${tile.y}` !== drawn.tile) {
        drawn.mark.destroy();
        this.pingMarks.delete(id);
      }
    }
    for (const [id, tile] of showing) {
      if (this.pingMarks.has(id)) {
        continue;
      }
      const mark = this.add.graphics().setDepth(atRow(CANOPY_BAND, tile.y));
      mark.lineStyle(2, PING_COLOUR, 1).strokeCircle(0, 0, TILE_SIZE / 2 + 2);
      mark.fillStyle(PING_COLOUR, 1).fillRect(-1, -TILE_SIZE, 2, TILE_SIZE / 2);
      mark.setPosition(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2);
      this.tweens.add({ targets: mark, alpha: { from: 1, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 });
      this.pingMarks.set(id, { tile: `${tile.x},${tile.y}`, mark });
    }
  }

  /** Whether a piece of loot is the room's shared ground rather than this raid's own. */
  private isSharedLoot(loot: WorldLoot): boolean {
    const room = friendRoom()?.room;
    return (
      room !== null &&
      room !== undefined &&
      room.mapId === this.currentMap.id &&
      (this.runSession?.plan?.roomLootIds?.includes(loot.id) ?? false)
    );
  }

  /**
   * Each frame of a raid with friends: a piece this player won is collected,
   * once, wherever they have walked to since (they were first, and that is
   * what counts); a piece somebody else holds is taken off the map; and losing
   * a race is said on the friend chip.
   */
  private settleRoomLoot(): void {
    const rooms = friendRoom();
    const room = rooms?.room;
    const ids = this.runSession?.plan?.roomLootIds;
    if (!rooms || !room || !ids || room.mapId !== this.currentMap.id || !this.isLootAvailable()) {
      return;
    }
    for (const loot of this.lootForCurrentMap()) {
      if (this.collectedLootIds.has(loot.id) || !ids.includes(loot.id)) {
        continue;
      }
      const holder = rooms.loot.holder(loot.id);
      if (holder === undefined) {
        continue;
      }
      if (holder === room.me) {
        if (rooms.loot.firstTry(loot.id) && !this.dialogBox.visible && !this.pendingHubTransition) {
          const said = this.collectLootHere(loot);
          if (said) {
            this.dialogBox.showMessages([said]);
          }
        }
        continue;
      }
      this.takeLootOffTheMap(loot);
      if (rooms.loot.lostTheRace(loot.id)) {
        audioManager.play('denied');
        rooms.tell(`${rooms.nameOf(holder) ?? 'A FRIEND'} GOT THERE FIRST`);
      }
    }
  }

  /** A piece nobody here will pick up any more: its mark, its gleam and its caption go. */
  private takeLootOffTheMap(loot: WorldLoot): void {
    this.collectedLootIds.add(loot.id);
    this.lootSprites.get(loot.id)?.destroy();
    this.lootSprites.delete(loot.id);
    this.removeWorldLabel(this.prizeLabels.get(loot.id));
    this.prizeLabels.delete(loot.id);
  }

  /** Collects a piece of loot into the pack and returns what to say, as `tryCollectLootAt` always has. */
  private collectLootHere(loot: WorldLoot | undefined): string | null {
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
      return lootRefusalLine(loot!.itemId, loot!.quantity, this.bag.count(loot!.itemId));
    }

    const marker = this.lootSprites.get(loot!.id);
    flashScreen(this.cameras.main, 100, [250, 204, 21]);
    audioManager.play('lootPickup');
    marker?.destroy();
    this.lootSprites.delete(loot!.id);
    this.removeWorldLabel(this.prizeLabels.get(loot!.id));
    this.prizeLabels.delete(loot!.id);
    const item = ITEMS[loot!.itemId];
    // Somebody at base is waiting on this one (`hub/errands.ts`). That it was
    // picked up is written now, as a beaten boss is, so the giver knows to ask
    // after it whichever way the raid ends.
    const errand = errandForItem(item.id);
    if (errand) {
      new SaveManager().recordErrandFound(item.id);
      return `Found ${item.displayName}! Walk out with it and ${errand.name} gets it back.${this.reseatNote()}`;
    }
    // Money is found as a sum, the way these games pay it out: "Found ₽40!".
    const found = isCurrency(item.id)
      ? formatMoney(loot!.quantity)
      : `${item.displayName}${loot!.quantity > 1 ? ` x${loot!.quantity}` : ''}`;
    return `Found ${found}${loot!.hidden ? ' hidden here' : ''}!${this.reseatNote()}`;
  }

  /**
   * Works a landmark and returns what to say about it, or null if there was
   * nothing to work. Lines rather than a boolean for the same reason
   * `tryCollectLootAt` does it: a landmark can stand on ground a trainer is
   * watching, and then both facts belong in one dialogue.
   */
  private tryActivatePoiAt(position: GridPosition): readonly string[] | null {
    const poi = this.currentMap.pois.find(
      (candidate) =>
        candidate.position.x === position.x &&
        candidate.position.y === position.y &&
        // A landmark this save finished with hands out nothing and opens
        // nothing: its exit is already open and its cache is already empty, so
        // standing on it must not say either of those things again.
        !isLandmarkWorked(candidate.id, this.completedContracts),
    );
    const result = tryActivatePoi(
      poi,
      this.isLootAvailable(),
      this.activatedPoiIds,
      (itemId, quantity) => this.collectRunItem(itemId, quantity),
      // Whole or not at all, and the pack will re-seat itself to take the
      // whole of it: a cache refused for the way the pack happens to be packed
      // would be a seal the player could not open from where they stand.
      (reward, freeing) => {
        if (this.bag.fitsAll(reward, freeing)) {
          return true;
        }
        if (!this.bag.tidyWouldFitAll(reward, freeing)) {
          return false;
        }
        this.bag.tidy();
        this.packReseated = true;
        return true;
      },
      { count: () => this.bag.count('lockpick'), spend: () => this.bag.remove('lockpick', 1) },
    );
    if (result === 'unavailable') {
      return null;
    }
    if (result === 'locked') {
      audioManager.play('denied');
      return lockedCrateLines(poi!);
    }
    if (result === 'bag-full') {
      audioManager.play('denied');
      // Nothing is taken and nothing is worked, so the landmark is still here:
      // the pack is one key away, and the way forward is to put something down
      // and walk back on to it. The message has to say all of that, including
      // the part a player cannot see - that the exit this landmark opens has
      // not opened either.
      return [
        `${cacheRefusalLine(poi!)} Drop something from the PACK and work it again.`,
        ...(poi!.effect === 'unlock-extraction'
          ? [
              `${poi!.unlockedExtractionLabel ?? 'The exit it opens'} stays shut until the cache is taken.`,
            ]
          : []),
      ];
    }

    this.poiSprites.get(poi!.id)?.destroy();
    this.poiSprites.delete(poi!.id);
    this.removeWorldLabel(this.poiLabels.get(poi!.id));
    this.poiLabels.delete(poi!.id);
    flashScreen(this.cameras.main, 140, [56, 189, 248]);
    // A cache pays out; a landmark is worked. They are different deeds on the
    // map and the field guide, so they are different sounds.
    audioManager.play(poi!.effect === 'unlock-extraction' ? 'landmarkWorked' : 'cacheOpen');
    if (poi!.effect === 'unlock-extraction') {
      const exit = poi!.unlockedExtractionLabel ?? 'A NEW EXIT';
      this.refreshExtractionMarkers();
      return [
        `${poi!.label}: ${exit} is open.`,
        this.rangerForecast(),
        ...(poi!.reward.length > 0 ? [`${cachePayoutLine(poi!, true)}${this.reseatNote()}`] : []),
      ];
    }
    return [
      ...(poi!.locked ? ['The Lockpick turned the lock, and snapped in it.'] : []),
      `${cachePayoutLine(poi!, false)}${this.reseatNote()}`,
    ];
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
    flashScreen(this.cameras.main, 120, [96, 165, 250]);
    audioManager.play('contractStop');
    this.refreshRunTimerHud();
    this.saveGame();
    return contractStopMessage(contract, marker, session.manager.snapshot().contractSteps);
  }

  private returnLocation(): RaidLocation {
    return createBattleReturnLocation({
      mapId: this.currentMap.id,
      position: { ...this.currentTile },
      facing: this.facing,
    });
  }

  private extractionPointsForCurrentMap(): readonly ExtractionPoint[] {
    return (
      this.runSession?.plan?.extractionPoints ??
      withWorkedExitsOpen(extractionPointsOn(this.currentMap.id), this.completedContracts)
    ).filter((point) => point.mapId === this.currentMap.id);
  }

  private trainersForCurrentMap(): readonly RunTrainerEncounter[] {
    // A keeper beaten by somebody in the room steps aside for the rest of the
    // raid, so the door that win opened is a door and not a keeper in a lane.
    const roomDoors = this.roomDoors();
    return this.trainerEncounters.filter(
      (trainer) =>
        trainer.mapId === this.currentMap.id &&
        !this.defeatedTrainerIds.has(trainer.trainer.id) &&
        !(trainer.bossId !== undefined && roomDoors.includes(trainer.bossId)),
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
    // Everything is open in an explorer run, doors included: what is being
    // looked at is the ground behind them.
    if (isPlaytestRun()) {
      return true;
    }
    return isExtractionAvailable(
      point,
      this.runSession?.manager.snapshot().elapsedMs ?? 0,
      this.activatedPoiIds,
      new Set(this.runSession?.exitsOpened ?? []),
    );
  }

  private rangerForecast(): string {
    const elapsedMs = this.runSession?.manager.snapshot().elapsedMs ?? 0;
    const spawnDelayMs = this.runSession?.plan?.hunter.spawnDelayMs ?? HUNTER_SPAWN_MS;
    return hunterForecastLine({
      spawned: this.hunterState.spawned,
      defeated: this.hunterState.defeated,
      returnsForEnrage: !this.hunterState.enrageAnswered,
      rivalName: this.hunterRival().name,
      msUntilSpawn: spawnDelayMs - elapsedMs,
    });
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
   * rather than a timer's special case: Brock's beacon opens on the
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

  /** @returns Whether a waiting piece of gear was handed over and spoken for. */
  private tryClaimWaitingBossGear(): boolean {
    const owed = this.unclaimedBossGear.length;
    const lines = this.claimBossGear();
    if (this.unclaimedBossGear.length === owed) {
      return false;
    }
    // An interruption, because the player did not ask for it and the key they
    // are already holding has to be able to answer it. The gear line sounds
    // its own jingle as it is put up.
    this.interrupt(lines);
    return true;
  }

  private extractThrough(point: ExtractionPoint): void {
    if (!this.runSession) {
      return;
    }
    this.runSession.manager.resolveEscape();
    this.destroyRunTimerHud();
    flashScreen(this.cameras.main, 240, [134, 239, 172]);
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
    // Written before the banking, which reloads the save it writes back: the
    // record and the survey are part of what this raid did, and banking must
    // carry them out rather than overwrite them.
    this.recordRaid('extracted');
    const contractResult = banksContract
      ? new SaveManager().bankContract(contract, runResult, settlement)
      : { saved: new SaveManager().bankRun(runResult, settlement), granted: false };
    this.pendingHubTransition = true;
    const contractPaid = contractResult.granted
      ? { pokemon: rewardPokemon(contract!.reward), items: contract!.reward.items }
      : { pokemon: [], items: [] };
    this.showRunResult(
      buildExtractionReport({
        outcome: 'ESCAPED',
        snapshot,
        durationMs: snapshot.durationMs,
        exitLabel: point.label,
        leftBehind: this.prizesLeftBehindNow(),
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
            ...contractPaid.pokemon,
          ],
          items: [
            ...settlement.supplies.filter(({ quantity }) => quantity > 0),
            ...objectiveRewards,
            ...contractPaid.items,
          ],
        },
        contractPaid,
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
    this.stopFishing();
    this.dialogBox.setVisible(false);
    this.time.delayedCall(RUN_RESULT_DELAY_MS, () => {
      if (this.scene.manager.keys.extraction) {
        this.scene.start('extraction', { report });
        return;
      }
      this.scene.start(
        this.scene.manager.keys.base ? 'base' : 'title',
        this.scene.manager.keys.base ? { arrival: 'raid' } : undefined,
      );
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
    //
    // A cutscene is that argument a third time, and the rule it settles on is
    // the one that cannot be gamed: the raid is charged for time the player can
    // spend and never for time the world spends on itself. A beat that runs
    // itself - a mark, a walk, a held breath - is bounded by its own authored
    // duration (`CUTSCENE_TIMED_CAP_MS`) and the player cannot act inside it,
    // so it is free. A beat that waits on a key is bounded by nothing, so it is
    // billed exactly as any other dialogue is and there is no authored way to
    // stop the clock.
    this.openingBriefingOpen = this.openingBriefingOpen && this.dialogBox.visible;
    const cutsceneRunning = this.cutscene !== undefined && !this.cutscene.waitingForPlayer;
    const clockMs =
      this.pendingTrainerBattle ||
      this.pendingWildBattle ||
      this.openingBriefingOpen ||
      cutsceneRunning
        ? 0
        : deltaMs;
    const snapshot = this.runSession.manager.tick(clockMs);
    if (snapshot.isEnraged) {
      this.hunterState = hunterAtEnrage(this.hunterState);
    }
    this.advanceHunterSearch(clockMs);
    this.advanceHunterWhileStill(clockMs);
    this.placeHunterIfDue(snapshot.elapsedMs);
    this.refreshExtractionMarkers();
    this.refreshBoats();
    this.refreshRunTimerHud(deltaMs);
    if (snapshot.isEnraged && this.runSession.manager.isEnrageGraceExpired) {
      this.resolveExpiredRun();
    }
  }

  // -- boats -------------------------------------------------------------------

  /** A boat's state at this point in the raid; every boat sails in an explorer run, as every door is open. */
  private sailingStateNow(sailing: MapSailing): ReturnType<typeof sailingState> {
    return isPlaytestRun() ? 'sailing' : sailingState(sailing, this.tideMs());
  }

  /**
   * The raid's time as the tides are drawn against it: the elapsed clock plus
   * however much the Pokemon Center took off this raid's (`authoredTimeIn`),
   * so a boat sails as far before the end of a short raid as of a full one.
   */
  private tideMs(): number {
    return (this.runSession?.manager.snapshot().elapsedMs ?? 0) + (this.runSession?.plan?.clockShortfallMs ?? 0);
  }

  /** The Seagallop, FireRed's own ferry, off the town sheet: drawn as a figure because it moves. */
  private boatSprite(at: GridPosition, moored?: Direction): Phaser.GameObjects.Image {
    const texture = this.textures.get(TOWN_SHEET_SOURCE.source.textureKey);
    if (!texture.has(BOAT_FRAME)) {
      const piece = TOWN_PIECES.seagallop;
      // The piece's top row is empty: the boat is the three below it.
      texture.add(BOAT_FRAME, 0, piece.column * TILE_SIZE, (piece.row + 1) * TILE_SIZE, piece.width * TILE_SIZE, (piece.height - 1) * TILE_SIZE);
    }
    const sprite = this.add.image(0, 0, TOWN_SHEET_SOURCE.source.textureKey, BOAT_FRAME);
    this.placeBoat(sprite, at.x, at.y, moored);
    return sprite;
  }

  /**
   * Stands a boat on a tile of water: its deck level with the tile's top, so a
   * boat off a jetty lies below the boards rather than over them, and its bow
   * and stern out either side.
   */
  private placeBoat(sprite: Phaser.GameObjects.Image, x: number, y: number, moored?: Direction): void {
    // Moored, the boat lies out from its jetty, its side to the boards rather
    // than across them: off a jetty's west side it lies west of the tile it is
    // boarded at, off its east side east, and off its head or its foot it is
    // centred on it, deck to the boards.
    const half = sprite.width / 2;
    const across = moored === 'left' ? TILE_SIZE - half : moored === 'right' ? half : TILE_SIZE / 2;
    const down = moored === 'up' ? TILE_SIZE - sprite.height / 2 + BOAT_RIDE_Y : sprite.height / 2 - BOAT_RIDE_Y;
    sprite
      .setPosition(x * TILE_SIZE + across, y * TILE_SIZE + down)
      .setDepth(atRow(FIGURE_BAND, moored === 'up' ? y : y + 2));
  }

  private createBoats(): void {
    if (!this.runSession) {
      return;
    }
    for (const sailing of this.currentMap.sailings ?? []) {
      for (const end of [0, 1] as const) {
        const jetty = sailing.ends[end];
        const sprite = this.boatSprite(jetty.boat, jetty.toward);
        const label = new WorldLabel(this, {
          subject: tileRect(jetty.landing),
          text: sailing.name.toUpperCase(),
          tone: LABEL_TONES.boat,
          depth: atRow(CAPTION_BAND, jetty.landing.y),
          speech: { voice: 'name', tiles: [jetty.landing, jetty.boat] },
        });
        this.mapObjects.push(sprite);
        this.worldLabels.push(label);
        this.boats.push({ sailing, end, sprite, label });
      }
    }
    this.refreshBoats();
  }

  /**
   * Every lift door on the map, captioned with FireRed's word for it and,
   * while its generator is off, that it has no power - read from in front of
   * the door, as a boat's is.
   */
  private createLiftLabels(): void {
    this.liftLabels = [];
    for (const lift of this.currentMap.lifts ?? []) {
      for (const stop of lift.stops) {
        const door = { x: stop.landing.x, y: stop.landing.y - 1 };
        const label = new WorldLabel(this, {
          subject: { x: (door.x - 1) * TILE_SIZE, y: (door.y - 1) * TILE_SIZE, width: TILE_SIZE * 3, height: TILE_SIZE * 2 },
          text: 'ELEVATOR',
          tone: LABEL_TONES.boat,
          depth: atRow(CAPTION_BAND, door.y),
          speech: { voice: 'name', tiles: [stop.landing] },
        });
        this.worldLabels.push(label);
        this.liftLabels.push({ lift, label });
      }
    }
    this.refreshLiftLabels();
  }

  private refreshLiftLabels(): void {
    for (const { lift, label } of this.liftLabels ?? []) {
      const running = this.liftIsRunning(lift);
      label.setText(running ? 'ELEVATOR' : 'ELEVATOR\nNO POWER', running ? LABEL_TONES.boat : LABEL_TONES.gateShut);
    }
  }

  private refreshBoats(): void {
    const elapsedMs = this.tideMs();
    // A harness that never built the map has no boats to show.
    for (const { sailing, end, sprite, label } of this.boats ?? []) {
      const state = this.sailingStateNow(sailing);
      const away = this.voyaging?.sailing === sailing && this.voyaging.from === end;
      sprite.setVisible(state === 'sailing' && !away);
      label.setText(
        `${sailing.name.toUpperCase()}\n${isPlaytestRun() ? 'SAILING' : boatCaption(sailing, state, elapsedMs)}`,
        state === 'sailing' ? LABEL_TONES.boat : LABEL_TONES.gateShut,
      );
    }
  }

  /**
   * A door with a lock in it, faced: FireRed's Card Key opens it for the rest
   * of the raid, in FireRed's words (`Text_CardKeyOpenedDoor`), and is not used
   * up; without one it says what it wants (`Text_ItNeedsCardKey`) and where
   * that is found, as a locked gate does.
   */
  private turnKeyIn(lock: WorldSwitch): readonly string[] {
    const keyName = ITEMS[MAP_FILE_EXIT_KEY].displayName;
    if (this.bag.count(MAP_FILE_EXIT_KEY) === 0) {
      audioManager.play('denied');
      return [
        'The door is locked...',
        `No! It needs the ${keyName}!`,
        ...(this.currentMap.loot.some((loot) => loot.itemId === MAP_FILE_EXIT_KEY)
          ? [`The ${keyName} is a rare find, somewhere on this map.`]
          : []),
      ];
    }
    this.throwSwitch(lock);
    return [`Bingo! The ${keyName} opened the door!`];
  }

  /** Whether a lift runs this raid: its generator thrown, or it needs none. */
  private liftIsRunning(lift: MapLift): boolean {
    return liftRuns(lift.id, this.switchesHere(), this.runSession?.switchesThrown ?? []);
  }

  /**
   * A lift's door pressed into from the tile in front of it: FireRed's floor
   * panel, the cursor on this floor, every floor offered. A dead lift says so
   * when asked - pressed into, or faced with the interact key - and is a wall
   * to a held key, as a boat away from its jetty is.
   */
  private tryRideLift(facing: Direction, asked: boolean): boolean {
    const found = liftAt(this.currentMap.lifts, this.currentTile, facing);
    if (!found) {
      return false;
    }
    if (!this.liftIsRunning(found.lift)) {
      if (!asked) {
        return false;
      }
      this.facing = facing;
      this.showIdlePose();
      audioManager.play('denied');
      this.dialogBox.showMessages([...DEAD_LIFT_LINES]);
      return true;
    }
    this.facing = facing;
    this.pushingAgainst = null;
    this.showIdlePose();
    const prompt = floorPrompt(found.lift, found.stop);
    const columns = 2;
    const height = 20 + 20 * (prompt.lines.length + Math.ceil(prompt.options.length / columns));
    this.trainerPrompt = new ChoicePrompt(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - height - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height,
      padding: 10,
      lines: prompt.lines,
      options: prompt.options,
      selected: prompt.selected,
      columns,
      onChoose: (index) => this.answerLift(found.lift, found.stop, index),
    });
    return true;
  }

  /** The floor chosen at the panel: the same floor or EXIT is nothing; another floor is the ride. */
  private answerLift(lift: MapLift, here: number, chosen: number): void {
    this.trainerPrompt?.destroy();
    this.trainerPrompt = undefined;
    const to = lift.stops[chosen];
    if (!to || chosen === here) {
      audioManager.play('cancel');
      return;
    }
    // The doors shut and the car shakes, as FireRed's does, and the doors open
    // on the floor chosen: the player steps out facing away from them.
    this.isWarping = true;
    this.player.stop();
    this.showIdlePose();
    audioManager.play('lift');
    this.cameras.main.shake(LIFT_RIDE_MS, 0.004);
    this.time.delayedCall(LIFT_RIDE_MS, () =>
      this.walkThrough({
        source: lift.stops[here].landing,
        destinationMapId: this.currentMap.id,
        destination: to.landing,
        facing: 'down',
        activation: 'push',
        toward: 'up',
      }),
    );
  }

  /**
   * Pressing out to sea from a jetty: a question while the boat sails, and
   * while it does not, when it sails - on the interact key every time, and on
   * a push the first time a visit to the jetty presses out, because pressing
   * out to sea is what a newcomer does and a silent bump told them nothing.
   * After that a push is a bump, as pushing into the water is.
   */
  private tryBoard(facing: Direction, asked: boolean): boolean {
    const found = boatAt(this.currentMap.sailings, this.currentTile, facing);
    if (!found) {
      return false;
    }
    const state = this.sailingStateNow(found.sailing);
    if (state !== 'sailing') {
      const told =
        this.boatAwayToldAt?.x === this.currentTile.x && this.boatAwayToldAt.y === this.currentTile.y;
      if (!asked && told) {
        return false;
      }
      this.boatAwayToldAt = { ...this.currentTile };
      this.facing = facing;
      this.pushingAgainst = null;
      this.showIdlePose();
      this.dialogBox.showMessages([
        ...boatAwayLines(found.sailing, state, this.tideMs()),
      ]);
      return true;
    }
    this.facing = facing;
    this.pushingAgainst = null;
    this.showIdlePose();
    const far = found.sailing.ends[1 - found.from].landing;
    const prompt = boardingPrompt(found.sailing, this.placeNameAt(far));
    this.trainerPrompt = new ChoicePrompt(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      padding: 10,
      lines: prompt.lines,
      options: prompt.options,
      selected: prompt.selected,
      onChoose: (index) => this.answerBoarding(found.sailing, found.from, index === 0),
    });
    return true;
  }

  private answerBoarding(sailing: MapSailing, from: 0 | 1, sailingAway: boolean): void {
    this.trainerPrompt?.destroy();
    this.trainerPrompt = undefined;
    if (!sailingAway) {
      audioManager.play('cancel');
      return;
    }
    this.pendingVoyage = { sailing, from };
    this.dialogBox.showMessages([castOffLine(sailing)]);
  }

  /**
   * Casts off: the player goes aboard and is carried along the course a tile a
   * step, at walking pace, so the trip costs the raid clock exactly what
   * walking that far would. The figure is the boat until it puts in.
   */
  private castOff(): void {
    const voyageNow = this.pendingVoyage;
    this.pendingVoyage = undefined;
    if (!voyageNow) {
      return;
    }
    const tiles = voyage(voyageNow.sailing, voyageNow.from);
    const boat = this.boatSprite(tiles[0]);
    this.mapObjects.push(boat);
    // The shore the player was already across the water from, if any, and
    // otherwise the one they are putting out from: afloat, that is where the
    // hunter is left (`hunterArrivesFrom`).
    const shoreBefore =
      this.runSession?.shoreLeftBehind?.mapId === this.currentMap.id
        ? this.runSession.shoreLeftBehind.position
        : undefined;
    const boardedAt = voyageNow.sailing.ends[voyageNow.from].landing;
    if (this.runSession) {
      this.runSession.shoreLeftBehind = { mapId: this.currentMap.id, position: { ...(shoreBefore ?? boardedAt) } };
    }
    this.voyaging = { ...voyageNow, tiles, index: 0, progress: 0, boat, shoreBefore };
    this.partner?.tuckIn();
    this.player.setVisible(false);
    this.playerGroundMark.setVisible(false);
    this.playerHeadMark.setVisible(false);
    this.currentTile = { ...tiles[0] };
    this.setPlayerPosition(tiles[0].x * TILE_SIZE, tiles[0].y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);
    this.refreshBoats();
    audioManager.play('warp');
  }

  /**
   * One frame of the voyage. Each tile of water is a step of the raid; the last
   * step is ashore, onto the far jetty, facing away from the water. Nothing on
   * land can reach a player on the water: no hunter, no wild Pokemon, no door.
   */
  private advanceVoyage(deltaMs: number): void {
    const trip = this.voyaging;
    if (!trip) {
      return;
    }
    trip.progress += deltaMs / STEP_DURATION_MS;
    while (trip.progress >= 1 && trip.index < trip.tiles.length - 1) {
      trip.progress -= 1;
      trip.index += 1;
      this.currentTile = { ...trip.tiles[trip.index] };
      if (this.runSession) {
        this.runSession.stepsTaken = (this.runSession.stepsTaken ?? 0) + 1;
      }
      this.hunterStillMs = 0;
    }
    const last = trip.tiles.length - 1;
    if (trip.index >= last) {
      this.putIn(trip);
      return;
    }
    const from = trip.tiles[trip.index];
    const to = trip.tiles[trip.index + 1];
    const heading = stepDirection(from, to) ?? this.facing;
    if (trip.index < last - 1) {
      // Afloat: the boat carries the player, its bow the way it goes.
      const t = Math.min(1, trip.progress);
      this.placeBoat(trip.boat, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (heading === 'left' || heading === 'right') {
        trip.boat.setFlipX(heading === 'right');
      }
      this.facing = heading;
      this.setPlayerPosition(
        Phaser.Math.Linear(from.x, to.x, t) * TILE_SIZE,
        Phaser.Math.Linear(from.y, to.y, t) * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
      );
    } else {
      // The last step is ashore: the boat lies at the far jetty and the
      // player walks off it onto the boards.
      this.player.setVisible(true);
      this.playerGroundMark.setVisible(true);
      this.playerHeadMark.setVisible(true);
      this.facing = heading;
      this.player.play(this.playerWalkKey(), true);
      this.setPlayerPosition(
        Phaser.Math.Linear(from.x, to.x, trip.progress) * TILE_SIZE,
        Phaser.Math.Linear(from.y, to.y, trip.progress) * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
      );
    }
  }

  private putIn(trip: NonNullable<WorldScene['voyaging']>): void {
    trip.boat.destroy();
    this.mapObjects = this.mapObjects.filter((object) => object !== trip.boat);
    this.voyaging = undefined;
    const ashore = trip.sailing.ends[1 - trip.from];
    this.currentTile = { ...ashore.landing };
    // Ashore: across the water from the shore left behind, or back on ground
    // the hunter can walk to from it, and so nothing left behind at all.
    if (this.runSession) {
      const shore = shoreLeftBehind(
        this.currentMap,
        trip.shoreBefore,
        trip.sailing.ends[trip.from].landing,
        ashore.landing,
      );
      this.runSession.shoreLeftBehind = shore ? { mapId: this.currentMap.id, position: shore } : undefined;
    }
    this.facing = OPPOSITE_DIRECTION[ashore.toward];
    this.player.setVisible(true);
    this.playerGroundMark.setVisible(true);
    this.playerHeadMark.setVisible(true);
    this.setPlayerPosition(this.currentTile.x * TILE_SIZE, this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);
    this.showIdlePose();
    this.standPartnerBesidePlayer();
    this.refreshBoats();
    this.saveGame();
    this.noteDistrict();
    this.surveyGround();
    // The key that boarded is still down: it must not walk the player straight
    // back off the jetty they have just been put down on.
    this.spentPresses.spendHeld(this.directionKeys);
  }

  /** The named place a tile is in, as the arrival plate would say it. */
  private placeNameAt(tile: GridPosition): string | undefined {
    return districtAt(this.currentMap.id, tile)?.name;
  }

  private refreshExtractionMarkers(): void {
    for (const { point, marker, label } of this.extractionMarkers) {
      const isOpen = this.isExtractionOpen(point);
      marker.setTexture(extractionIconKey(point, isOpen));
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
    flashScreen(this.cameras.main, 220, [239, 68, 68]);
    this.cameras.main.shake(180, 0.009);
    audioManager.play('clockExpired');
    const carriedOut = this.bag.toJSON();
    // The pack the clock ran out on is what divides the loss: only a secured
    // supply still in it comes home, and only what is still in it was lost with
    // the raid. Anything missing from it was spent, and is reported as spent.
    const wipe = buildWipeSettlement(this.runSession.secureSlot.items ?? [], carriedOut);
    this.recordRaid('wiped');
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      { ...this.runSession.stashSecureSlot, items: wipe.securedItems },
      // A secured Pokemon comes home in the state the raid left it in.
      deployedRaidCondition(this.runSession.broughtPokemonIds, snapshot),
      // The pack the clock ran out on goes with the raid. It was never in the bag -
      // it is the bag - so nothing in the accounting above can name it, and the
      // secure container cannot protect it either.
      this.runSession.packItemId,
    );
    this.pendingHubTransition = true;
    this.showRunResult(
      buildExtractionReport({
        outcome: 'WIPED',
        cause: 'timer',
        snapshot,
        durationMs: snapshot.durationMs,
        leftBehind: this.prizesLeftBehindNow(),
        lost: { pokemon: result.lostPokemon, items: wipe.destroyedItems },
        carriedOut,
        fitToRaid: anyoneFitToRaid(new SaveManager().load()?.stash),
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

    if (this.pendingWildBattle) {
      const wild = this.pendingWildBattle;
      this.pendingWildBattle = undefined;
      audioManager.play('encounter');
      this.transitionToBattle({ wild, teachingBattle: false });
      return;
    }

    if (this.pendingGiftNickname) {
      this.askGiftNickname(this.pendingGiftNickname);
      return;
    }

    if (!this.pendingHubTransition) {
      return;
    }

    const home = homeAfterRaid();
    if (this.scene.manager.keys[home.key]) {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(home.key, home.data);
      });
      return;
    }
    this.scene.start('title');
  }

  /**
   * Where the hunter's arrival is measured from: the player, or the jetty they
   * last put out from while they are across the water from it - on the water
   * included, so a hunter due mid-voyage waits on the shore it was left on.
   */
  private hunterArrivesFrom(): GridPosition {
    const shore = this.runSession?.shoreLeftBehind;
    return shore && shore.mapId === this.currentMap.id ? shore.position : this.currentTile;
  }

  /**
   * Brings the hunter into the raid, and re-places one that arrived somewhere unfair.
   *
   * Both cases retry every tick rather than settle for a bad tile: the spawn search
   * only comes up empty in a pocket too small to hold a fair arrival, and the player
   * walking out of that pocket is what fixes it.
   */
  private placeHunterIfDue(elapsedMs: number): void {
    // A room's hunter is brought in by its keeper, and only drawn here.
    if (this.huntRoleWas === 'follower') {
      return;
    }
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
    const returning = this.hunterState.returning === true;
    this.hunterState = {
      ...this.hunterState,
      spawned: true,
      defeated: false,
      returning: false,
      mapId: this.currentMap.id,
      position,
    };
    this.createHunterSprite();
    if (awaitingSpawn) {
      audioManager.play('hunterArrival');
      // A beaten hunter back for the enrage says so: it is the one return
      // there is (`hunterAtEnrage`).
      this.interrupt([returning ? this.hunterRival().comeback : this.hunterRival().arrival], [position]);
    }
  }

  /** Who is hunting this raid - a face and lines, never a fight (`hunters.ts`). */
  private hunterRival(): HunterRival {
    // In a room the hunter is everybody's, so it is whoever the room first
    // heard hunting: one face, one set of lines, one lead (`groupHunter.ts`).
    const shared = this.huntRoleWas === 'solo' ? undefined : friendRoom()?.hunters.latest?.hunter.rivalId;
    return hunterRival(shared ?? this.runSession?.plan?.hunter.rivalId ?? FIRST_HUNTER_RIVAL);
  }

  private isHunterEligible(): boolean {
    return (
      hunterComes() &&
      isHunterEligibleForFirstContract(
        this.currentMap.id,
        this.runSession?.plan?.contract?.mapId,
        this.activatedPoiIds.size > 0,
      )
    );
  }

  private findHunterSpawnTile(): GridPosition | null {
    const rng = this.runSession?.rng;
    return findHunterSpawnTile(
      // The hunter cannot sail: for a player across the water it comes in on
      // the shore they put out from, never beside them (`shoreLeftBehind`).
      this.hunterArrivesFrom(),
      this.bounds,
      (tile) => this.isBlockedForHunter(tile),
      // Wrapped rather than passed by reference so the RNG keeps its own `this`.
      rng ? (candidates) => rng.pick(candidates) : undefined,
      HUNTER_SPAWN_DISTANCE,
      // This raid's own exits, so the hunter never arrives in the one lane
      // between the player and every way out (the breakaway reads them too).
      this.reachableExitPositions(),
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

  /**
   * One step of the hunter's chase, paid for by a step of whoever it is after:
   * this player (`stepper` left out) or, for a room's keeper, the friend it is
   * chasing (`stepForFriends`). A step by anybody else moves it nowhere.
   */
  private advanceHunterPursuit(stepper?: string): void {
    if (!this.isHunterOnCurrentMap() || !this.hunterState.position) {
      return;
    }
    // A hunter that lost the trail holds where the player slipped away from it.
    if (isHunterSearching(this.hunterState)) {
      return;
    }
    // A room's hunter is walked by its keeper, and holds where it stands while
    // anybody fights it.
    if (this.huntRoleWas === 'follower' || (this.huntRoleWas === 'keeper' && friendRoom()?.hunters.hunterHeld)) {
      return;
    }
    const chased = this.groupQuarry();
    const me = friendRoom()?.room?.me;
    if (chased && chased.id !== (stepper ?? me)) {
      return;
    }
    if (chased && chased.id !== me) {
      this.chaseFriend(chased.tile);
      return;
    }
    const aggression = this.runSession?.plan?.hunter.aggressionStepsPerPlayerStep
      ?? DEFAULT_HUNTER_TUNING.aggressionStepsPerPlayerStep;
    const steps = this.runSession?.manager.isEnraged
      ? Math.max(aggression, HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP)
      : aggression;
    let position = this.hunterState.position;
    // What it is walking towards is what it can see: out in the open that is
    // the player and the sighting is recorded, and under a roof it is the last
    // tile it knew them on (`interiors.ts`). Contact below is still asked of
    // the player's real tile, because a hunter standing next to you has found
    // you whatever it believes.
    const quarry = hunterQuarry(this.hunterState, this.currentTile, this.playerIsHidden());
    this.hunterState = quarry.state;
    // The player holds still for the whole tick, so one search covers every step it takes.
    const path = findHunterPursuitPath(position, quarry.target, this.bounds, (tile) =>
      this.isBlockedForHunter(tile),
    );
    for (let index = 0; index < steps && index < path.length; index += 1) {
      this.hunterFacing = bearingFrom(position, path[index]) ?? this.hunterFacing;
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
    // Placed a tile at a time and turned the way it went: until the hunters
    // had faces it stood facing down for the whole raid, gliding sideways.
    this.placeFigure(HUNTER_FIGURE_ID, position.x, position.y, this.hunterFacing);
  }

  /** The keeper's hunter, a step towards a friend: their own browser makes the catch when it gets there. */
  private chaseFriend(target: GridPosition): void {
    let position = this.hunterState.position!;
    const aggression = this.runSession?.plan?.hunter.aggressionStepsPerPlayerStep
      ?? DEFAULT_HUNTER_TUNING.aggressionStepsPerPlayerStep;
    const steps = this.runSession?.manager.isEnraged
      ? Math.max(aggression, HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP)
      : aggression;
    const path = findHunterPursuitPath(position, target, this.bounds, (tile) => this.isBlockedForHunter(tile));
    for (let index = 0; index < steps && index < path.length; index += 1) {
      if (isHunterContactingPlayer(position, target)) {
        break;
      }
      this.hunterFacing = bearingFrom(position, path[index]) ?? this.hunterFacing;
      position = path[index];
    }
    this.hunterState = { ...this.hunterState, position };
    this.placeFigure(HUNTER_FIGURE_ID, position.x, position.y, this.hunterFacing);
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
        // And this raid's own exits, so the retreat is never through the one neck
        // between the player and every way out of the raid. Read off the plan
        // rather than the markers, which are not built until createEntities().
        this.reachableExitPositions(),
      ),
    );
  }

  /**
   * The step a hunter takes on a player who is standing still, every
   * `HUNTER_IDLE_STEP_MS` of raid clock (`hunterIdleSteps`). It is the same
   * step a player's step pays for, so it moves as far, sounds as near and is
   * as enraged. The catch it can make is asked by `update()` the first moment
   * nothing is on screen to read: the hunter may walk up while a box is being
   * read, because the clock is being charged for that box, but a fight never
   * starts underneath one.
   */
  private advanceHunterWhileStill(chargedMs: number): void {
    if (this.huntRoleWas === 'follower') {
      this.hunterStillMs = 0;
      return;
    }
    if (
      this.targetTile ||
      !this.isHunterOnCurrentMap() ||
      !this.hunterState.position ||
      isHunterSearching(this.hunterState) ||
      isHunterContactingPlayer(this.hunterState.position, this.currentTile)
    ) {
      this.hunterStillMs = 0;
      return;
    }
    const idle = hunterIdleSteps(this.hunterStillMs, chargedMs);
    this.hunterStillMs = idle.stillMs;
    for (let step = 0; step < idle.steps; step += 1) {
      if (isHunterContactingPlayer(this.hunterState.position, this.currentTile)) {
        return;
      }
      // Whoever it is after: standing still is standing still, whoever it is.
      this.advanceHunterPursuit(this.groupQuarry()?.id);
    }
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
    flashScreen(this.cameras.main, 120, [251, 191, 36]);
    audioManager.play('hunterResume');
  }

  private isBlockedForHunter(tile: GridPosition): boolean {
    return (
      this.collisionData[tile.y][tile.x] ||
      this.barredExitAt(tile) !== undefined ||
      this.currentMap.entities.some((entity) => this.entityHolds(entity, tile)) ||
      this.trainersForCurrentMap().some(
        (trainer) => trainer.position.x === tile.x && trainer.position.y === tile.y,
      )
    );
  }

  private tryStartHunterBattle(): boolean {
    if (
      this.hunterFightingSomebodyElse() ||
      !this.isHunterOnCurrentMap() ||
      !this.hunterState.position ||
      isHunterSearching(this.hunterState) ||
      !isHunterContactingPlayer(this.hunterState.position, this.currentTile)
    ) {
      return false;
    }
    this.catchPlayer(this.hunterState.position);
    return true;
  }

  /**
   * Walking into the hunter, which is being caught by it.
   *
   * A figure is collision, and a hunter that has lost the trail holds its tile
   * blind for `HUNTER_SEARCH_MS` - so for that whole window it was a thing that
   * would neither fight the player nor get out of their way, and in a neck that
   * is a door with nobody's hand on it. The captain played into one on
   * 2026-09-19 and could not move: "it wouldn't attack me or do anything. It's
   * just in my way and I was stuck in an area."
   *
   * The answer is not to let the player pass through a person. It is that this
   * particular person is the one chasing them, so the tile they are standing on
   * is a tile the player may always step into and the price of stepping into it
   * is the fight - the same `hunterCatchCutscene` a pursuit contact plays,
   * because it is the same event arrived at from the other side. That makes the
   * trap impossible by construction rather than unlikely: no arrangement of the
   * two figures can be a wall, on any map, in any gate state, whatever the
   * search window is doing. `findHunterBreakawayTile` keeps it from arising in
   * the first place where the map gives it any choice; this is what holds where
   * the map gives none.
   *
   * It is deliberately not conditional on the search: during a pursuit the catch
   * has already fired on the step that made the two adjacent, so this can only
   * ever be reached by a player pushing into a hunter that is holding still.
   */
  private tryWalkIntoHunter(facing: Direction): boolean {
    if (this.hunterFightingSomebodyElse() || !this.isHunterOnCurrentMap() || !this.hunterState.position) {
      return false;
    }
    const into = nextTileFromDirection(this.currentTile, facing);
    if (into.x !== this.hunterState.position.x || into.y !== this.hunterState.position.y) {
      return false;
    }
    this.facing = facing;
    this.catchPlayer(this.hunterState.position);
    return true;
  }

  /** Whether a room's hunter is in a fight with another player, and so catches nobody else until it is over. */
  private hunterFightingSomebodyElse(): boolean {
    return this.huntRoleWas !== 'solo' && (friendRoom()?.hunters.hunterHeld ?? false);
  }

  /** The one catch: the fight is queued, and the beat that hands it over plays. */
  private catchPlayer(hunter: GridPosition): void {
    // Whichever way the two of them met, the hunter has the player: a search
    // window left running would have it blind to someone it is already holding.
    this.hunterState = { ...this.hunterState, searchRemainingMs: 0 };
    this.pendingTrainerBattle = {
      // Matched to the party that can fight *now*: one Pokemon for each of
      // theirs still standing, so a raid that lost two on the way meets one.
      trainer: createHunterTrainer(
        this.runSession!.manager.snapshot().elapsedMs,
        this.runSession!.manager.isEnraged,
        this.runSession!.plan?.hunter && { ...this.runSession!.plan.hunter, rivalId: this.hunterRival().id },
        this.party.pokemon,
      ),
      introLines: this.hunterRival().caught,
      isHunter: true,
    };
    this.playCutscene(
      hunterCatchCutscene(
        HUNTER_FIGURE_ID,
        hunter,
        this.currentTile,
        this.facing,
        this.pendingTrainerBattle.introLines,
      ),
    );
  }
}

/**
 * An exit is one object in two states, so the open and the locked pad are the
 * same silhouette in two colours rather than two different marks.
 */
function extractionIconKey(point: ExtractionPoint, isOpen: boolean): string {
  // A buried exit is drawn as the rubble it is under, which is also a wall:
  // a locked pad would read as somewhere to stand and wait. A keyed exit is the
  // padlocked gate it is, for the same reason.
  if (!isOpen && isDugExit(point)) {
    return iconTextureKey(WORLD_ICONS.rubble);
  }
  if (!isOpen && point.requirement?.kind === 'key') {
    return iconTextureKey(WORLD_ICONS.lockedGate);
  }
  return iconTextureKey(isOpen ? WORLD_ICONS.extractionOpen : WORLD_ICONS.extractionLocked);
}

/** The frame name the Strength boulder is cut as on the town sheet's texture. */
const BOULDER_FRAME = 'strength-boulder';
/** And Victory Road's floor switch and rock barrier, on the area sheet's. */
const SWITCH_UP_FRAME = 'floor-switch';
/** The way a spinning figure turns, a facing a tile, as FireRed's does. */
const SPIN_TURNS: readonly Direction[] = ['down', 'left', 'up', 'right'];
/** The Rocket Hideout's shutter, a frame a cell. */
const SHUTTER_FRAME = (dx: number, dy: number): string => `hideout-shutter-${dx}-${dy}`;
/** How long the lift's car shakes before its doors open on another floor, as FireRed's `AnimateElevator`. */
const LIFT_RIDE_MS = 900;
const BARRIER_TOP_FRAME = 'rock-barrier-top';
const BARRIER_FOOT_FRAME = 'rock-barrier-foot';
/** The Seagallop's frame on the town sheet, cut the first time a boat is drawn. */
const BOAT_FRAME = 'seagallop-boat';
/** How far the Seagallop's deck rises above the top of the tile it lies on. */
const BOAT_RIDE_Y = 4;

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
