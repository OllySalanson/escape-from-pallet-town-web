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
import { audioManager } from '../audio/AudioManager';
import { nextBump } from '../audio/worldSounds';
import { SpentPresses } from '../world/spentPresses';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
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
import type { MapLayers } from '../world/tiles';
import {
  BASE_LANDING,
  BASE_PLACE_NAME,
  BASE_SPAWN,
  getBaseMap,
} from '../base/baseMap';
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
  type BaseRoom,
  type BuiltRoom,
  type RoomSprite,
  type RoomThing,
} from '../base/rooms';
import { standingFixtures, type BaseFixture } from '../base/fixtures';
import type { HubSceneData } from './HubScene';

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
const DOOR_TONE: WorldLabelTone = { fill: 0x3a2408, border: 0xf1bf63, ink: '#fef3c7' };
const FIXTURE_TONE: WorldLabelTone = { fill: 0x16222c, border: 0x6f97b4, ink: '#c6dced' };

export interface BaseSceneData {
  readonly savedGame?: RestoredGame;
  /** The door the player is coming back out of, into the yard. */
  readonly from?: string;
  /** The room the player is in: walked into, or backed out of a screen into. */
  readonly room?: string;
  /** Set by the result screen: a raid puts the player down on the quay. */
  readonly arrival?: 'raid';
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
  /**
   * False until `create` has finished building this visit. Phaser keeps one
   * instance per scene key and runs `update` whatever `create` decided, so a
   * visit that handed straight back to the title screen would otherwise walk
   * the previous visit's map.
   */
  private ready = false;
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();

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

