"use client";

export default function FitProEditProgram() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-3">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons mr-2 text-blue-600">
              fitness_center
            </span>
            <h1 className="text-xl font-bold text-gray-800">FitPro</h1>
          </div>
          <button className="relative">
            <span className="material-icons text-gray-600">notifications</span>
            <span className="absolute right-0 top-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
        </header>
        <main>
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <div className="flex items-center">
              <img
                alt="Profile picture of Olivia Carter"
                className="mr-4 h-12 w-12 rounded-full"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIeLmYWb8tK-gWfoQYAw7zpYbgwOaL-OGsdGtWkQBk4FVgbbUQex4_BQpvdxAFU5xokk29v881Ypk2wLBiLx-0QY09DZdSCvNqkW0CVGdw8sc9citoSEW2KJBpJEsgs0bG8IIDDcbn7dXk7DZZHAtq-NGvFSqscNAi3TtQUCXYhuuR3kRLD92fDCVwyxcXIxyoZPifxTGlZQFEGO92YZYWtxF_anZ0zF5OmpZjvC-rmW0mV7lVFsA7-O_J5PiK_UxqpvpJUaHuZvEt"
              />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Olivia Carter
                </h2>
                <p className="text-sm text-gray-600">Strength Training</p>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  Workout Program - 2024-07-20
                </h3>
                <button className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                  <span className="material-icons mr-1 text-base">done</span>
                  Done
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Squats</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Bench Press</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Deadlifts</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
              </div>
              <button className="mt-4 flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 font-medium text-gray-500 hover:border-gray-400 hover:bg-gray-100">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
            <div className="my-6 border-t border-gray-200"></div>
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  Workout Program - 2024-07-22
                </h3>
                <button className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                  <span className="material-icons mr-1 text-base">done</span>
                  Done
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Pull-ups</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        Overhead Press
                      </p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center">
                    <button className="mr-2 text-gray-400 hover:text-gray-600">
                      <span className="material-icons">drag_indicator</span>
                    </button>
                    <div className="mr-3 rounded-full bg-gray-200 p-2">
                      <span className="material-icons text-gray-600">
                        fitness_center
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Barbell Rows</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-700">
                    <span className="material-icons">
                      remove_circle_outline
                    </span>
                  </button>
                </div>
              </div>
              <button className="mt-4 flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 font-medium text-gray-500 hover:border-gray-400 hover:bg-gray-100">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
