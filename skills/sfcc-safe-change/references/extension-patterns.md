# SFRA extension patterns

## Extend a controller and add to a route

```js
'use strict';

var server = require('server');
server.extend(module.superModule);

server.append('Show', function (req, res, next) {
    var viewData = res.getViewData();
    viewData.extra = true;
    res.setViewData(viewData);
    next();
});

module.exports = server.exports();
```

Every middleware step receives `req`, `res` and `next` and must call `next()`. `res.setViewData` merges data across steps.

## Replace a route and keep its protection

`server.replace` registers a completely new chain. Middleware from the base route is gone unless you list it again, and so is the method restriction.

```js
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.replace('SubmitForm', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    // new implementation
    next();
});
```

Check the base route first and repeat each protective step it had. A CSRF check added with `append` runs after the handler and protects nothing.

## Code that runs after the chain

Handlers registered with `this.on('route:BeforeComplete', fn)` run after the last step and before rendering. Code that saves data often lives there, not in the chain. Look for it when a route seems to do more than its steps show.

## Extend a script or model

```js
'use strict';

var base = module.superModule;

function getTotals(basket) {
    var totals = base.getTotals(basket);
    totals.custom = true;
    return totals;
}

module.exports = Object.assign({}, base, { getTotals: getTotals });
```

`module.superModule` is the next file with the same relative path to the right on the cartridge path. It is `null` when there is none, so this only works when a lower copy exists on every site that uses your cartridge.

## Requires

| Form | Resolves to |
|---|---|
| `require('*/cartridge/scripts/x')` | First match along the cartridge path |
| `require('~/cartridge/scripts/x')` | The current cartridge |
| `require('some_cartridge/cartridge/scripts/x')` | That cartridge, whatever the order |

Prefer `*` when overriding should stay possible.

## Sources

Salesforce documentation: Customize SFRA, SFRA Modules, SFRA Features and Components. Salesforce official skills: `b2c-project`, `b2c-controllers`.
