import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { GAME_FONT } from '../ui/gameFont';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_INK, WINDOW_INK_VALUE, WINDOW_PAPER } from '../ui/pixelWindow';
import { isFigureSpecies, pokemonIconFrames, POKEMON_ICON_FRAME_MS, POKEMON_ICON_TEXTURE } from '../world/pokemonFigures';
import { countWord, counted, splitCount, type CountSplit, type CountWord } from '../minigames/readyCount';
import type { TicketLadder } from '../minigames/ticketLadder';

/**
 * The start line and the result every harbour game shares, drawn on the
 * game's own canvas over its own field (the harbour audit of 27 Nov 2026,
 * fault 3: a cabinet opened on a form). Nothing on either is a sentence:
 *
 * - **The start line** (`ReadySetGo`): READY, 3, 2, 1, GO! as FireRed's
 *   minigames count in, over a card with the Pokémon that plays shown big,
 *   arrows either side of it when somebody else could, and the game's one
 *   control drawn as a picture - its key cap, pressed in time with a little
 *   loop of what it does (a hop over a vine, a beak closing on a berry, a
 *   spade going in).
 * - **The key strip** (`KeyStrip`): the same caps, small, along the foot of
 *   the screen while the game is played, each one dipping as it is pressed.
 * - **The result** (`ResultCard`): what the game came to, the tickets it won,
 *   and the game's pay table once - its tiers as lamps along a bar filled as
 *   far as this result reached, lit for what today has paid.
 *
 * The timing is `minigames/readyCount.ts`, the pay table
 * `minigames/ticketLadder.ts`; this file only draws them.
 */

const INK = WINDOW_INK_VALUE;
const GOLD = 0xf8d040;
const GOLD_DARK = 0xb08018;
const SHADE = 0xc8c0a8;
const CAP_FACE = 0xf8f8f0;
const CAP_SIDE = 0x9890a0;
const LIT = 0x58c048;

/** A key as drawn: the space bar, an arrow, or ESC. */
export type Cap = 'space' | 'left' | 'up' | 'right' | 'down' | 'esc';

const CAP_HEIGHT = 15;
const capWidth = (cap: Cap): number => (cap === 'space' ? 40 : cap === 'esc' ? 24 : 15);

/** Text in the game's own type, pixel-crisp. */
function words(scene: Phaser.Scene, x: number, y: number, text: string, options: { big?: boolean; colour?: string; stroke?: boolean; scale?: number } = {}): Phaser.GameObjects.Text {
  const made = scene.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: GAME_FONT,
    fontSize: options.big ? DIALOG_FONT_SIZE : CHIP_FONT_SIZE,
    color: options.colour ?? WINDOW_INK,
    ...(options.stroke ? { stroke: '#202030', strokeThickness: 3 } : {}),
  });
  if (options.scale) made.setScale(options.scale);
  return made;
}

/**
 * One key cap: a face over its side, the face pushed down when pressed. An
 * arrow is drawn on the face; SPACE and ESC say their name, as the keys do.
 */
class KeyCap {
  public readonly width: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text | undefined;
  private readonly cap: Cap;
  private readonly x: number;
  private readonly y: number;
  private down = false;

  public constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, cap: Cap, x: number, y: number) {
    this.cap = cap;
    this.x = x;
    this.y = y;
    this.width = capWidth(cap);
    this.graphics = scene.add.graphics();
    parent.add(this.graphics);
    if (cap === 'space' || cap === 'esc') {
      this.label = words(scene, x + this.width / 2, y + 1, cap === 'space' ? 'SPACE' : 'ESC').setOrigin(0.5, 0);
      parent.add(this.label);
    }
    this.draw();
  }

  public press(down: boolean): void {
    if (down === this.down) return;
    this.down = down;
    this.draw();
  }

  private draw(): void {
    const { x, y, width } = this;
    const sink = this.down ? 2 : 0;
    const g = this.graphics.clear();
    // The cap's side, then its face over it: pressed, the face sits on the side.
    g.fillStyle(INK, 1).fillRect(x + 1, y, width - 2, CAP_HEIGHT).fillRect(x, y + 1, width, CAP_HEIGHT - 2);
    g.fillStyle(CAP_SIDE, 1).fillRect(x + 1, y + 1, width - 2, CAP_HEIGHT - 2);
    g.fillStyle(this.down ? GOLD : CAP_FACE, 1).fillRect(x + 2, y + 1 + sink, width - 4, CAP_HEIGHT - 5);
    this.label?.setY(y + sink);
    const cx = Math.round(x + width / 2);
    const cy = y + 6 + sink;
    g.fillStyle(INK, 1);
    if (this.cap === 'up') g.fillTriangle(cx - 4, cy + 2, cx + 4, cy + 2, cx, cy - 3);
    if (this.cap === 'down') g.fillTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
    if (this.cap === 'left') g.fillTriangle(cx + 2, cy - 4, cx + 2, cy + 4, cx - 3, cy);
    if (this.cap === 'right') g.fillTriangle(cx - 2, cy - 4, cx - 2, cy + 4, cx + 3, cy);
  }
}

