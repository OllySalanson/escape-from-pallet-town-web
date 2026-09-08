import Phaser from 'phaser';
import {
  applyRecovery,
  DeploymentFlow,
  FAINTED_TREATMENT_NOTE,
  formatRecoveryClock,
  needsRecovery,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidClockAfterRecovery,
  recoveryCostMs,
  treatmentOptions,
  treatWithItem,
  type Deployment,
  type TreatmentOption,
} from '../hub';
import { Bag, ITEM_DEFINITIONS, type ItemDefinition, type ItemId } from '../items';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { activeRunManager } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import { createActiveRunSession } from '../run/RunSession';
import {
  FIRST_CONTRACT,
  generateRunPlan,
  RUN_INSERTIONS,
  type RunInsertionId,
} from '../run/runGeneration';
import {
  availableContracts,
  contractCarryIn,
  contractForMap,
  formatStacks,
  missingCarryIn,
  objectivesForContract,
  secureItemStackLimit,
  type RaidContract,
} from '../objectives';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import {
  getStarterSpecies,
  type StarterSpeciesId,
  type Stash,
  type StashedPokemon,
} from '../stash';
import { itemIcon, objectiveIcon } from '../ui/icons';
import { WORLD_MAP_NAMES } from '../worldMap';
import { MenuOverlay, hpBar, pokemonAvatar, typeBadge } from '../ui/MenuOverlay';
import { conditionLine } from '../ui/condition';
import { starterCards, starterLoadoutSummary } from '../ui/starterPicker';

export interface HubSceneData {
  readonly savedGame?: RestoredGame;
}

