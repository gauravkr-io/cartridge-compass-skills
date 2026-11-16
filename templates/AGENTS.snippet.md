## SFCC work in this project

This project is Salesforce B2C Commerce (SFCC). Skills named `sfcc-*` are installed. Use them.

- Before the first SFCC task in a session, use sfcc-orient. Do not assume the project is SFRA or that this repository is the whole system.
- Before editing a controller, template, script or hook that may exist in more than one cartridge, use sfcc-what-runs. The answer is per site.
- Before changing shared, core, base, checkout, payment or integration code, use sfcc-blast-radius.
- Never invent SFCC APIs, hooks, endpoints, metadata, cartridge paths or site IDs. Verify, state the uncertainty, or ask (sfcc-verify-api).
- A value that is not configured is unknown. Continue with what is known and name what depends on the gap.
- Never read `dw.json`, `.env` files, keys or certificates. Never deploy, activate, import, run jobs or change an instance without a clear yes for that action (sfcc-instance-safety).
