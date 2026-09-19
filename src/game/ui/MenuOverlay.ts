import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { menuClickSound } from '../audio/menuSounds';
import { claimOverlayKeyboard } from './overlayKeyboard';

export class MenuOverlay {
  public readonly root: HTMLElement;
  private readonly releaseKeyboard: () => void;
  private readonly artworkErrorHandler: (event: Event) => void;
  private readonly clickSoundHandler: (event: Event) => void;

  public constructor(
    scene: Phaser.Scene,
    className: string,
    onKeyDown: (event: KeyboardEvent) => void,
  ) {
    this.root = document.createElement('section');
    this.root.className = `menu-overlay ${className}`;
    this.root.setAttribute('aria-label', 'Game menu');
    document.getElementById('app')?.append(this.root);
    // An overlay owns the keyboard for as long as it is on screen; see
    // `overlayKeyboard.ts` for why that ownership cannot live in the scenes.
    this.releaseKeyboard = claimOverlayKeyboard((event) => {
      // Every screen moves its cursor by moving focus, so focus having moved is
      // the one definition of "the cursor moved" that holds for all of them.
      const focused = document.activeElement;
      onKeyDown(event);
      if (document.activeElement !== focused && event.key.startsWith('Arrow')) {
        audioManager.play('select');
      }
    }, window);
    // Capture, so the baseline sounds before the button's own handler runs and
    // that handler's more specific effect is the one left standing.
    this.clickSoundHandler = (event) => {
      const button = (event.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) {
        return;
      }
      const sound = menuClickSound(button.dataset);
      if (sound) {
        audioManager.play(sound);
      }
    };
    this.root.addEventListener('click', this.clickSoundHandler, true);
    this.artworkErrorHandler = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.pokemon-avatar img')) {
        return;
      }
      image.remove();
      image.parentElement?.classList.add('artwork-unavailable');
    };
    this.root.addEventListener('error', this.artworkErrorHandler, true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  public destroy(): void {
    this.releaseKeyboard();
    this.root.removeEventListener('error', this.artworkErrorHandler, true);
    this.root.removeEventListener('click', this.clickSoundHandler, true);
    this.root.remove();
  }

  public focus(selector: string): void {
    requestAnimationFrame(() => this.root.querySelector<HTMLElement>(selector)?.focus());
  }
}

export function pokemonAvatar(dexId: number, name: string): string {
  return `<span class="pokemon-avatar" aria-label="${name}"><img src="/assets/pokemon/front/${dexId}.png" alt="${name} artwork" /><span aria-hidden="true">${name.slice(0, 1)}</span></span>`;
}

export function hpBar(current: number, max: number): string {
  const ratio = max === 0 ? 0 : Math.max(0, Math.min(1, current / max));
  const state = ratio > 0.5 ? 'healthy' : ratio > 0.2 ? 'warning' : 'critical';
  return `<div class="hp-track" aria-label="HP ${current} of ${max}"><span class="${state}" style="width:${ratio * 100}%"></span></div>`;
}

export function typeBadge(type: string): string {
  return `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`;
}
