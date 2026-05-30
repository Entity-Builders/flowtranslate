---
name: 'flowtranslate'
tagline: 'AI translation first, focused learning later'
platform: 'macOS'
status: 'experimental'
category: 'education'
icon: 'FT'
features:
  - 'Bidirectional translation through the flowtranslate backend'
  - 'Copy-ready translation output'
  - 'Separate learning section built from translation history'
  - 'Short learning articles with repetition and mini challenges'
  - 'Account-based usage tracking'
downloadUrl: 'https://flowtranslate.app'
visible: false
---

# flowtranslate

Electron + React app focused on translation first, then optional language
learning in a separate flow.

```bash
yarn workspace flowtranslate dev
```

The app uses Supabase auth plus the `flowtranslate-generate` Edge Function so
users do not bring their own Gemini API keys.
