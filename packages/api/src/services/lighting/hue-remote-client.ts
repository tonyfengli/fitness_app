// Using process.env directly like other lighting services

export interface HueRemoteClientConfig {
  accessToken: string;
  refreshToken: string;
  username: string;
  expiresAt: string;
  apiUrl?: string;
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
}

export class HueRemoteClient {
  private config: HueRemoteClientConfig;
  private apiUrl: string;

  constructor(config: HueRemoteClientConfig) {
    this.config = config;
    this.apiUrl = config.apiUrl || 'https://api.meethue.com';
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.config.expiresAt) return true;
    const expiryDate = new Date(this.config.expiresAt);
    const now = new Date();
    // Add 5 minute buffer before expiry
    const bufferMs = 5 * 60 * 1000;
    return (expiryDate.getTime() - bufferMs) <= now.getTime();
  }

  /**
   * Make authenticated API request to Remote Hue API
   */
  private async makeRequest<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    // Check token expiry (for future implementation)
    if (this.isTokenExpired()) {
      throw new Error('Access token expired. Manual refresh required.');
    }

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

    console.log(`[HueRemoteClient] ${method} ${url}`);

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hue Remote API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<T>;
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
   * Static factory method to create from environment variables
   */
  static fromEnv(): HueRemoteClient | null {
    const accessToken = process.env.HUE_REMOTE_ACCESS_TOKEN;
    const refreshToken = process.env.HUE_REMOTE_REFRESH_TOKEN;
    const username = process.env.HUE_REMOTE_USERNAME;
    const expiresAt = process.env.HUE_REMOTE_EXPIRES_AT;
    const apiUrl = process.env.HUE_REMOTE_API_URL;
    const enabled = process.env.HUE_REMOTE_ENABLED === 'true';

    if (!enabled || !accessToken || !refreshToken) {
      console.log('[HueRemoteClient] Remote API not configured or disabled');
      return null;
    }
    
    // Username might be empty from OAuth response, we'll use accessToken as fallback
    const actualUsername = username || accessToken;

    return new HueRemoteClient({
      accessToken,
      refreshToken,
      username: actualUsername,
      expiresAt: expiresAt || '',
      apiUrl,
    });
  }
}