  public create(data: BaseSceneData = {}): void {
    this.ready = false;
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
    this.targetTile = null;
    this.stepCarryMs = null;
    this.pushingAgainst = null;
    this.lookMs = 0;
    this.hintShown = '';
    this.figures.clear();
    this.worldLabels = [];

    const room = data.room === undefined ? undefined : roomNamed(data.room);
    if (room) {
      const built = buildRoom(room, loaded);
      this.place = {
        width: room.width,
        height: room.height,
        layers: built.layers,
        collision: built.collision,
        sources: [BASE_SHEET_SOURCE.source],
        room: built,
      };
      this.fixtures = [];
      // In through the door, onto the mat, facing the keeper.
      this.currentTile = { ...room.mat };
      this.facing = 'up';
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
      this.currentTile = returning
        ? { ...returning.returnTo }
        : data.arrival === 'raid'
          ? { ...BASE_LANDING }
          : { ...BASE_SPAWN };
      this.facing = returning ? 'down' : 'up';
    }
    this.bounds = { width: this.place.width, height: this.place.height };
    this.collision = this.place.collision.map((row) => [...row]);

    this.drawMap();
    this.drawSprites();
    this.createFigures();
    this.createPlayer();
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, relayout),
    );
    this.cameras.main.fadeIn(160, 0, 0, 0);
    this.ready = true;
  }

  public update(_time: number, deltaMs: number): void {
    if (!this.ready) {
      return;
    }
    const stepCarryMs = this.stepCarryMs;
    this.stepCarryMs = null;
    this.lookMs = advanceLookMs(
      this.lookMs,
      this.keyPresses.justPressed(this.controls.look),
      deltaMs,
    );
    this.containWorldLabels();
    this.dialogBox.update(deltaMs);

    if (this.leaving) {
      return;
    }

    if (this.dialogBox.visible) {
      this.showHint('');
      this.handleDialogInput();
      return;
    }

    if (this.targetTile) {
      this.advanceStep(deltaMs);
      return;
    }

    this.showHint(this.hintHere());

    if (this.isInteractionPressed()) {
      this.tryInteract();
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
    const pushing = input.up || input.down || input.left || input.right;
    const bump = nextBump(this.pushingAgainst, !decision.target && pushing ? decision.facing : null);
    this.pushingAgainst = bump.pushingAgainst;
    if (bump.thud) {
      audioManager.play('bump');
    }
    this.facing = decision.facing;

    if (decision.target) {
      this.beginStep(decision.target);
      if (stepCarryMs !== null) {
        this.advanceStep(deltaMs + stepCarryMs);
      }
      return;
    }

    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }

  // -- the map ---------------------------------------------------------------

  private drawMap(): void {
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
    const { ground, overlay, detail, canopy } = this.place.layers;
    for (const [name, layer, depth] of [
      ['base-ground', ground, atRow(TERRAIN_DEPTH, 0)],
      ['base-overlay', overlay, atRow(TERRAIN_DEPTH, 1)],
      ['base-detail', detail, atRow(TERRAIN_DEPTH, 2)],
      ['base-canopy', canopy, CANOPY_BAND],
    ] as const) {
      this.createTileLayer(map, sheets, name, layer, depth);
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
   * Joy's counter, and whatever Bill's shelves come to hold. Each is a frame
   * of the base's own sheet, named by the piece it is.
   */
  private drawSprites(): void {
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

  /** The keeper of the room the player is in. The yard has nobody standing in it. */
  private createFigures(): void {
    const room = this.place.room?.room;
    if (!room) {
      return;
    }
    const { keeper } = room;
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
          text: `${door.name}\n${doorStatusLine(door, this.savedGame)}`,
          tone: DOOR_TONE,
          depth: atRow(CAPTION_BAND, door.tiles[0].y),
          speech: { voice: 'name', tiles: door.tiles },
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
    const door = doorNamed(room.id);
    const status = door ? doorStatusLine(door, this.savedGame) : '';
    this.worldLabels.push(
      new WorldLabel(this, {
        subject: figureRect(room.keeper.position),
        text: status ? `${room.keeper.name}\n${status}` : room.keeper.name,
        tone: DOOR_TONE,
        depth: atRow(CAPTION_BAND, room.keeper.position.y),
        // Said as the player walks up, not from the mat: the hint line already
        // names the keeper there, and a caption said from the door sits over
        // the very room the player has walked in to look at.
        speech: { voice: 'name', tiles: [room.keeper.position], near: 2 },
      }),
    );
    for (const thing of built.things) {
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
    if (!room) {
      return '';
    }
    const keeper = `[SPACE] ${room.keeper.name}`;
    if (this.onMat(room)) {
      return `${keeper}   [DOWN] OUT`;
    }
    return servesFrom(room, nextTileFromDirection(this.currentTile, this.facing)) ? keeper : '';
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
    const audience = {
      player: this.currentTile,
      looking: isLooking(this.lookMs, this.controls.look.isDown),
      raidRemainingMs: Number.POSITIVE_INFINITY,
    };
    this.worldLabels.forEach((label) => label.describe(audience));
    const view = this.cameras.main.worldView;
    const bounds: Rect = { x: view.left, y: view.top, width: view.width, height: view.height };
    const room = this.place.room?.room;
    const placements = placeCaptions(
      this.worldLabels.map((label) => label.request()),
      {
        bounds,
        furniture: this.hintShown ? [this.hintRect(view)] : [],
        keepClear: room ? [figureRect(room.keeper.position)] : [],
        canopy: this.canopyInView(bounds),
        player: [figureRect(this.currentTile), figureRect(this.targetTile ?? this.currentTile)],
      },
    );
    this.worldLabels.forEach((label, index) => label.seat(placements[index]));
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

  /** Every crown in view, as one rectangle a row: writing may not sit under one. */
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
      look: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      run: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false),
      interact: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ],
    };
    this.latchDirectionPresses();
    this.keyPresses.watch([...this.directionKeys(), ...this.controls.interact, this.controls.look]);
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
    const keeper = this.place.room?.room.keeper.position;
    return (
      (this.collision[tile.y]?.[tile.x] ?? true) ||
      (keeper !== undefined && keeper.x === tile.x && keeper.y === tile.y)
    );
  }

  private onMat(room: BaseRoom): boolean {
    return this.currentTile.x === room.mat.x && this.currentTile.y === room.mat.y;
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
    if (this.place.room) {
      return;
    }
    const door = doorAt(this.currentTile);
    if (door) {
      this.enterRoom(door);
    }
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
  private tryInteract(): void {
    const target = nextTileFromDirection(this.currentTile, this.facing);
    const room = this.place.room?.room;
    if (room) {
      if (this.onMat(room) || servesFrom(room, target)) {
        this.openScreen(room);
        return;
      }
      const thing = this.place.room?.things.find((candidate: RoomThing) =>
        candidate.tiles.some((tile) => tile.x === target.x && tile.y === target.y),
      );
      if (thing) {
        this.say([`${thing.name} - ${thing.note.toLowerCase()}.`], [target]);
      }
      return;
    }
    const door = doorAt(target);
    if (door) {
      this.enterRoom(door);
      return;
    }
    const fixture = this.fixtures.find(
      (standing) => standing.at.x === target.x && standing.at.y === target.y,
    );
    if (fixture) {
      this.say([`${fixture.name} - ${fixture.note.toLowerCase()}.`], [target]);
      return;
    }
    if (target.x === NOTICE_BOARD.x && target.y === NOTICE_BOARD.y) {
      this.say(NOTICE_BOARD.lines, [target]);
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
    this.goTo({ savedGame: this.savedGame, room: door.id }, 'interiorEnter');
  }

  /** Down off the mat: back out into the yard, on the step outside. */
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
    audioManager.play(sound);
    this.cameras.main.fadeOut(120, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('base', data),
    );
  }

  /** The keeper's screen, which is what the room is the way to. */
  private openScreen(room: BaseRoom): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.player.stop();
    this.showHint('');
    audioManager.play('menuOpen');
    const payload: HubSceneData = {
      savedGame: this.savedGame,
      view: SCREEN_VIEWS[room.screen],
      from: room.id,
    };
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('hub', payload),
    );
  }
}

/**
 * The harbour's own board, on the quay where the boat ties up, because that is
 * where a player who has just come home is standing.
 */
const NOTICE_BOARD = {
  x: 14,
  y: 15,
  lines: [
    `${BASE_PLACE_NAME.toUpperCase()} - what the raids are run out of.`,
    'OAK kits you out. JOY patches the team up. BROCK builds onto the base, and BILL takes what you drag home.',
  ],
} as const;

/** Which screen each room's keeper opens, as `HubScene` names its views. */
const SCREEN_VIEWS = {
  raid: 'home',
  stash: 'stash',
  workshop: 'workshop',
  trader: 'trader',
} as const satisfies Record<BaseRoom['screen'], NonNullable<HubSceneData['view']>>;
