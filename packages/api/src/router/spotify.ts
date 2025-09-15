import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { spotifyAuth } from "../services/spotify-auth";

export const spotifyRouter = createTRPCRouter({
  // Get available Spotify Connect devices
  getDevices: protectedProcedure.query(async () => {
    console.log('[Spotify API] getDevices called');
    try {
      const response = await spotifyAuth.makeSpotifyRequest('/me/player/devices');
      
      console.log('[Spotify API] Devices response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Spotify API] Devices error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to get devices: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json() as any;
      console.log('[Spotify API] Devices data:', {
        devices: data.devices || [],
        deviceCount: data.devices?.length || 0
      });
      
      return {
        devices: data.devices || [],
        activeDevice: data.devices?.find((d: any) => d.is_active) || null,
      };
    } catch (error) {
      console.error('[Spotify API] Failed to get devices - full error:', error);
      throw new Error('Failed to get Spotify devices');
    }
  }),

  // Public version of getDevices for circuit config
  getDevicesPublic: publicProcedure.query(async () => {
    console.log('[Spotify API] getDevicesPublic called');
    try {
      const response = await spotifyAuth.makeSpotifyRequest('/me/player/devices');
      
      console.log('[Spotify API] Devices response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Spotify API] Devices error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to get devices: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json() as any;
      console.log('[Spotify API] Devices data:', {
        devices: data.devices || [],
        deviceCount: data.devices?.length || 0
      });
      
      return {
        devices: data.devices || [],
        activeDevice: data.devices?.find((d: any) => d.is_active) || null,
      };
    } catch (error) {
      console.error('[Spotify API] Failed to get devices - full error:', error);
      throw new Error('Failed to get Spotify devices');
    }
  }),


  // Control playback (play, pause)
  control: publicProcedure
    .input(z.object({
      action: z.enum(['play', 'pause']),
      deviceId: z.string().optional(),
      trackUri: z.string().optional(),
      positionMs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        switch (input.action) {
          case 'play': {
            const body: any = {};
            if (input.trackUri) {
              body.uris = [input.trackUri];
            }
            if (input.positionMs !== undefined) {
              body.position_ms = input.positionMs;
            }
            
            console.log('[Spotify API] Play request:', {
              deviceId: input.deviceId,
              trackUri: input.trackUri,
              positionMs: input.positionMs,
              body: JSON.stringify(body)
            });
            
            const response = await spotifyAuth.makeSpotifyRequest(
              `/me/player/play${input.deviceId ? `?device_id=${input.deviceId}` : ''}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              }
            );
            
            if (!response.ok && response.status !== 204) {
              const error = await response.text();
              throw new Error(`Play failed: ${error}`);
            }
            break;
          }
          
          case 'pause': {
            const response = await spotifyAuth.makeSpotifyRequest(
              `/me/player/pause${input.deviceId ? `?device_id=${input.deviceId}` : ''}`,
              { method: 'PUT' }
            );
            
            if (!response.ok && response.status !== 204) {
              const error = await response.text();
              throw new Error(`Pause failed: ${error}`);
            }
            break;
          }
        }
        
        return { success: true };
      } catch (error) {
        console.error(`[Spotify] ${input.action} failed:`, error);
        throw error;
      }
    }),

  // Set volume
  setVolume: publicProcedure
    .input(z.object({
      volumePercent: z.number().min(0).max(100),
      deviceId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await spotifyAuth.makeSpotifyRequest(
          `/me/player/volume?volume_percent=${input.volumePercent}${input.deviceId ? `&device_id=${input.deviceId}` : ''}`,
          { method: 'PUT' }
        );
        
        if (!response.ok && response.status !== 204) {
          const error = await response.text();
          console.warn(`[Spotify] Volume control failed: ${error}`);
          // Don't throw - just log and continue
          return { success: false, error };
        }
        
        return { success: true };
      } catch (error) {
        console.warn('[Spotify] Volume control error:', error);
        // Don't throw - volume control is not critical
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }),


  // Search for low energy Christian rap tracks (now actually high energy)
  searchLowEnergyChristianRap: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(50),
    }))
    .query(async ({ input }) => {
      try {
        console.log('[Spotify API] Searching for high energy Christian rap tracks - will fetch 200 total');
        
        // Try different search terms to find more Christian rap
        const searchTerms = ['christian hip hop', 'christian rap', 'gospel rap', 'holy hip hop'];
        const searchQuery = encodeURIComponent(searchTerms.join(' OR '));
        const allTracks: any[] = [];
        const tracksPerRequest = 50; // Spotify max per request
        const totalRequests = 1; // Just 1 x 50 = 50 tracks for now
        
        // Make multiple requests with offset for pagination
        for (let i = 0; i < totalRequests; i++) {
          const offset = i * tracksPerRequest;
          console.log(`[Spotify API] Fetching tracks ${offset + 1}-${offset + tracksPerRequest}`);
          
          const searchResponse = await spotifyAuth.makeSpotifyRequest(
            `/search?q=${searchQuery}&type=track&limit=${tracksPerRequest}&offset=${offset}`
          );
          
          if (!searchResponse.ok) {
            console.error(`[Spotify API] Search failed for offset ${offset}`);
            continue; // Skip this batch but continue with others
          }
          
          const searchData = await searchResponse.json() as any;
          const batchTracks = searchData.tracks?.items || [];
          console.log(`[Spotify API] Batch ${i + 1}: found ${batchTracks.length} tracks`);
          
          allTracks.push(...batchTracks);
        }
        
        console.log(`[Spotify API] Total tracks collected: ${allTracks.length}`);
        
        if (allTracks.length === 0) {
          console.log('[Spotify API] No tracks found across all searches');
          return { tracks: [], message: 'No Christian rap tracks found' };
        }
        
        // Remove duplicates by track ID
        const uniqueTracks = Array.from(
          new Map(allTracks.map(track => [track.id, track])).values()
        );
        console.log(`[Spotify API] Unique tracks after deduplication: ${uniqueTracks.length}`);
        
        const tracks = uniqueTracks;
        
        // Get audio features in batches (Spotify allows max 100 per request)
        const allAudioFeatures: any[] = [];
        const featuresPerRequest = 100;
        const featureBatches = Math.ceil(tracks.length / featuresPerRequest);
        
        console.log(`[Spotify API] Fetching audio features in ${featureBatches} batches`);
        
        for (let i = 0; i < featureBatches; i++) {
          const start = i * featuresPerRequest;
          const end = Math.min((i + 1) * featuresPerRequest, tracks.length);
          const batchTracks = tracks.slice(start, end);
          const batchIds = batchTracks.map((track: any) => track.id).join(',');
          
          const featuresResponse = await spotifyAuth.makeSpotifyRequest(
            `/audio-features?ids=${batchIds}`
          );
          
          if (!featuresResponse.ok) {
            console.error(`[Spotify API] Failed to get audio features for batch ${i + 1}`);
            // Add null features for this batch
            allAudioFeatures.push(...new Array(batchTracks.length).fill(null));
            continue;
          }
          
          const featuresData = await featuresResponse.json() as any;
          const batchFeatures = featuresData.audio_features || [];
          allAudioFeatures.push(...batchFeatures);
          
          console.log(`[Spotify API] Batch ${i + 1}: got ${batchFeatures.length} audio features`);
        }
        
        const audioFeatures = allAudioFeatures;
        
        // Combine track data with audio features and filter for low energy
        const tracksWithFeatures = tracks
          .map((track: any, index: number) => {
            const features = audioFeatures[index];
            if (!features) return null;
            
            return {
              id: track.id,
              name: track.name,
              artists: track.artists.map((a: any) => a.name).join(', '),
              album: track.album.name,
              uri: track.uri,
              duration_ms: track.duration_ms,
              preview_url: track.preview_url,
              // Audio features
              energy: features.energy,
              valence: features.valence,
              tempo: features.tempo,
              danceability: features.danceability,
              acousticness: features.acousticness,
              speechiness: features.speechiness,
              instrumentalness: features.instrumentalness,
            };
          })
          .filter((track: any) => track !== null)
          // Filter for HIGH energy characteristics
          .filter((track: any) => {
            // If we don't have audio features, exclude the track
            if (track.energy === null || track.energy === undefined) return false;
            
            return track.energy > 0.7 && // High energy
                   track.danceability > 0.7; // High danceability
          })
          // Sort by energy (highest first)
          .sort((a: any, b: any) => {
            if (a.energy === null || a.energy === undefined) return 1;
            if (b.energy === null || b.energy === undefined) return -1;
            return b.energy - a.energy; // Reversed for highest first
          });
        
        console.log(`[Spotify API] Found ${tracksWithFeatures.length} high energy Christian rap tracks out of ${tracks.length} searched`);
        
        // Log some sample tracks to see what we're filtering out
        if (tracks.length > 0 && tracksWithFeatures.length === 0) {
          console.log('[Spotify API] No tracks passed filter. Sample of what was filtered out:');
          tracks.slice(0, 5).forEach((track: any, index: number) => {
            const features = audioFeatures[index];
            if (features) {
              console.log(`  ${track.name}: energy=${features.energy}, tempo=${features.tempo}, dance=${features.danceability}`);
            }
          });
        }
        
        return {
          tracks: tracksWithFeatures,
          totalSearched: tracks.length,
          filtered: tracksWithFeatures.length,
        };
      } catch (error) {
        console.error('[Spotify API] Search error:', error);
        throw new Error('Failed to search for tracks');
      }
    }),

});