/** The caps a key is drawn as, for a key event: SPACE and ENTER are the space bar, W A S D the arrows. */
export function capOf(key: string): Cap | null {
  const letter = key.length === 1 ? key.toLowerCase() : key;
  if (letter === ' ' || letter === 'Enter' || letter === 'z') return 'space';
  if (letter === 'ArrowLeft' || letter === 'a') return 'left';
  if (letter === 'ArrowRight' || letter === 'd') return 'right';
  if (letter === 'ArrowUp' || letter === 'w') return 'up';
  if (letter === 'ArrowDown' || letter === 's') return 'down';
  if (letter === 'Escape' || letter === 'Backspace') return 'esc';
  return null;
}

/** A gold ticket with notched ends, as the PRIZE WINDOW's are. */
function drawTicket(g: Phaser.GameObjects.Graphics, x: number, y: number, width = 18, height = 11): void {
  g.fillStyle(INK, 1).fillRect(x, y, width, height);
  g.fillStyle(GOLD, 1).fillRect(x + 1, y + 1, width - 2, height - 2);
  g.fillStyle(GOLD_DARK, 1).fillRect(x + 4, y + 2, 1, height - 4).fillRect(x + width - 5, y + 2, 1, height - 4);
  // The notches: a bite out of each end.
  g.fillStyle(INK, 1).fillRect(x, y + Math.floor(height / 2) - 1, 2, 3).fillRect(x + width - 2, y + Math.floor(height / 2) - 1, 2, 3);
}

// --- the start line ---------------------------------------------------------------

/** What a game is shown as on its start line: the loop of its one control. */
export type ReadyDemo = 'jump' | 'pick' | 'dig' | 'cast' | 'race' | 'course';

/** Who plays, as the start line shows them. */
export interface ReadyFace {
  readonly dexId: number;
  readonly shiny: boolean;
  readonly name: string;
  /** Who plays alongside, by species: a jumping team, the course's runners. */
  readonly mates?: readonly string[];
  /** What the team brings, as icons lit or dim: the course's four HMs. */
  readonly marks?: readonly { readonly icon: string; readonly on: boolean }[];
}

/** A game of levels: which is to be played, and whether UP and DOWN change it. */
export interface ReadyLevel {
  readonly number: number;
  readonly name: string;
  readonly choices: number;
}

export interface ReadyOptions {
  readonly demo: ReadyDemo;
  /** How long the 3, 2, 1 lasts: a game with a count of its own (THE DERBY's) hands in its own. */
  readonly countMs: number;
  /** Who plays the loop: a party icon, or the player's own look. */
  readonly figure?: { readonly texture: string; readonly frames: readonly (string | number)[] };
  readonly depth?: number;
}

const CARD = { width: 220, height: 116 } as const;
const DEMO = { width: 100, height: 56 } as const;

/**
 * READY, 3, 2, 1, GO! over the game's own field, with who plays and how. The
 * scene hands it the frame's milliseconds and is told how they split between
 * the count and play; LEFT and RIGHT are the scene's to read, and starting
 * the line again is making a new one.
 */
export class ReadySetGo {
  public readonly root: Phaser.GameObjects.Container;
  private readonly card: Phaser.GameObjects.Container;
  private readonly word: Phaser.GameObjects.Text;
  private readonly demo: Phaser.GameObjects.Graphics;
  private readonly arrows: Phaser.GameObjects.Graphics;
  private readonly caps = new Map<Cap, KeyCap>();
  private readonly figure: Phaser.GameObjects.Sprite | undefined;
  private readonly area: { readonly x: number; readonly y: number };
  private elapsed = 0;
  private shown: CountWord = 'READY';
  private readonly scene: Phaser.Scene;
  private readonly options: ReadyOptions;
  private readonly others: boolean;
  private readonly level: ReadyLevel | undefined;

