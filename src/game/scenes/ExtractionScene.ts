import Phaser from 'phaser';
import { moodOfRaid } from '../base/arenaCrowd';
import { currentTry, homeAfterRaid, recordWalkedOut } from '../maker/tryIt';
import { countPlay, raidEnding } from '../analytics/playCounter';
import { friendRoom } from '../raidRoom/friendRoom';
import { audioManager } from '../audio/AudioManager';
import { isPlaytestRun } from '../dev/playtestMode';
import { nextStepLines } from '../hub/nextStep';
import { RAID_KEY_LETTERS } from '../input/keyBindings';
import { resultMoment, STOW_LABEL, type HaulStow, type ResultMoment } from '../run/resultMoment';
import { SaveManager } from '../save/SaveManager';
import { formatElapsedClock } from '../run/raidClock';
import {
  buildDefeatSequence,
  createBeatGate,
  type BeatGate,
  type DefeatBeat,
  type DefeatFigure,
  type DefeatSequence,
} from '../run/defeatSequence';
import type {
  ExtractionReport,
  ReportGroup,
  ReportItem,
  ReportPokemon,
} from '../run/extractionReport';
import { formatMoney, isCurrency, itemAmountFor, itemCountTag } from '../items';
import { publicAssetUrl } from '../publicAssetUrl';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import { iconUrl, itemIcon, itemIconName, objectiveIcon, WORLD_ICONS } from '../ui/icons';
import { MenuOverlay } from '../ui/MenuOverlay';
import type { SceneDescription } from '../dev/testDescribe';
import { formatExperience } from '../ui/pokemonSummary';
import { pixelCommitBar, pixelHpBar, pixelScreen, pixelShinyStar, pixelTag, pixelWindow } from '../ui/pixelUi';
import { pixelMonIconForDex } from '../ui/monIcon';

export interface ExtractionSceneData {
  readonly report: ExtractionReport;
}

/**
 * The raid result screen: the one place a finished raid is accounted for.
 *
 * It replaces the queue of dialogue boxes that used to narrate an extraction, so
 * the payoff of the loop is a screen rather than five sentences. It serves a wipe
 * too, because the accounting is the same three questions - what you take home,
 * what the secure slot was worth, and what the raid cost - and answering them in
 * two different places is how they drift apart. The losing view is styled as a
 * loss: no accent green, no reward framing, and the ledger names what is gone.
 */
/**
 * How long the way out of the screen stays disabled after it opens.
 *
 * A raid resolves out of a dialogue the player is already tapping through, and
 * without this the same tap that closed the last battle line dismisses the
 * result before it has been read.
 *
 * Both ways in are held: the button is disabled, and the scene's own key
 * listener refuses until the same moment.
 */
const INPUT_LOCK_MS = 900;

/**
 * The shorter hold used on the way out of the defeat sequence.
 *
 * The full lock exists to absorb the tap that closed the last battle line. That
 * tap is spent on the sequence's own first beat now, and every beat after it is
 * a press the player made deliberately, so the report only has to survive the
 * last of those presses being held down a moment too long.
 */
const SETTLED_LOCK_MS = 350;

/** Keys that are only ever half of a keypress, so they never advance a beat. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']);

/**
 * What the result screen says for a raid another window settled while this one
 * was away (`ExtractionReport.settledElsewhere`): the base took it for
 * abandoned - the pack lost, the team home as it set out - so nothing this
 * raid found or did was written, and the screen says that rather than an
 * account of a haul that never reached BILL'S PC (the vale hunt, finding 1).
 */
export const SETTLED_ELSEWHERE = {
  headline: 'ANOTHER WINDOW SETTLED THIS RAID.',
  summary: 'This window was away so long that the game, opened in another, took the raid for abandoned.',
  ledger: 'Nothing this raid found or did reached BILL’S PC. Your pack was lost with what was in it, as an abandoned raid’s is.',
  team: 'Your team went home from the other window, as it set out. What it did out here does not count.',
  note: 'Nothing here was banked: your base is as the other window left it.',
} as const;

/**
 * The same screen for a raid another window took up where this one left it
 * (`ExtractionReport.takenUpElsewhere`, `run/raidResume.ts`): nothing was
 * settled and nothing lost - the raid is still out, in the other window - so
 * this one only says that what it did after it went quiet does not count.
 */
export const TAKEN_UP_ELSEWHERE = {
  place: 'Raid in another window',
  headline: 'YOUR OTHER WINDOW HAS THIS RAID.',
  summary: 'This window was away, and the game, opened in another, picked the raid up where it stood.',
  ledger: 'Nothing this window did after it went quiet counts. Your pack and everything in it are still out on the raid.',
  team: 'Your team is still out, on the raid in the other window.',
  title: 'Still out in another window',
  note: 'Nothing here was banked: finish the raid in the other window.',
} as const;

