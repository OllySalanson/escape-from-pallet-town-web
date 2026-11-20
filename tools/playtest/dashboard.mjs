#!/usr/bin/env node
// The AI playtesters' dashboard: serves dashboard.html beside this, the state
// of every run under tools/playtest/ai-player/runs, and the machine's memory
// and processor, for the page to poll.
//
//   node tools/playtest/dashboard.mjs [--port=4719]      then open http://127.0.0.1:4719/
//
// Local only (127.0.0.1), read only, no dependencies.
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { cpus, loadavg } from 'node:os';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuns, readFindings, runDir, runsDir } from './ai-player/runs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? process.env.PORT ?? 4719);
/** How many findings of each kind the page is sent. */
const FINDINGS_PER_KIND = 40;

/** Memory as the kernel counts it: what is in use is what is not available. */
export function memory(meminfo = readFileSync('/proc/meminfo', 'utf8')) {
  const field = (name) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(meminfo)?.[1] ?? 0) / 1024;
  const totalMb = Math.round(field('MemTotal'));
  const freeMb = Math.round(field('MemAvailable'));
  return { totalMb, freeMb, usedPercent: totalMb ? Math.round(((totalMb - freeMb) / totalMb) * 100) : 0 };
}

/** Busy share of every core between two /proc/stat readings. */
export function processorBusy(before, after) {
  const idle = after.idle - before.idle;
  const total = after.total - before.total;
  return total > 0 ? Math.round(((total - idle) / total) * 100) : 0;
}

export function readCpuTimes(stat = readFileSync('/proc/stat', 'utf8')) {
  const fields = stat.split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  const idle = fields[3] + (fields[4] ?? 0);
  return { idle, total: fields.reduce((sum, value) => sum + value, 0) };
}

let lastCpu = readCpuTimes();
let lastBusy = 0;
setInterval(() => {
  const now = readCpuTimes();
  lastBusy = processorBusy(lastCpu, now);
  lastCpu = now;
}, 5000).unref();

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/** Everything the page shows, in one answer. */
export function dashboardState(root = runsDir(), now = Date.now()) {
  const runs = listRuns(root).map(({ signature, ...status }) => status);
  const findings = runs
    .flatMap((run) => readFindings(run.runId, root).map((finding) => ({ ...finding, shot: finding.shot ? `/shots/${run.runId}/${finding.shot.replace(/^shots\//, '')}` : null })))
    .sort((a, b) => b.at - a.at);
  const byKind = Object.fromEntries(['bug', 'confusing', 'ai-feel'].map((kind) => {
    const all = findings.filter((finding) => finding.kind === kind);
    return [kind, { count: all.length, newest: all.slice(0, FINDINGS_PER_KIND) }];
  }));
  const personas = ['veteran', 'newcomer'].map((persona) => {
    const theirs = runs.filter((run) => run.persona === persona);
    const current = theirs[0] ?? null;
    return {
      persona,
      current,
      runs: theirs.length,
      finishedRuns: theirs.filter((run) => run.finished).length,
      raids: theirs.reduce((sum, run) => sum + (run.raids ?? 0), 0),
      wipes: theirs.reduce((sum, run) => sum + (run.wipes ?? 0), 0),
      extractions: theirs.reduce((sum, run) => sum + (run.extractions ?? 0), 0),
      findings: theirs.reduce((sum, run) => sum + Object.values(run.findings ?? {}).reduce((a, b) => a + b, 0), 0),
    };
  });
  return {
    now,
    machine: { ...memory(), processorPercent: lastBusy, load: Math.round(loadavg()[0] * 10) / 10, cores: cpus().length },
    overnight: readJson(join(root, 'overnight.json')),
    personas,
    findings: byKind,
  };
}

const send = (response, status, type, body) => {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/' || url.pathname === '/dashboard.html') {
    send(response, 200, 'text/html; charset=utf-8', readFileSync(join(here, 'dashboard.html')));
    return;
  }
  if (url.pathname === '/api/state') {
    send(response, 200, 'application/json', JSON.stringify(dashboardState()));
    return;
  }
  const shot = /^\/shots\/([\w-]+)\/([\w.-]+\.png)$/.exec(url.pathname);
  if (shot) {
    const folder = resolve(runDir(shot[1]), 'shots');
    const path = normalize(join(folder, shot[2]));
    if (path.startsWith(folder) && existsSync(path)) {
      send(response, 200, 'image/png', readFileSync(path));
      return;
    }
  }
  send(response, 404, 'text/plain', 'not here');
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => console.log(`dashboard on http://127.0.0.1:${PORT}/`));
}
