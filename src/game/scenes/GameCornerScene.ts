import Phaser from 'phaser';
import { getSpeciesById } from '../pokemon/species';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { BATTLE_PIC_COORDS } from '../pokemon/generated/battlePicCoords';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { MenuOverlay } from '../ui/MenuOverlay';
import { takeDownPixelStatus } from '../ui/pixelUi';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_PAPER, WINDOW_INK } from '../ui/pixelWindow';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import { prizeWindowMarkup } from '../minigames/gameCornerView';
import { advancePokemonJump, startPokemonJump, vineTurn, type PokemonJumpGame } from '../minigames/pokemonJump';
import { NO_GAME_CORNER, prizeById, prizeName, prizeRefusal, RUMOUR_BOUGHT_LINE, type GameCornerRecord, type PrizeSituation } from '../minigames/tickets';
import { ticketLadder } from '../minigames/ticketLadder';
import { jumpLineup, jumpTeam, stepAlong, type Contender } from '../minigames/whoPlays';
import { isFigureSpecies, pokemonIconFrames, POKEMON_ICON_TEXTURE } from '../world/pokemonFigures';
import { capOf, KeyStrip, ReadySetGo, ResultCard } from './readySetGo';

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
  | { readonly kind: 'ready' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'hit'; readonly elapsed: number }
  | { readonly kind: 'result' };

/**
 * THE GAME CORNER's two screens over the paused harbour, as the boutique is
 * (`BoutiqueScene`): the POKéMON JUMP cabinet - its start line, the game
 * itself and what it paid - and the PRIZE WINDOW.
 *
 * The rules are `minigames/pokemonJump.ts` and nothing here decides anything:
 * the scene hands the game each frame's milliseconds and whether the key was
 * pressed, and draws what comes back. The game is drawn on the canvas, on the
 * scene clock - a Venusaur at the top swinging its vine, the jumpers from
 * behind, their own back sprites. The cabinet opens straight onto its start
 * line (`readySetGo.ts`): the partner leading the jump if it can, else the
 * house's PIKACHU, LEFT and RIGHT through the count for the next who can
 * (`minigames/whoPlays.ts`); the result is drawn over the clearing with the
 * pay table, once. The prize window is a pixel-ui screen
 * (`minigames/gameCornerView.ts`). What a game pays and what a prize costs are
 * written by `SaveManager.playJump` and `buyTicketPrize`, one write each.
 */