  public constructor(scene: Phaser.Scene, options: ReadyOptions, face: ReadyFace, others: boolean, level?: ReadyLevel) {
    this.scene = scene;
    this.options = options;
    this.others = others;
    this.level = level;
    const { width, height } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(options.depth ?? 40);
    this.root.setScrollFactor(0, 0, true);
    const left = Math.round((width - CARD.width) / 2);
    const top = Math.round((height - CARD.height) / 2) + 10;
    this.card = scene.add.container(0, 0);
    this.root.add(this.card);
    const paper = scene.add.graphics();
    drawPixelWindow(paper, { x: left, y: top, width: CARD.width, height: CARD.height }, { fill: WINDOW_PAPER });
    // The line between who and how.
    paper.fillStyle(SHADE, 1).fillRect(left + 110, top + 6, 1, CARD.height - 12);
    this.card.add(paper);
    // Who plays, big, with their name under them and who plays alongside.
    const front = pokemonTextureKey('front', face.dexId, face.shiny);
    const texture = scene.textures.exists(front) ? front : pokemonTextureKey('front', face.dexId);
    const centre = left + 55;
    this.card.add(scene.add.image(centre, top + 4, texture).setOrigin(0.5, 0));
    this.card.add(words(scene, centre, top + 68, face.name).setOrigin(0.5, 0));
    (face.mates ?? []).slice(0, 2).forEach((species, index, mates) => {
      if (!isFigureSpecies(species)) return;
      const x = centre + (index - (mates.length - 1) / 2) * 30;
      this.card.add(scene.add.sprite(x, top + CARD.height - 2, POKEMON_ICON_TEXTURE, pokemonIconFrames(species)[0]).setOrigin(0.5, 1));
    });
    this.arrows = scene.add.graphics();
    this.card.add(this.arrows);
    // How: the loop of the control, and its caps under it.
    this.area = { x: left + 116, y: top + 6 };
    this.demo = scene.add.graphics();
    this.card.add(this.demo);
    if (options.figure) {
      this.figure = scene.add.sprite(0, 0, options.figure.texture, options.figure.frames[0]).setOrigin(0.5, 1);
      this.card.add(this.figure);
    }
    this.layCaps(DEMO_CAPS[options.demo], this.area.x, this.area.y + DEMO.height + 4);
    // Under the card, a strip of its own: what the team brings, or the level to be played.
    const marks = face.marks ?? [];
    const stripTop = top + CARD.height + 4;
    if (marks.length > 0 || level) {
      const strip = scene.add.graphics();
      drawPixelWindow(strip, { x: left + 30, y: stripTop, width: CARD.width - 60, height: 20 }, { fill: WINDOW_PAPER });
      this.card.add(strip);
    }
    marks.forEach((mark, index) => {
      const icon = scene.add.image(left + CARD.width / 2 + (index - (marks.length - 1) / 2) * 24, stripTop + 10, iconTextureKey(mark.icon)).setAlpha(mark.on ? 1 : 0.3);
      this.card.add(icon);
    });
    if (level) this.card.add(words(scene, left + CARD.width / 2, stripTop + 3, `${level.number}  ${level.name}`).setOrigin(0.5, 0));
    this.word = words(scene, width / 2, top - 4, 'READY', { big: true, colour: '#f8f8f8', stroke: true, scale: 2 }).setOrigin(0.5, 1);
    this.root.add(this.word);
    this.drawFrame();
  }

  /** Whether the count is over and the game is being played. */
  public get done(): boolean {
    return counted(this.elapsed, this.options.countMs);
  }

  /** The frame's milliseconds on: how they split, with the words, the sounds and the loop moved on. */
  public tick(delta: number): CountSplit {
    const split = splitCount(this.elapsed, delta, this.options.countMs);
    this.elapsed += Math.max(0, delta);
    const word = countWord(this.elapsed, this.options.countMs);
    if (word !== this.shown) {
      this.shown = word;
      this.word.setText(word);
      if (word === 'GO!') {
        audioManager.play('confirm');
        this.word.setColor('#f8e070');
        this.card.setVisible(false);
      } else if (word !== '') {
        audioManager.play('select');
      }
    }
    if (!this.done) this.drawFrame();
    return split;
  }

  public destroy(): void {
    this.root.destroy(true);
  }

  private layCaps(caps: readonly Cap[], x: number, y: number): void {
    // The arrows of a game that walks stand as the keyboard's own cluster - UP over LEFT, DOWN and RIGHT - and SPACE beside them.
    if ((['left', 'up', 'right', 'down'] as const).every((cap) => caps.includes(cap))) {
      this.caps.set('up', new KeyCap(this.scene, this.card, 'up', x + 16, y - 2));
      (['left', 'down', 'right'] as const).forEach((cap, index) => this.caps.set(cap, new KeyCap(this.scene, this.card, cap, x + index * 16, y + 14)));
      if (caps.includes('space')) this.caps.set('space', new KeyCap(this.scene, this.card, 'space', x + 54, y + 14));
      return;
    }
    const placed = DEMO_CAP_X[this.options.demo];
    let along = x;
    caps.forEach((cap, index) => {
      const at = placed ? x + placed[index] - capWidth(cap) / 2 : along;
      this.caps.set(cap, new KeyCap(this.scene, this.card, cap, Math.round(at), y));
      along += capWidth(cap) + 2;
    });
  }

