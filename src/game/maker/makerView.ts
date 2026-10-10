import type { MapCheck } from '../world/mapFileChecks';
import { POKEMON_ICON_ORDER } from '../pokemon/generated/pokemonIcons';
import { pokemonCry, pokemonName } from '../world/pokemonFigures';
import { BERRY_IDS, berryItemId, berryName } from '../world/berries';
import { ITEMS } from '../items/items';
import {
  areaLimits,
  buildingDoorways,
  doorFront,
  MAP_FILE_DOOR_KINDS,
  MAP_FILE_FACINGS,
  MAP_FILE_HABITATS,
  MAP_FILE_LANDMARKS,
  MAP_FILE_LIMITS,
  MAP_FILE_LOOKS,
  MAP_FILE_TRAINER_TEAMS,
  teamLine,
  MAP_FILE_STYLES_OF,
  type MapFile,
  type MapFileLinkEnd,
  type MapFileArea,
  type MapFileBuildingKind,
  type MapFileDoorKind,
  type MapFileHabitat,
  type MapFileLandmarkKind,
  type MapFileTrainerTeam,
} from '../world/mapFile';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { growthRoom, type SpotKind, type ThingRef } from './draft';
import {
  areaById,
  doorwaysIn,
  focusArea,
  hasDoor,
  insideOf,
  stairwellIn,
  ladderDownIn,
  stairsUpIn,
  type AreaId,
  type DoorwayInArea,
} from './areas';
import type { StoredDraft } from './drafts';
import { PASSAGE_TARGETS, type PassageLook, type PendingPassage } from './passages';
import type { QueuedMap } from './review';
import { STATUS_WORDS, type SentMap, type SubmissionStatus } from './submissions';
import {
  BUILDING_CHOICES,
  PLANT_GROUPS,
  brushesFor,
  FACING_LABELS,
  FURNITURE_CHOICES,
  furnitureFor,
  HABITAT_LABELS,
  LOOK_LABELS,
  STYLE_LABELS,
} from './palette';

/**
 * The map maker's screen, as markup. Pure strings, like every pixel-ui screen,
 * so what it says is tested without a browser; `MapMakerScene` wires it.
 *
 * Three columns: what to paint with, the map, and what the map is - its checks,
 * the thing chosen on it, and its name, maker, size and wildlife. The checks sit
 * at the top of the right-hand column because they are the maker's to-do list:
 * a new map fails them all, and each one says what to do next.
 */

/** The right-hand column: the chosen thing and the map, the drafts, sending in, or what became of what was sent. */
export type MakerPanel = 'map' | 'drafts' | 'send' | 'sent' | 'review';

/**
 * The review list, for the owner: whether whoever is here may review, and
 * what is waiting. The database decides who is a reviewer (`maker/review.ts`).
 */
export type ReviewState =
  | { readonly step: 'checking' }
  | { readonly step: 'signed-out'; readonly reason?: string }
  | { readonly step: 'not-reviewer' }
  | { readonly step: 'loaded'; readonly maps: readonly QueuedMap[]; readonly reason?: string }
  | { readonly step: 'failed'; readonly reason: string };

/**
 * Sending in, step by step. `previous` is this draft's last receipt and what
 * became of it, when it has been sent before: a map still waiting is not sent
 * twice, and a map sent back goes in again as its next version.
 */
export type SendState =
  | { readonly step: 'checking' }
  | {
      readonly step: 'ready';
      readonly previous?: { readonly receipt: string; readonly status: SubmissionStatus };
      /** Whether a bot check is on screen and has not been passed yet. */
      readonly needsCheck: boolean;
    }
  | { readonly step: 'sending' }
  | { readonly step: 'sent'; readonly receipt: string }
  | { readonly step: 'failed'; readonly reason: string };

export type SentState =
  | { readonly step: 'loading' }
  | { readonly step: 'loaded'; readonly maps: readonly SentMap[] }
  | { readonly step: 'failed'; readonly reason: string };

/** How a stroke on the map lands. */
export type MakerTool = 'brush' | 'rect' | 'fill' | 'pick' | 'select' | 'erase' | 'place';

/** What the place tool puts down. */
export type PlaceChoice =
  | { readonly kind: SpotKind | 'district' | MapFileDoorKind | CavePassage }
  | { readonly kind: 'building'; readonly building: MapFileBuildingKind };

/** The ways through a cave a maker puts down one end at a time (`passages.ts`). */
export type CavePassage = Exclude<PassageLook, 'mouth'>;

export function isCavePassage(kind: string): kind is CavePassage {
  return kind === 'ladder-down' || kind === 'ladder-up' || kind === 'cave-exit';
}

/** The cave's own rows in Places: each is a way through, put down and then pointed where it comes out. */
const CAVE_PLACE_ROWS: readonly (readonly [CavePassage, string, string])[] = [
  [
    'ladder-down',
    'Ladder down',
    'A hole with a ladder down it. Click the floor where it goes, then click where it comes out on the floor of another cave.',
  ],
  [
    'ladder-up',
    'Ladder up',
    'A ladder up, its foot on the floor. Click where it stands, then click where it comes out on the floor of another cave.',
  ],
  [
    'cave-exit',
    'Way out',
    "Daylight cut into the cave's south wall. Click the rock where it goes, then the cave mouth outside it comes out of.",
  ],
];

/**
 * How big a tile is drawn, in game pixels. Sixteen is the art's own size; two
 * is for standing back from a 256x256 map, which at a quarter is still four
 * screens across.
 */
export const MAKER_ZOOMS = [2, 4, 8, 16, 32] as const;
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
  /**
   * The place of the map on screen: the outdoors, or the inside of one of its
   * buildings (`maker/areas.ts`). Everything chosen, painted and placed is in
   * it; the checks and the map's own name are the whole file's.
   */
  readonly area?: AreaId;
  /** A way through chosen on the map - a room's mat - by its link and end. */
  readonly doorway?: Pick<DoorwayInArea, 'link' | 'end'>;
  /** An entrance put down and waiting to be told where it comes out. */
  readonly passage?: PendingPassage;
  readonly tool: MakerTool;
  readonly brushId: string;
  readonly place: PlaceChoice;
  readonly selected: ThingRef | undefined;
  readonly zoom: MakerZoom;
  /** Whether the overview is wanted in the corner of the map window. */
  readonly overview: boolean;
  readonly checks: readonly MakerCheck[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Every draft in this browser, for the drafts panel. */
  readonly drafts: readonly StoredDraft[];
  /** How many drafts in this browser this editor cannot open: kept, and said so. */
  readonly unreadableDrafts?: number;
  readonly draftKey: string;
  /** What the right-hand column shows under the checks. */
  readonly panel: MakerPanel;
  /** Where sending this map in has got to, while the send panel is open. */
  readonly sending: SendState;
  /** What became of this browser's maps, while the sent panel is open. */
  readonly sent: SentState;
  readonly review: ReviewState;
  /** The map sent in that is open in the editor to be reviewed, if one is. */
  readonly reviewing: QueuedMap | undefined;
  readonly status?: string;
}

