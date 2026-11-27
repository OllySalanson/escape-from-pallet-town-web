import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { fullScreenOffered, isFullScreen, toggleFullScreen } from '../display/fullScreen';
import { mapTooltipsOn, setMapTooltips } from '../settings/mapTooltips';
import { KEY_GUIDE, type KeyGuideGroup } from '../input/keyGuide';
import { MenuOverlay } from '../ui/MenuOverlay';
import { escapeAttribute, pixelScreen, pixelWindow } from '../ui/pixelUi';

/** Which of the controls bar's two screens is open. */
export type ControlsView = 'help' | 'settings';

export interface ControlsSceneData {
  readonly view: ControlsView;
  /** Opens the FEEDBACK panel, from SETTINGS. */
  readonly openFeedback?: () => void;
  /** Puts back what the screen paused. */
  readonly onClose?: () => void;
}

/** A keycap as HELP draws it: each key of `Q E` its own cap. */
function keycaps(keys: string): string {
  return keys
    .split(' ')
    .map((key) => `<span class="cs-cap">${escapeAttribute(key)}</span>`)
    .join('');
}

/** HELP: every key the game answers, a card for each place it works. */
export function helpBody(guide: readonly KeyGuideGroup[] = KEY_GUIDE): string {
  const cards = guide.map((group) =>
    pixelWindow(
      `<ul class="cs-keys">${group.keys
        .map((key) => `<li class="cs-key">${keycaps(key.keys)}<span class="cs-does">${escapeAttribute(key.does)}</span></li>`)
        .join('')}</ul>`,
      { heading: group.title, className: 'cs-group' },
    ),
  );
  // One pane that is read on with the arrows where it is taller than the
  // window (`data-reads`, `MenuOverlay`): in an 800x600 window the four cards
  // were cut through their rows, and the last keys of each could not be reached.
  return `<main class="px-body cs-help-layout"><div class="px-scroll cs-help" data-reads>${cards.join('')}</div></main>`;
}

export interface SettingsState {
  readonly soundOn: boolean;
  readonly fullScreen: boolean;
  /** Whether the browser lets the page go full screen at all. */
  readonly fullScreenOffered: boolean;
  /** Whether the harbour's place labels say themselves as the player walks up (`settings/mapTooltips.ts`). */
  readonly mapTooltips: boolean;
}

/** SETTINGS: what can be changed, each a row that says what it is set to now. */
export function settingsBody(state: SettingsState): string {
  const row = (attribute: string, cap: string, name: string, now: string, on: boolean, help: string): string =>
    `<button class="px-row cs-setting" ${attribute} data-help="${escapeAttribute(help)}">`
    + `<span class="cs-setting-name">${cap ? `<span class="cs-cap">${cap}</span>` : ''}${name}</span>`
    + `<span class="cs-switch ${on ? 'is-on' : 'is-off'}">${now}</span></button>`;
  const rows = [
    row('data-sound', 'N', 'Sound', state.soundOn ? 'ON' : 'OFF', state.soundOn, state.soundOn ? 'Turn the sound off.' : 'Turn the sound on.'),
    row(
      'data-map-tooltips',
      '',
      'Map tooltips',
      state.mapTooltips ? 'ON' : 'OFF',
      state.mapTooltips,
      state.mapTooltips ? 'Names over the places as you walk up. L shows them whenever.' : 'Names only while L is held.',
    ),
    state.fullScreenOffered
      ? row('data-full-screen', '', 'Full screen', state.fullScreen ? 'ON' : 'OFF', state.fullScreen, state.fullScreen ? 'Back to the window.' : 'Fill the whole screen.')
      : '',
    row('data-feedback', 'F', 'Tell the lab what happened', 'OPEN', true, 'Write to the lab, with a picture of this moment.'),
    row('data-show-help', '?', 'Every key', 'SHOW', true, 'Every key the game answers.'),
  ];
  return `<main class="px-body cs-settings">${pixelWindow(`<div class="px-list">${rows.join('')}</div>`)}</main>`;
}

/**
 * The controls bar's two screens (`ui/controlsBar.ts`): HELP, every key the
 * game answers, and SETTINGS. Opened over the game, which is paused under it
 * as it is under FEEDBACK (`openControlsScreen`), and closed with the X or ESC.
 */