  private drawFrame(): void {
    const bob = Math.floor(this.elapsed / 300) % 2;
    const arrows = this.arrows.clear();
    const { width, height } = this.scene.scale;
    const left = Math.round((width - CARD.width) / 2);
    const top = Math.round((height - CARD.height) / 2) + 10;
    if (this.others) {
      // Somebody else could play: LEFT and RIGHT, either side of the picture.
      arrows.fillStyle(INK, 1);
      arrows.fillTriangle(left + 10 - bob, top + 36, left + 16 - bob, top + 30, left + 16 - bob, top + 42);
      arrows.fillTriangle(left + 100 + bob, top + 36, left + 94 + bob, top + 30, left + 94 + bob, top + 42);
    }
    if (this.level && this.level.choices > 1) {
      // Another level could be played: UP and DOWN, at the strip's end.
      const x = left + 42;
      const y = top + CARD.height + 4;
      arrows.fillStyle(INK, 1);
      arrows.fillTriangle(x, y + 2 - bob, x - 4, y + 8 - bob, x + 4, y + 8 - bob);
      arrows.fillTriangle(x, y + 18 + bob, x - 4, y + 12 + bob, x + 4, y + 12 + bob);
    }
    this.drawDemo(this.elapsed);
  }

  /** Presses one cap for the loop, and lets every other up. */
  private pressOnly(...down: Cap[]): void {
    for (const [cap, key] of this.caps) key.press(down.includes(cap));
  }

  /** Where the loop's figure stands, its feet on `y`, stepping its frames as it moves. */
  private stand(x: number, y: number, moving: boolean): void {
    if (!this.figure || !this.options.figure) return;
    const frames = this.options.figure.frames;
    this.figure.setPosition(Math.round(x), Math.round(y));
    this.figure.setFrame(frames[moving ? Math.floor(this.elapsed / POKEMON_ICON_FRAME_MS) % frames.length : 0]);
  }

