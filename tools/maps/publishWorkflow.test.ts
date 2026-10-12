import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUBMISSIONS_URL } from '../../src/game/maker/submitConfig';
import { PROJECT_URL } from './projectRequests.mjs';

/**
 * The publish workflow's secrets never share a machine with the game's
 * dependencies (the security review's M4, and the red team's F2: the steps of
 * one job share a machine, so giving a secret to one step was not enough).
 * The service-role key bypasses every rule the database has, and the write
 * token can push to `main`, which deploys to every player.
 */
const workflow = readFileSync(new URL('../../.github/workflows/publish-player-maps.yml', import.meta.url), 'utf8');
const jobs = Object.fromEntries(
  workflow
    .slice(workflow.indexOf('\njobs:\n'))
    .split(/\n {2}(?=[a-z]+:\n)/)
    .slice(1)
    .map((block) => [block.slice(0, block.indexOf(':')), block]),
);
const holding = (secret: RegExp): string[] => Object.keys(jobs).filter((name) => secret.test(jobs[name]));
const installs = (name: string): boolean => /\bnpm\b|\bnpx\b|vite-node/.test(jobs[name]);

describe('the publish workflow', () => {
  it('is four jobs, and grants nothing to the workflow as a whole', () => {
    expect(Object.keys(jobs)).toEqual(['fetch', 'verify', 'publish', 'mark']);
    expect(workflow).toContain('\npermissions: {}\n');
  });

  it('gives the service-role key only to the jobs that call the project, neither of which installs anything', () => {
    expect(holding(/SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\./)).toEqual(['fetch', 'mark']);
    expect(installs('fetch')).toBe(false);
    expect(installs('mark')).toBe(false);
  });

  it('gives the write token only to the job that pushes, which installs nothing either', () => {
    expect(holding(/GH_TOKEN: \$\{\{ github\.token \}\}/)).toEqual(['publish']);
    expect(holding(/contents: write/)).toEqual(['publish']);
    expect(installs('publish')).toBe(false);
  });

  it('runs the dependencies only in a job that holds no secret and can only read', () => {
    expect(Object.keys(jobs).filter(installs)).toEqual(['verify']);
    expect(jobs.verify).not.toMatch(/secrets\.|github\.token/);
    expect(jobs.verify).toMatch(/permissions:\n\s+contents: read\n\s+outputs:/);
  });

  it('commits nothing but map files named as map ids', () => {
    expect(jobs.publish).toContain('^[a-z0-9]+(-[a-z0-9]+)*\\.json$');
    expect(jobs.publish).toContain('git add -- src/maps/player');
  });

  it('runs no install scripts and leaves no token in .git/config', () => {
    expect(workflow).toContain('npm ci --ignore-scripts');
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(4);
  });

  it('talks to the game\'s own project', () => {
    expect(PROJECT_URL).toBe(SUBMISSIONS_URL);
  });
});
