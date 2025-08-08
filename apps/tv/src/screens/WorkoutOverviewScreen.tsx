import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '../App';

export function WorkoutOverviewScreen({ route }: any) {
  const navigation = useNavigation();
  const { sessionId } = route.params;

  // TODO: Implement the full workout overview UI
  // For now, just a placeholder that navigates to workout live

  return (
    <View className="flex-1 bg-gray-50 p-safe-x py-safe-y items-center justify-center">
      <Text className="text-tv-2xl font-bold text-gray-900 mb-8">
        Workout Overview
      </Text>
      <Text className="text-tv-lg text-gray-600 mb-8">
        Session: {sessionId}
      </Text>
      
      <TouchableOpacity
        onPress={() => navigation.navigate('WorkoutLive', { sessionId, round: 1 })}
        className="px-12 py-6 bg-green-600 rounded-lg"
      >
        <Text className="text-tv-xl font-semibold text-white">
          Start Workout
        </Text>
      </TouchableOpacity>
    </View>
  );
}