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
  renamePlace,
  resizeMap,
  setExitOpens,
  setMaker,
  thingAt,
  buildingSize,
  type GridPoint,
  type ThingRef,
} from '../maker/draft';
import {
  loadMakerStore,
  mapFileText,
  walkedVersion,
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
import {
  makerScreen,
  walkedCheck,
  MAKER_ZOOMS,
  type MakerTool,
  type MakerZoom,
  type PlaceChoice,
} from '../maker/makerView';
import { GROUND_BRUSHES, groundBrush, groundUnder } from '../maker/palette';
import { MenuOverlay } from '../ui/MenuOverlay';
import { takeDownPixelStatus } from '../ui/pixelUi';
import { readMapFile, type MapFile, type MapFileBuildingKind, type MapFileHabitat } from '../world/mapFile';
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

const AUTOSAVE_MS = 400;
const STATUS_MS = 3_500;

interface Stroke {
  readonly tool: MakerTool;
  readonly start: GridPoint;
  last: GridPoint;
  file: MapFile;
  /** For a drag with Select: the thing being carried. */
  readonly carrying?: ThingRef;
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
  private zoom: MakerZoom = 16;
  private showDrafts = false;
  private stroke: Stroke | undefined;
  private checks: readonly MapCheck[] = [];
  private checkedFile: MapFile | undefined;
  private layers: { readonly file: MapFile; readonly layers: MapLayers } | undefined;
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingDelete: string | undefined;

  public constructor() {
    super('mapmaker');
  }

  public create(data?: { readonly tried?: boolean }): void {
    // Back from a TRY IT: the draft stops being a map the game can deploy onto,
    // and the game goes back to its ordinary save.
    const tried = data?.tried === true;
    endTry();
    unregisterPlayerMap(playerMapId({ id: TRY_IT_MAP_ID }));
    setActiveSaveSlot('normal');
    this.store = loadMakerStore();
    const current = this.store.drafts.find((draft) => draft.key === this.store.current) ?? this.store.drafts[0];
    if (current) {
      this.draftKey = current.key;
      this.history.reset(current.file);
    } else {
      this.startNewDraft();
    }
    this.selected = undefined;
    this.stroke = undefined;
    this.showDrafts = false;
    this.overlay = new MenuOverlay(this, 'map-maker pixel-ui', (event) => this.handleKey(event));
    // Rows here are tools, and a pointer crossing them on its way to the map
    // must not choose one: it only lights what it is over.
    this.overlay.pointerRule = 'previews';
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.flushAutosave());
    this.render(tried ? (this.walkedOut() ? 'You walked out of it. The map is ready.' : 'That try ended without leaving by an exit.') : undefined);
    this.fitZoom();
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
    const file = blankMap();
    this.history.reset(file);
    this.store = withDraft(this.store, { key: this.draftKey, file, updatedAt: Date.now() });
    saveMakerStore(this.store);
  }

  // --- Keeping the file, the checks and the picture in step --------------------

  /** Makes `next` the map, as one undo step. */
  private commit(next: MapFile, selected: ThingRef | undefined = this.selected): void {
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
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => this.flushAutosave(), AUTOSAVE_MS);
  }

  private flushAutosave(): void {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = undefined;
    }
    const kept = this.store.drafts.find((draft) => draft.key === this.draftKey);
    if (kept?.file === this.file) {
      return;
    }
    this.store = withDraft(this.store, {
      ...(kept ?? {}),
      key: this.draftKey,
      file: this.file,
      updatedAt: Date.now(),
    });
    saveMakerStore(this.store);
  }

  private render(status?: string): void {
    const viewport = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    const scroll = viewport ? { left: viewport.scrollLeft, top: viewport.scrollTop } : undefined;
    this.overlay.root.innerHTML = makerScreen({
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
      draftKey: this.draftKey,
      showDrafts: this.showDrafts,
      ...(status ? { status } : {}),
    });
    this.wire();
    const next = this.overlay.root.querySelector<HTMLElement>('[data-viewport]');
    if (next && scroll) {
      next.scrollLeft = scroll.left;
      next.scrollTop = scroll.top;
    }
    this.drawSwatches();
    this.redraw();
    this.overlay.refocus('[data-tool].is-selected', '[data-tool]');
    if (status) {
      if (this.statusTimer) {
        clearTimeout(this.statusTimer);
      }
      this.statusTimer = setTimeout(() => takeDownPixelStatus(this.overlay.root), STATUS_MS);
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
    this.overlay.root.querySelectorAll<HTMLCanvasElement>('canvas[data-swatch]').forEach((canvas) => {
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
          : { kind: kind as 'drop-in' | 'exit' | 'item' };
      this.tool = 'place';
      this.render();
    });
    on('[data-zoom]', (element) => this.setZoom(Number(element.dataset.zoom) as MakerZoom));
    on('[data-undo]', () => this.undo());
    on('[data-redo]', () => this.redo());
    on('[data-new]', () => {
      this.flushAutosave();
      this.startNewDraft();
      this.selected = undefined;
      this.showDrafts = false;
      this.render('A new map. Your last one is in your drafts.');
      this.fitZoom();
    });
    on('[data-toggle-drafts]', () => {
      this.flushAutosave();
      this.showDrafts = !this.showDrafts;
      this.pendingDelete = undefined;
      this.render();
    });
    on('[data-open-draft]', (element) => this.openDraft(element.dataset.openDraft ?? ''));
    on('[data-delete-draft]', (element) => this.deleteDraft(element, element.dataset.deleteDraft ?? ''));
    on('[data-download]', () => this.download());
    on('[data-try]', (element) => this.tryIt(element.dataset.try === 'walk' ? 'walk' : 'raid'));
    on('[data-open-file]', () => root.querySelector<HTMLInputElement>('[data-file-input]')?.click());
    on('[data-back]', () => this.leave());
    on('[data-remove-selected]', () => {
      if (this.selected) {
        this.commit(removeThing(this.file, this.selected), undefined);
      }
    });

    root.querySelector<HTMLInputElement>('[data-file-input]')?.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      const chosen = input.files?.[0];
      if (chosen) {
        void chosen.text().then((text) => this.openFileText(text, chosen.name));
      }
      input.value = '';
    });

    const field = (selector: string, change: (value: string) => MapFile): void => {
      root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.addEventListener('change', (event) => {
        const next = change((event.target as HTMLInputElement).value);
        if (next !== this.file) {
          this.commit(next);
        }
      });
    };
    field('[data-map-name]', (value) => renameMap(this.file, value));
    field('[data-map-maker]', (value) => setMaker(this.file, value));
    field('[data-map-wildlife]', (value) => ({ ...this.file, wildlife: value as MapFileHabitat }));
    field('[data-map-width]', (value) => resizeMap(this.file, Number(value), this.file.height));
    field('[data-map-height]', (value) => resizeMap(this.file, this.file.width, Number(value)));
    field('[data-place-name]', (value) =>
      this.selected && value.trim().length > 0 ? renamePlace(this.file, this.selected, value) : this.file,
    );
    field('[data-place-description]', (value) =>
      this.selected?.kind === 'drop-in' ? describeDropIn(this.file, this.selected.index, value) : this.file,
    );
    field('[data-exit-seconds]', (value) => {
      if (this.selected?.kind !== 'exit') {
        return this.file;
      }
      const seconds = Math.round(Number(value));
      return setExitOpens(
        this.file,
        this.selected.index,
        Number.isFinite(seconds) && seconds > 0
          ? { when: 'after', seconds: Math.min(240, seconds) }
          : { when: 'always' },
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

  private tileAt(event: PointerEvent, canvas: HTMLCanvasElement): GridPoint {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - box.left) / box.width) * this.file.width),
      y: Math.floor(((event.clientY - box.top) / box.height) * this.file.height),
    };
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
    switch (this.tool) {
      case 'brush': {
        const file = paintWith(this.file, [tile], this.brush());
        this.stroke = { tool: 'brush', start: tile, last: tile, file };
        this.redraw(file);
        return;
      }
      case 'rect':
        this.stroke = { tool: 'rect', start: tile, last: tile, file: this.file };
        this.previewArea({ from: tile, to: tile });
        return;
      case 'fill':
        this.commit(paintWith(this.file, fillRegion(this.file, tile), this.brush()));
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
        this.showDrafts = false;
        if (thing) {
          this.stroke = { tool: 'select', start: tile, last: tile, file: this.file, carrying: thing };
        }
        this.render();
        return;
      }
      case 'place': {
        const outcome =
          this.place.kind === 'building'
            ? placeBuilding(this.file, this.place.building, tile)
            : placeSpot(this.file, this.place.kind, tile);
        if (outcome.placed) {
          this.showDrafts = false;
          this.commit(outcome.file, outcome.thing);
        } else {
          this.render(outcome.reason);
        }
        return;
      }
    }
  }

  private pointerMove(event: PointerEvent, canvas: HTMLCanvasElement): void {
    const tile = this.tileAt(event, canvas);
    const stroke = this.stroke;
    if (!stroke) {
      this.hover(tile);
      return;
    }
    if (tile.x === stroke.last.x && tile.y === stroke.last.y) {
      return;
    }
    if (stroke.tool === 'brush') {
      stroke.file = paintWith(stroke.file, line(stroke.last, tile), this.brush());
      stroke.last = tile;
      this.redraw(stroke.file);
    } else if (stroke.tool === 'rect') {
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
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!stroke) {
      return;
    }
    if (stroke.tool === 'brush') {
      this.commit(stroke.file);
    } else if (stroke.tool === 'rect') {
      this.commit(paintWith(this.file, rectangle(stroke.start, stroke.last), this.brush()));
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

  private cancelStroke(): void {
    this.stroke = undefined;
    this.redraw();
  }

  /** Where a carried thing lands: a building keeps the offset it was picked up by. */
  private carriedCorner(thing: ThingRef, start: GridPoint, at: GridPoint): GridPoint {
    if (thing.kind !== 'building') {
      return at;
    }
    const building = this.file.buildings[thing.index];
    return { x: building.x + at.x - start.x, y: building.y + at.y - start.y };
  }

  private footprint(thing: ThingRef, at: GridPoint): { from: GridPoint; to: GridPoint } {
    if (thing.kind !== 'building') {
      return { from: at, to: at };
    }
    const corner = this.carriedCorner(thing, this.stroke?.start ?? at, at);
    const size = buildingSize(this.file.buildings[thing.index].kind);
    return { from: corner, to: { x: corner.x + size.width - 1, y: corner.y + size.height - 1 } };
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
      this.previewArea({ from: tile, to: { x: tile.x + size.width - 1, y: tile.y + size.height - 1 } }, valid);
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
      ? { x: viewport.scrollLeft + viewport.clientWidth / 2, y: viewport.scrollTop + viewport.clientHeight / 2 }
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
    this.draftKey = draft.key;
    this.history.reset(draft.file);
    this.store = { ...this.store, current: draft.key };
    saveMakerStore(this.store);
    this.selected = undefined;
    this.showDrafts = false;
    this.render();
    this.fitZoom();
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
    this.draftKey = newDraftKey(this.store);
    this.history.reset(reading.file);
    this.store = withDraft(this.store, { key: this.draftKey, file: reading.file, updatedAt: Date.now() });
    saveMakerStore(this.store);
    this.selected = undefined;
    this.showDrafts = false;
    this.render(`Opened ${name}.`);
    this.fitZoom();
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
    const attempt = beginTry(this.draftKey, this.file, rules);
    registerPlayerMap(attempt.map);
    const insertion =
      (this.selected?.kind === 'drop-in' ? attempt.map.insertions[this.selected.index] : undefined) ??
      attempt.map.insertions[0];
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
      { mapId: insertion.mapId, durationMs: rules === 'walk' ? PLAYTEST_RAID_DURATION_MS : RAID_DURATION_MS },
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
        bag: new Bag(Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])), packGridFor(packItemId)),
        runSession,
      });
    });
  }

  private leave(): void {
    this.flushAutosave();
    this.scene.start('title');
  }

  private handleKey(event: KeyboardEvent): void {
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
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
      event.preventDefault();
      if (this.selected) {
        this.selected = undefined;
        this.render();
      } else {
        this.leave();
      }
      return;
    }
    if ((key === 'delete' || key === 'backspace') && this.selected) {
      event.preventDefault();
      this.commit(removeThing(this.file, this.selected), undefined);
      return;
    }
    const tools: Readonly<Record<string, MakerTool>> = { b: 'brush', r: 'rect', f: 'fill', i: 'pick', v: 'select', x: 'erase' };
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
