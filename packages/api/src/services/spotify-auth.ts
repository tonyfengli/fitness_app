
class SpotifyAuthService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      console.log('[SpotifyAuth] Using cached token, expires at:', this.tokenExpiry);
      return this.accessToken;
    }

    console.log('[SpotifyAuth] Token expired or missing, refreshing...');

    // Refresh using hardcoded refresh token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

    console.log('[SpotifyAuth] Credentials check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      clientIdPreview: clientId?.substring(0, 10) + '...',
      refreshTokenPreview: refreshToken?.substring(0, 20) + '...'
    });

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Spotify credentials in environment variables');
    }

    const authString = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString('base64');

    console.log('[SpotifyAuth] Making token refresh request...');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    console.log('[SpotifyAuth] Token refresh response:', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SpotifyAuth] Token refresh failed:', {
        status: response.status,
        error: error
      });
      throw new Error(`Spotify token refresh failed: ${error}`);
    }

    const data = await response.json() as any;
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // Refresh 1 min early
    
    console.log('[SpotifyAuth] Token refreshed successfully, new expiry:', this.tokenExpiry);
    
    return this.accessToken!;
  }

  async makeSpotifyRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAccessToken();
    
    return fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

export const spotifyAuth = new SpotifyAuthService();