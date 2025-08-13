import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

// Storage keys
const SESSION_STORAGE_KEY = 'tv-auth-session';
const TOKEN_STORAGE_KEY = 'tv-auth-token';

// Hardcoded credentials for TV app
const TV_CREDENTIALS = {
  email: 'tony.li.feng@gmail.com',
  password: '123456',
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
    console.log('[AuthService] Getting session...');

    // 1. Check memory cache first
    if (this.sessionCache) {
      console.log('[AuthService] Found session in cache');
      return this.sessionCache;
    }

    // 2. Check AsyncStorage
    const storedSession = await this.getStoredSession();
    if (storedSession && this.isSessionValid(storedSession)) {
      console.log('[AuthService] Found valid session in storage');
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
      console.log('[AuthService] Signing in...');
      
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
      console.log('[AuthService] Sign in successful, token:', signInData.token);

      // Store the token for future requests
      if (signInData.token) {
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, signInData.token);
      }

      // 2. Get full session data (like web app does)
      const fullSession = await this.fetchFullSession(signInData.token);
      if (fullSession) {
        await this.storeSession(fullSession);
        this.sessionCache = fullSession;
        return fullSession;
      }

      return null;
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      return null;
    }
  }

  /**
   * Auto login with hardcoded credentials
   */
  async autoLogin(): Promise<Session | null> {
    console.log('[AuthService] Auto-login with TV credentials');
    return this.signIn(TV_CREDENTIALS.email, TV_CREDENTIALS.password);
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
        
        // If 401, clear stored session and retry login
        if (response.status === 401) {
          console.log('[AuthService] Session expired, clearing and retrying');
          await this.clearSession();
          return this.autoLogin();
        }
        
        return null;
      }

      const data = await response.json();
      console.log('[AuthService] Full session data:', JSON.stringify(data, null, 2));

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

      // Validate we got a businessId
      if (!session.user.businessId) {
        console.error('[AuthService] ❌ User missing businessId!', session.user);
        // Clear session and retry login
        await this.clearSession();
        return this.autoLogin();
      }

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
      console.log('[AuthService] Signing out...');
      
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
      await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, TOKEN_STORAGE_KEY]);
      this.sessionCache = null;
      console.log('[AuthService] Session cleared');
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