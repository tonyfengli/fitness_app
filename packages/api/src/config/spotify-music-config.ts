export const SPOTIFY_MUSIC_CONFIG = {
  // Default device name to look for
  defaultDeviceName: "TV",
  
  // Track configuration for circuit training
  tracks: {
    warmup: {
      spotifyId: "spotify:track:1nBs6CyPsd9THOxqsuLt0M",
      startPosition: 0,
    },
    
    // High-energy workout tracks with hype timestamps (in seconds)
    workout: [
      {
        spotifyId: "spotify:track:1nBs6CyPsd9THOxqsuLt0M",
        hypeTimestamps: [30, 60, 90], // Default timestamps
        energy: "high",
      },
      {
        spotifyId: "spotify:track:35FW5OEe4p38LdjK1KqT2X",
        hypeTimestamps: [30, 60, 90], // Default timestamps
        energy: "high",
      },
    ],
    
    cooldown: {
      spotifyId: "spotify:track:35FW5OEe4p38LdjK1KqT2X",
      startPosition: 0,
    }
  },
  
  // Volume levels (0-100)
  volume: {
    work: 85,      // High energy during work
    rest: 45,      // Lower during rest
    cooldown: 35,  // Quiet for cooldown
    warmup: 60,    // Moderate for warmup
  },
  
  // Timing configuration
  timing: {
    roundStartOffset: -3000,  // Start music 3 seconds before round begins
    fadeInDuration: 2000,     // Fade in over 2 seconds
    fadeOutDuration: 3000,    // Fade out over 3 seconds
  },
  
  // Playback behavior
  behavior: {
    pauseDuringRest: false,         // Keep playing, just lower volume
    shuffleWorkoutTracks: false,    // Play in order for consistency
    loopIfShorterThanWorkout: true, // Loop playlist if workout is longer
  }
};

// Helper to get a workout track for a specific round
export function getWorkoutTrackForRound(roundIndex: number) {
  const tracks = SPOTIFY_MUSIC_CONFIG.tracks.workout;
  return tracks[roundIndex % tracks.length];
}

// Helper to get the best hype timestamp for a given duration
export function getHypeTimestampForDuration(track: typeof SPOTIFY_MUSIC_CONFIG.tracks.workout[0], duration: number) {
  // Find the best timestamp that allows the hype moment to play within the duration
  const validTimestamps = track.hypeTimestamps.filter(ts => ts + 10 < duration);
  return validTimestamps[0] || 0; // Default to start if no valid timestamp
}