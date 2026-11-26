import { BAR_MARGIN, barColumnLeft, type BarPlacement } from '../display/controlsBarLayout';
import { FULL_SCREEN_KEYS } from '../display/fullScreen';
import { sendKey } from '../input/syntheticKeys';
import { dimsTouchTray, hasTouchShortcuts, type TouchShortcut } from '../input/touchShortcuts';
import { iconMarkup } from './icons';
import { monIconCell, monIconPace } from './monIcon';
import { escapeAttribute } from './pixelUi';
import { shortcutsFrom } from './touchPad';

const escapeHtml = escapeAttribute;

/**
 * The controls bar: the game's keys as buttons, in the page beside the game
 * (the captain, 25 Nov 2026: "the six key tiles ... let's do the team front and
 * center, and then that gives us space to add the settings in as well").
 *
 * - **The team, front and centre**: who is in the party, each at its pace, a
 *   pip of health under it. It is P, the team key, so a click opens it.
 * - **The screen's own keys either side of it**, each a keycap, a picture
 *   where there is one and the word for what it does - read off the scenes
 *   exactly as the touch pad reads them (`shortcutsFrom`), so the bar offers a
 *   key exactly when the screen says it can be pressed.
 * - **FULL SCREEN, SETTINGS and HELP** at the end: HELP shows every key the
 *   game answers, and FULL SCREEN is there only where the browser can do it.
 *
 * A tile presses its key the way a keyboard does (`input/syntheticKeys.ts`), so
 * no scene has a path of its own for it, and it never takes focus: the cursor
 * stays on whatever menu it was on. Where it stands is `display/controlsBarLayout.ts`.
 */

/** A Pokémon as the bar's team shows it. */
export interface BarTeamMember {
  readonly name: string;
  readonly base: { readonly id: string };
  readonly currentHp: number;
  readonly maxHp: number;
  readonly isFainted: boolean;
}

/** A scene with a team to show on the bar: the raid's party, or the next raid's at base. */
export interface BarTeamSource {
  barTeam(): readonly BarTeamMember[];
}

export function hasBarTeam(scene: unknown): scene is BarTeamSource {
  return typeof (scene as Partial<BarTeamSource> | null)?.barTeam === 'function';
}

/** The team the topmost scene that has one shows, or none. */
export function teamFrom(scenes: readonly unknown[]): readonly BarTeamMember[] {
  for (const scene of [...scenes].reverse()) {
    if (hasBarTeam(scene)) {
      return scene.barTeam();
    }
  }
  return [];
}

/**
 * Whether a screen with no keys of its own is up over the game - the
 * Boutique, Bill's, Brock's, the Pokédex: the topmost running scene answers
 * none. The keys of the harbour under it would be offered otherwise, and LOOK
 * or MAP pressed there does nothing; so the bar offers none of them, and the
 * team stands on it unpressed. A screen with no scene of its own (THE MAP)
 * leaves every scene paused, which counts the same. A fight over a raid dims the raid's keys
 * instead (`dimsTouchTray`), as the touch pad does.
 */
export function menuOverTheGame(scenes: readonly unknown[]): boolean {
  for (const scene of [...scenes].reverse()) {
    const running = (scene as { sys?: { isActive?: () => boolean } } | null)?.sys?.isActive?.() === true;
    if (running) {
      return !hasTouchShortcuts(scene) && !dimsTouchTray(scene);
    }
  }
  // Nothing running at all: a screen drawn over a paused scene with no scene
  // of its own - THE MAP (`ui/MapScreen.ts`) - is up.
  return scenes.length > 0;
}

/** The team's own key: the team tile presses it. */
export const TEAM_KEY_CODE = 'KeyP';

/** A key's keycap: the letter or digit of `KeyB` or `Digit1`. */
export function keycapOf(code: string): string {
  return code.replace(/^(Key|Digit)/, '');
}

/** The picture beside a key's word, where the game has one for what it does. */
export function keyPicture(label: string): string | undefined {
  const pictures: Readonly<Record<string, string>> = {
    PACK: 'raid-pack',
    THINGS: 'things-bag',
    MAP: 'chart-piece-1',
    FAVOURS: 'favour-ask',
    OAK: 'radio-mast',
    DEX: 'poke-ball',
  };
  return pictures[label];
}

