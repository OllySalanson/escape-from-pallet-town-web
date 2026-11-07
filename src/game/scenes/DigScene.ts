import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import type { StashedPokemon } from '../stash';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { drawPixelWindow, WINDOW_CREAM } from '../ui/pixelWindow';
import {
  DIG_HEIGHT,
  DIG_WIDTH,
  digAt,
  diggerNotes,
  digItems,
  digsAPlus,
  digShape,
  isDug,
  isLoose,
  startDig,
  type DigGame,
  type Ping,
} from '../minigames/dig';
import { DIG_TICKET_TIERS } from '../minigames/tickets';
import { hasAbility, knows, type PokemonTraits } from '../minigames/traits';
import { OutdoorGameScene, type OutdoorFit } from './OutdoorGameScene';

/** A square of the patch, in game pixels. */
const SQUARE = 24;
/** How long the last dig is shown before the screen comes back. */
const END_PAUSE_MS = 1400;

const PING_WORDS: Readonly<Record<Ping, { readonly words: string; readonly colour: string }>> = {
  found: { words: 'FOUND IT!', colour: '#f8e070' },
  hot: { words: 'HOT!', colour: '#f85838' },
  warm: { words: 'WARM', colour: '#f8a848' },
  cold: { words: 'COLD', colour: '#88c0f8' },
};

/**
 * THE DIG, on the beach (`minigames/dig.ts`): a roped patch of sand eight
 * squares by five, ten digs, and after each a ping - HOT, WARM or COLD, as
 * FireRed's Itemfinder pings. Arrows move the spade, SPACE digs. Loose sand
 * is drawn darker; a Ground type turns over a plus; Keen Eye glints.
 */
export class DigScene extends OutdoorGameScene {
  protected readonly source = 'dig' as const;
  protected readonly words = {
    title: 'THE DIG',
    place: 'Beach · ',
    heading: 'Who digs?',
    doing: 'Digging',
    rules: 'Ten digs, a ping after each. A GROUND type digs five squares; DIG the move is two more digs; darker sand caves in.',
    playHelp: 'ARROWS move the spade, SPACE digs. HOT is a square away, WARM two.',
  };

  private dig_: DigGame | undefined;
  private cursor = { x: 3, y: 2 };
  private endingFor: number | null = null;
  private patch: Phaser.GameObjects.Graphics | undefined;
  private hud: Phaser.GameObjects.Text | undefined;
  private ping: Phaser.GameObjects.Text | undefined;
  private finds: Phaser.GameObjects.Image[] = [];

  public constructor() {
    super('dig');
  }

  /** For a playtest driver: the dig in progress. */
  public get digGame(): DigGame | undefined {
    return this.dig_;
  }

  /** For a playtest driver: dig at a square, as the arrows and SPACE do. */
  public digSquare(x: number, y: number): void {
    if (!this.playing || !this.dig_ || this.endingFor !== null) return;
    this.cursor = { x, y };
    this.dig();
  }

  protected fitOf(traits: PokemonTraits): OutdoorFit {
    const fit =
      1 +
      (digsAPlus(traits) ? 2 : 0) +
      (knows(traits, 'dig') ? 1 : 0) +
      (hasAbility(traits, 'pickup') ? 1 : 0) +
      (hasAbility(traits, 'keen-eye') ? 0.5 : 0) +
      (hasAbility(traits, 'sand-veil') ? 0.5 : 0);
    return { fit, notes: diggerNotes(traits) };
  }

  protected bestWords(best: number): string {
    return `${best} points`;
  }

  protected todayLine(): string {
    const [first, second, third] = DIG_TICKET_TIERS;
    return `Tickets at ${first.score}, ${second.score} and ${third.score} points; berries and a SAND ORNAMENT go home.`;
  }

