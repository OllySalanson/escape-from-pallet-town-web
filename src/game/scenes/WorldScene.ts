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
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { Bag, ITEMS, type ItemId } from '../items';
import { RunPhase } from '../run/RunManager';
import type { ActiveRunSession } from '../run/RunSession';
import { createRunTrainerEncounters, type RunTrainerEncounter } from '../world/trainers';
import { getVisibleLoot, tryCollectLoot } from '../world/loot';
import {
  chooseHunterPursuitStep,
  createHunterState,
  createHunterTrainer,
  HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP,
  HUNTER_SPAWN_MS,
  isHunterContactingPlayer,
  type HunterState,
} from '../world/hunter';

const STEP_DURATION_MS = 130;
const CAMERA_ZOOM = 1;
const PLAYER_FEET_PIXEL_Y = 27;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - PLAYER_FEET_PIXEL_Y;
const EXTRACTION_UNLOCK_DELAY_MS = 30_000;
const RAID_TIMER_URGENT_MS = 30_000;

interface ExtractionPoint {
  readonly mapId: WorldMapDefinition['id'];
  readonly position: GridPosition;
  readonly label: string;
  readonly unlockAtMs: number;
}

interface RunTimerHud {
  readonly backing: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

const EXTRACTION_POINTS: readonly ExtractionPoint[] = [
  {
    mapId: 'pallet-town',
    position: { x: 8, y: 42 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
  },
  {
    mapId: 'route-1',
    position: { x: 8, y: 30 },
    label: 'ROUTE OUTPOST',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
];

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
  interact: Phaser.Input.Keyboard.Key[];
}

export interface WorldSceneData {
  readonly savedGame?: RestoredGame;
  readonly party?: PokemonParty;
  /** The consumable items deployed from the hub for an extraction raid. */
  readonly bag?: Bag;
  readonly pokeBalls?: number;
  readonly caughtPokemonStash?: Pokemon[];
  /** Present only while playing an extraction raid launched by the hub. */
  readonly runSession?: ActiveRunSession;
  /** Trainer victories persist only for the active raid. */
  readonly defeatedTrainerIds?: readonly string[];
  /** Loot pickups persist only for the active raid. */
  readonly collectedLootIds?: readonly string[];
  /** The hunter persists across battle returns during the active raid. */
  readonly hunterState?: HunterState;
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
  private party = new PokemonParty([new Pokemon(CHARMANDER, 5)]);
  private pokeBalls = 5;
  private caughtPokemonStash: Pokemon[] = [];
  private bag = new Bag({ potion: 3, antidote: 1, 'poke-ball': 5, 'great-ball': 1 });
  private currentTile: GridPosition = { x: 6, y: 8 };
  private targetTile: GridPosition | null = null;
  private facing: Direction = 'down';
  private stepProgress = 0;
  private isWarping = false;
  private extractionMarkers: Array<{
    readonly point: ExtractionPoint;
    readonly marker: Phaser.GameObjects.Rectangle;
    readonly label: Phaser.GameObjects.Text;
  }> = [];
  private runTimerHud: RunTimerHud | undefined;
  private runSession: ActiveRunSession | undefined;
  private pendingHubTransition = false;
  private trainerEncounters: readonly RunTrainerEncounter[] = [];
  private readonly defeatedTrainerIds = new Set<string>();
  private readonly collectedLootIds = new Set<string>();
  private readonly lootSprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private pendingTrainerBattle:
    | {
        readonly trainer: RunTrainerEncounter['trainer'];
        readonly introLines: readonly string[];
        readonly isHunter: boolean;
      }
    | undefined;
  private hunterState: HunterState = createHunterState();

  public constructor() {
    super('world');
  }

  public create(data: WorldSceneData = {}): void {
    this.restoreSavedGame(data.savedGame);
    this.extractionMarkers = [];
    void audioManager.startTheme('overworld');
    if (data.party) {
      this.party = data.party;
    }
    if (data.bag) {
      this.bag = data.bag;
    }
    if (data.pokeBalls !== undefined) {
      this.pokeBalls = data.pokeBalls;
      this.syncPokeBallsToBag();
    }
    if (data.caughtPokemonStash) {
      this.caughtPokemonStash = data.caughtPokemonStash;
    }
    this.runSession = data.runSession;
    this.defeatedTrainerIds.clear();
    data.defeatedTrainerIds?.forEach((id) => this.defeatedTrainerIds.add(id));
    this.collectedLootIds.clear();
    data.collectedLootIds?.forEach((id) => this.collectedLootIds.add(id));
    this.trainerEncounters = this.runSession ? createRunTrainerEncounters() : [];
    this.pendingTrainerBattle = undefined;
    this.hunterState = data.hunterState ?? createHunterState();
    this.createMap();
    this.createEntities();
    this.createPlayer();
    this.createDialogBox();
    this.bindControls();
    this.configureCamera();
    this.createRunTimerHud();
    if (this.runTimerHud) {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyRunTimerHud());
    }
    this.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, () => this.clearMap());
  }

