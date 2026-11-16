#!/usr/bin/env node
/**
 * compass: read-only facts about a Salesforce B2C Commerce workspace.
 *
 * Answers questions that depend on the cartridge path of each site, for every
 * site at once and across several repositories. It never writes files, never
 * reads dw.json or other credential files, and never contacts an instance.
 *
 * Node.js 18 or newer. No dependencies. Run with --help for usage.
 */
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.0.2';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache', '.idea', '.vscode', '.turbo', 'out', '.react-router', '.claude', '.cursor', '.agents', '.github', '.sfcc-kit']);
const NEVER_READ = /(^|\/)(dw\.json|\.env(\..*)?|.*\.(pem|key|p12|pfx|jks))$/;
const MAX_FILES = 60000;
const MAX_BYTES = 768 * 1024;
const CARTRIDGE_FOLDERS = ['controllers', 'scripts', 'templates', 'pipelines', 'models', 'rest-apis', 'static', 'forms', 'experience', 'client'];

const HELP = `compass ${VERSION}: read-only facts about an SFCC workspace

Usage: node compass.mjs <command> [options]

Commands
  overview                     Repositories, architectures, cartridges, sites and what is not configured
  sites                        Site matrix: shared cartridges, differences, cartridges missing locally
  resolve --route Cart-Show    Which controller files serve a route, per site
  resolve --template a/b       Which template file wins, per site
  resolve --file scripts/x.js  Which copy of a file (relative to cartridge/) wins, per site
  hooks [--point name]         Hook registrations in cartridge path order, per site
  impact <file>                Which sites a change to this file reaches, and what depends on it

Options
  --root <dir>      Folder to scan. Repeatable. Default: current directory
  --sites <file>    JSON with sites and cartridge paths. Default: auto-discovery (see below)
  --path <a:b:c>    Use this single cartridge path instead of site configuration
  --site <ids>      Limit to these site IDs, comma separated
  --export <id>     With "sites": print one site's path as a:b:c, for SFCC_CARTRIDGES
  --json            Machine-readable output
  --max <n>         Maximum list items in text output (default 25)

Cartridge paths are discovered in this order and never guessed:
  --path, --sites, docs/ai/site-map.json or compass.sites.json under a root,
  then <custom-cartridges> in sites/<id>/site.xml files found in the scan.
Without any of these, answers list every candidate and say that precedence is unknown.
`;

// ---------- small helpers ----------

const toPosix = (p) => p.split(path.sep).join('/');
const uniq = (list) => [...new Set(list)];

function readText(file) {
  if (NEVER_READ.test(toPosix(file))) return '';
  try {
    if (fs.statSync(file).size > MAX_BYTES) return '';
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readJson(file) {
  const text = readText(file);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function parseArgs(argv) {
  const opts = { roots: [], positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      opts.positional.push(a);
      continue;
    }
    const key = a.slice(2);
    if (key === 'json' || key === 'help') {
      opts[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) fail(`--${key} needs a value.`);
    if (key === 'root') opts.roots.push(value);
    else opts[key] = value;
  }
  opts.command = opts.positional.shift();
  if (!opts.roots.length) opts.roots.push('.');
  opts.max = Number(opts.max) > 0 ? Number(opts.max) : 25;
  return opts;
}

function fail(message) {
  console.error(`compass: ${message}`);
  process.exit(2);
}

// ---------- scanning ----------

function isCartridgeDir(dir, name) {
  const inner = path.join(dir, 'cartridge');
  try {
    if (!fs.statSync(inner).isDirectory()) return false;
  } catch {
    return false;
  }
  if (fs.existsSync(path.join(dir, '.project')) || fs.existsSync(path.join(inner, `${name}.properties`))) return true;
  return CARTRIDGE_FOLDERS.some((f) => fs.existsSync(path.join(inner, f)));
}

function listCartridgeFiles(inner) {
  const files = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
      } else if (e.isFile()) {
        files.set(toPosix(path.relative(inner, full)), full);
      }
    }
  };
  walk(inner);
  return files;
}

function scan(rootArgs) {
  const roots = rootArgs.map((r) => path.resolve(r));
  const state = { roots, cartridges: [], packages: [], siteXml: [], truncated: false, seen: 0 };
  for (const root of roots) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail(`root is not a folder: ${root}`);
    walkRoot(root, root, state);
  }
  state.cartridges.sort((a, b) => a.name.localeCompare(b.name) || a.rel.localeCompare(b.rel));
  return state;
}

function repoOf(root, dir) {
  let cur = dir;
  while (cur.startsWith(root)) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    if (cur === root) break;
    cur = path.dirname(cur);
  }
  const first = toPosix(path.relative(root, dir)).split('/')[0];
  return first && first !== '..' ? path.join(root, first) : root;
}

