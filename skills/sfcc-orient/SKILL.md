---
name: sfcc-orient
description: Map a Salesforce B2C Commerce (SFCC) workspace before working in it. Finds the repositories, the architecture of each one (SFRA, SiteGenesis controllers, pipelines, SCAPI custom APIs, PWA Kit, Storefront Next, integrations), the sites and cartridge paths that are configured, and what is NOT configured. Use at the start of any SFCC task in an unfamiliar project, when the user asks "what is this project", "is this SFRA or SiteGenesis", "which repo owns this", "how is this codebase structured", when onboarding a developer, or before a change that may touch more than one cartridge, site or repository.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Orient in an SFCC workspace

An SFCC project is rarely one repository with one architecture. Before reading code in depth, establish what exists and what is unknown. Do this once per session and reuse the result.

## Running the compass script

This skill bundles `scripts/compass.mjs`. It needs Node.js 18 or newer, has no dependencies, never writes files, never reads `dw.json` or other credential files and never contacts an instance.

Run it from the workspace root. `<skill>` below is the folder that contains this SKILL.md:

```bash
node <skill>/scripts/compass.mjs <command> --root .
```

When several repositories sit side by side, use the folder that contains them as `--root`, or repeat `--root` once per repository. Add `--json` for structured output.

## Steps

1. Run the overview:

   ```bash
   node <skill>/scripts/compass.mjs overview --root .
   ```

2. If the user has told you what a repository is, or the project has a mapping file (for example `docs/ai/repositories.md`), that statement wins over anything detected. Detection is evidence, not a verdict.
3. If the overview says cartridge paths are not configured, look for them in this order and stop at the first that works:
   - a site list the user can provide as JSON (see "Site configuration")
   - `sites/<site-id>/site.xml` in import data in the repositories, which the script reads by itself
   - `b2c sites cartridges list --site-id <id>` when the B2C CLI and a sandbox are available. It is read-only
   - ask the user to copy the paths from Business Manager
4. Write the orientation brief below into your reply before doing anything else.

## Orientation brief

Keep it short and separate facts from gaps:

```text
Repositories: <name> = <architecture> (configured | detected, confidence), ...
Sites: <count> from <source>   or   NOT CONFIGURED
Shared by every site: <cartridges>
Not in the scanned code: <cartridges on a path that are missing locally>
Unknown: <each gap, and how it limits the task>
```

## Reading the result

- **Confidence** is `high`, `medium` or `low`. High needs two independent strong signals. Treat `low` as a question for the user.
- **A repository can carry several architectures.** SFRA plus API hooks plus custom APIs in one repository is normal.
- **Headless repositories** (`storefront-next`, `pwa-kit`) have no cartridge path. Their server-side behavior lives in cartridges of other repositories. Use the sfcc-cross-repo skill.
- **"On a site path but not in the scanned code"** means part of the system is invisible to you. Any conclusion about precedence left of those cartridges is uncertain. Say so.
- **"In the code but on no configured path"** may be Business Manager extensions, job-only cartridges or dead code. Do not call it dead without the reachability checks in the sfcc-legacy skill.

## Site configuration

The script looks for `docs/ai/site-map.json` or `compass.sites.json` under a root, or takes `--sites <file>`:

```json
{ "sites": [ { "id": "Shop_US", "cartridgePath": "app_custom_shop:app_storefront_base" } ],
  "businessManager": { "cartridgePath": "bm_tools" } }
```

`cartridgePath` may be a colon-separated string or an array. `businessManager` is optional. Never invent a path to fill this file.

## Rules

- Never assume an SFCC project is SFRA. Decide from evidence.
- Never assume the repository you are in is the whole system.
- A missing value is unknown. Continue with what is known and name the conclusions that depend on the gap.
- Architecture signatures are in [references/architecture-signals.md](references/architecture-signals.md). Read it only when detection is unclear.
