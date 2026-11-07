import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { harbourBite, type HarbourBite } from '../base/harbourFishing';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import type { StashedPokemon } from '../stash';
import { drawPixelWindow, WINDOW_CREAM } from '../ui/pixelWindow';
import { castDurationMs, dotsShown, NOT_EVEN_A_NIBBLE, ON_THE_HOOK, type CastPlan } from '../world/fishing';
import {
  biteChance,
  derbyTimeUp,
  landCatch,
  leadNotes,
  planDerbyCast,
  secondsLeft,
  startFishingDerby,
  type FishingDerbyState,
} from '../minigames/fishingDerby';
import { FISHING_DERBY_TICKET_TIERS } from '../minigames/tickets';
import type { PokemonTraits } from '../minigames/traits';
import { OutdoorGameScene, type OutdoorFit } from './OutdoorGameScene';

/** Where the line goes in: off the pier head, in the deep water (`harbourFishing.ts`). */
const DEEP_END = { x: 80, y: 31 } as const;
/** How long a catch, or a miss, is shown before the next cast. */
const SHOW_CATCH_MS = 1100;
const SHOW_MISS_MS = 700;
/** How long the last of the derby is shown before the screen comes back. */
const END_PAUSE_MS = 1300;

type Cast =
  | { readonly kind: 'idle' }
  | { readonly kind: 'casting'; readonly plan: CastPlan; readonly elapsed: number }
  | { readonly kind: 'landed'; readonly bite: HarbourBite; readonly scored: number; readonly newKind: boolean; readonly left: number }
  | { readonly kind: 'missed'; readonly left: number }
  | { readonly kind: 'over'; readonly left: number };

/**
 * THE FISHING DERBY, off the head of THE PLEASURE PIER
 * (`minigames/fishingDerby.ts`): two minutes of the raid's own FireRed
 * fishing - the cast, its dots and the coin - with a tally. SPACE casts; a
 * bite is reeled in, scored and let go, as the harbour's fishing does. The
 * lead sits on the pier beside the player, and its ability decides how often
 * anything bites: Illuminate twice as often, Stench half.
 */
export class FishingDerbyScene extends OutdoorGameScene {
  protected readonly source = 'fishing-derby' as const;
  protected readonly words = {
    title: 'FISHING DERBY',
    place: 'Pleasure Pier · ',
    heading: 'Who sits with you?',
    doing: 'Leading',
    rules: 'Two minutes off the deep end with a borrowed GOOD ROD: a catch scores its level, a kind new this derby ten more. ILLUMINATE draws twice the bites; STENCH drives them off.',
    playHelp: 'SPACE casts. The clock runs from the first cast; keep a line in the water.',
  };

  private state: FishingDerbyState | undefined;
  private cast: Cast = { kind: 'idle' };
  private started = false;
  private hud: Phaser.GameObjects.Text | undefined;
  private callout: Phaser.GameObjects.Text | undefined;
  private line: Phaser.GameObjects.Graphics | undefined;
  private catchSprite: Phaser.GameObjects.Image | undefined;

  public constructor() {
    super('fishing-derby');
  }

  /** For a playtest driver: the derby so far. */
  public get derbyState(): FishingDerbyState | undefined {
    return this.state;
  }

  /** For a playtest driver: cast, as SPACE does. */
  public castLine(): void {
    if (this.playing) this.castNow();
  }

  protected fitOf(traits: PokemonTraits): OutdoorFit {
    const chance = biteChance(traits);
    return { fit: chance >= 1 ? 3 : chance >= 0.5 ? 1.5 : 0.5, notes: leadNotes(traits) };
  }

  protected bestWords(best: number): string {
    return `${best} points`;
  }

  protected todayLine(): string {
    const [first, second, third] = FISHING_DERBY_TICKET_TIERS;
    return `Tickets at ${first.score}, ${second.score} and ${third.score} points.`;
  }

  protected beginGame(chosen: StashedPokemon, traits: PokemonTraits): void {
    this.state = startFishingDerby(traits, chosen.pokemon.name);
    this.cast = { kind: 'idle' };
    this.started = false;
    const { width, height } = this.scale;
    const back = this.keep(this.add.graphics().setDepth(0));
    // The view off the pier head: sky, the far breakwater, open sea, and the
    // pier's planks under the player.
    const sea = Math.round(height * 0.34);
    back.fillStyle(0x88c8f8, 1).fillRect(0, 0, width, sea);
    back.fillStyle(0xb8e0f8, 1).fillRect(0, sea - 14, width, 8);
    back.fillStyle(0xf8f8f8, 1).fillEllipse(60, 26, 40, 10).fillEllipse(width - 80, 40, 52, 12);
    back.fillStyle(0xa8a8b8, 1).fillRect(0, sea - 6, Math.round(width * 0.35), 6);
    back.fillStyle(0x686878, 1).fillRect(0, sea - 1, Math.round(width * 0.35), 1);
    back.fillStyle(0x3870c8, 1).fillRect(0, sea, width, height - sea);
    for (let index = 0; index < 70; index += 1) {
      const x = (index * 61) % width;
      const y = sea + 6 + ((index * 23) % (height - sea - 40));
      back.fillStyle(index % 3 === 0 ? 0x88c0f8 : 0x2858a8, 1).fillRect(x, y, 6, 1);
    }
    const deck = height - 40;
    back.fillStyle(0xb07840, 1).fillRect(0, deck, width, height - deck);
    for (let x = 0; x < width; x += 16) back.fillStyle(0x704020, 1).fillRect(x, deck, 1, height - deck);
    back.fillStyle(0xd8a060, 1).fillRect(0, deck, width, 2);
    back.fillStyle(0x303848, 1).fillRect(0, deck - 10, width, 2);
    for (let x = 8; x < width; x += 24) back.fillStyle(0x303848, 1).fillRect(x, deck - 10, 2, 10);
    this.keep(
      this.add
        .image(Math.round(width * 0.14), height - 6, pokemonTextureKey('back', chosen.pokemon.base.dexId, chosen.pokemon.shiny))
        .setOrigin(0.5, 1)
        .setDepth(3),
    );
    this.line = this.keep(this.add.graphics().setDepth(4));
    const panel = this.keep(this.add.graphics().setDepth(10));
    drawPixelWindow(panel, { x: 4, y: 4, width: 112, height: 44 }, { fill: WINDOW_CREAM });
    this.hud = this.words_(9, 6, '', { colour: '#202030' }).setStroke('#202030', 0).setDepth(11);
    this.callout = this.words_(width / 2, Math.round(height * 0.5), 'SPACE: cast!', { big: true, origin: [0.5, 0.5] });
    this.words_(width / 2, height - 3, 'SPACE: cast · ESC: stop', { origin: [0.5, 1] });
    this.drawDerby();
  }