  public update(_time: number, deltaMs: number): void {
    this.dialogBox.update(deltaMs);

    this.advanceRunClock(deltaMs);
    if (this.pendingHubTransition) {
      this.handleDialogInput();
      return;
    }

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

    if (Phaser.Input.Keyboard.JustDown(this.controls.bag)) {
      this.openBag();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.controls.save)) {
      this.saveGame();
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
        row.map((tile) => (tile === CLASSIC_TILE.TALL_GRASS ? CLASSIC_TILE.GRASS : tile)),
      ),
      0,
      0,
    );
    tallGrassLayer.putTilesAt(
      this.currentMap.tallGrassLayer.map((row) => [...row]),
      0,
      0,
    );
    tallGrassLayer.setDepth(1);
    detailLayer.putTilesAt(
      this.currentMap.detailLayer.map((row) => [...row]),
      0,
      0,
    );
    detailLayer.setDepth(1);
    this.mapObjects.push(groundLayer, tallGrassLayer, detailLayer);
    this.createExtractionPoints();
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
        .rectangle(x, y, 14, 14, isOpen ? 0x16a34a : 0x991b1b, 0.8)
        .setStrokeStyle(2, isOpen ? 0xdcfce7 : 0xfecaca)
        .setDepth(3 + point.position.y / 1000);
      const label = this.add
        .text(x, y - 13, `EXTRACT ${isOpen ? 'OPEN' : 'LOCKED'}`, {
          fontFamily: 'monospace',
          fontSize: '7px',
          color: isOpen ? '#dcfce7' : '#fecaca',
          backgroundColor: '#111827',
        })
        .setOrigin(0.5, 1)
        .setDepth(4 + point.position.y / 1000);
      this.mapObjects.push(marker, label);
      this.extractionMarkers.push({ point, marker, label });
    }
  }

  private createEntities(): void {
    this.createLoot();

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

    for (const encounter of this.trainersForCurrentMap()) {
      const sprite = this.add
        .sprite(
          encounter.position.x * TILE_SIZE,
          encounter.position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
          'character',
          getIdleFrame(encounter.facing),
        )
        .setOrigin(0, 0)
        .setTint(0xfbbf24)
        .setDepth(2 + encounter.position.y / 1000);
      this.npcSprites.set(encounter.trainer.id, sprite);
      this.mapObjects.push(sprite);
    }

    this.createHunterSprite();
  }

  private createLoot(): void {
    for (const loot of getVisibleLoot(
      this.currentMap.loot,
      this.isLootAvailable(),
      this.collectedLootIds,
    )) {
      const marker = this.add
        .rectangle(
          loot.position.x * TILE_SIZE + TILE_SIZE / 2,
          loot.position.y * TILE_SIZE + TILE_SIZE / 2,
          9,
          9,
          0xfacc15,
        )
        .setStrokeStyle(2, 0x92400e)
        .setDepth(3 + loot.position.y / 1000);
      this.lootSprites.set(loot.id, marker);
      this.mapObjects.push(marker);
    }
  }

  private createHunterSprite(): void {
    if (!this.isHunterOnCurrentMap()) {
      return;
    }
    const position = this.hunterState.position!;
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE,
        position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
        'character',
        getIdleFrame('down'),
      )
      .setOrigin(0, 0)
      .setTint(0xef4444)
      .setDepth(2 + position.y / 1000);
    this.npcSprites.set('rival-hunter', sprite);
    this.mapObjects.push(sprite);
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
      onComplete: () => this.handleRunResolutionComplete(),
    }).setScrollFactor(0, 0, true);
  }

  private createRunTimerHud(): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return;
    }

    const backing = this.add
      .rectangle(160, 10, 154, 22, 0x111827, 0.9)
      .setStrokeStyle(2, 0xdbeafe)
      .setScrollFactor(0)
      .setDepth(100);
    const text = this.add
      .text(160, 10, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setStroke('#020617', 2)
      .setScrollFactor(0)
      .setDepth(101);
    this.runTimerHud = { backing, text };
    this.refreshRunTimerHud();
  }

  private refreshRunTimerHud(): void {
    const hud = this.runTimerHud;
    const manager = this.runSession?.manager;
    if (!hud || !manager || manager.phase !== RunPhase.InRun) {
      return;
    }

    if (manager.isEnraged) {
      hud.backing.setFillStyle(0x7f1d1d, 0.95).setStrokeStyle(2, 0xfca5a5);
      hud.text.setText('ENRAGED - EXTRACT NOW').setColor('#fee2e2');
      const pulse = 0.7 + (Math.sin(this.time.now / 100) + 1) * 0.15;
      hud.backing.setAlpha(pulse);
      hud.text.setAlpha(pulse);
      return;
    }

    const remainingMs = manager.remainingMs();
    const isUrgent = remainingMs <= RAID_TIMER_URGENT_MS;
    hud.text.setText(`RAID ${formatRaidTimer(remainingMs)}`);
    hud.backing
      .setFillStyle(isUrgent ? 0x78350f : 0x111827, 0.9)
      .setStrokeStyle(2, isUrgent ? 0xfbbf24 : 0xdbeafe)
      .setAlpha(1);
    hud.text.setColor(isUrgent ? '#fef3c7' : '#f8fafc').setAlpha(1);
  }

  private destroyRunTimerHud(): void {
    this.runTimerHud?.backing.destroy();
    this.runTimerHud?.text.destroy();
    this.runTimerHud = undefined;
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

    if (this.tryCollectLootAt(targetTile)) {
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
      this.npcSprites
        .get(trainer.trainer.id)
        ?.setFrame(getIdleFrame(OPPOSITE_DIRECTION[this.facing]));
      this.pendingTrainerBattle = {
        trainer: trainer.trainer,
        introLines: trainer.introLines,
        isHunter: false,
      };
      this.dialogBox.showMessages([...trainer.introLines]);
      return;
    }

    if (entity?.kind === 'npc') {
      this.npcSprites.get(entity.id)?.setFrame(getIdleFrame(OPPOSITE_DIRECTION[this.facing]));
    }

    this.dialogBox.showMessages([...entity!.dialogLines]);
  }

  private openParty(): void {
    this.scene.pause();
    this.scene.launch('party', { party: this.party });
  }

  private openBag(): void {
    this.scene.pause();
    this.scene.launch('bag', {
      bag: this.bag,
      party: this.party,
      onItemUsed: () => this.saveGame(),
    });
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
    this.saveGame();

    const warp = getWarpAt(this.currentMap, this.currentTile, 'step');
    if (warp) {
      this.warp(warp);
      return;
    }

    if (this.tryCollectLootAt(this.currentTile)) {
      return;
    }

    if (this.tryStartHunterBattle()) {
      return;
    }
    this.advanceHunterPursuit();
    if (this.tryStartHunterBattle()) {
      return;
    }

    if (isTallGrassInMap(this.currentMap, this.currentTile) && this.currentMap.encounters) {
      const wild = rollEncounter(this.currentMap.encounters);
      if (wild) {
        audioManager.playEncounter();
        this.scene.start('battle', {
          wild,
          party: this.party,
          pokeBalls: this.bag.count('poke-ball'),
          caughtPokemonStash: this.caughtPokemonStash,
          runSession: this.runSession,
          collectedLootIds: [...this.collectedLootIds],
        });
      }
    }

    this.tryExtract();
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
      this.runSession?.manager.setMap(this.currentMap.id);
      this.currentTile = { ...warp.destination };
      this.moveHunterToCurrentMap();
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
      this.saveGame();
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
    this.lootSprites.clear();
    this.extractionMarkers = [];
  }

  private isLootAvailable(): boolean {
    return this.runSession?.manager.phase === RunPhase.InRun;
  }

  private tryCollectLootAt(position: GridPosition): boolean {
    const loot = this.currentMap.loot.find(
      (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
    );
    const result = tryCollectLoot(
      loot,
      this.isLootAvailable(),
      this.collectedLootIds,
      (itemId, quantity) => this.collectRunItem(itemId, quantity),
    );
    if (result === 'unavailable') {
      return false;
    }
    if (result === 'bag-full') {
      this.dialogBox.showMessage('Bag is full!');
      return true;
    }

    this.lootSprites.get(loot!.id)?.destroy();
    this.lootSprites.delete(loot!.id);
    const item = ITEMS[loot!.itemId];
    const quantity = loot!.quantity > 1 ? ` x${loot!.quantity}` : '';
    this.dialogBox.showMessage(`Found ${item.displayName}${quantity}!`);
    return true;
  }

  private restoreSavedGame(savedGame: RestoredGame | undefined): void {
    if (!savedGame) {
      return;
    }

    this.party = savedGame.party;
    this.bag = savedGame.bag;
    this.currentMap = getWorldMap(savedGame.mapId);
    this.currentTile = { ...savedGame.position };
  }

  private syncPokeBallsToBag(): void {
    const existingPokeBalls = this.bag.count('poke-ball');
    if (existingPokeBalls > 0) {
      this.bag.remove('poke-ball', existingPokeBalls);
    }
    this.bag.add('poke-ball', this.pokeBalls);
  }

  private saveGame(): void {
    const saveManager = new SaveManager();
    const existingGame = saveManager.load();
    saveManager.save({
      party: this.party,
      mapId: this.currentMap.id,
      position: this.currentTile,
      bag: this.bag,
      stash: existingGame?.stash,
    });
  }

  private extractionPointsForCurrentMap(): readonly ExtractionPoint[] {
    return EXTRACTION_POINTS.filter((point) => point.mapId === this.currentMap.id);
  }

  private trainersForCurrentMap(): readonly RunTrainerEncounter[] {
    return this.trainerEncounters.filter(
      (trainer) =>
        trainer.mapId === this.currentMap.id && !this.defeatedTrainerIds.has(trainer.trainer.id),
    );
  }

  private isExtractionOpen(point: ExtractionPoint): boolean {
    return (this.runSession?.manager.snapshot().elapsedMs ?? 0) >= point.unlockAtMs;
  }

  private tryExtract(): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return;
    }

    const point = this.extractionPointsForCurrentMap().find(
      (candidate) =>
        candidate.position.x === this.currentTile.x && candidate.position.y === this.currentTile.y,
    );
    if (!point) {
      return;
    }

    if (!this.isExtractionOpen(point)) {
      const seconds = Math.ceil(
        (point.unlockAtMs - this.runSession.manager.snapshot().elapsedMs) / 1_000,
      );
      this.dialogBox.showMessage(`${point.label} is LOCKED. Open in ${seconds}s.`);
      return;
    }

    this.runSession.manager.resolveEscape();
    this.destroyRunTimerHud();
    const snapshot = this.runSession.manager.snapshot();
    const saved = new SaveManager().bankRun({
      pokemon: snapshot.caughtPokemon,
      items: snapshot.foundItems,
    });
    this.pendingHubTransition = true;
    this.dialogBox.showMessages([
      'EXTRACTED!',
      formatRunSummary('Banked', snapshot.caughtPokemon, snapshot.foundItems),
      saved ? 'Stash secured. Returning to hub.' : 'Stash save unavailable. Returning to hub.',
    ]);
  }

  private advanceRunClock(deltaMs: number): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return;
    }

    const snapshot = this.runSession.manager.tick(deltaMs);
    this.spawnHunterIfDue(snapshot.elapsedMs);
    this.refreshExtractionMarkers();
    this.refreshRunTimerHud();
    if (snapshot.isEnraged && this.runSession.manager.isEnrageGraceExpired) {
      this.resolveExpiredRun();
    }
  }

  private refreshExtractionMarkers(): void {
    for (const { point, marker, label } of this.extractionMarkers) {
      const isOpen = this.isExtractionOpen(point);
      marker
        .setFillStyle(isOpen ? 0x16a34a : 0x991b1b, 0.8)
        .setStrokeStyle(2, isOpen ? 0xdcfce7 : 0xfecaca);
      label
        .setText(`EXTRACT ${isOpen ? 'OPEN' : 'LOCKED'}`)
        .setColor(isOpen ? '#dcfce7' : '#fecaca');
    }
  }

  private resolveExpiredRun(): void {
    if (!this.runSession || this.pendingHubTransition) {
      return;
    }

    const result = this.runSession.manager.resolveWipe(this.runSession.secureSlot);
    this.destroyRunTimerHud();
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      this.runSession.stashSecureSlot,
    );
    this.pendingHubTransition = true;
    this.dialogBox.showMessages([
      'TIME EXPIRED - YOU WERE WIPED.',
      formatRunSummary('Lost', result.lostPokemon, result.lostItems),
      saved
        ? 'Secure slot preserved. Returning to hub.'
        : 'Stash save unavailable. Returning to hub.',
    ]);
  }

  private handleRunResolutionComplete(): void {
    if (this.pendingTrainerBattle) {
      const battle = this.pendingTrainerBattle;
      this.pendingTrainerBattle = undefined;
      this.scene.start('battle', {
        trainer: battle.trainer,
        party: this.party,
        pokeBalls: this.bag.count('poke-ball'),
        caughtPokemonStash: this.caughtPokemonStash,
        runSession: this.runSession,
        defeatedTrainerIds: [...this.defeatedTrainerIds],
        collectedLootIds: [...this.collectedLootIds],
        hunterBattle: battle.isHunter,
        hunterState: this.hunterState,
      });
      return;
    }

    if (!this.pendingHubTransition) {
      return;
    }

    if (this.scene.manager.keys.hub) {
      this.scene.start('hub');
      return;
    }
    this.scene.start('title');
  }

  private spawnHunterIfDue(elapsedMs: number): void {
    if (
      !this.runSession ||
      this.runSession.manager.phase !== RunPhase.InRun ||
      this.hunterState.spawned ||
      this.hunterState.defeated ||
      elapsedMs < HUNTER_SPAWN_MS
    ) {
      return;
    }
    this.hunterState = {
      spawned: true,
      defeated: false,
      mapId: this.currentMap.id,
      position: this.findHunterSpawnTile(),
    };
    this.createHunterSprite();
    this.dialogBox.showMessage('A RIVAL HUNTER is on your trail!');
  }

  private findHunterSpawnTile(): GridPosition {
    const candidates = [
      { x: this.currentTile.x - 5, y: this.currentTile.y },
      { x: this.currentTile.x + 5, y: this.currentTile.y },
      { x: this.currentTile.x, y: this.currentTile.y - 5 },
      { x: this.currentTile.x, y: this.currentTile.y + 5 },
    ];
    return (
      candidates.find(
        (tile) =>
          tile.x >= 0 &&
          tile.y >= 0 &&
          tile.x < this.bounds.width &&
          tile.y < this.bounds.height &&
          !this.isBlocked(tile),
      ) ?? { ...this.currentTile }
    );
  }

  private moveHunterToCurrentMap(): void {
    if (!this.hunterState.spawned || this.hunterState.defeated) {
      return;
    }
    this.hunterState = {
      ...this.hunterState,
      mapId: this.currentMap.id,
      position: this.findHunterSpawnTile(),
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
    const steps = this.runSession?.manager.isEnraged ? HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP : 1;
    let position = this.hunterState.position;
    for (let index = 0; index < steps; index += 1) {
      const target = chooseHunterPursuitStep(position, this.currentTile, this.bounds, (tile) =>
        this.isBlockedForHunter(tile),
      );
      if (!target) {
        break;
      }
      position = target;
      if (isHunterContactingPlayer(position, this.currentTile)) {
        break;
      }
    }
    this.hunterState = { ...this.hunterState, position };
    const sprite = this.npcSprites.get('rival-hunter');
    sprite
      ?.setPosition(position.x * TILE_SIZE, position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET)
      .setDepth(2 + position.y / 1000);
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
      !isHunterContactingPlayer(this.hunterState.position, this.currentTile)
    ) {
      return false;
    }
    this.pendingTrainerBattle = {
      trainer: createHunterTrainer(
        this.runSession!.manager.snapshot().elapsedMs,
        this.runSession!.manager.isEnraged,
      ),
      introLines: ['FOUND YOU.', 'There is nowhere left to run!'],
      isHunter: true,
    };
    this.dialogBox.showMessages([...this.pendingTrainerBattle.introLines]);
    return true;
  }
}

function formatRunSummary(
  heading: string,
  pokemon: readonly Pokemon[],
  items: readonly { readonly itemId: string; readonly quantity: number }[],
): string {
  const pokemonSummary = pokemon.length === 0 ? 'no Pokemon' : `${pokemon.length} Pokemon`;
  const itemSummary =
    items.length === 0
      ? 'no items'
      : items.map((item) => `${item.quantity} ${item.itemId}`).join(', ');
  return `${heading}: ${pokemonSummary}; ${itemSummary}.`;
}

function formatRaidTimer(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
