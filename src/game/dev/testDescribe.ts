import { providesFeedbackContext } from '../feedback/feedbackContext';
import { readRunProgress, type RunProgress } from './runProgress';
import type { TestEvent } from './testEvents';

/**
 * The screen as plain JSON, for a program that plays the game: an AI
 * playtester, or a driver that would otherwise read private scene fields its
 * own way and break on the next rename (the research of 19 Nov 2026 found one
 * playtest with sixty helper scripts doing exactly that).
 *
 * It exists only in test mode (`testMode.ts` puts it on the game handle), so
 * nothing here is ever asked by a player's game.
 *
 * Three layers, from most general to most particular:
 *
 * 1. **What every screen shows**: the visible canvas text of every running
 *    scene, and the visible DOM menu with its controls. Nothing per scene, so
 *    a new minigame is described the day it ships.
 * 2. **What every scene already tells a feedback message**
 *    (`feedbackContext()`), which is the scene saying where the player is in
 *    its own words.
 * 3. **What the three scenes a run is played in know** - the world, the
 *    harbour and the battle - through `describeForTest()`, a method each of
 *    them implements over its own fields, so the compiler names every place a
 *    rename must reach.
 *
 * `busy` is the AGENTS.md rule made readable: a cutscene, a fight queued
 * behind the last line, a warp - the states in which nothing is on screen to
 * press and the world is about to change anyway.
 */

/** A scene that can say what it is showing, for `describe()`. */
export interface DescribesForTest {
  describeForTest(): SceneDescription;
}

/** What one scene says about itself. Plain JSON: every value survives `JSON.stringify`. */
export interface SceneDescription {
  /** Why nothing should be pressed yet, when that is so: `cutscene`, `warping`, `typing`... */
  readonly busy?: string | null;
  readonly [key: string]: unknown;
}

export function describesForTest(scene: unknown): scene is DescribesForTest {
  return typeof (scene as Partial<DescribesForTest> | null)?.describeForTest === 'function';
}

/**
 * A scene's own description, or what went wrong asking for it: a scene caught
 * half built (between `init` and the end of `create`) is still a screen, and
 * one bad part must not cost the whole description.
 */
export function sceneDescription(scene: unknown): SceneDescription {
  if (!describesForTest(scene)) {
    return {};
  }
  try {
    return scene.describeForTest();
  } catch (error) {
    return { busy: 'starting', error: String(error) };
  }
}

/** A line of canvas text on screen, where it sits in the game's own pixels. */
export interface ScreenText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/** A thing in a DOM menu a player can press. */
export interface DomControl {
  readonly label: string;
  readonly disabled?: true;
  readonly selected?: true;
  readonly focused?: true;
  /** What kind of control: `button`, `option`, `tab`, `input`... */
  readonly kind: string;
}

export interface DomScreen {
  readonly heading: string | null;
  /** The menu's words, whitespace folded, cut at `DOM_TEXT_LIMIT`. */
  readonly text: string;
  readonly controls: readonly DomControl[];
}

export interface GameDescription {
  /** Running scenes, the top one last. */
  readonly scenes: readonly string[];
  /** The first reason any scene gives for not pressing yet, or null when input is wanted. */
  readonly busy: string | null;
  /** Per scene: what it says about itself (layer 3) and its feedback details (layer 2). */
  readonly scene: Readonly<Record<string, SceneDescription>>;
  /** Visible canvas text, top to bottom (layer 1). */
  readonly texts: readonly ScreenText[];
  /** The DOM menu on screen, if one is (layer 1). */
  readonly menu: DomScreen | null;
  /** How far through a full run this save is (`runProgress.ts`). */
  readonly progress: RunProgress | null;
  /** The newest event's number, for `eventLog(since)`. */
  readonly lastEvent: number;
}

export const DOM_TEXT_LIMIT = 900;
export const SCREEN_TEXT_LIMIT = 60;

// ---------------------------------------------------------------------------
// Layer 1: canvas text. Duck-typed over Phaser's display list, so a test can
// hand it plain objects and the module never imports Phaser.

