# PWA Troubleshooting

Flowtranslate vNext is a React/Vite PWA. It does not use Electron auto-update,
native packaging, notarization, or GitHub release update checks.

## Installability

If the browser does not offer installation:

1. Build and preview the production app.

```bash
yarn workspace flowtranslate build
yarn workspace flowtranslate preview
```

2. Confirm `manifest.webmanifest`, `registerSW.js`, and `sw.js` return `200`.
3. Confirm the app is served over HTTPS in production, or `localhost` in local
   development.
4. Confirm `/icon.png` is available and the manifest includes a maskable icon.

## Offline Shell

The service worker caches app shell assets. Existing visible UI can remain
readable after first load, but new translation and Learning generation require
network access to Supabase and Gemini.

If offline shell behavior fails:

1. Build and preview the app.
2. Open DevTools Application tab.
3. Confirm the service worker is registered.
4. Reload once while online.
5. Disable network and reload.

The expected offline state is a visible app shell with AI actions blocked or
clearly unavailable.

## Account And Backend

Local development requires:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

The Edge Function environment requires:

```bash
GEMINI_API_KEY=<server-side-key>
FLOWTRANSLATE_FREE_MONTHLY_TOKENS=20000
FLOWTRANSLATE_GUEST_MONTHLY_TOKENS=800
FLOWTRANSLATE_TRANSLATE_MODEL=gemini-2.5-flash-lite
FLOWTRANSLATE_PRACTICE_MODEL=gemini-2.5-flash
# Optional legacy fallback for practice when FLOWTRANSLATE_PRACTICE_MODEL is not set.
FLOWTRANSLATE_GEMINI_MODEL=
```

Users should never enter a Gemini key in the app.

## FlowTranslate Pro Billing Env

Mercado Pago billing is server-side. The static FlowTranslate app should only
have public Supabase/PostHog Vite env vars. If checkout or paid-but-not-Pro
support later fails, verify the Edge Function environment first:

```bash
yarn env:sync:local --dry-run
```

For local development, the source should be `.env.source.local`, created from
`.env.source.local.template`. Use Mercado Pago test credentials there. For
production, use `.env.source.production`; do not mix production provider tokens
into the local source file.

Expected server-side keys for local Edge Functions:

```bash
MERCADO_PAGO_ACCESS_TOKEN=<redacted>
MERCADO_PAGO_PUBLIC_KEY=<redacted>
MERCADO_PAGO_WEBHOOK_SECRET=<redacted>
MERCADO_PAGO_APPLICATION_ID=<redacted>
FLOWTRANSLATE_PRO_MERCADO_PAGO_INTERNAL_PLAN_ID=flowtranslate_pro_monthly_ar
FLOWTRANSLATE_PRO_PRICE_AMOUNT=4999
FLOWTRANSLATE_PRO_PRICE_CURRENCY=ARS
FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL=https://flowtranslate.app/pro/checkout/return
FLOWTRANSLATE_PRO_BILLING_WEBHOOK_URL=https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/flowtranslate-billing-webhook?source_news=webhooks
```

Do not paste real tokens, webhook secrets, payment payloads, card data, source
text, generated text, or user emails into issue notes, analytics, screenshots,
or this repository.

If a user paid but Pro is not active, do not grant Pro from the return URL
alone. Check provider status and webhook processing from the server-side path.
Story 1.8 must make the future `flowtranslate-billing-webhook` public at the
Supabase JWT layer (`verify_jwt = false`) and then validate Mercado Pago
internally with `x-signature`, `x-request-id`, `ts`, `data.id`, HMAC SHA-256,
and provider lookup before mutating entitlement state.

Reusable billing rule: Mercado Pago provider credentials are shared
`MERCADO_PAGO_*` server secrets; app offers are product-scoped config such as
`FLOWTRANSLATE_PRO_*`. Future Entity Builders apps should add their own
product-prefixed config instead of duplicating the provider integration.

`env:sync --env local` writes app values to `apps/flowtranslate/.env.local`.
`env:sync --env production` writes app values to
`apps/flowtranslate/.env.production`. Edge Function values use
`eb-infra/supabase/functions/.env` for local function serve; production secrets
must still be set in Supabase Cloud secrets.
