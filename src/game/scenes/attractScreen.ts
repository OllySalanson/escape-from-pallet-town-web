import type Phaser from 'phaser';
import type { AttractPlayer, ResultCard } from '../minigames/attract';
import { GAME_FONT } from '../ui/gameFont';
import { drawPixelWindow, WINDOW_INK, WINDOW_PAPER } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';

/** PRESS SPACE is lit this long, and dark this long, round and round. */
const BLINK_ON_MS = 560;
const BLINK_OFF_MS = 360;
/** Drawn over everything a game draws, the result card over the rest of the screen. */
const DEPTH = 60;
const OUTLINE = '#202030';
const GOLD = '#f8e070';
/** The rows of a pay table the card has room for. */
const PAY_ROWS = 4;
/** A dark ink for a row the result reached, a grey one for a row it did not. */
const REACHED_INK = '#206838';
const UNREACHED_INK = '#909098';

/** Where on the screen the attract screen's parts stand. */
export interface AttractLayout {
  /** The part of the screen the game is played in: the title and the result card are centred over it. */
  readonly area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Where the plate naming who plays stands: its top corner, and which corner. */
  readonly plate: { readonly x: number; readonly y: number; readonly from: 'left' | 'right' };
  /** How far down the area the title stands, 0 to 1. */
  readonly titleAt?: number;
  /** How far down the area PRESS SPACE stands, 0 to 1: under the title, unless the game needs the room there. */
  readonly pressAt?: number;
}

/** What the plate says: who plays, whether more can be swapped in, and for a team how many more go and whether that can change. */
export interface AttractPlate {
  readonly lead: AttractPlayer | undefined;
  readonly others: number;
  /** Whether LEFT and RIGHT have anybody else to bring on. */
  readonly swaps: boolean;
  /** Whether UP and DOWN change how many go, or (THE DERBY) which course. */
  readonly sizes: boolean;
  /** A word more under the name: THE DERBY's course. */
  readonly note?: string;
}

/**
 * The words and windows an attract screen draws over a game's own demo
 * (`minigames/attract.ts`): the game's name, a blinking PRESS SPACE, a plate
 * naming who plays with an arrow either side when somebody else can, and,
 * after a game, the result card with the pay table on it. Everything stands
 * still on the screen while the game's own camera moves, and everything is
 * made once, so a scene with a second camera can be told once what to leave
 * out (`objects`).
 */
export class AttractScreen {
  private readonly title: Phaser.GameObjects.Text;
  private readonly press: Phaser.GameObjects.Text;
  private readonly keys: Phaser.GameObjects.Text;
  private readonly plateBack: Phaser.GameObjects.Graphics;
  private readonly plateName: Phaser.GameObjects.Text;
  private readonly plateNote: Phaser.GameObjects.Text;
  private readonly card: Phaser.GameObjects.Graphics;
  private readonly cardHeadline: Phaser.GameObjects.Text;
  private readonly cardBest: Phaser.GameObjects.Text;
  private readonly cardWon: Phaser.GameObjects.Text;
  private readonly cardAsks: Phaser.GameObjects.Text[] = [];
  private readonly cardPays: Phaser.GameObjects.Text[] = [];
  private shown = true;
  private result: ResultCard | null = null;
  private plate: AttractPlate = { lead: undefined, others: 0, swaps: false, sizes: false };

  private readonly layout: AttractLayout;

