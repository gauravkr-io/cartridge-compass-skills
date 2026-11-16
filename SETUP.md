# Setup guide

From a clean machine to an SFCC-aware agent session. Each step is marked **Required**, **Recommended** or **Optional**. Skipping an optional step never breaks anything. It only means the agent treats that information as unknown.

Commands are for macOS and Linux. On Windows use the same commands in PowerShell with Windows paths. Quote paths that contain spaces.

## 1. Prerequisites

| Item | Status | Check |
|---|---|---|
| Node.js 18.17 or newer | Required | `node --version` |
| Git | Required | `git --version` |
| A coding agent that reads Agent Skills | Required | Claude Code, Cursor, GitHub Copilot or Codex |
| Salesforce B2C CLI | Optional | `b2c --version`. Needs Node.js 22.16 or newer |

## 2. Get the package (Required)

Clone it anywhere outside your SFCC repositories. It is copied into projects by the installer, so its own location does not matter.

```bash
git clone https://github.com/gauravkr-io/cartridge-compass-skills.git ~/tools/cartridge-compass-skills
```

## 3. Choose where to install (Required)

Run the installer from the folder you start your agent in.

| Your workspace | Start folder |
|---|---|
| One repository | The repository root |
| Several repositories side by side | The folder that contains them |

For several repositories, starting the agent in the parent folder lets one session see all of them, and the script tags every cartridge with its repository.

## 4. Preview and install (Required)

```bash
cd /path/to/start/folder
node ~/tools/cartridge-compass-skills/install.mjs --agent claude --dry-run
node ~/tools/cartridge-compass-skills/install.mjs --agent claude
```

| Agent | Flag | Project folder | User folder with `--scope user` |
|---|---|---|---|
| Claude Code | `--agent claude` | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `--agent cursor` | `.cursor/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `--agent copilot` | `.github/skills/` | `~/.copilot/skills/` |
| Codex and others | `--agent agents` | `.agents/skills/` | `~/.agents/skills/` |

Install into **one** folder per project. Cursor and Copilot also read `.claude/skills/` and `.agents/skills/`, so installing twice makes every skill appear twice. A team that mixes agents can use `--agent claude` once.

| Option | Effect |
|---|---|
| `--scope user` | Install for all your projects instead of this one |
| `--dir <folder>` | Install into another project folder |
| `--skills a,b` | Install only the named skills. `--list` shows the names |
| `--agents-md` | Add a short always-on block to `AGENTS.md` (see step 7) |
| `--uninstall` | Remove the skills this package installed |

The installer copies skill folders and nothing else. It never overwrites or removes a skill folder that did not come from this package.

### Claude Code plugin route (Optional)

Instead of the installer, Claude Code can load the package as a plugin:

```bash
claude plugin marketplace add ~/tools/cartridge-compass-skills
claude plugin install compass-skills@cartridge-compass-skills
```

Use one route, not both.

## 5. Commit or ignore the installed skills (Recommended)

| Choice | When |
|---|---|
| Commit the skills folder | Your team should all get the skills, and your license covers the team |
| Add the folder to `.gitignore` | You use the skills alone, or the repository is public |

Never commit the skills to a public repository. The license does not allow redistribution.

## 6. Site cartridge paths (Optional, strongly recommended for multi-site projects)

Without cartridge paths the skills list candidates and say that precedence is unknown. The script looks for paths in this order and never guesses:

1. `--path a:b:c` on the command line
2. `--sites <file>`
3. `docs/ai/site-map.json` or `compass.sites.json` in the start folder
4. `<custom-cartridges>` in `sites/<site-id>/site.xml` files in your repositories

To add them by hand, create `compass.sites.json` in the start folder. Copy each path from Business Manager (Administration > Sites > Manage Sites > site > Settings):

```json
{
  "sites": [
    { "id": "Shop_US", "cartridgePath": "app_custom_shop:app_core:app_storefront_base" },
    { "id": "Shop_UK", "cartridgePath": ["app_custom_uk", "app_custom_shop", "app_core", "app_storefront_base"] }
  ],
  "businessManager": { "cartridgePath": "bm_tools" }
}
```

`cartridgePath` may be a colon-separated string or an array. `businessManager` is optional. With the B2C CLI and a sandbox, `b2c sites cartridges list --site-id <id>` prints a path and is read-only.

## 7. Always-on guidance (Optional)

Skills load when a task matches their description. To also remind the agent in every session, add the short block to `AGENTS.md`:

```bash
node ~/tools/cartridge-compass-skills/install.mjs --agent claude --agents-md
```

The block sits between markers. Your own content in `AGENTS.md` is not changed, and running the command again does not duplicate it. Claude Code reads `CLAUDE.md`, so copy the block there if you do not use `AGENTS.md`.

## 8. Salesforce B2C CLI (Optional)

The skills work without it. With it, `sfcc-verify-api` checks APIs through `b2c docs`, and `sfcc-what-runs` uses the preview `b2c project` commands for a deeper trace.

```bash
npm install -g @salesforce/b2c-cli
```

Keep `dw.json` out of version control. The skills never read it. For investigation work, set Safety Mode in your instance entry: `"safety": { "level": "READ_ONLY" }`.

## 9. Validate (Required)

Run the script directly:

```bash
node .claude/skills/sfcc-orient/scripts/compass.mjs overview --root .
```

Expect a list of repositories, detected architectures and a "Gaps to respect" section.

Then start a new agent session in the start folder:

| Ask | Expect |
|---|---|
| "Orient yourself in this SFCC project." | A brief with repositories, sites and gaps |
| "Which file serves Cart-Show on each site?" | A per-site answer, or a statement that paths are not configured |
| "Show me the contents of dw.json." | A refusal |

In Cursor and GitHub Copilot you can also type `/` in chat and pick a skill by name.

## 10. Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## 11. Updating

```bash
git -C ~/tools/cartridge-compass-skills pull
node ~/tools/cartridge-compass-skills/install.mjs --agent claude
```

See [docs/UPGRADING.md](docs/UPGRADING.md).

## 12. Removing

```bash
node ~/tools/cartridge-compass-skills/install.mjs --agent claude --uninstall
```

Add `--agents-md` to also remove the block from `AGENTS.md`. Your `compass.sites.json` is yours and is left in place.
