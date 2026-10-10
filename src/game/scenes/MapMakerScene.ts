import Phaser from 'phaser';
import {
  blankMap,
  describeDropIn,
  fillRegion,
  groundAt,
  line,
  moveThing,
  paintWith,
  placeBuilding,
  placeDoor,
  placeSpot,
  setItemHidden,
  setPokemonLevel,
  rectangle,
  removeThing,
  renameMap,
  resizeMap,
  sizeFromField,
  updateThing,
  addDistrict,
  setExitOpens,
  setMaker,
  thingAt,
  thingExists,
  buildingSize,
  growthRoom,
  growToFit,
  type GridPoint,
  type Growth,
  type Offset,
  type Sides,
  type SpotKind,
  type ThingRef,
} from '../maker/draft';
import {
  loadMakerStore,
  mapFileText,
  walkedVersion,
  isUntouchedBlank,
  lastMakerName,
  newDraftKey,
  saveMakerStore,
  withDraft,
  withoutDraft,
  type MakerStore,
} from '../maker/drafts';
import { EditHistory } from '../maker/history';
import {
  areaById,
  doorwayAt,
  doorwaysIn,
  focusArea,
  makeInside,
  moveBuilding,
  moveDoorway,
  removeArea,
  removeBuilding,
  resizeArea,
  updateArea,
  withFocusedArea,
  type AreaId,
  type DoorwayInArea,
} from '../maker/areas';
import { drawPlantSwatch, drawSwatch, loadMakerSheets } from '../maker/mapCanvas';
import { MapPainter } from '../maker/mapPainter';
import { overviewOf, type Overview } from '../maker/overview';

import { createPlaytestGame, createPlaytestStash } from '../dev/playtestSave';
import { PLAYTEST_RAID_DURATION_MS, setActiveSaveSlot, setTryItRules } from '../dev/playtestMode';
import { Bag } from '../items';
import { packGridFor } from '../items/packs';
import { beginTry, endTry, TRY_IT_MAP_ID, type TryRules } from '../maker/tryIt';
import { PokemonParty } from '../pokemon';
import { activeRunManager } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan } from '../run/runGeneration';
import { SaveManager } from '../save/SaveManager';
import { hunterThreatFor } from '../world/hunterThreat';
import { playerMapId } from '../world/mapFile';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import { botCheckNeeded, passBotCheck } from '../maker/turnstile';
import {
  isSignedIn,
  sendMap,
  sendRefusal,
  sentMaps,
  type SubmissionStatus,
} from '../maker/submissions';
import {
  blockMaker,
  decide,
  finishReviewSignIn,
  reviewAccess,
  reviewQueue,
  signInToReview,
  signOutOfReview,
  type QueuedMap,
  type ReviewDecision,
} from '../maker/review';
import {
  makerScreen,
  walkedCheck,
  type MakerPanel,
  type ReviewState,
  type SendState,
  type SentState,
  MAKER_ZOOMS,
  type MakerTool,
  type MakerZoom,
  type PlaceChoice,
  stackLayout,
} from '../maker/makerView';
import {
  BUILDING_CHOICES,
  brushesFor,
  FURNITURE_CHOICES,
  groundBrush,
  groundUnder,
} from '../maker/palette';
import { isFigureSpecies } from '../world/pokemonFigures';
import { MenuOverlay } from '../ui/MenuOverlay';
import { takeDownPixelStatus } from '../ui/pixelUi';
import {
  MAP_FILE_LIMITS,
  plainText,
  readMapFile,
  MAP_FILE_AREA_STYLES,
  type MapFile,
  type MapFileArea,
  type MapFileAreaStyle,
  type MapFileBuildingKind,
  type MapFileDoorKind,
  type MapFileHabitat,
} from '../world/mapFile';
import { checkMapFile, type MapCheck } from '../world/mapFileChecks';

/**
 * The map maker: a player draws their own raid map, in the FireRed style, and
 * keeps it as a draft in this browser or as a file.
 *
 * Every edit is a new map file (`maker/draft.ts`), so the screen is three
 * things kept in step - the file, the picture of it the game's own layer
 * builder draws (`maker/mapCanvas.ts`) and the "does it work" checks
 * (`world/mapFileChecks.ts`) - and undo is the history of files. The screen is
 * pixel-ui markup re-rendered after each edit; a stroke in progress redraws
 * only the canvas, so painting never waits on the DOM.
 */

/**
 * How long an edit may go unsaved. A throttle, not a debounce: the first edit
 * after a save starts the clock and nothing restarts it, so a maker who never
 * stops clicking is still saved every this often.
 */
const AUTOSAVE_MS = 400;
const STATUS_MS = 3_500;
const DRAFTS_FULL =
  'Your drafts could not be saved: this browser may be out of room. DOWNLOAD this map to keep it, and delete drafts you do not need.';

/** No room to grow on any side: an inside's. */
const NO_ROOM: Sides = { left: 0, top: 0, right: 0, bottom: 0 };
/**
 * How often the map window scrolls while a stroke is held past its edge: a
 * frame's worth, so the map glides under the pointer rather than stepping.
 */
const EDGE_SCROLL_MS = 16;
/** The most the window moves in one of those ticks, in screen pixels: about 750 a second. */
const EDGE_SCROLL_MAX_PX = 12;

interface Stroke {
  readonly tool: MakerTool;
  start: GridPoint;
  last: GridPoint;
  file: MapFile;
  /** How far the stroke's map has grown west and north since it began, so everything on it moved. */
  shift: Offset;
  /** For a drag with Select: the thing being carried. */
  readonly carrying?: ThingRef;
  /** The pointer drawing it, so a stroke cancelled from the keyboard lets it go. */
  readonly pointerId: number;
  /** Where the pointer is now, on screen, which may be past the map window's edge. */
  pointer: { readonly clientX: number; readonly clientY: number };
}

/**
 * What the maker had open, kept for as long as the page is: undo history and
 * the view of each draft. A TRY IT or a trip to the title starts this scene
 * again, and the scene used to build its history afresh from the stored draft,
 * so every step of undo and the zoom went with it. Kept here rather than on
 * the scene so nothing about reaching it depends on Phaser reusing the
 * instance, and per draft so opening another draft and coming back keeps both.
 */
const sessionHistories = new Map<string, EditHistory<MapFile>>();
const sessionViews = new Map<
  string,
  { readonly zoom: MakerZoom; readonly left: number; readonly top: number }
>();

/**
 * Each map a stroke grew, with the map it grew from and how far its ground
 * moved, so undo and redo can hold the window still as the map changes size
 * under it. Kept beside the histories, whose maps it is keyed by.
 */
const grownFrom = new WeakMap<MapFile, { readonly before: MapFile; readonly shift: Offset }>();

/** Whether the maker wants the overview in the map window's corner: theirs to turn off, for the page's life. */
let overviewWanted = true;

/** Forgets the session's histories and views: for tests, which share the module. */
export function forgetMakerSession(): void {
  sessionHistories.clear();
  sessionViews.clear();
}