  protected beginGame(chosen: StashedPokemon, traits: PokemonTraits): void {
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.dig_ = startDig(traits, seed);
    this.cursor = { x: 3, y: 2 };
    this.endingFor = null;
    this.finds = [];
    const { width, height } = this.scale;
    const back = this.keep(this.add.graphics().setDepth(0));
    // The beach: sand to the edges, the sea along the bottom, and a boardwalk rail at the top.
    back.fillStyle(0xe8d088, 1).fillRect(0, 0, width, height);
    for (let index = 0; index < 90; index += 1) {
      back.fillStyle(index % 2 ? 0xd8c078 : 0xf0e0a0, 1).fillRect((index * 53) % width, (index * 37) % height, 2, 1);
    }
    back.fillStyle(0x3870c8, 1).fillRect(0, height - 22, width, 22);
    back.fillStyle(0x88c0f8, 1).fillRect(0, height - 22, width, 2);
    back.fillStyle(0xf8f8f8, 1).fillRect(0, height - 24, width, 2);
    back.fillStyle(0xb07840, 1).fillRect(0, 0, width, 10);
    back.fillStyle(0x704020, 1).fillRect(0, 10, width, 2);
    // The rope round the patch, on posts.
    const left = this.patchLeft();
    const top = this.patchTop();
    const rope = { x: left - 6, y: top - 6, w: DIG_WIDTH * SQUARE + 12, h: DIG_HEIGHT * SQUARE + 12 };
    back.lineStyle(2, 0xc8a060, 1).strokeRect(rope.x, rope.y, rope.w, rope.h);
    for (const [px, py] of [
      [rope.x, rope.y],
      [rope.x + rope.w, rope.y],
      [rope.x, rope.y + rope.h],
      [rope.x + rope.w, rope.y + rope.h],
    ] as const) {
      back.fillStyle(0x704020, 1).fillRect(px - 2, py - 4, 4, 8);
    }
    this.keep(
      this.add
        .image(Math.max(36, left - 44), top + DIG_HEIGHT * SQUARE, pokemonTextureKey('front', chosen.pokemon.base.dexId, chosen.pokemon.shiny))
        .setOrigin(0.5, 1)
        .setDepth(3),
    );
    this.patch = this.keep(this.add.graphics().setDepth(4));
    const panel = this.keep(this.add.graphics().setDepth(10));
    drawPixelWindow(panel, { x: 4, y: 14, width: 108, height: 32 }, { fill: WINDOW_CREAM });
    this.hud = this.words_(9, 16, '', { colour: '#202030' }).setStroke('#202030', 0).setDepth(11);
    this.ping = this.words_(width / 2, top - 22, 'DIG!', { big: true, origin: [0.5, 0.5] });
    this.words_(width / 2, height - 3, 'ARROWS: move · SPACE: dig · ESC: stop', { origin: [0.5, 1] });
    this.drawPatch();
  }

  private patchLeft(): number {
    return Math.round((this.scale.width - DIG_WIDTH * SQUARE) / 2);
  }

  private patchTop(): number {
    return Math.round((this.scale.height - DIG_HEIGHT * SQUARE) / 2) + 4;
  }

