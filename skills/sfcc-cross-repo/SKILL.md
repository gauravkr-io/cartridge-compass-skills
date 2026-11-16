---
name: sfcc-cross-repo
description: Reason across several repositories in a Salesforce B2C Commerce (SFCC) project: storefront cartridges, shared or core cartridges, integration cartridges, legacy code, build and deployment repositories, and a headless storefront (PWA Kit or Storefront Next) that depends on hooks and SCAPI custom APIs implemented in cartridge repositories. Use when a task spans more than one repository, when the code you need is not in the current repository, when a headless front end and SFCC back end must change together, when the user asks "which repo owns this", "where is this implemented", "what does the storefront depend on in the back end", or when setting up a repository map for a team.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Work across repositories

The repository you are in is rarely the whole SFCC system. Cartridges from several repositories are combined on one cartridge path, and a headless storefront depends on server-side code it does not contain.

## Running the compass script

This skill bundles `scripts/compass.mjs`. It needs Node.js 18 or newer, has no dependencies, never writes files, never reads `dw.json` or other credential files and never contacts an instance.

Run it from the folder that contains the repositories. `<skill>` below is the folder that contains this SKILL.md:

```bash
node <skill>/scripts/compass.mjs overview --root .
```

Repeat `--root` once per repository when they are not side by side.

## First establish the map

1. Run the overview from the folder that holds the repositories. It lists each repository, its cartridges and its detected architecture.
2. If the project has a repository map, read it. A statement in it wins over detection. If it has none and the task is more than a one-off, offer to create one from [assets/repositories.template.md](assets/repositories.template.md). The file belongs to the team. Propose edits, do not rewrite their entries.
3. Check the overview for cartridges that are "on a site path but not in the scanned code". Those live in a repository you do not have. Name them and ask where they are before drawing conclusions that depend on them.

## Questions to answer before editing

| Question | Where the answer comes from |
|---|---|
| Which repository owns this cartridge? | Overview, repository map |
| Which sites combine cartridges from which repositories? | `compass.mjs sites`, site configuration |
| Is the cartridge shared by sites of other brands? | sfcc-blast-radius |
| Is the same file provided by a cartridge in another repository? | sfcc-what-runs |
| Is this file built at deploy time or resolved at runtime? | The repository's `package.json` build configuration |
| Which repository deploys, and how? | Build or CI repository, the user |

## Headless storefront plus cartridges

A PWA Kit or Storefront Next repository calls SCAPI. It has no cartridge path, so cartridge precedence rules do not apply to its code. Its server-side behavior is in other repositories:

- **Hooks** on `dw.ocapi.shop.*` extension points change what Shopper APIs do. A hook that returns a value skips later registrations and the system implementation, which is a frequent cause of "the API returns the wrong totals and nothing errors".
- **SCAPI custom APIs** live in `cartridge/rest-apis/<name>/` with `schema.yaml`, `api.json` and a script. Shopper custom APIs are site-scoped and resolve on the site's cartridge path.

When a front-end change needs data or behavior the back end does not provide:

1. Find the cartridge repository that holds the hook or custom API (overview lists `api-hooks` and `scapi-custom-api`).
2. Plan both changes together and state the order of deployment. The back end usually ships first and must stay compatible with the storefront version already live.
3. Check per site that the cartridge with the hook or API is on that site's path.
4. For framework work in the storefront itself, use Salesforce's official `storefront-next` skills when they are installed.

In a hybrid storefront some URLs are served by the headless application and others by SFRA or SiteGenesis. Establish which side serves the page before changing anything.

## Rules

- Never assume one repository equals one site, or one brand.
- A change to a shared cartridge ships to every site that includes it, whichever repository you opened.
- Keep changes that must ship together in one plan, with the repositories named.
- Do not copy code between repositories to avoid a dependency. Ask how the project shares code.
- Each repository has its own conventions, build and tests. Read them per repository.
- Run `b2c` commands from the folder that holds the intended `dw.json`, or pass `--config`. The CLI searches upward for it, so a repository with its own `dw.json` can point at a different instance.
