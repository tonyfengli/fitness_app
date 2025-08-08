import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '../App';

export function WorkoutLiveScreen({ route }: any) {
  const navigation = useNavigation();
  const { sessionId, round } = route.params;
  const [timeLeft, setTimeLeft] = useState(299); // 4:59

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // TODO: Implement the full workout live UI with exercise stations
  // For now, showing a simplified timer view

  return (
    <View className="flex-1 bg-gray-50 p-safe-x py-safe-y">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-12">
        <Text className="text-tv-2xl font-bold text-gray-900">Round {round}</Text>
        
        {/* Timer */}
        <View className="items-center">
          <Text className="text-tv-5xl font-bold text-gray-900">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* Exercise Stations Placeholder */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-tv-xl text-gray-600 mb-8">
          Exercise stations will appear here
        </Text>
      </View>

      {/* Navigation */}
      <View className="flex-row justify-between">
        <TouchableOpacity
          onPress={() => {
            if (round > 1) {
              navigation.setParams({ round: round - 1 });
            } else {
              navigation.goBack();
            }
          }}
          className="px-8 py-4 bg-gray-600 rounded-lg"
        >
          <Text className="text-tv-lg font-semibold text-white">
            {round > 1 ? 'Previous Round' : 'Back'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            navigation.setParams({ round: round + 1 });
          }}
          className="px-8 py-4 bg-indigo-600 rounded-lg"
        >
          <Text className="text-tv-lg font-semibold text-white">
            Next Round
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}