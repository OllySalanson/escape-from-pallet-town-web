// What the AI playtesters' dashboard is sent: the machine, each runner with
// each persona's latest run, and every runner's findings together, newest first.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRun, recordFinding, writeStatus } from './ai-player/runs.mjs';
import { dashboardState, isReleaseBlocker, memory, processorBusy, readCpuTimes, runnerName } from './dashboard.mjs';

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'eptw-dashboard-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('dashboard', () => {
  it('reads memory in use as what is not available', () => {
    expect(memory('MemTotal: 10240000 kB\nMemAvailable: 2560000 kB\n')).toEqual({ totalMb: 10000, freeMb: 2500, usedPercent: 75 });
  });

  it('reads the processor as the busy share between two readings', () => {
    const before = readCpuTimes('cpu  100 0 100 700 100 0 0 0 0 0\n');
    const after = readCpuTimes('cpu  150 0 150 750 150 0 0 0 0 0\n');
    expect(processorBusy(before, after)).toBe(50);
  });

  it('shows each persona’s newest run and totals, and findings by kind with their pictures', () => {
    createRun({ persona: 'veteran', runId: 'v-old', root, now: 1 });
    const veteran = createRun({ persona: 'veteran', runId: 'v-new', root, now: 2 });
    writeStatus({ ...veteran, raids: 3, wipes: 1, extractions: 2 }, root);
    recordFinding(veteran, { kind: 'bug', text: 'older', now: 10 }, root);
    recordFinding(veteran, { kind: 'bug', text: 'newer', shot: 'shots/5.png', now: 20 }, root);
    const state = dashboardState(root, 30);
    const [runner] = state.runners;
    const [vet] = runner.personas;
    expect(runner.personas.map((entry) => entry.persona)).toEqual(['veteran']);
    expect(vet).toMatchObject({ persona: 'veteran', runs: 2, raids: 3, wipes: 1, extractions: 2, giveUps: 0 });
    expect(vet.current.runId).toBe('v-new');
    expect(vet.current.signature).toBeUndefined();
    expect(runner.counts).toEqual({ bug: 2, confusing: 0, 'ai-feel': 0 });
    expect(state.findings.bug.count).toBe(2);
    expect(state.findings.bug.newest.map((finding) => finding.text)).toEqual(['newer', 'older']);
    expect(state.findings.bug.newest[0].shot).toBe('/shots/0/v-new/5.png');
    expect(state.findings['ai-feel']).toEqual({ count: 0, newest: [] });
    expect(state.machine.usedPercent).toBeGreaterThanOrEqual(0);
  });

  it('shows every runner side by side, with their findings together and named by runner', () => {
    const second = join(root, 'eptw-ai-playtest-3', 'runs');
    const first = join(root, 'eptw-ai-playtest-2', 'runs');
    const veteran = createRun({ persona: 'veteran', runId: 'v', root: first, now: 1 });
    const newcomer = createRun({ persona: 'newcomer', runId: 'n', root: second, now: 2 });
    recordFinding(veteran, { kind: 'confusing', text: 'first', now: 10 }, first);
    recordFinding(newcomer, { kind: 'confusing', text: 'second', shot: 'shots/7.png', now: 20 }, second);
    const state = dashboardState([first, second, join(root, 'eptw-ai-playtest-4', 'runs')], 30);
    expect(state.runners.map((runner) => [runner.name, runner.started, runner.runs])).toEqual([
      ['eptw-ai-playtest-2', true, 1],
      ['eptw-ai-playtest-3', true, 1],
      ['eptw-ai-playtest-4', false, 0],
    ]);
    expect(state.runners[1].personas.map((entry) => entry.persona)).toEqual(['newcomer']);
    expect(state.findings.confusing.newest.map((finding) => [finding.text, finding.runner])).toEqual([
      ['second', 'eptw-ai-playtest-3'],
      ['first', 'eptw-ai-playtest-2'],
    ]);
    expect(state.findings.confusing.newest[0].shot).toBe('/shots/1/n/7.png');
    expect(state.runners[0].findings).toBeUndefined();
  });

  it('counts sessions and given-up goals', () => {
    const run = createRun({ persona: 'newcomer', runId: 'n', root, now: 1 });
    writeFileSync(join(root, 'n', 'session-1.json'), '{}');
    writeFileSync(join(root, 'n', 'session-2.log'), '');
    writeFileSync(join(root, 'n', 'actions.jsonl'), `${JSON.stringify({ action: 'giveup' })}\n${JSON.stringify({ action: 'walk' })}\n`);
    const [runner] = dashboardState(root, 5).runners;
    expect(runner.sessions).toBe(2);
    expect(runner.personas[0].giveUps).toBe(1);
    expect(run.runId).toBe('n');
  });

  it('counts a bug as a release blocker when it says the game stopped, crashed or lost something', () => {
    const root2 = join(root, 'b');
    const run = createRun({ persona: 'veteran', runId: 'v', root: root2, now: 1 });
    recordFinding(run, { kind: 'bug', text: 'The game froze on the result screen', now: 2 }, root2);
    recordFinding(run, { kind: 'bug', text: 'The caption is one pixel off', now: 3 }, root2);
    recordFinding(run, { kind: 'confusing', text: 'I lost my way', now: 4 }, root2);
    const state = dashboardState(root2, 5);
    expect(state.releaseBlockers.count).toBe(1);
    expect(state.releaseBlockers.newest[0].text).toBe('The game froze on the result screen');
    expect(state.runners[0].releaseBlockers).toBe(1);
    expect(isReleaseBlocker({ kind: 'bug', text: 'my Pokémon were lost after extracting' })).toBe(true);
    expect(isReleaseBlocker({ kind: 'bug', text: 'MENU text runs out of its box' })).toBe(false);
  });

  it('names a runner by its folder, or the folder above a plain runs folder', () => {
    expect(runnerName('/data/eptw-ai-playtest-3/runs')).toBe('eptw-ai-playtest-3');
    expect(runnerName('/data/tonight')).toBe('tonight');
  });
});
