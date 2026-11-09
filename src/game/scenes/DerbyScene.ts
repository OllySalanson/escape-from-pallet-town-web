import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { getBaseMap } from '../base/baseMap';
import { BASE_TILESET } from '../base/baseTileset';
import type { TileLayer } from '../world/tiles';
import type { StashedPokemon } from '../stash';
import { drawPixelWindow, WINDOW_CREAM } from '../ui/pixelWindow';
import { feedbackTabOverGame } from '../feedback/feedbackTabCover';
import { isFigureSpecies, pokemonIconFrames, POKEMON_ICON_FRAME_MS, POKEMON_ICON_TEXTURE } from '../world/pokemonFigures';
import {
  advanceDerby,
  bestLines,
  ridesWaves,
  sailsOverCrates,
  toNextCorner,
  toNextHurdle,
  COUNTDOWN_MS,
  DERBY_LEVELS,
  derbyField,
  derbyGoing,
  derbyLevelOpen,
  derbyLevelOpened,
  derbyScore,
  legOf,
  hurdlesOn,
  lineForKey,
  mayTake,
  nextFork,
  PLACE_WORDS,
  plainLapMs,
  playerPlace,
  pointOnLeg,
  PODIUM,
  progressOf,
  racerNotes,
  raceTime,
  staminaMs,
  startDerby,
  THE_FRONT,
  wavesOn,
  WAVE_WARN_MS,
  waveThreat,
  whereIs,
  type CourseLeg,
  type DerbyLevel,
  type DerbyLineMark,
  type DerbyLines,
  type DerbyRace,
} from '../minigames/derby';
import type { OutdoorCourse } from '../minigames/outdoorView';
import { derbySource, derbyTiers, type GamePayout } from '../minigames/tickets';
import { traits, type PokemonTraits } from '../minigames/traits';
import type { RestoredGame } from '../save/SaveManager';
import { OutdoorGameScene, type OutdoorFit, type OutdoorGameSceneData, type OutdoorSource } from './OutdoorGameScene';

/** How long the finish is shown before the screen comes back. */
const END_PAUSE_MS = 1800;

/** A tile of the harbour, drawn at its own size: the race is the harbour's own art. */
const TILE = 16;
/** The column down the right the standings and the sprint stand in, off the track. */
const SIDE = 88;
/** The strip along the foot the forks and the keys are said in, off the track. */
const FOOT = 28;
const INK = '#202030';
/** The kind a level's lap is judged against when saying who suits it: an ordinary racer on every course. */
const YARDSTICK = traits('charmander');

/** How far apart the runners stand across the lane on the start grid, in pixels, and how far apart once they are away. */
const GRID_SPACING = 0.45 * TILE;
const RUNNING_SPACING = 2;
/** How far behind the line every other runner on the grid stands, in pixels. */
const GRID_STAGGER = 8;

/**
 * Where a runner is drawn from the middle of its lane, in pixels: on the grid
 * the field stands spread across the lane and every other one a step back, so
 * eight are eight and not one pile (playtest 51, finding 5); it closes up over
 * the first two tiles of the race to a small lane of its own each, so a pack
 * on a narrow stretch is still told apart. Square to the way the runner faces.
 */
export function laneOffset(index: number, runners: number, along: number, heading: number): { x: number; y: number } {
  const grid = Math.max(0, 1 - along / 3);
  const across = (index - (runners - 1) / 2) * (grid * GRID_SPACING + (1 - grid) * RUNNING_SPACING);
  const back = index % 2 === 1 ? grid * GRID_STAGGER : 0;
  return {
    x: Math.round(-Math.sin(heading) * across - Math.cos(heading) * back),
    y: Math.round(Math.cos(heading) * across - Math.sin(heading) * back),
  };
}

