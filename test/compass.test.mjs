import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPASS = path.resolve(HERE, '../src/compass.mjs');

function put(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function cartridge(root, repo, name, files) {
  const dir = path.join(root, repo, 'cartridges', name);
  put(path.join(dir, 'cartridge', `${name}.properties`), `demandware.cartridges.${name}.id=${name}\n`);
  for (const [rel, content] of Object.entries(files)) put(path.join(dir, rel), content);
}

const SFRA_BASE = "'use strict';\nvar server = require('server');\nserver.get('Show', function (req, res, next) { res.render('cart/cart'); next(); });\nserver.post('AddProduct', function (req, res, next) { next(); });\nmodule.exports = server.exports();\n";
const extend = (verb) => `'use strict';\nvar server = require('server');\nserver.extend(module.superModule);\nserver.${verb}('Show', function (req, res, next) { next(); });\nmodule.exports = server.exports();\n`;

/** A small estate: four cartridge repositories, one headless repository, five sites. */
function workspace({ sites = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-'));
  for (const repo of ['core', 'brand', 'legacy', 'integrations', 'web']) put(path.join(root, repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  cartridge(root, 'core', 'app_storefront_base', {
    'cartridge/controllers/Cart.js': SFRA_BASE,
    'cartridge/scripts/helpers/cartHelpers.js': 'module.exports = { total: function () {} };\n',
    'cartridge/templates/default/cart/cart.isml': '<isdecorate template="common/layout/page">cart</isdecorate>\n',
  });
  cartridge(root, 'brand', 'app_brand_core', {
    'cartridge/controllers/Cart.js': extend('append'),
    'cartridge/scripts/helpers/cartHelpers.js': "var base = module.superModule;\nmodule.exports = base;\n",
    'cartridge/scripts/hooks.json': JSON.stringify({ hooks: [{ name: 'dw.order.calculate', script: './hooks/calculate' }, { name: 'app.custom.event', script: './hooks/custom' }] }),
    'cartridge/scripts/hooks/calculate.js': 'exports.calculate = function () {};\n',
    'package.json': JSON.stringify({ hooks: './cartridge/scripts/hooks.json' }),
  });
  cartridge(root, 'brand', 'app_brand_a', {
    'cartridge/controllers/Cart.js': extend('prepend'),
    'cartridge/templates/default/cart/cart.isml': '<isinclude template="cart/promo"/>\n',
  });
  cartridge(root, 'brand', 'app_brand_b', {
    'cartridge/controllers/Cart.js': "'use strict';\nvar server = require('server');\nserver.get('MiniCart', function (req, res, next) { next(); });\nmodule.exports = server.exports();\n",
  });
  cartridge(root, 'legacy', 'app_storefront_controllers', {
    'cartridge/controllers/Cart.js': "var guard = require('~/cartridge/scripts/guard');\nvar app = require('~/cartridge/scripts/app');\nfunction show() { app.getView().render('cart'); }\nexports.Show = guard.ensure(['get'], show);\n",
    'cartridge/controllers/Old.js': "var guard = require('~/cartridge/scripts/guard');\nexports.Start = guard.ensure(['get'], function () {});\n",
  });
  cartridge(root, 'legacy', 'app_storefront_core', {
    'cartridge/pipelines/Old.xml': '<pipeline/>\n',
    'cartridge/pipelines/Wish.xml': '<pipeline/>\n',
  });
  cartridge(root, 'integrations', 'int_pay', {
    'cartridge/scripts/pay.js': "var cartHelpers = require('*/cartridge/scripts/helpers/cartHelpers');\nvar url = URLUtils.url('Cart-Show');\n",
    'cartridge/scripts/hooks.json': JSON.stringify({ hooks: [{ name: 'dw.order.calculate', script: './hooks/payCalculate' }] }),
    'cartridge/scripts/hooks/payCalculate.js': 'exports.calculate = function () {};\n',
    'cartridge/rest-apis/loyalty/schema.yaml': 'openapi: 3.0.0\n',
    'package.json': JSON.stringify({ hooks: './cartridge/scripts/hooks.json' }),
  });
  put(path.join(root, 'web', 'package.json'), JSON.stringify({ dependencies: { react: '^19', '@salesforce/storefront-next-runtime': '1.0.0', 'commerce-sdk-isomorphic': '^4' } }));
  put(path.join(root, 'core', 'dw.json'), '{ "password": "must-never-be-read" }');
  if (sites) {
    put(path.join(root, 'compass.sites.json'), JSON.stringify({ sites: [
      { id: 'A_US', cartridgePath: 'app_brand_a:app_brand_core:int_pay:app_storefront_base' },
      { id: 'A_UK', cartridgePath: ['app_brand_a', 'app_brand_core', 'int_pay', 'app_storefront_base'] },
      { id: 'B_DE', cartridgePath: 'app_brand_b:app_brand_core:app_storefront_base' },
      { id: 'L_FR', cartridgePath: 'app_storefront_controllers:app_storefront_core' },
      { id: 'X_IT', cartridgePath: 'vendor_x:app_brand_core:app_storefront_base' },
    ] }));
  }
  return root;
}

const run = (root, args) => execFileSync(process.execPath, [COMPASS, ...args, '--root', root], { encoding: 'utf8' });
const json = (root, args) => JSON.parse(run(root, [...args, '--json']));
const groupFor = (groups, site) => groups.find((g) => g.sites.includes(site));

test('overview finds repositories, architectures and gaps', () => {
  const root = workspace();
  const data = json(root, ['overview']);
  const arch = (name) => data.repositories.find((r) => r.name === name).architecture.map((a) => a.type);
  assert.equal(data.repositories.length, 5);
  assert.ok(arch('core').includes('sfra'));
  assert.ok(arch('legacy').includes('sgjc') && arch('legacy').includes('pipelines'));
  assert.ok(arch('web').includes('storefront-next'));
  assert.ok(arch('integrations').includes('scapi-custom-api'));
  assert.equal(data.sites.count, 5);
  assert.deepEqual(data.onPathNotLocal, ['vendor_x']);
  assert.ok(data.gaps.some((g) => /Business Manager/.test(g)));
});

test('a route resolves differently per site and identical sites are grouped', () => {
  const root = workspace();
  const { groups } = json(root, ['resolve', '--route', 'Cart-Show']);
  const a = groupFor(groups, 'A_US');
  assert.deepEqual(a.sites, ['A_US', 'A_UK']);
  assert.equal(a.answer.verdict, 'chain');
  assert.deepEqual(a.answer.chain.map((l) => [l.cartridge, l.defs[0].verb]), [['app_brand_a', 'prepend'], ['app_brand_core', 'append'], ['app_storefront_base', 'get']]);
  const b = groupFor(groups, 'B_DE').answer;
  assert.equal(b.verdict, 'error at runtime', 'a file without the action and without extend does not fall through');
  assert.deepEqual(b.shadowed, ['app_brand_core', 'app_storefront_base']);
  const legacy = groupFor(groups, 'L_FR').answer;
  assert.equal(legacy.verdict, 'single file');
  assert.equal(legacy.chain[0].style, 'sgjc');
  const x = groupFor(groups, 'X_IT').answer;
  assert.deepEqual(x.missingLeft, ['vendor_x']);
  assert.ok(x.notes.some((n) => /vendor_x/.test(n)), 'a cartridge missing from the scan is called out');
});

test('controllers beat pipelines and pipelines are used only without a controller', () => {
  const root = workspace();
  assert.equal(groupFor(json(root, ['resolve', '--route', 'Wish-Start', '--site', 'L_FR']).groups, 'L_FR').answer.verdict, 'pipeline');
  const old = groupFor(json(root, ['resolve', '--route', 'Old-Start', '--site', 'L_FR']).groups, 'L_FR').answer;
  assert.equal(old.chain[0].cartridge, 'app_storefront_controllers');
});

test('templates and modules resolve per site', () => {
  const root = workspace();
  const tpl = json(root, ['resolve', '--template', 'cart/cart']).results[0].groups;
  assert.equal(groupFor(tpl, 'A_US').answer.winner.cartridge, 'app_brand_a');
  assert.equal(groupFor(tpl, 'B_DE').answer.winner.cartridge, 'app_storefront_base');
  const mod = json(root, ['resolve', '--file', 'scripts/helpers/cartHelpers.js', '--site', 'A_US']).results[0].groups[0].answer;
  assert.equal(mod.winner.cartridge, 'app_brand_core');
  assert.equal(mod.winnerUsesSuperModule, true);
});

test('hooks are listed in path order per site', () => {
  const root = workspace();
  const point = json(root, ['hooks', '--point', 'dw.order.calculate']).points[0];
  assert.equal(point.kind, 'system');
  assert.deepEqual(groupFor(point.groups, 'A_US').answer.map((r) => r.cartridge), ['app_brand_core', 'int_pay']);
  assert.deepEqual(groupFor(point.groups, 'B_DE').answer.map((r) => r.cartridge), ['app_brand_core']);
  assert.deepEqual(groupFor(point.groups, 'L_FR').answer, []);
  assert.match(run(root, ['hooks', '--point', 'app.custom.event']), /script not found/);
});

test('impact reports site scope, shadowing and dependents', () => {
  const root = workspace();
  const base = json(root, ['impact', path.join(root, 'core/cartridges/app_storefront_base/cartridge/scripts/helpers/cartHelpers.js')]);
  assert.deepEqual(base.sitesIncluding, ['A_US', 'A_UK', 'B_DE', 'X_IT']);
  assert.equal(base.groups[0].answer.status, 'runs as base');
  assert.ok(base.dependents.some((d) => d.cartridge === 'int_pay' && d.kind === 'requires it'));
  const ctrl = json(root, ['impact', path.join(root, 'brand/cartridges/app_brand_core/cartridge/controllers/Cart.js')]);
  assert.equal(groupFor(ctrl.groups, 'B_DE').answer.status, 'shadowed');
  assert.equal(groupFor(ctrl.groups, 'A_US').answer.status, 'runs as base');
  assert.ok(ctrl.dependents.some((d) => /references its routes/.test(d.kind)));
  const hook = json(root, ['impact', path.join(root, 'integrations/cartridges/int_pay/cartridge/scripts/hooks/payCalculate.js')]);
  assert.ok(hook.dependents.some((d) => /hook implementation for dw.order.calculate/.test(d.kind)));
});

test('without site configuration nothing is guessed', () => {
  const root = workspace({ sites: false });
  const text = run(root, ['resolve', '--route', 'Cart-Show']);
  assert.match(text, /NOT CONFIGURED/);
  assert.match(text, /precedence unknown/);
  const data = json(root, ['overview']);
  assert.equal(data.sites.count, 0);
  assert.ok(data.gaps.some((g) => /not configured/.test(g)));
  assert.match(run(root, ['resolve', '--route', 'Cart-Show', '--path', 'app_brand_core:app_storefront_base']), /Result: chain/);
});

test('site.xml is used when no sites file exists', () => {
  const root = workspace({ sites: false });
  put(path.join(root, 'core/sites/site_template/sites/Shop_US/site.xml'), '<site><custom-cartridges>app_brand_core:app_storefront_base</custom-cartridges></site>');
  const data = json(root, ['sites']);
  assert.equal(data.source, 'site.xml files in the scanned code');
  assert.equal(data.sites[0].id, 'Shop_US');
  assert.equal(run(root, ['sites', '--export', 'Shop_US']).trim(), 'app_brand_core:app_storefront_base');
});

test('credential files are never read and nothing is written', () => {
  const root = workspace();
  const before = fs.readdirSync(root).sort();
  const all = ['overview', 'sites', 'hooks'].map((c) => run(root, [c])).join('\n') + run(root, ['resolve', '--route', 'Cart-Show']);
  assert.ok(!all.includes('must-never-be-read'));
  assert.deepEqual(fs.readdirSync(root).sort(), before);
});

test('bad input fails with exit code 2 and a clear message', () => {
  const root = workspace();
  for (const args of [['resolve'], ['resolve', '--route', 'Cart'], ['impact'], ['nope'], ['sites', '--export', 'Missing']]) {
    assert.throws(() => execFileSync(process.execPath, [COMPASS, ...args, '--root', root], { encoding: 'utf8', stdio: 'pipe' }), (err) => err.status === 2 && /compass:/.test(err.stderr));
  }
});

test('resolve --file accepts cartridge-relative, repo-relative and absolute paths', () => {
  const root = workspace({ sites: false });
  const rel = 'cartridge/controllers/Cart.js';
  const forms = [
    'controllers/Cart.js',
    rel,
    'core/cartridges/app_storefront_base/' + rel,
    path.join(root, 'core/cartridges/app_storefront_base', rel),
  ];
  for (const form of forms) {
    const text = run(root, ['resolve', '--file', form]);
    assert.match(text, /Contained in: .*app_storefront_base/, form);
    assert.doesNotMatch(text, /no scanned cartridge/, form);
  }
});

test('an unknown route says not found', () => {
  const root = workspace({ sites: false });
  const text = run(root, ['resolve', '--route', 'Nope-Show']);
  assert.match(text, /Result: not found/);
  assert.match(text, /No controllers\/Nope\.js/);
});
