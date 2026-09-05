import Phaser from 'phaser';
import {
  planNextGridStep,
  type Direction,
  type GridBounds,
  type GridInputState,
  type GridPosition,
} from '../movement/gridMovement';
import { getIdleFrame, getWalkAnimationKey } from '../playerFrames';

const TILE_SIZE = 16;
const MAP_WIDTH = 26;
const MAP_HEIGHT = 20;
const STEP_DURATION_MS = 130;
const CAMERA_ZOOM = 3;
const PLAYER_FEET_PIXEL_Y = 27;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - PLAYER_FEET_PIXEL_Y;

const GRASS_BASE_TILE: number = 200;
const GRASS_VARIANT_A_TILE: number = 201;
const GRASS_VARIANT_B_TILE: number = 240;
const WATER_TILE: number = 283;
const WATER_SHORE_TOP_TILE: number = 243;
const WATER_SHORE_BOTTOM_TILE: number = 282;
const WATER_SHORE_LEFT_TILE: number = 284;
const WATER_SHORE_RIGHT_TILE: number = 242;
const LOG_LEFT_CAP_TILE: number = 203;
const LOG_BODY_TILE: number = 204;
const LOG_RIGHT_CAP_TILE: number = 205;
const ROCK_TILE: number = 207;

interface ControlKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
}

export class WorldScene extends Phaser.Scene {
  private readonly bounds: GridBounds = { width: MAP_WIDTH, height: MAP_HEIGHT };
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();

  private player!: Phaser.GameObjects.Sprite;
  private controls!: ControlKeys;
  private currentTile: GridPosition = { x: 6, y: 8 };
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'down';
  private stepProgress = 0;

  public constructor() {
    super('world');
  }

  public create(): void {
    this.createMap();
    this.createPlayer();
    this.bindControls();
    this.configureCamera();
  }

  public update(_time: number, deltaMs: number): void {
    if (this.targetTile) {
      this.advanceStep(deltaMs);
      return;
    }

    const decision = planNextGridStep({
      position: this.currentTile,
      facing: this.facing,
      input: this.readInput(),
      bounds: this.bounds,
    });

    this.facing = decision.facing;

    if (decision.target) {
      this.beginStep(decision.target);
      return;
    }

    this.showIdlePose();
  }

  private createMap(): void {
    const map = this.make.tilemap({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage('overworldTiles', 'overworldTiles', TILE_SIZE, TILE_SIZE);
    if (!tileset) {
      throw new Error('Overworld tileset failed to load.');
    }

    const groundLayer = map.createBlankLayer('ground', tileset);
    const detailLayer = map.createBlankLayer('detail', tileset);
    if (!groundLayer || !detailLayer) {
      throw new Error('Tilemap layers failed to initialize.');
    }

    groundLayer.putTilesAt(buildGroundLayerData(), 0, 0);
    detailLayer.putTilesAt(buildDetailLayerData(), 0, 0);
    detailLayer.setDepth(1);
  }

  private createPlayer(): void {
    const spawnX = this.currentTile.x * TILE_SIZE;
    const spawnY = this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET;

    this.player = this.add
      .sprite(
        spawnX,
        spawnY,
        'character',
        getIdleFrame(this.facing),
      )
      .setOrigin(0, 0)
      .setDepth(2);
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

    this.controls = {
      up: cursors.up,
      down: cursors.down,
      left: cursors.left,
      right: cursors.right,
      w: wasdKeys.W,
      a: wasdKeys.A,
      s: wasdKeys.S,
      d: wasdKeys.D,
    };
  }

  private configureCamera(): void {
    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true);
  }

  private readInput(): GridInputState {
    return {
      up: this.controls.up.isDown || this.controls.w.isDown,
      down: this.controls.down.isDown || this.controls.s.isDown,
      left: this.controls.left.isDown || this.controls.a.isDown,
      right: this.controls.right.isDown || this.controls.d.isDown,
    };
  }

  private beginStep(targetTile: GridPosition): void {
    this.targetTile = targetTile;
    this.stepProgress = 0;

    this.stepStart.set(
      this.currentTile.x * TILE_SIZE,
      this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );
    this.stepEnd.set(
      targetTile.x * TILE_SIZE,
      targetTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
    );

    this.player.play(getWalkAnimationKey(this.facing), true);
  }

  private advanceStep(deltaMs: number): void {
    this.stepProgress = Math.min(1, this.stepProgress + deltaMs / STEP_DURATION_MS);

    this.player.setPosition(
      Phaser.Math.Linear(this.stepStart.x, this.stepEnd.x, this.stepProgress),
      Phaser.Math.Linear(this.stepStart.y, this.stepEnd.y, this.stepProgress),
    );

    if (this.stepProgress < 1 || !this.targetTile) {
      return;
    }

    this.currentTile = { ...this.targetTile };
    this.targetTile = null;
    this.player.setPosition(this.stepEnd.x, this.stepEnd.y);
    this.showIdlePose();
  }

  private showIdlePose(): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }
}

function buildGroundLayerData(): number[][] {
  const data = Array.from({ length: MAP_HEIGHT }, (_unused, y) =>
    Array.from({ length: MAP_WIDTH }, (_innerUnused, x) => {
      if ((x + y) % 7 === 0) {
        return GRASS_VARIANT_A_TILE;
      }
      if ((x * 2 + y) % 11 === 0) {
        return GRASS_VARIANT_B_TILE;
      }
      return GRASS_BASE_TILE;
    }),
  );

  for (let y = 7; y <= 11; y += 1) {
    for (let x = 14; x <= 19; x += 1) {
      data[y][x] = WATER_TILE;
    }
  }

  for (let x = 14; x <= 19; x += 1) {
    data[6][x] = WATER_SHORE_TOP_TILE;
    data[12][x] = WATER_SHORE_BOTTOM_TILE;
  }
  for (let y = 7; y <= 11; y += 1) {
    data[y][13] = WATER_SHORE_LEFT_TILE;
    data[y][20] = WATER_SHORE_RIGHT_TILE;
  }

  return data;
}

function buildDetailLayerData(): number[][] {
  const data = Array.from({ length: MAP_HEIGHT }, () => Array<number>(MAP_WIDTH).fill(-1));

  data[5][4] = LOG_LEFT_CAP_TILE;
  data[5][5] = LOG_BODY_TILE;
  data[5][6] = LOG_BODY_TILE;
  data[5][7] = LOG_BODY_TILE;
  data[5][8] = LOG_RIGHT_CAP_TILE;

  data[14][17] = ROCK_TILE;
  data[3][20] = ROCK_TILE;
  data[16][9] = ROCK_TILE;

  return data;
}
