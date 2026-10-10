import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The publish workflow's secrets go where they are used and nowhere else (the
 * security review's M4): the service-role key bypasses every rule the database
 * has, and any step that installs, lints, tests or builds runs code from every
 * npm dependency.
 */
const workflow = readFileSync(new URL('../../.github/workflows/publish-player-maps.yml', import.meta.url), 'utf8');
const steps = workflow.split(/\n {6}- name: /).slice(1).map((block) => ({ name: block.split('\n')[0].trim(), block }));
const holding = (secret: RegExp): string[] => steps.filter((step) => secret.test(step.block)).map((step) => step.name);

describe('the publish workflow', () => {
  it('gives the service-role key only to the two steps that call the project', () => {
    expect(workflow.slice(0, workflow.indexOf('\n    steps:'))).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(holding(/SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\./)).toEqual(['Collect approved maps', 'Mark them published']);
  });

  it('gives the write token only to the steps that push or ask GitHub for something', () => {
    expect(holding(/GH_TOKEN: \$\{\{ github\.token \}\}/)).toEqual(['Open and merge the pull request', 'Deploy the game']);
    expect(workflow).toContain('persist-credentials: false');
  });

  it('runs no install scripts', () => {
    expect(workflow).toContain('npm ci --ignore-scripts');
  });
});
