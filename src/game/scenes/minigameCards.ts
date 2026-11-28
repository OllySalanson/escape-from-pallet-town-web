import type Phaser from 'phaser';
import { GAME_FONT } from '../ui/gameFont';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { drawPixelWindow, WINDOW_INK, WINDOW_PAPER } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { isFigureSpecies, pokemonIconFrames, POKEMON_ICON_FRAME_MS, POKEMON_ICON_SIZE, POKEMON_ICON_TEXTURE } from '../world/pokemonFigures';
import type { PayLadder } from '../minigames/payLadder';
import type { Lineup } from '../minigames/whoPlays';

/**
 * What the harbour's minigames draw on their own canvas round the game
 * itself, now that no form stands before one (the harbour audit, 27 Nov 2026,
 * fault 3): the ready beat's plate - who plays, and the key to the list of
 * who else could - and the result card, the one place a game's pay ladder is
 * drawn. Both are the game's own pixel windows, drawn
 * in the scene, so no DOM screen opens over a game at all.
 */

/** Over everything a game draws, its own callouts included. */
export const CARD_DEPTH = 40;
const GOLD = 0xf8d040;
const GOLD_EDGE = 0x986808;
const GOOD_INK = '#287838';
const QUIET_INK = '#686868';

const text = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  words: string | string[],
  options: { readonly size?: string; readonly colour?: string; readonly wrap?: number; readonly origin?: [number, number] } = {},
): Phaser.GameObjects.Text =>
  scene.add
    .text(Math.round(x), Math.round(y), words, {
      fontFamily: GAME_FONT,
      fontSize: options.size ?? CHIP_FONT_SIZE,
      color: options.colour ?? WINDOW_INK,
      align: 'center',
      lineSpacing: 0,
      ...(options.wrap ? { wordWrap: { width: options.wrap } } : {}),
    })
    .setOrigin(...(options.origin ?? [0.5, 0]))
    .setScrollFactor(0);

/**
 * A key's arrow, as the games this one is dressed as draw one: a white
 * triangle with a dark rim, pointing the way the key goes. Drawn, never a
 * font's glyph, so it is the same at every zoom.
 */
export function drawKeyArrow(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  way: 'left' | 'right' | 'up' | 'down',
  size = 5,
  alpha = 1,
): void {
  const point = (s: number): [number, number, number, number, number, number] => {
    switch (way) {
      case 'left':
        return [x - s, y, x + s, y - s - 1, x + s, y + s + 1];
      case 'right':
        return [x + s, y, x - s, y - s - 1, x - s, y + s + 1];
      case 'up':
        return [x, y - s, x - s - 1, y + s, x + s + 1, y + s];
      case 'down':
        return [x, y + s, x - s - 1, y - s, x + s + 1, y - s];
    }
  };
  graphics.fillStyle(0x202030, alpha).fillTriangle(...point(size + 2));
  graphics.fillStyle(0xf8f8f8, alpha).fillTriangle(...point(size));
}

/** A gold ticket with notched ends, as THE PRIZE WINDOW prices things. */
function drawTicket(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, lit: boolean): void {
  const alpha = lit ? 1 : 0.35;
  graphics.fillStyle(GOLD_EDGE, alpha).fillRect(x, y, width, height);
  graphics.fillStyle(GOLD, alpha).fillRect(x + 1, y + 1, width - 2, height - 2);
  graphics.fillStyle(0xfff0a0, alpha).fillRect(x + 2, y + 2, width - 4, 1);
  // The notches.
  graphics.fillStyle(WINDOW_PAPER, 1).fillRect(x, y + Math.floor(height / 2) - 1, 2, 3).fillRect(x + width - 2, y + Math.floor(height / 2) - 1, 2, 3);
}

// --- the ready beat's plate -----------------------------------------------------------

export interface PlateView {
  readonly lineup: Lineup;
  /** Whether the list of who plays has somebody else, or another course, to choose: the plate names its key. */
  readonly canPick: boolean;
  /** THE DERBY's course. */
  readonly level?: { readonly name: string };
}

/** The plate's and the card's words for the key that opens the list of who plays (`readyBeat.PICK_KEY`). */
export const PICK_KEY_WORDS = 'P: who plays';

/**
 * The ready beat's plate: who plays, by their own party icons (bobbing, as
 * FireRed's party menu bobs them) and names, a star by one the game suits,
 * P's key when the list of who plays has another choice, and a bar under it
 * running down to the start. It goes the moment play does.
 */
export class ReadyPlate {
  private parts: Phaser.GameObjects.GameObject[] = [];
  private icons: { sprite: Phaser.GameObjects.Sprite; frames: readonly [number, number] }[] = [];
  private bar: Phaser.GameObjects.Graphics | undefined;
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private view: PlateView | undefined;
  private readonly scene: Phaser.Scene;
  private readonly top: number;
  private readonly depth: number;