  protected onGameKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.castNow();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finishDerby();
    }
  }

  private castNow(): void {
    if (!this.state || this.cast.kind !== 'idle' || derbyTimeUp(this.state)) return;
    this.started = true;
    const plan = planDerbyCast(this.state.lead);
    this.state = { ...this.state, casts: this.state.casts + 1 };
    this.cast = { kind: 'casting', plan, elapsed: 0 };
    this.catchSprite?.destroy();
    this.catchSprite = undefined;
    this.callout?.setText('');
    audioManager.play('select');
  }

  public update(_time: number, delta: number): void {
    if (!this.playing || !this.state) return;
    if (this.started && this.cast.kind !== 'over') {
      this.state = { ...this.state, elapsed: this.state.elapsed + delta };
    }
    const cast = this.cast;
    if (cast.kind === 'casting') {
      const elapsed = cast.elapsed + delta;
      if (elapsed >= castDurationMs(cast.plan)) {
        const bite = cast.plan.bites ? harbourBite(DEEP_END) : null;
        if (bite) {
          const landed = landCatch(this.state, bite.speciesId, bite.level);
          this.state = landed.state;
          this.cast = { kind: 'landed', bite, scored: landed.scored, newKind: landed.newKind, left: SHOW_CATCH_MS };
          this.callout?.setText([ON_THE_HOOK, `Lv. ${bite.level} ${bite.name}  +${landed.scored}${landed.newKind ? ' NEW!' : ''}`]).setColor('#f8e070');
          this.catchSprite = this.keep(
            this.add.image(Math.round(this.scale.width * 0.7), Math.round(this.scale.height * 0.62), pokemonTextureKey('front', bite.dexId)).setDepth(5),
          );
          audioManager.play('lootPickup');
        } else {
          this.cast = { kind: 'missed', left: SHOW_MISS_MS };
          this.callout?.setText(NOT_EVEN_A_NIBBLE).setColor('#f8f8f8');
          audioManager.play('denied');
        }
      } else {
        this.cast = { ...cast, elapsed };
      }
    } else if (cast.kind === 'landed' || cast.kind === 'missed') {
      const left = cast.left - delta;
      this.cast = left > 0 ? { ...cast, left } : { kind: 'idle' };
      if (left <= 0) this.callout?.setText(derbyTimeUp(this.state) ? '' : 'SPACE: cast!').setColor('#f8f8f8');
    } else if (cast.kind === 'over') {
      const left = cast.left - delta;
      this.cast = { kind: 'over', left };
      if (left <= 0) this.finishDerby();
      return;
    }
    if (this.cast.kind === 'idle' && derbyTimeUp(this.state)) {
      this.cast = { kind: 'over', left: END_PAUSE_MS };
      this.callout?.setText(["TIME'S UP!", `${this.state.score} points`]).setColor('#f8e070');
      audioManager.play('confirm');
    }
    this.drawDerby();
  }

  private finishDerby(): void {
    const state = this.state;
    if (!state || !this.playing) return;
    this.state = undefined;
    this.catchSprite = undefined;
    this.endGame(state.score, `Landed ${state.catches} in ${state.casts} casts: ${state.score} points`);
  }

  private drawDerby(): void {
    const state = this.state;
    if (!state) return;
    const { width, height } = this.scale;
    const line = this.line?.clear();
    if (line) {
      // The rod, propped on the rail beside the lead.
      const rodX = Math.round(width * 0.32);
      const rodY = height - 58;
      line.lineStyle(2, 0x704020, 1).lineBetween(rodX - 6, rodY + 24, rodX + 18, rodY - 6);
      if (this.cast.kind === 'casting') {
        const floatX = Math.round(width * 0.62);
        const floatY = Math.round(height * 0.55);
        line.lineStyle(1, 0xf8f8f8, 0.9).lineBetween(rodX + 18, rodY - 6, floatX, floatY);
        line.fillStyle(0xe04040, 1).fillCircle(floatX, floatY, 3);
        line.fillStyle(0xf8f8f8, 1).fillRect(floatX - 3, floatY, 6, 2);
        const dots = dotsShown(this.cast.plan, this.cast.elapsed);
        for (let index = 0; index < dots; index += 1) line.fillStyle(0xf8f8f8, 1).fillRect(floatX - 20 + index * 5, floatY - 14, 2, 2);
      }
    }
    this.hud?.setText([
      `TIME ${this.started ? secondsLeft(state) : 120}s`,
      `POINTS ${state.score}`,
      `CAUGHT ${state.catches} · KINDS ${state.kinds.length}`,
    ]);
  }
}
