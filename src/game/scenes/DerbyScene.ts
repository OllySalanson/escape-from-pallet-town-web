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
  COUNTDOWN_MS,
  derbyField,
  derbyGoing,
  derbyScore,
  lineMs,
  linesOpenTo,
  nextFork,
  playerPlace,
  progressOf,
  racerNotes,
  raceTime,
  routeOf,
  staminaMs,
  startDerby,
  whereIs,
  type DerbyRace,
  type FirstLine,
  type SecondLine,
} from '../minigames/derby';
import { DERBY_TICKET_TIERS } from '../minigames/tickets';
import type { PokemonTraits } from '../minigames/traits';
import { OutdoorGameScene, type OutdoorFit } from './OutdoorGameScene';

/** The part of THE HARBOUR the race is drawn on, in tiles. */
const VIEW = { x: 59, y: 11, width: 28, height: 21 } as const;
/** How long the finish is shown before the screen comes back. */
const END_PAUSE_MS = 1800;

/** A tile of the harbour, drawn at its own size: the race is the harbour's own art. */
const TILE = 16;
/** The column down the right the standings and the sprint stand in, off the track. */
const SIDE = 82;
/** The strip along the foot the forks and the keys are said in, off the track. */
const FOOT = 28;
const INK = '#202030';

const PLACE_WORDS = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'];

