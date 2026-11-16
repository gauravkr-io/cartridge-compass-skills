#!/usr/bin/env node
/**
 * Checks every skill against the Agent Skills specification and this
 * package's own rules. Exits with code 1 when anything fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCRIPT_SKILLS } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { fields, body: text.slice(m[0].length) };
}

function proseLines(text) {
  const lines = [];
  let fenced = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    else if (!fenced) lines.push({ line, n: i + 1 });
  });
  return lines;
}

function checkStyle(file, text) {
  const rel = path.relative(ROOT, file);
  text.split('\n').forEach((line, i) => {
    if (line.includes('—')) errors.push(`${rel}:${i + 1} em dash`);
  });
  if (!file.endsWith('.md')) return;
  for (const { line, n } of proseLines(text)) {
    const prose = line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
    if (prose.includes(';')) errors.push(`${rel}:${n} semicolon in prose`);
    for (const m of line.replace(/`[^`]*`/g, '').matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|#)/.test(m[1])) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) errors.push(`${rel}:${n} broken link ${m[1]}`);
    }
  }
}

const version = JSON.parse(read(path.join(ROOT, 'package.json'))).version;
const skillsDir = path.join(ROOT, 'skills');
const names = fs.readdirSync(skillsDir).filter((n) => fs.statSync(path.join(skillsDir, n)).isDirectory());
const source = read(path.join(ROOT, 'src/compass.mjs'));
const license = read(path.join(ROOT, 'LICENSE.txt'));

for (const name of names) {
  const dir = path.join(skillsDir, name);
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) {
    errors.push(`${name}: SKILL.md missing`);
    continue;
  }
  const text = read(file);
  const fm = frontmatter(text);
  if (!fm) {
    errors.push(`${name}: no frontmatter`);
    continue;
  }
  const { fields, body } = fm;
  if (fields.name !== name) errors.push(`${name}: name "${fields.name}" must match the folder`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) errors.push(`${name}: invalid skill name`);
  const description = fields.description || '';
  if (!description) errors.push(`${name}: description missing`);
  if (description.length > 1024) errors.push(`${name}: description is ${description.length} characters, limit 1024`);
  if (!/Use (when|before|at)/.test(description)) errors.push(`${name}: description must say when to use the skill`);
  if (/[<>]/.test(description)) errors.push(`${name}: description must not contain angle brackets`);
  if (!text.includes(`version: "${version}"`)) errors.push(`${name}: metadata version must be "${version}"`);
  const lines = body.split('\n').length;
  if (lines > 500) errors.push(`${name}: body has ${lines} lines, limit 500`);
  if (!fs.existsSync(path.join(dir, 'LICENSE.txt')) || read(path.join(dir, 'LICENSE.txt')) !== license) errors.push(`${name}: LICENSE.txt missing or stale. Run npm run build`);
  const script = path.join(dir, 'scripts/compass.mjs');
  if (SCRIPT_SKILLS.includes(name)) {
    if (!fs.existsSync(script) || read(script) !== source) errors.push(`${name}: scripts/compass.mjs missing or stale. Run npm run build`);
  } else if (body.includes('compass.mjs') && !/from the sfcc-[a-z-]+ skill/.test(body)) {
    errors.push(`${name}: mentions compass.mjs without bundling it or naming the skill that does`);
  }
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    const full = path.join(dir, String(f));
    if (fs.statSync(full).isFile() && /\.(md|mjs|json|txt)$/.test(full)) checkStyle(full, read(full));
  }
}

const required = ['README.md', 'SETUP.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE.txt', 'templates/AGENTS.snippet.md', 'install.mjs', 'src/compass.mjs'];
const docs = fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`);
for (const f of [...required, ...docs]) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) errors.push(`${f} missing`);
  else if (f !== 'LICENSE.txt') checkStyle(full, read(full));
}

const plugin = JSON.parse(read(path.join(ROOT, '.claude-plugin/plugin.json')));
if (plugin.version !== version) errors.push(`.claude-plugin/plugin.json version ${plugin.version} differs from package.json ${version}`);
if (!read(path.join(ROOT, 'CHANGELOG.md')).includes(`## ${version}`)) errors.push(`CHANGELOG.md has no entry for ${version}`);

const triggers = JSON.parse(read(path.join(ROOT, 'evals/triggers.json')));
for (const name of names) if (!triggers.some((t) => t.skill === name)) errors.push(`evals/triggers.json has no queries for ${name}`);
for (const t of triggers) if (t.skill !== 'none' && !names.includes(t.skill)) errors.push(`evals/triggers.json names unknown skill ${t.skill}`);

for (const e of errors) console.log(`ERROR ${e}`);
console.log(`validate: ${names.length} skills, ${errors.length} errors`);
process.exit(errors.length ? 1 : 0);