  public constructor(scene: Phaser.Scene, name: string, keys: string, layout: AttractLayout) {
    this.layout = layout;
    const words = (size: string, colour: string, stroke = 3): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: size, color: colour, stroke: OUTLINE, strokeThickness: stroke, lineSpacing: 0 })
        .setScrollFactor(0)
        .setDepth(DEPTH + 1);
    const ink = (size: string, colour = WINDOW_INK): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: size, color: colour, lineSpacing: 0 })
        .setScrollFactor(0)
        .setDepth(DEPTH + 3);
    const { area } = layout;
    const middle = Math.round(area.x + area.width / 2);
    this.title = words(DIALOG_FONT_SIZE, GOLD, 3)
      .setText(name)
      .setOrigin(0.5, 0.5)
      .setPosition(middle, Math.round(area.y + area.height * (layout.titleAt ?? 0.4)));
    // Twice the size where it fits, as a cabinet's marquee is; a whole number either way, so the face stays sharp.
    this.title.setScale(this.title.width * 2 <= area.width - 12 ? 2 : 1);
    this.press = words(DIALOG_FONT_SIZE, '#f8f8f8', 3)
      .setText('PRESS SPACE')
      .setOrigin(0.5, 0.5)
      .setPosition(
        middle,
        layout.pressAt === undefined ? Math.round(this.title.y + this.title.displayHeight / 2 + 14) : Math.round(area.y + area.height * layout.pressAt),
      );
    this.keys = words(CHIP_FONT_SIZE, '#f8f8f8', 3)
      .setText(keys)
      .setOrigin(0.5, 1)
      .setPosition(middle, area.y + area.height - 2);
    this.plateBack = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    this.plateName = ink(CHIP_FONT_SIZE);
    this.plateNote = ink(CHIP_FONT_SIZE, '#686878');
    this.card = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
    this.cardHeadline = ink(DIALOG_FONT_SIZE).setOrigin(0.5, 0);
    this.cardBest = ink(CHIP_FONT_SIZE, '#c03878').setOrigin(0.5, 0).setText('NEW BEST!');
    this.cardWon = ink(CHIP_FONT_SIZE, REACHED_INK).setOrigin(0.5, 0).setAlign('center');
    for (let row = 0; row < PAY_ROWS; row += 1) {
      this.cardAsks.push(ink(CHIP_FONT_SIZE).setOrigin(0, 0));
      this.cardPays.push(ink(CHIP_FONT_SIZE).setOrigin(1, 0));
    }
    this.draw();
  }

  /** Every object the screen draws, for a scene whose other camera must leave them out. */
  public objects(): Phaser.GameObjects.GameObject[] {
    return [
      this.title,
      this.press,
      this.keys,
      this.plateBack,
      this.plateName,
      this.plateNote,
      this.card,
      this.cardHeadline,
      this.cardBest,
      this.cardWon,
      ...this.cardAsks,
      ...this.cardPays,
    ];
  }

  /** Who plays, as the plate says it. */
  public setPlate(plate: AttractPlate): void {
    this.plate = plate;
    this.draw();
  }

  /** The last game's result, shown over the demo until the next game starts; null takes it down. */
  public setResult(result: ResultCard | null): void {
    this.result = result;
    this.draw();
  }

  /** Shows the screen over the demo, or takes it off for a game played. */
  public setShown(shown: boolean): void {
    this.shown = shown;
    this.draw();
  }

  /** PRESS SPACE blinks on the scene's own clock. */
  public update(now: number): void {
    if (!this.shown) return;
    this.press.setVisible(now % (BLINK_ON_MS + BLINK_OFF_MS) < BLINK_ON_MS);
  }

  public destroy(): void {
    for (const part of this.objects()) part.destroy();
  }

  private draw(): void {
    const shown = this.shown;
    const result = shown ? this.result : null;
    this.title.setVisible(shown && !result);
    this.press.setVisible(shown);
    this.keys.setVisible(shown);
    this.drawPlate(shown);
    this.drawCard(result);
  }

  private drawPlate(shown: boolean): void {
    const plate = this.plate;
    this.plateBack.clear();
    const lead = plate.lead;
    this.plateName.setVisible(shown && lead !== undefined);
    const note = lead ? [plate.others > 0 ? `+${plate.others}` : '', lead.lent ? 'LENT' : '', plate.note ?? ''].filter(Boolean).join(' ') : '';
    this.plateNote.setVisible(shown && note !== '');
    if (!shown || !lead) return;
    this.plateName.setText(lead.name);
    this.plateNote.setText(note);
    // Room either side of the name for the arrows that swap it, and under it for the note.
    const arrow = plate.swaps ? 9 : 0;
    const width = Math.max(this.plateName.width, note ? this.plateNote.width : 0) + 10 + arrow * 2;
    const height = 6 + this.plateName.height + (note ? this.plateNote.height : 0);
    const { x: anchorX, y, from } = this.layout.plate;
    const x = Math.round(from === 'left' ? anchorX : anchorX - width);
    drawPixelWindow(this.plateBack, { x, y, width, height }, { fill: WINDOW_PAPER });
    this.plateName.setPosition(x + 5 + arrow, y + 3);
    this.plateNote.setPosition(x + 5 + arrow, y + 3 + this.plateName.height);
    const middle = y + Math.round(height / 2);
    if (plate.swaps) {
      // The arrows the face has none of, drawn: LEFT and RIGHT bring on somebody else.
      this.plateBack.fillStyle(0xd03838, 1);
      this.plateBack.fillTriangle(x + 3, middle, x + 8, middle - 4, x + 8, middle + 4);
      this.plateBack.fillTriangle(x + width - 3, middle, x + width - 8, middle - 4, x + width - 8, middle + 4);
    }
    if (plate.sizes) {
      // UP and DOWN: one more, one fewer.
      const cx = x + width - 5 - arrow - 4;
      const top = y + 3 + this.plateName.height + 2;
      this.plateBack.fillStyle(0x3868c0, 1);
      this.plateBack.fillTriangle(cx - 3, top + 3, cx + 3, top + 3, cx, top);
      this.plateBack.fillTriangle(cx - 3, top + 5, cx + 3, top + 5, cx, top + 8);
    }
  }

  private drawCard(result: ResultCard | null): void {
    this.card.clear();
    const parts = [this.cardHeadline, this.cardBest, this.cardWon, ...this.cardAsks, ...this.cardPays];
    for (const part of parts) part.setVisible(false);
    if (!result) return;
    const { area } = this.layout;
    this.cardHeadline.setText(result.headline).setVisible(true);
    this.cardWon.setText(result.won.join('\n'));
    const rows = result.table.slice(0, PAY_ROWS);
    rows.forEach((row, index) => {
      this.cardAsks[index]?.setText(row.asks);
      this.cardPays[index]?.setText(row.pays);
    });
    // As wide as what it says, and never wider than the game's window.
    const widest = Math.max(
      this.cardHeadline.width,
      this.cardWon.width,
      ...rows.map((_row, index) => (this.cardAsks[index]?.width ?? 0) + (this.cardPays[index]?.width ?? 0) + 18),
    );
    const width = Math.min(area.width - 16, Math.max(150, Math.round(widest) + 24));
    const middle = Math.round(area.x + area.width / 2);
    const x = Math.round(middle - width / 2);
    let y = 6;
    const headlineAt = y;
    y += this.cardHeadline.height;
    const bestAt = y;
    if (result.newBest) y += this.cardBest.height;
    const wonAt = y;
    y += this.cardWon.height + 4;
    const tableAt = y;
    const rowHeight = this.cardAsks[0]?.height ?? 12;
    y += rows.length * rowHeight + 4;
    const height = y;
    const top = Math.round(area.y + Math.max(4, (area.height - height) / 2 - 10));
    drawPixelWindow(this.card, { x, y: top, width, height }, { fill: WINDOW_PAPER });
    this.cardHeadline.setPosition(middle, top + headlineAt);
    this.cardBest.setVisible(result.newBest).setPosition(middle, top + bestAt);
    this.cardWon.setVisible(true).setPosition(middle, top + wonAt);
    // The pay table, under a rule: a row the result reached in the dark ink with a ticket by it, the rest in grey.
    this.card.fillStyle(0xc8c8d0, 1).fillRect(x + 6, top + tableAt - 3, width - 12, 1);
    rows.forEach((row, index) => {
      const rowY = top + tableAt + index * rowHeight;
      const colour = row.reached ? REACHED_INK : UNREACHED_INK;
      this.cardAsks[index]?.setColor(colour).setPosition(x + 16, rowY).setVisible(true);
      this.cardPays[index]?.setColor(colour).setPosition(x + width - 8, rowY).setVisible(true);
      const tick = rowY + Math.round(rowHeight / 2);
      this.card.fillStyle(row.reached ? 0xe0a818 : 0xd8d8e0, 1).fillRect(x + 7, tick - 3, 6, 5);
      if (row.reached) this.card.fillStyle(0xf8e880, 1).fillRect(x + 8, tick - 2, 4, 1);
    });
  }
}
