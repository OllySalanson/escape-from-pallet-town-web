import Phaser from 'phaser';
import {
  nextTileFromDirection,
  planNextGridStep,
  type Direction,
  type GridBounds,
  type GridInputState,
  type GridPosition,
} from '../movement/gridMovement';
import { CHARACTER_FEET_PIXEL_Y, getIdleFrame, getWalkAnimationKey } from '../playerFrames';
import {
  worldCharacterTint,
  PLAYER_MARKER_DEPTH,
  PLAYER_MARKER_GROUND_LAYERS,
  PLAYER_MARKER_HEAD_LAYERS,
  type MarkerLayer,
} from '../world/characterPresentation';
import {
  CLASSIC_TILE,
  getWarpAt,
  getWorldMap,
  isTallGrassInMap,
  POND_TILES,
  TALL_GRASS_TINT,
  TREE_TILES,
  TREE_TINT,
  TILE_SIZE,
  WATER_TINT,
  WORLD_MAP_NAMES,
  type MapWarp,
  type WorldMapDefinition,
} from '../worldMap';
import { type WorldEntity } from '../world/npcs';
import { Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { DialogBox } from '../ui/DialogBox';
import { WORLD_ICONS, iconTextureKey } from '../ui/icons';
import { rollEncounter } from '../world/wildEncounters';
import { consumeTeachingEncounter } from '../world/teachingEncounter';
import { audioManager } from '../audio/AudioManager';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { Bag, ITEMS, type ItemId } from '../items';
import { completedObjectiveRewards } from '../objectives';
import { RunPhase } from '../run/RunManager';
import { buildExtractionReport, type ExtractionReport } from '../run/extractionReport';
import { buildRaidSettlement, deployedRaidCondition } from '../run/raidSettlement';
import { BASE_STAGE_WIDTH } from '../display/stage';
import { RaidHud } from '../ui/RaidHud';
import { WorldLabel, type WorldLabelTone } from '../ui/WorldLabel';
import { WINDOW_CREAM } from '../ui/pixelWindow';
import {
  OBJECTIVE_DETAIL_MS,
  hunterChipView,
  objectiveChipLines,
  raidClockAlertTier,
  raidClockView,
} from './raidHud';
import { createBattleReturnLocation, type ActiveRunSession, type RaidLocation } from '../run/RunSession';
import { FIRST_CONTRACT } from '../run/runGeneration';
import { createRunTrainerEncounters, type RunTrainerEncounter } from '../world/trainers';
import { getVisibleLoot, tryCollectLoot } from '../world/loot';
import { tryActivatePoi } from '../world/pois';
import {
  EXTRACTION_POINTS,
  extractionRequirementText,
  isExtractionAvailable,
  type ExtractionPoint,
} from '../world/extractionPoints';
import {
  findHunterPursuitPath,
  findHunterBreakawayTile,
  findHunterSpawnTile,
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
} from '../world/hunter';

const STEP_DURATION_MS = 130;
const CAMERA_ZOOM = 1;
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
/** Long enough for the extraction flash and shake to read before the result screen. */
const RUN_RESULT_DELAY_MS = 700;

/**
 * Map captions share the raid HUD's window, in a darker weight: screen furniture
 * is cream, world annotation is a tinted panel with a coloured frame. Each tone
 * keeps the colour the caption already carried, so nothing changes meaning.
 */
const LABEL_TONES: Readonly<Record<'station' | 'exitOpen' | 'exitShut' | 'route', WorldLabelTone>> = {
  station: { fill: 0x14243a, border: 0x7fb2e5, ink: '#dff0ff' },
  exitOpen: { fill: 0x123d22, border: 0x86efac, ink: '#dcfce7' },
  exitShut: { fill: 0x3d1414, border: 0xfca5a5, ink: '#fecaca' },
  route: { fill: 0x3a2408, border: 0xf1bf63, ink: '#fef3c7' },
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
  /** Fixed landmark activations persist only for the active raid. */
  readonly activatedPoiIds?: readonly string[];
  /** The hunter persists across battle returns during the active raid. */
  readonly hunterState?: HunterState;
  /** Exact overworld location to restore after a battle scene. */
  readonly returnLocation?: RaidLocation;
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
  /** Travel with the player so which figure is yours never has to be guessed. */
  private playerGroundMark!: Phaser.GameObjects.Graphics;
  private playerHeadMark!: Phaser.GameObjects.Graphics;
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
    readonly marker: Phaser.GameObjects.Image;
    readonly label: WorldLabel;
  }> = [];
  /** Every map caption, so each one can be kept inside the view each frame. */
  private worldLabels: WorldLabel[] = [];
  private raidHud: RaidHud | undefined;
  /** The cue the objective chip is currently showing, so a change can be noticed. */
  private objectiveCue = '';
  /** Counts down the window in which a changed objective shows its extra line. */
  private objectiveDetailMs = 0;
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
  private fieldKitMarker: Phaser.GameObjects.Image | undefined;
  private pendingTrainerBattle:
    | {
        readonly trainer: RunTrainerEncounter['trainer'];
        readonly introLines: readonly string[];
        readonly isHunter: boolean;
      }
    | undefined;
  private hunterState: HunterState = createHunterState();
  private timerThreat: 'normal' | 'urgent' | 'enraged' = 'normal';

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
    this.pendingHubTransition = false;
    // Set on the way to the result screen, and read by handleRunResolutionComplete
    // to keep a dialogue from completing past it - so it is exactly the shape of
    // flag that froze the second raid, and belongs on this list.
    this.pendingResultScreen = false;
    this.pendingTrainerBattle = undefined;
    this.isWarping = false;
    this.targetTile = null;
    this.stepProgress = 0;
    this.facing = 'down';
    this.caughtPokemonStash = [];
    this.extractionMarkers = [];
    this.timerThreat = 'normal';
  }

  public create(data: WorldSceneData = {}): void {
    this.resetStateFromPreviousRaid();
    this.runSession = data.runSession;
    if (!this.runSession) {
      this.restoreSavedGame(data.savedGame);
    } else if (data.returnLocation) {
      this.currentMap = getWorldMap(data.returnLocation.mapId);
      this.currentTile = { ...data.returnLocation.position };
      this.facing = data.returnLocation.facing;
    } else if (this.runSession.plan) {
      this.currentMap = getWorldMap(this.runSession.plan.insertion.mapId);
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
    if (data.pokeBalls !== undefined) {
      this.pokeBalls = data.pokeBalls;
      this.syncPokeBallsToBag();
    }
    if (data.caughtPokemonStash) {
      this.caughtPokemonStash = data.caughtPokemonStash;
    }
    this.defeatedTrainerIds.clear();
    data.defeatedTrainerIds?.forEach((id) => this.defeatedTrainerIds.add(id));
    this.collectedLootIds.clear();
    data.collectedLootIds?.forEach((id) => this.collectedLootIds.add(id));
    this.activatedPoiIds.clear();
    data.activatedPoiIds?.forEach((id) => this.activatedPoiIds.add(id));
    this.trainerEncounters = this.runSession
      ? (this.runSession.plan?.trainers ?? createRunTrainerEncounters())
      : [];
    this.hunterState = data.hunterState ?? createHunterState();
    this.createMap();
    this.applyPendingHunterBreakaway();
    this.createEntities();
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
  }

  public update(_time: number, deltaMs: number): void {
    this.clampWorldLabels();
    if (Phaser.Input.Keyboard.JustDown(this.controls.objectives)) {
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
    // Water has to look like water: without this the Floodplain Relay's flood,
    // and Pallet Town's pond, render as green fields with invisible walls.
    groundLayer.forEachTile((tile) => {
      if (POND_TILES.has(tile.index)) {
        tile.tint = WATER_TINT;
      }
    });
    // Hedges, trees and tall grass are drawn from the same leafy art, so on a
    // map made mostly of both the player cannot see which is a wall. Darkening
    // the solid growth and keeping the grass bright is the difference.
    detailLayer.forEachTile((tile) => {
      if (TREE_TILES.has(tile.index)) {
        tile.tint = TREE_TINT;
      }
    });
    tallGrassLayer.forEachTile((tile) => {
      if (tile.index >= 0) {
        tile.tint = TALL_GRASS_TINT;
      }
    });
    this.mapObjects.push(groundLayer, tallGrassLayer, detailLayer);
    this.createExtractionPoints();
    this.createRouteTransitionLabels();
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
        .setDepth(3 + point.position.y / 1000);
      const label = new WorldLabel(
        this,
        x,
        y - 11,
        `EXTRACT ${isOpen ? 'OPEN' : extractionRequirementText(point, this.runSession.manager.snapshot().elapsedMs)}`,
        isOpen ? LABEL_TONES.exitOpen : LABEL_TONES.exitShut,
        4 + point.position.y / 1000,
      );
      this.mapObjects.push(marker);
      this.worldLabels.push(label);
      this.extractionMarkers.push({ point, marker, label });
    }
  }


  private createEntities(): void {
    this.createLoot();
    this.createPois();
    this.createFieldKit();

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
        .setTint(worldCharacterTint('npc'))
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
        .setTint(worldCharacterTint('trainer'))
        .setDepth(2 + encounter.position.y / 1000);
      this.npcSprites.set(encounter.trainer.id, sprite);
      this.mapObjects.push(sprite);
    }

    this.createHunterSprite();
  }

  private createFieldKit(): void {
    const session = this.runSession;
    const contract = session?.plan?.contract;
    if (
      !contract ||
      session.manager.snapshot().recoveredFieldKit ||
      contract.mapId !== this.currentMap.id
    ) {
      return;
    }

    const marker = this.add
      .image(
        contract.position.x * TILE_SIZE + TILE_SIZE / 2,
        contract.position.y * TILE_SIZE + TILE_SIZE / 2,
        iconTextureKey(WORLD_ICONS.fieldKit),
      )
      .setDepth(3 + contract.position.y / 1000);
    this.fieldKitMarker = marker;
    this.mapObjects.push(marker);
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
          iconTextureKey(WORLD_ICONS.supplyCrate),
        )
        .setDepth(3 + loot.position.y / 1000);
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
      const station = this.add.container(x, y).setDepth(3 + poi.position.y / 1000);
      // A radio landmark and a supply landmark are different objects, so they
      // are drawn as different things rather than one shared box.
      station.add(
        this.add.image(
          0,
          0,
          iconTextureKey(
            poi.effect === 'activate-radio' ? WORLD_ICONS.radioMast : WORLD_ICONS.supplyCache,
          ),
        ),
      );
      const label = new WorldLabel(
        this,
        x,
        y - 12,
        `${poi.label}\n${poi.effect === 'unlock-extraction'
          ? `${poi.unlockedExtractionLabel ?? 'EXIT'}: SEALED`
          : `CACHE: ${formatPoiReward(poi)}`}`,
        LABEL_TONES.station,
        4 + poi.position.y / 1000,
      );
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
        new WorldLabel(
          this,
          warp.source.x * TILE_SIZE + TILE_SIZE,
          warp.source.y * TILE_SIZE - 1,
          `${WORLD_MAP_NAMES[warp.destinationMapId].toUpperCase()} ${this.warpArrow(warp)}`,
          LABEL_TONES.route,
          5 + warp.source.y / 1000,
        ),
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
    const position = this.hunterState.position!;
    const sprite = this.add
      .sprite(
        position.x * TILE_SIZE,
        position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET,
        'character',
        getIdleFrame('down'),
      )
      .setOrigin(0, 0)
      .setTint(worldCharacterTint('hunter'))
      .setDepth(2 + position.y / 1000);
    this.npcSprites.set('rival-hunter', sprite);
    this.mapObjects.push(sprite);
  }

  private createSign(entity: WorldEntity): void {
    const sign = this.add
      .image(
        entity.position.x * TILE_SIZE + TILE_SIZE / 2,
        entity.position.y * TILE_SIZE + TILE_SIZE / 2,
        iconTextureKey(WORLD_ICONS.signPost),
      )
      .setDepth(2 + entity.position.y / 1000);
    this.mapObjects.push(sign);
  }

  private createPlayer(): void {
    this.player = this.add.sprite(0, 0, 'character', getIdleFrame(this.facing)).setOrigin(0, 0);
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
    const depth = 2 + (y - PLAYER_SPRITE_Y_OFFSET) / TILE_SIZE / 1000;
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
      textStyle: { fontSize: '14px' },
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
    this.refreshRunTimerHud();
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
    const navigationCue = this.firstContractNavigationCue(snapshot.recoveredFieldKit)
      ?? session.objectives.find((objective) => !objective.progress(snapshot).complete)?.description
      ?? 'EXTRACT WITH YOUR HAUL';
    if (navigationCue !== this.objectiveCue) {
      this.objectiveCue = navigationCue;
      this.objectiveDetailMs = OBJECTIVE_DETAIL_MS;
    } else {
      this.objectiveDetailMs = Math.max(0, this.objectiveDetailMs - deltaMs);
    }

    if (manager.isEnraged) {
      if (this.timerThreat !== 'enraged') {
        this.timerThreat = 'enraged';
        this.cameras.main.flash(160, 239, 68, 68, false);
        audioManager.playLowHpWarning();
      }
    } else {
      const tier = raidClockAlertTier(snapshot.remainingMs);
      if (tier !== this.timerThreat) {
        this.timerThreat = tier;
        this.cameras.main.flash(120, 251, 191, 36, false);
        audioManager.playLowHpWarning();
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
        hunter: hunterChipView({
          searching: isHunterSearching(this.hunterState),
          searchRemainingMs: this.hunterState.searchRemainingMs,
          distance: this.hunterStepsAway(),
          direction: this.hunterBearing(),
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
    if (this.tryActivatePoiAt(targetTile)) {
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

  private openObjectives(): void {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun || this.pendingHubTransition) {
      return;
    }

    this.scene.pause();
    this.scene.launch('objectives', {
      runSession: this.runSession,
      currentMapId: this.currentMap.id,
      currentPosition: this.currentTile,
      activatedPoiIds: [...this.activatedPoiIds],
      pausedWorld: true,
    });
  }

  private firstContractNavigationCue(recoveredFieldKit: boolean): string | undefined {
    const contract = this.runSession?.plan?.contract;
    if (!contract || recoveredFieldKit) {
      return undefined;
    }
    if (this.currentMap.id !== contract.mapId) {
      return `TRAVEL TO ${WORLD_MAP_NAMES[contract.mapId].toUpperCase()}`;
    }
    return `LOST KIT: ${directionTo(this.currentTile, contract.position)}`;
  }

  private showFirstDeploymentBriefing(): void {
    const session = this.runSession;
    if (!session?.plan?.contract || session.firstDeploymentBriefingShown) {
      return;
    }
    session.firstDeploymentBriefingShown = true;
    this.dialogBox.showMessage(
      'ARROW KEYS / WASD: move. The field kit is SOUTH - fast road or west reeds. Press O for the FIELD GUIDE.',
    );
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

    this.setPlayerPosition(
      Phaser.Math.Linear(this.stepStart.x, this.stepEnd.x, this.stepProgress),
      Phaser.Math.Linear(this.stepStart.y, this.stepEnd.y, this.stepProgress),
    );

    if (this.stepProgress < 1 || !this.targetTile) {
      return;
    }

    this.currentTile = { ...this.targetTile };
    this.targetTile = null;
    this.setPlayerPosition(this.stepEnd.x, this.stepEnd.y);
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
    if (this.tryRecoverFieldKitAt(this.currentTile)) {
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

    const encounters = this.encountersForCurrentMap();
    if (isTallGrassInMap(this.currentMap, this.currentTile) && encounters) {
      const rng = this.runSession?.rng;
      // The authored teaching fight replaces the first roll of a first-contract
      // raid, so a new player's opening battle is winnable and explicable.
      const teaching = consumeTeachingEncounter(this.runSession);
      const wild =
        teaching ?? rollEncounter(encounters, rng === undefined ? undefined : () => rng.next());
      if (wild) {
        audioManager.playEncounter();
        this.transitionToBattle({
          wild,
          teachingBattle: teaching !== null,
          party: this.party,
          pokeBalls: this.bag.count('poke-ball'),
          caughtPokemonStash: this.caughtPokemonStash,
          runSession: this.runSession,
          collectedLootIds: [...this.collectedLootIds],
          activatedPoiIds: [...this.activatedPoiIds],
          returnLocation: this.returnLocation(),
        });
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

  private transitionToBattle(data: object): void {
    this.isWarping = true;
    this.player.stop();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('battle', data);
    });
  }

  private clearMap(): void {
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    this.worldLabels.forEach((label) => label.destroy());
    this.worldLabels = [];
    this.npcSprites.clear();
    this.lootSprites.clear();
    this.poiSprites.clear();
    this.poiLabels.clear();
    this.fieldKitMarker = undefined;
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
   * A caption belongs to a thing on the map, but it is read on a screen: one
   * near the edge of the view used to be cut in half by it.
   */
  private clampWorldLabels(): void {
    if (this.worldLabels.length === 0) {
      return;
    }
    const view = this.cameras.main.worldView;
    for (const label of this.worldLabels) {
      label.clampInto(view.left, view.right);
    }
  }

  private isLootAvailable(): boolean {
    return this.runSession?.manager.phase === RunPhase.InRun;
  }

  private tryCollectLootAt(position: GridPosition): boolean {
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
      return false;
    }
    if (result === 'bag-full') {
      this.dialogBox.showMessage('Bag is full!');
      return true;
    }

    const marker = this.lootSprites.get(loot!.id);
    this.cameras.main.flash(100, 250, 204, 21, false);
    audioManager.playLootPickup();
    marker?.destroy();
    this.lootSprites.delete(loot!.id);
    const item = ITEMS[loot!.itemId];
    const quantity = loot!.quantity > 1 ? ` x${loot!.quantity}` : '';
    this.dialogBox.showMessage(`Found ${item.displayName}${quantity}!`);
    return true;
  }

  private tryActivatePoiAt(position: GridPosition): boolean {
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
      return false;
    }
    if (result === 'bag-full') {
      this.dialogBox.showMessage('Bag is full. The marked cache remains sealed.');
      return true;
    }

    this.poiSprites.get(poi!.id)?.destroy();
    this.poiSprites.delete(poi!.id);
    this.removeWorldLabel(this.poiLabels.get(poi!.id));
    this.poiLabels.delete(poi!.id);
    this.cameras.main.flash(140, 56, 189, 248, false);
    audioManager.playLootPickup();
    const reward = poi!.reward
      .map(({ itemId, quantity }) => `${quantity}× ${ITEMS[itemId].displayName}`)
      .join(' + ');
    if (poi!.effect === 'unlock-extraction') {
      const exit = poi!.unlockedExtractionLabel ?? 'A NEW EXIT';
      this.dialogBox.showMessages([
        `${poi!.label}: ${exit} is open.`,
        this.rangerForecast(),
        ...(reward ? [`${reward} secured. Extract to bank it.`] : []),
      ]);
      this.refreshExtractionMarkers();
      return true;
    }
    this.dialogBox.showMessage(
      `${poi!.label}: ${reward} secured. Detour reward is LOST ON WIPE - extract to bank it.`,
    );
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

  private tryRecoverFieldKitAt(position: GridPosition): boolean {
    const session = this.runSession;
    const contract = session?.plan?.contract;
    if (
      !contract ||
      session.manager.snapshot().recoveredFieldKit ||
      contract.mapId !== this.currentMap.id ||
      contract.position.x !== position.x ||
      contract.position.y !== position.y
    ) {
      return false;
    }

    session.manager.recoverFieldKit();
    this.fieldKitMarker?.destroy();
    this.fieldKitMarker = undefined;
    this.cameras.main.flash(120, 96, 165, 250, false);
    audioManager.playLootPickup();
    this.dialogBox.showMessage('Recovered the lost field kit! Extract to secure it.');
    this.refreshRunTimerHud();
    return true;
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

  private encountersForCurrentMap() {
    return this.runSession?.plan?.encounters[this.currentMap.id] ?? this.currentMap.encounters;
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

  /**
   * @returns Whether this step ended the raid, or was spent on a locked exit,
   *   so the caller stops rather than rolling anything else into the same tick.
   */
  private tryExtract(): boolean {
    if (!this.runSession || this.runSession.manager.phase !== RunPhase.InRun) {
      return false;
    }

    const point = this.extractionPointsForCurrentMap().find(
      (candidate) =>
        candidate.position.x === this.currentTile.x && candidate.position.y === this.currentTile.y,
    );
    if (!point) {
      return false;
    }

    if (!this.isExtractionOpen(point)) {
      this.dialogBox.showMessage(
        `${point.label} is LOCKED: ${extractionRequirementText(point, this.runSession.manager.snapshot().elapsedMs)}.`,
      );
      return true;
    }

    this.runSession.manager.resolveEscape();
    this.destroyRunTimerHud();
    this.cameras.main.flash(240, 134, 239, 172, false);
    this.cameras.main.shake(120, 0.004);
    audioManager.playExtract();
    const snapshot = this.runSession.manager.snapshot();
    // The first contract's permanent reward is granted atomically below, rather
    // than as a repeatable per-run objective item.
    const objectiveRewards = snapshot.recoveredFieldKit
      ? []
      : completedObjectiveRewards(this.runSession.objectives, snapshot);
    // Loot found in the field is already in the bag, so it comes home through
    // the settlement's supply delta. Only rewards granted at base are banked
    // separately, or the same antidote would arrive twice.
    const runResult = { pokemon: snapshot.caughtPokemon, items: objectiveRewards };
    // What the raid itself cost, settled the same way whichever ending fires.
    const settlement = buildRaidSettlement(
      this.runSession.broughtPokemonIds,
      snapshot,
      this.bag.toJSON(),
    );
    const contractResult = snapshot.recoveredFieldKit
      ? new SaveManager().bankFirstContractRun(runResult, settlement)
      : { saved: new SaveManager().bankRun(runResult, settlement), granted: false };
    this.pendingHubTransition = true;
    this.showRunResult(
      buildExtractionReport({
        outcome: 'ESCAPED',
        snapshot,
        durationMs: snapshot.durationMs,
        exitLabel: point.label,
        // The contract's Super Potion is granted by the save rather than by the
        // run, so the report is handed exactly what the stash received.
        banked: {
          pokemon: runResult.pokemon,
          items: [
            ...snapshot.foundItems,
            ...objectiveRewards,
            ...(contractResult.granted ? [{ itemId: 'super-potion', quantity: 1 }] : []),
          ],
        },
        ...(snapshot.recoveredFieldKit
          ? {
            contract: {
              description: FIRST_CONTRACT.description,
              complete: true,
              reward: contractResult.granted
                ? 'Three more insertions are permanently unlocked, and a Super Potion is waiting at base.'
                : 'Already banked on an earlier raid, so there is no new unlock this time.',
            },
          }
          : {}),
        carriedOut: this.bag.toJSON(),
        saved: contractResult.saved,
      }),
    );
    return true;
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

    const snapshot = this.runSession.manager.tick(deltaMs);
    this.advanceHunterSearch(deltaMs);
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
        `EXTRACT ${isOpen ? 'OPEN' : extractionRequirementText(point, this.runSession?.manager.snapshot().elapsedMs ?? 0)}`,
        isOpen ? LABEL_TONES.exitOpen : LABEL_TONES.exitShut,
      );
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
    audioManager.playWipe();
    const saved = new SaveManager().applyWipeLoss(
      this.runSession.broughtPokemonIds,
      this.runSession.broughtItems,
      this.runSession.stashSecureSlot,
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
        lost: { pokemon: result.lostPokemon, items: result.lostItems },
        carriedOut: this.bag.toJSON(),
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
      this.transitionToBattle({
        trainer: battle.trainer,
        party: this.party,
        pokeBalls: this.bag.count('poke-ball'),
        caughtPokemonStash: this.caughtPokemonStash,
        runSession: this.runSession,
        defeatedTrainerIds: [...this.defeatedTrainerIds],
        collectedLootIds: [...this.collectedLootIds],
        activatedPoiIds: [...this.activatedPoiIds],
        returnLocation: this.returnLocation(),
        hunterBattle: battle.isHunter,
        hunterState: this.hunterState,
      });
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
      this.dialogBox.showMessage('A RIVAL HUNTER is on your trail!');
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
    const sprite = this.npcSprites.get('rival-hunter');
    sprite
      ?.setPosition(position.x * TILE_SIZE, position.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET)
      .setDepth(2 + position.y / 1000);
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
      findHunterBreakawayTile(this.hunterState.position, this.currentTile, this.bounds, (tile) =>
        this.isBlockedForHunter(tile),
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
    audioManager.playLowHpWarning();
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
    this.dialogBox.showMessages([...this.pendingTrainerBattle.introLines]);
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

function directionTo(from: GridPosition, to: GridPosition): string {
  const horizontal = to.x === from.x ? '' : to.x > from.x ? 'E' : 'W';
  const vertical = to.y === from.y ? '' : to.y > from.y ? 'S' : 'N';
  const direction = `${vertical}${horizontal}`;
  return direction || 'HERE';
}

function formatPoiReward(poi: { readonly reward: readonly { readonly itemId: ItemId; readonly quantity: number }[] }): string {
  return poi.reward
    .map(({ itemId, quantity }) => `${quantity}× ${ITEMS[itemId].displayName.toUpperCase()}`)
    .join(' + ');
}
