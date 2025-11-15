import { createTokenStorage, type TokenStorageService } from "../token-storage-service";

export interface HueRemoteClientConfig {
  accessToken: string;
  refreshToken: string;
  username: string;
  apiUrl?: string;
  tokenStorage?: TokenStorageService;
}

export interface HueScene {
  name: string;
  lastupdated: string;
  lights: string[];
  owner: string;
  recycle: boolean;
  locked: boolean;
  appdata: Record<string, unknown>;
  picture: string;
  image: string;
  version: number;
  type: string; // "LightScene" | "GroupScene"
  lightstates?: Record<string, any>; // Light ID -> desired state
  group?: string; // Group ID for GroupScene types
  transitiontime?: number; // Default transition time in deciseconds
}

export class HueRemoteClient {
  private config: HueRemoteClientConfig;
  private apiUrl: string;
  private tokenStorage: TokenStorageService;

  constructor(config: HueRemoteClientConfig) {
    this.config = config;
    this.apiUrl = config.apiUrl || 'https://api.meethue.com';
    this.tokenStorage = config.tokenStorage || createTokenStorage();
  }


  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    const clientId = process.env.HUE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.HUE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.HUE_OAUTH_REDIRECT_URL;
    
    console.log('🔄 [HueRemoteClient] Starting token refresh...');
    
    if (!clientId || !clientSecret || !this.config.refreshToken) {
      throw new Error('Missing OAuth credentials for token refresh');
    }

    const requestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });


    const response = await fetch('https://api.meethue.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ [HueRemoteClient] Token refresh failed:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    console.log('✅ [HueRemoteClient] Token refresh successful!');
    
    // Update in-memory tokens
    this.config.accessToken = tokenData.access_token;
    this.config.refreshToken = tokenData.refresh_token || this.config.refreshToken;
    
    // Update persistent storage (database or .env)
    await this.tokenStorage.updateTokens('hue_remote', {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || this.config.refreshToken,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
    });
  }


  /**
   * Make authenticated API request to Remote Hue API with automatic token refresh
   */
  private async makeRequest<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    return await this.attemptRequest<T>(method, path, body, false);
  }

  /**
   * Attempt API request with automatic retry on token expiry
   */
  private async attemptRequest<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    isRetry: boolean = false
  ): Promise<T> {
    const url = `${this.apiUrl}/route/api/${this.config.username}${path}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // Check if this is a token expiry error and we haven't already retried
      if (!isRetry && this.isTokenExpiredError(response.status, errorText)) {
        console.log('🚨 [HueRemoteClient] Token expired, refreshing and retrying...');
        await this.refreshAccessToken();
        return await this.attemptRequest<T>(method, path, body, true);
      }
      
      throw new Error(`Hue Remote API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Check if the error indicates token expiry
   */
  private isTokenExpiredError(status: number, errorText: string): boolean {
    if (status === 401) {
      // Any 401 from the Hue Remote API likely means token issues
      return (
        errorText.includes('expired') ||
        errorText.includes('invalid_access_token') ||
        errorText.includes('unauthorized user') ||
        errorText.includes('Unauthorized') ||
        errorText.trim() === '' // Empty error text with 401 also indicates auth issues
      );
    }
    return false;
  }

  /**
   * Test connection to Remote API
   */
  async testConnection(): Promise<{ success: boolean; bridgeInfo?: any; error?: string }> {
    try {
      const config = await this.makeRequest<any>('GET', '/config');
      return {
        success: true,
        bridgeInfo: {
          name: config.name,
          modelid: config.modelid,
          apiversion: config.apiversion,
          mac: config.mac,
          bridgeid: config.bridgeid,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all scenes from Remote API
   */
  async getScenes(): Promise<Record<string, HueScene>> {
    return this.makeRequest<Record<string, HueScene>>('GET', '/scenes');
  }

  /**
   * Activate a scene by ID
   */
  async activateScene(sceneId: string, groupId: string = "0"): Promise<void> {
    await this.makeRequest('PUT', `/groups/${groupId}/action`, {
      scene: sceneId
    });
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<Record<string, any>> {
    return this.makeRequest<Record<string, any>>('GET', '/lights');
  }


  /**
   * Set group state (for color control fallback)
   */
  async setGroupState(groupId: string = "0", state: any): Promise<void> {
    await this.makeRequest('PUT', `/groups/${groupId}/action`, state);
  }

  /**
   * Static factory method to create from environment variables or database
   */
  static async fromEnv(): Promise<HueRemoteClient | null> {
    const enabled = process.env.HUE_REMOTE_ENABLED === 'true';
    const bridgeId = process.env.HUE_REMOTE_USERNAME; // Bridge ID 
    const apiUsername = process.env.HUE_REMOTE_API_USERNAME; // Bridge user for API calls
    const apiUrl = process.env.HUE_REMOTE_API_URL;

    if (!enabled) {
      return null;
    }

    // Load tokens from database
    const tokenStorage = createTokenStorage();
    const tokens = await tokenStorage.getTokens('hue_remote');
    
    if (!tokens) {
      return null;
    }
    
    // Use API username if available, otherwise fall back to bridge ID
    const username = apiUsername || bridgeId;
    
    if (!username) {
      throw new Error('HUE_REMOTE_API_USERNAME is required for Remote API access');
    }

    return new HueRemoteClient({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      username,
      apiUrl,
      tokenStorage,
    });
  }
}