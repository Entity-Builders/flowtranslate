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
FLOWTRANSLATE_GEMINI_MODEL=gemini-2.5-flash
```

## Data And Runtime

Flowtranslate vNext stores durable app data in the dedicated
`flowtranslate` Supabase schema:

- `flowtranslate.profiles`
- `flowtranslate.translation_records`
- `flowtranslate.usage_events`

The browser app is a thin PWA interface. Gemini calls, quota preflight,
translation history writes, and practice generation all run through
`flowtranslate-generate`.

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
