import Phaser from 'phaser';

export class MenuOverlay {
  public readonly root: HTMLElement;
  private readonly keyHandler: (event: KeyboardEvent) => void;
  private readonly artworkErrorHandler: (event: Event) => void;

  public constructor(
    scene: Phaser.Scene,
    className: string,
    onKeyDown: (event: KeyboardEvent) => void,
  ) {
    this.root = document.createElement('section');
    this.root.className = `menu-overlay ${className}`;
    this.root.setAttribute('aria-label', 'Game menu');
    document.getElementById('app')?.append(this.root);
    this.keyHandler = (event) => {
      if (event.defaultPrevented || event.target instanceof HTMLInputElement) {
        return;
      }
      onKeyDown(event);
    };
    this.artworkErrorHandler = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.pokemon-avatar img')) {
        return;
      }
      image.remove();
      image.parentElement?.classList.add('artwork-unavailable');
    };
    window.addEventListener('keydown', this.keyHandler);
    this.root.addEventListener('error', this.artworkErrorHandler, true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.root.removeEventListener('error', this.artworkErrorHandler, true);
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
