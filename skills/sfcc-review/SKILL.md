---
name: sfcc-review
description: Review Salesforce B2C Commerce (SFCC) code changes for the mistakes that are specific to the platform: edits to the copy of a file that does not run, changes to shared cartridges that reach unintended sites, server.replace that drops security middleware, hooks that return a value and silence later hooks, double side effects from server.append, unverified or deprecated dw.* APIs, new OCAPI usage, edits to base or vendor cartridges, hardcoded site values and exposed credentials. Use when reviewing a pull request, a diff or a proposed change in an SFCC project, when the user asks "review this", "is this change safe", "check my SFRA code", or before approving your own change.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Review an SFCC change

A general code review misses the failures that are particular to SFCC. Run this checklist in addition to normal review, and report findings with file, line, the rule and the evidence.

## 1. Is the change in code that runs?

- For every changed controller, template, script or model that exists in more than one cartridge, confirm with the sfcc-what-runs skill that the changed copy is live on the intended sites.
- A new controller file that does not call `server.extend(module.superModule)` hides every route of the lower controllers with the same name. Flag it unless that is the stated intent.
- A changed file that is shadowed on the target site is a finding, even if the code is correct.

## 2. Does it reach only the intended sites?

- For changes in shared, core, base, integration or brand-named cartridges, get the site scope from the sfcc-blast-radius skill.
- Site-specific values (site IDs, locales, currencies, country logic) inside a cartridge that reaches other sites are a finding. They belong in a site cartridge or a site preference.

## 3. SFRA route changes

| Pattern in the diff | Check |
|---|---|
| `server.replace` | It drops every middleware of the base route, including CSRF, login and HTTPS checks and the GET or POST restriction. Compare with the base route and require the ones still needed |
| `server.append` | The original chain still runs. If it calls a service, sends an email, or writes data, that now happens as before plus the new step. Confirm no doubled side effect |
| A security check added with `append` | It runs after the handler and protects nothing. It must be `prepend` or part of a replaced chain |
| A POST route without CSRF protection | Finding |
| Middleware step without `next()` on every path | Finding |
| Changed or removed `pdict` or view data keys | Search templates and client code that read them |

## 4. Hooks

- A system hook (`dw.*`) that returns a value skips later registrations for that extension point and the system implementation. For basket and order hooks this can silently stop calculation. Flag every new `return` in a hook and ask whether stopping is intended.
- List other cartridges that register the same extension point on the affected sites (`compass.mjs hooks --point <name>` from the sfcc-what-runs skill) and consider order.
- A `hooks.json` entry must point at a script that exists, and the cartridge's `package.json` must reference the `hooks.json`.

## 5. Platform APIs

- Every `dw.*` class or method that is new to the project must be verified, and anything copied from old code checked for deprecation (sfcc-verify-api).
- New OCAPI endpoints, settings or client calls need explicit agreement. OCAPI is deprecated. Ask for the SCAPI equivalent.
- For SCAPI custom APIs check that `schema.yaml`, `api.json` and the implementing script agree, and that the script export is marked public.

## 6. Protected and generated code

- Edits inside `app_storefront_base` or the `modules` folder: finding. Extend from another cartridge.
- Edits inside vendor or LINK cartridges the project does not own: confirm ownership first.
- Hand edits to compiled output under `cartridge/static`: finding. Change the source.
- Hand-edited pipeline XML: confirm it was intended.

## 7. Data, configuration and secrets

- Metadata, services, job definitions and preferences changed with the code must ship together. Ask how they are deployed.
- No credentials, tokens, client secrets or customer data in code, logs, comments or test fixtures. A `dw.json` or `.env` in the diff is a blocking finding.
- Logging must not print full request bodies, payment data or personal data.

## 8. Use the official scanner when available

When the Salesforce B2C CLI has `b2c security scan` (preview), run it on the changed cartridges and include its findings. It checks route protection using the same project index as `b2c project`.

## Reporting

Order findings by consequence: wrong sites affected, security, silent behavior change, then maintainability. For each: what, where, why it matters on this platform, and the smallest fix. State what you could not check, such as instance configuration or code in repositories you do not have.
