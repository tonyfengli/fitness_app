import type { WorkoutParameters } from "../types";

interface BasicSettingsStepProps {
  workoutParams: WorkoutParameters;
  onChange: (params: WorkoutParameters) => void;
}

export function BasicSettingsStep({
  workoutParams,
  onChange,
}: BasicSettingsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          Session Goal
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              onChange({ ...workoutParams, sessionGoal: "strength" })
            }
            className={`rounded-lg border-2 px-4 py-3 transition-all ${
              workoutParams.sessionGoal === "strength"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-medium">Strength</div>
            <div className="mt-1 text-xs text-gray-600">
              Focus on building strength
            </div>
          </button>
          <button
            onClick={() =>
              onChange({ ...workoutParams, sessionGoal: "stability" })
            }
            className={`rounded-lg border-2 px-4 py-3 transition-all ${
              workoutParams.sessionGoal === "stability"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-medium">Stability</div>
            <div className="mt-1 text-xs text-gray-600">
              Focus on stability & control
            </div>
          </button>
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          Intensity Level
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(["low", "moderate", "high"] as const).map((level) => (
            <button
              key={level}
              onClick={() => onChange({ ...workoutParams, intensity: level })}
              className={`rounded-lg border-2 px-4 py-3 transition-all ${
                workoutParams.intensity === level
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="font-medium capitalize">{level}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          Workout Template <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          {!workoutParams.template && (
            <p className="text-sm italic text-gray-500">
              Select a template to continue
            </p>
          )}
          {[
            {
              value: "standard",
              label: "Standard",
              description: "Traditional workout structure",
            },
            {
              value: "circuit",
              label: "Circuit",
              description: "Circuit-style training",
            },
            {
              value: "full_body",
              label: "Full Body",
              description: "Comprehensive full body workout",
            },
          ].map((template) => (
            <button
              key={template.value}
              onClick={() =>
                onChange({
                  ...workoutParams,
                  template: template.value as WorkoutParameters["template"],
                })
              }
              className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                workoutParams.template === template.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div
                className={`font-medium ${
                  workoutParams.template === template.value
                    ? "text-indigo-700"
                    : ""
                }`}
              >
                {template.label}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
