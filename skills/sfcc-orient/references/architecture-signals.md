# Architecture signals

Use these when the overview reports `unknown` or `low` confidence. One signal alone is weak. Look for two that agree.

| Architecture | Signals in the code | Notes |
|---|---|---|
| SFRA | Controllers that `require('server')` and end with `module.exports = server.exports()`. A cartridge named `app_storefront_base`. `server.extend(module.superModule)` | Typical stack left to right: custom, LINK, plug-in, base (Salesforce: SFRA Features and Components) |
| SiteGenesis controllers (SGJC) | Controllers that export through `guard.ensure(...)` and use `app.getView()`, `app.getModel()`, `app.getForm()`. Cartridges `app_storefront_controllers` and `app_storefront_core` | No `server.extend` model |
| Pipelines | `cartridge/pipelines/*.xml`, `.ds` script files | Older than SGJC and a different architecture |
| Classic controllers | `exports.X = fn` with `exports.X.public = true`, without `server` or `guard` | Covered by Salesforce's `b2c-controllers` skill |
| SCAPI custom API | `cartridge/rest-apis/<name>/schema.yaml` and `api.json` | Shopper APIs resolve on the site path, org-level Admin APIs on the Business Manager path |
| API hooks | `hooks.json` registering `dw.ocapi.*` extension points | These extension points are shared by OCAPI and SCAPI |
| Storefront Next | `@salesforce/storefront-next-*` dependencies | No cartridge path |
| PWA Kit | `@salesforce/pwa-kit-*` dependencies | No cartridge path |
| Integration | Cartridge with scripts, services or job steps and no controllers or pipelines | Often shared by many sites |
| Business Manager extension | `bm_extensions.xml` | Lives on the Business Manager cartridge path |

A cartridge name is never proof. `int_*`, `app_*` and brand-named cartridges are frequently shared or repurposed.