  /** A plate whose top edge stands `top` pixels down the screen. */
  public constructor(scene: Phaser.Scene, top: number, depth = CARD_DEPTH) {
    this.scene = scene;
    this.top = top;
    this.depth = depth;
  }

  /** Everything the plate is drawn with, for a scene with a second camera to keep off its track. */
  public get objects(): readonly Phaser.GameObjects.GameObject[] {
    return this.parts;
  }

  public show(view: PlateView): void {
    this.destroy();
    this.view = view;
    const scene = this.scene;
    const width = scene.scale.width;
    const iconSize = POKEMON_ICON_SIZE;
    const names = text(scene, 0, 0, view.lineup.map((player) => player.name).join('  '), { wrap: width - 72 });
    const levelLine = view.level ? text(scene, 0, 0, view.level.name, { colour: QUIET_INK }) : undefined;
    const keyLine = view.canPick ? text(scene, 0, 0, PICK_KEY_WORDS, { colour: QUIET_INK }) : undefined;
    const lines = [levelLine, keyLine].filter((line): line is Phaser.GameObjects.Text => line !== undefined);
    const inner = Math.max(names.width, ...lines.map((line) => line.width), view.lineup.length * (iconSize + 2));
    const boxWidth = Math.round(inner + 20);
    const boxHeight = Math.round(iconSize + names.height + lines.reduce((sum, line) => sum + line.height + 1, 0) + 8);
    const x = Math.round((width - boxWidth) / 2);
    const y = this.top;
    this.box = { x, y, width: boxWidth, height: boxHeight };
    const frame = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    drawPixelWindow(frame, this.box, { fill: WINDOW_PAPER });
    this.parts.push(frame);
    const rowLeft = Math.round(width / 2 - (view.lineup.length * (iconSize + 2) - 2) / 2);
    const stars = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 2);
    view.lineup.forEach((player, index) => {
      const frames: readonly [number, number] = isFigureSpecies(player.species) ? pokemonIconFrames(player.species) : [0, 0];
      const sprite = scene.add
        .sprite(rowLeft + index * (iconSize + 2), y + 2, POKEMON_ICON_TEXTURE, frames[0])
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(this.depth + 1);
      this.icons.push({ sprite, frames });
      this.parts.push(sprite);
      if (player.suits) {
        // A small gold star at the icon's shoulder: the game suits this one.
        const sx = rowLeft + index * (iconSize + 2) + iconSize - 5;
        const sy = y + 6;
        stars.fillStyle(GOLD_EDGE, 1).fillRect(sx - 1, sy - 3, 3, 7).fillRect(sx - 3, sy - 1, 7, 3);
        stars.fillStyle(GOLD, 1).fillRect(sx, sy - 2, 1, 5).fillRect(sx - 2, sy, 5, 1);
      }
    });
    this.parts.push(stars);
    names.setPosition(Math.round(width / 2), y + iconSize + 2).setDepth(this.depth + 1);
    this.parts.push(names);
    let below = names.y + names.height + 1;
    for (const line of lines) {
      line.setPosition(Math.round(width / 2), below).setDepth(this.depth + 1);
      this.parts.push(line);
      below += line.height + 1;
    }
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 1);
    this.parts.push(this.bar);
    this.tick(1, scene.time.now);
  }

  /** The plate this frame: the bar at how much of the beat is left, the icons bobbing. */
  public tick(left: number, now: number): void {
    if (!this.view || !this.bar) return;
    const bob = Math.floor(now / POKEMON_ICON_FRAME_MS) % 2;
    for (const icon of this.icons) icon.sprite.setFrame(icon.frames[bob] ?? icon.frames[0]);
    const { x, y, width, height } = this.box;
    const bar = this.bar.clear();
    const full = width - 8;
    bar.fillStyle(0x202030, 0.6).fillRect(x + 4, y + height + 2, full, 3);
    bar.fillStyle(0xf8e070, 1).fillRect(x + 4, y + height + 2, Math.round(full * Math.max(0, Math.min(1, left))), 3);
  }

  public destroy(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    this.icons = [];
    this.bar = undefined;
    this.view = undefined;
  }
}

// --- the result card --------------------------------------------------------------------

export interface ResultView {
  /** The game's name, small, over the result. */
  readonly title: string;
  /** What the game came to: `SCORE 1,230`, `2ND of 6 in 0:41.20`. */
  readonly headline: string;
  /** Anything else the result opened: `THE SANDS is open!` */
  readonly news?: string;
  /** What came home, or that nothing did (`payLadder.wonLine`). */
  readonly won: string;
  readonly good: boolean;
  readonly ladder: PayLadder;
  /** The tickets the player holds after it. */
  readonly tickets: number;
  /** What SPACE plays next, when it is not simply the same again: `race THE SANDS`. */
  readonly again?: string;
  /** Whether P opens the list of who plays from here (`PlateView.canPick`). */
  readonly canPick: boolean;
}

