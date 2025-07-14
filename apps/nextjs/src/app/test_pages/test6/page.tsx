"use client";

export default function AddExercisePage() {
  return (
    <div className="bg-white h-screen flex flex-col">
      <header className="px-4 py-3 flex-shrink-0">
        <div className="flex justify-between items-center">
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
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="Search exercises..." type="text"/>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Chest</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <p className="font-medium text-gray-800">Bench Press</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Back</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <p className="font-medium text-gray-800">Pull-ups</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <p className="font-medium text-gray-800">Barbell Rows</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Legs</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <p className="font-medium text-gray-800">Squats</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <p className="font-medium text-gray-800">Leg Press</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <span className="material-icons">add_circle_outline</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-200 rounded-full mr-3">
                    <span className="material-icons text-gray-600">fitness_center</span>
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
      <footer className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
        <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300">Add to Workout</button>
      </footer>
    </div>
  );
}