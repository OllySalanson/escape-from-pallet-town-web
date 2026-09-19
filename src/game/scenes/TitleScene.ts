import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { getStarterSpecies } from '../stash';
import { GAME_FONT } from '../ui/gameFont';
import { drawPixelWindow, WINDOW_CREAM, WINDOW_INK } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { TILE_SIZE, WORLD_MAPS, type WorldMapDefinition } from '../worldMap';

/**
 * The picture behind the title is the game itself: a crop of the Floodplain
 * Relay's own map - Market Isle standing in its river - drawn through the same
 * layers and tints the raid uses, under dusk. Nothing here is new art, so the
 * first screen cannot disagree with the ones after it.
 */
const BACKDROP_MAP = 'floodplain-relay';
/** The crop, in tiles: the isle, its quay and the reach of river round it. */
const CROP = { x: 17, y: 26, width: 26, height: 17 } as const;
const DUSK = 0x0a1428;
const DUSK_ALPHA = 0.5;
const PLATE_FILL = 0x0f1f33;
const PLATE_ALPHA = 0.94;
const MINT = 0x8ed4c2;

const TITLE_TOP = '#8ed4c2';
const TITLE_MAIN = '#f8f5d7';
const TAGLINE = '#9bb4c6';

/** One row of the plate: what it says and the size it is set at. */
const TITLE_LINE_SIZE = '37px';

