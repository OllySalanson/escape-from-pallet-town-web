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
import { isPlaytestRun, PLAYTEST_RUN_DIVISOR } from '../dev/playtestMode';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_HEAD_PIXEL_Y,
  getIdleFrame,
  getWalkAnimationKey,
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
import { TILE_SIZE, type TileLayer } from '../worldMap';
import { DialogBox } from '../ui/DialogBox';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { audioManager } from '../audio/AudioManager';
import { nextBump } from '../audio/worldSounds';
import { SpentPresses } from '../world/spentPresses';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import {
  HOME_KEY_LETTERS,
  RAID_KEY_LETTERS,
  houseKeyHintLine,
  yardKeyHintLine,
  type LearnableKeyId,
} from '../input/keyBindings';
import { WorldLabel, type WorldLabelTone } from '../ui/WorldLabel';
import { placeCaptions, placeDialog, type Rect } from '../ui/labelPlacement';
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
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from '../base/baseMap';
import { BASE_TILESET, type BasePropName } from '../base/baseTileset';
import { BASE_DOORS, doorAt, doorNamed, type BaseDoor } from '../base/doors';
import { doorStatusLine } from '../base/doorStatus';
import { BASE_SHEET_SOURCE } from '../base/baseSheet';
import { BASE_PIECES } from '../base/generated/basePieces';
import {
  BASE_ROOMS,
  buildRoom,
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
  partnerOf,
  partnerReaction,
  turnToPartner,
  type PartnerEmote,
  type PartnerPlaceName,
} from '../base/partner';
import { PartnerFigure, type PartnerHost } from '../base/partnerFigure';
import { DAY_CARE_KEEPER, PEN_HOME, nextPenTile } from '../base/dayCarePen';
import { dayCareStatusLine, raidsCompleted } from '../hub/dayCare';
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
import { abandonedRaidLines, raidHeartbeat } from '../run/raidInFlight';
import { ownedFurniture, type Placement } from '../home/arrangement';
import { DecorateMode, type DecorateHost } from '../base/decorateMode';
import { loadPlayerName } from '../console/playerName';
import { houseNameNeeded, welcomeHomeLines } from '../home/houseName';
import { openHouseNameScreen } from '../ui/HouseNameOverlay';
import { harbour, type HarbourWhere } from '../harbour/harbour';
import { SHARED_HARBOUR_ROOMS } from '../harbour/harbourProtocol';
import { HarbourFigures } from '../base/harbourFigures';
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
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;
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

/**
 * The rectangle a planted landmark covers, read off the art rather than typed.
 * `frontageRows` takes only that many rows off the bottom of it.
 */
const propsRect = (
  props: readonly { name: BasePropName; x: number; y: number }[],
  frontageRows?: number,
): Rect => {
  const boxes = props.map((prop) => {
    const art = BASE_TILESET.props[prop.name];
    return { x: prop.x, y: prop.y, right: prop.x + art.width, bottom: prop.y + art.height };
  });
  return boxRect(boxes, frontageRows);
};

const tilesRect = (tiles: readonly GridPosition[]): Rect =>
  boxRect(tiles.map((tile) => ({ x: tile.x, y: tile.y, right: tile.x + 1, bottom: tile.y + 1 })));