export class ExtractionScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private report!: ExtractionReport;
  private leaving = false;
  private locked = true;
  /** A raid that got out opens on its moment (`run/resultMoment.ts`); this is whether the full report has been asked for. */
  private fullReport = false;
  /** Set while the defeat sequence is on screen, which is when a key advances. */
  private sequencePlaying = false;
  private sequenceBeats: readonly DefeatBeat[] = [];
  /** The beat on screen, or -1 during the lead-in before the first one lands. */
  private beatIndex = -1;
  private leadInTimer: Phaser.Time.TimerEvent | null = null;
  /** Swallows presses carried in from the battle; see `DefeatSequence.holdMs`. */
  private beatGate: BeatGate = createBeatGate(0);
  private promptTimer: Phaser.Time.TimerEvent | null = null;
  private sequenceHoldMs = 0;
  private defeatStage: HTMLElement | null = null;
  /** The sack's chime is owed once the screen answers, because nothing hopped to sound it (`hookStow`). */
  private chimeAtLock = false;

  public constructor() {
    super('extraction');
  }

  /**
   * Phaser reuses one instance per scene key, so every field describing the last
   * result outlives it. Everything the sequence sets is cleared here.
   */
  /** How the raid ended, for test mode's `describe()` and its event log (`dev/testDescribe.ts`). */
  public describeForTest(): SceneDescription {
    const report = this.report;
    return report
      ? {
          outcome: report.outcome,
          cause: report.cause ?? null,
          headline: report.headline,
          clock: report.clockLabel,
          contract: report.contract ? { done: report.contract.complete, reward: report.contract.reward } : null,
          exit: report.eyebrow,
        }
      : {};
  }

  public init(data: ExtractionSceneData): void {
    this.report = data.report;
    this.leaving = false;
    this.locked = true;
    this.fullReport = false;
    this.sequencePlaying = false;
    this.sequenceBeats = [];
    this.beatIndex = -1;
    this.leadInTimer = null;
    this.promptTimer?.remove(false);
    this.promptTimer = null;
    this.defeatStage = null;
    this.chimeAtLock = false;
  }

  public create(): void {
    // A map maker's TRY IT that ended through an exit is the walk the last
    // check asks for, recorded against the version of the draft it was.
    const attempt = currentTry();
    if (attempt && this.report.outcome === 'ESCAPED') {
      recordWalkedOut(attempt);
    }
    if (!attempt) {
      countPlay({ kind: 'raid-end', detail: raidEnding(this.report) });
    }
    // Every raid ends here, and a raid with a friend is the room's whole
    // purpose: the room is left, and the friend sees this player go at once
    // and raids on alone (`raidRoom/friendRoom.ts`). A room can only be raided
    // on its own map (`HubScene.startRun`), so any raid ending is its raid's.
    friendRoom()?.leave();
    this.cameras.main.fadeIn?.(200, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'extraction-menu', (event) => this.handleKey(event));
    this.overlay.root.setAttribute('aria-label', 'Raid result');
    const sequence = buildDefeatSequence(this.report);
    if (sequence) {
      this.playDefeatSequence(sequence);
      return;
    }
    this.showReport(INPUT_LOCK_MS);
  }

  /**
   * Opens the defeat beats over the result screen and then waits for the player.
   *
   * The only timer here is the lead-in, which is the tableau standing before it
   * falls rather than a beat being read out; everything after it moves because
   * the player moved it. Nothing can strand them: a key or a click always
   * advances, and the beat after the last one is the report.
   */
  private playDefeatSequence(sequence: DefeatSequence): void {
    this.sequencePlaying = true;
    this.sequenceBeats = sequence.beats;
    this.beatIndex = -1;
    this.overlay.root.innerHTML = defeatMarkup(sequence);
    const stage = this.overlay.root.querySelector<HTMLElement>('[data-defeat]');
    if (!stage) {
      this.finishDefeatSequence();
      return;
    }
    this.defeatStage = stage;
    // A click anywhere on the stage advances, so the prompt is a signpost for
    // the behaviour rather than the only target for it.
    this.beatGate = createBeatGate(sequence.holdMs);
    this.sequenceHoldMs = sequence.holdMs;
    stage.onpointerdown = () => this.pressDefeatSequence(false);
    this.leadInTimer = this.time.delayedCall(sequence.leadInMs, () =>
      this.advanceDefeatSequence(),
    );
  }

  /**
   * A key or a click, as opposed to the lead-in running out. It moves the
   * sequence only once the beat on screen is listening, so nothing the player
   * was already pressing when they got here costs them a beat they never saw.
   */
  private pressDefeatSequence(repeat: boolean): void {
    if (this.beatGate.accepts({ nowMs: this.time.now, repeat })) {
      this.advanceDefeatSequence();
    }
  }

  /** The one way the sequence ever moves: on to the next beat, or off the screen. */
  private advanceDefeatSequence(): void {
    if (!this.sequencePlaying) {
      return;
    }
    this.leadInTimer?.remove(false);
    this.leadInTimer = null;
    const next = this.sequenceBeats[this.beatIndex + 1];
    if (!next || !this.defeatStage) {
      this.finishDefeatSequence();
      return;
    }
    this.beatIndex += 1;
    this.enterDefeatBeat(this.defeatStage, next);
  }

  /**
   * Adds the beat to the stage rather than replacing the last one.
   *
   * The states are cumulative - the party stays down while their gear is taken,
   * and stays down while the secure slot is counted - so the stage carries every
   * beat it has reached and the CSS reads them with `~=`.
   */
  private enterDefeatBeat(stage: HTMLElement, beat: DefeatBeat): void {
    stage.dataset.beat = `${stage.dataset.beat ?? ''} ${beat.id}`.trim();
    const headline = stage.querySelector<HTMLElement>('[data-defeat-headline]');
    const detail = stage.querySelector<HTMLElement>('[data-defeat-detail]');
    const prompt = stage.querySelector<HTMLElement>('[data-defeat-prompt]');
    this.beatGate.beatEntered(this.time.now);
    // The prompt is the beat saying it is listening, so it arrives with that.
    const promptLine = prompt?.parentElement;
    if (prompt && promptLine) {
      prompt.textContent = beat.prompt;
      promptLine.style.visibility = 'hidden';
      this.promptTimer?.remove(false);
      this.promptTimer = this.time.delayedCall(this.sequenceHoldMs, () => {
        promptLine.style.visibility = '';
      });
    }
    if (headline && detail) {
      headline.textContent = beat.headline;
      detail.textContent = beat.detail;
      // Removing and re-adding in the same frame restarts the caption animation,
      // which otherwise only ever plays for the first beat.
      const caption = headline.parentElement;
      caption?.classList.remove('is-entering');
      void caption?.offsetWidth;
      caption?.classList.add('is-entering');
    }
    // The fall itself is silent. It used to repeat the faint jingle, but this
    // screen is only ever reached from the battle that has just played that
    // jingle for the last Pokemon and the wipe sting after it: a third falling
    // phrase in three seconds for the one loss.
    if (beat.id === 'taken') {
      audioManager.play('lossTaken');
    }
    if (
      beat.id === 'held' &&
      (this.report.partner !== undefined || this.report.secured.pokemon.length + this.report.secured.items.length > 0)
    ) {
      audioManager.play('secureHeld');
    }
  }

  /** The single way out of the sequence, whichever beat the player left from. */
  private finishDefeatSequence(): void {
    if (!this.sequencePlaying) {
      return;
    }
    this.sequencePlaying = false;
    this.leadInTimer?.remove(false);
    this.leadInTimer = null;
    this.promptTimer?.remove(false);
    this.promptTimer = null;
    this.defeatStage = null;
    this.showReport(SETTLED_LOCK_MS);
  }

  private showReport(lockMs: number): void {
    // Only the report is a pixel-ui screen. The defeat sequence in front of it
    // is its own full-bleed tableau with its own type scale.
    this.overlay.root.classList.add('pixel-ui');
    this.overlay.root.innerHTML = this.markup();
    // Measured now rather than when the cursor lands, which waits out the lock:
    // the screen a player reads first is the one with its MORE strips drawn.
    this.overlay.layout();
    const control = this.overlay.root.querySelector<HTMLButtonElement>('[data-continue]')!;
    control.onclick = () => this.leave();
    control.disabled = true;
    this.hookFullReport();
    this.hookStow();
    this.time.delayedCall(lockMs, () => {
      this.locked = false;
      control.disabled = false;
      // The raid's own ending has already sounded on the way here. The one
      // thing this screen adds is the contract, and it says so as the screen
      // becomes answerable: played on arrival it landed 0.7s behind the
      // extraction jingle, two rising phrases running into each other. The
      // contract's fanfare says what the sack's chime would, so it is the one.
      if (this.contractToSound()) {
        audioManager.play('contractBanked');
      } else if (this.chimeAtLock) {
        audioManager.play('haulStowed');
      }
      this.chimeAtLock = false;
      // Focus only lands once the button can act on it, so the first keypress a
      // player makes after reading is the one that leaves.
      this.overlay.focus('[data-continue]');
    });
  }

  /**
   * Reached through the overlay's own claim on the keyboard, which is what gives
   * this screen a keyboard at all: WorldScene and BattleScene both capture SPACE
   * and ENTER on the game's KeyboardManager, and those captures outlive the scene
   * that asked for them, so without the overlay owning the keys first Phaser
   * would `preventDefault()` every SPACE and ENTER and leave this screen
   * mouse-only. See `overlayKeyboard.ts`.
   */
  private handleKey(event: KeyboardEvent): void {
    // While the defeat plays, every key moves it on. SPACE is the one the screen
    // advertises, because it is the key the battle dialogue advertises, but a
    // player on their tenth defeat must never have to find the right one - and a
    // bare modifier is not a keypress a player meant as one.
    if (this.sequencePlaying) {
      if (MODIFIER_KEYS.has(event.key)) {
        return;
      }
      event.preventDefault();
      this.pressDefeatSequence(event.repeat);
      return;
    }
    if (this.locked) {
      return;
    }
    // The arrows walk between the panes and read on through a long one - the
    // ledger has no control in it, so before this the end of a long contract
    // could only be reached with the mouse wheel.
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
      return;
    }
    if ((event.key === 'l' || event.key === 'L') && !this.fullReport) {
      event.preventDefault();
      this.openFullReport();
      return;
    }
    if (!['Enter', ' ', 'Escape'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    // The cursor walked over to FULL REPORT: that is what OK presses.
    if (event.key !== 'Escape' && (event.target as Element | null)?.hasAttribute?.('data-full-report') === true) {
      this.openFullReport();
      return;
    }
    this.leave();
  }

  private contractToSound(): boolean {
    return this.report.outcome === 'ESCAPED' && this.report.contract?.complete === true;
  }

  /**
   * The haul going into YOUR THINGS on the moment (`stowMarkup`): the hops are
   * CSS, and each one landing is what sounds, so the sound is never ahead of or
   * behind the picture on a slow frame. A drop each, the sack gulping, and the
   * chime as the last is in and its name is written under it. A contract's
   * fanfare says the same and more, and it sounds as the screen answers
   * whatever the sack is doing, so the sack stays quiet then. Reduced motion
   * draws it already in, and the chime waits for the screen to answer, or it
   * runs into the extraction jingle.
   */
  private hookStow(): void {
    const stow = this.overlay.root.querySelector<HTMLElement>('[data-haul-stow]');
    if (!stow) {
      return;
    }
    const things = [...stow.querySelectorAll<HTMLElement>('[data-stow-thing]')];
    const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (still || things.length === 0) {
      stow.classList.add('is-stowed');
      this.chimeAtLock = true;
      return;
    }
    const chime = () => {
      stow.classList.add('is-stowed');
      if (!this.contractToSound()) {
        audioManager.play('haulStowed');
      }
    };
    const bag = stow.querySelector<HTMLElement>('[data-stow-bag]');
    let landed = 0;
    for (const thing of things) {
      thing.addEventListener('animationend', (event) => {
        if (event.animationName !== 'haul-stow-hop' || !stow.isConnected) {
          return;
        }
        landed += 1;
        if (bag) {
          // Restarted for every catch: off, a reflow, and on again.
          bag.classList.remove('is-gulping');
          void bag.offsetWidth;
          bag.classList.add('is-gulping');
        }
        if (landed < things.length) {
          audioManager.play('haulDrop');
        } else {
          chime();
        }
      });
    }
  }

  /**
   * What the raid put in YOUR THINGS, in a row beside an open sack: each hops
   * in after the one nearer it and settles in its mouth, the sack gulps, and its name
   * and key are written under it (`run/resultMoment.ts`). Each thing knows its place in the row,
   * so how far it hops to the sack's mouth is the stylesheet's sum.
   */
  private stowMarkup(stow: HaulStow): string {
    const cells = [
      ...stow.things.map(
        (thing) =>
          `<img src="${iconUrl(itemIconName(thing.itemId))}" alt="" />${
            thing.quantity > 1 || isCurrency(thing.itemId) ? `<span class="haul-stow-count">${escapeHtml(itemCountTag(thing.itemId, thing.quantity))}</span>` : ''
          }`,
      ),
      ...(stow.more > 0 ? [`<span class="haul-stow-more">+${stow.more}</span>`] : []),
    ];
    const middle = (cells.length - 1) / 2;
    const said = [...stow.things.map((thing) => itemAmountFor(thing.itemId, thing.quantity)), ...(stow.more > 0 ? [`${stow.more} more`] : [])].join(', ');
    return `<div class="haul-stow" data-haul-stow style="--n: ${cells.length}" role="img" aria-label="${escapeHtml(`${said}, into YOUR THINGS`)}"><div class="haul-stow-row">${cells
      .map((cell, index) => `<span class="haul-stow-thing" data-stow-thing style="--at: ${index}; --from: ${index - middle}; --deep: ${index % 2}">${cell}</span>`)
      .join('')}</div><div class="haul-stow-bag" data-stow-bag><img class="haul-stow-back" src="${iconUrl(WORLD_ICONS.thingsBag)}" alt="" /><img class="haul-stow-front" src="${iconUrl(
      WORLD_ICONS.thingsBagFront,
    )}" alt="" /></div><span class="px-name haul-stow-label" aria-hidden="true">${escapeHtml(STOW_LABEL)}</span></div>`;
  }

  /** The moment's FULL REPORT button, while the moment is on screen. */
  private hookFullReport(): void {
    const full = this.overlay.root.querySelector<HTMLButtonElement>('[data-full-report]');
    if (full) {
      full.onclick = () => this.openFullReport();
    }
  }

  /** From the moment to the whole account of the raid, the cursor on the way out. */
  private openFullReport(): void {
    if (this.fullReport || this.leaving) {
      return;
    }
    this.fullReport = true;
    audioManager.play('select');
    this.overlay.root.innerHTML = this.markup();
    this.overlay.layout();
    const control = this.overlay.root.querySelector<HTMLButtonElement>('[data-continue]')!;
    control.onclick = () => this.leave();
    control.disabled = this.locked;
    if (!this.locked) {
      this.overlay.focus('[data-continue]');
    }
  }

  /**
   * What a raid that got out opens on (`run/resultMoment.ts`): the deed, one
   * picture, what else came home, and Oak's next thing - with the full report
   * one key away. The overnight critic's problem 10: the result was a ledger.
   */
  private momentMarkup(moment: ResultMoment): string {
    const report = this.report;
    const picture = moment.picture
      ? moment.picture.kind === 'pokemon'
        ? `<img class="moment-picture is-pokemon" src="${publicAssetUrl(pokemonSpritePath('front', moment.picture.dexId, moment.picture.shiny))}" alt="" />`
        : `<img class="moment-picture is-item" src="${iconUrl(itemIconName(moment.picture.itemId))}" alt="" />`
      : '';
    const next = this.nextThing();
    return pixelScreen({
      place: escapeHtml(report.eyebrow),
      title: '',
      aside: escapeHtml(this.clockAside()),
      // The help strip says what becomes of the result, as the full report's
      // does; the key for the report is on its button (the critic's third pass).
      hints: escapeHtml(this.momentNote()),
      body: `<main class="px-body extraction-moment-layout">${pixelWindow(
        `${picture}<strong class="px-name moment-headline" data-moment-headline>${escapeHtml(moment.headline)}</strong>${
          report.closeCall ? `<span class="px-wrap">${escapeHtml(report.closeCall)}</span>` : ''
        }${moment.line ? `<span class="px-wrap">${escapeHtml(moment.line)}</span>` : ''}${moment.stow ? this.stowMarkup(moment.stow) : ''}${
          next ? `<span class="px-wrap moment-next">${escapeHtml(next)}</span>` : ''
        }`,
        { className: 'extraction-moment px-tone-primary', tag: 'div' },
      )}${pixelCommitBar({
        title: escapeHtml(this.momentFooterTitle()),
        lines: [],
        actions: `<button class="px-window px-button" data-full-report>Full report [L]</button><button class="px-window px-button is-primary" data-continue>${currentTry() ? 'Back to the map maker' : 'Back to the Arena'}</button>`,
      })}</main>`,
    });
  }

  /**
   * The moment's bar: "BANKED" alone, beside two buttons, read as a word left
   * over from the ledger (the critic's third pass), so it says the money banked,
   * or that the raid is saved.
   */
  private momentFooterTitle(): string {
    const title = this.footerTitle();
    if (title !== 'Banked') {
      return title;
    }
    const money = this.report.ledger.items.filter((item) => isCurrency(item.itemId)).reduce((sum, item) => sum + item.quantity, 0);
    return money > 0 ? `${formatMoney(money)} banked` : 'Saved';
  }

  /**
   * The moment's note: where a raid that brought home only Pokemon left them, in
   * the words the rail uses next ("waiting at base"), not the full report's
   * "Everything above is on BILL'S PC" - a name a first raid has never heard,
   * over one Pidgey (the critic's fourth pass).
   */
  private momentNote(): string {
    const { ledger, saved } = this.report;
    if (saved && ledger.items.length === 0 && ledger.pokemon.length > 0) {
      const names = ledger.pokemon.map((pokemon) => pokemon.name.toUpperCase());
      const who = names.length === 1 ? `${names[0]} is` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are`;
      return `${who} waiting at base for your next raid.`;
    }
    return this.footerNote();
  }

  /** Oak's one next thing (`hub/nextStep.ts`), read off the save this raid was just banked into. */
  private nextThing(): string | undefined {
    if (currentTry() || isPlaytestRun()) {
      return undefined;
    }
    const progress = new SaveManager().load()?.raidProgress;
    const [line] = progress ? nextStepLines(progress) : [];
    return line;
  }

  private leave(): void {
    if (this.leaving || this.locked) {
      return;
    }
    this.leaving = true;
    audioManager.play('confirm');
    // Storage-less browsers never reached a base in the first place, so the
    // title screen stays the fallback it is everywhere else in the game. A raid
    // that is over puts the player back on the rim they jumped from, looking
    // down at what they have just walked (`BaseScene`).
    const closeCall = this.report.closeCall;
    const home = homeAfterRaid(
      moodOfRaid(this.report.outcome === 'ESCAPED', this.report.haulTier, closeCall !== undefined),
      closeCall,
    );
    const reachable = this.scene.manager.keys[home.key];
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      reachable ? this.scene.start(home.key, home.data) : this.scene.start('title'),
    );
  }

  /**
   * The account of the raid, on the lobby's own screen: a title bar that says
   * how it ended and what the clock read, the verdict, what happened to the haul
   * beside what was gambled on it, and the one bar that leads back to base.
   *
   * Both lists scroll inside their own windows. The two-column grid this
   * replaced stretched its first row to the taller card and ran the screen past
   * the frame on any raid that came home with a secure slot and experience.
   */
  private markup(): string {
    const report = this.report;
    const escaped = report.outcome === 'ESCAPED';
    if (report.settledElsewhere) {
      return this.settledElsewhereMarkup();
    }
    const moment = this.fullReport || currentTry() ? null : resultMoment(report);
    if (moment) {
      return this.momentMarkup(moment);
    }
    return pixelScreen({
      place: escapeHtml(report.eyebrow),
      title: '',
      aside: escapeHtml(this.clockAside()),
      // There is one control on this screen, so the help bar is free to carry
      // what becomes of the result.
      hints: escapeHtml(this.footerNote()),
      body: `<main class="px-body extraction-layout ${escaped ? 'extraction-won' : 'extraction-lost'}">${pixelWindow(
        `<strong class="px-name">${escapeHtml(report.headline)}</strong>${report.closeCall ? `<strong class="px-name">${escapeHtml(report.closeCall)}</strong>` : ''}${(report.badgesWon ?? []).map((line) => `<strong class="px-name px-wrap" data-badge-won>${escapeHtml(line)}</strong>`).join('')}<span class="px-wrap">${escapeHtml(this.verdictSummary())}</span>${report.beatenBy ? `<span class="px-wrap what-beat-you">What beat you? ${escapeHtml(report.beatenBy)}</span>` : ''}`,
        { className: `extraction-verdict ${escaped ? 'px-tone-primary' : 'px-tone-risk'}`, tag: 'div' },
      )}${this.ledgerPanel()}${this.gamblePanel()}${pixelCommitBar({
        title: escapeHtml(this.footerTitle()),
        lines: [`<small class="px-wrap">${this.costFacts().map(escapeHtml).join(' · ')}</small>`],
        actions: `<button class="px-window px-button is-primary" data-continue>${currentTry() ? 'Back to the map maker' : 'Back to the Arena'}</button>`,
      })}</main>`,
    });
  }

  /** The same screen for a raid another window settled: what happened, and that nothing here counts. */
  private settledElsewhereMarkup(): string {
    const words = this.report.takenUpElsewhere ? TAKEN_UP_ELSEWHERE : SETTLED_ELSEWHERE;
    return pixelScreen({
      // Not EXTRACTED or RAID LOST: neither was written.
      place: this.report.takenUpElsewhere ? TAKEN_UP_ELSEWHERE.place : 'Raid settled elsewhere',
      title: '',
      aside: escapeHtml(this.clockAside()),
      hints: escapeHtml(this.footerNote()),
      body: `<main class="px-body extraction-layout extraction-lost">${pixelWindow(
        `<strong class="px-name">${escapeHtml(words.headline)}</strong><span class="px-wrap">${escapeHtml(words.summary)}</span>`,
        { className: 'extraction-verdict px-tone-risk', tag: 'div' },
      )}${pixelWindow(`<div class="px-list px-scroll" data-reads><p class="px-empty px-wrap">${escapeHtml(words.ledger)}</p></div>`, {
        className: 'extraction-ledger',
        heading: 'Not banked',
      })}${pixelWindow(`<div class="px-list px-scroll" data-reads><p class="px-empty px-wrap">${escapeHtml(words.team)}</p></div>`, {
        className: 'extraction-gamble',
        heading: 'Your team',
      })}${pixelCommitBar({
        title: escapeHtml(this.footerTitle()),
        lines: [],
        actions: `<button class="px-window px-button is-primary" data-continue>Back to the Arena</button>`,
      })}</main>`,
    });
  }

  /**
   * What the clock read. Under the explorer rules - the explorer run, and a map
   * maker try walked with WALK IT - the raid clock is eight hours so the map can
   * be looked at, and "0:07 of 480:00" printed that stand-in as though it were a
   * limit somebody had raced; what is worth saying there is how long it took.
   */
  private clockAside(): string {
    return isPlaytestRun()
      ? `Time taken ${formatElapsedClock(this.report.elapsedMs)}`
      : `Raid clock ${this.report.clockLabel}`;
  }

  /**
   * The sentence under the headline. A try of a map in the map maker carries a
   * throwaway team in a save of its own, so "3 Potions and your Raid pack rode
   * out unprotected" is a raid economy that was never in play; what a maker
   * reads there is what happened on their map.
   */
  private verdictSummary(): string {
    const attempt = currentTry();
    if (!attempt) {
      return this.report.summary;
    }
    const name = attempt.map.name;
    if (this.report.outcome === 'ESCAPED') {
      return `You walked out of ${name} by an exit.`;
    }
    return this.report.cause === 'timer'
      ? `The clock ran out before you found a way out of ${name}.`
      : `The try team went down inside ${name}.`;
  }

  private ledgerPanel(): string {
    const report = this.report;
    const escaped = report.outcome === 'ESCAPED';
    // What a contract paid is tagged as its reward, never as banked: listed
    // as banked, the contract's Super Potion read as one found in the field.
    const rows =
      groupRows(report.ledgerFound, escaped ? 'banked' : 'lost') + groupRows(report.ledgerPaid, 'reward');
    // The note counts every row under the heading that went the heading's way,
    // so a lost raid counts the pack and the gear that went down with it: they
    // are drawn GONE in this same window, and "1 ENTRY" over two GONE rows read
    // as the screen miscounting what was lost. The rows are counted as drawn,
    // found and paid apart: a Great Ball found beside the contract's two is one
    // ledger entry and two rows.
    const total =
      report.ledgerFound.pokemon.length +
      report.ledgerFound.items.length +
      report.ledgerPaid.pokemon.length +
      report.ledgerPaid.items.length +
      (escaped
        ? report.gear.filter((piece) => piece.fate === 'found').length
        : report.gear.filter((piece) => piece.fate === 'lost').length + (report.pack?.fate === 'lost' ? 1 : 0));
    // A contract banked leads, with field experience straight under it: what it
    // paid for good - the insertions it unlocked, the exit it opened - is said
    // nowhere else, and as the last block of the pane it was under the fold on
    // the very raid that unlocked the rest of the game (playtest 47). The
    // verdict above already says what was banked beside it. An unpaid contract
    // is said last, after the experience, as before: under a four-line contract
    // row a level gained in the field was below the fold (playtest 4).
    const contract = report.contract
      ? `<h3 class="px-subheading">Job</h3><div class="px-row has-icon${report.contract.complete ? ' is-secured' : ''}">${objectiveIcon('Contract')}<span class="px-row-main"><strong class="px-wrap">Job ${report.contract.complete ? 'done' : 'unpaid'}: ${escapeHtml(report.contract.description)}</strong><small class="px-wrap${report.contract.complete ? '' : ' px-warning'}">${escapeHtml(report.contract.reward)}</small></span></div>`
      : '';
    return pixelWindow(
      report.contract?.complete
        ? `<div class="px-list px-scroll" data-reads>${contract}${this.progressRows()}${rows ? `<h3 class="px-subheading">${escapeHtml(report.ledgerHeading)}</h3>${rows}` : ''}${this.packRow()}${this.gearRows()}</div>`
        : `<div class="px-list px-scroll" data-reads>${rows || `<p class="px-empty">${escapeHtml(report.ledgerEmptyText)}</p>`}${this.packRow()}${this.gearRows()}${this.progressRows()}${contract}</div>`,
      {
        className: 'extraction-ledger',
        heading: escapeHtml(report.ledgerHeading),
        // Where it went is the heading's own word - BANKED or GONE FOR GOOD -
        // so the note only counts. Spelled out as well, it was the one lid
        // long enough to clip itself at the smallest stage.
        note: `${total} ${total === 1 ? 'entry' : 'entries'}`,
      },
    );
  }

  private gamblePanel(): string {
    const report = this.report;
    // A try of a map in the map maker is played with a ready-made team in a
    // save of its own and thrown away, so nothing was gambled: "a wipe would
    // have cost you Charizard" over a level 99 try team is a raid that was not
    // at stake. What a maker came to this screen for is whether the walk counts.
    if (currentTry()) {
      const escaped = report.outcome === 'ESCAPED';
      return pixelWindow(
        `<div class="px-list px-scroll" data-reads><h3 class="px-subheading">${escaped ? 'The walk counts' : 'The walk does not count yet'}</h3><p class="px-empty px-wrap">${
          escaped
            ? 'You left by an exit, so the map maker ticks "You walked out of it yourself" for this version of the map.'
            : 'Leave by an exit for the walk to count.'
        }</p><p class="px-wrap gamble-verdict">Nothing was at stake: the try team plays in a save of its own, and your saved game was not touched.</p></div>`,
        { className: 'extraction-gamble', heading: 'Your try' },
      );
    }
    const securedRows = groupRows(report.secured, 'secured');
    // The partner's own place, above the container, because it is not in it.
    const partnerRows = report.partner
      ? `<h3 class="px-subheading">Partner</h3>${pokemonRow(report.partner, 'partner')}`
      : '';
    const riskedRows = groupRows(report.risked, 'survived');
    // A lost raid's at-risk list is exactly the ledger beside it, so only a
    // survived one lists what rode out unprotected and came back anyway.
    const risked =
      report.outcome === 'ESCAPED'
        ? `<h3 class="px-subheading">Carried at risk</h3>${riskedRows || '<p class="px-empty">Nothing was carried unprotected.</p>'}`
        : '';
    return pixelWindow(
      `<div class="px-list px-scroll" data-reads>${partnerRows}<h3 class="px-subheading">Secure slot</h3>${securedRows || `<p class="px-empty">${escapeHtml(report.securedEmptyText)}</p>`}${risked}<p class="px-wrap gamble-verdict">${escapeHtml(report.gambleVerdict)}</p></div>`,
      { className: 'extraction-gamble', heading: 'The gamble' },
    );
  }

  /**
   * The pack the raid was carried in, and what became of it.
   *
   * It is its own row above the gear because it is not part of the haul: it is
   * the thing the haul was in, and on a lost raid it is gone whatever the
   * secure container held. A player who went down in a Hauler frame needs to
   * read that here, not work it out from a smaller grid next raid.
   */
  private packRow(): string {
    const { pack, packSummary } = this.report;
    if (pack === null) {
      return '';
    }
    const tag = pack.fate === 'lost' ? pixelTag('Gone', 'risk') : pixelTag('Came home', 'good', true);
    return `<h3 class="px-subheading">Pack</h3><div class="px-row has-icon${
      pack.fate === 'lost' ? ' is-lost' : ''
    }">${itemIcon(pack.itemId, pack.name)}<span class="px-row-main"><strong>${escapeHtml(pack.name)}</strong><small>${pack.squares} squares</small></span>${tag}</div>${
      packSummary ? `<p class="px-wrap gamble-verdict">${escapeHtml(packSummary)}</p>` : ''
    }`;
  }

  /**
   * What became of the gear, when any was carried: one row per piece, named with
   * whoever was holding it.
   *
   * It goes above the experience rows because it is the one line on this screen
   * that can be a loss on a raid that otherwise went well - gear comes off a
   * boss once per save, so a piece that did not come home is not coming back,
   * and that has to be read before the level-ups underneath it.
   */
  private gearRows(): string {
    const { gear, gearSummary } = this.report;
    if (gear.length === 0) {
      return '';
    }
    const rows = gear
      .map((piece) => {
        const tag =
          piece.fate === 'lost'
            ? pixelTag('Gone', 'risk')
            : piece.fate === 'found'
              ? pixelTag('Carried out', 'good', true)
              : pixelTag('Still held', 'plain', true);
        return `<div class="px-row has-icon${piece.fate === 'lost' ? ' is-lost' : ''}">${itemIcon(piece.itemId, piece.label)}<span class="px-row-main"><strong>${escapeHtml(piece.label)}</strong><small>${escapeHtml(piece.holder)}</small></span>${tag}</div>`;
      })
      .join('');
    return `<h3 class="px-subheading">Gear</h3>${rows}${
      gearSummary ? `<p class="px-wrap gamble-verdict">${escapeHtml(gearSummary)}</p>` : ''
    }`;
  }

  /**
   * What the party earned, when it earned anything: one row per Pokemon, under
   * the ledger it belongs beside. The sentence that names what the party earned
   * is the verdict at the top of the screen, so it is not repeated here.
   */
  private progressRows(): string {
    const { progress } = this.report;
    if (progress.length === 0) {
      return '';
    }
    const rows = progress
      .map((entry) => {
        const levelled = entry.toLevel > entry.fromLevel;
        return `<div class="px-row has-icon${levelled ? ' is-selected' : ''}">${pixelMonIconForDex(entry.dexId, entry.name)}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeHtml(entry.name)}</strong>${entry.shiny ? pixelShinyStar() : ''}</span><small>${
          levelled
            ? `Level ${entry.fromLevel} to ${entry.toLevel}`
            : `Level ${entry.toLevel} · ${shortOfNextLevel(entry)}`
        }</small></span>${levelled ? pixelTag(`Level ${entry.toLevel}`, 'good', true) : pixelTag(`+${entry.experienceGained} xp`)}</div>`;
      })
      .join('');
    return `<h3 class="px-subheading">Field experience</h3>${rows}`;
  }

  private costFacts(): readonly string[] {
    const spent = this.report.spent;
    return [
      // An undefined spend means the losing screen could not see the bag, which
      // is not the same claim as "nothing was spent".
      ...(spent === undefined
        ? []
        : [spent.length ? `Supplies spent: ${spent.map(itemText).join(', ')}` : 'No supplies spent']),
      // Put down for room is not spent: nothing drank it (playtest 43 B6).
      ...(this.report.dropped.length > 0
        ? [`Put down for room: ${this.report.dropped.map(itemText).join(', ')}`]
        : []),
      ...this.report.pressure,
    ];
  }

  private footerTitle(): string {
    if (this.report.settledElsewhere) {
      return this.report.takenUpElsewhere ? TAKEN_UP_ELSEWHERE.title : 'Settled in another window';
    }
    if (!this.report.saved) {
      return 'Could not save';
    }
    if (this.report.outcome === 'WIPED') {
      return 'Losses applied';
    }
    if (this.report.haulTier !== 'empty') {
      return 'Banked';
    }
    return this.spentSupplies ? 'You came home lighter' : 'You came home whole';
  }

  private footerNote(): string {
    // A try of a map in the map maker banks into a save of its own and is
    // thrown away; what it says is whether the maker's walk counted.
    if (currentTry()) {
      return this.report.outcome === 'ESCAPED'
        ? 'A try of your map: you left by an exit, so the walk counts. Your saved game was not touched.'
        : 'A try of your map: leave by an exit for the walk to count. Your saved game was not touched.';
    }
    if (this.report.settledElsewhere) {
      return this.report.takenUpElsewhere ? TAKEN_UP_ELSEWHERE.note : SETTLED_ELSEWHERE.note;
    }
    if (!this.report.saved) {
      // Tried again as the base opens (`run/unsavedEnding.ts`); said, or a player
      // reads COULD NOT SAVE as the raid gone.
      return 'The browser would not save this. It is tried again as you go back.';
    }
    if (this.report.baseNote !== null) {
      return this.report.baseNote;
    }
    if (this.report.recoveryStillOwed) {
      return this.report.recoveryStillOwed;
    }
    // Promising a stash full of new supplies after an empty raid is the one way
    // this screen could lie about a result the player can see for themselves -
    // and so is calling a raid that levelled a Pokemon "nothing new to bank".
    if (this.report.haulTier !== 'empty') {
      return this.whereTheHaulIs();
    }
    if (this.report.progress.length > 0) {
      return 'No gear banked, but what your party learned is banked with them.';
    }
    // A loadout that drank its Potions is not "back at base": the panel above
    // has just listed what it spent.
    return this.spentSupplies
      ? 'Nothing new to bank. What is left of your loadout is back at base.'
      : 'Nothing new to bank, but your loadout is back at base and ready to redeploy.';
  }

  /**
   * Where what came home is, by the names of the screens that show it and
   * their keys: things in YOUR THINGS, Pokémon on YOUR TEAM. It said BILL'S
   * PC, the name of one of the places those are read, and the quay's pile
   * said "the vault", the name of none (the captain, 25 Nov 2026).
   */
  private whereTheHaulIs(): string {
    const { items, pokemon } = this.report.ledger;
    // The keys as words, not `[B]`: this screen answers to neither.
    const things = `YOUR THINGS (${RAID_KEY_LETTERS.bag} at base)`;
    const team = `YOUR TEAM (${RAID_KEY_LETTERS.party} at base)`;
    if (pokemon.length === 0) {
      return `Everything above is in ${things}, ready for your next raid.`;
    }
    return items.length === 0
      ? `Everything above is on ${team}, ready for your next raid.`
      : `The things are in ${things} and the Pokémon on ${team}, ready for your next raid.`;
  }

  private get spentSupplies(): boolean {
    return (this.report.spent ?? []).length > 0;
  }
}

/**
 * The defeat tableau: the trainer and the party, drawn from the sprites the game
 * already ships and laid out as one line-up standing on the field.
 *
 * The markup is written once and never re-rendered. Every beat is a state on the
 * stage element, so the figures animate from one beat to the next instead of
 * snapping between three separate pictures, and the stage answers a key or a
 * click at the first frame exactly as it does at the last.
 *
 * The continue prompt sits inside the caption panel, under the words it is
 * waiting on, which is where the battle dialogue's own `SPACE \u25bc` indicator
 * sits relative to its text, and only its glyph blinks. It is written as text
 * rather than as a button because the whole stage is already the target: a
 * button inside a stage that takes pointerdown would advance the sequence twice
 * on one click.
 */
function defeatMarkup(sequence: DefeatSequence): string {
  const cast = sequence.figures.map((figure, index) => defeatFigure(figure, index)).join('');
  return `<div class="defeat-stage" data-defeat data-beat="" role="group" aria-label="Raid lost">
    <div class="defeat-flash" aria-hidden="true"></div>
    <div class="defeat-field">
      <div class="defeat-cast">
        <figure class="defeat-figure is-trainer">
          <span class="defeat-sprite"><span class="defeat-trainer" aria-label="You, face down in the grass"></span></span>
          <span class="defeat-plate"><b>You</b><span class="defeat-meta"><small>Down</small></span></span>
        </figure>
        ${cast}
      </div>
    </div>
    <div class="defeat-caption is-entering" aria-live="polite">
      <p class="defeat-headline" data-defeat-headline></p>
      <p class="defeat-detail" data-defeat-detail></p>
      <p class="defeat-advance"><span data-defeat-prompt></span> <span class="defeat-advance-cursor" aria-hidden="true">${escapeHtml(sequence.promptIndicator)}</span></p>
    </div>
  </div>`;
}

/**
 * One column of the line-up: the sprite standing on the ground, and a plate laid
 * on the ground beneath it carrying the name, the level and the verdict.
 *
 * The plate is what makes the moment personal and legible at once - the level is
 * the difference between "a Charmander" and the one carried through six raids -
 * and putting the verdict on it rather than floating a stamp over the sprite
 * keeps every column the same shape however the sprite is rotated.
 */
function defeatFigure(figure: DefeatFigure, index: number): string {
  const classes = ['defeat-figure', figure.lastStand ? 'is-last-stand' : ''].join(' ').trim();
  const body =
    figure.kind === 'pokemon'
      ? `<img src="${publicAssetUrl(pokemonSpritePath('front', figure.dexId ?? 0, figure.shiny === true))}" alt="" />`
      : `<span class="defeat-item-glyph"><img src="${iconUrl(itemIconName(figure.itemId ?? ''))}" alt="" aria-hidden="true" /></span>`;
  const meta =
    figure.kind === 'pokemon'
      ? `Lv ${figure.level ?? '?'}`
      : itemCountTag(figure.itemId ?? '', figure.quantity ?? 1);
  return `<figure class="${classes}" data-kind="${figure.kind}" data-fate="${figure.fate}" style="--figure-index:${index}">
    <span class="defeat-sprite">${body}</span>
    <span class="defeat-plate">
      <b>${escapeHtml(figure.label)}</b>
      <span class="defeat-meta"><small>${meta}</small><span class="defeat-tag">${figure.fate === 'held' ? 'Held' : 'Taken'}</span></span>
    </span>
  </figure>`;
}

type RowTag = 'banked' | 'lost' | 'secured' | 'partner' | 'survived' | 'reward';

const ROW_TAGS: Record<RowTag, string> = {
  banked: pixelTag('Banked', 'good', true),
  lost: pixelTag('Gone', 'risk'),
  secured: pixelTag('Protected', 'secure'),
  partner: pixelTag('Safe', 'secure'),
  survived: pixelTag('Made it', 'plain', true),
  reward: pixelTag('Reward', 'good', true),
};

/** What became of a thing, in a word, for the tile that shows it by colour and mark instead. */
const TILE_WORDS: Record<RowTag, string> = {
  banked: 'banked',
  lost: 'gone',
  secured: 'protected',
  partner: 'safe',
  survived: 'made it',
  reward: 'reward',
};

function groupRows(group: ReportGroup, tag: RowTag): string {
  // The things carried home are the haul, shown as the haul: each its icon at
  // twice its size with how many on its corner, laid across the pane and
  // coloured by what became of it (`.result-tile`), each popping in after the
  // last. A Pokémon keeps its row, its icon at the head of it: its level and
  // its health are what a player reads it for.
  const items = group.items.length
    ? `<div class="px-item-tiles result-tiles">${group.items.map((item, index) => itemTile(item, tag, index)).join('')}</div>`
    : '';
  return `${group.pokemon.map((member) => pokemonRow(member, tag)).join('')}${items}`;
}

function pokemonRow(member: ReportPokemon, tag: RowTag): string {
  // Its icon at the head of the row in the ledger; the gamble's column is too
  // narrow for an icon beside a name, a bar and a tag, and its line broke.
  const icon = tag === 'banked' || tag === 'lost' || tag === 'reward';
  return `<div class="px-row${icon ? ' has-icon' : ''}${tag === 'lost' ? ' is-lost' : ''}">${icon ? pixelMonIconForDex(member.dexId, member.name, member.currentHp, member.maxHp) : ''}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeHtml(member.name)}</strong>${member.shiny ? pixelShinyStar() : ''}${pixelHpBar(member.currentHp, member.maxHp)}</span><small>Level ${member.level} · ${member.currentHp}/${member.maxHp}\u00a0HP</small></span>${ROW_TAGS[tag]}</div>`;
}

function itemTile(item: ReportItem, tag: RowTag, index: number): string {
  const count = itemCountTag(item.itemId, item.quantity);
  const words = `${item.label} ${count}, ${TILE_WORDS[tag]}`;
  return `<div class="px-item-tile result-tile is-${tag}" role="img" aria-label="${escapeHtml(words)}" title="${escapeHtml(words)}" style="--i:${index}">${itemIcon(item.itemId, item.label)}<span class="px-item-tile-count">${escapeHtml(count)}</span></div>`;
}

function itemText(item: ReportItem): string {
  return `${item.quantity}× ${item.label}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * What a Pokemon that did not level is short of, in the words the stash's
 * dossier says it in (`experienceLine`): "1 to go" left one what unsaid.
 */
function shortOfNextLevel(entry: { readonly toLevel: number; readonly experienceToNextLevel: number }): string {
  return entry.experienceToNextLevel > 0
    ? `${formatExperience(entry.experienceToNextLevel)} XP to Lv ${entry.toLevel + 1}`
    : 'fully grown';
}
