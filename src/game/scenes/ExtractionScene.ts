import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
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
import { itemCountTag } from '../items';
import { publicAssetUrl } from '../publicAssetUrl';
import { iconUrl, itemIcon, itemIconName, objectiveIcon } from '../ui/icons';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pixelCommitBar, pixelHpBar, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';

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

export class ExtractionScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private report!: ExtractionReport;
  private leaving = false;
  private locked = true;
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

  public constructor() {
    super('extraction');
  }

  /**
   * Phaser reuses one instance per scene key, so every field describing the last
   * result outlives it. Everything the sequence sets is cleared here.
   */
  public init(data: ExtractionSceneData): void {
    this.report = data.report;
    this.leaving = false;
    this.locked = true;
    this.sequencePlaying = false;
    this.sequenceBeats = [];
    this.beatIndex = -1;
    this.leadInTimer = null;
    this.promptTimer?.remove(false);
    this.promptTimer = null;
    this.defeatStage = null;
  }

  public create(): void {
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
    if (beat.id === 'held' && this.report.secured.pokemon.length + this.report.secured.items.length > 0) {
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
    const control = this.overlay.root.querySelector<HTMLButtonElement>('[data-continue]')!;
    control.onclick = () => this.leave();
    control.disabled = true;
    this.time.delayedCall(lockMs, () => {
      this.locked = false;
      control.disabled = false;
      // The raid's own ending has already sounded on the way here. The one
      // thing this screen adds is the contract, and it says so as the screen
      // becomes answerable: played on arrival it landed 0.7s behind the
      // extraction jingle, two rising phrases running into each other.
      if (this.report.outcome === 'ESCAPED' && this.report.contract?.complete) {
        audioManager.play('contractBanked');
      }
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
    if (this.locked || !['Enter', ' ', 'Escape'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    this.leave();
  }

  private leave(): void {
    if (this.leaving || this.locked) {
      return;
    }
    this.leaving = true;
    audioManager.play('confirm');
    // Storage-less browsers never reached a base in the first place, so the
    // title screen stays the fallback it is everywhere else in the game. A raid
    // that is over puts the player down on the quay, beside the man who buys
    // what they came home with.
    const home = this.scene.manager.keys.base;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      home ? this.scene.start('base', { arrival: 'raid' }) : this.scene.start('title'),
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
    return pixelScreen({
      place: escapeHtml(report.eyebrow),
      title: '',
      aside: `Raid clock ${escapeHtml(report.clockLabel)}`,
      // There is one control on this screen, so the help bar is free to carry
      // what becomes of the result.
      hints: escapeHtml(this.footerNote()),
      body: `<main class="px-body extraction-layout ${escaped ? 'extraction-won' : 'extraction-lost'}">${pixelWindow(
        `<strong class="px-name">${escapeHtml(report.headline)}</strong><span class="px-wrap">${escapeHtml(report.summary)}</span>`,
        { className: `extraction-verdict ${escaped ? 'px-tone-primary' : 'px-tone-risk'}`, tag: 'div' },
      )}${this.ledgerPanel()}${this.gamblePanel()}${pixelCommitBar({
        title: escapeHtml(this.footerTitle()),
        lines: [`<small class="px-wrap">${this.costFacts().map(escapeHtml).join(' · ')}</small>`],
        actions: '<button class="px-window px-button is-primary" data-continue>Back to the lab</button>',
      })}</main>`,
    });
  }

  private ledgerPanel(): string {
    const report = this.report;
    const escaped = report.outcome === 'ESCAPED';
    const rows = groupRows(report.ledger, escaped ? 'banked' : 'lost');
    const total = report.ledger.pokemon.length + report.ledger.items.length;
    // Experience before the contract: the verdict window above has already said
    // what became of the contract, while a level gained in the field is said
    // nowhere else - and under a four-line contract row it was below the fold.
    const contract = report.contract
      ? `<h3 class="px-subheading">Contract</h3><div class="px-row has-icon${report.contract.complete ? ' is-secured' : ''}">${objectiveIcon('Contract')}<span class="px-row-main"><strong class="px-wrap">Contract ${report.contract.complete ? 'complete' : 'unpaid'}: ${escapeHtml(report.contract.description)}</strong><small class="px-wrap${report.contract.complete ? '' : ' px-warning'}">${escapeHtml(report.contract.reward)}</small></span></div>`
      : '';
    return pixelWindow(
      `<div class="px-list px-scroll">${rows || `<p class="px-empty">${escapeHtml(report.ledgerEmptyText)}</p>`}${this.packRow()}${this.gearRows()}${this.progressRows()}${contract}</div>`,
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
    const securedRows = groupRows(report.secured, 'secured');
    const riskedRows = groupRows(report.risked, 'survived');
    // A lost raid's at-risk list is exactly the ledger beside it, so only a
    // survived one lists what rode out unprotected and came back anyway.
    const risked =
      report.outcome === 'ESCAPED'
        ? `<h3 class="px-subheading">Carried at risk</h3>${riskedRows || '<p class="px-empty">Nothing was carried unprotected.</p>'}`
        : '';
    return pixelWindow(
      `<div class="px-list px-scroll"><h3 class="px-subheading">Secure slot</h3>${securedRows || `<p class="px-empty">${escapeHtml(report.securedEmptyText)}</p>`}${risked}<p class="px-wrap gamble-verdict">${escapeHtml(report.gambleVerdict)}</p></div>`,
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
        return `<div class="px-row${levelled ? ' is-selected' : ''}"><span class="px-row-main"><strong class="px-name">${escapeHtml(entry.name)}</strong><small>${
          levelled
            ? `Level ${entry.fromLevel} to ${entry.toLevel}`
            : `Level ${entry.toLevel} · ${entry.experienceToNextLevel} to go`
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
      ...this.report.pressure,
    ];
  }

  private footerTitle(): string {
    if (!this.report.saved) {
      return 'Stash save unavailable';
    }
    if (this.report.outcome === 'WIPED') {
      return 'Losses applied';
    }
    if (this.report.haulTier !== 'empty') {
      return 'Stash secured';
    }
    return this.spentSupplies ? 'You came home lighter' : 'You came home whole';
  }

  private footerNote(): string {
    if (!this.report.saved) {
      return 'This result could not be written to storage.';
    }
    if (this.report.outcome === 'WIPED') {
      return 'Your base has been topped back up to a loadout you can deploy with.';
    }
    // Promising a stash full of new supplies after an empty raid is the one way
    // this screen could lie about a result the player can see for themselves -
    // and so is calling a raid that levelled a Pokemon "nothing new to bank".
    if (this.report.haulTier !== 'empty') {
      return 'Everything above is in your stash and ready for the next deployment.';
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
      ? `<img src="${publicAssetUrl(`assets/pokemon/front/${figure.dexId}.png`)}" alt="" />`
      : `<span class="defeat-item-glyph"><img src="${iconUrl(itemIconName(figure.itemId ?? ''))}" alt="" aria-hidden="true" /></span>`;
  const meta = figure.kind === 'pokemon' ? `Lv ${figure.level ?? '?'}` : `\u00d7${figure.quantity ?? 1}`;
  return `<figure class="${classes}" data-kind="${figure.kind}" data-fate="${figure.fate}" style="--figure-index:${index}">
    <span class="defeat-sprite">${body}</span>
    <span class="defeat-plate">
      <b>${escapeHtml(figure.label)}</b>
      <span class="defeat-meta"><small>${meta}</small><span class="defeat-tag">${figure.fate === 'held' ? 'Held' : 'Taken'}</span></span>
    </span>
  </figure>`;
}

type RowTag = 'banked' | 'lost' | 'secured' | 'survived';

const ROW_TAGS: Record<RowTag, string> = {
  banked: pixelTag('Banked', 'good', true),
  lost: pixelTag('Gone', 'risk'),
  secured: pixelTag('Protected', 'secure'),
  survived: pixelTag('Made it', 'plain', true),
};

function groupRows(group: ReportGroup, tag: RowTag): string {
  return [
    ...group.pokemon.map((member) => pokemonRow(member, tag)),
    ...group.items.map((item) => itemRow(item, tag)),
  ].join('');
}

function pokemonRow(member: ReportPokemon, tag: RowTag): string {
  return `<div class="px-row${tag === 'lost' ? ' is-lost' : ''}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeHtml(member.name)}</strong>${pixelHpBar(member.currentHp, member.maxHp)}</span><small>Level ${member.level} · ${member.currentHp}/${member.maxHp} HP</small></span>${ROW_TAGS[tag]}</div>`;
}

function itemRow(item: ReportItem, tag: RowTag): string {
  // Quantity sits on the name's own line: an item row has nothing to say on a
  // second one, and the screen is worth more than the extra height costs.
  return `<div class="px-row has-icon${tag === 'lost' ? ' is-lost' : ''}">${itemIcon(item.itemId, item.label)}<span class="px-row-main"><strong>${escapeHtml(item.label)} ${itemCountTag(item.itemId, item.quantity)}</strong></span>${ROW_TAGS[tag]}</div>`;
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
