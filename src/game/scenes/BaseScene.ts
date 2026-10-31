import Phaser from 'phaser';
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
import { PressLatch } from '../input/pressLatch';
import { STEP_DURATION_MS, advanceStepClock } from '../movement/stepClock';
import { activeSaveSlot, isPlaytestRun, PLAYTEST_RUN_DIVISOR } from '../dev/playtestMode';
import { countPlay } from '../analytics/playCounter';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_HEAD_PIXEL_Y,
  getIdleFrame,
} from '../playerFrames';
import {
  getWorldCharacterAppearance,
  NO_TINT,
  PLAYER_MARKER_DEPTH,
  PLAYER_MARKER_GROUND_LAYERS,
  PLAYER_MARKER_HEAD_LAYERS,
  SHARED_CHARACTER_TEXTURE,
  worldCharacterIdleFrame,
  type MarkerLayer,
} from '../world/characterPresentation';
import { getCharacterDesign } from '../world/characterDesigns';
import { TILE_SIZE, type TileLayer } from '../worldMap';
import { DialogBox } from '../ui/DialogBox';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { audioManager } from '../audio/AudioManager';
import { nextBump } from '../audio/worldSounds';
import { SpentPresses } from '../world/spentPresses';
import { SaveManager, raidsDeployed, raidsLost, type RestoredGame } from '../save/SaveManager';
import {
  FAVOUR_ANSWERS,
  declineErrand,
  errandLines,
  errandRecord,
  errandToSay,
  harbourGiver,
  withErrandAsked,
  type Errand,
  type ErrandBeat,
  type ErrandGiver,
} from '../hub/errands';
import { lookKey, readLook } from '../look/look';
import { lookHeadDrop, lookTexture, lookWalkKey } from '../look/lookTexture';
import type { BoutiqueSceneData } from './BoutiqueScene';
import {
  HOME_KEY_LETTERS,
  RAID_KEY_LETTERS,
  ROOM_KEY_LETTERS,
  houseKeyHintLine,
  yardKeyHintLine,
  type LearnableKeyId,
} from '../input/keyBindings';
import { WorldLabel, type WorldLabelTone } from '../ui/WorldLabel';
import { placeCaptions, placeDialog, seatedOver, type Rect } from '../ui/labelPlacement';
import { advanceLookMs, isLooking } from '../ui/captionReveal';
import { GAME_FONT } from '../ui/gameFont';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import {
  CANOPY_BAND,
  CAPTION_BAND,
  FIGURE_BAND,
  MARKER_BAND,
  TERRAIN_DEPTH,
  atRow,
} from '../world/depths';
import type { TileSource } from '../world/tileset/catalogue';
import { brimRuns, type MapLayers } from '../world/tiles';
import { BASE_PLACE_NAME, BASE_SIGNS, BASE_SPAWN, NOTICE_BOARD, getBaseMap } from '../base/baseMap';
import { noticeFor } from '../base/harbourNotices';
import { BASE_TILESET, type BasePropName } from '../base/baseTileset';
import { BASE_DOORS, doorAt, doorNamed, type BaseDoor, type BaseScreen } from '../base/doors';
import { doorStatusLine } from '../base/doorStatus';
import { gymGuideLines } from '../base/gymGuide';
import { BASE_SHEET_SOURCE } from '../base/baseSheet';
import { BASE_PIECES } from '../base/generated/basePieces';
import {
  BASE_ROOMS,
  buildRoom,
  ARENA_STATION_NAMES,
  roomNamed,
  servesFrom,
  stairArrival,
  stairAt,
  type BaseRoom,
  type BuiltRoom,
  type RoomSprite,
  type RoomThing,
} from '../base/rooms';
import { standingFixtures, type BaseFixture } from '../base/fixtures';
import { HARBOUR_LANDMARKS } from '../base/landmarks';
import { HarbourLifeFigures } from '../base/harbourLifeFigures';
import {
  HARBOUR_PEOPLE,
  harbourLifeAt,
  wardenLines,
  type HarbourFigure,
  type HarbourPerson,
} from '../base/harbourLife';
import { harbourPlaceAt } from '../base/harbourPlaces';
import { PlaceNameSign } from '../base/placeNameSign';
import { FloatingBoats } from '../base/floatingBoats';
import { anglerLines, harbourBite, reeledInLines } from '../base/harbourFishing';
import { spyglassLines } from '../base/spyglass';
import { seagallopLines } from '../base/seagallopLog';
import { paintFloat } from '../world/fishingFloat';
import { ALL_SPECIES } from '../pokemon/species';
import {
  NOT_EVEN_A_NIBBLE,
  ON_THE_HOOK,
  bestRod,
  castDurationMs,
  dotsShown,
  planCast,
  type CastPlan,
} from '../world/fishing';
import { HarbourNight } from '../base/harbourNight';
import { HarbourBird } from '../base/harbourBird';
import { windowLight } from '../base/homeClock';
import { TILE_ANIMATIONS_BY_TILE, animatedTileAt } from '../world/tileAnimation';
import type { Material } from '../world/tileset/materials';
import {
  CABINET_UNITS,
  EMPTY_CABINET_LINE,
  ODDITY_ART,
  ODDITY_HEIGHT,
  ODDITY_INK,
  cratesLine,
  firstOddityAt,
  nextOddity,
  unitTiles,
  type PlacedOddity,
} from '../base/cabinet';
import { oddityLabel } from '../hub/traderCabinet';
import { wallMapPoster } from '../base/wallMap';
import { badgeCasePoster } from '../base/badgeCase';
import { pennantsPoster } from '../base/pennants';
import type { PaintedPicture } from '../world/minimap';
import {
  arrivalPlace,
  directionBetween,
  sameTile,
  partnerFrame,
  partnerOf,
  partnerReaction,
  turnToPartner,
  type PartnerEmote,
  type PartnerPlaceName,
} from '../base/partner';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  PARTNER_SPRITE_X_OFFSET,
  PartnerFigure,
  drawEmoteBubble,
  type PartnerHost,
} from '../base/partnerFigure';
import { WAVE_SHOWN_MS } from '../harbour/harbourLink';
import { DAY_CARE_KEEPER, PEN_HOME, nextPenTile } from '../base/dayCarePen';
import {
  checkOnLines,
  DAY_CARE_OFFER_LINES,
  dayCareReport,
  dayCareStatusLine,
  NOT_TAKEN_BACK_LINE,
  raidsCompleted,
  takeBackQuestion,
  takenBackReport,
} from '../hub/dayCare';
import {
  POKEMON_ICON_FRAME_MS,
  POKEMON_ICON_TEXTURE,
  isFigureSpecies,
  pokemonIconFrames,
  pokemonSoleDrop,
  type FigureSpeciesId,
} from '../world/pokemonFigures';
import type { ConsoleSceneData } from './ConsoleScene';
import type { HubSceneData } from './HubScene';
import type { ArenaIntroSceneData } from './ArenaIntroScene';
import { ARENA_DARK_BELOW, ARENA_MAT, ARENA_STATIONS, PIT_RIM, acrossOval, arenaStationAt, cameraLean, type ArenaStationId } from '../base/arenaHall';
import { ArenaView } from '../base/arenaView';
import { ArenaFurniture } from '../base/arenaFurniture';
import { MAX_RUN_PARTY } from '../hub/deploymentFlow';
import { flowForGame, heldRoomMapId, offeredInsertions, type ArenaKit } from '../base/arenaKit';
import { ArenaDiveView } from '../base/arenaDiveView';
import { STANDS_HEIGHT, STANDS_ORIGIN, STANDS_WIDTH } from '../base/arenaStands';
import { ARENA_RIM, fenceBeside, isAtRim, landingBelow, rimTileOver, type RimLanding } from '../base/arenaRim';
import {
  FOG_APPROACH_MS,
  FOG_LIFT_MS,
  FOG_LIFT_STEPS,
  FOG_STEP_MS,
  FALL_MS,
  JUMP_MS,
  TURN_BACK_MS,
  HOP_MS,
  facingTowards,
  jumpPose,
  partnerLeap,
  overTheFence,
} from '../base/arenaDive';
import { marshalLines } from '../base/arenaMarshal';
import { wallMapPicture } from '../base/wallMap';
import { requireInsertion, runInsertion, type RunInsertionId } from '../run/runGeneration';
import type { ArenaPanel } from './HubScene';
import type { WorldSceneData } from './WorldScene';
import { worldMapName, type WorldMapId } from '../worldMap';
import { FIRST_WORDS, hasHeard, spokenLines, type FirstWordsId } from '../hub/firstWords';
import { centerOffer, healedLine, NOT_HEALED_LINE, SWAP_AT_THE_PC_LINE } from '../hub/centerCounter';
import { dueMilestone, milestoneWords, pokedexOwned } from '../hub/pokedex';
import { boardLines, boardPoster, oakNews } from '../base/labBoard';
import { friendRoom, friendRoomsOffered } from '../raidRoom/friendRoom';
import { abandonedRaidLines, raidHeartbeat } from '../run/raidInFlight';
import { isHomeRoom, ownedFurniture, type Placement } from '../home/arrangement';
import { DecorateMode, type DecorateHost } from '../base/decorateMode';
import { loadPlayerName } from '../console/playerName';
import { houseNameNeeded, welcomeHomeLines } from '../home/houseName';
import { openNameScreen } from '../ui/PlayerNameOverlay';
import { nameService } from '../names/nameService';
import { harbour, harbourHouses, type HarbourWhere } from '../harbour/harbour';
import type { KnockAtTheDoor } from '../harbour/houseService';
import { houseSnapshot, readHouseSnapshot } from '../home/houseSnapshot';
import {
  KNOCK_SIGN_LINE,
  LET_IN,
  NOT_NOW,
  knockGoneLine,
  knockQuestion,
  notYoursLine,
  notYoursToMoveLine,
  visitWelcomeLines,
  visitorThingName,
} from '../home/knocking';
import { openKnockScreen, type LetIn } from '../ui/KnockOverlay';
import { feedbackTabOverGame } from '../feedback/feedbackTabCover';
import { ChoicePrompt } from '../ui/ChoicePrompt';
import { openFavourList } from '../ui/FavourListOverlay';
import { PanelLean } from '../ui/sidePanel';
import { favourEntries } from '../hub/favourList';
import { SHARED_HARBOUR_ROOMS } from '../harbour/harbourProtocol';
import { HarbourFigures } from '../base/harbourFigures';
import { OWN_SPEAKER, harbourTalk } from '../base/harbourTalk';
import { SpeechBubble } from '../base/speechBubble';
import { HARBOUR_PHRASES, type HarbourPhraseId } from '../harbour/harbourPhrases';
import { PhrasePicker } from '../ui/PhrasePicker';
import { harbourRegulars, regularsClock, type RegularsWatcher } from '../base/harbourRegulars';
import { requestedTestMode } from '../dev/testMode';
import type { MenuOverlay } from '../ui/MenuOverlay';
import { furnitureDepth, furnitureImage, furnitureRect } from '../base/furnitureArt';

/**
 * THE HARBOUR: the base, walked rather than chosen off a list - and the four
 * rooms inside its buildings.
 *
 * Everything the four base screens do is untouched - they are `HubScene`
 * exactly as they were. What this scene replaces is the lobby that used to sit
 * in front of them: instead of four cards on one page, the player stands in
 * their own base, walks through a door and finds the keeper inside. The reason
 * is not navigation. It is that a base you can see is a base that can *fill
 * up*: every rung of Brock's ladder stands somewhere in the yard
 * (`base/fixtures.ts`) and in his workshop (`base/rooms.ts`), so the reward for
 * a raid is a thing in a place rather than a row going grey.
 *
 * One scene, two kinds of place. The yard and a room are both a drawn map the
 * player walks on, so they share every line of the walking, the drawing and the
 * captions; what differs is only what a door does and who is standing where.
 * Going through a door starts this scene again in the other place, the way a
 * FireRed door is a fade and a new map.
 *
 * It is deliberately not `WorldScene`. A raid scene carries a clock, a hunter, a
 * pack, wild encounters, loot, contracts, extraction, trainer watches, cutscenes
 * and a settlement, and the base has exactly none of those - the captain's one
 * hard rule for it is that it is safe. What the two do share is the walking and
 * the drawing, and those are shared as modules (`movement/`, `world/tiles`,
 * `world/characterPresentation`, `ui/WorldLabel`) rather than by inheritance.
 *
 * Walking is never a toll, because the base is crossed many times an hour: a
 * doorway opens the moment it is stepped on, and inside, the interact key on
 * the door mat opens the keeper's screen without crossing the room. Nothing
 * spends a line of dialogue on the way in.
 */

const CAMERA_ZOOM = 1;
/** Whether this page has counted a walk into the harbour yet (`analytics/playCounter.ts`). */
let harbourCounted = false;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;

/** The rim tile this page last jumped from: where a raid's ending puts the player back. */
let lastJumpedFrom: GridPosition | null = null;
/** Whether a raid has come home since the player was last out in the harbour: the Seagallop ties up when they get there. */
let boatDueHome = false;
/** How fast the hall's camera comes round to what it is asked to look at: a share of the way, per millisecond. */
const CAMERA_EASE_MS = 140;
/** How long a raid's fog lifts before a key can cut it short. */
const FOG_LISTENS_AFTER_MS = 500;
/** How often a held raid room is told this player is getting ready, and asked who else is. */
const HALL_ROOM_TICK_MS = 250;

/** How far above the player's head their own hand goes up when they wave: clear of the chevron over it. */
const OWN_WAVE_LIFT = 6;

/** What the hint line says facing another player in the shared harbour. */
const WAVE_HINT = '[SPACE] WAVE';

/** What the hint line says while the quick-phrase list is open. */
const PHRASE_LIST_HINT = `[ARROWS] CHOOSE   [SPACE] SAY   [${ROOM_KEY_LETTERS.talk}] CLOSE`;
const DIALOG_WIDTH = 232;
const DIALOG_HEIGHT = 56;
const DIALOG_MARGIN = 8;
const HINT_MARGIN = 6;
const HINT_PADDING_X = 5;
const HINT_PADDING_Y = 2;
const figureRect = (tile: GridPosition): Rect => ({
  x: tile.x * TILE_SIZE,
  y: tile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET + CHARACTER_HEAD_PIXEL_Y,
  width: TILE_SIZE,
  height: FIGURE_HEIGHT,
});

/** The rectangle a planted landmark covers, read off the art rather than typed. */
const propsRect = (props: readonly { name: BasePropName; x: number; y: number }[]): Rect =>
  boxRect(
    props.map((prop) => {
      const art = BASE_TILESET.props[prop.name];
      return { x: prop.x, y: prop.y, right: prop.x + art.width, bottom: prop.y + art.height };
    }),
  );

const tilesRect = (tiles: readonly GridPosition[]): Rect =>
  boxRect(tiles.map((tile) => ({ x: tile.x, y: tile.y, right: tile.x + 1, bottom: tile.y + 1 })));

function boxRect(boxes: readonly { x: number; y: number; right: number; bottom: number }[]): Rect {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return {
    x: left * TILE_SIZE,
    y: top * TILE_SIZE,
    width: (right - left) * TILE_SIZE,
    height: (bottom - top) * TILE_SIZE,
  };
}

/**
 * The base's two caption tones. A door is the warm one, because it is somewhere
 * to go; a thing you built is the quiet slate the raid maps use for a landmark
 * that has been worked - it is a fact about the place now, not something to do.
 */
/** The texture the wall map is painted into, one per visit to the lab. */
const WALL_MAP_TEXTURE = 'base-wall-map';

const DOOR_TONE: WorldLabelTone = { fill: 0x3a2408, border: 0xf1bf63, ink: '#fef3c7' };
/** The least time between two waves heard lapping at the quay; the most is twice it. */
const WAVE_EVERY_MS = 4200;
/** How many steps off the sea can still be heard. */
const WAVE_EARSHOT = 5;
/** The least time between two of the S.S. Anne's horns; the most is twice it. */
const HORN_EVERY_MS = 95_000;
/** The Seagallop's sailor by the jetty, who keeps her log (`base/seagallopLog.ts`). */
const SAILOR_ID = 'seagallop-sailor';
/** The S.S. Anne's captain on the long pier, who lends his spyglass (`base/spyglass.ts`). */
const CAPTAIN_ID = 'ss-anne-captain';
/** How many looks through the captain's glass this sitting: the sights go round in order. */
let spyglassLooks = 0;
/** The angler on the cove's jetty, who lends his rod (`base/harbourFishing.ts`). */
const ANGLER_ID = 'cove-angler';
/** The Gym Guide at the Raid Arena's door, who says the day's work (`base/gymGuide.ts`). */
const GYM_GUIDE_ID = 'gym-guide';
/** The Safari Warden above THE COVE, who can be understood once his GOLD TEETH are back (`hub/errands.ts`). */
const WARDEN_ID = 'safari-warden';
/**
 * Whether the angler has lent his rod this sitting. Kept for the page rather
 * than the scene, which is started again through every door; a player who has
 * caught anything has it for good (`hasHarbourRod`).
 */
let harbourRodLent = false;
const FIXTURE_TONE: WorldLabelTone = { fill: 0x16222c, border: 0x6f97b4, ink: '#c6dced' };
/** The harbour's own landmarks (`base/landmarks.ts`): white on the sea's own deep blue. */
const LANDMARK_TONE: WorldLabelTone = { fill: 0x0e2a44, border: 0xf4efe2, ink: '#f4efe2' };
/** The label on the one oddity being looked at: brass, like the case it is in. */
const ODDITY_TONE: WorldLabelTone = { fill: 0x2b1d0e, border: 0xd8b070, ink: '#f4efe2' };
/** The frame round the oddity being looked at. */
const ODDITY_MARK = 0xf7d36b;

/**
 * Somebody else's house, stepped into after they answered a knock with a yes
 * (`home/knocking.ts`): whose it is, and their house as their snapshot reads
 * through the save loader (`home/houseSnapshot.ts`).
 */
export interface HouseVisit {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly game: RestoredGame;
}

export interface BaseSceneData {
  /** In somebody else's house, as a visitor who was let in. */
  readonly visit?: HouseVisit;
  readonly savedGame?: RestoredGame;
  /** The door the player is coming back out of, into the yard. */
  readonly from?: string;
  /** The room the player is in: walked into, or backed out of a screen into. */
  readonly room?: string;
  /** Set by the result screen: a raid puts the player back on THE RAID ARENA's rim. */
  readonly arrival?: 'raid';
  /**
   * Where in the room to stand, facing up, instead of on the mat: backing out
   * of a screen opened from something in the room - the wall map - puts the
   * player back in front of it rather than at the door.
   */
  readonly at?: GridPosition;
  /**
   * The room the player has just come up or down the stairs from: they are put
   * down on this room's stair mat that leads back there, facing away from it.
   */
  readonly stairsFrom?: string;
  /**
   * What whoever the player has just dealt with says as they come back: a
   * screen, or a heal, hands the words to the room rather than saying them over
   * itself (`said`, in `create`), so they are always in the room's own box.
   */
  readonly said?: readonly string[];
}

interface BaseControls {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly w: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly d: Phaser.Input.Keyboard.Key;
  readonly look: Phaser.Input.Keyboard.Key;
  readonly run: Phaser.Input.Keyboard.Key;
  readonly interact: readonly Phaser.Input.Keyboard.Key[];
  readonly back: Phaser.Input.Keyboard.Key;
  /** O: the favours list (`hub/favourList.ts`), on the key the raid's field guide is on. */
  readonly favours: Phaser.Input.Keyboard.Key;
  /** THE BOLTHOLE's keys (`HOME_KEY_LETTERS`): decorating, and what it is done with. */
  readonly decorate: Phaser.Input.Keyboard.Key;
  readonly turn: Phaser.Input.Keyboard.Key;
  readonly boxBack: Phaser.Input.Keyboard.Key;
  readonly boxNext: Phaser.Input.Keyboard.Key;
  readonly putAway: Phaser.Input.Keyboard.Key;
  /** T: the quick-phrase list (`harbour/harbourPhrases.ts`), on the key a raid room's is on. */
  readonly talk: Phaser.Input.Keyboard.Key;
}

/**
 * The one thing on Bill's shelves being looked at, and what is looking: the
 * arrow keys, which hold the player at the cabinet until they are done, or the
 * pointer resting on it, which holds nobody.
 */
interface Inspecting {
  readonly index: number;
  readonly by: 'keys' | 'pointer';
}

/** What the scene is standing the player in this visit. */
interface Place {
  readonly width: number;
  readonly height: number;
  readonly layers: MapLayers;
  readonly collision: readonly boolean[][];
  readonly sources: readonly TileSource[];
  /** Null in the yard. */
  readonly room: BuiltRoom | null;
}

