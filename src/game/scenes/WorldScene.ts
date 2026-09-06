import Phaser from 'phaser';
import {
  nextTileFromDirection,
  planNextGridStep,
  type Direction,
  type GridBounds,
  type GridInputState,
  type GridPosition,
} from '../movement/gridMovement';
import { getIdleFrame, getWalkAnimationKey } from '../playerFrames';
import {
  buildCollisionData,
  buildDetailLayerData,
  buildGroundLayerData,
  buildTallGrassLayerData,
  CLASSIC_TILE,
  isTallGrassTile,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE_SIZE,
} from '../worldMap';
import { getWorldEntityAt, WORLD_ENTITIES, type WorldEntity } from '../world/npcs';
import { Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { PALLET_TALL_GRASS } from '../pokemon/encounters';
import { DialogBox } from '../ui/DialogBox';
import { rollEncounter } from '../world/wildEncounters';

const STEP_DURATION_MS = 130;
const CAMERA_ZOOM = 1;
const PLAYER_FEET_PIXEL_Y = 27;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - PLAYER_FEET_PIXEL_Y;

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
  interact: Phaser.Input.Keyboard.Key[];
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export class WorldScene extends Phaser.Scene {
  private readonly bounds: GridBounds = { width: MAP_WIDTH, height: MAP_HEIGHT };
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();

  private player!: Phaser.GameObjects.Sprite;
  private dialogBox!: DialogBox;
  private controls!: ControlKeys;
  private collisionData!: boolean[][];
  private readonly npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly party = new PokemonParty([new Pokemon(CHARMANDER, 5)]);
  private currentTile: GridPosition = { x: 6, y: 8 };
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'down';
  private stepProgress = 0;

  public constructor() {
    super('world');
  }

  public create(): void {
    this.createMap();
    this.createEntities();
    this.createPlayer();
    this.createDialogBox();
    this.bindControls();
    this.configureCamera();
  }

  public update(_time: number, deltaMs: number): void {
    this.dialogBox.update(deltaMs);

    if (this.dialogBox.visible) {
      this.handleDialogInput();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.controls.party)) {
      this.openParty();
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

    const decision = planNextGridStep({
      position: this.currentTile,
      facing: this.facing,
      input: this.readInput(),
      bounds: this.bounds,
      isBlocked: (tile) => this.isBlocked(tile),
    });

    this.facing = decision.facing;

    if (decision.target) {
      this.beginStep(decision.target);
      return;
    }

    this.showIdlePose();
  }

  private createMap(): void {
    this.collisionData = buildCollisionData();

    const map = this.make.tilemap({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage('classicTiles', 'classicTiles', TILE_SIZE, TILE_SIZE);
    if (!tileset) {
      throw new Error('Classic tileset failed to load.');
    }

    const groundLayer = map.createBlankLayer('ground', tileset);
    const tallGrassLayer = map.createBlankLayer('tall-grass', tileset);
    const detailLayer = map.createBlankLayer('detail', tileset);
    if (!groundLayer || !tallGrassLayer || !detailLayer) {
      throw new Error('Tilemap layers failed to initialize.');
    }

    groundLayer.putTilesAt(
      buildGroundLayerData().map((row) =>
        row.map((tile) =>
          tile === CLASSIC_TILE.TALL_GRASS ? CLASSIC_TILE.GRASS : tile,
        ),
      ),
      0,
      0,
    );
    tallGrassLayer.putTilesAt(buildTallGrassLayerData(), 0, 0);
    tallGrassLayer.setDepth(1);
    detailLayer.putTilesAt(buildDetailLayerData(), 0, 0);
    detailLayer.setDepth(1);
  }

  private createEntities(): void {
    for (const entity of WORLD_ENTITIES) {
      if (entity.kind === 'sign') {
        this.createSign(entity);
        continue;
      }

      const sprite = this.add
        .sprite(
          entity.position.x * TILE_SIZE,
          entity.position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
          'character',
          getIdleFrame(entity.facing),
        )
        .setOrigin(0, 0)
        .setDepth(2 + entity.position.y / 1000);
      this.npcSprites.set(entity.id, sprite);
    }
  }

  private createSign(entity: WorldEntity): void {
    this.add
      .rectangle(
        entity.position.x * TILE_SIZE + TILE_SIZE / 2,
        entity.position.y * TILE_SIZE + TILE_SIZE / 2,
        10,
        12,
        0x8b5a2b,
      )
      .setStrokeStyle(1, 0x4d2c16)
      .setDepth(2 + entity.position.y / 1000);
  }

  private createPlayer(): void {
    const spawnX = this.currentTile.x * TILE_SIZE;
    const spawnY = this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET;

    this.player = this.add
      .sprite(spawnX, spawnY, 'character', getIdleFrame(this.facing))
      .setOrigin(0, 0)
      .setDepth(2);
  }

  private createDialogBox(): void {
    this.dialogBox = new DialogBox(this, {
      x: 8,
      y: 152,
      width: 304,
      height: 80,
      padding: 10,
      textStyle: { fontSize: '14px' },
    }).setScrollFactor(0, 0, true);
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
    ]);

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
      interact: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ],
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

  private isInteractionPressed(): boolean {
    return this.controls.interact.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  private handleDialogInput(): void {
    if (!this.isInteractionPressed()) {
      return;
    }

    if (this.dialogBox.isCurrentMessageComplete) {
      this.dialogBox.advance();
      return;
    }

    this.dialogBox.skip();
  }

  private tryInteract(): void {
    const targetTile = nextTileFromDirection(this.currentTile, this.facing);
    const entity = getWorldEntityAt(targetTile);
    if (!entity) {
      return;
    }

    if (entity.kind === 'npc') {
      this.npcSprites.get(entity.id)?.setFrame(getIdleFrame(OPPOSITE_DIRECTION[this.facing]));
    }

    this.dialogBox.showMessages([...entity.dialogLines]);
  }

  private openParty(): void {
    this.scene.pause();
    this.scene.launch('party', { party: this.party });
  }

  private isBlocked(tile: GridPosition): boolean {
    return (
      this.collisionData[tile.y][tile.x] ||
      WORLD_ENTITIES.some(
        (entity) => entity.position.x === tile.x && entity.position.y === tile.y,
      )
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

    if (isTallGrassTile(this.currentTile)) {
      const wild = rollEncounter(PALLET_TALL_GRASS);
      if (wild) {
        this.scene.start('battle', { wild, party: this.party });
      }
    }
  }

  private showIdlePose(): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }
}