/** The player's own date, `YYYY-MM-DD`: the day's field and going. */
function localDay(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * THE PROMENADE DERBY (`minigames/derby.ts`), drawn on THE HARBOUR's own
 * ground from above: six run east along the stone, down the pleasure pier and
 * home - back up the pier, across the bay for a swimmer, or over the huts for
 * a flyer. SPACE taps a sprint while the bar lasts (never into a tight
 * corner), and the arrows choose the line at each fork.
 */
export class DerbyScene extends OutdoorGameScene {
  protected readonly source = 'derby' as const;
  protected readonly words = {
    title: 'PROMENADE DERBY',
    place: 'Promenade · ',
    heading: 'Who races?',
    doing: 'Racing',
    rules: 'Six run the front and the pier. Speed is pace, HP is the sprint, and a big one loses time at every tight corner. A WATER type may swim the bay home; a FLYING type may fly it.',
    playHelp: 'SPACE taps a sprint (never into a tight corner). The arrows choose the line at each fork.',
  };

  private race: DerbyRace | undefined;
  private wet = false;
  private choice: { first?: FirstLine; second?: SecondLine } = {};
  private tap = false;
  private endingFor: number | null = null;
  private tilemap: Phaser.Tilemaps.Tilemap | undefined;
  private hudCamera: Phaser.Cameras.Scene2D.Camera | undefined;
  /** What is drawn on the course, which the side and foot leave alone. */
  private trackParts: Phaser.GameObjects.GameObject[] = [];
  /** What is drawn in the side and the foot, which the course's camera leaves alone. */
  private hudParts: Phaser.GameObjects.GameObject[] = [];
  private sprint: Phaser.GameObjects.Graphics | undefined;
  private runners: Phaser.GameObjects.Sprite[] = [];
  private marks: Phaser.GameObjects.Graphics | undefined;
  private hud: Phaser.GameObjects.Text | undefined;
  private board: Phaser.GameObjects.Text | undefined;
  private callout: Phaser.GameObjects.Text | undefined;
  private fork: Phaser.GameObjects.Text | undefined;

  public constructor() {
    super('derby');
  }

  /** For a playtest driver: the race in progress. */
  public get derbyRace(): DerbyRace | undefined {
    return this.race;
  }

  /** For a playtest driver: tap a sprint, or choose a line, as the keys do. */
  public ride(input: { readonly tap?: boolean; readonly first?: FirstLine; readonly second?: SecondLine }): void {
    if (input.tap) this.tap = true;
    if (input.first) this.choice = { ...this.choice, first: input.first };
    if (input.second) this.choice = { ...this.choice, second: input.second };
  }

  protected fitOf(traits: PokemonTraits): OutdoorFit {
    const lines = bestLines(traits, this.wet);
    const ms = lineMs(traits, routeOf(lines.first, lines.second), this.wet);
    return { fit: Math.max(0.1, (17_000 - ms) / 1000), notes: racerNotes(traits, this.wet) };
  }

  protected bestWords(best: number): string {
    return PLACE_WORDS[Math.max(0, 6 - best)] ?? `${best}`;
  }

  protected todayLine(): string {
    const day = localDay(new Date());
    this.wet = derbyGoing(day) === 'wet';
    const field = derbyField(day)
      .map((entrant) => entrant.handle)
      .join(', ');
    const [third] = DERBY_TICKET_TIERS;
    return `Today the going is ${this.wet ? 'WET (SWIFT SWIM swims twice as fast)' : 'DRY'}; running: ${field}. The podium pays from ${third.tickets} tickets.`;
  }

  protected beginGame(chosen: StashedPokemon, traits: PokemonTraits): void {
    const day = localDay(new Date());
    this.wet = derbyGoing(day) === 'wet';
    this.race = startDerby({ name: chosen.pokemon.name.toUpperCase(), racer: traits }, derbyField(day), this.wet, Math.floor(Math.random() * 2 ** 31));
    this.choice = {};
    this.tap = false;
    this.endingFor = null;
    const { width, height } = this.scale;
    // The FEEDBACK tab stands over the right of the screen on a window the game
    // fills, so the side column steps in by it and nothing in it goes under.
    const tab = feedbackTabOverGame(this.game.canvas, { width, height });
    const tabWidth = tab ? width - tab.x : 0;
    const track = { width: width - SIDE - tabWidth, height: height - FOOT };
    this.trackParts = [];
    this.hudParts = [];
    this.layGround();
    this.marks = this.onTrack(this.add.graphics().setDepth(4));
    this.runners = this.race.runners.map((runner) => {
      const species = runner.racer.species;
      const frame = isFigureSpecies(species) ? pokemonIconFrames(species)[0] : 0;
      return this.onTrack(this.add.sprite(0, 0, POKEMON_ICON_TEXTURE, frame).setOrigin(0.5, 0.75).setDepth(runner.index === 0 ? 7 : 6));
    });
    // The course is seen through a window that follows the player's racer;
    // the side and the foot are a second camera's, so nothing is written on the track.
    const camera = this.cameras.main;
    camera.setViewport(0, 0, track.width, track.height);
    camera.setBounds(VIEW.x * TILE, VIEW.y * TILE, VIEW.width * TILE, VIEW.height * TILE);
    camera.setBackgroundColor(INK);
    camera.setRoundPixels(true);
    const mine = this.runners[0];
    if (mine) camera.startFollow(mine, true, 0.2, 0.2);
    this.hudCamera = this.cameras.add(0, 0, width, height);
    const frame = this.onHud(this.add.graphics().setDepth(0));
    frame.fillStyle(0x202030, 1).fillRect(track.width, 0, SIDE + tabWidth, height).fillRect(0, track.height, track.width, FOOT);
    const side = this.onHud(this.add.graphics().setDepth(1));
    drawPixelWindow(side, { x: track.width + 4, y: 4, width: SIDE - 8, height: 40 }, { fill: WINDOW_CREAM });
    drawPixelWindow(side, { x: track.width + 4, y: 48, width: SIDE - 8, height: Math.min(track.height - 52, 92) }, { fill: WINDOW_CREAM });
    this.hud = this.onHud(this.words_(track.width + 9, 6, '', { colour: INK }).setStroke(INK, 0).setDepth(2));
    this.sprint = this.onHud(this.add.graphics().setDepth(2));
    this.board = this.onHud(this.words_(track.width + 9, 50, '', { colour: INK }).setStroke(INK, 0).setDepth(2));
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

  /** THE HARBOUR's own tile layers under the course, at their own size, and the start and finish across the stone. */
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
    const line = this.onTrack(this.add.graphics().setDepth(3.5));
    const lineX = 64 * TILE;
    for (let row = 13; row <= 14; row += 1) {
      for (let step = 0; step < TILE; step += 2) {
        const py = row * TILE + step;
        line.fillStyle(step % 4 === 0 ? 0x202030 : 0xf8f8f8, 1).fillRect(lineX - 2, py, 2, 2);
        line.fillStyle(step % 4 === 0 ? 0xf8f8f8 : 0x202030, 1).fillRect(lineX, py, 2, 2);
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
    const me = race.runners[0];
    const fork = nextFork(me);
    const open = linesOpenTo(me.racer);
    const key = event.key;
    if (fork === 'first') {
      if (key === 'ArrowDown' || key === 's') this.choice = { ...this.choice, first: 'inside' };
      if (key === 'ArrowRight' || key === 'd') this.choice = { ...this.choice, first: 'wide' };
    }
    if (fork === 'first' || fork === 'second') {
      if (key === 'ArrowUp' || key === 'w') this.choice = { ...this.choice, second: 'pier' };
      if ((key === 'ArrowLeft' || key === 'a') && open.includes('bay')) this.choice = { ...this.choice, second: 'bay' };
      if ((key === 'ArrowRight' || key === 'd') && fork === 'second' && open.includes('air')) this.choice = { ...this.choice, second: 'air' };
    }
    if (key.startsWith('Arrow')) {
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
    this.race = advanceDerby(race, delta, { tap: this.tap, ...this.choice });
    this.tap = false;
    for (const event of this.race.events) {
      if (event.kind === 'go') audioManager.play('confirm');
      if (event.kind === 'go' || event.runner !== 0) continue;
      if (event.kind === 'stumble') this.shout('STUMBLE!', '#f85838');
      if (event.kind === 'bump') {
        audioManager.play('bump');
        this.shout(event.zapped ? 'ZAPPED!' : 'BUMPED!', '#f8a848');
      }
      if (event.kind === 'finish') {
        audioManager.play(event.place === 1 ? 'itemObtained' : 'confirm');
        this.shout(`${PLACE_WORDS[event.place - 1]}  ${raceTime(event.ms)}`, '#f8e070');
      }
    }
    // The count before the gun.
    if (this.race.clock < COUNTDOWN_MS) {
      const left = Math.ceil((COUNTDOWN_MS - this.race.clock) / (COUNTDOWN_MS / 3));
      this.callout?.setText(String(left)).setColor('#f8f8f8');
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
    const me = race.runners[0];
    const headline = place === null ? 'Did not finish' : `${PLACE_WORDS[place - 1]} of ${race.runners.length} in ${raceTime(me.finishedMs ?? 0)}`;
    this.runners = [];
    this.endGame(derbyScore(place, race.runners.length), headline);
  }

  private drawRace(): void {
    const race = this.race;
    const marks = this.marks?.clear();
    if (!race || !marks) return;
    const bob = Math.floor(this.time.now / POKEMON_ICON_FRAME_MS) % 2;
    race.runners.forEach((runner, index) => {
      const sprite = this.runners[index];
      if (!sprite) return;
      const where = whereIs(runner);
      const at = this.toScreen(where);
      // Side by side in the lane at the start, so six are not one picture.
      const lane = runner.leg === 0 && runner.along < 1 ? (index - 2.5) * 0.18 * TILE : 0;
      sprite.setPosition(Math.round(at.x), Math.round(at.y + lane));
      const species = runner.racer.species;
      if (isFigureSpecies(species)) sprite.setFrame(pokemonIconFrames(species)[runner.finishedMs === null && race.clock > COUNTDOWN_MS ? bob : 0]);
      sprite.setFlipX(Math.cos(where.heading) > 0.2);
      sprite.setAlpha(where.surface === 'water' ? 0.8 : 1);
      if (where.surface === 'air') marks.fillStyle(0x202030, 0.35).fillEllipse(at.x, at.y + TILE * 0.6, TILE * 0.8, TILE * 0.3);
      if (index === 0) {
        // The player's racer: a white chevron over it.
        marks.fillStyle(0xf8f8f8, 1).fillTriangle(at.x - 4, at.y - TILE - 10, at.x + 4, at.y - TILE - 10, at.x, at.y - TILE - 5);
      }
    });
    const me = race.runners[0];
    const order = [...race.runners].sort((a, b) => progressOf(b) - progressOf(a) || (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity));
    const place = playerPlace(race) ?? order.findIndex((runner) => runner.index === 0) + 1;
    const bar = Math.round((me.stamina / staminaMs(me.racer)) * 10);
    this.hud?.setText([`${PLACE_WORDS[place - 1]} · ${race.wet ? 'WET' : 'DRY'}`, 'SPRINT']);
    const sprint = this.sprint?.clear();
    if (sprint && this.hud) {
      // The sprint left, as a bar of ten pips under its word.
      const left = this.hud.x;
      const top = this.hud.y + 26;
      for (let pip = 0; pip < 10; pip += 1) {
        sprint.fillStyle(pip < bar ? 0x48a058 : 0xc8c0a0, 1).fillRect(left + pip * 6, top, 5, 6);
      }
    }
    this.board?.setText(order.map((runner, index) => `${index + 1} ${runner.index === 0 ? 'YOU' : runner.name}`));
    const fork = nextFork(me);
    const open = linesOpenTo(me.racer);
    const word = (line: string, chosen: string) => (line === chosen ? `[${line.toUpperCase()}]` : line.toUpperCase());
    if (fork === 'first') {
      this.fork?.setText(`DOWN: ${word('inside', me.first)} · RIGHT: ${word('wide', me.first)}`);
    } else if (fork === 'second') {
      this.fork?.setText(
        [
          `UP: ${word('pier', me.second)}`,
          ...(open.includes('bay') ? [`LEFT: ${word('bay', me.second)}`] : []),
          ...(open.includes('air') ? [`RIGHT: ${word('air', me.second)}`] : []),
        ].join(' · '),
      );
    } else {
      this.fork?.setText('');
    }
  }
}
