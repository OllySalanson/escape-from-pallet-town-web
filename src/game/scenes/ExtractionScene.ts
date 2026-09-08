import Phaser from 'phaser';
import type {
  ExtractionReport,
  ReportGroup,
  ReportItem,
  ReportPokemon,
} from '../run/extractionReport';
import { raidClockProgress } from '../run/raidClock';
import { itemIcon, objectiveIcon } from '../ui/icons';
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

export class ExtractionScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private report!: ExtractionReport;
  private leaving = false;
  private locked = true;
  private keyListener: ((event: KeyboardEvent) => void) | undefined;

  public constructor() {
    super('extraction');
  }

  public init(data: ExtractionSceneData): void {
    this.report = data.report;
    this.leaving = false;
    this.locked = true;
  }

  public create(): void {
    this.cameras.main.fadeIn?.(200, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'extraction-menu', () => {});
    this.overlay.root.setAttribute('aria-label', 'Raid result');
    this.listenForKeys();
    this.overlay.root.innerHTML = this.markup();
    const control = this.overlay.root.querySelector<HTMLButtonElement>('[data-continue]')!;
    control.onclick = () => this.leave();
    control.disabled = true;
    this.time.delayedCall(INPUT_LOCK_MS, () => {
      this.locked = false;
      control.disabled = false;
      // Focus only lands once the button can act on it, so the first keypress a
      // player makes after reading is the one that leaves.
      this.overlay.focus('[data-continue]');
    });
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
