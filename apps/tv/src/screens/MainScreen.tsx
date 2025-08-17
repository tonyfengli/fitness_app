import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useBusiness } from '../providers/BusinessProvider';
import { useAuth } from '../providers/AuthProvider';

// Design tokens - matching TV app theme
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    card2: '#0e1620',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
    danger: '#ef4444',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    button: 14,
    chip: 999,
  },
};

interface SessionDetails {
  name: string;
  coach: string;
  start: string;
  code: string;
}

export function MainScreen() {
  const { businessId } = useBusiness();
  const { user, isLoading: isAuthLoading, isAuthenticated, error: authError, retry } = useAuth();
  const [currentSession, setCurrentSession] = useState<SessionDetails | null>(null);
  const [environment, setEnvironment] = useState<'prod' | 'dev'>('prod');

  const createSession = () => {
    const newSession: SessionDetails = {
      name: environment === 'prod' ? 'Gym Session' : 'Dev Test Session',
      coach: 'Coach A.',
      start: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      code: Math.random().toString(36).substring(2, 6).toUpperCase()
    };
    setCurrentSession(newSession);
  };

  const endSession = () => {
    setCurrentSession(null);
  };

  // Show loading state
  if (isAuthLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show error state
  if (authError || !isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorMessage}>
          {authError?.message || 'Failed to authenticate. Please check your connection.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => retry()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Normal view - authenticated
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.createButton} onPress={createSession}>
          <Text style={styles.createButtonText}>+ Create New Session</Text>
        </TouchableOpacity>
        
        {/* Environment Toggle */}
        <View style={styles.segmented}>
          <TouchableOpacity 
            style={[styles.segmentOption, environment === 'dev' && styles.segmentActive]}
            onPress={() => setEnvironment('dev')}
          >
            <Text style={[styles.segmentText, environment === 'dev' && styles.segmentTextActive]}>Developer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.segmentOption, environment === 'prod' && styles.segmentActive]}
            onPress={() => setEnvironment('prod')}
          >
            <Text style={[styles.segmentText, environment === 'prod' && styles.segmentTextActive]}>Gym</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.card}>
          {currentSession ? (
            <View>
              <View style={styles.detailsGrid}>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>Session</Text>
                  <Text style={styles.kvValue}>{currentSession.name}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>Coach</Text>
                  <Text style={styles.kvValue}>{currentSession.coach}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>Start</Text>
                  <Text style={styles.kvValue}>{currentSession.start}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>Join Code</Text>
                  <Text style={styles.kvValue}>{currentSession.code}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.createButton, styles.dangerButton]} onPress={endSession}>
                <Text style={styles.createButtonText}>End Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>There's currently no active session.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.color.bg,
    padding: 32,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 24,
    color: TOKENS.color.text,
  },
  errorTitle: {
    fontSize: 32,
    color: TOKENS.color.text,
    marginBottom: 16,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 18,
    color: TOKENS.color.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: TOKENS.color.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: TOKENS.radius.button,
  },
  retryButtonText: {
    color: TOKENS.color.text,
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: TOKENS.color.accent,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: TOKENS.radius.button,
    shadowColor: TOKENS.color.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  createButtonText: {
    color: '#051015',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dangerButton: {
    backgroundColor: TOKENS.color.danger,
    shadowColor: TOKENS.color.danger,
  },
  segmented: {
    backgroundColor: TOKENS.color.card,
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: TOKENS.radius.chip,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
  },
  segmentOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: TOKENS.radius.chip,
  },
  segmentActive: {
    backgroundColor: 'rgba(124,255,181,0.16)',
    borderColor: 'rgba(124,255,181,0.45)',
    borderWidth: 1,
    transform: [{ translateY: -1 }],
  },
  segmentText: {
    fontSize: 18,
    letterSpacing: 0.2,
    color: TOKENS.color.muted,
  },
  segmentTextActive: {
    color: TOKENS.color.text,
  },
  mainContent: {
    flex: 1,
  },
  card: {
    backgroundColor: TOKENS.color.card,
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kv: {
    backgroundColor: '#0c131b',
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    minHeight: 64,
    width: '24%',
  },
  kvLabel: {
    fontSize: 12,
    color: TOKENS.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  kvValue: {
    fontSize: 22,
    fontWeight: '600',
    color: TOKENS.color.text,
  },
  emptyState: {
    textAlign: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    borderColor: '#284054',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#0b121a',
  },
  emptyStateText: {
    color: TOKENS.color.muted,
    fontSize: 20,
    textAlign: 'center',
  },
});