export class TitleScene extends Phaser.Scene {
  private hasStarted = false;
  private prompt!: Phaser.GameObjects.Text;
  private built: Phaser.GameObjects.GameObject[] = [];
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('title');
  }

  public create(): void {
    this.hasStarted = false;
    this.build();

    const relayout = () => this.rebuild();
    this.scale.on?.(Phaser.Scale.Events.RESIZE, relayout);
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard?.on('keydown-M', () => audioManager.toggleMute());
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.startGame());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off?.(Phaser.Scale.Events.RESIZE, relayout);
      audioManager.stopTheme();
    });
  }

  public update(time: number): void {
    if (this.hasStarted) {
      return;
    }
    const pulse = (Math.sin(time / 260) + 1) / 2;
    this.prompt.setAlpha(0.7 + pulse * 0.3);
  }

  private rebuild(): void {
    const label = this.hasStarted ? this.prompt.text : null;
    for (const object of this.built) {
      object.destroy();
    }
    this.built = [];
    this.build();
    if (label) {
      this.prompt.setText(label);
    }
  }

  /** Drawn to the live screen size, on whole pixels. */
  private build(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.drawBackdrop(width, height);
    const plateBottom = this.createTitle(width, height);
    this.createPrompt(width, height, plateBottom);
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.built.push(object);
    return object;
  }

  /**
   * The crop is centred on the screen, and a screen smaller than it simply
   * shows less of the river - the tiles are never scaled, so they stay whole.
   */
  private drawBackdrop(width: number, height: number): void {
    const map: WorldMapDefinition = WORLD_MAPS[BACKDROP_MAP];
    const tilemap = this.make.tilemap({
      width: CROP.width,
      height: CROP.height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const sheets = map.tileset.sources.map((source) => {
      const sheet = tilemap.addTilesetImage(
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

    const backing = this.add.graphics().setDepth(-1);
    backing.fillStyle(DUSK, 1);
    backing.fillRect(0, 0, width, height);
    this.track(backing);

    const originX = Math.floor((width - CROP.width * TILE_SIZE) / 2);
    const originY = Math.floor((height - CROP.height * TILE_SIZE) / 2);
    const { ground, overlay, detail, canopy } = map.layers;
    const layers = { ground, overlay, detail, canopy };
    let depth = 0;
    for (const [name, layer] of Object.entries(layers)) {
      const created = tilemap.createBlankLayer(name, sheets, originX, originY);
      if (!created) {
        throw new Error(`Tilemap layer '${name}' failed to initialize.`);
      }
      created.putTilesAt(
        layer.tiles.slice(CROP.y, CROP.y + CROP.height).map((row) => row.slice(CROP.x, CROP.x + CROP.width)),
        0,
        0,
      );
      created.forEachTile((tile) => {
        const tint = layer.tints[CROP.y + tile.y]?.[CROP.x + tile.x] ?? -1;
        if (tint >= 0) {
          tile.tint = tint;
        }
      });
      created.setDepth(depth);
      depth += 1;
      this.track(created);
    }
    this.track(tilemap as unknown as Phaser.GameObjects.GameObject);

    // A screen larger than the crop shows dusk beyond it, and the crop is dimmed with it.
    const dusk = this.add.graphics().setDepth(depth);
    dusk.fillStyle(DUSK, DUSK_ALPHA);
    dusk.fillRect(originX, originY, CROP.width * TILE_SIZE, CROP.height * TILE_SIZE);
    this.track(dusk);
  }

  /** The name, on a plate. Returns the plate's bottom edge. */
  private createTitle(width: number, height: number): number {
    const top = Math.round(height * 0.07);
    const plateHeight = Math.round(height * 0.38);
    const plateWidth = Math.min(width - 32, 264);
    const left = Math.floor((width - plateWidth) / 2);
    const plate = this.add.graphics().setDepth(10);
    drawPixelWindow(plate, { x: left, y: top, width: plateWidth, height: plateHeight }, {
      fill: PLATE_FILL,
      fillAlpha: PLATE_ALPHA,
    });
    // A mint rule inside the frame, one pixel in from it, as the lobby's title bar is ruled.
    plate.lineStyle(1, MINT, 1);
    plate.strokeRect(left + 4.5, top + 4.5, plateWidth - 9, plateHeight - 9);
    this.track(plate);

    const centre = Math.floor(width / 2);
    const style = (color: string, fontSize: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      align: 'center',
      color,
      fontFamily: GAME_FONT,
      fontSize,
    });
    const rows = [
      [0.24, 'ESCAPE FROM', style(TITLE_TOP, DIALOG_FONT_SIZE)],
      [0.5, 'PALLET TOWN', style(TITLE_MAIN, TITLE_LINE_SIZE)],
      [0.78, 'A RAID ON THE DROWNED RIVER TOWN', style(TAGLINE, CHIP_FONT_SIZE)],
    ] as const;
    for (const [at, text, textStyle] of rows) {
      this.track(this.add.text(centre, top + Math.round(plateHeight * at), text, textStyle).setOrigin(0.5).setDepth(11));
    }
    return top + plateHeight;
  }

  /** The one key, said out loud, on the game's cream window. */
  private createPrompt(width: number, height: number, plateBottom: number): void {
    const barHeight = 22;
    const barWidth = Math.min(width - 32, 200);
    const left = Math.floor((width - barWidth) / 2);
    const top = Math.min(height - 24 - barHeight, Math.max(plateBottom + 16, Math.round(height * 0.8)));
    const bar = this.add.graphics().setDepth(10);
    drawPixelWindow(bar, { x: left, y: top, width: barWidth, height: barHeight }, { fill: WINDOW_CREAM });
    this.track(bar);
    this.prompt = this.track(
      this.add
        .text(Math.floor(width / 2), top + Math.round(barHeight / 2), 'PRESS SPACE TO BEGIN', {
          align: 'center',
          color: WINDOW_INK,
          fontFamily: GAME_FONT,
          fontSize: DIALOG_FONT_SIZE,
        })
        .setOrigin(0.5)
        .setDepth(11),
    );
  }

  private startGame(): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    void this.playStartAudio();
    this.prompt.setAlpha(1);
    this.prompt.setText('READY!');
    this.time.delayedCall(180, () => {
      const savedGame = this.loadOrCreateGame();
      this.scene.start(savedGame ? 'hub' : 'starter', savedGame ? { savedGame } : undefined);
    });
  }

  private loadOrCreateGame() {
    const savedGame = this.saveManager.load();
    if (savedGame) {
      if (savedGame.stash.ensurePlayable(
        savedGame.starterSpeciesId ? getStarterSpecies(savedGame.starterSpeciesId) : undefined,
      )) {
        this.saveManager.save(savedGame);
      }
      return savedGame;
    }
    return null;
  }

  private async playStartAudio(): Promise<void> {
    await audioManager.activate();
    void audioManager.startTheme('title');
    audioManager.play('confirm');
  }
}
