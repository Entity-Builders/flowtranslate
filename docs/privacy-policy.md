# Privacy Policy - flowtranslate

**Last updated:** June 1, 2026

## Overview

flowtranslate is an application that helps you translate first, then optionally practice from your translation history in a separate learning flow. We are committed to protecting your privacy.

## Data We Collect

### Analytics (PostHog)

We collect **anonymous usage analytics** to improve the app. This includes:

- Feature usage (translator, Learning, quota, copy, and history actions)
- App version and session info
- Error events (without personal data)
- Usage metadata for quota enforcement, such as request type, character counts, estimated tokens, target language, model, and timestamp

**We do NOT collect:**

- Your own Gemini API keys
- A local personal API key setting
- Deleted translation records for future Learning generation

### AI Requests

flowtranslate sends translation and Learning requests to the flowtranslate backend, which forwards them to Google's Gemini API using a server-side API key. Users do not enter or store their own Gemini API keys in the app.

### Translation History & Settings

Successful distinct translations are saved to your Supabase-backed flowtranslate account so Learning can generate contextual practice. You can delete one saved translation or clear all saved translation history. Deleted translation records are excluded from future Learning generation while usage events remain for quota accounting without storing full deleted translation text.

## Third-Party Services

| Service           | Purpose                             | Privacy Policy                                                                   |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Supabase          | Auth, saved translation history, and usage limits | [Supabase Privacy Policy](https://supabase.com/privacy)                          |
| Google Gemini API | AI generation                       | [Google Privacy Policy](https://policies.google.com/privacy)                     |
| PostHog           | Anonymous analytics                 | [PostHog Privacy Policy](https://posthog.com/privacy)                            |

## Data Retention

Analytics data is retained for 12 months. Saved translation history remains in
your account until you delete individual records or clear history. Usage events
remain for quota accounting.

## Your Rights

You can:

- Delete individual saved translations
- Clear saved translation history
- Request deletion of analytics data by contacting us

## Contact

For privacy questions, contact: **[your-email@example.com]**

## Changes

We may update this policy. Changes will be noted by updating the date above.
