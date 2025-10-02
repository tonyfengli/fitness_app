import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = config.supabaseUrl;
const supabaseAnonKey = config.supabaseAnonKey;

console.log('[Supabase] Initializing with:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey.substring(0, 20) + '...',
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false, // Disable since we're not using Supabase auth
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting to prevent overwhelming TV
      apikey: supabaseAnonKey, // Explicitly pass the API key for Pro plan
    },
    log_level: 'debug', // Enable debug logging
    heartbeat: {
      interval: 30000, // 30 seconds
    },
    timeout: 30000, // Increase to 30 seconds connection timeout for TV
    // Enable auto reconnect with longer delays for TV
    reconnect_after_ms: (attempts: number) => {
      // Exponential backoff: 1s, 2s, 4s, etc. (slower for TV)
      return Math.min(1000 * Math.pow(2, attempts), 30000);
    },
  },
  global: {
    headers: {
      'X-Client-Type': 'react-native-tv', // Identify TV clients for debugging
      'apikey': supabaseAnonKey, // Ensure API key is in headers
    },
  },
  db: {
    schema: 'public',
  },
});

// Note: Supabase v2 doesn't have isConnected() or stateChange() methods
// We'll see connection status when we try to subscribe to channels