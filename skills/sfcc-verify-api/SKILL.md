---
name: sfcc-verify-api
description: Stop invented or outdated platform usage in Salesforce B2C Commerce (SFCC) code. A verification protocol for dw.* Script API classes and methods, hook extension points, OCAPI and SCAPI endpoints, custom API contracts, metadata and import XML, Business Manager settings, cartridge paths and site IDs, with the OCAPI deprecation rule. Use before writing or approving code that calls a dw.* API, registers a hook, calls or defines an API endpoint, or writes metadata XML, when the user asks "does this API exist", "is this deprecated", "what is the SCAPI equivalent", or whenever you are about to rely on memory for an SFCC name, signature or setting.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Verify before you write

SFCC has many platform-specific names that look guessable and are not. A method that exists on one manager class often does not exist on its neighbor. Plausible is not verified.

## The rule

Never invent an SFCC API, class, method, hook, endpoint, metadata element, Business Manager setting, cartridge path, site ID, realm or instance URL. For each one you rely on, do one of three things: **verify it, state the uncertainty, or ask.**

## Verification ladder

Use the first tier that applies.

| Tier | Situation | How to verify | What it proves |
|---|---|---|---|
| 1 | The project already uses it the same way | Cite the file and line | That it exists. Not that it is current |
| 2 | A `dw.*` class or method not yet used here | `b2c docs read dw.catalog.ProductMgr` | Signature and deprecation status |
| 3 | An endpoint, hook, custom API rule or XML element | `b2c docs search "<topic>"`, `b2c docs schema <name>` | Official guide or schema |
| 4 | None of the above works | Say exactly: "This could not be verified from the project code or official Salesforce documentation." | Nothing. Do not write code that depends on it |

`b2c docs` is part of the Salesforce B2C CLI and reads documentation bundled with the CLI, so it works offline. If the CLI is not installed, use the official documentation at developer.salesforce.com, or tier 1, or tier 4. Do not fall back to memory and present it as fact.

## Exists is not the same as current

Old code is full of APIs that still work and are deprecated, for example `dw.svc.ServiceRegistry`. Before copying a tier 1 pattern into **new** code, check its deprecation status with tier 2. If it is deprecated, use the replacement the reference names and tell the user that existing usages remain.

## OCAPI and SCAPI

- OCAPI is deprecated as of April 2026. It keeps receiving security updates for a limited period and no new features.
- Do not add new OCAPI endpoints, OCAPI-only settings or new OCAPI client calls without the user's explicit agreement. Propose the SCAPI equivalent. Salesforce publishes an OCAPI to SCAPI resource mapping in "Why Use SCAPI".
- Hook extension points named `dw.ocapi.shop.*` are shared by OCAPI and SCAPI. Existing hooks with those names are not made obsolete by the deprecation.
- Server-side customization for a headless storefront is done with hooks and SCAPI custom APIs in cartridges.
- A SCAPI custom API has `cartridge/rest-apis/<api-name>/schema.yaml`, `api.json` and the implementing script. Check registration with `b2c scapi custom status` when an instance is available.

## Project facts are not guessable either

| Fact | Where it comes from | If missing |
|---|---|---|
| Cartridge path of a site | Site configuration, `site.xml` in import data, `b2c sites cartridges list --site-id <id>`, the user | Unknown. List candidates. Do not order them |
| Business Manager cartridge path | `b2c sites cartridges list --bm`, the user | Unknown |
| Site IDs, locales, currencies | Site configuration or import data | Ask |
| Custom attributes and custom objects | System and custom object metadata XML in the repository | Search the metadata. Do not assume an attribute exists because it would be convenient |
| Service IDs and credentials | Services metadata. Reference where a credential is configured, never its value | Ask |
| Site preferences | Preferences metadata | Search, then ask |

## How to report

Mark non-obvious claims so the reader can tell what kind they are:

- `[code]` seen in this project, with the file
- `[docs]` confirmed in official documentation or `b2c docs`
- `[inferred]` reasoning from evidence, not confirmed
- `[unknown]` could not be established

If the reason for a design is not in code, commit history or documentation, write "Reason unknown. Do not assume intent."
