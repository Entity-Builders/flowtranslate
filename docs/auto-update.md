# Auto-Update Guide

This guide explains how to build and release updates for "flowtranslate" with auto-update support.

## Prerequisites

1.  **GitHub Token**: You need a GitHub Personal Access Token (Classic) with `repo` scope to publish releases.
    - Create one [here](https://github.com/settings/tokens/new).
    - Set it as an environment variable: `export GH_TOKEN="your_token_here"`

2.  **Code Signing (macOS)**:
    - Auto-updates on macOS require code signing.
    - `electron-builder` will automatically find your Developer ID Application certificate in your Keychain.
    - If detailed configuration is needed, verify `CSC_IDENTITY_AUTO_DISCOVERY` or set `CSC_LINK` and `CSC_KEY_PASSWORD`.

## Releasing an Update

To release a new version (e.g., patch):

1.  **Commit your changes**: Ensure your working directory is clean.
2.  **Run the release command**:

    ```bash
    export GH_TOKEN="your_token"
    yarn release:patch
    ```

    This command will:
    - Increment the patch version in `package.json`.
    - Build the application for macOS (`build:mac`).
    - Upload the artifacts (DMG, ZIP, blockmap) to a new draft release on GitHub.

3.  **Publish**: Go to the [GitHub Releases page](https://github.com/juanobrach/entity-builders/releases), edit the draft, and publish it.

## Verification

1.  **Install the old version**: Install a previous version of the app.
2.  **Release a new version**: Follow the steps above to publish a newer version.
3.  **Launch the app**: Open the installed app. It should check for updates on startup.
4.  **Wait for Notification**: An "Update Available" notification should appear, followed by "Update Ready".
5.  **Restart**: Click "Restart & Update" to apply the new version.
