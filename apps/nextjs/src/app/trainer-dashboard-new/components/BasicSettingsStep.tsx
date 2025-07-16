import type { WorkoutParameters } from '../types';

interface BasicSettingsStepProps {
  workoutParams: WorkoutParameters;
  onChange: (params: WorkoutParameters) => void;
}

export function BasicSettingsStep({ workoutParams, onChange }: BasicSettingsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Session Goal
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ ...workoutParams, sessionGoal: 'strength' })}
            className={`px-4 py-3 rounded-lg border-2 transition-all ${
              workoutParams.sessionGoal === 'strength'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium">Strength</div>
            <div className="text-xs text-gray-600 mt-1">Focus on building strength</div>
          </button>
          <button
            onClick={() => onChange({ ...workoutParams, sessionGoal: 'stability' })}
            className={`px-4 py-3 rounded-lg border-2 transition-all ${
              workoutParams.sessionGoal === 'stability'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium">Stability</div>
            <div className="text-xs text-gray-600 mt-1">Focus on stability & control</div>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Intensity Level
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['low', 'moderate', 'high'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onChange({ ...workoutParams, intensity: level })}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                workoutParams.intensity === level
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="font-medium capitalize">{level}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Workout Template
        </label>
        <div className="space-y-3">
          {[
            { value: 'standard', label: 'Standard', description: 'Traditional workout structure' },
            { value: 'circuit', label: 'Circuit', description: 'Circuit-style training' },
            { value: 'full_body', label: 'Full Body', description: 'Comprehensive full body workout' }
          ].map((template) => (
            <button
              key={template.value}
              onClick={() => onChange({ ...workoutParams, template: template.value as WorkoutParameters['template'] })}
              className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                workoutParams.template === template.value
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className={`font-medium ${
                workoutParams.template === template.value ? 'text-indigo-700' : ''
              }`}>
                {template.label}
              </div>
              <div className="text-xs text-gray-600 mt-1">{template.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}