  protected onGameKey(event: KeyboardEvent): void {
    if (!this.dig_ || this.endingFor !== null || event.repeat) return;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      w: [0, -1],
      s: [0, 1],
    };
    const step = move[event.key];
    if (step) {
      event.preventDefault();
      this.cursor = {
        x: Math.max(0, Math.min(DIG_WIDTH - 1, this.cursor.x + step[0])),
        y: Math.max(0, Math.min(DIG_HEIGHT - 1, this.cursor.y + step[1])),
      };
      audioManager.play('select');
      this.drawPatch();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.dig();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finishDig();
    }
  }

  private dig(): void {
    if (!this.dig_) return;
    if (isDug(this.dig_, this.cursor.x, this.cursor.y)) {
      audioManager.play('denied');
      return;
    }
    const result = digAt(this.dig_, this.cursor.x, this.cursor.y);
    this.dig_ = result.game;
    for (const event of result.events) {
      if (event.kind === 'found') {
        audioManager.play(event.what.kind === 'ornament' ? 'itemObtained' : 'lootPickup');
        if (event.what.itemId) this.showFind(event.what.itemId);
      }
      if (event.kind === 'caved') audioManager.play('bump');
      if (event.kind === 'ping') {
        const ping = PING_WORDS[event.ping];
        this.ping?.setText(ping.words).setColor(ping.colour);
        if (event.ping !== 'found') audioManager.play(event.ping === 'hot' ? 'confirm' : 'select');
      }
    }
    if (result.events.some((event) => event.kind === 'caved')) {
      this.ping?.setText('CAVED IN!').setColor('#c09048');
    }
    if (this.dig_.over) {
      this.endingFor = END_PAUSE_MS;
    }
    this.drawPatch();
  }

  private showFind(itemId: string): void {
    const x = this.scale.width - 18 - this.finds.length * 18;
    this.finds.push(this.keep(this.add.image(x, 30, iconTextureKey(itemIconName(itemId))).setDepth(11)));
  }

  public update(_time: number, delta: number): void {
    if (!this.playing || this.endingFor === null) return;
    this.endingFor -= delta;
    if (this.endingFor <= 0) this.finishDig();
  }

  private finishDig(): void {
    const game = this.dig_;
    if (!game || !this.playing) return;
    this.dig_ = undefined;
    this.endingFor = null;
    const found = game.found.length;
    this.endGame(game.score, `Dug up ${found} ${found === 1 ? 'thing' : 'things'}: ${game.score} points`, digItems(game));
  }

  private drawPatch(): void {
    const game = this.dig_;
    const patch = this.patch?.clear();
    if (!game || !patch) return;
    const left = this.patchLeft();
    const top = this.patchTop();
    const target = new Set(digShape(game.digger, this.cursor.x, this.cursor.y).map((square) => `${square.x},${square.y}`));
    for (let y = 0; y < DIG_HEIGHT; y += 1) {
      for (let x = 0; x < DIG_WIDTH; x += 1) {
        const px = left + x * SQUARE;
        const py = top + y * SQUARE;
        const dug = isDug(game, x, y);
        const loose = isLoose(game, x, y);
        patch.fillStyle(dug ? 0x987840 : loose ? 0xc8a868 : 0xe0c880, 1).fillRect(px, py, SQUARE - 1, SQUARE - 1);
        if (!dug) {
          patch.fillStyle(loose ? 0xb09050 : 0xf0e0a8, 1).fillRect(px + 3, py + 3, 3, 1).fillRect(px + 14, py + 12, 4, 1);
          if (loose) patch.fillStyle(0x987840, 1).fillRect(px + 8, py + 17, 5, 1).fillRect(px + 16, py + 6, 3, 1);
        } else {
          patch.fillStyle(0x705828, 1).fillRect(px + 2, py + 2, SQUARE - 5, 3);
          const thing = game.found.find((found) => found.x === x && found.y === y);
          if (thing) this.drawThing(patch, thing.kind, px + SQUARE / 2, py + SQUARE / 2);
        }
        if (target.has(`${x},${y}`)) {
          patch.lineStyle(1, 0xf8f8f8, 0.7).strokeRect(px + 1, py + 1, SQUARE - 3, SQUARE - 3);
        }
      }
    }
    // The spade, over the square it digs.
    const cx = left + this.cursor.x * SQUARE;
    const cy = top + this.cursor.y * SQUARE;
    patch.lineStyle(2, 0x202030, 1).strokeRect(cx - 1, cy - 1, SQUARE + 1, SQUARE + 1);
    patch.lineStyle(1, 0xf8f8f8, 1).strokeRect(cx, cy, SQUARE - 1, SQUARE - 1);
    // The last ping, marked on its square; Keen Eye's glint.
    if (game.ping) {
      const colour = Phaser.Display.Color.HexStringToColor(PING_WORDS[game.ping.ping].colour).color;
      patch.fillStyle(colour, 1).fillCircle(left + game.ping.x * SQUARE + SQUARE - 5, top + game.ping.y * SQUARE + 5, 3);
    }
    if (game.glint) {
      const gx = left + game.glint.x * SQUARE + SQUARE / 2;
      const gy = top + game.glint.y * SQUARE + SQUARE / 2;
      patch.fillStyle(0xfff8c8, 1).fillRect(gx - 1, gy - 6, 2, 12).fillRect(gx - 6, gy - 1, 12, 2);
    }
    this.hud?.setText([`DIGS LEFT ${game.digsLeft}`, `POINTS ${game.score}`]);
  }

  private drawThing(graphics: Phaser.GameObjects.Graphics, kind: 'berry' | 'shell' | 'ornament', x: number, y: number): void {
    if (kind === 'berry') {
      graphics.fillStyle(0x202030, 1).fillCircle(x, y, 6);
      graphics.fillStyle(0x3870e0, 1).fillCircle(x, y, 5);
      graphics.fillStyle(0x90c0f8, 1).fillRect(x - 3, y - 3, 2, 2);
      graphics.fillStyle(0x286828, 1).fillRect(x - 1, y - 8, 2, 3);
    } else if (kind === 'shell') {
      graphics.fillStyle(0x404868, 1).fillTriangle(x - 7, y + 5, x + 7, y + 5, x, y - 6);
      graphics.fillStyle(0xf8d8e0, 1).fillTriangle(x - 5, y + 4, x + 5, y + 4, x, y - 4);
      graphics.fillStyle(0xd890a8, 1).fillRect(x - 1, y - 2, 1, 6).fillRect(x + 2, y, 1, 4).fillRect(x - 3, y, 1, 4);
    } else {
      graphics.fillStyle(0x404868, 1).fillRect(x - 6, y - 2, 12, 9);
      graphics.fillStyle(0xf8e8b0, 1).fillRect(x - 5, y - 1, 10, 7);
      graphics.fillStyle(0xf8e8b0, 1).fillTriangle(x - 5, y - 1, x + 5, y - 1, x, y - 8);
      graphics.fillStyle(0xd0b070, 1).fillRect(x - 2, y + 2, 4, 4);
    }
  }
}
