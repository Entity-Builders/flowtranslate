---
name: 'flowtranslate'
tagline: 'AI translation first, focused learning later'
platform: 'Web PWA'
status: 'experimental'
category: 'education'
icon: 'FT'
features:
  - 'Bidirectional translation through the flowtranslate backend'
  - 'Copy-ready translation output'
  - 'Separate learning section built from account translation history'
  - 'Short mixed micro-practice sets with vocabulary recall, fill-in, and re-translate prompts'
  - 'Account-based usage tracking and monthly quotas'
downloadUrl: 'https://flowtranslate.app'
visible: false
---

# flowtranslate

React + Vite Progressive Web App focused on translation first, then optional
language learning in a separate flow. The app should be installable as a PWA and
provide basic offline app-shell behavior without Electron.

```bash
yarn workspace flowtranslate dev
```

The app uses Supabase Auth plus the existing `flowtranslate-generate` Edge
Function so users do not bring their own Gemini API keys.

## Local Setup

From the repo root:

```bash
yarn install
yarn infra:start
yarn infra:migrate
yarn supabase:functions
yarn start:flowtranslate
```

App environment:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

### Local Auth And OTP

The local Supabase stack supports both anonymous guest sessions and email
OTP/code login. Google OAuth is optional for local development; use email code
login when Google is not configured.

Auth is configured in `eb-infra/supabase/config.toml` with:

- `enable_anonymous_sign_ins = true`
- `enable_manual_linking = true`
- local redirect allow-list entries for `http://localhost:5173` and
  `http://127.0.0.1:5173`
- Inbucket enabled on `http://127.0.0.1:54324`

To test OTP locally:

1. Start infra with `yarn infra:start`.
2. Start FlowTranslate with `yarn start:flowtranslate`.
3. Open the account surface and submit an email under `Codigo por email`.
4. Open Inbucket at `http://127.0.0.1:54324`.
5. Copy the six-digit code from the latest auth email into FlowTranslate.

The account UI should keep the anonymous guest trial usable if Google OAuth is
missing or a provider link attempt fails.

Function environment lives in `eb-infra/supabase/functions/.env`:

```bash
GEMINI_API_KEY=<server-side-key>
FLOWTRANSLATE_FREE_MONTHLY_TOKENS=20000
FLOWTRANSLATE_GUEST_MONTHLY_TOKENS=800
FLOWTRANSLATE_TRANSLATE_MODEL=gemini-2.5-flash-lite
FLOWTRANSLATE_PRACTICE_MODEL=gemini-2.5-flash
# Optional legacy fallback for practice when FLOWTRANSLATE_PRACTICE_MODEL is not set.
FLOWTRANSLATE_GEMINI_MODEL=
```

FlowTranslate Pro billing uses Mercado Pago through server-side Supabase Edge
Functions only. For local development, copy `.env.source.local.template` to
`.env.source.local`, fill local Supabase and Mercado Pago test credentials, then
sync both the Vite app and Edge Function env:

```bash
yarn env:sync:local
```

That writes browser-safe values to `apps/flowtranslate/.env.local` and
server-side values to `eb-infra/supabase/functions/.env`. For production,
copy `.env.source.template` to `.env.source.production`, fill production
values, and use:

```bash
yarn env:sync:production
```

Do not add these values to `apps/flowtranslate/.env.production` or Cloudflare
static app env unless they are public `VITE_*` values:

```bash
MERCADO_PAGO_ACCESS_TOKEN=<server-side-token>
MERCADO_PAGO_PUBLIC_KEY=<server-side-for-v1>
MERCADO_PAGO_WEBHOOK_SECRET=<server-side-secret>
MERCADO_PAGO_APPLICATION_ID=<provider-app-id>
MERCADO_PAGO_WEBHOOK_URL_TOKEN=<optional-story-1.8-fallback>
ENTITY_BUILDERS_BILLING_WEBHOOK_URL=https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/entitybuilders-billing-webhook?source_news=webhooks&provider=mercado_pago
FLOWTRANSLATE_PRO_MERCADO_PAGO_INTERNAL_PLAN_ID=flowtranslate_pro_monthly_ar
FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_ACCOUNT_MODE=false
FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_PAYER_EMAIL=<optional-test-buyer-email>
FLOWTRANSLATE_PRO_PRICE_AMOUNT=4999
FLOWTRANSLATE_PRO_PRICE_CURRENCY=ARS
FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL=https://flowtranslate.app/pro/checkout/return
```