/**
 * The result, over the game it ends, dimmed: the game's name, what it came
 * to, what came home, and the pay ladder - gold tickets under what each asks,
 * the ones today has reached lit, a berry beside them where the cabinet pays
 * one - then the tickets held and the keys. Returns every part, for the scene
 * to take down when it plays again or leaves.
 */
export function drawResultCard(scene: Phaser.Scene, view: ResultView, depth = CARD_DEPTH): Phaser.GameObjects.GameObject[] {
  const { width, height } = scene.scale;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const veil = scene.add.graphics().setScrollFactor(0).setDepth(depth);
  veil.fillStyle(0x101018, 0.55).fillRect(0, 0, width, height);
  parts.push(veil);
  const boxWidth = Math.min(width - 24, 296);
  const wrap = boxWidth - 20;
  const centre = Math.round(width / 2);
  const words: Phaser.GameObjects.Text[] = [];
  const title = text(scene, centre, 0, view.title, { colour: QUIET_INK });
  const headline = text(scene, centre, 0, view.headline, { size: DIALOG_FONT_SIZE, wrap });
  const news = view.news ? text(scene, centre, 0, view.news, { colour: GOOD_INK, wrap }) : undefined;
  const won = text(scene, centre, 0, view.won, { colour: view.good ? GOOD_INK : WINDOW_INK, wrap });
  words.push(title, headline, ...(news ? [news] : []), won);
  const rungs = view.ladder.rungs;
  const slots = rungs.length + (view.ladder.berryFrom ? 1 : 0);
  const slot = Math.floor(Math.min(64, wrap / Math.max(1, slots)));
  const asks = rungs.map((rung) => text(scene, 0, 0, rung.ask, { colour: rung.reached ? WINDOW_INK : QUIET_INK }));
  const berryAsk = view.ladder.berryFrom ? text(scene, 0, 0, view.ladder.berryFrom, { colour: QUIET_INK }) : undefined;
  const pays = rungs.map((rung) => text(scene, 0, 0, `+${rung.tickets}`, { colour: rung.reached ? WINDOW_INK : QUIET_INK }));
  const held = text(scene, centre, 0, `You hold ${view.tickets.toLocaleString('en-GB')} tickets`, { colour: QUIET_INK });
  const keys = text(scene, centre, 0, [`SPACE: ${view.again ?? 'again'}`, ...(view.canPick ? [PICK_KEY_WORDS] : []), 'ESC: leave'].join(' · '), { wrap });
  const askHeight = asks[0]?.height ?? 12;
  const ladderHeight = askHeight + 18;
  const stack = (part: Phaser.GameObjects.Text): number => part.height;
  const boxHeight = Math.round(
    8 + stack(title) + 2 + stack(headline) + 3 + (news ? stack(news) + 2 : 0) + stack(won) + 6 + ladderHeight + 6 + stack(held) + 2 + stack(keys) + 6,
  );
  const top = Math.max(4, Math.round((height - boxHeight) / 2));
  const frame = scene.add.graphics().setScrollFactor(0).setDepth(depth + 1);
  drawPixelWindow(frame, { x: Math.round((width - boxWidth) / 2), y: top, width: boxWidth, height: boxHeight }, { fill: WINDOW_PAPER });
  parts.push(frame);
  let y = top + 8;
  const place = (part: Phaser.GameObjects.Text, gap: number): void => {
    part.setPosition(centre, Math.round(y)).setDepth(depth + 2);
    y += part.height + gap;
  };
  place(title, 2);
  place(headline, 3);
  if (news) place(news, 2);
  place(won, 6);
  // The ladder: a ticket a rung, under what it asks.
  const tickets = scene.add.graphics().setScrollFactor(0).setDepth(depth + 2);
  const rowLeft = Math.round(centre - (slots * slot) / 2);
  rungs.forEach((rung, index) => {
    const middle = rowLeft + index * slot + Math.round(slot / 2);
    asks[index]?.setPosition(middle, Math.round(y)).setDepth(depth + 2);
    drawTicket(tickets, middle - 17, Math.round(y + askHeight + 1), 34, 15, rung.reached);
    pays[index]?.setPosition(middle, Math.round(y + askHeight + 2)).setDepth(depth + 3);
  });
  if (berryAsk) {
    const middle = rowLeft + rungs.length * slot + Math.round(slot / 2);
    berryAsk.setPosition(middle, Math.round(y)).setDepth(depth + 2);
    const berry = scene.add
      .image(middle, Math.round(y + askHeight + 9), iconTextureKey(itemIconName('oran-berry')))
      .setScrollFactor(0)
      .setDepth(depth + 2);
    parts.push(berry);
  }
  y += ladderHeight + 6;
  parts.push(tickets, ...asks, ...pays, ...(berryAsk ? [berryAsk] : []));
  place(held, 2);
  place(keys, 0);
  parts.push(...words, held, keys);
  return parts;
}

/** Takes a card or a plate's parts down. */
export function takeDown(parts: readonly Phaser.GameObjects.GameObject[]): void {
  for (const part of parts) part.destroy();
}
