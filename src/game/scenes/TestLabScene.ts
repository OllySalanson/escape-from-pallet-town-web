import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import {
  SOUND_EFFECTS,
  SOUND_EFFECT_NAMES,
  soundEffectLength,
  type SoundChannel,
  type SoundEffect,
} from '../audio/soundEffects';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { createTestLabBattleScenario } from '../dev/testLabRoutes';
import { activeRunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { contractForMap, FIRST_CONTRACT_ID, objectivesForContract } from '../objectives';
import {
  CONTRACT_REWARD_INSERTIONS,
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RestoredGame,
} from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { hunterThreatFor } from '../world/hunterThreat';
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
  private view: 'scenarios' | 'sounds' = 'scenarios';
  private lastSound = '';

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
    if (this.view === 'sounds') {
      this.renderSoundBoard();
      return;
    }
    const scenario = TEST_LAB_SCENARIOS[this.selectedIndex];
    const record = this.records[scenario.id] ?? { result: 'not-tested', notes: '' };
    const completed = Object.values(this.records).filter((item) => item.result === 'pass').length;
    this.overlay.root.innerHTML = `<div class="menu-shell test-lab-shell">
      <header class="menu-header">
        <div><p class="eyebrow">LOCALHOST ONLY · DEVELOPMENT BUILD</p><h1>TEST LAB</h1></div>
        <div class="stash-count">${completed}/${TEST_LAB_SCENARIOS.length} passed</div>
        <button class="button" data-sound-board>Sound board →</button>
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

  /**
   * Every effect in the game, by name, one click each. A sound cannot be
   * reviewed from a diff, so this is where one is: the list is read straight
   * off `SOUND_EFFECTS`, so an effect cannot be added without appearing here.
   * `menuClickSound` keeps the menu's own click off these buttons, so the only
   * thing heard is the thing being auditioned.
   */
  private renderSoundBoard(): void {
    const channels: readonly SoundChannel[] = ['ui', 'world', 'alert', 'battle', 'fanfare'];
    const groups = channels
      .map((channel) => {
        const names = SOUND_EFFECT_NAMES.filter((name) => SOUND_EFFECTS[name].channel === channel);
        return `<section class="panel sound-board-group"><p class="eyebrow">${channel} channel · ${names.length}</p><div class="sound-board-grid">${names
          .map((name) => {
            const effect: SoundEffect = SOUND_EFFECTS[name];
            return `<button class="${name === this.lastSound ? 'selected' : ''}" data-sound="${name}"><strong>${name}</strong><small>${escapeHtml(effect.moment)}</small><small>${Math.round(soundEffectLength(effect) * 1000)} ms · ${effect.tones.length} voice${effect.tones.length === 1 ? '' : 's'}</small></button>`;
          })
          .join('')}</div></section>`;
      })
      .join('');
    this.overlay.root.innerHTML = `<div class="menu-shell test-lab-shell">
      <header class="menu-header">
        <button class="back-button" data-back>← Test lab</button>
        <div><p class="eyebrow">LOCALHOST ONLY · ${SOUND_EFFECT_NAMES.length} EFFECTS · MUSIC STAYS OFF</p><h1>SOUND BOARD</h1></div>
        <div class="stash-count">${this.lastSound ? `Last played: ${this.lastSound}` : 'Click any effect to hear it'}</div>
      </header>
      <p class="test-lab-intro">One channel says one thing at a time: start an effect while another on its channel is sounding and the first is cut, exactly as in a raid.</p>
      <main class="sound-board">${groups}</main>
    </div>`;
    this.overlay.root.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => {
      this.view = 'scenarios';
      this.render();
    };
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-sound]').forEach((button) => {
      button.onclick = () => {
        const name = button.dataset.sound as (typeof SOUND_EFFECT_NAMES)[number];
        // The lab is reached without passing the title screen's key press, so
        // this click is the gesture the browser needs before it will sound anything.
        void audioManager.activate().then(() => audioManager.play(name));
        this.lastSound = name;
        this.overlay.root
          .querySelectorAll('[data-sound]')
          .forEach((other) => other.classList.toggle('selected', other === button));
        const status = this.overlay.root.querySelector('.stash-count');
        if (status) {
          status.textContent = `Last played: ${name}`;
        }
      };
    });
  }

  private bindControls(): void {
    this.overlay.root.querySelector<HTMLButtonElement>('[data-sound-board]')!.onclick = () => {
      this.view = 'sounds';
      this.render();
    };
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
    const game = this.createFreshProfile(route !== 'base' && route !== 'run-town');
    if (route === 'base') {
      this.scene.start('hub', { savedGame: game });
      return;
    }
    const insertion: RunInsertionId =
      route === 'run-forest' ? 'viridian-forest' : route === 'run-route' ? 'route-1' : 'town-square';
    this.launchFixedRun(game, insertion);
  }

  private createFreshProfile(unlockEveryInsertion = false): RestoredGame {
    this.saveManager.clear();
    const stash = createStartingStash();
    stash.ensurePlayable();
    this.saveManager.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 7, y: 9 },
      bag: new Bag(),
      stash,
      raidProgress: unlockEveryInsertion
        ? {
          ...DEFAULT_RAID_PROGRESS,
          firstContractExtracted: true,
          unlockedInsertions: [...CONTRACT_REWARD_INSERTIONS],
          completedContracts: [FIRST_CONTRACT_ID],
          workshopUpgrades: [],
        }
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
      { mapId: RUN_INSERTIONS[insertion].mapId, durationMs: 18 * 60 * 1000 },
      {},
    );
    const contract = contractForMap(
      RUN_INSERTIONS[insertion].mapId,
      game.raidProgress.completedContracts,
    );
    const plan = generateRunPlan(0x5eed1234, undefined, insertion, contract, hunterThreatFor(party));
    const runSession = createActiveRunSession(
      activeRunManager,
      {},
      {},
      [stored.id],
      [],
      plan.contract ? objectivesForContract(plan.contract) : [],
      plan,
    );
    this.scene.start('world', { party: new PokemonParty(party), bag: new Bag(), runSession });
  }

  private setStatus(message: string): void {
    this.status = message;
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.view === 'sounds') {
      this.view = 'scenarios';
      this.render();
      return;
    }
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
