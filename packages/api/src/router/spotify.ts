import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { spotifyAuth } from "../services/spotify-auth";
import { SPOTIFY_MUSIC_CONFIG } from "../config/spotify-music-config";

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


  // Control playback (play, pause only)
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

  // Get music configuration
  getMusicConfig: publicProcedure.query(() => {
    return SPOTIFY_MUSIC_CONFIG;
  }),

});