  private drawDemo(elapsed: number): void {
    const g = this.demo.clear();
    const { x, y } = this.area;
    const between = (t: number, from: number, to: number): boolean => t >= from && t < to;
    switch (this.options.demo) {
      case 'jump': {
        // The vine swings round; SPACE goes down as it comes, and the jumper is over it.
        const t = (elapsed % 1400) / 1400;
        const ground = y + 50;
        const sag = (1 - Math.cos(2 * Math.PI * t)) / 2;
        const hop = between(t, 0.36, 0.64) ? Math.sin(((t - 0.36) / 0.28) * Math.PI) : 0;
        this.pressOnly(...(between(t, 0.33, 0.42) ? (['space'] as Cap[]) : []));
        g.fillStyle(0xb09060, 1).fillEllipse(x + 50, ground + 1, 80, 6);
        const rope = (from: number, to: number): void => {
          let last: { px: number; py: number } | null = null;
          for (let step = from; step <= to; step += 1) {
            const u = -1 + step / 12;
            const px = x + 50 + u * 42;
            const py = y + 8 + (1 - u * u) * sag * (ground - y - 6);
            if (last) {
              g.lineStyle(4, 0x205820, 1).lineBetween(last.px, last.py, px, py);
              g.lineStyle(2, 0x58c040, 1).lineBetween(last.px, last.py, px, py);
            }
            last = { px, py };
          }
        };
        rope(0, 24);
        this.stand(x + 50, ground - Math.round(hop * 20), hop > 0);
        if (!this.figure) g.fillStyle(0xf8d030, 1).fillCircle(x + 50, ground - 8 - Math.round(hop * 20), 8);
        return;
      }
      case 'pick': {
        // A berry drops over one column; the cap under it goes down as it reaches the beak.
        const column = Math.floor(elapsed / 1000) % 3;
        const t = (elapsed % 1000) / 1000;
        const columns = DEMO_CAP_X.pick ?? [20, 50, 80];
        for (const cx of columns) {
          g.fillStyle(0x704020, 1).fillRect(x + cx - 1, y, 2, 4);
          g.fillStyle(0xf8a040, 1).fillTriangle(x + cx - 5, y + 52, x + cx + 5, y + 52, x + cx, y + 46);
        }
        const cx = x + columns[column];
        const caught = t >= 0.7;
        this.pressOnly(...(between(t, 0.68, 0.85) ? [(['left', 'up', 'right'] as const)[column]] : []));
        if (!caught) {
          const by = y + 6 + Math.round((t / 0.7) * 34);
          g.fillStyle(INK, 1).fillCircle(cx, by, 6);
          g.fillStyle(0x3870e0, 1).fillCircle(cx, by, 5);
          g.fillStyle(0x90c0f8, 1).fillRect(cx - 3, by - 3, 2, 2);
        } else if (t < 0.9) {
          // Eaten: a spark where it was.
          g.fillStyle(0xf8e070, 1).fillRect(cx - 1, y + 34, 2, 8).fillRect(cx - 4, y + 37, 8, 2);
        }
        return;
      }
      case 'dig': {
        // The spade steps right a square, SPACE digs, and the ping glows.
        const t = elapsed % 2600;
        const size = 16;
        const gx = x + 18;
        const gy = y + 10;
        const at = t >= 700 ? 2 : 1;
        const dug = t >= 1400;
        this.pressOnly(...(between(t, 700, 880) ? (['right'] as Cap[]) : between(t, 1400, 1580) ? (['space'] as Cap[]) : []));
        for (let row = 0; row < 2; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            const isDug = dug && row === 0 && col === 2;
            g.fillStyle(isDug ? 0x987840 : 0xe0c880, 1).fillRect(gx + col * size, gy + row * size, size - 1, size - 1);
            if (isDug) g.fillStyle(0x705828, 1).fillRect(gx + col * size + 2, gy + row * size + 2, size - 5, 3);
          }
        }
        g.lineStyle(2, INK, 1).strokeRect(gx + at * size - 1, gy - 1, size + 1, size + 1);
        if (dug) {
          const ring = Math.min(1, (t - 1400) / 500);
          g.lineStyle(2, 0xf85838, 1 - ring * 0.6).strokeCircle(gx + 2 * size + size / 2, gy + size / 2, 4 + ring * 10);
        }
        return;
      }
      case 'cast': {
        // SPACE, and the line goes out; a float, three dots, and a bite.
        const t = elapsed % 2800;
        const rod = { x: x + 12, y: y + 50 };
        const tip = { x: x + 34, y: y + 14 };
        const float = { x: x + 80, y: y + 44 };
        this.pressOnly(...(between(t, 0, 200) ? (['space'] as Cap[]) : []));
        g.fillStyle(0x3870c8, 1).fillRect(x + 44, y + 40, DEMO.width - 46, 14);
        g.lineStyle(2, 0x704020, 1).lineBetween(rod.x, rod.y, tip.x, tip.y);
        const out = Math.min(1, t / 400);
        const fx = tip.x + (float.x - tip.x) * out;
        const fy = tip.y + (float.y - tip.y) * out - Math.sin(out * Math.PI) * 14;
        g.lineStyle(1, WINDOW_PAPER, 1).lineBetween(tip.x, tip.y, fx, fy);
        g.lineStyle(1, INK, 0.5).lineBetween(tip.x, tip.y + 1, fx, fy + 1);
        const bob = t > 400 && t < 2000 ? Math.floor(t / 250) % 2 : 0;
        g.fillStyle(0xe04040, 1).fillCircle(fx, fy + bob, 3);
        g.fillStyle(WINDOW_PAPER, 1).fillRect(fx - 3, fy + bob, 6, 2);
        const dots = t < 800 ? 0 : Math.min(3, 1 + Math.floor((t - 800) / 350));
        for (let dot = 0; dot < dots && t < 2000; dot += 1) g.fillStyle(INK, 1).fillRect(float.x - 10 + dot * 6, float.y - 14, 2, 2);
        if (t >= 2000) {
          g.fillStyle(INK, 1).fillRect(float.x - 1, float.y - 22, 3, 8).fillRect(float.x - 1, float.y - 12, 3, 3);
          const leap = Math.sin(Math.min(1, (t - 2000) / 800) * Math.PI);
          g.fillStyle(0xf86830, 1).fillEllipse(float.x + 8, float.y - 4 - leap * 10, 12, 7);
          g.fillStyle(WINDOW_PAPER, 1).fillRect(float.x + 10, float.y - 6 - leap * 10, 2, 2);
        }
        return;
      }
      case 'race': {
        // Away down the lane; SPACE is a dash; at the fork, UP takes the top line.
        const t = elapsed % 2600;
        const lane = y + 28;
        g.fillStyle(0xd8c8a0, 1).fillRect(x, lane - 6, 62, 12);
        g.fillStyle(0xd8c8a0, 1).fillTriangle(x + 58, lane - 6, x + 98, y + 2, x + 98, y + 14).fillTriangle(x + 58, lane - 2, x + 58, lane - 6, x + 98, y + 14);
        g.fillStyle(0x88c0f8, 1).fillTriangle(x + 58, lane + 6, x + 98, y + 42, x + 98, y + 54).fillTriangle(x + 58, lane + 2, x + 58, lane + 6, x + 98, y + 54);
        const dashing = t >= 500;
        let rx = t < 500 ? x + 6 + (t / 500) * 10 : x + 16 + Math.min(1, (t - 500) / 700) * 44;
        let ry = lane + 6;
        if (t >= 1200) {
          const up = Math.min(1, (t - 1400) / 900);
          rx = x + 60 + Math.max(0, up) * 32;
          ry = lane + 6 - Math.max(0, up) * 20;
        }
        this.pressOnly(...(between(t, 500, 700) ? (['space'] as Cap[]) : between(t, 1200, 1400) ? (['up'] as Cap[]) : []));
        if (dashing && t < 1200) {
          g.fillStyle(WINDOW_PAPER, 1).fillRect(rx - 16, ry - 8, 8, 1).fillRect(rx - 20, ry - 4, 10, 1);
        }
        this.stand(rx, ry, true);
        if (!this.figure) g.fillStyle(0xf8d030, 1).fillCircle(rx, ry - 6, 6);
        return;
      }
      case 'course': {
        // Walk up to the tree; SPACE cuts it; walk on through.
        const t = elapsed % 3000;
        const ground = y + 44;
        const cut = t >= 1700;
        g.fillStyle(0x88c070, 1).fillRect(x, ground - 2, DEMO.width, 6);
        if (!cut) {
          g.fillStyle(0x704020, 1).fillRect(x + 72, ground - 12, 4, 12);
          g.fillStyle(0x286828, 1).fillCircle(x + 74, ground - 18, 10);
          g.fillStyle(0x58b058, 1).fillCircle(x + 71, ground - 21, 6);
        } else if (t < 2100) {
          g.fillStyle(0x58b058, 1).fillRect(x + 66, ground - 22 - (t - 1700) / 40, 3, 3).fillRect(x + 80, ground - 16 - (t - 1700) / 50, 3, 3);
        }
        const walked = t < 1400 ? t / 1400 : t < 1900 ? 1 : 1 + (t - 1900) / 1100;
        const fx = x + 14 + walked * 42;
        const pulse = t < 1400 && Math.floor(t / 350) % 2 === 0;
        this.pressOnly(...(pulse || (t >= 1900 && Math.floor(t / 350) % 2 === 0) ? (['right'] as Cap[]) : between(t, 1500, 1700) ? (['space'] as Cap[]) : []));
        this.stand(Math.min(fx, x + DEMO.width - 6), ground, t < 1400 || t >= 1900);
        if (!this.figure) g.fillStyle(0xf86040, 1).fillCircle(Math.min(fx, x + DEMO.width - 6), ground - 7, 6);
      }
    }
  }
}