`MERCADO_PAGO_*` names are shared provider credentials for the Entity Builders
Billing integration. `ENTITY_BUILDERS_BILLING_WEBHOOK_URL` is the shared
server-side billing webhook; FlowTranslate routes through provider lookup and
`external_reference`, not a product-specific webhook function name.
`FLOWTRANSLATE_PRO_*` names are product-scoped config so a future Entity
Builders app can add its own plan without reintegrating the provider from
scratch. v1 does not expose `VITE_MERCADO_PAGO_*` because checkout will be
created server-side and redirected through Mercado Pago's hosted `init_point`.

For end-to-end Mercado Pago testing against the local Supabase stack, expose
the local functions server through a public HTTPS tunnel and put that tunnel in
`ENTITY_BUILDERS_BILLING_WEBHOOK_URL`, including
`?source_news=webhooks&provider=mercado_pago`. Mercado Pago cannot deliver
provider webhooks to `127.0.0.1` or `localhost` from its servers.

Mercado Pago also validates the checkout `back_url`. For local subscription
tests, set `FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL` to a public HTTPS route such
as `https://flowtranslate.app/pro/checkout/return`, or expose the local Vite app
through a second HTTPS tunnel and use that tunnel's `/pro/checkout/return` URL.
When using one Tailscale Funnel host for both services, route `/functions/v1`
to `http://127.0.0.1:54321/functions/v1` and `/` to
`http://127.0.0.1:5173`; otherwise `/pro/checkout/return` will hit the
Supabase gateway and return `no Route matched with those values`.

Configure Webhooks in the Mercado Pago app for the seller test account as well
as passing the webhook URL from the server payload. In local tests Mercado Pago
may still show `notification_url: null` on the subscription resource, so the
dashboard Webhooks configuration is the source of truth for automatic delivery.

For hosted subscription checkout tests, Mercado Pago requires two test
accounts: a seller and a buyer. Log in as the seller test account, create an app
there, and use that seller test account's production `APP_USR-*` credentials in
`.env.source.local`; `TEST-*` credentials from a real account can create a
pending preapproval that fails on the hosted checkout with "una de las partes es
de prueba". Then set `FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_ACCOUNT_MODE=true`
and `FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_PAYER_EMAIL` to the separate buyer
test account email. Mercado Pago may show the buyer as `TESTUSER123...`, but
the email expected by `/preapproval` is usually `test_user_123...@testuser.com`.
Run `yarn env:sync:local`, restart the local functions server, and complete
checkout in an incognito browser signed in as the buyer test account.

## Data And Runtime

Flowtranslate vNext stores durable app data in the dedicated
`flowtranslate` Supabase schema:

- `flowtranslate.profiles`
- `flowtranslate.translation_records`
- `flowtranslate.usage_events`

The browser app is a thin PWA interface. Gemini calls, quota preflight,
translation history writes, and practice generation all run through
`flowtranslate-generate`.

Direct translation and Learning practice can use separate Gemini models. Keep
`FLOWTRANSLATE_TRANSLATE_MODEL` on the fastest acceptable model for short text,
and tune `FLOWTRANSLATE_PRACTICE_MODEL` independently for richer exercise
generation.

## Validation

```bash
yarn workspace @eb-packages/flowtranslate-core test
yarn workspace flowtranslate test
yarn workspace flowtranslate build
deno test --no-config eb-infra/supabase/functions/flowtranslate-generate/*.test.ts
```

After building, preview with:

```bash
yarn workspace flowtranslate preview
```

Then verify the browser reports PWA installability and that the app shell still
loads after first visit when the network is disabled. New AI actions should be
disabled while offline.

## Production Deploy

Flowtranslate deploys as static Vite assets through Cloudflare Wrangler:

```bash
yarn deploy:flowtranslate
```

The Wrangler config lives at `apps/flowtranslate/wrangler.jsonc` and deploys
`dist/` to `flowtranslate.app`. Before deploying, provide production values via
the shell or `apps/flowtranslate/.env.production`; use `.env.production.template`
as the committable checklist.

Mercado Pago Access Token, webhook secret, Client Secret, card data, provider
payloads, and user emails must never be configured in Cloudflare/Wrangler for
the static app. Production billing secrets belong in Supabase Cloud secrets for
the shared `eb-core` project. Preview the server-side upload with:

```bash
./scripts/sync-secrets.sh xfcvuzcxvdpzkqpnahyx \
  --source .env.source.production \
  --dry-run
```

Remove `--dry-run` only when `.env.source.production` contains the intended
production server-side values.
