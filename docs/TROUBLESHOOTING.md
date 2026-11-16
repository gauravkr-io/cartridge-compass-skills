# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The agent does not use a skill | The session started before the install, or the skills are in a folder this agent does not read | Start a new session. Check the folder table in SETUP.md |
| Every skill appears twice | Installed into two folders the same agent reads | Uninstall from one: `install.mjs --agent <name> --uninstall` |
| A skill is missing in GitHub Copilot | The folder name and the `name` in `SKILL.md` differ | Do not rename skill folders. Reinstall |
| `Cartridge paths: NOT CONFIGURED` | No sites file and no `site.xml` found | Add `compass.sites.json` (SETUP.md step 6) or pass `--path` |
| `0 repositories` or `0 cartridges` | `--root` points at the wrong folder | Pass the folder that contains your repositories |
| A cartridge is not detected | It has no `.project` file, no `<name>.properties` and no standard folder under `cartridge/` | Check that the folder has a `cartridge` subfolder with code in it |
| "On a site path but not in the scanned code" | That cartridge lives in a repository that was not scanned | Add its folder with another `--root`, or accept the stated uncertainty |
| "Cartridge names found more than once" | Two folders have the same cartridge name, for example a vendored copy | Narrow `--root` to the copy that is deployed |
| `impact`: "is not inside a scanned cartridge" | The file is outside every `--root` | Pass `--root` for the folder that contains it |
| The scan stopped after 60,000 files | A very large workspace | Pass narrower `--root` folders |
| `skipped <skill>: a different skill with this name is already there` | A skill with the same name from another source | Rename or remove the other skill, or install with `--skills` |
| The script fails with a syntax error | Node.js older than 18 | `node --version`, then upgrade |