export class ControlsScene extends Phaser.Scene {
  private overlay: MenuOverlay | undefined;
  private view: ControlsView = 'help';
  private data_: ControlsSceneData = { view: 'help' };

  public constructor() {
    super('controls');
  }

  public create(data: ControlsSceneData): void {
    this.data_ = data;
    this.view = data.view;
    const overlay = new MenuOverlay(this, 'controls-menu pixel-ui', (event) => this.handleKey(event));
    overlay.root.addEventListener('click', (event) => this.handleClick(event));
    this.overlay = overlay;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    this.render();
  }

  private settings(): SettingsState {
    return {
      soundOn: !audioManager.isMuted,
      fullScreen: isFullScreen(document),
      fullScreenOffered: fullScreenOffered(document),
      mapTooltips: mapTooltipsOn(),
    };
  }

  private render(prefer: string = ''): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const help = this.view === 'help';
    overlay.root.setAttribute('aria-label', help ? 'Help' : 'Settings');
    // SETTINGS is five lines: drawn in the world's pixel. HELP is every key there is, and keeps the finer one.
    overlay.root.classList.toggle('px-world', !help);
    // HELP is a list of keys on boards; SETTINGS has its own few things in the world's pixel.
    overlay.root.classList.toggle('wood-floor', help);
    overlay.root.innerHTML = pixelScreen({
      title: help ? 'Help' : 'Settings',
      aside: help ? 'Every key' : '',
      close: { attribute: 'data-close' },
      body: help ? helpBody() : settingsBody(this.settings()),
      hints: help ? 'ARROWS read · ESC back' : 'ARROWS move · ENTER change it · ESC back',
    });
    // HELP has nothing to choose, and a screen never starts its cursor on the
    // way out, so it starts with none: ESC and the X still close it.
    if (!help) {
      overlay.focus(...(prefer ? [prefer] : []), '.cs-setting');
    } else {
      // Measured now, with no cursor to wait for: a pane taller than the window
      // gets its MORE strip and becomes the stop the arrows read on from.
      overlay.layout();
    }
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private handleClick(event: MouseEvent): void {
    const target = (event.target as Element | null)?.closest<HTMLElement>('button');
    if (!target) {
      return;
    }
    if (target.hasAttribute('data-close')) {
      this.close();
    } else if (target.hasAttribute('data-sound')) {
      audioManager.toggleMute();
      this.render('[data-sound]');
    } else if (target.hasAttribute('data-map-tooltips')) {
      setMapTooltips(!mapTooltipsOn());
      audioManager.play('select');
      this.render('[data-map-tooltips]');
    } else if (target.hasAttribute('data-full-screen')) {
      void toggleFullScreen(document).then(() => this.render('[data-full-screen]'));
    } else if (target.hasAttribute('data-feedback')) {
      const open = this.data_.openFeedback;
      this.close();
      open?.();
    } else if (target.hasAttribute('data-show-help')) {
      this.view = 'help';
      this.render();
    }
  }

  private close(): void {
    audioManager.play('menuClose');
    const onClose = this.data_.onClose;
    this.scene.stop();
    onClose?.();
  }
}

/** What opening a controls screen needs from the game: its scene manager. */
export interface ControlsGame {
  readonly scene: Phaser.Scenes.SceneManager;
}

/**
 * Opens HELP or SETTINGS over whatever is running, pausing it - the raid clock
 * with the raid - and putting back exactly what it paused when it closes, as
 * FEEDBACK does (`feedback/feedbackDesk.ts`).
 */
export function openControlsScreen(game: ControlsGame, view: ControlsView, openFeedback?: () => void): void {
  const scenes = game.scene;
  if (scenes.isActive('controls') || scenes.isActive('boot') || scenes.isActive('feedback') || !scenes.getScene('controls')) {
    return;
  }
  const cursor = document.activeElement;
  const paused = scenes
    .getScenes(true)
    .map((scene) => scene.sys.settings.key)
    .filter((key) => key !== 'controls');
  for (const key of paused) {
    scenes.pause(key);
  }
  audioManager.play('menuOpen');
  const data: ControlsSceneData = {
    view,
    openFeedback,
    onClose: () => {
      for (const key of paused) {
        if (scenes.isPaused(key)) {
          scenes.resume(key);
        }
      }
      if (cursor instanceof HTMLElement && cursor.isConnected) {
        cursor.focus();
      }
    },
  };
  scenes.run('controls', data);
}
