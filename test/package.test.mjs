import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = (args, cwd = ROOT) => execFileSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'compass-install-'));
const SKILLS = fs.readdirSync(path.join(ROOT, 'skills')).sort();

test('every skill passes the specification checks', () => {
  assert.match(node(['scripts/validate.mjs']), /9 skills, 0 errors/);
});

test('each agent gets its own folder and the bundled script runs from there', () => {
  const folders = { claude: '.claude/skills', cursor: '.cursor/skills', copilot: '.github/skills', agents: '.agents/skills', codex: '.agents/skills' };
  for (const [agent, folder] of Object.entries(folders)) {
    const dir = tmp();
    node([path.join(ROOT, 'install.mjs'), '--agent', agent, '--dir', dir]);
    assert.deepEqual(fs.readdirSync(path.join(dir, folder)).sort(), SKILLS, agent);
    const out = node([path.join(dir, folder, 'sfcc-what-runs/scripts/compass.mjs'), 'overview', '--root', dir]);
    assert.match(out, /Workspace overview/);
  }
});

test('install is repeatable, selective and never touches foreign skills', () => {
  const dir = tmp();
  const foreign = path.join(dir, '.claude/skills/sfcc-review');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'SKILL.md'), '---\nname: sfcc-review\ndescription: someone else\n---\n');
  const first = node([path.join(ROOT, 'install.mjs'), '--agent', 'claude', '--dir', dir, '--skills', 'sfcc-orient,sfcc-review']);
  assert.match(first, /skipped\s+sfcc-review/);
  assert.match(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), /someone else/);
  assert.match(node([path.join(ROOT, 'install.mjs'), '--agent', 'claude', '--dir', dir, '--skills', 'sfcc-orient']), /updated\s+sfcc-orient/);
  node([path.join(ROOT, 'install.mjs'), '--agent', 'claude', '--dir', dir, '--uninstall']);
  assert.deepEqual(fs.readdirSync(path.join(dir, '.claude/skills')), ['sfcc-review'], 'uninstall removes only our skills');
});

test('dry run writes nothing and the AGENTS.md block is managed between markers', () => {
  const dir = tmp();
  node([path.join(ROOT, 'install.mjs'), '--agent', 'cursor', '--dir', dir, '--dry-run', '--agents-md']);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Team rules\n\nRun the tests.\n');
  for (let i = 0; i < 2; i++) node([path.join(ROOT, 'install.mjs'), '--agent', 'cursor', '--dir', dir, '--agents-md']);
  const text = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.ok(text.startsWith('# Team rules\n\nRun the tests.\n'));
  assert.equal(text.split('compass-skills:begin').length, 2, 'the block is not duplicated');
  node([path.join(ROOT, 'install.mjs'), '--agent', 'cursor', '--dir', dir, '--agents-md', '--uninstall']);
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').trim(), '# Team rules\n\nRun the tests.');
});

test('bad installer input is rejected', () => {
  for (const args of [['--agent', 'nope'], ['--agent', 'claude', '--skills', 'missing'], ['--agent', 'claude', '--scope', 'world'], ['--wat']]) {
    assert.throws(() => node([path.join(ROOT, 'install.mjs'), ...args]), (err) => err.status === 2);
  }
});

test('skills name only skills that exist', () => {
  for (const name of SKILLS) {
    const text = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8');
    for (const m of text.matchAll(/\bsfcc-[a-z]+(?:-[a-z]+)*\b/g)) assert.ok(SKILLS.includes(m[0]), `${name} mentions unknown skill ${m[0]}`);
  }
});
