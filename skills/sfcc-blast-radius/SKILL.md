---
name: sfcc-blast-radius
description: Work out what a code change will affect in a Salesforce B2C Commerce (SFCC) project before making it. Reports which sites and brands include the cartridge, on which sites the file is active, shadowed or running as a base, and what depends on it (requires, template includes, route references, hook and job step registrations). Use before editing a shared, core, base or integration cartridge, anything in checkout, payment, basket, order or pricing, a hooks.json, a job step, a service or metadata, when the user asks "what breaks if I change this", "which sites does this affect", "is it safe to change", or when reviewing a pull request that touches shared code.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Blast radius before a change

A cartridge named after one brand is often on the path of other brands. A file can be active on one site, shadowed on another and a base for a third. Measure before editing.

## Running the compass script

This skill bundles `scripts/compass.mjs`. It needs Node.js 18 or newer, has no dependencies, never writes files, never reads `dw.json` or other credential files and never contacts an instance.

Run it from the workspace root. `<skill>` below is the folder that contains this SKILL.md:

```bash
node <skill>/scripts/compass.mjs <command> --root .
```

When several repositories sit side by side, use the folder that contains them as `--root`, or repeat `--root` once per repository. Add `--json` for structured output.

## Steps

1. Run the impact command on each file you intend to change:

   ```bash
   node <skill>/scripts/compass.mjs impact path/to/cartridge/scripts/helpers/cartHelpers.js
   ```

2. Read the site scope:

   | Status | Meaning |
   |---|---|
   | `active` | This copy is the one the platform uses on those sites |
   | `runs as base` | A copy further left extends it through `module.superModule`, so your change still runs there |
   | `shadowed` | A copy further left replaces it. Your change has no effect on those sites |
   | on no configured path | Business Manager, job-only or unused. Confirm which before assuming no effect |

3. Read the dependents. For each one decide whether your change alters what it receives.
4. Check what static search cannot see. Ask about, or search for:
   - hooks registered by other cartridges for the same extension point (`compass.mjs hooks --point <name>`)
   - `server.append` on a route whose original chain calls a service or third party, which would now run twice
   - references from Business Manager configuration, content assets, Page Designer data, job definitions and other repositories
   - a headless storefront that calls a custom API or relies on a hook in this cartridge
5. Write the impact statement before the change.

## Impact statement

```text
Change: <file> in <cartridge> (<repository>)
Sites reached: <n of m>, <which>            Sites where it has no effect: <which, and why>
Depends on it: <files and how>
Not verified: <what static search cannot see for this change>
Risk: low | medium | high, because <reason>
Smallest safe option: <edit here | extend from a site cartridge | guard by an existing site preference>
```

## Choosing where the change belongs

- Behavior wanted on one site only does not belong in a cartridge that reaches every site. Put it in that site's cartridge, or behind a site preference the project already uses.
- A change wanted everywhere belongs in the shared cartridge, and the statement must list every site it reaches.
- If the file is shadowed on the site the user cares about, the change belongs in the shadowing copy. Use the sfcc-what-runs skill to find it.

## Rules

- Only list dependents you actually found. Absence in the output is not proof of absence.
- If cartridge paths are not configured, say that site scope is unknown. Do not estimate it from cartridge names.
- Never edit base SFRA (`app_storefront_base`) or the `modules` folder to make a change. Extend from a cartridge further left.
