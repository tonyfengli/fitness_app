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
    },
    log_level: 'debug', // Enable debug logging
    heartbeat_interval: 30000, // 30 seconds
    timeout: 20000, // 20 seconds connection timeout
  },
  global: {
    headers: {
      'X-Client-Type': 'react-native-tv', // Identify TV clients for debugging
    },
  },
  db: {
    schema: 'public',
  },
});

// Note: Supabase v2 doesn't have isConnected() or stateChange() methods
// We'll see connection status when we try to subscribe to channels