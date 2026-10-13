import Phaser from 'phaser';
import { isTesterBrowser, markTesterBrowser, testerMarkChosen } from '../analytics/playCounter';
import { loadPlayStats } from '../analytics/playStats';
import { statsScreen, type StatsState } from '../analytics/statsView';
import {
  finishReviewSignIn,
  rememberSignInDestination,
  reviewAccess,
  signInToReview,
  signOutOfReview,
} from '../maker/review';
import { MenuOverlay } from '../ui/MenuOverlay';

export interface StatsSceneData {
  /** Back from signing in with GitHub: finish it before asking anything. */
  readonly signIn?: boolean;
}

/**
 * The owner's play stats: does anyone play this game? Reached from the map
 * maker's review list (PLAY STATS) or by opening the game with `?stats` on its
 * address. It signs in exactly as reviewing does - the same GitHub account and
 * the same admin row - and the database, not this screen, refuses anyone else
 * (`analytics/playStats.ts`).
 *
 * It is also where the owner marks a browser as a tester's: the first time a
 * browser opens the counts it is marked one (it is the owner's), and the
 * switch on the page turns it back into a player's or a tester's again.
 */
export class StatsScene extends Phaser.Scene {
  private overlay: MenuOverlay | undefined;
  private state: StatsState = { step: 'checking' };
  private status: string | undefined;
  /** Bumped by every load, so an answer that arrives after a newer question is dropped. */
  private asking = 0;

  public constructor() {
    super('stats');
  }

  public create(data: StatsSceneData = {}): void {
    this.state = { step: 'checking' };
    this.status = undefined;
    const overlay = new MenuOverlay(this, 'stats-menu pixel-ui', (event) => this.handleKey(event));
    overlay.root.setAttribute('aria-label', 'Play stats');
    overlay.root.addEventListener('click', (event) => this.handleClick(event));
    this.overlay = overlay;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.asking += 1;
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    this.render();
    void this.askForCounts(data.signIn === true);
  }

  private async askForCounts(finishingSignIn = false): Promise<void> {
    const question = (this.asking += 1);
    if (finishingSignIn) {
      await finishReviewSignIn();
    }
    const access = await reviewAccess();
    let next: StatsState;
    if (access === 'signed-out') {
      next = { step: 'signed-out' };
    } else if (access === 'not-reviewer') {
      next = { step: 'not-owner' };
    } else {
      const stats = await loadPlayStats();
      if (stats.ok && !testerMarkChosen(storage())) {
        markTesterBrowser(storage(), true);
      }
      next = stats.ok
        ? { step: 'loaded', stats: stats.value, testerHere: isTesterBrowser(storage()) }
        : { step: 'failed', reason: stats.reason };
    }
    if (question === this.asking && this.overlay) {
      this.state = next;
      this.render();
    }
  }

  private render(): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    overlay.root.innerHTML = statsScreen(this.state, this.status);
    overlay.focus('[data-sign-in]', '.stats-line', '[data-refresh]', '[data-sign-out]', '[data-close]');
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if ((event.key === 'r' || event.key === 'R') && this.state.step !== 'checking') {
      event.preventDefault();
      this.refresh();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private handleClick(event: MouseEvent): void {
    const target = (event.target as Element | null)?.closest<HTMLElement>('button');
    if (!target || target.getAttribute('aria-disabled') === 'true') {
      return;
    }
    if (target.hasAttribute('data-close')) {
      this.close();
    } else if (target.hasAttribute('data-refresh')) {
      this.refresh();
    } else if (target.hasAttribute('data-tester-toggle') && this.state.step === 'loaded') {
      const tester = !this.state.testerHere;
      if (markTesterBrowser(storage(), tester)) {
        this.state = { ...this.state, testerHere: tester };
        this.status = tester ? 'This browser is counted as a tester from now on.' : 'This browser is counted as a player from now on.';
      } else {
        this.status = 'This browser will not keep the mark: its storage is shut.';
      }
      this.render();
      this.overlay?.focus('[data-tester-toggle]');
    } else if (target.hasAttribute('data-sign-in')) {
      rememberSignInDestination('stats');
      void signInToReview().then((result) => {
        if (!result.ok && this.overlay) {
          this.state = { step: 'signed-out', reason: result.reason };
          this.render();
        }
      });
    } else if (target.hasAttribute('data-sign-out')) {
      void signOutOfReview().then(() => {
        if (this.overlay) {
          this.state = { step: 'signed-out' };
          this.render();
        }
      });
    }
  }

  private refresh(): void {
    this.state = { step: 'checking' };
    this.render();
    void this.askForCounts();
  }

  private close(): void {
    if (!this.scene.isActive()) {
      return;
    }
    this.scene.start('title');
  }
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
