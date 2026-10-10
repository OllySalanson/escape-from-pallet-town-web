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
  placeSpot,
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
  type GridPoint,
  type SpotKind,
  type ThingRef,
} from '../maker/draft';
import {
  loadMakerStore,
  mapFileText,
  walkedVersion,
  lastMakerName,
  newDraftKey,
  saveMakerStore,
  withDraft,
  withoutDraft,
  type MakerStore,
} from '../maker/drafts';
import { EditHistory } from '../maker/history';
import { drawMap, drawPreview, drawSwatch, layersFor, loadMakerSheets } from '../maker/mapCanvas';

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
import { isSignedIn, sendMap, sentMaps, type SubmissionStatus } from '../maker/submissions';
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
} from '../maker/makerView';
import { GROUND_BRUSHES, groundBrush, groundUnder } from '../maker/palette';
import { MenuOverlay } from '../ui/MenuOverlay';
import { takeDownPixelStatus } from '../ui/pixelUi';
import {
  MAP_FILE_LIMITS,
  plainText,
  readMapFile,
  type MapFile,
  type MapFileBuildingKind,
  type MapFileHabitat,
} from '../world/mapFile';
import { checkMapFile, type MapCheck } from '../world/mapFileChecks';
import type { MapLayers } from '../world/tiles';

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

/** How often the map window scrolls while a stroke is held past its edge. */
const EDGE_SCROLL_MS = 30;
/** The most the window moves in one of those ticks, in screen pixels. */
const EDGE_SCROLL_MAX_PX = 24;

