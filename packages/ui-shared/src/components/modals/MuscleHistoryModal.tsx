"use client";

import React, { useState } from 'react';
import { BaseModal } from './BaseModal';

interface MuscleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
}

// Hardcoded workout history data
const WORKOUT_HISTORY = [
  { date: '2025-08-23', muscle: 'Chest' },
  { date: '2025-08-24', muscle: 'Quads' },
  { date: '2025-08-24', muscle: 'Glutes' },
  { date: '2025-08-25', muscle: 'Back' },
  { date: '2025-08-26', muscle: 'Shoulders' },
  { date: '2025-08-27', muscle: 'Core' },
  { date: '2025-08-28', muscle: 'Quads' },
  { date: '2025-08-29', muscle: 'Back' }
];

// Simplified muscle groups for UI (unified from 13 system muscles)
const MUSCLES = [
  'Glutes',      // Unified: Glutes + Hips
  'Quads', 
  'Hamstrings', 
  'Calves',
  'Core',        // Unified: Core + Obliques
  'Chest', 
  'Shoulders',   // Unified: Shoulders + Traps
  'Back',
  'Biceps',
  'Triceps'
];

const MUSCLE_GROUPS = {
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  core: ['Core']
};

// Mapping from system muscles to simplified UI muscles
const MUSCLE_UNIFICATION: Record<string, string> = {
  'Hips': 'Glutes',
  'Obliques': 'Core',
  'Traps': 'Shoulders'
};

type TimeRange = '7' | '14' | '30' | 'custom';

export const MuscleHistoryModal: React.FC<MuscleHistoryModalProps> = ({
  isOpen,
  onClose,
  clientName
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7');
  const [isWeeklyMode, setIsWeeklyMode] = useState(true); // Default to This Week

  // Calculate date range and muscle coverage
  const calculateCoverage = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;

    if (isWeeklyMode) {
      // This week mode (Monday to Sunday)
      const day = today.getDay();
      const offset = day === 0 ? 6 : day - 1;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - offset);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      // Rolling window mode
      endDate = today;
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (Number(selectedRange) - 1));
    }

    // Filter workouts in date range
    const workoutsInRange = WORKOUT_HISTORY.filter(workout => {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate >= startDate && workoutDate <= endDate;
    });

    // Count workouts per muscle (with unification)
    const muscleCounts = Object.fromEntries(MUSCLES.map(m => [m, 0]));
    workoutsInRange.forEach(workout => {
      // Check if this muscle should be unified to another
      const unifiedMuscle = MUSCLE_UNIFICATION[workout.muscle] || workout.muscle;
      
      if (muscleCounts[unifiedMuscle] !== undefined) {
        muscleCounts[unifiedMuscle]++;
      }
    });

    return { startDate, endDate, muscleCounts };
  };

  const { startDate, endDate, muscleCounts } = calculateCoverage();

  const formatDateRange = (start: Date, end: Date) => {
    const formatDate = (date: Date) => 
      `${date.toLocaleString('en-US', { month: 'short' })} ${date.getDate()}`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isWeeklyMode) {
      // Format as "This Week (Mon–Today)" when appropriate
      const isCurrentWeek = end.getTime() >= today.getTime();
      
      if (isCurrentWeek && start.getDay() === 1) {
        return `This Week (Mon–Today)`;
      }
      return `${formatDate(start)} – ${formatDate(end)}`;
    }
    return `Last ${selectedRange} days • ${formatDate(start)} – ${formatDate(end)}`;
  };

  const MuscleProgressDots = ({ count }: { count: number }) => (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            count > i ? 'bg-green-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );

  const MuscleCard = ({ muscle, count }: { muscle: string; count: number }) => (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
        count === 0 
          ? 'border-red-500 bg-red-50' 
          : 'border-gray-200 bg-white'
      }`}
    >
      <span className="text-sm font-semibold text-gray-900">{muscle}</span>
      <MuscleProgressDots count={count} />
    </div>
  );

  const content = (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4">
        {/* Date range label */}
        <p className="text-sm text-gray-600 mb-4">
          {formatDateRange(startDate, endDate)}
        </p>

        {/* Time range selector */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2 mr-auto">
            <button
              onClick={() => {
                setIsWeeklyMode(!isWeeklyMode);
                setSelectedRange('7');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isWeeklyMode 
                  ? 'border-gray-300 bg-gray-100 text-gray-900' 
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">📅</span>
              This Week
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedRange('7');
              setIsWeeklyMode(false);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '7' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => {
              setSelectedRange('14');
              setIsWeeklyMode(false);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '14' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            14d
          </button>
          <button
            onClick={() => {
              setSelectedRange('30');
              setIsWeeklyMode(false);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '30' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            30d
          </button>
        </div>

        {/* Coverage section */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Coverage</h3>

          {/* Upper Body */}
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Upper Body
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {MUSCLE_GROUPS.upper.map(muscle => (
                <MuscleCard 
                  key={muscle} 
                  muscle={muscle} 
                  count={muscleCounts[muscle] || 0} 
                />
              ))}
            </div>
          </div>

          {/* Lower Body */}
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Lower Body
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {MUSCLE_GROUPS.lower.map(muscle => (
                <MuscleCard 
                  key={muscle} 
                  muscle={muscle} 
                  count={muscleCounts[muscle] || 0} 
                />
              ))}
            </div>
          </div>

          {/* Core */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Core
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {MUSCLE_GROUPS.core.map(muscle => (
                <MuscleCard 
                  key={muscle} 
                  muscle={muscle} 
                  count={muscleCounts[muscle] || 0} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Targets to Hit"
      className="max-h-[90vh]"
    >
      {content}
    </BaseModal>
  );
};