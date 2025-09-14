#!/usr/bin/env node

// Standalone script to populate spotify_tracks table
// Run with: node scripts/populate-spotify-tracks.js

const fs = require('fs');
const path = require('path');

// Rest tracks to add
const REST_TRACKS = [
  "spotify:track:2gmqnkY0jrfz3vnO4FVS4p",
  "spotify:track:66hLgDd6kk3GfzLej7t2eH",
  "spotify:track:2GrIebBWhOlOVe7yykx50i",
  "spotify:track:1ezVmdzA61xULe4dx1Slba",
  "spotify:track:7I079hnzaP3BNu5Ra7h6q4",
  "spotify:track:0EhihOUNnUG2rK9Z7ao4i5",
  "spotify:track:0xn6LxYghEct04MQTcrtrJ",
  "spotify:track:7h2yzh9vIBxSBN3885QyQt",
  "spotify:track:56Q2OtRzToYHKxU9p6XWsn",
  "spotify:track:4JR9blNFjAUiybd7RLYfkx",
  "spotify:track:1eU3EhUwOa4a3qCM45HogQ",
  "spotify:track:0GSEIffBQyILlI6FPzn6G0",
  "spotify:track:5HumzUY33Lrl13NUjGGKr8",
  "spotify:track:6PwW1zy9hmcP1VqqJaTcvo",
  "spotify:track:7HX3ubSk3OVg7ymt5UCYpL",
  "spotify:track:7iSuMiRlJNceKCE3ES6HBr",
  "spotify:track:1zmxmacvgIcfC9VtKJ1SFl",
  "spotify:track:2TCyoBUM7MNalMXmEQRlX8",
  "spotify:track:3OWBvbyAMnKuZLviZ82hIr",
  "spotify:track:0b79SWKCzxsKmuG5CBmeDs",
  "spotify:track:6ZW8f8xNkauNEKBQthQaas",
  "spotify:track:08iD88iFwW334KopqK0b8u",
  "spotify:track:7eRU4hubXFooI0Qa7qouXM",
  "spotify:track:322Be9xdBaPhiB8rX6BVls",
  "spotify:track:21CDBaCTL0ZVJCSZNpBHFe",
  "spotify:track:0IP3Dd9qchwml3dwBRnlda",
  "spotify:track:2346Isr3M7QwGz5XyMeagQ",
  "spotify:track:5lf8XNZKRv6rtbPzGoGd7S",
  "spotify:track:4V7VTQQWHOCGNRy7iaFHLS",
  "spotify:track:0auEaQZbRnomyp95qDher2",
  "spotify:track:2hpdKwumbBoIkq5zaoXVOu",
  "spotify:track:1FSqeugQ1A697oAv8EZ516",
  "spotify:track:2PVhk6KhiF4yKXFVCACZuG",
  "spotify:track:3GJpQY3I6YTgL3TtvvxmNm",
  "spotify:track:0fPdM4EC9Fyh7Wk6SWVTht",
  "spotify:track:5NsejBqTH83xlbKFdjScSw",
  "spotify:track:6NiEYy97bODtt7ntvUmlvp",
  "spotify:track:57sEnzGIfUU3BYAo8uvezv",
  "spotify:track:4DVgIpxVlwCGKP4fwgetWM",
  "spotify:track:10oQuQIQaOs6tExGsQnifs"
];

