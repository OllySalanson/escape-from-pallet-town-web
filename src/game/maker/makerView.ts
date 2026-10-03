import type { MapCheck } from '../world/mapFileChecks';
import { MAP_FILE_HABITATS, MAP_FILE_LIMITS, type MapFile, type MapFileBuildingKind } from '../world/mapFile';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import type { ThingRef } from './draft';
import type { StoredDraft } from './drafts';
import { BUILDING_CHOICES, GROUND_BRUSHES, HABITAT_LABELS } from './palette';

/**
 * The map maker's screen, as markup. Pure strings, like every pixel-ui screen,
 * so what it says is tested without a browser; `MapMakerScene` wires it.
 *
 * Three columns: what to paint with, the map, and what the map is - its checks,
 * the thing chosen on it, and its name, maker, size and wildlife. The checks sit
 * at the top of the right-hand column because they are the maker's to-do list:
 * a new map fails them all, and each one says what to do next.
 */

/** How a stroke on the map lands. */
export type MakerTool = 'brush' | 'rect' | 'fill' | 'pick' | 'select' | 'erase' | 'place';

/** What the place tool puts down. */
export type PlaceChoice =
  | { readonly kind: 'drop-in' | 'exit' | 'item' }
  | { readonly kind: 'building'; readonly building: MapFileBuildingKind };

/** How big a tile is drawn, in game pixels. Sixteen is the art's own size. */
export const MAKER_ZOOMS = [4, 8, 16, 32] as const;
export type MakerZoom = (typeof MAKER_ZOOMS)[number];

/** A line of the checks panel: a check on the file, or the walk the maker owes it. */
export type MakerCheck = Omit<MapCheck, 'id'> & { readonly id: string };

/** The last check, which is not a fact about the file but about its maker. */
export function walkedCheck(walked: boolean): MakerCheck {
  return {
    id: 'walked',
    label: 'You walked out of it yourself in TRY IT',
    passed: walked,
    problems: walked ? [] : ['WALK IT or RAID IT, and leave by an exit.'],
  };
}

