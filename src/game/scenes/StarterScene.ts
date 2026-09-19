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
import { pixelCommitBar, pixelScreen } from '../ui/pixelUi';
import { starterCards, starterLoadoutSummary } from '../ui/starterPicker';

export class StarterScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private selectedStarterId: StarterSpeciesId = 'bulbasaur';
  private overlay!: MenuOverlay;

  public constructor() {
    super('starter');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'starter-menu pixel-ui', (event) => this.handleKey(event));
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private render(): void {
    const selected = getStarterSpecies(this.selectedStarterId);
    this.overlay.root.innerHTML = pixelScreen({
      place: 'First raid briefing',
      title: 'Choose your partner',
      hints: 'ARROWS move · ENTER choose',
      body: `<main class="px-body starter-shell"><p class="starter-brief">Your partner enters the lost field kit raid with you. Choose carefully.</p><div class="starter-grid">${starterCards(this.selectedStarterId)}</div>${pixelCommitBar({
        title: selected.name,
        // The bar's title is the name and the button confirms it by name, so
        // the line is only what the name does not say.
        lines: [`<span class="px-wrap">${starterLoadoutSummary(selected)}</span>`],
        actions: `<button class="px-window px-button is-primary" data-confirm data-sfx="confirm" data-help="Locks in ${selected.name} as your first Pokémon.">Confirm ${selected.name}</button>`,
      })}</main>`,
    });
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