function walkRoot(root, dir, state) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (state.truncated) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (isCartridgeDir(full, e.name)) {
        const files = listCartridgeFiles(path.join(full, 'cartridge'));
        state.seen += files.size;
        const repo = repoOf(root, full);
        state.cartridges.push({ name: e.name, dir: full, rel: toPosix(path.relative(root, full)), root, repo, repoName: path.basename(repo), files });
        continue;
      }
      walkRoot(root, full, state);
    } else if (e.isFile()) {
      if (++state.seen > MAX_FILES) {
        state.truncated = true;
        return;
      }
      if (e.name === 'package.json') state.packages.push({ file: full, repo: repoOf(root, dir) });
      else if (e.name === 'site.xml' && path.basename(path.dirname(dir)) === 'sites') state.siteXml.push(full);
    }
  }
}

// ---------- sites ----------

function normalizePath(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(':');
  return list.map((c) => String(c).trim().replace(/^-+/, '')).filter(Boolean);
}

function loadSites(opts, state) {
  const result = { source: 'not configured', sites: [], bmPath: null, notes: [] };
  if (opts.path) {
    result.source = '--path';
    result.sites = [{ id: '(given path)', cartridgePath: normalizePath(opts.path) }];
    return result;
  }
  const candidates = opts.sites ? [path.resolve(opts.sites)] : state.roots.flatMap((r) => [path.join(r, 'docs/ai/site-map.json'), path.join(r, 'compass.sites.json')]);
  for (const file of candidates) {
    if (!fs.existsSync(file)) {
      if (opts.sites) fail(`sites file not found: ${file}`);
      continue;
    }
    const data = readJson(file);
    const list = Array.isArray(data) ? data : data && data.sites;
    if (!Array.isArray(list)) {
      result.notes.push(`${toPosix(file)} is not valid site configuration. It was ignored.`);
      continue;
    }
    for (const s of list) {
      const id = s && typeof s.id === 'string' && s.id.trim();
      const cartridgePath = s ? normalizePath(s.cartridgePath) : [];
      if (id && cartridgePath.length) result.sites.push({ id, cartridgePath });
      else result.notes.push(`${toPosix(file)}: a site entry without id or cartridgePath was ignored.`);
    }
    const bm = data && data.businessManager && data.businessManager.cartridgePath;
    if (bm) result.bmPath = normalizePath(bm);
    if (result.sites.length) {
      result.source = toPosix(file);
      break;
    }
  }
  if (!result.sites.length && state.siteXml.length) {
    const byId = new Map();
    for (const file of [...state.siteXml].sort()) {
      const m = readText(file).match(/<custom-cartridges>([^<]*)<\/custom-cartridges>/);
      if (m && m[1].trim()) byId.set(path.basename(path.dirname(file)), { cartridgePath: normalizePath(m[1]), file });
    }
    result.sites = [...byId.entries()].map(([id, v]) => ({ id, cartridgePath: v.cartridgePath }));
    if (result.sites.length) {
      result.source = 'site.xml files in the scanned code';
      result.notes.push('Paths come from site.xml in import data. They may differ from the instance. When several files exist for a site, the last one by path order was used.');
    }
  }
  if (opts.site) {
    const wanted = opts.site.split(',').map((s) => s.trim());
    const unknown = wanted.filter((w) => !result.sites.some((s) => s.id === w));
    if (unknown.length) result.notes.push(`Unknown site IDs ignored: ${unknown.join(', ')}.`);
    result.sites = result.sites.filter((s) => wanted.includes(s.id));
  }
  return result;
}

function cartridgeIndex(state) {
  const byName = new Map();
  const duplicates = [];
  for (const c of state.cartridges) {
    if (byName.has(c.name)) duplicates.push(c.name);
    else byName.set(c.name, c);
  }
  return { byName, duplicates: uniq(duplicates) };
}

/** Groups sites that produce the same answer, so 19 sites read as a few lines. */
function groupBySignature(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.signature)) groups.set(e.signature, { sites: [], answer: e.answer });
    groups.get(e.signature).sites.push(e.site);
  }
  return [...groups.values()].sort((a, b) => b.sites.length - a.sites.length);
}

// ---------- controllers ----------

