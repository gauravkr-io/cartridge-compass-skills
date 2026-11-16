# Security

## Reporting

Report vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting, not in a public issue.

## Security model

| Concern | Protection |
|---|---|
| Credentials | The script never opens `dw.json`, `.env` files, `*.pem`, `*.key`, `*.p12`, `*.pfx` or `*.jks`. A test plants a `dw.json` and proves nothing from it is printed |
| Writing to your project | The script has no write calls. A test proves the folder is unchanged after every command |
| Network | The script and the installer make no network requests and have no dependencies |
| Instance changes | None. The script reads local source only. The `sfcc-instance-safety` skill tells agents to ask before any state-changing command |
| Installer scope | Writes only into the chosen skills folder and, with `--agents-md`, one marked block in `AGENTS.md` |
| Foreign skills | A skill folder that did not come from this package is never overwritten or removed |
| Large or hostile repositories | Scans stop at 60,000 files, skip files over 768 KB, and do not follow dependency or build folders |

## Limitations

- Skills are instructions to an agent. An agent can ignore them. For hard limits use your agent's permission settings and Salesforce's Safety Mode in `dw.json`.
- The script reports what it finds in local source. It can miss dependencies that are computed at runtime or configured on the instance.
- Skill scripts run with your user's permissions. Review any skill before installing it, including this one.
