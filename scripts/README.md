# Scripts Directory

## get-spotify-refresh-token.js

This script helps you obtain a Spotify refresh token for the MVP. The refresh token allows the backend to authenticate with Spotify without user interaction.

### Prerequisites

1. Spotify Premium account (required for Connect API)
2. Spotify app credentials in `.env`:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`

### Usage

```bash
# From project root
pnpm spotify:auth

# Or directly
node scripts/get-spotify-refresh-token.js
```

### What it does

1. Starts a local server on port 8888
2. Opens Spotify OAuth login in your browser
3. After you log in, captures the authorization code
4. Exchanges it for a refresh token
5. Displays the refresh token and user ID

### Next steps

1. Copy the refresh token from the success page
2. Update your `.env` file:
   ```
   SPOTIFY_REFRESH_TOKEN="<your-refresh-token>"
   SPOTIFY_USER_ID="<your-user-id>"
   ```
3. Restart your development server

### Troubleshooting

- **Port 8888 already in use**: Kill any processes on that port or wait a moment
- **Invalid client**: Check your Client ID and Secret are correct
- **Scopes error**: The script requests all necessary scopes automatically

### Security Note

Never commit your refresh token to version control. Keep it in `.env` only.