export class BaseScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private savedGame!: RestoredGame;
  /** The sheet the player is drawn from: their look's, or the classic figure. */
  private playerTexture: string = SHARED_CHARACTER_TEXTURE;
  private place!: Place;
  private bounds: GridBounds = { width: 0, height: 0 };
  private collision: boolean[][] = [];
  private player!: Phaser.GameObjects.Sprite;
  private playerGroundMark!: Phaser.GameObjects.Graphics;
  private playerHeadMark!: Phaser.GameObjects.Graphics;
  private dialogBox!: DialogBox;
  private hintFrame!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private hintShown = '';
  /** Where the hint stands when not along the foot of the screen (`showTalkHint`). */
  private hintSeat: { readonly right: number; readonly y: number } | undefined;
  private controls!: BaseControls;
  private readonly keyPresses = new KeyPresses(() => this.currentFrame());
  private readonly directionPresses = new PressLatch<Direction>();
  private readonly spentPresses = new SpentPresses<Phaser.Input.Keyboard.Key>();
  private readonly figures = new Map<string, Phaser.GameObjects.Sprite>();
  private worldLabels: WorldLabel[] = [];
  private fixtures: readonly BaseFixture[] = [];
  private currentTile: GridPosition = BASE_SPAWN;
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'up';
  private stepProgress = 0;
  private stepDurationMs = STEP_DURATION_MS;
  private stepCarryMs: number | null = null;
  private pushingAgainst: Direction | null = null;
  private lookMs = 0;
  private leaving = false;
  /** True while the screen is dark for a sleep in the player's own bed. */
  private resting = false;
  private inspecting: Inspecting | null = null;
  private inspectLabel: WorldLabel | null = null;
  private inspectMark: Phaser.GameObjects.Graphics | null = null;
  /**
   * False until `create` has finished building this visit. Phaser keeps one
   * instance per scene key and runs `update` whatever `create` decided, so a
   * visit that handed straight back to the title screen would otherwise walk
   * the previous visit's map.
   */
  private ready = false;
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();
  /** The partner walking at the player's heel, or null when nobody is (`base/partner.ts`). */
  private partner: PartnerFigure | null = null;
  /** The Pokemon the Day-Care Man is raising, walking about his pen, while the player is in the yard. */
  private penPokemon: {
    readonly sprite: Phaser.GameObjects.Sprite;
    readonly species: FigureSpeciesId;
    tile: GridPosition;
    nextStepMs: number;
  } | null = null;
  /** Counts down while a tap towards the partner is turning the player rather than walking them. */
  private turnToPartnerMs: number | null = null;
  /** The place's tiles, kept so a room can be drawn again where it stands - a piece of furniture moved. */
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  /** The player's furniture standing in this room (`home/furniture.ts`). */
  private furnitureImages: Phaser.GameObjects.Image[] = [];
  /** Decorating THE BOLTHOLE, while it is being decorated (`base/decorateMode.ts`). */
  private decor: DecorateMode | null = null;
  /**
   * THE BOLTHOLE asking who lives there (`home/houseName.ts`), while it asks:
   * nobody walks about the house until it has a name.
   */
  private namePrompt: MenuOverlay | null = null;
  /** Everybody else in the shared harbour, drawn where they walk (`harbour/`). */
  private harbourFigures: HarbourFigures | null = null;
  /** This player's own hand while it is up (`waveAt`). */
  private ownWave: { readonly bubble: Phaser.GameObjects.Graphics; ms: number } | null = null;
  /** The quick-phrase list, while it is open (`ui/PhrasePicker.ts`). */
  private phrasePicker: PhrasePicker | null = null;
  /**
   * A list asked for with a step under way, opened when the step ends. A step
   * is 150ms and these keys were only read between steps, so a tap walking
   * along was lost nearly every time and nothing said why.
   */
  private listAskedMidStep: 'favours' | 'talk' | null = null;
  /** What this player is saying, over their head while they say it. */
  private ownBubble: SpeechBubble | null = null;
  /** The game time of this frame, which the harbour's talk is paced by. */
  private frameTime = 0;
  /**
   * Every tile on the map that FireRed animates (`world/tileAnimation.ts`) -
   * the sea, the surf on the cove, the flowers - with the still tile it was
   * laid as, and the clock they all move on.
   */
  private animatedTiles: { readonly tile: Phaser.Tilemaps.Tile; readonly still: number }[] = [];
  private tileAnimationMs = 0;
  /** What the yard's ground is made of, for hearing the sea from it; null in a room. */
  private terrain: readonly (readonly Material[])[] | null = null;
  /** Until the sea is next heard lapping at the quay. */
  private untilWaveMs = WAVE_EVERY_MS;
  /** Until the S.S. Anne next sounds her horn, out in the harbour. */
  private untilHornMs = HORN_EVERY_MS;
  /**
   * Whether the browser asks for reduced motion, as the title screen asks
   * (`TitleScene.still`): the harbour's own movement - the sea, the boats on
   * the swell, the bird, the harbour light's sweep - then holds still. The
   * people still walk, because they are how the harbour is played.
   */
  private still = false;
  /** THE HARBOUR after dark (`base/harbourNight.ts`), outdoors only. */
  private night: HarbourNight | null = null;
  /** The boats on the water, riding the swell (`base/floatingBoats.ts`), outdoors only. */
  private boats: FloatingBoats | null = null;
  private arena: ArenaView | null = null;
  /** What the player is getting ready with in THE RAID ARENA's hall (`base/arenaKit.ts`). */
  private kit: ArenaKit | null = null;
  /** Who is on the bench and what is on the rack, where they can be seen. */
  private furniture: ArenaFurniture | null = null;
  /** The panel open over the hall, if any: the hall burns on behind it and the player stands still. */
  private arenaPanel: ArenaPanel | null = null;
  /** The way in the player is stood over, or has under the cursor. */
  private aimed: RimLanding | null = null;
  /** Where the hall's camera has got to, as a follow offset. */
  private cameraOffset = { x: 0, y: 0 };
  /** A jump over the fence, while one is going on. */
  private jump: {
    elapsedMs: number;
    readonly world: WorldSceneData;
    readonly from: { readonly x: number; readonly y: number };
    readonly over: { readonly x: number; readonly y: number };
    readonly focus: { readonly x: number; readonly y: number };
    readonly viewFrom: { readonly x: number; readonly y: number };
    readonly viewAtFence: { readonly x: number; readonly y: number };
    hopped: boolean;
    leaving: boolean;
    /** What falls and what goes past (`arenaDiveView.ts`). */
    readonly dive: ArenaDiveView | null;
    /** The partner on its way over the fence after the player, drawn here until it too is falling. */
    leaper: { readonly image: Phaser.GameObjects.Image; readonly from: { readonly x: number; readonly y: number } } | null;
  } | null = null;
  /** The cloud lifting off ground a raid has just walked (`ArenaView.liftFogFromLastRaid`). */
  private fogLift: { elapsedMs: number; steps: number; readonly tile: GridPosition; readonly sign: PlaceNameSign } | null = null;
  /** Walking somewhere the pointer asked for: the steps left, and what to do on getting there. */
  private walkPlan: { readonly steps: Direction[]; readonly then: () => void } | null = null;
  private roomTickMs = 0;
  /** The hall's furniture and its caption, to say again when a panel closes. */
  private readonly stationLabels = new Map<RoomThing, WorldLabel>();
  /** The bird that glides over the harbour now and then (`base/harbourBird.ts`), outdoors by day only. */
  private bird: HarbourBird | null = null;
  /** FireRed's map-name board (`base/placeNameSign.ts`), outdoors only. */
  private placeSign: PlaceNameSign | null = null;
  /** The part of the harbour the player was last in (`base/harbourPlaces.ts`). */
  private placeId: string | null = null;
  /**
   * A line in the harbour's water, not yet answered (`base/harbourFishing.ts`):
   * where it went in, the cast as FireRed plans one, the float, and how far in.
   */
  private fishing: {
    readonly tile: GridPosition;
    readonly plan: CastPlan;
    readonly float: Phaser.GameObjects.Graphics;
    readonly floatY: number;
    elapsedMs: number;
    dots: number;
  } | null = null;
  /** The harbour's own townspeople and Pokemon (`base/harbourLife.ts`), outdoors only. */
  private harbourLife: HarbourLifeFigures | null = null;
  /** Somebody else's house this player is looking round, let in at the door. */
  private visit: HouseVisit | null = null;
  /** The knock screen, while it is up (`ui/KnockOverlay.ts`). */
  private knockScreen: MenuOverlay | null = null;
  /** The favours list, while it is up (`ui/FavourListOverlay.ts`). */
  private favoursScreen: MenuOverlay | null = null;
  private panelLeanValue: PanelLean | undefined;
  /** Somebody knocking at this player's own door, being asked about. */
  private knockPrompt: { readonly prompt: ChoicePrompt; readonly knock: KnockAtTheDoor } | null = null;
  /** A question asked YES or NOT NOW at the foot of what somebody said (`askInBox`): a favour, or a heal. */
  private boxQuestion: { readonly prompt: ChoicePrompt; readonly answer: (yes: boolean) => void } | null = null;
  /** The pointer came down while a box was up: read as the key that moves it on. */
  private boxClicked = false;
  /** The "!" over a keeper who has something to say about their favour. */
  private keeperMark: Phaser.GameObjects.Graphics | null = null;
  /** The "!" over each person about the harbour with a favour to ask, by their id: it walks their beat with them. */
  private harbourMarks = new Map<string, Phaser.GameObjects.Graphics>();
  /** What to do once the dialogue box now up has been read to its end (`say`). */
  private afterSaid: (() => void) | null = null;
  /**
   * Whether the front door has told the harbour this player is home, and the
   * furniture it told it about, so a change is told again. (A save that has
   * never decorated has no layout at all, so the two are kept apart.)
   */
  private doorTold = false;
  private doorLayout: unknown = undefined;

  /**
   * The four doors and the four rooms behind them, reachable from outside the
   * bundle.
   *
   * A playtest driver cannot import a module, and the alternative - a table of
   * tiles copied into `tools/playtest/` - is how a driver comes to walk to
   * where a door used to be. It reads these instead, the same way it reads
   * `WorldScene`'s collision. See `tools/playtest/README.md`.
   */
  public readonly doors = BASE_DOORS;
  public readonly rooms = BASE_ROOMS;
  public readonly arenaStations = ARENA_STATIONS;
  public readonly arenaRim = ARENA_RIM;

  /** The camera moved over for the favours' side panel (`ui/sidePanel.ts`). The hall's is `settleHallCamera`. */
  private get panelLean(): PanelLean {
    this.panelLeanValue ??= new PanelLean(() => this.cameras.main);
    return this.panelLeanValue;
  }

  public constructor() {
    super('base');
  }

  /** The room the player is standing in, or null in the yard. */
  public get room(): BaseRoom | null {
    return this.place?.room?.room ?? null;
  }

  /** Which room the player stands in, for a feedback message. See `feedback/feedbackContext.ts`. */
  public feedbackContext(): readonly FeedbackDetail[] {
    return [{ label: 'Room', value: this.place?.room?.room.name ?? 'The yard' }];
  }

  public create(data: BaseSceneData = {}): void {
    this.ready = false;
    // Every raid ending comes home to the base, so a raid this page was
    // playing is over by now and has nothing left to keep alive.
    raidHeartbeat.stop();
    // A raid that never reached an ending - the tab closed, a reload, a crash -
    // is settled here, before anything in the base can spend what it carried:
    // the pack is lost with everything in it and the team comes home
    // (`run/raidInFlight.ts`). One still being played in another tab is left
    // to that tab.
    const abandoned = this.saveManager.settleAbandonedRaid((raidId) =>
      raidHeartbeat.liveElsewhere(raidId),
    );
    if (abandoned && activeSaveSlot() !== 'try-it') {
      countPlay({ kind: 'raid-end', detail: 'abandoned' });
    }
    // Once a sitting: how many of the times the game is opened reach the harbour.
    if (!harbourCounted) {
      harbourCounted = true;
      countPlay({ kind: 'harbour' });
    }
    const loaded = this.saveManager.load() ?? data.savedGame;
    if (!loaded) {
      // A browser with no storage that has also lost the payload: the title
      // screen is the fallback everywhere else in the game and is here too.
      this.leaving = true;
      this.scene.start('title');
      return;
    }
    this.savedGame = loaded;
    // Phaser keeps one instance per scene key, so everything a previous visit
    // left behind is cleared here rather than guarded at each read.
    this.leaving = false;
    this.resting = false;
    this.targetTile = null;
    this.stepCarryMs = null;
    this.pushingAgainst = null;
    this.lookMs = 0;
    this.hintShown = '';
    this.hintSeat = undefined;
    this.figures.clear();
    this.worldLabels = [];
    this.inspecting = null;
    this.inspectLabel = null;
    this.inspectMark = null;
    this.partner = null;
    this.penPokemon = null;
    this.turnToPartnerMs = null;
    this.tilemap = null;
    this.furnitureImages = [];
    this.decor = null;
    this.namePrompt = null;
    this.harbourFigures = null;
    this.ownWave = null;
    this.phrasePicker = null;
    this.listAskedMidStep = null;
    this.ownBubble = null;
    this.harbourLife = null;
    this.fishing = null;
    this.knockScreen = null;
    this.favoursScreen = null;
    this.knockPrompt = null;
    this.boxQuestion = null;
    this.keeperMark = null;
    this.harbourMarks = new Map();
    this.afterSaid = null;
    this.boxClicked = false;
    this.doorTold = false;
    this.doorLayout = undefined;
    this.visit = null;
    this.kit = null;
    this.furniture = null;
    this.arenaPanel = null;
    this.aimed = null;
    this.jump = null;
    this.fogLift = null;
    this.walkPlan = null;
    this.roomTickMs = 0;

    const room = data.room === undefined ? undefined : roomNamed(data.room);
    // A visit is to somebody's house and nowhere else: their house is drawn
    // from their snapshot, read as any save is, and everything in it is
    // theirs by name.
    this.visit = room && data.visit && isHomeRoom(room.id) ? data.visit : null;
    if (room) {
      const visit = this.visit;
      const drawn = buildRoom(room, visit ? visit.game : loaded);
      const built = visit
        ? {
            ...drawn,
            things: drawn.things.map((thing: RoomThing) => ({ ...thing, name: visitorThingName(thing.name, visit.ownerName) })),
          }
        : drawn;
      this.place = {
        width: room.width,
        height: room.height,
        layers: built.layers,
        collision: built.collision,
        sources: built.sources,
        room: built,
      };
      this.fixtures = [];
      this.terrain = null;
      // In through the door, onto the mat, facing the keeper - or back where
      // they were standing, if a screen opened from inside the room is what
      // they have just backed out of - or on the stair mat they have just
      // climbed to, facing away from the stairs.
      const climbedTo =
        data.stairsFrom === undefined ? undefined : stairArrival(data.stairsFrom as BaseRoom['id'], room);
      // Home from a raid is back on the rim, where it left from.
      const fromTheRaid = data.arrival === 'raid' ? (lastJumpedFrom ?? rimAboveTheDoor()) : undefined;
      const standing =
        data.at !== undefined && built.collision[data.at.y]?.[data.at.x] === false
          ? data.at
          : (fromTheRaid ?? climbedTo ?? room.mat ?? room.stairs[0]?.tile ?? { x: 0, y: room.height - 1 });
      this.currentTile = { ...standing };
      const fence = fromTheRaid ? fenceBeside(fromTheRaid) : null;
      this.facing = fence ? facingTowards(standing, fence) : climbedTo ? 'down' : 'up';
    } else {
      const map = getBaseMap(loaded.raidProgress.workshopUpgrades);
      this.place = {
        width: map.width,
        height: map.height,
        layers: map.layers,
        collision: map.collision,
        sources: BASE_TILESET.sources,
        room: null,
      };
      this.fixtures = standingFixtures(loaded.raidProgress.workshopUpgrades);
      this.terrain = map.terrain;
      const returning = data.from === undefined ? undefined : doorNamed(data.from);
      // Backing out of the Day-Care's screen stands the player back where they
      // spoke to him, still facing him.
      const standing =
        data.at !== undefined && map.collision[data.at.y]?.[data.at.x] === false ? data.at : undefined;
      this.currentTile = standing
        ? { ...standing }
        : returning
          ? { ...returning.returnTo }
          : { ...BASE_SPAWN };
      this.facing = standing
        ? (directionBetween(standing, DAY_CARE_KEEPER.position) ?? 'up')
        : returning
          ? 'down'
          : 'up';
    }
    this.bounds = { width: this.place.width, height: this.place.height };
    this.collision = this.place.collision.map((row) => [...row]);

    this.still =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const detail = this.drawMap();
    // Out in the harbour for the first time since a raid, the boat that brought
    // it all home ties up and says so.
    const boatHome = !this.place.room && boatDueHome;
    if (data.arrival === 'raid') {
      boatDueHome = true;
    } else if (boatHome) {
      boatDueHome = false;
    }
    this.boats = null;
    if (detail && !this.place.room) {
      this.boats = new FloatingBoats(
        this,
        detail,
        HARBOUR_LANDMARKS.flatMap((landmark) =>
          landmark.floats ? [{ props: landmark.props, ...landmark.floats }] : [],
        ),
        detail.depth + 0.001,
        boatHome && !this.still,
      );
    }
    this.night = null;
    if (this.tilemap && !this.place.room) {
      const beacon = this.fixtures.find((fixture) => fixture.upgradeId === 'beacon')?.props[0];
      this.night = new HarbourNight(this, {
        now: new Date(),
        map: this.tilemap,
        buildings: [
          ...BASE_DOORS.map((door) => [{ ...door.building, name: door.building.prop }]),
          ...HARBOUR_LANDMARKS.filter((landmark) => !landmark.floats).map((landmark) => landmark.props),
        ],
        boats: this.boats,
        crowns: this.crownBoxes(),
        // The lamp at the top of the harbour light's roof.
        beacon: beacon
          ? { x: (beacon.x + BASE_TILESET.props[beacon.name].width / 2) * TILE_SIZE, y: beacon.y * TILE_SIZE + 5 }
          : null,
      });
    }
    this.drawSprites();
    this.drawFurniture();
    this.drawOddities();
    this.drawWallMap();
    this.arena = this.place.room?.pit ? this.openTheHall(loaded) : null;
    this.createFigures();
    this.createPlayer();
    // Somebody else's partner arrives where this player's own could, and never on top of it.
    this.harbourFigures = new HarbourFigures(
      this,
      undefined,
      (tile) => this.partnerCanStand(tile) && !this.partnerAt(tile),
      () => this.collision[0].length * TILE_SIZE,
    );
    this.createPartner(data);
    harbour()?.stand(
      this.harbourWhere(),
      this.currentTile,
      this.facing,
      houseName(),
      partnerOf(this.savedGame.stash)?.species ?? null,
      readLook(this.savedGame.raidProgress.look),
    );
    this.createCaptions();
    this.createDialogBox();
    this.createHint();
    this.bindControls();
    // A direction still held from the step that came through the door is not
    // a step in here: it has to be let go and pressed again. That is what
    // stops the key that walked in off the mat walking straight back out.
    this.spentPresses.spendHeld(this.directionKeys());
    this.configureCamera();
    this.cameraOffset = { x: 0, y: 0 };
    this.settleHallCamera(0, true);
    // The dialogue box and the hint are anchored to the screen, and the camera
    // centres a small room in it, so a resized window re-does both.
    const relayout = (): void => this.layoutForStage();
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    // A click moves a box on as the key does, so nobody who got here is ever
    // stranded on a line. A question's answers take their own clicks.
    const clicked = (_pointer: Phaser.Input.Pointer, over: readonly Phaser.GameObjects.GameObject[]): void => {
      this.boxClicked = this.dialogBox.visible && over.length === 0;
    };
    this.input.on('pointerdown', clicked);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', clicked);
      this.scale.off(Phaser.Scale.Events.RESIZE, relayout);
      // Decorating listens on the canvas itself, which outlives the scene.
      this.decor?.release();
      this.decor = null;
      // The name screen is a page element, which outlives the scene too.
      this.namePrompt?.destroy();
      this.namePrompt = null;
      // Through a door the harbour hears where the player is again in a moment;
      // to a menu or a raid, it says they are not standing anywhere.
      harbour()?.away();
      this.harbourFigures?.destroy();
      this.harbourFigures = null;
      // Out of the house - or only up or down its stairs, which the door
      // does not count as going out (`harbour/houseDoor.ts`).
      if (this.doorTold) {
        harbourHouses()?.door.out();
      }
      this.knockScreen?.destroy();
      this.knockScreen = null;
      this.favoursScreen?.destroy();
      this.favoursScreen = null;
      this.panelLean.setCover(0);
      this.knockPrompt?.prompt.destroy();
      this.knockPrompt = null;
      this.boxQuestion?.prompt.destroy();
      this.boxQuestion = null;
      this.furniture?.destroy();
      this.furniture = null;
      this.arena?.destroy();
      this.jump?.dive?.destroy();
      this.fogLift?.sign.destroy();
      this.fogLift = null;
      this.closeHallPanel();
      if (typeof document !== 'undefined') {
        this.game.canvas.style.cursor = '';
      }
    });
    this.cameras.main.fadeIn(160, 0, 0, 0);
    this.ready = true;
    // Home from a raid, the boat says so.
    if (boatHome) {
      audioManager.play('shipHorn');
    }
    if (this.arena && data.arrival === 'raid') {
      this.beginFogLift();
    }
    // Arriving in the harbour - off the title or off the boat, not out of a
    // door - it says its name, as a FireRed town does.
    if (!room && data.from === undefined && data.at === undefined) {
      this.placeSign?.show(BASE_PLACE_NAME.toUpperCase());
    }
    if (abandoned) {
      this.say(abandonedRaidLines(abandoned), []);
    } else if (data.said?.length) {
      const speaker = room ? room.keeper?.position : DAY_CARE_KEEPER.position;
      this.say(data.said, speaker ? [speaker] : []);
    }
    if (this.visit) {
      if (data.stairsFrom === undefined) {
        this.say(visitWelcomeLines(this.visit.ownerName), []);
      }
    } else if (this.place.room?.home && houseNameNeeded(houseName())) {
      this.askHouseName();
    }
    // Somebody waving at this player: a hand over them, and a "hi!" to say so.
    harbour()?.link.whenWavedAt(() => audioManager.play('harbourWave'));
    // Another player's browser saying it knocked here: look at the door now.
    harbour()?.link.whenNudged((_from, gone) =>
      gone ? harbourHouses()?.door.withdrawn(gone) : harbourHouses()?.door.knocked(),
    );
  }

  public update(time: number, deltaMs: number): void {
    if (!this.ready) {
      return;
    }
    this.frameTime = time;
    const shared = harbour();
    shared?.tick(time, deltaMs);
    const talk = harbourTalk();
    talk.tick(time);
    // The harbour's regulars (`base/harbourBots.ts`) keep the clock wherever
    // the player is, and are drawn beside the real players out in the yard,
    // saying whatever they said back to this player (`base/harbourTalk.ts`).
    const regulars = harbourRegulars();
    const watcher = this.regularsWatcher();
    regulars?.tick(regularsClock(deltaMs, requestedTestMode() !== 'off'), deltaMs, watcher);
    this.watchFrontDoor(time);
    this.tickHeldRoom(time, deltaMs);
    if (this.jump) {
      this.advanceJump(deltaMs);
      this.animateTiles(deltaMs);
      return;
    }
    if (!this.place.room?.pit) {
      this.panelLean.settle(deltaMs);
    }
    this.updateWalking(deltaMs);
    // After the walk, so every figure and name is seated against where this
    // player is this frame rather than where they were last frame.
    if (shared || regulars) {
      this.harbourFigures?.update(
        [
          ...(shared?.figuresHere() ?? []),
          ...(watcher ? (regulars?.figures(watcher.place) ?? []) : []).map((figure) => {
            const saying = talk.saying(figure.id, time);
            return saying ? { ...figure, saying } : figure;
          }),
        ],
        this.player,
      );
    }
    this.animateTiles(deltaMs);
    this.listenToTheSea(deltaMs);
    this.noticePlace(deltaMs);
    this.watchThePit(deltaMs);
    if (!this.still) {
      this.boats?.update(deltaMs);
      this.night?.update(deltaMs);
    }
    this.settleHeadMark();
    this.settleOwnWave(deltaMs);
    this.settleOwnBubble();
    this.bird?.update(deltaMs);
    this.partner?.update(deltaMs);
    this.wanderPen(deltaMs);
    // The harbour's people keep their beats, and stand still while anything
    // is being read: somebody who walked off mid-sentence leaves their words
    // hanging in the air.
    this.harbourLife?.update(
      deltaMs,
      this.dialogBox.visible ||
        this.boxQuestion !== null ||
        this.leaving ||
        this.namePrompt !== null ||
        this.knockScreen !== null ||
        this.favoursScreen !== null,
      (tile) => this.someoneElseOn(tile),
    );
    this.placeHarbourMarks();
    // Seated last, against this frame's figures: seated before the partner's
    // frame, a bubble it had just put up was a frame late into the seating and
    // a caption was drawn across it for that frame.
    this.containWorldLabels();
  }

  private updateWalking(deltaMs: number): void {
    const stepCarryMs = this.stepCarryMs;
    this.stepCarryMs = null;
    const looked = this.keyPresses.justPressed(this.controls.look);
    if (looked) {
      this.learnKey('look');
    }
    this.lookMs = advanceLookMs(this.lookMs, looked, deltaMs);
    this.dialogBox.update(deltaMs);

    if (this.leaving || this.resting || this.namePrompt || this.knockScreen || this.favoursScreen || this.arenaPanel) {
      this.closePhrases();
      return;
    }

    if (this.fogLift) {
      this.advanceFogLift(deltaMs);
      return;
    }

    if (this.phrasePicker) {
      if (this.dialogBox.visible || this.knockPrompt || this.boxQuestion || this.fishing || this.decor || this.targetTile) {
        this.closePhrases();
      } else {
        this.handlePhraseInput();
        return;
      }
    }

    if (this.knockPrompt) {
      this.handleKnockPromptInput();
      return;
    }

    if (this.boxQuestion) {
      const { prompt, answer } = this.boxQuestion;
      // ESC is NOT NOW, as B is NO on FireRed's YES/NO box.
      this.steerPrompt(prompt, () => answer(false));
      return;
    }

    if (this.fishing) {
      this.advanceFishing(deltaMs);
      return;
    }

    if (this.dialogBox.visible) {
      // What the step ended on is being read, and that is not what the key asked for.
      this.listAskedMidStep = null;
      this.showTalkHint();
      this.handleDialogInput();
      return;
    }

    if (this.inspecting?.by === 'keys') {
      this.handleInspectInput();
      return;
    }

    if (this.decor) {
      this.updateDecorating();
      return;
    }

    // What is left of this frame for walking, and the game time a step that
    // finished part-way through a frame hands to the step that follows it.
    let frameLeftMs = deltaMs;
    let carriedMs = stepCarryMs;
    if (this.targetTile) {
      if (this.keyPresses.justPressed(this.controls.favours)) {
        this.listAskedMidStep = 'favours';
      } else if (this.keyPresses.justPressed(this.controls.talk)) {
        this.listAskedMidStep = 'talk';
      }
      this.advanceStep(deltaMs);
      // A step that ends part-way through a frame walks straight on into the
      // next one in the same frame, as `WorldScene` does and for the same
      // reason: begun on the following frame, a held walk judders once a tile.
      // A door the step went through owns the frame, and so would anything
      // else the guards above answer first.
      if (this.targetTile || this.stepCarryMs === null || this.leaving || this.dialogBox.visible) {
        return;
      }
      carriedMs = this.stepCarryMs;
      this.stepCarryMs = null;
      frameLeftMs = 0;
    }

    this.showHint(this.hintHere());

    if (this.isInteractionPressed()) {
      this.tryInteract();
      return;
    }

    const asked = this.listAskedMidStep;
    this.listAskedMidStep = null;
    if (this.keyPresses.justPressed(this.controls.favours) || asked === 'favours') {
      this.openFavours();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.talk) || asked === 'talk') {
      this.openPhrases();
      return;
    }

    if (this.keyPresses.justPressed(this.controls.decorate) && this.place.room?.home) {
      this.decorateHere();
      return;
    }

    const input = this.followWalkPlan(this.readInput());
    if (input === null) {
      return;
    }
    const room = this.place.room?.room;
    // The way out of a room is the way out of every FireRed room: down off
    // the mat, into the dark the door is in.
    if (room && input.down && this.onMat(room)) {
      this.leaveRoom(room);
      return;
    }
    const decision = planNextGridStep({
      position: this.currentTile,
      facing: this.facing,
      input,
      bounds: this.bounds,
      isBlocked: (tile) => this.isBlocked(tile),
    });
    if (this.turnsToFacePartner(decision.target, decision.facing, carriedMs === null, deltaMs)) {
      this.facing = decision.facing;
      this.pushingAgainst = null;
      this.player.stop();
      this.player.setFrame(getIdleFrame(this.facing));
      return;
    }
    const pushing = input.up || input.down || input.left || input.right;
    const bump = nextBump(this.pushingAgainst, !decision.target && pushing ? decision.facing : null);
    this.pushingAgainst = bump.pushingAgainst;
    if (bump.thud) {
      audioManager.play('bump');
    }
    this.facing = decision.facing;

    if (decision.target) {
      this.beginStep(decision.target);
      if (carriedMs !== null) {
        this.advanceStep(frameLeftMs + carriedMs);
      }
      return;
    }

    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }

  // -- the map ---------------------------------------------------------------

  /** Every tile a crown or a brim is drawn on over the figures, in pixels: what a night wash lays over again. */
  private crownBoxes(): { x: number; y: number; width: number; height: number }[] {
    const { canopy, brimDepth } = this.place.layers;
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    canopy.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (tile >= 0) {
          boxes.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
        } else if ((brimDepth[y]?.[x] ?? 0) > 0) {
          const depth = brimDepth[y][x];
          boxes.push({ x: x * TILE_SIZE, y: (y + 1) * TILE_SIZE - depth, width: TILE_SIZE, height: depth });
        }
      }),
    );
    return boxes;
  }

  // -- THE RAID ARENA ----------------------------------------------------------

  /**
   * Into the hall: what the player gets ready with, for as long as they are in
   * it, and the pit with the ways in they may take. While a raid room is held the
   * pit shows the room's map and only its ways in, whatever else this save has.
   */
  private openTheHall(game: RestoredGame): ArenaView {
    const flow = flowForGame(game);
    const held = heldRoomMapId();
    if (held) {
      const there = offeredInsertions(game.raidProgress).find((insertion) => insertion.mapId === held);
      if (there) {
        flow.chooseInsertion(there.id);
      }
      friendRoom()?.atLab();
    }
    this.kit = {
      game,
      flow,
      close: () => this.closeHallPanel(),
      jump: (world) => this.beginJump(world),
      aim: (id) => this.aimAtInsertion(id),
      below: () => this.arena?.lookLines(this.currentTile) ?? [],
    };
    const mapId = requireInsertion(flow.insertionId).mapId;
    const view = new ArenaView(this, game, this.still, mapId, this.landingsOn(mapId, game));
    this.furniture = new ArenaFurniture(this);
    this.furniture.show(flow, partnerOf(game.stash)?.id ?? null);
    // A pointer can walk the room too: the rest of the harbour is walked with the
    // keys, but everything a raid is got ready with should answer a click.
    const pressed = (pointer: Phaser.Input.Pointer): void => this.pointAtHall(pointer);
    const moved = (pointer: Phaser.Input.Pointer): void => this.hoverOverHall(pointer);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, pressed);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, moved);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, pressed);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, moved);
    });
    return view;
  }

  /** The ways in on a map this save can take, as the rim knows them: those out of doors. */
  private landingsOn(mapId: WorldMapId, game: RestoredGame = this.savedGame): readonly RimLanding[] {
    const { width, height } = wallMapPicture(game, mapId);
    return offeredInsertions(game.raidProgress)
      .filter(
        (insertion) =>
          insertion.mapId === mapId && insertion.position.x < width && insertion.position.y < height,
      )
      .map((insertion) => ({ id: insertion.id, tile: insertion.position }));
  }

  /** A held room says it is here, and asks who else is. */
  private tickHeldRoom(time: number, deltaMs: number): void {
    if (!this.arena || !heldRoomMapId()) {
      return;
    }
    this.roomTickMs += deltaMs;
    if (this.roomTickMs >= HALL_ROOM_TICK_MS) {
      friendRoom()?.tick(time, this.roomTickMs);
      this.roomTickMs = 0;
    }
  }

  /** What the way in under this player is called on screen. */
  private landingName(landing: RimLanding): string {
    return (runInsertion(landing.id)?.label ?? '').toUpperCase();
  }

  /**
   * THE RAID ARENA's pit, for this frame: its layers slid for where the player
   * stands (`arenaView.ts`), the way in they are stood over marked in it, and the
   * camera come round to whatever there is to look at.
   */
  private watchThePit(deltaMs: number): void {
    if (!this.arena) {
      return;
    }
    const middle = {
      x: this.player.x + TILE_SIZE / 2,
      y: this.player.y - PLAYER_SPRITE_Y_OFFSET + TILE_SIZE / 2,
    };
    this.arena.update(deltaMs, middle);
    this.settleAim();
    this.settleHallCamera(deltaMs, false);
  }

  /** Which way in is under the player, and with the rim's panel up, whichever is under its cursor. */
  private settleAim(): void {
    const arena = this.arena;
    const kit = this.kit;
    if (!arena || !kit) {
      return;
    }
    if (this.arenaPanel === 'rim') {
      this.aimed = arena.share.landings.find((landing) => landing.id === kit.flow.insertionId) ?? null;
    } else if (!this.targetTile && isAtRim(this.currentTile) && !this.fogLift) {
      const below = landingBelow(this.currentTile, arena.share);
      if (below && below.id !== this.aimed?.id) {
        kit.flow.chooseInsertion(below.id as RunInsertionId);
      }
      this.aimed = below;
    } else if (!isAtRim(this.targetTile ?? this.currentTile)) {
      this.aimed = null;
    }
    arena.aimAt(this.aimed, this.aimed ? this.landingName(this.aimed) : '');
  }

  /** How much of the canvas a panel over the hall covers, in game pixels from the right and from the foot. */
  private panelCover(): { readonly right: number; readonly bottom: number } {
    if ((!this.arenaPanel && !this.favoursScreen) || typeof document === 'undefined') {
      return { right: 0, bottom: 0 };
    }
    if (this.favoursScreen && this.panelLean.covering === 0) {
      return { right: 0, bottom: 0 };
    }
    const panel = document.querySelector('#screens .arena-panel, #screens .favour-menu')?.getBoundingClientRect();
    const canvas = this.game.canvas.getBoundingClientRect();
    if (!panel || canvas.width === 0) {
      return { right: 0, bottom: 0 };
    }
    const scale = canvas.width / this.scale.width;
    return this.arenaPanel === 'rim'
      ? { right: 0, bottom: Math.max(0, (canvas.bottom - panel.top) / scale) }
      : { right: Math.max(0, (canvas.right - panel.left) / scale), bottom: 0 };
  }

  /**
   * The hall's camera. It leans out over the pit from wherever the player stands
   * (`cameraLean`), keeps them in what a panel leaves of the screen, and with the
   * rim's panel up comes right round to the way in being looked at. Eased, because
   * it is a person looking somewhere and not a cut.
   */
  private settleHallCamera(deltaMs: number, snap: boolean): void {
    if (!this.arena || this.jump) {
      return;
    }
    const middle = {
      x: this.player.x + TILE_SIZE / 2,
      y: this.player.y - PLAYER_SPRITE_Y_OFFSET + TILE_SIZE / 2,
    };
    const cover = this.panelCover();
    const seenHeight = this.scale.height - cover.bottom;
    const lean = cameraLean(middle, seenHeight);
    // Where the middle of what can be seen should look at, as the camera's own middle.
    let centre = {
      x: middle.x + lean.x + cover.right / 2,
      y: middle.y + lean.y + cover.bottom / 2,
    };
    const fogTile = this.fogLift?.tile;
    const lookedAt = fogTile
      ? { ...this.arena.pointOfLanding({ id: '', tile: fogTile }) }
      : this.arenaPanel === 'rim' && this.aimed
        ? this.arena.pointOfLanding(this.aimed)
        : null;
    if (lookedAt) {
      centre = { x: lookedAt.x + cover.right / 2, y: lookedAt.y + cover.bottom / 2 };
    }
    // How far the camera's middle stands from the player.
    const goal = { x: this.player.x - centre.x, y: this.player.y - centre.y };
    const share = snap || this.still ? 1 : Math.min(1, deltaMs / CAMERA_EASE_MS);
    const moved = (from: number, to: number): number => {
      const next = from + (to - from) * share;
      return Math.abs(to - next) < 1 ? to : next;
    };
    this.cameraOffset = { x: moved(this.cameraOffset.x, goal.x), y: moved(this.cameraOffset.y, goal.y) };
    // Both whole, each rounded alone, so walking moves the player on the screen
    // only as the lean changes: rounded together they each land a pixel either
    // side of the other from frame to frame, and the figure shakes as it walks.
    const camera = this.cameras.main;
    camera.setScroll(
      Math.round(this.player.x) - Math.round(this.cameraOffset.x) - Math.floor(camera.width / 2),
      Math.round(this.player.y) - Math.round(this.cameraOffset.y) - Math.floor(camera.height / 2),
    );
  }

  /** Stands the player still, facing the way they are facing, for something that has taken over. */
  private standStill(): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
  }

  /** A panel of the hall: the hall stays on screen beside it and the player stands where they are. */
  private openHallPanel(view: ArenaPanel): void {
    const kit = this.kit;
    if (!kit || this.arenaPanel || this.leaving) {
      return;
    }
    this.walkPlan = null;
    this.arenaPanel = view;
    this.standStill();
    audioManager.play('menuOpen');
    this.scene.launch('hub', { view, kit, from: this.place.room?.room.id } satisfies HubSceneData);
  }

  /** Back from a panel: what was chosen in it now stands in the room. */
  private closeHallPanel(): void {
    if (!this.arenaPanel) {
      return;
    }
    this.arenaPanel = null;
    this.scene.stop('hub');
    if (!this.kit) {
      return;
    }
    // The panel kept every key to itself, so one the hall saw go down before it
    // opened never came back up here.
    this.input.keyboard?.resetKeys();
    this.spentPresses.spendHeld(this.directionKeys());
    this.savedGame = this.saveManager.load() ?? this.kit.game;
    this.furniture?.show(this.kit.flow, partnerOf(this.savedGame.stash)?.id ?? null);
    this.sayStationNotes();
    audioManager.play('menuClose');
  }

  /** The cursor on the rim's panel has come to another way in: the pit swings round to it. */
  private aimAtInsertion(insertionId: RunInsertionId): void {
    const arena = this.arena;
    if (!arena) {
      return;
    }
    const { mapId } = requireInsertion(insertionId);
    arena.showMap(mapId, this.landingsOn(mapId));
  }

  /**
   * What each station's caption says under its name: the state of it, so the
   * loadout can be read from across the room.
   */
  private stationNote(id: ArenaStationId): string {
    const flow = this.kit?.flow;
    if (!flow) {
      return '';
    }
    if (id === 'bench') {
      const [only] = flow.party;
      if (!only) {
        return 'Nobody yet';
      }
      return flow.party.length === 1 ? `${only.pokemon.name.toUpperCase()} is coming` : `${flow.party.length} of ${MAX_RUN_PARTY} coming`;
    }
    if (id === 'rack') {
      return `${flow.packName} · ${flow.bagCells.used}/${flow.bagCells.total} squares`;
    }
    return `${flow.secureCells.used}/${flow.secureCells.total} squares safe`;
  }

  private sayStationNotes(): void {
    for (const [thing, label] of this.stationLabels) {
      if (thing.opens && thing.opens in ARENA_STATION_NAMES) {
        label.setText(`${thing.name}\n${this.stationNote(thing.opens as ArenaStationId)}`, DOOR_TONE);
      }
    }
  }

  /** Marks THE MARSHAL with a "!" until a newcomer has heard what the room is for. */
  private speakToMarshal(room: BaseRoom): void {
    const keeper = room.keeper;
    const kit = this.kit;
    if (!keeper || !kit) {
      return;
    }
    const lines = marshalLines(this.savedGame.raidProgress.firstWordsHeard, kit.flow);
    if (!hasHeard(this.savedGame.raidProgress.firstWordsHeard, 'loadout')) {
      this.hearFirstWords('loadout');
      this.clearKeeperMark();
    }
    this.standStill();
    this.say(lines, [keeper.position]);
  }

  // -- over the fence ----------------------------------------------------------

  /** Over the fence: the raid is committed to, and what remains is getting there. */
  private beginJump(world: WorldSceneData): void {
    const arena = this.arena;
    if (!arena || this.jump) {
      return;
    }
    this.arenaPanel = null;
    this.scene.stop('hub');
    this.walkPlan = null;
    arena.rememberBelow();
    lastJumpedFrom = { ...this.currentTile };
    const fence = fenceBeside(this.currentTile) ?? nextTileFromDirection(this.currentTile, this.facing);
    this.facing = facingTowards(this.currentTile, fence);
    this.standStill();
    this.dialogBox.setVisible(false);
    // Nobody can be asked to sit through it who asked for less movement.
    if (this.still) {
      audioManager.play('deploy');
      this.leaving = true;
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('world', world));
      this.jump = {
        elapsedMs: 0,
        world,
        from: this.player,
        over: { x: 0, y: 0 },
        focus: this.player,
        viewFrom: this.player,
        viewAtFence: this.player,
        hopped: true,
        leaving: true,
        dive: null,
        leaper: null,
      };
      return;
    }
    const camera = this.cameras.main;
    const middle = { x: this.player.x + TILE_SIZE / 2, y: this.player.y - PLAYER_SPRITE_Y_OFFSET + TILE_SIZE / 2 };
    const lean = cameraLean(middle, this.scale.height);
    const focusLanding = this.aimed ?? arena.share.landings[0];
    const focus = focusLanding ? arena.pointOfLanding(focusLanding) : this.player;
    this.jump = {
      elapsedMs: 0,
      world,
      from: { x: this.player.x, y: this.player.y },
      over: overTheFence(this.currentTile, fence),
      focus: { x: focus.x, y: focus.y },
      viewFrom: { x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2 },
      viewAtFence: {
        x: middle.x + lean.x,
        y: middle.y + lean.y,
      },
      hopped: false,
      leaving: false,
      dive: new ArenaDiveView(this, this.playerTexture),
      leaper: null,
    };
    camera.stopFollow();
    camera.removeBounds();
    audioManager.play('arenaHorn');
  }

  private advanceJump(deltaMs: number): void {
    const jump = this.jump;
    const arena = this.arena;
    if (!jump || jump.leaving || !arena) {
      return;
    }
    const before = jump.elapsedMs;
    jump.elapsedMs += deltaMs;
    if (!jump.hopped && jump.elapsedMs >= TURN_BACK_MS) {
      jump.hopped = true;
      arena.sendOff({ x: this.player.x, y: this.player.y });
      this.playerGroundMark.setVisible(false);
      this.playerHeadMark.setVisible(false);
      const partner = this.partner?.leaveForJump();
      if (partner) {
        jump.leaper = {
          image: this.add.image(partner.x, partner.y, partner.texture, partnerFrame(this.facing, 0)).setOrigin(0, 0).setDepth(CANOPY_BAND + 1),
          from: partner,
        };
        jump.dive?.partnerIs(partner.texture);
      }
      audioManager.play('ledgeHop');
    }
    if (before < TURN_BACK_MS + HOP_MS && jump.elapsedMs >= TURN_BACK_MS + HOP_MS) {
      audioManager.play('diveRush');
    }
    if (before < TURN_BACK_MS + HOP_MS + FALL_MS && jump.elapsedMs >= TURN_BACK_MS + HOP_MS + FALL_MS) {
      audioManager.play('diveRush');
    }
    const pose = jumpPose(jump.elapsedMs, jump.over);
    if (!pose.figure.falling) {
      this.player.setPosition(jump.from.x + pose.figure.x, jump.from.y + pose.figure.y);
      this.player.setDepth(CANOPY_BAND + 1);
    } else if (this.player.visible) {
      this.player.setVisible(false);
      jump.dive?.playerFalls({ x: this.player.x - this.cameras.main.scrollX, y: this.player.y - this.cameras.main.scrollY });
    }
    if (jump.leaper) {
      const overTheRail = jumpPose(TURN_BACK_MS + HOP_MS, jump.over).figure;
      const leap = partnerLeap(jump.elapsedMs, jump.leaper.from, {
        x: jump.from.x + overTheRail.x + PARTNER_SPRITE_X_OFFSET,
        y: jump.from.y + overTheRail.y,
      });
      if (leap.falling) {
        jump.dive?.partnerFalls({ x: leap.x - this.cameras.main.scrollX, y: leap.y - this.cameras.main.scrollY });
        jump.leaper.image.destroy();
        jump.leaper = null;
      } else {
        jump.leaper.image.setPosition(leap.x, leap.y);
      }
    }
    const camera = this.cameras.main;
    const fromX = jump.viewFrom.x + (jump.viewAtFence.x - jump.viewFrom.x) * pose.back;
    const fromY = jump.viewFrom.y + (jump.viewAtFence.y - jump.viewFrom.y) * pose.back;
    const x = fromX + (jump.focus.x - fromX) * pose.swing;
    const y = fromY + (jump.focus.y - fromY) * pose.swing;
    camera.setZoom(CAMERA_ZOOM * pose.zoom);
    camera.centerOn(x, y);
    arena.burn(deltaMs);
    arena.diveFrame(pose.zoom, jump.focus);
    jump.dive?.frame(jump.elapsedMs, pose, this.scale.width, this.scale.height);
    this.partner?.update(deltaMs);
    if (jump.elapsedMs >= JUMP_MS) {
      jump.leaving = true;
      this.leaving = true;
      this.scene.start('world', { ...jump.world, droppedIn: true });
    }
  }

  // -- home again --------------------------------------------------------------

  /**
   * Home from a raid: the cloud that was over whatever it walked is laid back
   * over it and taken away, with the view gone round to look. Any key cuts it
   * short, and with nothing new to lift it is simply the hall.
   */
  private beginFogLift(): void {
    const lifted = this.arena?.liftFogFromLastRaid();
    if (!lifted) {
      return;
    }
    const sign = new PlaceNameSign(this);
    sign.show(
      lifted.gained > 0
        ? `+${lifted.gained}% OF ${worldMapName(this.arena!.mapId).toUpperCase()}`
        : worldMapName(this.arena!.mapId).toUpperCase(),
    );
    this.standStill();
    this.fogLift = { elapsedMs: 0, steps: 0, tile: lifted.tile, sign };
  }

  private advanceFogLift(deltaMs: number): void {
    const lift = this.fogLift;
    if (!lift) {
      return;
    }
    lift.elapsedMs += deltaMs;
    lift.sign.update(deltaMs);
    const due = Math.min(FOG_LIFT_STEPS, Math.max(0, Math.floor((lift.elapsedMs - FOG_APPROACH_MS) / FOG_STEP_MS)));
    while (lift.steps < due) {
      lift.steps += 1;
      this.arena?.thinTheFog(FOG_LIFT_STEPS);
    }
    // The key that left the result screen is still on its way up as this starts,
    // and is not a request to skip what it has just opened on.
    const anyKey =
      lift.elapsedMs > FOG_LISTENS_AFTER_MS &&
      (this.isInteractionPressed() ||
        this.keyPresses.justPressed(this.controls.back) ||
        this.keyPresses.justPressed(this.controls.up) ||
        this.keyPresses.justPressed(this.controls.down) ||
        this.keyPresses.justPressed(this.controls.left) ||
        this.keyPresses.justPressed(this.controls.right));
    if (lift.elapsedMs >= FOG_LIFT_MS || anyKey) {
      this.arena?.endFog();
      lift.sign.destroy();
      this.fogLift = null;
      this.spentPresses.spendHeld(this.directionKeys());
    }
  }

  // -- walking the hall with the pointer ---------------------------------------

  /** What a pointer is over in the hall: a station, or the way in nearest it in the pit. */
  private hallThingAt(pointer: Phaser.Input.Pointer): { readonly station?: ArenaStationId; readonly landing?: RimLanding } | null {
    const arena = this.arena;
    if (!arena) {
      return null;
    }
    const tile = { x: Math.floor(pointer.worldX / TILE_SIZE), y: Math.floor(pointer.worldY / TILE_SIZE) };
    const station = arenaStationAt(tile) ?? arenaStationAt({ x: tile.x, y: tile.y + 1 });
    if (station) {
      return { station: station.id };
    }
    // Everything past the fence is the pit.
    if (this.collision[tile.y]?.[tile.x] !== true || !insideThePit(pointer.worldX, pointer.worldY)) {
      return null;
    }
    const near = arena.share.landings
      .map((landing) => {
        const point = arena.pointOfLanding(landing);
        return { landing, away: Math.hypot(point.x - pointer.worldX, point.y - pointer.worldY) };
      })
      .sort((a, b) => a.away - b.away)[0];
    return near ? { landing: near.landing } : null;
  }

  private canTakeAPointer(): boolean {
    return !this.arenaPanel && !this.jump && !this.fogLift && !this.leaving && !this.dialogBox.visible && !this.phrasePicker;
  }

  private hoverOverHall(pointer: Phaser.Input.Pointer): void {
    if (this.phrasePicker) {
      // The list's own rows say what the pointer may do.
      return;
    }
    this.game.canvas.style.cursor = this.canTakeAPointer() && this.hallThingAt(pointer) ? 'pointer' : '';
  }

  /**
   * A click in the hall walks the player to what it was on, and opens it when
   * they get there: a station from its front, the pit from the nearest stretch of
   * rim over the way in nearest the click.
   */
  private pointAtHall(pointer: Phaser.Input.Pointer): void {
    if (!this.canTakeAPointer()) {
      return;
    }
    const over = this.hallThingAt(pointer);
    if (over?.station) {
      const id = over.station;
      const tiles = this.place.room?.things.find((thing) => thing.opens === id)?.tiles ?? [];
      const fronts = tiles.map((tile) => ({ x: tile.x, y: tile.y + 1 }));
      this.walkThen(fronts, 'up', () => this.openHallPanel(id));
      return;
    }
    const arena = this.arena;
    if (over?.landing && arena) {
      const { landing } = over;
      const standing = rimTileOver(landing.id, arena.share, this.currentTile);
      if (standing) {
        this.walkThen([standing], null, () => {
          this.kit?.flow.chooseInsertion(landing.id as RunInsertionId);
          this.lookDown();
        });
      }
    }
  }

  /** Plans the walk to the nearest of these tiles, then does this; the keys take over the moment one is pressed. */
  private walkThen(goals: readonly GridPosition[], facing: Direction | null, then: () => void): void {
    const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
    const wanted = new Set(goals.map(key));
    const came = new Map<string, { readonly from: GridPosition; readonly step: Direction } | null>([[key(this.currentTile), null]]);
    const queue: GridPosition[] = [this.currentTile];
    const directions: readonly Direction[] = ['up', 'down', 'left', 'right'];
    let reached: GridPosition | null = wanted.has(key(this.currentTile)) ? this.currentTile : null;
    while (queue.length > 0 && !reached) {
      const at = queue.shift()!;
      for (const step of directions) {
        const next = nextTileFromDirection(at, step);
        if (came.has(key(next)) || this.isBlocked(next)) {
          continue;
        }
        came.set(key(next), { from: at, step });
        if (wanted.has(key(next))) {
          reached = next;
          break;
        }
        queue.push(next);
      }
    }
    if (!reached) {
      audioManager.play('denied');
      return;
    }
    const steps: Direction[] = [];
    for (let link = came.get(key(reached)); link; link = came.get(key(link.from))) {
      steps.unshift(link.step);
    }
    this.walkPlan = {
      steps,
      then: () => {
        if (facing) {
          this.facing = facing;
          this.player.setFrame(getIdleFrame(facing));
        }
        then();
      },
    };
  }

  /**
   * The next step of a walk the pointer asked for, as the keys would have asked
   * for it; or the keys themselves, the moment one is held. Null when the walk
   * has just ended in opening something, which takes the frame.
   */
  private followWalkPlan(input: GridInputState): GridInputState | null {
    const plan = this.walkPlan;
    if (!plan) {
      return input;
    }
    if (input.up || input.down || input.left || input.right) {
      this.walkPlan = null;
      return input;
    }
    const step = plan.steps.shift();
    if (!step) {
      this.walkPlan = null;
      plan.then();
      return null;
    }
    return { up: step === 'up', down: step === 'down', left: step === 'left', right: step === 'right' };
  }

  /** Looking down from the rim, facing the fence: the panel that starts the raid. */
  private lookDown(): void {
    const fence = fenceBeside(this.currentTile);
    if (fence) {
      this.facing = facingTowards(this.currentTile, fence);
      this.player.setFrame(getIdleFrame(this.facing));
    }
    audioManager.play('select');
    // The first time, the marshal says what is down there before it opens.
    const marshal = this.place.room?.room.keeper?.position;
    this.sayFirstWords('check', marshal ? [marshal] : [], () => this.openHallPanel('rim'));
  }

  /** Lays the map's tile layers, and hands back the detail layer landmarks are drawn on. */
  private drawMap(): Phaser.Tilemaps.TilemapLayer | null {
    this.tilemap?.destroy();
    this.animatedTiles = [];
    const map = this.make.tilemap({
      width: this.place.width,
      height: this.place.height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const sheets = this.place.sources.map((source) => {
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
    const { ground, overlay, detail, canopy, brim } = this.place.layers;
    for (const [name, layer, depth] of [
      ['base-ground', ground, atRow(TERRAIN_DEPTH, 0)],
      ['base-overlay', overlay, atRow(TERRAIN_DEPTH, 1)],
      ['base-detail', detail, atRow(TERRAIN_DEPTH, 2)],
      ['base-canopy', canopy, CANOPY_BAND],
      ['base-brim', brim, CANOPY_BAND],
    ] as const) {
      this.createTileLayer(map, sheets, name, layer, depth);
    }
    this.tilemap = map;
    return map.getLayer('base-detail')?.tilemapLayer ?? null;
  }

  /**
   * The player's furniture, in the player's own house: each piece the way it
   * is turned, a rug over the floor and everything else sorted in among the
   * figures (`base/furnitureArt.ts`).
   */
  private drawFurniture(): void {
    this.furnitureImages.forEach((image) => image.destroy());
    this.furnitureImages = [];
    const placed = this.place.room?.home?.placed ?? [];
    for (const piece of placed) {
      this.furnitureImages.push(
        furnitureImage(this, piece.definition.facings[piece.facing], piece.x, piece.y).setDepth(
          furnitureDepth(piece, placed),
        ),
      );
    }
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
    created.forEachTile((tile) => {
      const tint = layer.tints[tile.y]?.[tile.x] ?? -1;
      if (tint >= 0) {
        tile.tint = tint;
      }
      if (layer.flips[tile.y]?.[tile.x]) {
        tile.flipX = true;
      }
      if (TILE_ANIMATIONS_BY_TILE.has(tile.index)) {
        this.animatedTiles.push({ tile, still: tile.index });
      }
    });
  }

  /**
   * Whether a rod reaches `tile`: open sea in front of the player outdoors,
   * with the angler's rod lent or one of the player's own in the vault.
   */
  private canFishAt(tile: GridPosition): boolean {
    return (
      this.terrain?.[tile.y]?.[tile.x] === 'water' &&
      this.collision[tile.y]?.[tile.x] === true &&
      (harbourRodLent || this.hasHarbourRod())
    );
  }

  /** A rod of the player's own, or the angler's tally showing he has lent his. */
  private hasHarbourRod(): boolean {
    return (
      (this.savedGame.raidProgress.harbourCatches?.length ?? 0) > 0 ||
      bestRod((itemId) => this.savedGame.stash.itemCount(itemId)) !== null
    );
  }

  /** The kinds in the angler's book, by name, in Pokédex order. */
  private harbourCatchNames(): string[] {
    return (this.savedGame.raidProgress.harbourCatches ?? []).flatMap((dexId) => {
      const species = ALL_SPECIES.find((each) => each.dexId === dexId);
      return species ? [species.name.toUpperCase()] : [];
    });
  }

  /** Casts into `tile`: FireRed's cast, its dots, then the water's answer. */
  private castInto(tile: GridPosition): void {
    const float = paintFloat(this.add.graphics(), false)
      .setPosition(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2)
      .setDepth(atRow(MARKER_BAND, tile.y));
    this.fishing = { tile, plan: planCast(), float, floatY: float.y, elapsedMs: 0, dots: 0 };
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('rodCast');
    this.say([], [tile]);
    this.dialogBox.showProgress('');
  }

  /**
   * One frame of a cast: the dots, then nothing - or a bite, reeled in and let
   * go, and the angler's book the richer for a new kind.
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
    this.fishing = null;
    const bite = cast.plan.bites ? harbourBite(cast.tile) : null;
    if (!bite) {
      cast.float.destroy();
      this.say([NOT_EVEN_A_NIBBLE], [cast.tile]);
      return;
    }
    paintFloat(cast.float.clear(), true).setY(cast.floatY);
    audioManager.play('fishBite');
    this.cameras.main.shake(90, 0.003);
    const fresh = this.saveManager.recordHarbourCatch(bite.dexId);
    const caught = this.savedGame.raidProgress.harbourCatches ?? [];
    if (fresh) {
      this.savedGame = {
        ...this.savedGame,
        raidProgress: {
          ...this.savedGame.raidProgress,
          harbourCatches: [...caught, bite.dexId].sort((a, b) => a - b),
        },
      };
    }
    this.say([ON_THE_HOOK, ...reeledInLines(bite, fresh, caught.length + (fresh ? 1 : 0))], [cast.tile], () =>
      cast.float.destroy(),
    );
  }

  /**
   * The player's head mark gives way to anybody standing in the tile above
   * them, as it does on a raid (`headMarkCoversSomebody`): that is where a
   * player stands to talk to someone, and the mark sat on their face for the
   * whole conversation. The player is drawn in front of them there, so
   * nothing is lost.
   */
  private settleHeadMark(): void {
    const above = { x: this.currentTile.x, y: this.currentTile.y - 1 };
    const keeper = this.place.room ? this.place.room.room.keeper?.position : DAY_CARE_KEEPER.position;
    const covered =
      this.targetTile === null &&
      ((keeper !== undefined && sameTile(keeper, above)) ||
        [...(this.harbourLife?.standing('person') ?? []), ...(this.harbourLife?.standing('pokemon') ?? [])].some(
          (tile) => sameTile(tile, above),
        ));
    this.playerHeadMark.setVisible(!covered);
  }

  /**
   * Walking from one part of the harbour into another puts its name up
   * (`base/harbourPlaces.ts`), the way a raid map names its districts.
   */
  private noticePlace(deltaMs: number): void {
    if (!this.placeSign) {
      return;
    }
    const here = harbourPlaceAt(this.currentTile);
    if (here && here.id !== this.placeId) {
      this.placeId = here.id;
      this.placeSign.show(here.name);
    }
    this.placeSign.update(deltaMs);
  }

  /**
   * Now and then, while there is sea within earshot of the player, the sound
   * of it lapping at the quay - and once in a long while, from anywhere in the
   * harbour, the S.S. Anne's horn. Never in a room, never while anything is
   * being read, and never on a beat anybody could count.
   */
  private listenToTheSea(deltaMs: number): void {
    const terrain = this.terrain;
    if (!terrain || this.dialogBox.visible || this.leaving) {
      return;
    }
    this.untilHornMs -= deltaMs;
    if (this.untilHornMs <= 0) {
      this.untilHornMs = HORN_EVERY_MS + Math.random() * HORN_EVERY_MS;
      audioManager.play('distantHorn');
    }
    this.untilWaveMs -= deltaMs;
    if (this.untilWaveMs > 0) {
      return;
    }
    this.untilWaveMs = WAVE_EVERY_MS + Math.random() * WAVE_EVERY_MS;
    const { x, y } = this.currentTile;
    for (let dy = -WAVE_EARSHOT; dy <= WAVE_EARSHOT; dy += 1) {
      for (let dx = -WAVE_EARSHOT; dx <= WAVE_EARSHOT; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) <= WAVE_EARSHOT && terrain[y + dy]?.[x + dx] === 'water') {
          audioManager.play('waveLap');
          return;
        }
      }
    }
  }

  /**
   * FireRed's moving ground, a frame at a time: each animated tile shows the
   * frame the one shared clock is on, set only when it changes.
   */
  private animateTiles(deltaMs: number): void {
    if (this.animatedTiles.length === 0 || this.still) {
      return;
    }
    this.tileAnimationMs += deltaMs;
    for (const animated of this.animatedTiles) {
      const index = animatedTileAt(animated.still, this.tileAnimationMs);
      if (animated.tile.index !== index) {
        animated.tile.index = index;
      }
    }
  }

  /**
   * What a room sets on its furniture rather than into it: the Poké Balls on
   * Joy's counter. Each is a frame of the base's own sheet, named by the piece
   * it is. Bill's oddities are drawn by `drawOddities`.
   */
  private drawSprites(): void {
    // A finished errand's thing, as its own icon on the giver's furniture.
    for (const icon of this.place.room?.icons ?? []) {
      this.add
        .image(icon.x, icon.y, iconTextureKey(itemIconName(icon.itemId)))
        .setOrigin(0, 0)
        .setDepth(atRow(MARKER_BAND, Math.floor(icon.y / TILE_SIZE)));
    }
    const sprites: readonly RoomSprite[] = this.place.room?.sprites ?? [];
    if (sprites.length === 0) {
      return;
    }
    const texture = this.textures.get(BASE_SHEET_SOURCE.source.textureKey);
    for (const sprite of sprites) {
      const piece = BASE_PIECES[sprite.piece];
      if (!texture.has(sprite.piece)) {
        texture.add(
          sprite.piece,
          0,
          piece.column * TILE_SIZE,
          piece.row * TILE_SIZE,
          piece.width * TILE_SIZE,
          piece.height * TILE_SIZE,
        );
      }
      this.add
        .image(sprite.x * TILE_SIZE, sprite.y * TILE_SIZE, texture.key, sprite.piece)
        .setOrigin(0, 0)
        .setDepth(atRow(MARKER_BAND, sprite.y));
    }
  }

  /**
   * Everything on Bill's shelves, each as the miniature `base/cabinet.ts`
   * draws it (`oddityFrame`). Each answers the pointer: resting on one is
   * asking what it is, and while the keys are looking along the shelves the
   * pointer moves the look rather than taking it over.
   */
  private drawOddities(): void {
    const placed = this.place.room?.cabinet?.layout.placed ?? [];
    for (const oddity of placed) {
      const { key, frame } = this.oddityFrame(oddity.oddity.itemId);
      const image = this.add
        .image(oddity.x, oddity.y, key, frame)
        .setOrigin(0, 0)
        .setDepth(atRow(MARKER_BAND, CABINET_UNITS[oddity.unit].y));
      // The whole seat, a pixel proud all round: four pixels of lamp is a
      // hard thing to rest a pointer on.
      image.setInteractive(
        new Phaser.Geom.Rectangle(-1, -1, oddity.width + 2, oddity.height + 2),
        (area: Phaser.Geom.Rectangle, x: number, y: number) =>
          Phaser.Geom.Rectangle.Contains(area, x, y),
      );
      image.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (!this.leaving) {
          this.inspect({ index: oddity.index, by: this.inspecting?.by === 'keys' ? 'keys' : 'pointer' });
        }
      });
      image.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        if (this.inspecting?.by === 'pointer' && this.inspecting.index === oddity.index) {
          this.inspect(null);
        }
      });
    }
    // Phaser hears the pointer only over the canvas, so leaving the game's
    // frame is no pointer-out on anything: the label the pointer put up stayed,
    // and every other caption in the room stayed hidden behind it.
    if (placed.length > 0) {
      this.input.on(Phaser.Input.Events.GAME_OUT, () => {
        if (this.inspecting?.by === 'pointer') {
          this.inspect(null);
        }
      });
    }
  }

  /**
   * Every miniature, painted once into one texture with a transparent pixel
   * round each. The gutter is not tidiness: drawn from frames exactly their
   * own size, every miniature came out a column wider under WebGL, its last
   * column repeated, and three crates on a shelf ran together into one plank.
   * Each frame now takes the gutter to its right and below, so whatever the
   * edge repeats is a pixel of nothing.
   */
  private oddityFrame(itemId: string): { readonly key: string; readonly frame: string } {
    const key = 'bill-oddities';
    const frame = Object.hasOwn(ODDITY_ART, itemId) ? itemId : 'curio';
    if (this.textures.exists(key)) {
      return { key, frame };
    }
    const kinds = Object.entries(ODDITY_ART);
    const width = kinds.reduce((sum, [, art]) => sum + art[0].length + 2, 0);
    const texture = this.textures.createCanvas(key, width, ODDITY_HEIGHT + 2);
    if (!texture) {
      throw new Error("Could not make a texture for Bill's shelves.");
    }
    const context = texture.getContext();
    let left = 0;
    for (const [kind, art] of kinds) {
      art.forEach((row, y) =>
        [...row].forEach((ink, x) => {
          if (ink === '.') return;
          context.fillStyle = `#${ODDITY_INK[ink].toString(16).padStart(6, '0')}`;
          context.fillRect(left + 1 + x, 1 + y, 1, 1);
        }),
      );
      texture.add(kind, 0, left + 1, 1, art[0].length + 1, ODDITY_HEIGHT + 1);
      left += art[0].length + 2;
    }
    texture.refresh();
    return { key, frame };
  }

  /**
   * Looks at one oddity, or at none: the frame round it and the one label that
   * says what it is. Only one is ever up, and while it is every other caption
   * in the room keeps quiet, so the shelf is read a thing at a time.
   */
  private inspect(next: Inspecting | null): void {
    const placed = this.place.room?.cabinet?.layout.placed ?? [];
    const target = next === null ? undefined : placed[next.index];
    this.inspectLabel?.destroy();
    this.inspectLabel = null;
    this.inspectMark?.destroy();
    this.inspectMark = null;
    this.inspecting = target && next ? next : null;
    if (!target) {
      return;
    }
    const around = { x: target.x - 1, y: target.y - 1, width: target.width + 2, height: target.height + 2 };
    this.inspectMark = this.add
      .graphics()
      .lineStyle(1, ODDITY_MARK, 1)
      .strokeRect(around.x + 0.5, around.y + 0.5, around.width - 1, around.height - 1)
      .setDepth(atRow(MARKER_BAND, CABINET_UNITS[target.unit].y) + 0.0005);
    const label = oddityLabel(target.oddity, new Date());
    this.inspectLabel = new WorldLabel(this, {
      // Seated against the whole unit rather than the thing, which is four
      // pixels tall: a label sat on the thing covers the shelf above it, and
      // the frame already says which thing on the unit it means.
      subject: tilesRect(unitTiles(target.unit)),
      text: `${label.name}\n${label.note}`,
      tone: ODDITY_TONE,
      depth: atRow(CAPTION_BAND, this.place.height),
      // Speaks for as long as it is up, wherever the player is standing.
      speech: { voice: 'name', tiles: [], near: Number.POSITIVE_INFINITY },
    });
  }

  /**
   * Looking along the shelves with the keys: the arrows walk from thing to
   * thing (`nextOddity`), and the interact key or Escape puts the player back
   * in charge of their feet.
   */
  private handleInspectInput(): void {
    this.showHint('[ARROWS] LOOK ALONG   [SPACE] DONE');
    const current = this.inspecting;
    if (!current) {
      return;
    }
    if (this.isInteractionPressed() || this.keyPresses.justPressed(this.controls.back)) {
      audioManager.play('cancel');
      this.spentPresses.spendHeld(this.directionKeys());
      this.inspect(null);
      return;
    }
    const placed = this.place.room?.cabinet?.layout.placed ?? [];
    const pressed = (keys: Phaser.Input.Keyboard.Key[]) =>
      keys.some((key) => this.keyPresses.justPressed(key));
    const direction: Direction | null = pressed([this.controls.left, this.controls.a])
      ? 'left'
      : pressed([this.controls.right, this.controls.d])
        ? 'right'
        : pressed([this.controls.up, this.controls.w])
          ? 'up'
          : pressed([this.controls.down, this.controls.s])
            ? 'down'
            : null;
    if (direction === null) {
      return;
    }
    const index = nextOddity(placed, current.index, direction);
    if (index === current.index) {
      audioManager.play('bump');
      return;
    }
    audioManager.play('select');
    this.inspect({ index, by: 'keys' });
  }

  /**
   * The wall map in Oak's Lab, painted from the save onto the stretch of wall
   * the room keeps for it (`base/wallMap.ts`). A texture made fresh on every
   * visit, because what it is a picture of - where the player has walked, who
   * they have beaten - changes between visits and a room is rebuilt on each.
   */
  private drawWallMap(): void {
    const area = this.place.room?.wallMap;
    if (area) {
      this.hangPicture(WALL_MAP_TEXTURE, wallMapPoster(this.savedGame, area), area);
    }
    // The other pictures of the save a room keeps wall for: Oak's cork board,
    // and THE BOLTHOLE's badge case and its pennants, painted fresh on every
    // visit for the same reason the wall map is.
    for (const poster of this.place.room?.posters ?? []) {
      const picture =
        poster.kind === 'badge-case'
          ? badgeCasePoster(this.savedGame, poster.area)
          : poster.kind === 'cork-board'
            ? boardPoster(this.savedGame, poster.area)
            : pennantsPoster(this.savedGame, poster.area);
      this.hangPicture(`base-poster-${poster.kind}`, picture, poster.area);
    }
  }

  /** A picture of the save, painted into a texture of its own and hung on its stretch of wall. */
  private hangPicture(key: string, picture: PaintedPicture, area: Rect): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const texture = this.textures.createCanvas(key, picture.width, picture.height);
    if (!texture) {
      return;
    }
    texture.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
    texture.refresh();
    this.add
      .image(area.x * TILE_SIZE, area.y * TILE_SIZE, key)
      .setOrigin(0, 0)
      .setDepth(atRow(MARKER_BAND, area.y + area.height - 1));
  }

  /**
   * The keeper of the room the player is in. The house has nobody standing in
   * it, and the yard has only the Day-Care Man at his pen and whoever he is
   * raising inside it.
   */
  private createFigures(): void {
    if (!this.place.room) {
      this.createDayCare();
      const life = harbourLifeAt(windowLight(new Date()));
      this.harbourLife = new HarbourLifeFigures(this, life);
      this.markHarbourGivers(life);
      this.placeSign = new PlaceNameSign(this);
      // Nothing flies over the harbour at night.
      this.bird =
        windowLight(new Date()) === 'night' || this.still
          ? null
          : new HarbourBird(this, { width: this.place.width * TILE_SIZE, height: this.place.height * TILE_SIZE });
      this.placeId = harbourPlaceAt(this.currentTile)?.id ?? null;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.harbourLife?.destroy();
        this.harbourLife = null;
        this.placeSign?.destroy();
        this.placeSign = null;
        this.bird?.destroy();
        this.bird = null;
      });
      return;
    }
    const keeper = this.place.room.room.keeper;
    if (!keeper) {
      return;
    }
    const appearance = getWorldCharacterAppearance('npc', keeper.design);
    const sprite = this.add
      .sprite(
        keeper.position.x * TILE_SIZE,
        keeper.position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
        appearance.textureKey,
        worldCharacterIdleFrame(appearance, keeper.facing),
      )
      .setOrigin(0, 0)
      .setTint(appearance.tint ?? NO_TINT)
      .setDepth(atRow(FIGURE_BAND, keeper.position.y));
    this.figures.set(keeper.id, sprite);
    this.markKeeper(this.place.room.room);
  }

  private createDayCare(): void {
    const keeper = DAY_CARE_KEEPER;
    const appearance = getWorldCharacterAppearance('npc', keeper.design);
    const sprite = this.add
      .sprite(
        keeper.position.x * TILE_SIZE,
        keeper.position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
        appearance.textureKey,
        worldCharacterIdleFrame(appearance, keeper.facing),
      )
      .setOrigin(0, 0)
      .setTint(appearance.tint ?? NO_TINT)
      .setDepth(atRow(FIGURE_BAND, keeper.position.y));
    this.figures.set(keeper.id, sprite);

    const stay = this.savedGame.stash.dayCare();
    const species = stay?.pokemon.base.id;
    if (!species || !isFigureSpecies(species)) {
      return;
    }
    // FireRed's own party icon, bobbing as the party menu bobs it - the one
    // picture of a Pokemon the game has for every species.
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
    const tile = { ...PEN_HOME };
    const pokemon = this.add
      .sprite(...this.penPoint(tile, species), POKEMON_ICON_TEXTURE, first)
      .setOrigin(0.5, 1)
      .setDepth(atRow(FIGURE_BAND, tile.y))
      .play(key);
    this.penPokemon = { sprite: pokemon, species, tile, nextStepMs: PEN_STEP_EVERY_MS };
  }

  /** Where an icon stands on a tile of the pen: centred, its feet on the tile's last row. */
  private penPoint(tile: GridPosition, species: FigureSpeciesId): [number, number] {
    return [tile.x * TILE_SIZE + TILE_SIZE / 2, (tile.y + 1) * TILE_SIZE + pokemonSoleDrop(species)];
  }

  /**
   * The Pokemon in the pen potters about: a tile at a time, every few seconds,
   * never out of the fence. It is the yard's own life, so it is off the
   * player's clock, and it waits while a line is being read.
   */
  private wanderPen(deltaMs: number): void {
    const pen = this.penPokemon;
    if (!pen || this.dialogBox.visible) {
      return;
    }
    pen.nextStepMs -= deltaMs;
    if (pen.nextStepMs > 0) {
      return;
    }
    pen.nextStepMs = PEN_STEP_EVERY_MS + Math.random() * PEN_STEP_SPREAD_MS;
    const to = nextPenTile(pen.tile, Math.random());
    if (to.x === pen.tile.x && to.y === pen.tile.y) {
      return;
    }
    // FireRed's icons look left; one walking right is turned round.
    if (to.x !== pen.tile.x) {
      pen.sprite.setFlipX(to.x > pen.tile.x);
    }
    pen.tile = to;
    const [x, y] = this.penPoint(to, pen.species);
    pen.sprite.setDepth(atRow(FIGURE_BAND, to.y));
    this.tweens.add({ targets: pen.sprite, x, y, duration: STEP_DURATION_MS * 2 });
  }

  private createPlayer(): void {
    // The player is drawn in what they wear (`look/look.ts`); a save that has
    // never been to the boutique wears the classic figure the game always drew.
    this.playerTexture = lookTexture(this, readLook(this.savedGame.raidProgress.look));
    this.player = this.add
      .sprite(0, 0, this.playerTexture, getIdleFrame(this.facing))
      .setOrigin(0, 0);
    this.playerGroundMark = this.paintPlayerMark(PLAYER_MARKER_GROUND_LAYERS);
    this.playerHeadMark = this.paintPlayerMark(PLAYER_MARKER_HEAD_LAYERS).setDepth(
      PLAYER_MARKER_DEPTH,
    );
    this.setPlayerPosition(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
  }

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

  private setPlayerPosition(x: number, y: number): void {
    this.player.setPosition(x, y);
    const depth = atRow(FIGURE_BAND, (y - PLAYER_SPRITE_Y_OFFSET) / TILE_SIZE);
    this.player.setDepth(depth);
    this.playerGroundMark.setPosition(x, y).setDepth(depth);
    // On the head this look has: a FireRed cap starts lower than the classic crop.
    this.playerHeadMark.setPosition(x, y + lookHeadDrop(this.playerTexture));
  }

  /**
   * In the yard, one caption per door and one per thing the player has built.
   * In a room, one over the keeper - who they are and what is waiting, the
   * line the door said outside - and one over each thing in it, which speaks
   * only while the player is standing beside it, because a room is small
   * enough that everything in it is within the yard's five steps of the mat.
   * All of them speak while the look key is held, the same rule the raid maps
   * follow, so the base is read the way the rest of the game is.
   */
  private createCaptions(): void {
    const built = this.place.room;
    if (built) {
      this.createRoomCaptions(built);
      return;
    }
    for (const door of BASE_DOORS) {
      /*
       * Seated against the whole building, so it stands over its roof or under
       * its front and never on it. It used to be seated against the building's
       * **frontage** - its bottom row - which put it over the lower wall: the
       * caption covered the lab's own front on arrival (playtest 47).
       *
       * The frontage was the answer to a whole footprint that could not seat a
       * caption anywhere near it: a caption is about eight tiles wide, these
       * buildings stand two tiles apart, and in the order the doors were made
       * every ordinary seat was taken and the lab ended up captioned four rows
       * away, down on the quay. Names are seated nearest first now
       * (`labelPlacement.ts`), so the door being walked to takes the seat over
       * its own roof; `doorCaptions.test.ts` holds both.
       */
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: propsRect([{ ...door.building, name: door.building.prop }]),
          // Two lines, and no more. The name says what the building is and
          // the second line says what is waiting inside today, which is the
          // whole of what the lobby's four cards carried
          // (`base/doorStatus.ts`). A third line saying what the building is
          // *for* was tried and thrown away: the yard is four rows deep, two
          // of these speak at once from the middle of it, and at three lines
          // each there was no base left to look at. What each keeper does is
          // said once, on the harbour's own board by the jetty.
          text: `${door.name}\n${doorStatusLine(door, this.savedGame, houseName())}`,
          tone: DOOR_TONE,
          depth: atRow(CAPTION_BAND, door.tiles[0].y),
          speech: { voice: 'name', tiles: door.tiles },
        }),
      );
    }
    this.worldLabels.push(
      new WorldLabel(this, {
        subject: figureRect(DAY_CARE_KEEPER.position),
        text: `${DAY_CARE_KEEPER.name}\n${dayCareStatusLine(
          this.savedGame.stash,
          raidsCompleted(this.savedGame.raidProgress, this.savedGame.raidInFlight),
        )}`,
        tone: DOOR_TONE,
        depth: atRow(CAPTION_BAND, DAY_CARE_KEEPER.position.y),
        speech: { voice: 'name', tiles: [DAY_CARE_KEEPER.position] },
      }),
    );
    for (const landmark of HARBOUR_LANDMARKS) {
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: propsRect(landmark.props),
          text: `${landmark.name}\n${landmark.note}`,
          tone: LANDMARK_TONE,
          depth: atRow(CAPTION_BAND, landmark.at.y),
          speech: { voice: 'name', tiles: landmark.near ?? [landmark.at] },
        }),
      );
    }
    for (const fixture of this.fixtures) {
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: propsRect(fixture.props),
          text: `${fixture.name}\n${fixture.note}`,
          tone: FIXTURE_TONE,
          depth: atRow(CAPTION_BAND, fixture.at.y),
          speech: { voice: 'name', tiles: [fixture.at] },
        }),
      );
    }
  }

  private createRoomCaptions(built: BuiltRoom): void {
    const { room } = built;
    const { keeper } = room;
    if (keeper) {
      const door = doorNamed(room.id);
      const status = door ? doorStatusLine(door, this.savedGame) : '';
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: figureRect(keeper.position),
          text: status ? `${keeper.name}\n${status}` : keeper.name,
          tone: DOOR_TONE,
          depth: atRow(CAPTION_BAND, keeper.position.y),
          // Said as the player walks up, not from the mat: the hint line already
          // names the keeper there, and a caption said from the door sits over
          // the very room the player has walked in to look at.
          speech: { voice: 'name', tiles: [keeper.position], near: 2 },
        }),
      );
    }
    this.stationLabels.clear();
    for (const thing of built.things.filter((each) => !each.quiet)) {
      const station = thing.opens && thing.opens in ARENA_STATION_NAMES ? (thing.opens as ArenaStationId) : null;
      const label = new WorldLabel(this, {
        subject: station ? { ...tilesRect(thing.tiles), y: tilesRect(thing.tiles).y - STATION_RISE, height: TILE_SIZE + STATION_RISE } : tilesRect(thing.tiles),
        text: `${thing.name}\n${station ? this.stationNote(station) : thing.note}`,
        tone: station ? DOOR_TONE : FIXTURE_TONE,
        depth: atRow(CAPTION_BAND, Math.max(...thing.tiles.map((tile) => tile.y))),
        // The hall's furniture names itself as it is walked up to, from further
        // off than a thing in a room does, because the hall is that much bigger.
        speech: { voice: 'name', tiles: thing.tiles, near: station ? STATION_NAMED_WITHIN : 1 },
      });
      this.worldLabels.push(label);
      if (station) {
        this.stationLabels.set(thing, label);
      }
    }
  }

  private createDialogBox(): void {
    this.dialogBox = new DialogBox(this, {
      x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      padding: 10,
      // The same drawn window and the same face as the raid's dialogue, so the
      // base speaks in the game's one voice.
      pixelWindow: true,
      borderColor: WINDOW_CREAM,
      backgroundColor: 0x0e1828,
      textStyle: { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE },
      indicatorStyle: { fontFamily: GAME_FONT, fontSize: '12px' },
    }).setScrollFactor(0, 0, true);
  }

  /**
   * The line along the foot of the screen that says what the keys do where
   * the player is standing: which key speaks to the keeper, and - on the mat -
   * which way is out. It is the room's whole tutorial, and it is only shown
   * where it is true.
   */
  private createHint(): void {
    this.hintFrame = this.add.graphics().setScrollFactor(0).setDepth(CANOPY_BAND + 0.2);
    this.hintText = this.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CANOPY_BAND + 0.21);
    this.showHint('');
  }

  private hintHere(): string {
    const room = this.place.room?.room;
    const facing = nextTileFromDirection(this.currentTile, this.facing);
    // Facing the partner is the one thing the yard says a key does, because
    // turning to face it is the only way anybody would find out.
    const partner = this.partner && this.partnerAt(facing) ? `[SPACE] ${this.partner.name}` : undefined;
    // Another player faced is waved at, and the same goes for them: facing
    // somebody is the only way anybody would find that out (playtest 49).
    const wave = !partner && this.otherPlayerAt(facing) ? WAVE_HINT : undefined;
    if (!room) {
      // Nothing else to say in the yard: the keys this save has not used yet
      // (`input/keyBindings.ts`). A newcomer arrives here first, and the first
      // control hint used to be inside Oak's Lab (playtest 43).
      if (wave) {
        return wave;
      }
      if (!partner && sameTile(facing, DAY_CARE_KEEPER.position)) {
        return `[SPACE] ${DAY_CARE_KEEPER.name}`;
      }
      const local = partner ? undefined : this.harbourLife?.at(facing);
      if (local) {
        return `[SPACE] ${local.name}`;
      }
      if (!partner && this.canFishAt(facing)) {
        return '[SPACE] FISH';
      }
      return partner ?? yardKeyHintLine(new Set(this.savedGame.raidProgress.keysLearned ?? []));
    }
    const keeper = room.keeper ? `[SPACE] ${room.keeper.name}` : '';
    if (this.onMat(room) && room.screen === 'arena') {
      return partner ? `${partner}   [DOWN] OUT` : '[DOWN] OUT';
    }
    if (this.onMat(room)) {
      // The player's own house has nobody to speak to from the mat, so it
      // names its own keys there instead: the mat is where everybody arrives,
      // and the house's H and K went unsaid until they stepped off it
      // (playtest 48).
      // A keeper's screen is opened from the mat whoever is in front of it.
      const speak = partner ?? (room.screen ? keeper : undefined) ?? wave ?? (keeper || this.houseKeys());
      return speak ? `${speak}   [DOWN] OUT` : '[DOWN] OUT';
    }
    if (partner) {
      return partner;
    }
    if (servesFrom(room, facing)) {
      return keeper;
    }
    if (wave) {
      return wave;
    }
    // Something in the room that opens a screen says so where it can be
    // opened from, exactly as the keeper does: a board on a wall that answers
    // a key nobody was told about is a board nobody reads.
    const faced = this.thingFaced(facing);
    if (faced?.opens || faced?.reads) {
      return `[SPACE] ${faced.name}`;
    }
    // The cabinet is looked into rather than read off, so it says it can be.
    const unit = faced?.cabinetUnit;
    if (unit !== undefined && this.oddityToStartAt(facing, unit) !== undefined) {
      return '[SPACE] LOOK CLOSER';
    }
    // Anywhere on the rim is over a way in, and the hint says which.
    if (this.arena && isAtRim(this.currentTile)) {
      return this.aimed && !this.kit?.flow.notReady ? `[SPACE] JUMP IN AT ${this.landingName(this.aimed)}` : '[SPACE] LOOK DOWN';
    }
    // The player's own house says it can be decorated, until it has been.
    return this.houseKeys();
  }

  /** The keys the player's own house answers that this save has not used yet. */
  private houseKeys(): string {
    return this.place.room?.home && !this.visit
      ? houseKeyHintLine(new Set(this.savedGame.raidProgress.keysLearned ?? []))
      : '';
  }

  /** Whether another player in the shared harbour stands (or is stepping) onto this tile: Space waves at them. */
  private otherPlayerAt(tile: GridPosition): boolean {
    return harbour()?.figuresHere().some((figure) => sameTile(figure.toward ?? figure.tile, tile)) ?? false;
  }

  private thingFaced(facing: GridPosition): RoomThing | undefined {
    return this.place.room?.things.find((candidate: RoomThing) =>
      candidate.tiles.some((tile) => tile.x === facing.x && tile.y === facing.y),
    );
  }

  private oddityToStartAt(facing: GridPosition, unit: number): number | undefined {
    const placed: readonly PlacedOddity[] = this.place.room?.cabinet?.layout.placed ?? [];
    return firstOddityAt(placed, facing, unit, TILE_SIZE);
  }

  /**
   * A key used for the first time on this save, so the yard stops naming it.
   * The scene's copy of the game learns it too: every door and room hands that
   * copy to the next scene.
   */
  private learnKey(key: LearnableKeyId): void {
    const progress = this.savedGame.raidProgress;
    if (progress.keysLearned?.includes(key)) {
      return;
    }
    this.saveManager.learnKeys([key]);
    this.savedGame = {
      ...this.savedGame,
      raidProgress: { ...progress, keysLearned: [...(progress.keysLearned ?? []), key] },
    };
  }

  /**
   * While somebody is talking and there is more to come, the one key that gets
   * past all of it is named just clear of the box: favours run to eight presses
   * for a player who only came for the keeper's screen.
   */
  private showTalkHint(): void {
    if (this.dialogBox.boxesLeft <= 1 && !this.afterSaid) {
      this.showHint('');
      return;
    }
    const height = Math.ceil(this.hintText.height) + HINT_PADDING_Y * 2;
    const above = this.dialogBox.y - height - HINT_MARGIN;
    this.showHint(TALK_SKIP_HINT, {
      right: this.dialogBox.x + DIALOG_WIDTH,
      y: above >= 0 ? above : this.dialogBox.y + DIALOG_HEIGHT + HINT_MARGIN,
    });
  }

  /** The hint centred along the foot of the screen, or at `seat` - the corner of a box - when that is in use. */
  private showHint(text: string, seat?: { readonly right: number; readonly y: number }): void {
    if (text === this.hintShown && seat?.y === this.hintSeat?.y && seat?.right === this.hintSeat?.right) {
      return;
    }
    this.hintShown = text;
    this.hintSeat = seat;
    this.hintFrame.clear();
    this.hintText.setText(text).setVisible(text !== '');
    if (text === '') {
      return;
    }
    const width = Math.ceil(this.hintText.width) + HINT_PADDING_X * 2;
    const height = Math.ceil(this.hintText.height) + HINT_PADDING_Y * 2;
    const x = seat ? seat.right - width : Math.round((this.scale.width - width) / 2);
    const y = seat ? seat.y : this.scale.height - height - HINT_MARGIN;
    drawPixelWindow(this.hintFrame, { x, y, width, height }, { fill: WINDOW_CREAM });
    this.hintText.setPosition(x + HINT_PADDING_X, y + HINT_PADDING_Y);
  }

  private layoutForStage(): void {
    if (!this.dialogBox) {
      return;
    }
    this.dialogBox.setPosition(
      Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
    );
    const hint = this.hintShown;
    this.hintShown = '\u0000';
    this.showHint(hint, this.hintSeat);
    this.configureCamera();
  }

  /**
   * The yard is bigger than the screen and the camera follows the player
   * across it. A room is smaller than the screen and stands still in the
   * middle of it, in the dark, the way a FireRed room does: the bounds are
   * widened to the view round the room so the camera cannot scroll and the
   * room lands centred, on whole pixels.
   */
  private configureCamera(): void {
    const camera = this.cameras.main;
    const width = this.place.width * TILE_SIZE;
    const height = this.place.height * TILE_SIZE;
    const viewWidth = this.scale.width / CAMERA_ZOOM;
    const viewHeight = this.scale.height / CAMERA_ZOOM;
    const left = width < viewWidth ? Math.floor((width - viewWidth) / 2) : 0;
    const top = height < viewHeight ? Math.floor((height - viewHeight) / 2) : 0;
    camera.setBackgroundColor(0x000000);
    const below = this.place.room?.pit ? ARENA_DARK_BELOW : 0;
    if (this.place.room?.pit) {
      // The hall's stands stand outside its own grid (`arenaStands.ts`).
      camera.setBounds(STANDS_ORIGIN.x, STANDS_ORIGIN.y, STANDS_WIDTH, Math.max(STANDS_HEIGHT, height + below - STANDS_ORIGIN.y));
    } else {
      camera.setBounds(left, top, Math.max(width, viewWidth), Math.max(height + below, viewHeight));
    }
    this.panelLean.boundsWereSet();
    camera.setZoom(CAMERA_ZOOM);
    camera.setRoundPixels(true);
    // The hall's camera is placed by hand, a whole pixel from a whole pixel
    // (`settleHallCamera`), because it leans as well as follows.
    if (!this.place.room?.pit) {
      camera.startFollow(this.player, true);
    }
  }

  private containWorldLabels(): void {
    if (this.worldLabels.length === 0) {
      return;
    }
    // Decorating is looking at the room itself: no caption over it. Nor over the
    // hall with a panel up: the panel is saying it.
    if (this.decor || this.arenaPanel) {
      this.worldLabels.forEach((label) => label.hide());
      this.partner?.setVeiled(false);
      return;
    }
    const audience = {
      player: this.currentTile,
      looking: isLooking(this.lookMs, this.controls.look.isDown),
      raidRemainingMs: Number.POSITIVE_INFINITY,
    };
    // Looking at one thing on Bill's shelves takes every other caption in the
    // room off the screen - and out of the seating, where a quiet caption is
    // still ground a label may not sit on - so the label on it is the only
    // writing there is.
    const labels = this.inspectLabel ? [this.inspectLabel] : this.worldLabels;
    if (this.inspectLabel) {
      this.worldLabels.forEach((label) => label.hide());
    }
    labels.forEach((label) => label.describe(audience));
    const view = this.cameras.main.worldView;
    const bounds: Rect = { x: view.left, y: view.top, width: view.width, height: view.height };
    const room = this.place.room?.room;
    const partner = this.partner?.place.out ? this.partner : null;
    const bubble = partner ? partner.bubbleRect() : null;
    const placements = placeCaptions(
      labels.map((label) => label.request()),
      {
        bounds,
        // The dialogue box is drawn over the captions, as the hint line is, so
        // while one is up it is ground no caption may take - the raid's rule
        // (`WorldScene`), which the base had not been told: a caption came out
        // half under the box whenever anything here was spoken to.
        furniture: [
          ...(this.hintShown ? [this.hintRect(view)] : []),
          ...this.placeSignIn(view),
          ...this.feedbackTabIn(view),
          // The favours' side panel, so a caption is never half under it.
          ...(this.panelLean.covering > 0
            ? [{ x: view.right - this.panelLean.covering, y: view.top, width: this.panelLean.covering, height: view.height }]
            : []),
          ...(this.dialogBox.visible
            ? [{ x: this.dialogBox.x + view.left, y: this.dialogBox.y + view.top, width: DIALOG_WIDTH, height: DIALOG_HEIGHT }]
            : []),
          // And so is a question asked in its frame - a favour's YES or NOT
          // NOW, or a knock at the door - which is up while the box is down.
          ...[this.boxQuestion?.prompt, this.knockPrompt?.prompt]
            .filter((prompt): prompt is ChoicePrompt => prompt !== undefined)
            .map((prompt) => ({ x: prompt.x + view.left, y: prompt.y + view.top, width: DIALOG_WIDTH, height: DIALOG_HEIGHT })),
        ],
        keepClear: [
          ...(room?.keeper ? [figureRect(room.keeper.position)] : []),
          ...(room ? [] : [figureRect(DAY_CARE_KEEPER.position)]),
          ...(this.penPokemon ? [figureRect(this.penPokemon.tile)] : []),
          // The harbour's people (`base/harbourLife.ts`), as the Day-Care man
          // is: a caption seated across a person reads as their head stuck on
          // a sign.
          ...(this.harbourLife?.standing('person') ?? []).map((tile) => figureRect(tile)),
          // What the other players are saying: a caption seated over it would be read as said.
          ...(this.harbourFigures?.bubbleRects() ?? []),
          // This player's own hand while it is up.
          ...(this.ownWave ? [{ x: this.ownWave.bubble.x, y: this.ownWave.bubble.y, width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT }] : []),
          // And what they are saying.
          ...(this.ownBubble?.box ? [{ ...this.ownBubble.box }] : []),
          // And the "!" over anybody with a favour on their mind.
          ...[...(this.keeperMark ? [this.keeperMark] : []), ...this.harbourMarks.values()].map((mark) => ({
            x: mark.x,
            y: mark.y,
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
          })),
          // What the partner is saying: a door's name seated across its bubble hid
          // the heart it answers a word with, on the quay and at the Day-Care.
          ...(bubble ? [bubble] : []),
          // A piece of furniture is drawn among the figures, over any caption under it.
          ...(this.place.room?.home?.placed ?? [])
            .filter((piece) => piece.definition.layer !== 'floor')
            .map(furnitureRect),
        ],
        canopy: this.canopyInView(bounds),
        player: [figureRect(this.currentTile), figureRect(this.targetTile ?? this.currentTile)],
        // The partner itself is company, as it is on a raid: a caption would
        // rather sit clear of it, but never goes unseated for it, and it goes
        // faint under one instead. Kept clear outright, it tucked in under the
        // player on THE BOLTHOLE's step - where everybody comes out - and took
        // the house's name away, with the trees over the roof and the workshop
        // beside it already taken.
        // The harbour's Pokemon are company the same way, and small enough
        // that a name seated over one still reads.
        follower: [
          ...(partner ? [partner.rect()] : []),
          ...(this.harbourLife?.standing('pokemon') ?? []).map((tile) => figureRect(tile)),
          // And the partners walking at other players' heels.
          ...(this.harbourFigures?.heelRects() ?? []),
          // And the other players themselves, and the regulars: somebody
          // standing about beside a door never takes its name away. A regular
          // knocking at the Pokémon Center had the only seat its name has from
          // the doorstep, and the favour on it went unread for as long as they
          // stood there. A name that has to sit across them is read through
          // them (`HarbourFigures.veilUnder`).
          ...(this.harbourFigures?.rects() ?? []),
        ],
      },
    );
    labels.forEach((label, index) => label.seat(placements[index]));
    this.harbourFigures?.veilUnder(
      placements.flatMap((placement, index) => {
        const { width, height } = labels[index].request();
        return placement.visible ? [{ x: placement.x, y: placement.y, width, height }] : [];
      }),
    );
    this.partner?.setVeiled(
      partner !== null &&
        seatedOver(
          placements,
          labels.map((label) => label.request()),
          partner.rect(),
        ),
    );
  }

  /** The place-name board while it is up, in world space: ground no caption may take. */
  private placeSignIn(view: Phaser.Geom.Rectangle): Rect[] {
    const sign = this.placeSign?.rect();
    return sign ? [{ ...sign, x: sign.x + view.left, y: sign.y + view.top }] : [];
  }

  /** The FEEDBACK tab where it stands over the yard, in world space (`feedbackTabCover.ts`). */
  private feedbackTabIn(view: Phaser.Geom.Rectangle): Rect[] {
    const tab = feedbackTabOverGame(this.game?.canvas, this.scale?.gameSize);
    return tab ? [{ ...tab, x: tab.x + view.left, y: tab.y + view.top }] : [];
  }

  private hintRect(view: Phaser.Geom.Rectangle): Rect {
    const height = Math.ceil(this.hintText.height) + HINT_PADDING_Y * 2;
    return {
      x: view.left,
      y: view.top + this.scale.height - height - HINT_MARGIN,
      width: view.width,
      height: height + HINT_MARGIN,
    };
  }

  /** Every crown in view, as one rectangle a row, and the tops of them: writing may not sit under one. */
  private canopyInView(view: Rect): readonly Rect[] {
    const canopy = this.place.layers.canopy.tiles;
    const left = Math.max(0, Math.floor(view.x / TILE_SIZE));
    const right = Math.min(this.place.width - 1, Math.ceil((view.x + view.width) / TILE_SIZE));
    const top = Math.max(0, Math.floor(view.y / TILE_SIZE));
    const bottom = Math.min(this.place.height - 1, Math.ceil((view.y + view.height) / TILE_SIZE));
    const runs: Rect[] = [];
    for (let y = top; y <= bottom; y += 1) {
      let start: number | null = null;
      for (let x = left; x <= right + 1; x += 1) {
        const drawn = x <= right && canopy[y]?.[x] >= 0;
        if (drawn && start === null) {
          start = x;
        } else if (!drawn && start !== null) {
          runs.push({
            x: start * TILE_SIZE,
            y: y * TILE_SIZE,
            width: (x - start) * TILE_SIZE,
            height: TILE_SIZE,
          });
          start = null;
        }
      }
    }
    runs.push(...brimRuns(this.place.layers, { left, top, right, bottom }, TILE_SIZE));
    return runs;
  }

  // -- input -----------------------------------------------------------------

  private bindControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is not available.');
    }
    const cursors = this.input.keyboard.createCursorKeys();
    const wasd = this.input.keyboard.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    ]);
    this.input.keyboard.on?.('keydown-M', () => audioManager.toggleMute());
    this.controls = {
      up: cursors.up,
      down: cursors.down,
      left: cursors.left,
      right: cursors.right,
      w: wasd.W,
      a: wasd.A,
      s: wasd.S,
      d: wasd.D,
      look: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.look]),
      run: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false),
      interact: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ],
      back: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false),
      favours: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[RAID_KEY_LETTERS.objectives], false),
      decorate: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.decorate], false),
      turn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.turn], false),
      boxBack: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.boxBack], false),
      boxNext: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.boxNext], false),
      putAway: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.putAway], false),
      talk: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[ROOM_KEY_LETTERS.talk], false),
    };
    this.latchDirectionPresses();
    this.keyPresses.watch([
      ...this.directionKeys(),
      ...this.controls.interact,
      this.controls.look,
      this.controls.back,
      this.controls.favours,
      this.controls.decorate,
      this.controls.turn,
      this.controls.boxBack,
      this.controls.boxNext,
      this.controls.putAway,
      this.controls.talk,
    ]);
  }

  private directionKeys(): Phaser.Input.Keyboard.Key[] {
    return [
      this.controls.up,
      this.controls.down,
      this.controls.left,
      this.controls.right,
      this.controls.w,
      this.controls.a,
      this.controls.s,
      this.controls.d,
    ];
  }

  private latchDirectionPresses(): void {
    const watch = (key: Phaser.Input.Keyboard.Key, direction: Direction): void => {
      key.on('down', () => this.directionPresses.press(direction, this.currentFrame()));
    };
    watch(this.controls.up, 'up');
    watch(this.controls.w, 'up');
    watch(this.controls.down, 'down');
    watch(this.controls.s, 'down');
    watch(this.controls.left, 'left');
    watch(this.controls.a, 'left');
    watch(this.controls.right, 'right');
    watch(this.controls.d, 'right');
  }

  private currentFrame(): number {
    return this.game.loop.frame;
  }

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

  private isInteractionPressed(): boolean {
    return this.controls.interact.some((key) => this.keyPresses.justPressed(key));
  }

  // -- walking ---------------------------------------------------------------

  /** Whether a tile can be walked onto: the map, and whoever is standing on it. */
  public isBlocked(tile: GridPosition): boolean {
    const keeper = this.place.room ? this.place.room.room.keeper?.position : DAY_CARE_KEEPER.position;
    return (
      (this.collision[tile.y]?.[tile.x] ?? true) ||
      (keeper !== undefined && keeper.x === tile.x && keeper.y === tile.y) ||
      (this.harbourLife?.holds(tile) ?? false)
    );
  }

  /**
   * Whether the player, their partner or the Day-Care man has this tile, for a
   * townsperson deciding where to drift: nobody steps into the player.
   */
  private someoneElseOn(tile: GridPosition): boolean {
    const partnerTile = this.partner?.place.out ? this.partner.place.tile : null;
    return (
      sameTile(tile, this.currentTile) ||
      (this.targetTile !== null && sameTile(tile, this.targetTile)) ||
      (partnerTile !== null && sameTile(tile, partnerTile)) ||
      sameTile(tile, DAY_CARE_KEEPER.position)
    );
  }

  private onMat(room: BaseRoom): boolean {
    return room.mat !== null && this.currentTile.x === room.mat.x && this.currentTile.y === room.mat.y;
  }

  private beginStep(targetTile: GridPosition): void {
    this.targetTile = targetTile;
    this.stepProgress = 0;
    this.stepDurationMs =
      isPlaytestRun() && this.controls.run.isDown
        ? STEP_DURATION_MS / PLAYTEST_RUN_DIVISOR
        : STEP_DURATION_MS;
    this.stepStart.set(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
    this.stepEnd.set(targetTile.x * TILE_SIZE, targetTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET);
    this.player.play(lookWalkKey(this.playerTexture, this.facing), true);
    this.partner?.follow(this.currentTile, targetTile);
    harbour()?.stepped(targetTile, this.facing);
  }

  private advanceStep(deltaMs: number): void {
    const tick = advanceStepClock(this.stepProgress, deltaMs, this.stepDurationMs);
    this.stepProgress = tick.progress;
    this.setPlayerPosition(
      Phaser.Math.Linear(this.stepStart.x, this.stepEnd.x, this.stepProgress),
      Phaser.Math.Linear(this.stepStart.y, this.stepEnd.y, this.stepProgress),
    );
    if (this.stepProgress < 1 || !this.targetTile) {
      return;
    }
    this.currentTile = this.targetTile;
    this.targetTile = null;
    this.stepCarryMs = tick.overflowMs;
    this.partner?.arrived();
    const room = this.place.room?.room;
    if (room) {
      const stair = stairAt(room, this.currentTile);
      if (stair) {
        this.climb(room, stair.to);
      }
      return;
    }
    const door = doorAt(this.currentTile);
    if (door) {
      this.enterRoom(door);
    }
  }

  // -- the partner -----------------------------------------------------------

  /**
   * The partner, if this save still has one, standing where it would have
   * walked in: behind the player, else beside them (`arrivalPlace`). It fades
   * in with a hop rather than standing there from the first frame, because it
   * has just come in after them - and coming home from a raid, or opening the
   * game, it says hello.
   */
  private createPartner(data: BaseSceneData): void {
    const partner = partnerOf(this.savedGame.stash);
    if (!partner) {
      return;
    }
    const place = arrivalPlace(this.currentTile, this.facing, (tile) => this.partnerCanStand(tile));
    const greeting: PartnerEmote | null =
      data.arrival === 'raid' || (data.from === undefined && data.room === undefined && data.at === undefined)
        ? partner.pokemon.isFainted
          ? 'sleepy'
          : partner.pokemon.currentHp * 4 <= partner.pokemon.maxHp
            ? 'ellipsis'
            : data.arrival === 'raid'
              ? 'heart'
              : 'happy'
        : null;
    this.partner = new PartnerFigure(this, this.partnerHost(), partner, place, { greeting });
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
      standingAbout: () => this.targetTile === null && !this.leaving,
      quiet: () => this.inspecting !== null,
    };
  }

  /**
   * Ground a partner may arrive on: inside the place, not solid, nobody on it,
   * and somewhere it can be seen. A doorway is none of the last two - the
   * building's own art is drawn over whoever stands in it, which is what makes
   * walking into one read as going inside - so a partner put there arrived
   * invisible and stayed so until the player moved.
   */
  private partnerCanStand(tile: GridPosition): boolean {
    return (
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x < this.bounds.width &&
      tile.y < this.bounds.height &&
      !this.isBlocked(tile) &&
      (this.place.room !== null || doorAt(tile) === undefined) &&
      (this.place.layers.canopy.tiles[tile.y]?.[tile.x] ?? -1) < 0
    );
  }

  /** Whether the partner is out and standing on `tile`. */
  private partnerAt(tile: GridPosition): boolean {
    return this.partner?.standsOn(tile) ?? false;
  }

  /** Whether this frame's step only turns the player to face the partner (`turnToPartner`). */
  private turnsToFacePartner(
    target: GridPosition | null,
    facing: Direction,
    fromStanding: boolean,
    deltaMs: number,
  ): boolean {
    const { turn, holdMs } = turnToPartner({
      holdMs: this.turnToPartnerMs,
      target,
      partner: this.partner?.standingTile() ?? null,
      stepFacing: facing,
      facing: this.facing,
      fromStanding,
      deltaMs,
    });
    this.turnToPartnerMs = holdMs;
    return turn;
  }

  /**
   * Facing the partner and pressing the interact key: it turns to the player,
   * says how it is - in its own words, with the bubble over its head - and
   * hops if it has the energy.
   */
  private talkToPartner(): void {
    const partner = this.partner;
    if (!partner) {
      return;
    }
    const place: PartnerPlaceName = (this.place.room?.room.id as PartnerPlaceName | undefined) ?? 'yard';
    const reaction = partnerReaction(partner.pokemon, place, Math.random());
    partner.lookAtPlayer();
    if (reaction.hops) {
      partner.hop();
    }
    partner.showBubble(reaction.emote);
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.say([reaction.line], [partner.place.tile]);
  }

  // -- the doors, the rooms and the keepers ----------------------------------

  /**
   * Speaking to whatever is in front of the player.
   *
   * In a room the keeper is spoken to across their counter or face to face,
   * and from the door mat whichever way the player is facing: that is the
   * one-key way to a screen, and nothing else in a room is on the mat. In the
   * yard a door opens from the tile in front of it, so a player who walks *at*
   * a building rather than *into* it is not left pressing keys at a wall.
   * Everything else answers with what it is.
   */
  // -- decorating -------------------------------------------------------------

  /**
   * H in a house: the player's own is picked up to decorate, and somebody
   * else's says why it cannot be - a key that did nothing at all left a
   * visitor wondering whether it was broken (playtest 48).
   */
  private decorateHere(): void {
    if (this.visit) {
      this.say([notYoursToMoveLine(this.visit.ownerName)], []);
      return;
    }
    this.startDecorating();
  }

  /**
   * Picks the house up to decorate it (`base/decorateMode.ts`): the player
   * stands where they are and a cursor takes over, starting on the tile they
   * were facing.
   */
  private startDecorating(): void {
    const built = this.place.room;
    if (!built?.home || this.decor) {
      return;
    }
    this.learnKey('decorate');
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    const faced = nextTileFromDirection(this.currentTile, this.facing);
    const inRoom = faced.x >= 0 && faced.y >= 0 && faced.x < this.place.width && faced.y < this.place.height;
    const layout: Placement[] = built.home.house.map(({ id, room, x, y, facing }) => ({ id, room, x, y, facing }));
    this.decor = new DecorateMode(this.decorateHost(), layout, inRoom ? faced : this.currentTile);
  }

  private decorateHost(): DecorateHost {
    const withLayout = (layout: readonly Placement[]): RestoredGame => ({
      ...this.savedGame,
      raidProgress: { ...this.savedGame.raidProgress, homeLayout: [...layout] },
    });
    return {
      scene: this,
      built: () => this.place.room!,
      standing: () => this.currentTile,
      owned: () => ownedFurniture(this.savedGame),
      show: (layout) => this.redrawRoom(withLayout(layout)),
      keep: (layout) => {
        // Written as it lands. With nowhere to write it, the house still
        // stands as arranged for as long as the page is open.
        this.savedGame = this.saveManager.arrangeHome(layout) ?? withLayout(layout);
        this.redrawRoom(this.savedGame);
      },
      showHint: (text) => this.showHint(text),
    };
  }

  /** One frame of decorating: the keys read and handed over, until it is done. */
  private updateDecorating(): void {
    const decor = this.decor;
    if (!decor) {
      return;
    }
    const pressed = (...keys: Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => this.keyPresses.justPressed(key));
    const move = pressed(this.controls.left, this.controls.a)
      ? { dx: -1, dy: 0 }
      : pressed(this.controls.right, this.controls.d)
        ? { dx: 1, dy: 0 }
        : pressed(this.controls.up, this.controls.w)
          ? { dx: 0, dy: -1 }
          : pressed(this.controls.down, this.controls.s)
            ? { dx: 0, dy: 1 }
            : undefined;
    const going = decor.update({
      move,
      press: this.isInteractionPressed(),
      turn: pressed(this.controls.turn),
      box: pressed(this.controls.boxNext) ? 1 : pressed(this.controls.boxBack) ? -1 : undefined,
      putAway: pressed(this.controls.putAway),
      back: pressed(this.controls.back),
      done: pressed(this.controls.decorate),
    });
    if (!going) {
      decor.destroy();
      this.decor = null;
      // A direction still held from moving the cursor is not a step.
      this.spentPresses.spendHeld(this.directionKeys());
      this.showHint(this.hintHere());
    }
  }

  /**
   * The room drawn again where it stands, from this game: a piece of furniture
   * has been picked up or put down. The tiles, the furniture, the collision and
   * the captions all follow, and a partner left standing inside a piece steps
   * out of it.
   */
  private redrawRoom(game: RestoredGame): void {
    const current = this.place.room;
    if (!current) {
      return;
    }
    const built = buildRoom(current.room, game);
    this.place = { ...this.place, layers: built.layers, collision: built.collision, sources: built.sources, room: built };
    this.collision = built.collision.map((row) => [...row]);
    this.drawMap();
    this.drawFurniture();
    this.worldLabels.forEach((label) => label.destroy());
    this.worldLabels = [];
    this.createRoomCaptions(built);
    const partnerTile = this.partner?.standingTile();
    if (this.partner && partnerTile && this.isBlocked(partnerTile)) {
      this.partner.standAt(arrivalPlace(this.currentTile, this.facing, (tile) => this.partnerCanStand(tile)));
    }
  }

  /**
   * Opens the quick-phrase list (`harbour/harbourPhrases.ts`): anywhere in the
   * harbour, alone or not, because a regular may answer and so may anybody who
   * walks up while the bubble is still there.
   */
  private openPhrases(): void {
    this.learnKey('talk');
    audioManager.play('select');
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    // An arrow still held from the walk is not a press on the list: unread,
    // it moved the cursor the moment the list opened.
    const { up, down, left, right, w, a, s, d } = this.controls;
    [up, down, left, right, w, a, s, d].forEach((key) => this.keyPresses.justPressed(key));
    this.phrasePicker = new PhrasePicker(
      this,
      HARBOUR_PHRASES.map((phrase) => phrase.words),
      (index) => this.sayPhrase(HARBOUR_PHRASES[index].id),
    );
    this.showHint(PHRASE_LIST_HINT);
  }

  private closePhrases(): void {
    this.phrasePicker?.destroy();
    this.phrasePicker = null;
  }

  /** The list open: the arrows walk it, SPACE or ENTER says, T or ESC shuts it. */
  private handlePhraseInput(): void {
    const picker = this.phrasePicker!;
    this.showHint(PHRASE_LIST_HINT);
    const pressed = (keys: readonly Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => this.keyPresses.justPressed(key));
    if (pressed([this.controls.talk, this.controls.back])) {
      this.closePhrases();
      audioManager.play('select');
      return;
    }
    if (pressed(this.controls.interact)) {
      picker.say();
      return;
    }
    const direction: Direction | null = pressed([this.controls.left, this.controls.a])
      ? 'left'
      : pressed([this.controls.right, this.controls.d])
        ? 'right'
        : pressed([this.controls.up, this.controls.w])
          ? 'up'
          : pressed([this.controls.down, this.controls.s])
            ? 'down'
            : null;
    if (direction && picker.move(direction)) {
      audioManager.play('select');
    }
  }

  /**
   * Says a phrase: up over this player at once, to everybody else in the place
   * (`HarbourLink.say`), and maybe answered by the nearest regular. Too soon
   * after the last and it is not said, and the list stays open to say so.
   */
  private sayPhrase(phrase: HarbourPhraseId): void {
    const talk = harbourTalk();
    if (!talk.say(phrase, this.frameTime)) {
      audioManager.play('denied');
      return;
    }
    harbour()?.say(phrase);
    const watcher = this.regularsWatcher();
    if (watcher) {
      talk.answer(
        phrase,
        this.frameTime,
        (harbourRegulars()?.figures(watcher.place) ?? []).map((figure) => ({
          id: figure.id,
          steps: Math.abs(figure.tile.x - this.currentTile.x) + Math.abs(figure.tile.y - this.currentTile.y),
        })),
        Math.random,
      );
    }
    audioManager.play('confirm');
    this.closePhrases();
    this.showHint(this.hintHere());
  }

  /**
   * This player's own phrase over their head while it is up: over their own
   * hand if that is up too, and lifted clear of every name plate and bubble
   * beside them, as their hand is (`placeOwnWave`).
   */
  private settleOwnBubble(): void {
    const saying = harbourTalk().saying(OWN_SPEAKER, this.frameTime);
    if (!saying) {
      this.ownBubble?.destroy();
      this.ownBubble = null;
      return;
    }
    this.ownBubble ??= new SpeechBubble(this);
    this.ownBubble.say(saying);
    const centreX = this.player.x + TILE_SIZE / 2;
    const head = this.player.y + CHARACTER_HEAD_PIXEL_Y + lookHeadDrop(this.playerTexture);
    // Over the chevron that marks this player, as their hand is.
    const tipY = Math.round(this.ownWave ? this.ownWave.bubble.y - 1 : head - OWN_WAVE_LIFT - 1);
    const width = this.collision[0].length * TILE_SIZE;
    // And clear of the note or heart over a partner standing beside them.
    const emote = this.partner?.bubbleRect();
    const box = this.ownBubble.place(centreX, tipY, width, [...(this.harbourFigures?.bubbleRects() ?? []), ...(emote ? [emote] : [])]);
    // And no name is drawn under it: their own bubble over anybody's plate is the plate's to give up.
    this.harbourFigures?.clearNamesUnder(box);
  }

  /**
   * Waves at another player standing on `target` in the shared harbour: a hand
   * goes up over this player, and over them on every screen in the place
   * (`HarbourLink.wave`). Facing somebody, the key is for them, so it is spent
   * even while the last wave is still up.
   */
  private waveAt(target: GridPosition): boolean {
    const shared = harbour();
    const other = shared?.figuresHere().find((figure) => sameTile(figure.toward ?? figure.tile, target));
    if (!shared || !other) {
      return false;
    }
    if (shared.wave(other.id)) {
      this.ownWave?.bubble.destroy();
      this.ownWave = { bubble: drawEmoteBubble(this, 'wave'), ms: 0 };
      this.placeOwnWave();
      audioManager.play('harbourWave');
    }
    return true;
  }

  /**
   * Where the harbour's regulars can be seen from: the yard, or a keeper's
   * room they call in - never the player's own house, nor somebody else's.
   */
  private regularsWatcher(): RegularsWatcher | null {
    const room = this.place.room?.room;
    if (this.visit) {
      return null;
    }
    if (!room) {
      return { place: 'yard', player: this.currentTile };
    }
    if (!room.mat || !(SHARED_HARBOUR_ROOMS as readonly string[]).includes(room.id)) {
      return null;
    }
    return {
      place: room.id as RegularsWatcher['place'],
      player: this.currentTile,
      room: { collision: this.place.collision, mat: room.mat },
    };
  }

  /**
   * This player's own hand, up over their head while it is up - and lifted
   * over the name plate of whoever they are waving at, which stands over the
   * tile next door and is wider than it: the hand covered the first letters
   * of the name it was waving at.
   */
  private placeOwnWave(): void {
    if (!this.ownWave) {
      return;
    }
    const x = Math.round(this.player.x + TILE_SIZE / 2 - BUBBLE_WIDTH / 2);
    let y = Math.round(this.player.y + CHARACTER_HEAD_PIXEL_Y + lookHeadDrop(this.playerTexture) - BUBBLE_HEIGHT - OWN_WAVE_LIFT);
    for (const plate of this.harbourFigures?.plateRects() ?? []) {
      const across = x < plate.x + plate.width && x + BUBBLE_WIDTH > plate.x;
      if (across && y < plate.y + plate.height && y + BUBBLE_HEIGHT > plate.y) {
        y = plate.y - BUBBLE_HEIGHT;
      }
    }
    this.ownWave.bubble.setPosition(x, y);
  }

  private settleOwnWave(deltaMs: number): void {
    if (!this.ownWave) {
      return;
    }
    this.ownWave.ms += deltaMs;
    if (this.ownWave.ms >= WAVE_SHOWN_MS) {
      this.ownWave.bubble.destroy();
      this.ownWave = null;
      return;
    }
    this.placeOwnWave();
  }

  private tryInteract(): void {
    const target = nextTileFromDirection(this.currentTile, this.facing);
    // The partner first, even on a room's mat: facing it takes a turn on
    // purpose, so a key pressed at it is meant for it.
    if (this.partnerAt(target)) {
      this.talkToPartner();
      return;
    }
    const room = this.place.room?.room;
    if (room) {
      if (room.screen === 'arena') {
        // Nobody's screen opens from the mat in here: the room is the screen.
        if (servesFrom(room, target)) {
          this.speakToMarshal(room);
          return;
        }
      } else if (room.screen && (this.onMat(room) || servesFrom(room, target))) {
        this.speakToKeeper(room, room.screen);
        return;
      }
      if (this.waveAt(target)) {
        return;
      }
      const thing = this.thingFaced(target);
      if (thing?.opens === 'bench' || thing?.opens === 'rack' || thing?.opens === 'locker') {
        this.openHallPanel(thing.opens);
        return;
      }
      // Anywhere on the rim, whichever way along it the player happens to be
      // facing: they turn to the fence and look over.
      if (this.arena && isAtRim(this.currentTile)) {
        this.lookDown();
        return;
      }
      const cabinet = this.place.room?.cabinet;
      if (thing?.opens === 'wall-map') {
        this.openWallMap(room);
        return;
      }
      if (thing?.opens === 'boxes') {
        this.openHub({ savedGame: this.savedGame, view: 'stash', from: room.id, at: { ...this.currentTile } });
        return;
      }
      if (thing?.reads === 'board') {
        this.readTheBoard(room, [target]);
        return;
      }
      if (thing?.cabinetUnit !== undefined) {
        const index = this.oddityToStartAt(target, thing.cabinetUnit);
        if (index === undefined) {
          this.say([EMPTY_CABINET_LINE], [target]);
          return;
        }
        audioManager.play('select');
        this.player.stop();
        this.player.setFrame(getIdleFrame(this.facing));
        this.inspect({ index, by: 'keys' });
        return;
      }
      if (thing?.crated && cabinet) {
        this.say([cratesLine(cabinet.layout, cabinet.oddities, new Date())], [target]);
        return;
      }
      // A visitor looks round and touches nothing that is the owner's to use.
      if (
        this.visit &&
        thing &&
        (thing.does !== undefined || thing.opens === 'games' || thing.opens === 'wardrobe' || thing.name.endsWith("'S PC"))
      ) {
        this.say([notYoursLine(this.visit.ownerName)], [target]);
        return;
      }
      if (thing?.does === 'sleep') {
        this.sleep(thing.lines ?? [], [target]);
        return;
      }
      if (thing?.opens === 'games') {
        this.openGames();
        return;
      }
      if (thing?.opens === 'wardrobe') {
        this.openBoutique('wardrobe');
        return;
      }
      if (thing) {
        this.say(thing.lines ?? [`${thing.name} - ${thing.note.toLowerCase()}.`], [target]);
      }
      return;
    }
    if (this.waveAt(target)) {
      return;
    }
    const door = doorAt(target);
    if (door) {
      this.enterRoom(door);
      return;
    }
    const local = this.harbourLife?.at(target);
    // A favour first: somebody who wants something fetched says so before
    // anything else they have to say.
    if (local?.kind === 'person' && this.speakForFavour(local, target)) {
      return;
    }
    if (local?.id === SAILOR_ID) {
      this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      this.say(seagallopLines(this.savedGame.raidProgress.raidRecord), [target]);
      return;
    }
    if (local?.id === CAPTAIN_ID) {
      this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      this.say(spyglassLines(windowLight(new Date()), spyglassLooks), [target]);
      spyglassLooks += 1;
      return;
    }
    if (local?.id === GYM_GUIDE_ID) {
      this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      this.say(gymGuideLines(this.savedGame.raidProgress), [target]);
      return;
    }
    if (local?.id === WARDEN_ID) {
      this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      const teeth = errandRecord(this.savedGame.raidProgress.errands, 'gold-teeth')?.status === 'completed';
      this.say(wardenLines(teeth), [target]);
      return;
    }
    if (local?.id === ANGLER_ID) {
      this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      const lines = anglerLines(harbourRodLent || this.hasHarbourRod(), this.harbourCatchNames());
      harbourRodLent = true;
      this.say(lines, [target]);
      return;
    }
    if (local) {
      // Spoken to, a person turns to look back; a Pokemon cries first.
      if (local.kind === 'person') {
        this.harbourLife?.face(local.id, directionBetween(target, this.currentTile) ?? 'down');
      } else {
        this.harbourLife?.cry(local);
      }
      this.say(local.lines, [target]);
      return;
    }
    if (sameTile(target, DAY_CARE_KEEPER.position)) {
      this.speakToDayCareMan(target);
      return;
    }
    const fixture = this.fixtures.find(
      (standing) => standing.at.x === target.x && standing.at.y === target.y,
    );
    if (fixture) {
      this.say([`${fixture.name} - ${fixture.note.toLowerCase()}.`], [target]);
      return;
    }
    const landmark = HARBOUR_LANDMARKS.find((each) => sameTile(each.at, target));
    if (landmark) {
      this.say([`${landmark.name} - ${landmark.note.toLowerCase()}.`], [target]);
      return;
    }
    if (this.canFishAt(target)) {
      this.castInto(target);
      return;
    }
    const sign = BASE_SIGNS.find((each) => each.x === target.x && each.y === target.y);
    if (sign?.knocks && harbourHouses()) {
      this.readKnockSign(target);
      return;
    }
    if (sign) {
      // The harbour's board has today's notice pinned on top of its own words,
      // so a player back from a raid reads what is new before what they know.
      const lines = sign === NOTICE_BOARD ? [`TODAY'S NOTICE: ${noticeFor(new Date())}`, ...sign.lines] : sign.lines;
      this.say(lines, [target]);
    }
  }

  /**
   * The same two-beat rule the raid's dialogue has: the first press finishes
   * the line being typed, the second moves on. The press that answers a box is
   * spent on answering it, so a direction key still held when it closes does
   * not also walk a tile.
   */
  private handleDialogInput(): void {
    if (this.keyPresses.justPressed(this.controls.back)) {
      this.skipTalk();
      return;
    }
    const clicked = this.boxClicked;
    this.boxClicked = false;
    if (!this.isInteractionPressed() && !clicked) {
      return;
    }
    this.spentPresses.spendHeld(this.directionKeys());
    if (this.dialogBox.isCurrentMessageComplete) {
      audioManager.play('textAdvance');
      this.dialogBox.advance();
      const then = this.dialogBox.visible ? null : this.afterSaid;
      if (then) {
        this.afterSaid = null;
        then();
      }
      return;
    }
    this.dialogBox.skip();
  }

  /** ESC, past everything still to be said: on to whatever the talk was on its way to. */
  private skipTalk(): void {
    this.spentPresses.spendHeld(this.directionKeys());
    audioManager.play('textAdvance');
    this.dialogBox.dismiss();
    const then = this.afterSaid;
    this.afterSaid = null;
    then?.();
  }

  /**
   * Puts lines up in the dialogue box; `then` runs once the last of them has
   * been read and the box is down - a sign that opens something after it has
   * spoken (the knock sign's list of players).
   */
  private say(
    lines: readonly string[],
    about: readonly GridPosition[],
    then?: () => void,
    onLineShown?: (index: number) => void,
  ): void {
    this.afterSaid = then ?? null;
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
    this.dialogBox.showMessages([...lines], onLineShown);
  }

  /**
   * The favours list (`hub/favourList.ts`), over a harbour that stands still
   * while it is up: every favour, where it stands and the whole of it, read
   * when the player wants it rather than said at them.
   */
  private openFavours(): void {
    if (this.leaving || this.favoursScreen) {
      return;
    }
    this.learnKey('favours');
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('menuOpen');
    const game = this.savedGame;
    const entries = favourEntries(
      game.raidProgress,
      (itemId) => game.stash.itemCount(itemId),
      raidsDeployed(game.raidProgress),
    );
    this.favoursScreen = openFavourList(
      this,
      entries,
      () => {
        this.favoursScreen = null;
        // The screen kept every key to itself, so a key the yard saw go down
        // before it opened never came back up here.
        this.input.keyboard?.resetKeys();
        this.spentPresses.spendHeld(this.directionKeys());
        audioManager.play('menuClose');
        this.showHint(this.hintHere());
      },
      // This scene goes on running under it, so its own frame moves the view.
      { covers: (gamePixels) => this.panelLean.setCover(gamePixels), frame: () => undefined },
    );
  }

  /** Through a door: the same scene, started again inside the room behind it. */
  private enterRoom(door: BaseDoor): void {
    // Through a door is the yard's lesson done: the room's own hint takes over.
    this.learnKey('walk');
    // THE RAID ARENA's trailer plays on the way in (`cutscene/arenaIntro.ts`),
    // unasked the first time and with a SKIP after, and ends in its great hall.
    if (door.screen === 'arena') {
      this.openArenaIntro({ savedGame: this.savedGame, hall: { savedGame: this.savedGame, room: door.id } });
      return;
    }
    this.goTo({ savedGame: this.savedGame, room: door.id }, 'interiorEnter');
  }

  /**
   * A lie-down in the player's own bed: the screen goes dark for a moment, and
   * the bed's lines - the dream and the waking - are said as it comes back.
   * Nothing else happens, on purpose: healing is Nurse Joy's, priced in raid
   * time, and a free bed at home would price her at nothing.
   */
  private sleep(lines: readonly string[], about: readonly GridPosition[]): void {
    this.resting = true;
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    const camera = this.cameras.main;
    camera.fadeOut(SLEEP_FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.time.delayedCall(SLEEP_DARK_MS, () => {
        if (this.leaving) {
          return;
        }
        camera.fadeIn(SLEEP_FADE_MS, 0, 0, 0);
        this.resting = false;
        this.say(lines, about);
      });
    });
  }

  /** Onto a stair mat: the same scene, started again on the floor it leads to. */
  private climb(room: BaseRoom, to: string): void {
    this.goTo(
      { savedGame: this.savedGame, room: to, stairsFrom: room.id, ...(this.visit ? { visit: this.visit } : {}) },
      'interiorEnter',
    );
  }

  /**
   * Who lives here? Asked on the way into THE BOLTHOLE until it has an answer
   * (`home/houseName.ts`), over a house that stands still while it asks. A name
   * is welcomed home; going back outside instead is out of the door it came in.
   */
  private askHouseName(): void {
    const room = this.place.room?.room;
    if (!room || this.namePrompt) {
      return;
    }
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    this.namePrompt = openNameScreen(this, { where: 'house', service: nameService() }, (end) => {
      this.namePrompt = null;
      // The screen kept every key to itself, so a key the house saw go down
      // before it opened never came back up here.
      this.input.keyboard?.resetKeys();
      this.spentPresses.spendHeld(this.directionKeys());
      if (typeof end !== 'object') {
        this.leaveRoom(room);
        return;
      }
      const { name } = end;
      nameThisSitting = name;
      // Named, the player can be seen in the harbour from now on.
      harbour()?.stand(
        this.harbourWhere(),
        this.currentTile,
        this.facing,
        name,
        this.partner?.species ?? null,
        readLook(this.savedGame.raidProgress.look),
      );
      this.say(welcomeHomeLines(name), []);
    });
  }

  /** Where the shared harbour has the player: the yard, a keeper's room, or their own house. */
  private harbourWhere(): HarbourWhere {
    const room = this.place.room?.room;
    if (!room) {
      return 'yard';
    }
    if (this.visit) {
      return { visiting: this.visit.ownerId, upstairs: room.id === 'bolthole-upstairs' };
    }
    if (room.id === 'bolthole') {
      return 'home';
    }
    if (room.id === 'bolthole-upstairs') {
      return 'home-upstairs';
    }
    return (SHARED_HARBOUR_ROOMS as readonly string[]).includes(room.id)
      ? room.id
      : 'yard';
  }

  /** The other players drawn here, the tiles they stand on and the partner at their heel, for a playtest to read. */
  public get harbourFiguresShown(): readonly {
    readonly name: string;
    readonly tile: GridPosition;
    readonly partner: string | null;
    readonly waving: boolean;
    /** What they wear, as `lookKey` names it: `classic` for the figure everybody starts in. */
    readonly look: string;
    /** The words in their speech bubble, if any (`harbour/harbourPhrases.ts`). */
    readonly saying: string | null;
  }[] {
    if (!this.harbourFigures) {
      return [];
    }
    return (harbour()?.figuresHere() ?? []).map((figure) => ({
      name: figure.name,
      tile: { ...figure.tile },
      partner: figure.partner ?? null,
      waving: figure.waving === true,
      look: lookKey(figure.look ?? null),
      saying: figure.saying ?? null,
    }));
  }

  /** The harbour's regulars drawn here (`base/harbourRegulars.ts`), for a playtest to read. */
  public get harbourRegularsShown(): readonly {
    readonly name: string;
    readonly tile: GridPosition;
    readonly partner: string | null;
    readonly waving: boolean;
    /** What they are saying now: to the harbour at large, or back to this player (`base/harbourTalk.ts`). */
    readonly saying: string | null;
    /** What they are about (`base/harbourActivities.ts`). */
    readonly activity: string;
  }[] {
    const watcher = this.regularsWatcher();
    if (!this.harbourFigures || !watcher) {
      return [];
    }
    return (harbourRegulars()?.figures(watcher.place) ?? []).map((figure) => ({
      name: figure.name,
      tile: { ...figure.tile },
      partner: figure.partner ?? null,
      waving: figure.waving === true,
      saying: harbourTalk().saying(figure.id, this.frameTime) ?? figure.saying ?? null,
      activity: figure.activity,
    }));
  }

  /** What this player is saying, and whether the phrase list is open, for a playtest to read. */
  public get talking(): { readonly saying: string | null; readonly listOpen: boolean } {
    return { saying: harbourTalk().saying(OWN_SPEAKER, this.frameTime), listOpen: this.phrasePicker !== null };
  }

  /** Whether this player's own hand is up, for a playtest to read. */
  public get waving(): boolean {
    return this.ownWave !== null;
  }

  /** Where the partners at other players' heels are drawn, for a playtest to read. */
  public get harbourHeelsShown(): readonly Rect[] {
    return this.harbourFigures?.heelRects() ?? [];
  }

  // -- knocking --------------------------------------------------------------

  /**
   * The player's own front door (`harbour/houseDoor.ts`): told the player is
   * home once they are standing in their house and can be heard in the
   * harbour, told again whenever the furniture moves, and asked each frame
   * whether anybody is knocking - who is asked about once nothing else is on
   * the screen.
   */
  private watchFrontDoor(time: number): void {
    const houses = harbourHouses();
    if (!houses) {
      return;
    }
    houses.door.tick(time);
    const ownHome = this.place.room?.home && !this.visit;
    if (!ownHome || !harbour()?.seenAs) {
      return;
    }
    const layout = this.savedGame.raidProgress.homeLayout;
    if (!this.doorTold || this.doorLayout !== layout) {
      this.doorTold = true;
      this.doorLayout = layout;
      houses.door.inside(houseSnapshot(this.savedGame));
    }
    // A question about a knock that is no longer at the door - the knocker
    // stopped, or the minute ran out - is taken down rather than answered.
    if (this.knockPrompt && !houses.door.stillAtTheDoor(this.knockPrompt.knock.knockId)) {
      this.knockerWentAway(this.knockPrompt.knock);
    }
    const knock = houses.door.atTheDoor;
    if (
      knock &&
      !this.knockPrompt &&
      !this.knockScreen &&
      !this.namePrompt &&
      // Not held for decorating, which can go on for minutes: the knocker
      // was told nobody came while the owner was home and busy (playtest 49).
      // The question pauses the decorating, which carries on once it is answered.
      !this.resting &&
      !this.leaving &&
      !this.targetTile &&
      !this.dialogBox.visible
    ) {
      this.askToLetIn(knock);
    }
  }

  /** Somebody at the door: let them in, or not now - which is where the cursor starts. */
  private askToLetIn(knock: KnockAtTheDoor): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('menuOpen');
    this.knockPrompt = {
      knock,
      prompt: new ChoicePrompt(this, {
        x: Math.round((this.scale.width - DIALOG_WIDTH) / 2),
        y: this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
        width: DIALOG_WIDTH,
        height: DIALOG_HEIGHT,
        padding: 10,
        lines: [knockQuestion(knock.knockerName)],
        options: [LET_IN, NOT_NOW],
        selected: 1,
        onChoose: (index) => this.answerKnock(knock, index === 0),
      }),
    };
  }

  private handleKnockPromptInput(): void {
    const asking = this.knockPrompt;
    if (asking) {
      this.steerPrompt(asking.prompt, () => this.answerKnock(asking.knock, false));
    }
  }

  /** One frame of a question in the dialogue box: the cursor moves, the key answers, ESC says no. */
  private steerPrompt(prompt: ChoicePrompt, no: () => void): void {
    const pressed = (keys: readonly Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => this.keyPresses.justPressed(key));
    if (pressed([this.controls.left, this.controls.up, this.controls.a, this.controls.w])) {
      if (prompt.moveSelection(-1)) {
        audioManager.play('select');
      }
    } else if (pressed([this.controls.right, this.controls.down, this.controls.d, this.controls.s])) {
      if (prompt.moveSelection(1)) {
        audioManager.play('select');
      }
    } else if (pressed(this.controls.interact)) {
      prompt.confirm();
    } else if (pressed([this.controls.back])) {
      no();
    }
  }

  private answerKnock(knock: KnockAtTheDoor, letIn: boolean): void {
    this.knockPrompt?.prompt.destroy();
    this.knockPrompt = null;
    // The keys of the question were spent on it, not on a step.
    this.spentPresses.spendHeld(this.directionKeys());
    void harbourHouses()?.door.answer(knock.knockId, letIn);
    audioManager.play(letIn ? 'confirm' : 'cancel');
    this.say(
      [letIn ? `You open the door to ${knock.knockerName}.` : `You leave ${knock.knockerName} on the step.`],
      [],
      () => this.decor?.draw(),
    );
  }

  private knockerWentAway(knock: KnockAtTheDoor): void {
    this.knockPrompt?.prompt.destroy();
    this.knockPrompt = null;
    this.spentPresses.spendHeld(this.directionKeys());
    audioManager.play('cancel');
    this.say([knockGoneLine(knock.knockerName)], [], () => this.decor?.draw());
  }

  /**
   * THE BOLTHOLE's garden sign, read while the shared harbour is up: it asks
   * whose door to knock on in the ordinary text box, and once that is read the
   * list of players comes up (`ui/KnockOverlay.ts`). A player nobody can see
   * yet is told why nobody would answer instead.
   */
  private readKnockSign(sign: GridPosition): void {
    if (!harbour()?.seenAs) {
      this.say(['Nobody will answer a knock from somebody they cannot see. Give your house a name first.'], [sign]);
      return;
    }
    this.say([KNOCK_SIGN_LINE], [sign], () => this.openKnock());
  }

  /**
   * The knock screen (`ui/KnockOverlay.ts`), over a yard that stands still
   * while it is up. A yes is a walk through somebody else's front door; any
   * other ending is back where the player stood, facing the sign.
   */
  private openKnock(): void {
    const houses = harbourHouses();
    if (!houses || this.leaving) {
      return;
    }
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('menuOpen');
    this.knockScreen = openKnockScreen(
      this,
      houses.service,
      (owner, gone) => harbour()?.link.nudge(owner, gone),
      (letIn) => this.knocked(letIn),
    );
  }

  private knocked(letIn: LetIn | null): void {
    this.knockScreen = null;
    this.input.keyboard?.resetKeys();
    this.spentPresses.spendHeld(this.directionKeys());
    if (!letIn) {
      audioManager.play('menuClose');
      return;
    }
    const game = readHouseSnapshot(letIn.snapshot);
    if (!game) {
      this.say([`You couldn't see into ${letIn.ownerName}'s house. Try again in a moment.`], []);
      return;
    }
    this.goTo(
      { savedGame: this.savedGame, room: 'bolthole', visit: { ownerId: letIn.ownerId, ownerName: letIn.ownerName, game } },
      'interiorEnter',
    );
  }

  /** Down off the mat: back out into the yard, on the step outside. */
  private leaveRoom(room: BaseRoom): void {
    this.goTo({ savedGame: this.savedGame, from: room.id }, 'interiorLeave');
  }

  private goTo(data: BaseSceneData, sound: 'interiorEnter' | 'interiorLeave' | 'heal'): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.player.stop();
    this.showHint('');
    this.partner?.tuckIn();
    audioManager.play(sound);
    this.cameras.main.fadeOut(120, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('base', data),
    );
  }

  /**
   * The wall map, read on a screen. Backing out of it puts the player back on
   * the tile they read it from, facing it, rather than at the door.
   */
  private openWallMap(room: BaseRoom): void {
    this.openHub({ savedGame: this.savedGame, view: 'wallmap', from: room.id, at: { ...this.currentTile } });
  }

  /**
   * The console's GAMES menu, over the house rather than instead of it: the
   * house pauses where it stands and carries on from there when the player
   * comes back, facing the telly.
   */
  private openGames(): void {
    if (this.leaving) {
      return;
    }
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('menuOpen');
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      // The menu and the game kept every key to themselves, so a key the
      // house saw go down before it paused never came back up here.
      this.input.keyboard?.resetKeys();
      this.showHint(this.hintHere());
      // The console can change the player's name: the harbour hears it now,
      // not at the next door.
      harbour()?.stand(this.harbourWhere(), this.currentTile, this.facing, houseName(), this.partner?.species ?? null);
    });
    this.scene.pause();
    this.scene.launch('console', { pausedBase: true } satisfies ConsoleSceneData);
  }

  /** What a keeper or somebody about the harbour has to say about their favour, if anything (`hub/errands.ts`). */
  private favourHere(giver: ErrandGiver): ErrandBeat | undefined {
    const game = this.savedGame;
    return errandToSay(
      giver,
      game.raidProgress,
      (itemId) => game.stash.itemCount(itemId),
      raidsDeployed(game.raidProgress),
    );
  }

  /**
   * Speaking to a keeper, which is what the key on the door mat does: the talk
   * starts there, in the dialogue box over the room, the way anybody in the yard
   * is spoken to. Whatever they tell a newcomer first, then their favour - a
   * favour asked ends on its question with YES and NOT NOW under it - and then
   * what the key was pressed for: the board read out, the price of a heal, or
   * the screen of somebody who deals over a counter of numbers. ESC is past the
   * lot (`skipTalk`). Nothing is ever said over a screen.
   */
  private speakToKeeper(room: BaseRoom, screen: BaseScreen): void {
    const about = room.keeper ? [room.keeper.position] : [];
    const beat = this.favourHere(screen);
    const favourThen = (then: () => void): void => {
      if (beat) {
        this.sayFavour(beat, about, then, () => this.clearKeeperMark());
      } else {
        then();
      }
    };
    if (screen === 'lab') {
      this.sayFirstWords('lab', about, () =>
        favourThen(() =>
          this.oakGives(about, () => {
            this.readTheBoard(room, about, oakNews(this.savedGame, isPlaytestRun()));
          }),
        ),
      );
      return;
    }
    if (screen === 'stash') {
      this.sayFirstWords('center', about, () => favourThen(() => this.joyOffers(about)));
      return;
    }
    // The hall's marshal is `speakToMarshal`: everything in it is on the floor.
    if (screen !== 'arena') {
      favourThen(() => this.openScreen(room, screen));
    }
  }

  /** What this person tells a newcomer, the first time and never again; recorded as it is said. */
  private sayFirstWords(id: FirstWordsId, about: readonly GridPosition[], then: () => void): void {
    if (hasHeard(this.savedGame.raidProgress.firstWordsHeard, id)) {
      then();
      return;
    }
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.hearFirstWords(id);
    this.say(spokenLines(FIRST_WORDS[id], houseName()), about, then);
  }

  /**
   * Professor Oak looks at the Pokédex and hands over the next milestone's
   * reward, if one is due (`hub/pokedex.ts`). Written into the vault and recorded
   * in one save before he says a word, so it is given once however the room is
   * left; two crossed at once are said one after the other.
   */
  private oakGives(about: readonly GridPosition[], then: () => void, continuing = false): void {
    const progress = this.savedGame.raidProgress;
    if (!dueMilestone(pokedexOwned(progress.pokedexOwned, this.savedGame.stash).length, progress.pokedexRewards)) {
      then();
      return;
    }
    const given = this.saveManager.claimPokedexReward();
    if (!given) {
      then();
      return;
    }
    this.savedGame = this.saveManager.load() ?? this.savedGame;
    audioManager.play('itemObtained');
    this.say(milestoneWords(given.milestone, given.owned, continuing).lines, about, () =>
      this.oakGives(about, then, true),
    );
  }

  /**
   * The cork board, a notice a line (`base/labBoard.ts`): read off the wall, or
   * read out by Oak from the mat with whatever news he has first. Raiding with a
   * friend is the last thing pinned to it.
   */
  private readTheBoard(room: BaseRoom, about: readonly GridPosition[], news: readonly string[] = []): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.say([...news, ...boardLines(this.savedGame)], about, () => {
      if (!friendRoomsOffered()) {
        return;
      }
      const held = friendRoom()?.room;
      const at = { ...this.currentTile };
      this.askInBox(held ? `Your room ${held.code} is pinned up. Go and see to it?` : 'Going to raid with a friend?', (yes) => {
        if (yes) {
          this.openHub({ savedGame: this.savedGame, view: 'friend', from: room.id, at });
        }
      });
    });
  }

  /**
   * Nurse Joy at her counter (`hub/centerCounter.ts`): the price, and YES or NOT
   * NOW. Boxes are the PC's, over by the wall.
   */
  private joyOffers(about: readonly GridPosition[]): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.savedGame = this.saveManager.load() ?? this.savedGame;
    const free = isPlaytestRun();
    const offer = centerOffer(this.savedGame, free);
    const { question } = offer;
    if (question === undefined) {
      const swap = this.savedGame.stash.canSwapStarter() && raidsLost(this.savedGame.raidProgress) > 0;
      this.say([...offer.lines, ...(swap ? [SWAP_AT_THE_PC_LINE] : [])], about);
      return;
    }
    this.say(offer.lines, about, () =>
      this.askInBox(question, (yes) => {
        if (!yes) {
          audioManager.play('cancel');
          this.say([NOT_HEALED_LINE], about);
          return;
        }
        const outcome = this.saveManager.healAtCenter();
        const room = this.place.room?.room.id;
        if (!outcome || !room) {
          this.say(['I’m so sorry. Your game could not be saved, so nobody has been treated.'], about);
          return;
        }
        // The room is drawn again, without the Poké Balls waiting on her counter.
        this.goTo(
          {
            savedGame: this.saveManager.load() ?? this.savedGame,
            room,
            at: { ...this.currentTile },
            said: [healedLine(outcome.chargedMs, outcome.pendingRecoveryMs, free)],
          },
          'heal',
        );
      }),
    );
  }

  /**
   * The Day-Care Man at his fence (`hub/dayCare.ts`): somebody with nobody in
   * his care is asked in his own words and then chooses who from a short list;
   * somebody he is raising a Pokémon for is told how it has grown, and asked.
   */
  private speakToDayCareMan(at: GridPosition): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    const game = this.savedGame;
    const stay = game.stash.dayCare();
    if (!stay) {
      this.say(DAY_CARE_OFFER_LINES, [at], () =>
        this.openHub({ savedGame: this.savedGame, view: 'daycare', at: { ...this.currentTile } }),
      );
      return;
    }
    const report = dayCareReport(stay, raidsCompleted(game.raidProgress, game.raidInFlight));
    this.say(checkOnLines(report), [at], () =>
      this.askInBox(takeBackQuestion(stay.pokemon.name), (yes) => {
        if (!yes) {
          audioManager.play('cancel');
          this.say([NOT_TAKEN_BACK_LINE], [at]);
          return;
        }
        const taken = this.saveManager.takeBackFromDayCare();
        if (!taken) {
          this.say(['It could not be taken back: the game could not be saved.'], [at]);
          return;
        }
        audioManager.play('confirm');
        // The yard is drawn again, with nobody in the pen. A move it has no room
        // for is asked the next time a screen opens (`hub/pendingMoves.ts`).
        this.goTo(
          {
            savedGame: this.saveManager.load() ?? this.savedGame,
            at: { ...this.currentTile },
            said: takenBackReport(taken),
          },
          'interiorLeave',
        );
      }),
    );
  }

  /**
   * Somebody about the harbour, spoken to: if they have a favour to ask, a
   * thing to take or a loss to hear about, they turn and say it - the same
   * conversation a keeper has, with nothing to open after it. Says whether
   * they had anything to say about one.
   */
  private speakForFavour(person: HarbourPerson, at: GridPosition): boolean {
    const beat = this.favourHere(harbourGiver(person.id));
    if (!beat) {
      return false;
    }
    this.harbourLife?.face(person.id, directionBetween(at, this.currentTile) ?? 'down');
    this.sayFavour(beat, [at], () => undefined, () => this.clearHarbourMark(person.id));
    return true;
  }

  /**
   * A favour said in the dialogue box: asked, ending on its question; handed
   * over and paid for in one write before a word is said, so it is paid once
   * however the box is left; or a loss heard. `then` follows the last line,
   * and `answered` takes the "!" down once there is nothing more to say.
   */
  private sayFavour(
    beat: ErrandBeat,
    about: readonly GridPosition[],
    then: () => void,
    answered: () => void,
  ): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    const { errand } = beat;
    if (beat.kind === 'ask') {
      this.say(errandLines(beat), about, () => this.askFavour(errand, about, then, answered));
      return;
    }
    answered();
    if (beat.kind === 'thanks') {
      if (!this.saveManager.completeErrand(errand.id)) {
        then();
        return;
      }
      this.savedGame = this.saveManager.load() ?? this.savedGame;
      const lines = errandLines(beat);
      this.say(lines, about, then, (index) => {
        if (index === lines.length - 1) {
          audioManager.play('itemObtained');
        }
      });
      return;
    }
    this.saveManager.hearErrandLoss(errand.id);
    this.savedGame = this.saveManager.load() ?? this.savedGame;
    this.say(errandLines(beat), about, then);
  }

  /** A question in the dialogue box's own frame, with YES first as FireRed's box is; ESC is NOT NOW. */
  private askInBox(question: string, answer: (yes: boolean) => void): void {
    audioManager.play('menuOpen');
    this.showHint('');
    const answered = (yes: boolean): void => {
      this.boxQuestion?.prompt.destroy();
      this.boxQuestion = null;
      // The keys of the question were spent on it, not on a step.
      this.spentPresses.spendHeld(this.directionKeys());
      answer(yes);
    };
    this.boxQuestion = {
      answer: answered,
      prompt: new ChoicePrompt(this, {
        x: this.dialogBox.x,
        y: this.dialogBox.y,
        width: DIALOG_WIDTH,
        height: DIALOG_HEIGHT,
        padding: 10,
        lines: [question],
        options: FAVOUR_ANSWERS,
        selected: 0,
        onChoose: (index) => answered(index === 0),
      }),
    };
  }

  /** The favour's question, once what they had to say about it is read. */
  private askFavour(errand: Errand, about: readonly GridPosition[], then: () => void, answered: () => void): void {
    this.askInBox(errand.question, (yes) => this.answerFavour(errand, yes, about, then, answered));
  }

  /**
   * YES takes the favour - recorded at once, so it is laid on the next raid
   * however the room is left - and NOT NOW leaves it to be asked again after
   * the next raid. Either way the giver says one line about it.
   */
  private answerFavour(
    errand: Errand,
    yes: boolean,
    about: readonly GridPosition[],
    then: () => void,
    answered: () => void,
  ): void {
    answered();
    if (yes) {
      const progress = this.savedGame.raidProgress;
      this.savedGame = this.saveManager.askErrand(errand.id)
        ? (this.saveManager.load() ?? this.savedGame)
        : { ...this.savedGame, raidProgress: { ...progress, errands: withErrandAsked(progress.errands, errand.id) } };
      audioManager.play('confirm');
      this.say([errand.accepted], about, then);
      return;
    }
    declineErrand(errand.id, raidsDeployed(this.savedGame.raidProgress));
    audioManager.play('cancel');
    this.say([errand.declined], about, then);
  }

  /**
   * A "!" over the keeper while they have something to say about their favour,
   * as a FireRed trainer's mark goes up over somebody who wants a word. It is
   * the room's own say-so: the door's caption has already said it from the yard.
   */
  private markKeeper(room: BaseRoom): void {
    const keeper = room.keeper;
    // THE RAID ARENA's marshal has no favour to ask, only what the room is for.
    const wantsAWord =
      room.screen === 'arena'
        ? !hasHeard(this.savedGame.raidProgress.firstWordsHeard, 'loadout')
        : room.screen !== null && this.favourHere(room.screen) !== undefined;
    if (!keeper || !wantsAWord) {
      return;
    }
    const head = getCharacterDesign(keeper.design).headPixelY;
    this.keeperMark = drawEmoteBubble(this, 'exclaim').setPosition(
      Math.round(keeper.position.x * TILE_SIZE + TILE_SIZE / 2 - BUBBLE_WIDTH / 2),
      keeper.position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET + head - BUBBLE_HEIGHT,
    );
  }

  private clearKeeperMark(): void {
    this.keeperMark?.destroy();
    this.keeperMark = null;
  }

  /**
   * THE HARBOUR BOUTIQUE, or the wardrobe at home: a screen over the paused
   * harbour (`scenes/BoutiqueScene.ts`). Coming back, the player is redrawn
   * in whatever they walked out in.
   */
  private openBoutique(mode: BoutiqueSceneData['mode']): void {
    if (this.leaving) {
      return;
    }
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
    this.showHint('');
    audioManager.play('menuOpen');
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.input.keyboard?.resetKeys();
      this.savedGame = this.saveManager.load() ?? this.savedGame;
      this.dressPlayer();
      this.showHint(this.hintHere());
    });
    this.scene.pause();
    this.scene.launch('boutique', { mode, pausedBase: true } satisfies BoutiqueSceneData);
  }

  /** Draws the player in what the save says they wear. */
  private dressPlayer(): void {
    const texture = lookTexture(this, readLook(this.savedGame.raidProgress.look));
    if (texture === this.playerTexture) {
      return;
    }
    this.playerTexture = texture;
    this.player.setTexture(texture, getIdleFrame(this.facing));
    this.setPlayerPosition(this.player.x, this.player.y);
  }

  /**
   * The same "!" over everybody out in the harbour with something to say
   * about a favour, so a player walking the yard can see who wants a word
   * from across it. It walks their beat with them (`placeHarbourMarks`).
   */
  private markHarbourGivers(life: readonly HarbourFigure[]): void {
    for (const figure of life) {
      if (figure.kind === 'person' && this.favourHere(harbourGiver(figure.id))) {
        this.harbourMarks.set(figure.id, drawEmoteBubble(this, 'exclaim'));
      }
    }
    this.placeHarbourMarks();
  }

  private placeHarbourMarks(): void {
    for (const [id, mark] of this.harbourMarks) {
      const at = this.harbourLife?.spriteAt(id);
      const person = HARBOUR_PEOPLE.find((each) => each.id === id);
      if (!at || !person) {
        continue;
      }
      mark.setPosition(
        Math.round(at.x + TILE_SIZE / 2 - BUBBLE_WIDTH / 2),
        at.y + getCharacterDesign(person.design).headPixelY - BUBBLE_HEIGHT,
      );
    }
  }

  private clearHarbourMark(id: string): void {
    this.harbourMarks.get(id)?.destroy();
    this.harbourMarks.delete(id);
  }

  /** The keeper's screen, which is what the room is the way to. */
  private openScreen(room: BaseRoom, screen: ScreenOpened | 'boutique'): void {
    if (screen === 'boutique') {
      this.openBoutique('shop');
      return;
    }
    this.openHub({ savedGame: this.savedGame, view: SCREEN_VIEWS[screen], from: room.id });
  }

  /** Writes down that these first words have been said, in storage and in this scene's copy of the game. */
  private hearFirstWords(id: FirstWordsId): void {
    this.saveManager.hearFirstWords(id);
    const { raidProgress } = this.savedGame;
    this.savedGame = {
      ...this.savedGame,
      raidProgress: { ...raidProgress, firstWordsHeard: [...(raidProgress.firstWordsHeard ?? []), id] },
    };
  }

  /** Into THE RAID ARENA: its trailer, which hands over to the great hall. */
  private openArenaIntro(payload: ArenaIntroSceneData): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.player.stop();
    this.showHint('');
    audioManager.play('interiorEnter');
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('arenaIntro', payload),
    );
  }

  private openHub(payload: HubSceneData): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.player.stop();
    this.showHint('');
    audioManager.play('menuOpen');
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('hub', payload),
    );
  }
}

