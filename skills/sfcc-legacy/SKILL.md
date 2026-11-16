---
name: sfcc-legacy
description: Work safely in legacy Salesforce B2C Commerce (SFCC) code: SiteGenesis JavaScript Controllers (SGJC, guard.ensure, app.getView, app.getModel, app.getForm), pipelines (XML flows, pipelets, .ds scripts), and hybrid projects where SiteGenesis and SFRA cartridges share a site path. Covers reading and changing SGJC code without applying SFRA patterns, deciding which implementation is live when both exist, proving whether legacy code is still reachable before removing it, and planning migration. Use when a file uses guard or the app facade, lives in app_storefront_controllers, app_storefront_core or a pipelines folder, or when the user mentions SiteGenesis, SGJC, pipelines, legacy controllers, hybrid, migration to SFRA, or dead code cleanup.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Legacy and hybrid SFCC code

SiteGenesis controllers, pipelines and SFRA are three different architectures that can sit on one cartridge path. Applying the rules of one to another produces code that looks right and does not run.

## Identify what you are looking at

| You see | It is |
|---|---|
| `exports.Show = guard.ensure(['get'], show)` and `app.getView()`, `app.getModel()`, `app.getForm()` | SiteGenesis controller (SGJC) |
| `cartridge/pipelines/*.xml`, `.ds` files | Pipeline and pipelets |
| `require('server')`, `server.get`, `module.exports = server.exports()` | SFRA |
| `exports.X.public = true` without `server` or `guard` | Classic controller |

Decide per file. One cartridge can contain more than one style.

## Changing SiteGenesis controllers

- Routes are `Controller-Function`. A function becomes a route when it is exported through `guard`. The conditions (`get`, `post`, `https`, `loggedIn`) are defined in the project's own `scripts/guard.js`, so read that file for what each one enforces.
- `app.js` is a facade that returns models, views and forms. Much of the logic and most templates traditionally live in `app_storefront_core`.
- There is no `server.extend`. Projects usually customize by copying a controller into a cartridge further left, which replaces the lower file completely. Check whether this project does that or uses `module.superModule`, which is a platform feature and may be used in any module.
- Do not introduce `server`, middleware chains, `res.render` or `res.json` into an SGJC controller.
- Follow the patterns in the neighboring legacy files, including how they render and how they handle forms and transactions.
- Verify every `dw.*` API before copying it from old code. Existing usage proves the API exists, not that it is current. Deprecations are marked in the Script API reference (`b2c docs read <Class>`). Use the sfcc-verify-api skill.

## Pipelines

- Pipelines are XML flows. Do not hand-edit pipeline XML unless the user explicitly asks. They are normally changed in a visual editor and small text edits can corrupt them.
- Controllers have no access to the Pipeline Dictionary. Logic moved from a pipeline to a controller must pass data explicitly.
- Route naming as `Pipeline-StartNode` is an assumption here. Confirm in the pipeline file.

## Which implementation is live in a hybrid

The platform picks a file first and a function second:

1. It searches the whole cartridge path for `controllers/<Name>.js`. The first one wins, whether it is SiteGenesis or SFRA.
2. It does not check that the file has the requested function. If it does not, the request fails. It does not fall through to another cartridge.
3. Only when no controller of that name exists anywhere on the path does it look for `pipelines/<Name>.xml`. So a controller far to the right beats a pipeline far to the left.

Use the sfcc-what-runs skill to get this per site. When a legacy cartridge and its `_sfra` variant are both on a path, the one further left wins for files both provide. Hooks from both run.

Before changing legacy code, confirm it is the live implementation for at least one site, and say so. If an SFRA implementation is live for the target site, the change belongs there.

## Is this legacy code still reachable?

Never delete or "clean up" legacy code on the strength of its name. Work through [references/reachability.md](references/reachability.md) and record a status with evidence:

| Status | Meaning |
|---|---|
| `active` | Live for at least one site |
| `replaced-still-referenced` | Shadowed everywhere, but something still points at it |
| `replaced-unreferenced` | Shadowed everywhere and nothing found pointing at it |
| `unknown` | Evidence incomplete. List what is missing |

Only `replaced-unreferenced`, confirmed by the team, is a removal candidate.

## Migration planning

- List every crossing between architectures: an SFRA file that requires a core script, a `*/cartridge/...` require that resolves into the other style.
- Migrate by route or feature, and re-run sfcc-what-runs after each step to confirm which copy is live per site.
- New API work goes to SCAPI. OCAPI is deprecated.