// Music config with all the tracks
const SPOTIFY_MUSIC_CONFIG = {
  tracks: {
    workout: [
      {
        spotifyId: "spotify:track:56YasbqXFzP3ErHyhLtn26",
        skipOutro: 162,
      },
      {
        spotifyId: "spotify:track:2pwYfIGr9Jmk6HpbDDMrpe",
        hypeTimestamp: 6,
        skipOutro: 163,
      },
      {
        spotifyId: "spotify:track:1mL3MVPYMXMXx8vB93ytTP",
        hypeTimestamp: 31,
        skipOutro: 96,
      },
      {
        spotifyId: "spotify:track:55wFmVPoWFRwdyFw3ngSRz",
        hypeTimestamp: 15,
        skipOutro: 110,
      },
      {
        spotifyId: "spotify:track:1oWpZUAbdXCJt9ZNN6nFOG",
        hypeTimestamp: 17,
        skipOutro: 159,
      },
      {
        spotifyId: "spotify:track:2Q1bfpjE2DwKnn6yLIYZdZ",
        skipOutro: 160,
      },
      {
        spotifyId: "spotify:track:0GHY3CW19K5KqIBjrJdZGz",
        skipOutro: 123,
      },
      {
        spotifyId: "spotify:track:469LAygB7nTl7CCDbnniaR",
      },
      {
        spotifyId: "spotify:track:6NVlLjo4Y4eaNYkXv4tScU",
        hypeTimestamp: 5,
      },
      {
        spotifyId: "spotify:track:6AlQ5HtGrPQO7M20pTtsf5",
        hypeTimestamp: 28,
        skipOutro: 197,
      },
      {
        spotifyId: "spotify:track:3mtfe81bb7wsMtQPbWpOMY",
        hypeTimestamp: 13,
        skipOutro: 144,
      },
      {
        spotifyId: "spotify:track:6868cDsJrSGPyYnO8HPxHZ",
        hypeTimestamp: 10,
        skipOutro: 148,
      },
      {
        spotifyId: "spotify:track:57Il3OuTJdiF42Qwz1A17n",
        hypeTimestamp: 11,
        skipOutro: 184,
      },
      {
        spotifyId: "spotify:track:4MgpHcDBkz2k84ao1BrBHK",
        hypeTimestamp: 5,
        skipOutro: 232,
      },
      {
        spotifyId: "spotify:track:27SV91JVfJNMvvDoCu5IM7",
        hypeTimestamp: 17,
      },
      {
        spotifyId: "spotify:track:2CQNa8WplamGGPnMpSlFt6",
        skipOutro: 164,
      },
      {
        spotifyId: "spotify:track:2ImsqbD8uYAwKH358qcGie",
        hypeTimestamp: 15,
        skipOutro: 144,
      },
      {
        spotifyId: "spotify:track:0PgnIPWS1eQh1SbneVtFDB",
      },
      {
        spotifyId: "spotify:track:7Jerd3W7J7CvqX6SeYiF3K",
        hypeTimestamp: 12,
      },
      {
        spotifyId: "spotify:track:6qTRyyctUgRWY5HqbndlAs",
        hypeTimestamp: 10,
        skipOutro: 160,
      },
      {
        spotifyId: "spotify:track:1sYPiSou59AOcqM7Dwi8wv",
        hypeTimestamp: 4,
      },
      {
        spotifyId: "spotify:track:6PjYVEj03iPG81ZfwA9D3y",
        hypeTimestamp: 20,
      },
      {
        spotifyId: "spotify:track:2Cy8awXmK3RJvwZrDHIqOj",
        skipOutro: 182,
      },
      {
        spotifyId: "spotify:track:4xmrP0u72ox9OJ1cgJzZpQ",
        hypeTimestamp: 19,
      },
      {
        spotifyId: "spotify:track:2pTIbtODPQ9dtQuD3rPaTp",
        hypeTimestamp: 20,
      },
      {
        spotifyId: "spotify:track:57TsydrFWLVhEFtJZTVcWB",
        hypeTimestamp: 5,
        skipOutro: 156,
      },
      {
        spotifyId: "spotify:track:2TCgkRY4Og8Q0I52ksHDyG",
        skipOutro: 156,
      },
      {
        spotifyId: "spotify:track:2Yz9Rtpswoz6JIHItcULU5",
      },
      {
        spotifyId: "spotify:track:1QRxu30D9RdCpff2VpJWY7",
      },
      {
        spotifyId: "spotify:track:3WN17zGd3yNhnHrRx15dXh",
        hypeTimestamp: 5,
        skipOutro: 149,
      },
      {
        spotifyId: "spotify:track:7JiUCSSulfaJJEKWiZjVNG",
        skipOutro: 132,
      },
      {
        spotifyId: "spotify:track:6YbsIDsK3A58cogFEXHlvY",
        hypeTimestamp: 18,
        skipOutro: 175,
      },
      {
        spotifyId: "spotify:track:4EC3Ug5LdFDCYI8AXtXsZx",
        hypeTimestamp: 6,
        skipOutro: 151,
      },
    ],
  }
};

