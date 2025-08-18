import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

// Storage keys
const SESSION_STORAGE_KEY = 'tv-auth-session';
const TOKEN_STORAGE_KEY = 'tv-auth-token';
const ENVIRONMENT_STORAGE_KEY = 'tv-environment';

// Hardcoded credentials for TV app
const TV_CREDENTIALS = {
  gym: {
    email: 'tony.li.feng@gmail.com',
    password: '123456',
  },
  developer: {
    email: 'tony.feng.li@gmail.com',
    password: '123456',
  }
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  user: User;
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    token: string;
  };
}

class AuthService {
  private baseURL: string;
  private sessionCache: Session | null = null;

  constructor() {
    this.baseURL = config.apiUrl;
  }

  /**
   * Get current session - checks cache first, then storage, then attempts login
   */
  async getSession(): Promise<Session | null> {
    console.log('[AuthService] 🔍 Getting session...');

    // 1. Check memory cache first
    if (this.sessionCache) {
      console.log('[AuthService] 📦 Found session in cache');
      console.log('[AuthService] Cached user:', this.sessionCache.user.email, 'BusinessId:', this.sessionCache.user.businessId);
      return this.sessionCache;
    }

    // 2. Check AsyncStorage
    const storedSession = await this.getStoredSession();
    if (storedSession && this.isSessionValid(storedSession)) {
      console.log('[AuthService] 💾 Found valid session in storage');
      console.log('[AuthService] Stored user:', storedSession.user.email, 'BusinessId:', storedSession.user.businessId);
      this.sessionCache = storedSession;
      return storedSession;
    }

    // 3. No valid session, attempt auto-login
    console.log('[AuthService] No valid session found, attempting auto-login');
    return this.autoLogin();
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<Session | null> {
    try {
      console.log('[AuthService] 🚀 Signing in with email:', email);
      
      // 1. First sign in with BetterAuth
      const signInResponse = await fetch(`${this.baseURL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!signInResponse.ok) {
        console.error('[AuthService] Sign in failed:', signInResponse.status);
        const error = await signInResponse.text();
        console.error('[AuthService] Error details:', error);
        return null;
      }

      const signInData = await signInResponse.json();
      console.log('[AuthService] ✅ Sign in successful, token:', signInData.token ? 'received' : 'missing');

      // Store the token for future requests
      if (signInData.token) {
        console.log('[AuthService] 💾 Storing token, length:', signInData.token.length);
        console.log('[AuthService] Token preview:', signInData.token.substring(0, 30) + '...');
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, signInData.token);
        
        // Verify it was stored
        const verifyToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        console.log('[AuthService] Token stored successfully:', !!verifyToken);
        console.log('[AuthService] Stored token matches:', verifyToken === signInData.token);
      } else {
        console.error('[AuthService] ⚠️ No token in sign-in response!');
      }

      // Small delay to ensure token is propagated
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Get full session data (like web app does)
      const fullSession = await this.fetchFullSession(signInData.token);
      if (fullSession) {
        console.log('[AuthService] 📝 Storing session for user:', fullSession.user.email, 'BusinessId:', fullSession.user.businessId);
        await this.storeSession(fullSession);
        this.sessionCache = fullSession;
        return fullSession;
      } else {
        console.error('[AuthService] ❌ Failed to fetch full session after sign in');
        console.log('[AuthService] Sign in data was:', JSON.stringify(signInData));
      }

      return null;
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      return null;
    }
  }

  /**
   * Get current environment
   */
  async getCurrentEnvironment(): Promise<'gym' | 'developer'> {
    try {
      const env = await AsyncStorage.getItem(ENVIRONMENT_STORAGE_KEY);
      console.log('[AuthService] 🌍 Current environment from storage:', env || 'gym (default)');
      return (env as 'gym' | 'developer') || 'gym';
    } catch {
      return 'gym';
    }
  }

  /**
   * Set current environment
   */
  async setCurrentEnvironment(env: 'gym' | 'developer'): Promise<void> {
    console.log('[AuthService] 🌍 Setting environment to:', env);
    await AsyncStorage.setItem(ENVIRONMENT_STORAGE_KEY, env);
  }

  /**
   * Auto login with hardcoded credentials
   */
  async autoLogin(): Promise<Session | null> {
    const env = await this.getCurrentEnvironment();
    const credentials = env === 'developer' ? TV_CREDENTIALS.developer : TV_CREDENTIALS.gym;
    console.log('[AuthService] 🤖 Auto-login with', env, 'credentials:', credentials.email);
    return this.signIn(credentials.email, credentials.password);
  }

  /**
   * Switch account based on environment
   */
  async switchAccount(env: 'gym' | 'developer'): Promise<Session | null> {
    console.log('[AuthService] 🔄 Switching account to:', env);
    
    // Store current session in case we need to fallback
    const currentSession = this.sessionCache;
    const currentEnv = await this.getCurrentEnvironment();
    
    try {
      // Clear current session
      console.log('[AuthService] 🧹 Clearing current session before switch');
      await this.clearSession();
      
      // Set new environment
      await this.setCurrentEnvironment(env);
      
      // Login with new credentials
      const credentials = env === 'developer' ? TV_CREDENTIALS.developer : TV_CREDENTIALS.gym;
      const newSession = await this.signIn(credentials.email, credentials.password);
      
      if (!newSession) {
        throw new Error('Failed to login with new credentials');
      }
      
      return newSession;
    } catch (error) {
      console.error('[AuthService] ❌ Account switch failed:', error);
      console.log('[AuthService] 🔙 Falling back to previous account');
      
      // Restore previous environment
      await this.setCurrentEnvironment(currentEnv);
      
      // Try to restore previous session
      if (currentSession) {
        this.sessionCache = currentSession;
        await this.storeSession(currentSession);
        return currentSession;
      }
      
      // If no previous session, try auto-login with previous env
      return this.autoLogin();
    }
  }

  /**
   * Fetch full session data from the server (includes all user fields)
   */
  async fetchFullSession(token?: string): Promise<Session | null> {
    try {
      console.log('[AuthService] Fetching full session from server');
      
      // Get token from storage if not provided
      const authToken = token || await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth header if we have a token
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        // Also set cookie for BetterAuth compatibility
        headers['Cookie'] = `better-auth.session=${authToken}`;
      }

      const response = await fetch(`${this.baseURL}/api/auth/get-session`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[AuthService] Get session failed:', response.status);
        const errorText = await response.text();
        console.error('[AuthService] Error response:', errorText);
        
        // If 401, clear stored session and retry login
        if (response.status === 401) {
          console.log('[AuthService] Session expired, clearing and retrying');
          await this.clearSession();
          return this.autoLogin();
        }
        
        return null;
      }

      const data = await response.json();
      console.log('[AuthService] Full session data:', data ? 'received' : 'null');
      
      // Only log full data if there's an issue
      if (!data || !data.user) {
        console.error('[AuthService] Unexpected session response:', JSON.stringify(data, null, 2));
      }

      if (!data || !data.user) {
        console.error('[AuthService] Invalid session data received');
        return null;
      }

      // Ensure we have all required fields
      const session: Session = {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || 'client',
          businessId: data.user.businessId || '',
          emailVerified: data.user.emailVerified,
          createdAt: data.user.createdAt,
          updatedAt: data.user.updatedAt,
        },
        session: data.session || {
          id: data.session?.id || '',
          userId: data.user.id,
          expiresAt: data.session?.expiresAt || '',
          token: authToken || '',
        },
      };
      
      // Log the session token status
      console.log('[AuthService] Session constructed with token:', !!session.session.token);
      if (session.session.token) {
        console.log('[AuthService] Session token length:', session.session.token.length);
        console.log('[AuthService] Session token preview:', session.session.token.substring(0, 30) + '...');
      }

      // Validate we got a businessId
      if (!session.user.businessId) {
        console.error('[AuthService] ❌ User missing businessId!', session.user);
        console.error('[AuthService] 🔄 Clearing session and retrying auto-login');
        // Clear session and retry login
        await this.clearSession();
        return this.autoLogin();
      }
      
      console.log('[AuthService] ✅ Session validated with businessId:', session.user.businessId);

      return session;
    } catch (error) {
      console.error('[AuthService] Fetch session error:', error);
      return null;
    }
  }

  /**
   * Refresh session if needed
   */
  async refreshSession(): Promise<Session | null> {
    console.log('[AuthService] Refreshing session...');
    
    // Clear cache to force refresh
    this.sessionCache = null;
    
    // Try to get fresh session
    const session = await this.fetchFullSession();
    if (session) {
      await this.storeSession(session);
      this.sessionCache = session;
      return session;
    }

    // If fetch failed, try auto-login
    return this.autoLogin();
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      console.log('[AuthService] 🚪 Signing out...');
      console.log('[AuthService] Current cached user:', this.sessionCache?.user.email, 'BusinessId:', this.sessionCache?.user.businessId);
      
      // Call sign out endpoint
      await fetch(`${this.baseURL}/api/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[AuthService] Sign out error:', error);
    } finally {
      // Always clear local session
      await this.clearSession();
    }
  }

  /**
   * Check if session is valid
   */
  private isSessionValid(session: Session): boolean {
    if (!session.session?.expiresAt) {
      return true; // No expiry, assume valid
    }

    const expiresAt = new Date(session.session.expiresAt);
    const now = new Date();
    const isValid = expiresAt > now;
    
    console.log('[AuthService] Session valid:', isValid, 'expires:', expiresAt);
    return isValid;
  }

  /**
   * Get stored session from AsyncStorage
   */
  private async getStoredSession(): Promise<Session | null> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as Session;
      
      // Validate required fields
      if (!session.user?.id || !session.user?.email || !session.user?.businessId) {
        console.warn('[AuthService] Invalid stored session, missing required fields');
        console.warn('[AuthService] User data:', session.user);
        return null;
      }

      return session;
    } catch (error) {
      console.error('[AuthService] Error reading stored session:', error);
      return null;
    }
  }

