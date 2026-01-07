import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/realtime-js';

interface TrainingSession {
  id: string;
  businessId: string;
  templateType: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'draft';
  scheduledAt: Date | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  trainerId: string | null;
  trainer?: {
    id: string;
    name: string;
    email: string;
  };
}

interface UseRealtimeTrainingSessionsOptions {
  businessId: string;
  supabase: SupabaseClient;
  onUpdate?: (session: TrainingSession, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onError?: (error: Error) => void;
}

export function useRealtimeTrainingSessions({
  businessId,
  supabase,
  onUpdate,
  onError
}: UseRealtimeTrainingSessionsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Store callbacks in refs to avoid re-subscribing
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  }, [onUpdate, onError]);

  useEffect(() => {
    if (!businessId) return;

    console.log('[useRealtimeTrainingSessions] 🚀 Setting up subscription for businessId:', businessId);

    // 100ms delay to avoid rapid re-renders
    const timeoutId = setTimeout(() => {
      
      const channel = supabase
        .channel(`training-sessions-${businessId}`)
        .on('postgres_changes', {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'training_session',
          filter: `business_id=eq.${businessId}`,
        }, (payload) => {
          console.log('[useRealtimeTrainingSessions] 📨 PAYLOAD:', payload.eventType, payload.new?.id || payload.old?.id);
          
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            // Determine which record to process
            const record = newRecord || oldRecord;
            if (!record) {
              console.warn('[useRealtimeTrainingSessions] ⚠️ No record in payload');
              return;
            }

            // Check if this record matches our businessId filter
            if (record.business_id !== businessId) {
              console.warn('[useRealtimeTrainingSessions] ⚠️ BusinessId mismatch:', record.business_id, 'vs', businessId);
              return;
            }

            // Transform the record to match our interface
            const session: TrainingSession = {
              id: record.id,
              businessId: record.business_id,
              templateType: record.template_type,
              status: record.status,
              scheduledAt: record.scheduled_at ? new Date(record.scheduled_at) : null,
              name: record.name,
              createdAt: new Date(record.created_at),
              updatedAt: new Date(record.updated_at),
              trainerId: record.trainer_id,
            };

            console.log('[useRealtimeTrainingSessions] ✅ Calling onUpdate:', eventType, session.name);

            // Call the update callback
            onUpdateRef.current?.(session, eventType as 'INSERT' | 'UPDATE' | 'DELETE');
          } catch (err) {
            console.error('[useRealtimeTrainingSessions] Error processing payload:', err);
            const errorMsg = 'Failed to process training session update';
            setError(errorMsg);
            onErrorRef.current?.(new Error(errorMsg));
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
            console.log('[useRealtimeTrainingSessions] ✅ CONNECTED');
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            const errorMsg = 'Failed to connect to training sessions updates';
            setError(errorMsg);
            onErrorRef.current?.(new Error(errorMsg));
            console.error('[useRealtimeTrainingSessions] ❌ CHANNEL ERROR');
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false);
            const errorMsg = 'Connection timed out';
            setError(errorMsg);
            onErrorRef.current?.(new Error(errorMsg));
            console.error('[useRealtimeTrainingSessions] ⏰ TIMED OUT');
          }
        });

      channelRef.current = channel;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [businessId, supabase]);

  return {
    isConnected,
    error,
  };
}