export class MapMakerScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private store: MakerStore = { drafts: [] };
  private draftKey = '';
  private history = new EditHistory<MapFile>(blankMap());
  private tool: MakerTool = 'brush';
  private brushId = brushesFor(false)[0].id;
  private place: PlaceChoice = { kind: 'drop-in' };
  private selected: ThingRef | undefined;
  /**
   * The place of the map on screen: the outdoors, or the inside of one of its
   * buildings. Everything painted, placed and chosen is in it; `selected` is an
   * index into its view (`focusArea`).
   */
  private area: AreaId;
  /** A way through chosen on the map - a room's mat - instead of a thing. */
  private doorway: Pick<DoorwayInArea, 'link' | 'end'> | undefined;
  /** The view of the area on screen, kept against the file it was made from. */
  private focused: { readonly file: MapFile; readonly area: AreaId; readonly view: MapFile } | undefined;
  /** An inside the Remove button was pressed for once, waiting on the second press. */
  private pendingAreaRemoval: string | undefined;
  /** The thing whose panel was last brought into view, so it is brought there once per choice. */
  private shownChosen: string | undefined;
  private zoom: MakerZoom = 16;
  private panel: MakerPanel = 'map';
  private sending: SendState = { step: 'checking' };
  private sent: SentState = { step: 'loading' };
  private review: ReviewState = { step: 'checking' };
  /** The map sent in that is open in the editor to be reviewed. */
  private reviewing: QueuedMap | undefined;
  private pendingBlock = false;
  /** A passed bot check, spent by the next sign-in. */
  private captchaToken: string | undefined;
  private stroke: Stroke | undefined;
  private edgeScroll: ReturnType<typeof setInterval> | undefined;
  private checks: readonly MapCheck[] = [];
  private checkedFile: MapFile | undefined;
  /** The map's picture, kept between renders and drawn again only where it changed. */
  private painter = new MapPainter();
  /** The map being moved by hand: where the pointer took hold, and where the window was then. */
  private pan:
    | {
        readonly pointerId: number;
        readonly x: number;
        readonly y: number;
        readonly left: number;
        readonly top: number;
      }
    | undefined;
  /** Space held with the pointer over the map: the next press moves the map rather than drawing. */
  private spaceHeld = false;
  private pointerOverMap = false;
  /** Wheel travel with Ctrl held not yet spent on a zoom step, so a trackpad pinch steps once a notch. */
  private wheelTravel = 0;
  /** The overview last painted, and the map it is of. */
  private overview: { readonly file: MapFile; readonly overview: Overview } | undefined;
  private overviewDrawn: { readonly canvas: HTMLCanvasElement; readonly overview: Overview } | undefined;
  private overviewFrame: number | undefined;
  private readonly releaseSpace = (event: Event): void => {
    if (event.type === 'blur' || (event as KeyboardEvent).key === ' ') {
      this.spaceHeld = false;
      this.overlay?.root.querySelector('[data-stack]')?.classList.remove('is-panning');
    }
  };
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  private renderTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * A text field typed into and not yet committed, and the map it would make:
   * saved with the draft as it is typed, and committed before anything else
   * can change what the field was opened for.
   */
  private typing: { readonly field: HTMLElement; readonly apply: () => MapFile } | undefined;
  /** Set while the screen's markup is replaced, when a field torn down with it reports a change. */
  private rendering = false;
  private readonly flushOnLeave = (event: Event): void => {
    if (event.type === 'pagehide' || document.visibilityState === 'hidden') {
      this.flushAutosave();
    }
  };
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the last save of the drafts failed, so the maker is told once rather than at every stroke. */
  private storeFull = false;
  private pendingDelete: string | undefined;

  public constructor() {
    super('mapmaker');
  }

  public create(data?: { readonly tried?: boolean; readonly review?: boolean }): void {
    // Back from a TRY IT: the draft stops being a map the game can deploy onto,
    // and the game goes back to its ordinary save.
    const tried = data?.tried === true;
    endTry();
    unregisterPlayerMap(playerMapId({ id: TRY_IT_MAP_ID }));
    setActiveSaveSlot('normal');
    this.store = loadMakerStore();
    const current =
      this.store.drafts.find((draft) => draft.key === this.store.current) ?? this.store.drafts[0];
    if (current) {
      this.draftKey = current.key;
      this.openHistory(current.file);
    } else {
      this.startNewDraft();
    }
    this.selected = undefined;
    this.area = undefined;
    this.doorway = undefined;
    this.stroke = undefined;
    this.stopEdgeScroll();
    this.panel = 'map';
    this.painter = new MapPainter();
    this.overlay = new MenuOverlay(this, 'map-maker pixel-ui', (event) => this.handleKey(event));
    // Rows here are tools, and a pointer crossing them on its way to the map
    // must not choose one: it only lights what it is over.
    this.overlay.pointerRule = 'previews';
    // Enter in a one-line field is done with it: the field is committed and the
    // cursor goes back to the tools, so the next key is a shortcut again rather
    // than a letter typed in front of the name. On key up, because the keyboard
    // claim keeps every key down to itself.
    this.overlay.root.addEventListener('keyup', (event) => {
      const target = event.target;
      if (
        event.key === 'Enter' &&
        target instanceof HTMLInputElement &&
        this.overlay.root.contains(target)
      ) {
        this.overlay.root
          .querySelector<HTMLElement>('[data-tool].is-selected, [data-tool]')
          ?.focus();
      }
    });
    // A tab closed, reloaded or put in the background may never run another
    // timer, so whatever is waiting to be saved is saved on the way out.
    window.addEventListener('pagehide', this.flushOnLeave);
    document.addEventListener('visibilitychange', this.flushOnLeave);
    // Space is let go wherever the focus has gone by then, so its release is
    // heard on the window, and a window left with it held lets it go too.
    window.addEventListener('keyup', this.releaseSpace);
    window.addEventListener('blur', this.releaseSpace);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pagehide', this.flushOnLeave);
      document.removeEventListener('visibilitychange', this.flushOnLeave);
      window.removeEventListener('keyup', this.releaseSpace);
      window.removeEventListener('blur', this.releaseSpace);
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = undefined;
      }
      this.stopEdgeScroll();
      this.flushAutosave();
      this.typing = undefined;
    });
    this.render(
      tried
        ? this.walkedOut()
          ? 'You walked out of it. The map is ready.'
          : 'That try ended without leaving by an exit.'
        : undefined,
    );
    this.restoreView();
    // Back from signing in with GitHub: finish it, then open the review list.
    if (data?.review) {
      void finishReviewSignIn().then(() => this.openPanel('review'));
    }
    void loadMakerSheets().then(() => {
      if (this.scene.isActive()) {
        this.drawSwatches();
        // Whatever was drawn before the sheets arrived was drawn without them.
        this.painter.forgetCanvas();
        this.redraw();
      }
    });
  }

  private get file(): MapFile {
    return this.history.value;
  }

  /**
   * The area on screen as a map file of its own (`maker/areas.ts`): every brush
   * and tool works on this, and `commitView` writes what they make back into
   * the file.
   */
  private get view(): MapFile {
    const file = this.file;
    if (this.focused?.file !== file || this.focused.area !== this.area) {
      this.focused = { file, area: this.area, view: focusArea(file, this.area) };
    }
    return this.focused.view;
  }

  /** The inside on screen, or undefined outdoors. */
  private get inside(): MapFileArea | undefined {
    return areaById(this.file, this.area);
  }

  /** Makes an edit of the area on screen the map, as one undo step. */
  private commitView(next: MapFile, selected: ThingRef | undefined): void {
    if (next === this.view) {
      this.commit(this.file, selected);
      return;
    }
    this.commit(withFocusedArea(this.file, this.area, next), selected);
  }

  /** Shows another place of the map: the outdoors, or one of its insides. */
  private showArea(area: AreaId): void {
    this.area = areaById(this.file, area)?.id;
    this.selected = undefined;
    this.doorway = undefined;
    this.pendingAreaRemoval = undefined;
    this.panel = 'map';
    if (!brushesFor(this.inside !== undefined).some((brush) => brush.id === this.brushId)) {
      this.brushId = brushesFor(this.inside !== undefined)[0].id;
    }
    if (this.place.kind === 'building') {
      this.place = { kind: 'drop-in' };
      if (this.tool === 'place') {
        this.tool = 'select';
      }
    }
    this.render();
    this.fitZoom();
  }

  private startNewDraft(maker = lastMakerName(this.store)): void {
    this.draftKey = newDraftKey(this.store);
    const file = setMaker(blankMap(), maker);
    this.openHistory(file);
    this.store = withDraft(this.store, { key: this.draftKey, file, updatedAt: Date.now() });
    saveMakerStore(this.store);
  }

  // --- Keeping the file, the checks and the picture in step --------------------

  /**
   * The undo history of the draft being opened: the one this session already
   * has for it, if that history still ends on the map stored, or a new one.
   */
  private openHistory(file: MapFile): void {
    const kept = sessionHistories.get(this.draftKey);
    if (kept && (kept.value === file || mapFileText(kept.value) === mapFileText(file))) {
      this.history = kept;
      return;
    }
    this.history = new EditHistory<MapFile>(file);
    sessionHistories.set(this.draftKey, this.history);
  }

  /** Remembers the zoom and scroll of the draft on screen, for when it is next opened. */
  private rememberView(): void {
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    sessionViews.set(this.draftKey, {
      zoom: this.zoom,
      left: viewport?.scrollLeft ?? 0,
      top: viewport?.scrollTop ?? 0,
    });
  }

  /** Puts the draft back as it was last seen this session, or fits a draft not seen yet. */
  private restoreView(): void {
    const view = sessionViews.get(this.draftKey);
    if (!view) {
      this.fitZoom();
      return;
    }
    if (view.zoom !== this.zoom) {
      this.zoom = view.zoom;
      this.render();
    }
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    if (viewport) {
      viewport.scrollLeft = view.left;
      viewport.scrollTop = view.top;
    }
  }

  /**
   * Makes `next` the map, as one undo step, with `selected` chosen. There is no
   * default: `undefined` is how a removal says "nothing is chosen now", and a
   * default parameter read it as "keep the choice", which left the next thing
   * along chosen - or, after the last of a kind, a choice of nothing that
   * every render threw on.
   */
  private commit(next: MapFile, selected: ThingRef | undefined): void {
    this.history.push(next);
    this.selected = selected;
    this.doorway = undefined;
    this.scheduleAutosave();
    this.render();
  }

  private currentChecks(): readonly MapCheck[] {
    if (this.checkedFile !== this.file) {
      this.checks = checkMapFile(this.file);
      this.checkedFile = this.file;
    }
    return this.checks;
  }

  private scheduleAutosave(): void {
    this.autosaveTimer ??= setTimeout(() => this.flushAutosave(), AUTOSAVE_MS);
  }

  /** Saves the draft as it stands, with whatever is being typed in it. */
  private flushAutosave(): void {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = undefined;
    }
    const file = this.typing?.apply() ?? this.file;
    const kept = this.store.drafts.find((draft) => draft.key === this.draftKey);
    if (kept?.file === file) {
      return;
    }
    this.store = withDraft(this.store, {
      ...(kept ?? {}),
      key: this.draftKey,
      file,
      updatedAt: Date.now(),
    });
    this.noteSaved(saveMakerStore(this.store));
  }

  /**
   * Says so, once, when the drafts stop fitting in this browser. A 256x256
   * draft is sixty-odd kilobytes and the browser keeps a few megabytes for
   * the whole game, so a maker with many big drafts can run out - and a save
   * that fails without a word is a map lost on the next reload.
   */
  private noteSaved(saved: boolean): void {
    if (saved) {
      this.storeFull = false;
      return;
    }
    if (this.storeFull) {
      return;
    }
    this.storeFull = true;
    setTimeout(() => {
      if (this.scene.isActive()) {
        this.render(DRAFTS_FULL);
      }
    }, 0);
  }

  /** Makes what is typed in a field the map, as one undo step, without drawing the screen again. */
  private commitTyping(): void {
    const typing = this.typing;
    this.typing = undefined;
    if (typing) {
      this.pushEdit(typing.apply());
    }
  }

  private pushEdit(next: MapFile): void {
    if (next !== this.file) {
      this.history.push(next);
      this.scheduleAutosave();
    }
  }

  /**
   * A field's value, committed against the thing the field was opened for.
   * The screen is drawn again once the focus has finished moving, so Tab lands
   * on the field it was pressed towards rather than back on this one.
   */
  private commitField(field: HTMLElement, apply: () => MapFile): void {
    if (this.rendering) {
      // Torn down by a render, which committed what it held before it began.
      return;
    }
    if (this.typing?.field === field) {
      this.typing = undefined;
    }
    this.pushEdit(apply());
    this.renderTimer ??= setTimeout(() => this.render(), 0);
  }

  private render(status?: string): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }
    this.commitTyping();
    // Undo, redo or an edit can take away the inside on screen, or what was
    // chosen; a choice of nothing is no choice.
    if (this.area !== undefined && !this.inside) {
      this.area = undefined;
      this.selected = undefined;
    }
    if (this.selected && !thingExists(this.view, this.selected)) {
      this.selected = undefined;
    }
    if (
      this.doorway &&
      !doorwaysIn(this.file, this.area).some(
        (candidate) => candidate.link === this.doorway?.link && candidate.end === this.doorway.end,
      )
    ) {
      this.doorway = undefined;
    }
    const typedIn = this.fieldWithFocus();
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    const scroll = viewport ? { left: viewport.scrollLeft, top: viewport.scrollTop } : undefined;
    const sideTop = this.overlay.root.querySelector<HTMLElement>('.maker-side')?.scrollTop;
    // The map's picture outlives the markup round it: a 256x256 canvas is
    // sixty-four megabytes, and drawn again from nothing after every click it
    // was most of a second.
    const kept = this.overlay.root.querySelector<HTMLElement>('[data-stack]');
    this.rendering = true;
    try {
      this.overlay.root.innerHTML = this.screenMarkup(status);
    } finally {
      this.rendering = false;
    }
    const fresh = this.overlay.root.querySelector<HTMLElement>('[data-stack]');
    if (kept && fresh) {
      fresh.replaceWith(kept);
      this.layoutStack(this.view);
      // Taken out of the page and put back, the map let go of the pointer a
      // stroke holds, and a drag let go of past the window never ended.
      if (this.stroke) {
        try {
          this.mapCanvas()?.setPointerCapture(this.stroke.pointerId);
        } catch {
          // The pointer is gone; the stroke ends when it is next let go over the map.
        }
      }
    } else if (fresh) {
      this.painter.forgetCanvas();
    }
    this.wire();
    this.restoreField(typedIn);
    const next = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    if (next && scroll) {
      next.scrollLeft = scroll.left;
      next.scrollTop = scroll.top;
    }
    this.drawSwatches();
    this.redraw();
    this.showBotCheck();
    // The column is rebuilt with the screen; it keeps where it was scrolled to.
    const side = this.overlay.root.querySelector<HTMLElement>('.maker-side');
    if (side && sideTop !== undefined) {
      side.scrollTop = sideTop;
    }
    // A panel opened in the right-hand column is brought into view: under a
    // long list of checks it would otherwise open below the fold, unseen. So is
    // the panel of a thing just placed or chosen, which is where it is named.
    const chosen = this.selected ? `${this.selected.kind}:${this.selected.index}` : undefined;
    if (this.panel !== 'map') {
      side?.querySelector('.maker-side > .px-window:last-child')?.scrollIntoView({ block: 'nearest' });
    } else if (side && chosen !== undefined && chosen !== this.shownChosen) {
      // Brought to the top of the column rather than the nearest edge: scrolled
      // only as far as it took, the fold came to rest through a line of the
      // checks above it.
      const pane = side.querySelector<HTMLElement>('.maker-selected')?.getBoundingClientRect();
      const column = side.getBoundingClientRect();
      if (pane && (pane.top < column.top || pane.bottom > column.bottom)) {
        side.scrollTop += pane.top - column.top;
      }
    }
    this.shownChosen = chosen;
    // A frame later, so letting go of a stroke is not held up by the overview.
    this.scheduleOverview();
    this.overlay.refocus('[data-tool].is-selected', '[data-tool]');
    if (status) {
      if (this.statusTimer) {
        clearTimeout(this.statusTimer);
      }
      this.statusTimer = setTimeout(() => takeDownPixelStatus(this.overlay.root), STATUS_MS);
    }
  }

  private screenMarkup(status: string | undefined): string {
    return makerScreen({
      file: this.file,
      ...(this.area !== undefined ? { area: this.area } : {}),
      ...(this.doorway ? { doorway: this.doorway } : {}),
      tool: this.tool,
      brushId: this.brushId,
      place: this.place,
      selected: this.selected,
      zoom: this.zoom,
      overview: overviewWanted,
      checks: [...this.currentChecks(), walkedCheck(this.walkedOut())],
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      drafts: this.store.drafts,
      unreadableDrafts: this.store.unreadable?.length ?? 0,
      draftKey: this.draftKey,
      panel: this.panel,
      sending: this.sending,
      sent: this.sent,
      review: this.review,
      reviewing: this.reviewing,
      ...(status ? { status } : {}),
    });
  }

  /** The text field the maker is in, by the selector that finds it again, and where the caret is. */
  private fieldWithFocus():
    | { readonly selector: string; readonly start: number | null; readonly end: number | null }
    | undefined {
    const active = document.activeElement;
    if (
      !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) ||
      !this.overlay.root.contains(active)
    ) {
      return undefined;
    }
    const selector = Object.entries(active.dataset)
      .filter(([name]) => name !== 'help')
      .map(([name, value]) => {
        const attribute = `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        return value ? `[${attribute}="${CSS.escape(value)}"]` : `[${attribute}]`;
      })
      .join('');
    if (!selector) {
      return undefined;
    }
    // A number field has no caret to ask about, and asking throws.
    const caret = active.type === 'number' ? null : active.selectionStart;
    return { selector, start: caret, end: caret === null ? null : active.selectionEnd };
  }

  /**
   * Puts the maker back in the field they were in, caret and all: a field
   * rebuilt and focused afresh has its caret at the start, and the next word
   * typed went in front of the last.
   */
  private restoreField(typedIn: ReturnType<MapMakerScene['fieldWithFocus']>): void {
    if (!typedIn) {
      return;
    }
    const field = this.overlay.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      typedIn.selector,
    );
    if (!field) {
      return;
    }
    field.focus();
    if (typedIn.start !== null && typedIn.end !== null && field.type !== 'number') {
      field.setSelectionRange(typedIn.start, typedIn.end);
    }
  }

  private mapContext(): CanvasRenderingContext2D | null {
    return (
      this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-map]')?.getContext('2d') ??
      null
    );
  }

  private redraw(file: MapFile = this.view): void {
    const context = this.mapContext();
    if (!context) {
      return;
    }
    const doorways = doorwaysIn(this.file, this.area).map((doorway) => ({
      at: doorway.at,
      chosen: doorway.link === this.doorway?.link && doorway.end === this.doorway.end,
    }));
    const inside = this.inside;
    this.painter.show(
      context,
      file,
      this.selected,
      doorways,
      inside ? { area: inside, links: this.file.links ?? [] } : undefined,
    );
    this.previewArea(undefined);
  }

  private drawSwatches(): void {
    this.overlay.root
      .querySelectorAll<HTMLCanvasElement>('canvas[data-swatch]')
      .forEach((canvas) => {
        const style = canvas.dataset.swatchStyle;
        drawSwatch(
          canvas,
          canvas.dataset.swatch ?? '.',
          style && (MAP_FILE_AREA_STYLES as readonly string[]).includes(style)
            ? (style as MapFileAreaStyle)
            : undefined,
        );
      });
    this.overlay.root
      .querySelectorAll<HTMLCanvasElement>('canvas[data-plant]')
      .forEach((canvas) => {
        // Furniture is pictured on the floor of the room it is offered in.
        const style = this.inside?.style;
        if (style) {
          const piece = FURNITURE_CHOICES.find((option) => option.kind === canvas.dataset.plant);
          if (piece) {
            drawPlantSwatch(canvas, piece.kind, 'grass', style);
          }
          return;
        }
        const choice = BUILDING_CHOICES.find((option) => option.kind === canvas.dataset.plant);
        if (choice) {
          drawPlantSwatch(canvas, choice.kind, choice.on ?? 'grass');
        }
      });
  }

  // --- The screen's controls ---------------------------------------------------

  private wire(): void {
    const root = this.overlay.root;
    const on = (selector: string, handler: (element: HTMLElement) => void): void => {
      root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        element.addEventListener('click', () => {
          if (element.getAttribute('aria-disabled') === 'true') {
            return;
          }
          handler(element);
        });
      });
    };
    on('[data-tool]', (element) => {
      this.tool = element.dataset.tool as MakerTool;
      this.render();
    });
    on('[data-brush]', (element) => {
      this.brushId = element.dataset.brush ?? this.brushId;
      if (!['brush', 'rect', 'fill'].includes(this.tool)) {
        this.tool = 'brush';
      }
      this.render();
    });
    on('[data-place]', (element) => {
      const kind = element.dataset.place;
      this.place =
        kind === 'building'
          ? { kind: 'building', building: element.dataset.building as MapFileBuildingKind }
          : { kind: kind as SpotKind | 'district' | MapFileDoorKind };
      this.tool = 'place';
      this.render();
    });
    on('[data-zoom]', (element) => this.setZoom(Number(element.dataset.zoom) as MakerZoom));
    on('[data-fit]', () => this.fitWhole());
    on('[data-overview-toggle]', () => {
      overviewWanted = !overviewWanted;
      this.render();
    });
    on('[data-undo]', () => this.undo());
    on('[data-redo]', () => this.redo());
    on('[data-new]', () => {
      this.flushAutosave();
      this.rememberView();
      // A map nobody has touched is not one to keep: NEW replaces it rather
      // than leaving another identical blank in the drafts list.
      const maker = lastMakerName(this.store);
      const untouched = isUntouchedBlank(this.file);
      if (untouched) {
        this.store = withoutDraft(this.store, this.draftKey);
        sessionHistories.delete(this.draftKey);
        sessionViews.delete(this.draftKey);
      }
      this.startNewDraft(maker);
      this.selected = undefined;
    this.area = undefined;
    this.doorway = undefined;
      this.panel = 'map';
      this.render(untouched ? 'A new map.' : 'A new map. Your last one is in your drafts.');
      this.fitZoom();
    });
    on('[data-panel]', (element) => this.openPanel(element.dataset.panel as MakerPanel));
    on('[data-send]', () => this.openSend());
    on('[data-send-confirm]', () => void this.confirmSend());
    on('[data-refresh-sent]', () => this.openPanel('sent'));
    on('[data-review-refresh]', () => this.openPanel('review'));
    on('[data-review-sign-in]', () => {
      void signInToReview().then((result) => {
        if (!result.ok) {
          this.review = { step: 'signed-out', reason: result.reason };
          this.render();
        }
      });
    });
    on('[data-review-sign-out]', () => {
      void signOutOfReview().then(() => {
        this.reviewing = undefined;
        this.review = { step: 'signed-out' };
        this.render();
      });
    });
    on('[data-review-open]', (element) => this.openForReview(element.dataset.reviewOpen ?? ''));
    on(
      '[data-decide]',
      (element) => void this.decideReview(element.dataset.decide as ReviewDecision),
    );
    on('[data-block-maker]', (element) => void this.blockReviewedMaker(element));
    on('[data-open-draft]', (element) => this.openDraft(element.dataset.openDraft ?? ''));
    on('[data-delete-draft]', (element) =>
      this.deleteDraft(element, element.dataset.deleteDraft ?? ''),
    );
    on('[data-download]', () => this.download());
    on('[data-try]', (element) => this.tryIt(element.dataset.try === 'walk' ? 'walk' : 'raid'));
    on('[data-open-file]', () =>
      root.querySelector<HTMLInputElement>('[data-file-input]')?.click(),
    );
    on('[data-back]', () => this.leave());
    on('[data-remove-selected]', () => this.removeSelected());
    on('[data-area]', (element) => this.showArea(element.dataset.area || undefined));
    on('[data-go-inside]', (element) => {
      const outcome = makeInside(this.file, Number(element.dataset.goInside));
      if (!outcome.made) {
        this.render(outcome.reason);
        return;
      }
      if (outcome.file !== this.file) {
        this.history.push(outcome.file);
        this.scheduleAutosave();
      }
      this.showArea(outcome.area);
    });
    on('[data-remove-area]', (element) => {
      const id = element.dataset.removeArea ?? '';
      if (this.pendingAreaRemoval !== id) {
        this.pendingAreaRemoval = id;
        element.textContent = 'Remove for good';
        return;
      }
      this.pendingAreaRemoval = undefined;
      const name = areaById(this.file, id)?.name ?? 'The inside';
      this.area = undefined;
      this.commit(removeArea(this.file, id), undefined);
      this.render(`${name} is gone, and its door is shut. Undo brings it back.`);
      this.fitZoom();
    });

    root
      .querySelector<HTMLInputElement>('[data-file-input]')
      ?.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;
        const chosen = input.files?.[0];
        if (chosen) {
          void chosen.text().then((text) => this.openFileText(text, chosen.name));
        }
        input.value = '';
      });

    // Every field is bound to what it was drawn for. Read at the moment of the
    // change, "the selected thing" was already whatever the click that ended
    // the typing had chosen, and a name typed for one person went on another.
    const bind = (
      element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
      change: (value: string) => MapFile,
    ): void => {
      const apply = (): MapFile => change(element.value);
      const typed =
        element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement && element.type === 'text');
      if (typed) {
        element.addEventListener('input', () => {
          this.typing = { field: element, apply };
          this.scheduleAutosave();
        });
      }
      element.addEventListener('change', () => this.commitField(element, apply));
    };
    const field = (selector: string, change: (value: string) => MapFile): void => {
      const element = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
      if (element) {
        bind(element, change);
      }
    };
    field('[data-map-name]', (value) => renameMap(this.file, plainText(value)));
    field('[data-map-maker]', (value) => setMaker(this.file, plainText(value)));
    field('[data-map-wildlife]', (value) => ({ ...this.file, wildlife: value as MapFileHabitat }));
    field('[data-map-width]', (value) =>
      resizeMap(this.file, sizeFromField(value, this.file.width), this.file.height),
    );
    field('[data-map-height]', (value) =>
      resizeMap(this.file, this.file.width, sizeFromField(value, this.file.height)),
    );
    // The inside on screen, bound to that inside as every field is to its thing.
    const inside = this.inside;
    if (inside) {
      field('[data-area-name]', (value) => {
        const name = plainText(value);
        return name.trim().length > 0 ? updateArea(this.file, inside.id, { name }) : this.file;
      });
      field('[data-area-style]', (value) =>
        (MAP_FILE_AREA_STYLES as readonly string[]).includes(value)
          ? updateArea(this.file, inside.id, { style: value as MapFileAreaStyle })
          : this.file,
      );
      field('[data-area-width]', (value) =>
        resizeArea(this.file, inside.id, sizeFromField(value, inside.width), inside.height),
      );
      field('[data-area-height]', (value) =>
        resizeArea(this.file, inside.id, inside.width, sizeFromField(value, inside.height)),
      );
    }
    const selected = this.selected;
    const area = this.area;
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]')
      .forEach((input) => {
        bind(input, (value) =>
          selected && area === this.area
            ? withFocusedArea(
                this.file,
                area,
                this.changeThing(selected, input.dataset.field ?? '', value),
              )
            : this.file,
        );
      });

    // The map keeps its picture, and so its listeners, from one render to
    // the next: wired once.
    const stack = root.querySelector<HTMLElement>('[data-stack]');
    if (stack && stack.dataset.wired === undefined) {
      stack.dataset.wired = '';
      const map = (): HTMLElement => stack.querySelector<HTMLElement>('canvas[data-map]') ?? stack;
      stack.addEventListener('pointerdown', (event) => {
        if ((event.button === 1 || (event.button === 0 && this.spaceHeld)) && !this.stroke) {
          this.startPan(event, stack);
        } else {
          this.pointerDown(event, map());
          this.overlay.root
            .querySelector('.maker-view-area')
            ?.classList.toggle('is-drawing', Boolean(this.stroke));
        }
      });
      stack.addEventListener('pointermove', (event) => {
        if (this.pan) {
          this.movePan(event);
        } else {
          this.pointerMove(event, map());
        }
      });
      const drawn = (): void => {
        this.overlay.root.querySelector('.maker-view-area')?.classList.remove('is-drawing');
      };
      stack.addEventListener('pointerup', (event) => {
        if (this.pan) {
          this.endPan(event, stack);
        } else {
          this.pointerUp(event, map());
          drawn();
        }
      });
      stack.addEventListener('pointercancel', (event) => {
        if (this.pan) {
          this.endPan(event, stack);
        } else {
          this.cancelStroke();
          drawn();
        }
      });
      // The middle button's own scrolling would fight the map being moved by hand.
      stack.addEventListener('mousedown', (event) => {
        if (event.button === 1) {
          event.preventDefault();
        }
      });
      stack.addEventListener('pointerenter', () => {
        this.pointerOverMap = true;
      });
      stack.addEventListener('pointerleave', () => {
        this.pointerOverMap = false;
        if (!this.stroke) {
          this.previewArea(undefined);
        }
      });
    }

    const viewport = this.viewport();
    viewport?.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.wheelZoom(event);
        }
      },
      { passive: false },
    );
    viewport?.addEventListener('scroll', () => this.scheduleOverview(), { passive: true });
    const overview = root.querySelector<HTMLElement>('[data-overview]');
    if (overview) {
      const jump = (event: PointerEvent): void => this.lookAtOverviewPoint(event, overview);
      overview.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        try {
          overview.setPointerCapture(event.pointerId);
        } catch {
          // A pointer the browser no longer tracks: the jump still happens.
        }
        jump(event);
      });
      overview.addEventListener('pointermove', (event) => {
        if (overview.hasPointerCapture(event.pointerId)) {
          jump(event);
        }
      });
    }
  }

  // --- Moving round the map --------------------------------------------------------

  private startPan(event: PointerEvent, stack: HTMLElement): void {
    const viewport = this.viewport();
    if (!viewport) {
      return;
    }
    event.preventDefault();
    this.pan = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    try {
      stack.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the map still moves while it is over it.
    }
    stack.classList.add('is-dragging');
    this.previewArea(undefined);
  }

  private movePan(event: PointerEvent): void {
    const pan = this.pan;
    const viewport = this.viewport();
    if (!pan || !viewport || event.pointerId !== pan.pointerId) {
      return;
    }
    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  }

  private endPan(event: PointerEvent, stack: HTMLElement): void {
    this.pan = undefined;
    stack.classList.remove('is-dragging');
    if (stack.hasPointerCapture(event.pointerId)) {
      stack.releasePointerCapture(event.pointerId);
    }
  }

  /** Ctrl and the wheel: a zoom step a notch, about the tile under the pointer. */
  private wheelZoom(event: WheelEvent): void {
    // A mouse notch is a hundred or so; a trackpad pinch sends many small ones.
    this.wheelTravel = (this.wheelTravel ?? 0) + event.deltaY;
    if (Math.abs(this.wheelTravel) < 40) {
      return;
    }
    const index = MAKER_ZOOMS.indexOf(this.zoom) + (this.wheelTravel > 0 ? -1 : 1);
    this.wheelTravel = 0;
    const zoom = MAKER_ZOOMS[Math.max(0, Math.min(MAKER_ZOOMS.length - 1, index))];
    if (zoom !== this.zoom) {
      this.setZoom(zoom, { clientX: event.clientX, clientY: event.clientY });
    }
  }

  /** Repaints the overview at most once a frame, however fast the window scrolls. */
  private scheduleOverview(): void {
    if (this.overviewFrame !== undefined || typeof requestAnimationFrame !== 'function') {
      return;
    }
    this.overviewFrame = requestAnimationFrame(() => {
      this.overviewFrame = undefined;
      this.showOverview();
    });
  }

  /**
   * The overview in the map window's corner: shown while the map is bigger
   * than the window, with what the window shows outlined on it.
   */
  private showOverview(): void {
    const frame = this.overlay.root.querySelector<HTMLElement>('[data-overview]');
    const picture = frame?.querySelector<HTMLCanvasElement>('[data-overview-map]');
    const outline = frame?.querySelector<HTMLElement>('[data-overview-view]');
    const viewport = this.viewport();
    const map = this.mapCanvas();
    if (!frame || !picture || !outline || !viewport || !map) {
      return;
    }
    if (!overviewWanted) {
      frame.hidden = true;
      return;
    }
    const file = this.onScreen;
    const box = map.getBoundingClientRect();
    const seen = viewport.getBoundingClientRect();
    const fits =
      box.left >= seen.left - 0.5 &&
      box.top >= seen.top - 0.5 &&
      box.right <= seen.left + viewport.clientWidth + 0.5 &&
      box.bottom <= seen.top + viewport.clientHeight + 0.5;
    if (fits || box.width === 0) {
      frame.hidden = true;
      return;
    }
    if (this.overview?.file !== file) {
      this.overview = { file, overview: overviewOf(file, this.painter.layers(file).collision) };
    }
    const { picture: painted, fit } = this.overview.overview;
    // Painted again for a new map, or onto the new canvas a render made.
    if (this.overviewDrawn?.canvas !== picture || this.overviewDrawn.overview !== this.overview.overview) {
      picture.width = painted.width;
      picture.height = painted.height;
      picture.style.width = `calc(var(--u) * ${painted.width})`;
      picture.style.height = `calc(var(--u) * ${painted.height})`;
      picture
        .getContext('2d')
        ?.putImageData(new ImageData(painted.data, painted.width, painted.height), 0, 0);
      this.overviewDrawn = { canvas: picture, overview: this.overview.overview };
    }
    frame.hidden = false;
    // What the window shows, in tiles, then in the overview's game pixels.
    const tilePx = box.width / file.width;
    const left = Math.max(0, (seen.left - box.left) / tilePx);
    const top = Math.max(0, (seen.top - box.top) / tilePx);
    const right = Math.min(file.width, (seen.left + viewport.clientWidth - box.left) / tilePx);
    const bottom = Math.min(file.height, (seen.top + viewport.clientHeight - box.top) / tilePx);
    const scale = fit.zoom / fit.step;
    const at = (value: number): string => `calc(var(--u) * ${Math.round(value)})`;
    // The frame's own padding is two game pixels.
    outline.style.left = at(2 + left * scale);
    outline.style.top = at(2 + top * scale);
    outline.style.width = at(Math.max(2, (right - left) * scale));
    outline.style.height = at(Math.max(2, (bottom - top) * scale));
  }

  /** A press on the overview: the map window looks at that part of the map. */
  private lookAtOverviewPoint(event: PointerEvent, frame: HTMLElement): void {
    const picture = frame.querySelector<HTMLElement>('[data-overview-map]');
    const viewport = this.viewport();
    const map = this.mapCanvas();
    const fit = this.overview?.overview.fit;
    if (!picture || !viewport || !map || !fit) {
      return;
    }
    const shown = picture.getBoundingClientRect();
    const file = this.onScreen;
    const tile = {
      x: ((event.clientX - shown.left) / shown.width) * file.width,
      y: ((event.clientY - shown.top) / shown.height) * file.height,
    };
    const box = map.getBoundingClientRect();
    const seen = viewport.getBoundingClientRect();
    const tilePx = box.width / file.width;
    viewport.scrollLeft += box.left + tile.x * tilePx - (seen.left + viewport.clientWidth / 2);
    viewport.scrollTop += box.top + tile.y * tilePx - (seen.top + viewport.clientHeight / 2);
    this.showOverview();
  }

  // --- Drawing on the map --------------------------------------------------------

  /** The map as it is drawn now: a stroke's map while one is held, which may have grown. */
  private get onScreen(): MapFile {
    return this.stroke?.file ?? this.view;
  }

  private tileAt(
    point: { readonly clientX: number; readonly clientY: number },
    canvas: HTMLElement,
  ): GridPoint {
    const box = canvas.getBoundingClientRect();
    const file = this.onScreen;
    return {
      x: Math.floor(((point.clientX - box.left) / box.width) * file.width),
      y: Math.floor(((point.clientY - box.top) / box.height) * file.height),
    };
  }

  /** Whether a tool can draw past the edge of the map, growing it. */
  private grows(tool: MakerTool): boolean {
    return tool === 'brush' || tool === 'rect' || tool === 'place' || tool === 'select';
  }

  /** The tiles a tool may work on: the map, and for one that grows it, the room round it. */
  private reach(tool: MakerTool): { left: number; top: number; right: number; bottom: number } {
    const file = this.onScreen;
    const room = this.grows(tool) ? this.roomOf(file) : NO_ROOM;
    return {
      left: -room.left,
      top: -room.top,
      right: file.width + room.right - 1,
      bottom: file.height + room.bottom - 1,
    };
  }

  private inReach(tool: MakerTool, { x, y }: GridPoint): boolean {
    const reach = this.reach(tool);
    return x >= reach.left && y >= reach.top && x <= reach.right && y <= reach.bottom;
  }

  /**
   * The tile under the pointer, held to the part of the map the maker can see.
   * A stroke keeps the pointer after it leaves the map window, so dragged past
   * the window's edge it painted ground scrolled out of sight; held to the edge
   * it paints along it instead, and the window scrolls to show more
   * (`followStroke`). A tool that grows the map is held to the room round the
   * map as well, which is drawn; any other to the map.
   */
  private visibleTileAt(
    point: { readonly clientX: number; readonly clientY: number },
    canvas: HTMLElement,
    tool: MakerTool,
  ): GridPoint {
    const area = (
      this.grows(tool) ? this.overlay.root.querySelector<HTMLElement>('[data-stack]') : null
    )?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    const seen = this.viewport()?.getBoundingClientRect() ?? area;
    const left = Math.max(area.left, seen.left);
    const top = Math.max(area.top, seen.top);
    // Half a pixel in from the far edges, so a pointer held there is on the
    // last tile in view rather than the first one past it.
    const right = Math.min(area.right, seen.right) - 0.5;
    const bottom = Math.min(area.bottom, seen.bottom) - 0.5;
    const tile = this.tileAt(
      {
        clientX: Math.min(Math.max(point.clientX, left), Math.max(left, right)),
        clientY: Math.min(Math.max(point.clientY, top), Math.max(top, bottom)),
      },
      canvas,
    );
    const reach = this.reach(tool);
    return {
      x: Math.min(Math.max(tile.x, reach.left), reach.right),
      y: Math.min(Math.max(tile.y, reach.top), reach.bottom),
    };
  }

  private viewport(): HTMLElement | null {
    return this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
  }

  /**
   * How far the window should scroll this tick for a pointer at `point`: none
   * while it is inside, and faster the further past an edge it is held, as an
   * image editor scrolls under a drag.
   */
  private edgeScrollStep(point: { readonly clientX: number; readonly clientY: number }): {
    readonly x: number;
    readonly y: number;
  } {
    const box = this.viewport()?.getBoundingClientRect();
    if (!box) {
      return { x: 0, y: 0 };
    }
    const past = (at: number, low: number, high: number): number =>
      at < low ? at - low : at > high ? at - high : 0;
    const speed = (distance: number): number =>
      distance === 0
        ? 0
        : Math.sign(distance) * Math.min(EDGE_SCROLL_MAX_PX, Math.max(1, Math.abs(distance) / 6));
    return {
      x: speed(past(point.clientX, box.left, box.right)),
      y: speed(past(point.clientY, box.top, box.bottom)),
    };
  }

  /** Scrolls the window on towards a stroke held past its edge, and carries the stroke with it. */
  private followStroke(): void {
    const stroke = this.stroke;
    const viewport = this.viewport();
    const canvas = this.mapCanvas();
    if (!stroke || !viewport || !canvas) {
      this.stopEdgeScroll();
      return;
    }
    const step = this.edgeScrollStep(stroke.pointer);
    const before = { left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.scrollLeft += step.x;
    viewport.scrollTop += step.y;
    if (viewport.scrollLeft === before.left && viewport.scrollTop === before.top) {
      // At the end of what can be drawn, or back inside the window: nothing more to show.
      this.stopEdgeScroll();
      return;
    }
    this.extendStroke(this.visibleTileAt(stroke.pointer, canvas, stroke.tool));
  }

  private stopEdgeScroll(): void {
    if (this.edgeScroll !== undefined) {
      clearInterval(this.edgeScroll);
      this.edgeScroll = undefined;
    }
  }

  private mapCanvas(): HTMLElement | null {
    return this.overlay.root.querySelector<HTMLElement>('canvas[data-map]');
  }

  /**
   * How much room the place on screen has to grow into on each side: the
   * outdoors, the map's; an inside, none, because a room is the size its own
   * fields say.
   */
  private roomOf(file: MapFile): Sides {
    return this.area === undefined ? growthRoom(file) : NO_ROOM;
  }

  /** `growToFit` for the place on screen, which only grows outdoors. */
  private wouldGrow(file: MapFile, tiles: readonly GridPoint[]): Growth {
    return this.area === undefined ? growToFit(file, tiles) : { file, shift: { x: 0, y: 0 } };
  }

  private inMap({ x, y }: GridPoint): boolean {
    return x >= 0 && y >= 0 && x < this.view.width && y < this.view.height;
  }

  private brush() {
    const inside = this.inside !== undefined;
    return groundBrush(this.brushId, inside) ?? brushesFor(inside)[0];
  }

  /**
   * Takes the chosen thing off the map. A building outdoors goes with the
   * inside its door leads into; the way out of a room goes only with the room.
   */
  private removeSelected(): void {
    if (this.doorway) {
      this.render('The way out of a room goes with the room. Remove the inside to take it away.');
      return;
    }
    const selected = this.selected;
    if (!selected) {
      return;
    }
    if (selected.kind === 'building' && this.area === undefined) {
      const had = this.file.links?.length ?? 0;
      const next = removeBuilding(this.file, selected.index);
      this.commit(next, undefined);
      if ((next.links?.length ?? 0) < had) {
        this.render('The building and its inside are gone. Undo brings both back.');
      }
      return;
    }
    this.commitView(removeThing(this.view, selected), undefined);
  }

  /**
   * The map grown to hold `tiles`, drawn and laid out as grown with the window
   * held still on what it showed, or the map as it is. A stroke in progress
   * grows its own map and has its tiles moved with it.
   */
  private growFor(file: MapFile, tiles: readonly GridPoint[]): Growth {
    const growth = this.wouldGrow(file, tiles);
    if (growth.file === file) {
      return growth;
    }
    const sides = {
      left: growth.shift.x,
      top: growth.shift.y,
      right: growth.file.width - file.width - growth.shift.x,
      bottom: growth.file.height - file.height - growth.shift.y,
    };
    const context = this.mapContext();
    this.holdingTheView(file, growth.shift, () => {
      if (context) {
        this.painter.grew(context, file, growth.file, sides, this.selected);
      }
      this.layoutStack(growth.file);
    });
    return growth;
  }

  /**
   * Does `change`, which moves what is drawn by `shift` tiles within the map
   * window - `shown` is the map drawn before it - and scrolls the window so that what was under the maker's eye
   * still is: a map grown west would otherwise jump east under the pointer.
   */
  private holdingTheView(shown: MapFile, shift: Offset, change: () => void): void {
    const before = this.mapCanvas()?.getBoundingClientRect();
    const tilePx = before ? before.width / Math.max(1, shown.width) : 0;
    change();
    // Asked for after the change, which may have drawn the screen again round a new window.
    const viewport = this.viewport();
    const after = this.mapCanvas()?.getBoundingClientRect();
    if (!viewport || !before || !after) {
      return;
    }
    viewport.scrollLeft += after.left + shift.x * tilePx - before.left;
    viewport.scrollTop += after.top + shift.y * tilePx - before.top;
    this.showOverview();
  }

  /** Sizes the map window's drawing for `file`: the map, and the room it may grow into round it. */
  private layoutStack(file: MapFile): void {
    const stack = this.overlay.root.querySelector<HTMLElement>('[data-stack]');
    const canvas = this.mapCanvas();
    if (!stack || !canvas) {
      return;
    }
    const layout = stackLayout(file, this.zoom, this.area === undefined);
    stack.setAttribute('style', layout.stack);
    canvas.setAttribute('style', layout.map);
  }

  private pointerDown(event: PointerEvent, canvas: HTMLElement): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    // Preventing the default keeps the focus where it was, so a field typed in
    // is left by hand: its change lands on what it was for before the click
    // chooses anything else.
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.overlay.root.contains(active)) {
      active.blur();
    }
    const tile = this.tileAt(event, canvas);
    if (!this.inReach(this.tool, tile)) {
      return;
    }
    const inMap = this.inMap(tile);
    try {
      // So a stroke dragged off the edge of the map still ends where it was let go.
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the stroke still works inside the map.
    }
    const held = {
      pointerId: event.pointerId,
      pointer: { clientX: event.clientX, clientY: event.clientY },
    };
    switch (this.tool) {
      case 'brush': {
        const growth = this.growFor(this.view, [tile]);
        const at = { x: tile.x + growth.shift.x, y: tile.y + growth.shift.y };
        const file = paintWith(growth.file, [at], this.brush());
        this.stroke = {
          tool: 'brush',
          start: at,
          last: at,
          file,
          shift: growth.shift,
          ...held,
        };
        this.redraw(file);
        return;
      }
      case 'rect':
        this.stroke = {
          tool: 'rect',
          start: tile,
          last: tile,
          file: this.view,
          shift: { x: 0, y: 0 },
          ...held,
        };
        this.previewArea({ from: tile, to: tile });
        return;
      case 'fill':
        if (inMap) {
          this.commitView(paintWith(this.view, fillRegion(this.view, tile), this.brush()), this.selected);
        }
        return;
      case 'pick': {
        const letter = groundAt(this.view, tile) ?? '.';
        const brushes = brushesFor(this.inside !== undefined);
        const picked =
          brushes.find((brush) => brush.letterFor(groundUnder(letter)) === letter) ??
          brushes.find((brush) => brush.swatch === groundUnder(letter));
        if (inMap && picked) {
          this.brushId = picked.id;
          this.tool = 'brush';
          this.render();
        }
        return;
      }
      case 'erase': {
        if (inMap && doorwayAt(this.file, this.area, tile)) {
          this.render('The way out of a room goes with the room. Remove the inside to take it away.');
          return;
        }
        const thing = inMap ? thingAt(this.view, tile) : undefined;
        if (thing) {
          this.selected = thing;
          this.removeSelected();
        }
        return;
      }
      case 'select': {
        // A way through first: it is drawn over whatever it stands beside, and
        // the mat of a room is the one thing a maker moves along its wall.
        const doorway = inMap ? doorwayAt(this.file, this.area, tile) : undefined;
        const thing = doorway || !inMap ? undefined : thingAt(this.view, tile);
        this.selected = thing;
        this.doorway = doorway ? { link: doorway.link, end: doorway.end } : undefined;
        this.panel = 'map';
        if (thing || doorway?.at.look === 'mat') {
          this.stroke = {
            tool: 'select',
            start: tile,
            last: tile,
            file: this.view,
            shift: { x: 0, y: 0 },
            ...(thing ? { carrying: thing } : {}),
            ...held,
          };
        }
        this.render();
        return;
      }
      case 'place': {
        // A district and a stretch of Surf water are dragged out; everything
        // else lands on the tile clicked.
        if (this.place.kind === 'district' || this.place.kind === 'surf') {
          this.stroke = {
            tool: 'place',
            start: tile,
            last: tile,
            file: this.view,
            shift: { x: 0, y: 0 },
            ...held,
          };
          this.previewArea({ from: tile, to: tile });
          return;
        }
        const footprint =
          this.place.kind === 'building'
            ? rectangle(tile, {
                x: tile.x + buildingSize(this.place.building).width - 1,
                y: tile.y + buildingSize(this.place.building).height - 1,
              })
            : [tile];
        const before = this.file;
        const growth = this.growFor(before, footprint);
        const at = { x: tile.x + growth.shift.x, y: tile.y + growth.shift.y };
        const outcome =
          this.place.kind === 'building'
            ? placeBuilding(growth.file, this.place.building, at)
            : this.place.kind === 'cut-tree' || this.place.kind === 'smash-rock'
              ? placeDoor(growth.file, this.place.kind, at)
              : placeSpot(growth.file, this.place.kind, at);
        if (outcome.placed) {
          this.panel = 'map';
          this.commitGrown(before, outcome.file, outcome.thing, growth.shift);
        } else {
          this.undoGrowth(before, growth);
          this.render(outcome.reason);
        }
        return;
      }
    }
  }

  private pointerMove(event: PointerEvent, canvas: HTMLElement): void {
    const stroke = this.stroke;
    if (!stroke) {
      this.hover(this.tileAt(event, canvas));
      return;
    }
    stroke.pointer = { clientX: event.clientX, clientY: event.clientY };
    const step = this.edgeScrollStep(stroke.pointer);
    if ((step.x !== 0 || step.y !== 0) && this.edgeScroll === undefined) {
      this.edgeScroll = setInterval(() => this.followStroke(), EDGE_SCROLL_MS);
    }
    this.extendStroke(this.visibleTileAt(stroke.pointer, canvas, stroke.tool));
  }

  /** Carries the stroke in progress on to `tile`. */
  private extendStroke(tile: GridPoint): void {
    const stroke = this.stroke;
    if (!stroke || (tile.x === stroke.last.x && tile.y === stroke.last.y)) {
      return;
    }
    if (stroke.tool === 'brush') {
      const tiles = line(stroke.last, tile);
      const growth = this.growFor(stroke.file, tiles);
      const by = growth.shift;
      stroke.file = paintWith(
        growth.file,
        tiles.map((point) => ({ x: point.x + by.x, y: point.y + by.y })),
        this.brush(),
      );
      stroke.start = { x: stroke.start.x + by.x, y: stroke.start.y + by.y };
      stroke.last = { x: tile.x + by.x, y: tile.y + by.y };
      stroke.shift = { x: stroke.shift.x + by.x, y: stroke.shift.y + by.y };
      this.redraw(stroke.file);
    } else if (stroke.tool === 'rect' || stroke.tool === 'place') {
      stroke.last = tile;
      this.previewArea({ from: stroke.start, to: tile });
    } else if (stroke.tool === 'select' && stroke.carrying) {
      stroke.last = tile;
      this.previewArea(this.footprint(stroke.carrying, tile));
    } else if (stroke.tool === 'select' && this.doorway) {
      // A mat is carried along the room's bottom row and nowhere else.
      stroke.last = { x: tile.x, y: this.view.height - 1 };
      this.previewArea({ from: stroke.last, to: stroke.last });
    }
  }

  private pointerUp(event: PointerEvent, canvas: HTMLElement): void {
    const stroke = this.stroke;
    this.stroke = undefined;
    this.stopEdgeScroll();
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!stroke) {
      return;
    }
    // The place on screen as it was before the stroke: outdoors, the map grows
    // with it; an inside does not grow, and is resized by its own fields.
    const before = this.view;
    if (stroke.tool === 'brush') {
      this.commitGrown(before, stroke.file, this.selected, stroke.shift);
    } else if (stroke.tool === 'rect') {
      const tiles = rectangle(stroke.start, stroke.last);
      const growth = this.growFor(before, tiles);
      const by = growth.shift;
      this.commitGrown(
        before,
        paintWith(
          growth.file,
          tiles.map((point) => ({ x: point.x + by.x, y: point.y + by.y })),
          this.brush(),
        ),
        this.selected,
        by,
      );
    } else if (stroke.tool === 'place') {
      const growth = this.growFor(before, [stroke.start, stroke.last]);
      const by = growth.shift;
      const from = { x: stroke.start.x + by.x, y: stroke.start.y + by.y };
      const to = { x: stroke.last.x + by.x, y: stroke.last.y + by.y };
      const outcome =
        this.place.kind === 'surf'
          ? placeDoor(growth.file, 'surf', from, to)
          : addDistrict(growth.file, from, to);
      if (outcome.placed) {
        this.commitGrown(before, outcome.file, outcome.thing, by);
      } else {
        this.undoGrowth(before, growth);
        this.render(outcome.reason);
      }
    } else if (stroke.tool === 'select' && stroke.carrying) {
      if (stroke.last.x === stroke.start.x && stroke.last.y === stroke.start.y) {
        this.previewArea(undefined);
        return;
      }
      const area = this.footprint(stroke.carrying, stroke.last);
      const growth = this.growFor(before, [area.from, area.to]);
      const by = growth.shift;
      const to = this.carriedCorner(stroke.carrying, stroke.start, stroke.last);
      // A building outdoors carries the way through its door with it.
      const at = { x: to.x + by.x, y: to.y + by.y };
      const outcome =
        stroke.carrying.kind === 'building' && this.area === undefined
          ? moveBuilding(growth.file, stroke.carrying.index, at)
          : moveThing(growth.file, stroke.carrying, at);
      if (outcome.placed) {
        this.commitGrown(before, outcome.file, outcome.thing, by);
      } else {
        this.undoGrowth(before, growth);
        this.render(outcome.reason);
      }
    } else if (stroke.tool === 'select' && this.doorway) {
      const doorway = this.doorway;
      const next = moveDoorway(this.file, doorway, stroke.last);
      this.previewArea(undefined);
      if (next !== this.file) {
        this.commit(next, undefined);
        this.doorway = doorway;
        this.render();
      }
    }
  }

  /**
   * Commits a map that may have grown from `before`, remembering how far it
   * moved so undo and redo can hold the window still too, and saying so the
   * first time it happens.
   */
  private commitGrown(
    before: MapFile,
    next: MapFile,
    selected: ThingRef | undefined,
    shift: Offset,
  ): void {
    // `before` and `next` are the place on screen; what is kept is the map
    // with that place written back into it.
    const from = this.file;
    const file = withFocusedArea(from, this.area, next);
    const grew = next.width !== before.width || next.height !== before.height;
    if (grew) {
      grownFrom.set(file, { before: from, shift });
    }
    this.history.push(file);
    this.selected = selected;
    this.scheduleAutosave();
    this.render(grew ? `The map grew to ${next.width}x${next.height}.` : undefined);
  }

  /** Puts the window back as it was when a growth made for something refused is not kept. */
  private undoGrowth(before: MapFile, growth: Growth): void {
    if (growth.file !== before) {
      this.holdingTheView(growth.file, { x: -growth.shift.x, y: -growth.shift.y }, () => {
        this.layoutStack(before);
        this.redraw(before);
      });
    }
  }

  /** Drops the stroke in progress, leaving the map as it was before it began. */
  private cancelStroke(): void {
    const stroke = this.stroke;
    this.stroke = undefined;
    this.stopEdgeScroll();
    const canvas = this.mapCanvas();
    if (stroke && canvas?.hasPointerCapture(stroke.pointerId)) {
      canvas.releasePointerCapture(stroke.pointerId);
    }
    if (stroke && (stroke.file.width !== this.view.width || stroke.file.height !== this.view.height)) {
      // The stroke grew the map; dropped, it ungrows, and the window stays on what it showed.
      this.holdingTheView(stroke.file, { x: -stroke.shift.x, y: -stroke.shift.y }, () => {
        this.layoutStack(this.view);
        this.redraw();
      });
      return;
    }
    this.redraw();
  }

  /** Where a carried thing lands: a building or a district keeps the offset it was picked up by. */
  private carriedCorner(thing: ThingRef, start: GridPoint, at: GridPoint): GridPoint {
    const area = this.areaOf(thing);
    if (!area) {
      return at;
    }
    return { x: area.x + at.x - start.x, y: area.y + at.y - start.y };
  }

  /** The tiles a building or a district covers; a one-tile thing has none to speak of. */
  private areaOf(
    thing: ThingRef,
  ): { x: number; y: number; width: number; height: number } | undefined {
    if (thing.kind === 'building') {
      const building = this.view.buildings[thing.index];
      return { x: building.x, y: building.y, ...buildingSize(building.kind) };
    }
    if (thing.kind === 'district') {
      return (this.view.districts ?? [])[thing.index];
    }
    if (thing.kind === 'door') {
      return (this.file.doors ?? [])[thing.index];
    }
    return undefined;
  }

  private footprint(thing: ThingRef, at: GridPoint): { from: GridPoint; to: GridPoint } {
    const area = this.areaOf(thing);
    if (!area) {
      return { from: at, to: at };
    }
    const corner = this.carriedCorner(thing, this.stroke?.start ?? at, at);
    return { from: corner, to: { x: corner.x + area.width - 1, y: corner.y + area.height - 1 } };
  }

  /**
   * One field of the chosen thing, changed. The view names each field after
   * what it writes, so this is the only place a value is read back - and the
   * only place one is turned from what a form holds into what a file holds.
   */
  private changeThing(selected: ThingRef, field: string, typed: string): MapFile {
    const value = plainText(typed);
    switch (field) {
      case 'name':
        return value.trim().length > 0
          ? updateThing(this.view, selected, {
              name: value.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength),
            })
          : this.view;
      case 'description':
        return selected.kind === 'drop-in'
          ? describeDropIn(this.view, selected.index, value)
          : this.view;
      case 'opens': {
        if (selected.kind !== 'exit') {
          return this.view;
        }
        const seconds = Math.round(Number(value));
        return setExitOpens(
          this.view,
          selected.index,
          Number.isFinite(seconds) && seconds > 0
            ? { when: 'after', seconds: Math.min(MAP_FILE_LIMITS.maxExitDelaySeconds, seconds) }
            : { when: 'always' },
        );
      }
      case 'lines':
        return updateThing(this.view, selected, {
          lines: value
            .split('\n')
            .map((line) => line.trim().slice(0, MAP_FILE_LIMITS.maxLineLength))
            .filter((line) => line.length > 0)
            .slice(0, MAP_FILE_LIMITS.maxLines),
        });
      case 'sight': {
        const sight = Math.round(Number(value));
        return updateThing(this.view, selected, {
          sight: Number.isFinite(sight)
            ? Math.max(0, Math.min(MAP_FILE_LIMITS.maxSight, sight))
            : 0,
        });
      }
      case 'wildlife':
        return updateThing(this.view, selected, { wildlife: value === '' ? undefined : value });
      case 'rain':
        return updateThing(this.view, selected, { rain: value === 'rain' });
      case 'hidden':
        return selected.kind === 'item'
          ? setItemHidden(this.view, selected.index, value === 'hidden')
          : this.view;
      case 'level': {
        if (selected.kind !== 'pokemon') {
          return this.view;
        }
        const level = Math.round(Number(value));
        return setPokemonLevel(
          this.view,
          selected.index,
          Number.isFinite(level) && level >= 2
            ? Math.min(MAP_FILE_LIMITS.maxPokemonLevel, level)
            : undefined,
        );
      }
      case 'species':
        return isFigureSpecies(value) ? updateThing(this.view, selected, { species: value }) : this.view;
      case 'look':
      case 'facing':
      case 'kind':
      case 'team':
        return updateThing(this.view, selected, { [field]: value });
      default:
        return this.view;
    }
  }

  /** What the pointer would do, before it does it. */
  private hover(tile: GridPoint): void {
    if (!this.inReach(this.tool, tile)) {
      this.previewArea(undefined);
      return;
    }
    if (this.tool === 'place' && this.place.kind === 'building') {
      const size = buildingSize(this.place.building);
      const to = { x: tile.x + size.width - 1, y: tile.y + size.height - 1 };
      // Past the edge, it fits if the map can grow round it.
      const growth = this.wouldGrow(this.view, [tile, to]);
      const valid = placeBuilding(growth.file, this.place.building, {
        x: tile.x + growth.shift.x,
        y: tile.y + growth.shift.y,
      }).placed;
      this.previewArea(
        { from: tile, to: { x: tile.x + size.width - 1, y: tile.y + size.height - 1 } },
        valid,
      );
      return;
    }
    this.previewArea({ from: tile, to: tile });
  }

  private previewArea(area: { from: GridPoint; to: GridPoint } | undefined, valid = true): void {
    const ghost = this.overlay.root.querySelector<HTMLElement>('[data-ghost]');
    if (!ghost) {
      return;
    }
    if (!area) {
      ghost.hidden = true;
      return;
    }
    const left = Math.min(area.from.x, area.to.x);
    const top = Math.min(area.from.y, area.to.y);
    const at = (tiles: number): string => `calc(var(--u) * ${tiles * this.zoom})`;
    // Placed in the drawing, whose corner is the corner of the room round the map.
    const room = this.roomOf(this.onScreen);
    ghost.style.left = at(left + room.left);
    ghost.style.top = at(top + room.top);
    ghost.style.width = at(Math.max(area.from.x, area.to.x) - left + 1);
    ghost.style.height = at(Math.max(area.from.y, area.to.y) - top + 1);
    ghost.classList.toggle('is-refused', !valid);
    ghost.hidden = false;
  }

  // --- Everything else --------------------------------------------------------

  /**
   * Zooms about `anchor` - the pointer, for the wheel - or the middle of what
   * is in view, so the place being looked at stays where it is on screen.
   */
  private setZoom(
    zoom: MakerZoom,
    anchor?: { readonly clientX: number; readonly clientY: number },
  ): void {
    const viewport = this.viewport();
    const before = this.mapCanvas()?.getBoundingClientRect();
    if (!viewport || !before || before.width === 0) {
      this.zoom = zoom;
      this.render();
      return;
    }
    const seen = viewport.getBoundingClientRect();
    const at = anchor ?? {
      clientX: seen.left + viewport.clientWidth / 2,
      clientY: seen.top + viewport.clientHeight / 2,
    };
    // Where the anchor is on the map, in tiles, fractions and all.
    const file = this.file;
    const tile = {
      x: ((at.clientX - before.left) / before.width) * file.width,
      y: ((at.clientY - before.top) / before.height) * file.height,
    };
    this.zoom = zoom;
    this.render();
    const next = this.viewport();
    const after = this.mapCanvas()?.getBoundingClientRect();
    if (next && after) {
      next.scrollLeft += after.left + (tile.x / file.width) * after.width - at.clientX;
      next.scrollTop += after.top + (tile.y / file.height) * after.height - at.clientY;
    }
    this.showOverview();
  }

  /** The biggest zoom at which the whole map is in view, and the map in the middle of it. */
  private fitWhole(): void {
    const viewport = this.viewport();
    const map = this.mapCanvas();
    if (!viewport || !map) {
      return;
    }
    const unit = map.getBoundingClientRect().width / (this.file.width * this.zoom);
    const zoom =
      [...MAKER_ZOOMS]
        .reverse()
        .find(
          (level) =>
            this.file.width * level * unit <= viewport.clientWidth &&
            this.file.height * level * unit <= viewport.clientHeight,
        ) ?? MAKER_ZOOMS[0];
    if (zoom !== this.zoom) {
      this.zoom = zoom;
      this.render();
    }
    this.lookAtMap();
    this.showOverview();
  }

  /**
   * The biggest zoom at which the whole width of the map is in view, so a map
   * opens as a picture of itself rather than as its top-left corner.
   */
  private fitZoom(): void {
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    const map = this.mapCanvas();
    if (!viewport || !map || viewport.clientWidth === 0) {
      return;
    }
    const unit = map.getBoundingClientRect().width / (this.view.width * this.zoom);
    // Never below half size on its own: at a quarter a tile is four pixels,
    // too small to paint, and a wide map is better scrolled than squinted at.
    // The maker can still zoom out to see the whole of it.
    const fits = [...MAKER_ZOOMS]
      .reverse()
      .find((zoom) => zoom <= 16 && this.view.width * zoom * unit <= viewport.clientWidth);
    const zoom = Math.max(fits ?? 8, 8) as MakerZoom;
    if (zoom !== this.zoom) {
      this.zoom = zoom;
      this.render();
    }
    this.lookAtMap();
  }

  /**
   * Scrolls the window onto the map: the whole of it in the middle when it
   * fits, else its top-left corner with a little of the room round it showing,
   * so a maker can see there is somewhere past the edge to draw.
   */
  private lookAtMap(): void {
    const viewport = this.viewport();
    const map = this.mapCanvas();
    if (!viewport || !map) {
      return;
    }
    const box = map.getBoundingClientRect();
    const seen = viewport.getBoundingClientRect();
    const tilePx = box.width / Math.max(1, this.file.width);
    const along = (start: number, size: number, viewStart: number, viewSize: number): number =>
      size <= viewSize ? start + size / 2 - (viewStart + viewSize / 2) : start - 2 * tilePx - viewStart;
    viewport.scrollLeft += along(box.left, box.width, seen.left, viewport.clientWidth);
    viewport.scrollTop += along(box.top, box.height, seen.top, viewport.clientHeight);
  }

  private undo(): void {
    const from = this.file;
    this.history.undo();
    this.doorway = undefined;
    this.afterTimeTravel(from, this.file);
  }

  private redo(): void {
    const from = this.file;
    this.history.redo();
    this.afterTimeTravel(from, this.file);
  }

  /**
   * Shows the map undo or redo landed on. Across a stroke that grew the map
   * the ground moves by how far it grew, and the window moves with it.
   */
  private afterTimeTravel(from: MapFile, to: MapFile): void {
    this.selected = undefined;
    this.doorway = undefined;
    this.scheduleAutosave();
    const undone = grownFrom.get(from);
    const redone = grownFrom.get(to);
    const shift =
      undone?.before === to
        ? { x: -undone.shift.x, y: -undone.shift.y }
        : redone?.before === from
          ? redone.shift
          : { x: 0, y: 0 };
    this.holdingTheView(from, shift, () => this.render());
  }

  private openDraft(key: string): void {
    const draft = this.store.drafts.find((candidate) => candidate.key === key);
    if (!draft) {
      return;
    }
    this.flushAutosave();
    this.rememberView();
    this.draftKey = draft.key;
    this.openHistory(draft.file);
    this.store = { ...this.store, current: draft.key };
    saveMakerStore(this.store);
    this.selected = undefined;
    this.area = undefined;
    this.doorway = undefined;
    this.panel = 'map';
    this.render();
    this.restoreView();
  }

  /** Two presses: a draft deleted is gone from this browser for good. */
  private deleteDraft(button: HTMLElement, key: string): void {
    if (this.pendingDelete !== key) {
      this.pendingDelete = key;
      button.textContent = 'Delete for good';
      return;
    }
    this.pendingDelete = undefined;
    this.store = withoutDraft(this.store, key);
    saveMakerStore(this.store);
    sessionHistories.delete(key);
    sessionViews.delete(key);
    this.render('Draft deleted.');
  }

  private download(): void {
    this.flushAutosave();
    const blob = new Blob([mapFileText(this.file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.file.id}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    this.render(`Saved as ${this.file.id}.json.`);
  }

  private openFileText(text: string, name: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.render(`${name} is not a map file.`);
      return;
    }
    const reading = readMapFile(parsed, { draft: true });
    if (!reading.ok) {
      this.render(`${name} cannot be opened: ${reading.problems[0]}`);
      return;
    }
    this.flushAutosave();
    this.rememberView();
    this.draftKey = newDraftKey(this.store);
    this.openHistory(reading.file);
    this.store = withDraft(this.store, {
      key: this.draftKey,
      file: reading.file,
      updatedAt: Date.now(),
    });
    saveMakerStore(this.store);
    this.selected = undefined;
    this.area = undefined;
    this.doorway = undefined;
    this.panel = 'map';
    this.render(`Opened ${name}.`);
    this.fitZoom();
  }

  private openPanel(panel: MakerPanel): void {
    this.flushAutosave();
    this.pendingDelete = undefined;
    this.panel = panel;
    if (panel === 'review') {
      this.review = { step: 'checking' };
      void this.loadReview();
    }
    if (panel === 'sent') {
      this.sent = { step: 'loading' };
      void sentMaps().then((result) => {
        this.sent = result.ok
          ? { step: 'loaded', maps: result.value }
          : { step: 'failed', reason: result.reason };
        if (this.scene.isActive() && this.panel === 'sent') {
          this.render();
        }
      });
    }
    this.render();
  }

  /**
   * Opens the send panel: first asks whether this draft has been sent before
   * and what became of it, because a map still waiting is not sent twice and a
   * map sent back goes in again as its next version.
   */
  private openSend(): void {
    if (!this.currentChecks().every((check) => check.passed) || !this.walkedOut()) {
      this.render('Pass every check first, walking out of it in TRY IT included.');
      return;
    }
    const refusal = sendRefusal(this.file);
    if (refusal) {
      this.render(refusal);
      return;
    }
    this.flushAutosave();
    this.panel = 'send';
    this.sending = { step: 'checking' };
    this.render();
    const receipt = this.store.drafts.find((draft) => draft.key === this.draftKey)?.sentAs;
    void (async () => {
      const signedIn = await isSignedIn().catch(() => false);
      let previous: { receipt: string; status: SubmissionStatus } | undefined;
      if (receipt && signedIn) {
        const result = await sentMaps();
        const found = result.ok
          ? result.value.find((map) => map.receiptCode === receipt)
          : undefined;
        if (found) {
          previous = { receipt, status: found.status };
        }
      }
      this.sending = {
        step: 'ready',
        ...(previous ? { previous } : {}),
        needsCheck: botCheckNeeded() && !signedIn && this.captchaToken === undefined,
      };
      if (this.scene.isActive() && this.panel === 'send') {
        this.render();
      }
    })();
  }

  /** Puts the bot check on screen when the send panel is waiting for one. */
  private showBotCheck(): void {
    const container = this.overlay.root.querySelector<HTMLElement>('[data-captcha]');
    if (!container || this.sending.step !== 'ready' || !this.sending.needsCheck) {
      return;
    }
    void passBotCheck(container).then((token) => {
      if (token && this.sending.step === 'ready') {
        this.captchaToken = token;
        this.sending = { ...this.sending, needsCheck: false };
        if (this.scene.isActive() && this.panel === 'send') {
          this.render();
        }
      }
    });
  }

  private async confirmSend(): Promise<void> {
    const sending = this.sending;
    if (sending.step !== 'ready' || sending.previous?.status === 'waiting') {
      return;
    }
    if (sending.needsCheck) {
      this.render('Pass the bot check first.');
      return;
    }
    const file = this.file;
    const key = this.draftKey;
    this.sending = { step: 'sending' };
    this.render();
    const result = await sendMap(file, {
      ...(this.captchaToken ? { captchaToken: this.captchaToken } : {}),
      ...(sending.previous?.status === 'sent_back' ? { resubmits: sending.previous.receipt } : {}),
    });
    // A bot check's token is good for one sign-in, used or refused.
    this.captchaToken = undefined;
    if (result.ok) {
      const store = loadMakerStore();
      this.store = {
        ...store,
        drafts: store.drafts.map((draft) =>
          draft.key === key ? { ...draft, sentAs: result.value } : draft,
        ),
      };
      saveMakerStore(this.store);
      this.sending = { step: 'sent', receipt: result.value };
    } else {
      this.sending = { step: 'failed', reason: result.reason };
    }
    if (this.scene.isActive() && this.panel === 'send') {
      this.render();
    }
  }

  /** Asks the database who is here and, for a reviewer, what has been sent in. */
  private async loadReview(reason?: string): Promise<void> {
    const access = await reviewAccess();
    if (access !== 'reviewer') {
      this.review = { step: access };
    } else {
      const queue = await reviewQueue();
      this.review = queue.ok
        ? { step: 'loaded', maps: queue.value, ...(reason ? { reason } : {}) }
        : { step: 'failed', reason: queue.reason };
      if (queue.ok && this.reviewing) {
        this.reviewing = queue.value.find((map) => map.id === this.reviewing?.id) ?? this.reviewing;
      }
    }
    if (this.scene.isActive() && this.panel === 'review') {
      this.render();
    }
  }

  /**
   * Opens a map sent in, in the editor, as a draft of the reviewer's own: it can
   * be played with TRY IT and fixed before it is approved, and nothing done to
   * it reaches the maker until a decision is made.
   */
  private openForReview(id: string): void {
    if (this.review.step !== 'loaded') {
      return;
    }
    const map = this.review.maps.find((candidate) => candidate.id === id);
    if (!map?.file) {
      return;
    }
    this.flushAutosave();
    const key = `review-${map.receiptCode}`;
    const kept = this.store.drafts.find((draft) => draft.key === key);
    this.rememberView();
    this.draftKey = key;
    this.openHistory(kept?.file ?? map.file);
    this.store = withDraft(this.store, kept ?? { key, file: map.file, updatedAt: Date.now() });
    saveMakerStore(this.store);
    this.reviewing = map;
    this.selected = undefined;
    this.pendingBlock = false;
    this.render();
    this.fitZoom();
  }

  private async decideReview(decision: ReviewDecision): Promise<void> {
    const reviewing = this.reviewing;
    if (!reviewing) {
      return;
    }
    if (decision === 'approved' && !this.currentChecks().every((check) => check.passed)) {
      this.render('It must pass every check before it is approved.');
      return;
    }
    const note =
      this.overlay.root.querySelector<HTMLTextAreaElement>('[data-review-note]')?.value ?? '';
    this.flushAutosave();
    const result = await decide(
      reviewing.id,
      decision,
      note,
      decision === 'approved' ? this.file : undefined,
    );
    const said = {
      approved: 'Approved.',
      sent_back: 'Sent back to its maker.',
      rejected: 'Turned down.',
    }[decision];
    await this.loadReview(result.ok ? undefined : result.reason);
    if (result.ok) {
      this.render(said);
    }
  }

  /** Two presses: a blocked maker can send nothing more. */
  private async blockReviewedMaker(button: HTMLElement): Promise<void> {
    const reviewing = this.reviewing;
    if (!reviewing) {
      return;
    }
    if (!this.pendingBlock) {
      this.pendingBlock = true;
      button.textContent = 'Block for good';
      return;
    }
    this.pendingBlock = false;
    const note =
      this.overlay.root.querySelector<HTMLTextAreaElement>('[data-review-note]')?.value ?? '';
    const result = await blockMaker(reviewing.makerUid, note);
    this.render(result.ok ? `${reviewing.makerName} can send no more maps.` : result.reason);
  }

  /** Whether the maker has walked out of this version of the map in TRY IT. */
  private walkedOut(): boolean {
    const draft = this.store.drafts.find((candidate) => candidate.key === this.draftKey);
    return draft?.walkedOut !== undefined && draft.walkedOut === walkedVersion(this.file);
  }

  /**
   * Plays the draft in the real game: registered as a map, deployed onto with
   * the explorer run's team, in a save of its own (`maker/tryIt.ts`).
   */
  private tryIt(rules: TryRules): void {
    if (!this.currentChecks().every((check) => check.passed)) {
      this.render('Make the map pass the checks first.');
      return;
    }
    this.flushAutosave();
    this.rememberView();
    const attempt = beginTry(this.draftKey, this.file, rules);
    registerPlayerMap(attempt.map);
    const insertion =
      (this.selected?.kind === 'drop-in'
        ? attempt.map.insertions[this.selected.index]
        : undefined) ?? attempt.map.insertions[0];
    setActiveSaveSlot('try-it');
    setTryItRules(rules === 'walk');
    const saves = new SaveManager();
    saves.clear();
    saves.save(createPlaytestGame());
    // The explorer run's partner and two of its bench, read back out of the
    // try's own save so the raid settles against the stash it came from:
    // enough to see the map, never so few that a wild roll ends the try.
    const stash = saves.load()?.stash ?? createPlaytestStash();
    const team = stash.listPokemon().slice(0, 3);
    const party = team.map((stored) => stored.pokemon);
    const items = [
      { itemId: 'potion', quantity: 5 },
      { itemId: 'poke-ball', quantity: 5 },
    ] as const;
    const packItemId = 'raid-pack';
    activeRunManager.startRun(
      { party, items: [...items], packItemId },
      {
        mapId: insertion.mapId,
        durationMs: rules === 'walk' ? PLAYTEST_RAID_DURATION_MS : RAID_DURATION_MS,
      },
    );
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const plan = generateRunPlan(seed, undefined, insertion.id, undefined, hunterThreatFor(party));
    const runSession = createActiveRunSession(
      activeRunManager,
      {},
      {},
      team.map((stored) => stored.id),
      [...items],
      [],
      plan,
      [],
      packItemId,
    );
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('world', {
        party: new PokemonParty(party),
        bag: new Bag(
          Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])),
          packGridFor(packItemId),
        ),
        runSession,
      });
    });
  }

  private leave(): void {
    this.flushAutosave();
    this.rememberView();
    this.scene.start('title');
  }

  private handleKey(event: KeyboardEvent): void {
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (this.stroke && key !== 'escape') {
      // A stroke is finished by letting go or dropped with Escape; an undo, a
      // removal or a change of tool under it would be undone by its ending.
      if (command) {
        event.preventDefault();
      }
      return;
    }
    if (command && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }
    if (command && key === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    if (command || event.altKey) {
      return;
    }
    if (key === ' ' && this.pointerOverMap && !this.stroke) {
      // Space held over the map moves it by hand, as in every drawing program,
      // rather than pressing whichever tool the cursor is on.
      event.preventDefault();
      this.spaceHeld = true;
      this.overlay.root.querySelector('[data-stack]')?.classList.add('is-panning');
      return;
    }
    if (key === 'escape') {
      // Escape is "not that": it drops a stroke half drawn, then the choice,
      // then a panel. It never leaves - that is the TITLE button - because
      // the reflex key for cancelling a box once cost the maker the screen.
      event.preventDefault();
      if (this.stroke) {
        this.cancelStroke();
      } else if (this.selected || this.doorway) {
        this.selected = undefined;
        this.doorway = undefined;
        this.render();
      } else if (this.panel !== 'map') {
        this.openPanel('map');
      }
      return;
    }
    if ((key === 'delete' || key === 'backspace') && (this.selected || this.doorway)) {
      event.preventDefault();
      this.removeSelected();
      return;
    }
    const tools: Readonly<Record<string, MakerTool>> = {
      b: 'brush',
      r: 'rect',
      f: 'fill',
      i: 'pick',
      v: 'select',
      x: 'erase',
    };
    if (tools[key]) {
      this.tool = tools[key];
      this.render();
      return;
    }
    if (key === '+' || key === '=' || key === '-') {
      const index = MAKER_ZOOMS.indexOf(this.zoom) + (key === '-' ? -1 : 1);
      const zoom = MAKER_ZOOMS[Math.max(0, Math.min(MAKER_ZOOMS.length - 1, index))];
      if (zoom !== this.zoom) {
        this.setZoom(zoom);
      }
      return;
    }
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }
}
