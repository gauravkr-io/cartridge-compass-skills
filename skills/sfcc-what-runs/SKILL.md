---
name: sfcc-what-runs
description: Find which code actually runs in a Salesforce B2C Commerce (SFCC) project, per site, when several cartridges provide the same thing. Resolves a controller route (Cart-Show), a template, a script or model module, and hook registrations against the cartridge path of every site at once, and groups sites that share the same answer. Use when the user asks "which Cart-Show runs on site X", "why is my override or change not taking effect", "which cartridge wins", "does this differ between sites or brands", "which hooks run for this extension point", "is this template overridden", or before editing any controller, template, script or hook that exists in more than one cartridge.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# What runs, on which site

In SFCC the same file name can exist in many cartridges, and each site has its own cartridge path. The answer to "which code runs" is therefore a per-site answer. Editing the copy that does not run is the most common wasted change in SFCC work.

## Running the compass script

This skill bundles `scripts/compass.mjs`. It needs Node.js 18 or newer, has no dependencies, never writes files, never reads `dw.json` or other credential files and never contacts an instance.

Run it from the workspace root. `<skill>` below is the folder that contains this SKILL.md:

```bash
node <skill>/scripts/compass.mjs <command> --root .
```

When several repositories sit side by side, use the folder that contains them as `--root`, or repeat `--root` once per repository. Add `--json` for structured output.

## Commands

```bash
node <skill>/scripts/compass.mjs resolve --route Cart-Show
node <skill>/scripts/compass.mjs resolve --template checkout/cart
node <skill>/scripts/compass.mjs resolve --file scripts/helpers/cartHelpers.js
node <skill>/scripts/compass.mjs hooks --point dw.order.calculate
```

Add `--site A,B` to limit the sites, or `--path a:b:c` to test one explicit cartridge path.

Sites with an identical answer are grouped, so a 20-site estate reads as a few lines. A group that differs from the rest is usually the finding the user needs.

## Reading a route result

| Result | Meaning | What to do |
|---|---|---|
| `single file` | One controller file serves the route | Edit that file, or extend it from a cartridge further left |
| `chain` | Several files contribute through `server.extend(module.superModule)` | Read every file in the chain, top to bottom, before changing any |
| `error at runtime` | The leftmost file with that controller name does not define the action and does not extend | The platform selected a file by name and does not fall through. This is usually the bug |
| `pipeline` | No controller of that name exists on the path, so a pipeline serves it | Use the sfcc-legacy skill |
| `not determined` | Route names are computed in code | Read the file |
| `precedence unknown` | No cartridge path is configured | List the candidates and ask for the path. Do not pick one |

A note that cartridges are "not in the scanned code, left of the result" means the answer may be wrong for that site. Say so.

## Going deeper with the official tooling

When the Salesforce B2C CLI is installed and has the `project` commands (preview), use it for the full middleware chain, route events and hook return behavior. It works on one cartridge path at a time, so feed it each site's path:

```bash
SFCC_CARTRIDGES="$(node <skill>/scripts/compass.mjs sites --export Shop_US)" b2c project endpoints get Cart-Show --json
SFCC_CARTRIDGES="$(node <skill>/scripts/compass.mjs sites --export Shop_US)" b2c project hooks list dw.order.calculate
```

Run it once per distinct group from the compass output, not once per site. If `b2c project` is not available, the compass result stands by itself.

## Rules that decide the answer

The essentials. Full table with sources: [references/resolution-rules.md](references/resolution-rules.md).

- **Controllers**: the first `controllers/<Name>.js` on the path wins as a file. The platform does not check that it contains the requested function.
- **Pipelines** are reached only when no controller of that name exists anywhere on the path.
- **Templates and `*/cartridge/...` modules**: first match from the left.
- **`module.superModule`**: the next file with the same relative path to the right. Without it, lower copies are fully shadowed.
- **Hooks are not overrides.** For system extension points (`dw.*`) registrations run in path order and the first one that returns a value skips the rest and the system implementation. For custom extension points every registration runs.
- **Client JavaScript and SCSS** are resolved by the build, not by the cartridge path.

## Reporting

State the site or sites, the file path, the rule that made it win, and anything you could not verify. Never answer "the Cart controller" without naming the cartridge.
