import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import { feedbackTabOverGame } from '../feedback/feedbackTabCover';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { GAME_FONT } from '../ui/gameFont';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { bookNamed, type LibraryBook } from '../library/books';
import { resolveBookText } from '../library/bookText';
import { secretsBookOpens } from '../library/secretsBookLock';
import { SaveManager } from '../save/SaveManager';
import {
  HEADING_ROOM,
  bookLayout,
  bookLeaves,
  lineWidth,
  type BookLayout,
  type BookLeaf,
} from '../library/bookLayout';
import {
  PAGE_INK,
  paintBackdrop,
  paintBook,
  paintGutter,
  paintHeadingRule,
  paintPaper,
  paintPlinth,
  paintTitlePlate,
  type Painter,
} from '../library/bookArt';
import { LEAF_STRIPS, PAGE_TURN_MS, leafPose, leafSides, leafStrip, type TurnDirection } from '../library/pageTurn';

export interface LibraryBookSceneData {
  /** Which book (`library/books.ts`). */
  readonly bookId: string;
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
  /** The spread to open at: kept when the window is resized under an open book. */
  readonly spread?: number;
}

interface Turn {
  readonly direction: TurnDirection;
  elapsed: number;
}

/** How tall one line of a heading is drawn; a heading taller than this has wrapped. */
const HEADING_LINE = 18;

/** The words that say how to work the book, on the plinth's front. */
const HINT = resolveBookText('{key:walk} or click a page to turn');

/**
 * A book from THE GREAT LIBRARY, read full screen: lying open on a wooden
 * plinth in a dark reading room, two pages at a time, the next spread brought
 * over by a page that lifts at the spine, curls and lays down on the far side.
 *
 * Opened over the paused harbour by facing a lectern (`BaseScene`), and closed
 * back onto the same spot. What is drawn is worked out elsewhere and only
 * placed here: the layout for this window (`library/bookLayout.ts`), the art
 * (`library/bookArt.ts`), the words (`library/books.ts`) and the turn
 * (`library/pageTurn.ts`). Each side of the book is drawn once into a texture
 * of its own, so a turning page is that page's own pixels in strips.
 *
 * The right arrow, D, SPACE or ENTER (or a click on the right page) turns on;
 * the left arrow, A or BACKSPACE (or a click on the left page) turns back; ESC
 * closes. A press while a page is still going over is kept for when it lands,
 * so the book can be leafed through as fast as the keys are pressed.
 */