/** How far a station's art rises above its own row: where its caption has to clear. */
const STATION_RISE = 16;
/** How many steps off a station still names itself. */
const STATION_NAMED_WITHIN = 3;

/** The stretch of rim straight in from the door, for a raid come home that this page did not see leave. */
function rimAboveTheDoor(): GridPosition {
  const straightUp = ARENA_RIM.filter((tile) => tile.x === ARENA_MAT.x);
  return straightUp.reduce((nearest, tile) => (tile.y > nearest.y ? tile : nearest), straightUp[0]);
}

/** Whether a point of the hall is inside the fence. */
function insideThePit(x: number, y: number): boolean {
  return acrossOval(PIT_RIM, x, y) < 1;
}

/** Named clear of a box with more to come. */
const TALK_SKIP_HINT = '[ESC] SKIP';

/**
 * The name given at THE BOLTHOLE's door, for this sitting. It is kept on the
 * device (`console/playerName.ts`), and this is only what a browser that
 * cannot store anything still knows: without it, every stair climbed would
 * ask the name again.
 */
let nameThisSitting: string | null = null;

/** The name the house goes by: the device's, else this sitting's. */
function houseName(): string | null {
  return loadPlayerName() ?? nameThisSitting;
}

/** How often the Pokemon in the Day-Care's pen thinks about taking a step, and how much that wanders. */
const PEN_STEP_EVERY_MS = 1800;
const PEN_STEP_SPREAD_MS = 2400;

/** How long the screen takes to go dark for a sleep, and how long it stays dark. */
const SLEEP_FADE_MS = 450;
const SLEEP_DARK_MS = 600;

/** The keepers who deal over a screen. Oak and Joy say what they have in the room's own box. */
type ScreenOpened = Exclude<BaseScreen, 'boutique' | 'arena' | 'lab' | 'stash'>;

/** Which screen those doors open, as `HubScene` names its views. */
const SCREEN_VIEWS = {
  workshop: 'workshop',
  trader: 'trader',
} as const satisfies Record<ScreenOpened, NonNullable<HubSceneData['view']>>;