/** Base screens outside preparation; the deploy route is owned by DeploymentFlow. */
type HubView = 'home' | 'stash' | 'deploy' | 'reselect';

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  private flow!: DeploymentFlow;
  private overlay!: MenuOverlay;
  private view: HubView = 'home';
  private reselectStarterId: StarterSpeciesId = 'bulbasaur';
  /** A swap only runs from an explicit second click, so a misclick cannot delete a survivor. */
  private swapArmed = false;
  private status = '';

  public constructor() {
    super('hub');
  }

  /**
   * The stored save wins over any handed-in snapshot. Phaser reuses a scene's
   * previous start payload when a later `scene.start('hub')` passes none, so a
   * raid that banked a contract used to return to a hub still rendering the
   * snapshot captured at game start. Storage is written before every hand-off,
   * so the passed game is only a fallback for storage-less browsers.
   */
  public init(data: HubSceneData = {}): void {
    const loaded = this.saveManager.load() ?? data.savedGame;
    if (!loaded) {
      throw new Error('HubScene requires a saved game.');
    }

    this.applyLoadedGame(loaded);
  }

  private applyLoadedGame(loaded: RestoredGame): void {
    this.savedGame = loaded;
    this.stash = loaded.stash;
    // Nothing is pre-selected: the raid party is always something the player picked.
    this.flow = new DeploymentFlow(
      this.stash,
      this.unlockedInsertions[0]?.[0],
      secureItemStackLimit(loaded.raidProgress.completedContracts),
    );
    this.view = 'home';
    this.reselectStarterId = this.startingStarterId();
    this.swapArmed = false;
    this.status = '';
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

  private get firstContractActive(): boolean {
    return !this.savedGame.raidProgress.firstContractExtracted;
  }

  /** Every contract the board is offering, in the order they unlock. */
  private get openContracts(): readonly RaidContract[] {
    return availableContracts(this.savedGame.raidProgress.completedContracts);
  }

  /**
   * The contract a raid inserting here would carry. A contract belongs to its
   * map, so the insertion list *is* the contract board: choosing where to drop
   * in is choosing which contract to take, and no separate acceptance step can
   * fall out of step with it.
   */
  private contractFor(insertionId: RunInsertionId): RaidContract | undefined {
    return contractForMap(
      RUN_INSERTIONS[insertionId].mapId,
      this.savedGame.raidProgress.completedContracts,
    );
  }

  /**
   * What the chosen contract asks you to pack, checked against what is actually
   * in the loadout. A delivery is decided here or not at all: the drop refuses
   * a player who arrives without the supplies, and the raid is spent by then.
   */
  private carryInNote(): string {
    const contract = this.contractFor(this.flow.insertionId);
    const required = contract ? contractCarryIn(contract) : [];
    if (required.length === 0) {
      return '';
    }
    const short = missingCarryIn(required, (itemId) => this.flow.itemQuantity(itemId));
    return short.length === 0
      ? `<p class="confirm-note">${contract!.name}: ${formatStacks(required)} packed for the drop. They are spent when you hand them over.</p>`
      : `<div class="risk-note">${contract!.name} needs ${formatStacks(required)} in your pack. Still short: ${formatStacks(short)}.</div>`;
  }

  /**
   * Unlocked entries, narrowed to the active contract's own area while one is
   * running, so a first raid can never be deployed somewhere its objective is
   * unreachable. Every unlocked insertion returns the moment it is banked.
   */
  private get unlockedInsertions(): readonly [RunInsertionId, (typeof RUN_INSERTIONS)[RunInsertionId]][] {
    const entries = Object.entries(RUN_INSERTIONS) as [
      RunInsertionId,
      (typeof RUN_INSERTIONS)[RunInsertionId],
    ][];
    return entries.filter(
      ([id, insertion]) =>
        this.savedGame.raidProgress.unlockedInsertions.includes(id) &&
        (!this.firstContractActive || insertion.mapId === FIRST_CONTRACT.mapId),
    );
  }

  /** Everyone at base who a recovery would actually change. */
  private get injuredPokemon(): readonly StashedPokemon[] {
    return pokemonNeedingRecovery(this.stash);
  }

  private get pendingRecoveryMs(): number {
    return this.savedGame.pendingRecoveryMs;
  }

  /** The clock the next raid starts with, once recovery is taken out of it. */
  private get raidClockMs(): number {
    return raidClockAfterRecovery(RAID_DURATION_MS, this.pendingRecoveryMs);
  }

  /**
   * Restores Pokemon at base and books the time to the next raid clock. The
   * scene's own stash is the one treated, so a half-built loadout keeps pointing
   * at the same Pokemon it did before, now healed.
   */
  private recover(ids: readonly string[]): void {
    const outcome = applyRecovery(this.stash, this.pendingRecoveryMs, ids);
    if (outcome.recoveredIds.length === 0) {
      this.setStatus('Everyone there is already fit.');
      return;
    }

    this.savedGame = { ...this.savedGame, pendingRecoveryMs: outcome.pendingRecoveryMs };
    const treated =
      outcome.recoveredIds.length === 1
        ? (this.stash.listPokemon().find((stored) => stored.id === outcome.recoveredIds[0])?.pokemon
            .base.name ?? 'Your Pokémon')
        : `${outcome.recoveredIds.length} Pokémon`;
    const cost =
      outcome.chargedMs === 0
        ? 'no extra raid time'
        : `${formatRecoveryClock(outcome.chargedMs)} of raid time`;
    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? `${treated} recovered for ${cost}. Next raid clock: ${formatRecoveryClock(this.raidClockMs)}.`
        : `${treated} recovered, but the recovery could not be saved.`,
    );
  }

  /**
   * Spends one medicine out of the stash on a Pokemon at base.
   *
   * The stash is the same vault the half-built loadout draws from, so the
   * loadout's own supply counts shrink with it and a deployed stack can never
   * outgrow what is actually held - see `DeploymentFlow.items`.
   */
  private treat(pokemonId: string, itemId: string): void {
    const result = treatWithItem(this.stash, pokemonId, itemId);
    if (!result.used) {
      this.setStatus(result.message);
      return;
    }

    this.setStatus(
      this.saveManager.save({ ...this.savedGame, stash: this.stash })
        ? result.message
        : `${result.message} The treatment could not be saved.`,
    );
  }

  /** The lone Pokemon a swap would trade away, or undefined while a team remains. */
  private get sparePartner(): StashedPokemon | undefined {
    return this.stash.canSwapStarter() ? this.stashPokemon[0] : undefined;
  }

  /** Preselects the species already held so a swap is never armed by default. */
  private startingStarterId(): StarterSpeciesId {
    const heldId = this.stash.listPokemon()[0]?.pokemon.base.id;
    return heldId === 'charmander' || heldId === 'squirtle' ? heldId : 'bulbasaur';
  }

  private setView(view: HubView): void {
    this.view = view;
    this.swapArmed = false;
    if (view === 'reselect') {
      this.reselectStarterId = this.startingStarterId();
    }
  }

  private confirmSwap(): void {
    if (!this.sparePartner) {
      this.setView('stash');
      this.setStatus('Swapping is only offered while one Pokemon remains at base.');
      return;
    }
    if (!this.saveManager.reselectStarter(this.reselectStarterId)) {
      this.setView('home');
      this.setStatus('That swap could not be saved.');
      return;
    }

    const reloaded = this.saveManager.load();
    if (reloaded) {
      // Reloading rebuilds the deployment flow, so a swapped-away Pokemon can
      // never linger in a half-built loadout.
      this.applyLoadedGame(reloaded);
    }
    this.setView('stash');
    this.setStatus(`${getStarterSpecies(this.reselectStarterId).name} is your new partner.`);
  }

  private openDeployment(): void {
    this.flow.restart();
    this.setView('deploy');
    this.render();
  }

  private leaveDeployment(): void {
    this.flow.restart();
    this.setView('home');
    this.render();
  }

  /** The only way into a raid: a plan the player walked through and confirmed. */
  private startRun(): void {
    let deployment: Deployment;
    try {
      deployment = this.flow.deploy();
    } catch {
      this.setStatus('Confirm your loadout before deploying.');
      return;
    }

    const items = deployment.items;
    activeRunManager.startRun(
      { party: deployment.party.map((stored) => stored.pokemon), items },
      // The base clock, less whatever recovery has already been booked against it.
      {
        mapId: RUN_INSERTIONS[deployment.insertionId].mapId,
        durationMs: this.raidClockMs,
        secureItemStackLimit: this.flow.secureItemStacks,
      },
      deployment.secureSlot,
    );
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const plan = generateRunPlan(
      seed,
      undefined,
      deployment.insertionId,
      this.contractFor(deployment.insertionId),
    );
    const runSession = createActiveRunSession(
      activeRunManager,
      deployment.secureSlot,
      deployment.stashSecureSlot,
      deployment.party.map((stored) => stored.id),
      items,
      plan.contract ? objectivesForContract(plan.contract) : [],
      plan,
    );
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('world', {
        party: new PokemonParty(deployment.party.map((stored) => stored.pokemon)),
        bag: new Bag(Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity]))),
        runSession,
      });
    });
  }

  private goBack(): void {
    if (this.view === 'deploy' && this.flow.retreat()) {
      this.render();
      return;
    }
    // The swap is reached from the stash, so backing out of it returns there
    // rather than dropping the player two screens out to the base.
    if (this.view === 'reselect') {
      this.setView('stash');
      this.render();
      return;
    }
    this.leaveDeployment();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.view !== 'home') {
      event.preventDefault(); this.goBack(); return;
    }
    const controls = [...this.overlay.root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const current = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) && controls.length) {
      event.preventDefault();
      controls[(current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
  }

  private get heading(): string {
    if (this.view === 'home') return 'Ready for a run?';
    if (this.view === 'stash') return 'Your stash';
    if (this.view === 'reselect') return 'Swap your partner';
    if (this.flow.step === 'loadout') return 'Build your loadout';
    return this.flow.step === 'secure' ? 'Secure slot' : 'Final check';
  }

  private get backLabel(): string {
    if (this.view === 'reselect') return '← Stash';
    if (this.view !== 'deploy') return '← Base';
    if (this.flow.step === 'confirm') return '← Loadout';
    if (this.flow.step === 'secure') {
      return this.flow.secureReturnStep === 'confirm' ? '← Final check' : '← Loadout';
    }
    return '← Base';
  }

  private render(): void {
    const back = this.view === 'home' ? '' : `<button class="back-button" data-back>${this.backLabel}</button>`;
    this.overlay.root.innerHTML = `<div class="menu-shell"><header class="menu-header">${back}<div><p class="eyebrow">Pallet Town</p><h1>${this.heading}</h1></div><div class="stash-count">${this.stashPokemon.length} Pokémon · ${this.stashItems.length} item types</div></header>${this.view === 'deploy' ? this.progressRail() : ''}${this.content()}${this.status ? `<p class="menu-status" role="status">${this.status}</p>` : ''}</div>`;
    this.overlay.root.querySelector<HTMLButtonElement>('[data-back]')?.addEventListener('click', () => this.goBack());
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.onclick = () => { this.setView(button.dataset.view as HubView); this.render(); });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-starter]').forEach((button) => button.onclick = () => { this.reselectStarterId = button.dataset.starter as StarterSpeciesId; this.swapArmed = false; this.render(); });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-swap-arm]')?.addEventListener('click', () => { this.swapArmed = true; this.render(); });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-swap-cancel]')?.addEventListener('click', () => { this.swapArmed = false; this.render(); });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-swap-confirm]')?.addEventListener('click', () => this.confirmSwap());
    this.overlay.root.querySelector<HTMLButtonElement>('[data-deploy-flow]')?.addEventListener('click', () => this.openDeployment());
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-recover]').forEach((button) => button.onclick = () => this.recover([button.dataset.recover!]));
    this.overlay.root.querySelector<HTMLButtonElement>('[data-recover-all]')?.addEventListener('click', () => this.recover(this.injuredPokemon.map((stored) => stored.id)));
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-pokemon]').forEach((button) => button.onclick = () => { this.setStatus(this.flow.togglePokemon(button.dataset.pokemon!)); });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-treat-item]').forEach((button) => { button.onclick = () => this.treat(button.dataset.treatPokemon!, button.dataset.treatItem!); });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((button) => { button.onclick = () => { this.flow.adjustItem(button.dataset.item as ItemId, Number(button.dataset.amount)); this.render(); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-secure-pokemon]').forEach((button) => { button.onclick = () => { this.flow.toggleSecurePokemon(button.dataset.securePokemon!); this.render(); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-secure-item]').forEach((button) => { button.onclick = () => { this.setStatus(this.flow.toggleSecureItem(button.dataset.secureItem as ItemId)); }; });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-insertion]').forEach((button) => {
      button.onclick = () => { this.flow.chooseInsertion(button.dataset.insertion as RunInsertionId); this.render(); };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-back-step]')?.addEventListener('click', () => this.goBack());
    this.overlay.root.querySelector<HTMLButtonElement>('[data-secure-slot]')?.addEventListener('click', () => { this.flow.openSecureSlot(); this.render(); });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-advance]')?.addEventListener('click', () => { this.setStatus(this.flow.advance()); });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-start]')?.addEventListener('click', () => this.startRun());
    this.overlay.focus('button');
  }

  /** Shows preparation as a route with a raid at the end of it. */
  private progressRail(): string {
    const step = this.flow.step === 'confirm' ? 2 : 1;
    const labels = ['Loadout', 'Final check', 'Raid'];
    return `<ol class="deploy-progress">${labels
      .map((label, index) => {
        const position = index + 1;
        const state = position < step ? 'done' : position === step ? 'current' : 'upcoming';
        return `<li class="${state}"${state === 'current' ? ' aria-current="step"' : ''}><span>${position < step ? '✓' : position}</span>${label}</li>`;
      })
      .join('')}</ol>`;
  }

  private content(): string {
    if (this.view === 'home') return this.homeView();
    if (this.view === 'stash') return this.stashView();
    if (this.view === 'reselect') return this.reselectView();
    if (this.flow.step === 'loadout') return this.loadoutView();
    return this.flow.step === 'secure' ? this.secureView() : this.confirmView();
  }

  /**
   * The base screen leads with the raid it is sending you on: what to do next,
   * then what is outstanding. Nothing here is a consolation prize - the swap
   * offer lives in the stash, beside the Pokemon it would trade away, because
   * on a fresh save it is the loudest panel on the screen three seconds after
   * the player chose that partner, and it is what pushed the lobby past the
   * frame and put a browser scrollbar down the side of the game.
   */
  private homeView(): string {
    const unlocked = this.savedGame.raidProgress.firstContractExtracted;
    return `<main class="hub-home">${this.recoveryPanel()}<section class="hub-actions"><button class="action-card primary" data-deploy-flow><span>DEPLOY</span><h2>Start a raid</h2><p>${unlocked ? 'Pick the Pokémon and supplies you are willing to risk, choose where you drop in, then confirm. Where you drop in is which contract you take.' : 'Pick the Pokémon and supplies you are willing to risk, then confirm before you drop in. Recover the lost field kit at the Floodplain Relay, then pick an exit and get out.'}</p><b>Prepare loadout →</b></button><button class="action-card" data-view="stash"><span>STASH</span><h2>Review &amp; recover</h2><p>Check the Pokémon and supplies secured at base, treat anyone who came home hurt${this.sparePartner ? ', or trade your last partner for a different starter' : ''}.</p><b>Open stash →</b></button></section>${this.contractBoard()}</main>`;
  }

  /**
   * The contract board: every contract on offer, what it asks and what it pays.
   *
   * Each row names its insertion because taking a contract is choosing where to
   * drop in, and names what has to be packed for it, because a delivery decided
   * at the loadout screen is decided too late once the raid has started.
   */
  private contractBoard(): string {
    const contracts = this.openContracts;
    if (contracts.length === 0) {
      return `<section class="panel objectives-panel"><div class="panel-heading"><div><p class="eyebrow">Contract board</p><h2>Nothing outstanding</h2></div><small>Every contract is banked</small></div><div class="objective-list"><p class="empty-state">Raids from here are for supplies, Pokémon and whatever the maps still hold.</p></div></section>`;
    }
    const insertionFor = (contract: RaidContract): string =>
      Object.values(RUN_INSERTIONS).find((insertion) => insertion.mapId === contract.mapId)?.label
        ?? WORLD_MAP_NAMES[contract.mapId];
    return `<section class="panel objectives-panel"><div class="panel-heading"><div><p class="eyebrow">Contract board</p><h2>${contracts.length === 1 ? '1 contract open' : `${contracts.length} contracts open`}</h2></div><small>Rewards require extraction</small></div><div class="objective-list">${contracts
      .map((contract) => {
        const carryIn = contractCarryIn(contract);
        return `<article class="entity-row">${objectiveIcon('Contract')}<div class="objective-copy"><strong>${contract.description}</strong><small>Insert at ${insertionFor(contract)}${contract.requiredExitLabel ? ` · banks only through ${contract.requiredExitLabel}` : ''}${carryIn.length ? ` · pack ${formatStacks(carryIn)}` : ''}</small><small>Reward: ${contract.reward.summary}</small></div></article>`;
      })
      .join('')}</div></section>`;
  }

  /**
   * The between-raid recovery surface. It only appears when there is something
   * to say - somebody hurt, or time already booked - so a fit player's lobby is
   * exactly the lobby they had before.
   */
  private recoveryPanel(): string {
    const injured = this.injuredPokemon;
    const pending = this.pendingRecoveryMs;
    if (injured.length === 0 && pending === 0) {
      return '';
    }
    const quotedMs = quoteRecovery(this.stash, pending, injured.map((stored) => stored.id));
    const rows = injured
      .map(
        (stored) =>
          `<article class="entity-row">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div class="entity-copy"><strong>${stored.pokemon.base.name}</strong><small>${this.conditionLine(stored)}</small>${hpBar(stored.pokemon.currentHp, stored.pokemon.maxHp)}</div><button class="button" data-recover="${stored.id}">Recover · −${formatRecoveryClock(recoveryCostMs(stored.pokemon))}</button></article>`,
      )
      .join('');
    return `<section class="panel recovery-panel"><div class="panel-heading"><div><p class="eyebrow">Between raids</p><h2>Recovery bay</h2></div><small>Paid for in raid time, never in supplies</small></div><p>${
      injured.length === 0
        ? 'Everyone at base is fit again.'
        : 'Treatment restores full HP and clears any status, and the time comes off your next raid clock.'
    }</p><div class="entity-list">${rows}</div>${this.recoveryBill(injured, quotedMs)}</section>`;
  }

  private recoveryBill(injured: readonly StashedPokemon[], quotedMs: number): string {
    const injuredCount = injured.length;
    // The cap can make treating everyone cheaper than the rows add up to, so say so.
    const listedMs = injured.reduce((total, stored) => total + recoveryCostMs(stored.pokemon), 0);
    const capNote =
      listedMs > quotedMs
        ? `<small>Capped: only ${formatRecoveryClock(quotedMs)} of the ${formatRecoveryClock(listedMs)} listed above is charged.</small>`
        : '';
    const clock = `<div><strong>Next raid clock ${formatRecoveryClock(this.raidClockMs)}</strong><small>${
      this.pendingRecoveryMs === 0
        ? `full ${formatRecoveryClock(RAID_DURATION_MS)}, nothing booked`
        : `${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery already booked`
    }</small>${capNote}</div>`;
    const action =
      injuredCount === 0
        ? ''
        : `<button class="button primary-button" data-recover-all>Recover ${injuredCount === 1 ? 'them' : `all ${injuredCount}`} · −${formatRecoveryClock(quotedMs)} →</button>`;
    return `<div class="recovery-bill">${clock}${action}</div>`;
  }

  /** One line of condition, so "fainted" is never hidden behind an HP number. */
  private conditionLine(stored: StashedPokemon): string {
    return conditionLine(stored.pokemon);
  }

  /**
   * The treatment surface. It only appears on a Pokemon a raid actually hurt,
   * and it names both prices side by side before either is paid: one medicine
   * out of the stash, or a full restore at the recovery bay for raid time. A
   * player should never have to spend a Potion to find out what it does.
   */
  private careStrip(stored: StashedPokemon): string {
    const { pokemon } = stored;
    if (!needsRecovery(pokemon)) {
      return '';
    }

    const lead = pokemon.isFainted
      ? FAINTED_TREATMENT_NOTE
      : `Hurt · ${pokemon.currentHp}/${pokemon.maxHp} HP${
        pokemon.primaryStatus === null ? '' : ` · ${pokemon.primaryStatus}`
      }`;
    const options = treatmentOptions(this.stash, pokemon);
    const medicine = options.length
      ? `<div class="care-options">${options.map((option) => this.careOption(stored.id, option)).join('')}</div>`
      : '<p class="care-empty">No medicine at base.</p>';
    return `<div class="care-strip"><p class="care-lead">${lead}</p>${medicine}<button class="button" data-recover="${stored.id}">Recovery bay · full restore for −${formatRecoveryClock(recoveryCostMs(pokemon))} raid time</button></div>`;
  }

  private careOption(pokemonId: string, option: TreatmentOption): string {
    return `<button class="care-item" data-treat-pokemon="${pokemonId}" data-treat-item="${option.itemId}"${option.usable ? '' : ' disabled'}><strong>${option.displayName} ×${option.held}</strong><small>${option.effect}</small></button>`;
  }

  private stashView(): string {
    return `<main class="stash-layout"><section><h2>Pokémon</h2><p class="confirm-note">Recovery costs raid time: your next raid clock is ${formatRecoveryClock(this.raidClockMs)}.</p><div class="entity-list">${this.stashPokemon.map((stored) => `<article class="entity-row">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div class="entity-copy"><strong>${stored.pokemon.base.name}</strong><small>${this.conditionLine(stored)}</small>${hpBar(stored.pokemon.currentHp, stored.pokemon.maxHp)}</div><div>${typeBadge(stored.pokemon.base.primaryType)}${stored.pokemon.base.secondaryType ? typeBadge(stored.pokemon.base.secondaryType) : ''}</div>${needsRecovery(stored.pokemon) ? `<button class="button" data-recover="${stored.id}">Recover · −${formatRecoveryClock(recoveryCostMs(stored.pokemon))}</button>` : '<span class="fit-tag">Fit ✓</span>'}</article>`).join('') || '<p class="empty-state">No Pokémon in storage.</p>'}</div>${this.swapPanel()}</section><section><h2>Supplies</h2><div class="item-grid">${this.stashItems.map((item) => `<article class="item-card">${itemIcon(item.id, item.displayName)}<strong>${item.displayName}</strong><small>${item.category} · ${this.stash.itemCount(item.id)} available</small></article>`).join('') || '<p class="empty-state">No supplies in storage.</p>'}</div></section></main>`;
  }

  /**
   * Two panels and a bar. The two columns are what you choose from - the stash
   * on the left, where you are dropping in on the right - and everything that
   * commits you sits in a full-width bar that stays on screen, because the
   * three-panel column layout this replaced ran the right column past the fold
   * at 1280x800 and put `Review & deploy` somewhere a new player never saw it,
   * with an empty half-column beside it. The bar is the same one the final
   * check screen already ends on, so the route reads as one route.
   */
  private loadoutView(): string {
    const party = this.flow.party;
    const securedCount = (this.flow.securedPokemon ? 1 : 0) + this.flow.securedItems.length;
    const single = this.stashPokemon.length === 1;
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const allFainted = party.length > 0 && !this.flow.isDeployable;
    // The bar is where the loadout is now read back, so it names what is in it
    // rather than counting it: the panel column that used to list the party is
    // what pushed the primary action off the screen, and the final check screen
    // is where the full at-risk breakdown belongs anyway.
    const summary = party.length === 0
      ? 'Nothing selected yet. Add a Pokémon from your stash.'
      : `${party.map((stored) => stored.pokemon.base.name).join(', ')} · ${supplies} ${supplies === 1 ? 'supply' : 'supplies'} packed · ${securedCount} protected`;
    return `<main class="loadout-layout"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Available</p><h2>Stash</h2></div><small>Click to add or remove · treat anyone hurt before you go</small></div><div class="entity-list">${this.stashPokemon.map((stored) => `<div class="loadout-entry${needsRecovery(stored.pokemon) ? ' hurt' : ''}"><button class="entity-row selectable ${this.flow.includesPokemon(stored.id) ? 'selected' : ''}" data-pokemon="${stored.id}">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div class="entity-copy"><strong>${stored.pokemon.base.name}</strong><small>${this.conditionLine(stored)}${single ? ' · your only Pokémon' : ''}</small>${needsRecovery(stored.pokemon) ? hpBar(stored.pokemon.currentHp, stored.pokemon.maxHp) : ''}</div><span>${this.flow.includesPokemon(stored.id) ? 'Added ✓' : 'Add +'}</span></button>${this.careStrip(stored)}</div>`).join('')}<div class="item-grid compact">${this.stashItems.map((item) => `<article class="item-card"><strong>${item.displayName}</strong><small>${this.stash.itemCount(item.id)} available</small><div><button data-item="${item.id}" data-amount="-1" aria-label="Remove ${item.displayName}">−</button><b>${this.flow.itemQuantity(item.id as ItemId)}</b><button data-item="${item.id}" data-amount="1" aria-label="Add ${item.displayName}">+</button></div></article>`).join('')}</div></div></section><section class="panel run-loadout"><div class="panel-heading"><div><p class="eyebrow">Insertion</p><h2>${this.firstContractActive ? 'Contract area' : 'Choose your entry'}</h2></div></div>${this.unlockedInsertions.map(([id, insertion]) => { const contract = this.contractFor(id); return `<button class="entity-row selectable ${this.flow.insertionId === id ? 'selected' : ''}" data-insertion="${id}"><div><strong>${insertion.label}</strong>${contract ? `<small class="insertion-contract">CONTRACT · ${contract.name}</small>` : ''}<small>${insertion.description}</small></div></button>`; }).join('')}${this.firstContractActive ? '<p class="confirm-note">Your active contract is here. Three more insertions unlock when you extract it.</p>' : ''}${this.carryInNote()}</section><section class="starter-confirm confirm-bar"><div><strong>${party.length}/6 Pokémon packed</strong><small>${summary}</small><small class="bar-warning">${allFainted ? 'Every Pokémon here has fainted. Recover one at base before you deploy.' : 'Everything here is lost on a wipe unless it is in the secure slot.'}</small></div><div class="bar-actions"><button class="button" data-secure-slot>Secure slot${securedCount ? ` · ${securedCount} protected` : ''} →</button><button class="button primary-button" data-advance ${this.flow.isDeployable ? '' : 'disabled'}>Review &amp; deploy →</button></div></section></main>`;
  }

  private secureView(): string {
    const party = this.flow.party;
    const returnLabel = this.flow.secureReturnStep === 'confirm' ? 'final check' : 'loadout';
    return `<main class="secure-layout"><section class="secure-intro"><p class="eyebrow">Protected on a wipe</p><h2>SECURED</h2><p>One Pokémon and ${this.flow.secureItemStacks} item stacks survive. Everything else in your loadout is at risk.</p></section><section class="secure-group"><h2>Pokémon <small>1 slot</small></h2>${party.map((stored) => `<button class="entity-row selectable ${this.flow.securesPokemon(stored.id) ? 'secured' : ''}" data-secure-pokemon="${stored.id}">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<strong>${stored.pokemon.base.name}</strong><span>${this.flow.securesPokemon(stored.id) ? 'Secured ✓' : 'Secure'}</span></button>`).join('') || '<p class="empty-state">Add a Pokémon to your loadout first.</p>'}</section><section class="secure-group"><h2>Item stacks <small>${this.flow.securedItems.length}/${this.flow.secureItemStacks} slots</small></h2>${this.flow.items.map((item) => `<button class="entity-row selectable ${this.flow.securesItem(item.itemId) ? 'secured' : ''}" data-secure-item="${item.itemId}">${itemIcon(item.itemId, this.itemName(item.itemId))}<strong>${this.itemName(item.itemId)} ×${item.quantity}</strong><span>${this.flow.securesItem(item.itemId) ? 'Secured ✓' : 'Secure'}</span></button>`).join('') || '<p class="empty-state">Add supplies to your loadout first.</p>'}<button class="button primary-button" data-advance>Back to ${returnLabel} →</button></section></main>`;
  }

  private confirmView(): string {
    const insertion = RUN_INSERTIONS[this.flow.insertionId];
    const securedPokemon = this.flow.securedPokemon;
    const securedItems = this.flow.securedItems;
    const riskedPokemon = this.flow.party.filter((stored) => stored.id !== securedPokemon?.id);
    const riskedItems = this.flow.items
      .map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity - (securedItems.find((secured) => secured.itemId === item.itemId)?.quantity ?? 0),
      }))
      .filter((item) => item.quantity > 0);
    const supplies = this.flow.items.reduce((total, item) => total + item.quantity, 0);
    const protectedCount = (securedPokemon ? 1 : 0) + securedItems.length;
    return `<main class="confirm-layout"><section class="panel confirm-insertion"><div class="panel-heading"><div><p class="eyebrow">Insertion</p><h2>${insertion.label}</h2></div></div><p class="confirm-note">${insertion.description}</p><p class="confirm-note"><strong>Raid clock ${formatRecoveryClock(this.raidClockMs)}</strong>${this.pendingRecoveryMs === 0 ? '' : ` · ${formatRecoveryClock(RAID_DURATION_MS)} base − ${formatRecoveryClock(this.pendingRecoveryMs)} recovery`}</p><button class="button" data-back-step>Change loadout</button></section><section class="panel confirm-risk"><div class="panel-heading"><div><p class="eyebrow">At risk</p><h2>Lost if you wipe</h2></div><b>${riskedPokemon.length + riskedItems.length} ${riskedPokemon.length + riskedItems.length === 1 ? 'entry' : 'entries'}</b></div><div class="entity-list">${riskedPokemon.map((stored) => `<article class="entity-row">${pokemonAvatar(stored.pokemon.base.dexId, stored.pokemon.base.name)}<div class="entity-copy"><strong>${stored.pokemon.base.name}</strong><small>${this.conditionLine(stored)}</small>${hpBar(stored.pokemon.currentHp, stored.pokemon.maxHp)}</div><span class="risk-tag">At risk</span></article>`).join('')}${riskedItems.map((item) => `<article class="entity-row">${itemIcon(item.itemId, this.itemName(item.itemId))}<div><strong>${this.itemName(item.itemId)}</strong><small>${item.quantity} packed</small></div><span class="risk-tag">At risk</span></article>`).join('')}${riskedPokemon.length + riskedItems.length ? '' : '<p class="empty-state">Nothing extra is at risk. Your whole loadout is protected.</p>'}</div></section><section class="panel confirm-secure"><div class="panel-heading"><div><p class="eyebrow">Protected</p><h2>Secure slot</h2></div><b>${protectedCount}/${1 + this.flow.secureItemStacks}</b></div><div class="entity-list">${securedPokemon ? `<article class="entity-row secured">${pokemonAvatar(securedPokemon.pokemon.base.dexId, securedPokemon.pokemon.base.name)}<div><strong>${securedPokemon.pokemon.base.name}</strong><small>Level ${securedPokemon.pokemon.level}</small></div><span class="secure-tag">Comes home ✓</span></article>` : ''}${securedItems.map((item) => `<article class="entity-row secured">${itemIcon(item.itemId, this.itemName(item.itemId))}<div><strong>${this.itemName(item.itemId)}</strong><small>${item.quantity} packed</small></div><span class="secure-tag">Comes home ✓</span></article>`).join('')}${protectedCount ? '' : '<p class="risk-note">Nothing is protected. A wipe costs you your whole loadout.</p>'}</div><button class="button" data-secure-slot>${protectedCount ? 'Change secure slot' : 'Set up secure slot'} →</button></section><section class="starter-confirm confirm-bar"><div><strong>Deploy to ${insertion.label}</strong><small>${this.flow.party.length} Pokémon · ${supplies} supplies packed · ${protectedCount} protected · ${formatRecoveryClock(this.raidClockMs)} on the clock</small></div><button class="button primary-button" data-start>Enter the raid →</button></section></main>`;
  }

  /**
   * The swap offer, shown in the stash beside the Pokemon it would trade away.
   * It still only appears while the rule applies, so it disappears the moment a
   * second Pokemon is banked.
   */
  private swapPanel(): string {
    const spare = this.sparePartner;
    if (!spare) return '';
    return `<section class="panel swap-panel"><div class="panel-heading"><div><p class="eyebrow">Down to one Pokémon</p><h2>Swap your partner</h2></div><small>Only while one Pokémon is left at base</small></div><p>${spare.pokemon.base.name} (Level ${spare.pokemon.level}) is all you have left. Trade it for a fresh level 5 Bulbasaur, Charmander or Squirtle - the species you settle on is the one you are re-issued after a wipe.</p><button class="button" data-view="reselect">Choose a new partner →</button></section>`;
  }

  private reselectView(): string {
    const spare = this.sparePartner;
    if (!spare) return '<main class="hub-home"><p class="empty-state">You have more than one Pokémon, so there is nothing to swap.</p></main>';
    const chosen = getStarterSpecies(this.reselectStarterId);
    const held = `${spare.pokemon.base.name} (Level ${spare.pokemon.level})`;
    return `<main class="starter-shell reselect-shell"><header class="starter-header"><p class="eyebrow">Re-specialise</p><h1>Choose a new partner</h1><p>${held} is your last Pokémon. Swapping releases it for good and issues a fresh level 5 starter in its place, so this is never an upgrade - only a change of direction.</p></header><main class="starter-grid">${starterCards(this.reselectStarterId, { heldSpeciesId: spare.pokemon.base.id, selectLabel: 'Swap to →' })}</main><footer class="starter-confirm ${this.swapArmed ? 'arming' : ''}">${this.swapFooter(spare, chosen)}</footer></main>`;
  }

  private swapFooter(spare: StashedPokemon, chosen: PokemonBase): string {
    if (spare.pokemon.base.id === chosen.id) {
      return `<div><span class="eyebrow">Already yours</span><strong>${chosen.name}</strong><small>Pick a different starter to swap.</small></div><button class="button primary-button" disabled>Swap for ${chosen.name} →</button>`;
    }
    if (!this.swapArmed) {
      return `<div><span class="eyebrow">Arrives as</span><strong>${chosen.name}</strong><small>${starterLoadoutSummary(chosen)}</small></div><button class="button primary-button" data-swap-arm>Swap for ${chosen.name} →</button>`;
    }
    return `<div><span class="eyebrow">This cannot be undone</span><strong>Release ${spare.pokemon.base.name} (Level ${spare.pokemon.level})?</strong><small>It is gone for good, and ${chosen.name} arrives at level 5.</small></div><div class="swap-actions"><button class="button" data-swap-cancel>Keep ${spare.pokemon.base.name}</button><button class="button danger-button" data-swap-confirm>Release and take ${chosen.name}</button></div>`;
  }

  private itemName(itemId: ItemId): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  private setStatus(message: string | undefined): void {
    if (message === undefined) {
      this.status = '';
      this.render();
      return;
    }
    this.status = message;
    this.render();
    this.time.delayedCall(2200, () => { this.status = ''; this.render(); });
  }
}
