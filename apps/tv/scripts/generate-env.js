const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

const appRoot = path.resolve(__dirname, '..');
const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'development';

// Try loading env files in order of precedence
const candidates = [
  `.env.${APP_ENV}.local`,
  `.env.${APP_ENV}`,
  `.env.local`,
  `.env`,
].map(p => path.join(appRoot, p));

let env = {};

for (const file of candidates) {
  if (fs.existsSync(file)) {
    console.log(`Loading environment from: ${file}`);
    const res = dotenv.config({ path: file });
    dotenvExpand.expand(res);
    env = { ...env, ...res.parsed };
  }
}

// Whitelist only what you need to ship to the client bundle:
const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'API_URL',
  'EXPO_PUBLIC_HUE_BRIDGE_IP',
  'EXPO_PUBLIC_HUE_APP_KEY',
  'EXPO_PUBLIC_HUE_GROUP_ID',
];

const missing = required.filter(k => !(k in env));
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const out = `/* AUTO-GENERATED. DO NOT EDIT. */
export const EXPO_PUBLIC_SUPABASE_URL = ${JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL)};
export const EXPO_PUBLIC_SUPABASE_ANON_KEY = ${JSON.stringify(env.EXPO_PUBLIC_SUPABASE_ANON_KEY)};
export const API_URL = ${JSON.stringify(env.API_URL)};
export const EXPO_PUBLIC_HUE_BRIDGE_IP = ${JSON.stringify(env.EXPO_PUBLIC_HUE_BRIDGE_IP)};
export const EXPO_PUBLIC_HUE_APP_KEY = ${JSON.stringify(env.EXPO_PUBLIC_HUE_APP_KEY)};
export const EXPO_PUBLIC_HUE_GROUP_ID = ${JSON.stringify(env.EXPO_PUBLIC_HUE_GROUP_ID)};
`;

const outPath = path.join(appRoot, 'src/env.generated.ts');
fs.writeFileSync(outPath, out);
console.log('✅ Generated environment variables:', outPath);
console.log('  - EXPO_PUBLIC_SUPABASE_URL:', env.EXPO_PUBLIC_SUPABASE_URL);
console.log('  - EXPO_PUBLIC_SUPABASE_ANON_KEY:', env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
console.log('  - API_URL:', env.API_URL);
console.log('  - EXPO_PUBLIC_HUE_BRIDGE_IP:', env.EXPO_PUBLIC_HUE_BRIDGE_IP);
console.log('  - EXPO_PUBLIC_HUE_APP_KEY:', env.EXPO_PUBLIC_HUE_APP_KEY?.substring(0, 20) + '...');
console.log('  - EXPO_PUBLIC_HUE_GROUP_ID:', env.EXPO_PUBLIC_HUE_GROUP_ID);