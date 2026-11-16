#!/usr/bin/env node
/**
 * Installs the skills into the folder a coding agent reads.
 *
 * It copies skill folders and nothing else. It never overwrites or removes a
 * skill folder that did not come from this package. Node.js 18 or newer.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = 'author: cartridge-compass';
const TARGETS = {
  claude: { project: '.claude/skills', user: '.claude/skills', label: 'Claude Code (also read by Cursor and GitHub Copilot)' },
  cursor: { project: '.cursor/skills', user: '.cursor/skills', label: 'Cursor' },
  copilot: { project: '.github/skills', user: '.copilot/skills', label: 'GitHub Copilot' },
  agents: { project: '.agents/skills', user: '.agents/skills', label: 'Codex and other agents (also read by Cursor and GitHub Copilot)' },
};
TARGETS.codex = TARGETS.agents;

const HELP = `Install Cartridge Compass Skills

Usage: node install.mjs --agent <name> [options]

  --agent <name>    claude, cursor, copilot, codex or agents
  --scope <scope>   project (default): into the current folder. user: into your home folder
  --dir <folder>    Project folder to install into. Default: current folder
  --skills <list>   Comma-separated skill names. Default: all
  --agents-md       Also add the always-on guidance block to AGENTS.md in the project
  --uninstall       Remove the skills this package installed
  --dry-run         Show what would happen
  --list            List the skills in this package

Agents and folders
${Object.entries(TARGETS).filter(([k]) => k !== 'codex').map(([k, t]) => `  ${k.padEnd(8)} ${t.project.padEnd(16)} ${t.label}`).join('\n')}

Install into ONE folder per project. Cursor and Copilot also read .claude/skills and .agents/skills,
so installing twice makes every skill appear twice.
`;

function fail(message) {
  console.error(`install: ${message}`);
  process.exit(2);
}

function parse(argv) {
  const opts = { scope: 'project' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (['agents-md', 'uninstall', 'dry-run', 'list', 'help'].includes(key)) opts[key] = true;
    else if (['agent', 'scope', 'dir', 'skills'].includes(key)) {
      opts[key] = argv[++i];
      if (!opts[key]) fail(`--${key} needs a value.`);
    } else fail(`unknown option ${argv[i]}. Run with --help.`);
  }
  return opts;
}

const isOurs = (dir) => {
  try {
    return fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').includes(MARK);
  } catch {
    return false;
  }
};

function main() {
  const opts = parse(process.argv.slice(2));
  const available = fs.readdirSync(path.join(HERE, 'skills')).filter((n) => fs.existsSync(path.join(HERE, 'skills', n, 'SKILL.md'))).sort();
  if (opts.help || (!opts.agent && !opts.list)) return console.log(HELP);
  if (opts.list) return console.log(available.join('\n'));
  const target = TARGETS[opts.agent];
  if (!target) fail(`unknown agent "${opts.agent}". Use one of: ${Object.keys(TARGETS).join(', ')}.`);
  if (!['project', 'user'].includes(opts.scope)) fail('--scope must be project or user.');
  const wanted = opts.skills ? opts.skills.split(',').map((s) => s.trim()) : available;
  const unknown = wanted.filter((s) => !available.includes(s));
  if (unknown.length) fail(`unknown skills: ${unknown.join(', ')}. Run with --list.`);

  const base = opts.scope === 'user' ? os.homedir() : path.resolve(opts.dir || '.');
  if (!fs.existsSync(base)) fail(`folder does not exist: ${base}`);
  const dest = path.join(base, target[opts.scope]);
  const dry = opts['dry-run'] ? '[dry run] ' : '';
  console.log(`${dry}${opts.uninstall ? 'Removing from' : 'Installing into'} ${dest}`);

  for (const name of wanted) {
    const to = path.join(dest, name);
    const exists = fs.existsSync(to);
    if (exists && !isOurs(to)) {
      console.log(`  skipped   ${name}: a different skill with this name is already there. It was not touched.`);
      continue;
    }
    if (opts.uninstall) {
      if (!exists) continue;
      if (!opts['dry-run']) fs.rmSync(to, { recursive: true });
      console.log(`  removed   ${name}`);
      continue;
    }
    if (!opts['dry-run']) {
      if (exists) fs.rmSync(to, { recursive: true });
      fs.cpSync(path.join(HERE, 'skills', name), to, { recursive: true });
    }
    console.log(`  ${exists ? 'updated  ' : 'installed'} ${name}`);
  }

  if (opts['agents-md'] && opts.scope === 'project') {
    const file = path.join(base, 'AGENTS.md');
    const block = fs.readFileSync(path.join(HERE, 'templates/AGENTS.snippet.md'), 'utf8').trim();
    const begin = '<!-- compass-skills:begin -->';
    const end = '<!-- compass-skills:end -->';
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const a = current.indexOf(begin);
    const b = current.indexOf(end);
    let next;
    if (opts.uninstall) next = a >= 0 && b > a ? (current.slice(0, a) + current.slice(b + end.length)).replace(/\n{3,}/g, '\n\n') : current;
    else if (a >= 0 && b > a) next = current.slice(0, a) + `${begin}\n${block}\n${end}` + current.slice(b + end.length);
    else next = `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${begin}\n${block}\n${end}\n`;
    if (next !== current) {
      if (!opts['dry-run']) fs.writeFileSync(file, next);
      console.log(`  ${opts.uninstall ? 'removed block from' : 'updated  '} AGENTS.md`);
    }
  }
  if (!opts.uninstall) console.log('\nStart a new agent session, then ask: "Orient yourself in this SFCC project."');
}

main();
