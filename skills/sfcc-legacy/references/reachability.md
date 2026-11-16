# Reachability checklist

Work through every item before giving legacy code a status. Record the evidence for each answer. "Not found" needs the search you ran.

1. **On a path?** Is the cartridge on any storefront cartridge path or the Business Manager path? A cartridge on no storefront path can still serve Business Manager or jobs.
2. **Shadowed everywhere?** For each site that includes it, is the route or file replaced by a copy further left? Remember the controller rule: the first `controllers/<Name>.js` wins as a whole file.
3. **Linked to?** Search for the route name in `URLUtils` calls, `isinclude url`, form actions, client JavaScript, redirects and other repositories, including a headless storefront.
4. **Required?** Is the script required by name from another cartridge, including through `*/cartridge/...`?
5. **Registered?** Is it a hook implementation in a `hooks.json` or a job step in `steptypes.json` or `steptypes.xml`? Hooks and jobs run regardless of the storefront architecture.
6. **Configured?** Is it named in services, payment processors, job definitions, site preferences or other metadata?
7. **Outside the code?** Content assets, content slots and Page Designer data can link to routes and templates. These live on the instance and are not visible in the repository. Ask the team.

Items 6 and 7 can rarely be closed from code alone. If they are open, the status is `unknown` or at best `replaced-still-referenced`, never `replaced-unreferenced`.
