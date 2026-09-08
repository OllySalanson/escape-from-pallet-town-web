import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import {
  buildDefeatSequence,
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
import { raidClockProgress } from '../run/raidClock';
import { iconUrl, itemIcon, itemIconName, objectiveIcon } from '../ui/icons';
import { MenuOverlay, hpBar, pokemonAvatar } from '../ui/MenuOverlay';

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
    stage.onpointerdown = () => this.advanceDefeatSequence();
    this.leadInTimer = this.time.delayedCall(sequence.leadInMs, () =>
      this.advanceDefeatSequence(),
    );
  }

  /**
   * The one way the sequence ever moves: on to the next beat, or off the screen.
   *
   * A press during the lead-in lands the first beat rather than being swallowed,
   * which is what keeps the screen answerable from its very first frame without
   * costing the player a beat they never saw.
   */
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
    if (prompt) {
      prompt.textContent = beat.prompt;
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
    if (beat.id === 'fall') {
      audioManager.playFaint();
    }
    if (beat.id === 'held' && this.report.secured.pokemon.length + this.report.secured.items.length > 0) {
      audioManager.playConfirm();
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
    this.defeatStage = null;
    this.showReport(SETTLED_LOCK_MS);
  }

  private showReport(lockMs: number): void {
    this.overlay.root.innerHTML = this.markup();
    const control = this.overlay.root.querySelector<HTMLButtonElement>('[data-continue]')!;
    control.onclick = () => this.leave();
    control.disabled = true;
    this.time.delayedCall(lockMs, () => {
      this.locked = false;
      control.disabled = false;
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
      this.advanceDefeatSequence();
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
    // Storage-less browsers never reached a hub in the first place, so the title
    // screen stays the fallback it is everywhere else in the game.
    const target = this.scene.manager.keys.hub ? 'hub' : 'title';
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(target),
    );
  }

  private markup(): string {
    const report = this.report;
    const escaped = report.outcome === 'ESCAPED';
    return `<div class="menu-shell extraction-shell ${escaped ? 'extraction-won' : 'extraction-lost'}">
      <header class="extraction-header">
        <div class="extraction-headline">
          <p class="eyebrow">${escapeHtml(report.eyebrow)}</p>
          <h1>${escapeHtml(report.headline)}</h1>
          <p class="extraction-summary">${escapeHtml(report.summary)}</p>
        </div>
        ${this.clockCard()}
      </header>
      <main class="extraction-layout">
        ${this.ledgerPanel()}
        ${this.gamblePanel()}
        ${this.progressPanel()}
      </main>
      ${this.costPanel()}
      <footer class="starter-confirm extraction-footer">
        <div>
          <strong>${escapeHtml(this.footerTitle())}</strong>
          <small>${escapeHtml(this.footerNote())}</small>
        </div>
        <button class="button primary-button" data-continue>Back to base →</button>
      </footer>
    </div>`;
  }

  private clockCard(): string {
    const report = this.report;
    const used = Math.round(raidClockProgress(report.elapsedMs, report.durationMs) * 100);
    return `<div class="extraction-clock">
      <p class="eyebrow">Raid clock</p>
      <strong>${escapeHtml(report.clockLabel)}</strong>
      <div class="clock-track" aria-label="${used}% of the raid clock used"><span style="width:${used}%"></span></div>
      <small>${used}% of the raid spent</small>
    </div>`;
  }

  private ledgerPanel(): string {
    const report = this.report;
    const rows = groupRows(report.ledger, report.outcome === 'ESCAPED' ? 'banked' : 'lost');
    const total = report.ledger.pokemon.length + report.ledger.items.length;
    return `<section class="panel extraction-ledger">
      <div class="panel-heading">
        <div><p class="eyebrow">${report.outcome === 'ESCAPED' ? 'Straight to your stash' : 'Deleted from your stash'}</p><h2>${escapeHtml(report.ledgerHeading)}</h2></div>
        <b>${total} ${total === 1 ? 'entry' : 'entries'}</b>
      </div>
      <div class="entity-list">${rows || `<p class="empty-state">${escapeHtml(report.ledgerEmptyText)}</p>`}</div>
      ${report.contract ? `<article class="extraction-contract${report.contract.complete ? '' : ' unpaid'}">${objectiveIcon('Contract')}<div><strong>Contract ${report.contract.complete ? 'complete' : 'unpaid'}: ${escapeHtml(report.contract.description)}</strong><small>${escapeHtml(report.contract.reward)}</small></div></article>` : ''}
    </section>`;
  }

  private gamblePanel(): string {
    const report = this.report;
    const securedRows = groupRows(report.secured, 'secured');
    const riskedRows = groupRows(report.risked, 'survived');
    return `<section class="panel extraction-gamble">
      <div class="panel-heading">
        <div><p class="eyebrow">What you chose before you deployed</p><h2>The gamble</h2></div>
      </div>
      <div class="gamble-group">
        <p class="eyebrow">Secure slot</p>
        <div class="entity-list">${securedRows || '<p class="empty-state">You protected nothing.</p>'}</div>
      </div>
      ${
        // A lost raid's at-risk list is exactly the ledger beside it, so only a
        // survived one lists what rode out unprotected and came back anyway.
        report.outcome === 'ESCAPED'
          ? `<div class="gamble-group">
        <p class="eyebrow">Carried at risk</p>
        <div class="entity-list">${riskedRows || '<p class="empty-state">Nothing was carried unprotected.</p>'}</div>
      </div>`
          : ''
      }
      <p class="gamble-verdict">${escapeHtml(report.gambleVerdict)}</p>
    </section>`;
  }

  /**
   * What the party earned, when it earned anything.
   *
   * One row per Pokemon, in the ledger's column so a short haul fills the space
   * it already left empty rather than making the screen taller. The sentence
   * that names what the party earned is the headline summary at the top of the
   * screen, so it is deliberately not repeated here.
   */
  private progressPanel(): string {
    const { progress } = this.report;
    if (progress.length === 0) {
      return '';
    }
    const rows = progress
      .map((entry) => {
        const levelled = entry.toLevel > entry.fromLevel;
        return `<article class="entity-row${levelled ? ' levelled' : ''}">${pokemonAvatar(entry.dexId, entry.name)}<div class="entity-copy"><strong>${escapeHtml(entry.name)}</strong><small>${
          levelled
            ? `Level ${entry.fromLevel} → ${entry.toLevel}`
            : `Level ${entry.toLevel} · ${entry.experienceToNextLevel} to go`
        }</small></div><span class="${levelled ? 'level-tag' : 'xp-tag'}">${levelled ? `Level ${entry.toLevel} ✓` : `+${entry.experienceGained} xp`}</span></article>`;
      })
      .join('');
    return `<section class="panel extraction-progress">
      <div class="panel-heading">
        <div><p class="eyebrow">Carried home in the party</p><h2>Field experience</h2></div>
        <b>${progress.length} Pokémon</b>
      </div>
      <div class="entity-list">${rows}</div>
    </section>`;
  }

  private costPanel(): string {
    const report = this.report;
    const spent = report.spent;
    const facts = [
      // An undefined spend means the losing screen could not see the bag, which
      // is not the same claim as "nothing was spent".
      ...(spent === undefined
        ? []
        : [spent.length ? `Supplies spent: ${spent.map(itemText).join(', ')}` : 'No supplies spent']),
      ...report.pressure,
    ];
    return `<section class="panel extraction-cost">
      <div class="panel-heading"><h2>What the raid cost</h2></div>
      <ul class="cost-list">${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')}</ul>
    </section>`;
  }

  private footerTitle(): string {
    if (!this.report.saved) {
      return 'Stash save unavailable';
    }
    if (this.report.outcome === 'WIPED') {
      return 'Losses applied';
    }
    return this.report.haulTier === 'empty' ? 'You came home whole' : 'Stash secured';
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
    return this.report.progress.length > 0
      ? 'No gear banked, but what your party learned is banked with them.'
      : 'Nothing new to bank, but your loadout is back at base and ready to redeploy.';
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
      ? `<img src="/assets/pokemon/front/${figure.dexId}.png" alt="" />`
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

const ROW_TAGS: Record<RowTag, { readonly text: string; readonly className: string }> = {
  banked: { text: 'Banked ✓', className: 'secure-tag banked-tag' },
  lost: { text: 'Gone', className: 'risk-tag' },
  secured: { text: 'Protected', className: 'secure-tag' },
  survived: { text: 'Made it back ✓', className: 'risk-tag survived-tag' },
};

function groupRows(group: ReportGroup, tag: RowTag): string {
  return [
    ...group.pokemon.map((member) => pokemonRow(member, tag)),
    ...group.items.map((item) => itemRow(item, tag)),
  ].join('');
}

function pokemonRow(member: ReportPokemon, tag: RowTag): string {
  const { text, className } = ROW_TAGS[tag];
  return `<article class="entity-row">${pokemonAvatar(member.dexId, escapeHtml(member.name))}<div><strong>${escapeHtml(member.name)}</strong><small>Level ${member.level} · ${member.currentHp}/${member.maxHp} HP</small>${hpBar(member.currentHp, member.maxHp)}</div><span class="${className}">${text}</span></article>`;
}

function itemRow(item: ReportItem, tag: RowTag): string {
  const { text, className } = ROW_TAGS[tag];
  // Quantity sits on the name's own line: an item row has nothing to say on a
  // second one, and the screen is worth more than the extra height costs.
  return `<article class="entity-row">${itemIcon(item.itemId, item.label)}<div><strong>${escapeHtml(item.label)} <span class="item-quantity">×${item.quantity}</span></strong></div><span class="${className}">${text}</span></article>`;
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