/** The caps each game's loop is shown with. */
const DEMO_CAPS: Readonly<Record<ReadyDemo, readonly Cap[]>> = {
  jump: ['space'],
  pick: ['left', 'up', 'right'],
  dig: ['left', 'up', 'right', 'down', 'space'],
  cast: ['space'],
  race: ['space', 'up', 'down'],
  course: ['left', 'up', 'right', 'down', 'space'],
};

/** Where a loop's caps stand under it, by their centres, when they stand under what they do. */
const DEMO_CAP_X: Readonly<Partial<Record<ReadyDemo, readonly number[]>>> = {
  jump: [50],
  pick: [20, 50, 80],
  cast: [50],
};

// --- the key strip ------------------------------------------------------------------

/**
 * The game's keys along the foot of the screen while it is played: the start
 * line's caps, small, each dipping as it is pressed. ESC is always the last.
 */
export class KeyStrip {
  public readonly root: Phaser.GameObjects.Container;
  private readonly caps = new Map<Cap, KeyCap>();
  private readonly downUntil = new Map<Cap, number>();
  private clock = 0;

  public constructor(scene: Phaser.Scene, caps: readonly Cap[], options: { readonly x?: number; readonly y?: number; readonly depth?: number } = {}) {
    const all = [...caps.filter((cap) => cap !== 'esc'), 'esc' as const];
    const width = all.reduce((sum, cap) => sum + capWidth(cap) + 2, 0) + 6;
    const left = Math.round((options.x ?? scene.scale.width / 2) - width / 2);
    const top = Math.round((options.y ?? scene.scale.height - 2) - CAP_HEIGHT);
    this.root = scene.add.container(0, 0).setDepth(options.depth ?? 25);
    this.root.setScrollFactor(0, 0, true);
    let along = left;
    all.forEach((cap) => {
      // A gap before ESC: it stops the game rather than playing it.
      if (cap === 'esc') along += 6;
      this.caps.set(cap, new KeyCap(scene, this.root, cap, along, top));
      along += capWidth(cap) + 2;
    });
  }

