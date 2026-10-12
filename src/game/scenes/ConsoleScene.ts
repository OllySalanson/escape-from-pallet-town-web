import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { CONSOLE_GAME_CLASS, CONSOLE_GAMES, consoleGame, type ConsoleGame } from '../console/consoleGames';
import { ConsoleSession } from '../console/consoleSession';
import { boardRows, gamesMenuMarkup } from '../console/gamesMenu';
import { DeviceBoard, Leaderboards, type Board } from '../console/leaderboard';
import {
  checkPlayerName,
  loadPlayerName,
  playerNameProblemLine,
  savePlayerName,
  typedPlayerName,
} from '../console/playerName';
import { palletTownBoards } from '../console/remoteScores';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';

export interface ConsoleSceneData {
  /** Only resume the house when this screen paused it. */
  readonly pausedBase: boolean;
}

function deviceStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The console in the player's room: the GAMES menu, and the game it starts.
 *
 * The menu is a pixel-ui screen over the paused house, the way the field guide
 * is over a paused raid (`ObjectivesScene`). Picking a game takes the menu down
 * - and with it the menu's claim on the keyboard (`ui/overlayKeyboard.ts`),
 * which stops every key at the window before it reaches anything else - and
 * plays the game full-window over everything, in an element of its own that the
 * game listens on and keeps its keys inside. Leaving the game (EXIT, or Esc on
 * its title screen) goes back to the house, as the menu's own Esc does.
 *
 * What is said and drawn is `console/gamesMenu.ts`; which games there are is
 * `console/consoleGames.ts`; the handoff to a game is `console/consoleSession.ts`;
 * the boards are `console/leaderboard.ts`.
 */
export class ConsoleScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private boards = new Map<string, Board>();
  private playerName: string | null = null;
  private naming: { value: string; then?: string } | null = null;
  private status: string | undefined;
  private session!: ConsoleSession;

  public constructor() {
    super('console');
  }

  public init(data: ConsoleSceneData): void {
    // Phaser keeps one instance of a scene for every visit, and the last
    // visit's menu was destroyed with it: a menu kept from then is a menu
    // drawn nowhere.
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.boards = new Map();
    this.playerName = loadPlayerName();
    this.naming = null;
    this.status = undefined;
    this.session = new ConsoleSession({
      leaderboards: new Leaderboards(palletTownBoards, new DeviceBoard(deviceStorage())),
      hideMenu: () => {
        this.overlay?.destroy();
        this.overlay = undefined;
      },
      showMenu: (status) => {
        this.status = status;
        this.showMenu();
      },
      makeHost: (game) => {
        const host = document.createElement('div');
        host.className = CONSOLE_GAME_CLASS;
        host.setAttribute('aria-label', game.name);
        document.body.append(host);
        return host;
      },
      boardRead: (game, board) => this.showBoard(game, board),
      leave: () => this.close(),
      later: (run) => window.setTimeout(run, 0),
      record: recordAction,
    });
    const session = this.session;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => session.takeDown());
    this.showMenu();
    this.readBoards();
  }

  public create(): void {
    // The menu is built in init so it is up before the first frame after the
    // house pauses.
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    const playing = this.session.playing;
    return [playing ? { label: 'Playing', value: playing.name } : { label: 'Screen', value: 'GAMES menu' }];
  }

  private showMenu(): void {
    this.overlay ??= new MenuOverlay(this, 'console-menu pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Games');
    this.render();
  }

  private render(): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    overlay.root.innerHTML = gamesMenuMarkup({
      games: CONSOLE_GAMES,
      boards: this.boards,
      playerName: this.playerName,
      naming: this.naming,
      ...(this.status ? { status: this.status } : {}),
    });
    const root = overlay.root;
    root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    root.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((button) => {
      button.onclick = () => this.play(button.dataset.play ?? '');
    });
    const rename = root.querySelector<HTMLButtonElement>('[data-name]');
    if (rename) {
      rename.onclick = () => this.openNaming();
    }
    this.wireNameForm(root);
    if (this.naming) {
      overlay.focus('.px-field');
    } else {
      overlay.refocus('[data-cursor-start]', '[data-play]');
    }
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.openNaming();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private wireNameForm(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>('[data-name-form]');
    const field = form?.querySelector<HTMLInputElement>('.px-field');
    if (!form || !field) {
      return;
    }
    // Only what a name may hold ever stands in the box, so what is typed is
    // what goes on the board.
    field.oninput = () => {
      const typed = typedPlayerName(field.value);
      if (typed !== field.value) {
        field.value = typed;
      }
      if (this.naming) {
        this.naming.value = typed;
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      this.submitName(field.value);
    };
    root.querySelector<HTMLButtonElement>('[data-name-cancel]')!.onclick = () => this.cancelNaming();
    // A field owns its keys (`overlayKeyboard.ts`); key up is how it hands the
    // cursor back, exactly as the stash's box name does.
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        this.cancelNaming();
      }
    };
  }

  private openNaming(then?: string): void {
    if (this.naming || this.session.playing) {
      return;
    }
    this.naming = { value: this.playerName ?? '', ...(then ? { then } : {}) };
    this.status = undefined;
    this.render();
  }

  private cancelNaming(): void {
    this.naming = null;
    this.status = undefined;
    this.render();
  }

  private submitName(raw: string): void {
    const check = checkPlayerName(raw);
    if (!check.ok) {
      audioManager.play('bump');
      this.status = playerNameProblemLine(check.problem);
      this.naming = { ...this.naming, value: typedPlayerName(raw) };
      this.render();
      return;
    }
    const then = this.naming?.then;
    this.playerName = check.name;
    savePlayerName(check.name);
    this.naming = null;
    this.status = `Your scores go on the boards as ${check.name}.`;
    if (then) {
      this.play(then);
      return;
    }
    this.render();
    // The device board marks its own rows by name, so it is read again.
    this.readBoards();
  }

  private readBoards(): void {
    for (const game of CONSOLE_GAMES) {
      void this.session.readBoard(game, this.playerName);
    }
  }

  /**
   * A board arrived: only its own pane is redrawn, never the screen, because a
   * rebuild under the pointer eats the click it was about to make.
   */
  private showBoard(game: ConsoleGame, board: Board): void {
    this.boards.set(game.id, board);
    const pane = this.overlay?.root.querySelector<HTMLElement>(`[data-shown-by="${game.id}"]`);
    if (!pane) {
      return;
    }
    pane.innerHTML = boardRows(game, board);
    // Laid out again - text boxes snapped to the pixel grid, the MORE strip
    // asked again - with the cursor kept where it was, or put back on the game
    // if it was on a row this just replaced.
    this.overlay?.refocus(`[data-play="${game.id}"]`);
  }

  private play(id: string): void {
    const game = consoleGame(id);
    if (!game || this.session.playing) {
      return;
    }
    if (!this.playerName) {
      this.openNaming(id);
      return;
    }
    audioManager.play('menuOpen');
    void this.session.play(game, this.playerName);
  }

  private close(): void {
    if (!this.scene.isActive('console')) {
      return;
    }
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    this.session.takeDown();
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