// Get Spotify access token using client credentials
async function getSpotifyAccessToken(clientId, clientSecret) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch track details from Spotify
async function fetchTrackDetails(trackIds, accessToken) {
  // Extract just the track ID from the full URI
  const ids = trackIds.map(uri => uri.replace('spotify:track:', '')).join(',');
  
  const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${ids}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tracks: ${response.statusText}`);
  }

  const data = await response.json();
  return data.tracks;
}

// Escape single quotes for SQL
function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// Load environment variables from .env file
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.error('Warning: Could not load .env file:', error.message);
  }
}

// Fetch tracks in batches (Spotify API limit is 50 per request)
async function fetchTracksInBatches(trackUris, accessToken) {
  const batchSize = 50;
  const allTracks = [];
  
  for (let i = 0; i < trackUris.length; i += batchSize) {
    const batch = trackUris.slice(i, i + batchSize);
    console.log(`Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(trackUris.length/batchSize)} (${batch.length} tracks)...`);
    const tracks = await fetchTrackDetails(batch, accessToken);
    allTracks.push(...tracks);
  }
  
  return allTracks;
}

// Main function
async function main() {
  // Load environment variables
  loadEnv();
  
  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env file');
    process.exit(1);
  }

  console.log('Getting Spotify access token...');
  const accessToken = await getSpotifyAccessToken(CLIENT_ID, CLIENT_SECRET);
  
  // Process workout tracks
  console.log('\n=== Processing Workout Tracks ===');
  const workoutTracks = SPOTIFY_MUSIC_CONFIG.tracks.workout;
  const workoutUris = workoutTracks.map(t => t.spotifyId);
  const spotifyWorkoutTracks = await fetchTracksInBatches(workoutUris, accessToken);
  console.log(`Fetched ${spotifyWorkoutTracks.length} workout tracks from Spotify`);

  // Process rest tracks
  console.log('\n=== Processing Rest Tracks ===');
  const spotifyRestTracks = await fetchTracksInBatches(REST_TRACKS, accessToken);
  console.log(`Fetched ${spotifyRestTracks.length} rest tracks from Spotify`);

  // Generate SQL statements
  const sqlStatements = [];
  
  // Create a map of our config by spotify ID for easy lookup
  const configMap = {};
  workoutTracks.forEach(track => {
    configMap[track.spotifyId] = track;
  });

  // Process workout tracks
  spotifyWorkoutTracks.forEach((track, index) => {
    if (!track) {
      console.warn(`Workout track at index ${index} returned null from Spotify`);
      return;
    }

    const spotifyId = `spotify:track:${track.id}`;
    const config = configMap[spotifyId];
    
    // Format artists as comma-separated string
    const artists = track.artists.map(a => a.name).join(', ');
    
    // Determine usage based on hypeTimestamp
    const usage = config.hypeTimestamp ? '{"hype"}' : '{"bridge"}';
    
    // Build the SQL statement
    const values = [
      `'${spotifyId}'`, // spotify_id
      `'${escapeSql(track.name)}'`, // name
      `'${escapeSql(artists)}'`, // artist
      track.duration_ms, // duration_ms
      `'{}'::text[]`, // genres (empty array)
      `'${usage}'::text[]`, // usage based on hypeTimestamp
      config.hypeTimestamp || 'NULL', // hype_timestamp
      config.skipOutro || 'NULL', // skip_outro
    ];

    const sql = `INSERT INTO spotify_tracks (spotify_id, name, artist, duration_ms, genres, usage, hype_timestamp, skip_outro) VALUES (${values.join(', ')});`;
    sqlStatements.push(sql);
  });

  // Process rest tracks
  spotifyRestTracks.forEach((track, index) => {
    if (!track) {
      console.warn(`Rest track at index ${index} returned null from Spotify`);
      return;
    }

    const spotifyId = `spotify:track:${track.id}`;
    
    // Format artists as comma-separated string
    const artists = track.artists.map(a => a.name).join(', ');
    
    // Build the SQL statement
    const values = [
      `'${spotifyId}'`, // spotify_id
      `'${escapeSql(track.name)}'`, // name
      `'${escapeSql(artists)}'`, // artist
      track.duration_ms, // duration_ms
      `'{}'::text[]`, // genres (empty array)
      `'{"rest"}'::text[]`, // usage for rest tracks
      'NULL', // hype_timestamp
      'NULL', // skip_outro
    ];

    const sql = `INSERT INTO spotify_tracks (spotify_id, name, artist, duration_ms, genres, usage, hype_timestamp, skip_outro) VALUES (${values.join(', ')});`;
    sqlStatements.push(sql);
  });

  // Write to file
  const outputPath = path.join(__dirname, 'spotify_tracks_insert.sql');
  const sqlContent = [
    '-- Generated SQL to populate spotify_tracks table',
    `-- Generated on: ${new Date().toISOString()}`,
    `-- Total workout tracks: ${spotifyWorkoutTracks.length}`,
    `-- Total rest tracks: ${spotifyRestTracks.length}`,
    `-- Total tracks: ${sqlStatements.length}`,
    '',
    '-- Workout tracks (hype and bridge)',
    ...sqlStatements.slice(0, spotifyWorkoutTracks.length),
    '',
    '-- Rest tracks',
    ...sqlStatements.slice(spotifyWorkoutTracks.length)
  ].join('\n');

  fs.writeFileSync(outputPath, sqlContent);
  console.log(`\nSQL file generated: ${outputPath}`);
  console.log(`Total tracks: ${sqlStatements.length} (${spotifyWorkoutTracks.length} workout + ${spotifyRestTracks.length} rest)`);
  console.log('\nYou can now run this SQL file in your database.');
}

// Run the script
main().catch(console.error);