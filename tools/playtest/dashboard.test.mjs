// What the AI playtesters' dashboard is sent: the machine, and each
// persona's latest run with its findings, newest first.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRun, recordFinding, writeStatus } from './ai-player/runs.mjs';
import { dashboardState, memory, processorBusy, readCpuTimes } from './dashboard.mjs';

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
    const [vet, newcomer] = state.personas;
    expect(vet).toMatchObject({ persona: 'veteran', runs: 2, raids: 3, wipes: 1, extractions: 2 });
    expect(vet.current.runId).toBe('v-new');
    expect(vet.current.signature).toBeUndefined();
    expect(newcomer).toMatchObject({ persona: 'newcomer', current: null, runs: 0 });
    expect(state.findings.bug.count).toBe(2);
    expect(state.findings.bug.newest.map((finding) => finding.text)).toEqual(['newer', 'older']);
    expect(state.findings.bug.newest[0].shot).toBe('/shots/v-new/5.png');
    expect(state.findings['ai-feel']).toEqual({ count: 0, newest: [] });
    expect(state.machine.usedPercent).toBeGreaterThanOrEqual(0);
  });
});