  /** A key went down: its cap dips for a moment, if the strip has it. */
  public press(key: string): void {
    const cap = capOf(key);
    if (!cap || !this.caps.has(cap)) return;
    this.caps.get(cap)?.press(true);
    this.downUntil.set(cap, this.clock + 140);
  }

  public tick(delta: number): void {
    this.clock += delta;
    for (const [cap, until] of this.downUntil) {
      if (this.clock < until) continue;
      this.caps.get(cap)?.press(false);
      this.downUntil.delete(cap);
    }
  }

  public destroy(): void {
    this.root.destroy(true);
  }
}

// --- the result -----------------------------------------------------------------------

export interface ResultContent {
  /** Who played, shown beside what they came to. */
  readonly face?: { readonly dexId: number; readonly shiny: boolean };
  /** What the game came to, in the game's own words: `SCORE 1,230`, `2nd  0:41.20`. */
  readonly headline: string;
  /** A second line, if there is news: a course opened, or that nothing could be written. */
  readonly note?: string;
  readonly newBest: boolean;
  /** Tickets this game won. */
  readonly earned: number;
  /** What it sent home besides, by item id: berries, a SAND ORNAMENT. */
  readonly finds: readonly string[];
  /** The game's pay table against this result, or null for a game without one. */
  readonly ladder: TicketLadder | null;
}

const RESULT = { width: 232, height: 128 } as const;
const BAR_INSET = 14;

/** Where a tier's lamp stands along the bar: evenly, the last short of the end so what it asks fits under it. */
function rungX(cardLeft: number, rungs: number, index: number): number {
  const span = RESULT.width - BAR_INSET * 2 - 18;
  return cardLeft + BAR_INSET + Math.round(((index + 1) / Math.max(1, rungs)) * span);
}

/**
 * What a game came to, over its frozen field: the result, the tickets won,
 * the pay table once as lamps along a bar, and the two keys - SPACE to play
 * again, ESC to go.
 */
export class ResultCard {
  public readonly root: Phaser.GameObjects.Container;
  private readonly count: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly caps: KeyCap[] = [];
  private elapsed = 0;
  private readonly scene: Phaser.Scene;
  private readonly content: ResultContent;