/** The player's own date, `YYYY-MM-DD`: the day's field and going. */
function localDay(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The arrow a key is, for choosing a line, or null. */
function arrowOf(key: string): 'up' | 'down' | 'left' | 'right' | null {
  if (key === 'ArrowUp' || key === 'w') return 'up';
  if (key === 'ArrowDown' || key === 's') return 'down';
  if (key === 'ArrowLeft' || key === 'a') return 'left';
  if (key === 'ArrowRight' || key === 'd') return 'right';
  return null;
}

/**
 * THE PROMENADE DERBY (`minigames/derby.ts`), drawn on THE HARBOUR's own
 * ground from above, on one of its levels (`minigames/derbyLevels.ts`): the
 * runners go the level's course - along the stone, down the pier and home, and
 * on the later levels along the sand and out round the breakwater. SPACE taps
 * a sprint while the bar lasts (never into a tight corner, always into a
 * crate), and the arrows choose the line at each fork.
 */
export class DerbyScene extends OutdoorGameScene {
  /** Each level pays from its own source, on its own tiers, once a day (`derbySource`). */
  protected get source(): OutdoorSource {
    return derbySource(this.level.number);
  }
  protected readonly words = {
    title: 'PROMENADE DERBY',
    place: 'Promenade · ',
    heading: 'Who races?',
    doing: 'Racing',
    rules: 'Speed is pace, HP is the sprint, and a big one loses time at every tight corner. A WATER type may swim the bay home; a FLYING type may fly it.',
    playHelp: 'SPACE taps a sprint (never into a tight corner, always into a crate). The arrows choose the line at each fork.',
  };

  private race: DerbyRace | undefined;
  /** The level chosen on the screen, and raced. */
  private level: DerbyLevel = THE_FRONT;
  private wet = false;
  private choice: Record<string, string> = {};
  private tap = false;
  private endingFor: number | null = null;
  /** Where the last race finished, for the write. */
  private lastPlace: number | null = null;
  /** The level the last race was run on: a podium moves the chosen level on past it. */
  private racedOn: DerbyLevel | null = null;
  private tilemap: Phaser.Tilemaps.Tilemap | undefined;
  private hudCamera: Phaser.Cameras.Scene2D.Camera | undefined;
  /** What is drawn on the course, which the side and foot leave alone. */
  private trackParts: Phaser.GameObjects.GameObject[] = [];
  /** What is drawn in the side and the foot, which the course's camera leaves alone. */
  private hudParts: Phaser.GameObjects.GameObject[] = [];
  private sprint: Phaser.GameObjects.Graphics | undefined;
  private runners: Phaser.GameObjects.Sprite[] = [];
  private marks: Phaser.GameObjects.Graphics | undefined;
  /** The player's racer's ring and chevron, over every other racer and under its own. */
  private yours: Phaser.GameObjects.Graphics | undefined;
  private surf: Phaser.GameObjects.Graphics | undefined;
  private hud: Phaser.GameObjects.Text | undefined;
  private board: Phaser.GameObjects.Text | undefined;
  private callout: Phaser.GameObjects.Text | undefined;
  private fork: Phaser.GameObjects.Text | undefined;
  /** The wave the player was last warned of, so a warning is shouted once. */
  private warnedFor = -1;

  public constructor() {
    super('derby');
  }

  public init(data: OutdoorGameSceneData): void {
    super.init(data);
    // The newest level this save has open: the one there is still to finish.
    const cleared = this.cleared();
    this.level = [...DERBY_LEVELS].reverse().find((level) => derbyLevelOpen(level, cleared)) ?? THE_FRONT;
    this.choice = {};
    this.lastPlace = null;
    this.racedOn = null;
  }

  /** For a playtest driver: the race in progress. */
  public get derbyRace(): DerbyRace | undefined {
    return this.race;
  }

  /** For a playtest driver: the level chosen, by number. */
  public get derbyLevel(): number {
    return this.level.number;
  }

  /**
   * For a playtest driver: what the player's racer has ahead of it - the next
   * tight corner and crate in tiles, whether a wave is about to break where it
   * is running - and the quicker line at each fork, as a rider who knows the
   * course reckons it.
   */
  public get derbyAhead():
    | { readonly corner: number; readonly crate: number; readonly wave: boolean; readonly surf: 'warning' | 'breaking' | null; readonly lines: DerbyLines }
    | undefined {
    const race = this.race;
    if (!race) return undefined;
    const me = race.runners[0];
    return {
      corner: toNextCorner(race.level, me),
      crate: sailsOverCrates(me.racer) ? Number.POSITIVE_INFINITY : toNextHurdle(race.level, me),
      wave: !ridesWaves(me.racer) && waveThreat(race.level, me, race.clock),
      // A wave coming or breaking on the stretch it is on, whoever it is.
      surf: this.surfOn(race),
      lines: bestLines(race.level, me.racer, race.wet),
    };
  }

  private surfOn(race: DerbyRace): 'warning' | 'breaking' | null {
    if (race.clock <= COUNTDOWN_MS) return null;
    const me = race.runners[0];
    // Only a wave near enough to be on the screen with the racer.
    const waves = wavesOn(legOf(race.level, me), race.clock).filter((wave) => wave.from <= me.along + 6 && wave.to >= me.along - 3);
    if (waves.some((wave) => wave.breaking)) return 'breaking';
    return waves.some((wave) => wave.inMs <= WAVE_WARN_MS) ? 'warning' : null;
  }

  /** For a playtest driver: choose a level, as the screen's buttons do. */
  public raceOn(level: number): boolean {
    if (this.playing || !this.chooseLevel(level)) return false;
    this.showMenu();
    return true;
  }

  /** For a playtest driver: tap a sprint, or choose lines by fork id, as the keys do. */
  public ride(input: { readonly tap?: boolean; readonly lines?: DerbyLines }): void {
    if (input.tap) this.tap = true;
    if (input.lines) this.choice = { ...this.choice, ...input.lines };
  }

  private cleared(): number {
    return this.savedGame?.raidProgress.derbyCleared ?? 0;
  }

  protected fitOf(traits: PokemonTraits): OutdoorFit {
    // A lap on this course, as long as it would be on THE FRONT for an ordinary racer, so THE FRONT reads as it always did.
    const yardstick = plainLapMs(this.level, YARDSTICK, this.wet) / plainLapMs(THE_FRONT, YARDSTICK, this.wet);
    const ms = plainLapMs(this.level, traits, this.wet) / yardstick;
    return { fit: Math.max(0.1, (17_000 - ms) / 1000), notes: racerNotes(traits, this.wet, this.level) };
  }

  /** Today's best on the chosen course, named by it: a best on another course is no yardstick. */
  protected bestWords(best: number): string {
    return `on ${this.level.name} ${PLACE_WORDS[Math.max(0, 6 - best)] ?? `${best}`}`;
  }

  /** AGAIN only when it is: a podium that opened the next course races that one, and says so. */
  protected playLabel(): string | undefined {
    return this.racedOn && this.racedOn !== this.level ? `Race ${this.level.name}` : undefined;
  }

  protected todayLine(): string {
    const day = localDay(new Date());
    this.wet = derbyGoing(day) === 'wet';
    const field = derbyField(this.level, day)
      .map((entrant) => entrant.handle)
      .join(', ');
    const [third, second, first] = derbyTiers(this.level.number);
    return `Today the going is ${this.wet ? 'WET (SWIFT SWIM swims twice as fast)' : 'DRY'}; running ${this.level.name}: ${field}. Here 3rd pays ${third.tickets} tickets, 2nd ${second.tickets}, 1st ${first.tickets}.`;
  }

  protected course(): OutdoorCourse {
    const cleared = this.cleared();
    const next = DERBY_LEVELS[this.level.number];
    const newsLine = this.level.news.length > 0 ? ` ${this.level.number === 1 ? 'The knack' : 'New here'}: ${this.level.news.join('; ')}.` : '';
    const nextLine = !next
      ? ' The last level.'
      : derbyLevelOpen(next, cleared)
        ? ` Next: ${next.name}, open.`
        : ` Next: ${next.name} - finish in the top ${PODIUM} here to open it.`;
    return {
      note: `Level ${this.level.number} of ${DERBY_LEVELS.length}`,
      levels: DERBY_LEVELS.map((level) => {
        const open = derbyLevelOpen(level, cleared);
        const before = DERBY_LEVELS[level.number - 2];
        return {
          number: level.number,
          name: level.name,
          open,
          chosen: level === this.level,
          help: open
            ? `${level.name}: ${level.blurb}`
            : `Locked: finish ${before?.name ?? 'the level before'} in the top ${PODIUM} to open ${level.name}.`,
        };
      }),
      line: `${this.level.name}: ${this.level.blurb}${newsLine}${nextLine}`,
    };
  }

  protected chooseLevel(number: number): boolean {
    const level = DERBY_LEVELS[number - 1];
    if (!level || !derbyLevelOpen(level, this.cleared())) return false;
    this.level = level;
    this.last = undefined;
    return true;
  }

  protected writeResult(): { readonly game: RestoredGame; readonly payout: GamePayout; readonly kept: readonly string[] } | null {
    const written = this.saveManager.playDerby(this.level, this.lastPlace);
    if (!written) return null;
    const opened = DERBY_LEVELS[written.cleared];
    // A level just opened is the one chosen next.
    if (opened && opened.number > this.level.number && derbyLevelOpen(opened, written.cleared)) this.level = opened;
    return { game: written.game, payout: written.payout, kept: [] };
  }

  protected beginGame(chosen: StashedPokemon, traits: PokemonTraits): void {
    const day = localDay(new Date());
    const level = this.level;
    this.wet = derbyGoing(day) === 'wet';
    this.race = startDerby(level, { name: chosen.pokemon.name.toUpperCase(), racer: traits }, derbyField(level, day), this.wet, Math.floor(Math.random() * 2 ** 31));
    this.choice = {};
    this.tap = false;
    this.endingFor = null;
    this.lastPlace = null;
    this.racedOn = level;
    this.warnedFor = -1;
    const { width, height } = this.scale;
    // The FEEDBACK tab stands over the right of the screen on a window the game
    // fills, so the side column steps in by it and nothing in it goes under.
    const tab = feedbackTabOverGame(this.game.canvas, { width, height });
    const tabWidth = tab ? width - tab.x : 0;
    const track = { width: width - SIDE - tabWidth, height: height - FOOT };
    this.trackParts = [];
    this.hudParts = [];
    this.layGround();
    this.surf = this.onTrack(this.add.graphics().setDepth(3.6));
    this.marks = this.onTrack(this.add.graphics().setDepth(4));
    this.yours = this.onTrack(this.add.graphics().setDepth(6.5));
    this.runners = this.race.runners.map((runner) => {
      const species = runner.racer.species;
      const frame = isFigureSpecies(species) ? pokemonIconFrames(species)[0] : 0;
      return this.onTrack(this.add.sprite(0, 0, POKEMON_ICON_TEXTURE, frame).setOrigin(0.5, 0.75).setDepth(runner.index === 0 ? 7 : 6));
    });
    // The course is seen through a window that follows the player's racer;
    // the side and the foot are a second camera's, so nothing is written on the track.
    const camera = this.cameras.main;
    const view = level.view;
    camera.setViewport(0, 0, track.width, track.height);
    camera.setBounds(view.x * TILE, view.y * TILE, view.width * TILE, view.height * TILE);
    camera.setBackgroundColor(INK);
    camera.setRoundPixels(true);
    const mine = this.runners[0];
    if (mine) camera.startFollow(mine, true, 0.2, 0.2);
    this.hudCamera = this.cameras.add(0, 0, width, height);
    const frame = this.onHud(this.add.graphics().setDepth(0));
    frame.fillStyle(0x202030, 1).fillRect(track.width, 0, SIDE + tabWidth, height).fillRect(0, track.height, track.width, FOOT);
    const side = this.onHud(this.add.graphics().setDepth(1));
    // The words first, so the windows behind them are as tall as the lines they hold.
    this.hud = this.onHud(this.words_(track.width + 9, 6, ['LEVEL', 'PLACE', 'SPRINT'], { colour: INK }).setStroke(INK, 0).setDepth(2));
    const line = Math.ceil(this.hud.height / 3);
    const hudHeight = line * 3 + 12;
    const boardTop = 4 + hudHeight + 4;
    // The standings' window is as tall as the field, and never past the foot of the track.
    const boardHeight = Math.min(track.height - boardTop - 4, 6 + this.race.runners.length * line);
    drawPixelWindow(side, { x: track.width + 4, y: 4, width: SIDE - 8, height: hudHeight }, { fill: WINDOW_CREAM });
    drawPixelWindow(side, { x: track.width + 4, y: boardTop, width: SIDE - 8, height: boardHeight }, { fill: WINDOW_CREAM });
    this.sprint = this.onHud(this.add.graphics().setDepth(2));
    this.board = this.onHud(this.words_(track.width + 9, boardTop + 2, '', { colour: INK }).setStroke(INK, 0).setDepth(2));
    this.callout = this.onHud(this.words_(track.width / 2, Math.round(track.height * 0.32), '', { big: true, origin: [0.5, 0.5] }));
    this.fork = this.onHud(this.words_(track.width / 2, height - 15, '', { origin: [0.5, 1], colour: '#f8e070' }));
    this.onHud(this.words_(track.width / 2, height - 2, 'SPACE: sprint · ARROWS: line · ESC: stop', { origin: [0.5, 1] }));
    camera.ignore(this.hudParts);
    this.hudCamera.ignore(this.trackParts);
    this.drawRace();
  }

  private onTrack<T extends Phaser.GameObjects.GameObject>(part: T): T {
    this.trackParts.push(part);
    return this.keep(part);
  }

  private onHud<T extends Phaser.GameObjects.GameObject>(part: T): T {
    this.hudParts.push(part);
    return this.keep(part);
  }

  /** Every leg of the level, once each. */
  private legs(): readonly CourseLeg[] {
    return [...new Set(this.level.stretches.flatMap((stretch) => stretch.lines.flatMap((line) => line.legs)))];
  }

  /**
   * THE HARBOUR's own tile layers under the course, at their own size; the
   * start and the finish across it, chequered; and the level's crates.
   */
  private layGround(): void {
    const harbour = getBaseMap([]);
    const map = this.make.tilemap({ width: harbour.width, height: harbour.height, tileWidth: TILE, tileHeight: TILE });
    const sheets = BASE_TILESET.sources.map((source) => {
      const sheet = map.addTilesetImage(source.textureKey, source.textureKey, TILE, TILE, 0, 0, source.firstIndex);
      if (!sheet) throw new Error(`Tileset '${source.textureKey}' failed to load.`);
      return sheet;
    });
    const lay = (layer: TileLayer, name: string, depth: number): void => {
      const created = map.createBlankLayer(`derby-${name}`, sheets, 0, 0);
      if (!created) throw new Error(`Tilemap layer 'derby-${name}' failed to initialize.`);
      created.putTilesAt(layer.tiles.map((row) => [...row]), 0, 0);
      created.setDepth(depth);
      created.forEachTile((tile) => {
        const tint = layer.tints[tile.y]?.[tile.x] ?? -1;
        if (tint >= 0) tile.tint = tint;
        if (layer.flips[tile.y]?.[tile.x]) tile.flipX = true;
      });
      this.trackParts.push(created);
    };
    const { ground, overlay, detail, canopy, brim } = harbour.layers;
    lay(ground, 'ground', 0);
    lay(overlay, 'overlay', 0.1);
    lay(detail, 'detail', 0.2);
    // Roofs and crowns under the racers: a race is watched from above, and nobody runs hidden.
    lay(canopy, 'canopy', 3);
    lay(brim, 'brim', 3.1);
    this.tilemap = map;
    const lines = this.onTrack(this.add.graphics().setDepth(3.5));
    const chequer = (mark: DerbyLineMark): void => {
      const lineX = mark.x * TILE;
      for (let row = mark.from; row <= mark.to; row += 1) {
        for (let step = 0; step < TILE; step += 2) {
          const py = row * TILE + step;
          lines.fillStyle(step % 4 === 0 ? 0x202030 : 0xf8f8f8, 1).fillRect(lineX - 2, py, 2, 2);
          lines.fillStyle(step % 4 === 0 ? 0xf8f8f8 : 0x202030, 1).fillRect(lineX, py, 2, 2);
        }
      }
    };
    chequer(this.level.start);
    const { start, finish } = this.level;
    if (finish.x !== start.x || finish.from !== start.from || finish.to !== start.to) chequer(finish);
    // The crates: a fish box on the stone, drawn here, whole pixels.
    const crates = this.onTrack(this.add.graphics().setDepth(3.55));
    const seen = new Set<string>();
    for (const leg of this.legs()) {
      for (const crate of hurdlesOn(leg)) {
        const key = `${crate.x},${crate.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const left = crate.x * TILE + 3;
        const top = crate.y * TILE + 5;
        crates.fillStyle(0x202030, 1).fillRect(left - 1, top - 1, 12, 9);
        crates.fillStyle(0xb87838, 1).fillRect(left, top, 10, 7);
        crates.fillStyle(0xe0a860, 1).fillRect(left, top, 10, 2);
        crates.fillStyle(0x784818, 1).fillRect(left, top + 4, 10, 1).fillRect(left + 4, top, 2, 7);
      }
    }
  }

  protected tearDownStage(): void {
    super.tearDownStage();
    this.tilemap?.destroy();
    this.tilemap = undefined;
    this.trackParts = [];
    this.hudParts = [];
    this.sprint = undefined;
    this.surf = undefined;
    this.yours = undefined;
    if (this.hudCamera) {
      this.cameras?.remove(this.hudCamera);
      this.hudCamera = undefined;
    }
    const camera = this.cameras?.main;
    if (camera) {
      camera.stopFollow();
      camera.setViewport(0, 0, this.scale.width, this.scale.height);
      camera.removeBounds();
      camera.setScroll(0, 0);
      camera.setBackgroundColor('rgba(0,0,0,0)');
    }
  }

  private toScreen(point: { readonly x: number; readonly y: number }): { x: number; y: number } {
    return { x: (point.x + 0.5) * TILE, y: (point.y + 0.5) * TILE };
  }

  protected onGameKey(event: KeyboardEvent): void {
    const race = this.race;
    if (!race || this.endingFor !== null) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finishRace();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) this.tap = true;
      return;
    }
    const arrow = arrowOf(event.key);
    if (!arrow) return;
    // The arrow chooses at the nearest fork ahead with a line on it, as the foot of the screen says.
    const me = { ...race.runners[0], lines: { ...race.runners[0].lines, ...this.choice } };
    const chosen = lineForKey(race.level, me, arrow);
    if (chosen) this.choice = { ...this.choice, [chosen.fork]: chosen.line };
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      audioManager.play('select');
    }
  }

  public update(_time: number, delta: number): void {
    const race = this.race;
    if (!this.playing || !race) return;
    if (this.endingFor !== null) {
      this.endingFor -= delta;
      if (this.endingFor <= 0) this.finishRace();
      return;
    }
    const before = race.clock;
    this.race = advanceDerby(race, delta, { tap: this.tap, lines: this.choice });
    this.tap = false;
    for (const event of this.race.events) {
      if (event.kind === 'go') audioManager.play('confirm');
      if (event.kind === 'go' || event.kind === 'wave' || event.runner !== 0) continue;
      if (event.kind === 'stumble') this.shout('STUMBLE!', '#f85838');
      if (event.kind === 'bump') {
        audioManager.play('bump');
        this.shout(event.zapped ? 'ZAPPED!' : 'BUMPED!', '#f8a848');
      }
      if (event.kind === 'leap') this.shout('LEAPT IT!', '#88e088');
      if (event.kind === 'clamber') {
        audioManager.play('bump');
        this.shout('CLAMBER!', '#f8a848');
      }
      if (event.kind === 'soaked') {
        audioManager.play('bump');
        this.shout('SOAKED!', '#88c8f8');
      }
      if (event.kind === 'rode-wave') this.shout('RODE IT!', '#88c8f8');
      if (event.kind === 'finish') {
        audioManager.play(event.place === 1 ? 'itemObtained' : 'confirm');
        this.shout(`${PLACE_WORDS[event.place - 1]}  ${raceTime(event.ms)}`, '#f8e070');
      }
    }
    // A wave coming where the player is running: said once, before it breaks.
    const me = this.race.runners[0];
    if (me.finishedMs === null && !ridesWaves(me.racer) && waveThreat(this.race.level, me, this.race.clock, 6) && this.warnedFor < 0) {
      this.warnedFor = this.race.clock;
      this.shout('WAVE!', '#88c8f8');
    } else if (this.warnedFor >= 0 && this.race.clock - this.warnedFor > 2000) {
      this.warnedFor = -1;
    }
    // The count before the gun, with the course's name over it.
    if (this.race.clock < COUNTDOWN_MS) {
      const left = Math.ceil((COUNTDOWN_MS - this.race.clock) / (COUNTDOWN_MS / 3));
      this.callout?.setText([this.level.name, String(left)]).setColor('#f8f8f8');
    } else if (before < COUNTDOWN_MS) {
      this.callout?.setText('GO!').setColor('#f8e070');
      this.time.delayedCall(600, () => {
        if (this.callout?.text === 'GO!') this.callout.setText('');
      });
    }
    if (this.race.over || this.race.runners[0].finishedMs !== null) {
      if (this.race.runners[0].finishedMs !== null && !this.race.over) {
        // The player is home: the rest are run out quickly to set the places.
        while (!this.race.over) this.race = advanceDerby(this.race, 1000, {});
      }
      this.endingFor = END_PAUSE_MS;
    }
    this.drawRace();
  }

  private shout(words: string, colour: string): void {
    this.callout?.setText(words).setColor(colour);
    this.time.delayedCall(900, () => {
      if (this.callout?.text === words) this.callout.setText('');
    });
  }

  private finishRace(): void {
    const race = this.race;
    if (!race || !this.playing) return;
    this.race = undefined;
    this.endingFor = null;
    const place = playerPlace(race);
    this.lastPlace = place;
    const me = race.runners[0];
    const opened = derbyLevelOpened(race.level, place, this.cleared());
    const result = place === null ? 'Did not finish' : `${PLACE_WORDS[place - 1]} of ${race.runners.length} in ${raceTime(me.finishedMs ?? 0)}`;
    const headline = `${race.level.name}: ${result}${opened ? ` · ${opened.name} is open!` : ''}`;
    this.runners = [];
    this.endGame(derbyScore(place), headline);
  }

  /** The waves over the breakwater: a warning line along the stone, then the foam. */
  private drawWaves(race: DerbyRace): void {
    const surf = this.surf?.clear();
    if (!surf) return;
    const seen = new Set<string>();
    for (const leg of this.legs()) {
      for (const wave of wavesOn(leg, race.clock)) {
        if (seen.has(wave.key)) continue;
        seen.add(wave.key);
        const warning = race.clock >= COUNTDOWN_MS && wave.inMs <= WAVE_WARN_MS;
        if (!warning && !wave.breaking) continue;
        // A tile of foam over each tile of the lane: the out lane and the back lane share a wave, so it covers both.
        for (let along = wave.from; along <= wave.to + 0.01; along += 1) {
          const point = pointOnLeg(leg, along);
          const left = Math.round(point.x) * TILE;
          const top = Math.round(point.y) * TILE;
          if (wave.breaking) {
            // Broken over the stone: foam, and the sea running off it.
            surf.fillStyle(0xb8e0f8, 0.85).fillRect(left, top, TILE, TILE);
            surf.fillStyle(0xf8f8f8, 1).fillRect(left + 1, top + 3, 9, 2).fillRect(left + 6, top + 10, 9, 2);
          } else {
            // The warning: the sea washing up over the stone, and spray, brighter on every other beat.
            const beat = Math.floor(race.clock / 160) % 2 === 0;
            surf.fillStyle(0x3890e8, beat ? 0.45 : 0.25).fillRect(left, top, TILE, TILE);
            surf.fillStyle(0xf8f8f8, beat ? 1 : 0.6).fillRect(left + 2, top + 2, 2, 2).fillRect(left + 11, top + 6, 2, 2).fillRect(left + 5, top + 12, 2, 2);
          }
        }
      }
    }
  }

  private drawRace(): void {
    const race = this.race;
    const marks = this.marks?.clear();
    const yours = this.yours?.clear();
    if (!race || !marks || !yours) return;
    const level = race.level;
    this.drawWaves(race);
    const bob = Math.floor(this.time.now / POKEMON_ICON_FRAME_MS) % 2;
    race.runners.forEach((runner, index) => {
      const sprite = this.runners[index];
      if (!sprite) return;
      const where = whereIs(level, runner);
      const lane = laneOffset(index, race.runners.length, runner.leg === 0 ? runner.along : Number.POSITIVE_INFINITY, where.heading);
      const at = this.toScreen(where);
      at.x += lane.x;
      at.y += lane.y;
      sprite.setPosition(Math.round(at.x), Math.round(at.y));
      const species = runner.racer.species;
      if (isFigureSpecies(species)) sprite.setFrame(pokemonIconFrames(species)[runner.finishedMs === null && race.clock > COUNTDOWN_MS ? bob : 0]);
      sprite.setFlipX(Math.cos(where.heading) > 0.2);
      sprite.setAlpha(where.surface === 'water' ? 0.8 : 1);
      if (where.surface === 'air') marks.fillStyle(0x202030, 0.35).fillEllipse(at.x, at.y + TILE * 0.6, TILE * 0.8, TILE * 0.3);
      if (index === 0) {
        // The player's racer: a gold ring at its feet and a chevron over it, so it is found in a pile (playtest 51, finding 5).
        // Drawn over every other racer, so a pile never hides it.
        const x = Math.round(at.x);
        const y = Math.round(at.y);
        yours.lineStyle(4, 0x202030, 1).strokeEllipse(x, y + 4, TILE + 14, 11);
        yours.lineStyle(2, 0xf8e070, 1).strokeEllipse(x, y + 4, TILE + 14, 11);
        yours.fillStyle(0x202030, 1).fillTriangle(x - 6, y - TILE - 11, x + 6, y - TILE - 11, x, y - TILE - 4);
        yours.fillStyle(0xf8e070, 1).fillTriangle(x - 4, y - TILE - 10, x + 4, y - TILE - 10, x, y - TILE - 6);
      }
    });
    const me = race.runners[0];
    const order = [...race.runners].sort((a, b) => progressOf(level, b) - progressOf(level, a) || (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity));
    const place = playerPlace(race) ?? order.findIndex((runner) => runner.index === 0) + 1;
    const bar = Math.round((me.stamina / staminaMs(me.racer)) * 10);
    this.hud?.setText([`LEVEL ${level.number} OF ${DERBY_LEVELS.length}`, `${PLACE_WORDS[place - 1]} · ${race.wet ? 'WET' : 'DRY'}`, 'SPRINT']);
    const sprint = this.sprint?.clear();
    if (sprint && this.hud) {
      // The sprint left, as a bar of ten pips under its word.
      const left = this.hud.x;
      const top = this.hud.y + this.hud.height + 1;
      for (let pip = 0; pip < 10; pip += 1) {
        sprint.fillStyle(pip < bar ? 0x48a058 : 0xc8c0a0, 1).fillRect(left + pip * 6, top, 5, 6);
      }
    }
    this.board?.setText(order.map((runner, index) => `${index + 1} ${runner.index === 0 ? 'YOU' : runner.name}`));
    // The next fork ahead and every line on it the player may take, the one chosen in brackets.
    const fork = nextFork(level, { ...me, lines: { ...me.lines, ...this.choice } });
    if (fork) {
      const chosen = this.choice[fork.id] ?? me.lines[fork.id];
      this.fork?.setText(
        fork.lines
          .filter((line) => line.key && mayTake(me.racer, line))
          .map((line) => `${(line.key ?? '').toUpperCase()}: ${line.id === chosen ? `[${line.word}]` : line.word}`)
          .join(' · '),
      );
    } else {
      this.fork?.setText('');
    }
  }
}