interface Stroke {
  readonly tool: MakerTool;
  readonly start: GridPoint;
  last: GridPoint;
  file: MapFile;
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
  private brushId = GROUND_BRUSHES[0].id;
  private place: PlaceChoice = { kind: 'drop-in' };
  private selected: ThingRef | undefined;
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
  private layers: { readonly file: MapFile; readonly layers: MapLayers } | undefined;
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
    this.stroke = undefined;
    this.stopEdgeScroll();
    this.panel = 'map';
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pagehide', this.flushOnLeave);
      document.removeEventListener('visibilitychange', this.flushOnLeave);
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
        this.redraw();
      }
    });
  }

  private get file(): MapFile {
    return this.history.value;
  }

  private startNewDraft(): void {
    this.draftKey = newDraftKey(this.store);
    const file = setMaker(blankMap(), lastMakerName(this.store));
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
    saveMakerStore(this.store);
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
    // Undo, redo or an edit can take away what was chosen; a choice of nothing
    // is no choice.
    if (this.selected && !thingExists(this.file, this.selected)) {
      this.selected = undefined;
    }
    const typedIn = this.fieldWithFocus();
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    const scroll = viewport ? { left: viewport.scrollLeft, top: viewport.scrollTop } : undefined;
    const sideTop = this.overlay.root.querySelector<HTMLElement>('.maker-side')?.scrollTop;
    this.rendering = true;
    try {
      this.overlay.root.innerHTML = this.screenMarkup(status);
    } finally {
      this.rendering = false;
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
      tool: this.tool,
      brushId: this.brushId,
      place: this.place,
      selected: this.selected,
      zoom: this.zoom,
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

  private layersOf(file: MapFile): MapLayers {
    if (this.layers?.file !== file) {
      this.layers = { file, layers: layersFor(file) };
    }
    return this.layers.layers;
  }

  private redraw(file: MapFile = this.file): void {
    const canvas = this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-map]');
    const context = canvas?.getContext('2d');
    if (!context) {
      return;
    }
    drawMap(context, file, this.layersOf(file), this.selected);
    const preview = this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-preview]');
    const previewContext = preview?.getContext('2d');
    if (previewContext) {
      drawPreview(previewContext, file, undefined, true);
    }
  }

  private drawSwatches(): void {
    this.overlay.root
      .querySelectorAll<HTMLCanvasElement>('canvas[data-swatch]')
      .forEach((canvas) => {
        drawSwatch(canvas, canvas.dataset.swatch ?? '.');
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
          : { kind: kind as SpotKind | 'district' };
      this.tool = 'place';
      this.render();
    });
    on('[data-zoom]', (element) => this.setZoom(Number(element.dataset.zoom) as MakerZoom));
    on('[data-undo]', () => this.undo());
    on('[data-redo]', () => this.redo());
    on('[data-new]', () => {
      this.flushAutosave();
      this.rememberView();
      this.startNewDraft();
      this.selected = undefined;
      this.panel = 'map';
      this.render('A new map. Your last one is in your drafts.');
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
    on('[data-remove-selected]', () => {
      if (this.selected) {
        this.commit(removeThing(this.file, this.selected), undefined);
      }
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
    const selected = this.selected;
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]')
      .forEach((input) => {
        bind(input, (value) =>
          selected ? this.changeThing(selected, input.dataset.field ?? '', value) : this.file,
        );
      });

    const preview = root.querySelector<HTMLCanvasElement>('canvas[data-preview]');
    if (preview) {
      preview.addEventListener('pointerdown', (event) => this.pointerDown(event, preview));
      preview.addEventListener('pointermove', (event) => this.pointerMove(event, preview));
      preview.addEventListener('pointerup', (event) => this.pointerUp(event, preview));
      preview.addEventListener('pointercancel', () => this.cancelStroke());
      preview.addEventListener('pointerleave', () => {
        if (!this.stroke) {
          this.previewArea(undefined);
        }
      });
    }
  }

  // --- Drawing on the map --------------------------------------------------------

  private tileAt(
    point: { readonly clientX: number; readonly clientY: number },
    canvas: HTMLCanvasElement,
  ): GridPoint {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((point.clientX - box.left) / box.width) * this.file.width),
      y: Math.floor(((point.clientY - box.top) / box.height) * this.file.height),
    };
  }

  /**
   * The tile under the pointer, held to the part of the map the maker can see.
   * A stroke keeps the pointer after it leaves the map window, so dragged past
   * the window's edge it painted ground scrolled out of sight; held to the edge
   * it paints along it instead, and the window scrolls to show more
   * (`followStroke`).
   */
  private visibleTileAt(
    point: { readonly clientX: number; readonly clientY: number },
    canvas: HTMLCanvasElement,
  ): GridPoint {
    const map = canvas.getBoundingClientRect();
    const seen = this.viewport()?.getBoundingClientRect() ?? map;
    const left = Math.max(map.left, seen.left);
    const top = Math.max(map.top, seen.top);
    // Half a pixel in from the far edges, so a pointer held there is on the
    // last tile in view rather than the first one past it.
    const right = Math.min(map.right, seen.right) - 0.5;
    const bottom = Math.min(map.bottom, seen.bottom) - 0.5;
    const tile = this.tileAt(
      {
        clientX: Math.min(Math.max(point.clientX, left), Math.max(left, right)),
        clientY: Math.min(Math.max(point.clientY, top), Math.max(top, bottom)),
      },
      canvas,
    );
    return {
      x: Math.min(Math.max(tile.x, 0), this.file.width - 1),
      y: Math.min(Math.max(tile.y, 0), this.file.height - 1),
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
        : Math.sign(distance) * Math.min(EDGE_SCROLL_MAX_PX, Math.max(2, Math.abs(distance) / 3));
    return {
      x: speed(past(point.clientX, box.left, box.right)),
      y: speed(past(point.clientY, box.top, box.bottom)),
    };
  }

  /** Scrolls the window on towards a stroke held past its edge, and carries the stroke with it. */
  private followStroke(): void {
    const stroke = this.stroke;
    const viewport = this.viewport();
    const canvas = this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-preview]');
    if (!stroke || !viewport || !canvas) {
      this.stopEdgeScroll();
      return;
    }
    const step = this.edgeScrollStep(stroke.pointer);
    const before = { left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.scrollLeft += step.x;
    viewport.scrollTop += step.y;
    if (viewport.scrollLeft === before.left && viewport.scrollTop === before.top) {
      // At the end of the map, or back inside the window: nothing more to show.
      this.stopEdgeScroll();
      return;
    }
    this.extendStroke(this.visibleTileAt(stroke.pointer, canvas));
  }

  private stopEdgeScroll(): void {
    if (this.edgeScroll !== undefined) {
      clearInterval(this.edgeScroll);
      this.edgeScroll = undefined;
    }
  }

  private inMap({ x, y }: GridPoint): boolean {
    return x >= 0 && y >= 0 && x < this.file.width && y < this.file.height;
  }

  private brush() {
    return groundBrush(this.brushId) ?? GROUND_BRUSHES[0];
  }

  private pointerDown(event: PointerEvent, canvas: HTMLCanvasElement): void {
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
    if (!this.inMap(tile)) {
      return;
    }
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
        const file = paintWith(this.file, [tile], this.brush());
        this.stroke = { tool: 'brush', start: tile, last: tile, file, ...held };
        this.redraw(file);
        return;
      }
      case 'rect':
        this.stroke = { tool: 'rect', start: tile, last: tile, file: this.file, ...held };
        this.previewArea({ from: tile, to: tile });
        return;
      case 'fill':
        this.commit(paintWith(this.file, fillRegion(this.file, tile), this.brush()), this.selected);
        return;
      case 'pick': {
        const letter = groundAt(this.file, tile) ?? '.';
        const picked =
          GROUND_BRUSHES.find((brush) => brush.letterFor(groundUnder(letter)) === letter) ??
          GROUND_BRUSHES.find((brush) => brush.swatch === groundUnder(letter));
        if (picked) {
          this.brushId = picked.id;
          this.tool = 'brush';
          this.render();
        }
        return;
      }
      case 'erase': {
        const thing = thingAt(this.file, tile);
        if (thing) {
          this.commit(removeThing(this.file, thing), undefined);
        }
        return;
      }
      case 'select': {
        const thing = thingAt(this.file, tile);
        this.selected = thing;
        this.panel = 'map';
        if (thing) {
          this.stroke = {
            tool: 'select',
            start: tile,
            last: tile,
            file: this.file,
            carrying: thing,
            ...held,
          };
        }
        this.render();
        return;
      }
      case 'place': {
        if (this.place.kind === 'district') {
          this.stroke = { tool: 'place', start: tile, last: tile, file: this.file, ...held };
          this.previewArea({ from: tile, to: tile });
          return;
        }
        const outcome =
          this.place.kind === 'building'
            ? placeBuilding(this.file, this.place.building, tile)
            : placeSpot(this.file, this.place.kind, tile);
        if (outcome.placed) {
          this.panel = 'map';
          this.commit(outcome.file, outcome.thing);
        } else {
          this.render(outcome.reason);
        }
        return;
      }
    }
  }

  private pointerMove(event: PointerEvent, canvas: HTMLCanvasElement): void {
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
    this.extendStroke(this.visibleTileAt(stroke.pointer, canvas));
  }

  /** Carries the stroke in progress on to `tile`. */
  private extendStroke(tile: GridPoint): void {
    const stroke = this.stroke;
    if (!stroke || (tile.x === stroke.last.x && tile.y === stroke.last.y)) {
      return;
    }
    if (stroke.tool === 'brush') {
      stroke.file = paintWith(stroke.file, line(stroke.last, tile), this.brush());
      stroke.last = tile;
      this.redraw(stroke.file);
    } else if (stroke.tool === 'rect' || stroke.tool === 'place') {
      stroke.last = tile;
      this.previewArea({ from: stroke.start, to: tile });
    } else if (stroke.tool === 'select' && stroke.carrying) {
      stroke.last = tile;
      this.previewArea(this.footprint(stroke.carrying, tile));
    }
  }

  private pointerUp(event: PointerEvent, canvas: HTMLCanvasElement): void {
    const stroke = this.stroke;
    this.stroke = undefined;
    this.stopEdgeScroll();
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!stroke) {
      return;
    }
    if (stroke.tool === 'brush') {
      this.commit(stroke.file, this.selected);
    } else if (stroke.tool === 'rect') {
      this.commit(
        paintWith(this.file, rectangle(stroke.start, stroke.last), this.brush()),
        this.selected,
      );
    } else if (stroke.tool === 'place') {
      const outcome = addDistrict(this.file, stroke.start, stroke.last);
      if (outcome.placed) {
        this.commit(outcome.file, outcome.thing);
      } else {
        this.render(outcome.reason);
      }
    } else if (stroke.tool === 'select' && stroke.carrying) {
      if (stroke.last.x === stroke.start.x && stroke.last.y === stroke.start.y) {
        this.previewArea(undefined);
        return;
      }
      const to = this.carriedCorner(stroke.carrying, stroke.start, stroke.last);
      const outcome = moveThing(this.file, stroke.carrying, to);
      if (outcome.placed) {
        this.commit(outcome.file, outcome.thing);
      } else {
        this.render(outcome.reason);
      }
    }
  }

  /** Drops the stroke in progress, leaving the map as it was before it began. */
  private cancelStroke(): void {
    const stroke = this.stroke;
    this.stroke = undefined;
    this.stopEdgeScroll();
    const canvas = this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-preview]');
    if (stroke && canvas?.hasPointerCapture(stroke.pointerId)) {
      canvas.releasePointerCapture(stroke.pointerId);
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
      const building = this.file.buildings[thing.index];
      return { x: building.x, y: building.y, ...buildingSize(building.kind) };
    }
    if (thing.kind === 'district') {
      return (this.file.districts ?? [])[thing.index];
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
          ? updateThing(this.file, selected, {
              name: value.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength),
            })
          : this.file;
      case 'description':
        return selected.kind === 'drop-in'
          ? describeDropIn(this.file, selected.index, value)
          : this.file;
      case 'opens': {
        if (selected.kind !== 'exit') {
          return this.file;
        }
        const seconds = Math.round(Number(value));
        return setExitOpens(
          this.file,
          selected.index,
          Number.isFinite(seconds) && seconds > 0
            ? { when: 'after', seconds: Math.min(MAP_FILE_LIMITS.maxExitDelaySeconds, seconds) }
            : { when: 'always' },
        );
      }
      case 'lines':
        return updateThing(this.file, selected, {
          lines: value
            .split('\n')
            .map((line) => line.trim().slice(0, MAP_FILE_LIMITS.maxLineLength))
            .filter((line) => line.length > 0)
            .slice(0, MAP_FILE_LIMITS.maxLines),
        });
      case 'sight': {
        const sight = Math.round(Number(value));
        return updateThing(this.file, selected, {
          sight: Number.isFinite(sight)
            ? Math.max(0, Math.min(MAP_FILE_LIMITS.maxSight, sight))
            : 0,
        });
      }
      case 'wildlife':
        return updateThing(this.file, selected, { wildlife: value === '' ? undefined : value });
      case 'look':
      case 'facing':
      case 'kind':
      case 'team':
        return updateThing(this.file, selected, { [field]: value });
      default:
        return this.file;
    }
  }

  /** What the pointer would do, before it does it. */
  private hover(tile: GridPoint): void {
    if (!this.inMap(tile)) {
      this.previewArea(undefined);
      return;
    }
    if (this.tool === 'place' && this.place.kind === 'building') {
      const size = buildingSize(this.place.building);
      const valid = placeBuilding(this.file, this.place.building, tile).placed;
      this.previewArea(
        { from: tile, to: { x: tile.x + size.width - 1, y: tile.y + size.height - 1 } },
        valid,
      );
      return;
    }
    this.previewArea({ from: tile, to: tile });
  }

  private previewArea(area: { from: GridPoint; to: GridPoint } | undefined, valid = true): void {
    const preview = this.overlay.root.querySelector<HTMLCanvasElement>('canvas[data-preview]');
    const context = preview?.getContext('2d');
    if (context) {
      drawPreview(context, this.file, area, valid);
    }
  }

  // --- Everything else --------------------------------------------------------

  private setZoom(zoom: MakerZoom): void {
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    // Zoom about the middle of what is in view, so the place being looked at stays put.
    const ratio = zoom / this.zoom;
    const middle = viewport
      ? {
          x: viewport.scrollLeft + viewport.clientWidth / 2,
          y: viewport.scrollTop + viewport.clientHeight / 2,
        }
      : undefined;
    this.zoom = zoom;
    this.render();
    const next = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    if (next && middle) {
      next.scrollLeft = middle.x * ratio - next.clientWidth / 2;
      next.scrollTop = middle.y * ratio - next.clientHeight / 2;
    }
  }

  /**
   * The biggest zoom at which the whole width of the map is in view, so a map
   * opens as a picture of itself rather than as its top-left corner.
   */
  private fitZoom(): void {
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    const stack = viewport?.querySelector<HTMLElement>('.maker-stack');
    if (!viewport || !stack || viewport.clientWidth === 0) {
      return;
    }
    const unit = stack.getBoundingClientRect().width / (this.file.width * this.zoom);
    // Never below half size on its own: at a quarter a tile is four pixels,
    // too small to paint, and a wide map is better scrolled than squinted at.
    // The maker can still zoom out to see the whole of it.
    const fits = [...MAKER_ZOOMS]
      .reverse()
      .find((zoom) => zoom <= 16 && this.file.width * zoom * unit <= viewport.clientWidth);
    const zoom = Math.max(fits ?? 8, 8) as MakerZoom;
    if (zoom !== this.zoom) {
      this.zoom = zoom;
      this.render();
    }
  }

  private undo(): void {
    this.history.undo();
    this.selected = undefined;
    this.scheduleAutosave();
    this.render();
  }

  private redo(): void {
    this.history.redo();
    this.selected = undefined;
    this.scheduleAutosave();
    this.render();
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
    if (key === 'escape') {
      // Escape is "not that": it drops a stroke half drawn, then the choice,
      // then a panel. It never leaves - that is the TITLE button - because
      // the reflex key for cancelling a box once cost the maker the screen.
      event.preventDefault();
      if (this.stroke) {
        this.cancelStroke();
      } else if (this.selected) {
        this.selected = undefined;
        this.render();
      } else if (this.panel !== 'map') {
        this.openPanel('map');
      }
      return;
    }
    if ((key === 'delete' || key === 'backspace') && this.selected) {
      event.preventDefault();
      this.commit(removeThing(this.file, this.selected), undefined);
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