  public constructor(scene: Phaser.Scene, content: ResultContent, depth = 45) {
    this.scene = scene;
    this.content = content;
    const { width, height } = scene.scale;
    const left = Math.round((width - RESULT.width) / 2);
    const top = Math.round((height - RESULT.height) / 2);
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.root.setScrollFactor(0, 0, true);
    const shade = scene.add.graphics();
    shade.fillStyle(0x101018, 0.45).fillRect(0, 0, width, height);
    drawPixelWindow(shade, { x: left, y: top, width: RESULT.width, height: RESULT.height }, { fill: WINDOW_PAPER });
    this.root.add(shade);
    const face = content.face;
    const textLeft = face ? left + 72 : left + 10;
    if (face) {
      const front = pokemonTextureKey('front', face.dexId, face.shiny);
      const texture = scene.textures.exists(front) ? front : pokemonTextureKey('front', face.dexId);
      this.root.add(scene.add.image(left + 36, top + 4, texture).setOrigin(0.5, 0));
    }
    this.root.add(words(scene, textLeft, top + 8, content.headline, { big: true }));
    if (content.newBest) {
      const ribbon = scene.add.graphics();
      ribbon.fillStyle(0xf85888, 1).fillRect(left + RESULT.width - 62, top - 6, 58, 13);
      ribbon.fillStyle(INK, 1).fillRect(left + RESULT.width - 62, top + 7, 58, 1);
      this.root.add(ribbon);
      this.root.add(words(scene, left + RESULT.width - 33, top - 6, 'NEW BEST!', { colour: '#f8f8f8' }).setOrigin(0.5, 0));
    }
    if (content.note) this.root.add(words(scene, textLeft, top + 26, content.note, { colour: '#386838' }));
    // The tickets won, and what came home besides.
    const prize = scene.add.graphics();
    drawTicket(prize, textLeft, top + 44, 22, 13);
    this.root.add(prize);
    this.count = words(scene, textLeft + 26, top + 43, '+0', { big: true });
    this.root.add(this.count);
    content.finds.slice(0, 5).forEach((itemId, index) => {
      this.root.add(scene.add.image(textLeft + 80 + index * 18, top + 51, iconTextureKey(itemIconName(itemId))));
    });
    // The pay table: a lamp a tier along a bar, what it asks under it and what it pays over it.
    this.bar = scene.add.graphics();
    this.root.add(this.bar);
    const ladder = content.ladder;
    if (ladder) {
      ladder.rungs.forEach((rung, index) => {
        const x = rungX(left, ladder.rungs.length, index);
        const tickets = scene.add.graphics();
        drawTicket(tickets, x - 10, top + 66, 20, 12);
        this.root.add(tickets);
        this.root.add(words(scene, x, top + 65, String(rung.tickets)).setOrigin(0.5, 0));
        this.root.add(words(scene, x, top + 92, rung.asks, { colour: rung.reached ? '#386838' : '#707070' }).setOrigin(0.5, 0));
      });
    }
    // SPACE again, ESC away.
    const keysTop = top + RESULT.height - CAP_HEIGHT - 4;
    const again = new KeyCap(scene, this.root, 'space', left + RESULT.width / 2 - 52, keysTop);
    const leave = new KeyCap(scene, this.root, 'esc', left + RESULT.width / 2 + 26, keysTop);
    this.caps.push(again, leave);
    const glyphs = scene.add.graphics();
    // Again: a loop with its arrowhead.
    const ax = left + RESULT.width / 2 - 52 + 46;
    glyphs.lineStyle(2, INK, 1).beginPath().arc(ax + 5, keysTop + 7, 5, Math.PI * 0.2, Math.PI * 1.8).strokePath();
    glyphs.fillStyle(INK, 1).fillTriangle(ax + 8, keysTop + 1, ax + 12, keysTop + 5, ax + 7, keysTop + 6);
    // Away: an arrow out of a door.
    const lx = left + RESULT.width / 2 + 26 + 28;
    glyphs.fillStyle(INK, 1).fillRect(lx, keysTop + 1, 2, 12).fillRect(lx, keysTop + 1, 7, 2).fillRect(lx, keysTop + 11, 7, 2);
    glyphs.fillRect(lx + 4, keysTop + 6, 7, 2).fillTriangle(lx + 10, keysTop + 3, lx + 14, keysTop + 7, lx + 10, keysTop + 11);
    this.root.add(glyphs);
    this.drawBar();
  }

  /** The tickets count up and the bar fills, over the first half second. */
  public tick(delta: number): void {
    this.elapsed += delta;
    this.drawBar();
  }

  /** A key went down on the card: its cap dips. */
  public press(key: string): void {
    const cap = capOf(key);
    this.caps[0]?.press(cap === 'space');
    this.caps[1]?.press(cap === 'esc');
  }

  public destroy(): void {
    this.root.destroy(true);
  }

  private drawBar(): void {
    const grown = Math.min(1, this.elapsed / 500);
    this.count.setText(`+${Math.round(this.content.earned * grown)}`);
    const ladder = this.content.ladder;
    const bar = this.bar.clear();
    if (!ladder) return;
    const { width, height } = this.scene.scale;
    const cardLeft = Math.round((width - RESULT.width) / 2);
    const left = cardLeft + BAR_INSET;
    const top = Math.round((height - RESULT.height) / 2) + 82;
    const barWidth = RESULT.width - BAR_INSET * 2;
    const span = rungX(cardLeft, ladder.rungs.length, ladder.rungs.length - 1) - left;
    bar.fillStyle(INK, 1).fillRect(left, top, barWidth, 6);
    bar.fillStyle(SHADE, 1).fillRect(left + 1, top + 1, barWidth - 2, 4);
    bar.fillStyle(LIT, 1).fillRect(left + 1, top + 1, Math.round(span * ladder.fill * grown), 4);
    ladder.rungs.forEach((rung, index) => {
      const x = rungX(cardLeft, ladder.rungs.length, index);
      // The lamp: lit gold for a tier today has paid, dark for one it has not.
      bar.fillStyle(INK, 1).fillCircle(x, top + 3, 5);
      bar.fillStyle(rung.lit ? GOLD : 0x585868, 1).fillCircle(x, top + 3, 4);
      if (rung.lit) bar.fillStyle(0xfff8c8, 1).fillRect(x - 2, top + 1, 2, 2);
    });
  }
}
