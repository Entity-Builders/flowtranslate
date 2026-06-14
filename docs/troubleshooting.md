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

### Local OTP Login

Email code login is the reliable localhost path. Google OAuth may be configured
for local testing, but it is not required to verify permanent-account behavior.

The local Supabase config enables anonymous sign-ins, manual identity linking,
and Inbucket email capture. After requesting a code in FlowTranslate, open:

```bash
http://127.0.0.1:54324
```

Use the latest auth email to copy the six-digit code back into the account
surface. If Google OAuth fails locally, the current guest trial should remain
usable and the email code path should still be available.

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
`.env.source.local.template`. For hosted Mercado Pago subscription checkout
tests, use production `APP_USR-*` credentials from a Mercado Pago seller test
account, not `TEST-*` credentials from a real account. For production, use
`.env.source.production`; do not mix live provider tokens into the local source
file.

For real local subscription tests, `ENTITY_BUILDERS_BILLING_WEBHOOK_URL` must
be a public HTTPS tunnel that forwards to the local Supabase functions server.
`FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL` must also be public HTTPS because
Mercado Pago validates the subscription `back_url` before creating the
preapproval. Use production return URL for backend entitlement testing, or a
second tunnel to the local Vite app for full local return-screen testing.
If both URLs use a single Tailscale Funnel host, configure path routing so `/`
proxies to the Vite dev server and `/functions/v1` proxies to Supabase
Functions. A return page that shows `{"message":"no Route matched with those
values"}` is reaching Supabase, not FlowTranslate.

Mercado Pago Webhooks should also be configured in the seller test account's
Developer Panel application for the local tunnel URL and subscription/payment
events. Do not assume that the subscription resource will echo
`notification_url`; local preapproval tests can return `notification_url: null`
even when the server sent a webhook URL in the create request.

Expected server-side keys for local Edge Functions:

```bash
MERCADO_PAGO_ACCESS_TOKEN=<redacted>
MERCADO_PAGO_PUBLIC_KEY=<redacted>
MERCADO_PAGO_WEBHOOK_SECRET=<redacted>
MERCADO_PAGO_APPLICATION_ID=<redacted>
ENTITY_BUILDERS_BILLING_WEBHOOK_URL=<redacted-shared-webhook-url>
FLOWTRANSLATE_PRO_MERCADO_PAGO_INTERNAL_PLAN_ID=flowtranslate_pro_monthly_ar
FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_ACCOUNT_MODE=<true-for-seller-test-account>
FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_PAYER_EMAIL=<optional-test-buyer-email>
FLOWTRANSLATE_PRO_PRICE_AMOUNT=4999
FLOWTRANSLATE_PRO_PRICE_CURRENCY=ARS
FLOWTRANSLATE_PRO_CHECKOUT_RETURN_URL=https://flowtranslate.app/pro/checkout/return
```

If Mercado Pago shows "Una de las partes con la que intentas hacer el pago es
de prueba", verify the full test-account chain: create separate seller and
buyer test accounts in Mercado Pago, log in as the seller test account to create
an app, use that seller test account's production `APP_USR-*` credentials in
the local Edge Function env, set
`FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_ACCOUNT_MODE=true`, set
`FLOWTRANSLATE_PRO_MERCADO_PAGO_TEST_PAYER_EMAIL` to the buyer test account
email, then run `yarn env:sync:local` and restart `supabase functions serve`.
If Mercado Pago shows the buyer nickname as `TESTUSER123...`, use the email
shape `test_user_123...@testuser.com` unless `/users/me` for that test account
shows a different email. Open checkout in an incognito browser signed in as the
buyer test account, not a real account and not the seller account.

Do not paste real tokens, webhook secrets, payment payloads, card data, source
text, generated text, or user emails into issue notes, analytics, screenshots,
or this repository.

If a user paid but Pro is not active, do not grant Pro from the return URL
alone. Check provider status and webhook processing from the server-side path.
Story 1.8 must make the future `entitybuilders-billing-webhook` public at the
Supabase JWT layer (`verify_jwt = false`) and then validate Mercado Pago
internally with `x-signature`, `x-request-id`, `ts`, `data.id`, HMAC SHA-256,
provider lookup, and `external_reference` routing before mutating entitlement
state.

For operator-only paid-but-not-Pro reconciliation, use
`apps/flowtranslate/docs/pro-reconciliation.md` and the support SQL templates in
`eb-infra/supabase/support/flowtranslate-pro-reconciliation.sql`. Do not expose
those templates in the app or use them from browser code.

Reusable billing rule: Mercado Pago provider credentials are shared
`MERCADO_PAGO_*` server secrets, the billing webhook is shared as
`ENTITY_BUILDERS_BILLING_WEBHOOK_URL`, and app offers are product-scoped config
such as `FLOWTRANSLATE_PRO_*`. Future Entity Builders apps should add their own
product-prefixed config instead of duplicating the provider integration.

`env:sync --env local` writes app values to `apps/flowtranslate/.env.local`.
`env:sync --env production` writes app values to
`apps/flowtranslate/.env.production`. Edge Function values use
`eb-infra/supabase/functions/.env` for local function serve; production secrets
must still be set in Supabase Cloud secrets.

Use this to preview production Edge Function secret upload without printing
values:

```bash
./scripts/sync-secrets.sh xfcvuzcxvdpzkqpnahyx \
  --source .env.source.production \
  --dry-run
```

`eb-infra/.env.local` is legacy compatibility for older scripts. It is not the
source for `supabase functions serve` and should not be treated as the canonical
production secret source.
