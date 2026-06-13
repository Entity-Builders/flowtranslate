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
FLOWTRANSLATE_PRO_MERCADO_PAGO_INTERNAL_PLAN_ID=flowtranslate_pro_monthly_ar
FLOWTRANSLATE_PRO_PRICE_AMOUNT=4999
FLOWTRANSLATE_PRO_PRICE_CURRENCY=ARS
FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL=https://flowtranslate.app/pro/checkout/return
FLOWTRANSLATE_PRO_BILLING_WEBHOOK_URL=https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/flowtranslate-billing-webhook?source_news=webhooks
```

`MERCADO_PAGO_*` names are shared provider credentials for the Entity Builders
Billing integration. `FLOWTRANSLATE_PRO_*` names are product-scoped config so a
future Entity Builders app can add its own plan without reintegrating the
provider from scratch. v1 does not expose `VITE_MERCADO_PAGO_*` because checkout
will be created server-side and redirected through Mercado Pago's hosted
`init_point`.

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
the shared `eb-core` project.
