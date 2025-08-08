import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { useRealtimeStatus } from '@acme/ui-shared';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SessionLobby'>;

export function SessionLobbyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [sessionCode, setSessionCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // SMS check-in simulation - in real app, this would be from SMS
  const digitButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const handleDigitPress = (digit: string) => {
    if (sessionCode.length < 6) {
      setSessionCode(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    setSessionCode(prev => prev.slice(0, -1));
  };

  const handleCheckIn = async () => {
    if (sessionCode.length !== 6) return;

    setIsLoading(true);
    setError('');

    try {
      // In a real app, this would validate the session code via API
      // For now, we'll use the session code as a simplified session ID
      setCurrentSessionId(sessionCode);
    } catch (err) {
      setError('Invalid session code');
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for real-time updates when all clients are ready
  useRealtimeStatus({
    sessionId: currentSessionId || '',
    supabase,
    onStatusChange: (status) => {
      if (status.allClientsReady) {
        navigation.navigate('GlobalPreferences', { sessionId: currentSessionId! });
      }
    },
  });

  return (
    <View className="flex-1 bg-gray-50 p-safe-x py-safe-y">
      <View className="flex-1 items-center justify-center">
        <Text className="text-tv-3xl font-bold text-gray-900 mb-8">Enter Session Code</Text>
        
        {/* Code Display */}
        <View className="flex-row mb-12">
          {[...Array(6)].map((_, i) => (
            <View
              key={i}
              className={`w-20 h-24 mx-2 border-4 rounded-lg items-center justify-center ${
                i < sessionCode.length ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
              }`}
            >
              <Text className="text-tv-2xl font-bold text-gray-900">
                {sessionCode[i] || ''}
              </Text>
            </View>
          ))}
        </View>

        {error ? (
          <Text className="text-tv-base text-red-600 mb-4">{error}</Text>
        ) : null}

        {/* Number Pad */}
        <View className="w-full max-w-2xl">
          <View className="flex-row flex-wrap justify-center">
            {digitButtons.map((digit) => (
              <TouchableOpacity
                key={digit}
                onPress={() => handleDigitPress(digit)}
                className="w-32 h-24 m-2 bg-white rounded-lg border-2 border-gray-300 items-center justify-center"
                style={{ opacity: sessionCode.length >= 6 ? 0.5 : 1 }}
                disabled={sessionCode.length >= 6}
              >
                <Text className="text-tv-2xl font-semibold text-gray-900">{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row justify-center mt-4">
            <TouchableOpacity
              onPress={handleDelete}
              className="w-48 h-24 m-2 bg-gray-200 rounded-lg items-center justify-center"
              disabled={sessionCode.length === 0}
            >
              <Text className="text-tv-xl font-semibold text-gray-700">Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCheckIn}
              className={`w-48 h-24 m-2 rounded-lg items-center justify-center ${
                sessionCode.length === 6
                  ? 'bg-indigo-600'
                  : 'bg-gray-300'
              }`}
              disabled={sessionCode.length !== 6 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="large" />
              ) : (
                <Text className="text-tv-xl font-semibold text-white">Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Instructions */}
        <Text className="text-tv-base text-gray-600 mt-8 text-center">
          Enter the 6-digit code from your SMS to join the session
        </Text>
      </View>
    </View>
  );
}