function parseController(file, action) {
  const src = readText(file);
  const sfra = /require\(\s*['"]server['"]\s*\)/.test(src);
  const guard = /guard\.\w+\(|require\([^)]*scripts\/guard['"]\)/.test(src);
  const info = { style: sfra ? 'sfra' : guard ? 'sgjc' : /\.public\s*=\s*true/.test(src) ? 'classic' : 'unknown', extendsBase: false, defs: [], dynamic: false };
  info.extendsBase = sfra && /server\.extend\(/.test(src) && /module\.superModule/.test(src);
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of src.matchAll(new RegExp(`server\\.(get|post|use|append|prepend|replace)\\(\\s*['"]${escaped}['"]`, 'g'))) {
    info.defs.push({ verb: m[1], line: lineOf(src, m.index) });
  }
  for (const m of src.matchAll(new RegExp(`(?:module\\.)?exports\\.${escaped}\\s*=`, 'g'))) {
    info.defs.push({ verb: 'export', line: lineOf(src, m.index) });
  }
  info.dynamic = /server\.(get|post|use|append|prepend|replace)\(\s*[A-Za-z_$][\w$.]*\s*,/.test(src);
  return info;
}

function resolveRoute(cartridgePath, byName, controller, action) {
  const rel = `controllers/${controller}.js`;
  const chain = [];
  const missingLeft = [];
  let winnerIndex = -1;
  let expecting = true;
  cartridgePath.forEach((name, i) => {
    const c = byName.get(name);
    if (!c) {
      if (winnerIndex < 0) missingLeft.push(name);
      return;
    }
    const file = c.files.get(rel);
    if (!file || !expecting) return;
    if (winnerIndex < 0) winnerIndex = i;
    const info = parseController(file, action);
    chain.push({ cartridge: name, file: toPosix(path.relative(c.root, file)), ...info });
    expecting = info.extendsBase;
  });
  const answer = { controller, action, chain, missingLeft, verdict: '', notes: [] };
  if (!chain.length) {
    const pipeline = cartridgePath.map((n) => byName.get(n)).find((c) => c && c.files.has(`pipelines/${controller}.xml`));
    if (pipeline) {
      answer.verdict = 'pipeline';
      answer.pipeline = { cartridge: pipeline.name, file: toPosix(path.relative(pipeline.root, pipeline.files.get(`pipelines/${controller}.xml`))) };
      answer.notes.push('No controller with this name is on the path, so the pipeline is used. Start node names are not verified by this tool.');
    } else {
      answer.verdict = 'not found';
      answer.notes.push(`No controllers/${controller}.js and no pipelines/${controller}.xml in the scanned cartridges on this path.`);
    }
  } else {
    const defined = chain.some((l) => l.defs.length);
    const base = chain.find((l) => l.defs.some((d) => ['get', 'post', 'use', 'replace', 'export'].includes(d.verb)));
    if (!defined && chain.some((l) => l.dynamic)) {
      answer.verdict = 'not determined';
      answer.notes.push('The selected file registers routes with computed names. Read the file to confirm.');
    } else if (!defined || !base) {
      answer.verdict = 'error at runtime';
      answer.notes.push(`${chain[0].cartridge} provides controllers/${controller}.js and the platform selects that file, but no file in its chain defines "${action}". The platform does not fall through to another cartridge.`);
    } else {
      answer.verdict = chain.length > 1 ? 'chain' : 'single file';
    }
    if (chain.length && !chain[chain.length - 1].extendsBase) {
      const shadowed = cartridgePath.slice(winnerIndex + 1).filter((n) => byName.get(n)?.files.has(rel) && !chain.some((l) => l.cartridge === n));
      if (shadowed.length) answer.shadowed = shadowed;
    }
  }
  if (missingLeft.length && answer.verdict !== 'not found') {
    answer.notes.push(`Cartridges on the path but not in the scanned code, left of the result: ${missingLeft.join(', ')}. If one of them has controllers/${controller}.js, it wins instead.`);
  }
  const signature = JSON.stringify([answer.verdict, chain.map((l) => [l.cartridge, l.defs.map((d) => d.verb)]), answer.pipeline?.cartridge, missingLeft]);
  return { answer, signature };
}

// ---------- files and templates ----------

function resolveFile(cartridgePath, byName, rel) {
  const holders = [];
  const missingLeft = [];
  for (const name of cartridgePath) {
    const c = byName.get(name);
    if (!c) {
      if (!holders.length) missingLeft.push(name);
      continue;
    }
    if (c.files.has(rel)) holders.push({ cartridge: name, file: toPosix(path.relative(c.root, c.files.get(rel))), abs: c.files.get(rel) });
  }
  const answer = { file: rel, winner: holders[0] || null, lower: holders.slice(1).map((h) => h.cartridge), missingLeft, notes: [] };
  if (holders.length > 1 && /\.(js|ds)$/.test(rel)) {
    answer.winnerUsesSuperModule = /module\.superModule/.test(readText(holders[0].abs));
    answer.notes.push(answer.winnerUsesSuperModule
      ? 'The winning copy uses module.superModule, so the next copy to the right also runs as its base.'
      : 'The winning copy does not use module.superModule, so lower copies are fully shadowed.');
  }
  if (missingLeft.length && holders.length) answer.notes.push(`Not in the scanned code, left of the winner: ${missingLeft.join(', ')}. A copy there would win instead.`);
  if (answer.winner) delete answer.winner.abs;
  return { answer, signature: JSON.stringify([holders.map((h) => h.cartridge), missingLeft]) };
}

function templateRels(state, name) {
  const clean = name.replace(/\.isml$/, '');
  const rels = new Set();
  for (const c of state.cartridges) {
    for (const rel of c.files.keys()) {
      const m = rel.match(/^templates\/([^/]+)\/(.+)\.isml$/);
      if (m && m[2] === clean) rels.add(rel);
    }
  }
  return [...rels].sort((a, b) => (a.startsWith('templates/default/') ? -1 : 0) - (b.startsWith('templates/default/') ? -1 : 0) || a.localeCompare(b));
}

// ---------- hooks ----------

function collectHooks(state) {
  const registrations = [];
  for (const c of state.cartridges) {
    const pkg = readJson(path.join(c.dir, 'package.json'));
    if (!pkg || typeof pkg.hooks !== 'string') continue;
    const hooksFile = path.resolve(c.dir, pkg.hooks);
    const data = readJson(hooksFile);
    if (!data || !Array.isArray(data.hooks)) continue;
    for (const h of data.hooks) {
      if (!h || typeof h.name !== 'string') continue;
      const script = typeof h.script === 'string' ? h.script : '';
      const base = path.resolve(path.dirname(hooksFile), script);
      const found = [base, `${base}.js`, `${base}.ds`].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      registrations.push({
        point: h.name,
        cartridge: c.name,
        registeredIn: toPosix(path.relative(c.root, hooksFile)),
        script,
        scriptFile: found ? toPosix(path.relative(c.root, found)) : null,
        kind: h.name.startsWith('dw.') ? 'system' : 'custom',
      });
    }
  }
  return registrations;
}

// ---------- impact ----------

function locate(state, fileArg) {
  const abs = path.resolve(fileArg);
  const owner = state.cartridges.find((c) => abs === c.dir || abs.startsWith(c.dir + path.sep));
  if (!owner) return null;
  const inner = path.join(owner.dir, 'cartridge');
  const rel = abs.startsWith(inner + path.sep) ? toPosix(path.relative(inner, abs)) : null;
  return { owner, rel, abs, exists: fs.existsSync(abs) };
}

// Accepts a cartridge-relative path (scripts/x.js or cartridge/scripts/x.js), a repo-relative path
// (cartridges/app_x/cartridge/scripts/x.js) or an absolute path, and returns the path inside cartridge/.
function fileRel(state, arg) {
  const hit = locate(state, arg);
  if (hit && hit.rel) return hit.rel;
  const posix = toPosix(arg);
  const m = posix.match(/(?:^|\/)cartridge\/(.+)$/);
  return m ? m[1] : posix;
}

function findDependents(state, target) {
  const { owner, rel } = target;
  const found = [];
  const add = (c, file, kind, line) => found.push({ cartridge: c.name, file: toPosix(path.relative(c.root, file)), kind, line });
  const noExt = rel.replace(/\.(js|ds|json)$/, '');
  const template = rel.match(/^templates\/[^/]+\/(.+)\.isml$/);
  const controller = rel.match(/^controllers\/([^/]+)\.js$/);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const requireRx = new RegExp(`['"](?:\\*|~|${esc(owner.name)})/cartridge/${esc(noExt)}(?:\\.js|\\.ds)?['"]`, 'g');
  const templateRx = template ? new RegExp(`['"]${esc(template[1])}(?:\\.isml)?['"]`, 'g') : null;
  const routeRx = controller ? new RegExp(`['"]${esc(controller[1])}-[A-Za-z0-9_]+['"]`, 'g') : null;
  for (const c of state.cartridges) {
    for (const [r, file] of c.files) {
      if (file === target.abs || !/\.(js|ds|isml|json|xml)$/.test(r)) continue;
      if (r.startsWith('static/') || r.startsWith('client/')) {
        if (!routeRx) continue;
      }
      const src = readText(file);
      if (!src) continue;
      if (/\.(js|ds)$/.test(r)) {
        for (const m of src.matchAll(requireRx)) {
          if (m[0].includes('~/') && c !== owner) continue;
          add(c, file, 'requires it', lineOf(src, m.index));
        }
        if (c === owner) {
          for (const m of src.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
            const resolved = toPosix(path.normalize(path.join(path.dirname(r), m[1]))).replace(/\.(js|ds)$/, '');
            if (resolved === noExt) add(c, file, 'requires it (relative)', lineOf(src, m.index));
          }
        }
      }
      if (templateRx && /\.(js|ds|isml)$/.test(r)) {
        for (const m of src.matchAll(templateRx)) add(c, file, 'renders or includes it', lineOf(src, m.index));
      }
      if (routeRx && /\.(js|ds|isml)$/.test(r)) {
        const hits = [...src.matchAll(routeRx)];
        if (hits.length) add(c, file, `references its routes (${uniq(hits.map((h) => h[0].slice(1, -1))).slice(0, 4).join(', ')})`, lineOf(src, hits[0].index));
      }
    }
    const steps = readText(path.join(c.dir, 'steptypes.json'));
    if (steps && steps.includes(`${owner.name}/cartridge/${noExt}`)) add(c, path.join(c.dir, 'steptypes.json'), 'job step module', 0);
  }
  for (const h of collectHooks(state)) {
    const hookCartridge = state.cartridges.find((c) => c.name === h.cartridge);
    if (h.scriptFile && hookCartridge && path.resolve(hookCartridge.root, h.scriptFile) === target.abs) {
      found.push({ cartridge: h.cartridge, file: h.registeredIn, kind: `hook implementation for ${h.point}`, line: 0 });
    }
  }
  return found;
}

function buildImpact(state, sites, byName, target) {
  const { owner, rel } = target;
  const including = sites.sites.filter((s) => s.cartridgePath.includes(owner.name));
  const perSite = including.map((s) => {
    if (!rel) return { site: s.id, signature: 'cartridge-level', answer: { status: 'cartridge on path' } };
    const { answer } = resolveFile(s.cartridgePath, byName, rel);
    const winner = answer.winner ? answer.winner.cartridge : null;
    let status = 'active';
    let detail = '';
    if (winner !== owner.name) {
      const left = s.cartridgePath.slice(0, s.cartridgePath.indexOf(owner.name)).filter((n) => byName.get(n)?.files.has(rel));
      const top = byName.get(left[0]);
      const viaSuper = top && /module\.superModule/.test(readText(top.files.get(rel)));
      status = viaSuper ? 'runs as base' : 'shadowed';
      detail = viaSuper ? `${left.join(', ')} extends it through module.superModule` : `${left[0]} provides the same file and does not use module.superModule`;
    }
    return { site: s.id, signature: `${status}|${detail}`, answer: { status, detail } };
  });
  return {
    cartridge: owner.name,
    repository: owner.repoName,
    file: rel ? `cartridge/${rel}` : toPosix(path.relative(owner.dir, target.abs)),
    sitesConfigured: sites.sites.length,
    sitesIncluding: including.map((s) => s.id),
    groups: groupBySignature(perSite),
    dependents: rel ? findDependents(state, target) : [],
  };
}

// ---------- overview ----------

function architectureOf(state, repo) {
  const tags = new Map();
  const add = (type, kind, strong) => {
    if (!tags.has(type)) tags.set(type, { kinds: new Set(), strong: 0 });
    const t = tags.get(type);
    if (!t.kinds.has(kind)) {
      t.kinds.add(kind);
      if (strong) t.strong++;
    }
  };
  const cartridges = state.cartridges.filter((c) => c.repo === repo);
  for (const c of cartridges) {
    if (c.name === 'app_storefront_base') add('sfra', 'cartridge app_storefront_base', true);
    if (/^app_storefront_(controllers|core)$/.test(c.name)) add('sgjc', `cartridge ${c.name}`, true);
    let controllers = 0;
    let other = 0;
    for (const [rel, file] of c.files) {
      if (/^controllers\/[^/]+\.js$/.test(rel)) {
        controllers++;
        if (controllers > 40) continue;
        const src = readText(file);
        if (/require\(\s*['"]server['"]\s*\)/.test(src)) add('sfra', 'controllers use the server module', true);
        else if (/guard\.\w+\(/.test(src)) add('sgjc', 'controllers use guard', true);
        else if (/\.public\s*=\s*true/.test(src)) add('custom-controllers', 'controllers export .public = true', true);
        if (/server\.extend\(/.test(src)) add('sfra', 'controllers extend a lower cartridge', false);
        if (/app\.get(Model|View|Form|Controller)\(/.test(src)) add('sgjc', 'controllers use the app facade', false);
      } else if (/^pipelines\/[^/]+\.xml$/.test(rel)) add('pipelines', 'pipeline XML', true);
      else if (/^rest-apis\/[^/]+\/schema\.ya?ml$/.test(rel)) add('scapi-custom-api', 'rest-apis schema', true);
      else if (/^scripts\//.test(rel)) other++;
    }
    if (fs.existsSync(path.join(c.dir, 'bm_extensions.xml')) || c.files.has('bm_extensions.xml')) add('bm-extension', 'bm_extensions.xml', true);
    if (!controllers && !c.files.size) continue;
    if (!controllers && other && ![...c.files.keys()].some((r) => r.startsWith('pipelines/'))) add('integration', 'cartridge without controllers or pipelines', false);
  }
  if (collectHooksFor(state, cartridges).some((h) => h.point.startsWith('dw.ocapi.'))) add('api-hooks', 'hooks.json registers dw.ocapi.* extension points', true);
  for (const p of state.packages.filter((x) => x.repo === repo)) {
    const pkg = readJson(p.file);
    if (!pkg) continue;
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies });
    if (names.some((n) => n.startsWith('@salesforce/storefront-next-'))) add('storefront-next', 'package @salesforce/storefront-next-*', true);
    if (names.some((n) => n.startsWith('@salesforce/pwa-kit-'))) add('pwa-kit', 'package @salesforce/pwa-kit-*', true);
    if (names.some((n) => n.includes('commerce-sdk'))) add('scapi-client', 'package commerce-sdk*', false);
    if (names.includes('sgmf-scripts')) add('sfra', 'package sgmf-scripts', false);
  }
  return [...tags.entries()].map(([type, t]) => ({
    type,
    confidence: t.strong >= 2 || (t.strong === 1 && t.kinds.size >= 2) ? 'high' : t.strong === 1 ? 'medium' : 'low',
    evidence: [...t.kinds],
  })).sort((a, b) => 'hml'.indexOf(a.confidence[0]) - 'hml'.indexOf(b.confidence[0]) || a.type.localeCompare(b.type));
}

function collectHooksFor(state, cartridges) {
  const names = new Set(cartridges.map((c) => c.name));
  return collectHooks(state).filter((h) => names.has(h.cartridge));
}

function buildOverview(state, sites, index) {
  const repos = uniq([...state.cartridges.map((c) => c.repo), ...state.packages.map((p) => p.repo)]).sort();
  const repositories = repos.map((repo) => ({
    name: path.basename(repo),
    path: toPosix(path.relative(process.cwd(), repo)) || '.',
    git: fs.existsSync(path.join(repo, '.git')),
    cartridges: state.cartridges.filter((c) => c.repo === repo).map((c) => c.name),
    architecture: architectureOf(state, repo),
  })).filter((r) => r.cartridges.length || r.architecture.length);
  const onPaths = new Set(sites.sites.flatMap((s) => s.cartridgePath));
  const local = new Set(index.byName.keys());
  const gaps = [];
  if (!sites.sites.length) gaps.push('Site cartridge paths are not configured. Precedence between cartridges is unknown. Do not assume an order.');
  if (!sites.bmPath) gaps.push('The Business Manager cartridge path is not configured.');
  if (repositories.some((r) => !r.architecture.length)) gaps.push('At least one repository has no recognizable architecture. Inspect it before choosing an implementation style.');
  if (state.truncated) gaps.push(`The scan stopped after ${MAX_FILES} files. Narrow --root for complete results.`);
  return {
    repositories,
    cartridgeCount: state.cartridges.length,
    duplicateCartridgeNames: index.duplicates,
    sites: { source: sites.source, count: sites.sites.length, ids: sites.sites.map((s) => s.id), businessManagerPath: sites.bmPath ? 'configured' : 'not configured' },
    onPathNotLocal: sites.sites.length ? [...onPaths].filter((n) => !local.has(n)).sort() : [],
    localOnNoPath: sites.sites.length ? [...local].filter((n) => !onPaths.has(n) && !(sites.bmPath || []).includes(n)).sort() : [],
    gaps,
    notes: sites.notes,
  };
}

// ---------- text output ----------

const BLIND_SPOTS = 'Limits: static reading of local code only. Computed route, template or module names, code loaded with importScript, Business Manager configuration and code outside the scanned folders are not seen. Absence here is not proof of absence.';

function siteLabel(group, total) {
  if (total && group.sites.length === total && total > 1) return `all ${total} sites`;
  return group.sites.length > 6 ? `${group.sites.length} sites (${group.sites.slice(0, 6).join(', ')}, ...)` : group.sites.join(', ');
}

function printRoute(groups, total, title, hasSites) {
  const out = [`# ${title}`, ''];
  for (const g of groups) {
    const a = g.answer;
    out.push(hasSites ? `## ${siteLabel(g, total)}` : '## Candidates (precedence unknown)');
    out.push(`Result: ${a.verdict}`);
    a.chain.forEach((l, i) => {
      const defs = l.defs.length ? l.defs.map((d) => `${d.verb} (line ${d.line})`).join(', ') : 'does not define this action';
      out.push(`${i + 1}. ${l.cartridge}  ${l.file}  [${l.style}]  ${defs}${l.extendsBase ? '  extends the next file' : ''}`);
    });
    if (a.pipeline) out.push(`Pipeline: ${a.pipeline.cartridge}  ${a.pipeline.file}`);
    if (a.shadowed) out.push(`Never reached (shadowed copies): ${a.shadowed.join(', ')}`);
    for (const n of a.notes) out.push(`Note: ${n}`);
    out.push('');
  }
  return out;
}

function print(lines, opts, data) {
  if (opts.json) console.log(JSON.stringify(data, null, 2));
  else console.log([...lines, BLIND_SPOTS].join('\n'));
}

// ---------- commands ----------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.command || opts.command === 'help') {
    console.log(HELP);
    return;
  }
  const state = scan(opts.roots);
  const index = cartridgeIndex(state);
  const sites = loadSites(opts, state);
  const { byName } = index;
  const hasSites = sites.sites.length > 0;
  const total = sites.sites.length;
  const header = hasSites ? `Cartridge paths: ${sites.source}.` : 'Cartridge paths: NOT CONFIGURED. Answers list candidates only. Do not infer precedence.';

  if (opts.command === 'overview') {
    const data = buildOverview(state, sites, index);
    const out = ['# Workspace overview', '', `Repositories: ${data.repositories.length}. Cartridges: ${data.cartridgeCount}. Sites: ${data.sites.count} (${data.sites.source}). Business Manager path: ${data.sites.businessManagerPath}.`, ''];
    for (const r of data.repositories) {
      const arch = r.architecture.length ? r.architecture.map((a) => `${a.type} (${a.confidence})`).join(', ') : 'unknown';
      out.push(`## ${r.name}${r.git ? '' : ' (not a git repository)'}`, `Architecture (detected, a hint and not a fact): ${arch}`);
      for (const a of r.architecture) out.push(`- ${a.type}: ${a.evidence.join('. ')}`);
      if (r.cartridges.length) out.push(`Cartridges (${r.cartridges.length}): ${r.cartridges.slice(0, opts.max).join(', ')}${r.cartridges.length > opts.max ? ', ...' : ''}`);
      out.push('');
    }
    if (data.duplicateCartridgeNames.length) out.push(`Cartridge names found more than once: ${data.duplicateCartridgeNames.join(', ')}. Only the first copy is used in answers.`, '');
    if (data.onPathNotLocal.length) out.push(`On a site path but not in the scanned code (${data.onPathNotLocal.length}): ${data.onPathNotLocal.slice(0, opts.max).join(', ')}`, '');
    if (data.localOnNoPath.length) out.push(`In the code but on no configured path (${data.localOnNoPath.length}): ${data.localOnNoPath.slice(0, opts.max).join(', ')}. These may be Business Manager, job-only or unused.`, '');
    out.push('## Gaps to respect', ...(data.gaps.length ? data.gaps.map((g) => `- ${g}`) : ['- None detected by this tool.']), ...data.notes.map((n) => `- ${n}`), '');
    return print(out, opts, data);
  }

  if (opts.command === 'sites') {
    if (opts.export) {
      const site = sites.sites.find((s) => s.id === opts.export);
      if (!site) fail(`site not found: ${opts.export}`);
      console.log(site.cartridgePath.join(':'));
      return;
    }
    const shared = hasSites ? sites.sites[0].cartridgePath.filter((c) => sites.sites.every((s) => s.cartridgePath.includes(c))) : [];
    const usage = new Map();
    for (const s of sites.sites) for (const c of s.cartridgePath) usage.set(c, [...(usage.get(c) || []), s.id]);
    const data = {
      source: sites.source,
      sites: sites.sites.map((s) => ({ id: s.id, cartridges: s.cartridgePath.length, cartridgePath: s.cartridgePath, notLocal: s.cartridgePath.filter((c) => !byName.has(c)) })),
      sharedByAll: shared,
      usage: Object.fromEntries([...usage.entries()].sort()),
      notes: sites.notes,
    };
    const out = ['# Sites', '', header, ''];
    for (const s of data.sites) out.push(`- ${s.id}: ${s.cartridges} cartridges${s.notLocal.length ? `, ${s.notLocal.length} not in the scanned code` : ''}`);
    if (hasSites && total > 1) out.push('', `Shared by all ${total} sites (a change here reaches every site): ${shared.join(', ') || 'none'}`);
    out.push(...sites.notes.map((n) => `Note: ${n}`), '');
    return print(out, opts, data);
  }

  if (opts.command === 'resolve') {
    if (opts.route) {
      const [controller, action] = opts.route.split('-');
      if (!controller || !action) fail('--route expects Controller-Action, for example Cart-Show.');
      let results;
      if (hasSites) results = sites.sites.map((s) => ({ site: s.id, ...resolveRoute(s.cartridgePath, byName, controller, action) }));
      else {
        const holders = state.cartridges.filter((c) => c.files.has(`controllers/${controller}.js`) || c.files.has(`pipelines/${controller}.xml`));
        const chain = holders.filter((c) => c.files.has(`controllers/${controller}.js`)).map((c) => ({ cartridge: c.name, file: toPosix(path.relative(c.root, c.files.get(`controllers/${controller}.js`))), ...parseController(c.files.get(`controllers/${controller}.js`), action) }));
        if (!holders.length) results = [{ site: '(no path)', signature: 'x', answer: { controller, action, chain, verdict: 'not found', notes: [`No controllers/${controller}.js or pipelines/${controller}.xml in the scanned cartridges. Check the spelling, or the code may be in a cartridge outside the scanned folders.`] } }];
        else results = [{ site: '(no path)', signature: 'x', answer: { controller, action, chain, verdict: 'precedence unknown', notes: ['Every cartridge that has this controller is listed. Which one runs depends on the site cartridge path, which is not configured.'] } }];
      }
      const groups = groupBySignature(results);
      return print([header, '', ...printRoute(groups, total, `Route ${opts.route}`, hasSites)], opts, { route: opts.route, pathSource: sites.source, groups });
    }
    const rels = opts.template ? templateRels(state, opts.template) : opts.file ? [fileRel(state, opts.file)] : null;
    if (!rels) fail('resolve needs --route, --template or --file.');
    const data = [];
    const out = [header, ''];
    if (opts.template && !rels.length) out.push(`No template named ${opts.template} in the scanned cartridges.`, '');
    for (const rel of rels) {
      let results;
      if (hasSites) results = sites.sites.map((s) => ({ site: s.id, ...resolveFile(s.cartridgePath, byName, rel) }));
      else results = [{ site: '(no path)', signature: 'x', answer: { file: rel, winner: null, lower: state.cartridges.filter((c) => c.files.has(rel)).map((c) => c.name), notes: ['Precedence unknown. Cartridges that contain this file are listed.'] } }];
      const groups = groupBySignature(results);
      data.push({ file: rel, groups });
      out.push(`# cartridge/${rel}`, '');
      for (const g of groups) {
        const a = g.answer;
        out.push(`## ${hasSites ? siteLabel(g, total) : 'Candidates (precedence unknown)'}`);
        out.push(a.winner ? `Wins: ${a.winner.cartridge}  ${a.winner.file}` : hasSites ? 'Wins: none of the scanned cartridges on this path has the file' : `Contained in: ${a.lower.join(', ') || 'no scanned cartridge'}`);
        if (a.winner && a.lower.length) out.push(`Lower copies: ${a.lower.join(', ')}`);
        for (const n of a.notes) out.push(`Note: ${n}`);
        out.push('');
      }
    }
    return print(out, opts, { pathSource: sites.source, results: data });
  }

  if (opts.command === 'hooks') {
    const all = collectHooks(state).filter((h) => !opts.point || h.point.includes(opts.point));
    const points = uniq(all.map((h) => h.point)).sort();
    const data = [];
    const out = [header, ''];
    if (!all.length) out.push(opts.point ? `No registration matches "${opts.point}".` : 'No hook registrations found.', '');
    for (const point of points.slice(0, opts.max)) {
      const regs = all.filter((h) => h.point === point);
      let groups;
      if (hasSites) {
        groups = groupBySignature(sites.sites.map((s) => {
          const ordered = s.cartridgePath.flatMap((n) => regs.filter((r) => r.cartridge === n));
          return { site: s.id, signature: JSON.stringify(ordered.map((r) => [r.cartridge, r.script])), answer: ordered };
        }));
      } else groups = [{ sites: ['(no path)'], answer: regs }];
      data.push({ point, kind: regs[0].kind, groups });
      out.push(`# ${point}  [${regs[0].kind} extension point]`);
      for (const g of groups) {
        out.push(`## ${hasSites ? siteLabel(g, total) : 'Registrations (order unknown)'}`);
        if (!g.answer.length) out.push('No registration on this path.');
        g.answer.forEach((r, i) => out.push(`${i + 1}. ${r.cartridge}  ${r.scriptFile || `${r.script} (script not found next to ${r.registeredIn})`}`));
      }
      out.push(regs[0].kind === 'system'
        ? 'Rule: registrations run in cartridge path order. The first one that returns a value skips the later ones and the system implementation.'
        : 'Rule: every registration of a custom extension point runs, whatever it returns.', '');
    }
    if (points.length > opts.max) out.push(`${points.length - opts.max} more extension points not shown. Use --point to filter.`, '');
    return print(out, opts, { pathSource: sites.source, points: data });
  }

  if (opts.command === 'impact') {
    const fileArg = opts.positional[0];
    if (!fileArg) fail('impact needs a file path.');
    const target = locate(state, fileArg);
    if (!target) fail(`${fileArg} is not inside a scanned cartridge. Pass --root for the folder that contains it.`);
    const data = buildImpact(state, sites, byName, target);
    const out = [`# Impact of changing ${data.file}`, '', `Cartridge: ${data.cartridge}. Repository: ${data.repository}.`, header, ''];
    if (hasSites) {
      out.push(data.sitesIncluding.length
        ? `Sites that include ${data.cartridge}: ${data.sitesIncluding.length} of ${data.sitesConfigured}${data.sitesIncluding.length === data.sitesConfigured && total > 1 ? ' (EVERY configured site)' : ''}.`
        : `${data.cartridge} is on no configured site path. It may be Business Manager, job-only or unused. Confirm before assuming the change has no effect.`);
      for (const g of data.groups) out.push(`- ${g.answer.status}${g.answer.detail ? ` (${g.answer.detail})` : ''}: ${siteLabel(g, 0)}`);
    }
    out.push('', `## What depends on this file (${data.dependents.length} found)`);
    for (const d of data.dependents.slice(0, opts.max)) out.push(`- ${d.cartridge}  ${d.file}${d.line ? `:${d.line}` : ''}  ${d.kind}`);
    if (data.dependents.length > opts.max) out.push(`- ${data.dependents.length - opts.max} more. Use --json or --max.`);
    if (!data.dependents.length) out.push('- None found by static search.');
    out.push('');
    return print(out, opts, data);
  }

  fail(`unknown command "${opts.command}". Run with --help.`);
}

main();
