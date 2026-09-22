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
import { WINDOW_CREAM } from '../ui/pixelWindow';
import { DIALOG_FONT_SIZE } from '../ui/screenType';
import { CANOPY_BAND, CAPTION_BAND, FIGURE_BAND, TERRAIN_DEPTH, atRow } from '../world/depths';
import {
  BASE_LANDING,
  BASE_PLACE_NAME,
  BASE_SPAWN,
  getBaseMap,
  type BaseMapDefinition,
} from '../base/baseMap';
import { BASE_TILESET, type BasePropName } from '../base/baseTileset';
import { BASE_DOORS, doorAt, keeperAt, type BaseDoor } from '../base/doors';
import { doorStatusLine } from '../base/doorStatus';
import { standingFixtures, type BaseFixture } from '../base/fixtures';
import type { HubSceneData } from './HubScene';

/**
 * THE HARBOUR: the base, walked rather than chosen off a list.
 *
 * Everything the four base screens do is untouched - they are
 * `HubScene` exactly as they were. What this scene replaces is the lobby that
 * used to sit in front of them: instead of four cards on one page, the player
 * stands in their own base and walks to Oak's Lab, the Pokémon Center, Brock's
 * Workshop or the quay. The reason is not navigation. It is that a base you can
 * see is a base that can *fill up*: every Outfitter rung the player builds
 * stands somewhere on this map (`base/fixtures.ts`), so the reward for a raid is
 * a thing in a place rather than a row going grey.
 *
 * It is deliberately not `WorldScene`. A raid scene carries a clock, a hunter, a
 * pack, wild encounters, loot, contracts, extraction, trainer watches, cutscenes
 * and a settlement, and the base has exactly none of those - the captain's one
 * hard rule for it is that it is safe. What the two do share is the walking and
 * the drawing, and those are shared as modules (`movement/`, `world/tiles`,
 * `world/characterPresentation`, `ui/WorldLabel`) rather than by inheritance.
 *
 * Two ways through every door, because the base is crossed many times an hour:
 * step onto the doorway, or walk up to the keeper and press the interact key.
 * Neither spends a line of dialogue on the way in. The keepers do speak - every
 * one of them has something to say about what they do - but only when you speak
 * to them from somewhere other than their own doorstep.
 */

const CAMERA_ZOOM = 1;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;
const DIALOG_WIDTH = 232;
const DIALOG_HEIGHT = 56;
const DIALOG_MARGIN = 8;

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
};

/**
 * The base's two caption tones. A door is the warm one, because it is somewhere
 * to go; a thing you built is the quiet slate the raid maps use for a landmark
 * that has been worked - it is a fact about the place now, not something to do.
 */
const DOOR_TONE: WorldLabelTone = { fill: 0x3a2408, border: 0xf1bf63, ink: '#fef3c7' };
const FIXTURE_TONE: WorldLabelTone = { fill: 0x16222c, border: 0x6f97b4, ink: '#c6dced' };

export interface BaseSceneData {
  readonly savedGame?: RestoredGame;
  /** The door the player is coming back out of, if any. */
  readonly from?: string;
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

export class BaseScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private savedGame!: RestoredGame;
  private map!: BaseMapDefinition;
  private bounds: GridBounds = { width: 0, height: 0 };
  private collision: boolean[][] = [];
  private player!: Phaser.GameObjects.Sprite;
  private playerGroundMark!: Phaser.GameObjects.Graphics;
  private playerHeadMark!: Phaser.GameObjects.Graphics;
  private dialogBox!: DialogBox;
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
   * The four doors, reachable from outside the bundle.
   *
   * A playtest driver cannot import a module, and the alternative - a table of
   * tiles copied into `tools/playtest/` - is how a driver comes to walk to
   * where a door used to be. It reads this instead, the same way it reads
   * `WorldScene`'s collision. See `tools/playtest/README.md`.
   */
  public readonly doors = BASE_DOORS;

  public constructor() {
    super('base');
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
    this.figures.clear();
    this.worldLabels = [];

    this.map = getBaseMap(loaded.raidProgress.workshopUpgrades);
    this.fixtures = standingFixtures(loaded.raidProgress.workshopUpgrades);
    this.bounds = { width: this.map.width, height: this.map.height };
    this.collision = this.map.collision.map((row) => [...row]);

    const returning = BASE_DOORS.find((door) => door.id === data.from);
    this.currentTile = returning
      ? { ...returning.returnTo }
      : data.arrival === 'raid'
        ? { ...BASE_LANDING }
        : { ...BASE_SPAWN };
    this.facing = returning ? 'down' : 'up';

    this.drawMap();
    this.createFigures();
    this.createPlayer();
    this.createCaptions();
    this.createDialogBox();
    this.bindControls();
    this.configureCamera();
    // The dialogue box is anchored to the bottom of the screen, so a resized
    // window has to re-anchor it exactly as a raid does.
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
      this.handleDialogInput();
      return;
    }

