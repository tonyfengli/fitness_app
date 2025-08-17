import { useEffect, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';

/**
 * Hook that cleans up all Supabase real-time subscriptions when auth changes
 * This prevents subscriptions from the previous account from remaining active
 */
export function useAuthCleanup() {
  const { session } = useAuth();
  const previousSessionIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    const currentSessionId = session?.session?.id || null;
    const previousSessionId = previousSessionIdRef.current;
    
    // Only cleanup if session actually changed (not on first mount)
    if (previousSessionId !== null && previousSessionId !== currentSessionId) {
      console.log('[useAuthCleanup] 🔄 Session change detected');
      console.log('[useAuthCleanup] Previous session:', previousSessionId);
      console.log('[useAuthCleanup] Current session:', currentSessionId);
      
      // Get all active channels
      const channels = supabase.realtime.channels;
      console.log('[useAuthCleanup] 📡 Active channels before cleanup:', channels.length);
      
      if (channels.length > 0) {
        console.log('[useAuthCleanup] Channel details:');
        channels.forEach((channel) => {
          console.log(`[useAuthCleanup]   - ${channel.topic} (state: ${channel.state})`);
        });
        
        // Unsubscribe from all channels
        console.log('[useAuthCleanup] 🧹 Cleaning up all realtime subscriptions...');
        supabase.removeAllChannels();
        
        // Verify cleanup
        const remainingChannels = supabase.realtime.channels;
        console.log('[useAuthCleanup] ✅ Cleanup complete. Remaining channels:', remainingChannels.length);
      } else {
        console.log('[useAuthCleanup] No active channels to clean up');
      }
    }
    
    // Update the ref for next comparison
    previousSessionIdRef.current = currentSessionId;
  }, [session]);
}