/** The bar's tiles, split round the team: the first half of the standing keys before it, the rest after. */
export function splitRoundTeam(keys: readonly TouchShortcut[]): { readonly before: TouchShortcut[]; readonly after: TouchShortcut[]; readonly team?: TouchShortcut } {
  const team = keys.find((key) => key.code === TEAM_KEY_CODE && !key.extra);
  const rest = keys.filter((key) => key !== team);
  const standing = rest.filter((key) => !key.extra);
  const extra = rest.filter((key) => key.extra);
  const half = Math.ceil(standing.length / 2);
  return { before: standing.slice(0, half), after: [...standing.slice(half), ...extra], ...(team ? { team } : {}) };
}

function keyTile(key: TouchShortcut): string {
  const picture = keyPicture(key.label);
  const pressable = key.inert ? '' : ` data-key="${escapeAttribute(key.code)}"`;
  const classes = ['cb-tile', key.extra ? 'is-extra' : '', key.inert ? 'is-inert' : ''].filter(Boolean).join(' ');
  return `<button type="button" class="${classes}"${pressable} tabindex="-1" aria-label="${escapeAttribute(`${keycapOf(key.code)}: ${key.label}`)}">`
    + `<span class="cb-cap">${escapeHtml(keycapOf(key.code))}</span>`
    + (picture ? iconMarkup(picture, '') : '')
    + `<span class="cb-word">${escapeHtml(key.label)}</span></button>`;
}

function teamIcon(member: BarTeamMember): string {
  const cell = monIconCell(member.base.id);
  const pace = member.isFainted ? 'still' : monIconPace(member.currentHp, member.maxHp);
  const health = member.maxHp > 0 ? Math.max(0, Math.min(1, member.currentHp / member.maxHp)) : 0;
  const tone = member.isFainted ? 'is-out' : health > 0.5 ? 'is-green' : health > 0.2 ? 'is-yellow' : 'is-red';
  const icon = cell
    ? `<span class="px-mon-icon is-${pace}" style="--icon-col:${cell.column};--icon-row:${cell.row}"></span>`
    : `<span class="px-mon-icon is-missing">${escapeHtml(member.name.slice(0, 1))}</span>`;
  return `<span class="cb-mon ${tone}" title="${escapeAttribute(member.name)}">${icon}<span class="cb-hp"><i style="width:${Math.round(health * 100)}%"></i></span></span>`;
}

/**
 * The FULL SCREEN tile: four corner marks that point out to fill the screen,
 * and in to come back, lit gold while it is full screen. None where the browser
 * cannot (`display/fullScreen.ts`).
 */
export function fullScreenTile(state: FullScreenState): string {
  if (state === 'unavailable') {
    return '';
  }
  const on = state === 'on';
  const label = on ? `Leave full screen (${FULL_SCREEN_KEYS})` : `Full screen (${FULL_SCREEN_KEYS})`;
  return `<button type="button" class="cb-tile cb-full${on ? ' is-on' : ''}" data-open="full-screen" tabindex="-1" aria-pressed="${on}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}">`
    + `<span class="cb-glyph ${on ? 'cb-shrink' : 'cb-expand'}"></span></button>`;
}

/** Whether the page is full screen, or cannot be. */
export type FullScreenState = 'off' | 'on' | 'unavailable';

/** The bar's markup, for the keys and the team the screen has now. */
export function controlsBarMarkup(keys: readonly TouchShortcut[], team: readonly BarTeamMember[], fullScreen: FullScreenState = 'unavailable'): string {
  const { before, after, team: teamKey } = splitRoundTeam(keys);
  const teamPress = teamKey && !teamKey.inert ? ` data-key="${TEAM_KEY_CODE}"` : '';
  const teamWord = teamKey?.label ?? 'TEAM';
  const teamTile = team.length > 0 || teamKey
    ? `<button type="button" class="cb-team${teamPress ? '' : ' is-inert'}"${teamPress} tabindex="-1" aria-label="${escapeAttribute(`${keycapOf(TEAM_KEY_CODE)}: ${teamWord}`)}">`
      + `<span class="cb-team-head"><span class="cb-cap">${keycapOf(TEAM_KEY_CODE)}</span><span class="cb-word">${escapeHtml(teamWord)}</span></span>`
      + `<span class="cb-mons">${team.map(teamIcon).join('')}</span></button>`
    : '';
  return `<div class="cb-keys">${before.map(keyTile).join('')}</div>`
    + teamTile
    + `<div class="cb-keys">${after.map(keyTile).join('')}</div>`
    + `<div class="cb-system">`
    + fullScreenTile(fullScreen)
    + `<button type="button" class="cb-tile cb-settings" data-open="settings" tabindex="-1" aria-label="Settings"><span class="cb-glyph cb-gear"></span><span class="cb-word">SETTINGS</span></button>`
    + `<button type="button" class="cb-tile cb-help" data-open="help" tabindex="-1" aria-label="Help: every key"><span class="cb-cap">?</span><span class="cb-word">HELP</span></button>`
    + `</div>`;
}

