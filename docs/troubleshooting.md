# Auto-Update Troubleshooting

If auto-updates are not working, follow these steps to debug.

## 1. Check the Logs

The application now logs detailed update information to a file.
Open the following file in Console app or a text editor:

```
~/Library/Logs/flowtranslate/main.log
```

Look for lines starting with `[info]` or `[error]` related to `auto-updater`.

### Common Log Messages

- `Checking for update...`: The update check started.
- `Update available`: An update was found.
- `Update not available`: No update found (check version numbers).
- `Error in auto-updater`: Something went wrong.

## 2. Common Issues

### Private Repository

If your repository is **Private**, `electron-updater` cannot see the releases unless:

1.  **GH_TOKEN** is set in the environment where the app is running (not just building).
2.  OR, you configure the app to authenticate.

**Diagnosis**:

- Logs show `Error: 404 Not Found` when checking for updates.
- Logs show `Error: 403 Forbidden`.

### Code Signing (macOS)

On macOS, auto-update requires the app to be signed and notarized.

- If testing locally with a production build (`yarn build:mac` then running the `.app`), it might work if signed with a development certificate, but for distribution, it MUST be signed with "Developer ID Application".

### Version Mismatch

Ensure the `version` in `package.json` of the **installed** app is strictly lower than the release on GitHub.

- Installed: 0.1.1
- Release: 0.1.3

## 3. How to Test Locally

To test the full flow:

1.  Build version 0.1.1.
2.  Install/Run version 0.1.1.
3.  Release version 0.1.3 to GitHub.
4.  Open the 0.1.1 app.
5.  Watch `main.log`.
