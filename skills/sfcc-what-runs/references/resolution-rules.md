# Resolution rules

How the platform chooses between cartridges, with the source for each rule. Sources are Salesforce documentation pages and Salesforce's official agent skills.

| Artifact | Rule | Source |
|---|---|---|
| Cartridge path | Colon-separated list per site. Precedence runs left to right | Cartridges guide |
| Controller `controllers/Name.js` | First file with that name, left to right. SiteGenesis and SFRA controllers are treated alike. The requested function is not checked, so a missing function is an error and there is no fall-through | SFRA Modules |
| Pipeline `pipelines/Name.xml` | Used only when no controller with that name exists anywhere on the path | SFRA Modules |
| Template | First template with the same name and relative location | Customize SFRA |
| `require('*/cartridge/...')` | Resolved along the cartridge path, left to right | Official `b2c-project` skill |
| `require('~/cartridge/...')` | The current cartridge | Convention used across SFRA |
| `require('<cartridge>/cartridge/...')` | That cartridge, whatever the order | Convention used across SFRA |
| `module.superModule` | The next module with the same path and name to the right. `null` when there is none. A platform feature, not only SFRA | SFRA Modules |
| `server.extend(module.superModule)` | Inherits the routes of the next same-named controller | Customize SFRA |
| `server.append` | Runs after the existing chain. Side effects of the original chain still happen | Customize SFRA |
| `server.prepend` | Runs before the existing chain | Official `b2c-project` skill |
| `server.replace` | Drops everything from the base route, including security middleware and the GET or POST check | Official `b2c-project` skill |
| System hooks (`dw.*`) | Run in cartridge path order. The first registration that returns a value skips later ones and the system implementation | Official `b2c-project` skill, Extensibility via Hooks |
| Custom hooks | Every registration runs, whatever it returns | Official `b2c-project` skill |
| SCAPI custom API | Shopper APIs on the site path. Org-level Admin APIs on the Business Manager path | Official `b2c-custom-api-development` skill |
| Client JS and SCSS | Build time, through `paths` in `package.json` and the build tool. Not the runtime path | Customize SFRA |
| `modules` folder | Globally available. It does not have to be on the cartridge path | SFRA Features and Components |

## Not established

- Whether listing `modules` on a site path changes anything.
- The exact naming of pipeline start nodes in route names. Treat `Pipeline-StartNode` as an assumption and confirm in the pipeline file.

When a rule you need is not in this table, verify it with `b2c docs search "<topic>"` or ask. Do not extrapolate from a similar rule.
