import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { SaveManager, type SaveSummary } from '../save/SaveManager';
import { getStarterSpecies } from '../stash';
import { GAME_FONT } from '../ui/gameFont';
import { drawMenuCursor, drawPixelWindow, WINDOW_CREAM, WINDOW_INK } from '../ui/pixelWindow';
import {
  eraseMenu,
  layoutTitleMenu,
  moveTitleChoice,
  needsEraseConfirmation,
  titleMenu,
  type TitleChoiceId,
  type TitleMenu,
} from '../ui/titleMenu';
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
/** A choice that would do nothing: dimmer than the cream window, and its words with it. */
const DISABLED_FILL = 0xc3c29d;
const DISABLED_INK = '#75745f';

/** One row of the plate: what it says and the size it is set at. */
const TITLE_LINE_SIZE = '37px';

export class TitleScene extends Phaser.Scene {
  private hasStarted = false;
  /** The key hint under the menu; it pulses until something is chosen. */
  private prompt!: Phaser.GameObjects.Text;
  private built: Phaser.GameObjects.GameObject[] = [];
  private readonly saveManager = new SaveManager();
  private summary: SaveSummary = { kind: 'none' };
  private menu: TitleMenu = titleMenu({ kind: 'none' });
  private choice: TitleChoiceId = 'new';
  private redrawPending = false;

  public constructor() {
    super('title');
  }

