"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { StandardGroupWorkoutBlueprint } from "@acme/ai";
import type { GroupContext } from "@acme/ai";

interface StandardTemplateViewProps {
  groupContext: GroupContext;
  blueprint: StandardGroupWorkoutBlueprint;
  summary: any;
  generateWorkout: () => void;
  isGenerating: boolean;
  router: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  llmDebugData: any;
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function StandardTemplateView({
  groupContext,
  blueprint,
  summary,
  generateWorkout,
  isGenerating,
  router,
  activeTab,
  setActiveTab,
  llmDebugData
}: StandardTemplateViewProps) {
  // Create tab options: one per client + shared tab
  const clientTabs = groupContext.clients.map(client => ({
    id: client.user_id,
    name: client.name,
    type: 'client' as const
  }));
  
  const allTabs = [
    ...clientTabs,
    { id: 'shared', name: 'Shared Exercises', type: 'shared' as const }
  ];

  // State for client sub-tabs
  const [clientSubTabs, setClientSubTabs] = useState<Record<string, 'all' | 'selected'>>({});
  
  const setClientSubTab = (clientId: string, tab: 'all' | 'selected') => {
    setClientSubTabs(prev => ({ ...prev, [clientId]: tab }));
  };
  
  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Set default tab if none selected
  useEffect(() => {
    if (!activeTab && allTabs.length > 0) {
      setActiveTab(allTabs[0].id);
    }
  }, [activeTab, allTabs, setActiveTab]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Standard Group Workout</h1>
            <p className="text-lg text-gray-600 mt-1">
              Exercise pools for {summary.totalClients} clients
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateWorkout}
              disabled={isGenerating}
              className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate Workout'}
            </button>
            <button
              onClick={() => router.push(`/session-lobby?sessionId=${groupContext.sessionId}`)}
              className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              Back to Lobby
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {allTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-b-2 border-indigo-500 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Client Exercise Tables */}
            {clientTabs.map(clientTab => {
              if (activeTab !== clientTab.id) return null;
              
              const client = groupContext.clients.find(c => c.user_id === clientTab.id);
              const pool = blueprint.clientExercisePools[clientTab.id];
              
              if (!client || !pool) return null;

              return (
                <div key={clientTab.id}>
                  {/* Client Info Header */}
                  <div className="mb-6 flex items-start gap-4">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                      alt={client.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{client.name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Goal:</span> {formatMuscleName(client.primary_goal || 'general_fitness')}
                        </div>
                        <div>
                          <span className="font-medium">Intensity:</span> {client.intensity}
                        </div>
                        {client.muscle_target && client.muscle_target.length > 0 && (
                          <div>
                            <span className="font-medium">Target Muscles:</span> {client.muscle_target.map(formatMuscleName).join(', ')}
                          </div>
                        )}
                        {client.muscle_lessen && client.muscle_lessen.length > 0 && (
                          <div>
                            <span className="font-medium">Avoid Muscles:</span> {client.muscle_lessen.map(formatMuscleName).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Client Exercise Tabs */}
                  <div className="mb-4">
                    <div className="border-b border-gray-200">
                      <nav className="flex -mb-px">
                        <button
                          onClick={() => setClientSubTab(clientTab.id, 'all')}
                          className={`px-4 py-2 text-sm font-medium ${
                            (clientSubTabs[clientTab.id] || 'all') === 'all'
                              ? 'border-b-2 border-indigo-500 text-indigo-600'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          All Exercises
                        </button>
                        <button
                          onClick={() => setClientSubTab(clientTab.id, 'selected')}
                          className={`px-4 py-2 text-sm font-medium ${
                            clientSubTabs[clientTab.id] === 'selected'
                              ? 'border-b-2 border-indigo-500 text-indigo-600'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Selected Exercises (Top 8)
                        </button>
                      </nav>
                    </div>
                  </div>

                  {/* All Exercises Tab */}
                  {(clientSubTabs[clientTab.id] || 'all') === 'all' && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Exercise Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Movement Pattern
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Primary Muscle
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Secondary Muscles
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score Breakdown
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                        {/* Placeholder Pre-assigned Exercises */}
                        <tr className="bg-purple-50">
                          <td className="px-4 py-2 text-sm text-gray-900">1</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">Barbell Back Squat</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Squat</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Glutes</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Quads, Hamstrings</td>
                          <td className="px-4 py-2 text-sm text-gray-900">-</td>
                          <td className="px-4 py-2 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Pre-assigned (deterministic)
                            </span>
                          </td>
                        </tr>
                        <tr className="bg-purple-50">
                          <td className="px-4 py-2 text-sm text-gray-900">2</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">Pull-ups</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Vertical Pull</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Lats</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Biceps, Middle Back</td>
                          <td className="px-4 py-2 text-sm text-gray-900">-</td>
                          <td className="px-4 py-2 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Pre-assigned (deterministic)
                            </span>
                          </td>
                        </tr>
                        
                        {/* Available Candidates */}
                        {pool.availableCandidates.map((exercise, idx) => {
                          const scoreBreakdown = exercise.scoreBreakdown || {};
                          const isShared = blueprint.sharedExercisePool.some(
                            shared => shared.id === exercise.id
                          );
                          
                          // Build score breakdown badges
                          const breakdownBadges = [];
                          
                          if (scoreBreakdown.includeExerciseBoost > 0) {
                            breakdownBadges.push(
                              <span key="include" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Include +{scoreBreakdown.includeExerciseBoost.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.muscleTargetBonus > 0) {
                            const isPrimary = scoreBreakdown.muscleTargetBonus >= 3.0;
                            breakdownBadges.push(
                              <span key="target" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Target {isPrimary ? '' : '(2nd)'} +{scoreBreakdown.muscleTargetBonus.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.muscleLessenPenalty < 0) {
                            const isPrimary = scoreBreakdown.muscleLessenPenalty <= -3.0;
                            breakdownBadges.push(
                              <span key="lessen" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Lessen {isPrimary ? '' : '(2nd)'} {scoreBreakdown.muscleLessenPenalty.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.intensityAdjustment > 0) {
                            breakdownBadges.push(
                              <span key="intensity" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Intensity +{scoreBreakdown.intensityAdjustment.toFixed(2)}
                              </span>
                            );
                          }
                          
                          return (
                            <tr key={exercise.id} className={idx < 6 ? 'bg-blue-50' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {idx + 3}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {exercise.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {formatMuscleName(exercise.movementPattern || '')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {formatMuscleName(exercise.primaryMuscle || '')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 
                                  ? exercise.secondaryMuscles.map(formatMuscleName).join(', ')
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                {exercise.score.toFixed(1)}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <div className="flex flex-wrap gap-1">
                                  {breakdownBadges.length > 0 ? breakdownBadges : (
                                    <span className="text-gray-400 text-xs">Base score</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <p>* Purple rows: Pre-assigned exercises (2)</p>
                        <p>* Blue rows: Top 6 exercises to be selected by LLM</p>
                        <p>* Total workout: 8 exercises (2 pre-assigned + 6 selected)</p>
                      </div>
                    </>
                  )}

                  {/* Selected Exercises Tab - Constraint Analysis */}
                  {clientSubTabs[clientTab.id] === 'selected' && (
                    <div>
                      {/* Constraint Summary */}
                      <div className="mb-6 bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Constraint Analysis for Selected Exercises</h4>
                        
                        <div className="space-y-4">
                          {/* Function Tag Coverage */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => toggleSection(`${clientTab.id}-function`)}
                                className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                              >
                                <span className={`transition-transform ${expandedSections[`${clientTab.id}-function`] ? 'rotate-90' : ''}`}>▶</span>
                                Function Tag
                              </button>
                              {(() => {
                                if (!client.muscle_target || client.muscle_target.length === 0) return null;
                                const selectedExercises = [
                                  { name: 'Barbell Back Squat', primaryMuscle: 'glutes', secondaryMuscles: ['quads', 'hamstrings'] },
                                  { name: 'Pull-ups', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'middle_back'] },
                                  ...pool.availableCandidates.slice(0, 6)
                                ];
                                const targetsCovered = client.muscle_target.filter(target => 
                                  selectedExercises.some(ex => 
                                    ex.primaryMuscle === target || 
                                    (ex.secondaryMuscles && ex.secondaryMuscles.includes(target))
                                  )
                                ).length;
                                const percentage = Math.round((targetsCovered / client.muscle_target.length) * 100);
                                return (
                                  <span className={`text-xs font-medium ${percentage === 100 ? 'text-green-600' : percentage >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {targetsCovered}/{client.muscle_target.length} targets ({percentage}%)
                                  </span>
                                );
                              })()}
                            </div>
                            {expandedSections[`${clientTab.id}-function`] && (
                              <div className="space-y-2 mt-2">
                                {(() => {
                                  const functionCategories = [
                                    { name: 'Strength', tags: ['primary_strength', 'secondary_strength', 'accessory'] },
                                    { name: 'Core', tags: ['core'] },
                                    { name: 'Capacity', tags: ['capacity'] }
                                  ];
                                  const selectedExercises = [
                                    { name: 'Barbell Back Squat', functionTags: ['primary_strength'] },
                                    { name: 'Pull-ups', functionTags: ['primary_strength', 'secondary_strength'] },
                                    ...pool.availableCandidates.slice(0, 6)
                                  ];
                                  
                                  return functionCategories.map(category => {
                                    const coverageExercises = selectedExercises.filter(ex => 
                                      ex.functionTags && ex.functionTags.some(tag => category.tags.includes(tag))
                                    );
                                    
                                    const coverageCount = coverageExercises.length;
                                    const maxExpected = category.name === 'Strength' ? 6 : 2; // Different expectations per category
                                    const percentage = Math.min(100, (coverageCount / maxExpected) * 100);
                                    
                                    return (
                                      <div key={category.name}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="text-gray-600">{category.name}</span>
                                          <span className={`font-medium ${coverageCount >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                                            {coverageCount} exercise{coverageCount !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div 
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                              coverageCount === 0 ? 'bg-red-500' : 
                                              coverageCount < maxExpected ? 'bg-yellow-500' : 
                                              'bg-green-500'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                          
                          {/* Muscle Coverage */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => toggleSection(`${clientTab.id}-muscle`)}
                                className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                              >
                                <span className={`transition-transform ${expandedSections[`${clientTab.id}-muscle`] ? 'rotate-90' : ''}`}>▶</span>
                                Muscle
                              </button>
                              {(() => {
                                const selectedExercises = [
                                  { movementPattern: 'squat' },
                                  { movementPattern: 'vertical_pull' },
                                  ...pool.availableCandidates.slice(0, 6)
                                ];
                                const patternCounts = selectedExercises.reduce((acc, ex) => {
                                  const pattern = ex.movementPattern || 'unknown';
                                  acc[pattern] = (acc[pattern] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>);
                                const uniquePatterns = Object.keys(patternCounts).length;
                                const varietyScore = Math.round((uniquePatterns / 8) * 100); // Target 8 unique patterns
                                
                                return (
                                  <span className={`text-xs font-medium ${uniquePatterns >= 6 ? 'text-green-600' : uniquePatterns >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {uniquePatterns} unique patterns
                                  </span>
                                );
                              })()}
                            </div>
                            {expandedSections[`${clientTab.id}-muscle`] && (
                              <div className="space-y-2 mt-2">
                                {(() => {
                                  const muscleGroups = ['chest', 'back', 'legs', 'biceps', 'triceps', 'shoulders', 'core'];
                                  const selectedExercises = [
                                    { name: 'Barbell Back Squat', primaryMuscle: 'glutes', secondaryMuscles: ['quads', 'hamstrings'] },
                                    { name: 'Pull-ups', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'middle_back'] },
                                    ...pool.availableCandidates.slice(0, 6)
                                  ];
                                  
                                  return muscleGroups.map(muscle => {
                                    const muscleMapping: Record<string, string[]> = {
                                      'chest': ['chest', 'pectorals'],
                                      'back': ['lats', 'middle_back', 'upper_back', 'lower_back', 'rhomboids', 'traps'],
                                      'legs': ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'adductors', 'abductors'],
                                      'biceps': ['biceps'],
                                      'triceps': ['triceps'],
                                      'shoulders': ['shoulders', 'delts', 'deltoids', 'anterior_delts', 'lateral_delts', 'posterior_delts'],
                                      'core': ['abs', 'core', 'obliques', 'transverse_abs']
                                    };
                                    
                                    const targetMuscles = muscleMapping[muscle] || [muscle];
                                    const coverageExercises = selectedExercises.filter(ex => 
                                      targetMuscles.some(target => 
                                        ex.primaryMuscle === target || 
                                        (ex.secondaryMuscles && ex.secondaryMuscles.includes(target))
                                      )
                                    );
                                    
                                    const coverageCount = coverageExercises.length;
                                    const maxExpected = 3;
                                    const percentage = Math.min(100, (coverageCount / maxExpected) * 100);
                                    
                                    return (
                                      <div key={muscle}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="text-gray-600">{muscle.charAt(0).toUpperCase() + muscle.slice(1)}</span>
                                          <span className={`font-medium ${coverageCount >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                                            {coverageCount} exercise{coverageCount !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div 
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                              coverageCount === 0 ? 'bg-red-500' : 
                                              coverageCount === 1 ? 'bg-yellow-500' : 
                                              'bg-green-500'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                          
                          {/* Movement Pattern */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => toggleSection(`${clientTab.id}-movement`)}
                                className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                              >
                                <span className={`transition-transform ${expandedSections[`${clientTab.id}-movement`] ? 'rotate-90' : ''}`}>▶</span>
                                Movement Pattern
                              </button>
                              {(() => {
                                const selectedExercises = [
                                  { movementPattern: 'squat' },
                                  { movementPattern: 'vertical_pull' },
                                  ...pool.availableCandidates.slice(0, 6)
                                ];
                                const patternCounts = selectedExercises.reduce((acc, ex) => {
                                  const pattern = ex.movementPattern || 'unknown';
                                  acc[pattern] = (acc[pattern] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>);
                                const uniquePatterns = Object.keys(patternCounts).length;
                                
                                return (
                                  <span className={`text-xs font-medium ${uniquePatterns >= 6 ? 'text-green-600' : uniquePatterns >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {uniquePatterns} unique patterns
                                  </span>
                                );
                              })()}
                            </div>
                            {expandedSections[`${clientTab.id}-movement`] && (
                              <div className="space-y-2 mt-2">
                                {(() => {
                                  const selectedExercises = [
                                    { movementPattern: 'squat' },
                                    { movementPattern: 'vertical_pull' },
                                    ...pool.availableCandidates.slice(0, 6)
                                  ];
                                  
                                  const patternCounts = selectedExercises.reduce((acc, ex) => {
                                    const pattern = ex.movementPattern || 'unknown';
                                    acc[pattern] = (acc[pattern] || 0) + 1;
                                    return acc;
                                  }, {} as Record<string, number>);
                                  
                                  const maxCount = Math.max(...Object.values(patternCounts));
                                  
                                  return Object.entries(patternCounts)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([pattern, count]) => {
                                      const percentage = (count / maxCount) * 100;
                                      const isOverused = count > 2;
                                      
                                      return (
                                        <div key={pattern}>
                                          <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-600">{formatMuscleName(pattern)}</span>
                                            <span className={`font-medium ${isOverused ? 'text-orange-600' : 'text-gray-600'}`}>
                                              {count}x {isOverused && '⚠️'}
                                            </span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                              className={`h-2 rounded-full transition-all duration-300 ${
                                                isOverused ? 'bg-orange-500' : 'bg-blue-500'
                                              }`}
                                              style={{ width: `${percentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    });
                                })()}
                              </div>
                            )}
                          </div>
                          
                          {/* Constraint Compliance */}
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Constraint Compliance</h5>
                            <div className="space-y-2">
                              {(() => {
                                const constraints = [];
                                
                                // Muscle Lessen Check
                                if (client.muscle_lessen && client.muscle_lessen.length > 0) {
                                  const violations = pool.availableCandidates.slice(0, 6).filter(ex => 
                                    client.muscle_lessen.includes(ex.primaryMuscle) ||
                                    (ex.secondaryMuscles && ex.secondaryMuscles.some(m => client.muscle_lessen.includes(m)))
                                  );
                                  constraints.push({
                                    name: 'Avoid Muscle Violations',
                                    status: violations.length === 0 ? 'pass' : 'fail',
                                    detail: violations.length === 0 ? 'No violations' : `${violations.length} exercise${violations.length > 1 ? 's' : ''} violate constraint`,
                                    severity: 'high'
                                  });
                                }
                                
                                // Shared Exercise Check
                                const hasShared = pool.availableCandidates.slice(0, 6).some(ex => 
                                  blueprint.sharedExercisePool.some(shared => shared.id === ex.id)
                                );
                                constraints.push({
                                  name: 'Shared Exercise Requirement',
                                  status: hasShared ? 'pass' : 'warning',
                                  detail: hasShared ? 'Has shared exercises' : 'Only pre-assigned shared',
                                  severity: 'medium'
                                });
                                
                                // Muscle Target Coverage
                                if (client.muscle_target && client.muscle_target.length > 0) {
                                  const selectedExercises = [
                                    { primaryMuscle: 'glutes', secondaryMuscles: ['quads', 'hamstrings'] },
                                    { primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'middle_back'] },
                                    ...pool.availableCandidates.slice(0, 6)
                                  ];
                                  const uncoveredTargets = client.muscle_target.filter(target => 
                                    !selectedExercises.some(ex => 
                                      ex.primaryMuscle === target || 
                                      (ex.secondaryMuscles && ex.secondaryMuscles.includes(target))
                                    )
                                  );
                                  constraints.push({
                                    name: 'Muscle Coverage',
                                    status: uncoveredTargets.length === 0 ? 'pass' : 'fail',
                                    detail: uncoveredTargets.length === 0 ? 'All targets covered' : `Missing: ${uncoveredTargets.map(formatMuscleName).join(', ')}`,
                                    severity: 'high'
                                  });
                                }
                                
                                // Workout Flow
                                constraints.push({
                                  name: 'Workout Flow',
                                  status: 'pass',
                                  detail: 'Strength → Metabolic progression',
                                  severity: 'low'
                                });
                                
                                return constraints.map(constraint => (
                                  <div key={constraint.name} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                        constraint.status === 'pass' ? 'bg-green-100' : 
                                        constraint.status === 'warning' ? 'bg-yellow-100' : 
                                        'bg-red-100'
                                      }`}>
                                        {constraint.status === 'pass' ? (
                                          <span className="text-green-600 text-xs">✓</span>
                                        ) : constraint.status === 'warning' ? (
                                          <span className="text-yellow-600 text-xs">!</span>
                                        ) : (
                                          <span className="text-red-600 text-xs">✗</span>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-700">{constraint.name}</span>
                                    </div>
                                    <span className={`text-xs ${
                                      constraint.status === 'pass' ? 'text-gray-600' : 
                                      constraint.status === 'warning' ? 'text-yellow-600' : 
                                      'text-red-600'
                                    }`}>
                                      {constraint.detail}
                                    </span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Selected Exercises Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Order
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Exercise Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Function Tag
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pattern
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Primary Muscle
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Secondary Muscles
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Shared?
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {/* Pre-assigned exercises */}
                            <tr className="bg-purple-50">
                              <td className="px-4 py-2 text-sm text-gray-900">1</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">Barbell Back Squat</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Primary Strength</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Squat</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Glutes</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Quads, Hamstrings</td>
                              <td className="px-4 py-2 text-sm">
                                <span className="text-gray-400 text-xs">-</span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">-</td>
                            </tr>
                            <tr className="bg-purple-50">
                              <td className="px-4 py-2 text-sm text-gray-900">2</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">Pull-ups</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Primary Strength</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Vertical Pull</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Lats</td>
                              <td className="px-4 py-2 text-sm text-gray-600">Biceps, Middle Back</td>
                              <td className="px-4 py-2 text-sm">
                                <span className="text-gray-400 text-xs">-</span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">-</td>
                            </tr>
                            
                            {/* Selected exercises */}
                            {pool.availableCandidates.slice(0, 6).map((exercise, idx) => {
                              const isShared = blueprint.sharedExercisePool.some(
                                shared => shared.id === exercise.id
                              );
                              const role = idx < 2 ? 'Primary Strength' : idx < 4 ? 'Conditioning' : 'Metabolic Finisher';
                              
                              return (
                                <tr key={exercise.id} className={idx < 4 ? 'bg-blue-50' : ''}>
                                  <td className="px-4 py-2 text-sm text-gray-900">{idx + 3}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{exercise.name}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {exercise.functionTags && exercise.functionTags.length > 0
                                      ? exercise.functionTags.map(tag => tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')
                                      : 'Accessory'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {formatMuscleName(exercise.movementPattern || '')}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {formatMuscleName(exercise.primaryMuscle || '')}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 
                                      ? exercise.secondaryMuscles.map(formatMuscleName).join(', ')
                                      : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    {isShared ? (
                                      <span className="text-green-600 text-xs">✓ Shared</span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">Individual</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                    {exercise.score.toFixed(1)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Summary */}
                      <div className="mt-4 text-sm text-gray-600">
                        <p className="font-medium">Selection Summary:</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          <li>• 2 pre-assigned exercises (lower body + pull)</li>
                          <li>• 2 primary strength exercises (typically push/hinge patterns)</li>
                          <li>• 2 conditioning exercises (varied patterns)</li>
                          <li>• 2 metabolic finishers (high intensity, often shared)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Shared Exercises Tab */}
            {activeTab === 'shared' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  Shared Exercise Pool ({blueprint.sharedExercisePool.length} exercises)
                </h3>
                <p className="text-gray-600 mb-6">
                  These exercises can be performed by multiple clients and may be selected to increase group cohesion.
                </p>

                {/* Smart Bucketing Analysis for Shared Pool */}
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Shared Pool Smart Bucketing</h4>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {/* Movement Pattern Distribution */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Movement Patterns</h5>
                      <div className="space-y-1">
                        {(() => {
                          const patterns = blueprint.sharedExercisePool.reduce((acc, ex) => {
                            const pattern = ex.movementPattern || 'unknown';
                            acc[pattern] = (acc[pattern] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          return Object.entries(patterns)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([pattern, count]) => (
                              <div key={pattern} className="flex justify-between text-xs">
                                <span className="text-gray-600">{formatMuscleName(pattern)}</span>
                                <span className="text-gray-900 font-medium">{count}</span>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                    
                    {/* Client Sharing Distribution */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Client Sharing</h5>
                      <div className="space-y-1">
                        {(() => {
                          const distribution = blueprint.sharedExercisePool.reduce((acc, ex) => {
                            const count = ex.clientsSharing.length;
                            const key = `${count} client${count > 1 ? 's' : ''}`;
                            acc[key] = (acc[key] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          return Object.entries(distribution)
                            .sort(([a], [b]) => parseInt(b) - parseInt(a))
                            .map(([sharing, count]) => (
                              <div key={sharing} className="flex justify-between text-xs">
                                <span className="text-gray-600">{sharing}</span>
                                <span className="text-gray-900 font-medium">{count} exercises</span>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                    
                    {/* Selection Strategy */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Selection Priority</h5>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>1. Take top 2 per movement pattern</p>
                        <p>2. Ensure 3-5 per function type</p>
                        <p>3. Verify muscle diversity</p>
                        <p className="text-gray-900 font-medium mt-2">
                          Target: {Math.floor(blueprint.sharedExercisePool.length * 0.4)} exercises (40%)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exercise Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Movement Pattern
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Primary Muscle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Secondary Muscles
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Group Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clients
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {blueprint.sharedExercisePool.map((exercise, idx) => (
                        <tr key={exercise.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {exercise.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {formatMuscleName(exercise.movementPattern || '')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {formatMuscleName(exercise.primaryMuscle || '')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 
                              ? exercise.secondaryMuscles.map(formatMuscleName).join(', ')
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {exercise.groupScore.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {exercise.clientsSharing.map(clientId => {
                                const client = groupContext.clients.find(c => c.user_id === clientId);
                                return (
                                  <span
                                    key={clientId}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {client?.name || clientId}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}