export interface ControlsBarHost {
  readonly document: Document;
  /** The scenes to ask for keys and the team, top of the stack last, as Phaser lists them. */
  scenes(): readonly unknown[];
  /** Opens SETTINGS or HELP over the game. */
  openScreen(view: 'settings' | 'help'): void;
  /** Whether the page is full screen now, or cannot be (`display/fullScreen.ts`). */
  fullScreen(): FullScreenState;
  /** Goes full screen, or comes back. */
  toggleFullScreen(): void;
}

export interface ControlsBar {
  /**
   * Stands the bar beside the game's box (its CSS pixels on the page), or
   * takes it away (null).
   */
  place(placement: BarPlacement | null, canvas: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null): void;
  destroy(): void;
}

/** How often the bar asks the scenes what to show, as the touch pad does. */
export const BAR_REFRESH_MS = 200;

export function installControlsBar(host: ControlsBarHost): ControlsBar {
  const { document } = host;
  const root = document.createElement('nav');
  root.className = 'pixel-ui controls-bar';
  root.setAttribute('aria-label', 'Controls');
  root.hidden = true;
  document.body.append(root);

  let shown = '';
  let before: readonly TouchShortcut[] = [];
  // Under the game the bar is exactly as wide as the game, inside the frame's
  // ring (`display/stageFrame.ts`). Where its tiles would run past that, they
  // drop their pictures - as the column beside the game does - and then their
  // words, keeping the keycaps; the team and SETTINGS and HELP keep theirs.
  const fit = (): void => {
    root.classList.remove('is-tight', 'is-tighter');
    if (root.dataset.side !== 'below') {
      return;
    }
    const overflows = (): boolean => {
      const box = root.getBoundingClientRect();
      const tiles = root.querySelectorAll(':scope > * > button, :scope > button');
      const first = tiles[0]?.getBoundingClientRect();
      const last = tiles[tiles.length - 1]?.getBoundingClientRect();
      return first !== undefined && last !== undefined && (first.left < box.left - 0.5 || last.right > box.right + 0.5);
    };
    for (const step of ['is-tight', 'is-tighter']) {
      if (!overflows()) {
        return;
      }
      root.classList.add(step);
    }
  };
  const draw = (): void => {
    if (root.hidden) {
      return;
    }
    const scenes = host.scenes();
    before = menuOverTheGame(scenes) ? [] : shortcutsFrom(scenes, before);
    const markup = controlsBarMarkup(before, teamFrom(scenes), host.fullScreen());
    if (markup !== shown) {
      shown = markup;
      root.innerHTML = markup;
      fit();
    }
  };

  // Never take focus: a focused button takes SPACE and ENTER, which are the
  // game's A button, and the menu under the cursor would lose its cursor.
  root.addEventListener('mousedown', (event) => event.preventDefault());
  root.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('button');
    if (!button) {
      return;
    }
    const open = button.dataset.open;
    if (open === 'settings' || open === 'help') {
      host.openScreen(open);
      return;
    }
    if (open === 'full-screen') {
      host.toggleFullScreen();
      return;
    }
    const code = button.dataset.key;
    if (code) {
      sendKey(document, code, 'keydown');
      sendKey(document, code, 'keyup');
      draw();
    }
  });

  const timer = setInterval(draw, BAR_REFRESH_MS);

  return {
    place(placement, canvas) {
      if (!placement || !canvas) {
        root.hidden = true;
        document.body.classList.remove('has-controls-bar');
        return;
      }
      root.hidden = false;
      document.body.classList.add('has-controls-bar');
      root.dataset.side = placement.side;
      root.style.setProperty('--px', `${placement.unit}px`);
      root.style.setProperty('--zoom', `${placement.unit}`);
      if (placement.side === 'below') {
        root.style.left = `${canvas.x}px`;
        root.style.top = `${canvas.y + canvas.height + BAR_MARGIN}px`;
        root.style.width = `${canvas.width}px`;
        root.style.height = '';
      } else {
        root.style.top = `${canvas.y}px`;
        root.style.height = `${canvas.height}px`;
        root.style.width = '';
        root.style.left = `${barColumnLeft(canvas.x, placement.unit)}px`;
      }
      draw();
      fit();
    },
    destroy() {
      clearInterval(timer);
      root.remove();
      document.body.classList.remove('has-controls-bar');
    },
  };
}
