import type { MapCheck } from '../world/mapFileChecks';
import { POKEMON_ICON_ORDER } from '../pokemon/generated/pokemonIcons';
import { pokemonCry, pokemonName } from '../world/pokemonFigures';
import {
  MAP_FILE_FACINGS,
  MAP_FILE_HABITATS,
  MAP_FILE_LANDMARKS,
  MAP_FILE_LIMITS,
  MAP_FILE_LOOKS,
  MAP_FILE_TRAINER_TEAMS,
  teamLine,
  type MapFile,
  type MapFileBuildingKind,
  type MapFileDoorKind,
  type MapFileHabitat,
  type MapFileLandmarkKind,
  type MapFileTrainerTeam,
} from '../world/mapFile';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { growthRoom, type SpotKind, type ThingRef } from './draft';
import type { StoredDraft } from './drafts';
import type { QueuedMap } from './review';
import { STATUS_WORDS, type SentMap, type SubmissionStatus } from './submissions';
import {
  BUILDING_CHOICES,
  PLANT_GROUPS,
  FACING_LABELS,
  GROUND_BRUSHES,
  HABITAT_LABELS,
  LOOK_LABELS,
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
  | { readonly kind: SpotKind | 'district' | MapFileDoorKind }
  | { readonly kind: 'building'; readonly building: MapFileBuildingKind };

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
    'surf',
    'Surf water',
    'Drag out deep water a Pokémon that knows Surf can cross. Crossed once, it stays open.',
  ],
] as const;

/** Everything SELECT and REMOVE work on, named as the Paint pane names it. */
const PLACED_THINGS = [...PLACE_ROWS.map(([, label]) => label.toLowerCase()), 'building']
  .join(', ')
  .replace(/, ([^,]+)$/, ' or $1');

const TOOLS: readonly {
  readonly id: MakerTool;
  readonly label: string;
  readonly key: string;
  readonly help: string;
}[] = [
  {
    id: 'brush',
    label: 'Brush',
    key: 'B',
    help: 'Paints the ground under the pointer. Drag to paint a stroke. Paint past the edge of the map to make it bigger.',
  },
  {
    id: 'rect',
    label: 'Box',
    key: 'R',
    help: 'Drag out a box and fill it with the ground you have chosen. A box past the edge makes the map bigger.',
  },
  {
    id: 'fill',
    label: 'Fill',
    key: 'F',
    help: 'Fills every joined tile of the same ground with the ground you have chosen.',
  },
  {
    id: 'pick',
    label: 'Pick',
    key: 'I',
    help: 'Takes the ground under the pointer as your brush.',
  },
  {
    id: 'select',
    label: 'Select',
    key: 'V',
    help: `Chooses a ${PLACED_THINGS}. Drag it to move it.`,
  },
  {
    id: 'erase',
    label: 'Remove',
    key: 'X',
    help: `Takes a ${PLACED_THINGS} off the map.`,
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
  const places = PLACE_ROWS.map(([kind, label, help]) =>
    toolRow(`data-place="${kind}"`, label, help, chosenPlace === kind),
  ).join('');
  // Everything a maker can plant, under its heading, each row with a picture of
  // the thing itself drawn whole (`drawPlantSwatch`), because eighty names are
  // not a palette.
  const plants = PLANT_GROUPS.map((group) => {
    const rows = BUILDING_CHOICES.filter((choice) => choice.group === group)
      .map((choice) =>
        toolRow(
          `data-place="building" data-building="${choice.kind}"`,
          choice.label,
          `Plants a ${choice.label.toLowerCase()} with its top-left corner on the tile you click.`,
          chosenPlace === `building:${choice.kind}`,
          `<canvas class="maker-swatch" data-plant="${choice.kind}" width="16" height="16" aria-hidden="true"></canvas>`,
        ),
      )
      .join('');
    return `<p class="px-subheading">${group}</p>${rows}`;
  }).join('');
  return pixelWindow(
    `<div class="maker-toolbar">${tools}</div><div class="px-scroll maker-pane"><div class="px-list"><p class="px-subheading">Ground</p>${brushes}<p class="px-subheading">Places</p>${places}${plants}</div></div>`,
    { className: 'maker-tools', heading: 'Paint' },
  );
}

/**
 * Where the map is drawn in its window: the map itself, and round it the room
 * it may still grow into, which a tool that grows the map draws on. Both as
 * inline styles, in game pixels, so the scene can lay a map out again as a
 * stroke grows it without drawing the screen again.
 */
export function stackLayout(file: MapFile, zoom: MakerZoom): { stack: string; map: string } {
  const room = growthRoom(file);
  const at = (tiles: number): string => `calc(var(--u) * ${tiles * zoom})`;
  return {
    // The room is ruled every tile, or every few tiles where a tile is drawn
    // smaller than eight game pixels, so the rule never becomes a fill.
    stack: `width:${at(file.width + room.left + room.right)};height:${at(file.height + room.top + room.bottom)};--grid:${at(Math.max(1, 8 / zoom))}`,
    map: `left:${at(room.left)};top:${at(room.top)};width:${at(file.width)};height:${at(file.height)}`,
  };
}

function mapPane(state: MakerViewState): string {
  const { file, zoom } = state;
  const layout = stackLayout(file, zoom);
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
    `<div class="maker-zooms">${zoomButtons}${fit}${overviewToggle}</div><div class="maker-view-area"><div class="maker-viewport" data-viewport data-help="Drag with the middle button, or hold Space and drag, to move the map. Ctrl and the wheel zoom."><div class="maker-stack" data-stack style="${layout.stack}"><canvas class="maker-canvas" data-map style="${layout.map}"></canvas><div class="maker-ghost" data-ghost hidden></div></div></div>${overview}</div>`,
    {
      className: 'maker-map',
      heading: escapeHtml(file.name || 'Untitled map'),
      note: `${file.width}x${file.height}`,
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
function selectedPane(file: MapFile, selected: ThingRef | undefined): string {
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
      body = `${name(spot.name)}<label class="maker-field"><span>Opens after</span><input class="px-window px-field" data-field="opens" type="number" min="0" max="${MAP_FILE_LIMITS.maxExitDelaySeconds}" step="5" value="${seconds}" /><span class="px-note">seconds, 0 is open from the start</span></label>`;
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
        BUILDING_CHOICES.find((choice) => choice.kind === building.kind)?.label ?? 'Building';
      body = `<p class="px-note px-wrap">Drag it with Select to move it.</p>`;
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
  const panels: Readonly<Record<MakerPanel, () => string>> = {
    map: () => `${selectedPane(state.file, state.selected)}${settingsPane(state.file)}`,
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
    body: `<main class="px-body maker-shell">${toolsPane(state)}${mapPane(state)}${side}${pixelCommitBar(
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
