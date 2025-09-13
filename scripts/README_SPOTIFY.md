# Spotify Tracks Population Script

## Setup

1. Make sure you have your Spotify credentials set as environment variables:
   ```bash
   export SPOTIFY_CLIENT_ID="your_client_id"
   export SPOTIFY_CLIENT_SECRET="your_client_secret"
   ```

   Or check your `.env` file in the project root.

2. Run the script:
   ```bash
   cd scripts
   node populate-spotify-tracks.js
   ```

   Or using npm script:
   ```bash
   npm run populate-spotify
   ```

3. The script will generate `spotify_tracks_insert.sql` in the scripts directory.

4. Run the generated SQL file in your database to populate the tracks.

## What it does

- Fetches track metadata from Spotify API (name, artist, duration)
- Preserves existing hypeTimestamp and skipOutro values from the config
- Generates INSERT statements for all tracks
- Outputs to `spotify_tracks_insert.sql`