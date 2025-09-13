-- Create spotify_tracks table for managing workout music
CREATE TABLE IF NOT EXISTS spotify_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotify_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    genres TEXT[] DEFAULT '{}',
    usage TEXT[] DEFAULT '{}',
    hype_timestamp INTEGER,
    skip_outro INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_spotify_tracks_updated_at 
    BEFORE UPDATE ON spotify_tracks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for common queries
CREATE INDEX idx_spotify_tracks_usage ON spotify_tracks USING GIN (usage);
CREATE INDEX idx_spotify_tracks_genres ON spotify_tracks USING GIN (genres);

-- Add check constraints
ALTER TABLE spotify_tracks 
ADD CONSTRAINT check_duration_positive CHECK (duration_ms > 0);

ALTER TABLE spotify_tracks 
ADD CONSTRAINT check_hype_timestamp_positive CHECK (hype_timestamp IS NULL OR hype_timestamp >= 0);

ALTER TABLE spotify_tracks 
ADD CONSTRAINT check_skip_outro_positive CHECK (skip_outro IS NULL OR skip_outro >= 0);

-- Add comments for documentation
COMMENT ON TABLE spotify_tracks IS 'Stores Spotify tracks used in workout sessions with timing metadata';
COMMENT ON COLUMN spotify_tracks.spotify_id IS 'Full Spotify URI (e.g., spotify:track:xxx)';
COMMENT ON COLUMN spotify_tracks.hype_timestamp IS 'Timestamp in seconds where the hype/high-energy moment begins';
COMMENT ON COLUMN spotify_tracks.skip_outro IS 'Timestamp in seconds where playback should skip to avoid silence';
COMMENT ON COLUMN spotify_tracks.usage IS 'Array of usage contexts: rest, bridge, roundStart, general';
COMMENT ON COLUMN spotify_tracks.genres IS 'Array of music genres for the track';