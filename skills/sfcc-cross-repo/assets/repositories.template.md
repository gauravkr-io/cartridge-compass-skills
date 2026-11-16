# Project repositories

<!--
One section per repository. Every field is optional. A missing value means "not configured", never "guess".
Type: one or more of sfra, sgjc, pipelines, custom-controllers, scapi-custom-api, api-hooks, pwa-kit,
storefront-next, headless, integration, bm-extension, library, build-deploy, other.
A Type written here wins over anything a tool detects.
Status: active (default), archived, or ignore.
-->

## storefront
- Path: storefront
- Type: sfra
- Purpose: Main storefront cartridges
- Sites: Shop_US, Shop_UK
- Status: active

## integrations
- Path: integrations
- Type: integration, api-hooks, scapi-custom-api
- Purpose: Payment, tax and API extensions shared by every site

## web
- Path: web
- Type: storefront-next
- Purpose: Headless storefront. Depends on custom APIs and hooks in integrations
