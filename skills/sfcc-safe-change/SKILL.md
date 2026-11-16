---
name: sfcc-safe-change
description: Plan and make a code change in a Salesforce B2C Commerce (SFCC) project the safe way. Gives the ordered checks to run before writing code, the priority between project conventions and official guidance, the correct SFRA extension pattern (extend, append, prepend, replace, superModule, template override), and how to validate. Use when implementing a feature, fixing a bug, adding or overriding a controller, route, model, script, template, hook or form in an existing SFCC codebase, or when the user asks "where should this code go", "how do I override this", "add this to checkout", or "fix this in the storefront".
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Make a safe change in an SFCC project

Most bad SFCC changes are correct code in the wrong place: the wrong cartridge, the copy that does not run, a new helper beside an existing one. Work through the questions first. The code is the short part.

## Before writing code

Answer these in order. Skip none. Write "unknown" where you cannot answer and say how that limits the change.

1. Which repository and cartridge am I in, and what do they own? (sfcc-orient)
2. Which architecture does the file use: SFRA, SiteGenesis controllers, pipelines, or a headless storefront? Decide from the file, not from the project name.
3. Which sites does this cartridge reach? (sfcc-blast-radius)
4. Which copy of the file actually runs on the site in question? (sfcc-what-runs)
5. Does the project already have this? Search for an existing helper, model, service, middleware, hook, template, form or test before creating one.
6. What conventions does the project follow here: naming, logging, error handling, where site-specific code lives?
7. Which platform APIs do I need, and are they verified and current? (sfcc-verify-api)
8. What is the smallest change that does the job?
9. How will I validate it?

## Priority when sources disagree

1. What the user or the project documentation says about this project
2. The existing architecture
3. Existing implementation patterns in the same area
4. Official Salesforce guidance
5. General best practice

Do not replace a deliberate project design because another looks cleaner. If you believe the project pattern is harmful, make the change the project way and raise the concern separately as a proposal.

## Where the code goes

- New behavior for one site or brand goes in that site's or brand's cartridge.
- New behavior for every site goes in the shared cartridge the project uses for that purpose. Name it in your plan and let the user confirm when the project has several.
- Never edit `app_storefront_base` or the `modules` folder. Salesforce guarantees backward compatibility for base only while it is unmodified.
- Do not edit vendor or LINK cartridges the project does not own. Extend from a project cartridge further left. Do not assume every `int_*` cartridge is vendor code. Ask.
- Do not edit generated output, such as compiled files under `cartridge/static`. Change the source and rebuild.

## Choosing the SFRA pattern

| Goal | Pattern | Watch for |
|---|---|---|
| Add data to an existing route | `server.extend(module.superModule)` then `server.append` | The original chain still runs. Service calls and other side effects in it are not skipped |
| Run a check before an existing route | `server.prepend` | |
| Change what a route does, or stop its service call | `server.replace` | It drops everything from the base route, including CSRF, login and HTTPS checks and the GET or POST restriction. Repeat the middleware you still need |
| Change a script or model | Same relative path in a cartridge further left, starting from `module.superModule` | Without `superModule` you replace the lower file entirely |
| Change markup | Template with the same name and relative location further left | Do not rename or remove `pdict` variables other code reads |
| React to a platform event | A hook registration | Other cartridges may register the same point. A returned value from a system hook skips later registrations and the system implementation |

A controller file that does not call `server.extend(module.superModule)` hides every route of the lower controllers, including routes it does not define. Details and examples: [references/extension-patterns.md](references/extension-patterns.md).

For SiteGenesis controllers or pipelines, stop and use the sfcc-legacy skill. SFRA patterns do not work there.
For a headless storefront, use the sfcc-cross-repo skill. Cartridge rules do not apply to React code.

## Validate

- Run the project's own lint, unit tests and build, using the commands in its `package.json`. Do not invent commands.
- Re-run sfcc-what-runs for the route or file you changed and confirm your copy is in the result for the intended sites.
- Deploying, activating a code version, importing data and running jobs change an instance. Follow the sfcc-instance-safety skill and ask first.

## Report

Say what changed and in which cartridge, which sites it reaches, which existing code you reused, what you verified and what you could not.