export class GameCornerScene extends Phaser.Scene implements ProvidesFeedbackContext {
  /** When the last game ended: SPACE takes no press for `RESULT_HOLD_MS` after. */
  private finishedAt = Number.NEGATIVE_INFINITY;
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private mode: GameCornerSceneData['mode'] = 'jump';
  private game_: RestoredGame | undefined;
  /** Who could lead the jump, the first in line leading (`whoPlays.ts`). */
  private contenders: Contender[] = [];
  private lead = 0;
  private team: Contender[] = [];
  private status: string | undefined;
  /** THE RUMOUR MILL's slip just bought, said in the bar. */
  private rumour: string | undefined;
  private phase: Phase = { kind: 'menu' };
  private ready: ReadySetGo | undefined;
  private strip: KeyStrip | undefined;
  private card: ResultCard | undefined;
  private jump: PokemonJumpGame | undefined;
  private pressed = false;
  private openedAt = 0;
  /** The prize asked about and not yet bought or kept (`PrizeWindowState.asking`). */
  private asking: string | undefined;
  /** When it was asked, so the second half of a double-click on the row cannot buy it. */
  private askedAt = Number.NEGATIVE_INFINITY;
  private stage: Phaser.GameObjects.Container | undefined;
  private vine: Phaser.GameObjects.Graphics | undefined;
  private vineFront: Phaser.GameObjects.Graphics | undefined;
  private jumperSprites: Phaser.GameObjects.Image[] = [];
  /** Where each jumper's picture stands on the ground, by its own empty rows. */
  private jumperFeet: number[] = [];
  private jumperLip: Phaser.GameObjects.Graphics | undefined;
  private scoreText: Phaser.GameObjects.Text | undefined;
  private callout: { text: Phaser.GameObjects.Text; until: number } | undefined;
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
    this.asking = undefined;
    this.askedAt = Number.NEGATIVE_INFINITY;
    this.phase = { kind: 'menu' };
    this.jump = undefined;
    this.pressed = false;
    this.ready = undefined;
    this.strip = undefined;
    this.card = undefined;
    this.game_ = this.saveManager.load() ?? undefined;
    this.contenders = this.game_ ? jumpLineup(this.game_.stash) : [];
    this.lead = 0;
    this.team = [];
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
      if (this.phase.kind === 'playing' || this.phase.kind === 'ready') this.pressed = true;
    });
    // The cabinet is the game: it opens on its start line, never on a form.
    if (this.mode === 'jump') this.startGame();
    else this.showMenu();
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

  /** For a playtest driver: where the screen is - the start line, the vine, the hit or the result. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  /** For a playtest driver and the tests: who could lead, in the order LEFT and RIGHT offer them. */
  public get lineupIds(): readonly string[] {
    return this.contenders.map((contender) => contender.id);
  }

  /** For a playtest driver and the tests: who is jumping, the lead first. */
  public get teamIds(): readonly string[] {
    return this.team.map((contender) => contender.id);
  }

  /** For a playtest driver: put somebody at the head of the jump, by id, as LEFT and RIGHT would. */
  public playWith(id: string): boolean {
    const index = this.contenders.findIndex((contender) => contender.id === id);
    if (index < 0 || this.mode !== 'jump') return false;
    this.lead = index;
    this.startGame();
    return true;
  }

  private record(): GameCornerRecord {
    return this.game_?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  // --- the screens ---------------------------------------------------------------

  private showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui', (event) => this.onMenuKey(event));
    }
    const markup = prizeWindowMarkup({
      record: this.record(),
      now: new Date(),
      situation: this.situation(),
      ...(this.rumour ? { rumour: this.rumour } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.asking ? { asking: this.asking } : {}),
    });
    this.overlay.redraw(markup);
    const root = this.overlay.root;
    root.setAttribute('aria-label', 'PRIZE WINDOW');
    root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-prize]').forEach((button) => {
      button.onclick = () => this.ask(button.dataset.prize ?? '');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-prize-cancel]').forEach((button) => {
      button.onclick = () => this.keepTickets();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-prize-confirm]').forEach((button) => {
      button.onclick = () => this.buy(button.dataset.prizeConfirm ?? '');
    });
    if (focusOn) {
      this.overlay.refocus(focusOn, '[data-cursor-start]');
    } else {
      this.overlay.refocus('[data-cursor-start]', '[data-close]');
    }
  }

  /** What the window asks of the save: what it holds, and whether the mill has news. */
  private situation(): PrizeSituation {
    return this.game_ ? SaveManager.prizeSituation(this.game_) : { holding: () => 0, rumourToTell: false };
  }

  /**
   * A press on a prize asks before it spends: the row becomes the question,
   * with the cursor on NOT NOW, as Bill's barters do. A prize that cannot be
   * had says why at once, with nothing to answer.
   */
  private ask(id: string): void {
    // The click that opened the window must not be the one that asks.
    if (this.time.now - this.openedAt < RELEASE_ARMING_MS) return;
    const prize = prizeById(id);
    if (!prize) return;
    this.catchUp();
    const refusal = prizeRefusal(prize, this.record(), new Date(), this.situation());
    if (refusal) {
      audioManager.play('denied');
      this.asking = undefined;
      this.status = refusal;
      this.showMenu(`[data-prize="${id}"]`);
      return;
    }
    audioManager.play('select');
    this.asking = id;
    this.askedAt = this.time.now;
    this.status = undefined;
    this.showMenu('[data-prize-cancel]');
  }

  /**
   * Reads the save again. Two tabs share one save, and the window drew the
   * tickets it read when it opened: without this a tab the other had spent
   * from kept showing tickets it no longer had, and refused every prize with
   * no reason (the harbour bug hunt of 10 Nov 2026).
   */
  private catchUp(): void {
    this.game_ = this.saveManager.load() ?? this.game_;
  }

  private keepTickets(): void {
    const id = this.asking;
    this.asking = undefined;
    audioManager.play('cancel');
    this.showMenu(id ? `[data-prize="${id}"]` : undefined);
  }

  private buy(id: string): void {
    // The second half of the double-click that asked lands on BUY.
    if (id !== this.asking || this.time.now - this.askedAt < RELEASE_ARMING_MS) return;
    this.asking = undefined;
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
      // Refused by the save itself: most often another tab spent the tickets
      // since this window last read it, so it reads it again and says why.
      this.catchUp();
      this.status =
        prizeRefusal(prize, this.record(), new Date(), this.situation()) ??
        'The window could not take that. Nothing was spent.';
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
        ? RUMOUR_BOUGHT_LINE
        : `${prizeName(prize)} - it is waiting at home.`;
    this.showMenu(`[data-prize="${id}"]`);
  }

  private onMenuKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      // Out of a question first, and only then out of the window.
      if (this.asking) {
        this.keepTickets();
        return;
      }
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
      // What was said about the last prize goes as the cursor leaves it: it
      // stood under every row after, so TM18 read "You have one already"
      // (the harbour critic tour, 26 Nov 2026).
      if (this.status !== undefined && !this.asking) {
        this.status = undefined;
        if (this.overlay) takeDownPixelStatus(this.overlay.root);
      }
    }
  }

  // --- the game -------------------------------------------------------------------

  /** The vine set up fresh with whoever leads, and the start line counting in over it. */
  private startGame(): void {
    const lead = this.contenders[this.lead];
    this.tearDownStage();
    this.status = undefined;
    if (!lead) {
      this.close();
      return;
    }
    this.team = jumpTeam(lead, this.contenders);
    const species = this.team.map((jumper) => jumper.species);
    recordAction(`Played POKéMON JUMP with ${species.join(', ')}`);
    this.jump = startPokemonJump(species, (Math.random() * 2 ** 32) >>> 0);
    this.pressed = false;
    this.phase = { kind: 'ready' };
    this.buildStage();
    this.ready = new ReadySetGo(
      this,
      {
        demo: 'jump',
        countMs: COUNTDOWN_MS,
        ...(isFigureSpecies(lead.species) ? { figure: { texture: POKEMON_ICON_TEXTURE, frames: pokemonIconFrames(lead.species) } } : {}),
      },
      { dexId: lead.dexId, shiny: lead.shiny, name: lead.name, mates: this.team.slice(1).map((mate) => mate.species) },
      this.contenders.length > 1,
    );
  }

  private onGameKey(event: KeyboardEvent): void {
    if (this.phase.kind === 'menu') return;
    const cap = capOf(event.key);
    if (this.phase.kind === 'result') {
      this.card?.press(event.key);
      if (cap === 'esc') {
        event.preventDefault();
        this.close();
      } else if (cap === 'space' && !event.repeat && this.time.now - this.finishedAt >= RESULT_HOLD_MS) {
        // The score is seen before SPACE takes a press: SPACE jumps, and the
        // press still going at the end started the next game over the result
        // (the harbour re-critic, 26 Nov 2026).
        event.preventDefault();
        audioManager.play('confirm');
        this.startGame();
      }
      return;
    }
    if (this.phase.kind === 'ready') {
      if (cap === 'esc') {
        // Nothing played yet: back to the harbour, nothing written.
        event.preventDefault();
        this.close();
        return;
      }
      if (cap === 'left' || cap === 'right') {
        event.preventDefault();
        if (event.repeat || this.contenders.length < 2) return;
        audioManager.play('select');
        this.lead = stepAlong(this.contenders.length, this.lead, cap === 'left' ? -1 : 1);
        this.startGame();
        return;
      }
    }
    if (event.key === 'Escape') {
      if (this.phase.kind === 'playing') this.finish();
      return;
    }
    if ([' ', 'Enter', 'ArrowUp', 'z', 'Z', 'x', 'X'].includes(event.key) && !event.repeat) {
      event.preventDefault();
      this.strip?.press(event.key);
      this.pressed = true;
    }
  }

  public update(_time: number, delta: number): void {
    const phase = this.phase;
    if (phase.kind === 'result') {
      this.card?.tick(delta);
      return;
    }
    if (phase.kind === 'menu' || !this.jump) return;
    const split = this.ready?.tick(delta);
    if (phase.kind === 'ready') {
      if (!this.ready?.done) {
        // A key pressed in the count is a jump on the first frame, never lost.
        this.drawStage();
        return;
      }
      this.phase = { kind: 'playing' };
      this.strip = new KeyStrip(this, ['space']);
      this.play(split?.play ?? 0);
      return;
    }
    if (phase.kind === 'hit') {
      const elapsed = phase.elapsed + delta;
      this.phase = { kind: 'hit', elapsed };
      this.drawStage();
      if (elapsed >= HIT_PAUSE_MS) this.finish();
      return;
    }
    this.strip?.tick(delta);
    this.play(delta);
  }

  /** The vine moved on by `delta` ms of play, with the key if it went down. */
  private play(delta: number): void {
    if (!this.jump) return;
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

  /** The game is over: its score written and paid, and what it came to drawn over the clearing. */
  private finish(): void {
    const jump = this.jump;
    if (!jump) return;
    const score = jump.score;
    const written = this.saveManager.playJump(score);
    if (written) {
      this.game_ = written.game;
      if (written.payout.tickets > 0 || written.berries.length > 0) audioManager.play('itemObtained');
    }
    recordAction(`POKéMON JUMP scored ${score}`);
    this.strip?.destroy();
    this.strip = undefined;
    this.ready?.destroy();
    this.ready = undefined;
    this.phase = { kind: 'result' };
    this.finishedAt = this.time.now;
    const lead = this.team[0];
    this.card = new ResultCard(this, {
      ...(lead ? { face: { dexId: lead.dexId, shiny: lead.shiny } } : {}),
      headline: `SCORE ${score.toLocaleString('en-GB')}`,
      ...(written ? {} : { note: 'Nothing could be written down.' }),
      newBest: written?.payout.newBest ?? false,
      earned: written?.payout.tickets ?? 0,
      finds: written?.berries ?? [],
      ladder: written ? ticketLadder('pokemon-jump', score, written.game.raidProgress.gameCorner ?? NO_GAME_CORNER, new Date()) : null,
    });
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
    this.jumperFeet = [];
    this.jumperSprites = jumpers.map((jumper, index) => {
      // By its kind, not by a stored Pokémon: the house's lent PIKACHU is in no
      // box, and fell back to dex 1, a BULBASAUR (the re-critic, 26 Nov 2026).
      const dexId = getSpeciesById(jumper.species)?.dexId ?? 1;
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
    drawPixelWindow(panel, { x: 4, y: 4, width: 84, height: 32 }, { fill: WINDOW_PAPER });
    this.scoreText = this.add
      .text(9, 6, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK, lineSpacing: 0 })
      .setDepth(11);
    this.stage = this.add.container(0, 0, [back, venusaur, panel]).setDepth(0);
    this.drawStage();
  }

  private tearDownStage(): void {
    this.ready?.destroy();
    this.ready = undefined;
    this.strip?.destroy();
    this.strip = undefined;
    this.card?.destroy();
    this.card = undefined;
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
