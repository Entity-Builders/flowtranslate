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
FLOWTRANSLATE_GEMINI_MODEL=gemini-2.5-flash
```

Users should never enter a Gemini key in the app.