export interface MakerViewState {
  readonly file: MapFile;
  readonly tool: MakerTool;
  readonly brushId: string;
  readonly place: PlaceChoice;
  readonly selected: ThingRef | undefined;
  readonly zoom: MakerZoom;
  readonly checks: readonly MakerCheck[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Every draft in this browser, for the drafts panel. */
  readonly drafts: readonly StoredDraft[];
  readonly draftKey: string;
  /** Whether the drafts list is open in place of the map's settings. */
  readonly showDrafts: boolean;
  readonly status?: string;
}

const TOOLS: readonly { readonly id: MakerTool; readonly label: string; readonly key: string; readonly help: string }[] = [
  { id: 'brush', label: 'Brush', key: 'B', help: 'Paints the ground under the pointer. Drag to paint a stroke.' },
  { id: 'rect', label: 'Box', key: 'R', help: 'Drag out a box and fill it with the ground you have chosen.' },
  { id: 'fill', label: 'Fill', key: 'F', help: 'Fills every joined tile of the same ground with the ground you have chosen.' },
  { id: 'pick', label: 'Pick', key: 'I', help: 'Takes the ground under the pointer as your brush.' },
  { id: 'select', label: 'Select', key: 'V', help: 'Chooses a drop-in, exit, item spot or building. Drag it to move it.' },
  { id: 'erase', label: 'Remove', key: 'X', help: 'Takes a drop-in, exit, item spot or building off the map.' },
];

const placeKey = (place: PlaceChoice): string => (place.kind === 'building' ? `building:${place.building}` : place.kind);

/** A row button in a tool list. */
function toolRow(attributes: string, label: string, help: string, chosen: boolean, lead = ''): string {
  return `<button class="px-row maker-choice${lead ? ' has-icon' : ''}${chosen ? ' is-selected' : ''}" ${attributes} aria-pressed="${chosen}" data-help="${escapeAttribute(help)}">${lead}<span class="px-row-main">${label}</span></button>`;
}

function toolsPane(state: MakerViewState): string {
  // The tools are a strip of buttons above the lists rather than rows in them:
  // six of them are picked far more often than any one brush, so they never
  // scroll away.
  const tools = TOOLS.map(
    (tool) =>
      `<button class="px-window px-chip maker-tool${state.tool === tool.id ? ' is-selected' : ''}" data-tool="${tool.id}" aria-pressed="${state.tool === tool.id}" data-help="${escapeAttribute(`${tool.help} Key: ${tool.key}.`)}">${tool.label}</button>`,
  ).join('');
  const brushes = GROUND_BRUSHES.map((brush) =>
    toolRow(
      `data-brush="${brush.id}"`,
      brush.label,
      brush.help,
      state.brushId === brush.id && ['brush', 'rect', 'fill'].includes(state.tool),
      `<canvas class="maker-swatch" data-swatch="${escapeAttribute(brush.swatch)}" width="16" height="16" aria-hidden="true"></canvas>`,
    ),
  ).join('');
  const chosenPlace = state.tool === 'place' ? placeKey(state.place) : '';
  const places = (
    [
      ['drop-in', 'Drop-in', 'Where a raid on the map starts. The first is the front door.'],
      ['exit', 'Exit', 'A way out. Stepping on it ends the raid with what you carry.'],
      ['item', 'Item spot', 'Somewhere to find something. The game decides what.'],
    ] as const
  )
    .map(([kind, label, help]) => toolRow(`data-place="${kind}"`, label, help, chosenPlace === kind))
    .join('');
  const buildings = BUILDING_CHOICES.map((choice) =>
    toolRow(
      `data-place="building" data-building="${choice.kind}"`,
      choice.label,
      `Plants a ${choice.label.toLowerCase()} with its top-left corner on the tile you click.`,
      chosenPlace === `building:${choice.kind}`,
    ),
  ).join('');
  return pixelWindow(
    `<div class="maker-toolbar">${tools}</div><div class="px-scroll maker-pane"><div class="px-list"><p class="px-subheading">Ground</p>${brushes}<p class="px-subheading">Places</p>${places}<p class="px-subheading">Buildings</p>${buildings}</div></div>`,
    { className: 'maker-tools', heading: 'Paint' },
  );
}

function mapPane(state: MakerViewState): string {
  const { file, zoom } = state;
  const zoomButtons = MAKER_ZOOMS.map(
    (level) =>
      `<button class="px-window px-button maker-zoom${level === zoom ? ' is-primary' : ''}" data-zoom="${level}" aria-pressed="${level === zoom}" data-help="Draws a tile ${level} pixels wide.">${level === 16 ? '1x' : level < 16 ? `1/${16 / level}` : `${level / 16}x`}</button>`,
  ).join('');
  const width = file.width * zoom;
  const height = file.height * zoom;
  return pixelWindow(
    `<div class="maker-zooms">${zoomButtons}</div><div class="maker-viewport" data-viewport><div class="maker-stack" style="width:calc(var(--u) * ${width});height:calc(var(--u) * ${height})"><canvas class="maker-canvas" data-map></canvas><canvas class="maker-canvas" data-preview></canvas></div></div>`,
    { className: 'maker-map', heading: escapeHtml(file.name || 'Untitled map'), note: `${file.width}x${file.height}` },
  );
}

function checksPane(checks: readonly MakerCheck[]): string {
  const passed = checks.filter((check) => check.passed).length;
  const rows = checks
    .map((check) => {
      const problems = check.problems
        .slice(0, 3)
        .map((problem) => `<small class="px-wrap">${escapeHtml(problem)}</small>`)
        .join('');
      const more = check.problems.length > 3 ? `<small class="px-note">and ${check.problems.length - 3} more</small>` : '';
      // A check with nothing to say about a map that does not load yet is
      // waiting on that, not failed on its own account.
      const state = check.passed ? 'is-passed' : check.problems.length > 0 ? 'is-failed' : 'is-waiting';
      return `<li class="maker-check ${state}" data-check="${check.id}"><span class="maker-check-mark" aria-label="${check.passed ? 'passed' : state === 'is-waiting' ? 'waiting' : 'not yet'}"></span><span class="px-row-main"><span class="px-wrap">${escapeHtml(check.label)}</span>${problems}${more}</span></li>`;
    })
    .join('');
  return pixelWindow(`<ul class="maker-checks-list">${rows}</ul>`, {
    className: 'maker-checks',
    heading: 'Does it work',
    note: `${passed} of ${checks.length}`,
  });
}

/** What can be said or changed about the thing chosen on the map. */
function selectedPane(file: MapFile, selected: ThingRef | undefined): string {
  if (!selected) {
    return pixelWindow(`<p class="px-empty px-wrap">Choose a drop-in, exit, item spot or building with Select to name it or move it.</p>`, {
      className: 'maker-selected',
      heading: 'Chosen',
    });
  }
  const remove = `<button class="px-window px-button" data-remove-selected data-help="Takes it off the map.">Remove</button>`;
  const field = (attribute: string, label: string, value: string, max: number): string =>
    `<label class="maker-field"><span>${label}</span><input class="px-window px-field" ${attribute} value="${escapeAttribute(value)}" maxlength="${max}" spellcheck="false" autocomplete="off" /></label>`;
  let body: string;
  let heading: string;
  if (selected.kind === 'drop-in') {
    const spot = file.dropIns[selected.index];
    heading = selected.index === 0 ? 'Front door' : 'Drop-in';
    body = `${field('data-place-name', 'Name', spot.name, MAP_FILE_LIMITS.maxPlaceNameLength)}${field('data-place-description', 'Says', spot.description ?? '', MAP_FILE_LIMITS.maxDescriptionLength)}`;
  } else if (selected.kind === 'exit') {
    const spot = file.exits[selected.index];
    heading = 'Exit';
    const seconds = spot.opens.when === 'after' ? spot.opens.seconds : 0;
    body = `${field('data-place-name', 'Name', spot.name, MAP_FILE_LIMITS.maxPlaceNameLength)}<label class="maker-field"><span>Opens after</span><input class="px-window px-field" data-exit-seconds type="number" min="0" max="${MAP_FILE_LIMITS.maxExitDelaySeconds}" step="5" value="${seconds}" /><span class="px-note">seconds, 0 is open from the start</span></label>`;
  } else if (selected.kind === 'item') {
    heading = 'Item spot';
    body = `<p class="px-note px-wrap">Something to find. The game decides what, from what the game's own maps hold.</p>`;
  } else {
    const building = file.buildings[selected.index];
    heading = BUILDING_CHOICES.find((choice) => choice.kind === building.kind)?.label ?? 'Building';
    body = `<p class="px-note px-wrap">Drag it with Select to move it.</p>`;
  }
  return pixelWindow(`<div class="maker-form">${body}<div class="maker-actions">${remove}</div></div>`, {
    className: 'maker-selected',
    heading,
  });
}

function settingsPane(file: MapFile): string {
  const habitats = (Object.keys(MAP_FILE_HABITATS) as (keyof typeof MAP_FILE_HABITATS)[])
    .map(
      (habitat) =>
        `<option value="${habitat}"${habitat === file.wildlife ? ' selected' : ''}>${HABITAT_LABELS[habitat]}</option>`,
    )
    .join('');
  return pixelWindow(
    `<div class="maker-form"><label class="maker-field"><span>Name</span><input class="px-window px-field" data-map-name value="${escapeAttribute(file.name)}" maxlength="${MAP_FILE_LIMITS.maxNameLength}" spellcheck="false" autocomplete="off" /></label><label class="maker-field"><span>Drawn by</span><input class="px-window px-field" data-map-maker value="${escapeAttribute(file.maker)}" maxlength="${MAP_FILE_LIMITS.maxMakerLength}" spellcheck="false" autocomplete="off" placeholder="your maker name" /></label><label class="maker-field"><span>Wild Pokémon</span><select class="px-window px-field" data-map-wildlife>${habitats}</select></label><div class="maker-size"><label class="maker-field"><span>Width</span><input class="px-window px-field" data-map-width type="number" min="${MAP_FILE_LIMITS.minWidth}" max="${MAP_FILE_LIMITS.maxWidth}" value="${file.width}" /></label><label class="maker-field"><span>Height</span><input class="px-window px-field" data-map-height type="number" min="${MAP_FILE_LIMITS.minHeight}" max="${MAP_FILE_LIMITS.maxHeight}" value="${file.height}" /></label></div></div>`,
    { className: 'maker-settings', heading: 'The map' },
  );
}

function draftsPane(drafts: readonly StoredDraft[], current: string): string {
  const rows = drafts
    .map(
      (draft) =>
        `<div class="maker-draft"><button class="px-row${draft.key === current ? ' is-selected' : ''}" data-open-draft="${escapeAttribute(draft.key)}" data-help="Opens this draft."><span class="px-row-main"><span class="px-name">${escapeHtml(draft.file.name || 'Untitled map')}</span><small class="px-note">${draft.file.width}x${draft.file.height}</small></span></button>${
          draft.key === current
            ? ''
            : `<button class="px-window px-button" data-delete-draft="${escapeAttribute(draft.key)}" data-help="Deletes this draft from this browser. It cannot be undone.">Delete</button>`
        }</div>`,
    )
    .join('');
  return pixelWindow(`<div class="px-scroll maker-pane"><div class="px-list">${rows || '<p class="px-empty">No drafts yet.</p>'}</div></div>`, {
    className: 'maker-drafts',
    heading: 'Your drafts',
    note: 'kept in this browser',
  });
}

export function makerScreen(state: MakerViewState): string {
  const side = `<div class="maker-side">${checksPane(state.checks)}${state.showDrafts ? draftsPane(state.drafts, state.draftKey) : `${selectedPane(state.file, state.selected)}${settingsPane(state.file)}`}</div>`;
  const button = (attribute: string, label: string, help: string, enabled = true, primary = false): string =>
    `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${attribute} data-help="${escapeAttribute(help)}"${enabled ? '' : ' aria-disabled="true"'}>${label}</button>`;
  // The map has to work before it can be tried: a raid on a map with no way
  // out is a raid that can only end on the clock.
  const works = state.checks.filter((check) => check.id !== 'walked').every((check) => check.passed);
  const tryHelp = (what: string): string =>
    works
      ? `${what} ${state.selected?.kind === 'drop-in' ? 'Starts at the chosen drop-in.' : 'Starts at the front door; choose a drop-in first to start there.'}`
      : 'Make the map pass the checks above first.';
  const actions = [
    button('data-undo', 'Undo', 'Takes back the last change. Ctrl+Z.', state.canUndo),
    button('data-redo', 'Redo', 'Puts it back again. Ctrl+Y.', state.canRedo),
    button('data-new', 'New', 'Starts a new map. This one stays in your drafts.'),
    button('data-toggle-drafts', state.showDrafts ? 'Back to map' : 'Drafts', 'Every map you have drawn in this browser.'),
    button('data-open-file', 'Open file', 'Opens a map file you downloaded or were sent.'),
    button('data-download', 'Download', 'Saves this map as a file you can keep or share.'),
    button('data-try="walk"', 'Walk it', tryHelp('Walks your map in the real game: nobody faints, every exit is open, no clock.'), works),
    button('data-try="raid"', 'Raid it', tryHelp('Plays your map as a raid: the clock, the hunter, the wild Pokémon.'), works, true),
  ].join('');
  return pixelScreen({
    place: 'Map maker',
    title: escapeHtml(state.file.name || 'Untitled map'),
    back: { label: 'TITLE', attribute: 'data-back' },
    aside: `<span>${state.checks.every((check) => check.passed) ? 'READY' : works ? 'WORKS · TRY IT' : 'NOT FINISHED'}</span>`,
    hints: 'CLICK the map to paint · CTRL+Z undo · ESC back',
    ...(state.status ? { status: escapeHtml(state.status) } : {}),
    body: `<main class="px-body maker-shell">${toolsPane(state)}${mapPane(state)}${side}${pixelCommitBar({
      title: 'Your map',
      actions,
      lines: [
        `<input type="file" accept=".json,application/json" data-file-input hidden />`,
      ],
    })}</main>`,
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { checksPane, selectedPane };
