// Import generated environment variables
import {
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  API_URL,
} from './env.generated';

// Configuration for the TV app
export const config = {
  // Supabase configuration - should match the web app
  supabaseUrl: EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: EXPO_PUBLIC_SUPABASE_ANON_KEY,
  
  // API configuration
  apiUrl: API_URL,
};

// Log configuration on load
console.log('[Config] Loaded configuration:', {
  supabaseUrl: config.supabaseUrl,
  supabaseAnonKey: config.supabaseAnonKey ? '***' : 'Not set',
  apiUrl: config.apiUrl,
});