export class LibraryBookScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private book: LibraryBook | undefined;
  private pausedBase = false;
  private layout!: BookLayout;
  private leaves: readonly BookLeaf[] = [];
  private pageKeys: string[] = [];
  private spread = 0;
  private turn: Turn | null = null;
  private queued: TurnDirection | null = null;
  private leftPage!: Phaser.GameObjects.Image;
  private rightPage!: Phaser.GameObjects.Image;
  private strips: Phaser.GameObjects.Image[] = [];
  private leafShade!: Phaser.GameObjects.Graphics;
  private closeHint!: Phaser.GameObjects.Text;
  private closing = false;
  private static opened = 0;

  public constructor() {
    super('library-book');
  }

  public init(data: LibraryBookSceneData): void {
    this.book = bookNamed(data.bookId);
    this.pausedBase = data.pausedBase;
    this.spread = Math.max(0, data.spread ?? 0);
    this.turn = null;
    this.queued = null;
    this.closing = false;
    this.strips = [];
    this.pageKeys = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.forgetPages());
  }

  public create(): void {
    // A book on a locked plinth never opens, whoever asks (`secretsBookLock.ts`).
    if (!this.book || (this.book.plinth === 'golden' && !secretsBookOpens(new SaveManager().load()?.raidProgress))) {
      this.close();
      return;
    }
    recordAction(`Opened ${this.book.title} in the GREAT LIBRARY`);
    const { width, height } = this.cameras.main;
    // The FEEDBACK tab stands over the canvas's right edge: the book keeps off it.
    const tab = feedbackTabOverGame(this.game.canvas, this.scale.gameSize);
    this.layout = bookLayout(width, height, tab ? width - tab.x : 0);
    this.leaves = bookLeaves(this.book);
    this.spread = Math.min(this.spread, this.leaves.length / 2 - 1);

    const room = this.add.graphics();
    paintBackdrop(painterFor(room), width, height);
    const plinth = this.add.graphics();
    paintPlinth(painterFor(plinth), this.layout, this.book.plinth === 'golden' ? 'golden' : 'wood');
    const body = this.add.graphics();
    paintBook(painterFor(body), this.layout, this.book.colour);

    this.drawPages(this.book);
    const { left, right } = this.layout;
    this.leftPage = this.add.image(left.x, left.y, this.pageKeys[this.spread * 2]).setOrigin(0, 0);
    this.rightPage = this.add.image(right.x, right.y, this.pageKeys[this.spread * 2 + 1]).setOrigin(0, 0);
    const gutter = this.add.graphics();
    paintGutter(painterFor(gutter), this.layout);
    for (let index = 0; index < LEAF_STRIPS; index += 1) {
      this.strips.push(this.add.image(0, 0, this.pageKeys[0]).setOrigin(0, 0).setVisible(false));
    }
    this.leafShade = this.add.graphics();

    // How to work it, on a plate on the plinth's front, and a CLOSE a pointer can press beside it.
    const plate = { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8e8c8', backgroundColor: '#402818', padding: { x: 3, y: 1 } };
    const hintY = Math.min(height - 16, this.layout.plinth.y + 17);
    this.add.text(Math.round(width / 2), hintY, HINT, plate).setOrigin(0.5, 0);
    this.closeHint = this.add
      .text(width - 6, hintY, resolveBookText('{key:back} CLOSE'), plate)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize));
    audioManager.play('pageTurn');
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'GREAT LIBRARY book' },
      { label: 'Book', value: this.book?.title ?? 'none' },
      { label: 'Spread', value: `${this.spread + 1} of ${this.leaves.length / 2}` },
    ];
  }

  /** For a playtest driver: which spread is open, and whether a page is going over. */
  public get reading(): { readonly book: string; readonly spread: number; readonly spreads: number; readonly turning: boolean } {
    return { book: this.book?.id ?? '', spread: this.spread, spreads: this.leaves.length / 2, turning: this.turn !== null };
  }

  /** For a playtest driver: turn as a key would. */
  public turnPage(direction: TurnDirection): void {
    this.requestTurn(direction);
  }

  public update(_time: number, delta: number): void {
    if (!this.turn) {
      return;
    }
    this.turn.elapsed += delta;
    if (this.turn.elapsed >= PAGE_TURN_MS) {
      this.land(this.turn.direction);
      return;
    }
    this.drawLeaf(this.turn);
  }

  // --- the pages -------------------------------------------------------------

  /** Every side of the book, each into a texture of its own, once. */
  private drawPages(book: LibraryBook): void {
    const { left } = this.layout;
    const opening = ++LibraryBookScene.opened;
    this.leaves.forEach((leaf, index) => {
      const side = index % 2 === 0 ? 'left' : 'right';
      const key = `library-page-${opening}-${index}`;
      const texture = this.textures.addDynamicTexture(key, left.width, left.height);
      if (!texture) {
        return;
      }
      const paper = this.make.graphics({}, false);
      paintPaper(painterFor(paper), left.width, left.height, side);
      texture.draw(paper, 0, 0);
      paper.destroy();
      this.drawLeafWords(texture, leaf, side, book);
      this.pageKeys.push(key);
    });
  }

  private drawLeafWords(texture: Phaser.Textures.DynamicTexture, leaf: BookLeaf, side: 'left' | 'right', book: LibraryBook): void {
    const { words, left } = this.layout;
    const x0 = side === 'left' ? words.outer : words.inner;
    const width = lineWidth(this.layout);
    const middle = x0 + Math.floor(width / 2);
    const write = (text: string, x: number, y: number, size: string, colour: string, originX = 0, wrap = width): number => {
      const object = this.make
        .text({ x: 0, y: 0, text, style: { fontFamily: GAME_FONT, fontSize: size, color: colour, wordWrap: { width: wrap }, lineSpacing: size === '14px' ? 2 : 1, align: originX === 0 ? 'left' : 'center' } }, false)
        .setOrigin(0, 0);
      texture.draw(object, Math.round(x - object.width * originX), y);
      const height = object.height;
      object.destroy();
      return height;
    };
    // Ornaments are laid on the paper before the words that sit on them.
    const ornament = (draw: (paint: Painter) => void): void => {
      const graphics = this.make.graphics({}, false);
      draw(painterFor(graphics));
      texture.draw(graphics, 0, 0);
      graphics.destroy();
    };
    const body = `${this.layout.body.size}px`;
    if (leaf.kind === 'title') {
      write('THE GREAT LIBRARY', middle, words.top, CHIP_FONT_SIZE, PAGE_INK.faint, 0.5);
      const plateY = Math.round(left.height * 0.3);
      ornament((paint) => paintTitlePlate(paint, x0, plateY, width, 26, book.colour));
      write(book.title, middle, plateY + 6, DIALOG_FONT_SIZE, '#f8f0d8', 0.5);
      write(book.blurb, middle, plateY + 36, body, PAGE_INK.body, 0.5);
      write(resolveBookText('Click a page or press {key:walk} to turn.'), middle, left.height - words.bottom - 14, CHIP_FONT_SIZE, PAGE_INK.faint, 0.5);
    } else if (leaf.kind === 'end') {
      const rule = Math.round(left.height * 0.45);
      write('THE END', middle, rule - 22, DIALOG_FONT_SIZE, PAGE_INK.heading, 0.5);
      ornament((paint) => paintHeadingRule(paint, x0 + 16, rule, width - 32, book.colour));
      write(resolveBookText('Press {key:back} to close the book.'), middle, rule + 10, CHIP_FONT_SIZE, PAGE_INK.faint, 0.5);
    } else {
      // A heading that runs to two lines pushes the rule and the words down with it.
      const headingHeight = write(leaf.page.heading, x0, words.top, DIALOG_FONT_SIZE, PAGE_INK.heading);
      const below = Math.max(0, headingHeight - HEADING_LINE);
      ornament((paint) => paintHeadingRule(paint, x0, words.top + 17 + below, width, book.colour));
      write(resolveBookText(leaf.page.text), x0, words.top + HEADING_ROOM + below, body, PAGE_INK.body);
      write(String(leaf.number), middle, left.height - words.bottom + 4, CHIP_FONT_SIZE, PAGE_INK.faint, 0.5);
    }
  }

  private forgetPages(): void {
    for (const key of this.pageKeys) {
      if (this.textures.exists(key)) this.textures.remove(key);
    }
    this.pageKeys = [];
  }

  // --- turning ---------------------------------------------------------------

  private requestTurn(direction: TurnDirection): void {
    if (this.closing) {
      return;
    }
    if (this.turn) {
      this.queued = direction;
      return;
    }
    const spreads = this.leaves.length / 2;
    const next = this.spread + (direction === 'forward' ? 1 : -1);
    if (next < 0 || next >= spreads) {
      audioManager.play('denied');
      return;
    }
    // What lies under the turning page: on the side it leaves, the next spread
    // shows as it lifts; on the side it lands, the old page stays until covered.
    if (direction === 'forward') {
      this.rightPage.setTexture(this.pageKeys[next * 2 + 1]);
    } else {
      this.leftPage.setTexture(this.pageKeys[next * 2]);
    }
    this.turn = { direction, elapsed: 0 };
    audioManager.play('pageTurn');
    this.drawLeaf(this.turn);
  }

  private land(direction: TurnDirection): void {
    this.spread += direction === 'forward' ? 1 : -1;
    this.leftPage.setTexture(this.pageKeys[this.spread * 2]);
    this.rightPage.setTexture(this.pageKeys[this.spread * 2 + 1]);
    this.strips.forEach((strip) => strip.setVisible(false));
    this.leafShade.clear();
    this.turn = null;
    const queued = this.queued;
    this.queued = null;
    if (queued) {
      this.requestTurn(queued);
    }
  }

  /** The turning page, a strip at a time, and its shade and the shadow it casts. */
  private drawLeaf(turn: Turn): void {
    const pose = leafPose(turn.elapsed);
    const sides = leafSides(turn.direction);
    const side = pose.onStartSide ? sides.start : sides.end;
    const old = this.spread;
    const next = old + (turn.direction === 'forward' ? 1 : -1);
    // The face that shows: the page lifted while it is over its own side, its back once it is over.
    const face =
      turn.direction === 'forward'
        ? pose.onStartSide
          ? this.pageKeys[old * 2 + 1]
          : this.pageKeys[next * 2]
        : pose.onStartSide
          ? this.pageKeys[old * 2]
          : this.pageKeys[next * 2 + 1];
    const { spineX, left } = this.layout;
    this.leafShade.clear();
    let outerEdge = spineX;
    this.strips.forEach((strip, index) => {
      const place = leafStrip(pose, side, index, spineX, left.width, left.height);
      if (place.width <= 0 || place.sourceWidth <= 0) {
        strip.setVisible(false);
        return;
      }
      const scale = place.width / place.sourceWidth;
      strip
        .setTexture(face)
        .setCrop(place.sourceX, 0, place.sourceWidth, left.height)
        .setScale(scale, 1)
        .setPosition(Math.round(place.x - place.sourceX * scale), left.y - place.rise)
        .setVisible(true);
      // Darker the further it stands up from the page, and towards its outer edge.
      const shade = pose.shade * (0.35 + 0.65 * place.reach);
      if (shade > 0.02) {
        this.leafShade.fillStyle(0x281808, shade);
        this.leafShade.fillRect(place.x, left.y - place.rise, place.width, left.height);
      }
      outerEdge = side === 'right' ? Math.max(outerEdge, place.x + place.width) : Math.min(outerEdge, place.x);
    });
    // The shadow it throws across the page beneath, just past its edge.
    const shadow = Math.round(10 * pose.lift);
    if (shadow > 0) {
      this.leafShade.fillStyle(0x000000, 0.18 * pose.lift);
      const x = side === 'right' ? outerEdge : outerEdge - shadow;
      const clipped = side === 'right' ? Math.min(shadow, spineX + left.width - x) : Math.min(shadow, x + shadow - (spineX - left.width));
      if (clipped > 0) {
        this.leafShade.fillRect(side === 'right' ? x : outerEdge - clipped, left.y, clipped, left.height);
      }
    }
  }

  // --- input -----------------------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    if (event.repeat && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
      case ' ':
      case 'Enter':
        event.preventDefault();
        this.requestTurn('forward');
        return;
      case 'ArrowLeft':
      case 'a':
      case 'A':
      case 'Backspace':
        event.preventDefault();
        this.requestTurn('back');
        return;
      case 'Escape':
        event.preventDefault();
        this.close();
        return;
      default:
    }
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.layout || this.closing) {
      return;
    }
    if (this.closeHint.getBounds().contains(pointer.x, pointer.y)) {
      this.close();
      return;
    }
    this.requestTurn(pointer.x >= this.layout.spineX ? 'forward' : 'back');
  }

  private readonly onResize = (): void => {
    if (this.closing || !this.book) {
      return;
    }
    this.scene.restart({ bookId: this.book.id, pausedBase: this.pausedBase, spread: this.spread } satisfies LibraryBookSceneData);
  };

  private close(): void {
    if (this.closing || !this.scene.isActive('library-book')) {
      return;
    }
    this.closing = true;
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}

/** A Graphics object as the art's painter: every rectangle on whole pixels. */
function painterFor(graphics: Phaser.GameObjects.Graphics): Painter {
  return {
    rect(x, y, width, height, colour, alpha = 1) {
      if (width <= 0 || height <= 0) return;
      graphics.fillStyle(colour, alpha);
      graphics.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    },
  };
}
