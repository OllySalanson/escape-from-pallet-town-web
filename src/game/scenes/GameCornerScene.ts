import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { BATTLE_PIC_COORDS } from '../pokemon/generated/battlePicCoords';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pickerBasics, pickerEntries, pickerOrder, wirePickerFind } from '../ui/boxPicker';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_CREAM, WINDOW_INK } from '../ui/pixelWindow';
import { RELEASE_ARMING_MS } from '../ui/spatialFocus';
import { jumpTeamMarkup, prizeWindowMarkup, type JumpCandidate, type JumpTeamState } from '../minigames/gameCornerView';
import {
  advancePokemonJump,
  jumpTypeOf,
  MAX_JUMPERS,
  startPokemonJump,
  vineTurn,
  type PokemonJumpGame,
} from '../minigames/pokemonJump';
import { NO_GAME_CORNER, prizeById, prizeName, prizeRefusal, type GameCornerRecord, type PrizeSituation } from '../minigames/tickets';

export interface GameCornerSceneData {
  readonly mode: 'jump' | 'prizes';
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** How long the cabinet counts down before the vine starts. */
const COUNTDOWN_MS = 2400;
/** How long a hit is shown before the result. */
const HIT_PAUSE_MS = 1100;
/** How long a word over the jumpers stays up: EXCELLENT, a bonus. */
const CALLOUT_MS = 700;
/** FireRed's jump is drawn half as high again here: a sprite is twice a FireRed icon. */
const JUMP_DRAW_SCALE = 1.5;
/** The jumpers' Pokédex numbers stand on this line, in from the foot of the screen. */
const GROUND_INSET = 26;
/**
 * How far below the ground line a jumper's feet are stood: a back picture is
 * cut flat across its bottom, as FireRed's stands on its text box, so the cut
 * sits behind the worn patch's front lip (playtest wave 3, finding 10).
 */
const JUMPER_SINK = 4;

/** The rows a back picture leaves empty under its art, which a jumper is stood down by. */
function backPictureEmptyRows(dexId: number): number {
  return BATTLE_PIC_COORDS[dexId]?.[1] ?? 0;
}

type Phase =
  | { readonly kind: 'menu' }
  | { readonly kind: 'countdown'; readonly elapsed: number }
  | { readonly kind: 'playing' }
  | { readonly kind: 'hit'; readonly elapsed: number };

/**
 * THE GAME CORNER's two screens over the paused harbour, as the boutique is
 * (`BoutiqueScene`): the POKéMON JUMP cabinet - who jumps, the game itself and
 * what it paid - and the PRIZE WINDOW.
 *
 * The rules are `minigames/pokemonJump.ts` and nothing here decides anything:
 * the scene hands the game each frame's milliseconds and whether the key was
 * pressed, and draws what comes back. The game is drawn on the canvas, on the
 * scene clock - a Venusaur at the top swinging its vine, the jumpers from
 * behind, their own back sprites - and the choosing and the prize window are
 * pixel-ui screens (`minigames/gameCornerView.ts`). What a game pays and what
 * a prize costs are written by `SaveManager.playJump` and `buyTicketPrize`,
 * one write each.
 */
export class GameCornerScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private mode: GameCornerSceneData['mode'] = 'jump';
  private game_: RestoredGame | undefined;
  private chosen: string[] = [];
  private status: string | undefined;
  /** THE RUMOUR MILL's slip just bought, said in the bar. */
  private rumour: string | undefined;
  /** What the list's find field held (`ui/boxPicker.ts`). */
  private find = '';
  private last: JumpTeamState['last'];
  private phase: Phase = { kind: 'menu' };
  private jump: PokemonJumpGame | undefined;
  private pressed = false;
  private openedAt = 0;
  private stage: Phaser.GameObjects.Container | undefined;
  private vine: Phaser.GameObjects.Graphics | undefined;
  private vineFront: Phaser.GameObjects.Graphics | undefined;
  private jumperSprites: Phaser.GameObjects.Image[] = [];
  /** Where each jumper's picture stands on the ground, by its own empty rows. */
  private jumperFeet: number[] = [];
  private jumperLip: Phaser.GameObjects.Graphics | undefined;
  private scoreText: Phaser.GameObjects.Text | undefined;
  private callout: { text: Phaser.GameObjects.Text; until: number } | undefined;
  private bigText: Phaser.GameObjects.Text | undefined;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('game-corner');
  }

  public init(data: GameCornerSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.mode = data.mode;
    this.status = undefined;
    this.rumour = undefined;
    this.last = undefined;
    this.phase = { kind: 'menu' };
    this.jump = undefined;
    this.pressed = false;
    this.game_ = this.saveManager.load() ?? undefined;
    this.chosen = this.defaultTeam();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.tearDownStage();
    });
    recordAction(this.mode === 'jump' ? 'Opened POKéMON JUMP' : 'Opened the PRIZE WINDOW');
  }

  public create(): void {
    this.openedAt = this.time.now;
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event));
    this.input.on('pointerdown', () => {
      if (this.phase.kind === 'playing' || this.phase.kind === 'countdown') this.pressed = true;
    });
    this.showMenu();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: this.mode === 'jump' ? 'POKéMON JUMP' : 'PRIZE WINDOW' },
      { label: 'Phase', value: this.phase.kind },
      ...(this.jump ? [{ label: 'Score', value: String(this.jump.score) }] : []),
    ];
  }

  /** For a playtest driver: the game in progress, if there is one. */
  public get jumpGame(): PokemonJumpGame | undefined {
    return this.jump;
  }

  /** For a playtest driver: where the screen is. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  private record(): GameCornerRecord {
    return this.game_?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  private candidates(): JumpCandidate[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    // Every box, the jumpers first (`ui/boxPicker.ts`).
    return pickerOrder(pickerEntries(stash), (entry) => (jumpTypeOf(entry.pokemon.base.id) ? 1 : 0)).map((entry) => ({
      ...pickerBasics(entry),
      jumpType: jumpTypeOf(entry.pokemon.base.id),
    }));
  }

  /** Who jumps if nobody is chosen: the first three who can, fastest kinds first. */
  private defaultTeam(): string[] {
    const order = { fast: 0, normal: 1, slow: 2 } as const;
    return this.candidates()
      .filter((candidate) => candidate.jumpType !== undefined)
      .sort((a, b) => order[a.jumpType!] - order[b.jumpType!])
      .slice(0, MAX_JUMPERS)
      .map((candidate) => candidate.id);
  }

  // --- the screens ---------------------------------------------------------------

  private showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui', (event) => this.onMenuKey(event));
    }
    const record = this.record();
    const markup =
      this.mode === 'jump'
        ? jumpTeamMarkup({
            candidates: this.candidates(),
            chosen: this.chosen,
            tickets: record.tickets,
            best: record.best['pokemon-jump'] ?? 0,
            ...(this.status ? { status: this.status } : {}),
            ...(this.last ? { last: this.last } : {}),
          })
        : prizeWindowMarkup({
            record,
            now: new Date(),
            situation: this.situation(),
            ...(this.rumour ? { rumour: this.rumour } : {}),
            ...(this.status ? { status: this.status } : {}),
          });
    this.overlay.redraw(markup);
    const root = this.overlay.root;
    root.setAttribute('aria-label', this.mode === 'jump' ? 'POKéMON JUMP' : 'PRIZE WINDOW');
    root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-jumper]').forEach((button) => {
      button.onclick = () => this.toggle(button.dataset.jumper ?? '', button);
    });
    const play = root.querySelector<HTMLButtonElement>('[data-play]');
    if (play) {
      play.onclick = () => {
        if (play.getAttribute('aria-disabled') === 'true') {
          audioManager.play('denied');
          return;
        }
        this.startGame();
      };
    }
    root.querySelectorAll<HTMLButtonElement>('[data-prize]').forEach((button) => {
      button.onclick = () => this.buy(button.dataset.prize ?? '');
    });
    // The find over the list narrows it in place, and is kept over a redraw.
    wirePickerFind(root, (key) => this.overlay?.moveCursor(key), this.find);
    root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
      this.find = (event.target as HTMLInputElement).value;
    });
    if (focusOn) {
      this.overlay.refocus(focusOn, '[data-cursor-start]');
    } else {
      this.overlay.refocus(this.mode === 'jump' && this.chosen.length > 0 ? '[data-play]' : '[data-cursor-start]', '[data-close]');
    }
  }

  private toggle(id: string, button: HTMLButtonElement): void {
    if (this.chosen.includes(id)) {
      this.chosen = this.chosen.filter((other) => other !== id);
      audioManager.play('cancel');
    } else if (this.chosen.length < MAX_JUMPERS && button.getAttribute('aria-disabled') !== 'true') {
      this.chosen = [...this.chosen, id];
      audioManager.play('confirm');
    } else {
      audioManager.play('denied');
      return;
    }
    this.status = undefined;
    this.showMenu(`[data-jumper="${id}"]`);
  }

  /** What the window asks of the save: what it holds, and whether the mill has news. */
  private situation(): PrizeSituation {
    return this.game_ ? SaveManager.prizeSituation(this.game_) : { holding: () => 0, rumourToTell: false };
  }

  private buy(id: string): void {
    // The click that opened the window must not be the one that buys.
    if (this.time.now - this.openedAt < RELEASE_ARMING_MS) return;
    const prize = prizeById(id);
    if (!prize) return;
    const refusal = prizeRefusal(prize, this.record(), new Date(), this.situation());
    if (refusal) {
      audioManager.play('denied');
      this.status = refusal;
      this.showMenu(`[data-prize="${id}"]`);
      return;
    }
    const bought = this.saveManager.buyTicketPrize(id);
    if (!bought) {
      audioManager.play('denied');
      this.status = 'The window could not take that. Nothing was spent.';
      this.showMenu(`[data-prize="${id}"]`);
      return;
    }
    audioManager.play('itemObtained');
    recordAction(`Bought ${prizeName(prize)} for tickets`);
    this.game_ = bought.game;
    this.rumour = bought.rumour?.line;
    this.status = bought.pokemon
      ? `${bought.pokemon.name.toUpperCase()} went to your boxes. Put it on the team with P.`
      : bought.rumour
        ? 'Heard. The slip is kept with every rumour you have heard.'
        : `${prizeName(prize)} - it is waiting at home.`;
    this.showMenu(`[data-prize="${id}"]`);
  }

  private onMenuKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  // --- the game -------------------------------------------------------------------

  private startGame(): void {
    const stash = this.game_?.stash;
    if (!stash || this.chosen.length === 0) return;
    const species = this.chosen.flatMap((id) => {
      const stored = stash.listPokemon().find((candidate) => candidate.id === id);
      return stored ? [stored.pokemon.base.id] : [];
    });
    this.overlay?.destroy();
    this.overlay = undefined;
    this.status = undefined;
    audioManager.play('confirm');
    recordAction(`Played POKéMON JUMP with ${species.join(', ')}`);
    this.jump = startPokemonJump(species, (Math.random() * 2 ** 32) >>> 0);
    this.pressed = false;
    this.phase = { kind: 'countdown', elapsed: 0 };
    this.buildStage();
  }

  private onGameKey(event: KeyboardEvent): void {
    if (this.phase.kind === 'menu') return;
    if (event.key === 'Escape') {
      if (this.phase.kind === 'playing' || this.phase.kind === 'countdown') this.finish();
      return;
    }
    if ([' ', 'Enter', 'ArrowUp', 'z', 'Z', 'x', 'X'].includes(event.key) && !event.repeat) {
      event.preventDefault();
      this.pressed = true;
    }
  }

  public update(_time: number, delta: number): void {
    const phase = this.phase;
    if (phase.kind === 'menu' || !this.jump) return;
    if (phase.kind === 'countdown') {
      const elapsed = phase.elapsed + delta;
      this.phase = { kind: 'countdown', elapsed };
      const left = Math.ceil((COUNTDOWN_MS - elapsed) / (COUNTDOWN_MS / 3));
      this.bigText?.setText(left > 0 ? String(left) : 'JUMP!');
      if (elapsed >= COUNTDOWN_MS) {
        this.phase = { kind: 'playing' };
        this.bigText?.setText('');
      }
      // A key pressed in the count is a jump on the first frame, never lost.
      this.drawStage();
      return;
    }
    if (phase.kind === 'hit') {
      const elapsed = phase.elapsed + delta;
      this.phase = { kind: 'hit', elapsed };
      this.drawStage();
      if (elapsed >= HIT_PAUSE_MS) this.finish();
      return;
    }
    const press = this.pressed;
    this.pressed = false;
    this.jump = advancePokemonJump(this.jump, delta, press);
    for (const event of this.jump.events) {
      if (event.kind === 'jump') audioManager.play('ledgeHop');
      if (event.kind === 'cleared') audioManager.play('select');
      if (event.kind === 'bonus') this.shout(`+${event.points}`, '#f8e070');
      if (event.kind === 'excellent') {
        audioManager.play('confirm');
        this.shout(event.inRow > 1 ? `EXCELLENT x${event.inRow}!` : 'EXCELLENT!', '#f860b0');
      }
      if (event.kind === 'hit') {
        audioManager.play('bump');
        this.shout('OUCH!', '#f05050');
        this.cameras.main.shake(180, 0.006);
      }
    }
    if (this.jump.over) {
      this.phase = { kind: 'hit', elapsed: 0 };
    }
    this.drawStage();
  }

  /** The game is over: its score written and paid, and the cabinet's screen back up. */
  private finish(): void {
    const jump = this.jump;
    if (!jump) return;
    const score = jump.score;
    const written = this.saveManager.playJump(score);
    if (written) {
      this.game_ = written.game;
      this.last = { score, payout: written.payout, berries: written.berries };
      if (written.payout.tickets > 0 || written.berries.length > 0) audioManager.play('itemObtained');
    } else {
      this.last = undefined;
      this.status = 'The cabinet could not write that down. Nothing was paid.';
    }
    recordAction(`POKéMON JUMP scored ${score}`);
    this.tearDownStage();
    this.jump = undefined;
    this.phase = { kind: 'menu' };
    this.openedAt = this.time.now;
    this.showMenu('[data-play]');
  }

  private shout(words: string, colour: string): void {
    this.callout?.text.destroy();
    const { width } = this.scale;
    const text = this.add
      .text(Math.round(width / 2), Math.round(this.groundY() - 112), words, {
        fontFamily: GAME_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: colour,
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);
    this.callout = { text, until: this.time.now + CALLOUT_MS };
  }

  private groundY(): number {
    return this.scale.height - GROUND_INSET;
  }

  // --- drawing -------------------------------------------------------------------

  private buildStage(): void {
    this.tearDownStage();
    const { width, height } = this.scale;
    const ground = this.groundY();
    const back = this.add.graphics().setDepth(0);
    // Venusaur's clearing, drawn in FireRed's colours: a sky, a wood along the
    // back of the meadow, the meadow itself with flowers in it, and the patch
    // the vine has worn bare under the jumpers' feet.
    const horizon = Math.round(height * 0.36);
    back.fillStyle(0x88c8f8, 1).fillRect(0, 0, width, horizon);
    back.fillStyle(0xb8e0f8, 1).fillRect(0, Math.round(horizon * 0.55), width, Math.round(horizon * 0.2));
    for (let x = -8; x < width + 16; x += 22) {
      const lift = (x * 13) % 9;
      back.fillStyle(0x286828, 1).fillCircle(x, horizon - 4 - lift, 15);
      back.fillStyle(0x40a048, 1).fillCircle(x - 3, horizon - 8 - lift, 10);
      back.fillStyle(0x70c870, 1).fillCircle(x - 6, horizon - 12 - lift, 4);
    }
    back.fillStyle(0x58b058, 1).fillRect(0, horizon, width, height - horizon);
    back.fillStyle(0x70c870, 1).fillRect(0, horizon, width, 2);
    for (let i = 0; i < 46; i += 1) {
      const x = (i * 53) % width;
      const y = horizon + 8 + ((i * 37) % Math.max(8, height - horizon - 40));
      back.fillStyle(0x48a048, 1).fillRect(x, y, 2, 2);
      if (i % 4 === 0) back.fillStyle(i % 8 === 0 ? 0xf86060 : 0xf8e070, 1).fillRect(x + 4, y - 1, 2, 2);
    }
    // The mound Venusaur sits on.
    back.fillStyle(0x488838, 1).fillEllipse(Math.round(width / 2), 62, 92, 22);
    back.fillStyle(0x68b050, 1).fillEllipse(Math.round(width / 2), 60, 80, 16);
    back.fillStyle(0xb09060, 1).fillEllipse(Math.round(width / 2), ground + 2, width - 40, 18);
    back.fillStyle(0xd0b080, 1).fillEllipse(Math.round(width / 2), ground, width - 64, 10);
    const venusaur = this.add.image(Math.round(width / 2), 6, pokemonTextureKey('front', 3)).setOrigin(0.5, 0).setDepth(1);
    this.vine = this.add.graphics().setDepth(2);
    const jumpers = this.jump?.jumpers ?? [];
    const spacing = Math.min(80, Math.floor((width - 40) / Math.max(1, jumpers.length)));
    const left = Math.round(width / 2 - (spacing * (jumpers.length - 1)) / 2);
    const stash = this.game_?.stash;
    this.jumperFeet = [];
    this.jumperSprites = jumpers.map((jumper, index) => {
      const dexId = stash?.listPokemon().find((stored) => stored.pokemon.base.id === jumper.species)?.pokemon.base.dexId ?? 1;
      const feet = ground + backPictureEmptyRows(dexId) + JUMPER_SINK;
      this.jumperFeet.push(feet);
      return this.add.image(left + index * spacing, feet, pokemonTextureKey('back', dexId)).setOrigin(0.5, 1).setDepth(3);
    });
    // The worn patch's front half, over the jumpers' feet, so the flat cut of a
    // back picture is hidden behind the ground rather than hanging in the air.
    const lip = this.add.graphics().setDepth(3.5);
    const centre = Math.round(width / 2);
    const rim = (radiusX: number, radiusY: number, y: number): Phaser.Math.Vector2[] =>
      Array.from({ length: 33 }, (_point, step) => {
        const angle = (Math.PI * step) / 32;
        return new Phaser.Math.Vector2(centre + Math.cos(angle) * radiusX, y + Math.sin(angle) * radiusY);
      });
    lip.fillStyle(0xb09060, 1).fillPoints(rim((width - 40) / 2, 9, ground + 2), true);
    lip.fillStyle(0xd0b080, 1).fillPoints(rim((width - 64) / 2, 5, ground), true);
    this.jumperLip = lip;
    this.vineFront = this.add.graphics().setDepth(4);
    const panel = this.add.graphics().setDepth(10);
    drawPixelWindow(panel, { x: 4, y: 4, width: 84, height: 32 }, { fill: WINDOW_CREAM });
    this.scoreText = this.add
      .text(9, 6, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK, lineSpacing: 0 })
      .setDepth(11);
    this.bigText = this.add
      .text(Math.round(width / 2), Math.round(height * 0.55), '', {
        fontFamily: GAME_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);
    const hint = this.add
      .text(Math.round(width / 2), height - 2, 'SPACE: jump · ESC: stop', {
        fontFamily: GAME_FONT,
        fontSize: CHIP_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);
    this.stage = this.add.container(0, 0, [back, venusaur, panel, hint]).setDepth(0);
    this.drawStage();
  }

  private tearDownStage(): void {
    this.stage?.destroy(true);
    this.stage = undefined;
    for (const sprite of this.jumperSprites) sprite.destroy();
    this.jumperSprites = [];
    this.jumperFeet = [];
    this.jumperLip?.destroy();
    this.jumperLip = undefined;
    this.vine?.destroy();
    this.vine = undefined;
    this.vineFront?.destroy();
    this.vineFront = undefined;
    this.scoreText?.destroy();
    this.scoreText = undefined;
    this.bigText?.destroy();
    this.bigText = undefined;
    this.callout?.text.destroy();
    this.callout = undefined;
    this.cameras?.main?.resetFX();
  }

  /**
   * The vine round its swing, as a rope seen from in front: up over
   * Venusaur's head at its highest, down under the jumpers' feet at its
   * lowest - which is FireRed's hit position, `VINE_UPSWING_LOWER` - and in
   * front of them on the way down, behind them on the way back up.
   */
  private drawStage(): void {
    const jump = this.jump;
    if (!jump || !this.vine || !this.vineFront) return;
    const { width } = this.scale;
    const ground = this.groundY();
    const anchorY = 48;
    const theta = 2 * Math.PI * (vineTurn(jump) - 0.6) + Math.PI;
    const drop = -Math.cos(theta);
    const inFront = Math.sin(theta) > 0;
    const reach = Math.round(width / 2 - 10);
    const cx = Math.round(width / 2);
    this.vine.clear();
    this.vineFront.clear();
    const target = inFront ? this.vineFront : this.vine;
    const depthOf = (u: number): number =>
      drop >= 0 ? (1 - u * u) * drop * (ground + 2 - anchorY) : (1 - u * u) * drop * (anchorY - 4);
    let previous: { x: number; y: number } | null = null;
    for (let step = 0; step <= 64; step += 1) {
      const u = -1 + step / 32;
      const x = Math.round(cx + u * reach);
      const y = Math.round(anchorY + depthOf(u));
      if (previous) {
        target.lineStyle(5, 0x205820, 1).lineBetween(previous.x, previous.y, x, y);
        target.lineStyle(3, 0x58c040, 1).lineBetween(previous.x, previous.y, x, y);
      }
      previous = { x, y };
    }
    jump.jumpers.forEach((jumper, index) => {
      const sprite = this.jumperSprites[index];
      if (!sprite) return;
      sprite.y = (this.jumperFeet[index] ?? ground) + Math.round(jumper.offset * JUMP_DRAW_SCALE);
      if (jumper.hit) sprite.setTint(0xf06060);
    });
    this.scoreText?.setText([`SCORE ${jump.score.toLocaleString('en-GB')}`, `JUMPS ${jump.jumpsInRow}`]);
    if (this.callout && this.time.now > this.callout.until) {
      this.callout.text.destroy();
      this.callout = undefined;
    }
  }

  private close(): void {
    if (!this.scene.isActive('game-corner')) {
      return;
    }
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
