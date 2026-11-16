# Versions and upgrading

## Versions

One version number covers the package, the Claude Code plugin manifest and every skill. It is in `package.json`, `.claude-plugin/plugin.json` and the `metadata.version` of each `SKILL.md`.

| Change | Version bump |
|---|---|
| A skill removed or renamed, a script command or option removed, output a skill depends on changed | Major |
| A new skill, command, option or agent | Minor |
| Corrections and fixes | Patch |

## Upgrading

```bash
git -C /path/to/cartridge-compass-skills pull
cd /path/to/your/project
node /path/to/cartridge-compass-skills/install.mjs --agent claude
```

The installer replaces each installed skill folder with the new version. Start a new agent session afterwards.

If you edited an installed skill, your edits are replaced. Keep project-specific rules in your own `AGENTS.md` or `CLAUDE.md`, not in the installed skills.

Your `compass.sites.json` is never touched.

## Coming from the open-source Cartridge Compass kit

The two can be used together. The kit generates project documentation and Claude Code permissions. The skills answer questions on demand in any agent. The script reads the kit's `docs/ai/site-map.json` as it is, so no site configuration needs to be repeated.

## Rolling back

Check out the previous tag in the package folder and run the installer again.
