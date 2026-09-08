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
 * The shorter hold used when the defeat sequence played all the way through.
 *
 * The full lock exists to absorb the tap that closed the last battle line. A
 * player who watched four seconds of their party going down has already spent
 * that tap, so making them wait again is the screen being slow rather than safe.
 */
const SETTLED_LOCK_MS = 350;

/**
 * Whether this save has already seen a defeat, which is all the sequence needs
 * to know to run at its shorter pace from the second death onwards.
 *
 * Kept out of the save blob deliberately: it is presentation pacing, it must
 * survive a wipe rather than be undone by one, and a browser with no storage
 * simply always gets the first-viewing pace rather than an error.
 */
const DEFEAT_SEEN_KEY = 'escape-from-pallet-town.defeat-seen.v1';

/** Keys that are only ever half of a keypress, so they never count as the skip. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']);

export class ExtractionScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private report!: ExtractionReport;
  private leaving = false;
  private locked = true;
  private keyListener: ((event: KeyboardEvent) => void) | undefined;
  /** Set while the defeat sequence is on screen, which is when a key skips. */
  private sequencePlaying = false;
  private sequenceTimers: Phaser.Time.TimerEvent[] = [];

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
    this.sequenceTimers = [];
  }

  public create(): void {
    this.cameras.main.fadeIn?.(200, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'extraction-menu', () => {});
    this.overlay.root.setAttribute('aria-label', 'Raid result');
    this.listenForKeys();
    const sequence = buildDefeatSequence(this.report, { pace: this.defeatPace() });
    if (sequence) {
      this.playDefeatSequence(sequence);
      return;
    }
    this.showReport(INPUT_LOCK_MS);
  }

  /**
   * Plays the defeat beats over the result screen, then hands it the screen.
   *
   * Nothing here can strand the player: the scene keeps every timer it schedules
   * so a skip cancels the rest, and a skip and a finished sequence land on the
   * same report through the same method.
   */
  private playDefeatSequence(sequence: DefeatSequence): void {
    this.sequencePlaying = true;
    this.overlay.root.innerHTML = defeatMarkup(sequence);
    const stage = this.overlay.root.querySelector<HTMLElement>('[data-defeat]');
    if (!stage) {
      this.finishDefeatSequence(true);
      return;
    }
    // A click anywhere on the stage skips, so the skip button is a signpost for
    // the behaviour rather than the only target for it.
    stage.onpointerdown = () => this.finishDefeatSequence(true);

    let offsetMs = sequence.leadInMs;
    for (const beat of sequence.beats) {
      this.sequenceTimers.push(
        this.time.delayedCall(offsetMs, () => this.enterDefeatBeat(stage, beat)),
      );
      offsetMs += beat.durationMs;
    }
    this.sequenceTimers.push(
      this.time.delayedCall(sequence.totalMs, () => this.finishDefeatSequence(false)),
    );
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

  /** The single way out of the sequence, whether it was watched or skipped. */
  private finishDefeatSequence(skipped: boolean): void {
    if (!this.sequencePlaying) {
      return;
    }
    this.sequencePlaying = false;
    for (const timer of this.sequenceTimers) {
      timer.remove(false);
    }
    this.sequenceTimers = [];
    this.rememberDefeatSeen();
    this.showReport(skipped ? INPUT_LOCK_MS : SETTLED_LOCK_MS);
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

  private defeatPace(): 'first' | 'repeat' {
    try {
      return window.localStorage?.getItem(DEFEAT_SEEN_KEY) ? 'repeat' : 'first';
    } catch {
      // Storage can be unavailable or blocked. A defeat still plays, at the pace
      // a player who has never seen one should get.
      return 'first';
    }
  }

  private rememberDefeatSeen(): void {
    try {
      window.localStorage?.setItem(DEFEAT_SEEN_KEY, '1');
    } catch {
      // Nothing to do: the next defeat simply plays at the first-viewing pace.
    }
  }

  /**
   * Listens in the capture phase, on the scene's own listener.
   *
   * WorldScene and BattleScene both `addCapture` SPACE and ENTER, and those
   * captures live on the game's KeyboardManager rather than the scene that asked
   * for them. While they stand, Phaser calls `preventDefault()` on every SPACE
   * and ENTER - which stops the browser activating the focused button and makes
   * `MenuOverlay` drop the event as already handled. Capturing first is what
   * gives this screen a keyboard at all; without it, it is mouse-only.
   */
  private listenForKeys(): void {
    this.keyListener = (event: KeyboardEvent) => {
      // While the defeat plays, every key is the skip. A player who has seen it
      // must never have to find the right one, and a bare modifier is not a
      // keypress a player meant as one.
      if (this.sequencePlaying) {
        if (MODIFIER_KEYS.has(event.key)) {
          return;
        }
        event.preventDefault();
        this.finishDefeatSequence(true);
        return;
      }
      if (this.locked || !['Enter', ' ', 'Escape'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      this.leave();
    };
    window.addEventListener('keydown', this.keyListener, true);
    const stopListening = (): void => {
      if (this.keyListener) {
        window.removeEventListener('keydown', this.keyListener, true);
        this.keyListener = undefined;
      }
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopListening);
    this.events.once(Phaser.Scenes.Events.DESTROY, stopListening);
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
      ${report.contract ? `<article class="extraction-contract">${objectiveIcon('Contract')}<div><strong>Contract complete: ${escapeHtml(report.contract.description)}</strong><small>${escapeHtml(report.contract.reward)}</small></div></article>` : ''}
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
    // this screen could lie about a result the player can see for themselves.
    return this.report.haulTier === 'empty'
      ? 'Nothing new to bank, but your loadout is back at base and ready to redeploy.'
      : 'Everything above is in your stash and ready for the next deployment.';
  }
}

/**
 * The defeat tableau: the trainer and the party, drawn from the sprites the game
 * already ships and laid out as one line-up standing on the field.
 *
 * The markup is written once and never re-rendered. Every beat is a state on the
 * stage element, so the figures animate from one beat to the next instead of
 * snapping between three separate pictures, and the stage is exactly as
 * skippable at the first frame as at the last.
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
    </div>
    <button type="button" class="defeat-skip" data-defeat-skip>${escapeHtml(sequence.skipHint)} \u25b8</button>
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
