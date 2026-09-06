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
  CLASSIC_TILE,
  getWarpAt,
  getWorldMap,
  isTallGrassInMap,
  TILE_SIZE,
  type MapWarp,
  type WorldMapDefinition,
} from '../worldMap';
import { type WorldEntity } from '../world/npcs';
import { Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { DialogBox } from '../ui/DialogBox';
import { rollEncounter } from '../world/wildEncounters';
import { audioManager } from '../audio/AudioManager';

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
  private bounds: GridBounds = { width: 0, height: 0 };
  private readonly stepStart = new Phaser.Math.Vector2();
  private readonly stepEnd = new Phaser.Math.Vector2();

  private player!: Phaser.GameObjects.Sprite;
  private dialogBox!: DialogBox;
  private controls!: ControlKeys;
  private collisionData!: boolean[][];
  private currentMap: WorldMapDefinition = getWorldMap('pallet-town');
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly party = new PokemonParty([new Pokemon(CHARMANDER, 5)]);
  private currentTile: GridPosition = { x: 6, y: 8 };
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'down';
  private stepProgress = 0;
  private isWarping = false;

  public constructor() {
    super('world');
  }

  public create(): void {
    void audioManager.startTheme('overworld');
    this.createMap();
    this.createEntities();
    this.createPlayer();
    this.createDialogBox();
    this.bindControls();
    this.configureCamera();
  }

  public update(_time: number, deltaMs: number): void {
    this.dialogBox.update(deltaMs);

    if (this.isWarping) {
      return;
    }

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
    this.collisionData = this.currentMap.collision.map((row) => [...row]);
    this.bounds = { width: this.currentMap.width, height: this.currentMap.height };

    const map = this.make.tilemap({
      width: this.currentMap.width,
      height: this.currentMap.height,
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
      this.currentMap.groundLayer.map((row) =>
        row.map((tile) =>
          tile === CLASSIC_TILE.TALL_GRASS ? CLASSIC_TILE.GRASS : tile,
        ),
      ),
      0,
      0,
    );
    tallGrassLayer.putTilesAt(this.currentMap.tallGrassLayer.map((row) => [...row]), 0, 0);
    tallGrassLayer.setDepth(1);
    detailLayer.putTilesAt(this.currentMap.detailLayer.map((row) => [...row]), 0, 0);
    detailLayer.setDepth(1);
    this.mapObjects.push(groundLayer, tallGrassLayer, detailLayer);
  }

  private createEntities(): void {
    for (const entity of this.currentMap.entities) {
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
      this.mapObjects.push(sprite);
    }
  }

  private createSign(entity: WorldEntity): void {
    const sign = this.add
      .rectangle(
        entity.position.x * TILE_SIZE + TILE_SIZE / 2,
        entity.position.y * TILE_SIZE + TILE_SIZE / 2,
        10,
        12,
        0x8b5a2b,
      )
      .setStrokeStyle(1, 0x4d2c16)
      .setDepth(2 + entity.position.y / 1000);
    this.mapObjects.push(sign);
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
      interact: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ],
    };
  }

  private configureCamera(): void {
    const worldWidth = this.currentMap.width * TILE_SIZE;
    const worldHeight = this.currentMap.height * TILE_SIZE;

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
    const warp = getWarpAt(this.currentMap, targetTile, 'interact');
    if (warp) {
      this.warp(warp);
      return;
    }

    const entity = this.currentMap.entities.find(
      (candidate) =>
        candidate.position.x === targetTile.x && candidate.position.y === targetTile.y,
    );
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
      this.currentMap.entities.some(
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

    const warp = getWarpAt(this.currentMap, this.currentTile, 'step');
    if (warp) {
      this.warp(warp);
      return;
    }

    if (isTallGrassInMap(this.currentMap, this.currentTile) && this.currentMap.encounters) {
      const wild = rollEncounter(this.currentMap.encounters);
      if (wild) {
        audioManager.playEncounter();
        this.scene.start('battle', { wild, party: this.party });
      }
    }
  }

  private showIdlePose(): void {
    this.player.stop();
    this.player.setFrame(getIdleFrame(this.facing));
  }

  private warp(warp: MapWarp): void {
    this.isWarping = true;
    this.player.stop();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.clearMap();
      this.currentMap = getWorldMap(warp.destinationMapId);
      this.currentTile = { ...warp.destination };
      this.facing = warp.facing;
      this.targetTile = null;
      this.createMap();
      this.createEntities();
      this.player.setPosition(
        this.currentTile.x * TILE_SIZE,
        this.currentTile.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
      );
      this.showIdlePose();
      this.configureCamera();
      this.cameras.main.fadeIn(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isWarping = false;
      });
    });
  }

  private clearMap(): void {
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    this.npcSprites.clear();
  }
}
