"use client";

export default function AddExercisePage() {
  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex-shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <button className="flex items-center text-blue-600">
            <span className="material-icons">arrow_back_ios</span>
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Add Exercise</h1>
          <div className="w-16"></div>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto px-4">
        <div className="relative mb-4">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Search exercises..."
            type="text"
          />
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Chest</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Bench Press</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Dumbbell Flyes</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Back</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Pull-ups</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Barbell Rows</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Deadlifts</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Legs</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Squats</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Leg Press</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center">
                  <div className="mr-3 rounded-full bg-gray-200 p-2">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Lunges</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <button className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">
          Add to Workout
        </button>
      </footer>
    </div>
  );
}