    if (this.targetTile) {
      this.advanceStep(deltaMs);
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
      width: this.map.width,
      height: this.map.height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const sheets = BASE_TILESET.sources.map((source) => {
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
    const { ground, overlay, detail, canopy } = this.map.layers;
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

  private createFigures(): void {
    for (const door of BASE_DOORS) {
      const { keeper } = door;
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
   * One caption per door and one per thing the player has built. Both speak
   * within `CAPTION_NEAR_STEPS` of what they name, and all of them while the
   * look key is held - the same rule the raid maps follow, so the base is read
   * the way the rest of the game is.
   */
  private createCaptions(): void {
    for (const door of BASE_DOORS) {
      const about = door.tiles.length > 0 ? door.tiles : [door.keeper.position];
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
      const subject = door.building
        ? propsRect([{ ...door.building, name: door.building.prop }], 1)
        : figureRect(door.keeper.position);
      this.worldLabels.push(
        new WorldLabel(this, {
          subject,
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
          depth: atRow(CAPTION_BAND, about[0].y),
          speech: { voice: 'name', tiles: about },
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

  private layoutForStage(): void {
    if (!this.dialogBox) {
      return;
    }
    this.dialogBox.setPosition(
      Math.round((this.scale.width - DIALOG_WIDTH) / 2),
      this.scale.height - DIALOG_HEIGHT - DIALOG_MARGIN,
    );
  }

  private configureCamera(): void {
    this.cameras.main.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true);
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
    const placements = placeCaptions(
      this.worldLabels.map((label) => label.request()),
      {
        bounds,
        furniture: [],
        keepClear: BASE_DOORS.map((door) => figureRect(door.keeper.position)),
        canopy: this.canopyInView(bounds),
        player: [figureRect(this.currentTile), figureRect(this.targetTile ?? this.currentTile)],
      },
    );
    this.worldLabels.forEach((label, index) => label.seat(placements[index]));
  }

  /** Every crown in view, as one rectangle a row: writing may not sit under one. */
  private canopyInView(view: Rect): readonly Rect[] {
    const canopy = this.map.layers.canopy.tiles;
    const left = Math.max(0, Math.floor(view.x / TILE_SIZE));
    const right = Math.min(this.map.width - 1, Math.ceil((view.x + view.width) / TILE_SIZE));
    const top = Math.max(0, Math.floor(view.y / TILE_SIZE));
    const bottom = Math.min(this.map.height - 1, Math.ceil((view.y + view.height) / TILE_SIZE));
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
    this.keyPresses.watch([
      this.controls.up,
      this.controls.down,
      this.controls.left,
      this.controls.right,
      this.controls.w,
      this.controls.a,
      this.controls.s,
      this.controls.d,
      ...this.controls.interact,
      this.controls.look,
    ]);
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

  private isBlocked(tile: GridPosition): boolean {
    return (
      this.collision[tile.y][tile.x] ||
      BASE_DOORS.some(
        (door) => door.keeper.position.x === tile.x && door.keeper.position.y === tile.y,
      )
    );
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
    const door = doorAt(this.currentTile);
    if (door) {
      this.enter(door);
    }
  }

  // -- the four places -------------------------------------------------------

  /**
   * Speaking to whatever is in front of the player.
   *
   * A keeper opens their own screen with no line first: the base is crossed
   * many times an hour and a keypress that only says hello is a toll by the
   * fourth raid. A door does the same from the tile in front of it, so a player
   * who walks *at* a building rather than *into* it is not left pressing keys at
   * a wall. Everything else answers with what it is.
   */
  private tryInteract(): void {
    const target = nextTileFromDirection(this.currentTile, this.facing);
    const keeper = keeperAt(target);
    if (keeper) {
      this.enter(keeper);
      return;
    }
    const door = doorAt(target);
    if (door) {
      this.enter(door);
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
    this.spentPresses.spendHeld([
      this.controls.up,
      this.controls.down,
      this.controls.left,
      this.controls.right,
      this.controls.w,
      this.controls.a,
      this.controls.s,
      this.controls.d,
    ]);
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

  private enter(door: BaseDoor): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.player.stop();
    audioManager.play('menuOpen');
    const payload: HubSceneData = {
      savedGame: this.savedGame,
      view: SCREEN_VIEWS[door.screen],
      from: door.id,
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
  x: 20,
  y: 15,
  lines: [
    `${BASE_PLACE_NAME.toUpperCase()} - what the raids are run out of.`,
    'OAK kits you out. JOY patches the team up. BROCK builds onto the base, and BILL takes what you drag home.',
  ],
} as const;

/** Which screen each door opens, as `HubScene` names its views. */
const SCREEN_VIEWS = {
  raid: 'home',
  stash: 'stash',
  workshop: 'workshop',
  trader: 'trader',
} as const satisfies Record<BaseDoor['screen'], NonNullable<HubSceneData['view']>>;
