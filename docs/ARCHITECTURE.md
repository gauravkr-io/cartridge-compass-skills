# Architecture

How the package is built and why. For maintainers and for anyone evaluating it.

## Layout

```text
skills/<name>/SKILL.md       instructions an agent loads when a task matches
skills/<name>/scripts/       compass.mjs, copied into the skills that need facts
skills/<name>/references/    detail an agent reads only when needed
src/compass.mjs              the single source of the script
install.mjs                  copies skills into an agent's folder
scripts/build.mjs            copies src/compass.mjs and LICENSE.txt into the skills
scripts/validate.mjs         checks every skill against the Agent Skills specification
evals/triggers.json          prompts and the skill each one should load
test/                        script and installer tests
```

## Design decisions

### D1. Skills carry no project state

**Decision.** Nothing is generated into the project. Every answer is computed from source when it is asked for.

**Why.** Generated context goes stale and needs a setup step per project. A skill that works on first use, in any agent, is easier to adopt and cannot be out of date.

### D2. One script, bundled per skill

**Decision.** `compass.mjs` is one file with no dependencies, copied by the build into each skill that runs it.

**Why.** The Agent Skills format installs skills as independent folders. A skill that depends on a file in another skill breaks when it is installed alone. Duplication is the price, and the validator fails the build when a copy is stale.

### D3. Per-site answers, grouped

**Decision.** Every resolution runs against the cartridge path of every configured site, and sites with identical answers are reported together.

**Why.** In a multi-site project the correct answer to "which file runs" is a list. Grouping keeps twenty sites readable and makes the odd one out visible.

### D4. Never guess a cartridge path

**Decision.** Paths come from explicit input, a sites file, or `site.xml` in import data. With none of these the script lists candidates and says precedence is unknown.

**Why.** A guessed order produces a confident wrong answer, which is worse than no answer.

### D5. Say what is missing

**Decision.** Cartridges that are on a site path but not in the scanned code are named in every affected answer.

**Why.** A copy in a repository the agent cannot see may win. Hiding that would make the answer look complete when it is not.

### D6. Complement the official tooling

**Decision.** The skills use Salesforce's `b2c project` and `b2c docs` when they are installed and do not reimplement them.

**Why.** The official index traces middleware chains and hook behavior in more depth for one cartridge path. This package adds the dimensions it lacks: many sites, several repositories, change impact, legacy code and a verify-first workflow.

### D7. Portable by format, not by adapter

**Decision.** One set of `SKILL.md` files follows the open specification. The installer only chooses the destination folder per agent.

**Why.** Claude Code, Cursor, GitHub Copilot and Codex all read the same format. Per-agent variants would drift apart.

## Resolution rules implemented

| Artifact | Rule |
|---|---|
| Controller | First `controllers/<Name>.js` on the path wins as a file. A file that extends pulls in the next one to the right. No fall-through when the action is missing |
| Pipeline | Used only when no controller of that name is on the path |
| Template, script, model | First match from the left. Lower copies run only through `module.superModule` |
| Hooks | Every registration, in path order |

Sources are listed in `skills/sfcc-what-runs/references/resolution-rules.md`.

## Extension points

| To add | Where |
|---|---|
| A script command | `main()` in `src/compass.mjs`, a test, the command table in README |
| An architecture signal | `architectureOf()` in `src/compass.mjs` and `skills/sfcc-orient/references/architecture-signals.md` |
| An agent | `TARGETS` in `install.mjs` |
| A skill | See CONTRIBUTING.md |
