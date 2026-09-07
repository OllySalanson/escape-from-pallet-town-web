import Phaser from 'phaser';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { SaveManager } from '../save/SaveManager';
import {
  createStartingStash,
  getStarterSpecies,
  type StarterSpeciesId,
} from '../stash';
import { MenuOverlay } from '../ui/MenuOverlay';
import { starterCards, starterLoadoutSummary } from '../ui/starterPicker';

export class StarterScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private selectedStarterId: StarterSpeciesId = 'bulbasaur';
  private overlay!: MenuOverlay;

  public constructor() {
    super('starter');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'starter-menu', (event) => this.handleKey(event));
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    const controls = [...this.overlay.root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const current = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) && controls.length) {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      controls[(current + direction + controls.length) % controls.length]?.focus();
    }
  }

  private render(): void {
    const selected = getStarterSpecies(this.selectedStarterId);
    this.overlay.root.innerHTML = `<div class="menu-shell starter-shell"><header class="starter-header"><p class="eyebrow">First raid briefing</p><h1>Choose your partner</h1><p>Your partner enters the lost field kit raid with you. Choose carefully, then confirm to lock in your first Pokémon.</p></header><main class="starter-grid">${starterCards(this.selectedStarterId)}</main><footer class="starter-confirm"><div><span class="eyebrow">Ready to deploy</span><strong>${selected.name}</strong><small>${starterLoadoutSummary(selected)}</small></div><button class="button primary-button" data-confirm>Confirm ${selected.name} →</button></footer></div>`;
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-starter]').forEach((button) => {
      button.onclick = () => {
        this.selectedStarterId = button.dataset.starter as StarterSpeciesId;
        this.render();
      };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-confirm]')?.addEventListener('click', () => this.confirmStarter());
    this.overlay.focus('[data-confirm]');
  }

  private confirmStarter(): void {
    const starter = getStarterSpecies(this.selectedStarterId);
    const newGame = {
      party: new PokemonParty([]),
      mapId: 'pallet-town' as const,
      position: { x: 6, y: 8 },
      items: [],
      bag: new Bag(),
      stash: createStartingStash(starter),
      starterSpeciesId: this.selectedStarterId,
    };
    this.saveManager.save(newGame);
    this.scene.start('hub', { savedGame: this.saveManager.load() ?? newGame });
  }
}
