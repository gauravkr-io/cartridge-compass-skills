# Contributing

This is a commercially licensed product. Bug reports, corrections and suggestions are welcome. Code contributions are accepted by agreement only, so open an issue before sending a pull request.

## Ground rules

1. **No organization-specific content.** No company, realm, site, cartridge, instance or person names. Use placeholders such as `Shop_US` and `app_brand_core`.
2. **No secrets**, not even realistic-looking fake ones.
3. **Evidence for platform claims.** Every statement about how Salesforce B2C Commerce behaves needs an official source: Salesforce documentation or the official B2C Developer Tooling repository.
4. **Never guess.** A value that cannot be discovered is reported as unknown. Add a test proving it.
5. **Read-only.** The script never writes files, never reads credential files and never uses the network.
6. **Writing style.** Plain, precise English. No em dashes and no semicolons in prose.

## Reporting a problem

Open an issue with the command you ran, what you expected and what you got. Remove project names from the output first. For a wrong platform rule, include the source that shows the correct behavior.

## Common changes

| Change | Steps |
|---|---|
| Change the script | Edit `src/compass.mjs`, run `npm run build` to copy it into the skills, add a test in `test/compass.test.mjs` |
| Change a skill | Edit `skills/<name>/SKILL.md`. Keep the body under 500 lines and the description under 1,024 characters. Add a prompt to `evals/triggers.json` when the trigger conditions change |
| Add a skill | Create `skills/<name>/SKILL.md` with the same frontmatter, add trigger prompts, add it to the README table. Add the name to `SCRIPT_SKILLS` in `scripts/build.mjs` if it runs the script |
| Support another agent | Add its folders to `TARGETS` in `install.mjs`, with a link to that agent's documentation in the pull request |

## Tests

```bash
npm run check
```

Runs the build, the validator and all tests. Tests must not touch the network or real project folders.

## Releases

1. Update `CHANGELOG.md`.
2. Set the same version in `package.json`, `.claude-plugin/plugin.json` and the `metadata.version` of every skill. The validator checks that they match.
3. Run `npm run check`, then tag `vX.Y.Z`.