/** The Places list: what a maker can stand on the map besides ground and buildings. */
const PLACE_ROWS = [
  ['drop-in', 'Drop-in', 'Where a raid on the map starts. The first is the front door.'],
  ['exit', 'Exit', 'A way out. Stepping on it ends the raid with what you carry.'],
  ['item', 'Item spot', 'Somewhere to find something. The game decides what.'],
  [
    'landmark',
    'Landmark',
    'A place to work once a raid by walking onto it: a spring, a hide, a shed. It pays what it is.',
  ],
  [
    'person',
    'Person',
    'Somebody who stands there and says something. Nobody can walk through them.',
  ],
  [
    'pokemon',
    'Pokémon',
    'A Pokémon standing in the world - any of the 151 - that says its name when spoken to.',
  ],
  [
    'berry-tree',
    'Berry tree',
    'A tree hung with one kind of berry. Picked once a raid, and ripe again on the next.',
  ],
  ['sign', 'Sign', 'A sign that reads what you write on it.'],
  [
    'trainer',
    'Trainer',
    "A trainer with one of the game's own teams. Walking into them, or into their sight, is a fight.",
  ],
  [
    'district',
    'District',
    'Drag out a named part of the map, with its own wild Pokémon and rain if you like.',
  ],
  [
    'cut-tree',
    'Cut tree',
    'A small tree in the way. A Pokémon that knows Cut clears it, and it stays cleared.',
  ],
  [
    'smash-rock',
    'Rock Smash rock',
    'A cracked rock in the way. A Pokémon that knows Rock Smash breaks it, and it stays broken.',
  ],
  [
    'boulder',
    'Boulder',
    'A boulder in the way. A Pokémon that knows Strength pushes it a tile at a time, for that raid.',
  ],
  [
    'surf',
    'Surf water',
    'Drag out deep water a Pokémon that knows Surf can cross. Crossed once, it stays open.',
  ],
] as const;

/** A field move's doors - a Cut tree, a Rock Smash rock, Surf water - stand outdoors, so an inside has none of them. */
const placesFor = (inside: MapFileArea | undefined): readonly (typeof PLACE_ROWS)[number][] =>
  inside
    ? PLACE_ROWS.filter(([kind]) => !(MAP_FILE_DOOR_KINDS as readonly string[]).includes(kind))
    : PLACE_ROWS;

/** Everything SELECT and REMOVE work on in this place, named as the Paint pane names it. */
const placedThings = (inside: MapFileArea | undefined): string =>
  [...placesFor(inside).map(([, label]) => label.toLowerCase()), inside ? 'piece of furniture' : 'building']
    .join(', ')
    .replace(/, ([^,]+)$/, ' or $1');

const TOOLS: readonly {
  readonly id: MakerTool;
  readonly label: string;
  readonly key: string;
  readonly help: (inside: MapFileArea | undefined) => string;
}[] = [
  {
    id: 'brush',
    label: 'Brush',
    key: 'B',
    // An inside is the size its own fields say: only the outdoors grows.
    help: (inside) =>
      `Paints the ground under the pointer. Drag to paint a stroke.${inside ? '' : ' Paint past the edge of the map to make it bigger.'}`,
  },
  {
    id: 'rect',
    label: 'Box',
    key: 'R',
    help: (inside) =>
      `Drag out a box and fill it with the ground you have chosen.${inside ? '' : ' A box past the edge makes the map bigger.'}`,
  },
  {
    id: 'fill',
    label: 'Fill',
    key: 'F',
    help: () => 'Fills every joined tile of the same ground with the ground you have chosen.',
  },
  {
    id: 'pick',
    label: 'Pick',
    key: 'I',
    help: () => 'Takes the ground under the pointer as your brush.',
  },
  {
    id: 'select',
    label: 'Select',
    key: 'V',
    help: (inside) => `Chooses a ${placedThings(inside)}. Drag it to move it.`,
  },
  {
    id: 'erase',
    label: 'Remove',
    key: 'X',
    help: (inside) => `Takes a ${placedThings(inside)} off the map.`,
  },
];

const placeKey = (place: PlaceChoice): string =>
  place.kind === 'building' ? `building:${place.building}` : place.kind;

/** A row button in a tool list. */
function toolRow(
  attributes: string,
  label: string,
  help: string,
  chosen: boolean,
  lead = '',
): string {
  return `<button class="px-row maker-choice${lead ? ' has-icon' : ''}${chosen ? ' is-selected' : ''}" ${attributes} aria-pressed="${chosen}" data-help="${escapeAttribute(help)}">${lead}<span class="px-row-main">${label}</span></button>`;
}

function toolsPane(state: MakerViewState, inside: MapFileArea | undefined): string {
  // The tools are a strip of buttons above the lists rather than rows in them:
  // six of them are picked far more often than any one brush, so they never
  // scroll away.
  const tools = TOOLS.map(
    (tool) =>
      `<button class="px-window px-chip maker-tool${state.tool === tool.id ? ' is-selected' : ''}" data-tool="${tool.id}" aria-pressed="${state.tool === tool.id}" data-help="${escapeAttribute(`${tool.help(inside)} Key: ${tool.key}.`)}">${tool.label}</button>`,
  ).join('');
  const brushes = brushesFor(inside?.kind).map((brush) =>
    toolRow(
      `data-brush="${brush.id}"`,
      brush.label,
      brush.help,
      state.brushId === brush.id && ['brush', 'rect', 'fill'].includes(state.tool),
      `<canvas class="maker-swatch" data-swatch="${escapeAttribute(brush.swatch)}"${inside ? ` data-swatch-style="${inside.style}"` : ''} width="16" height="16" aria-hidden="true"></canvas>`,
    ),
  ).join('');
  const chosenPlace = state.tool === 'place' ? placeKey(state.place) : '';
  const places = [...placesFor(inside), ...(inside?.kind === 'cave' ? CAVE_PLACE_ROWS : [])]
    .map(([kind, label, help]) => toolRow(`data-place="${kind}"`, label, help, chosenPlace === kind))
    .join('');
  // Everything a maker can plant, under its heading, each row with a picture of
  // the thing itself drawn whole (`drawPlantSwatch`), because eighty names are
  // not a palette. Indoors what is planted is the room's furniture: the same
  // tool, planted the same way, from the pieces a FireRed room is furnished with.
  const plantRow = (choice: { readonly kind: MapFileBuildingKind; readonly label: string }): string =>
    toolRow(
      `data-place="building" data-building="${choice.kind}"`,
      choice.label,
      `Plants a ${choice.label.toLowerCase()} with its top-left corner on the tile you click.`,
      chosenPlace === `building:${choice.kind}`,
      `<canvas class="maker-swatch" data-plant="${choice.kind}"${inside ? ` data-swatch-style="${inside.style}"` : ''} width="16" height="16" aria-hidden="true"></canvas>`,
    );
  const plants = inside
    ? `<p class="px-subheading">Furniture</p>${furnitureFor(inside.style).map(plantRow).join('')}`
    : PLANT_GROUPS.map(
        (group) =>
          `<p class="px-subheading">${group}</p>${BUILDING_CHOICES.filter((choice) => choice.group === group)
            .map(plantRow)
            .join('')}`,
      ).join('');
  return pixelWindow(
    `<div class="maker-toolbar">${tools}</div><div class="px-scroll maker-pane"><div class="px-list"><p class="px-subheading">${inside ? BRUSH_HEADINGS[inside.kind] : 'Ground'}</p>${brushes}<p class="px-subheading">Places</p>${places}${plants}</div></div>`,
    { className: 'maker-tools', heading: 'Paint' },
  );
}

