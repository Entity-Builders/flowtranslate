import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Script started');

// Try to read .env from parent directory
const envPath = path.join(__dirname, '../.env');
console.log('Looking for .env at:', envPath);

let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
  console.log('.env file found');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.*)/);
  if (match) {
    apiKey = match[1].trim();
    console.log('GEMINI_API_KEY found in .env');
  } else {
    console.log('GEMINI_API_KEY not found in .env content');
  }
} else {
  console.log('.env file not found or GEMINI_API_KEY already set');
}

if (!apiKey) {
  console.error('GEMINI_API_KEY not found');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
console.log('Fetching models from:', url.replace(apiKey, 'HIDDEN_KEY'));

try {
  const response = await fetch(url);
  if (!response.ok) {
    console.error('HTTP Error:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response:', text);
  } else {
    const data = await response.json();
    if (data.models) {
      console.log('Available models:');
      data.models.forEach((m) => {
        // console.log(JSON.stringify(m, null, 2));
        console.log(`- ${m.name}`);
        console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      console.log('No models found in response:', data);
    }
  }
} catch (e) {
  console.error('Fetch error:', e);
}
