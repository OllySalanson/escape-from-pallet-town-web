#!/usr/bin/env node
// `npm run vale`: Vale over the words the game says, with the Tells style
// (styles/Tells) - the "does this sound machine-written?" sweep. Warning only:
// it prints and exits 0 unless asked (`--strict`). See README.md beside this.
//
//   npm run vale                        every alert, by file
//   npm run vale -- --summary           counts by rule
//   npm run vale -- --report=<path.md>  the uncontracted lines, grouped by who says them
//   npm run vale -- <file.ts> ...       just these files
//
// Vale is one pinned binary, fetched once from its GitHub release into
// node_modules/.cache/vale and checked against the release's own checksums.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VALE_VERSION = '3.28.1';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const cache = join(repo, 'node_modules', '.cache', 'vale', VALE_VERSION);
const binary = join(cache, 'vale');

/**
 * Where the game's words are: the source, and the district programs that
 * write Greystone Vale's people and signs (the map file is built from them).
 */
const ROOTS = ['src', 'tools/mapcraft/worlds'];
/**
 * Not the game's own voice, or not words at all: tests and their kits, every
 * generated folder (canon Pokedex text, species and moves), the vendored
 * console games, and the map-name word banks.
 */
export const SKIP = [/\.test\.ts$/, /\.testkit\.ts$/, /\.d\.ts$/, /\/generated\//, /\/vendor\//, /mapNames\.ts$/];

export function gameSources(root = repo) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && !SKIP.some((skip) => skip.test(path))) found.push(path);
    }
  };
  for (const each of ROOTS) if (existsSync(join(root, each))) walk(join(root, each));
  return found.sort();
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensureVale() {
  if (existsSync(binary)) return binary;
  if (platform() !== 'linux' || arch() !== 'x64') {
    throw new Error(`fetching Vale is only set up for Linux x64; install Vale ${VALE_VERSION} and put it on PATH as vale`);
  }
  const name = `vale_${VALE_VERSION}_Linux_64-bit.tar.gz`;
  const base = `https://github.com/vale-cli/vale/releases/download/v${VALE_VERSION}`;
  console.error(`fetching Vale ${VALE_VERSION} (once)...`);
  const [archive, sums] = await Promise.all([download(`${base}/${name}`), download(`${base}/vale_${VALE_VERSION}_checksums.txt`)]);
  const expected = sums.toString('utf8').split('\n').find((line) => line.endsWith(` ${name}`))?.split(/\s+/)[0];
  const actual = createHash('sha256').update(archive).digest('hex');
  if (!expected || expected !== actual) throw new Error(`Vale's archive does not match its published checksum (${actual})`);
  mkdirSync(cache, { recursive: true });
  const tarball = join(cache, name);
  writeFileSync(tarball, archive);
  const unpacked = spawnSync('tar', ['-xzf', tarball, '-C', cache, 'vale']);
  if (unpacked.status !== 0) throw new Error(`could not unpack Vale: ${unpacked.stderr}`);
  return binary;
}

/** `vale sync` once: it fetches the TypeScript grammar `.vale.ini` names. */
function ensureGrammar(vale) {
  if (existsSync(join(repo, 'styles', 'config', 'grammars', 'typescript.wasm'))) return;
  const synced = spawnSync(vale, ['sync'], { cwd: repo, encoding: 'utf8' });
  if (synced.status !== 0) throw new Error(`vale sync failed: ${synced.stderr || synced.stdout}`);
}

/** Vale's JSON, flattened to one alert a line with the words it was said about. */
export function flatten(json, root = repo) {
  return Object.entries(json).flatMap(([file, alerts]) =>
    alerts.map((alert) => ({
      file: relative(root, resolve(root, file)),
      line: alert.Line,
      column: alert.Span?.[0] ?? 0,
      rule: alert.Check,
      level: alert.Severity,
      message: alert.Message,
      match: alert.Match,
    })),
  );
}