/**
 * Where the map is drawn in its window: the map itself, and round it the room
 * it may still grow into, which a tool that grows the map draws on. Both as
 * inline styles, in game pixels, so the scene can lay a map out again as a
 * stroke grows it without drawing the screen again.
 */
export function stackLayout(
  file: MapFile,
  zoom: MakerZoom,
  grows = true,
): { stack: string; map: string } {
  // An inside is a room of a size its own fields set, and does not grow.
  const room = grows ? growthRoom(file) : { left: 0, top: 0, right: 0, bottom: 0 };
  const at = (tiles: number): string => `calc(var(--u) * ${tiles * zoom})`;
  return {
    // The room is ruled every tile, or every few tiles where a tile is drawn
    // smaller than eight game pixels, so the rule never becomes a fill.
    stack: `width:${at(file.width + room.left + room.right)};height:${at(file.height + room.top + room.bottom)};--grid:${at(Math.max(1, 8 / zoom))}`,
    map: `left:${at(room.left)};top:${at(room.top)};width:${at(file.width)};height:${at(file.height)}`,
  };
}

/**
 * While an entrance waits for where it comes out: what to click for that, and
 * the way to give up on it.
 */
function passageBanner(state: MakerViewState): string {
  const passage = state.passage;
  if (!passage) {
    return '';
  }
  const outside = passage.to === 'mouth' || passage.to === 'path-hut';
  return `<div class="maker-passage"><p class="px-wrap"><span class="px-name">Where does it come ${passage.to === 'path-hut' ? 'up' : 'out'}?</span> Click ${escapeHtml(PASSAGE_TARGETS[passage.to])}${outside ? '' : ', choosing it above first'}.</p><button class="px-window px-button" data-cancel-passage data-help="Puts the entrance away again. Key: Esc.">Cancel</button></div>`;
}

/**
 * The places of the map, one button each: the outdoors and every inside. Only
 * drawn once there is somewhere to go - a map with no insides is one place,
 * and a strip with one button on it would say nothing.
 */
function areaStrip(file: MapFile, area: AreaId): string {
  const areas = file.areas ?? [];
  if (areas.length === 0) {
    return '';
  }
  const chip = (id: AreaId, label: string, help: string): string =>
    `<button class="px-window px-chip maker-area${id === area ? ' is-selected' : ''}" data-area="${escapeAttribute(id ?? '')}" aria-pressed="${id === area}" data-help="${escapeAttribute(help)}">${escapeHtml(label)}</button>`;
  return `<div class="maker-areas">${chip(undefined, 'Outside', 'The map itself: the ground, the buildings and everything outdoors.')}${areas
    .map((candidate) =>
      chip(
        candidate.id,
        candidate.name,
        `${AREA_KIND_NAMES[candidate.kind]}: ${candidate.name}. ${candidate.width}x${candidate.height} tiles.`,
      ),
    )
    .join('')}</div>`;
}

function mapPane(state: MakerViewState, view: MapFile, inside: MapFileArea | undefined): string {
  const { zoom } = state;
  const file = view;
  const layout = stackLayout(file, zoom, inside === undefined);
  const zoomButtons = MAKER_ZOOMS.map(
    (level) =>
      `<button class="px-window px-button maker-zoom${level === zoom ? ' is-primary' : ''}" data-zoom="${level}" aria-pressed="${level === zoom}" data-help="Draws a tile ${level} pixels wide. Ctrl and the mouse wheel zoom about the pointer.">${level === 16 ? '1x' : level < 16 ? `1/${16 / level}` : `${level / 16}x`}</button>`,
  ).join('');
  const overviewToggle = `<button class="px-window px-button maker-zoom${state.overview ? ' is-primary' : ''}" data-overview-toggle aria-pressed="${state.overview}" data-help="Shows or hides the whole map in the corner of the window, while the map is bigger than the window. Press it to look there.">Overview</button>`;
  const fit = `<button class="px-window px-button maker-zoom" data-fit data-help="Zooms out as far as it takes to see the whole map, or as much of it as the window holds, and puts it in the middle.">Fit</button>`;
  // The overview stands in the window's corner, over the map, and is only
  // shown while the map does not fit the window (`MapMakerScene.showOverview`).
  const overview = `<div class="px-window maker-overview" data-overview hidden><canvas class="maker-overview-map" data-overview-map></canvas><div class="maker-overview-view" data-overview-view></div></div>`;
  return pixelWindow(
    `${passageBanner(state)}${areaStrip(state.file, state.area)}<div class="maker-zooms">${zoomButtons}${fit}${overviewToggle}</div><div class="maker-view-area"><div class="maker-viewport" data-viewport data-help="Drag with the middle button, or hold Space and drag, to move the map. Ctrl and the wheel zoom."><div class="maker-stack" data-stack style="${layout.stack}"><canvas class="maker-canvas" data-map style="${layout.map}"></canvas><div class="maker-ghost" data-ghost hidden></div></div></div>${overview}</div>`,
    {
      className: 'maker-map',
      heading: escapeHtml(inside ? inside.name : file.name || 'Untitled map'),
      note: `${inside ? `${AREA_KIND_NAMES[inside.kind].toLowerCase()} · ` : ''}${file.width}x${file.height}`,
    },
  );
}

