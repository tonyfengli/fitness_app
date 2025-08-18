interface ProgressIndicatorProps {
  currentStep: number;
  steps: {
    number: number;
    label: string;
  }[];
}

export function ProgressIndicator({
  currentStep,
  steps,
}: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-2">
      {steps.map((step, index) => {
        const isActive = currentStep >= step.number;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.number} className="flex items-center">
            <div
              className={`flex items-center ${isActive ? "text-indigo-600" : "text-gray-400"}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isActive ? "bg-indigo-600 text-white" : "bg-gray-200"
                }`}
              >
                {step.number}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  isActive ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-2 h-0.5 w-16 ${
                  currentStep > step.number ? "bg-indigo-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
