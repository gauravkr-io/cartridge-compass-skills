---
name: sfcc-instance-safety
description: Guard rails for anything that touches a Salesforce B2C Commerce (SFCC) instance from an AI coding agent: deploying or activating code, running or importing jobs, WebDAV uploads, changing cartridge paths, preferences, users or roles, replication, sandbox lifecycle, Managed Runtime bundles and MCP tools that write. Separates read-only commands from state-changing ones, requires explicit approval for the latter, and protects credential files. Use before running any b2c CLI command or B2C MCP tool, when the user asks to deploy, upload, activate, import, replicate, run a job or change instance configuration, and whenever a task could read dw.json, .env files, keys or certificates.
license: Proprietary. LICENSE.txt has complete terms
metadata:
  author: cartridge-compass
  version: "1.0.2"
---

# Instance and credential safety

Some agents enforce permissions and some do not. This skill is the same discipline for all of them: read freely, change an instance only when the user asked for that specific action in this session.

## Credentials

- Never open, print, copy or summarize `dw.json`, `.env` files, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks` or any file that holds tokens or passwords.
- Never run commands whose purpose is to print a token or client secret.
- In documentation and explanations, say where a credential is configured. Never include its value.
- Logs, debugger variables and API responses can contain customer data or secrets. Quote only what the task needs.

## Which instance

- Treat every configured instance as a shared resource. Work against sandboxes. Never target staging or production unless the user names it and asks, in this session.
- The B2C CLI finds `dw.json` by searching upward from the current folder. A repository with its own `dw.json` can silently point at a different instance than the workspace root. Before a state-changing command, confirm the folder you are in, or pass `--config`.

## Read-only: fine without asking

- `b2c docs read`, `b2c docs search`, `b2c docs schema`
- `b2c project ...` and `b2c security scan`, which read local source
- `b2c code list`, `b2c sites list`, `b2c sites cartridges list`
- `b2c logs ...` (mind personal data in the output)
- `b2c scapi custom status`

## State-changing: ask first, every time

Name the exact command, the instance and the effect, then wait for a clear yes. One approval covers one action.

| Area | Examples |
|---|---|
| Code versions | `b2c code deploy`, `activate`, `delete`, `watch` |
| Jobs and data | `b2c job run`, `job import`, site imports |
| Files | `b2c webdav put`, `rm`, `mkdir`, `unzip` |
| Site setup | `b2c sites cartridges add`, `remove`, `set`, preference updates |
| Replication | `b2c scapi replications publish` |
| Sandboxes | create, delete, reset, start, stop, restart |
| Access | Account Manager and Business Manager users, roles, API clients, SLAS clients |
| Edge and runtime | eCDN changes, Managed Runtime bundle pushes and environment changes |
| MCP tools | `cartridge_deploy`, `webdav_put`, `scapi_execute`, `mrt_bundle_push`, `debug_evaluate`, `debug_set_breakpoints` |

This list is not complete. If a command is not clearly read-only, treat it as state-changing.

## Recommend the tool-level boundary

Instructions can be ignored. The B2C CLI, its IDE extension and its MCP server share Safety Mode, which the tools enforce themselves. Suggest it to the user when it is not in place. They set it, since you do not read `dw.json`:

```json
"safety": { "level": "READ_ONLY" }
```

inside the instance entry in `dw.json`, or the environment variable `SFCC_SAFETY_LEVEL`. Levels are `NONE`, `NO_DELETE` and `READ_ONLY`. Rules can require confirmation for single commands, for example deploys.

## Repositories

- Never reset, revert, force-push or discard changes you did not make without explicit instruction.
- Do not commit generated files, credentials or instance exports that contain customer data.