  public create(): void {
    this.hasStarted = false;
    this.redrawPending = false;
    // Asked once per visit, not per frame: the summary reads the whole save.
    this.summary = this.saveManager.describe();
    this.menu = titleMenu(this.summary);
    this.choice = this.menu.initial;
    this.build();

    const relayout = () => this.rebuild();
    this.scale.on?.(Phaser.Scale.Events.RESIZE, relayout);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', () => this.chooseSelected());
    keyboard?.on('keydown-SPACE', () => this.chooseSelected());
    keyboard?.on('keydown-UP', () => this.moveCursor(-1));
    keyboard?.on('keydown-DOWN', () => this.moveCursor(1));
    keyboard?.on('keydown-W', () => this.moveCursor(-1));
    keyboard?.on('keydown-S', () => this.moveCursor(1));
    keyboard?.on('keydown-ESC', () => this.backOut());
    keyboard?.on('keydown-M', () => audioManager.toggleMute());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off?.(Phaser.Scale.Events.RESIZE, relayout);
      keyboard?.removeAllListeners();
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
    this.createMenu(width, height, plateBottom);
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

  /**
   * The choices, on the game's cream window, with the drawn menu cursor beside
   * the one the keys are on. What each says and where it sits is
   * `ui/titleMenu.ts`; this only paints it. A choice that would do nothing is
   * drawn dim and gives the cursor nothing to land on, so a first-time player
   * sees CONTINUE is not there rather than being offered it.
   */
  private createMenu(width: number, height: number, plateBottom: number): void {
    const layout = layoutTitleMenu(this.menu, width, height, plateBottom);
    if (this.menu.question && layout.question) {
      this.track(
        this.add
          .text(layout.question.x, layout.question.y, this.menu.question, {
            align: 'center',
            color: TITLE_MAIN,
            fontFamily: GAME_FONT,
            fontSize: DIALOG_FONT_SIZE,
          })
          .setOrigin(0.5)
          .setDepth(11),
      );
    }
    for (const row of layout.rows) {
      const choice = this.menu.choices.find((candidate) => candidate.id === row.id)!;
      const selected = row.id === this.choice && choice.enabled;
      const bar = this.add.graphics().setDepth(10);
      drawPixelWindow(bar, row, { fill: !choice.enabled ? DISABLED_FILL : selected ? MINT : WINDOW_CREAM });
      this.track(bar);
      if (selected) {
        const cursor = this.add.graphics().setDepth(11);
        drawMenuCursor(cursor, row.x + 6, row.y + Math.round(row.height / 2) - 2, 0x202020);
        this.track(cursor);
      }
      const ink = choice.enabled ? WINDOW_INK : DISABLED_INK;
      const labelY = choice.detail ? row.y + 11 : row.y + Math.round(row.height / 2);
      this.track(
        this.add
          .text(row.x + Math.round(row.width / 2), labelY, choice.label, {
            align: 'center',
            color: ink,
            fontFamily: GAME_FONT,
            fontSize: DIALOG_FONT_SIZE,
          })
          .setOrigin(0.5)
          .setDepth(11),
      );
      if (choice.detail) {
        this.track(
          this.add
            .text(row.x + Math.round(row.width / 2), row.y + 24, choice.detail, {
              align: 'center',
              color: ink,
              fontFamily: GAME_FONT,
              fontSize: CHIP_FONT_SIZE,
            })
            .setOrigin(0.5)
            .setDepth(11),
        );
      }
      if (choice.enabled) {
        const hit = this.add
          .zone(row.x, row.y, row.width, row.height)
          .setOrigin(0, 0)
          .setDepth(12)
          .setInteractive({ useHandCursor: true });
        hit.on(Phaser.Input.Events.POINTER_OVER, () => this.pointTo(row.id));
        hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
          this.choice = row.id;
          this.chooseSelected();
        });
        this.track(hit);
      }
    }
    this.prompt = this.track(
      this.add
        .text(layout.hint.x, layout.hint.y, this.menu.question ? 'ESC KEEPS IT' : 'UP DOWN CHOOSE · SPACE SELECT', {
          align: 'center',
          color: TAGLINE,
          fontFamily: GAME_FONT,
          fontSize: CHIP_FONT_SIZE,
        })
        .setOrigin(0.5)
        .setDepth(11),
    );
  }

  private pointTo(choice: TitleChoiceId): void {
    if (this.hasStarted || this.choice === choice) {
      return;
    }
    this.choice = choice;
    this.redraw();
  }

  /**
   * Draws the menu again on the next tick. It is asked for from a pointer
   * handler, and a redraw destroys the very zone that raised the event - so it
   * waits for the handler to finish rather than pulling the object out from
   * under it.
   */
  private redraw(): void {
    if (this.redrawPending) {
      return;
    }
    this.redrawPending = true;
    this.time.delayedCall(0, () => {
      this.redrawPending = false;
      this.rebuild();
    });
  }

  private moveCursor(step: -1 | 1): void {
    if (this.hasStarted) {
      return;
    }
    const next = moveTitleChoice(this.menu, this.choice, step);
    if (next !== this.choice) {
      this.choice = next;
      audioManager.play('select');
      this.redraw();
    }
  }

  /** Escape on the erase question is the answer that keeps the save. */
  private backOut(): void {
    if (this.hasStarted || !this.menu.question) {
      return;
    }
    this.showMenu(titleMenu(this.summary), 'new');
  }

  private showMenu(menu: TitleMenu, choice: TitleChoiceId): void {
    this.menu = menu;
    this.choice = choice;
    this.redraw();
  }

  private chooseSelected(): void {
    if (this.hasStarted) {
      return;
    }
    if (this.choice === 'continue') {
      this.startGame('continue');
    } else if (this.choice === 'new') {
      if (needsEraseConfirmation(this.summary)) {
        // The key that opened the game is still held down, so the question
        // starts on the answer that changes nothing.
        audioManager.play('confirm');
        const menu = eraseMenu();
        this.showMenu(menu, menu.initial);
      } else {
        this.startGame('new');
      }
    } else if (this.choice === 'keep') {
      this.backOut();
    } else {
      this.startGame('new');
    }
  }

  private startGame(mode: 'continue' | 'new'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    void this.playStartAudio();
    this.prompt.setText('READY!');
    this.time.delayedCall(180, () => {
      if (mode === 'new') {
        // Only reached once the erase question has been answered, or when there
        // was nothing to erase.
        this.saveManager.clear();
        this.scene.start('starter');
        return;
      }
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
