"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaseModal } from './BaseModal';

interface MuscleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientId: string;
  api: any; // tRPC client instance
}

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
  clientName,
  clientId,
  api
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7');
  const [isWeeklyMode, setIsWeeklyMode] = useState(true); // Default to This Week

  // Calculate date range
  const calculateDateRange = () => {
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

    return { startDate, endDate };
  };

  const { startDate, endDate } = calculateDateRange();

  // Fetch muscle coverage data using React Query
  const { data: muscleData, isLoading } = useQuery({
    ...api.muscleCoverage.getClientMuscleCoverage.queryOptions({
      clientId,
      startDate,
      endDate,
    }),
    enabled: isOpen && !!clientId,
    select: (data) => {
      // Process the muscle scores with unification
      const processedCounts: Record<string, number> = {};
      
      // Initialize all muscles to 0
      MUSCLES.forEach(muscle => {
        processedCounts[muscle] = 0;
      });

      // Add scores from API, applying unification
      if (data?.muscleScores) {
        Object.entries(data.muscleScores).forEach(([muscle, score]) => {
          const muscleKey = muscle.charAt(0).toUpperCase() + muscle.slice(1);
          const unifiedMuscle = MUSCLE_UNIFICATION[muscleKey] || muscleKey;
          
          if (processedCounts[unifiedMuscle] !== undefined) {
            processedCounts[unifiedMuscle] += score as number;
          }
        });
      }

      return processedCounts;
    }
  });

  const muscleCounts = muscleData || {};

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

  const MuscleProgressDots = ({ count }: { count: number }) => {
    // Calculate full and partial bubbles
    const fullBubbles = Math.floor(count);
    const hasPartialBubble = count % 1 !== 0;
    const partialValue = count % 1;
    
    // Show at least 3 bubbles for aesthetics, more if needed
    const totalBubbles = Math.max(3, Math.ceil(count));
    
    return (
      <div className="flex gap-1">
        {Array.from({ length: totalBubbles }, (_, i) => {
          let bubbleClass = 'h-2 w-2 rounded-full transition-all ';
          
          if (i < fullBubbles) {
            // Full green bubble
            bubbleClass += 'bg-green-500';
          } else if (i === fullBubbles && hasPartialBubble) {
            // Partial bubble with 30% opacity
            bubbleClass += 'bg-green-500 opacity-30';
          } else {
            // Empty bubble
            bubbleClass += 'bg-gray-200';
          }
          
          return <div key={i} className={bubbleClass} />;
        })}
      </div>
    );
  };

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
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading muscle data...</p>
            </div>
          </div>
        )}
        
        {/* Content when loaded */}
        {!isLoading && (
          <>
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
        </>
        )}
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