function boxRect(
  boxes: readonly { x: number; y: number; right: number; bottom: number }[],
  frontageRows?: number,
): Rect {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  const from = frontageRows === undefined ? top : Math.max(top, bottom - frontageRows);
  return {
    x: left * TILE_SIZE,
    y: from * TILE_SIZE,
    width: (right - left) * TILE_SIZE,
    height: (bottom - from) * TILE_SIZE,
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
const FIXTURE_TONE: WorldLabelTone = { fill: 0x16222c, border: 0x6f97b4, ink: '#c6dced' };
/** The label on the one oddity being looked at: brass, like the case it is in. */
const ODDITY_TONE: WorldLabelTone = { fill: 0x2b1d0e, border: 0xd8b070, ink: '#f4efe2' };
/** The frame round the oddity being looked at. */
const ODDITY_MARK = 0xf7d36b;

export interface BaseSceneData {
  readonly savedGame?: RestoredGame;
  /** The door the player is coming back out of, into the yard. */
  readonly from?: string;
  /** The room the player is in: walked into, or backed out of a screen into. */
  readonly room?: string;
  /** Set by the result screen: a raid puts the player down on the quay. */
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
  /** THE BOLTHOLE's keys (`HOME_KEY_LETTERS`): decorating, and what it is done with. */
  readonly decorate: Phaser.Input.Keyboard.Key;
  readonly turn: Phaser.Input.Keyboard.Key;
  readonly boxBack: Phaser.Input.Keyboard.Key;
  readonly boxNext: Phaser.Input.Keyboard.Key;
  readonly putAway: Phaser.Input.Keyboard.Key;
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

    const room = data.room === undefined ? undefined : roomNamed(data.room);
    if (room) {
      const built = buildRoom(room, loaded);
      this.place = {
        width: room.width,
        height: room.height,
        layers: built.layers,
        collision: built.collision,
        sources: built.sources,
        room: built,
      };
      this.fixtures = [];
      // In through the door, onto the mat, facing the keeper - or back where
      // they were standing, if a screen opened from inside the room is what
      // they have just backed out of - or on the stair mat they have just
      // climbed to, facing away from the stairs.
      const climbedTo =
        data.stairsFrom === undefined ? undefined : stairArrival(data.stairsFrom as BaseRoom['id'], room);
      const standing =
        data.at !== undefined && built.collision[data.at.y]?.[data.at.x] === false
          ? data.at
          : (climbedTo ?? room.mat ?? room.stairs[0]?.tile ?? { x: 0, y: room.height - 1 });
      this.currentTile = { ...standing };
      this.facing = climbedTo ? 'down' : 'up';
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
      const returning = data.from === undefined ? undefined : doorNamed(data.from);
      // Backing out of the Day-Care's screen stands the player back where they
      // spoke to him, still facing him.
      const standing =
        data.at !== undefined && map.collision[data.at.y]?.[data.at.x] === false ? data.at : undefined;
      this.currentTile = standing
        ? { ...standing }
        : returning
          ? { ...returning.returnTo }
          : data.arrival === 'raid'
            ? { ...BASE_LANDING }
            : { ...BASE_SPAWN };
      this.facing = standing
        ? (directionBetween(standing, DAY_CARE_KEEPER.position) ?? 'up')
        : returning
          ? 'down'
          : 'up';
    }
    this.bounds = { width: this.place.width, height: this.place.height };
    this.collision = this.place.collision.map((row) => [...row]);

    this.drawMap();
    this.drawSprites();
    this.drawFurniture();
    this.drawOddities();
    this.drawWallMap();
    this.createFigures();
    this.createPlayer();
    this.harbourFigures = new HarbourFigures(this);
    harbour()?.stand(this.harbourWhere(), this.currentTile, this.facing, houseName());
    this.createPartner(data);
    this.createCaptions();
    this.createDialogBox();
    this.createHint();
    this.bindControls();
    // A direction still held from the step that came through the door is not
    // a step in here: it has to be let go and pressed again. That is what
    // stops the key that walked in off the mat walking straight back out.
    this.spentPresses.spendHeld(this.directionKeys());
    this.configureCamera();
    // The dialogue box and the hint are anchored to the screen, and the camera
    // centres a small room in it, so a resized window re-does both.
    const relayout = (): void => this.layoutForStage();
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    });
    this.cameras.main.fadeIn(160, 0, 0, 0);
    this.ready = true;
    if (abandoned) {
      this.say(abandonedRaidLines(abandoned), []);
    }
    if (this.place.room?.home && houseNameNeeded(houseName())) {
      this.askHouseName();
    }
  }

  public update(time: number, deltaMs: number): void {
    if (!this.ready) {
      return;
    }
    const shared = harbour();
    if (shared) {
      shared.tick(time, deltaMs);
      this.harbourFigures?.update(shared.figuresHere());
    }
    this.updateWalking(deltaMs);
    this.partner?.update(deltaMs);
    this.wanderPen(deltaMs);
  }

  private updateWalking(deltaMs: number): void {
    const stepCarryMs = this.stepCarryMs;
    this.stepCarryMs = null;
    const looked = this.keyPresses.justPressed(this.controls.look);
    if (looked) {
      this.learnKey('look');
    }
    this.lookMs = advanceLookMs(this.lookMs, looked, deltaMs);
    this.containWorldLabels();
    this.dialogBox.update(deltaMs);

    if (this.leaving || this.resting || this.namePrompt) {
      return;
    }

    if (this.dialogBox.visible) {
      this.showHint('');
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

    if (this.keyPresses.justPressed(this.controls.decorate) && this.place.room?.home) {
      this.startDecorating();
      return;
    }

    const input = this.readInput();
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

  private drawMap(): void {
    this.tilemap?.destroy();
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
    });
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
    // The other pictures of the save a room keeps wall for: THE BOLTHOLE's
    // badge case and its pennants, painted fresh on every visit for the same
    // reason the wall map is.
    for (const poster of this.place.room?.posters ?? []) {
      const picture =
        poster.kind === 'badge-case'
          ? badgeCasePoster(this.savedGame, poster.area)
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
    this.player = this.add
      .sprite(0, 0, SHARED_CHARACTER_TEXTURE, getIdleFrame(this.facing))
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
    this.playerHeadMark.setPosition(x, y);
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
       * Seated against the building's **frontage** - its bottom row - rather
       * than against its doorway or its whole footprint, and both of those
       * were tried first.
       *
       * Against the doorway the caption sat squarely over the building it was
       * naming. Against the whole footprint it could not sit anywhere near it:
       * a caption is about eight tiles wide, these buildings stand two tiles
       * apart, and the player is always in the row under the door they are
       * walking to - so every ordinary seat was taken and the lab ended up
       * captioned four rows away, down on the quay.
       *
       * The frontage is the answer to both. The caption seats above it, which
       * is over the lower wall of the building and unmistakably that
       * building's, and the roof and the door are both still on screen.
       */
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: propsRect(
            [{ ...door.building, name: door.building.prop }],
            // A building three rows tall is all frontage: seated against its
            // bottom row, the caption covered the whole of Bill's cottage.
            BASE_TILESET.props[door.building.prop].height > 3 ? 1 : undefined,
          ),
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
    for (const thing of built.things.filter((each) => !each.quiet)) {
      this.worldLabels.push(
        new WorldLabel(this, {
          subject: tilesRect(thing.tiles),
          text: `${thing.name}\n${thing.note}`,
          tone: FIXTURE_TONE,
          depth: atRow(CAPTION_BAND, Math.max(...thing.tiles.map((tile) => tile.y))),
          speech: { voice: 'name', tiles: thing.tiles, near: 1 },
        }),
      );
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
    if (!room) {
      // Nothing else to say in the yard: the keys this save has not used yet
      // (`input/keyBindings.ts`). A newcomer arrives here first, and the first
      // control hint used to be inside Oak's Lab (playtest 43).
      if (!partner && sameTile(facing, DAY_CARE_KEEPER.position)) {
        return `[SPACE] ${DAY_CARE_KEEPER.name}`;
      }
      return partner ?? yardKeyHintLine(new Set(this.savedGame.raidProgress.keysLearned ?? []));
    }
    const keeper = room.keeper ? `[SPACE] ${room.keeper.name}` : '';
    if (this.onMat(room)) {
      // The player's own house has nobody to speak to from the mat.
      const speak = partner ?? keeper;
      return speak ? `${speak}   [DOWN] OUT` : '[DOWN] OUT';
    }
    if (partner) {
      return partner;
    }
    if (servesFrom(room, facing)) {
      return keeper;
    }
    // Something in the room that opens a screen says so where it can be
    // opened from, exactly as the keeper does: a board on a wall that answers
    // a key nobody was told about is a board nobody reads.
    const faced = this.thingFaced(facing);
    if (faced?.opens) {
      return `[SPACE] ${faced.name}`;
    }
    // The cabinet is looked into rather than read off, so it says it can be.
    const unit = faced?.cabinetUnit;
    if (unit !== undefined && this.oddityToStartAt(facing, unit) !== undefined) {
      return '[SPACE] LOOK CLOSER';
    }
    // The player's own house says it can be decorated, until it has been.
    return this.place.room?.home ? houseKeyHintLine(new Set(this.savedGame.raidProgress.keysLearned ?? [])) : '';
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

  private showHint(text: string): void {
    if (text === this.hintShown) {
      return;
    }
    this.hintShown = text;
    this.hintFrame.clear();
    this.hintText.setText(text).setVisible(text !== '');
    if (text === '') {
      return;
    }
    const width = Math.ceil(this.hintText.width) + HINT_PADDING_X * 2;
    const height = Math.ceil(this.hintText.height) + HINT_PADDING_Y * 2;
    const x = Math.round((this.scale.width - width) / 2);
    const y = this.scale.height - height - HINT_MARGIN;
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
    this.showHint(hint);
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
    camera.setBounds(left, top, Math.max(width, viewWidth), Math.max(height, viewHeight));
    camera.setZoom(CAMERA_ZOOM);
    camera.setRoundPixels(true);
    camera.startFollow(this.player, true);
  }

  private containWorldLabels(): void {
    if (this.worldLabels.length === 0) {
      return;
    }
    // Decorating is looking at the room itself: no caption over it.
    if (this.decor) {
      this.worldLabels.forEach((label) => label.hide());
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
          ...(this.dialogBox.visible
            ? [{ x: this.dialogBox.x + view.left, y: this.dialogBox.y + view.top, width: DIALOG_WIDTH, height: DIALOG_HEIGHT }]
            : []),
        ],
        keepClear: [
          ...(room?.keeper ? [figureRect(room.keeper.position)] : []),
          ...(room ? [] : [figureRect(DAY_CARE_KEEPER.position)]),
          ...(this.penPokemon ? [figureRect(this.penPokemon.tile)] : []),
          ...(this.partner?.place.out ? [this.partner.rect()] : []),
          // A piece of furniture is drawn among the figures, over any caption under it.
          ...(this.place.room?.home?.placed ?? [])
            .filter((piece) => piece.definition.layer !== 'floor')
            .map(furnitureRect),
        ],
        canopy: this.canopyInView(bounds),
        player: [figureRect(this.currentTile), figureRect(this.targetTile ?? this.currentTile)],
      },
    );
    labels.forEach((label, index) => label.seat(placements[index]));
  }

  /** Where the hint line is, in the world, so no caption is seated under it. */
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
      decorate: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.decorate], false),
      turn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.turn], false),
      boxBack: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.boxBack], false),
      boxNext: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.boxNext], false),
      putAway: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[HOME_KEY_LETTERS.putAway], false),
    };
    this.latchDirectionPresses();
    this.keyPresses.watch([
      ...this.directionKeys(),
      ...this.controls.interact,
      this.controls.look,
      this.controls.back,
      this.controls.decorate,
      this.controls.turn,
      this.controls.boxBack,
      this.controls.boxNext,
      this.controls.putAway,
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
      (keeper !== undefined && keeper.x === tile.x && keeper.y === tile.y)
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
    this.player.play(getWalkAnimationKey(this.facing), true);
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
      if (room.screen && (this.onMat(room) || servesFrom(room, target))) {
        this.openScreen(room, room.screen);
        return;
      }
      const thing = this.thingFaced(target);
      const cabinet = this.place.room?.cabinet;
      if (thing?.opens === 'wall-map') {
        this.openWallMap(room);
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
      if (thing?.does === 'sleep') {
        this.sleep(thing.lines ?? [], [target]);
        return;
      }
      if (thing?.opens === 'games') {
        this.openGames();
        return;
      }
      if (thing) {
        this.say(thing.lines ?? [`${thing.name} - ${thing.note.toLowerCase()}.`], [target]);
      }
      return;
    }
    const door = doorAt(target);
    if (door) {
      this.enterRoom(door);
      return;
    }
    if (sameTile(target, DAY_CARE_KEEPER.position)) {
      this.openHub({ savedGame: this.savedGame, view: 'daycare', at: { ...this.currentTile } });
      return;
    }
    const fixture = this.fixtures.find(
      (standing) => standing.at.x === target.x && standing.at.y === target.y,
    );
    if (fixture) {
      this.say([`${fixture.name} - ${fixture.note.toLowerCase()}.`], [target]);
      return;
    }
    const sign = BASE_SIGNS.find((each) => each.x === target.x && each.y === target.y);
    if (sign) {
      this.say(sign.lines, [target]);
    }
  }

  /**
   * The same two-beat rule the raid's dialogue has: the first press finishes
   * the line being typed, the second moves on. The press that answers a box is
   * spent on answering it, so a direction key still held when it closes does
   * not also walk a tile.
   */
  private handleDialogInput(): void {
    if (!this.isInteractionPressed()) {
      return;
    }
    this.spentPresses.spendHeld(this.directionKeys());
    if (this.dialogBox.isCurrentMessageComplete) {
      audioManager.play('textAdvance');
      this.dialogBox.advance();
      return;
    }
    this.dialogBox.skip();
  }

  private say(lines: readonly string[], about: readonly GridPosition[]): void {
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
    this.dialogBox.showMessages([...lines]);
  }

  /** Through a door: the same scene, started again inside the room behind it. */
  private enterRoom(door: BaseDoor): void {
    // Through a door is the yard's lesson done: the room's own hint takes over.
    this.learnKey('walk');
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
    this.goTo({ savedGame: this.savedGame, room: to, stairsFrom: room.id }, 'interiorEnter');
  }

  /** Down off the mat: back out into the yard, on the step outside. */
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
    this.namePrompt = openHouseNameScreen(this, (name) => {
      this.namePrompt = null;
      // The screen kept every key to itself, so a key the house saw go down
      // before it opened never came back up here.
      this.input.keyboard?.resetKeys();
      this.spentPresses.spendHeld(this.directionKeys());
      if (name === null) {
        this.leaveRoom(room);
        return;
      }
      nameThisSitting = name;
      // Named, the player can be seen in the harbour from now on.
      harbour()?.stand(this.harbourWhere(), this.currentTile, this.facing, name);
      this.say(welcomeHomeLines(name), []);
    });
  }

  /** Where the shared harbour has the player: the yard, a keeper's room, or their own house. */
  private harbourWhere(): HarbourWhere {
    const room = this.place.room?.room;
    if (!room) {
      return 'yard';
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

  /** The other players drawn here and the tiles they stand on, for a playtest to read. */
  public get harbourFiguresShown(): readonly { readonly name: string; readonly tile: GridPosition }[] {
    if (!this.harbourFigures) {
      return [];
    }
    return (harbour()?.figuresHere() ?? []).map((figure) => ({ name: figure.name, tile: { ...figure.tile } }));
  }

  private leaveRoom(room: BaseRoom): void {
    this.goTo({ savedGame: this.savedGame, from: room.id }, 'interiorLeave');
  }

  private goTo(data: BaseSceneData, sound: 'interiorEnter' | 'interiorLeave'): void {
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
    });
    this.scene.pause();
    this.scene.launch('console', { pausedBase: true } satisfies ConsoleSceneData);
  }

  /** The keeper's screen, which is what the room is the way to. */
  private openScreen(room: BaseRoom, screen: NonNullable<BaseRoom['screen']>): void {
    this.openHub({ savedGame: this.savedGame, view: SCREEN_VIEWS[screen], from: room.id });
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

/** Which screen each room's keeper opens, as `HubScene` names its views. */
const SCREEN_VIEWS = {
  raid: 'home',
  stash: 'stash',
  workshop: 'workshop',
  trader: 'trader',
} as const satisfies Record<NonNullable<BaseRoom['screen']>, NonNullable<HubSceneData['view']>>;