/** The whole string a line of source says, for the report: the quoted text on that line. */
export function quotedOn(sourceLine) {
  const strings = [...sourceLine.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2]);
  return strings.sort((a, b) => b.length - a.length)[0] ?? sourceLine.trim();
}

/**
 * Who says a line: a `NAME:` at its start; else the `name:` of the object it
 * is written in (a person in a district program, a trainer, a keeper), looked
 * for a few lines up and never past the end of another object; else the file
 * it lives in.
 */
export function speakerOf(text, file, sourceLines = [], lineIndex = -1) {
  const named = /^([A-Z][A-Z .'’-]{1,30}):\s/.exec(text);
  if (named) return named[1].trim();
  for (let at = lineIndex; at >= 0 && at > lineIndex - 15; at -= 1) {
    const line = sourceLines[at];
    if (at < lineIndex && /^\s*\},?\s*$/.test(line)) break;
    const owner = /\bname:\s*(['"])((?:\\.|(?!\1).)+)\1/.exec(line);
    if (owner) return `${owner[2]} (${file.replace(/^.*\//, '')})`;
  }
  return file;
}

function report(alerts, path) {
  const lines = new Map();
  for (const alert of alerts.filter((each) => each.rule === 'Tells.NoContraction')) {
    const sourceLines = readFileSync(join(repo, alert.file), 'utf8').split('\n');
    const text = quotedOn(sourceLines[alert.line - 1] ?? '');
    const key = `${alert.file}:${alert.line}`;
    if (!lines.has(key)) lines.set(key, { ...alert, text, speaker: speakerOf(text, alert.file, sourceLines, alert.line - 1), matches: [] });
    lines.get(key).matches.push(alert.match);
  }
  const bySpeaker = new Map();
  for (const line of lines.values()) {
    if (!bySpeaker.has(line.speaker)) bySpeaker.set(line.speaker, []);
    bySpeaker.get(line.speaker).push(line);
  }
  const groups = [...bySpeaker.entries()].sort((a, b) => b[1].length - a[1].length);
  const out = [
    '# Uncontracted lines in the game, by who says them',
    '',
    `Written by \`npm run vale -- --report=${relative(repo, path)}\` (Vale ${VALE_VERSION}, rule \`Tells.NoContraction\`) on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand: run it again.`,
    `${lines.size} lines from ${groups.length} speakers or files. A speaker is the \`NAME:\` a line starts with; otherwise the file it is in.`,
    '',
  ];
  for (const [speaker, said] of groups) {
    out.push(`## ${speaker} (${said.length})`, '');
    for (const line of said.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      out.push(`- \`${line.file}:${line.line}\` [${[...new Set(line.matches)].join(', ')}] ${line.text.replace(/\|/g, '\\|')}`);
    }
    out.push('');
  }
  writeFileSync(path, out.join('\n'));
  console.log(`wrote ${lines.size} lines by ${groups.length} speakers to ${relative(repo, path)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const files = args.filter((arg) => !arg.startsWith('--'));
  const vale = await ensureVale();
  ensureGrammar(vale);
  const targets = files.length > 0 ? files : gameSources().map((path) => relative(repo, path));
  const run = spawnSync(vale, ['--output=JSON', '--no-exit', ...targets], { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0 && !run.stdout) throw new Error(run.stderr);
  const alerts = flatten(JSON.parse(run.stdout || '{}'));
  if (option('report')) {
    report(alerts, resolve(repo, option('report')));
  } else if (args.includes('--summary')) {
    const counts = new Map();
    for (const alert of alerts) counts.set(alert.rule, (counts.get(alert.rule) ?? 0) + 1);
    for (const [rule, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(5)} ${rule}`);
    console.log(`${String(alerts.length).padStart(5)} in ${targets.length} files`);
  } else {
    for (const alert of alerts) console.log(`${alert.file}:${alert.line}:${alert.column} ${alert.level} ${alert.rule} ${alert.message}`);
    console.log(`${alerts.length} alerts in ${targets.length} files (warnings only: nothing fails)`);
  }
  if (args.includes('--strict') && alerts.some((alert) => alert.level === 'error')) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