function checksPane(checks: readonly MakerCheck[]): string {
  const passed = checks.filter((check) => check.passed).length;
  // A finished map's list is one line: every check has passed, and the room
  // is needed by whatever the column is opened to next - sending it in.
  if (passed === checks.length) {
    return pixelWindow(
      `<ul class="maker-checks-list"><li class="maker-check is-passed" data-check="all"><span class="maker-check-mark" aria-label="passed"></span><span class="px-row-main"><span class="px-wrap">Every check passes.</span></span></li></ul>`,
      { className: 'maker-checks', heading: 'Does it work', note: `${passed} of ${checks.length}` },
    );
  }
  const rows = checks
    .map((check) => {
      const problems = check.problems
        .slice(0, 3)
        .map((problem) => `<small class="px-wrap">${escapeHtml(problem)}</small>`)
        .join('');
      const more =
        check.problems.length > 3
          ? `<small class="px-note">and ${check.problems.length - 3} more</small>`
          : '';
      // A check with nothing to say about a map that does not load yet is
      // waiting on that, not failed on its own account.
      const state = check.passed
        ? 'is-passed'
        : check.problems.length > 0
          ? 'is-failed'
          : 'is-waiting';
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
function selectedPane(
  file: MapFile,
  selected: ThingRef | undefined,
  /** The whole file and the place of it `file` is a view of, when it is one. */
  whole?: MapFile,
  area?: AreaId,
): string {
  if (!selected) {
    return pixelWindow(
      `<p class="px-empty px-wrap">Choose anything on the map with Select to name it, change it or move it.</p>`,
      { className: 'maker-selected', heading: 'Chosen' },
    );
  }
  // Every field names what it changes in \`data-field\`, and the scene writes
  // it back through \`updateThing\` - one handler for every kind of thing.
  const text = (
    field: string,
    label: string,
    value: string,
    max: number,
    placeholder = '',
  ): string =>
    `<label class="maker-field"><span>${label}</span><input class="px-window px-field" data-field="${field}" value="${escapeAttribute(value)}" maxlength="${max}" spellcheck="false" autocomplete="off"${placeholder ? ` placeholder="${escapeAttribute(placeholder)}"` : ''} /></label>`;
  const lines = (label: string, value: readonly string[]): string =>
    `<label class="maker-field"><span>${label}</span><textarea class="px-window px-field maker-lines" data-field="lines" rows="${MAP_FILE_LIMITS.maxLines}" maxlength="${(MAP_FILE_LIMITS.maxLineLength + 1) * MAP_FILE_LIMITS.maxLines}" spellcheck="true" placeholder="One line per box of dialogue">${escapeHtml(value.join('\n'))}</textarea><span class="px-note">Up to ${MAP_FILE_LIMITS.maxLines} lines.</span></label>`;
  const choose = (
    field: string,
    label: string,
    value: string,
    options: readonly (readonly [string, string])[],
  ): string =>
    `<label class="maker-field"><span>${label}</span><select class="px-window px-field" data-field="${field}">${options
      .map(
        ([option, name]) =>
          `<option value="${escapeAttribute(option)}"${option === value ? ' selected' : ''}>${escapeHtml(name)}</option>`,
      )
      .join('')}</select></label>`;
  const looks = MAP_FILE_LOOKS.map((look) => [look, LOOK_LABELS[look]] as const);
  const facings = MAP_FILE_FACINGS.map((facing) => [facing, FACING_LABELS[facing]] as const);
  const name = (value: string): string =>
    text('name', 'Name', value, MAP_FILE_LIMITS.maxPlaceNameLength);

  let body: string;
  let heading: string;
  switch (selected.kind) {
    case 'drop-in': {
      const spot = file.dropIns[selected.index];
      heading = selected.index === 0 ? 'Front door' : 'Drop-in';
      body = `${name(spot.name)}${text('description', 'Says', spot.description ?? '', MAP_FILE_LIMITS.maxDescriptionLength, 'What the drop-in screen says about it')}`;
      break;
    }
    case 'exit': {
      const spot = file.exits[selected.index];
      heading = 'Exit';
      const seconds = spot.opens.when === 'after' ? spot.opens.seconds : 0;
      const buried: (readonly [string, string])[] = [
        ['', 'In the open'],
        ['dug', 'Under rubble'],
      ];
      const lies = choose('buried', 'Lies', spot.opens.when === 'dug' ? 'dug' : '', buried);
      body =
        spot.opens.when === 'dug'
          ? `${name(spot.name)}${lies}<p class="px-note px-wrap">A wall of rubble until somebody faces it with a Pickaxe in the pack, then a way out for that raid. Every drop-in still needs a way out without one.</p>`
          : `${name(spot.name)}${lies}<label class="maker-field"><span>Opens after</span><input class="px-window px-field" data-field="opens" type="number" min="0" max="${MAP_FILE_LIMITS.maxExitDelaySeconds}" step="5" value="${seconds}" /><span class="px-note">seconds, 0 is open from the start</span></label>`;
      break;
    }
    case 'item': {
      const spot = file.itemSpots[selected.index];
      heading = 'Item spot';
      const shows: (readonly [string, string])[] = [
        ['', 'In the open'],
        ['hidden', 'Hidden: found by walking onto it'],
      ];
      body = `${choose('hidden', 'Lies', spot.hidden ? 'hidden' : '', shows)}<p class="px-note px-wrap">Something to find. The game decides what, from what the game's own maps hold.</p>`;
      break;
    }
    case 'person': {
      const person = (file.people ?? [])[selected.index];
      heading = 'Person';
      body = `${name(person.name)}${choose('look', 'Looks like', person.look, looks)}${choose('facing', 'Faces', person.facing, facings)}${lines('Says', person.lines)}<p class="px-note px-wrap">Nobody can walk through a person, so leave the lanes clear.</p>`;
      break;
    }
    case 'pokemon': {
      const standing = (file.pokemon ?? [])[selected.index];
      heading = 'Pokémon';
      const species = POKEMON_ICON_ORDER.map((id) => [id, pokemonName(id)] as const);
      body = `${choose('species', 'Which', standing.species, species)}<label class="maker-field"><span>Fights</span><input class="px-window px-field" data-field="level" type="number" min="0" max="${MAP_FILE_LIMITS.maxPokemonLevel}" value="${standing.level ?? 0}" /><span class="px-note">at this level when spoken to, once a raid; 0 only says its name</span></label><p class="px-note px-wrap">It stands there, solid as a person, and says ${escapeHtml(pokemonCry(standing.species))} when spoken to.</p>`;
      break;
    }
    case 'berry-tree': {
      const tree = (file.berryTrees ?? [])[selected.index];
      heading = 'Berry tree';
      const berries = BERRY_IDS.map((berry) => [berry, berryName(berry)] as const);
      body = `${choose('berry', 'Grows', tree.berry, berries)}<p class="px-note px-wrap">${escapeHtml(ITEMS[berryItemId(tree.berry)].description)} Solid as a person; facing it and pressing the interact key picks one berry, once a raid.</p>`;
      break;
    }
    case 'boulder': {
      heading = 'Boulder';
      body = `<p class="px-note px-wrap">A wall until a Pokémon that knows Strength (HM04) pushes it, a tile at a time. It stands back where you put it at the start of every raid, and it will never be pushed onto an exit, an item or a drop-in, or across the only way out.</p>`;
      break;
    }
    case 'sign': {
      const sign = (file.signs ?? [])[selected.index];
      heading = 'Sign';
      body = `${lines('Reads', sign.lines)}`;
      break;
    }
    case 'landmark': {
      const landmark = (file.landmarks ?? [])[selected.index];
      heading = 'Landmark';
      const kinds = (Object.keys(MAP_FILE_LANDMARKS) as MapFileLandmarkKind[]).map(
        (kind) => [kind, MAP_FILE_LANDMARKS[kind].label] as const,
      );
      body = `${name(landmark.name)}${choose('kind', 'What it is', landmark.kind, kinds)}<p class="px-note px-wrap">${escapeHtml(MAP_FILE_LANDMARKS[landmark.kind].says)} Worked once a raid by walking onto it.</p>`;
      break;
    }
    case 'trainer': {
      const trainer = (file.trainers ?? [])[selected.index];
      heading = 'Trainer';
      const teams = (Object.keys(MAP_FILE_TRAINER_TEAMS) as MapFileTrainerTeam[]).map(
        (team) => [team, teamLine(team)] as const,
      );
      body = `${name(trainer.name)}${choose('team', 'Team', trainer.team, teams)}${choose('look', 'Looks like', trainer.look, looks)}${choose('facing', 'Faces', trainer.facing, facings)}<label class="maker-field"><span>Watches</span><input class="px-window px-field" data-field="sight" type="number" min="0" max="${MAP_FILE_LIMITS.maxSight}" value="${trainer.sight}" /><span class="px-note">tiles ahead; 0 waits to be spoken to</span></label>${lines('Says', trainer.lines)}`;
      break;
    }
    case 'district': {
      const district = (file.districts ?? [])[selected.index];
      heading = 'District';
      const habitats: (readonly [string, string])[] = [
        ['', 'Same as the map'],
        ...(Object.keys(MAP_FILE_HABITATS) as MapFileHabitat[]).map(
          (habitat) => [habitat, HABITAT_LABELS[habitat]] as const,
        ),
      ];
      const weathers: (readonly [string, string])[] = [
        ['', 'Dry'],
        ['rain', 'Rain'],
      ];
      body = `${name(district.name)}${choose('wildlife', 'Wild Pokémon', district.wildlife ?? '', habitats)}${choose('rain', 'Weather', district.rain ? 'rain' : '', weathers)}<p class="px-note px-wrap">${district.width}x${district.height} tiles. Its name comes up as a player walks in. Rain makes Water moves stronger and Fire moves weaker in every fight there.</p>`;
      break;
    }
    case 'door': {
      const door = (file.doors ?? [])[selected.index];
      heading = { 'cut-tree': 'Cut tree', 'smash-rock': 'Rock Smash rock', surf: 'Surf water' }[
        door.kind
      ];
      body = `<p class="px-note px-wrap">${
        door.kind === 'surf'
          ? `${door.width}x${door.height} tiles of deep water, crossed by a Pokémon that knows Surf.`
          : door.kind === 'cut-tree'
            ? 'Shut until a Pokémon that knows Cut clears it.'
            : 'Shut until a Pokémon that knows Rock Smash breaks it.'
      } A raid must still be able to get out without it. Drag it with Select to move it.</p>`;
      break;
    }
    case 'building': {
      const building = file.buildings[selected.index];
      heading =
        [...BUILDING_CHOICES, ...FURNITURE_CHOICES].find((choice) => choice.kind === building.kind)
          ?.label ?? 'Building';
      const room = whole && !area ? insideOf(whole, building) : undefined;
      const goIn = (label: string, help: string): string =>
        `<div class="maker-actions"><button class="px-window px-button is-primary" data-go-inside="${selected.index}" data-help="${escapeAttribute(help)}">${label}</button></div>`;
      const door = !whole || area || !hasDoor(building)
        ? ''
        : building.kind === 'underground-path'
          ? pathHutPane(whole, selected.index, room)
          : building.kind === 'cave-mouth'
          ? room
            ? `<p class="px-note px-wrap">It leads into ${escapeHtml(room.name)}.</p>${goIn('Go in', 'Opens the cave, to draw and fill.')}`
            : `<p class="px-note px-wrap">It leads nowhere yet. Cut it into the foot of a rock face, give it a cave, and walking up to it takes a player in.</p>${goIn('Make its cave', 'Makes a cave behind it, ringed in rock the way Mt. Moon is, with its way out cut into the south wall, and opens it.')}${
                (whole.areas ?? []).some((candidate) => candidate.kind === 'cave')
                  ? `<div class="maker-actions"><button class="px-window px-button" data-lead-into="${selected.index}" data-help="Makes it a second way into a cave you have: choose the cave, then click its south wall where the daylight goes.">Into a cave you have</button></div>`
                  : ''
              }`
          : buildingDoorways(building).length > 1
            ? room
              ? `<p class="px-note px-wrap">It is walked through: its doors lead into ${escapeHtml(room.name)}, in at one side and out at the other.</p>${goIn('Go inside', 'Opens the inside of it, to furnish and fill.')}`
              : `<p class="px-note px-wrap">Its doors are shut. Give it an inside and a player walks through it, in at one side and out at the other, as FireRed's gatehouses are.</p>${goIn('Make its inside', 'Makes the inside of it, the gatehouse FireRed has, with a way out on each side, and opens both doors.')}`
            : room
              ? `<p class="px-note px-wrap">Its door leads into ${escapeHtml(room.name)}.</p>${goIn('Go inside', 'Opens the inside of it, to furnish and fill.')}`
              : `<p class="px-note px-wrap">Its door is shut. Give it an inside and walking up to the door takes a player in.</p>${goIn('Make its inside', 'Makes the inside of it, furnished as FireRed furnishes one, and opens it.')}`;
      body = `<p class="px-note px-wrap">Drag it with Select to move it.</p>${door}`;
      break;
    }
  }
  const remove = `<button class="px-window px-button" data-remove-selected data-help="Takes it off the map.">Remove</button>`;
  return pixelWindow(
    `<div class="maker-form">${body}<div class="maker-actions">${remove}</div></div>`,
    {
      className: 'maker-selected',
      heading,
    },
  );
}

/** What a place's ground is headed in the list of brushes. */
const BRUSH_HEADINGS: Readonly<Record<MapFileArea['kind'], string>> = {
  inside: 'Room',
  cave: 'Cave',
  tunnel: 'Tunnel',
};

/** What each kind of place is called in the editor. */
const AREA_KIND_NAMES: Readonly<Record<MapFileArea['kind'], string>> = {
  inside: 'Inside',
  cave: 'Cave',
  tunnel: 'Tunnel',
};

/** How a building's door is gone in by, from the way it is pressed. */
const GOING_IN: Readonly<Record<MapFileLinkEnd['toward'], string>> = {
  up: 'walking up to the door',
  down: 'walking down off the ridge of its roof',
  left: 'walking into its porch from the east',
  right: 'walking into its porch from the west',
};

/**
 * An Underground Path hut, chosen: where its path comes up, or the two clicks
 * that make it - this hut, then the hut it comes up in.
 */
function pathHutPane(file: MapFile, index: number, room: MapFileArea | undefined): string {
  const stairs = room ? stairwellIn(file, room.id) : undefined;
  const tunnel = stairs ? file.links?.[stairs.link]?.ends[1 - stairs.end].area : undefined;
  const other = tunnel
    ? doorwaysIn(file, tunnel)
        .map((end) => file.links?.[end.link]?.ends[1 - end.end].area)
        .find((area) => area !== undefined && area !== room?.id)
    : undefined;
  const goIn = `<div class="maker-actions"><button class="px-window px-button" data-go-inside="${index}" data-help="Opens the inside of it, to furnish and fill.">Go inside</button></div>`;
  if (room && stairs) {
    const comesUp = other ? areaById(file, other)?.name : undefined;
    return `<p class="px-note px-wrap">Its stairs go down to the Underground Path${comesUp ? `, which comes up in ${escapeHtml(comesUp)}` : ''}.</p>${goIn}`;
  }
  const others = file.buildings.some(
    (candidate, at) => at !== index && candidate.kind === 'underground-path',
  );
  const make = `<div class="maker-actions"><button class="px-window px-button is-primary" data-lead-path="${index}" data-help="Makes the Underground Path from this hut: then click the hut it comes up in. Each hut gets its entrance, and the tunnel between them is FireRed's own.">Make the Underground Path</button></div>`;
  return `<p class="px-note px-wrap">${
    others
      ? 'The Underground Path goes down from here. Make it, then click the hut it comes up in.'
      : 'The Underground Path goes down from here and comes up in another of these huts: put a second one down, then make the path.'
  }</p>${others ? make : ''}${room ? goIn : ''}`;
}

/** A way through chosen on the map: where it goes, and how to move it. */
function doorwayPane(file: MapFile, doorway: DoorwayInArea): string {
  const far = file.links?.[doorway.link]?.ends[1 - doorway.end];
  const leadsTo = far?.area === undefined ? 'outside' : (areaById(file, far.area)?.name ?? 'nowhere');
  const look = doorway.at.look;
  const to = escapeHtml(leadsTo === 'outside' ? 'back outside' : `to ${leadsTo}`);
  const [heading, body] = ((): [string, string] => {
    switch (look) {
      case 'mat':
        return [
          'Way out',
          `<p class="px-wrap">The way out. Standing on the mat and pressing ${doorway.at.toward} takes a player ${to}, and coming in they arrive on it.</p><p class="px-note px-wrap">${
            doorway.at.toward === 'down'
              ? 'Drag it along the wall with Select to move it.'
              : 'It is let into the side wall. Drag it up and down the wall with Select to move it.'
          }</p>`,
        ];
      case 'stairwell':
        return [
          'Stairs down',
          `<p class="px-wrap">The stairs down into the Underground Path. A player stands beside them and presses left to go down, and coming up they arrive beside them.</p>`,
        ];
      case 'tunnel-stairs':
        return [
          'Stairs up',
          `<p class="px-wrap">The stairs up ${to}. A player stands beside them and presses ${doorway.at.toward} to go up, and coming down they arrive beside them.</p>`,
        ];
      case 'back-door':
        return [
          'Back door',
          `<p class="px-wrap">The doorway in the back wall. Walking up into it takes a player ${to}, and coming in they arrive in front of it.</p><p class="px-note px-wrap">Drag it along the back wall with Select to move it.</p>`,
        ];
      case 'stairs-up':
      case 'stairs-down':
        return [
          'Stairs',
          `<p class="px-wrap">The stairs ${look === 'stairs-up' ? 'up' : 'down'} to ${escapeHtml(leadsTo)}. A player walks up to the foot of them and presses up.</p><p class="px-note px-wrap">Drag them along the back wall with Select to move them.</p>`,
        ];
      case 'cave-exit':
        return [
          'Way out',
          `<p class="px-wrap">The way out of the cave: daylight in its south wall. Walking down into it takes a player ${to}, and coming in they arrive in front of it.</p><p class="px-note px-wrap">Drag it along the south wall with Select to move it.</p>`,
        ];
      case 'ladder-up':
        return [
          'Ladder up',
          `<p class="px-wrap">The ladder up ${to}. A player stands at its foot and presses up.</p><p class="px-note px-wrap">Drag it with Select to move it.</p>`,
        ];
      case 'ladder-down':
        return [
          'Ladder down',
          `<p class="px-wrap">The ladder down ${to}. A player walks up to the hole and presses into it.</p><p class="px-note px-wrap">Drag it with Select to move it.</p>`,
        ];
      default: {
        const mouth = file.buildings.some(
          (building) =>
            building.kind === 'cave-mouth' &&
            doorFront(building)?.x === doorway.at.x &&
            doorFront(building)?.y === doorway.at.y,
        );
        return mouth
          ? [
              'Cave mouth',
              `<p class="px-wrap">The mouth of ${escapeHtml(leadsTo)}. A player goes in by walking up into it.</p>`,
            ]
          : [
              'Door',
              `<p class="px-wrap">The door into ${escapeHtml(leadsTo)}. A player goes in by ${GOING_IN[doorway.at.toward]}.</p>`,
            ];
      }
    }
  })();
  // Where it leads is a place of its own: one press goes there, with the
  // other end chosen.
  const go = far
    ? `<div class="maker-actions"><button class="px-window px-button" data-go-end data-help="Goes to where it comes out, with that end chosen.">Go to the other end</button></div>`
    : '';
  return pixelWindow(`<div class="maker-form">${body}${go}</div>`, {
    className: 'maker-selected',
    heading,
  });
}

/** A house can have a floor above it, with stairs up to it; once it has, the button goes there. */
function upstairsButton(file: MapFile, area: MapFileArea): string {
  if (area.style !== 'house') {
    return '';
  }
  const stairs = stairsUpIn(file, area.id);
  const above = stairs
    ? areaById(file, file.links?.[stairs.link]?.ends[1 - stairs.end].area)
    : undefined;
  return above
    ? `<div class="maker-actions"><button class="px-window px-button" data-area="${escapeAttribute(above.id)}" data-help="Goes up the stairs to ${escapeAttribute(above.name)}.">Go upstairs</button></div>`
    : `<div class="maker-actions"><button class="px-window px-button" data-add-upstairs="${escapeAttribute(area.id)}" data-help="Builds a floor above this one, furnished as a bedroom, with stairs up to it against the back wall.">Add an upstairs</button></div>`;
}

/** A cave can have a floor below it, with a ladder down to it; once it has, the button goes there. */
function belowButton(file: MapFile, area: MapFileArea): string {
  if (area.kind !== 'cave') {
    return '';
  }
  const ladder = ladderDownIn(file, area.id);
  const below = ladder
    ? areaById(file, file.links?.[ladder.link]?.ends[1 - ladder.end].area)
    : undefined;
  return below
    ? `<div class="maker-actions"><button class="px-window px-button" data-area="${escapeAttribute(below.id)}" data-help="Goes down the ladder to ${escapeAttribute(below.name)}.">Go down</button></div>`
    : `<div class="maker-actions"><button class="px-window px-button" data-add-below="${escapeAttribute(area.id)}" data-help="Digs a floor below this one, as Mt. Moon's basement is, with a ladder down to it.">Add a floor below</button></div>`;
}

/** The inside on screen: its name, its look and its size, and the way back out. */
function insidePane(file: MapFile, area: MapFileArea): string {
  const cave = area.kind === 'cave';
  const kinds = MAP_FILE_STYLES_OF[area.kind];
  const styles = kinds
    .map(
      (style) =>
        `<option value="${style}"${style === area.style ? ' selected' : ''}>${STYLE_LABELS[style]}</option>`,
    )
    .join('');
  // A choice of one is not a choice: a cave has one look, and says nothing.
  const looks =
    kinds.length > 1
      ? `<label class="maker-field"><span>Looks like</span><select class="px-window px-field" data-area-style>${styles}</select></label>`
      : '';
  const limits = areaLimits(area.kind);
  const tunnel = area.kind === 'tunnel';
  const removeHelp = cave
    ? 'Takes this cave away, and everything in it. The cave mouth outside leads nowhere again. Press twice.'
    : tunnel
      ? 'Takes the tunnel away, and everything in it. The stairs down in each hut go nowhere again. Press twice.'
      : 'Takes this inside away, and everything in it. The door outside shuts again. Press twice.';
  // A tunnel is the length FireRed made the Underground Path, so it has no
  // size to choose.
  const size = tunnel
    ? `<p class="px-note px-wrap">The Underground Path, as FireRed lays it: ${area.width} wide and ${area.height} long, with its stairs up at either end.</p>`
    : `<div class="maker-size"><label class="maker-field"><span>Width</span><input class="px-window px-field" data-area-width type="number" min="${limits.minWidth}" max="${limits.maxWidth}" value="${area.width}" /></label><label class="maker-field"><span>Height</span><input class="px-window px-field" data-area-height type="number" min="${limits.minHeight}" max="${limits.maxHeight}" value="${area.height}" /></label></div>`;
  return pixelWindow(
    `<div class="maker-form"><label class="maker-field"><span>Name</span><input class="px-window px-field" data-area-name value="${escapeAttribute(area.name)}" maxlength="${MAP_FILE_LIMITS.maxPlaceNameLength}" spellcheck="false" autocomplete="off" /></label>${looks}${size}${upstairsButton(file, area)}${belowButton(file, area)}<div class="maker-actions"><button class="px-window px-button" data-area="" data-help="Back to the map outdoors.">Back outside</button><button class="px-window px-button" data-remove-area="${escapeAttribute(area.id)}" data-help="${escapeAttribute(removeHelp)}">Remove</button></div></div>`,
    { className: 'maker-settings', heading: cave ? 'This cave' : tunnel ? 'This tunnel' : 'This inside' },
  );
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

function draftsPane(drafts: readonly StoredDraft[], current: string, unreadable = 0): string {
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
  const kept =
    unreadable > 0
      ? `<p class="px-empty px-wrap">${unreadable === 1 ? 'One draft here cannot be opened. It is kept, not deleted.' : `${unreadable} drafts here cannot be opened. They are kept, not deleted.`}</p>`
      : '';
  return pixelWindow(
    `<div class="px-scroll maker-pane"><div class="px-list">${rows || (kept ? '' : '<p class="px-empty">No drafts yet.</p>')}${kept}</div></div><div class="maker-actions maker-pad"><button class="px-window px-button" data-panel="sent" data-help="What became of the maps you sent in from this browser.">Sent in</button><button class="px-window px-button" data-panel="review" data-help="For the game's owner: the maps players have sent in.">Review maps</button></div>`,
    {
      className: 'maker-drafts',
      heading: 'Your drafts',
      note: 'kept in this browser',
    },
  );
}

/**
 * Sending the map in. Who reads it is said plainly and once: every map sent is
 * played before it can join the game, and nothing about the maker but the name
 * they typed travels with it.
 */
function sendPane(file: MapFile, sending: SendState): string {
  const button = (attribute: string, label: string, primary = false): string =>
    `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${attribute}>${label}</button>`;
  const back = button('data-panel="map"', 'Back to map');
  let body: string;
  switch (sending.step) {
    case 'checking':
      body = `<p class="px-note">Looking up this map…</p>`;
      break;
    case 'ready': {
      const previous = sending.previous;
      if (previous?.status === 'waiting') {
        body = `<p class="px-wrap">This map is already in, waiting to be played. Its receipt is <strong>${previous.receipt}</strong>.</p><div class="maker-actions">${back}</div>`;
        break;
      }
      const again = previous?.status === 'sent_back';
      body = `<p class="px-wrap">${
        again
          ? `This map was sent back with notes (receipt <strong>${previous.receipt}</strong>). Send this version as its next try.`
          : 'Every map sent in is played before it can join the game. An approved map goes into the game with your maker name on it.'
      }</p><p class="px-note px-wrap">Sent as <strong>${escapeHtml(file.name)}</strong> by <strong>${escapeHtml(file.maker)}</strong>. Nothing else about you is sent.</p>${
        sending.needsCheck ? `<div class="maker-captcha" data-captcha></div>` : ''
      }<div class="maker-actions">${back}${button('data-send-confirm', again ? 'Send again' : 'Send it in', true)}</div>`;
      break;
    }
    case 'sending':
      body = `<p class="px-note">Sending…</p>`;
      break;
    case 'sent':
      body = `<p class="px-wrap">Sent. Your receipt is <strong>${sending.receipt}</strong>.</p><p class="px-note px-wrap">Sent in, under Drafts, shows what becomes of it.</p><div class="maker-actions">${back}</div>`;
      break;
    case 'failed':
      body = `<p class="px-warning px-wrap">${escapeHtml(sending.reason)}</p><div class="maker-actions">${back}${button('data-send', 'Try again')}</div>`;
      break;
  }
  return pixelWindow(`<div class="maker-form">${body}</div>`, {
    className: 'maker-send',
    heading: 'Send it in',
  });
}

/** Every map this browser has sent, and what became of each. */
function sentPane(sent: SentState): string {
  let body: string;
  if (sent.step === 'loading') {
    body = `<p class="px-empty">Looking…</p>`;
  } else if (sent.step === 'failed') {
    body = `<p class="px-warning px-wrap">${escapeHtml(sent.reason)}</p>`;
  } else if (sent.maps.length === 0) {
    body = `<p class="px-empty px-wrap">Nothing sent from this browser yet.</p>`;
  } else {
    body = sent.maps
      .map(
        (map) =>
          `<div class="maker-sent"><span class="px-name">${escapeHtml(map.mapName)}</span><small class="px-note">${STATUS_WORDS[map.status]}${map.revision > 1 ? ` · try ${map.revision}` : ''} · ${map.receiptCode}</small>${
            map.note ? `<small class="px-wrap maker-note">${escapeHtml(map.note)}</small>` : ''
          }</div>`,
      )
      .join('');
  }
  return pixelWindow(
    `<div class="px-scroll maker-pane"><div class="px-list">${body}</div></div><div class="maker-actions maker-pad"><button class="px-window px-button" data-panel="drafts">Drafts</button><button class="px-window px-button" data-refresh-sent>Check again</button></div>`,
    { className: 'maker-drafts', heading: 'Sent in', note: 'from this browser' },
  );
}

/**
 * Reviewing: the decision on the map open in the editor, then everything sent
 * in. A map is opened into the editor to be played and, if it needs it, fixed:
 * approving takes the map as it then stands.
 */
function reviewPane(
  review: ReviewState,
  reviewing: QueuedMap | undefined,
  checks: readonly MakerCheck[],
): string {
  const button = (attribute: string, label: string, primary = false, help = ''): string =>
    `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${attribute}${help ? ` data-help="${escapeAttribute(help)}"` : ''}>${label}</button>`;
  const footer = (extra: string): string =>
    `<div class="maker-actions maker-pad">${button('data-panel="drafts"', 'Drafts')}${extra}</div>`;
  switch (review.step) {
    case 'checking':
      return pixelWindow(`<p class="px-empty">Checking…</p>`, {
        className: 'maker-drafts',
        heading: 'Review maps',
      });
    case 'signed-out':
      return pixelWindow(
        `<div class="maker-form"><p class="px-wrap">Maps sent in are reviewed here by the game's owner, who signs in with GitHub.</p>${
          review.reason ? `<p class="px-warning px-wrap">${escapeHtml(review.reason)}</p>` : ''
        }<div class="maker-actions">${button('data-panel="drafts"', 'Drafts')}${button('data-review-sign-in', 'Sign in with GitHub', true)}</div></div>`,
        { className: 'maker-drafts', heading: 'Review maps' },
      );
    case 'not-reviewer':
      return pixelWindow(
        `<div class="maker-form"><p class="px-wrap">This account does not review maps.</p><div class="maker-actions">${button('data-panel="drafts"', 'Drafts')}${button('data-review-sign-out', 'Sign out')}</div></div>`,
        { className: 'maker-drafts', heading: 'Review maps' },
      );
    case 'failed':
      return pixelWindow(
        `<p class="px-warning px-wrap maker-pad">${escapeHtml(review.reason)}</p>${footer(button('data-review-refresh', 'Try again'))}`,
        {
          className: 'maker-drafts',
          heading: 'Review maps',
        },
      );
    case 'loaded':
      break;
  }
  const passed = checks.filter((check) => check.id !== 'walked' && check.passed).length;
  const total = checks.filter((check) => check.id !== 'walked').length;
  const decision = reviewing
    ? pixelWindow(
        `<div class="maker-form"><p class="px-wrap"><strong>${escapeHtml(reviewing.mapName)}</strong> by <strong>${escapeHtml(reviewing.makerName)}</strong>${
          reviewing.revision > 1 ? `, try ${reviewing.revision}` : ''
        }. ${STATUS_WORDS[reviewing.status]}. Receipt ${reviewing.receiptCode}.</p><p class="px-note px-wrap">${passed} of ${total} checks pass. Play it with WALK IT or RAID IT; fix anything here before approving and the fixed map is what is approved.</p>${
          review.reason ? `<p class="px-warning px-wrap">${escapeHtml(review.reason)}</p>` : ''
        }<label class="maker-field"><span>Note to the maker</span><textarea class="px-window px-field maker-lines" data-review-note rows="3" maxlength="2000" placeholder="Needed to send back or turn down">${escapeHtml(reviewing.note ?? '')}</textarea></label><div class="maker-actions">${button(
          'data-decide="sent_back"',
          'Send back',
          false,
          'Returns it to its maker with your note, to fix and send again.',
        )}${button('data-decide="rejected"', 'Turn down', false, 'Refuses it for good, with your note as the reason.')}${button(
          'data-decide="approved"',
          'Approve',
          passed === total,
          passed === total
            ? 'Approves the map as it now stands; it is then added to the game.'
            : 'It must pass every check first.',
        )}</div><div class="maker-actions">${button('data-block-maker', 'Block this maker', false, 'Stops this maker sending any more maps. Press twice.')}</div></div>`,
        { className: 'maker-send', heading: 'Reviewing' },
      )
    : '';
  const rows = review.maps
    .map(
      (map) =>
        `<button class="px-row${reviewing?.id === map.id ? ' is-selected' : ''}" data-review-open="${escapeAttribute(map.id)}" data-help="Opens it in the editor to play and decide."${map.file ? '' : ' aria-disabled="true"'}><span class="px-row-main"><span class="px-name">${escapeHtml(map.mapName)}</span><small class="px-note">${escapeHtml(map.makerName)} · ${STATUS_WORDS[map.status]}${map.revision > 1 ? ` · try ${map.revision}` : ''}</small></span></button>`,
    )
    .join('');
  return `${decision}${pixelWindow(
    `<div class="px-scroll maker-pane"><div class="px-list">${rows || '<p class="px-empty">Nothing has been sent in.</p>'}</div></div>${footer(`${button('data-review-refresh', 'Check again')}${button('data-review-sign-out', 'Sign out')}`)}`,
    {
      className: 'maker-drafts',
      heading: 'Review maps',
      note: `${review.maps.filter((map) => map.status === 'waiting').length} waiting`,
    },
  )}`;
}

export function makerScreen(state: MakerViewState): string {
  const inside = areaById(state.file, state.area);
  const area = inside?.id;
  const view = focusArea(state.file, area);
  const doorway = state.doorway
    ? doorwaysIn(state.file, area).find(
        (candidate) => candidate.link === state.doorway?.link && candidate.end === state.doorway.end,
      )
    : undefined;
  const panels: Readonly<Record<MakerPanel, () => string>> = {
    map: () =>
      `${doorway ? doorwayPane(state.file, doorway) : selectedPane(view, state.selected, state.file, area)}${inside ? insidePane(state.file, inside) : settingsPane(state.file)}`,
    drafts: () => draftsPane(state.drafts, state.draftKey, state.unreadableDrafts),
    send: () => sendPane(state.file, state.sending),
    sent: () => sentPane(state.sent),
    review: () => reviewPane(state.review, state.reviewing, state.checks),
  };
  // The column scrolls as any pane does, so it says MORE when the chosen
  // thing's panel is below the checks rather than leaving its heading peeking
  // out under the bar (playtest 45).
  const side = `<div class="maker-side px-scroll">${checksPane(state.checks)}${panels[state.panel]()}</div>`;
  const button = (
    attribute: string,
    label: string,
    help: string,
    enabled = true,
    primary = false,
  ): string =>
    `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${attribute} data-help="${escapeAttribute(help)}"${enabled ? '' : ' aria-disabled="true"'}>${label}</button>`;
  // The map has to work before it can be tried: a raid on a map with no way
  // out is a raid that can only end on the clock.
  const works = state.checks
    .filter((check) => check.id !== 'walked')
    .every((check) => check.passed);
  const ready = state.checks.every((check) => check.passed);
  const tryHelp = (what: string): string =>
    works
      ? `${what} ${state.selected?.kind === 'drop-in' ? 'Starts at the chosen drop-in.' : 'Starts at the front door; choose a drop-in first to start there.'}`
      : 'Make the map pass the checks above first.';
  const actions = [
    button('data-undo', 'Undo', 'Takes back the last change. Ctrl+Z.', state.canUndo),
    button('data-redo', 'Redo', 'Puts it back again. Ctrl+Y.', state.canRedo),
    button('data-new', 'New', 'Starts a new map. This one stays in your drafts.'),
    button(
      `data-panel="${state.panel === 'drafts' ? 'map' : 'drafts'}"`,
      state.panel === 'drafts' ? 'Back to map' : 'Drafts',
      'Every map you have drawn in this browser, and what became of the ones you sent in.',
    ),
    button('data-open-file', 'Open file', 'Opens a map file you downloaded or were sent.'),
    button('data-download', 'Download', 'Saves this map as a file you can keep or share.'),
    button(
      'data-try="walk"',
      'Walk it',
      tryHelp('Walks your map in the real game: nobody faints, every exit is open, no clock.'),
      works,
    ),
    button(
      'data-try="raid"',
      'Raid it',
      tryHelp('Plays your map as a raid: the clock, the hunter, the wild Pokémon.'),
      works,
    ),
    button(
      'data-send',
      'Send in',
      ready
        ? 'Sends this map in to be played and, if it is approved, put in the game.'
        : 'Pass every check above first, walking out of it in TRY IT included.',
      ready,
      true,
    ),
  ].join('');
  return pixelScreen({
    place: 'Map maker',
    title: escapeHtml(state.file.name || 'Untitled map'),
    back: { label: 'TITLE', attribute: 'data-back' },
    aside: `<span>${state.checks.every((check) => check.passed) ? 'READY' : works ? 'WORKS · TRY IT' : 'NOT FINISHED'}</span>`,
    hints: 'CLICK the map to paint · CTRL+Z undo · ESC cancel',
    ...(state.status ? { status: escapeHtml(state.status) } : {}),
    body: `<main class="px-body maker-shell">${toolsPane(state, inside)}${mapPane(state, view, inside)}${side}${pixelCommitBar(
      {
        title: 'Your map',
        actions,
        lines: [`<input type="file" accept=".json,application/json" data-file-input hidden />`],
      },
    )}</main>`,
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { checksPane, selectedPane };
