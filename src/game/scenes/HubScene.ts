import Phaser from 'phaser';
import { Bag, ITEM_DEFINITIONS, type ItemDefinition, type ItemId } from '../items';
import { PokemonParty } from '../pokemon';
import { activeRunManager, type ItemStack, type SecureSlot } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { formatObjectiveReward, RUN_OBJECTIVES } from '../objectives';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { type SecureSlot as StashSecureSlot, type Stash, type StashedPokemon } from '../stash';
import { MenuOverlay, hpBar, pokemonAvatar, typeBadge } from '../ui/MenuOverlay';

// Leaves enough time to visit an outer area and return, while still punishing detours.
const RUN_DURATION_MS = 18 * 60 * 1000;

export interface HubSceneData {
  readonly savedGame?: RestoredGame;
}

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  private selectedPokemonIds: string[] = [];
  private selectedItems = new Map<ItemId, number>();
  private securedPokemonId: string | undefined;
  private securedItemIds: ItemId[] = [];
  private selectedInsertionId: RunInsertionId = 'town-square';
  private overlay!: MenuOverlay;
  private view: 'home' | 'stash' | 'loadout' | 'secure' = 'home';
  private status = '';

  public constructor() {
    super('hub');
  }

  public init(data: HubSceneData = {}): void {
    const loaded = data.savedGame ?? this.saveManager.load();
    if (!loaded) {
      throw new Error('HubScene requires a saved game.');
    }

    this.savedGame = loaded;
    this.stash = loaded.stash;
    this.selectedPokemonIds = this.stash.listPokemon().slice(0, 1).map(({ id }) => id);
    this.selectedItems.clear();
    this.securedPokemonId = undefined;
    this.securedItemIds = [];
    this.selectedInsertionId = 'town-square';
  }

  public create(): void {
    this.cameras.main.fadeIn?.(180, 0, 0, 0);
    this.overlay = new MenuOverlay(this, 'hub-menu', (event) => this.handleKey(event));
    this.render();
  }

  private get stashPokemon(): readonly StashedPokemon[] {
    return this.stash.listPokemon();
  }

  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.stash.itemCount(item.id) > 0);
  }

  private get loadoutPokemon(): readonly StashedPokemon[] {
    return this.selectedPokemonIds
      .map((id) => this.stashPokemon.find((stored) => stored.id === id))
      .filter((stored): stored is StashedPokemon => stored !== undefined);
  }

  private get loadoutItems(): readonly ItemStack[] {
    return [...this.selectedItems].map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  private togglePokemon(pokemon: StashedPokemon): void {
      if (this.selectedPokemonIds.includes(pokemon.id)) {
        this.selectedPokemonIds = this.selectedPokemonIds.filter((id) => id !== pokemon.id);
        if (this.securedPokemonId === pokemon.id) this.securedPokemonId = undefined;
      } else if (this.selectedPokemonIds.length < 6) {
        this.selectedPokemonIds.push(pokemon.id);
      } else this.setStatus('Your run party can hold up to 6 Pokemon.');
  }

  private adjustItem(itemId: ItemId, direction: number): void {
    const quantity = this.selectedItems.get(itemId) ?? 0;
    const next = Math.max(0, Math.min(this.stash.itemCount(itemId), quantity + direction));
    if (next === 0) {
      this.selectedItems.delete(itemId);
      this.securedItemIds = this.securedItemIds.filter((id) => id !== itemId);
    } else this.selectedItems.set(itemId, next);
  }

  private toggleSecurePokemon(id: string): void {
    this.securedPokemonId = this.securedPokemonId === id ? undefined : id;
  }

  private toggleSecureItem(id: ItemId): void {
    if (this.securedItemIds.includes(id)) this.securedItemIds = this.securedItemIds.filter((item) => item !== id);
    else if (this.securedItemIds.length < 2) this.securedItemIds.push(id);
    else this.setStatus('The secure slot protects two item stacks.');
  }

  private startRun(): void {
    const party = this.loadoutPokemon;
    if (party.length === 0) {
      this.setStatus('Add at least one Pokemon to your run loadout.');
      return;
    }
    const secureSlot = this.runSecureSlot(party);
    activeRunManager.startRun(
      { party: party.map((stored) => stored.pokemon), items: this.loadoutItems },
      { mapId: 'pallet-town', durationMs: RUN_DURATION_MS },
      secureSlot,
    );
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const firstContractActive = !this.savedGame.raidProgress.firstContractExtracted;
    const plan = generateRunPlan(seed, undefined, this.selectedInsertionId, firstContractActive);
    const runSession = createActiveRunSession(
      activeRunManager,
      secureSlot,
      this.stashSecureSlot(),
      this.selectedPokemonIds,
      this.loadoutItems,
      firstContractActive ? RUN_OBJECTIVES : [],
      plan,
    );
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('world', {
        party: new PokemonParty(party.map((stored) => stored.pokemon)),
        bag: new Bag(Object.fromEntries(this.loadoutItems.map(({ itemId, quantity }) => [itemId, quantity]))),
        runSession,
      });
    });
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.view !== 'home') {
      event.preventDefault(); this.view = 'home'; this.render(); return;
    }
    const controls = [...this.overlay.root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const current = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) && controls.length) {
      event.preventDefault();
      controls[(current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
  }

  private render(): void {
    const back = this.view === 'home' ? '' : '<button class="back-button" data-view="home">← Base</button>';
    this.overlay.root.innerHTML = `<div class="menu-shell"><header class="menu-header">${back}<div><p class="eyebrow">Pallet Town</p><h1>${this.view === 'home' ? 'Ready for a run?' : this.view === 'stash' ? 'Your stash' : this.view === 'loadout' ? 'Build your loadout' : 'Secure slot'}</h1></div><div class="stash-count">${this.stashPokemon.length} Pokémon · ${this.stashItems.length} item types</div></header>${this.content()}${this.status ? `<p class="menu-status" role="status">${this.status}</p>` : ''}</div>`;
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.onclick = () => { this.view = button.dataset.view as typeof this.view; this.render(); });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-pokemon]').forEach((button) => button.onclick = () => { this.togglePokemon(this.stashPokemon.find((p) => p.id === button.dataset.pokemon)!); this.render(); });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((button) => { button.onclick = () => { this.adjustItem(button.dataset.item as ItemId, Number(button.dataset.amount)); this.render(); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-secure-pokemon]').forEach((button) => { button.onclick = () => { this.toggleSecurePokemon(button.dataset.securePokemon!); this.render(); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-secure-item]').forEach((button) => { button.onclick = () => { this.toggleSecureItem(button.dataset.secureItem as ItemId); this.render(); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-insertion]').forEach((button) => {
      button.onclick = () => { this.selectedInsertionId = button.dataset.insertion as RunInsertionId; this.render(); };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-start]')?.addEventListener('click', () => this.startRun());
    this.overlay.focus('button');
  }

  private content(): string {
    if (this.view === 'home') return `<main class="hub-home">${this.savedGame.raidProgress.firstContractExtracted ? '<section class="panel objectives-panel"><div class="panel-heading"><div><p class="eyebrow">New permanent unlock</p><h2>South Verge + Super Potion</h2></div><small>Now available in your stash and insertion list</small></div></section>' : ''}<section class="hub-actions"><button class="action-card primary" data-start><span>DEPLOY</span><h2>Deploy to ${RUN_INSERTIONS[this.selectedInsertionId].label}</h2><p>${this.savedGame.raidProgress.firstContractExtracted ? 'South Verge is unlocked. Take your partner out, find supplies, and escape with your haul.' : 'Your recommended partner is ready. Recover the lost field kit on Route 1, then escape through the marked South Gate.'}</p><b>Begin raid →</b></button><button class="action-card" data-view="loadout"><span>PREPARE</span><h2>Loadout & insertion</h2><p>${this.loadoutPokemon.length}/6 Pokémon selected. Everything taken is at risk.</p><b>Adjust raid plan →</b></button><button class="action-card" data-view="stash"><span>STASH</span><h2>Review supplies</h2><p>Check the Pokémon and supplies secured at base.</p><b>Open stash →</b></button></section>${this.savedGame.raidProgress.firstContractExtracted ? '' : `<section class="panel objectives-panel"><div class="panel-heading"><div><p class="eyebrow">Active contract</p><h2>Lost field kit</h2></div><small>Reward requires extraction</small></div><div class="objective-list">${RUN_OBJECTIVES.map((objective) => `<article class="entity-row"><span class="item-icon">✦</span><div class="objective-copy"><strong>${objective.description}</strong><small>Reward: unlock South Verge + ${formatObjectiveReward(objective.reward)}</small></div></article>`).join('')}</div></section>`}</main>`;
    if (this.view === 'stash') return `<main class="stash-layout"><section><h2>Pokémon</h2><div class="entity-list">${this.stashPokemon.map((stored) => `<article class="entity-row">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div><strong>${stored.pokemon.base.name}</strong><small>Level ${stored.pokemon.level} · ${stored.pokemon.currentHp}/${stored.pokemon.maxHp} HP</small>${hpBar(stored.pokemon.currentHp, stored.pokemon.maxHp)}</div><div>${typeBadge(stored.pokemon.base.primaryType)}${stored.pokemon.base.secondaryType ? typeBadge(stored.pokemon.base.secondaryType) : ''}</div></article>`).join('') || '<p class="empty-state">No Pokémon in storage.</p>'}</div></section><section><h2>Supplies</h2><div class="item-grid">${this.stashItems.map((item) => `<article class="item-card"><span class="item-icon">✦</span><strong>${item.displayName}</strong><small>${item.category} · ${this.stash.itemCount(item.id)} available</small></article>`).join('') || '<p class="empty-state">No supplies in storage.</p>'}</div></section></main>`;
    if (this.view === 'loadout') return `<main class="loadout-layout"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Available</p><h2>Stash</h2></div><small>Click to add or remove</small></div><div class="entity-list">${this.stashPokemon.map((stored) => `<button class="entity-row selectable ${this.selectedPokemonIds.includes(stored.id) ? 'selected' : ''}" data-pokemon="${stored.id}">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div><strong>${stored.pokemon.base.name}</strong><small>Level ${stored.pokemon.level}${stored.id === this.stashPokemon[0]?.id ? ' · Recommended partner' : ''}</small></div><span>${this.selectedPokemonIds.includes(stored.id) ? 'Added' : 'Add +'}</span></button>`).join('')}<div class="item-grid compact">${this.stashItems.map((item) => `<article class="item-card"><strong>${item.displayName}</strong><small>${this.stash.itemCount(item.id)} available</small><div><button data-item="${item.id}" data-amount="-1" aria-label="Remove ${item.displayName}">−</button><b>${this.selectedItems.get(item.id as ItemId) ?? 0}</b><button data-item="${item.id}" data-amount="1" aria-label="Add ${item.displayName}">+</button></div></article>`).join('')}</div></div></section><section class="panel run-loadout"><div class="panel-heading"><div><p class="eyebrow">Insertion</p><h2>Choose your entry</h2></div></div>${(Object.entries(RUN_INSERTIONS) as [RunInsertionId, typeof RUN_INSERTIONS[RunInsertionId]][]).filter(([id]) => this.savedGame.raidProgress.unlockedInsertions.includes(id)).map(([id, insertion]) => `<button class="entity-row selectable ${this.selectedInsertionId === id ? 'selected' : ''}" data-insertion="${id}"><strong>${insertion.label}</strong><small>${insertion.description}</small></button>`).join('')}<div class="panel-heading"><div><p class="eyebrow">At risk</p><h2>Run loadout</h2></div><b>${this.loadoutPokemon.length}/6</b></div>${this.loadoutPokemon.map((stored) => `<article class="entity-row">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<strong>${stored.pokemon.base.name}</strong></article>`).join('') || '<p class="empty-state">Add a Pokémon from your stash.</p>'}<div class="risk-note">Everything here is lost on a wipe unless it is in the secure slot.</div><button class="button primary-button" data-view="secure">Set up secure slot →</button><button class="button" data-start ${this.loadoutPokemon.length ? '' : 'disabled'}>Deploy to ${RUN_INSERTIONS[this.selectedInsertionId].label}</button></section></main>`;
    return `<main class="secure-layout"><section class="secure-intro"><p class="eyebrow">Protected on a wipe</p><h2>SECURED</h2><p>One Pokémon and two item stacks survive. Everything else in your loadout is at risk.</p></section><section class="secure-group"><h2>Pokémon <small>1 slot</small></h2>${this.loadoutPokemon.map((stored) => `<button class="entity-row selectable ${this.securedPokemonId === stored.id ? 'secured' : ''}" data-secure-pokemon="${stored.id}">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<strong>${stored.pokemon.base.name}</strong><span>${this.securedPokemonId === stored.id ? 'Secured ✓' : 'Secure'}</span></button>`).join('') || '<p class="empty-state">Add a Pokémon to your loadout first.</p>'}</section><section class="secure-group"><h2>Item stacks <small>${this.securedItemIds.length}/2 slots</small></h2>${this.loadoutItems.map((item) => `<button class="entity-row selectable ${this.securedItemIds.includes(item.itemId) ? 'secured' : ''}" data-secure-item="${item.itemId}"><span class="item-icon">✦</span><strong>${this.itemName(item.itemId)} ×${item.quantity}</strong><span>${this.securedItemIds.includes(item.itemId) ? 'Secured ✓' : 'Secure'}</span></button>`).join('') || '<p class="empty-state">Add supplies to your loadout first.</p>'}<button class="button primary-button" data-view="loadout">Back to loadout</button></section></main>`;
  }

  private runSecureSlot(party: readonly StashedPokemon[]): SecureSlot {
    const securedPokemon = party.find((stored) => stored.id === this.securedPokemonId)?.pokemon;
    return {
      ...(securedPokemon === undefined ? {} : { pokemon: securedPokemon }),
      items: this.loadoutItems.filter((item) => this.securedItemIds.includes(item.itemId)),
    };
  }

  private stashSecureSlot(): StashSecureSlot {
    return {
      ...(this.securedPokemonId === undefined ? {} : { pokemonId: this.securedPokemonId }),
      items: this.loadoutItems
        .filter((item) => this.securedItemIds.includes(item.itemId))
        .map(({ itemId, quantity }) => ({ itemId, quantity })),
    };
  }


  private itemName(itemId: ItemId): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  private setStatus(message: string): void {
    this.status = message;
    this.render();
    this.time.delayedCall(2200, () => { this.status = ''; this.render(); });
  }
}
