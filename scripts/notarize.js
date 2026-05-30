import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import process from 'process';

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.resolve(appOutDir, `${appName}.app`);

  console.log(`Checking notarization prerequisites for ${appPath}`);

  const appleId = process.env.APPLE_ID;
  const password =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !password || !teamId) {
    console.warn(
      'Skipping notarization: Missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID in env.',
    );
    return;
  }

  try {
    console.log('Zipping app for notarization...');
    const zipPath = path.resolve(appOutDir, `${appName}-notarize.zip`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`);

    console.log(
      'Submitting to Apple Notary Service (this may take a few minutes)...',
    );
    const submitCmd = `xcrun notarytool submit "${zipPath}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}" --wait --output-format json`;

    // Capture output as JSON to verify the submission status
    let submitOutput;
    try {
      submitOutput = execSync(submitCmd, { encoding: 'utf-8' });
      console.log('Notarytool output:', submitOutput);
    } catch (submitError) {
      // notarytool exits non-zero on failure, but output may still have useful info
      console.error(
        'Notarytool submission failed:',
        submitError.stdout || submitError.stderr || submitError.message,
      );
      throw submitError;
    }

    // Parse JSON output and verify status
    let submitResult;
    try {
      submitResult = JSON.parse(submitOutput);
    } catch {
      // If output isn't valid JSON, log it and continue (older xcrun versions may not support JSON)
      console.log('Could not parse notarytool output as JSON, continuing...');
    }

    if (submitResult) {
      const status = submitResult.status;
      const submissionId = submitResult.id;
      console.log(`Notarization status: ${status}`);
      if (status === 'Invalid' || status === 'Rejected') {
        // Fetch the detailed log from Apple to see WHY it was rejected
        if (submissionId) {
          try {
            console.log(
              `Fetching detailed notarization log for submission ${submissionId}...`,
            );
            const logCmd = `xcrun notarytool log "${submissionId}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}"`;
            const logOutput = execSync(logCmd, { encoding: 'utf-8' });
            console.error('=== APPLE NOTARIZATION LOG ===');
            console.error(logOutput);
            console.error('=== END NOTARIZATION LOG ===');
          } catch (logError) {
            console.error(
              'Could not fetch notarization log:',
              logError.stdout || logError.stderr || logError.message,
            );
          }
        }
        throw new Error(
          `Notarization was rejected. Status: ${status}. Full response: ${JSON.stringify(submitResult, null, 2)}`,
        );
      }
      if (status !== 'Accepted') {
        console.warn(
          `Unexpected notarization status: ${status}. Will attempt stapling anyway.`,
        );
      }
    }

    console.log('Notarization successful!');

    // Stapling embeds the notarization ticket into the app for offline verification.
    // If it fails, the app is still notarized — macOS will verify online.
    console.log('Stapling notarization ticket...');
    const maxRetries = 10;
    const retryDelay = 30000; // 30 seconds
    let stapled = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const stapleOutput = execSync(`xcrun stapler staple "${appPath}"`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log('Stapler output:', stapleOutput);
        stapled = true;
        break;
      } catch (stapleError) {
        const errorOutput =
          stapleError.stderr || stapleError.stdout || stapleError.message;
        console.log(
          `Stapling attempt ${attempt}/${maxRetries} failed: ${errorOutput}`,
        );

        if (attempt === maxRetries) {
          console.warn(
            `⚠️  Stapling failed after ${maxRetries} attempts. The app IS notarized — ` +
              `macOS will verify the notarization online. Stapling just embeds the ticket for offline verification. ` +
              `Continuing without stapling.`,
          );
        } else {
          console.log(
            `Retrying in ${retryDelay / 1000}s (ticket may not have propagated to Apple's CDN yet)...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    if (stapled) {
      console.log('Stapling complete!');
    }

    console.log('Done!');

    // Cleanup zip
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
}
