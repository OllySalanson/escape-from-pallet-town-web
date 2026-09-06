import Phaser from 'phaser';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { createTestLabBattleScenario } from '../dev/testLabRoutes';
import { activeRunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, type RunInsertionId } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, SaveManager, type RestoredGame } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { MenuOverlay } from '../ui/MenuOverlay';
import {
  TEST_LAB_SCENARIOS,
  TestLabStore,
  type TestLabRecord,
  type TestLabResult,
} from '../dev/TestLabStore';

export class TestLabScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private readonly store = new TestLabStore();
  private overlay!: MenuOverlay;
  private records: Record<string, TestLabRecord> = {};
  private selectedIndex = 0;
  private status = '';

  public constructor() {
    super('test-lab');
  }

  public create(): void {
    this.records = this.store.load();
    this.cameras.main.setBackgroundColor('#101c30');
    this.overlay = new MenuOverlay(this, 'test-lab-menu', (event) => this.handleKey(event));
    this.render();
  }

  private render(): void {
    const scenario = TEST_LAB_SCENARIOS[this.selectedIndex];
    const record = this.records[scenario.id] ?? { result: 'not-tested', notes: '' };
    const completed = Object.values(this.records).filter((item) => item.result === 'pass').length;
    this.overlay.root.innerHTML = `<div class="menu-shell test-lab-shell">
      <header class="menu-header">
        <div><p class="eyebrow">LOCALHOST ONLY · DEVELOPMENT BUILD</p><h1>TEST LAB</h1></div>
        <div class="stash-count">${completed}/${TEST_LAB_SCENARIOS.length} passed</div>
      </header>
      <p class="test-lab-intro">Open <b>?test-lab=1</b> on localhost. This screen is not bundled into production builds.</p>
      <main class="test-lab-layout">
        <nav class="test-lab-list" aria-label="Scenarios">${TEST_LAB_SCENARIOS.map(
          (item, index) => {
            const result = this.records[item.id]?.result ?? 'not-tested';
            return `<button class="${index === this.selectedIndex ? 'selected' : ''}" data-scenario="${index}"><span class="lab-state ${result}">${result === 'pass' ? '✓' : result === 'fail' ? '!' : '·'}</span>${item.title}</button>`;
          },
        ).join('')}</nav>
        <section class="panel test-lab-detail">
          <p class="eyebrow">Scenario ${this.selectedIndex + 1}</p><h2>${scenario.title}</h2>
          <dl><dt>SETUP</dt><dd>${scenario.setup}</dd><dt>EXPECT</dt><dd>${scenario.expected}</dd></dl>
          <div class="test-lab-actions"><button class="button primary-button" data-route>Open prepared scenario →</button><button class="button" data-fresh>Reset game profile</button></div>
          <fieldset><legend>Checklist result</legend>${(['not-tested', 'pass', 'fail'] as const).map((result) => `<button class="lab-result ${record.result === result ? 'selected' : ''}" data-result="${result}">${result === 'not-tested' ? 'Not yet tested' : result === 'pass' ? 'Pass' : 'Fail'}</button>`).join('')}</fieldset>
          <label class="test-lab-notes">Captain notes<textarea data-notes maxlength="500" placeholder="Optional observations">${escapeHtml(record.notes)}</textarea></label>
          <button class="button reset-button" data-reset>Reset all checklist results</button>
          ${this.status ? `<p class="menu-status" role="status">${this.status}</p>` : ''}
        </section>
      </main>
    </div>`;
    this.bindControls();
  }

  private bindControls(): void {
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => {
      button.onclick = () => {
        this.selectedIndex = Number(button.dataset.scenario);
        this.render();
      };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-route]')!.onclick = () =>
      this.routeScenario();
    this.overlay.root.querySelector<HTMLButtonElement>('[data-fresh]')!.onclick = () => {
      this.createFreshProfile();
      this.setStatus('Fresh profile saved. Open Base to begin.');
    };
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-result]').forEach((button) => {
      button.onclick = () => this.updateRecord(button.dataset.result as TestLabResult);
    });
    this.overlay.root.querySelector<HTMLTextAreaElement>('[data-notes]')!.onchange = (event) => {
      this.updateRecord(undefined, (event.target as HTMLTextAreaElement).value);
    };
    this.overlay.root.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {
      this.store.reset();
      this.records = {};
      this.setStatus('Checklist results cleared.');
    };
    this.overlay.focus('button');
  }

  private updateRecord(result?: TestLabResult, notes?: string): void {
    const scenario = TEST_LAB_SCENARIOS[this.selectedIndex];
    const prior = this.records[scenario.id] ?? { result: 'not-tested', notes: '' };
    this.records = {
      ...this.records,
      [scenario.id]: { result: result ?? prior.result, notes: notes ?? prior.notes },
    };
    this.store.save(this.records);
    this.render();
  }

  private routeScenario(): void {
    const route = TEST_LAB_SCENARIOS[this.selectedIndex].route;
    if (route === 'battle') {
      this.scene.start('battle', createTestLabBattleScenario());
      return;
    }
    const game = this.createFreshProfile(route === 'run-south');
    if (route === 'base') {
      this.scene.start('hub', { savedGame: game });
      return;
    }
    this.launchFixedRun(game, route === 'run-south' ? 'south-verge' : 'town-square');
  }

  private createFreshProfile(unlockSouthVerge = false): RestoredGame {
    this.saveManager.clear();
    const stash = createStartingStash();
    stash.ensurePlayable();
    this.saveManager.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      raidProgress: unlockSouthVerge
        ? { firstContractExtracted: true, unlockedInsertions: ['town-square', 'south-verge'] }
        : DEFAULT_RAID_PROGRESS,
    });
    const game = this.saveManager.load();
    if (!game) throw new Error('Test Lab could not create its isolated fresh profile.');
    return game;
  }

  private launchFixedRun(game: RestoredGame, insertion: RunInsertionId): void {
    const stored = game.stash.listPokemon()[0];
    const party = [stored.pokemon];
    activeRunManager.startRun(
      { party, items: [] },
      { mapId: 'pallet-town', durationMs: 18 * 60 * 1000 },
      {},
    );
    const plan = generateRunPlan(
      0x5eed1234,
      undefined,
      insertion,
      !game.raidProgress.firstContractExtracted,
    );
    const runSession = createActiveRunSession(
      activeRunManager,
      {},
      {},
      [stored.id],
      [],
      undefined,
      plan,
    );
    this.scene.start('world', { party: new PokemonParty(party), bag: new Bag(), runSession });
  }

  private setStatus(message: string): void {
    this.status = message;
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.scene.start('title');
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
