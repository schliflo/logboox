# The import Worker

Automatic import from XPeng, hourly at :45. One fetch step per owner who is due
(a new export a day each), then every fetched ZIP is parsed into the account
with the same code the browser uses. Details and setup:
[docs/auto-import.md](../docs/auto-import.md).

It binds the app's database and bucket and holds `XPENG_APP_ID` and
`XPENG_APP_SECRET`; the app itself has neither secret.

```sh
# From the repository root
pnpm deploy:import

# Locally: copy .dev.vars.example to .dev.vars, then fire the schedule at /__scheduled
pnpm exec wrangler dev --config import/wrangler.jsonc --test-scheduled
```
