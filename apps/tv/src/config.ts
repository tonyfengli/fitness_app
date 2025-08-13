import { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, API_URL } from '@env';

// Debug environment variables
console.log('[Config] Environment variables loaded:', {
  EXPO_PUBLIC_SUPABASE_URL: EXPO_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set',
  API_URL: API_URL ? 'Set' : 'Not set',
});

// Configuration for the TV app
// Temporarily hardcoding values to test if environment variables are the issue
export const config = {
  // Supabase configuration - should match the web app
  supabaseUrl: EXPO_PUBLIC_SUPABASE_URL || 'https://jrpjnwonyhhdahptxyhm.supabase.co',
  supabaseAnonKey: EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpycGpud29ueWhoZGFocHR4eWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzOTIzMDAsImV4cCI6MjA2Njk2ODMwMH0.Q7ND5zKkxhFOFGQm-yUkSKXIL-6AZTDdBxAhXPGRZ3s',
  
  // API configuration
  apiUrl: API_URL || 'http://10.0.2.2:3000',
};

// Validate required configuration
if (!config.supabaseUrl || config.supabaseUrl === 'https://your-project.supabase.co') {
  console.warn('[Config] WARNING: EXPO_PUBLIC_SUPABASE_URL not set. Supabase features will not work.');
}

if (!config.supabaseAnonKey || config.supabaseAnonKey === 'your-anon-key') {
  console.warn('[Config] WARNING: EXPO_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work.');
}