interface DisplayObjectLike {
  readonly type?: string;
  readonly visible?: boolean;
  readonly alpha?: number;
  readonly text?: string;
  readonly list?: readonly DisplayObjectLike[];
  readonly scrollFactorX?: number;
  getBounds?(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

interface CameraLike {
  readonly worldView: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom?: number;
}

export interface SceneLike {
  readonly scene: { readonly key: string };
  readonly children?: { readonly list: readonly DisplayObjectLike[] };
  readonly cameras?: { readonly main?: CameraLike };
}

const fold = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Every visible line of canvas text a scene is drawing inside its camera, in
 * screen pixels, top to bottom. A container hides everything in it; text with
 * a scroll factor of zero is fixed to the screen (a chip, a dialogue box), and
 * anything else is in the world and on screen only inside the camera's view.
 */
export function visibleTexts(scene: SceneLike): ScreenText[] {
  const camera = scene.cameras?.main;
  const found: ScreenText[] = [];
  const visit = (object: DisplayObjectLike, fixed: boolean): void => {
    if (object.visible === false || object.alpha === 0) {
      return;
    }
    const pinned = fixed || object.scrollFactorX === 0;
    if (object.list) {
      for (const child of object.list) {
        visit(child, pinned);
      }
      return;
    }
    if (object.type !== 'Text' || !object.text || !object.getBounds) {
      return;
    }
    const text = fold(object.text);
    if (text.length === 0) {
      return;
    }
    const bounds = object.getBounds();
    let x = bounds.x;
    let y = bounds.y;
    if (camera && !pinned) {
      const view = camera.worldView;
      const inView =
        bounds.x + bounds.width > view.x &&
        bounds.x < view.x + view.width &&
        bounds.y + bounds.height > view.y &&
        bounds.y < view.y + view.height;
      if (!inView) {
        return;
      }
      const zoom = camera.zoom ?? 1;
      x = (bounds.x - view.x) * zoom;
      y = (bounds.y - view.y) * zoom;
    }
    // A shadow or outline is the same words drawn again a pixel or two over.
    const echo = found.some((seen) => seen.text === text && Math.abs(seen.x - x) <= 4 && Math.abs(seen.y - y) <= 4);
    if (!echo) {
      found.push({ text, x: Math.round(x), y: Math.round(y) });
    }
  };
  for (const object of scene.children?.list ?? []) {
    visit(object, false);
  }
  return found.sort((a, b) => a.y - b.y || a.x - b.x);
}

// ---------------------------------------------------------------------------
// Layer 1: the DOM menu. Duck-typed over the DOM for the same reason.

export interface ElementLike {
  readonly tagName: string;
  readonly innerText?: string;
  readonly textContent?: string | null;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly classList?: { contains(name: string): boolean };
  getAttribute(name: string): string | null;
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
  getClientRects(): ArrayLike<unknown>;
  click?(): void;
  dispatchEvent?(event: Event): boolean;
  focus?(): void;
  scrollIntoView?(options: { readonly block: 'nearest' }): void;
}

export interface DocumentLike {
  readonly activeElement: unknown;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

/** Everything in a menu a player can press, in the order they read it. */
export const CONTROL_SELECTOR =
  'button, [role="button"], [role="option"], [role="tab"], [role="menuitem"], [role="radio"], [role="checkbox"], input, select, textarea, a[href]';

const shown = (element: ElementLike): boolean => element.getClientRects().length > 0;

/**
 * What a control is called, as a screen reader would say it: its `aria-label`
 * where it has one, which is what the page says the control *is*, and its
 * words otherwise. A box tile shows a Pokémon's icon over its level, so read
 * by its words alone a Diglett was a control called "3" (veteran playtest,
 * 20 Nov 2026), while its label says who it is.
 */
export function controlLabel(element: ElementLike): string {
  const text = fold(element.innerText ?? element.textContent ?? '');
  const aria = fold(element.getAttribute('aria-label') ?? '');
  const value = element.tagName === 'INPUT' ? fold(element.value ?? element.getAttribute('placeholder') ?? '') : '';
  return aria || text || value || fold(element.getAttribute('title') ?? '');
}

function controlKind(element: ElementLike): string {
  const role = element.getAttribute('role');
  if (role) {
    return role;
  }
  return element.tagName.toLowerCase() === 'a' ? 'link' : element.tagName.toLowerCase();
}

const isSelected = (element: ElementLike): boolean =>
  element.getAttribute('aria-selected') === 'true' ||
  element.getAttribute('aria-pressed') === 'true' ||
  element.getAttribute('aria-checked') === 'true' ||
  (element.getAttribute('aria-current') ?? 'false') !== 'false' ||
  element.classList?.contains('is-selected') === true;

const isDisabled = (element: ElementLike): boolean =>
  element.disabled === true || element.getAttribute('aria-disabled') === 'true';

/** The menu layers on screen, topmost last. */
function shownMenus(document: DocumentLike): ElementLike[] {
  // Not one on its way out: it is drawn for a tenth of a second more and can be pressed by nobody (`ui/menuMotion.ts`).
  return Array.from(document.querySelectorAll('.menu-overlay')).filter((menu) => shown(menu) && menu.getAttribute('data-leaving') === null);
}

/** Every pressable control in a menu, visible ones only. */
function controlsOf(menu: ElementLike): ElementLike[] {
  return Array.from(menu.querySelectorAll(CONTROL_SELECTOR)).filter(shown);
}

/** The DOM menu on screen - the topmost - as words and controls, or null when there is none. */
export function describeMenu(document: DocumentLike): DomScreen | null {
  const menus = shownMenus(document);
  const menu = menus[menus.length - 1];
  if (!menu) {
    return null;
  }
  const heading = menu.querySelector('h1, h2, h3, [role="heading"]');
  const text = fold(menu.innerText ?? menu.textContent ?? '');
  const controls = controlsOf(menu)
    .map((element): DomControl => {
      const label = controlLabel(element);
      return {
        label,
        kind: controlKind(element),
        ...(isDisabled(element) ? { disabled: true as const } : {}),
        ...(isSelected(element) ? { selected: true as const } : {}),
        ...(document.activeElement === element ? { focused: true as const } : {}),
      };
    })
    .filter((control) => control.label.length > 0);
  return {
    heading: heading ? fold(heading.innerText ?? heading.textContent ?? '') || null : null,
    text: text.length > DOM_TEXT_LIMIT ? `${text.slice(0, DOM_TEXT_LIMIT)}...` : text,
    controls,
  };
}

/**
 * Presses the control in the topmost menu whose label matches `label`: the
 * exact label first (case aside), then the first that starts with it, then
 * the first that contains it. A disabled one is never pressed. Returns the
 * label pressed, or null when nothing matched.
 */
export function pressMenuControl(document: DocumentLike, label: string): string | null {
  const menus = shownMenus(document);
  const menu = menus[menus.length - 1];
  if (!menu) {
    return null;
  }
  const wanted = fold(label).toLowerCase();
  const candidates = controlsOf(menu)
    .filter((element) => !isDisabled(element))
    .map((element) => ({ element, label: controlLabel(element) }));
  const lower = (text: string): string => text.toLowerCase();
  const match =
    candidates.find((each) => lower(each.label) === wanted) ??
    candidates.find((each) => lower(each.label).startsWith(wanted)) ??
    candidates.find((each) => lower(each.label).includes(wanted));
  if (!match) {
    return null;
  }
  // Scrolled to first, as a player scrolls to a row before clicking it: a
  // click on a row still below a list's fold focused it out of sight, and the
  // veteran run read its details beside a list that never showed it (20 Nov 2026).
  match.element.scrollIntoView?.({ block: 'nearest' });
  match.element.focus?.();
  // A pointer's click, with a click count, as a player's is: a key's press has
  // none, and the jump-in card's rows bump on a key (`HubScene`'s rim rows).
  if (typeof MouseEvent === 'function' && match.element.dispatchEvent) {
    match.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  } else {
    match.element.click?.();
  }
  return match.label;
}

// ---------------------------------------------------------------------------
// The whole description.

export interface DescribeInputs {
  /** Running scenes, bottom first, as `game.scene.getScenes(true)` gives them reversed. */
  readonly scenes: readonly SceneLike[];
  readonly document: DocumentLike | null;
  /** The raw stored save text, or null for no save. */
  readonly saveText: string | null;
  readonly lastEvent: number;
}

/** Scenes whose canvas text is never the game's: the feedback panel is a DOM screen over everything. */
const QUIET_SCENES = new Set(['boot']);

export function describeGame(inputs: DescribeInputs): GameDescription {
  const scene: Record<string, SceneDescription> = {};
  let busy: string | null = null;
  const texts: ScreenText[] = [];
  for (const each of inputs.scenes) {
    const key = each.scene.key;
    const own = sceneDescription(each);
    const details = providesFeedbackContext(each) ? each.feedbackContext() : [];
    scene[key] = {
      ...own,
      ...(details.length > 0 ? { details: Object.fromEntries(details.map((d) => [d.label, d.value])) } : {}),
    };
    busy ??= own.busy ?? null;
    if (!QUIET_SCENES.has(key)) {
      texts.push(...visibleTexts(each));
    }
  }
  return {
    scenes: inputs.scenes.map((each) => each.scene.key),
    busy,
    scene,
    texts: texts.slice(0, SCREEN_TEXT_LIMIT),
    menu: inputs.document ? describeMenu(inputs.document) : null,
    progress: readRunProgress(inputs.saveText),
    lastEvent: inputs.lastEvent,
  };
}

/** The part of the test handle `describe()` and its event log add. */
export interface TestReadouts {
  /** The screen as JSON. */
  describe(): GameDescription;
  /** Events after number `since` (all kept ones by default), oldest first. */
  eventLog(since?: number): readonly TestEvent[];
  /** Presses the DOM menu control with this label; the label pressed, or null. */
  pressMenu(label: string): string | null;
}
