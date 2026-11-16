# Changelog

## 1.0.2 (2026-11-16)

- License changed from MIT to a proprietary commercial license (all rights reserved). Individual and team licenses are described in `LICENSE.txt`.
- Copies obtained while version 1.0.1 was published under the MIT license keep the MIT terms for those copies. Version 1.0.2 onward is proprietary.
- SETUP and CONTRIBUTING restored to the commercial wording, and the skill metadata now reads `Proprietary`.

## 1.0.1 (2026-11-16)

Found by testing against a real SFRA repository.

- `resolve --file` now accepts a repo-relative path (`cartridges/app_x/cartridge/scripts/x.js`) or an absolute path as well as the cartridge-relative form. Before, those paths quietly returned "Contained in: no scanned cartridge".
- `resolve --route` for a controller that does not exist now says "not found" and names what was searched, instead of an empty "precedence unknown".

## 1.0.0 (2026-11-16)

First release.

- Nine skills in the open Agent Skills format: `sfcc-orient`, `sfcc-what-runs`, `sfcc-blast-radius`, `sfcc-safe-change`, `sfcc-legacy`, `sfcc-verify-api`, `sfcc-cross-repo`, `sfcc-review`, `sfcc-instance-safety`.
- `compass.mjs`, a read-only script with no dependencies, bundled in the four skills that need facts. Commands: `overview`, `sites`, `resolve`, `hooks`, `impact`. Answers are computed for every configured site and grouped.
- `install.mjs` for Claude Code, Cursor, GitHub Copilot and Codex, project or user scope, with uninstall and dry run.
- Optional always-on block for `AGENTS.md`.
- Claude Code plugin manifest, so the folder also works as a local plugin marketplace.
- Repository documentation: README, SETUP, CONTRIBUTING, SECURITY, architecture, troubleshooting and upgrading guides, and a CI workflow for Linux, Windows and macOS.
- Platform facts checked against Salesforce documentation and the official B2C Developer Tooling at commit `2149bff` (CLI 2.15.0), including the preview `b2c project` and `b2c security scan` commands.
