#!/usr/bin/env node
/**
 * Copies shared files into the skills that ship them. A skill folder must work
 * when it is installed by itself, so the script and the license are duplicated
 * on purpose. Edit src/compass.mjs and LICENSE.txt, then run this.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPT_SKILLS = ['sfcc-orient', 'sfcc-what-runs', 'sfcc-blast-radius', 'sfcc-cross-repo'];

export function build() {
  const skills = fs.readdirSync(path.join(ROOT, 'skills')).filter((n) => fs.existsSync(path.join(ROOT, 'skills', n, 'SKILL.md')));
  for (const name of skills) {
    fs.copyFileSync(path.join(ROOT, 'LICENSE.txt'), path.join(ROOT, 'skills', name, 'LICENSE.txt'));
  }
  for (const name of SCRIPT_SKILLS) {
    const dir = path.join(ROOT, 'skills', name, 'scripts');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'src/compass.mjs'), path.join(dir, 'compass.mjs'));
  }
  return skills;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const skills = build();
  console.log(`build: ${skills.length} skills updated, script copied into ${SCRIPT_SKILLS.length}`);
}