  /**
   * Store session in AsyncStorage
   */
  private async storeSession(session: Session): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      console.log('[AuthService] Session stored successfully');
    } catch (error) {
      console.error('[AuthService] Error storing session:', error);
    }
  }

  /**
   * Clear stored session
   */
  async clearSession(): Promise<void> {
    try {
      console.log('[AuthService] 🧹 Clearing all session data');
      await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, TOKEN_STORAGE_KEY]);
      this.sessionCache = null;
      console.log('[AuthService] ✅ Session cleared from memory and storage');
    } catch (error) {
      console.error('[AuthService] Error clearing session:', error);
    }
  }

  /**
   * Handle API request with automatic token refresh
   */
  async authenticatedRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    try {
      // Get current session
      const session = await this.getSession();
      if (!session) {
        console.error('[AuthService] No session for authenticated request');
        return null;
      }

      // Add auth headers
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Cookie': `better-auth.session=${token}`,
      };

      // Make request
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      // Handle 401 - refresh and retry
      if (response.status === 401) {
        console.log('[AuthService] Got 401, refreshing session...');
        const newSession = await this.refreshSession();
        
        if (newSession) {
          // Retry with new token
          const newToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`,
              'Cookie': `better-auth.session=${newToken}`,
            },
            credentials: 'include',
          });

          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        
        return null;
      }

      if (!response.ok) {
        console.error('[AuthService] Request failed:', response.status);
        return null;
      }

      return response.json();
    } catch (error) {
      console.error('[AuthService] Authenticated request error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();